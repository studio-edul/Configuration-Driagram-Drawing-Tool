/**
 * NAS Configuration
 * 
 * ⚠️ 보안 주의: 이 파일은 GitHub에 공개되므로 실제 배포 전에는
 * Vercel 환경변수나 사용자 입력 방식으로 변경해야 합니다.
 * 
 * 현재는 개발/테스트 목적으로만 사용합니다.
 */

export const NAS_CONFIG = {
    // Vercel 사용 여부
    // true: Vercel Serverless Functions 사용 (외부망 접속 가능)
    // false: 직접 NAS API 호출 (내부망만 가능, CORS 문제 발생 가능)
    useVercel: true,
    
    // Vercel API 베이스 URL (배포 후 실제 URL로 변경 필요)
    // 예: 'https://your-project.vercel.app' 또는 'http://localhost:3000' (로컬 개발 시)
    vercelApiUrl: '', // 빈 문자열이면 현재 origin 사용
    
    // NAS 접속 정보 (직접 연결 시에만 사용)
    // 예: '192.168.1.100' 또는 'nas.example.com'
    host: '192.168.10.180',
    
    // 포트 번호
    // HTTP: 기본 5000, HTTPS: 기본 5001
    // 사용자 정의 포트: 11477
    port: 11477,
    
    // 프로토콜 (http 또는 https)
    // SSL 인증서 오류 방지를 위해 HTTP 사용 (내부망 환경)
    protocol: 'http',
    
    // 저장 폴더 경로
    // 예: '/volume1/projects' 또는 '/web/projects'
    projectFolder: '/volume1/projects',
    
    // 사용자 계정 정보 (나중에 사용자 입력으로 변경 예정)
    // 현재는 개발용으로만 사용
    username: 'jiwon.lee',
    password: 'czjNNM$1',
    
    // API 버전
    apiVersion: '7',
    
    // FileStation API 이름
    fileStationApi: 'SYNO.FileStation',
    
    /**
     * Vercel API 베이스 URL 가져오기
     */
    getVercelApiUrl() {
        if (this.vercelApiUrl) {
            return this.vercelApiUrl;
        }
        // 빈 문자열이면 현재 origin 사용 (같은 도메인에서 호출)
        return window.location.origin;
    },
    
    /**
     * NAS 기본 URL 생성 (직접 연결 시)
     */
    getBaseUrl() {
        return `${this.protocol}://${this.host}:${this.port}`;
    },
    
    /**
     * API 엔드포인트 URL 생성 (직접 연결 시)
     */
    getApiUrl(endpoint) {
        return `${this.getBaseUrl()}${endpoint}`;
    }
};
