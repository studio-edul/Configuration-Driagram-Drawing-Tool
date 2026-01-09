import { APP_VERSION } from '../config/version.js';

export class ProjectManager {
    constructor(dataStore, visualizer) {
        this.dataStore = dataStore;
        this.visualizer = visualizer;
        this.currentVersion = APP_VERSION;
    }

    /**
     * Export project to JSON file
     */
    exportProject() {
        try {
            const state = this.dataStore.getState();
            
            // Create export object with version info
            const exportData = {
                version: this.currentVersion,
                exportedAt: new Date().toISOString(),
                meta: {
                    mode: state.meta.mode,
                    floorPlanImage: state.meta.floorPlanImage || null,
                    projectName: state.meta.projectName || 'Untitled Project',
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
            
            // Create blob and download
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Use project name for filename, sanitize it
            const projectName = state.meta.projectName || 'project';
            const sanitizedName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            link.download = `${sanitizedName}.cdt`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up URL
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            return true;
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
                projectName: data.meta.projectName || 'Untitled Project',
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
}

