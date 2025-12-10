export class PropertyManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.selectedNodeId = null;

        // UI Elements
        this.panel = document.getElementById('properties-panel');
        this.inputs = {
            type: document.getElementById('prop-type'),
            id: document.getElementById('prop-id'),
            model: document.getElementById('prop-model'),
            ip: document.getElementById('prop-ip'),
            desc: document.getElementById('prop-desc')
        };

        this.init();
    }

    init() {
        // Listen for input changes
        Object.entries(this.inputs).forEach(([key, input]) => {
            if (input && !input.disabled) {
                input.addEventListener('change', (e) => this.handleInputChange(key, e.target.value));
            }
        });

        // Subscribe to store changes to update UI if the selected node changes externally
        this.dataStore.subscribe((data) => {
            if (this.selectedNodeId) {
                const node = data.nodes[this.selectedNodeId];
                if (node) {
                    // Update UI values in case they changed elsewhere (e.g. sync)
                    // Avoid overwriting if user is typing? For now, simple sync.
                    this.updatePanelValues(node);
                } else {
                    // Node deleted? Deselect
                    this.deselectNode();
                }
            }
        });
    }

    selectNode(nodeId) {
        const data = this.dataStore.getState();
        const node = data.nodes[nodeId];

        if (!node) return;

        this.selectedNodeId = nodeId;
        this.panel.classList.remove('hidden');
        this.panel.classList.add('fade-in'); // Add animation

        this.updatePanelValues(node);
    }

    deselectNode() {
        this.selectedNodeId = null;
        this.panel.classList.add('hidden');
    }

    updatePanelValues(node) {
        if (this.inputs.type) this.inputs.type.value = node.type || '';
        if (this.inputs.id) this.inputs.id.value = node.id || '';
        if (this.inputs.model) this.inputs.model.value = node.model || '';
        if (this.inputs.ip) this.inputs.ip.value = node.ip || '';
        if (this.inputs.desc) this.inputs.desc.value = node.description || '';
    }

    handleInputChange(key, value) {
        if (!this.selectedNodeId) return;

        const updates = {};

        // Map UI keys to DataStore keys
        if (key === 'id') {
            // ID change is complex because it's the key in the object.
            // For now, let's treat "Name/ID" as a display name or label property, 
            // NOT the internal ID, to avoid refactoring the whole store structure.
            // Let's call it 'label' or just update 'id' if we really want to rename.
            // Given the complexity, let's map 'id' input to a 'name' property for display,
            // but keep internal ID same for now to be safe.
            // OR: We actually rename the node. Let's stick to adding properties first.
            updates.name = value;
        } else if (key === 'desc') {
            updates.description = value;
        } else {
            updates[key] = value;
        }

        this.dataStore.updateNode(this.selectedNodeId, updates);
    }
}
