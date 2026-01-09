/**
 * PPT Export Manager
 * 
 * PptxGenJS 라이브러리를 사용하여 PowerPoint 프레젠테이션을 생성합니다.
 * 
 * 참고 자료:
 * - 공식 문서: https://gitbrent.github.io/PptxGenJS/
 * - GitHub 저장소: https://github.com/gitbrent/PptxGenJS/tree/master
 * - Shape API 문서: https://gitbrent.github.io/PptxGenJS/docs/api-shapes/
 * 
 * 사용 가능한 ShapeType (pres.ShapeType.*):
 * - rect: 일반 사각형
 * - roundRect: 둥근 모서리 사각형 (rectRadius 옵션 필요, 0-1 비율)
 *   참고: TypeScript 정의에서 shapes.ROUNDED_RECTANGLE = 'roundRect'이지만,
 *         실제 ShapeType enum에는 'roundRect'로 정의됨
 * - ellipse: 타원형
 * - line: 직선
 * - triangle: 삼각형
 * - 등등... (약 200개 이상의 도형 타입 지원)
 * 
 * 전체 ShapeType 목록은 GitHub 저장소의 types 폴더 또는 소스 코드에서 확인 가능:
 * https://github.com/gitbrent/PptxGenJS/tree/master/types
 */
export class PPTExportManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
    }

    exportToPPT(nodes, connectionsData, hardwareList) {
        try {
            const data = this.dataStore.getState();
            
            // Canvas dimensions: VIRTUAL_WIDTH = 960.26, VIRTUAL_HEIGHT = 540
            const VIRTUAL_WIDTH = 960.26;
            const VIRTUAL_HEIGHT = 540;
            
            // Filter nodes and connections separately for each mode
            // IMPORTANT: Each mode uses its own node set to ensure connections are calculated correctly
            
            // Configuration mode: use ONLY nodes with logicalPos (ignore physicalPos even if present)
            const configNodes = {};
            Object.entries(nodes).forEach(([id, node]) => {
                // Only include nodes that have logicalPos (Configuration mode nodes)
                if (node.logicalPos && (node.logicalPos.col !== undefined || node.logicalPos.row !== undefined)) {
                    const col = node.logicalPos.col || 0;
                    const row = node.logicalPos.row || 0;
                    const nodeX = col * 24;
                    const nodeY = row * 24;
                    const nodeW = 75; // Updated block width
                    const nodeH = 42;
                    const isVisible = nodeX < VIRTUAL_WIDTH && nodeY < VIRTUAL_HEIGHT && 
                                   (nodeX + nodeW) > 0 && (nodeY + nodeH) > 0;
                    if (isVisible) {
                        configNodes[id] = node;
                    }
                }
            });
            const configNodeIds = new Set(Object.keys(configNodes));
            // Use configurationConnections directly (already filtered by mode)
            const configConnections = {};
            const configurationConnections = connectionsData.configurationConnections || {};
            Object.entries(configurationConnections).forEach(([id, conn]) => {
                // Only include connections where both source and target are in configNodes set
                if (configNodeIds.has(conn.source) && configNodeIds.has(conn.target)) {
                    configConnections[id] = conn;
                }
            });

            // Installation mode: use ONLY nodes with physicalPos (ignore logicalPos even if present)
            const installNodes = {};
            Object.entries(nodes).forEach(([id, node]) => {
                // Only include nodes that have physicalPos (Installation mode nodes)
                if (node.physicalPos && (node.physicalPos.x !== undefined || node.physicalPos.y !== undefined)) {
                    const nodeX = node.physicalPos.x ?? 0;
                    const nodeY = node.physicalPos.y ?? 0;
                    const nodeW = 16.8;
                    const nodeH = 16.8;
                    const isVisible = nodeX < VIRTUAL_WIDTH && nodeY < VIRTUAL_HEIGHT && 
                                   (nodeX + nodeW) > 0 && (nodeY + nodeH) > 0;
                    if (isVisible) {
                        installNodes[id] = node;
                    }
                }
            });
            const installNodeIds = new Set(Object.keys(installNodes));
            // Use installationConnections directly (already filtered by mode)
            const installConnections = {};
            const installationConnections = connectionsData.installationConnections || {};
            Object.entries(installationConnections).forEach(([id, conn]) => {
                // Only include connections where both source and target are in installNodes set
                if (installNodeIds.has(conn.source) && installNodeIds.has(conn.target)) {
                    installConnections[id] = conn;
                }
            });
            
            // 1. Initialize PptxGenJS
            const pres = new PptxGenJS();
            pres.layout = 'LAYOUT_16x9';

            // --- Slide 1: Configuration ---
            this.addDiagramSlide(pres, 'System Configuration', configNodes, configConnections, 'CONFIGURATION');

            // --- Slide 2: Installation ---
            this.addDiagramSlide(pres, 'Cable Guide', installNodes, installConnections, 'INSTALLATION');

            // --- Slide 3: Network ---
            const networkNodes = data.networkNodes || {};
            const networkConnections = connectionsData.networkConnections || {};
            // Filter network nodes/connections too
            const visibleNetworkNodes = {};
            const visibleNetworkNodeIds = new Set();
            Object.entries(networkNodes).forEach(([id, node]) => {
                if (node.physicalPos) {
                    const nodeX = node.physicalPos.x || 0;
                    const nodeY = node.physicalPos.y || 0;
                    const nodeW = 16.8;
                    const nodeH = 16.8;
                    const isVisible = nodeX < VIRTUAL_WIDTH && nodeY < VIRTUAL_HEIGHT && 
                                     (nodeX + nodeW) > 0 && (nodeY + nodeH) > 0;
                    if (isVisible) {
                        visibleNetworkNodes[id] = node;
                        visibleNetworkNodeIds.add(id);
                    }
                }
            });
            const visibleNetworkConnections = {};
            Object.entries(networkConnections).forEach(([id, conn]) => {
                if (visibleNetworkNodeIds.has(conn.source) && visibleNetworkNodeIds.has(conn.target)) {
                    visibleNetworkConnections[id] = conn;
                }
            });
            this.addDiagramSlide(pres, 'Network', visibleNetworkNodes, visibleNetworkConnections, 'NETWORK');

            // --- Slide 4 & 5: Hardware List ---
            // Get hardware list from actual web table (HardwareListManager)
            this.addHardwareListSlides(pres);

            // Save File
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `Hardware_Config_${timestamp}.pptx`;
            
            pres.writeFile({ fileName: fileName }).then(() => {
                // File saved successfully
            }).catch(err => {
                console.error('Error saving PPT file:', err);
            });

            return true;
        } catch (error) {
            console.error('Failed to export PPT:', error);
            return false;
        }
    }

    addDiagramSlide(pres, title, nodes, connections, mode) {
        try {
            const slide = pres.addSlide();
            // Use 72 DPI to match Visualizer (72 DPI for 33.876cm x 19.05cm)
            const PX_TO_INCH = 1 / 72;

            // Validate inputs
            if (!nodes) nodes = {};
            if (!connections) connections = {};

            // 1. Define Fixed Stage Dimensions (Exact replica of Web Stage)
            const VIRTUAL_WIDTH = 960.26;
            const VIRTUAL_HEIGHT = 540;

        // 2. Calculate Transform to fit slide (10 x 5.625 inches)
        // We map the entire virtual stage to the entire slide area to ensure WYSIWYG
        const slideW = 10;
        const slideH = 5.625;

        // No margins, map 1:1 to slide edges (or maybe extremely small margin if printer requires, but user wants screen replica)
        // Let's stick to 1:1 mapping of Stage -> Slide

        const scaleX = slideW / (VIRTUAL_WIDTH * PX_TO_INCH);
        const scaleY = slideH / (VIRTUAL_HEIGHT * PX_TO_INCH);
        // They should be almost identical (both 16:9), pick one used for global scale
        const scale = Math.min(scaleX, scaleY);

        const transform = {
            scale: scale,
            originX: 0,
            originY: 0,
            offsetX: 0,
            offsetY: 0
        };

        // 2.5. Add Background Image (for INSTALLATION and NETWORK modes)
        // Match web layout calculation for background image
        if ((mode === 'INSTALLATION' || mode === 'NETWORK') && this.dataStore.getState().meta.floorPlanImage) {
            const floorPlanImage = this.dataStore.getState().meta.floorPlanImage;
            
            // Match web layout calculation (Visualizer.js)
            const VIRTUAL_WIDTH_PX = 960.26;
            const VIRTUAL_HEIGHT_PX = 540;
            const titleHeight = 90; // Adjusted top margin
            const legendWidth = 160; // Technical List width
            const padding = 30; // Adjusted padding
            
            const availableWidthPx = VIRTUAL_WIDTH_PX - legendWidth - (padding * 2);
            const availableHeightPx = VIRTUAL_HEIGHT_PX - titleHeight - (padding * 2);
            
            // Load image synchronously to get dimensions (image should already be loaded)
            const img = new Image();
            try {
                // Set src and wait for load
                img.src = floorPlanImage;
                
                // If image is already cached, dimensions are available immediately
                if (img.complete && img.naturalWidth > 0) {
                    const imgWidth = img.naturalWidth || img.width;
                    const imgHeight = img.naturalHeight || img.height;
                    
                    if (imgWidth && imgHeight) {
                        const imgRatio = imgWidth / imgHeight;
                        const availableRatio = availableWidthPx / availableHeightPx;
                        
                        let newWidthPx, newHeightPx;
                        
                        // Fit to available space (same logic as web)
                        if (imgRatio > availableRatio) {
                            // Limited by width
                            newWidthPx = availableWidthPx;
                            newHeightPx = availableWidthPx / imgRatio;
                        } else {
                            // Limited by height
                            newHeightPx = availableHeightPx;
                            newWidthPx = availableHeightPx * imgRatio;
                        }
                        
                        // Convert to inches and apply transform
                        const imgXInch = (padding + (availableWidthPx - newWidthPx) / 2) * PX_TO_INCH * transform.scale;
                        const imgYInch = (VIRTUAL_HEIGHT_PX - newHeightPx - padding) * PX_TO_INCH * transform.scale;
                        const imgWInch = newWidthPx * PX_TO_INCH * transform.scale;
                        const imgHInch = newHeightPx * PX_TO_INCH * transform.scale;
                        
                        // Add image to slide
                        slide.addImage({
                            data: floorPlanImage,
                            x: imgXInch,
                            y: imgYInch,
                            w: imgWInch,
                            h: imgHInch,
                            sizing: {
                                type: 'contain',
                                w: imgWInch,
                                h: imgHInch
                            }
                        });
                    }
                } else {
                    // Image not loaded yet, try async load
                    img.onload = () => {
                        const imgWidth = img.naturalWidth || img.width;
                        const imgHeight = img.naturalHeight || img.height;
                        
                        if (imgWidth && imgHeight) {
                            const imgRatio = imgWidth / imgHeight;
                            const availableRatio = availableWidthPx / availableHeightPx;
                            
                            let newWidthPx, newHeightPx;
                            
                            if (imgRatio > availableRatio) {
                                newWidthPx = availableWidthPx;
                                newHeightPx = availableWidthPx / imgRatio;
                            } else {
                                newHeightPx = availableHeightPx;
                                newWidthPx = availableHeightPx * imgRatio;
                            }
                            
                            const imgXInch = (padding + (availableWidthPx - newWidthPx) / 2) * PX_TO_INCH * transform.scale;
                            const imgYInch = (VIRTUAL_HEIGHT_PX - newHeightPx - padding) * PX_TO_INCH * transform.scale;
                            const imgWInch = newWidthPx * PX_TO_INCH * transform.scale;
                            const imgHInch = newHeightPx * PX_TO_INCH * transform.scale;
                            
                            slide.addImage({
                                data: floorPlanImage,
                                x: imgXInch,
                                y: imgYInch,
                                w: imgWInch,
                                h: imgHInch,
                                sizing: {
                                    type: 'contain',
                                    w: imgWInch,
                                    h: imgHInch
                                }
                            });
                        }
                    };
                    img.onerror = () => {
                        // Failed to load background image
                    };
                }
            } catch (error) {
                // Error adding background image
            }
        }

        // 3. Add Title
        // Web: x = width * 0.04, y = width * 0.04
        // PPT: x = 10 * 0.04 = 0.4 inch, y = 10 * 0.04 = 0.4 inch
        // Web Font: 48px -> PPT Font: 36pt (approx 48 * 0.75)
        // Match hardware list title position (y: 0.4)
        if (title) {
            slide.addText(title, {
                x: 0.4, 
                y: 0.4, // Match hardware list title position
                w: 9.2, // Width for text box
                h: 0.6, // Height for text box (36pt font needs ~0.6 inch)
                fontSize: 36,
                bold: true,
                color: '363636',
                fontFace: 'Samsung Sharp Sans', // Match web font
                valign: 'top' // Align text to top of text box
            });
        }

        // 4. Render Connections
        // Calculate layout for all connections together to get proper port offsets
        // (Port offsets are distributed when multiple connections share the same node side)
        // Store connection shape objects for grouping using addGroup
        const connectionShapeGroups = {}; // Map<connId, Array<shapeObjects>>
        
        // IMPORTANT: Only render connections that belong to the passed nodes set
        // Filter connections to only include those between nodes in the passed nodes object
        const nodeIds = new Set(Object.keys(nodes));
        const filteredConnections = {};
        if (connections) {
            Object.entries(connections).forEach(([connId, conn]) => {
                // Only include connections where both source and target are in the nodes set
                if (nodeIds.has(conn.source) && nodeIds.has(conn.target)) {
                    filteredConnections[connId] = conn;
                }
            });
        }
        
        if (Object.keys(filteredConnections).length > 0) {
            if (window.app && window.app.visualizer) {
                try {
                    // Use filtered connections and filtered nodes for layout calculation
                    const result = window.app.visualizer.calculateConnectionLayout(filteredConnections, nodes, mode);
                    const layout = result.layout || result;
                    
                    // Render each connection using the calculated layout
                    Object.values(filteredConnections).forEach(conn => {
                        const points = layout[conn.id];
                        if (points && Array.isArray(points) && points.length >= 4) {
                            const shapeObjects = this.renderConnectionFromPoints(pres, slide, conn, points, transform);
                            if (shapeObjects && shapeObjects.length > 0) {
                                connectionShapeGroups[conn.id] = shapeObjects;
                            }
                        }
                    });
                } catch (error) {
                    // Fallback: render connections individually
                    Object.values(filteredConnections).forEach(conn => {
                        const shapeObjects = this.renderConnection(pres, slide, conn, nodes, mode, transform);
                        if (shapeObjects && shapeObjects.length > 0) {
                            connectionShapeGroups[conn.id] = shapeObjects;
                        }
                    });
                }
            }
        }
        
        // Group connection segments - PptxGenJS addGroup may not be available in all versions
        // For now, add shapes individually (grouping can be done manually in PowerPoint if needed)
        Object.keys(connectionShapeGroups).forEach(connId => {
            const shapeObjects = connectionShapeGroups[connId];
            if (shapeObjects && shapeObjects.length > 0) {
                // Add all segments individually
                shapeObjects.forEach(shapeObj => {
                    slide.addShape(shapeObj.shape, shapeObj);
                });
            }
        });

        // 5. Render Nodes
        Object.values(nodes).forEach(node => {
            let x, y, w, h;
            if (mode === 'INSTALLATION' || mode === 'NETWORK') {
                // Match web: use physicalPos only (do not convert from logicalPos)
                // Each mode maintains its own position independently after initial creation
                if (!node.physicalPos) {
                    // Skip nodes without physicalPos in Installation/Network mode
                    // Do not convert from logicalPos to maintain mode independence
                    return;
                }
                const physicalX = node.physicalPos.x ?? 0;
                const physicalY = node.physicalPos.y ?? 0;
                x = physicalX * PX_TO_INCH;
                y = physicalY * PX_TO_INCH;
                w = 16.8 * PX_TO_INCH; // Match web: 16.8x16.8
                h = 16.8 * PX_TO_INCH;
                
            } else {
                // CONFIGURATION mode: calculate block size based on text length with padding
                const col = node.logicalPos?.col || 0;
                const row = node.logicalPos?.row || 0;
                x = (col * 24) * PX_TO_INCH;
                y = (row * 24) * PX_TO_INCH;
                
                // Base size
                const baseW = 75 * PX_TO_INCH; // Changed to 75
                const baseH = 42 * PX_TO_INCH;
                const minBoxWidth = baseW;
                
                // Padding inside block (5px each side, match web)
                const padding = 5 * PX_TO_INCH;
                
                const fontSize = 15;
                // More accurate character width calculation for SamsungOneKorean 400 font
                // Web uses actual text measurement, so we need better approximation
                // For bold 15pt SamsungOneKorean, average char width is approximately 0.7-0.8 of fontSize
                const avgCharWidth = fontSize * 0.75 / 72; // Adjusted from 0.6 to 0.75 for better accuracy
                
                // Process type text only (Configuration mode: no model name)
                const typeTextStr = node.type || 'Unknown';
                const hasSpacesInType = typeTextStr.includes(' ');
                const typeTextWidth = typeTextStr.length * avgCharWidth;
                let finalW = baseW;
                
                // If type has no spaces and is wider than block, expand block width
                if (!hasSpacesInType && typeTextWidth + (padding * 2) > baseW) {
                    finalW = Math.max(minBoxWidth, typeTextWidth + (padding * 2));
                }
                
                const textW = finalW - (padding * 2); // Available width for text
                
                // Calculate height: if text has spaces, allow wrapping; otherwise single line
                // Match web: boxHeight = Math.max(42, typeTextHeight + 6)
                let adjustedH = baseH;
                if (hasSpacesInType) {
                    // Has spaces: calculate wrapping height
                    const textLength = typeTextStr.length;
                    const estimatedTextWidth = textLength * avgCharWidth;
                    
                    if (estimatedTextWidth > textW) {
                        const charsPerLine = Math.floor(textW / avgCharWidth);
                        const linesNeeded = Math.ceil(textLength / charsPerLine);
                        // Match web: lineHeight similar to fontSize, padding = 6px
                        const lineHeight = fontSize / 72; // Line height in inches (1:1 ratio, no extra spacing)
                        const textPadding = 6 * PX_TO_INCH; // Match web padding of 6px
                        adjustedH = Math.max(baseH, linesNeeded * lineHeight + textPadding);
                    } else {
                        // Single line with padding
                        const textPadding = 6 * PX_TO_INCH;
                        adjustedH = Math.max(baseH, fontSize / 72 + textPadding);
                    }
                } else {
                    // No spaces: single line, but ensure minimum height with padding
                    const textPadding = 6 * PX_TO_INCH; // Match web padding of 6px
                    adjustedH = Math.max(baseH, fontSize / 72 + textPadding);
                }
                
                w = finalW;
                h = adjustedH;
            }

            // Apply Transform
            const xBeforeTransform = x;
            const yBeforeTransform = y;
            x = (x - transform.originX) * transform.scale + transform.offsetX;
            y = (y - transform.originY) * transform.scale + transform.offsetY;
            w = w * transform.scale;
            h = h * transform.scale;

            // Validate dimensions (must be positive)
            if (w <= 0 || h <= 0 || isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
                console.warn(`Invalid node dimensions for ${node.id} (${mode}): x=${x}, y=${y}, w=${w}, h=${h}, beforeTransform: x=${xBeforeTransform}, y=${yBeforeTransform}, physicalPos:`, node.physicalPos);
                return; // Skip this node
            }

            let fillColor = (node.color || '94a3b8').replace('#', '').toUpperCase();
            // Ensure fillColor is valid 6-digit hex (PptxGenJS requirement)
            if (!/^[0-9A-F]{6}$/.test(fillColor)) {
                console.warn(`Invalid color for ${node.id}: ${node.color}, using default`);
                fillColor = '94A3B8';
            }
            
            // INSTALLATION and NETWORK modes: use regular rectangle (no rounded corners)
            // CONFIGURATION mode: use rounded rectangle
            if (mode === 'INSTALLATION' || mode === 'NETWORK') {
                // Use regular rectangle (sharp corners)
                slide.addShape(pres.ShapeType.rect, {
                    x: x, y: y, w: w, h: h,
                    fill: { color: fillColor }
                    // No line/border - 윤곽선 제거
                });
            } else {
                // CONFIGURATION mode: use rounded rectangle
                const cornerRadiusRatio = 5.6 / 70; // Configuration cornerRadius = 5.6px on 70px width
                slide.addShape(pres.ShapeType.roundRect, {
                    x: x, y: y, w: w, h: h,
                    fill: { color: fillColor },
                    rectRadius: cornerRadiusRatio
                    // No line/border - 윤곽선 제거
                });
            }

            // Text - only show text in CONFIGURATION mode, not in INSTALLATION or NETWORK
            if (mode === 'CONFIGURATION') {
                // Configuration mode: only show type, not model name
                const typeTextStr = node.type || 'Unknown';
                const hasSpacesInType = typeTextStr.includes(' ');
                const hasSpaces = hasSpacesInType;
                
                let text = typeTextStr; // Only type, no model

                // Font size: Web uses 15pt for Configuration mode
                const fontSize = 15;
                
                // Add padding inside block (5px each side, match web)
                const padding = 5 * PX_TO_INCH * transform.scale;
                const textX = x + padding;
                const textY = y;
                const textW = w - (padding * 2);
                const textH = h;

                slide.addText(text, {
                    x: textX, y: textY, w: textW, h: textH,
                    align: 'center', valign: 'middle',
                    fontSize: fontSize,
                    bold: true, // Match web: fontStyle: 'bold'
                    color: 'FFFFFF', // White text to match web (fill: '#ffffff')
                    fontFace: 'SamsungOneKorean 400', // Use Samsung One Korean for non-title text
                    wrap: hasSpaces // Only wrap if there are spaces
                });
            }
            // INSTALLATION and NETWORK modes: no text (empty blocks only)
        });

        // 6. Render Technical List (Legend)
        this.renderTechnicalList(pres, slide, nodes, connections, mode, transform);
        } catch (error) {
            console.error(`Error in addDiagramSlide (${mode}):`, error);
            throw error; // Re-throw to be caught by exportToPPT
        }
    }

    renderConnection(pres, slide, conn, nodes, mode, transform) {
        // Legacy method: calculate points for single connection
        // Use 72 DPI to match Visualizer
        const PX_TO_INCH = 1 / 72;

        if (!window.app || !window.app.visualizer) {
            return [];
        }

        let points;
        try {
            points = window.app.visualizer.calculateConnectionPoints(conn, nodes, mode);
            if (!points || !Array.isArray(points) || points.length < 4) return [];
        } catch (error) {
            return [];
        }

        return this.renderConnectionFromPoints(pres, slide, conn, points, transform);
    }

    renderConnectionFromPoints(pres, slide, conn, points, transform) {
        // Use 72 DPI to match Visualizer
        const PX_TO_INCH = 1 / 72;

        if (!points || points.length < 4) return [];

        // Convert all points to inches and apply transform
        const transformedPoints = [];
        for (let i = 0; i < points.length; i += 2) {
            let x = points[i] * PX_TO_INCH;
            let y = points[i + 1] * PX_TO_INCH;
            
            // Apply Transform
            x = (x - transform.originX) * transform.scale + transform.offsetX;
            y = (y - transform.originY) * transform.scale + transform.offsetY;
            
            // Sanitize
            x = isNaN(x) ? 0 : x;
            y = isNaN(y) ? 0 : y;
            
            transformedPoints.push({ x, y });
        }

        let lineColor = (conn.color && typeof conn.color === 'string') ? conn.color : '#94a3b8';
        lineColor = lineColor.replace('#', '').toUpperCase();
        if (!/^[0-9A-F]{6}$/.test(lineColor)) lineColor = '94A3B8';

        const lineWidth = 1.5 * transform.scale;
        // Check if connection is Wireless - match web logic: conn.category === 'Cable' && conn.type === 'Wireless'
        const isWireless = conn.category === 'Cable' && conn.type && conn.type.toLowerCase() === 'wireless';
        const dashType = isWireless ? 'dash' : 'solid';

        // Store shape objects for grouping using addGroup
        const shapeObjects = [];

        // Create shape objects for each segment (don't add to slide yet)
        // These will be grouped together using addGroup
        for (let i = 0; i < transformedPoints.length - 1; i++) {
            const start = transformedPoints[i];
            const end = transformedPoints[i + 1];

            // Normalize coordinates for PptxGenJS (w and h must be positive)
            const x = Math.min(start.x, end.x);
            const y = Math.min(start.y, end.y);
            const w = Math.abs(end.x - start.x);
            const h = Math.abs(end.y - start.y);

            // Skip zero-length segments
            if (w < 0.001 && h < 0.001) continue;

            // Create shape object for grouping (format: { shape, x, y, w, h, line })
            const shapeObj = {
                shape: pres.ShapeType.line,
                x: x,
                y: y,
                w: w,
                h: h,
                line: {
                    color: lineColor,
                    width: lineWidth,
                    dashType: dashType
                }
            };
            
            shapeObjects.push(shapeObj);
        }

        // If only one segment, add it directly to slide
        // If multiple segments, return them for grouping
        if (shapeObjects.length === 1) {
            slide.addShape(shapeObjects[0].shape, shapeObjects[0]);
            return [];
        }

        return shapeObjects;
    }


    renderTechnicalList(pres, slide, nodes, connections, mode, transform) {
        try {
            // Use 72 DPI to match Visualizer
            const PX_TO_INCH = 1 / 72;
            const VIRTUAL_WIDTH = 960.26;
            const VIRTUAL_HEIGHT = 540;
            const slideW = 10;
            const slideH = 5.625;

            // Validate inputs
            if (!nodes || !connections) {
                return;
            }

        // Calculate components and cables
        const components = {};
        Object.values(nodes || {}).forEach(node => {
            if (!node) return;
            // Use type only, not model name
            const name = node.type || 'Unknown';
            components[name] = (components[name] || 0) + 1;
        });

        const cables = {};
        Object.values(connections || {}).forEach(conn => {
            if (!conn) return;
            const name = conn.type || 'Unknown';
            cables[name] = (cables[name] || 0) + 1;
        });

        const itemCount = Object.keys(components).length + Object.keys(cables).length;
        
        // Calculate dimensions (match web version exactly)
        // Web: legendHeight = headerHeight + topPadding + (itemCount * 21) + bottomPadding
        // Web: headerHeight = 20, topPadding = 10, bottomPadding = 10
        const legendWidthPx = 160;
        const headerHeightPx = 20; // Match web: headerHeight = 20
        const topPadding = 10; // Match web: topPadding = 10
        const bottomPadding = 10; // Match web: bottomPadding = 10
        const legendHeightPx = headerHeightPx + topPadding + (itemCount * 21) + bottomPadding; // Match web calculation
        
        // Convert to inches and apply scale
        const legendWidthInch = (legendWidthPx * PX_TO_INCH) * transform.scale;
        const legendHeightInch = (legendHeightPx * PX_TO_INCH) * transform.scale;
        const headerHeightInch = (headerHeightPx * PX_TO_INCH) * transform.scale;

        // Position: right aligned with padding, vertically centered
        // Web: legendX = width - legendWidth - (width * 0.04)
        // Web: legendY = (height - legendHeight) / 2
        const legendXInch = slideW - legendWidthInch - (slideW * 0.04);
        const legendYInch = (slideH - legendHeightInch) / 2;

        // Validate dimensions
        if (legendWidthInch <= 0 || legendHeightInch <= 0 || 
            isNaN(legendXInch) || isNaN(legendYInch) || 
            isNaN(legendWidthInch) || isNaN(legendHeightInch)) {
            console.warn(`Invalid technical list dimensions: x=${legendXInch}, y=${legendYInch}, w=${legendWidthInch}, h=${legendHeightInch}`);
            return;
        }

        // Corner radius: Web uses cornerRadius: 0 (sharp corners)
        // Use regular rect shape (not rounded) to match web
        const cornerRadiusInch = 0; // Match web: cornerRadius = 0

        // Background rectangle - Technical List box (sharp corners to match web)
        slide.addShape(pres.ShapeType.rect, {
            x: legendXInch,
            y: legendYInch,
            w: legendWidthInch,
            h: legendHeightInch,
            fill: { color: 'FFFFFF' },
            line: { color: '000000', width: 2 * PX_TO_INCH * transform.scale }, // Thicker border (2px instead of 1px)
            rectRadius: cornerRadiusInch
        });

        // Header background (match web: 30px height, sharp corners)
        slide.addShape(pres.ShapeType.rect, {
            x: legendXInch,
            y: legendYInch,
            w: legendWidthInch,
            h: headerHeightInch,
            fill: { color: '000000' },
            rectRadius: cornerRadiusInch
        });

        // Header text (match web: fontSize 12pt)
        // Ensure text uses full header width without wrapping or duplication
        slide.addText('Technical List', {
            x: legendXInch,
            y: legendYInch,
            w: legendWidthInch,
            h: headerHeightInch,
            fontSize: 12,
            bold: true,
            color: 'FFFFFF',
            align: 'center',
            valign: 'middle',
            fontFace: 'Samsung Sharp Sans' // Match web font
        });

        // Render items (match web: currentY starts at headerHeight + 10px from top of legend)
        // headerHeight = 20px, so currentY = 30px from top of legend
        let currentYInch = legendYInch + ((headerHeightPx + 10) * PX_TO_INCH * transform.scale);
        const itemHeightInch = (21 * PX_TO_INCH) * transform.scale;

        // Render Components first
        Object.keys(components).forEach(compName => {
            // compName is now always type, not model
            const node = Object.values(nodes).find(n => n.type === compName);
            const color = node ? (node.color || '#94a3b8') : '#94a3b8';
            const colorHex = color.replace('#', '').toUpperCase();

            // Component square - color indicator in Technical List
            // Web: x = 20.3, y = currentY + 4.5, width = 12, height = 12
            // Text center: currentY + itemHeight/2 = currentY + 10.5
            // Rect center: currentY + 4.5 + 6 = currentY + 10.5 (aligned with text)
            const squareSizeInch = (12 * PX_TO_INCH) * transform.scale; // Match web: 12x12
            const squareXInch = legendXInch + (20.3 * PX_TO_INCH * transform.scale);
            const squareYInch = currentYInch + (4.5 * PX_TO_INCH * transform.scale); // Match web: currentY + 4.5

            slide.addShape(pres.ShapeType.rect, {
                x: squareXInch,
                y: squareYInch,
                w: squareSizeInch,
                h: squareSizeInch,
                fill: { color: colorHex },
                // Remove outline/border
                line: { color: colorHex, width: 0 }
            });

            // Component label (match web: fontSize 12pt, x starts at 42px)
            // Text width: legendWidth(160) - textStartX(42) = 118px available for text
            const textStartXInch = legendXInch + (42 * PX_TO_INCH * transform.scale);
            const textWidthInch = legendWidthInch - (42 * PX_TO_INCH * transform.scale); // Match web: legendWidth - 42
            slide.addText(compName, {
                x: textStartXInch,
                y: currentYInch,
                w: textWidthInch,
                h: itemHeightInch,
                fontSize: 12,
                color: '000000',
                align: 'left',
                valign: 'middle',
                fontFace: 'SamsungOneKorean 400' // Use Samsung One Korean for non-title text
            });

            currentYInch += itemHeightInch;
        });

        // Render Cables
        Object.keys(cables).forEach(cableType => {
            const conn = Object.values(connections).find(c => c.type === cableType);
            const color = conn ? (conn.color || 'black') : 'black';
            const colorHex = color.replace('#', '').toUpperCase();

            // Cable line - horizontal line indicator in Technical List
            // Web: lineY = currentY + itemHeight / 2 = currentY + 10.5
            // Web: points = [14, lineY, 35, lineY], strokeWidth = 1.4
            // Use same line width as connection lines in Configuration mode
            const itemHeightPx = 21; // Match web: itemHeight = 21
            const lineYInch = currentYInch + ((itemHeightPx / 2) * PX_TO_INCH * transform.scale); // Match web: currentY + 10.5
            const lineStartXInch = legendXInch + (14 * PX_TO_INCH * transform.scale);
            const lineEndXInch = legendXInch + (35 * PX_TO_INCH * transform.scale);
            // Use same line width as connection lines: 1.5 * transform.scale
            const lineWidth = 1.5 * transform.scale; // Match connection line width in Configuration mode

            slide.addShape(pres.ShapeType.line, {
                x: lineStartXInch,
                y: lineYInch,
                w: lineEndXInch - lineStartXInch,
                h: 0,
                line: {
                    color: colorHex.toUpperCase(),
                    width: lineWidth,
                    dashType: cableType.includes('Wireless') ? 'dash' : 'solid'
                }
            });

            // Cable label (match web: fontSize 12pt, x starts at 42px)
            // Text width: legendWidth(160) - textStartX(42) = 118px available for text
            const textStartXInch = legendXInch + (42 * PX_TO_INCH * transform.scale);
            const textWidthInch = legendWidthInch - (42 * PX_TO_INCH * transform.scale); // Match web: legendWidth - 42
            slide.addText(cableType, {
                x: textStartXInch,
                y: currentYInch,
                w: textWidthInch,
                h: itemHeightInch,
                fontSize: 12,
                color: '000000',
                align: 'left',
                valign: 'middle',
                fontFace: 'SamsungOneKorean 400' // Use Samsung One Korean for non-title text
            });

            currentYInch += itemHeightInch;
        });
        } catch (error) {
            console.error('Error rendering Technical List:', error);
            // Don't throw - allow slide to continue without technical list
        }
    }

    addHardwareListSlides(pres) {
        // Get hardware list data from HardwareListManager (same logic as renderTable)
        const data = this.dataStore.getState();
        const nodes = data.nodes || {};
        // Combine all connections for hardware list (use configurationConnections primarily)
        const connections = {
            ...(data.configurationConnections || {}),
            ...(data.installationConnections || {}),
            ...(data.networkConnections || {})
        };
        const metadata = data.meta.hardwareListMetadata || {};
        const sidebarHardwareList = data.meta.hardwareList || [];

        // Filter to only visible nodes (within canvas bounds)
        const VIRTUAL_WIDTH = 960.26;
        const VIRTUAL_HEIGHT = 540;
        const visibleNodes = {};
        Object.entries(nodes).forEach(([id, node]) => {
            let isVisible = false;
            if (node.logicalPos) {
                const col = node.logicalPos.col || 0;
                const row = node.logicalPos.row || 0;
                const nodeX = col * 24;
                const nodeY = row * 24;
                const nodeW = 70;
                const nodeH = 42;
                isVisible = nodeX < VIRTUAL_WIDTH && nodeY < VIRTUAL_HEIGHT && 
                           (nodeX + nodeW) > 0 && (nodeY + nodeH) > 0;
            } else if (node.physicalPos) {
                const nodeX = node.physicalPos.x || 0;
                const nodeY = node.physicalPos.y || 0;
                const nodeW = 16.8;
                const nodeH = 16.8;
                isVisible = nodeX < VIRTUAL_WIDTH && nodeY < VIRTUAL_HEIGHT && 
                           (nodeX + nodeW) > 0 && (nodeY + nodeH) > 0;
            }
            if (isVisible) {
                visibleNodes[id] = node;
            }
        });

        // Filter connections to visible nodes
        const visibleNodeIds = new Set(Object.keys(visibleNodes));
        const visibleConnections = {};
        Object.entries(connections).forEach(([id, conn]) => {
            if (visibleNodeIds.has(conn.source) && visibleNodeIds.has(conn.target)) {
                visibleConnections[id] = conn;
            }
        });

        // Count hardware items (same logic as HardwareListManager.renderTable)
        const hardwareMap = new Map();
        Object.values(visibleNodes).forEach(node => {
            // Skip WAN - it should not appear in hardware list
            if (node.type === 'WAN') {
                return;
            }
            
            const key = `${node.type}|${node.model || ''}`;
            if (hardwareMap.has(key)) {
                hardwareMap.get(key).count += 1;
            } else {
                hardwareMap.set(key, {
                    type: node.type,
                    model: node.model || '',
                    category: node.category || 'Device',
                    count: 1
                });
            }
        });

        Object.values(visibleConnections).forEach(conn => {
            const cableType = conn.type || '';
            if (cableType.toLowerCase() === 'wireless') return;
            const key = `Cable|${cableType || conn.model || ''}`;
            if (hardwareMap.has(key)) {
                hardwareMap.get(key).count += 1;
            } else {
                hardwareMap.set(key, {
                    type: cableType || 'Cable',
                    model: conn.model || '',
                    category: 'Cable',
                    count: 1
                });
            }
        });

        // Sort by sidebar order
        const sidebarOrderMap = new Map();
        sidebarHardwareList.forEach((item, index) => {
            const key = `${item.type}|${item.model || ''}`;
            sidebarOrderMap.set(key, index);
        });

        const hardwareList = Array.from(hardwareMap.values()).sort((a, b) => {
            const keyA = `${a.type}|${a.model || ''}`;
            const keyB = `${b.type}|${b.model || ''}`;
            const orderA = sidebarOrderMap.has(keyA) ? sidebarOrderMap.get(keyA) : Infinity;
            const orderB = sidebarOrderMap.has(keyB) ? sidebarOrderMap.get(keyB) : Infinity;
            if (orderA !== Infinity && orderB !== Infinity) return orderA - orderB;
            if (orderA !== Infinity) return -1;
            if (orderB !== Infinity) return 1;
            if (a.category !== b.category) return a.category === 'Device' ? -1 : 1;
            return a.type.localeCompare(b.type);
        });

        // Separate into I M FINE and Local lists
        const imfineList = [];
        const localList = [];
        hardwareList.forEach(item => {
            const itemKey = `${item.type}|${item.model}`;
            const itemMetadata = metadata[itemKey] || {};
            if (itemMetadata.isImfine === true) {
                imfineList.push(item);
            } else {
                localList.push(item);
            }
        });

        // Create slides with table styling matching web version
        this.addTableSlide(pres, 'Hardware List - Local', localList, metadata);
        this.addTableSlide(pres, 'Hardware List - I M Fine', imfineList, metadata);
    }

    addTableSlide(pres, title, hardwareList, metadata = {}) {
        const slide = pres.addSlide();

        // Title
        slide.addText(title, {
            x: 0.4, y: 0.4, w: '90%', h: 0.5,
            fontSize: 36, bold: true, color: '363636', fontFace: 'Samsung Sharp Sans'
        });

        // Determine if this is I M FINE or Local table
        const isImfine = title.includes('I M Fine');
        const categoryText = isImfine ? 'I M FINE' : 'Local';
        
        // Calculate row height for equal distribution
        const TARGET_DATA_ROWS = 12; // Target number of data rows
        const SLIDE_HEIGHT = 7.5;
        const TABLE_START_Y = 1.0;
        const AVAILABLE_HEIGHT = 4; // Fixed table height
        const HEADER_ROWS_COUNT = 2;
        const TOTAL_ROWS = HEADER_ROWS_COUNT + TARGET_DATA_ROWS;
        const ROW_HEIGHT = AVAILABLE_HEIGHT / TOTAL_ROWS;
        
        // First header row: Black background with white text showing "Local" or "I M FINE"
        // Border array: [top, right, bottom, left] - all sides E2E8F0
        const firstHeaderOpts = {
            bold: true,
            fill: '000000', // Black background
            color: 'FFFFFF', // White text
            align: 'center',
            valign: 'middle',
            border: [
                { pt: 1, color: 'E2E8F0' }, // Top
                { pt: 1, color: 'E2E8F0' }, // Right
                { pt: 1, color: 'E2E8F0' }, // Bottom - ensure this matches second header row top
                { pt: 1, color: 'E2E8F0' }  // Left
            ],
            colspan: 5, // Span all 5 columns
            h: ROW_HEIGHT // Set equal height
        };

        // Second header row: Colored background with column names
        // Border array: [top, right, bottom, left] - all sides E2E8F0
        const headerOpts = {
            bold: true,
            fill: isImfine ? 'FEE2E2' : 'E0F2FE', // red-100 for I M FINE, sky-50 for Local
            color: '000000',
            align: 'center',
            valign: 'middle',
            border: [
                { pt: 1, color: 'E2E8F0' }, // Top - ensure this matches first header row bottom
                { pt: 1, color: 'E2E8F0' }, // Right
                { pt: 1, color: 'E2E8F0' }, // Bottom
                { pt: 1, color: 'E2E8F0' }  // Left
            ],
            fontFace: 'SamsungOneKorean 400', // Use Samsung One Korean for non-title text
            h: ROW_HEIGHT // Set equal height
        };

        const rows = [
            [
                { text: categoryText, options: firstHeaderOpts }
            ],
            [
                { text: 'Hardware', options: headerOpts },
                { text: 'Model', options: headerOpts },
                { text: 'EA', options: headerOpts },
                { text: 'R&R', options: headerOpts },
                { text: 'Remark', options: headerOpts }
            ]
        ];

        // Process hardware list with rowspan for R&R column
        // Calculate actual number of data rows (minimum 10, but can exceed if more hardware exists)
        const actualDataRowCount = hardwareList && hardwareList.length > 0 
            ? Math.max(TARGET_DATA_ROWS, hardwareList.length) 
            : TARGET_DATA_ROWS;
        
        // Recalculate ROW_HEIGHT based on actual number of rows
        // Total rows = header rows (2) + actual data rows
        // This ensures table height stays constant regardless of row count
        const TOTAL_ROWS_ACTUAL = HEADER_ROWS_COUNT + actualDataRowCount;
        const ROW_HEIGHT_ACTUAL = AVAILABLE_HEIGHT / TOTAL_ROWS_ACTUAL;
        
        // Update header row heights to match actual row height
        firstHeaderOpts.h = ROW_HEIGHT_ACTUAL;
        headerOpts.h = ROW_HEIGHT_ACTUAL;
        
        if (hardwareList && hardwareList.length > 0) {
            hardwareList.forEach((item, index) => {
                const itemKey = `${item.type}|${item.model}`;
                const itemMetadata = metadata[itemKey] || {};
                const modelText = item.model || '';
                const hasTBU = modelText.toUpperCase().includes('TBU');
                const modelDisplay = modelText || '-';
                
                // Determine rowspan for R&R column (first row only)
                const isFirstRow = index === 0;
                // Use actual data row count for rowspan
                const rowspan = isFirstRow ? actualDataRowCount : 0;
                
                // Row background color: alternate white and colored (red-50 for I M FINE, sky-50 for Local)
                const rowColor = index % 2 === 0 ? 'FFFFFF' : (isImfine ? 'FEF2F2' : 'F0F9FF'); // red-50 or sky-50
                
                const cellOpts = {
                    color: '334155',
                    align: 'center',
                    valign: 'middle',
                    border: { pt: 1, color: 'E2E8F0' },
                    fill: rowColor,
                    fontFace: 'SamsungOneKorean 400', // Use Samsung One Korean for non-title text
                    h: ROW_HEIGHT_ACTUAL // Set equal height for all cells
                };

                const modelCellOpts = {
                    ...cellOpts,
                    color: hasTBU ? 'DC2626' : '334155' // red-600 for TBU
                };

                const rrCellOpts = {
                    ...cellOpts,
                    fill: 'F3F4F6', // gray-100
                    rowspan: rowspan,
                    h: ROW_HEIGHT_ACTUAL * actualDataRowCount // R&R cell spans all data rows
                };

                const row = [
                    { text: item.type || '', options: cellOpts },
                    { text: modelDisplay, options: modelCellOpts },
                    { text: String(item.count || 1), options: cellOpts },
                    isFirstRow ? { text: isImfine ? 'I M FINE' : 'Local', options: rrCellOpts } : null,
                    { text: itemMetadata.remark || '', options: cellOpts }
                ].filter(cell => cell !== null); // Remove null cells (non-first rows don't have R&R cell)

                rows.push(row);
            });
            
            // Add empty rows to reach TARGET_DATA_ROWS if needed (only if less than 10)
            const currentDataRowCount = hardwareList.length;
            if (currentDataRowCount < TARGET_DATA_ROWS) {
                const emptyRowsNeeded = TARGET_DATA_ROWS - currentDataRowCount;
                
                for (let i = 0; i < emptyRowsNeeded; i++) {
                    const emptyRowIndex = currentDataRowCount + i;
                    const rowColor = emptyRowIndex % 2 === 0 ? 'FFFFFF' : (isImfine ? 'FEF2F2' : 'F0F9FF');
                    
                    const cellOpts = {
                        color: '334155',
                        align: 'center',
                        valign: 'middle',
                        border: { pt: 1, color: 'E2E8F0' },
                        fill: rowColor,
                        fontFace: 'SamsungOneKorean 400',
                        h: ROW_HEIGHT_ACTUAL
                    };
                    
                    const emptyRow = [
                        { text: '', options: cellOpts },
                        { text: '', options: cellOpts },
                        { text: '', options: cellOpts },
                        // No R&R cell for empty rows (already handled by rowspan in first row)
                        { text: '', options: cellOpts }
                    ];
                    
                    rows.push(emptyRow);
                }
            }
        } else {
            // No hardware - create empty table with 10 data rows
            const cellOpts = {
                color: '334155',
                align: 'center',
                valign: 'middle',
                border: { pt: 1, color: 'E2E8F0' },
                fontFace: 'SamsungOneKorean 400',
                h: ROW_HEIGHT_ACTUAL
            };
            
            // Add empty data rows
            for (let i = 0; i < actualDataRowCount; i++) {
                const rowColor = i % 2 === 0 ? 'FFFFFF' : (isImfine ? 'FEF2F2' : 'F0F9FF');
                const emptyCellOpts = {
                    ...cellOpts,
                    fill: rowColor
                };
                
                const rrCellOpts = {
                    ...emptyCellOpts,
                    fill: 'F3F4F6',
                    rowspan: i === 0 ? actualDataRowCount : 0,
                    h: i === 0 ? ROW_HEIGHT_ACTUAL * actualDataRowCount : ROW_HEIGHT_ACTUAL
                };
                
                const emptyRow = [
                    { text: '', options: emptyCellOpts },
                    { text: '', options: emptyCellOpts },
                    { text: '', options: emptyCellOpts },
                    i === 0 ? { text: isImfine ? 'I M FINE' : 'Local', options: rrCellOpts } : null,
                    { text: '', options: emptyCellOpts }
                ].filter(cell => cell !== null);
                
                rows.push(emptyRow);
            }
        }

        // Create row heights array (2 header rows + actual data rows)
        // Use ROW_HEIGHT_ACTUAL which is calculated based on actual row count
        const rowH = [];
        for (let i = 0; i < HEADER_ROWS_COUNT; i++) {
            rowH.push(ROW_HEIGHT_ACTUAL);
        }
        for (let i = 0; i < actualDataRowCount; i++) {
            rowH.push(ROW_HEIGHT_ACTUAL);
        }

        // Add Table with equal row heights
        slide.addTable(rows, {
            x: 0.5,
            y: 1.0,
            w: 9.0,
            colW: [2.0, 2.5, 1.0, 1.5, 2.0],
            rowH: rowH, // Set equal heights for all rows
            fontSize: 10,
            align: 'center',
            valign: 'middle'
        });
    }
}
