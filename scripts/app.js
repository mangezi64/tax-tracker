/**
 * Main Application Controller
 * Handles navigation, initialization, and global app state
 */

class App {
    constructor() {
        this.currentView = 'dashboard';
        this.initialized = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        if (this.initialized) return;

        try {
            console.log('Starting app initialization...');

            // Show loading
            this.showLoading();

            // Initialize database
            console.log('Initializing database...');
            await db.init();
            console.log('Database initialized');

            // Initialize default categories
            console.log('Initializing categories...');
            await db.initializeDefaultCategories();
            console.log('Categories initialized');

            // Load categories into selects
            console.log('Loading categories into UI...');
            await this.loadCategories();

            // Initialize event listeners
            console.log('Setting up event listeners...');
            this.initializeEventListeners();

            // Initialize receipt upload zone
            console.log('Initializing receipt manager...');
            receiptManager.initializeUploadZone();

            // Load initial view (dashboard)
            console.log('Loading dashboard view...');
            await this.showView('dashboard');

            this.initialized = true;
            this.hideLoading();

            console.log('App initialized successfully!');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            console.error('Error stack:', error.stack);
            this.hideLoading();

            // Show user-friendly error
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--color-bg-secondary);
                border: 2px solid var(--color-danger);
                border-radius: var(--border-radius-lg);
                padding: var(--spacing-xl);
                max-width: 500px;
                z-index: 10000;
                text-align: center;
            `;
            errorMsg.innerHTML = `
                <h2 style="color: var(--color-danger); margin-bottom: 16px;">Initialization Error</h2>
                <p style="margin-bottom: 16px;">${error.message}</p>
                <p style="font-size: 14px; color: var(--color-text-muted); margin-bottom: 16px;">
                    Check the browser console (F12) for details.
                </p>
                <button onclick="location.reload()" class="btn btn-primary">
                    Reload Page
                </button>
            `;
            document.body.appendChild(errorMsg);
        }
    }

    /**
     * Initialize all event listeners
     */
    initializeEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                this.showView(view);
            });
        });

        // Add expense button
        const addExpenseBtn = document.getElementById('add-expense-btn');
        if (addExpenseBtn) {
            addExpenseBtn.addEventListener('click', () => this.openExpenseModal());
        }

        // Expense form submission
        const expenseForm = document.getElementById('expense-form');
        if (expenseForm) {
            expenseForm.addEventListener('submit', (e) => this.handleExpenseSubmit(e));
        }

        // Auto-calculate deductible
        const expenseAmount = document.getElementById('expense-amount');
        const percentUsed = document.getElementById('percent-used');
        const deductiblePreview = document.getElementById('deductible-preview');

        if (expenseAmount && percentUsed && deductiblePreview) {
            const updatePreview = () => {
                const amount = parseFloat(expenseAmount.value) || 0;
                const percent = parseFloat(percentUsed.value) || 0;
                const deductible = (amount * percent) / 100;
                deductiblePreview.textContent = `$${deductible.toFixed(2)}`;
            };

            expenseAmount.addEventListener('input', updatePreview);
            percentUsed.addEventListener('input', updatePreview);
        }

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeAllModals();
                }
            });
        });

        // Filter controls
        const categoryFilter = document.getElementById('filter-category');
        const dateFilter = document.getElementById('filter-date');
        const searchInput = document.getElementById('search-expenses');

        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                expenseManager.setFilter('category', e.target.value);
            });
        }

        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                expenseManager.setFilter('dateRange', e.target.value);
            });
        }

        if (searchInput) {
            // Debounced search
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    expenseManager.setFilter('searchTerm', e.target.value);
                }, 300);
            });
        }

        // Report quarter/year selectors
        const reportYear = document.getElementById('report-year');
        const reportQuarter = document.getElementById('report-quarter');
        const generateReportBtn = document.getElementById('generate-report-btn');

        if (generateReportBtn && reportYear && reportQuarter) {
            generateReportBtn.addEventListener('click', () => {
                const year = parseInt(reportYear.value);
                const quarter = parseInt(reportQuarter.value);
                reportManager.displayReport(year, quarter);
            });
        }

        // Export buttons
        const exportCsvBtn = document.getElementById('export-csv-btn');
        const exportPdfBtn = document.getElementById('export-pdf-btn');

        if (exportCsvBtn && reportYear && reportQuarter) {
            exportCsvBtn.addEventListener('click', () => {
                const year = parseInt(reportYear.value);
                const quarter = parseInt(reportQuarter.value);
                reportManager.exportCSV(year, quarter);
            });
        }

        if (exportPdfBtn && reportYear && reportQuarter) {
            exportPdfBtn.addEventListener('click', () => {
                const year = parseInt(reportYear.value);
                const quarter = parseInt(reportQuarter.value);
                reportManager.exportPDF(year, quarter);
            });
        }

        // Add category button
        const addCategoryBtn = document.getElementById('add-category-btn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => this.addCustomCategory());
        }

        // Quick export button
        const quickExportBtn = document.getElementById('quick-export-btn');
        if (quickExportBtn) {
            quickExportBtn.addEventListener('click', () => backupManager.exportData());
        }
    }

    /**
     * Show a specific view
     */
    async showView(viewName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === viewName) {
                link.classList.add('active');
            }
        });

        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
        });

        // Show requested view
        const view = document.getElementById(`${viewName}-view`);
        if (view) {
            view.style.display = 'block';
        }

        // Load view data
        switch (viewName) {
            case 'dashboard':
                await dashboardManager.refreshDashboard();
                break;
            case 'expenses':
                await expenseManager.renderExpenseTable();
                break;
            case 'reports':
                // Auto-select current quarter
                const reportYear = document.getElementById('report-year');
                const reportQuarter = document.getElementById('report-quarter');
                if (reportYear && reportQuarter) {
                    reportYear.value = new Date().getFullYear();
                    reportQuarter.value = Math.floor(new Date().getMonth() / 3) + 1;
                    await reportManager.displayReport(
                        parseInt(reportYear.value),
                        parseInt(reportQuarter.value)
                    );
                }
                break;
        }

        this.currentView = viewName;
    }

    /**
     * Open expense modal
     */
    openExpenseModal(expenseId = null) {
        const modal = document.getElementById('expense-modal');
        const form = document.getElementById('expense-form');
        const title = document.getElementById('expense-modal-title');

        // Reset form
        form.reset();
        document.getElementById('expense-id').value = '';
        receiptManager.clearSelectedFiles();

        // Set title
        title.textContent = expenseId ? 'Edit Expense' : 'Add New Expense';

        // Set default date to today
        const dateInput = document.getElementById('date-paid');
        if (dateInput && !expenseId) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Set default percent to 100
        const percentInput = document.getElementById('percent-used');
        if (percentInput && !expenseId) {
            percentInput.value = '100';
        }

        modal.classList.add('active');
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    /**
     * Handle expense form submission
     */
    async handleExpenseSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const expenseId = formData.get('expenseId');

        try {
            // Create expense object
            const expense = expenseManager.createExpenseFromForm(formData);

            // Add receipts
            expense.receiptFiles = receiptManager.getAllReceipts();

            // Validate
            const errors = expenseManager.validateExpense(expense);
            if (errors.length > 0) {
                alert('Please fix the following errors:\n\n' + errors.join('\n'));
                return;
            }

            // Save or update
            if (expenseId) {
                await db.updateExpense(parseInt(expenseId), expense);
                expenseManager.showToast('Expense updated successfully', 'success');
            } else {
                await db.addExpense(expense);
                expenseManager.showToast('Expense added successfully', 'success');
            }

            // Close modal
            this.closeAllModals();

            // Refresh views
            await expenseManager.renderExpenseTable();
            await dashboardManager.refreshDashboard();

        } catch (error) {
            console.error('Error saving expense:', error);
            alert('Failed to save expense. Please try again.');
        }
    }

    /**
     * Load categories into select dropdowns
     */
    async loadCategories() {
        const categories = await db.getAllCategories();

        // Update all category selects
        const selects = document.querySelectorAll('.category-select');
        selects.forEach(select => {
            select.innerHTML = categories
                .map(cat => `<option value="${cat.name}">${cat.icon} ${cat.name}</option>`)
                .join('');
        });

        // Update category filter (add "All" option)
        const filterSelect = document.getElementById('filter-category');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="all">All Categories</option>' +
                categories.map(cat => `<option value="${cat.name}">${cat.icon} ${cat.name}</option>`).join('');
        }
    }

    /**
     * Add custom category
     */
    async addCustomCategory() {
        const name = prompt('Enter category name:');

        if (!name || name.trim() === '') {
            return;
        }

        const icon = prompt('Enter category emoji icon (optional):', '📦');

        try {
            await db.addCategory({
                name: name.trim(),
                icon: icon || '📦',
                color: this.generateRandomColor()
            });

            await this.loadCategories();
            expenseManager.showToast('Category added successfully', 'success');
        } catch (error) {
            console.error('Error adding category:', error);
            alert('Failed to add category. It may already exist.');
        }
    }

    /**
     * Generate random color
     */
    generateRandomColor() {
        const colors = [
            '#4c9aff', '#ffab00', '#36b37e', '#ff5630',
            '#6554c0', '#00b8d9', '#ff8b00', '#00875a'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        const loading = document.getElementById('loading-overlay');
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const loading = document.getElementById('loading-overlay');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    /**
     * Populate year selector
     */
    populateYearSelector(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentYear = new Date().getFullYear();
        const years = [];

        for (let i = currentYear; i >= currentYear - 5; i--) {
            years.push(i);
        }

        select.innerHTML = years.map(year =>
            `<option value="${year}">${year}</option>`
        ).join('');
    }

    /**
     * Save Google Drive credentials
     */
    async saveGoogleCredentials() {
        const clientId = document.getElementById('google-client-id').value.trim();
        const apiKey = document.getElementById('google-api-key').value.trim();

        if (!clientId || !apiKey) {
            alert('Please enter both Client ID and API Key');
            return;
        }

        backupManager.setGoogleCredentials(clientId, apiKey);

        // Initialize Google Drive
        const success = await backupManager.initGoogleDrive();

        if (success) {
            // Show Google Drive actions
            document.getElementById('google-drive-actions').style.display = 'block';
            expenseManager.showToast('Google Drive configured successfully!', 'success');
        }
    }

    /**
     * Clear all data
     */
    async clearAllData() {
        const confirmed = confirm(
            '⚠️ WARNING: This will permanently delete ALL data:\n\n' +
            '- All expenses\n' +
            '- All receipts\n' +
            '- All custom categories\n' +
            '- All settings\n\n' +
            'This action CANNOT be undone!\n\n' +
            'Are you absolutely sure?'
        );

        if (!confirmed) return;

        const doubleCheck = confirm('This is your last chance. Delete everything?');
        if (!doubleCheck) return;

        try {
            this.showLoading();

            // Clear database
            await db.clearAllData();

            // Reinitialize defaults
            await db.initializeDefaultCategories();

            // Reload the app
            location.reload();
        } catch (error) {
            console.error('Error clearing data:', error);
            alert('Failed to clear data: ' + error.message);
            this.hideLoading();
        }
    }
}

// Create app instance
const app = new App();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Export
window.app = app;
