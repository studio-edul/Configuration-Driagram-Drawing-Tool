export class LegendManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.legendContainer = document.getElementById('legend-container');
        this.componentsContainer = document.getElementById('legend-components');
        this.cablesContainer = document.getElementById('legend-cables');

        this.init();
    }

    init() {
        // Subscribe to data changes
        this.dataStore.subscribe((data) => {
            const mode = data.meta.mode;
            if (mode === 'CONFIGURATION' || mode === 'INSTALLATION') {
                this.updateLegend(data);
                this.showLegend();
            } else {
                this.hideLegend();
            }
        });

        // Initial update
        const currentData = this.dataStore.getState();
        if (currentData.meta.mode === 'CONFIGURATION' || currentData.meta.mode === 'INSTALLATION') {
            this.updateLegend(currentData);
            this.showLegend();
        }
    }

    showLegend() {
        if (this.legendContainer) {
            this.legendContainer.classList.remove('hidden');
        }
    }

    hideLegend() {
        if (this.legendContainer) {
            this.legendContainer.classList.add('hidden');
        }
    }

    updateLegend(data) {
        if (!this.componentsContainer || !this.cablesContainer) return;

        // Get hardware list for color information and ordering
        const hardwareList = data.meta.hardwareList || [];
        const hardwareMap = new Map();
        const hardwareOrderMap = new Map(); // Map<type, index> for ordering
        hardwareList.forEach((item, index) => {
            hardwareMap.set(item.type, item);
            hardwareOrderMap.set(item.type, index);
        });

        // Collect used component types from nodes
        const usedComponents = new Map();
        Object.values(data.nodes || {}).forEach(node => {
            if (node.type && !usedComponents.has(node.type)) {
                // Use node's color if available, otherwise get from hardware list
                const hardware = hardwareMap.get(node.type);
                usedComponents.set(node.type, {
                    type: node.type,
                    color: node.color || hardware?.color || '#94a3b8',
                    order: hardwareOrderMap.get(node.type) ?? 9999 // Use hardware list order
                });
            }
        });

        // Collect used cable types from connections
        const usedCables = new Map();
        Object.values(data.connections || {}).forEach(conn => {
            if (conn.type && !usedCables.has(conn.type)) {
                const hardware = hardwareMap.get(conn.type);
                usedCables.set(conn.type, {
                    type: conn.type,
                    color: conn.color || hardware?.color || '#94a3b8',
                    dash: conn.category === 'Cable' && conn.type === 'Wireless',
                    order: hardwareOrderMap.get(conn.type) ?? 9999 // Use hardware list order
                });
            }
        });

        // Render components
        this.renderComponents(usedComponents, hardwareList);
        
        // Render cables
        this.renderCables(usedCables, hardwareList);
    }

    renderComponents(componentsMap, hardwareList) {
        if (!this.componentsContainer) return;

        this.componentsContainer.innerHTML = '';

        // Sort components by hardware list order (Device category only)
        const deviceTypes = hardwareList
            .filter(item => item.category === 'Device')
            .map(item => item.type);
        
        const sortedComponents = Array.from(componentsMap.values()).sort((a, b) => {
            const indexA = deviceTypes.indexOf(a.type);
            const indexB = deviceTypes.indexOf(b.type);
            
            // If both found in hardware list, use their order
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }
            // If only one found, prioritize it
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            // If neither found, sort alphabetically
            return a.type.localeCompare(b.type);
        });

        sortedComponents.forEach(component => {
            const item = document.createElement('div');
            item.className = 'flex items-center gap-2';
            
            // Color box
            const colorBox = document.createElement('div');
            colorBox.className = 'w-4 h-4 rounded border border-slate-200';
            colorBox.style.backgroundColor = component.color;
            
            // Type label
            const label = document.createElement('span');
            label.className = 'text-xs text-slate-700';
            label.textContent = component.type;
            
            item.appendChild(colorBox);
            item.appendChild(label);
            this.componentsContainer.appendChild(item);
        });

        // Show message if no components
        if (sortedComponents.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'text-xs text-slate-400 italic';
            emptyMsg.textContent = 'No components';
            this.componentsContainer.appendChild(emptyMsg);
        }
    }

    renderCables(cablesMap, hardwareList) {
        if (!this.cablesContainer) return;

        this.cablesContainer.innerHTML = '';

        // Sort cables by hardware list order (Cable category only)
        const cableTypes = hardwareList
            .filter(item => item.category === 'Cable')
            .map(item => item.type);
        
        const sortedCables = Array.from(cablesMap.values()).sort((a, b) => {
            const indexA = cableTypes.indexOf(a.type);
            const indexB = cableTypes.indexOf(b.type);
            
            // If both found in hardware list, use their order
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }
            // If only one found, prioritize it
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            // If neither found, sort alphabetically
            return a.type.localeCompare(b.type);
        });

        sortedCables.forEach(cable => {
            const item = document.createElement('div');
            item.className = 'flex items-center gap-2';
            
            // Color line
            const lineContainer = document.createElement('div');
            lineContainer.className = 'w-8 h-0.5 relative';
            
            const line = document.createElement('div');
            line.className = 'absolute top-0 left-0 w-full h-full';
            line.style.backgroundColor = cable.color;
            if (cable.dash) {
                line.style.borderTop = `2px dashed ${cable.color}`;
                line.style.backgroundColor = 'transparent';
            }
            
            lineContainer.appendChild(line);
            
            // Type label
            const label = document.createElement('span');
            label.className = 'text-xs text-slate-700';
            label.textContent = cable.type;
            
            item.appendChild(lineContainer);
            item.appendChild(label);
            this.cablesContainer.appendChild(item);
        });

        // Show message if no cables
        if (sortedCables.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'text-xs text-slate-400 italic';
            emptyMsg.textContent = 'No cables';
            this.cablesContainer.appendChild(emptyMsg);
        }
    }
}

