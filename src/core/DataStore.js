export class DataStore {
    constructor() {
        this.projectData = {
            meta: {
<<<<<<< HEAD
                mode: 'LOGICAL', // 'LOGICAL' | 'PHYSICAL' | 'REQUEST' | 'HARDWARE_LIST'
                floorPlanImage: null,
                bomMetadata: {},
                hardwareListMetadata: {}, // Store remark and other metadata for hardware list items
                projectName: 'The First Look 2026' // Project name for hardware list tables
=======
                mode: 'LOGICAL', // 'LOGICAL' | 'PHYSICAL' | 'REQUEST'
                floorPlanImage: null,
                bomMetadata: {}
>>>>>>> 69958a1430fa59ef7d54047e968a915e3f18feb4
            },
            nodes: {},
            connections: {},
            requests: {}
        };
        this.listeners = [];
    }

    // Get the entire state
    getState() {
        return this.projectData;
    }

    addNode(node) {
        this.projectData.nodes[node.id] = node;
        this.notify();
    }

    // Update specific part of state
    updateNode(nodeId, updates) {
        if (!this.projectData.nodes[nodeId]) {
            this.projectData.nodes[nodeId] = {};
        }
        this.projectData.nodes[nodeId] = { ...this.projectData.nodes[nodeId], ...updates };
        this.notify();
    }

    // Delete node(s)
    deleteNode(nodeId) {
        if (this.projectData.nodes[nodeId]) {
            delete this.projectData.nodes[nodeId];
            this.removeConnectionsForNode(nodeId); // Clean up connections
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
        this.projectData.connections[connection.id] = connection;
        this.notify();
    }

    removeConnection(connectionId) {
        if (this.projectData.connections[connectionId]) {
            delete this.projectData.connections[connectionId];
            this.notify();
        }
    }

    removeConnectionsForNode(nodeId) {
        const connections = this.projectData.connections;
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
