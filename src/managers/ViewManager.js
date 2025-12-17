export class ViewManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.buttons = {
            CONFIGURATION: document.getElementById('btn-view-logical'),
            INSTALLATION: document.getElementById('btn-view-physical'),
            NETWORK: document.getElementById('btn-view-network'),
            HARDWARE_LIST: document.getElementById('btn-hardware-list')
        };
        this.copyButton = document.getElementById('btn-copy-canvas');
        this.syncButton = document.getElementById('btn-sync-config');
        this.exportButton = document.getElementById('btn-export-ppt');

        this.init();
    }

    init() {
        // Bind events for mode buttons
        Object.entries(this.buttons).forEach(([mode, btn]) => {
            if (btn) {
                btn.addEventListener('click', () => this.switchMode(mode));
            }
        });

        // Bind copy button event
        if (this.copyButton) {
            this.copyButton.addEventListener('click', () => this.copyCanvas());
        }

        // Bind sync button event
        if (this.syncButton) {
            this.syncButton.addEventListener('click', () => this.syncFromConfiguration());
        }

        // Bind export button event
        if (this.exportButton) {
            this.exportButton.addEventListener('click', () => this.exportPPT());
        }

        // Subscribe to store changes to update UI
        this.dataStore.subscribe((data) => {
            this.updateUI(data.meta.mode);
        });

        // Initial UI state (with delay to ensure BackgroundManager is initialized)
        setTimeout(() => {
            this.updateUI(this.dataStore.getState().meta.mode);
        }, 100);
    }

    switchMode(mode) {
        this.dataStore.setMode(mode);

        // If switching to INSTALLATION mode, ensure positions are initialized
        if (mode === 'INSTALLATION') {
            const data = this.dataStore.getState();
            this.ensurePhysicalPositions(data);
        }
    }

    ensurePhysicalPositions(data) {
        let updated = false;
        const nodes = data.nodes;

        Object.values(nodes).forEach(node => {
            if (!node.physicalPos || (node.physicalPos.x === 0 && node.physicalPos.y === 0)) {
                // Copy logicalPos to physicalPos as initial value
                // Logical mode uses 24px grid: x = col * 24, y = row * 24
                const x = node.logicalPos?.x || (node.logicalPos?.col || 0) * 24;
                const y = node.logicalPos?.y || (node.logicalPos?.row || 0) * 24;

                this.dataStore.updateNode(node.id, {
                    physicalPos: { x, y }
                });
                updated = true;
            }
        });
    }

    syncFromConfiguration() {
        const data = this.dataStore.getState();
        const nodes = data.nodes;
        let updated = false;

        // Copy logical positions to physical positions for all nodes
        Object.values(nodes).forEach(node => {
            if (node.logicalPos) {
                // Convert logical grid position to pixel coordinates
                const x = node.logicalPos.x || (node.logicalPos.col || 0) * 24;
                const y = node.logicalPos.y || (node.logicalPos.row || 0) * 24;

                // Update physical position to match logical position
                this.dataStore.updateNode(node.id, {
                    physicalPos: { x, y }
                });
                updated = true;
            }
        });

        if (updated) {
            // Visual feedback
            const originalText = this.syncButton.innerHTML;
            this.syncButton.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Synced!';
            this.syncButton.classList.add('bg-green-50', 'text-green-700', 'border-green-300');
            this.syncButton.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');

            // Refresh icons
            if (window.lucide) window.lucide.createIcons();

            // Reset after 2 seconds
            setTimeout(() => {
                this.syncButton.innerHTML = originalText;
                this.syncButton.classList.remove('bg-green-50', 'text-green-700', 'border-green-300');
                this.syncButton.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
                if (window.lucide) window.lucide.createIcons();
            }, 2000);

        } else {
            // Show message if no nodes to sync
            const originalText = this.syncButton.innerHTML;
            this.syncButton.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4"></i> No nodes';
            this.syncButton.classList.add('bg-yellow-50', 'text-yellow-700', 'border-yellow-300');
            this.syncButton.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');

            if (window.lucide) window.lucide.createIcons();

            setTimeout(() => {
                this.syncButton.innerHTML = originalText;
                this.syncButton.classList.remove('bg-yellow-50', 'text-yellow-700', 'border-yellow-300');
                this.syncButton.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
                if (window.lucide) window.lucide.createIcons();
            }, 2000);
        }
    }

    async exportPPT() {
        if (!window.app || !window.app.pptExportManager) {
            console.error('PPTExportManager not available');
            return;
        }

        const data = this.dataStore.getState();
        const success = window.app.pptExportManager.exportToPPT(data.nodes, data.connections, data.meta.hardwareList);

        if (success) {
            // Visual feedback
            const originalText = this.exportButton.innerHTML;
            this.exportButton.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i> Downloading...';

            if (window.lucide) window.lucide.createIcons();

            setTimeout(() => {
                this.exportButton.innerHTML = originalText;
                if (window.lucide) window.lucide.createIcons();
            }, 2000);
        } else {
            alert('Failed to export PPT. Please try again.');
        }
    }

    copyCanvas() {
        // Legacy copy functionality, if needed
        console.log('Copy canvas not implemented');
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

        // Show/hide copy button based on mode (CONFIGURATION and INSTALLATION)
        if (this.copyButton) {
            if (activeMode === 'CONFIGURATION' || activeMode === 'INSTALLATION') {
                this.copyButton.classList.remove('hidden');
            } else {
                this.copyButton.classList.add('hidden');
            }
        }

        // Show/hide sync button based on mode (INSTALLATION only)
        if (this.syncButton) {
            if (activeMode === 'INSTALLATION') {
                this.syncButton.classList.remove('hidden');
            } else {
                this.syncButton.classList.add('hidden');
            }
        }

        // Show/hide upload button based on mode (INSTALLATION only)
        if (window.app && window.app.backgroundManager) {
            if (activeMode === 'INSTALLATION') {
                window.app.backgroundManager.showUploadButton();
            } else {
                window.app.backgroundManager.hideUploadButton();
            }
        }

        // Show/hide views based on mode
        const canvasArea = document.querySelector('#canvas-container')?.parentElement;
        const hardwareListView = document.getElementById('hardware-list-view');

        if (activeMode === 'HARDWARE_LIST') {
            // Hide canvas area and show hardware list view
            if (canvasArea) {
                canvasArea.classList.add('hidden');
            }
            if (hardwareListView) {
                hardwareListView.classList.remove('hidden');
            }
        } else {
            // Show canvas area and hide hardware list view
            if (canvasArea) {
                canvasArea.classList.remove('hidden');
            }
            if (hardwareListView) {
                hardwareListView.classList.add('hidden');
            }
        }
    }
}
