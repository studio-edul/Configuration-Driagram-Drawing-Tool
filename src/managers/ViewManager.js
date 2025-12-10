export class ViewManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.buttons = {
            LOGICAL: document.getElementById('btn-view-logical'),
            PHYSICAL: document.getElementById('btn-view-physical'),
            REQUEST: document.getElementById('btn-view-request')
        };

        this.init();
    }

    init() {
        // Bind events
        Object.entries(this.buttons).forEach(([mode, btn]) => {
            if (btn) {
                btn.addEventListener('click', () => this.switchMode(mode));
            }
        });

        // Subscribe to store changes to update UI
        this.dataStore.subscribe((data) => {
            this.updateUI(data.meta.mode);
        });

        // Initial UI state
        this.updateUI(this.dataStore.getState().meta.mode);
    }

    switchMode(newMode) {
        const currentData = this.dataStore.getState();

        // Strategy: Initial Placement when entering PHYSICAL mode
        if (newMode === 'PHYSICAL' || newMode === 'REQUEST') {
            this.ensurePhysicalPositions(currentData);
        }

        this.dataStore.setMode(newMode);
        console.log(`ViewManager: Switched to ${newMode}`);
    }

    ensurePhysicalPositions(data) {
        let updated = false;
        const nodes = data.nodes;

        Object.values(nodes).forEach(node => {
            if (!node.physicalPos) {
                // Copy logicalPos to physicalPos as initial value
                // Note: Logical pos might be grid-based (col, row), need conversion if so.
                // For now assuming logicalPos has x, y or we map col/row to x/y.
                // Guide says: "Logical Mode(구성도)에서의 계산된 렌더링 좌표(x, y)를 그대로 physicalPos의 초기값으로 복사"
                // Since we don't have the renderer's calculated positions here easily without the Visualizer,
                // we might need to rely on the Visualizer to update the store, OR we estimate it here.
                // Let's assume logicalPos has x,y for now or we use a default multiplier.

                const x = node.logicalPos?.x || (node.logicalPos?.col * 150 + 50) || 100;
                const y = node.logicalPos?.y || (node.logicalPos?.row * 100 + 50) || 100;

                node.physicalPos = { x, y };
                updated = true;
            }
        });

        if (updated) {
            // We modified nodes directly, which is a bit hacky for the store. 
            // Ideally we should dispatch an action.
            // But since we are inside the manager, we can call updateNode or just notify.
            // For batch update, we might want a specific method in DataStore.
            this.dataStore.notify();
        }
    }

    updateUI(activeMode) {
        Object.entries(this.buttons).forEach(([mode, btn]) => {
            if (!btn) return;

            if (mode === activeMode) {
                // Active State
                btn.classList.remove('text-slate-500', 'hover:text-slate-900');
                btn.classList.add('bg-white', 'shadow-sm', 'text-slate-900', 'font-medium');
            } else {
                // Inactive State
                btn.classList.remove('bg-white', 'shadow-sm', 'text-slate-900', 'font-medium');
                btn.classList.add('text-slate-500', 'hover:text-slate-900');
            }
        });
    }
}
