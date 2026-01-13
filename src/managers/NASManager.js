import { NAS_CONFIG } from '../config/nas-config.js';

/**
 * NAS Manager - Vercel API를 통한 NAS 연동
 * 인증은 서버에서 자동으로 처리됨
 */
export class NASManager {
    constructor() {
        // 세션 관리 불필요 (서버에서 자동 인증)
    }

    /**
     * 프로젝트 파일 목록 가져오기
     * @returns {Promise<Array>} 프로젝트 파일 목록
     */
    async listProjects() {
        try {
            const vercelApiUrl = NAS_CONFIG.getVercelApiUrl();
            const response = await fetch(`${vercelApiUrl}/api/nas-list`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                // 응답이 JSON인지 확인
                const contentType = response.headers.get('content-type');
                let errorData;
                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.json();
                } else {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText || 'Server error'}`);
                }
                throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                return data.projects || [];
            } else {
                throw new Error(data.message || '파일 목록을 가져오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('[NASManager] List projects error:', error);
            throw error;
        }
    }

    /**
     * 프로젝트 파일 저장
     * @param {string} filename - 저장할 파일명 (예: 'project.cdt')
     * @param {string} content - JSON 문자열
     * @returns {Promise<boolean>} 저장 성공 여부
     */
    async saveProject(filename, content) {
        try {
            const vercelApiUrl = NAS_CONFIG.getVercelApiUrl();
            const response = await fetch(`${vercelApiUrl}/api/nas-save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: filename,
                    content: content
                })
            });

            if (!response.ok) {
                // 응답이 JSON인지 확인
                const contentType = response.headers.get('content-type');
                let errorData;
                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.json();
                } else {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText || 'Server error'}`);
                }
                throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                console.log('[NASManager] Project saved:', filename);
                return true;
            } else {
                throw new Error(data.message || '파일 저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('[NASManager] Save project error:', error);
            throw error;
        }
    }

    /**
     * 프로젝트 파일 불러오기
     * @param {string} filename - 불러올 파일명
     * @returns {Promise<string>} 파일 내용 (JSON 문자열)
     */
    async loadProject(filename) {
        try {
            const vercelApiUrl = NAS_CONFIG.getVercelApiUrl();
            const response = await fetch(`${vercelApiUrl}/api/nas-load?filename=${encodeURIComponent(filename)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                // 응답이 JSON인지 확인
                const contentType = response.headers.get('content-type');
                let errorData;
                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.json();
                } else {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText || 'Server error'}`);
                }
                throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                return data.content;
            } else {
                throw new Error(data.message || '파일을 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('[NASManager] Load project error:', error);
            throw error;
        }
    }

    /**
     * NAS 연결 테스트
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async testConnection() {
        try {
            const vercelApiUrl = NAS_CONFIG.getVercelApiUrl();
            const response = await fetch(`${vercelApiUrl}/api/nas-auth`, {
                method: 'GET'
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            return data.success === true;
        } catch (error) {
            console.error('[NASManager] Connection test error:', error);
            return false;
        }
    }
}
