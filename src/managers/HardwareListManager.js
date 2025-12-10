export class HardwareListManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.canvasContainer = document.getElementById('canvas-container');
        this.hardwareListView = document.getElementById('hardware-list-view');
        this.tableBodyImfine = document.getElementById('hardware-list-tbody-imfine');
        this.tableBodyLocal = document.getElementById('hardware-list-tbody-local');
        this.btnCopyImfine = document.getElementById('btn-copy-imfine');
        this.btnCopyLocal = document.getElementById('btn-copy-local');
        this.tableImfine = document.getElementById('hardware-list-table-imfine');
        this.tableLocal = document.getElementById('hardware-list-table-local');
        this.projectNameLocal = document.getElementById('project-name-local');
        this.projectNameImfine = document.getElementById('project-name-imfine');

        this.init();
    }

    init() {
        // Subscribe to mode changes
        this.dataStore.subscribe((data) => {
            this.handleModeChange(data.meta.mode);
        });

        // Bind copy buttons
        if (this.btnCopyImfine) {
            this.btnCopyImfine.addEventListener('click', () => {
                this.copyTable('imfine');
            });
        }
        if (this.btnCopyLocal) {
            this.btnCopyLocal.addEventListener('click', () => {
                this.copyTable('local');
            });
        }

        // Bind project name editing
        if (this.projectNameLocal) {
            this.projectNameLocal.addEventListener('blur', () => {
                this.updateProjectName(this.projectNameLocal.textContent.trim());
            });
            this.projectNameLocal.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.projectNameLocal.blur();
                }
            });
        }
        if (this.projectNameImfine) {
            this.projectNameImfine.addEventListener('blur', () => {
                this.updateProjectName(this.projectNameImfine.textContent.trim());
            });
            this.projectNameImfine.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.projectNameImfine.blur();
                }
            });
        }

        // Initial render
        const mode = this.dataStore.getState().meta.mode;
        this.handleModeChange(mode);
    }

    handleModeChange(mode) {
        if (mode === 'HARDWARE_LIST') {
            this.canvasContainer.classList.add('hidden');
            this.hardwareListView.classList.remove('hidden');
            this.updateProjectNameDisplay();
            this.renderTable();
        } else {
            this.canvasContainer.classList.remove('hidden');
            this.hardwareListView.classList.add('hidden');
        }
    }

    updateProjectNameDisplay() {
        const projectName = this.dataStore.getState().meta.projectName || 'The First Look 2026';
        if (this.projectNameLocal) {
            this.projectNameLocal.textContent = projectName;
        }
        if (this.projectNameImfine) {
            this.projectNameImfine.textContent = projectName;
        }
    }

    updateProjectName(newName) {
        if (!newName || newName.trim() === '') {
            newName = 'The First Look 2026';
        }
        this.dataStore.updateMeta({ projectName: newName.trim() });
        // Sync both fields
        if (this.projectNameLocal && this.projectNameLocal.textContent.trim() !== newName) {
            this.projectNameLocal.textContent = newName;
        }
        if (this.projectNameImfine && this.projectNameImfine.textContent.trim() !== newName) {
            this.projectNameImfine.textContent = newName;
        }
    }

    renderTable() {
        const data = this.dataStore.getState();
        const nodes = data.nodes || {};
        const connections = data.connections || {};
        const metadata = data.meta.hardwareListMetadata || {};
        const sidebarHardwareList = data.meta.hardwareList || []; // Get sidebar hardware list order

        // Count hardware items (devices and cables)
        const hardwareMap = new Map();

        // Count devices
        Object.values(nodes).forEach(node => {
            const key = `${node.type}|${node.model || ''}`;
            if (hardwareMap.has(key)) {
                hardwareMap.get(key).count += 1;
            } else {
                hardwareMap.set(key, {
                    type: node.type,
                    model: node.model || '',
                    category: node.category || 'Device',
                    count: 1
                });
            }
        });

        // Count cables (connections) - exclude Wireless
        Object.values(connections).forEach(conn => {
            const cableType = conn.type || '';
            // Skip Wireless cables
            if (cableType.toLowerCase() === 'wireless') {
                return;
            }
            
            const key = `Cable|${cableType || conn.model || ''}`;
            if (hardwareMap.has(key)) {
                hardwareMap.get(key).count += 1;
            } else {
                hardwareMap.set(key, {
                    type: cableType || 'Cable',
                    model: conn.model || '',
                    category: 'Cable',
                    count: 1
                });
            }
        });

        // Sort hardware list according to sidebar hardware list order
        // Create a map for quick lookup of sidebar order
        const sidebarOrderMap = new Map();
        sidebarHardwareList.forEach((item, index) => {
            const key = `${item.type}|${item.model || ''}`;
            sidebarOrderMap.set(key, index);
        });

        // Convert to array and sort by sidebar order
        const hardwareList = Array.from(hardwareMap.values()).sort((a, b) => {
            const keyA = `${a.type}|${a.model || ''}`;
            const keyB = `${b.type}|${b.model || ''}`;
            const orderA = sidebarOrderMap.has(keyA) ? sidebarOrderMap.get(keyA) : Infinity;
            const orderB = sidebarOrderMap.has(keyB) ? sidebarOrderMap.get(keyB) : Infinity;
            
            // If both are in sidebar, use sidebar order
            if (orderA !== Infinity && orderB !== Infinity) {
                return orderA - orderB;
            }
            // If only one is in sidebar, prioritize it
            if (orderA !== Infinity) return -1;
            if (orderB !== Infinity) return 1;
            // If neither is in sidebar, maintain category order (Devices first, then Cables)
            if (a.category !== b.category) {
                return a.category === 'Device' ? -1 : 1;
            }
            // Then sort by type
            return a.type.localeCompare(b.type);
        });

        // Separate into I M FINE and Local lists based on metadata
        const imfineList = [];
        const localList = [];

        hardwareList.forEach(item => {
            const itemKey = `${item.type}|${item.model}`;
            const itemMetadata = metadata[itemKey] || {};
            // Default to Local if not checked
            if (itemMetadata.isImfine === true) {
                imfineList.push(item);
            } else {
                localList.push(item);
            }
        });

        // Clear table bodies
        this.tableBodyImfine.innerHTML = '';
        this.tableBodyLocal.innerHTML = '';

        // Render I M FINE table
        if (imfineList.length > 0) {
            const totalRows = imfineList.length; // Only data rows, no empty rows
            imfineList.forEach((item, index) => {
                const row = this.createTableRow(item, index, metadata, 'imfine', index === 0 ? totalRows : 0);
                this.tableBodyImfine.appendChild(row);
            });
            // Don't add empty rows - only show actual hardware items
        }
        // If no items, don't add any rows (just header)

        // Render Local table
        if (localList.length > 0) {
            const totalRows = localList.length; // Only data rows, no empty rows
            localList.forEach((item, index) => {
                const row = this.createTableRow(item, index, metadata, 'local', index === 0 ? totalRows : 0);
                this.tableBodyLocal.appendChild(row);
            });
            // Don't add empty rows - only show actual hardware items
        }
        // If no items, don't add any rows (just header)
    }

    createTableRow(item, index, metadata, tableType, rowspan = 0) {
        const row = document.createElement('tr');
        // Different colors for each table
        if (tableType === 'imfine') {
            // I M FINE: white and pink
            row.className = index % 2 === 0 ? 'bg-white' : 'bg-red-50';
        } else {
            // Local: white and sky blue
            row.className = index % 2 === 0 ? 'bg-white' : 'bg-sky-50';
        }
        
        const itemKey = `${item.type}|${item.model}`;
        const itemMetadata = metadata[itemKey] || {};

        // Check if model contains TBU (case insensitive)
        const modelText = item.model || '';
        const hasTBU = modelText.toUpperCase().includes('TBU');
        const modelDisplay = modelText || '-';

        // R&R cell: merged if rowspan > 0, otherwise empty
        const rrCell = rowspan > 0 ? 
            `<td class="border border-gray-300 px-4 py-2 bg-gray-100 text-center align-middle" rowspan="${rowspan}">
                <span>${tableType === 'imfine' ? 'I M FINE' : 'Local'}</span>
            </td>` : 
            '';

        row.innerHTML = `
            <td class="border border-gray-300 px-4 py-2 text-center relative">
                <input type="checkbox" 
                    class="custom-checkbox absolute left-0 top-1/2 -translate-y-1/2 cursor-pointer" 
                    data-key="${itemKey}"
                    ${tableType === 'imfine' ? 'checked' : ''}
                    onchange="window.app.hardwareListManager.toggleImfine(event)">
                <span>${item.type}</span>
            </td>
            <td class="border border-gray-300 px-4 py-2 text-center">
                ${hasTBU ? `<span class="text-red-600">${modelDisplay}</span>` : `<span>${modelDisplay}</span>`}
            </td>
            <td class="border border-gray-300 px-4 py-2 text-center">${item.count}</td>
            ${rrCell}
            <td class="border border-gray-300 px-4 py-2 text-center">
                <input type="text" 
                    class="w-full border-none outline-none bg-transparent text-center" 
                    data-key="${itemKey}"
                    data-field="remark"
                    value="${itemMetadata.remark || ''}"
                    placeholder="">
            </td>
        `;

        // Add event listeners for input changes
        const inputs = row.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.updateMetadata(e.target.dataset.key, e.target.dataset.field, e.target.value);
            });
        });

        return row;
    }

    addEmptyRows(tableBody, startIndex, tableType) {
        // Add empty rows for spacing (5-6 rows)
        // R&R column is already merged in the first data row, so we don't add it here
        for (let i = 0; i < 6; i++) {
            const emptyRow = document.createElement('tr');
            // Different colors for each table
            if (tableType === 'imfine') {
                // I M FINE: white and pink
                emptyRow.className = (startIndex + i) % 2 === 0 ? 'bg-white' : 'bg-red-50';
            } else {
                // Local: white and sky blue
                emptyRow.className = (startIndex + i) % 2 === 0 ? 'bg-white' : 'bg-sky-50';
            }
            
            // R&R column is merged, so we only have 4 columns here
            emptyRow.innerHTML = `
                <td class="border border-gray-300 px-4 py-2"></td>
                <td class="border border-gray-300 px-4 py-2"></td>
                <td class="border border-gray-300 px-4 py-2"></td>
                <td class="border border-gray-300 px-4 py-2"></td>
            `;
            tableBody.appendChild(emptyRow);
        }
    }

    toggleImfine(event) {
        const checkbox = event.target;
        const itemKey = checkbox.dataset.key;
        const isChecked = checkbox.checked;

        const metadata = this.dataStore.getState().meta.hardwareListMetadata || {};
        if (!metadata[itemKey]) {
            metadata[itemKey] = {};
        }
        metadata[itemKey].isImfine = isChecked;
        this.dataStore.updateMeta({ hardwareListMetadata: metadata });

        // Re-render table to move item between tables
        this.renderTable();
    }

    updateMetadata(itemKey, field, value) {
        const metadata = this.dataStore.getState().meta.hardwareListMetadata || {};
        if (!metadata[itemKey]) {
            metadata[itemKey] = {};
        }
        metadata[itemKey][field] = value;
        this.dataStore.updateMeta({ hardwareListMetadata: metadata });
    }

    copyTable(tableType) {
        const table = tableType === 'imfine' ? this.tableImfine : this.tableLocal;
        if (!table) return;

        // Clone the table to preserve formatting
        const tableClone = table.cloneNode(true);
        
        // Remove checkboxes from cloned table (they shouldn't be copied)
        const checkboxes = tableClone.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            // Remove checkbox but keep its parent cell structure
            const parentCell = checkbox.parentElement;
            if (parentCell) {
                // Find the span element that contains the hardware type text
                const textSpan = parentCell.querySelector('span');
                if (textSpan) {
                    // Keep only the text span, remove the checkbox
                    const textContent = textSpan.textContent.trim();
                    parentCell.innerHTML = `<span>${textContent}</span>`;
                } else {
                    // If no span found, just remove the checkbox and keep other content
                    checkbox.remove();
                }
            }
        });
        
        // Apply enhanced styling for better copy appearance (PPT-friendly)
        // PowerPoint often scales down HTML font sizes significantly
        // Current: 72pt → 22pt in PPT, 36pt → 11pt in PPT (about 3.27x reduction)
        // Target: ~16-17pt in PPT, so we need ~54pt (16.5 × 3.27 ≈ 54pt)
        tableClone.style.width = '100%';
        tableClone.style.borderCollapse = 'collapse';
        tableClone.style.fontSize = '54pt'; // Base font size for PPT scaling
        
        // Style all cells with better padding and height
        const allCells = tableClone.querySelectorAll('th, td');
        allCells.forEach(cell => {
            const computedStyle = window.getComputedStyle(cell);
            cell.style.padding = '20px 16px'; // Much larger padding
            cell.style.height = 'auto';
            cell.style.minHeight = '60px'; // Much larger minimum height
            cell.style.verticalAlign = 'middle';
            cell.style.border = computedStyle.border || '1px solid #d1d5db';
            cell.style.fontSize = '54pt'; // Font size - PPT will scale down to ~16-17pt
            cell.style.lineHeight = '1.8'; // More line spacing
        });
        
        // Style header rows (Hardware, Model, EA, etc.) - keep bold
        const headerRows = tableClone.querySelectorAll('thead tr');
        headerRows.forEach(row => {
            const cells = row.querySelectorAll('th');
            cells.forEach(cell => {
                cell.style.padding = '24px 16px'; // Much larger padding for headers
                cell.style.minHeight = '70px'; // Much larger minimum height
                cell.style.fontWeight = 'bold'; // Keep bold for headers
                cell.style.fontSize = '54pt'; // Font size - PPT will scale down to ~16-17pt
            });
        });
        
        // Style data rows - remove bold, use regular weight
        const dataRows = tableClone.querySelectorAll('tbody tr');
        dataRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                cell.style.padding = '20px 16px';
                cell.style.minHeight = '60px';
                cell.style.fontSize = '54pt'; // Font size - PPT will scale down to ~16-17pt
                cell.style.fontWeight = 'normal'; // Regular weight (not bold)
                
                // Remove font-bold class from cell and all child elements
                cell.classList.remove('font-bold');
                const childElements = cell.querySelectorAll('*');
                childElements.forEach(child => {
                    // Remove font-bold class
                    child.classList.remove('font-bold');
                    // Force normal weight with !important equivalent (using setProperty)
                    child.style.setProperty('font-weight', 'normal', 'important');
                    child.style.setProperty('font-style', 'normal', 'important');
                });
                
                // Force normal weight on the cell itself with high priority
                cell.style.setProperty('font-weight', 'normal', 'important');
            });
        });
        
        // Update input values in cloned table to match current values
        const originalInputs = table.querySelectorAll('input[type="text"]');
        const clonedInputs = tableClone.querySelectorAll('input[type="text"]');
        originalInputs.forEach((original, index) => {
            if (clonedInputs[index]) {
                clonedInputs[index].value = original.value;
                // Replace input with its value wrapped in a span to preserve formatting
                const span = document.createElement('span');
                span.textContent = original.value || '';
                span.style.cssText = window.getComputedStyle(original).cssText;
                span.style.padding = '0';
                span.style.display = 'inline-block';
                span.style.fontSize = '54pt'; // Font size - PPT will scale down to ~16-17pt
                span.style.fontWeight = 'normal'; // Regular weight (not bold)
                clonedInputs[index].parentNode.replaceChild(span, clonedInputs[index]);
            }
        });

        // Replace checkboxes with their checked state
        const originalCheckboxes = table.querySelectorAll('input[type="checkbox"]');
        const clonedCheckboxes = tableClone.querySelectorAll('input[type="checkbox"]');
        originalCheckboxes.forEach((original, index) => {
            if (clonedCheckboxes[index]) {
                const span = document.createElement('span');
                span.textContent = original.checked ? '✓' : '';
                span.style.fontSize = '16px';
                clonedCheckboxes[index].parentNode.replaceChild(span, clonedCheckboxes[index]);
            }
        });

        // Create a temporary container with the cloned table
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        tempContainer.appendChild(tableClone);
        document.body.appendChild(tempContainer);

        // Select the table
        const range = document.createRange();
        range.selectNodeContents(tableClone);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // Copy using execCommand (preserves formatting)
        try {
            const success = document.execCommand('copy');
            if (success) {
                // Show feedback
                const button = tableType === 'imfine' ? this.btnCopyImfine : this.btnCopyLocal;
                const originalHTML = button.innerHTML;
                button.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i> Copied!';
                button.classList.add('bg-green-100', 'text-green-700');
                button.classList.remove('bg-slate-100', 'text-slate-700');
                
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.classList.remove('bg-green-100', 'text-green-700');
                    button.classList.add('bg-slate-100', 'text-slate-700');
                    // Refresh icons
                    if (window.lucide) window.lucide.createIcons();
                }, 2000);
            } else {
                throw new Error('execCommand failed');
            }
        } catch (err) {
            console.error('Failed to copy:', err);
            // Fallback: try clipboard API with HTML
            const htmlContent = tableClone.outerHTML;
            const textContent = this.getTableTextContent(table);
            
            navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([htmlContent], { type: 'text/html' }),
                    'text/plain': new Blob([textContent], { type: 'text/plain' })
                })
            ]).then(() => {
                const button = tableType === 'imfine' ? this.btnCopyImfine : this.btnCopyLocal;
                const originalHTML = button.innerHTML;
                button.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i> Copied!';
                button.classList.add('bg-green-100', 'text-green-700');
                button.classList.remove('bg-slate-100', 'text-slate-700');
                
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.classList.remove('bg-green-100', 'text-green-700');
                    button.classList.add('bg-slate-100', 'text-slate-700');
                    if (window.lucide) window.lucide.createIcons();
                }, 2000);
            }).catch(fallbackErr => {
                console.error('Clipboard API also failed:', fallbackErr);
                alert('Failed to copy table. Please try selecting and copying manually.');
            });
        } finally {
            // Clean up
            selection.removeAllRanges();
            document.body.removeChild(tempContainer);
        }
    }

    getTableTextContent(table) {
        // Fallback text content for clipboard
        let text = '';
        
        const projectName = this.dataStore.getState().meta.projectName || 'The First Look 2026';
        const suffix = table === this.tableImfine ? 'I M Fine' : 'Local';
        text += `${projectName} - ${suffix}\n`;
        
        const headerRow = table.querySelector('thead tr:last-child');
        if (headerRow) {
            const headers = Array.from(headerRow.querySelectorAll('th'));
            text += headers.map(th => th.textContent.trim()).join('\t') + '\n';
        }
        
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length > 0) {
                const rowText = cells.map(cell => {
                    const input = cell.querySelector('input[type="text"]');
                    const checkbox = cell.querySelector('input[type="checkbox"]');
                    if (input) {
                        return input.value || '';
                    } else if (checkbox) {
                        return checkbox.checked ? '✓' : '';
                    } else {
                        return cell.textContent.trim();
                    }
                }).join('\t');
                if (rowText.trim()) {
                    text += rowText + '\n';
                }
            }
        });
        
        return text;
    }
}

