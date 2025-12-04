/**
 * Receipt Management Module
 * Handles file uploads, storage, and display of receipts
 */

class ReceiptManager {
    constructor() {
        this.selectedFiles = [];
        this.existingReceipts = [];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    }

    /**
     * Initialize file upload handlers
     */
    initializeUploadZone(zoneId = 'file-upload-zone') {
        const zone = document.getElementById(zoneId);

        if (!zone) return;

        const fileInput = document.getElementById('receipt-files');

        // Click to upload
        zone.addEventListener('click', () => {
            fileInput.click();
        });

        // File selection
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag and drop
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files);
        });
    }

    /**
     * Handle file selection/drop
     */
    handleFiles(files) {
        Array.from(files).forEach(file => {
            // Validate file
            if (!this.validateFile(file)) {
                return;
            }

            // Read file
            this.readFile(file);
        });
    }

    /**
     * Validate file
     */
    validateFile(file) {
        // Check file type
        if (!this.allowedTypes.includes(file.type)) {
            alert(`File type not allowed: ${file.name}. Please upload images (JPEG, PNG, GIF) or PDF files.`);
            return false;
        }

        // Check file size
        if (file.size > this.maxFileSize) {
            alert(`File too large: ${file.name}. Maximum size is 10MB.`);
            return false;
        }

        return true;
    }

    /**
     * Read file and convert to base64
     */
    readFile(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            this.selectedFiles.push({
                name: file.name,
                type: file.type,
                size: file.size,
                data: e.target.result,
                uploadedAt: new Date().toISOString()
            });

            this.displaySelectedFiles();
        };

        reader.readAsDataURL(file);
    }

    /**
     * Display selected files preview
     */
    displaySelectedFiles() {
        const previewContainer = document.getElementById('file-preview-list');

        if (!previewContainer) return;

        previewContainer.innerHTML = this.selectedFiles.map((file, index) => {
            return this.renderFilePreview(file, index, false);
        }).join('');
    }

    /**
     * Display existing receipts
     */
    displayExistingReceipts() {
        const previewContainer = document.getElementById('existing-receipts-list');

        if (!previewContainer) return;

        if (this.existingReceipts.length === 0) {
            previewContainer.innerHTML = '<p class="text-muted">No existing receipts</p>';
            return;
        }

        previewContainer.innerHTML = this.existingReceipts.map((file, index) => {
            return this.renderFilePreview(file, index, true);
        }).join('');
    }

    /**
     * Render file preview
     */
    renderFilePreview(file, index, isExisting) {
        const isPdf = file.type === 'application/pdf';
        const listType = isExisting ? 'existing' : 'new';

        if (isPdf) {
            return `
        <div class="file-preview-item" data-index="${index}" data-type="${listType}">
          <div class="pdf-preview">
            <div class="pdf-icon">📄</div>
            <div class="pdf-name">${this.escapeHtml(file.name)}</div>
          </div>
          <button type="button" class="file-preview-remove" onclick="receiptManager.removeFile(${index}, ${isExisting})">
            ✕
          </button>
        </div>
      `;
        }

        return `
      <div class="file-preview-item" data-index="${index}" data-type="${listType}">
        <img src="${file.data}" alt="${this.escapeHtml(file.name)}" />
        <button type="button" class="file-preview-remove" onclick="receiptManager.removeFile(${index}, ${isExisting})">
          ✕
        </button>
      </div>
    `;
    }

    /**
     * Remove file from selection
     */
    removeFile(index, isExisting = false) {
        if (isExisting) {
            this.existingReceipts.splice(index, 1);
            this.displayExistingReceipts();
        } else {
            this.selectedFiles.splice(index, 1);
            this.displaySelectedFiles();
        }
    }

    /**
     * Get all receipts (existing + new)
     */
    getAllReceipts() {
        return [...this.existingReceipts, ...this.selectedFiles];
    }

    /**
     * Clear selected files
     */
    clearSelectedFiles() {
        this.selectedFiles = [];
        this.existingReceipts = [];

        const fileInput = document.getElementById('receipt-files');
        if (fileInput) {
            fileInput.value = '';
        }

        const previewContainer = document.getElementById('file-preview-list');
        if (previewContainer) {
            previewContainer.innerHTML = '';
        }

        const existingContainer = document.getElementById('existing-receipts-list');
        if (existingContainer) {
            existingContainer.innerHTML = '';
        }
    }

    /**
     * Display receipts in a gallery (for viewing)
     */
    displayReceipts(receipts, containerId) {
        const container = document.getElementById(containerId);

        if (!container) return;

        if (!receipts || receipts.length === 0) {
            container.innerHTML = '<p class="text-muted">No receipts attached</p>';
            return;
        }

        container.innerHTML = `
      <div class="receipt-gallery">
        ${receipts.map((receipt, index) => {
            return this.renderReceiptGalleryItem(receipt, index);
        }).join('')}
      </div>
    `;
    }

    /**
     * Render receipt gallery item
     */
    renderReceiptGalleryItem(receipt, index) {
        const isPdf = receipt.type === 'application/pdf';

        if (isPdf) {
            return `
        <div class="receipt-gallery-item">
          <a href="${receipt.data}" download="${receipt.name}" class="receipt-pdf-link">
            <div class="pdf-preview-large">
              <div class="pdf-icon-large">📄</div>
              <div class="pdf-name">${this.escapeHtml(receipt.name)}</div>
              <div class="pdf-size">${this.formatFileSize(receipt.size)}</div>
            </div>
          </a>
        </div>
      `;
        }

        return `
      <div class="receipt-gallery-item">
        <img src="${receipt.data}" alt="${this.escapeHtml(receipt.name)}" 
             onclick="receiptManager.viewFullReceipt('${receipt.data}', '${this.escapeHtml(receipt.name)}')" />
        <div class="receipt-info">
          <span class="receipt-name">${this.escapeHtml(receipt.name)}</span>
          <a href="${receipt.data}" download="${receipt.name}" class="btn btn-sm btn-secondary">
            Download
          </a>
        </div>
      </div>
    `;
    }

    /**
     * View full receipt in modal
     */
    viewFullReceipt(dataUrl, name) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
      <div class="modal" style="max-width: 90%; max-height: 95vh;">
        <div class="modal-header">
          <h2 class="modal-title">${this.escapeHtml(name)}</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="padding: 0; max-height: 80vh; overflow: auto;">
          <img src="${dataUrl}" alt="${this.escapeHtml(name)}" style="width: 100%; height: auto;" />
        </div>
        <div class="modal-footer">
          <a href="${dataUrl}" download="${name}" class="btn btn-primary">Download</a>
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
        </div>
      </div>
    `;

        document.body.appendChild(modal);

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Add CSS for receipt gallery
const style = document.createElement('style');
style.textContent = `
  .receipt-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }

  .receipt-gallery-item {
    border: 1px solid var(--glass-border);
    border-radius: var(--border-radius-md);
    overflow: hidden;
    background: var(--color-bg-tertiary);
    transition: all var(--transition-base);
  }

  .receipt-gallery-item:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
  }

  .receipt-gallery-item img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    cursor: pointer;
  }

  .receipt-info {
    padding: var(--spacing-sm);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .receipt-name {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pdf-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--spacing-md);
    text-align: center;
  }

  .pdf-icon {
    font-size: 48px;
    margin-bottom: var(--spacing-sm);
  }

  .pdf-name {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    word-break: break-word;
  }

  .pdf-preview-large {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
    min-height: 200px;
  }

  .pdf-icon-large {
    font-size: 64px;
    margin-bottom: var(--spacing-md);
  }

  .pdf-size {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--spacing-xs);
  }

  .receipt-pdf-link {
    text-decoration: none;
    color: inherit;
  }
`;
document.head.appendChild(style);

// Create a singleton instance
const receiptManager = new ReceiptManager();

// Export
window.receiptManager = receiptManager;
