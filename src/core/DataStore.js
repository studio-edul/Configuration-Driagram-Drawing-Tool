export class DataStore {
    constructor() {
        this.projectData = {
            meta: {
                mode: 'LOGICAL', // 'LOGICAL' | 'PHYSICAL' | 'REQUEST' | 'HARDWARE_LIST'
                floorPlanImage: null,
                bomMetadata: {},
                hardwareListMetadata: {}, // Store remark and other metadata for hardware list items
                projectName: 'The First Look 2026' // Project name for hardware list tables
            },
            nodes: {},
            connections: {},
            networkNodes: {},
            networkConnections: {},
            requests: {}
        };
        this.listeners = [];
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
                this.removeConnectionsForNode(nodeId); // Clean up connections
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
            this.projectData.networkConnections[connection.id] = connection;
        } else {
            this.projectData.connections[connection.id] = connection;
        }
        this.notify();
    }

    updateConnection(connectionId, updates) {
        if (this.projectData.connections[connectionId]) {
            this.projectData.connections[connectionId] = { ...this.projectData.connections[connectionId], ...updates };
        } else if (this.projectData.networkConnections[connectionId]) {
            this.projectData.networkConnections[connectionId] = { ...this.projectData.networkConnections[connectionId], ...updates };
        }
        this.notify();
    }

    removeConnection(connectionId) {
        if (this.projectData.connections[connectionId]) {
            delete this.projectData.connections[connectionId];
            this.notify();
        } else if (this.projectData.networkConnections[connectionId]) {
            delete this.projectData.networkConnections[connectionId];
            this.notify();
        }
    }

    removeConnectionsForNode(nodeId, type = 'STANDARD') {
        const connections = type === 'NETWORK' ? this.projectData.networkConnections : this.projectData.connections;
        let changed = false;
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
    }
}
