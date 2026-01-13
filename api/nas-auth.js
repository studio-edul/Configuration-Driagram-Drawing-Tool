/**
 * Vercel Serverless Function - NAS 인증 (환경변수 자동 인증)
 * GET /api/nas-auth - 연결 테스트용
 */

// NAS 로그인 헬퍼 함수 (다른 API에서도 사용)
export async function getNasSession() {
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
        return res.status(200).json({
            success: true,
            message: 'NAS connection successful'
        });
    } catch (error) {
        console.error('[nas-auth] Error:', error);
        return res.status(500).json({
            error: 'NAS connection failed',
            message: error.message
        });
    }
}
