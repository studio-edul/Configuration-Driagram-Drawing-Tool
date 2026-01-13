/**
 * Vercel Serverless Function - NAS 파일 불러오기
 * GET /api/nas-load?sessionId=xxx&filename=xxx
 */
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
        const { sessionId, filename } = req.query;

        if (!sessionId || !filename) {
            return res.status(400).json({ 
                error: 'Session ID and filename are required' 
            });
        }

        // 환경변수에서 NAS 설정 가져오기
        const nasHost = process.env.NAS_HOST;
        const nasPort = process.env.NAS_PORT || '5000';
        const nasProtocol = process.env.NAS_PROTOCOL || 'http';
        const nasProjectFolder = process.env.NAS_PROJECT_FOLDER || '/volume1/projects';
        const nasBaseUrl = `${nasProtocol}://${nasHost}:${nasPort}`;

        // 파일 다운로드 API 호출
        const downloadUrl = `${nasBaseUrl}/webapi/FileStation/download.cgi`;
        const filePath = `${nasProjectFolder}/${filename}`;
        const params = new URLSearchParams({
            api: 'SYNO.FileStation.Download',
            version: '2',
            method: 'download',
            path: filePath,
            _sid: sessionId
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
