import { DEFAULT_HARDWARE } from '../config/default-hardware.js';

// Available colors for hardware (excluding red colors)
const AVAILABLE_COLORS = [
    '#22c55e', // green-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#f59e0b', // amber-500
    '#10b981', // emerald-500
    '#06b6d4', // cyan-500
    '#6366f1', // indigo-500
    '#14b8a6', // teal-500
    '#84cc16', // lime-500
    '#f97316', // orange-500
    '#a855f7', // purple-500
    '#0ea5e9', // sky-500
    '#64748b', // slate-500
    '#94a3b8'  // slate-400
];

export class HardwareRegistryManager {
    constructor(dataStore) {
        this.dataStore = dataStore;

        // UI Elements
        this.listContainer = document.getElementById('hardware-list-container');
        this.btnAdd = document.getElementById('btn-add-hardware');
        this.modal = document.getElementById('hardware-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.btnSave = document.getElementById('btn-save-hw');
        this.btnCancel = document.getElementById('btn-cancel-hw');

        // Inputs
        this.inputEditId = document.getElementById('hw-edit-id');
        this.inputCategory = document.getElementById('hw-category');
        this.inputType = document.getElementById('hw-type');
        this.inputModel = document.getElementById('hw-model');
        this.inputColor = document.getElementById('hw-color');

        this.init();
    }

    init() {

        // Initialize with defaults if empty
        const currentList = this.dataStore.getState().meta.hardwareList;
        if (!currentList || currentList.length === 0) {
            // Add id to default hardware items and ensure unique colors
            const usedColors = new Set();
            const defaultHardwareWithIds = DEFAULT_HARDWARE.map((item, index) => {
                let color = item.color;
                // If color is already used, find an unused color
                if (usedColors.has(color)) {
                    const availableColors = AVAILABLE_COLORS.filter(c => !usedColors.has(c));
                    color = availableColors[0] || AVAILABLE_COLORS[0];
                }
                usedColors.add(color);
                return {
                    ...item,
                    id: `default-${index}`,
                    color: color
                };
            });
            this.dataStore.updateMeta({ hardwareList: defaultHardwareWithIds });
        }

        // Bind Events
        if (this.btnAdd) {
            this.btnAdd.onclick = () => {
                this.openModal(); // Open in Add mode
            };
        }
        if (this.btnCancel) this.btnCancel.onclick = () => this.closeModal();
        if (this.btnSave) this.btnSave.onclick = () => this.saveHardwareFromForm();

        // Subscribe to store
        this.dataStore.subscribe((data) => {
            this.renderList(data.meta.hardwareList || []);
        });

        // Initial render
        const initialList = this.dataStore.getState().meta.hardwareList || [];
        this.renderList(initialList);

    }

    getUnusedColor() {
        const currentList = this.dataStore.getState().meta.hardwareList || [];
        const usedColors = new Set(currentList.map(item => item.color).filter(Boolean));

        // Exclude red colors
        const redColors = ['#ef4444', '#f87171', '#dc2626', '#fee2e2', '#fca5a5', '#991b1b', '#be123c'];
        const availableColors = AVAILABLE_COLORS.filter(color => !redColors.includes(color.toLowerCase()));

        // Find first unused color from available colors (excluding red)
        for (const color of availableColors) {
            if (!usedColors.has(color)) {
                return color;
            }
        }

        // If all colors are used, return first available non-red color
        return availableColors[0] || AVAILABLE_COLORS[0];
    }

    openModal(item = null) {
        this.modal.classList.remove('hidden');
        this.modal.classList.add('fade-in');

        if (item) {
            // Edit Mode
            this.modalTitle.textContent = 'Edit Hardware';
            this.inputEditId.value = item.id;
            this.inputCategory.value = item.category || 'Device';
            this.inputType.value = item.type;
            this.inputModel.value = item.model;
            this.inputColor.value = item.color || '#3b82f6';
        } else {
            // Add Mode - auto-select unused color
            this.modalTitle.textContent = 'Add Hardware';
            this.inputEditId.value = '';
            this.inputCategory.value = 'Device';
            this.inputType.value = '';
            this.inputModel.value = '';
            this.inputColor.value = this.getUnusedColor();
        }
    }

    closeModal() {
        this.modal.classList.add('hidden');
    }

    saveHardwareFromForm() {
        const item = {
            id: this.inputEditId.value,
            category: this.inputCategory.value,
            type: this.inputType.value || 'Generic',
            model: this.inputModel.value || 'Generic',
            color: this.inputColor.value
        };
        this.saveHardware(item);
    }

    saveHardware(item) {
        const currentList = this.dataStore.getState().meta.hardwareList || [];
        let newList;

        if (item.id) {
            // Edit existing
            const oldItem = currentList.find(i => i.id === item.id);
            newList = currentList.map(i => i.id === item.id ? item : i);

            // Sync changes to existing nodes on canvas
            if (oldItem) {
                this.dataStore.updateNodesByHardware(oldItem, item);
            }
        } else {
            // Add new - ensure color doesn't conflict
            item.id = Date.now().toString();
            if (!item.color || item.color === '#ef4444') {
                // If no color specified or red color, use unused color
                item.color = this.getUnusedColor();
            } else {
                // Check if color is already used
                const usedColors = new Set(currentList.map(i => i.color).filter(Boolean));
                if (usedColors.has(item.color)) {
                    // Color conflict - use unused color instead
                    item.color = this.getUnusedColor();
                }
            }
            newList = [...currentList, item];
        }

        this.dataStore.updateMeta({ hardwareList: newList });
        this.closeModal();
    }

    deleteHardware(itemId) {
        const currentList = this.dataStore.getState().meta.hardwareList || [];
        const newList = currentList.filter(item => item.id !== itemId);
        this.dataStore.updateMeta({ hardwareList: newList });
    }

    renderList(list) {
        if (!this.listContainer) return;

        this.listContainer.innerHTML = '';

        if (list.length === 0) {
            this.listContainer.innerHTML = '<p class="text-xs text-slate-400 italic text-center py-2">No hardware defined.</p>';
            return;
        }

        // Find Router color for UTP and Wireless
        const router = list.find(item => item.type === 'Router');
        const routerColor = router?.color || '#3b82f6';

        // Update UTP and Wireless colors to match Router
        const updatedList = list.map(item => {
            if ((item.type === 'UTP' || item.type === 'Wireless') && item.color !== routerColor) {
                return { ...item, color: routerColor };
            }
            return item;
        });

        // Group by category
        const devices = updatedList.filter(item => item.category === 'Device');
        const cables = updatedList.filter(item => item.category === 'Cable');

        // Render Device section
        if (devices.length > 0) {
            const deviceSection = this.createCategorySection('Device', devices, 'device-section');
            this.listContainer.appendChild(deviceSection);
        }

        // Render Cable section
        if (cables.length > 0) {
            const cableSection = this.createCategorySection('Cable', cables, 'cable-section');
            this.listContainer.appendChild(cableSection);
        }

        // Render Infra section
        const infra = updatedList.filter(item => item.category === 'Infra');
        if (infra.length > 0) {
            const infraSection = this.createCategorySection('Infra', infra, 'infra-section');
            this.listContainer.appendChild(infraSection);
        }

        // Re-initialize icons
        if (window.lucide) window.lucide.createIcons();
    }

    createCategorySection(categoryName, items, sectionId) {
        const section = document.createElement('div');
        // section.className = 'mb-4'; // Removed to rely on space-y-2 from container for consistent spacing
        section.id = sectionId;

        const toggleId = `toggle-${sectionId}`;
        const contentId = `content-${sectionId}`;
        const isExpanded = localStorage.getItem(`${sectionId}-expanded`) !== 'false';

        section.innerHTML = `
            <button class="toggle-category w-full flex items-center justify-between p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors mb-2" data-section-id="${sectionId}">
                <div class="flex items-center gap-2">
                    <i data-lucide="chevron-down" class="toggle-icon w-4 h-4 text-slate-600 transition-transform ${isExpanded ? '' : '-rotate-90'}"></i>
                    <span class="text-xs font-bold text-slate-700 uppercase">${categoryName}</span>
                    <span class="text-xs text-slate-500">(${items.length})</span>
                </div>
            </button>
            <div class="category-content space-y-2 ${isExpanded ? '' : 'hidden'}" id="${contentId}">
            </div>
        `;

        const toggleBtn = section.querySelector('.toggle-category');
        const contentDiv = section.querySelector(`#${contentId}`);
        const icon = section.querySelector('.toggle-icon');

        // Set initial state
        if (!isExpanded) {
            contentDiv.classList.add('hidden');
        }

        // Toggle functionality
        toggleBtn.onclick = () => {
            const isHidden = contentDiv.classList.contains('hidden');
            if (isHidden) {
                contentDiv.classList.remove('hidden');
                icon.classList.remove('-rotate-90');
                localStorage.setItem(`${sectionId}-expanded`, 'true');
            } else {
                contentDiv.classList.add('hidden');
                icon.classList.add('-rotate-90');
                localStorage.setItem(`${sectionId}-expanded`, 'false');
            }
        };

        // Render items
        items.forEach(item => {
            const el = this.createHardwareItem(item);
            contentDiv.appendChild(el);
        });

        return section;
    }

    createHardwareItem(item) {
        const el = document.createElement('div');
        // Make draggable only for Device category, not for Cable
        el.draggable = item.category !== 'Cable';
        el.dataset.type = item.type;
        el.dataset.model = item.model;

        // Get Router color for UTP and Wireless
        let displayColor = item.color;
        if (item.type === 'UTP' || item.type === 'Wireless') {
            const hardwareList = this.dataStore.getState().meta.hardwareList || [];
            const router = hardwareList.find(hw => hw.type === 'Router');
            displayColor = router?.color || '#3b82f6';
        }

        el.dataset.color = displayColor;
        el.dataset.category = item.category;

        // Different cursor and styling for cables
        const cursorClass = item.category === 'Cable' ? 'cursor-pointer' : 'cursor-move';
        el.className = `bg-slate-50 border border-slate-100 rounded-lg p-2 flex justify-between items-center ${cursorClass} hover:border-slate-400 hover:shadow-sm transition-all group relative`;

        // Icon based on type or category
        let iconName = this.getIconName(item.type, item.category);

        // Color box style - use displayColor for UTP/Wireless
        const colorStyle = `background-color: ${displayColor || '#ccc'};`;

        el.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-md flex items-center justify-center border border-slate-200 shadow-sm" style="${colorStyle}">
                        <i data-lucide="${iconName}" class="w-4 h-4 text-white mix-blend-hard-light"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-slate-700 group-hover:text-slate-900">${item.type}</p>
                        <p class="text-[10px] text-slate-500">${item.model}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn-edit p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors">
                        <i data-lucide="pencil" class="w-3 h-3"></i>
                    </button>
                <button class="btn-delete p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 transition-colors">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
                </div>
            `;

        // Bind Edit Click
        const btnEdit = el.querySelector('.btn-edit');
        if (btnEdit) {
            btnEdit.onclick = (e) => {
                e.stopPropagation(); // Prevent drag start or other clicks
                e.preventDefault();
                this.openModal(item);
            };
        }

        // Bind Delete Click
        const btnDelete = el.querySelector('.btn-delete');
        if (btnDelete) {
            btnDelete.onclick = (e) => {
                e.stopPropagation(); // Prevent drag start or other clicks
                e.preventDefault();
                if (confirm(`Delete "${item.type}"?`)) {
                    this.deleteHardware(item.id);
                }
            };
        }

        return el;
    }

    getIconName(type, category) {
        if (category === 'Cable') return 'cable';
        const t = type.toLowerCase();
        if (t.includes('router')) return 'router';
        if (t.includes('switch')) return 'network';
        if (t.includes('ap') || t.includes('access point')) return 'wifi';
        if (t.includes('220v')) return 'plug';
        if (t.includes('internet')) return 'globe';
        return 'box';
    }
}
