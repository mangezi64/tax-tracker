/**
 * Expense Management Module
 * Handles all expense-related operations and UI rendering
 */

class ExpenseManager {
  constructor() {
    this.currentFilter = {
      category: 'all',
      dateRange: 'all',
      searchTerm: ''
    };
    this.currentSort = {
      field: 'datePaid',
      order: 'desc'
    };
    this.currentExpenseId = null;
  }

  /**
   * Calculate deductible amount
   */
  calculateDeductible(expenseAmount, percentUsedForWork) {
    return (expenseAmount * percentUsedForWork) / 100;
  }

  /**
   * Validate expense data
   */
  validateExpense(expense) {
    const errors = [];

    if (!expense.datePaid) {
      errors.push('Date Paid is required');
    }

    if (!expense.merchant || expense.merchant.trim() === '') {
      errors.push('Merchant is required');
    }

    if (!expense.expenseDetails || expense.expenseDetails.trim() === '') {
      errors.push('Expense Details is required');
    }

    if (!expense.expenseCategory) {
      errors.push('Expense Category is required');
    }

    if (!expense.expenseAmount || expense.expenseAmount <= 0) {
      errors.push('Expense Amount must be greater than 0');
    }

    if (expense.percentUsedForWork === undefined ||
      expense.percentUsedForWork < 0 ||
      expense.percentUsedForWork > 100) {
      errors.push('% Used for Work must be between 0 and 100');
    }

    return errors;
  }

  /**
   * Create expense object from form data
   */
  createExpenseFromForm(formData) {
    const expenseAmount = parseFloat(formData.get('expenseAmount')) || 0;
    const percentUsedForWork = parseFloat(formData.get('percentUsedForWork')) || 0;

    return {
      datePaid: formData.get('datePaid'),
      merchant: formData.get('merchant'),
      expenseDetails: formData.get('expenseDetails'),
      expenseCategory: formData.get('expenseCategory'),
      expenseAmount: expenseAmount,
      percentUsedForWork: percentUsedForWork,
      deductible: this.calculateDeductible(expenseAmount, percentUsedForWork),
      notes: formData.get('notes') || '',
      receiptFiles: [] // Will be populated by receipt manager
    };
  }

  /**
   * Render expense table
   */
  async renderExpenseTable(containerId = 'expense-table-body') {
    const container = document.getElementById(containerId);

    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    try {
      let expenses = await db.getAllExpenses();

      // Apply filters
      expenses = this.filterExpenses(expenses);

      // Apply sorting
      expenses = this.sortExpenses(expenses);

      if (expenses.length === 0) {
        container.innerHTML = `
          <tr>
            <td colspan="9" class="text-center">
              <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <div class="empty-state-title">No expenses found</div>
                <div class="empty-state-text">Add your first expense to get started</div>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      container.innerHTML = expenses.map(expense => this.renderExpenseRow(expense)).join('');
    } catch (error) {
      console.error('Error rendering expense table:', error);
      container.innerHTML = `
        <tr>
          <td colspan="9" class="text-center text-danger">
            Error loading expenses. Please refresh the page.
          </td>
        </tr>
      `;
    }
  }

  /**
   * Render a single expense row
   */
  renderExpenseRow(expense) {
    const receiptCount = expense.receiptFiles ? expense.receiptFiles.length : 0;
    const receiptBadge = receiptCount > 0
      ? `<span class="badge badge-success" title="${receiptCount} receipt(s)">${receiptCount} 📎</span>`
      : `<span class="badge badge-warning" title="No receipts">0 📎</span>`;

    return `
      <tr data-expense-id="${expense.id}">
        <td>${this.formatDate(expense.datePaid)}</td>
        <td>${this.escapeHtml(expense.merchant)}</td>
        <td>${this.escapeHtml(expense.expenseDetails)}</td>
        <td><span class="badge badge-primary">${this.escapeHtml(expense.expenseCategory)}</span></td>
        <td class="text-right">$${this.formatCurrency(expense.expenseAmount)}</td>
        <td class="text-center">${expense.percentUsedForWork}%</td>
        <td class="text-right text-success">$${this.formatCurrency(expense.deductible)}</td>
        <td class="text-center">${receiptBadge}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-sm btn-secondary btn-icon" onclick="expenseManager.viewExpense(${expense.id})" title="View">
              👁️
            </button>
            <button class="btn btn-sm btn-primary btn-icon" onclick="expenseManager.editExpense(${expense.id})" title="Edit">
              ✏️
            </button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="expenseManager.deleteExpense(${expense.id})" title="Delete">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Filter expenses based on current filter settings
   */
  filterExpenses(expenses) {
    return expenses.filter(expense => {
      // Category filter
      if (this.currentFilter.category !== 'all' &&
        expense.expenseCategory !== this.currentFilter.category) {
        return false;
      }

      // Date range filter
      if (this.currentFilter.dateRange !== 'all') {
        const expenseDate = new Date(expense.datePaid);
        const now = new Date();

        switch (this.currentFilter.dateRange) {
          case 'this-month':
            if (expenseDate.getMonth() !== now.getMonth() ||
              expenseDate.getFullYear() !== now.getFullYear()) {
              return false;
            }
            break;
          case 'this-quarter':
            const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
            const expenseQuarter = Math.floor(expenseDate.getMonth() / 3) + 1;
            if (expenseQuarter !== currentQuarter ||
              expenseDate.getFullYear() !== now.getFullYear()) {
              return false;
            }
            break;
          case 'this-year':
            if (expenseDate.getFullYear() !== now.getFullYear()) {
              return false;
            }
            break;
        }
      }

      // Search filter
      if (this.currentFilter.searchTerm) {
        const searchLower = this.currentFilter.searchTerm.toLowerCase();
        const searchableText = [
          expense.merchant,
          expense.expenseDetails,
          expense.expenseCategory,
          expense.notes
        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort expenses based on current sort settings
   */
  sortExpenses(expenses) {
    return expenses.sort((a, b) => {
      let aVal = a[this.currentSort.field];
      let bVal = b[this.currentSort.field];

      // Handle date sorting
      if (this.currentSort.field === 'datePaid') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal < bVal) return this.currentSort.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.currentSort.order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Set filter and refresh table
   */
  setFilter(filterType, value) {
    this.currentFilter[filterType] = value;
    this.renderExpenseTable();
  }

  /**
   * Set sort and refresh table
   */
  setSort(field, order = 'desc') {
    this.currentSort = { field, order };
    this.renderExpenseTable();
  }

  /**
   * View expense details
   */
  async viewExpense(id) {
    this.currentExpenseId = id;
    const expense = await db.getExpense(id);

    if (!expense) {
      alert('Expense not found');
      return;
    }

    // Show in modal
    const modal = document.getElementById('view-expense-modal');
    const content = document.getElementById('view-expense-content');

    content.innerHTML = `
      <div class="expense-details">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date Paid</label>
            <p>${this.formatDate(expense.datePaid)}</p>
          </div>
          <div class="form-group">
            <label class="form-label">Merchant</label>
            <p>${this.escapeHtml(expense.merchant)}</p>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Expense Details</label>
          <p>${this.escapeHtml(expense.expenseDetails)}</p>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <p><span class="badge badge-primary">${this.escapeHtml(expense.expenseCategory)}</span></p>
          </div>
          <div class="form-group">
            <label class="form-label">Expense Amount</label>
            <p class="text-lg">$${this.formatCurrency(expense.expenseAmount)}</p>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">% Used for Work</label>
            <p>${expense.percentUsedForWork}%</p>
          </div>
          <div class="form-group">
            <label class="form-label">Deductible Amount</label>
            <p class="text-lg text-success">$${this.formatCurrency(expense.deductible)}</p>
          </div>
        </div>
        
        ${expense.notes ? `
          <div class="form-group">
            <label class="form-label">Notes</label>
            <p>${this.escapeHtml(expense.notes)}</p>
          </div>
        ` : ''}
        
        <div class="form-group">
          <label class="form-label">Receipts</label>
          <div id="receipt-gallery-${expense.id}"></div>
        </div>
      </div>
    `;

    modal.classList.add('active');

    // Load receipts
    if (expense.receiptFiles && expense.receiptFiles.length > 0) {
      receiptManager.displayReceipts(expense.receiptFiles, `receipt-gallery-${expense.id}`);
    } else {
      document.getElementById(`receipt-gallery-${expense.id}`).innerHTML =
        '<p class="text-muted">No receipts attached</p>';
    }
  }

  /**
   * Edit expense
   */
  async editExpense(id) {
    const expense = await db.getExpense(id);

    if (!expense) {
      alert('Expense not found');
      return;
    }

    // Populate form
    document.getElementById('expense-id').value = expense.id;
    document.getElementById('date-paid').value = expense.datePaid;
    document.getElementById('merchant').value = expense.merchant;
    document.getElementById('expense-details').value = expense.expenseDetails;
    document.getElementById('expense-category').value = expense.expenseCategory;
    document.getElementById('expense-amount').value = expense.expenseAmount;
    document.getElementById('percent-used').value = expense.percentUsedForWork;
    document.getElementById('notes').value = expense.notes || '';

    // Update modal title
    document.getElementById('expense-modal-title').textContent = 'Edit Expense';

    // Show existing receipts
    if (expense.receiptFiles) {
      receiptManager.existingReceipts = expense.receiptFiles;
      receiptManager.displayExistingReceipts();
    }

    // Show modal
    document.getElementById('expense-modal').classList.add('active');
  }

  /**
   * Delete expense
   */
  async deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
      return;
    }

    try {
      await db.deleteExpense(id);
      await this.renderExpenseTable();

      // Refresh dashboard if on that view
      if (typeof dashboardManager !== 'undefined') {
        await dashboardManager.refreshDashboard();
      }

      // Show success message
      this.showToast('Expense deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete expense. Please try again.');
    }
  }

  /**
   * Utility: Format date
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Utility: Format currency
   */
  formatCurrency(amount) {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Utility: Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Print current expense
   */
  printCurrentExpense() {
    if (!this.currentExpenseId) {
      alert('No expense selected for printing');
      return;
    }

    // Add print-mode class to modal
    const modal = document.getElementById('view-expense-modal');
    modal.classList.add('print-mode');

    // Trigger print dialog
    window.print();

    // Remove print-mode class after print dialog closes
    // Use setTimeout to ensure print dialog has opened first
    setTimeout(() => {
      modal.classList.remove('print-mode');
    }, 100);
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 16px 24px;
      background: var(--color-bg-tertiary);
      border: 1px solid var(--glass-border);
      border-radius: var(--border-radius-md);
      color: var(--color-text-primary);
      box-shadow: var(--shadow-lg);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Create a singleton instance
const expenseManager = new ExpenseManager();

// Export
window.expenseManager = expenseManager;
