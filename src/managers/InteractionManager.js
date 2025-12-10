export class InteractionManager {
    constructor(dataStore, visualizer) {
        this.dataStore = dataStore;
        this.visualizer = visualizer; // We need visualizer to access stage/container for coordinates
        this.selectedCable = null; // Currently selected cable for connection
        this.connectionSourceNode = null; // First node clicked for connection

        this.init();
    }

    init() {
        this.setupSidebarDraggables();
        this.setupCanvasDropZone();
        this.setupCableSelection();
        this.setupNodeConnection();
    }

    setupSidebarDraggables() {
        // Use Event Delegation on the Hardware List Container
        const listContainer = document.getElementById('hardware-list-container');

        if (listContainer) {
            listContainer.addEventListener('dragstart', (e) => {
                // Check if the dragged element or its parent has the draggable attribute
                const target = e.target.closest('[draggable="true"]');
                if (target) {
                    // Don't allow dragging cables
                    if (target.dataset.category === 'Cable') {
                        e.preventDefault();
                        return;
                    }

                    // Deselect any active cable connection when starting a drag
                    if (this.selectedCable) {
                        this.deselectCable();
                    }

                    console.log('Drag started:', target.dataset.type, target.dataset.model);
                    e.dataTransfer.setData('type', target.dataset.type);
                    e.dataTransfer.setData('model', target.dataset.model);
                    e.dataTransfer.setData('color', target.dataset.color);
                    e.dataTransfer.setData('category', target.dataset.category);
                    e.dataTransfer.effectAllowed = 'copy';
                }
            });
        }
    }

    setupCableSelection() {
        const listContainer = document.getElementById('hardware-list-container');
        if (!listContainer) return;

        listContainer.addEventListener('click', (e) => {
            const item = e.target.closest('[data-category="Cable"]');
            if (item) {
                // Prevent edit/delete button clicks from selecting cable
                if (e.target.closest('.btn-edit') || e.target.closest('.btn-delete')) {
                    return;
                }

                // Select cable
                this.selectCable({
                    type: item.dataset.type,
                    model: item.dataset.model,
                    color: item.dataset.color,
                    category: item.dataset.category
                });

                // Update UI to show selected state
                this.updateCableSelectionUI(item);
            } else {
                // Clicked something else in the sidebar (e.g. Device) - deselect cable
                // But ignore clicks on container itself or headers if we want
                // For now, let's be safe: if we clicked a Device item, deselect cable
                const deviceItem = e.target.closest('[data-category="Device"]');
                if (deviceItem && this.selectedCable) {
                    this.deselectCable();
                }
            }
        });
    }

    selectCable(cable) {
        this.selectedCable = cable;
        this.connectionSourceNode = null; // Reset connection source
        console.log('Cable selected:', cable.type);
    }

    updateCableSelectionUI(selectedElement) {
        // Remove previous selection
        const listContainer = document.getElementById('hardware-list-container');
        const allCables = listContainer.querySelectorAll('[data-category="Cable"]');
        allCables.forEach(cable => {
            cable.classList.remove('ring-2', 'ring-offset-2');
            cable.style.removeProperty('--tw-ring-color');
            cable.style.boxShadow = ''; // Clear custom shadow if any
        });

        // Add selection to clicked cable
        if (selectedElement) {
            const color = selectedElement.dataset.color || '#3b82f6';
            selectedElement.classList.add('ring-2', 'ring-offset-2');
            // Use inline style for dynamic color since Tailwind arbitrary values need JIT or specific config
            // We can simulate ring using box-shadow
            selectedElement.style.boxShadow = `0 0 0 2px #fff, 0 0 0 4px ${color}`;
        }
    }

    setupNodeConnection() {
        // Note: Visualizer's onNodeSelect is handled by App.js, which delegates to us if needed.
        // We don't need to wrap it here anymore to avoid conflicts.

        // Listen for background clicks from Visualizer to deselect cable
        if (this.visualizer) {
            this.visualizer.onBackgroundClick = () => {
                if (this.selectedCable) {
                    this.deselectCable();
                    this.connectionSourceNode = null;
                    this.visualizer.clearNodeSelection();
                }
            };
        }
    }

    deselectCable() {
        this.selectedCable = null;
        this.connectionSourceNode = null;
        this.updateCableSelectionUI(null);
        console.log('Cable deselected');
    }

    handleNodeClickForConnection(nodeId) {
        if (!this.selectedCable) {
            // No cable selected, ignore
            return;
        }

        if (!this.connectionSourceNode) {
            // First node clicked - set as source
            this.connectionSourceNode = nodeId;
            console.log('Connection source set:', nodeId);
            // Visual feedback for source node
            if (this.visualizer) {
                this.visualizer.highlightNode(nodeId, 'source', this.selectedCable);
            }
        } else {
            // Second node clicked - create connection
            if (this.connectionSourceNode !== nodeId) {
                this.createConnection(this.connectionSourceNode, nodeId, this.selectedCable);
                // Clear highlights
                if (this.visualizer) {
                    this.visualizer.clearNodeSelection();
                }
                // Reset after connection - IMPORTANT: deselect cable to prevent repeated connections
                this.connectionSourceNode = null;
                this.deselectCable(); // Deselect cable after successful connection
            } else {
                // Same node clicked - deselect source
                this.connectionSourceNode = null;
                console.log('Connection source deselected');
                if (this.visualizer) {
                    this.visualizer.clearNodeSelection();
                }
            }
        }
    }

    createConnection(sourceNodeId, targetNodeId, cable) {
        console.log(`Creating connection: ${sourceNodeId} -> ${targetNodeId} using ${cable.type}`);

        const sourceNode = this.dataStore.getState().nodes[sourceNodeId];
        const targetNode = this.dataStore.getState().nodes[targetNodeId];

        if (!sourceNode || !targetNode) {
            console.error('Source or target node not found');
            return;
        }

        const connectionId = `conn-${Date.now()}`;
        const newConnection = {
            id: connectionId,
            source: sourceNodeId,
            target: targetNodeId,
            type: cable.type,
            color: cable.color,
            category: cable.category,
            model: cable.model
        };

        this.dataStore.addConnection(newConnection);
        console.log('Connection created:', newConnection);
    }

    setupCanvasDropZone() {
        const container = document.getElementById('canvas-container');

        container.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            e.dataTransfer.dropEffect = 'copy';
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('type');
            const model = e.dataTransfer.getData('model');
            const color = e.dataTransfer.getData('color');
            const category = e.dataTransfer.getData('category');

            console.log('Drop event:', type, model, color, category);

            if (type) {
                this.handleDrop(e, type, model, color, category);
            }
        });
    }

    handleDrop(e, type, model, color, category) {
        try {
            // Don't create nodes for cables - they are used for connections only
            if (category === 'Cable') {
                console.log('Cables cannot be dropped as nodes. Select cable and click two nodes to connect.');
                return;
            }

            // Calculate position relative to the stage/container
            // We can use the visualizer's stage if available, or just DOM rect
            let x, y;

            if (this.visualizer && this.visualizer.stage) {
                // Use Konva's method to get pointer position relative to stage
                this.visualizer.stage.setPointersPositions(e);
                const pos = this.visualizer.stage.getPointerPosition();
                if (pos) {
                    x = pos.x;
                    y = pos.y;
                }
            }

            // Fallback if Konva failed to get position
            if (x === undefined || y === undefined) {
                // Fallback to DOM math
                const container = document.getElementById('canvas-container');
                const rect = container.getBoundingClientRect();
                x = e.clientX - rect.left;
                y = e.clientY - rect.top;
            }

            // Ensure we have valid numbers
            if (isNaN(x) || isNaN(y)) {
                console.error('Invalid drop coordinates:', x, y);
                return;
            }

            // Create new Node (only for Device category)
            const id = `${type}-${Date.now()}`; // Simple unique ID
            const mode = this.dataStore.getState().meta.mode;

            // Snap to grid in LOGICAL mode
            if (mode === 'LOGICAL' && this.visualizer) {
                x = this.visualizer.snapToGridX(x);
                y = this.visualizer.snapToGridY(y);
            }

            // Sanitize inputs
            const safeType = type || 'Unknown';
            const safeModel = (model && model !== 'undefined' && model !== 'null') ? model : '';
            const safeColor = (color && color !== 'undefined' && color !== 'null') ? color : '#94a3b8';

            const newNode = {
                id: id,
                type: safeType,
                model: safeModel,
                color: safeColor,
                category: category || 'Device',
                // Initialize positions based on mode
                logicalPos: mode === 'LOGICAL' ? this.pixelsToLogical(x, y) : { col: 0, row: 0 },
                physicalPos: mode === 'PHYSICAL' ? { x, y } : null
            };

            this.dataStore.addNode(newNode);
            console.log(`InteractionManager: Added ${type} (${model}) at`, x, y);
        } catch (error) {
            console.error('InteractionManager Drop Error:', error);
        }
    }

    pixelsToLogical(x, y) {
        // Convert pixel position to grid coordinates (using 24px grid)
        // x = col * 24  =>  col = x / 24
        // y = row * 24  =>  row = y / 24
        return {
            col: Math.round(x / 24),
            row: Math.round(y / 24)
        };
    }
}
