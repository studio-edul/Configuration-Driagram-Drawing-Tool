/**
 * Vercel Serverless Function - NAS 파일 목록 가져오기 (자동 인증)
 * GET /api/nas-list
 */

// NAS 로그인 헬퍼 함수
async function getNasSession() {
    const nasHost = process.env.NAS_HOST;
    const nasPort = process.env.NAS_PORT || '5001';
    const nasProtocol = process.env.NAS_PROTOCOL || 'https';
    const nasUsername = process.env.NAS_USERNAME;
    const nasPassword = process.env.NAS_PASSWORD;
    const nasBaseUrl = `${nasProtocol}://${nasHost}:${nasPort}`;

    const loginUrl = `${nasBaseUrl}/webapi/auth.cgi`;
    const params = new URLSearchParams({
        api: 'SYNO.API.Auth',
        version: '7',
        method: 'login',
        account: nasUsername,
        passwd: nasPassword,
        session: 'FileStation',
        format: 'sid'
    });

    // Node.js 환경에서 SSL 인증서 검증 무시 (자체 서명 인증서용)
    // undici의 Agent를 사용하여 SSL 검증 무시
    const { Agent } = await import('undici');
    const agent = new Agent({
        connect: {
            rejectUnauthorized: false
        }
    });

    const response = await fetch(`${loginUrl}?${params.toString()}`, {
        method: 'GET',
        dispatcher: agent
    });

    if (!response.ok) {
        throw new Error(`NAS connection failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
        return {
            sessionId: data.data.sid,
            baseUrl: nasBaseUrl
        };
    } else {
        throw new Error(data.error?.msg || 'Authentication failed');
    }
}

export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getNasSession();
        let nasProjectFolder = process.env.NAS_PROJECT_FOLDER || '/volume1/projects';

        // Remove /volume number prefix if present (e.g. /volume1/web -> /web)
        if (nasProjectFolder.match(/^\/volume\d+/)) {
            nasProjectFolder = nasProjectFolder.replace(/^\/volume\d+/, '');
        }

        // axios 및 https 모듈 로드
        const axios = (await import('axios')).default;
        const https = await import('https');

        // SSL 인증서 검증 무시를 위한 https agent 생성
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        // NAS 파일 목록 API 호출
        // list.cgi 대신 entry.cgi 사용 (표준 엔드포인트)
        const listUrl = `${session.baseUrl}/webapi/entry.cgi`;
        const params = new URLSearchParams({
            api: 'SYNO.FileStation.List',
            version: '2',
            method: 'list',
            folder_path: nasProjectFolder,
            _sid: session.sessionId
        });

        console.log('[nas-list] Calling NAS API (POST):', listUrl);

        try {
            const response = await axios.post(listUrl, params, {
                httpsAgent: httpsAgent,
                headers: {
                    'Cookie': `id=${session.sessionId}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                validateStatus: function (status) {
                    return status < 500; // 500 이상만 에러로 처리
                }
            });

            if (response.status !== 200) {
                console.error('[nas-list] HTTP error:', response.status, response.data);
                return res.status(response.status).json({
                    error: `Failed to list files: ${response.status}`,
                    details: response.data
                });
            }

            const data = response.data;

            if (data.success) {
                // .cdt 파일만 필터링
                const files = data.data.files || [];
                const projects = files
                    .filter(file => file.name.endsWith('.cdt'))
                    .map(file => ({
                        name: file.name,
                        path: file.path,
                        size: file.size,
                        modified: file.mtime
                    }));

                return res.status(200).json({
                    success: true,
                    projects
                });
            } else {
                console.error('[nas-list] NAS API error:', data.error);
                return res.status(400).json({
                    error: 'Failed to list files',
                    message: data.error?.msg || 'Unknown error',
                    code: data.error?.code
                });
            }
        } catch (axiosError) {
            console.error('[nas-list] Axios error:', axiosError.message);
            if (axiosError.response) {
                console.error('[nas-list] Response data:', axiosError.response.data);
            }
            throw axiosError;
        }

    } catch (error) {
        console.error('[nas-list] Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
