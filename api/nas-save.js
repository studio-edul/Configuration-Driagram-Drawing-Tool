/**
 * Vercel Serverless Function - NAS 파일 저장 (자동 인증)
 * POST /api/nas-save
 * Body: { filename: string, content: string }
 */

// NAS 로그인 헬퍼 함수
async function getNasSession() {
    const nasHost = process.env.NAS_HOST;
    const nasPort = process.env.NAS_PORT || '5001';
    const nasProtocol = process.env.NAS_PROTOCOL || 'https';
    const nasUsername = process.env.NAS_USERNAME;
    const nasPassword = process.env.NAS_PASSWORD;

    if (!nasHost || !nasUsername || !nasPassword) {
        console.error('[getNasSession] Missing environment variables:', {
            host: !!nasHost,
            username: !!nasUsername,
            password: !!nasPassword
        });
        throw new Error('NAS environment variables are not set');
    }

    const nasBaseUrl = `${nasProtocol}://${nasHost}:${nasPort}`;
    console.log('[getNasSession] Connecting to NAS:', nasBaseUrl.replace(/\/\/.*@/, '//***:***@'));

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
    // undici의 fetch는 dispatcher 옵션을 통해 SSL 검증을 무시할 수 있음
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
        const errorText = await response.text();
        console.error('[getNasSession] HTTP error:', response.status, errorText);
        throw new Error(`NAS connection failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[getNasSession] NAS response:', JSON.stringify(data, null, 2));

    if (data.success) {
        return {
            sessionId: data.data.sid,
            baseUrl: nasBaseUrl
        };
    } else {
        console.error('[getNasSession] Authentication failed:', {
            error: data.error,
            code: data.error?.code,
            message: data.error?.msg
        });
        throw new Error(data.error?.msg || `Authentication failed (code: ${data.error?.code || 'unknown'})`);
    }
}

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
        console.log('[nas-save] Request received');
        console.log('[nas-save] Environment check:', {
            hasHost: !!process.env.NAS_HOST,
            hasUsername: !!process.env.NAS_USERNAME,
            hasPassword: !!process.env.NAS_PASSWORD
        });

        const { filename, content } = req.body;

        if (!filename || !content) {
            console.error('[nas-save] Missing required fields:', { filename: !!filename, content: !!content });
            return res.status(400).json({
                error: 'Filename and content are required'
            });
        }

        console.log('[nas-save] Attempting NAS authentication...');
        // 자동 인증
        const session = await getNasSession();
        console.log('[nas-save] NAS authentication successful');
        let nasProjectFolder = process.env.NAS_PROJECT_FOLDER || '/volume1/projects';

        // Remove /volume number prefix if present (e.g. /volume1/web -> /web)
        // Synology FileStation API expects paths without volume prefix
        if (nasProjectFolder.match(/^\/volume\d+/)) {
            console.log('[nas-save] Removing volume prefix from path:', nasProjectFolder);
            nasProjectFolder = nasProjectFolder.replace(/^\/volume\d+/, '');
        }

        // SSL 검증 무시 agent 생성
        const { Agent } = await import('undici');
        const agent = new Agent({
            connect: {
                rejectUnauthorized: false
            }
        });

        // 폴더가 없으면 생성 시도 (경로를 순차적으로 생성)
        console.log('[nas-save] Target folder:', nasProjectFolder);

        // 경로를 분리하여 각 폴더를 순차적으로 생성
        const pathParts = nasProjectFolder.split('/').filter(p => p);
        let currentPath = '';

        for (let i = 0; i < pathParts.length; i++) {
            const parentPath = currentPath || '/';
            const folderName = pathParts[i];
            currentPath = currentPath ? `${currentPath}/${folderName}` : `/${folderName}`;

            try {
                const createUrl = `${session.baseUrl}/webapi/entry.cgi`;
                const createParams = new URLSearchParams({
                    api: 'SYNO.FileStation.CreateFolder',
                    version: '2',
                    method: 'create',
                    folder_path: parentPath,
                    name: folderName,
                    force_parent: 'true',
                    _sid: session.sessionId
                });

                const createResponse = await fetch(`${createUrl}?${createParams.toString()}`, {
                    method: 'GET',
                    dispatcher: agent
                });

                if (!createResponse.ok) {
                    const createErrorText = await createResponse.text();
                    // 408 에러는 폴더가 이미 존재하는 경우이므로 무시
                    if (createResponse.status !== 408) {
                        console.warn(`[nas-save] Folder creation warning for ${currentPath}:`, createResponse.status, createErrorText.substring(0, 200));
                    }
                } else {
                    const createData = await createResponse.json();
                    if (createData.success) {
                        console.log(`[nas-save] Folder created: ${currentPath}`);
                    }
                }
            } catch (error) {
                // 폴더가 이미 존재하는 경우는 무시
                console.warn(`[nas-save] Folder creation warning for ${currentPath}:`, error.message);
            }
        }

        // 파일 업로드
        // Synology FileStation Upload API는 entry.cgi를 사용
        // _sid를 URL 파라미터로 명시해야 119 에러(Invalid Session)를 방지할 수 있음 (가장 확실한 방법)
        const uploadUrl = `${session.baseUrl}/webapi/entry.cgi?_sid=${encodeURIComponent(session.sessionId)}`;
        console.log('[nas-save] Upload URL:', uploadUrl.replace(session.sessionId, '***'));
        console.log('[nas-save] Upload path:', nasProjectFolder);
        console.log('[nas-save] Filename:', filename);

        // form-data 패키지 사용 (파일 업로드에 필요)
        const FormData = (await import('form-data')).default;
        const formData = new FormData();

        // 파일 내용을 Buffer로 변환 (먼저 준비)
        const fileBuffer = Buffer.from(content, 'utf-8');

        // API 파라미터 추가 (예시 코드와 동일한 순서)
        formData.append('api', 'SYNO.FileStation.Upload');
        formData.append('version', '2');
        formData.append('method', 'upload');
        formData.append('path', nasProjectFolder);
        formData.append('create_parents', 'true');
        formData.append('_sid', session.sessionId);

        // 파일은 마지막에 추가 (예시 코드와 동일한 형식)
        formData.append('file', fileBuffer, {
            filename: filename,
            contentType: 'application/json'
        });

        // 디버깅: 전송되는 파라미터 확인
        const headers = formData.getHeaders();

        // 쿠키에도 세션 ID 추가 (호환성 강화, 일부 DSM 버전에서 요구할 수 있음)
        headers['Cookie'] = `id=${session.sessionId}`;

        console.log('[nas-save] Form data headers:', headers);
        console.log('[nas-save] Form data length:', fileBuffer.length);
        console.log('[nas-save] File content preview:', content.substring(0, 200));
        console.log('[nas-save] Upload parameters:', {
            api: 'SYNO.FileStation.Upload',
            version: '2',
            method: 'upload',
            path: nasProjectFolder,
            create_parents: 'true',
            _sid: session.sessionId.substring(0, 20) + '...',
            filename: filename
        });

        // axios 사용 (예시 코드와 동일)
        const axios = (await import('axios')).default;
        const https = await import('https');

        // SSL 인증서 검증 무시를 위한 https agent 생성
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        // 세션 ID 확인
        console.log('[nas-save] Session ID:', session.sessionId);
        console.log('[nas-save] Form data _sid check:', formData._streams?.some(s => typeof s === 'string' && s.includes('_sid')));

        try {
            const response = await axios.post(uploadUrl, formData, {
                headers: headers,
                httpsAgent: httpsAgent,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                validateStatus: function (status) {
                    return status < 500; // 500 이상만 에러로 처리
                }
            });

            console.log('[nas-save] Upload response status:', response.status);
            console.log('[nas-save] Upload response data:', JSON.stringify(response.data, null, 2));

            const data = response.data;

            if (data.success) {
                return res.status(200).json({
                    success: true,
                    message: 'File saved successfully'
                });
            } else {
                console.error('[nas-save] Upload failed:', {
                    error: data.error,
                    code: data.error?.code,
                    message: data.error?.msg
                });
                return res.status(400).json({
                    error: 'Failed to save file',
                    message: data.error?.msg || 'Unknown error',
                    code: data.error?.code
                });
            }
        } catch (axiosError) {
            console.error('[nas-save] Axios error:', axiosError.message);
            if (axiosError.response) {
                console.error('[nas-save] Response status:', axiosError.response.status);
                console.error('[nas-save] Response data:', axiosError.response.data);
                return res.status(axiosError.response.status).json({
                    error: 'Failed to save file',
                    message: axiosError.response.data?.error?.msg || axiosError.message,
                    code: axiosError.response.data?.error?.code
                });
            }
            throw axiosError;
        }
    } catch (error) {
        console.error('[nas-save] Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
