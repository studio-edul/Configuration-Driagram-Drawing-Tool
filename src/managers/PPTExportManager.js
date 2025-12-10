<<<<<<< HEAD
export class PPTExportManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.init();
    }

    init() {
        const btn = document.getElementById('btn-export-ppt');
        if (btn) {
            btn.addEventListener('click', () => this.exportPPT());
        }
    }

    exportPPT() {
        console.log("PPTExportManager: Generating PPT...");
        const pptx = new PptxGenJS();
        const data = this.dataStore.getState();

        // Slide 1: System Configuration (Logical)
        const slide1 = pptx.addSlide();
        slide1.addText("System Configuration (Logical)", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
        // TODO: Add logical view screenshot or reconstruction
        this.drawNodesOnSlide(slide1, data, 'LOGICAL');

        // Slide 2: Cable Guide (Physical)
        const slide2 = pptx.addSlide();
        slide2.addText("Cable Guide (Physical)", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
        if (data.meta.floorPlanImage) {
            slide2.addImage({
                data: data.meta.floorPlanImage,
                x: 'center', y: 'center', w: '95%', h: '95%',
                sizing: { type: 'contain' }
            });
        }
        this.drawNodesOnSlide(slide2, data, 'PHYSICAL');

        // Slide 3: Requests
        const slide3 = pptx.addSlide();
        slide3.addText("Requests", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
        if (data.meta.floorPlanImage) {
            slide3.addImage({
                data: data.meta.floorPlanImage,
                x: 'center', y: 'center', w: '95%', h: '95%',
                sizing: { type: 'contain' }
            });
        }
        this.drawRequestsOnSlide(slide3, data);

        // Slide 4: BOM
        const slide4 = pptx.addSlide();
        slide4.addText("Hardware List (BOM)", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
        this.drawBOMTable(slide4, data);

        pptx.writeFile({ fileName: "Hardware_Config.pptx" });
    }

    drawNodesOnSlide(slide, data, mode) {
        // Simple reconstruction of nodes on slide
        // Note: Coordinates need scaling from Canvas px to PPT inches
        // Assuming 100px = 1 inch for simplicity for now, or use ratio
        const scale = 0.01;

        Object.values(data.nodes).forEach(node => {
            let x, y;
            if (mode === 'LOGICAL') {
                x = ((node.logicalPos?.col || 0) * 150 + 50) * scale;
                y = ((node.logicalPos?.row || 0) * 100 + 50) * scale;
            } else {
                x = (node.physicalPos?.x || 0) * scale;
                y = (node.physicalPos?.y || 0) * scale;
            }

            // Adjust for slide margins if needed
            x += 0.5;
            y += 1.0;

            slide.addShape(pptx.ShapeType.rect, {
                x: x, y: y, w: 0.4, h: 0.4,
                fill: node.type === 'Router' ? 'BFDBFE' : 'BBF7D0',
                line: { color: '000000', width: 1 }
            });
            slide.addText(node.id, {
                x: x, y: y + 0.45, w: 0.4, h: 0.2,
                fontSize: 10, align: 'center'
            });
        });
    }

    drawRequestsOnSlide(slide, data) {
        const scale = 0.01;
        Object.values(data.requests).forEach(req => {
            let x = req.x * scale;
            let y = req.y * scale;
            x += 0.5;
            y += 1.0;

            slide.addShape(pptx.ShapeType.rect, {
                x: x, y: y, w: 0.3, h: 0.3,
                fill: req.type === 'POWER' ? 'FCA5A5' : '93C5FD'
            });
        });
    }

    drawBOMTable(slide, data) {
        const rows = [['Type', 'Count', 'Items']];
        const bom = {}; // Re-calculate BOM locally or use BOMManager
        Object.values(data.nodes).forEach(node => {
            if (!bom[node.type]) bom[node.type] = { count: 0, items: [] };
            bom[node.type].count++;
            bom[node.type].items.push(node.id);
        });

        Object.entries(bom).forEach(([type, info]) => {
            rows.push([type, info.count, info.items.join(', ')]);
        });

        slide.addTable(rows, { x: 0.5, y: 1.0, w: 9.0, border: { pt: 1, color: '000000' } });
    }
}
=======
export class PPTExportManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.init();
    }

    init() {
        const btn = document.getElementById('btn-export-ppt');
        if (btn) {
            btn.addEventListener('click', () => this.exportPPT());
        }
    }

    exportPPT() {
        console.log("PPTExportManager: Generating PPT...");
        const pptx = new PptxGenJS();
        const data = this.dataStore.getState();

        // Slide 1: System Configuration (Logical)
        const slide1 = pptx.addSlide();
        slide1.addText("System Configuration (Logical)", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
        // TODO: Add logical view screenshot or reconstruction
        this.drawNodesOnSlide(slide1, data, 'LOGICAL');

        // Slide 2: Cable Guide (Physical)
        const slide2 = pptx.addSlide();
        slide2.addText("Cable Guide (Physical)", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
        if (data.meta.floorPlanImage) {
            slide2.addImage({
                data: data.meta.floorPlanImage,
                x: 'center', y: 'center', w: '95%', h: '95%',
                sizing: { type: 'contain' }
            });
        }
        this.drawNodesOnSlide(slide2, data, 'PHYSICAL');

        // Slide 3: Requests
        const slide3 = pptx.addSlide();
        slide3.addText("Requests", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
        if (data.meta.floorPlanImage) {
            slide3.addImage({
                data: data.meta.floorPlanImage,
                x: 'center', y: 'center', w: '95%', h: '95%',
                sizing: { type: 'contain' }
            });
        }
        this.drawRequestsOnSlide(slide3, data);

        // Slide 4: BOM
        const slide4 = pptx.addSlide();
        slide4.addText("Hardware List (BOM)", { x: 0.5, y: 0.5, fontSize: 18, bold: true });
        this.drawBOMTable(slide4, data);

        pptx.writeFile({ fileName: "Hardware_Config.pptx" });
    }

    drawNodesOnSlide(slide, data, mode) {
        // Simple reconstruction of nodes on slide
        // Note: Coordinates need scaling from Canvas px to PPT inches
        // Assuming 100px = 1 inch for simplicity for now, or use ratio
        const scale = 0.01;

        Object.values(data.nodes).forEach(node => {
            let x, y;
            if (mode === 'LOGICAL') {
                x = ((node.logicalPos?.col || 0) * 150 + 50) * scale;
                y = ((node.logicalPos?.row || 0) * 100 + 50) * scale;
            } else {
                x = (node.physicalPos?.x || 0) * scale;
                y = (node.physicalPos?.y || 0) * scale;
            }

            // Adjust for slide margins if needed
            x += 0.5;
            y += 1.0;

            slide.addShape(pptx.ShapeType.rect, {
                x: x, y: y, w: 0.4, h: 0.4,
                fill: node.type === 'Router' ? 'BFDBFE' : 'BBF7D0',
                line: { color: '000000', width: 1 }
            });
            slide.addText(node.id, {
                x: x, y: y + 0.45, w: 0.4, h: 0.2,
                fontSize: 10, align: 'center'
            });
        });
    }

    drawRequestsOnSlide(slide, data) {
        const scale = 0.01;
        Object.values(data.requests).forEach(req => {
            let x = req.x * scale;
            let y = req.y * scale;
            x += 0.5;
            y += 1.0;

            slide.addShape(pptx.ShapeType.rect, {
                x: x, y: y, w: 0.3, h: 0.3,
                fill: req.type === 'POWER' ? 'FCA5A5' : '93C5FD'
            });
        });
    }

    drawBOMTable(slide, data) {
        const rows = [['Type', 'Count', 'Items']];
        const bom = {}; // Re-calculate BOM locally or use BOMManager
        Object.values(data.nodes).forEach(node => {
            if (!bom[node.type]) bom[node.type] = { count: 0, items: [] };
            bom[node.type].count++;
            bom[node.type].items.push(node.id);
        });

        Object.entries(bom).forEach(([type, info]) => {
            rows.push([type, info.count, info.items.join(', ')]);
        });

        slide.addTable(rows, { x: 0.5, y: 1.0, w: 9.0, border: { pt: 1, color: '000000' } });
    }
}
>>>>>>> 69958a1430fa59ef7d54047e968a915e3f18feb4
