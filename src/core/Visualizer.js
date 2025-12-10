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
        this.connectionSourceNodeId = null;
        this.nodeGroups = {}; // Store node groups for highlighting

        // Interaction state management
        this.interactionMode = 'IDLE'; // 'IDLE' | 'DRAGGING' | 'SELECTING_AREA'
        this.dragStart = null; // {x, y} - Mouse position when drag started
        this.initialBlockPositions = new Map(); // Map<nodeId, {x, y}> - Initial positions of selected blocks when drag starts

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
        const container = document.getElementById('canvas-container');
        this.width = container.offsetWidth;
        this.height = container.offsetHeight;

        this.stage = new Konva.Stage({
            container: 'canvas-container',
            width: this.width,
            height: this.height,
        });

        this.layer = new Konva.Layer();
        this.stage.add(this.layer);

        // Handle resize
        window.addEventListener('resize', () => {
            this.width = container.offsetWidth;
            this.height = container.offsetHeight;
            this.stage.width(this.width);
            this.stage.height(this.height);
            this.render();
        });

        // Subscribe to data changes
        this.dataStore.subscribe(() => {
            this.render();
        });

        // Initial render
        this.render();

        // Keyboard event listeners for modifier keys
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') this.modifierKeys.shift = true;
            if (e.key === 'Control' || e.key === 'Meta') this.modifierKeys.ctrl = true;

            // Delete/Backspace key handler for node deletion
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.handleDeleteKey(e);
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') this.modifierKeys.shift = false;
            if (e.key === 'Control' || e.key === 'Meta') this.modifierKeys.ctrl = false;
        });

        // Box selection setup
        this.setupBoxSelection();

        // Background click handler for Request Mode and deselection
        this.stage.on('mousedown', (e) => {
            const mode = this.dataStore.getState().meta.mode;

            // If clicked on empty space (not on a node/shape)
            // Check if target is stage or layer (background)
            // Also check if a node was clicked (by checking if target has an id or is a group)
            const isNodeClick = e.target !== this.stage && e.target !== this.layer &&
                (e.target.id() || e.target.getParent()?.id() || e.target.getAttr('_nodeClicked'));

            if (isNodeClick) {
                // Node was clicked, don't process background click
                return;
            }

            if (e.target === this.stage || e.target === this.layer) {
                if (mode === 'REQUEST') {
                    // Request mode: add request marker (on click, not mousedown)
                    // Keep click handler for this
                } else {
                    // Other modes: deselect all nodes if Shift/Ctrl not pressed
                    if (!this.modifierKeys.shift && !this.modifierKeys.ctrl) {
                        this.selectedNodeIds.clear();
                        this.updateAllNodeHighlights();

                        // Hide property panel
                        if (window.app && window.app.propertyManager) {
                            window.app.propertyManager.deselectNode();
                        }

                        // Notify InteractionManager
                        if (this.onBackgroundClick) {
                            this.onBackgroundClick();
                        }
                    }

                    // Set interaction mode to SELECTING_AREA for box selection
                    this.interactionMode = 'SELECTING_AREA';
                    const pos = this.stage.getPointerPosition();
                    this.dragStart = { x: pos.x, y: pos.y };
                    this.boxStartPos = this.dragStart;

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

        // Keep click handler for Request Mode
        this.stage.on('click', (e) => {
            const mode = this.dataStore.getState().meta.mode;
            if (mode === 'REQUEST' && (e.target === this.stage || e.target === this.layer)) {
                const pos = this.stage.getPointerPosition();
                if (window.app && window.app.requestManager) {
                    window.app.requestManager.addRequest(pos.x, pos.y);
                }
            }
        });
    }

    setupBoxSelection() {
        this.stage.on('mousemove', (e) => {
            // Only draw selection box if in SELECTING_AREA mode
            if (this.interactionMode === 'SELECTING_AREA' && this.boxSelectionRect && this.dragStart) {
                const pos = this.stage.getPointerPosition();
                const width = pos.x - this.dragStart.x;
                const height = pos.y - this.dragStart.y;

                this.boxSelectionRect.setAttrs({
                    x: width < 0 ? pos.x : this.dragStart.x,
                    y: height < 0 ? pos.y : this.dragStart.y,
                    width: Math.abs(width),
                    height: Math.abs(height),
                    visible: true
                });
                this.layer.draw();
            }
        });

        this.stage.on('mouseup', (e) => {
            if (this.interactionMode === 'SELECTING_AREA' && this.boxSelectionRect && this.dragStart) {
                const pos = this.stage.getPointerPosition();
                const box = {
                    x: Math.min(this.dragStart.x, pos.x),
                    y: Math.min(this.dragStart.y, pos.y),
                    width: Math.abs(pos.x - this.dragStart.x),
                    height: Math.abs(pos.y - this.dragStart.y)
                };

                // Select nodes within box
                this.selectNodesInBox(box);

                // Remove selection rectangle
                this.boxSelectionRect.destroy();
                this.boxSelectionRect = null;
                this.dragStart = null;
                this.layer.draw();

                // Reset interaction mode
                this.interactionMode = 'IDLE';
            }
        });
    }

    selectNodesInBox(box) {
        const selectedNodes = new Set();

        Object.values(this.nodeGroups).forEach(group => {
            const nodeBox = {
                x: group.x(),
                y: group.y(),
                width: 100,
                height: 60
            };

            // Check if node intersects with selection box
            if (this.boxIntersects(box, nodeBox)) {
                selectedNodes.add(group.id());
            }
        });

        // Update selection
        // If Shift key is pressed, add to existing selection (union)
        // Otherwise, replace selection
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
        try {
            const data = this.dataStore.getState();
            const mode = data.meta.mode;

<<<<<<< HEAD
            // Don't render canvas in HARDWARE_LIST mode
            if (mode === 'HARDWARE_LIST') {
                return;
            }

=======
>>>>>>> 69958a1430fa59ef7d54047e968a915e3f18feb4
            // Clean up invalid selections (nodes that no longer exist)
            const existingNodeIds = new Set(Object.keys(data.nodes || {}));
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

            // Render Background Image
            if (data.meta.floorPlanImage && (mode === 'PHYSICAL' || mode === 'REQUEST')) {
                if (!this.bgImageNode) {
                    this.bgImageNode = new Konva.Image({
                        x: 0, y: 0,
                        image: this.bgImageObj,
                    });
                }

                // Update image source if changed
                if (this.bgImageObj.src !== data.meta.floorPlanImage) {
                    this.bgImageObj.src = data.meta.floorPlanImage;
                    this.bgImageObj.onload = () => {
                        this.layer.batchDraw();
                    };
                }

                this.layer.add(this.bgImageNode);
            }

            // Render Connections
            // console.log('Rendering connections...');
            this.renderConnections(data.connections, data.nodes, mode);

            // Render Nodes
            // console.log('Rendering nodes...');
            Object.values(data.nodes || {}).forEach(node => {
                this.renderNode(node, mode);
            });

            // Render Requests
            // console.log('Rendering requests...');
            Object.values(data.requests || {}).forEach(req => {
                this.renderRequest(req);
            });

            // console.log('Batch drawing...');
            this.layer.batchDraw();

            // Update highlights after rendering (nodeGroups are now populated)
            // console.log('Updating highlights...');
            this.updateAllNodeHighlights();
            // console.log('Render complete.');
        } catch (error) {
            console.error('Visualizer Render Error:', error);
        }
    }

    renderConnections(connections, nodes, mode) {
        if (!connections || !nodes) return;

        // 1. Prepare Layout: Calculate start/end points for all connections with port distribution
        const layout = this.calculateConnectionLayout(connections, nodes, mode);

        // 2. Render Lines
        Object.values(connections).forEach(conn => {
            const points = layout[conn.id];
            if (points) {
                const line = new Konva.Line({
                    points: points,
                    stroke: conn.color || '#94a3b8',
                    strokeWidth: 2,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dash: conn.category === 'Cable' && conn.type === 'Wireless' ? [10, 10] : [],
                    listening: false
                });

                this.layer.add(line);
                line.moveToBottom();
            }
        });
    }

    calculateConnectionLayout(connections, nodes, mode) {
        const layout = {};
        const nodePorts = {}; // Map<nodeId, { top: [], bottom: [], left: [], right: [] }>

        // Initialize port groups
        Object.keys(nodes).forEach(nodeId => {
            nodePorts[nodeId] = { top: [], bottom: [], left: [], right: [] };
        });

        // Step 1: Assign connections to sides
        Object.values(connections).forEach(conn => {
            const sourceNode = nodes[conn.source];
            const targetNode = nodes[conn.target];
            if (!sourceNode || !targetNode) return;

            const sourceRect = this.getNodeRect(sourceNode, mode);
            const targetRect = this.getNodeRect(targetNode, mode);

            // Determine sides
            const { sourceSide, targetSide } = this.determineConnectionSides(sourceRect, targetRect);

            // Add to groups
            if (nodePorts[conn.source]) nodePorts[conn.source][sourceSide].push({ conn, isSource: true, otherRect: targetRect });
            if (nodePorts[conn.target]) nodePorts[conn.target][targetSide].push({ conn, isSource: false, otherRect: sourceRect });
        });

        // Step 2: Sort and calculate offsets
        const portOffsets = {}; // Map<connId, { start: {x,y}, end: {x,y} }>

        Object.keys(nodePorts).forEach(nodeId => {
            const node = nodes[nodeId];
            const rect = this.getNodeRect(node, mode);
            const sides = nodePorts[nodeId];

            Object.keys(sides).forEach(side => {
                const ports = sides[side];
                if (ports.length === 0) return;

                // Sort ports to minimize crossing
                // For Top/Bottom sides, sort by otherRect.x
                // For Left/Right sides, sort by otherRect.y
                ports.sort((a, b) => {
                    if (side === 'top' || side === 'bottom') return a.otherRect.x - b.otherRect.x;
                    return a.otherRect.y - b.otherRect.y;
                });

                // Calculate offsets
                const length = (side === 'top' || side === 'bottom') ? rect.width : rect.height;
                const gap = length / (ports.length + 1);

                ports.forEach((port, index) => {
                    const offset = gap * (index + 1);
                    let x, y;

                    switch (side) {
                        case 'top': x = rect.x + offset; y = rect.y; break;
                        case 'bottom': x = rect.x + offset; y = rect.y + rect.height; break;
                        case 'left': x = rect.x; y = rect.y + offset; break;
                        case 'right': x = rect.x + rect.width; y = rect.y + offset; break;
                    }

                    if (!portOffsets[port.conn.id]) portOffsets[port.conn.id] = {};
                    if (port.isSource) {
                        portOffsets[port.conn.id].start = { x, y, side };
                    } else {
                        portOffsets[port.conn.id].end = { x, y, side };
                    }
                });
            });
        });

        // Step 3: Calculate Manhattan Routes
        Object.values(connections).forEach(conn => {
            const offsets = portOffsets[conn.id];
            if (offsets && offsets.start && offsets.end) {
                layout[conn.id] = this.calculateManhattanRoute(offsets.start, offsets.end);
            }
        });

        // Step 4: Path Separation (Post-processing)
        this.applyPathSeparation(layout);

        return layout;
    }

    applyPathSeparation(layout) {
        const verticalSegments = [];

        // 1. Collect all vertical segments
        Object.entries(layout).forEach(([connId, points]) => {
            for (let i = 0; i < points.length - 2; i += 2) {
                const x1 = points[i];
                const y1 = points[i + 1];
                const x2 = points[i + 2];
                const y2 = points[i + 3];

                if (Math.abs(x1 - x2) < 0.1) { // Vertical segment
                    verticalSegments.push({
                        connId,
                        index: i, // Start index of the segment in points array
                        x: x1,
                        yMin: Math.min(y1, y2),
                        yMax: Math.max(y1, y2)
                    });
                }
            }
        });

        // 2. Group by X-coordinate
        const groups = {};
        verticalSegments.forEach(seg => {
            const key = Math.round(seg.x); // Group by integer X
            if (!groups[key]) groups[key] = [];
            groups[key].push(seg);
        });

        // 3. Process groups
        Object.values(groups).forEach(group => {
            if (group.length <= 1) return;

            // Sort by Y position to minimize crossing
            group.sort((a, b) => a.yMin - b.yMin);

            // Check for actual overlap in Y ranges
            // Simple approach: just spread them all if they share X
            // Better approach: only spread overlapping subgroups. 
            // For simplicity and robustness as per spec, we spread the whole group.

            const gap = 10;
            const count = group.length;

            group.forEach((seg, index) => {
                const offset = (index - (count - 1) / 2) * gap;
                const newX = seg.x + offset;

                // Update the points in the layout
                const points = layout[seg.connId];
                points[seg.index] = newX;     // x1
                points[seg.index + 2] = newX; // x2
            });
        });
    }

    determineConnectionSides(sourceRect, targetRect) {
        // Strict Left/Right logic as per user request
        const dx = (targetRect.x + targetRect.width / 2) - (sourceRect.x + sourceRect.width / 2);

        let sourceSide, targetSide;

        if (dx > 0) { // Target is to the right
            sourceSide = 'right';
            targetSide = 'left';
        } else { // Target is to the left
            sourceSide = 'left';
            targetSide = 'right';
        }

        return { sourceSide, targetSide };
    }

    calculateManhattanRoute(start, end, buffer = 20) {
        const points = [start.x, start.y];

        let p1 = { ...start };
        let p2 = { ...end };

        // Apply buffer based on side
        // Use the dynamic buffer for Source (p1)
        switch (start.side) {
            case 'top': p1.y -= buffer; break;
            case 'bottom': p1.y += buffer; break;
            case 'left': p1.x -= buffer; break;
            case 'right': p1.x += buffer; break;
        }

        // Use fixed buffer for Target (p2) for now, or could calculate similarly
        const targetBuffer = 20;
        switch (end.side) {
            case 'top': p2.y -= targetBuffer; break;
            case 'bottom': p2.y += targetBuffer; break;
            case 'left': p2.x -= targetBuffer; break;
            case 'right': p2.x += targetBuffer; break;
        }

        points.push(p1.x, p1.y);

        // Calculate intermediate points (Midpoints)
        // Simple Z-routing or U-routing
        // We want to move from p1 to p2 using only H/V lines

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // Determine orientation based on sides
        const startVertical = start.side === 'top' || start.side === 'bottom';
        const endVertical = end.side === 'top' || end.side === 'bottom';

        if (startVertical === endVertical) {
            // Same orientation (e.g., Top to Top, or Top to Bottom)
            if (startVertical) {
                // Vertical start/end
                if ((start.side === 'bottom' && end.side === 'top' && p1.y < p2.y) ||
                    (start.side === 'top' && end.side === 'bottom' && p1.y > p2.y)) {
                    // Direct path possible with Z-shape (vertical -> horizontal -> vertical)
                    points.push(p1.x, midY);
                    points.push(p2.x, midY);
                } else {
                    // U-shape needed (go out, move sideways, go in)
                    // Or simple Z if enough space?
                    // Let's use midY
                    points.push(p1.x, midY);
                    points.push(p2.x, midY);
                }
            } else {
                // Horizontal start/end
                points.push(midX, p1.y);
                points.push(midX, p2.y);
            }
        } else {
            // Different orientation (e.g., Right to Bottom)
            // Just one corner needed usually
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

    getNodeRect(node, mode) {
        let x, y;
        if (mode === 'LOGICAL') {
            x = (node.logicalPos?.col || 0) * 24;
            y = (node.logicalPos?.row || 0) * 24;
        } else {
            x = node.physicalPos?.x || 0;
            y = node.physicalPos?.y || 0;
        }
        return {
            x: x,
            y: y,
            width: 100,
            height: 60
        };
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
            draggable = (mode === 'PHYSICAL');
        }

        const group = new Konva.Group({
            x: x,
            y: y,
            draggable: draggable,
            id: node.id
        });

        // Dynamic Color
        const nodeColor = node.color || '#94a3b8'; // Default slate-400

        // Shape (Rounded Rect)
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
            y: hasModel ? 28 : 40, // Adjusted to 28 (was 25) for better centering
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
                y: 42, // Adjusted to 42 (was 40) for better centering
                width: 100,
                align: 'center',
                fill: '#94a3b8'
            });
            group.add(modelText);
        }

        // Store group reference for highlighting
        this.nodeGroups[node.id] = group;

        // Selection Handler - PPT style: use mousedown event
        group.on('mousedown', (e) => {
            // Stop event propagation to prevent background click handler
            e.cancelBubble = true;
            if (e.evt) {
                e.evt.stopPropagation();
                e.evt.stopImmediatePropagation();
            }

            // Prevent background handler from running by setting a flag
            e.target.setAttr('_nodeClicked', true);
            setTimeout(() => {
                if (e.target) {
                    e.target.setAttr('_nodeClicked', false);
                }
            }, 100);

            // Handle node selection (PPT style)
            const isMultiSelect = this.modifierKeys.shift || this.modifierKeys.ctrl;
            const wasSelected = this.selectedNodeIds.has(node.id);

            if (isMultiSelect) {
                // Multi-select mode: toggle selection
                if (wasSelected) {
                    // Toggle Off: remove from selection
                    this.selectedNodeIds.delete(node.id);
                } else {
                    // Toggle On: add to selection
                    this.selectedNodeIds.add(node.id);
                }
            } else {
                // Single select mode: ALWAYS clear all selections first, then select this one
                // This ensures only one block is selected at a time
                this.selectedNodeIds.clear();
                this.selectedNodeIds.add(node.id);
            }

            // Store initial positions of all selected blocks for drag preparation
            this.initialBlockPositions.clear();
            this.selectedNodeIds.forEach(selectedId => {
                if (this.nodeGroups[selectedId]) {
                    const selectedGroup = this.nodeGroups[selectedId];
                    this.initialBlockPositions.set(selectedId, {
                        x: selectedGroup.x(),
                        y: selectedGroup.y()
                    });
                }
            });

            // Update highlights immediately (only if nodeGroups are populated)
            if (Object.keys(this.nodeGroups).length > 0) {
                this.updateAllNodeHighlights();
            }

            // Call original handler for property panel (only if single node is selected)
            if (this.selectedNodeIds.has(node.id) && this.selectedNodeIds.size === 1) {
                if (this.onNodeSelect) {
                    this.onNodeSelect(node.id);
                }
            } else if (this.selectedNodeIds.size === 0) {
                // Deselect property panel if nothing is selected
                if (window.app && window.app.propertyManager) {
                    window.app.propertyManager.deselectNode();
                }
            }
        });

        // Drag events - PPT style: only selected blocks can be dragged
        if (mode === 'PHYSICAL' || mode === 'LOGICAL') {
            group.on('dragstart', (e) => {
                // Only allow drag if this node is selected
                if (!this.selectedNodeIds.has(node.id)) {
                    e.evt.preventDefault();
                    return;
                }

                // Set interaction mode to DRAGGING
                this.interactionMode = 'DRAGGING';

                // Store drag start position (mouse coordinates)
                const pos = this.stage.getPointerPosition();
                this.dragStart = { x: pos.x, y: pos.y };

                // Store initial positions of all selected blocks in Map
                this.initialBlockPositions.clear();
                this.selectedNodeIds.forEach(selectedId => {
                    if (this.nodeGroups[selectedId]) {
                        const selectedGroup = this.nodeGroups[selectedId];
                        this.initialBlockPositions.set(selectedId, {
                            x: selectedGroup.x(),
                            y: selectedGroup.y()
                        });
                    }
                });

                // Update selection highlight if this node is selected
                this.updateNodeHighlight(node.id);

                this.layer.add(group);
            });

            group.on('dragmove', (e) => {
                // Only process if in DRAGGING mode
                if (this.interactionMode !== 'DRAGGING') {
                    return;
                }

                // Only move if this node is selected
                if (!this.selectedNodeIds.has(node.id)) {
                    return;
                }

                // Calculate delta from drag start position
                const pos = this.stage.getPointerPosition();
                const deltaX = pos.x - this.dragStart.x;
                const deltaY = pos.y - this.dragStart.y;

                // Move all selected nodes together
                this.selectedNodeIds.forEach(selectedId => {
                    if (this.nodeGroups[selectedId] && this.initialBlockPositions.has(selectedId)) {
                        const selectedGroup = this.nodeGroups[selectedId];
                        const initialPos = this.initialBlockPositions.get(selectedId);
                        const newX = initialPos.x + deltaX;
                        const newY = initialPos.y + deltaY;

                        // Don't snap during drag - allow free movement
                        selectedGroup.position({ x: newX, y: newY });
                    }
                });
                this.layer.batchDraw();
            });

            group.on('dragend', (e) => {
                // Only process if in DRAGGING mode
                if (this.interactionMode !== 'DRAGGING') {
                    return;
                }

                // Update positions of all selected nodes
                this.selectedNodeIds.forEach(selectedId => {
                    if (this.nodeGroups[selectedId]) {
                        const selectedGroup = this.nodeGroups[selectedId];
                        const nodeData = this.dataStore.getState().nodes[selectedId];
                        if (nodeData) {
                            if (mode === 'LOGICAL') {
                                // Snap to nearest grid position
                                const currentX = selectedGroup.x();
                                const currentY = selectedGroup.y();
                                const snappedX = this.snapToGridX(currentX);
                                const snappedY = this.snapToGridY(currentY);
                                // Apply snap position
                                selectedGroup.position({ x: snappedX, y: snappedY });
                                // Convert pixel position to grid coordinates (using 24px grid)
                                const col = Math.round(snappedX / 24);
                                const row = Math.round(snappedY / 24);
                                this.dataStore.updateNode(selectedId, {
                                    logicalPos: { col, row }
                                });
                            } else {
                                this.dataStore.updateNode(selectedId, {
                                    physicalPos: {
                                        x: selectedGroup.x(),
                                        y: selectedGroup.y()
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

                // Reset interaction mode
                this.interactionMode = 'IDLE';
                this.dragStart = null;
                this.initialBlockPositions.clear();
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
        // Only update if nodeGroups are populated (after render)
        if (Object.keys(this.nodeGroups).length === 0) {
            return; // Skip if no nodes rendered yet
        }

        Object.keys(this.nodeGroups).forEach(nodeId => {
            this.updateNodeHighlight(nodeId);
        });

        // Update draggable state: only selected blocks can be dragged (PPT style)
        const mode = this.dataStore.getState().meta.mode;
        const isDraggableMode = mode === 'PHYSICAL' || mode === 'LOGICAL';

        Object.keys(this.nodeGroups).forEach(nodeId => {
            const group = this.nodeGroups[nodeId];
            if (group) {
                // Only enable dragging if node is selected and mode allows dragging
                const isSelected = this.selectedNodeIds.has(nodeId);
                group.draggable(isDraggableMode && isSelected);
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
            const node = this.dataStore.getState().nodes[nodeId];

            // Determine Color
            let highlightColor;
            if (isSource && this.connectionSourceCable) {
                highlightColor = this.connectionSourceCable.color || '#3b82f6';
            } else {
                highlightColor = node ? node.color : '#10b981';
            }

            // Determine Dash Style
            let dash = [];
            if (isSource && this.connectionSourceCable) {
                // Wireless = Dashed, Wired = Solid
                if (this.connectionSourceCable.type === 'Wireless') {
                    dash = [10, 10];
                }
            } else if (isSource) {
                dash = [5, 5]; // Default source dash if no cable info
            }

            const highlight = new Konva.Rect({
                name: isSource ? 'source-highlight' : 'selection-highlight',
                width: 112, // +6px padding on each side
                height: 72, // +6px padding on each side
                x: -6,
                y: -6,
                fill: 'transparent',
                stroke: highlightColor,
                strokeWidth: 2,
                cornerRadius: 12,
                shadowColor: highlightColor,
                shadowBlur: 20,   // Stronger blur for "background shadow" effect
                shadowOpacity: 0.8,
                dash: dash
            });
            group.add(highlight);
            highlight.moveToTop(); // Move to front
        }

        this.layer.batchDraw();
    }

    handleDeleteKey(e) {
        // Check if focus is on input/textarea (prevent deletion during text editing)
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            return; // Don't delete nodes if user is typing in input/textarea
        }

        // Check if there are selected nodes
        if (this.selectedNodeIds.size === 0) {
            return; // Nothing to delete
        }

        // Create a copy of selected node IDs before clearing (important!)
        const nodeIdsToDelete = Array.from(this.selectedNodeIds);
        console.log('Deleting nodes:', nodeIdsToDelete); // Debug log

        // Clear selection first to prevent issues
        this.selectedNodeIds.clear();

        // Delete all selected nodes
        this.dataStore.deleteNodes(nodeIdsToDelete);

        // Update highlights
        if (Object.keys(this.nodeGroups).length > 0) {
            this.updateAllNodeHighlights();
        }

        // Hide property panel
        if (window.app && window.app.propertyManager) {
            window.app.propertyManager.deselectNode();
        }

        // Prevent default browser behavior (e.g., going back in history)
        e.preventDefault();
    }
}
