/**
 * NAS Configuration
 * 
 * Vercel Serverless Functions를 통해 NAS에 연결합니다.
 * 인증 정보는 Vercel 환경변수에서 관리됩니다.
 */

export const NAS_CONFIG = {
    // Vercel 사용 (항상 true)
    useVercel: true,
    
    // Vercel API 베이스 URL
    // 로컬 개발 시: 'http://localhost:3000' (Vercel CLI 사용 시)
    // GitHub Pages에서 사용 시: Vercel 배포 URL 입력 필요
    vercelApiUrl: 'https://configuration-driagram-drawing-tool.vercel.app',
    
    /**
     * Vercel API 베이스 URL 가져오기
     */
    getVercelApiUrl() {
        const origin = window.location.origin;
        
        // 로컬 개발 시 (localhost 또는 127.0.0.1)
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return 'http://localhost:3000';
        }
        
        // GitHub Pages에서 실행 시 Vercel 배포 URL 사용
        if (origin.includes('github.io') || origin.includes('github.com')) {
            if (!this.vercelApiUrl) {
                throw new Error('Vercel 배포 URL이 설정되지 않았습니다. nas-config.js의 vercelApiUrl을 설정하세요.');
            }
            return this.vercelApiUrl;
        }
        
        // 기타 경우 (Vercel 배포 환경 등) 현재 origin 사용
        return origin;
    }
};
