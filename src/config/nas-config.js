/**
 * NAS Configuration
 * 
 * Vercel Serverless Functions를 통해 NAS에 연결합니다.
 * 인증 정보는 Vercel 환경변수에서 관리됩니다.
 */

export const NAS_CONFIG = {
    // Vercel 사용 (항상 true)
    useVercel: true,
    
    // Vercel API 베이스 URL (빈 문자열이면 현재 origin 사용)
    vercelApiUrl: '',
    
    /**
     * Vercel API 베이스 URL 가져오기
     */
    getVercelApiUrl() {
        if (this.vercelApiUrl) {
            return this.vercelApiUrl;
        }
        return window.location.origin;
    }
};
