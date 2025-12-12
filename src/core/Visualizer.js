export class Visualizer {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.stage = null;
        this.layer = null;
        this.width = 0;
        this.height = 0;

        this.bgImageObj = new Image();
        this.bgImageNode = null;
        this.selectedNodeIds = new Set(); // Multiple selection support
        this.selectedConnectionIds = new Set(); // Selected connections (cables)
        this.connectionSourceNodeId = null;
        this.nodeGroups = {}; // Store node groups for highlighting
        this.connectionLines = {}; // Map<connectionId, Konva.Line> - Store connection line objects
        this.connectionBendHandles = {}; // Map<connectionId, Konva.Circle> - bend handle (selected connections)
        this.connectionPortOffsets = {}; // Map<connId, { start, end }> - cached endpoints for bend editing

        // Box selection
        this.isBoxSelecting = false;
        this.boxStartPos = null;
        this.boxSelectionRect = null;
        this.modifierKeys = { shift: false, ctrl: false };

        // Click debouncing (global, not per-node)
        this.lastClickTime = 0;
        this.lastClickNodeId = null;
        this.isProcessingClick = false;

        this.init();
    }

    init() {
        // Handle resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Initial sizing
        this.handleResize();

        // Subscribe to data changes
        this.dataStore.subscribe(() => {
            this.render();
        });
        // Initial render (will be called by handleResize, but keep for clarity if handleResize doesn't always render)
        this.render();

        // Keyboard event listeners for modifier keys
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') this.modifierKeys.shift = true;
            if (e.key === 'Control' || e.key === 'Meta') this.modifierKeys.ctrl = true;
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') this.modifierKeys.shift = false;
            if (e.key === 'Control' || e.key === 'Meta') this.modifierKeys.ctrl = false;
        });

        // Keyboard event handlers for arrow keys and delete
        window.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        // Box selection setup
        this.setupBoxSelection();

        // Click handler for Request Mode and deselection
        this.stage.on('click', (e) => {
            const mode = this.dataStore.getState().meta.mode;

            // If clicked on empty space (not on a node/shape)
            // Check if target is stage or layer (background)
            if (e.target === this.stage || e.target === this.layer) {
                if (mode === 'REQUEST') {
                    // Request mode: add request marker
                    const pos = this.stage.getPointerPosition();
                    if (window.app && window.app.requestManager) {
                        window.app.requestManager.addRequest(pos.x, pos.y);
                    }
                } else {
                    // Other modes: deselect all nodes
                    // Only deselect if not using modifier keys (to allow box selection)
                    if (!this.modifierKeys.shift && !this.modifierKeys.ctrl) {
                        this.selectedNodeIds.clear();
                        this.updateAllNodeHighlights();

                        // Hide property panel
                        if (window.app && window.app.propertyManager) {
                            window.app.propertyManager.deselectNode();
                        }
                    }
                }
            }
        });
    }

    handleResize() {
        const container = document.getElementById('canvas-container');
        if (!container) return;

        // Calculate 92% width and 16:9 height for better spacing
        this.width = container.offsetWidth * 0.92;
        this.height = this.width * (9 / 16);

        if (!this.stage) {
            this.stage = new Konva.Stage({
                container: 'canvas-container',
                width: this.width,
                height: this.height,
            });
            this.layer = new Konva.Layer();
            this.stage.add(this.layer);

            // Click handler for Request Mode and deselection
            this.stage.on('click', (e) => {
                const mode = this.dataStore.getState().meta.mode;
                if (e.target === this.stage || e.target === this.layer) {
                    if (mode === 'REQUEST') {
                        const pos = this.stage.getPointerPosition();
                        if (window.app && window.app.requestManager) {
                            window.app.requestManager.addRequest(pos.x, pos.y);
                        }
                    } else {
                        if (!this.modifierKeys.shift && !this.modifierKeys.ctrl) {
                            this.selectedNodeIds.clear();
                            this.selectedConnectionIds.clear(); // Clear connection selection
                            this.updateAllNodeHighlights();
                            this.updateConnectionSelection(); // Update connection visuals
                            if (window.app && window.app.propertyManager) {
                                window.app.propertyManager.deselectNode();
                            }
                            // Notify listeners (e.g. InteractionManager for cable deselection)
                            if (this.onBackgroundClick) {
                                this.onBackgroundClick();
                            }
                        }
                    }
                }
            });
        } else {
            this.stage.width(this.width);
            this.stage.height(this.height);
        }

        this.render();
    }

    renderTitle(mode) {
        let titleText = '';
        if (mode === 'LOGICAL') {
            titleText = 'System Configuration';
        } else if (mode === 'PHYSICAL') {
            titleText = 'Cable Guide';
        } else if (mode === 'NETWORK') {
            titleText = 'Electricity & Network';
        }

        if (titleText) {
            const textNode = new Konva.Text({
                x: this.width * 0.04,
                y: this.width * 0.04, // Equal margins based on width
                text: titleText,
                fontSize: 60, // Approx 45pt
                fontStyle: 'bold',
                fill: '#000000',
                fontFamily: 'Noto Sans KR'
            });
            this.layer.add(textNode);
        }
    }

    setupBoxSelection() {
        let isSelecting = false;
        let startPos = null;

        this.stage.on('mousedown', (e) => {
            // Only enable box selection if clicking on stage (not on a node)
            const mode = this.dataStore.getState().meta.mode;
            if (e.target === this.stage && (mode === 'PHYSICAL' || mode === 'LOGICAL' || mode === 'NETWORK')) {
                // Don't start box selection if modifier keys are pressed (for multi-select)
                if (!this.modifierKeys.shift && !this.modifierKeys.ctrl) {
                    isSelecting = true;
                    const pos = this.stage.getPointerPosition();
                    startPos = { x: pos.x, y: pos.y };
                    this.boxStartPos = startPos;

                    // Create selection rectangle
                    this.boxSelectionRect = new Konva.Rect({
                        x: pos.x,
                        y: pos.y,
                        width: 0,
                        height: 0,
                        fill: 'rgba(59, 130, 246, 0.1)',
                        stroke: '#3b82f6',
                        strokeWidth: 2,
                        dash: [5, 5],
                        visible: false
                    });
                    this.layer.add(this.boxSelectionRect);
                    this.layer.draw();
                }
            }
        });

        this.stage.on('mousemove', (e) => {
            if (isSelecting && this.boxSelectionRect && startPos) {
                const pos = this.stage.getPointerPosition();
                const width = pos.x - startPos.x;
                const height = pos.y - startPos.y;

                this.boxSelectionRect.setAttrs({
                    x: width < 0 ? pos.x : startPos.x,
                    y: height < 0 ? pos.y : startPos.y,
                    width: Math.abs(width),
                    height: Math.abs(height),
                    visible: true
                });
                this.layer.draw();
            }
        });

        this.stage.on('mouseup', (e) => {
            if (isSelecting && this.boxSelectionRect && startPos) {
                const pos = this.stage.getPointerPosition();
                const box = {
                    x: Math.min(startPos.x, pos.x),
                    y: Math.min(startPos.y, pos.y),
                    width: Math.abs(pos.x - startPos.x),
                    height: Math.abs(pos.y - startPos.y)
                };

                // Select nodes within box
                this.selectNodesInBox(box);

                // Remove selection rectangle
                this.boxSelectionRect.destroy();
                this.boxSelectionRect = null;
                this.boxStartPos = null;
                this.layer.draw();

                isSelecting = false;
                startPos = null;
            }
        });
    }

    selectNodesInBox(box) {
        const selectedNodes = new Set();

        const mode = this.dataStore.getState().meta.mode;
        const isSmallNode = mode === 'PHYSICAL' || mode === 'NETWORK';

        Object.values(this.nodeGroups).forEach(group => {
            const nodeBox = {
                x: group.x(),
                y: group.y(),
                width: isSmallNode ? 24 : 100,
                height: isSmallNode ? 24 : 60
            };

            // Check if node intersects with selection box
            if (this.boxIntersects(box, nodeBox)) {
                selectedNodes.add(group.id());
            }
        });

        // Update selection
        if (!this.modifierKeys.shift && !this.modifierKeys.ctrl) {
            this.selectedNodeIds.clear();
        }
        selectedNodes.forEach(id => {
            this.selectedNodeIds.add(id);
        });

        this.updateAllNodeHighlights();
    }

    boxIntersects(box1, box2) {
        return !(box1.x + box1.width < box2.x ||
            box2.x + box2.width < box1.x ||
            box1.y + box1.height < box2.y ||
            box2.y + box2.height < box1.y);
    }

    render() {
        const data = this.dataStore.getState();
        const mode = data.meta.mode;

        // Select data based on mode
        const targetNodes = mode === 'NETWORK' ? data.networkNodes : data.nodes;
        const targetConnections = mode === 'NETWORK' ? data.networkConnections : data.connections;

        // Clean up invalid selections (nodes that no longer exist)
        const existingNodeIds = new Set(Object.keys(targetNodes));
        const validSelections = new Set();
        this.selectedNodeIds.forEach(nodeId => {
            if (existingNodeIds.has(nodeId)) {
                validSelections.add(nodeId);
            }
        });
        this.selectedNodeIds = validSelections;

        // Clear node groups cache when re-rendering
        this.nodeGroups = {};
        this.layer.destroyChildren();
        this.connectionLines = {};
        this.connectionBendHandles = {};

        // Render Title
        this.renderTitle(mode);

        // Render Background Image
        if (data.meta.floorPlanImage && (mode === 'PHYSICAL' || mode === 'REQUEST' || mode === 'NETWORK')) {
            if (!this.bgImageNode) {
                this.bgImageNode = new Konva.Image({
                    image: this.bgImageObj,
                });
            }

            // Update image source if changed
            if (this.bgImageObj.src !== data.meta.floorPlanImage) {
                this.bgImageObj.src = data.meta.floorPlanImage;
                this.bgImageObj.onload = () => {
                    this.render(); // Re-render to recalculate layout with correct dimensions
                };
            }

            // Calculate layout to fit bottom-left without overlapping Title or Legend
            // Use naturalWidth/Height to ensure we get the real image dimensions
            const imgWidth = this.bgImageObj.naturalWidth || this.bgImageObj.width;
            const imgHeight = this.bgImageObj.naturalHeight || this.bgImageObj.height;

            if (imgWidth && imgHeight) {
                const titleHeight = 90; // Adjusted top margin
                const legendWidth = 300; // Adjusted right margin
                const padding = 30; // Adjusted padding

                const availableWidth = this.width - legendWidth - (padding * 2);
                const availableHeight = this.height - titleHeight - (padding * 2);

                const imgRatio = imgWidth / imgHeight;
                const availableRatio = availableWidth / availableHeight;

                let newWidth, newHeight;

                // Fit to available space
                if (imgRatio > availableRatio) {
                    // Limited by width
                    newWidth = availableWidth;
                    newHeight = availableWidth / imgRatio;
                } else {
                    // Limited by height
                    newHeight = availableHeight;
                    newWidth = availableHeight * imgRatio;
                }

                this.bgImageNode.width(newWidth);
                this.bgImageNode.height(newHeight);

                // Center horizontally if image is narrower than available space
                const centeredX = padding + (availableWidth - newWidth) / 2;
                this.bgImageNode.x(centeredX);
                this.bgImageNode.y(this.height - newHeight - padding);

                // Only add to layer if we successfully calculated dimensions
                this.layer.add(this.bgImageNode);
            }
        }

        // Render Connections
        this.renderConnections(targetConnections, targetNodes, mode);

        // Render Nodes
        Object.values(targetNodes).forEach(node => {
            this.renderNode(node, mode);
        });

        // Render Requests
        Object.values(data.requests).forEach(req => {
            this.renderRequest(req);
        });

        // Render Legend (Technical List)
        this.renderLegend(data, mode);

        this.layer.batchDraw();
    }

    renderLegend(data, mode) {
        if (mode !== 'LOGICAL' && mode !== 'PHYSICAL' && mode !== 'NETWORK') return;

        const targetNodes = mode === 'NETWORK' ? data.networkNodes : data.nodes;
        const targetConnections = mode === 'NETWORK' ? data.networkConnections : data.connections;

        // Calculate items first to determine height
        const components = {};
        Object.values(targetNodes).forEach(node => {
            const name = node.model || node.type || 'Unknown';
            components[name] = (components[name] || 0) + 1;
        });

        const cables = {};
        Object.values(targetConnections).forEach(conn => {
            const name = conn.type || 'Unknown';
            cables[name] = (cables[name] || 0) + 1;
        });

        const itemCount = Object.keys(components).length + Object.keys(cables).length;
        // Height = Header(30) + TopMargin(30) + Items(n*30) + BottomMargin(approx 30)
        // StartY=60. LastItemY = 60 + (n-1)*30. Height = LastItemY + 12 + 30 = 30n + 72.
        // Using 75 for slight extra breathing room
        const legendHeight = (itemCount * 30) + 75;

        const legendWidth = 200;
        const legendX = this.width - legendWidth - (this.width * 0.04); // Right aligned with padding
        const legendY = (this.height - legendHeight) / 2; // Vertically centered

        const group = new Konva.Group({
            x: legendX,
            y: legendY
        });

        // Background
        const bg = new Konva.Rect({
            width: legendWidth,
            height: legendHeight,
            fill: 'white',
            stroke: 'black',
            strokeWidth: 1,
            cornerRadius: 10
        });
        group.add(bg);

        // Header
        const headerBg = new Konva.Rect({
            width: legendWidth,
            height: 30,
            fill: 'black',
            cornerRadius: [10, 10, 0, 0]
        });
        group.add(headerBg);

        const headerText = new Konva.Text({
            x: 0, y: 8,
            width: legendWidth,
            text: 'Technical List',
            fontSize: 14,
            fontStyle: 'bold',
            fill: 'white',
            align: 'center'
        });
        group.add(headerText);

        let currentY = 60; // Increased top margin

        // Render Items
        const renderItem = (label, color, isLine = false) => {
            if (isLine) {
                const line = new Konva.Line({
                    points: [20, currentY + 7, 50, currentY + 7], // Increased left margin and length
                    stroke: color,
                    strokeWidth: 2,
                    dash: label.includes('Wireless') ? [5, 5] : []
                });
                group.add(line);
            } else {
                // Draw a small square for component
                const rect = new Konva.Rect({
                    x: 29, // Centered with line (20-50 center is 35, width 12, so 35-6=29)
                    y: currentY + 1, // Center with text
                    width: 12,
                    height: 12,
                    fill: color
                });
                group.add(rect);
            }

            const text = new Konva.Text({
                x: 60, // Increased left margin for text
                y: currentY,
                text: label,
                fontSize: 12,
                fill: 'black'
            });
            group.add(text);
            currentY += 30; // Increased line height spacing
        };

        // Draw Components first
        Object.keys(components).forEach(compName => {
            const node = Object.values(targetNodes).find(n => (n.model === compName || n.type === compName));
            const color = node ? (node.color || '#94a3b8') : '#94a3b8';
            renderItem(compName, color, false);
        });

        // Draw Cables
        Object.keys(cables).forEach(cableType => {
            // Find color for this cable type
            const conn = Object.values(targetConnections).find(c => c.type === cableType);
            const color = conn ? (conn.color || 'black') : 'black';
            renderItem(cableType, color, true);
        });

        this.layer.add(group);
    }

    renderRequest(req) {
        const size = 30;
        const group = new Konva.Group({
            x: req.x,
            y: req.y,
            draggable: false // Requests are static for now, or editable in future
        });

        const rect = new Konva.Rect({
            width: size, height: size,
            fill: req.type === 'POWER' ? '#fca5a5' : '#93c5fd', // red-300 : blue-300
            stroke: req.type === 'POWER' ? '#ef4444' : '#3b82f6', // red-500 : blue-500
            strokeWidth: 2,
            offset: { x: size / 2, y: size / 2 }
        });

        const text = new Konva.Text({
            text: req.label,
            fontSize: 14,
            fontStyle: 'bold',
            fill: 'white',
            offset: { x: 4, y: 6 } // Approximate center
        });

        group.add(rect);
        group.add(text);
        this.layer.add(group);
    }

    renderNode(node, mode) {
        let x, y;
        let draggable = false;

        if (mode === 'LOGICAL') {
            // Grid mapping for logical (using 24px grid)
            x = (node.logicalPos?.col || 0) * 24;
            y = (node.logicalPos?.row || 0) * 24;
            draggable = true; // Enable dragging in LOGICAL mode
        } else {
            // Physical / Request
            x = node.physicalPos?.x || 0;
            y = node.physicalPos?.y || 0;
            draggable = (mode === 'PHYSICAL' || mode === 'NETWORK');
        }

        const group = new Konva.Group({
            x: x,
            y: y,
            draggable: draggable,
            id: node.id
        });

        // Dynamic Color
        const nodeColor = node.color || '#94a3b8'; // Default slate-400

        if (mode === 'PHYSICAL' || mode === 'NETWORK') {
            // Physical Mode: 24x24 Rounded Square
            const rect = new Konva.Rect({
                width: 24,
                height: 24,
                fill: nodeColor,
                stroke: '#ffffff',
                strokeWidth: 1,
                cornerRadius: 6,
                shadowColor: 'black',
                shadowBlur: 3,
                shadowOpacity: 0.2,
                shadowOffset: { x: 1, y: 1 }
            });
            group.add(rect);
        } else {
            // Logical Mode: 100x60 Card with Labels
            const rect = new Konva.Rect({
                width: 100,
                height: 60,
                fill: 'white',
                stroke: nodeColor,
                strokeWidth: 2,
                cornerRadius: 8,
                shadowColor: 'black',
                shadowBlur: 5,
                shadowOpacity: 0.1,
                shadowOffset: { x: 2, y: 2 }
            });

            // Header Background (Colored)
            const header = new Konva.Rect({
                width: 100,
                height: 20,
                fill: nodeColor,
                cornerRadius: [8, 8, 0, 0]
            });

            // Type Label - centered if no model, otherwise positioned above
            const hasModel = node.model && node.model.trim() !== '';
            const typeText = new Konva.Text({
                text: node.type || node.id.replace(/-\d+$/, ''), // Remove trailing numbers from id if type not available
                fontSize: 12,
                fontStyle: 'bold',
                y: hasModel ? 25 : 40, // Above model if exists, centered at box center (40px) if not
                width: 100,
                align: 'center',
                fill: '#334155',
                offsetY: hasModel ? 0 : 6 // Adjust to center text vertically when no model (half of font size)
            });

            group.add(rect);
            group.add(header);
            group.add(typeText);

            // Model Label - only show if model exists
            if (hasModel) {
                const modelText = new Konva.Text({
                    text: node.model,
                    fontSize: 10,
                    y: 40,
                    width: 100,
                    align: 'center',
                    fill: '#94a3b8'
                });
                group.add(modelText);
            }
        }

        // Store group reference for highlighting
        this.nodeGroups[node.id] = group;

        // Selection Handler - use only 'click' to avoid duplicate events
        group.on('click', (e) => {
            e.cancelBubble = true;

            // Prevent concurrent click processing
            if (this.isProcessingClick) {
                return;
            }

            const now = Date.now();
            const timeSinceLastClick = now - this.lastClickTime;
            const isSameNode = this.lastClickNodeId === node.id;

            // Prevent rapid duplicate clicks on same node (within 100ms)
            if (isSameNode && timeSinceLastClick < 100) {
                return;
            }

            this.isProcessingClick = true;
            this.lastClickTime = now;
            this.lastClickNodeId = node.id;

            // Handle node selection
            if (this.onNodeSelect) {
                const isMultiSelect = this.modifierKeys.shift || this.modifierKeys.ctrl;

                if (isMultiSelect) {
                    // Multi-select mode: toggle selection
                    if (this.selectedNodeIds.has(node.id)) {
                        this.selectedNodeIds.delete(node.id);
                    } else {
                        this.selectedNodeIds.add(node.id);
                    }
                } else {
                    // Single select mode: ALWAYS clear all selections first, then select this node
                    // Also clear connection selection
                    this.selectedConnectionIds.clear();
                    this.updateConnectionSelection();

                    // If clicking the same single-selected node, deselect it
                    const wasSelected = this.selectedNodeIds.has(node.id);
                    const wasOnlySelected = this.selectedNodeIds.size === 1 && wasSelected;

                    // Always clear first
                    this.selectedNodeIds.clear();

                    if (!wasOnlySelected) {
                        // Select this node (unless it was the only selected one)
                        this.selectedNodeIds.add(node.id);
                    }
                }

                // Update highlights immediately
                this.updateAllNodeHighlights();

                // Call original handler for property panel (only if node is selected)
                if (this.selectedNodeIds.has(node.id) && this.selectedNodeIds.size === 1) {
                    this.onNodeSelect(node.id);
                } else if (this.selectedNodeIds.size === 0) {
                    // Deselect property panel if nothing is selected
                    if (window.app && window.app.propertyManager) {
                        window.app.propertyManager.deselectNode();
                    }
                }
            }

            // Reset processing flag after a short delay
            setTimeout(() => {
                this.isProcessingClick = false;
            }, 50);
        });

        // Drag events - handle both single and multi-node drag
        if (mode === 'PHYSICAL' || mode === 'LOGICAL' || mode === 'NETWORK') {
            group.on('dragstart', () => {
                // If dragging a non-selected node, make it the only selected node
                if (!this.selectedNodeIds.has(node.id)) {
                    this.selectedConnectionIds.clear(); // Clear connection selection on drag start too
                    this.updateConnectionSelection();

                    this.selectedNodeIds.clear();
                    this.selectedNodeIds.add(node.id);
                    this.updateAllNodeHighlights();
                }

                // Store initial positions for multi-node drag
                if (this.selectedNodeIds.has(node.id) && this.selectedNodeIds.size > 1) {
                    this.selectedNodeIds.forEach(selectedId => {
                        if (this.nodeGroups[selectedId]) {
                            const selectedGroup = this.nodeGroups[selectedId];
                            selectedGroup.setAttr('_startX', selectedGroup.x());
                            selectedGroup.setAttr('_startY', selectedGroup.y());
                        }
                    });
                }
            });

            group.on('dragmove', () => {
                // Don't snap during drag - allow free movement
                // Snap will be applied on dragend

                // Move all selected nodes together if multi-selected
                if (this.selectedNodeIds.has(node.id) && this.selectedNodeIds.size > 1) {
                    const currentX = group.x();
                    const currentY = group.y();
                    const startX = group.getAttr('_startX') || currentX;
                    const startY = group.getAttr('_startY') || currentY;
                    const deltaX = currentX - startX;
                    const deltaY = currentY - startY;

                    this.selectedNodeIds.forEach(selectedId => {
                        if (selectedId !== node.id && this.nodeGroups[selectedId]) {
                            const selectedGroup = this.nodeGroups[selectedId];
                            const nodeStartX = selectedGroup.getAttr('_startX') || selectedGroup.x();
                            const nodeStartY = selectedGroup.getAttr('_startY') || selectedGroup.y();
                            const newX = nodeStartX + deltaX;
                            const newY = nodeStartY + deltaY;

                            // Don't snap during drag - allow free movement
                            selectedGroup.position({ x: newX, y: newY });
                        }
                    });
                    this.layer.batchDraw();
                }

                // Update connections during drag (live preview)
                const data = this.dataStore.getState();
                const targetNodes = mode === 'NETWORK' ? data.networkNodes : data.nodes;
                const targetConnections = mode === 'NETWORK' ? data.networkConnections : data.connections;
                this.renderConnections(targetConnections, targetNodes, mode);
            });

            group.on('dragend', (e) => {
                // Update positions of all selected nodes
                if (this.selectedNodeIds.has(node.id) && this.selectedNodeIds.size > 1) {
                    // Multi-node drag: calculate final positions based on initial positions and total delta
                    const draggedGroup = this.nodeGroups[node.id];
                    const draggedStartX = draggedGroup.getAttr('_startX') || draggedGroup.x();
                    const draggedStartY = draggedGroup.getAttr('_startY') || draggedGroup.y();
                    const draggedEndX = draggedGroup.x();
                    const draggedEndY = draggedGroup.y();
                    const totalDeltaX = draggedEndX - draggedStartX;
                    const totalDeltaY = draggedEndY - draggedStartY;

                    this.selectedNodeIds.forEach(selectedId => {
                        if (this.nodeGroups[selectedId]) {
                            const selectedGroup = this.nodeGroups[selectedId];
                            const nodeStartX = selectedGroup.getAttr('_startX') || selectedGroup.x();
                            const nodeStartY = selectedGroup.getAttr('_startY') || selectedGroup.y();
                            const finalX = nodeStartX + totalDeltaX;
                            const finalY = nodeStartY + totalDeltaY;

                            const nodeData = this.dataStore.getState().nodes[selectedId];
                            if (nodeData) {
                                if (mode === 'LOGICAL') {
                                    // Snap to nearest grid position
                                    const snappedX = this.snapToGridX(finalX);
                                    const snappedY = this.snapToGridY(finalY);
                                    // Apply snap position
                                    selectedGroup.position({ x: snappedX, y: snappedY });
                                    // Convert pixel position to grid coordinates (using 24px grid)
                                    const col = Math.round(snappedX / 24);
                                    const row = Math.round(snappedY / 24);
                                    this.dataStore.updateNode(selectedId, {
                                        logicalPos: { col, row }
                                    });
                                } else {
                                    // Snap to grid for physical/network mode too
                                    const snappedX = this.snapToGridX(finalX);
                                    const snappedY = this.snapToGridY(finalY);
                                    selectedGroup.position({ x: snappedX, y: snappedY });
                                    this.dataStore.updateNode(selectedId, {
                                        physicalPos: {
                                            x: snappedX,
                                            y: snappedY
                                        }
                                    });
                                }
                            }
                        }
                    });
                    // Redraw layer after snapping all nodes
                    if (mode === 'LOGICAL') {
                        this.layer.batchDraw();
                    }
                } else {
                    // Single node drag
                    // Get current position and snap to nearest grid
                    const currentX = group.x();
                    const currentY = group.y();
                    const snappedX = this.snapToGridX(currentX);
                    const snappedY = this.snapToGridY(currentY);

                    // Apply snap position
                    group.position({ x: snappedX, y: snappedY });

                    if (mode === 'LOGICAL') {
                        // Convert pixel position to grid coordinates (using 24px grid)
                        const col = Math.round(snappedX / 24);
                        const row = Math.round(snappedY / 24);
                        this.dataStore.updateNode(node.id, {
                            logicalPos: { col, row }
                        });
                        // Redraw layer after snapping
                        this.layer.batchDraw();
                    } else {
                        // PHYSICAL / NETWORK mode
                        this.dataStore.updateNode(node.id, {
                            physicalPos: {
                                x: snappedX,
                                y: snappedY
                            }
                        });
                    }
                }
            });
        }

        // Update selection highlight if this node is selected
        this.updateNodeHighlight(node.id);

        this.layer.add(group);
    }

    highlightNode(nodeId, type = 'selected') {
        if (type === 'source') {
            this.connectionSourceNodeId = nodeId;
        } else {
            this.selectedNodeIds.clear();
            this.selectedNodeIds.add(nodeId);
        }
        this.updateAllNodeHighlights();
    }

    clearNodeSelection() {
        const previousSource = this.connectionSourceNodeId;
        this.selectedNodeIds.clear();
        this.connectionSourceNodeId = null;

        if (previousSource && this.nodeGroups[previousSource]) {
            this.updateNodeHighlight(previousSource);
        }
        this.updateAllNodeHighlights();
    }

    snapToGridX(x) {
        // Grid spacing: 24px (matches canvas dot grid)
        return Math.round(x / 24) * 24;
    }

    snapToGridY(y) {
        // Grid spacing: 24px (matches canvas dot grid)
        return Math.round(y / 24) * 24;
    }

    updateAllNodeHighlights() {
        Object.keys(this.nodeGroups).forEach(nodeId => {
            this.updateNodeHighlight(nodeId);
        });

        // Update draggable state based on mode only (not selection)
        const mode = this.dataStore.getState().meta.mode;
        const isDraggable = mode === 'PHYSICAL' || mode === 'LOGICAL' || mode === 'NETWORK';

        Object.keys(this.nodeGroups).forEach(nodeId => {
            const group = this.nodeGroups[nodeId];
            if (group) {
                // Enable dragging in PHYSICAL and LOGICAL modes for all nodes
                group.draggable(isDraggable);
            }
        });
    }

    updateNodeHighlight(nodeId) {
        const group = this.nodeGroups[nodeId];
        if (!group) return;

        // Remove existing highlight rectangles
        const existingHighlight = group.findOne('.selection-highlight');
        const existingSourceHighlight = group.findOne('.source-highlight');
        if (existingHighlight) existingHighlight.destroy();
        if (existingSourceHighlight) existingSourceHighlight.destroy();

        // Add highlight if node is selected or is connection source
        const isSelected = this.selectedNodeIds.has(nodeId);
        const isSource = this.connectionSourceNodeId === nodeId;

        if (isSelected || isSource) {
            // Get node color for highlight
            const mode = this.dataStore.getState().meta.mode;
            const nodes = mode === 'NETWORK' ? this.dataStore.getState().networkNodes : this.dataStore.getState().nodes;
            const nodeData = nodes[nodeId];
            const nodeColor = nodeData?.color || '#94a3b8';

            // Use block color for selection, keep blue for source
            const highlightColor = isSource ? '#3b82f6' : nodeColor;

            // Increase size for more padding
            // PHYSICAL: 24x24 -> Highlight 36x36 (offset -6)
            // LOGICAL: 100x60 -> Highlight 112x72 (offset -6)
            const isPhysical = this.dataStore.getState().meta.mode === 'PHYSICAL' || this.dataStore.getState().meta.mode === 'NETWORK';

            const highlight = new Konva.Rect({
                name: isSource ? 'source-highlight' : 'selection-highlight',
                width: isPhysical ? 36 : 112,
                height: isPhysical ? 36 : 72,
                x: -6,
                y: -6,
                fill: 'transparent',
                stroke: highlightColor,
                strokeWidth: 2, // Slightly thinner for elegance
                cornerRadius: isPhysical ? 8 : 12,
                dash: isSource ? [5, 5] : []
            });
            group.add(highlight);
            highlight.moveToTop(); // Move to front
        }

        this.layer.batchDraw();
    }

    renderConnections(connections, nodes, mode) {
        if (!connections || !nodes) return;

        // 1. Prepare Layout: Calculate start/end points for all connections with port distribution
        const result = this.calculateConnectionLayout(connections, nodes, mode);
        const layout = result.layout || result;
        this.connectionPortOffsets = result.portOffsets || {};

        // Track active connection IDs to remove stale ones
        const activeIds = new Set();

        // 2. Render/Update Lines
        Object.values(connections).forEach(conn => {
            const points = layout[conn.id];
            if (points) {
                activeIds.add(conn.id);
                const isSelected = this.selectedConnectionIds.has(conn.id);
                const lineColor = conn.color || '#94a3b8';

                let line = this.connectionLines[conn.id];

                if (line) {
                    // Update existing line
                    line.points(points);
                    line.stroke(lineColor);
                    line.dash(conn.category === 'Cable' && conn.type === 'Wireless' ? [10, 10] : []);
                    line.shadowColor(isSelected ? lineColor : null);
                    line.shadowBlur(isSelected ? 15 : 0);
                    line.shadowOpacity(isSelected ? 0.8 : 0);
                } else {
                    // Create new line
                    line = new Konva.Line({
                        points: points,
                        stroke: lineColor,
                        strokeWidth: 2,
                        hitStrokeWidth: 20, // Wider click detection area (20px)
                        lineCap: 'round',
                        lineJoin: 'round',
                        dash: conn.category === 'Cable' && conn.type === 'Wireless' ? [10, 10] : [],
                        listening: true, // Enable click events
                        id: conn.id, // Store connection ID for click handling
                        shadowColor: isSelected ? lineColor : null,
                        shadowBlur: isSelected ? 15 : 0,
                        shadowOpacity: isSelected ? 0.8 : 0
                    });

                    // Add click event handler
                    line.on('click', (e) => {
                        e.cancelBubble = true; // Prevent event from bubbling to background
                        this.handleConnectionClick(conn.id, e);
                    });

                    // Store line reference
                    this.connectionLines[conn.id] = line;
                    this.layer.add(line);
                    // line.moveToBottom(); // REMOVED: This puts lines behind the background image. Order is handled by render() sequence.
                }
            }
        });

        // 3. Cleanup stale lines
        Object.keys(this.connectionLines).forEach(connId => {
            if (!activeIds.has(connId)) {
                this.connectionLines[connId].destroy();
                delete this.connectionLines[connId];
            }
        });

        // 4. Update bend handles
        this.updateConnectionSelection();
    }

    calculateConnectionLayout(connections, nodes, mode) {
        // Use legacy routing as default
        return this.calculateConnectionLayoutLegacyWithPorts(connections, nodes, mode);
    }

    calculateConnectionPoints(conn, nodes, mode) {
        // Helper for PPT Export to get points for a single connection
        // We can reuse the existing layout calculation
        const result = this.calculateConnectionLayoutLegacyWithPorts({ [conn.id]: conn }, nodes, mode);
        return result.layout[conn.id];
    }

    calculateConnectionLayoutLegacyWithPorts(connections, nodes, mode) {
        // This is the legacy algorithm, but returns portOffsets for bend editing.
        const layout = {};
        const nodePorts = {};

        Object.keys(nodes).forEach(nodeId => {
            nodePorts[nodeId] = { top: [], bottom: [], left: [], right: [] };
        });

        Object.values(connections).forEach(conn => {
            const sourceNode = nodes[conn.source];
            const targetNode = nodes[conn.target];
            if (!sourceNode || !targetNode) return;

            const sourceRect = this.getNodeRect(sourceNode, mode);
            const targetRect = this.getNodeRect(targetNode, mode);
            const { sourceSide, targetSide } = this.determineConnectionSides(sourceRect, targetRect);

            if (nodePorts[conn.source]) nodePorts[conn.source][sourceSide].push({ conn, isSource: true, otherRect: targetRect });
            if (nodePorts[conn.target]) nodePorts[conn.target][targetSide].push({ conn, isSource: false, otherRect: sourceRect });
        });

        const portOffsets = {};

        Object.keys(nodePorts).forEach(nodeId => {
            const node = nodes[nodeId];
            const rect = this.getNodeRect(node, mode);
            const sides = nodePorts[nodeId];

            Object.keys(sides).forEach(side => {
                const connections = sides[side];
                if (connections.length === 0) return;

                const portCount = connections.length;
                const spacing = 10;
                const totalHeight = (portCount - 1) * spacing;
                let startY = rect.y + (rect.height / 2) - (totalHeight / 2);

                connections.forEach((connInfo, index) => {
                    const conn = connInfo.conn;
                    const isSource = connInfo.isSource;
                    const portY = startY + (index * spacing);

                    let portX, portY_final;
                    if (side === 'left') {
                        portX = rect.x;
                        portY_final = portY;
                    } else if (side === 'right') {
                        portX = rect.x + rect.width;
                        portY_final = portY;
                    } else if (side === 'top') {
                        portX = rect.x + (rect.width / 2); // Center for now
                        portY_final = rect.y;
                    } else { // bottom
                        portX = rect.x + (rect.width / 2);
                        portY_final = rect.y + rect.height;
                    }

                    if (!portOffsets[conn.id]) portOffsets[conn.id] = {};
                    if (isSource) {
                        portOffsets[conn.id].start = { x: portX, y: portY_final, side };
                    } else {
                        portOffsets[conn.id].end = { x: portX, y: portY_final, side };
                    }
                });
            });
        });

        Object.values(connections).forEach(conn => {
            const offsets = portOffsets[conn.id];
            if (offsets?.start && offsets?.end) {
                // Check if there is a stored bendX override
                const bendX = this.getConnectionBendX(conn, mode);

                let points;
                if (typeof bendX === 'number') {
                    // Use stored bendX
                    points = this.buildBendOverrideRoute(offsets.start, offsets.end, bendX);
                } else {
                    // Calculate default route
                    points = this.calculateManhattanRoute(offsets.start, offsets.end);
                    // Only snap internal segments if using default routing (custom routing is already snapped)
                    points = this.snapOrthogonalInternalSegmentsToHalfGrid(points);
                }

                layout[conn.id] = points;
            }
        });

        this.applyPathSeparation(layout);

        return { layout, portOffsets };
    }

    getNodeRect(node, mode) {
        // Try to get live position from Konva group first (for smooth dragging)
        const group = this.nodeGroups[node.id];
        if (group) {
            return {
                x: group.x(),
                y: group.y(),
                width: mode === 'PHYSICAL' ? 24 : 100,
                height: mode === 'PHYSICAL' ? 24 : 60
            };
        }

        if (mode === 'PHYSICAL') {
            return {
                x: node.physicalPos?.x || 0,
                y: node.physicalPos?.y || 0,
                width: 24,
                height: 24
            };
        } else {
            return {
                x: (node.logicalPos?.col || 0) * 24,
                y: (node.logicalPos?.row || 0) * 24,
                width: 100,
                height: 60
            };
        }
    }

    determineConnectionSides(sourceRect, targetRect) {
        // Calculate horizontal gap between blocks
        const sourceRight = sourceRect.x + sourceRect.width;
        const targetRight = targetRect.x + targetRect.width;

        // Gap calculation:
        // If target is right of source: target.x - sourceRight
        // If target is left of source: source.x - targetRight
        // Negative gap means overlap
        const gap = Math.max(0, targetRect.x - sourceRight, sourceRect.x - targetRight);

        // Threshold for "vertical alignment" or "too close for S-shape"
        // If gap is small, we force same-side routing to avoid cutting through
        const VERTICAL_ALIGN_THRESHOLD = 40;

        if (gap < VERTICAL_ALIGN_THRESHOLD) {
            // Blocks are vertically aligned or close horizontally
            // Decide side based on relative center X position
            const sourceCenterX = sourceRect.x + sourceRect.width / 2;
            const targetCenterX = targetRect.x + targetRect.width / 2;

            if (targetCenterX >= sourceCenterX) {
                // Target is slightly right or aligned -> Use Right-Right
                return { sourceSide: 'right', targetSide: 'right' };
            } else {
                // Target is left -> Use Left-Left
                return { sourceSide: 'left', targetSide: 'left' };
            }
        }

        // Standard S-shape routing for horizontally separated blocks
        const dx = (targetRect.x + targetRect.width / 2) - (sourceRect.x + sourceRect.width / 2);

        if (dx > 0) { // Target is to the right
            return { sourceSide: 'right', targetSide: 'left' };
        } else { // Target is to the left
            return { sourceSide: 'left', targetSide: 'right' };
        }
    }

    calculateManhattanRoute(start, end, buffer = 20) {
        const points = [start.x, start.y];

        let p1 = { ...start };
        let p2 = { ...end };

        // Apply buffer based on side
        switch (start.side) {
            case 'top': p1.y -= buffer; break;
            case 'bottom': p1.y += buffer; break;
            case 'left': p1.x -= buffer; break;
            case 'right': p1.x += buffer; break;
        }

        const targetBuffer = 20;
        switch (end.side) {
            case 'top': p2.y -= targetBuffer; break;
            case 'bottom': p2.y += targetBuffer; break;
            case 'left': p2.x -= targetBuffer; break;
            case 'right': p2.x += targetBuffer; break;
        }

        points.push(p1.x, p1.y);

        const startVertical = start.side === 'top' || start.side === 'bottom';
        const endVertical = end.side === 'top' || end.side === 'bottom';

        if (startVertical === endVertical) {
            // Same orientation (Vertical-Vertical or Horizontal-Horizontal)
            if (startVertical) {
                // Top-Top, Bottom-Bottom, Top-Bottom
                const midY = (p1.y + p2.y) / 2;
                points.push(p1.x, midY);
                points.push(p2.x, midY);
            } else {
                // Left-Left, Right-Right, Left-Right
                // For Same-Side routing (Left-Left or Right-Right), we need to go OUTWARDS
                // instead of averaging, to avoid cutting through if blocks are misaligned.

                let midX;
                if (start.side === end.side) {
                    if (start.side === 'left') {
                        // Left-Left: Go to the leftmost point
                        midX = Math.min(p1.x, p2.x);
                    } else {
                        // Right-Right: Go to the rightmost point
                        midX = Math.max(p1.x, p2.x);
                    }
                } else {
                    // Left-Right or Right-Left: Average is fine
                    midX = (p1.x + p2.x) / 2;
                }

                points.push(midX, p1.y);
                points.push(midX, p2.y);
            }
        } else {
            // Different orientation (Corner)
            if (startVertical) {
                points.push(p1.x, p2.y);
            } else {
                points.push(p2.x, p1.y);
            }
        }

        points.push(p2.x, p2.y);
        points.push(end.x, end.y);

        return points;
    }

    /**
     * Snap ONLY the middle vertical segment (between 2nd and 3rd bends) to half-grid (12px).
     * - Applies ONLY to connections that have exactly 2 bends (horizontal->vertical->horizontal).
     * - Skips stub segments directly connected to blocks (first segment from start, last segment to end).
     * - Preserves all endpoint and stub positions to avoid moving port positions.
     */
    snapOrthogonalInternalSegmentsToHalfGrid(points) {
        if (!points || points.length < 8) return points; // Need at least: start, stub, bend1, bend2, stub, end = 6 points = 12 coords

        const snapped = points.slice();

        // For a typical 2-bend route (horizontal->vertical->horizontal):
        // [0,1]: start anchor (block connection - skip)
        // [2,3]: stub out from start (block connection - skip)
        // [4,5]: first bend (horizontal->vertical)
        // [6,7]: second bend (vertical->horizontal) <- THIS is the middle vertical segment we want to snap
        // [8,9]: stub in to end (block connection - skip)
        // [10,11]: end anchor (block connection - skip)

        // Find the middle vertical segment: look for segment between 2nd and 3rd bend points
        // We want to identify the vertical segment that is NOT connected to start/end anchors

        // Strategy: skip first 2 points (start + stub), skip last 2 points (stub + end)
        // Look for vertical segment in the middle
        const startSkip = 4; // Skip first 2 points (4 coords: start anchor + stub)
        const endSkip = 4;   // Skip last 2 points (4 coords: stub + end anchor)

        if (snapped.length < startSkip + endSkip + 4) return points; // Need at least 2 middle points

        // Search for vertical segment in the middle region
        for (let i = startSkip; i < snapped.length - endSkip - 2; i += 2) {
            const next = i + 2;
            if (next >= snapped.length - endSkip) break;

            const x1 = snapped[i];
            const y1 = snapped[i + 1];
            const x2 = snapped[next];
            const y2 = snapped[next + 1];

            // Check if this is a vertical segment (same X, different Y)
            if (Math.abs(x1 - x2) < 0.1 && Math.abs(y1 - y2) > 0.1) {
                // This is the middle vertical segment - snap its X coordinate
                const sx = this.snapToHalfGridX(x1);
                snapped[i] = sx;
                snapped[next] = sx;
                // Only snap the first vertical segment found in the middle (the main vertical run)
                break;
            }
        }

        return this.simplifyOrthogonalPoints(snapped);
    }

    snapToHalfGridX(x) {
        // Grid = 24px -> half-grid = 12px
        return Math.round(x / 12) * 12;
    }

    simplifyOrthogonalPoints(points) {
        if (!points || points.length < 4) return points;
        const simplified = [points[0], points[1]];
        for (let i = 2; i < points.length - 2; i += 2) {
            const prevX = simplified[simplified.length - 2];
            const prevY = simplified[simplified.length - 1];
            const currX = points[i];
            const currY = points[i + 1];
            const nextX = points[i + 2];
            const nextY = points[i + 3];

            // Skip intermediate points that are collinear
            const isHorizontal = Math.abs(prevY - currY) < 0.1 && Math.abs(currY - nextY) < 0.1;
            const isVertical = Math.abs(prevX - currX) < 0.1 && Math.abs(currX - nextX) < 0.1;

            if (!isHorizontal && !isVertical) {
                simplified.push(currX, currY);
            }
        }
        simplified.push(points[points.length - 2], points[points.length - 1]);
        return simplified;
    }

    applyPathSeparation(layout) {
        // Group connections by source node and side
        const groups = {};
        Object.entries(layout).forEach(([connId, points]) => {
            if (points.length < 4) return;
            const startX = points[0];
            const startY = points[1];
            const key = `${startX},${startY}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push({ connId, points, startX, startY });
        });

        // Process groups with multiple connections
        Object.values(groups).forEach(group => {
            if (group.length <= 1) return;
            group.sort((a, b) => a.startY - b.startY);

            const gap = 10;
            group.forEach((seg, idx) => {
                const offset = (idx - (group.length - 1) / 2) * gap;
                if (Math.abs(offset) < 0.1) return;

                // Find vertical segment and adjust
                for (let i = 2; i < seg.points.length - 2; i += 2) {
                    const x1 = seg.points[i];
                    const y1 = seg.points[i + 1];
                    const x2 = seg.points[i + 2];
                    const y2 = seg.points[i + 3];
                    if (Math.abs(x1 - x2) < 0.1) {
                        const newX = x1 + offset;
                        seg.points[i] = newX;
                        seg.points[i + 2] = newX;
                        break;
                    }
                }
            });
        });
    }

    handleConnectionClick(connId, e) {
        const isMultiSelect = this.modifierKeys.shift || this.modifierKeys.ctrl;

        if (isMultiSelect) {
            // Toggle selection
            if (this.selectedConnectionIds.has(connId)) {
                this.selectedConnectionIds.delete(connId);
            } else {
                this.selectedConnectionIds.add(connId);
            }
        } else {
            // Single select: clear all and select this one
            this.selectedConnectionIds.clear();
            this.selectedConnectionIds.add(connId);
            // Clear node selection when cable is selected
            this.selectedNodeIds.clear();
            this.updateAllNodeHighlights();
        }

        this.updateConnectionSelection();
    }

    updateConnectionSelection() {
        // Update shadow effect for selected connections
        Object.entries(this.connectionLines).forEach(([connId, line]) => {
            const isSelected = this.selectedConnectionIds.has(connId);
            if (isSelected) {
                // Get connection color for shadow
                const data = this.dataStore.getState();
                const conn = data.connections[connId];
                const shadowColor = conn?.color || '#94a3b8';

                line.shadowColor(shadowColor);
                line.shadowBlur(15);
                line.shadowOpacity(0.8);
            } else {
                // Remove shadow for unselected connections
                line.shadowColor(null);
                line.shadowBlur(0);
                line.shadowOpacity(0);
            }
        });

        this.updateConnectionBendHandles();
        this.layer.batchDraw();
    }

    updateConnectionBendHandles() {
        const mode = this.dataStore.getState().meta.mode;
        const editableMode = (mode === 'LOGICAL' || mode === 'PHYSICAL' || mode === 'NETWORK');

        // Remove handles that should not exist
        Object.keys(this.connectionBendHandles).forEach(connId => {
            if (!editableMode || !this.selectedConnectionIds.has(connId) || !this.connectionLines[connId]) {
                this.connectionBendHandles[connId].destroy();
                delete this.connectionBendHandles[connId];
            }
        });

        if (!editableMode) return;

        const data = this.dataStore.getState();

        Array.from(this.selectedConnectionIds).forEach(connId => {
            const line = this.connectionLines[connId];
            if (!line) return;
            const info = this.getPrimaryVerticalSegmentInfo(line.points());
            if (!info) return;

            const conn = data.connections?.[connId];
            const color = conn?.color || '#94a3b8';

            let handle = this.connectionBendHandles[connId];
            if (!handle) {
                handle = new Konva.Circle({
                    x: info.x,
                    y: info.yMid,
                    radius: 6,
                    fill: '#ffffff',
                    stroke: color,
                    strokeWidth: 2,
                    shadowColor: 'black',
                    shadowBlur: 4,
                    shadowOpacity: 0.15,
                    draggable: true,
                    listening: true
                });

                handle.on('mousedown', (e) => { e.cancelBubble = true; });

                handle.dragBoundFunc((pos) => ({ x: this.snapToHalfGridX(pos.x), y: info.yMid }));

                // Live preview while dragging (store write only on dragend)
                handle.on('dragmove', () => {
                    const bendX = this.snapToHalfGridX(handle.x());
                    const offsets = this.connectionPortOffsets?.[connId];
                    if (!offsets?.start || !offsets?.end) return;

                    const newPoints = this.buildBendOverrideRoute(offsets.start, offsets.end, bendX);
                    line.points(newPoints);

                    const updated = this.getPrimaryVerticalSegmentInfo(newPoints);
                    if (updated) handle.position({ x: bendX, y: updated.yMid });

                    this.layer.batchDraw();
                });

                handle.on('dragend', () => {
                    const bendX = this.snapToHalfGridX(handle.x());
                    this.setConnectionBendX(connId, mode, bendX);
                });

                this.connectionBendHandles[connId] = handle;
                this.layer.add(handle);
                handle.moveToTop();
            } else {
                handle.position({ x: info.x, y: info.yMid });
                handle.stroke(color);
                handle.moveToTop();
            }
        });
    }

    getPrimaryVerticalSegmentInfo(points) {
        if (!points || points.length < 4) return null;

        let best = null;
        for (let i = 0; i < points.length - 2; i += 2) {
            const x1 = points[i];
            const y1 = points[i + 1];
            const x2 = points[i + 2];
            const y2 = points[i + 3];
            if (Math.abs(x1 - x2) >= 0.1) continue;
            const len = Math.abs(y2 - y1);
            if (len <= 0) continue;
            if (!best || len > best.len) best = { index: i, x: x1, y1, y2, len };
        }
        if (!best) return null;
        return { ...best, yMid: (best.y1 + best.y2) / 2 };
    }

    buildBendOverrideRoute(start, end, bendX, buffer = 20) {
        const points = [start.x, start.y];

        const p1 = { ...start };
        const p2 = { ...end };

        switch (start.side) {
            case 'top': p1.y -= buffer; break;
            case 'bottom': p1.y += buffer; break;
            case 'left': p1.x -= buffer; break;
            case 'right': p1.x += buffer; break;
        }

        switch (end.side) {
            case 'top': p2.y -= buffer; break;
            case 'bottom': p2.y += buffer; break;
            case 'left': p2.x -= buffer; break;
            case 'right': p2.x += buffer; break;
        }

        points.push(p1.x, p1.y);
        points.push(bendX, p1.y);
        points.push(bendX, p2.y);
        points.push(p2.x, p2.y);
        points.push(end.x, end.y);

        return this.simplifyOrthogonalPoints(points);
    }

    setConnectionBendX(connId, mode, bendX) {
        const field = (mode === 'LOGICAL') ? 'bendXLogical' : 'bendXPhysical';
        this.dataStore.updateConnection(connId, { [field]: bendX });
    }

    handleConnectionArrowKey(e) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) return;

        const dx = e.key === 'ArrowLeft' ? -12 : (e.key === 'ArrowRight' ? 12 : 0);
        if (!dx) return;

        e.preventDefault();

        const mode = this.dataStore.getState().meta.mode;
        const data = this.dataStore.getState();

        Array.from(this.selectedConnectionIds).forEach(connId => {
            const conn = data.connections?.[connId];
            if (!conn) return;

            let bendX = this.getConnectionBendX(conn, mode);
            if (typeof bendX !== 'number') {
                const line = this.connectionLines[connId];
                const info = line ? this.getPrimaryVerticalSegmentInfo(line.points()) : null;
                if (!info) return;
                bendX = info.x;
            }

            const next = this.snapToHalfGridX(bendX + dx);
            this.setConnectionBendX(connId, mode, next);
        });
    }

    getConnectionBendX(conn, mode) {
        const field = (mode === 'LOGICAL') ? 'bendXLogical' : 'bendXPhysical';
        return conn[field];
    }

    handleKeyDown(e) {
        // Check if focus is on input/textarea (prevent deletion during text editing)
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) return;

        // Handle Delete key
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.handleDeleteKey(e);
            return;
        }

        // Handle Arrow keys for connections
        if (this.selectedConnectionIds.size > 0) {
            this.handleConnectionArrowKey(e);
            return;
        }

        // Handle Arrow keys for nodes
        if (this.selectedNodeIds.size > 0) {
            this.handleArrowKey(e);
        }
    }

    handleDeleteKey(e) {
        const data = this.dataStore.getState();

        // Delete selected connections
        if (this.selectedConnectionIds.size > 0) {
            Array.from(this.selectedConnectionIds).forEach(connId => {
                this.dataStore.removeConnection(connId);
            });
            this.selectedConnectionIds.clear();
            this.updateConnectionSelection();
        }

        // Delete selected nodes
        if (this.selectedNodeIds.size > 0) {
            const nodeIdsToDelete = Array.from(this.selectedNodeIds);
            this.dataStore.deleteNodes(nodeIdsToDelete);
            this.selectedNodeIds.clear();
            this.updateAllNodeHighlights();
        }
    }

    handleArrowKey(e) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) return;

        const dx = e.key === 'ArrowLeft' ? -24 : (e.key === 'ArrowRight' ? 24 : 0);
        const dy = e.key === 'ArrowUp' ? -24 : (e.key === 'ArrowDown' ? 24 : 0);

        if (!dx && !dy) return;

        e.preventDefault();

        const mode = this.dataStore.getState().meta.mode;
        const data = this.dataStore.getState();

        Array.from(this.selectedNodeIds).forEach(nodeId => {
            const nodes = mode === 'NETWORK' ? data.networkNodes : data.nodes;
            const node = nodes[nodeId];
            if (!node) return;

            if (mode === 'LOGICAL') {
                const currentCol = node.logicalPos?.col || 0;
                const currentRow = node.logicalPos?.row || 0;
                const newCol = currentCol + (dx / 24);
                const newRow = currentRow + (dy / 24);
                this.dataStore.updateNode(nodeId, {
                    logicalPos: { col: newCol, row: newRow }
                });
            } else {
                // PHYSICAL / NETWORK mode
                const currentX = node.physicalPos?.x || 0;
                const currentY = node.physicalPos?.y || 0;
                this.dataStore.updateNode(nodeId, {
                    physicalPos: {
                        x: currentX + dx,
                        y: currentY + dy
                    }
                });
            }
        });
    }
}
