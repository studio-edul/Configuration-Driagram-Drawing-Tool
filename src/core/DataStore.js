import { APP_VERSION } from '../config/version.js';

export class DataStore {
    constructor() {
        this.projectData = {
            meta: {
                mode: 'CONFIGURATION', // 'CONFIGURATION' | 'INSTALLATION' | 'REQUEST' | 'HARDWARE_LIST'
                floorPlanImage: null,
                bomMetadata: {},
                hardwareListMetadata: {}, // Store remark and other metadata for hardware list items
                projectName: 'The First Look 2026' // Project name for hardware list tables
            },
            nodes: {},
            configurationConnections: {}, // Connections created in CONFIGURATION mode
            installationConnections: {}, // Connections created in INSTALLATION mode
            networkNodes: {},
            networkConnections: {},
            requests: {}
        };
        this.listeners = [];
        this.autoSaveTimeout = null;
        this.currentVersion = APP_VERSION;
        this.storageKey = 'hardware-config-project-autosave';
        
        // Load from LocalStorage on initialization
        this.loadFromLocalStorage();
    }

    // Get the entire state
    getState() {
        return this.projectData;
    }

    addNode(node) {
        const mode = this.projectData.meta.mode;
        if (mode === 'NETWORK') {
            this.projectData.networkNodes[node.id] = node;
        } else {
            this.projectData.nodes[node.id] = node;
        }
        this.notify();
    }

    // Update specific part of state
    updateNode(nodeId, updates) {
        // Check both collections as we might not know the mode of the caller, 
        // or just check where the node exists.
        if (this.projectData.nodes[nodeId]) {
            this.projectData.nodes[nodeId] = { ...this.projectData.nodes[nodeId], ...updates };
        } else if (this.projectData.networkNodes[nodeId]) {
            this.projectData.networkNodes[nodeId] = { ...this.projectData.networkNodes[nodeId], ...updates };
        }
        this.notify();
    }

    // Delete node(s)
    deleteNode(nodeId) {
        if (this.projectData.nodes[nodeId]) {
            delete this.projectData.nodes[nodeId];
            this.removeConnectionsForNode(nodeId, 'STANDARD');
            this.notify();
        } else if (this.projectData.networkNodes[nodeId]) {
            delete this.projectData.networkNodes[nodeId];
            this.removeConnectionsForNode(nodeId, 'NETWORK');
            this.notify();
        }
    }

    deleteNodes(nodeIds) {
        let deleted = false;
        nodeIds.forEach(nodeId => {
            if (this.projectData.nodes[nodeId]) {
                delete this.projectData.nodes[nodeId];
                this.removeConnectionsForNode(nodeId, 'STANDARD'); // Clean up connections
                deleted = true;
            } else if (this.projectData.networkNodes[nodeId]) {
                delete this.projectData.networkNodes[nodeId];
                this.removeConnectionsForNode(nodeId, 'NETWORK'); // Clean up connections
                deleted = true;
            }
        });
        if (deleted) {
            this.notify();
        }
    }

    addRequest(request) {
        this.projectData.requests[request.id] = request;
        this.notify();
    }

    addConnection(connection) {
        const mode = this.projectData.meta.mode;
        if (mode === 'NETWORK') {
            if (!this.projectData.networkConnections) {
                this.projectData.networkConnections = {};
            }
            this.projectData.networkConnections[connection.id] = connection;
        } else if (mode === 'CONFIGURATION') {
            // Add to configurationConnections
            if (!this.projectData.configurationConnections) {
                this.projectData.configurationConnections = {};
            }
            this.projectData.configurationConnections[connection.id] = connection;
            // Also add to installationConnections so it appears in Installation mode
            if (!this.projectData.installationConnections) {
                this.projectData.installationConnections = {};
            }
            // Create a copy for installation mode (same connection between same nodes)
            this.projectData.installationConnections[connection.id] = { ...connection };
        } else if (mode === 'INSTALLATION') {
            // Add to installationConnections
            if (!this.projectData.installationConnections) {
                this.projectData.installationConnections = {};
            }
            this.projectData.installationConnections[connection.id] = connection;
            // Also add to configurationConnections so it appears in Configuration mode
            if (!this.projectData.configurationConnections) {
                this.projectData.configurationConnections = {};
            }
            // Create a copy for configuration mode (same connection between same nodes)
            this.projectData.configurationConnections[connection.id] = { ...connection };
        }
        this.notify();
    }

    updateConnection(connectionId, updates) {
        let updated = false;
        
        // Update in both configuration and installation connections if they exist
        // (since connections are shared between these two modes)
        if (this.projectData.configurationConnections && this.projectData.configurationConnections[connectionId]) {
            this.projectData.configurationConnections[connectionId] = { ...this.projectData.configurationConnections[connectionId], ...updates };
            updated = true;
            // Also update in installationConnections if it exists (same connection)
            if (this.projectData.installationConnections && this.projectData.installationConnections[connectionId]) {
                this.projectData.installationConnections[connectionId] = { ...this.projectData.installationConnections[connectionId], ...updates };
            }
        } else if (this.projectData.installationConnections && this.projectData.installationConnections[connectionId]) {
            this.projectData.installationConnections[connectionId] = { ...this.projectData.installationConnections[connectionId], ...updates };
            updated = true;
            // Also update in configurationConnections if it exists (same connection)
            if (this.projectData.configurationConnections && this.projectData.configurationConnections[connectionId]) {
                this.projectData.configurationConnections[connectionId] = { ...this.projectData.configurationConnections[connectionId], ...updates };
            }
        } else if (this.projectData.networkConnections && this.projectData.networkConnections[connectionId]) {
            this.projectData.networkConnections[connectionId] = { ...this.projectData.networkConnections[connectionId], ...updates };
            updated = true;
        }
        
        if (updated) {
            this.notify();
        }
    }

    removeConnection(connectionId) {
        let removed = false;
        
        // Remove from both configuration and installation connections
        // (since connections are shared between these two modes)
        if (this.projectData.configurationConnections && this.projectData.configurationConnections[connectionId]) {
            delete this.projectData.configurationConnections[connectionId];
            removed = true;
            // Also remove from installationConnections if it exists (same connection)
            if (this.projectData.installationConnections && this.projectData.installationConnections[connectionId]) {
                delete this.projectData.installationConnections[connectionId];
            }
        } else if (this.projectData.installationConnections && this.projectData.installationConnections[connectionId]) {
            delete this.projectData.installationConnections[connectionId];
            removed = true;
            // Also remove from configurationConnections if it exists (same connection)
            if (this.projectData.configurationConnections && this.projectData.configurationConnections[connectionId]) {
                delete this.projectData.configurationConnections[connectionId];
            }
        } else if (this.projectData.networkConnections && this.projectData.networkConnections[connectionId]) {
            delete this.projectData.networkConnections[connectionId];
            removed = true;
        }
        
        if (removed) {
            this.notify();
        }
    }

    removeConnectionsForNode(nodeId, type = 'STANDARD') {
        let changed = false;
        let connections;
        
        if (type === 'NETWORK') {
            connections = this.projectData.networkConnections || {};
        } else {
            // Check both configuration and installation connections
            const configConnections = this.projectData.configurationConnections || {};
            const installConnections = this.projectData.installationConnections || {};
            
            Object.keys(configConnections).forEach(connId => {
                const conn = configConnections[connId];
                if (conn.source === nodeId || conn.target === nodeId) {
                    delete configConnections[connId];
                    changed = true;
                }
            });
            
            Object.keys(installConnections).forEach(connId => {
                const conn = installConnections[connId];
                if (conn.source === nodeId || conn.target === nodeId) {
                    delete installConnections[connId];
                    changed = true;
                }
            });
            
            if (changed) this.notify();
            return;
        }
        
        Object.keys(connections).forEach(connId => {
            const conn = connections[connId];
            if (conn.source === nodeId || conn.target === nodeId) {
                delete connections[connId];
                changed = true;
            }
        });
        if (changed) this.notify();
    }

    setMode(mode) {
        this.projectData.meta.mode = mode;
        this.notify();
    }

    updateMeta(updates) {
        this.projectData.meta = { ...this.projectData.meta, ...updates };
        this.notify();
    }

    // Sync hardware changes to existing nodes
    updateNodesByHardware(oldHardware, newHardware) {
        let changed = false;
        const nodes = this.projectData.nodes;

        Object.keys(nodes).forEach(nodeId => {
            const node = nodes[nodeId];
            // Match by type and model (assuming this combination identifies the hardware)
            // Or just match by ID if we had a link, but we don't.
            // We match by the properties that define the hardware "identity" in the list.
            if (node.type === oldHardware.type && node.model === oldHardware.model) {
                // Update properties
                nodes[nodeId] = {
                    ...node,
                    type: newHardware.type,
                    model: newHardware.model,
                    color: newHardware.color
                };
                changed = true;
            }
        });

        if (changed) {
            this.notify();
        }
    }

    // Observer pattern
    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.projectData));
        // Auto-save to LocalStorage with debouncing
        this.autoSaveToLocalStorage();
    }

    /**
     * Auto-save to LocalStorage with debouncing (max once per second)
     */
    autoSaveToLocalStorage() {
        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        // Set new timeout (1 second debounce)
        this.autoSaveTimeout = setTimeout(() => {
            this.saveToLocalStorage();
        }, 1000);
    }

    /**
     * Save current project data to LocalStorage
     */
    saveToLocalStorage() {
        try {
            const state = this.projectData;
            
            // Create save object with version info (same structure as exportProject)
            const saveData = {
                version: this.currentVersion,
                savedAt: new Date().toISOString(),
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

            // Save to LocalStorage
            const jsonString = JSON.stringify(saveData);
            localStorage.setItem(this.storageKey, jsonString);
            
            // Update save status indicator if exists
            this.updateSaveStatus(true);
        } catch (error) {
            console.error('Error saving to LocalStorage:', error);
            // Handle quota exceeded error
            if (error.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded. Consider clearing old data.');
            }
            this.updateSaveStatus(false);
        }
    }

    /**
     * Load project data from LocalStorage
     */
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem(this.storageKey);
            if (!savedData) {
                return false; // No saved data
            }

            const data = JSON.parse(savedData);
            
            // Validate data structure
            if (!data || !data.meta || typeof data.meta !== 'object') {
                console.warn('Invalid saved data format, skipping load');
                return false;
            }

            // Check version compatibility
            // If saved version is different from current version, clear LocalStorage
            const savedVersion = data.version || '1.0.0';
            if (savedVersion !== this.currentVersion) {
                console.log(`Version mismatch detected. Saved: ${savedVersion}, Current: ${this.currentVersion}. Clearing LocalStorage.`);
                this.clearLocalStorage();
                return false; // Don't load old data
            }

            // Load data into projectData (without triggering notify to avoid infinite loop)
            this.projectData.meta = {
                mode: data.meta.mode || 'CONFIGURATION',
                floorPlanImage: data.meta.floorPlanImage || null,
                projectName: data.meta.projectName || 'The First Look 2026',
                hardwareList: data.meta.hardwareList || [],
                hardwareListMetadata: data.meta.hardwareListMetadata || {},
                bomMetadata: data.meta.bomMetadata || {},
                configurationConnectionOrder: data.meta.configurationConnectionOrder || {},
                installationConnectionOrder: data.meta.installationConnectionOrder || {},
                networkConnectionOrder: data.meta.networkConnectionOrder || {}
            };

            this.projectData.nodes = data.nodes || {};
            this.projectData.networkNodes = data.networkNodes || {};
            this.projectData.configurationConnections = data.configurationConnections || {};
            this.projectData.installationConnections = data.installationConnections || {};
            this.projectData.networkConnections = data.networkConnections || {};
            this.projectData.requests = data.requests || {};

            // Notify listeners after loading (but only once)
            setTimeout(() => {
                this.notify();
            }, 0);

            return true;
        } catch (error) {
            console.error('Error loading from LocalStorage:', error);
            return false;
        }
    }

    /**
     * Clear saved data from LocalStorage
     */
    clearLocalStorage() {
        try {
            localStorage.removeItem(this.storageKey);
            this.updateSaveStatus(false);
        } catch (error) {
            console.error('Error clearing LocalStorage:', error);
        }
    }

    /**
     * Update save status indicator in UI
     */
    updateSaveStatus(success) {
        // Try to find or create save status indicator
        let statusIndicator = document.getElementById('autosave-status');
        if (!statusIndicator) {
            // Create status indicator if it doesn't exist
            statusIndicator = document.createElement('div');
            statusIndicator.id = 'autosave-status';
            statusIndicator.className = 'fixed bottom-4 right-4 text-xs text-slate-500 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 z-50';
            document.body.appendChild(statusIndicator);
        }

        if (success) {
            statusIndicator.textContent = '자동 저장됨';
            statusIndicator.className = 'fixed bottom-4 right-4 text-xs text-green-600 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-green-200 z-50';
            // Hide after 2 seconds
            setTimeout(() => {
                if (statusIndicator) {
                    statusIndicator.textContent = '';
                    statusIndicator.className = 'fixed bottom-4 right-4 text-xs text-slate-500 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 z-50';
                }
            }, 2000);
        } else {
            statusIndicator.textContent = '저장 실패';
            statusIndicator.className = 'fixed bottom-4 right-4 text-xs text-red-600 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-red-200 z-50';
        }
    }
}
