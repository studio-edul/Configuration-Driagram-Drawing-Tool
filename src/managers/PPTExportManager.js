export class PPTExportManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
    }

    exportToPPT(nodes, connections, hardwareList) {
        try {
            // 1. Initialize PptxGenJS
            const pres = new PptxGenJS();
            pres.layout = 'LAYOUT_16x9';

            // --- Slide 1: Configuration (Logical) ---
            this.addDiagramSlide(pres, 'System Configuration', nodes, connections, 'LOGICAL');

            // --- Slide 2: Installation (Physical) ---
            this.addDiagramSlide(pres, 'Cable Guide', nodes, connections, 'PHYSICAL');

            // --- Slide 3: Local Hardware List ---
            this.addTableSlide(pres, 'Hardware List - Local', hardwareList);

            // --- Slide 4: I M Fine Hardware List ---
            this.addTableSlide(pres, 'Hardware List - I M Fine', hardwareList);

            // Save File
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            pres.writeFile({ fileName: `Hardware_Config_${timestamp}.pptx` });

            return true;
        } catch (error) {
            console.error('Failed to export PPT:', error);
            return false;
        }
    }

    addDiagramSlide(pres, title, nodes, connections, mode) {
        const slide = pres.addSlide();
        const PX_TO_INCH = 1 / 96;

        // 1. Calculate Bounding Box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasNodes = false;

        Object.values(nodes).forEach(node => {
            let x, y, w, h;
            if (mode === 'PHYSICAL') {
                x = node.physicalPos?.x || 0;
                y = node.physicalPos?.y || 0;
                w = 24;
                h = 24;
            } else {
                x = (node.logicalPos?.col || 0) * 24;
                y = (node.logicalPos?.row || 0) * 24;
                w = 100;
                h = 60;
            }
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
            hasNodes = true;
        });

        if (!hasNodes) {
            minX = 0; minY = 0; maxX = 800; maxY = 600;
        }

        // Add padding
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        // 2. Calculate Transform to fit slide (10 x 5.625 inches)
        // Leave margins: 0.5 inch
        const slideW = 10;
        const slideH = 5.625;
        const margin = 0.5;
        const availW = slideW - (margin * 2);
        const availH = slideH - (margin * 2);

        const scaleX = availW / (contentW * PX_TO_INCH);
        const scaleY = availH / (contentH * PX_TO_INCH);
        const scale = Math.min(scaleX, scaleY, 1); // Don't upscale, max 1

        const transform = {
            scale: scale,
            originX: minX * PX_TO_INCH,
            originY: minY * PX_TO_INCH,
            offsetX: margin + (availW - (contentW * PX_TO_INCH * scale)) / 2,
            offsetY: margin + (availH - (contentH * PX_TO_INCH * scale)) / 2
        };

        // 3. Add Title
        if (title) {
            slide.addText(title, {
                x: 0.4, y: 0.2, fontSize: 18, bold: true, color: '363636'
            });
        }

        // 4. Render Connections
        if (connections) {
            Object.values(connections).forEach(conn => {
                this.renderConnection(pres, slide, conn, nodes, mode, transform);
            });
        }

        // 5. Render Nodes
        Object.values(nodes).forEach(node => {
            let x, y, w, h;
            if (mode === 'PHYSICAL') {
                x = (node.physicalPos?.x || 0) * PX_TO_INCH;
                y = (node.physicalPos?.y || 0) * PX_TO_INCH;
                w = 24 * PX_TO_INCH;
                h = 24 * PX_TO_INCH;
            } else {
                const col = node.logicalPos?.col || 0;
                const row = node.logicalPos?.row || 0;
                x = (col * 24) * PX_TO_INCH;
                y = (row * 24) * PX_TO_INCH;
                w = 100 * PX_TO_INCH;
                h = 60 * PX_TO_INCH;
            }

            // Apply Transform
            x = (x - transform.originX) * transform.scale + transform.offsetX;
            y = (y - transform.originY) * transform.scale + transform.offsetY;
            w = w * transform.scale;
            h = h * transform.scale;

            const fillColor = (node.color || '94a3b8').replace('#', '');
            const radius = mode === 'PHYSICAL' ? 8 : 4; // PPT uses points/pixels roughly? No, shape radius is 0-1 or points. PptxGenJS rectRadius is 0-1? No, usually points.
            // PptxGenJS rectRadius is confusing, let's stick to simple rect for now or small value.

            slide.addShape(pres.ShapeType.rect, {
                x: x, y: y, w: w, h: h,
                fill: { color: fillColor },
                line: { color: '000000', width: 1 },
                rectRadius: 0.1 // Small radius
            });

            // Text
            let text = node.type || 'Unknown';
            if (mode === 'LOGICAL' && node.model) {
                text += `\n${node.model}`;
            }

            slide.addText(text, {
                x: x, y: y, w: w, h: h,
                align: 'center', valign: 'middle',
                fontSize: (mode === 'PHYSICAL' ? 6 : 10) * transform.scale,
                color: '000000' // Black text for visibility
            });
        });
    }

    renderConnection(pres, slide, conn, nodes, mode, transform) {
        const PX_TO_INCH = 1 / 96;

        if (!window.app || !window.app.visualizer) return;

        const points = window.app.visualizer.calculateConnectionPoints(conn, nodes, mode);
        if (!points || !Array.isArray(points) || points.length < 4) return;

        for (let i = 0; i < points.length - 2; i += 2) {
            let startX = points[i] * PX_TO_INCH;
            let startY = points[i + 1] * PX_TO_INCH;
            let endX = points[i + 2] * PX_TO_INCH;
            let endY = points[i + 3] * PX_TO_INCH;

            // Apply Transform
            startX = (startX - transform.originX) * transform.scale + transform.offsetX;
            startY = (startY - transform.originY) * transform.scale + transform.offsetY;
            endX = (endX - transform.originX) * transform.scale + transform.offsetX;
            endY = (endY - transform.originY) * transform.scale + transform.offsetY;

            // Sanitize
            startX = isNaN(startX) ? 0 : startX;
            startY = isNaN(startY) ? 0 : startY;
            endX = isNaN(endX) ? 0 : endX;
            endY = isNaN(endY) ? 0 : endY;

            // Normalize coordinates for PptxGenJS (w and h must be positive)
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const w = Math.abs(endX - startX);
            const h = Math.abs(endY - startY);

            let lineColor = (conn.color && typeof conn.color === 'string') ? conn.color : '#94a3b8';
            lineColor = lineColor.replace('#', '');
            if (!/^[0-9A-Fa-f]{6}$/.test(lineColor)) lineColor = '94A3B8';

            slide.addShape(pres.ShapeType.line, {
                x: x, y: y, w: w, h: h,
                line: {
                    color: lineColor,
                    width: 1.5 * transform.scale, // Scale line width
                    dashType: (conn.category === 'Cable' && conn.type === 'Wireless') ? 'dash' : 'solid'
                }
            });
        }
    }

    addTableSlide(pres, title, hardwareList) {
        const slide = pres.addSlide();

        // Title
        slide.addText(title, {
            x: 0.5, y: 0.3, w: '90%', h: 0.5,
            fontSize: 18, bold: true, color: '363636'
        });

        // Table Data
        // Headers
        const headerOpts = {
            bold: true,
            fill: 'F1F5F9',
            color: '1E293B',
            align: 'center',
            valign: 'middle',
            border: { pt: 1, color: 'CBD5E1' }
        };

        const rows = [
            [
                { text: 'Hardware', options: headerOpts },
                { text: 'Model', options: headerOpts },
                { text: 'EA', options: headerOpts },
                { text: 'R&R', options: headerOpts },
                { text: 'Remark', options: headerOpts }
            ]
        ];

        // Content
        const cellOpts = {
            color: '334155',
            align: 'center',
            valign: 'middle',
            border: { pt: 1, color: 'E2E8F0' }
        };

        if (hardwareList && hardwareList.length > 0) {
            hardwareList.forEach(item => {
                rows.push([
                    { text: item.type || '', options: cellOpts },
                    { text: item.model || '', options: cellOpts },
                    { text: '1', options: cellOpts }, // Default EA
                    { text: '', options: cellOpts },  // Default R&R
                    { text: '', options: cellOpts }   // Default Remark
                ]);
            });
        } else {
            rows.push([
                { text: 'No hardware defined', options: { ...cellOpts, colspan: 5 } },
                { text: '', options: cellOpts },
                { text: '', options: cellOpts },
                { text: '', options: cellOpts },
                { text: '', options: cellOpts }
            ]);
        }

        // Add Table
        slide.addTable(rows, {
            x: 0.5,
            y: 1.0,
            w: 9.0,
            colW: [2.0, 2.5, 1.0, 1.5, 2.0],
            fontSize: 10,
            align: 'center',
            valign: 'middle'
        });
    }
}
