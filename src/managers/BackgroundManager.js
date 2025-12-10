export class BackgroundManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.init();
    }

    init() {
        // Create hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.id = 'bg-upload-input';
        document.body.appendChild(input);

        input.addEventListener('change', (e) => this.handleFileSelect(e));

        // Add Upload Button to UI (if not exists, or bind to existing)
        // For now, let's create a button in the header dynamically or assume it exists
        // I'll add it to the header via JS for simplicity
        this.addUploadButton();
    }

    addUploadButton() {
        const headerActions = document.getElementById('header-actions');
        if (headerActions) {
            const btn = document.createElement('button');
            // Secondary Button Style
            btn.className = 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2';
            btn.innerHTML = '<i data-lucide="upload" class="w-4 h-4"></i> Upload Plan';
            btn.onclick = () => document.getElementById('bg-upload-input').click();

            // Insert before the Export button
            headerActions.insertBefore(btn, headerActions.firstChild);

            // Refresh icons for the new button
            if (window.lucide) window.lucide.createIcons();
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            this.dataStore.projectData.meta.floorPlanImage = base64;
            this.dataStore.notify();
            console.log("BackgroundManager: Image uploaded");
        };
        reader.readAsDataURL(file);
    }
}
