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

    const response = await fetch(`${loginUrl}?${params.toString()}`, {
        method: 'GET'
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
        const nasProjectFolder = process.env.NAS_PROJECT_FOLDER || '/volume1/projects';

        // 파일 다운로드 API 호출
        const downloadUrl = `${session.baseUrl}/webapi/FileStation/download.cgi`;
        const filePath = `${nasProjectFolder}/${filename}`;
        const params = new URLSearchParams({
            api: 'SYNO.FileStation.Download',
            version: '2',
            method: 'download',
            path: filePath,
            _sid: session.sessionId
        });

        const response = await fetch(`${downloadUrl}?${params.toString()}`, {
            method: 'GET'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[nas-load] HTTP error:', response.status, errorText);
            return res.status(response.status).json({
                error: `Failed to load file: ${response.status}`,
                details: errorText
            });
        }

        const text = await response.text();

        // JSON 응답인지 확인 (에러인 경우)
        try {
            const jsonData = JSON.parse(text);
            if (!jsonData.success) {
                return res.status(400).json({
                    error: 'Failed to load file',
                    message: jsonData.error?.msg || 'Unknown error',
                    code: jsonData.error?.code
                });
            }
        } catch (e) {
            // JSON이 아니면 파일 내용이므로 그대로 반환
            return res.status(200).json({
                success: true,
                content: text
            });
        }

        return res.status(200).json({
            success: true,
            content: text
        });
    } catch (error) {
        console.error('[nas-load] Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
