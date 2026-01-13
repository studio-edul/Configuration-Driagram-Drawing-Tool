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
                loadNASButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    loadDropdown.classList.add('hidden');
                    try {
                        const projects = await this.projectManager.listProjectsFromNAS();
                        
                        if (projects.length === 0) {
                            alert('NAS에 저장된 프로젝트가 없습니다.');
                            return;
                        }

                        // 프로젝트 목록 표시 모달
                        const projectList = projects.map((p, i) => 
                            `${i + 1}. ${p.name} (${new Date(p.modified * 1000).toLocaleString()})`
                        ).join('\n');

                        const selection = prompt(`불러올 프로젝트 번호를 선택하세요:\n\n${projectList}\n\n번호 입력:`);
                        const index = parseInt(selection) - 1;

                        if (isNaN(index) || index < 0 || index >= projects.length) {
                            alert('올바른 번호를 입력해주세요.');
                            return;
                        }

                        const selectedProject = projects[index];
                        await this.projectManager.loadProjectFromNAS(selectedProject.name);
                        alert(`프로젝트 "${selectedProject.name}"를 불러왔습니다.`);
                    } catch (error) {
                        console.error('Load from NAS error:', error);
                        alert('NAS에서 프로젝트를 불러오는 중 오류가 발생했습니다: ' + error.message);
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
