export class BackgroundManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.cropper = null;
        this.currentFile = null;
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

        // Attach listener to existing upload button
        const btn = document.getElementById('btn-upload-plan');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openUploadModal();
            });
        }

        // Setup upload modal handlers
        this.setupUploadModal();

        // Setup crop modal handlers
        this.setupCropModal();
    }

    setupUploadModal() {
        const uploadModal = document.getElementById('upload-modal');
        const dropZone = document.getElementById('drop-zone');
        const btnBrowse = document.getElementById('btn-browse-file');
        const btnCancel = document.getElementById('btn-cancel-upload');
        const fileInput = document.getElementById('bg-upload-input');
        const modalContent = uploadModal?.querySelector('.bg-white'); // Modal content wrapper

        if (!uploadModal || !dropZone || !btnBrowse || !btnCancel) return;

        // Close modal when clicking outside
        uploadModal.addEventListener('click', (e) => {
            // If click is on the modal backdrop (not on modal content)
            if (e.target === uploadModal) {
                this.closeUploadModal();
            }
        });

        // Prevent modal from closing when clicking inside modal content
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Browse button click
        btnBrowse.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        // Cancel button
        btnCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeUploadModal();
        });

        // Drag and drop handlers
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('border-slate-500', 'bg-slate-100');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-slate-500', 'bg-slate-100');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-slate-500', 'bg-slate-100');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    this.processFile(file);
                } else {
                    alert('Please upload an image file.');
                }
            }
        });

        // Click on drop zone to browse
        dropZone.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    showUploadButton() {
        const btn = document.getElementById('btn-upload-plan');
        if (btn) {
            btn.classList.remove('hidden');
        }
    }

    hideUploadButton() {
        const btn = document.getElementById('btn-upload-plan');
        if (btn) {
            btn.classList.add('hidden');
        }
    }

    setupCropModal() {
        const cropModal = document.getElementById('crop-modal');
        const cropImage = document.getElementById('crop-image');
        const btnCancel = document.getElementById('btn-cancel-crop');
        const btnConfirm = document.getElementById('btn-confirm-crop');
        const grayscaleCheckbox = document.getElementById('crop-grayscale');
        const modalContent = cropModal?.querySelector('.bg-white'); // Modal content wrapper

        if (!cropModal || !cropImage || !btnCancel || !btnConfirm) return;

        // Close modal when clicking outside
        cropModal.addEventListener('click', (e) => {
            // If click is on the modal backdrop (not on modal content)
            if (e.target === cropModal) {
                this.closeCropModal();
            }
        });

        // Prevent modal from closing when clicking inside modal content
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Grayscale checkbox change handler - real-time preview
        if (grayscaleCheckbox) {
            grayscaleCheckbox.addEventListener('change', (e) => {
                this.applyGrayscaleFilter(e.target.checked);
            });
        }

        btnCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeCropModal();
        });

        btnConfirm.addEventListener('click', (e) => {
            e.stopPropagation();
            this.confirmCrop();
        });
    }

    /**
     * Apply or remove grayscale filter to cropper image and canvas elements
     * Guide elements (crop box, lines, points) remain colored
     */
    applyGrayscaleFilter(apply) {
        const cropImage = document.getElementById('crop-image');
        if (!cropImage || !this.cropper) return;

        const filterValue = apply ? 'grayscale(100%)' : 'none';
        const cropperContainer = cropImage.parentElement;
        if (!cropperContainer) return;

        // Apply filter to image and canvas elements
        this._applyFilterToImageElements(cropperContainer, cropImage, filterValue);

        // Ensure guide elements remain colored
        this._removeFilterFromGuideElements(cropperContainer);

        // Set up observers and event listeners for dynamic updates
        if (apply) {
            this._setupGrayscaleObservers(cropperContainer, cropImage);
        } else {
            this._cleanupGrayscaleObservers();
        }
    }

    /**
     * Apply filter to image and canvas elements (not guide elements)
     */
    _applyFilterToImageElements(container, image, filterValue) {
        image.style.filter = filterValue;

        const cropperCanvas = container.querySelector('.cropper-canvas');
        if (cropperCanvas) cropperCanvas.style.filter = filterValue;

        const viewBox = container.querySelector('.cropper-view-box');
        if (viewBox) viewBox.style.filter = filterValue;

        // Apply to canvas elements, excluding guide-related ones
        const canvases = container.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            const parent = canvas.parentElement;
            if (parent && !this._isGuideElement(parent)) {
                canvas.style.filter = filterValue;
            }
        });
    }

    /**
     * Remove filter from guide elements to keep them colored
     */
    _removeFilterFromGuideElements(container) {
        const cropBox = container.querySelector('.cropper-crop-box');
        const cropLines = container.querySelectorAll('.cropper-line');
        const cropPoints = container.querySelectorAll('.cropper-point');

        if (cropBox) cropBox.style.filter = 'none';
        cropLines.forEach(line => line.style.filter = 'none');
        cropPoints.forEach(point => point.style.filter = 'none');
    }

    /**
     * Check if element is a guide element
     */
    _isGuideElement(element) {
        return element.classList.contains('cropper-crop-box') ||
            element.classList.contains('cropper-line') ||
            element.classList.contains('cropper-point');
    }

    /**
     * Set up MutationObserver and event listeners for grayscale filter
     */
    _setupGrayscaleObservers(container, image) {
        // Disconnect existing observer
        if (this._grayscaleObserver) {
            this._grayscaleObserver.disconnect();
        }

        // Create MutationObserver for dynamic canvas updates
        this._grayscaleObserver = new MutationObserver(() => {
            this._applyFilterToImageElements(container, image, 'grayscale(100%)');
            this._removeFilterFromGuideElements(container);
        });

        this._grayscaleObserver.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        });

        // Set up cropper event listeners
        if (this.cropper.cropper) {
            if (this._cropFilterUpdate) {
                this.cropper.cropper.removeEventListener('crop', this._cropFilterUpdate);
                this.cropper.cropper.removeEventListener('zoom', this._cropFilterUpdate);
                this.cropper.cropper.removeEventListener('ready', this._cropFilterUpdate);
            }

            this._cropFilterUpdate = () => {
                setTimeout(() => {
                    this._applyFilterToImageElements(container, image, 'grayscale(100%)');
                    this._removeFilterFromGuideElements(container);
                }, 10);
            };

            this.cropper.cropper.addEventListener('crop', this._cropFilterUpdate);
            this.cropper.cropper.addEventListener('zoom', this._cropFilterUpdate);
            this.cropper.cropper.addEventListener('ready', this._cropFilterUpdate);
        }
    }

    /**
     * Clean up observers and event listeners
     */
    _cleanupGrayscaleObservers() {
        if (this._grayscaleObserver) {
            this._grayscaleObserver.disconnect();
            this._grayscaleObserver = null;
        }

        if (this._cropFilterUpdate && this.cropper?.cropper) {
            this.cropper.cropper.removeEventListener('crop', this._cropFilterUpdate);
            this.cropper.cropper.removeEventListener('zoom', this._cropFilterUpdate);
            this.cropper.cropper.removeEventListener('ready', this._cropFilterUpdate);
            this._cropFilterUpdate = null;
        }
    }

    openUploadModal() {
        const uploadModal = document.getElementById('upload-modal');
        if (uploadModal) {
            uploadModal.classList.remove('hidden');
            if (window.lucide) window.lucide.createIcons();
        }
    }

    closeUploadModal() {
        const uploadModal = document.getElementById('upload-modal');
        if (uploadModal) {
            uploadModal.classList.add('hidden');
        }

        // Reset file input
        const input = document.getElementById('bg-upload-input');
        if (input) {
            input.value = '';
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.processFile(file);
    }

    processFile(file) {
        // Close upload modal
        this.closeUploadModal();

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }

        this.currentFile = file;
        this.openCropModal(file);
    }

    openCropModal(file) {
        const cropModal = document.getElementById('crop-modal');
        const cropImage = document.getElementById('crop-image');

        if (!cropModal || !cropImage) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            cropImage.src = event.target.result;
            cropModal.classList.remove('hidden');

            // Initialize cropper after image is loaded
            cropImage.onload = () => {
                // Destroy existing cropper if any
                if (this.cropper) {
                    this.cropper.destroy();
                }

                // Reset grayscale filter when opening new image
                cropImage.style.filter = 'none';
                const grayscaleCheckbox = document.getElementById('crop-grayscale');
                if (grayscaleCheckbox) {
                    grayscaleCheckbox.checked = false;
                }

                // Initialize cropper
                this.cropper = new Cropper(cropImage, {
                    aspectRatio: NaN, // Free aspect ratio
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 1,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                });

                // Apply grayscale filter after cropper initialization if checkbox is checked
                setTimeout(() => {
                    if (grayscaleCheckbox?.checked) {
                        this.applyGrayscaleFilter(true);
                    }
                }, 200);

                if (this.cropper?.cropper) {
                    this.cropper.cropper.addEventListener('ready', () => {
                        setTimeout(() => {
                            if (grayscaleCheckbox?.checked) {
                                this.applyGrayscaleFilter(true);
                            }
                        }, 100);
                    }, { once: true });
                }
            };
        };
        reader.readAsDataURL(file);
    }

    closeCropModal() {
        const cropModal = document.getElementById('crop-modal');
        if (cropModal) {
            cropModal.classList.add('hidden');
        }

        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }

        // Reset grayscale checkbox and image filter
        const grayscaleCheckbox = document.getElementById('crop-grayscale');
        const cropImage = document.getElementById('crop-image');
        if (grayscaleCheckbox) {
            grayscaleCheckbox.checked = false;
        }
        if (cropImage) {
            cropImage.style.filter = 'none';
        }

        // Reset file input
        const input = document.getElementById('bg-upload-input');
        if (input) {
            input.value = '';
        }

        this.currentFile = null;
    }

    /**
     * Convert canvas image to grayscale using luminance formula
     */
    convertToGrayscale(canvas) {
        if (!canvas) return canvas;

        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;

        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Convert to grayscale using luminance formula (ITU-R BT.601)
            for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                data[i] = gray;     // Red
                data[i + 1] = gray; // Green
                data[i + 2] = gray; // Blue
                // Alpha channel remains unchanged
            }

            ctx.putImageData(imageData, 0, 0);
            return canvas;
        } catch (error) {
            console.error("BackgroundManager: Error converting to grayscale:", error);
            return canvas;
        }
    }

    confirmCrop() {
        if (!this.cropper) return;

        // Get cropped canvas
        let canvas = this.cropper.getCroppedCanvas({
            width: 1920, // Max width
            height: 1080, // Max height
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        if (!canvas) return;

        // Apply grayscale conversion if option is selected
        const grayscaleCheckbox = document.getElementById('crop-grayscale');
        if (grayscaleCheckbox?.checked) {
            canvas = this.convertToGrayscale(canvas);
            if (!canvas) {
                alert('Failed to convert image to grayscale. Please try again.');
                return;
            }
        }

        // Save to DataStore
        const base64 = canvas.toDataURL('image/png');
        this.dataStore.updateMeta({ floorPlanImage: base64 });

        this.closeCropModal();
    }
}
