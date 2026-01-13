/**
 * Vercel Serverless Function - NAS 인증
 * POST /api/nas-auth
 * Body: { username: string, password: string }
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
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // 환경변수에서 NAS 설정 가져오기
        const nasHost = process.env.NAS_HOST;
        const nasPort = process.env.NAS_PORT || '5000';
        const nasProtocol = process.env.NAS_PROTOCOL || 'http';
        const nasBaseUrl = `${nasProtocol}://${nasHost}:${nasPort}`;

        // NAS 로그인 API 호출
        const loginUrl = `${nasBaseUrl}/webapi/auth.cgi`;
        const params = new URLSearchParams({
            api: 'SYNO.API.Auth',
            version: '7',
            method: 'login',
            account: username,
            passwd: password,
            session: 'FileStation',
            format: 'sid'
        });

        const response = await fetch(`${loginUrl}?${params.toString()}`, {
            method: 'GET'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[nas-auth] HTTP error:', response.status, errorText);
            return res.status(response.status).json({ 
                error: `NAS connection failed: ${response.status}`,
                details: errorText 
            });
        }

        const data = await response.json();

        if (data.success) {
            return res.status(200).json({
                success: true,
                sessionId: data.data.sid
            });
        } else {
            return res.status(401).json({
                error: 'Authentication failed',
                message: data.error?.msg || 'Invalid credentials',
                code: data.error?.code
            });
        }
    } catch (error) {
        console.error('[nas-auth] Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
