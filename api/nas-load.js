/**
 * Vercel Serverless Function - NAS 파일 불러오기 (자동 인증)
 * GET /api/nas-load?filename=xxx
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
        const { filename } = req.query;

        if (!filename) {
            return res.status(400).json({
                error: 'Filename is required'
            });
        }

        // 자동 인증
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

        // 파일 다운로드 API 호출
        // download.cgi 대신 entry.cgi 사용 (표준 엔드포인트)
        const downloadUrl = `${session.baseUrl}/webapi/entry.cgi`;
        const filePath = `${nasProjectFolder}/${filename}`;
        const params = new URLSearchParams({
            api: 'SYNO.FileStation.Download',
            version: '2',
            method: 'download',
            path: filePath,
            _sid: session.sessionId
        });

        console.log('[nas-load] Calling NAS API:', downloadUrl);
        console.log('[nas-load] File path:', filePath);

        try {
            const response = await axios.get(`${downloadUrl}?${params.toString()}`, {
                httpsAgent: httpsAgent,
                headers: {
                    'Cookie': `id=${session.sessionId}`
                },
                responseType: 'text', // 텍스트로 받음 (JSON 파일이므로)
                validateStatus: function (status) {
                    return status < 500;
                }
            });

            if (response.status !== 200) {
                console.error('[nas-load] HTTP error:', response.status);
                return res.status(response.status).json({
                    error: `Failed to load file: ${response.status}`,
                    details: response.data
                });
            }

            // response.data가 이미 객체(JSON)일 수도 있고, 문자열일 수도 있음
            const content = typeof response.data === 'object' ? JSON.stringify(response.data) : response.data;

            // NAS가 에러 JSON을 반환했는지 확인 (성공 시에는 파일 내용 자체가 옴)
            try {
                // 만약 파일 내용이 우연히 success:false를 포함한 JSON이라면 오판할 수 있으나,
                // Synology 에러는 보통 {error: {code: ...}, success: false} 형태임.
                if (typeof response.data === 'object' && response.data.success === false) {
                    console.error('[nas-load] NAS API error:', response.data.error);
                    return res.status(400).json({
                        error: 'Failed to load file',
                        message: response.data.error?.msg || 'Unknown error',
                        code: response.data.error?.code
                    });
                }
            } catch (e) {
                // Ignore parsing error
            }

            return res.status(200).json({
                success: true,
                content: content
            });

        } catch (axiosError) {
            console.error('[nas-load] Axios error:', axiosError.message);
            if (axiosError.response) {
                console.error('[nas-load] Response data:', axiosError.response.data);
            }
            throw axiosError;
        }

    } catch (error) {
        console.error('[nas-load] Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
