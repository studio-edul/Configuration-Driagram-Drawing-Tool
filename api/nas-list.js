/**
 * Vercel Serverless Function - NAS 파일 목록 가져오기
 * GET /api/nas-list?sessionId=xxx
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
        const { sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        // 환경변수에서 NAS 설정 가져오기
        const nasHost = process.env.NAS_HOST;
        const nasPort = process.env.NAS_PORT || '5000';
        const nasProtocol = process.env.NAS_PROTOCOL || 'http';
        const nasProjectFolder = process.env.NAS_PROJECT_FOLDER || '/volume1/projects';
        const nasBaseUrl = `${nasProtocol}://${nasHost}:${nasPort}`;

        // NAS 파일 목록 API 호출
        const listUrl = `${nasBaseUrl}/webapi/FileStation/list.cgi`;
        const params = new URLSearchParams({
            api: 'SYNO.FileStation.List',
            version: '2',
            method: 'list',
            folder_path: nasProjectFolder,
            _sid: sessionId
        });

        const response = await fetch(`${listUrl}?${params.toString()}`, {
            method: 'GET'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[nas-list] HTTP error:', response.status, errorText);
            return res.status(response.status).json({
                error: `Failed to list files: ${response.status}`,
                details: errorText
            });
        }

        const data = await response.json();

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
            return res.status(400).json({
                error: 'Failed to list files',
                message: data.error?.msg || 'Unknown error',
                code: data.error?.code
            });
        }
    } catch (error) {
        console.error('[nas-list] Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
