import { ViewManager } from '../managers/ViewManager.js';
import { RequestManager } from '../managers/RequestManager.js';
import { BackgroundManager } from '../managers/BackgroundManager.js';
import { BOMManager } from '../managers/BOMManager.js';
import { PPTExportManager } from '../managers/PPTExportManager.js';
import { InteractionManager } from '../managers/InteractionManager.js';
import { PropertyManager } from '../managers/PropertyManager.js';
import { HardwareRegistryManager } from '../managers/HardwareRegistryManager.js';
import { HardwareListManager } from '../managers/HardwareListManager.js';
import { LegendManager } from '../managers/LegendManager.js';
import { ProjectManager } from '../managers/ProjectManager.js';
import { Visualizer } from './Visualizer.js';
import { DataStore } from './DataStore.js';

export class App {
    constructor() {
        this.dataStore = new DataStore();
        this.viewManager = new ViewManager(this.dataStore);
        this.requestManager = new RequestManager(this.dataStore);
        this.backgroundManager = new BackgroundManager(this.dataStore);
        this.bomManager = new BOMManager(this.dataStore);
        this.pptExportManager = new PPTExportManager(this.dataStore);
        this.visualizer = new Visualizer(this.dataStore);
        this.propertyManager = new PropertyManager(this.dataStore);
        this.hardwareRegistryManager = new HardwareRegistryManager(this.dataStore);
        this.interactionManager = new InteractionManager(this.dataStore, this.visualizer);
        this.hardwareListManager = new HardwareListManager(this.dataStore);
        this.legendManager = new LegendManager(this.dataStore);
        this.projectManager = new ProjectManager(this.dataStore, this.visualizer);

        // Bind Selection - This will be wrapped by InteractionManager for cable connection mode
        // Normal node selection goes to PropertyManager
        const originalOnNodeSelect = (nodeId) => {
            this.propertyManager.selectNode(nodeId);
            // Visual feedback for normal selection
            if (!this.interactionManager.selectedCable) {
                this.visualizer.highlightNode(nodeId, 'selected');
            }
        };

        // Set up node selection handler
        this.visualizer.onNodeSelect = (nodeId) => {
            // If cable is selected, InteractionManager will handle it
            if (this.interactionManager.selectedCable) {
                this.interactionManager.handleNodeClickForConnection(nodeId);
            } else {
                // Otherwise, normal selection
                originalOnNodeSelect(nodeId);
            }
        };

        // Initialize project file buttons
        this.initProjectFileButtons();

        // Setup auto-save on page unload
        this.setupAutoSaveOnUnload();

        // Make hardwareListManager accessible globally for checkbox handler
        window.app = this;
    }

    setupAutoSaveOnUnload() {
        // Save before page unload
        window.addEventListener('beforeunload', () => {
            if (this.dataStore && typeof this.dataStore.saveToLocalStorage === 'function') {
                // Clear timeout and save immediately
                if (this.dataStore.autoSaveTimeout) {
                    clearTimeout(this.dataStore.autoSaveTimeout);
                }
                this.dataStore.saveToLocalStorage();
            }
        });
    }

    initProjectFileButtons() {
        // Import JSON button
        const importButton = document.getElementById('btn-import-json');
        const importInput = document.getElementById('input-import-project');
        
        if (importButton && importInput) {
            importButton.addEventListener('click', () => {
                importInput.click();
            });
            
            importInput.addEventListener('change', (e) => {
                this.projectManager.handleFileInput(e);
            });
        }

        // Export JSON button
        const exportButton = document.getElementById('btn-export-json');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                this.projectManager.exportProject();
            });
        }
    }
}
