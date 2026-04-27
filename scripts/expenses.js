/**
 * Expense Management Module
 * Handles all expense-related operations and UI rendering
 */

class ExpenseManager {
  constructor() {
    this.currentFilter = {
      category: 'all',
      year: 'all',
      quarter: 'all',
      dateFrom: '',
      dateTo: '',
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

      const expenseDate = new Date(expense.datePaid);

      // Custom date range filter (takes priority)
      if (this.currentFilter.dateFrom && this.currentFilter.dateTo) {
        const fromDate = new Date(this.currentFilter.dateFrom);
        const toDate = new Date(this.currentFilter.dateTo);
        // Set time to start/end of day for inclusive range
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);

        if (expenseDate < fromDate || expenseDate > toDate) {
          return false;
        }
      }
      // Year filter
      else if (this.currentFilter.year !== 'all') {
        const year = parseInt(this.currentFilter.year);
        if (expenseDate.getFullYear() !== year) {
          return false;
        }

        // Quarter filter (only applies if year is selected)
        if (this.currentFilter.quarter !== 'all') {
          const quarter = parseInt(this.currentFilter.quarter);
          const expenseQuarter = Math.floor(expenseDate.getMonth() / 3) + 1;
          if (expenseQuarter !== quarter) {
            return false;
          }
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

    // Load receipts - DIRECTLY display without using global receipt manager state
    const galleryContainer = document.getElementById(`receipt-gallery-${expense.id}`);

    if (expense.receiptFiles && expense.receiptFiles.length > 0) {
      // Display receipts directly without polluting receiptManager state
      galleryContainer.innerHTML = expense.receiptFiles.map((file, index) => {
        const isImage = file.type.startsWith('image/');
        const isPDF = file.type === 'application/pdf';

        return `
          <div class="receipt-item" style="display: inline-block; margin: 10px; position: relative;">
            ${isImage ? `
              <img src="${file.data}" alt="${file.name}" 
                   style="max-width: 200px; max-height: 200px; cursor: pointer; border: 1px solid var(--glass-border); border-radius: 8px;"
                   onclick="receiptManager.viewReceipt('${file.data}', '${file.name}')">
            ` : isPDF ? `
              <div style="width: 200px; height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; 
                          border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; background: var(--color-bg-tertiary);"
                   onclick="receiptManager.viewReceipt('${file.data}', '${file.name}')">
                <div style="font-size: 48px;">📄</div>
                <div style="font-size: 12px; margin-top: 8px; text-align: center; padding: 0 10px; word-break: break-word;">${file.name}</div>
              </div>
            ` : ''}
            <div style="margin-top: 5px; font-size: 12px; text-align: center; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${file.name}
            </div>
          </div>
        `;
      }).join('');
    } else {
      galleryContainer.innerHTML = '<p class="text-muted">No receipts attached</p>';
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

  /**
   * Calculate summary for currently filtered expenses
   */
  async getSummary() {
    const allExpenses = await db.getAllExpenses();
    const filtered = this.sortExpenses(this.filterExpenses(allExpenses));

    const summary = {
      count: filtered.length,
      totalExpenses: filtered.reduce((sum, exp) => sum + exp.expenseAmount, 0),
      totalDeductible: filtered.reduce((sum, exp) => sum + exp.deductible, 0),
      averageWorkPercentage: filtered.length > 0
        ? filtered.reduce((sum, exp) => sum + exp.percentUsedForWork, 0) / filtered.length
        : 0
    };

    return { filtered, summary };
  }

  /**
   * Export filtered expenses to CSV
   */
  async exportFilteredCSV() {
    try {
      const { filtered, summary } = await this.getSummary();

      if (filtered.length === 0) {
        alert('No expenses to export with current filters');
        return;
      }

      // Create CSV content
      let csv = 'Date,Merchant,Description,Category,Amount,% Work,Deductible,Notes\n';

      filtered.forEach(expense => {
        const row = [
          this.formatDate(expense.datePaid),
          `"${expense.merchant}"`,
          `"${expense.expenseDetails}"`,
          expense.expenseCategory,
          expense.expenseAmount.toFixed(2),
          expense.percentUsedForWork,
          expense.deductible.toFixed(2),
          `"${expense.notes || ''}"`
        ].join(',');
        csv += row + '\n';
      });

      // Add summary
      csv += '\nSUMMARY\n';
      csv += `Total Expenses,${summary.totalExpenses.toFixed(2)}\n`;
      csv += `Total Deductible,${summary.totalDeductible.toFixed(2)}\n`;
      csv += `Count,${summary.count}\n`;
      csv += `Average Work %,${summary.averageWorkPercentage.toFixed(1)}%\n`;

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showToast('CSV exported successfully', 'success');
    } catch (error) {
      console.error('CSV export error:', error);
      alert('Failed to export CSV: ' + error.message);
    }
  }

  /**
   * Export filtered expenses to PDF
   */
  async exportFilteredPDF() {
    try {
      const { filtered, summary } = await this.getSummary();

      if (filtered.length === 0) {
        alert('No expenses to export with current filters');
        return;
      }

      // Check if jsPDF is loaded
      if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
        alert('PDF library not loaded. Please refresh the page.');
        return;
      }

      const { jsPDF } = jspdf;
      const doc = new jsPDF();

      // Title
      doc.setFontSize(18);
      doc.text('Expense Report', 14, 20);

      // Filter info
      doc.setFontSize(10);
      let yPos = 30;

      if (this.currentFilter.year !== 'all') {
        doc.text(`Year: ${this.currentFilter.year}`, 14, yPos);
        yPos += 5;
      }
      if (this.currentFilter.quarter !== 'all') {
        doc.text(`Quarter: Q${this.currentFilter.quarter}`, 14, yPos);
        yPos += 5;
      }
      if (this.currentFilter.dateFrom && this.currentFilter.dateTo) {
        doc.text(`Date Range: ${this.currentFilter.dateFrom} to ${this.currentFilter.dateTo}`, 14, yPos);
        yPos += 5;
      }
      if (this.currentFilter.category !== 'all') {
        doc.text(`Category: ${this.currentFilter.category}`, 14, yPos);
        yPos += 5;
      }

      yPos += 10;

      // Summary box
      doc.setFillColor(240, 240, 240);
      doc.rect(14, yPos, 180, 30, 'F');
      doc.setFontSize(12);
      doc.text('SUMMARY', 16, yPos + 7);
      doc.setFontSize(10);
      doc.text(`Total Expenses: $${summary.totalExpenses.toFixed(2)}`, 16, yPos + 14);
      doc.text(`Total Deductible: $${summary.totalDeductible.toFixed(2)}`, 16, yPos + 21);
      doc.text(`Count: ${summary.count}`, 110, yPos + 14);
      doc.text(`Avg Work %: ${summary.averageWorkPercentage.toFixed(1)}%`, 110, yPos + 21);

      yPos += 40;

      // Table header
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Date', 14, yPos);
      doc.text('Merchant', 35, yPos);
      doc.text('Category', 75, yPos);
      doc.text('Amount', 115, yPos);
      doc.text('Work %', 140, yPos);
      doc.text('Deductible', 165, yPos);

      yPos += 5;
      doc.setFont(undefined, 'normal');

      // Table rows
      filtered.forEach(expense => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        doc.text(this.formatDate(expense.datePaid), 14, yPos);
        doc.text(expense.merchant.substring(0, 20), 35, yPos);
        doc.text(expense.expenseCategory.substring(0, 15), 75, yPos);
        doc.text(`$${expense.expenseAmount.toFixed(2)}`, 115, yPos);
        doc.text(`${expense.percentUsedForWork}%`, 140, yPos);
        doc.text(`$${expense.deductible.toFixed(2)}`, 165, yPos);

        yPos += 7;
      });

      // Check if receipts should be included
      const includeReceipts = document.getElementById('include-receipts-pdf');
      if (includeReceipts && includeReceipts.checked) {
        // Collect all expenses with receipts
        const expensesWithReceipts = filtered.filter(exp =>
          exp.receiptFiles && exp.receiptFiles.length > 0
        );

        if (expensesWithReceipts.length > 0) {
          // Add new page for receipts appendix
          doc.addPage();
          yPos = 20;

          // Receipts appendix title
          doc.setFontSize(16);
          doc.setFont(undefined, 'bold');
          doc.text('RECEIPTS APPENDIX', 14, yPos);
          yPos += 10;
          doc.setFont(undefined, 'normal');

          const pdfReceiptsList = [];

          // Process each expense with receipts
          for (const expense of expensesWithReceipts) {
            // Add expense header
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');

            // Check if we need a new page
            if (yPos > 260) {
              doc.addPage();
              yPos = 20;
            }

            doc.text(`Expense: ${expense.merchant}`, 14, yPos);
            yPos += 6;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Date: ${this.formatDate(expense.datePaid)}  |  Amount: $${expense.expenseAmount.toFixed(2)}  |  Deductible: $${expense.deductible.toFixed(2)}`, 14, yPos);
            yPos += 8;

            // Process receipts for this expense
            for (const receipt of expense.receiptFiles) {
              if (receipt.type.startsWith('image/')) {
                // Embed image receipt
                try {
                  // Check if we need a new page for the image
                  if (yPos > 200) {
                    doc.addPage();
                    yPos = 20;
                  }

                  // Calculate image dimensions to fit on page
                  const img = new Image();
                  img.src = receipt.data;

                  // Wait for image to load to get dimensions
                  await new Promise((resolve) => {
                    img.onload = resolve;
                    // Fallback in case image is already loaded
                    if (img.complete) resolve();
                  });

                  const maxWidth = 180;
                  const maxHeight = 200;
                  const imgWidth = img.width;
                  const imgHeight = img.height;

                  let finalWidth = maxWidth;
                  let finalHeight = (imgHeight * maxWidth) / imgWidth;

                  if (finalHeight > maxHeight) {
                    finalHeight = maxHeight;
                    finalWidth = (imgWidth * maxHeight) / imgHeight;
                  }

                  doc.addImage(receipt.data, 'JPEG', 14, yPos, finalWidth, finalHeight);
                  yPos += finalHeight + 5;

                  // Add filename
                  doc.setFontSize(8);
                  doc.text(`File: ${receipt.name}`, 14, yPos);
                  yPos += 10;
                  doc.setFontSize(10);

                } catch (error) {
                  console.error('Error adding image to PDF:', error);
                  doc.text(`[Image: ${receipt.name} - Failed to embed]`, 14, yPos);
                  yPos += 6;
                }
              } else if (receipt.type === 'application/pdf') {
                // Add to PDF receipts list
                pdfReceiptsList.push({
                  expense: expense.merchant,
                  date: this.formatDate(expense.datePaid),
                  filename: receipt.name
                });
              }
            }

            yPos += 5; // Space between expenses
          }

          // Add PDF receipts index if any
          if (pdfReceiptsList.length > 0) {
            // Check if we need a new page
            if (yPos > 240) {
              doc.addPage();
              yPos = 20;
            }

            yPos += 10;
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('PDF RECEIPTS INDEX', 14, yPos);
            yPos += 8;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text('The following PDF receipts are not embedded. Please refer to original files or Google Drive backup:', 14, yPos);
            yPos += 10;

            pdfReceiptsList.forEach(item => {
              if (yPos > 270) {
                doc.addPage();
                yPos = 20;
              }

              doc.setFont(undefined, 'bold');
              doc.text(`• ${item.filename}`, 14, yPos);
              doc.setFont(undefined, 'normal');
              yPos += 5;
              doc.text(`  Expense: ${item.expense} (${item.date})`, 14, yPos);
              yPos += 7;
            });
          }
        }
      }

      // Save
      doc.save(`expenses-${new Date().toISOString().split('T')[0]}.pdf`);
      this.showToast('PDF exported successfully', 'success');
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF: ' + error.message);
    }
  }

  /**
   * Print filtered expenses
   */
  async printFilteredExpenses() {
    try {
      const { filtered, summary } = await this.getSummary();

      if (filtered.length === 0) {
        alert('No expenses to print with current filters');
        return;
      }

      // Create print window content
      let printContent = `
        <html>
        <head>
          <title>Expense Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; }
            .summary { background: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .summary h2 { margin-top: 0; }
            .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #333; color: white; }
            .text-right { text-align: right; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Expense Report</h1>
          
          <div class="summary">
            <h2>Summary</h2>
            <div class="summary-grid">
              <div><strong>Total Expenses:</strong> $${summary.totalExpenses.toFixed(2)}</div>
              <div><strong>Total Deductible:</strong> $${summary.totalDeductible.toFixed(2)}</div>
              <div><strong>Count:</strong> ${summary.count}</div>
              <div><strong>Avg Work %:</strong> ${summary.averageWorkPercentage.toFixed(1)}%</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Description</th>
                <th>Category</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Work %</th>
                <th class="text-right">Deductible</th>
              </tr>
            </thead>
            <tbody>
      `;

      filtered.forEach(expense => {
        printContent += `
          <tr>
            <td>${this.formatDate(expense.datePaid)}</td>
            <td>${this.escapeHtml(expense.merchant)}</td>
            <td>${this.escapeHtml(expense.expenseDetails)}</td>
            <td>${this.escapeHtml(expense.expenseCategory)}</td>
            <td class="text-right">$${expense.expenseAmount.toFixed(2)}</td>
            <td class="text-right">${expense.percentUsedForWork}%</td>
            <td class="text-right">$${expense.deductible.toFixed(2)}</td>
          </tr>
        `;
      });

      printContent += `
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Open print dialog
      const printWindow = window.open('', '', 'width=800,height=600');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();

      this.showToast('Opening print dialog...', 'info');
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to print: ' + error.message);
    }
  }
}

// Create a singleton instance
const expenseManager = new ExpenseManager();

// Export
window.expenseManager = expenseManager;
