import { APP_VERSION } from '../config/version.js';
import { NASManager } from './NASManager.js';

export class ProjectManager {
    constructor(dataStore, visualizer) {
        this.dataStore = dataStore;
        this.visualizer = visualizer;
        this.currentVersion = APP_VERSION;
        this.nasManager = new NASManager();
        this.nasLoginPromise = null; // 로그인 모달 Promise 저장
        this.initNASLoginModal();
    }

    /**
     * NAS 로그인 모달 초기화
     */
    initNASLoginModal() {
        const modal = document.getElementById('nas-login-modal');
        const usernameInput = document.getElementById('nas-username-input');
        const passwordInput = document.getElementById('nas-password-input');
        const confirmButton = document.getElementById('btn-confirm-nas-login');
        const cancelButton = document.getElementById('btn-cancel-nas-login');

        if (!modal || !usernameInput || !passwordInput || !confirmButton || !cancelButton) {
            console.warn('NAS login modal elements not found');
            return;
        }

        // 취소 버튼
        cancelButton.addEventListener('click', () => {
            this.closeNASLoginModal();
            if (this.nasLoginPromise) {
                this.nasLoginPromise.reject(new Error('로그인이 취소되었습니다.'));
                this.nasLoginPromise = null;
            }
        });

        // 확인 버튼
        confirmButton.addEventListener('click', () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                alert('사용자명과 비밀번호를 모두 입력해주세요.');
                return;
            }

            if (this.nasLoginPromise) {
                this.nasLoginPromise.resolve({ username, password });
                this.nasLoginPromise = null;
            }
            this.closeNASLoginModal();
        });

        // Enter 키로 로그인
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmButton.click();
            }
        });

        // 모달 외부 클릭 시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeNASLoginModal();
                if (this.nasLoginPromise) {
                    this.nasLoginPromise.reject(new Error('로그인이 취소되었습니다.'));
                    this.nasLoginPromise = null;
                }
            }
        });
    }

    /**
     * NAS 로그인 모달 열기
     * @returns {Promise<{username: string, password: string}>}
     */
    showNASLoginModal() {
        return new Promise((resolve, reject) => {
            const modal = document.getElementById('nas-login-modal');
            const usernameInput = document.getElementById('nas-username-input');
            const passwordInput = document.getElementById('nas-password-input');

            if (!modal || !usernameInput || !passwordInput) {
                reject(new Error('로그인 모달을 찾을 수 없습니다.'));
                return;
            }

            // 입력 필드 초기화
            usernameInput.value = '';
            passwordInput.value = '';

            // Promise 저장
            this.nasLoginPromise = { resolve, reject };

            // 모달 표시
            modal.classList.remove('hidden');
            usernameInput.focus();
        });
    }

    /**
     * NAS 로그인 모달 닫기
     */
    closeNASLoginModal() {
        const modal = document.getElementById('nas-login-modal');
        const usernameInput = document.getElementById('nas-username-input');
        const passwordInput = document.getElementById('nas-password-input');

        if (modal) {
            modal.classList.add('hidden');
        }
        if (usernameInput) {
            usernameInput.value = '';
        }
        if (passwordInput) {
            passwordInput.value = '';
        }
    }

    /**
     * Export project to JSON file with file picker
     */
    async exportProject() {
        try {
            const state = this.dataStore.getState();
            
            // Create export object with version info
            const exportData = {
                version: this.currentVersion,
                exportedAt: new Date().toISOString(),
                meta: {
                    mode: state.meta.mode,
                    floorPlanImage: state.meta.floorPlanImage || null,
                    projectName: state.meta.projectName || 'ProjectName_SystemConfiguration_IMfine',
                    hardwareList: state.meta.hardwareList || [],
                    hardwareListMetadata: state.meta.hardwareListMetadata || {},
                    bomMetadata: state.meta.bomMetadata || {},
                    configurationConnectionOrder: state.meta.configurationConnectionOrder || {},
                    installationConnectionOrder: state.meta.installationConnectionOrder || {},
                    networkConnectionOrder: state.meta.networkConnectionOrder || {}
                },
                nodes: state.nodes || {},
                networkNodes: state.networkNodes || {},
                configurationConnections: state.configurationConnections || {},
                installationConnections: state.installationConnections || {},
                networkConnections: state.networkConnections || {},
                requests: state.requests || {}
            };

            // Convert to JSON string with pretty formatting
            const jsonString = JSON.stringify(exportData, null, 2);
            
            // Default filename format: SystemConfiguration_IMfine_(오늘 날짜)
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
            const defaultFilename = `SystemConfiguration_IMfine_${dateStr}.cdt`;
            
            // Try to use File System Access API (modern browsers)
            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: defaultFilename,
                        types: [{
                            description: 'Configuration Diagram Tool Project',
                            accept: {
                                'application/json': ['.cdt', '.json']
                            }
                        }]
                    });
                    
                    const writable = await fileHandle.createWritable();
                    await writable.write(jsonString);
                    await writable.close();
                    
                    alert('프로젝트가 저장되었습니다.');
                    return true;
                } catch (error) {
                    // User cancelled the file picker
                    if (error.name === 'AbortError') {
                        return false;
                    }
                    throw error;
                }
            } else {
                // Fallback to download method for older browsers
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = defaultFilename;
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up URL
                setTimeout(() => URL.revokeObjectURL(url), 100);
                
                return true;
            }
        } catch (error) {
            console.error('Error exporting project:', error);
            alert('프로젝트 내보내기 중 오류가 발생했습니다: ' + error.message);
            return false;
        }
    }

    /**
     * Import project from JSON file
     */
    importProject(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('파일이 선택되지 않았습니다.'));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const jsonString = e.target.result;
                    const importData = JSON.parse(jsonString);
                    
                    // Validate file format
                    if (!this.validateProjectData(importData)) {
                        reject(new Error('유효하지 않은 프로젝트 파일 형식입니다.'));
                        return;
                    }
                    
                    // Migrate data if needed (for future version compatibility)
                    const migratedData = this.migrateProjectData(importData);
                    
                    // Load data into DataStore
                    this.loadProjectData(migratedData);
                    
                    // Save to LocalStorage after import
                    if (this.dataStore && typeof this.dataStore.saveToLocalStorage === 'function') {
                        this.dataStore.saveToLocalStorage();
                    }
                    
                    // Re-render visualizer
                    if (this.visualizer) {
                        this.visualizer.render();
                    }
                    
                    resolve(true);
                } catch (error) {
                    console.error('Error importing project:', error);
                    reject(new Error('프로젝트 파일을 읽는 중 오류가 발생했습니다: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Validate imported project data structure
     */
    validateProjectData(data) {
        // Check if it's a valid project file
        if (!data || typeof data !== 'object') {
            return false;
        }
        
        // Check for required top-level fields
        if (!data.meta || typeof data.meta !== 'object') {
            return false;
        }
        
        // Check for required meta fields
        if (data.meta.mode === undefined) {
            return false;
        }
        
        // Nodes and connections can be empty objects, so we just check they exist
        if (data.nodes === undefined || data.networkNodes === undefined) {
            return false;
        }
        
        if (data.configurationConnections === undefined || 
            data.installationConnections === undefined || 
            data.networkConnections === undefined) {
            return false;
        }
        
        return true;
    }

    /**
     * Migrate project data to current version format
     */
    migrateProjectData(data) {
        // For now, just return data as-is
        // In the future, this can handle version migrations
        const version = data.version || '1.0.0';
        
        // Ensure all required fields exist with defaults
        const migrated = {
            ...data,
            meta: {
                mode: data.meta.mode || 'CONFIGURATION',
                floorPlanImage: data.meta.floorPlanImage || null,
                projectName: data.meta.projectName || 'ProjectName_SystemConfiguration_IMfine',
                hardwareList: data.meta.hardwareList || [],
                hardwareListMetadata: data.meta.hardwareListMetadata || {},
                bomMetadata: data.meta.bomMetadata || {},
                configurationConnectionOrder: data.meta.configurationConnectionOrder || {},
                installationConnectionOrder: data.meta.installationConnectionOrder || {},
                networkConnectionOrder: data.meta.networkConnectionOrder || {}
            },
            nodes: data.nodes || {},
            networkNodes: data.networkNodes || {},
            configurationConnections: data.configurationConnections || {},
            installationConnections: data.installationConnections || {},
            networkConnections: data.networkConnections || {},
            requests: data.requests || {}
        };
        
        return migrated;
    }

    /**
     * Load project data into DataStore
     */
    loadProjectData(data) {
        // Update meta data
        // Always switch to CONFIGURATION mode when importing
        this.dataStore.updateMeta({
            mode: 'CONFIGURATION',
            floorPlanImage: data.meta.floorPlanImage,
            projectName: data.meta.projectName,
            hardwareList: data.meta.hardwareList,
            hardwareListMetadata: data.meta.hardwareListMetadata,
            bomMetadata: data.meta.bomMetadata,
            configurationConnectionOrder: data.meta.configurationConnectionOrder,
            installationConnectionOrder: data.meta.installationConnectionOrder,
            networkConnectionOrder: data.meta.networkConnectionOrder
        });
        
        // Replace all nodes and connections
        // We need to directly update projectData since there's no method to replace everything
        const currentState = this.dataStore.getState();
        
        // Clear existing data
        currentState.nodes = {};
        currentState.networkNodes = {};
        currentState.configurationConnections = {};
        currentState.installationConnections = {};
        currentState.networkConnections = {};
        currentState.requests = {};
        
        // Load new data
        Object.assign(currentState.nodes, data.nodes);
        Object.assign(currentState.networkNodes, data.networkNodes);
        Object.assign(currentState.configurationConnections, data.configurationConnections);
        Object.assign(currentState.installationConnections, data.installationConnections);
        Object.assign(currentState.networkConnections, data.networkConnections);
        Object.assign(currentState.requests, data.requests);
        
        // Notify listeners
        this.dataStore.notify();
    }

    /**
     * Handle file input change event
     */
    handleFileInput(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        
        // Check file extension
        if (!file.name.toLowerCase().endsWith('.cdt') && !file.name.toLowerCase().endsWith('.json')) {
            alert('지원하지 않는 파일 형식입니다. .cdt 또는 .json 파일을 선택해주세요.');
            event.target.value = ''; // Reset input
            return;
        }
        
        this.importProject(file)
            .then(() => {
                alert('프로젝트를 성공적으로 불러왔습니다.');
                event.target.value = ''; // Reset input for next import
            })
            .catch((error) => {
                alert(error.message);
                event.target.value = ''; // Reset input
            });
    }

    /**
     * Save project to NAS
     * @param {string} projectName - 프로젝트 이름 (파일명으로 사용)
     * @returns {Promise<boolean>} 저장 성공 여부
     */
    async saveProjectToNAS(projectName) {
        try {
            // NAS 연결 확인
            if (!this.nasManager.isConnected) {
                // 로그인 모달 표시
                const credentials = await this.showNASLoginModal();
                await this.nasManager.connect(credentials.username, credentials.password);
            }

            // 프로젝트 데이터 준비
            const state = this.dataStore.getState();
            const exportData = {
                version: this.currentVersion,
                exportedAt: new Date().toISOString(),
                meta: {
                    mode: state.meta.mode,
                    floorPlanImage: state.meta.floorPlanImage || null,
                    projectName: projectName || state.meta.projectName || 'ProjectName_SystemConfiguration_IMfine',
                    hardwareList: state.meta.hardwareList || [],
                    hardwareListMetadata: state.meta.hardwareListMetadata || {},
                    bomMetadata: state.meta.bomMetadata || {},
                    configurationConnectionOrder: state.meta.configurationConnectionOrder || {},
                    installationConnectionOrder: state.meta.installationConnectionOrder || {},
                    networkConnectionOrder: state.meta.networkConnectionOrder || {}
                },
                nodes: state.nodes || {},
                networkNodes: state.networkNodes || {},
                configurationConnections: state.configurationConnections || {},
                installationConnections: state.installationConnections || {},
                networkConnections: state.networkConnections || {},
                requests: state.requests || {}
            };

            const jsonString = JSON.stringify(exportData, null, 2);
            const sanitizedName = (projectName || state.meta.projectName || 'project')
                .replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${sanitizedName}.cdt`;

            // NAS에 저장
            await this.nasManager.saveProject(filename, jsonString);
            
            // 프로젝트 이름 업데이트
            if (projectName) {
                this.dataStore.updateMeta({ projectName });
            }

            alert(`프로젝트 "${projectName || sanitizedName}"가 NAS에 저장되었습니다.`);
            return true;
        } catch (error) {
            console.error('Error saving to NAS:', error);
            
            // CORS 에러인 경우 명확한 안내
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                alert('CORS 정책으로 인해 브라우저에서 직접 NAS에 접속할 수 없습니다.\n\n해결 방법:\n1. NAS 설정에서 CORS 허용 (제어판 > 보안 > HTTP 보안 헤더)\n2. 또는 로컬 파일로 저장 후 수동으로 NAS에 업로드\n\n로컬 파일로 다운로드하시겠습니까?');
                const fallback = confirm('로컬 파일로 다운로드하시겠습니까?');
                if (fallback) {
                    return this.exportProject();
                }
            } else if (error.message.includes('연결') || error.message.includes('인증')) {
                // 연결/인증 실패 시
                const fallback = confirm(`NAS 연결에 실패했습니다: ${error.message}\n\n로컬 파일로 다운로드하시겠습니까?`);
                if (fallback) {
                    return this.exportProject();
                }
            } else {
                alert('NAS 저장 중 오류가 발생했습니다: ' + error.message);
            }
            return false;
        }
    }

    /**
     * List projects from NAS
     * @returns {Promise<Array>} 프로젝트 파일 목록
     */
    async listProjectsFromNAS() {
        try {
            // NAS 연결 확인
            if (!this.nasManager.isConnected) {
                // 로그인 모달 표시
                const credentials = await this.showNASLoginModal();
                await this.nasManager.connect(credentials.username, credentials.password);
            }

            const projects = await this.nasManager.listProjects();
            return projects;
        } catch (error) {
            console.error('Error listing projects from NAS:', error);
            throw error;
        }
    }

    /**
     * Load project from NAS
     * @param {string} filename - 불러올 파일명
     * @returns {Promise<boolean>} 불러오기 성공 여부
     */
    async loadProjectFromNAS(filename) {
        try {
            // NAS 연결 확인
            if (!this.nasManager.isConnected) {
                // 로그인 모달 표시
                const credentials = await this.showNASLoginModal();
                await this.nasManager.connect(credentials.username, credentials.password);
            }

            // NAS에서 파일 불러오기
            const jsonString = await this.nasManager.loadProject(filename);
            const importData = JSON.parse(jsonString);
            
            // Validate and load
            if (!this.validateProjectData(importData)) {
                throw new Error('유효하지 않은 프로젝트 파일 형식입니다.');
            }
            
            const migratedData = this.migrateProjectData(importData);
            this.loadProjectData(migratedData);
            
            // Save to LocalStorage after import
            if (this.dataStore && typeof this.dataStore.saveToLocalStorage === 'function') {
                this.dataStore.saveToLocalStorage();
            }
            
            // Re-render visualizer
            if (this.visualizer) {
                this.visualizer.render();
            }
            
            return true;
        } catch (error) {
            console.error('Error loading from NAS:', error);
            throw error;
        }
    }

    /**
     * Clear all project data and reset to initial state
     */
    clearProject() {
        // Confirm before clearing
        if (!confirm('모든 작업 내용이 삭제됩니다. 정말 초기화하시겠습니까?')) {
            return;
        }

        try {
            const currentState = this.dataStore.getState();
            
            // Clear all nodes
            const allNodeIds = [
                ...Object.keys(currentState.nodes || {}),
                ...Object.keys(currentState.networkNodes || {})
            ];
            if (allNodeIds.length > 0) {
                this.dataStore.deleteNodes(allNodeIds);
            }

            // Clear all connections
            const allConnectionIds = [
                ...Object.keys(currentState.configurationConnections || {}),
                ...Object.keys(currentState.installationConnections || {}),
                ...Object.keys(currentState.networkConnections || {})
            ];
            allConnectionIds.forEach(connId => {
                this.dataStore.removeConnection(connId);
            });

            // Clear all requests
            const allRequestIds = Object.keys(currentState.requests || {});
            allRequestIds.forEach(requestId => {
                delete currentState.requests[requestId];
            });

            // Reset meta data to initial state (keep hardwareList and projectName)
            this.dataStore.updateMeta({
                mode: 'CONFIGURATION',
                floorPlanImage: null,
                bomMetadata: {},
                hardwareListMetadata: {},
                configurationConnectionOrder: {},
                installationConnectionOrder: {},
                networkConnectionOrder: {}
            });

            // Clear LocalStorage
            if (this.dataStore && typeof this.dataStore.clearLocalStorage === 'function') {
                this.dataStore.clearLocalStorage();
            }

            // Re-render visualizer
            if (this.visualizer) {
                this.visualizer.render();
            }

            alert('프로젝트가 초기화되었습니다.');
        } catch (error) {
            console.error('Error clearing project:', error);
            alert('프로젝트 초기화 중 오류가 발생했습니다: ' + error.message);
        }
    }
}

