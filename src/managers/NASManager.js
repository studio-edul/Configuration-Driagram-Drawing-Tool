import { NAS_CONFIG } from '../config/nas-config.js';

/**
 * NAS Manager - Synology DSM API 클라이언트
 * 내부망에서 직접 NAS와 통신하는 역할
 */
export class NASManager {
    constructor() {
        this.sessionId = null;
        this.isConnected = false;
    }

    /**
     * NAS 연결 테스트 및 인증
     * @param {string} username - NAS 사용자명
     * @param {string} password - NAS 비밀번호
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async connect(username, password) {
        try {
            if (NAS_CONFIG.useVercel) {
                // Vercel Serverless Functions 사용
                const vercelApiUrl = NAS_CONFIG.getVercelApiUrl();
                const response = await fetch(`${vercelApiUrl}/api/nas-auth`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username || NAS_CONFIG.username,
                        password: password || NAS_CONFIG.password
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.success) {
                    this.sessionId = data.sessionId;
                    this.isConnected = true;
                    console.log('[NASManager] Connected via Vercel, SID:', this.sessionId);
                    return true;
                } else {
                    throw new Error(data.message || '인증 실패');
                }
            } else {
                // 직접 NAS API 호출 (내부망)
                const loginUrl = NAS_CONFIG.getApiUrl('/webapi/auth.cgi');
                
                const params = new URLSearchParams({
                    api: 'SYNO.API.Auth',
                    version: '7',
                    method: 'login',
                    account: username || NAS_CONFIG.username,
                    passwd: password || NAS_CONFIG.password,
                    session: 'FileStation',
                    format: 'sid'
                });

                const fullUrl = `${loginUrl}?${params.toString()}`;
                console.log('[NASManager] Attempting to connect to:', fullUrl.replace(/passwd=[^&]+/, 'passwd=***'));

                const response = await fetch(fullUrl, {
                    method: 'GET',
                    credentials: 'omit',
                    mode: 'cors'
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[NASManager] HTTP error response:', response.status, errorText);
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                console.log('[NASManager] Login response:', data);
                
                if (data.success) {
                    this.sessionId = data.data.sid;
                    this.isConnected = true;
                    console.log('[NASManager] Connected successfully, SID:', this.sessionId);
                    return true;
                } else {
                    const errorMsg = data.error?.msg || '인증 실패';
                    const errorCode = data.error?.code || 'unknown';
                    throw new Error(`인증 실패 (코드: ${errorCode}): ${errorMsg}`);
                }
            }
        } catch (error) {
            console.error('[NASManager] Connection error:', error);
            this.isConnected = false;
            this.sessionId = null;
            
            // CORS 에러를 명확히 구분
            if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
                throw new Error('CORS 정책에 의해 차단되었습니다. 브라우저에서 직접 NAS API를 호출할 수 없습니다. NAS 설정에서 CORS를 허용하거나, 프록시 서버(Vercel 등)를 사용해야 합니다.');
            }
            
            throw error;
        }
    }

    /**
     * NAS 연결 해제
     */
    async disconnect() {
        if (!this.sessionId) return;

        try {
            const logoutUrl = NAS_CONFIG.getApiUrl('/webapi/auth.cgi');
            const params = new URLSearchParams({
                api: 'SYNO.API.Auth',
                version: '7',
                method: 'logout',
                session: 'FileStation'
            });

            await fetch(`${logoutUrl}?${params.toString()}`, {
                method: 'GET',
                credentials: 'omit'
            });

            this.sessionId = null;
            this.isConnected = false;
            console.log('[NASManager] Disconnected');
        } catch (error) {
            console.error('[NASManager] Disconnect error:', error);
        }
    }

    /**
     * 프로젝트 파일 목록 가져오기
     * @returns {Promise<Array>} 프로젝트 파일 목록
     */
    async listProjects() {
        if (!this.isConnected || !this.sessionId) {
            throw new Error('NAS에 연결되지 않았습니다. 먼저 연결해주세요.');
        }

        try {
            if (NAS_CONFIG.useVercel) {
                // Vercel Serverless Functions 사용
                const vercelApiUrl = NAS_CONFIG.getVercelApiUrl();
                const response = await fetch(`${vercelApiUrl}/api/nas-list?sessionId=${this.sessionId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.success) {
                    return data.projects || [];
                } else {
                    throw new Error(data.message || '파일 목록을 가져오는데 실패했습니다.');
                }
            } else {
                // 직접 NAS API 호출
                const listUrl = NAS_CONFIG.getApiUrl('/webapi/FileStation/list.cgi');
                const params = new URLSearchParams({
                    api: 'SYNO.FileStation.List',
                    version: '2',
                    method: 'list',
                    folder_path: NAS_CONFIG.projectFolder,
                    _sid: this.sessionId
                });

                const response = await fetch(`${listUrl}?${params.toString()}`, {
                    method: 'GET',
                    credentials: 'omit'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.success) {
                    // .cdt 파일만 필터링
                    const files = data.data.files || [];
                    return files
                        .filter(file => file.name.endsWith('.cdt'))
                        .map(file => ({
                            name: file.name,
                            path: file.path,
                            size: file.size,
                            modified: file.mtime
                        }));
                } else {
                    throw new Error(data.error?.msg || '파일 목록을 가져오는데 실패했습니다.');
                }
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
        if (!this.isConnected || !this.sessionId) {
            throw new Error('NAS에 연결되지 않았습니다. 먼저 연결해주세요.');
        }

        try {
            if (NAS_CONFIG.useVercel) {
                // Vercel Serverless Functions 사용
                const vercelApiUrl = NAS_CONFIG.getVercelApiUrl();
                const response = await fetch(`${vercelApiUrl}/api/nas-save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sessionId: this.sessionId,
                        filename: filename,
                        content: content
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.success) {
                    console.log('[NASManager] Project saved via Vercel:', filename);
                    return true;
                } else {
                    throw new Error(data.message || '파일 저장에 실패했습니다.');
                }
            } else {
                // 직접 NAS API 호출
                // 폴더가 없으면 생성
                await this.ensureFolderExists();

                const uploadUrl = NAS_CONFIG.getApiUrl('/webapi/FileStation/upload.cgi');
                const formData = new FormData();
                
                // 파일 내용을 Blob으로 변환
                const blob = new Blob([content], { type: 'application/json' });
                formData.append('file', blob, filename);
                formData.append('path', NAS_CONFIG.projectFolder);
                formData.append('overwrite', 'true');
                formData.append('_sid', this.sessionId);

                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    body: formData,
                    credentials: 'omit'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.success) {
                    console.log('[NASManager] Project saved:', filename);
                    return true;
                } else {
                    throw new Error(data.error?.msg || '파일 저장에 실패했습니다.');
                }
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
        if (!this.isConnected || !this.sessionId) {
            throw new Error('NAS에 연결되지 않았습니다. 먼저 연결해주세요.');
        }

        try {
            if (NAS_CONFIG.useVercel) {
                // Vercel Serverless Functions 사용
                const vercelApiUrl = NAS_CONFIG.getVercelApiUrl();
                const response = await fetch(`${vercelApiUrl}/api/nas-load?sessionId=${this.sessionId}&filename=${encodeURIComponent(filename)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.success) {
                    return data.content;
                } else {
                    throw new Error(data.message || '파일을 불러오는데 실패했습니다.');
                }
            } else {
                // 직접 NAS API 호출
                const downloadUrl = NAS_CONFIG.getApiUrl('/webapi/FileStation/download.cgi');
                const filePath = `${NAS_CONFIG.projectFolder}/${filename}`;
                const params = new URLSearchParams({
                    api: 'SYNO.FileStation.Download',
                    version: '2',
                    method: 'download',
                    path: filePath,
                    _sid: this.sessionId
                });

                const response = await fetch(`${downloadUrl}?${params.toString()}`, {
                    method: 'GET',
                    credentials: 'omit'
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const text = await response.text();
                
                // JSON 응답인지 확인 (에러인 경우)
                try {
                    const jsonData = JSON.parse(text);
                    if (!jsonData.success) {
                        throw new Error(jsonData.error?.msg || '파일을 불러오는데 실패했습니다.');
                    }
                } catch (e) {
                    // JSON이 아니면 파일 내용이므로 그대로 반환
                    return text;
                }

                return text;
            }
        } catch (error) {
            console.error('[NASManager] Load project error:', error);
            throw error;
        }
    }

    /**
     * 프로젝트 폴더가 존재하는지 확인하고 없으면 생성
     * @private
     */
    async ensureFolderExists() {
        try {
            const createUrl = NAS_CONFIG.getApiUrl('/webapi/FileStation/create_folder.cgi');
            const params = new URLSearchParams({
                api: 'SYNO.FileStation.CreateFolder',
                version: '2',
                method: 'create',
                folder_path: NAS_CONFIG.projectFolder,
                name: '',
                force_parent: 'true',
                _sid: this.sessionId
            });

            const response = await fetch(`${createUrl}?${params.toString()}`, {
                method: 'GET',
                credentials: 'omit'
            });

            const data = await response.json();
            // 폴더가 이미 존재하면 에러가 나지만 무시
            if (!data.success && data.error?.code !== 1100) {
                console.warn('[NASManager] Folder creation warning:', data.error?.msg);
            }
        } catch (error) {
            console.warn('[NASManager] Folder check error:', error);
            // 폴더 생성 실패는 무시 (이미 존재할 수 있음)
        }
    }

    /**
     * 네트워크 연결 가능 여부 확인 (NAS 도달 가능성 테스트)
     * @returns {Promise<boolean>} 연결 가능 여부
     */
    async checkConnection() {
        try {
            const testUrl = NAS_CONFIG.getBaseUrl();
            const response = await fetch(testUrl, {
                method: 'HEAD',
                mode: 'no-cors', // CORS 우회 시도
                credentials: 'omit'
            });
            return true;
        } catch (error) {
            console.warn('[NASManager] Connection check failed:', error);
            return false;
        }
    }
}
