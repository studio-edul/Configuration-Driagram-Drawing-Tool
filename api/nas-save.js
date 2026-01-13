/**
 * Vercel Serverless Function - NAS 파일 저장
 * POST /api/nas-save
 * Body: { sessionId: string, filename: string, content: string }
 */
export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, filename, content } = req.body;

        if (!sessionId || !filename || !content) {
            return res.status(400).json({ 
                error: 'Session ID, filename, and content are required' 
            });
        }

        // 환경변수에서 NAS 설정 가져오기
        const nasHost = process.env.NAS_HOST;
        const nasPort = process.env.NAS_PORT || '5000';
        const nasProtocol = process.env.NAS_PROTOCOL || 'http';
        const nasProjectFolder = process.env.NAS_PROJECT_FOLDER || '/volume1/projects';
        const nasBaseUrl = `${nasProtocol}://${nasHost}:${nasPort}`;

        // 폴더가 없으면 생성 시도
        try {
            const createUrl = `${nasBaseUrl}/webapi/FileStation/create_folder.cgi`;
            const createParams = new URLSearchParams({
                api: 'SYNO.FileStation.CreateFolder',
                version: '2',
                method: 'create',
                folder_path: nasProjectFolder,
                name: '',
                force_parent: 'true',
                _sid: sessionId
            });

            await fetch(`${createUrl}?${createParams.toString()}`, {
                method: 'GET'
            });
            // 폴더가 이미 존재하면 에러가 나지만 무시
        } catch (error) {
            console.warn('[nas-save] Folder creation warning:', error.message);
        }

        // 파일 업로드
        const uploadUrl = `${nasBaseUrl}/webapi/FileStation/upload.cgi`;
        
        // Node.js 환경에서 FormData 생성 (Node.js 18+ 내장 FormData 사용)
        const FormData = globalThis.FormData || (await import('form-data')).default;
        const formData = new FormData();
        
        // 파일 내용을 Buffer로 변환하여 추가
        const fileBuffer = Buffer.from(content, 'utf-8');
        formData.append('file', fileBuffer, {
            filename: filename,
            contentType: 'application/json'
        });
        formData.append('path', nasProjectFolder);
        formData.append('overwrite', 'true');
        formData.append('_sid', sessionId);

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[nas-save] HTTP error:', response.status, errorText);
            return res.status(response.status).json({
                error: `Failed to save file: ${response.status}`,
                details: errorText
            });
        }

        const data = await response.json();

        if (data.success) {
            return res.status(200).json({
                success: true,
                message: 'File saved successfully'
            });
        } else {
            return res.status(400).json({
                error: 'Failed to save file',
                message: data.error?.msg || 'Unknown error',
                code: data.error?.code
            });
        }
    } catch (error) {
        console.error('[nas-save] Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
