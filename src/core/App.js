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
        const importInput = document.getElementById('input-import-project');

        // Save button with dropdown
        const saveButton = document.getElementById('btn-save');
        const saveDropdown = document.getElementById('save-dropdown');
        const saveLocalButton = document.getElementById('btn-save-local');
        const saveNASButton = document.getElementById('btn-save-nas');

        if (saveButton && saveDropdown) {
            // Toggle dropdown on button click
            saveButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = saveDropdown.classList.contains('hidden');

                // Close other dropdowns
                document.getElementById('load-dropdown')?.classList.add('hidden');

                if (isHidden) {
                    saveDropdown.classList.remove('hidden');
                } else {
                    saveDropdown.classList.add('hidden');
                }
            });

            // Save to Local
            if (saveLocalButton) {
                saveLocalButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    saveDropdown.classList.add('hidden');
                    await this.projectManager.exportProject();
                });
            }

            // Save to NAS
            if (saveNASButton) {
                saveNASButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    saveDropdown.classList.add('hidden');
                    const projectName = prompt('프로젝트 이름을 입력하세요:', this.dataStore.getState().meta.projectName || 'ProjectName_SystemConfiguration_IMfine');
                    if (projectName) {
                        try {
                            await this.projectManager.saveProjectToNAS(projectName);
                        } catch (error) {
                            console.error('Save to NAS error:', error);
                        }
                    }
                });
            }
        }

        // Load button with dropdown
        const loadButton = document.getElementById('btn-load');
        const loadDropdown = document.getElementById('load-dropdown');
        const loadLocalButton = document.getElementById('btn-load-local');
        const loadNASButton = document.getElementById('btn-load-nas');

        if (loadButton && loadDropdown) {
            // Toggle dropdown on button click
            loadButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = loadDropdown.classList.contains('hidden');

                // Close other dropdowns
                document.getElementById('save-dropdown')?.classList.add('hidden');

                if (isHidden) {
                    loadDropdown.classList.remove('hidden');
                } else {
                    loadDropdown.classList.add('hidden');
                }
            });

            // Load from Local
            if (loadLocalButton && importInput) {
                loadLocalButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    loadDropdown.classList.add('hidden');
                    importInput.click();
                });
            }

            // Load from NAS
            if (loadNASButton) {
                const nasFileModal = document.getElementById('nas-file-modal');
                const nasFileList = document.getElementById('nas-file-list');
                const btnCloseNasModal = document.getElementById('btn-close-nas-modal');
                const btnCancelNasLoad = document.getElementById('btn-cancel-nas-load');

                // Close/Cancel handlers
                const closeNasModal = () => {
                    nasFileModal.classList.add('hidden');
                };

                if (btnCloseNasModal) btnCloseNasModal.addEventListener('click', closeNasModal);
                if (btnCancelNasLoad) btnCancelNasLoad.addEventListener('click', closeNasModal);

                loadNASButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    loadDropdown.classList.add('hidden');

                    // Show modal
                    nasFileModal.classList.remove('hidden');
                    nasFileList.innerHTML = '<div class="text-center text-slate-400 py-8 text-sm">Loading files...</div>';

                    try {
                        const projects = await this.projectManager.listProjectsFromNAS();

                        if (projects.length === 0) {
                            nasFileList.innerHTML = '<div class="text-center text-slate-400 py-8 text-sm">No projects found.</div>';
                            return;
                        }

                        // Render list
                        nasFileList.innerHTML = '';
                        // Sort by modified date desc
                        projects.sort((a, b) => b.modified - a.modified).forEach(project => {
                            const date = new Date(project.modified * 1000).toLocaleString();
                            const div = document.createElement('div');
                            div.className = 'nas-file-item';
                            div.innerHTML = `
                                <i data-lucide="file-json" class="w-5 h-5 file-icon"></i>
                                <div class="file-info">
                                    <div class="file-name">${project.name}</div>
                                    <div class="file-date">${date}</div>
                                </div>
                            `;
                            div.addEventListener('click', async () => {
                                try {
                                    closeNasModal();
                                    await this.projectManager.loadProjectFromNAS(project.name);
                                    alert(`프로젝트 "${project.name}"를 불러왔습니다.`);
                                } catch (error) {
                                    console.error('Load error:', error);
                                    alert('로드 실패: ' + error.message);
                                }
                            });
                            nasFileList.appendChild(div);
                        });

                        // Re-initialize icons for new elements
                        if (window.lucide) lucide.createIcons();

                    } catch (error) {
                        console.error('Load from NAS error:', error);
                        nasFileList.innerHTML = `<div class="text-center text-red-500 py-8 text-sm">Error loading files: ${error.message}</div>`;
                    }
                });
            }
        }

        // File input change handler
        if (importInput) {
            importInput.addEventListener('change', (e) => {
                this.projectManager.handleFileInput(e);
            });
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!saveButton?.contains(e.target) && !saveDropdown?.contains(e.target)) {
                saveDropdown?.classList.add('hidden');
            }
            if (!loadButton?.contains(e.target) && !loadDropdown?.contains(e.target)) {
                loadDropdown?.classList.add('hidden');
            }
        });

        // Clear Project button
        const clearButton = document.getElementById('btn-clear-project');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.projectManager.clearProject();
            });
        }
    }
}
