/**
 * Reports Module
 * Generates quarterly reports for ZIMRA QPD submissions
 */

class ReportManager {
  constructor() {
    this.currentYear = new Date().getFullYear();
    this.currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  }

  /**
   * Generate quarterly report
   */
  async generateReport(year, quarter) {
    const stats = await db.getQuarterlyStats(year, quarter);

    return {
      year,
      quarter,
      ...stats,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Display report in UI
   */
  async displayReport(year, quarter) {
    const report = await this.generateReport(year, quarter);
    const container = document.getElementById('report-content');

    if (!container) return;

    if (report.expenses.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📄</div>
          <div class="empty-state-title">No expenses for Q${quarter} ${year}</div>
          <div class="empty-state-text">Add expenses for this period to generate a report</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.renderReportHTML(report);
  }

  /**
   * Render report HTML
   */
  renderReportHTML(report) {
    const quarterDates = this.getQuarterDates(report.year, report.quarter);

    return `
      <div class="report-header">
        <h2>ZIMRA QPD Quarterly Report</h2>
        <div class="report-meta">
          <div><strong>Period:</strong> Q${report.quarter} ${report.year} (${quarterDates.start} to ${quarterDates.end})</div>
          <div><strong>Generated:</strong> ${this.formatDateTime(report.generatedAt)}</div>
          <div><strong>Total Expenses:</strong> ${report.expenseCount}</div>
        </div>
      </div>

      <div class="report-summary">
        <h3>Summary</h3>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total Expenses</div>
            <div class="summary-value">$${this.formatCurrency(report.totalExpenses)}</div>
          </div>
          <div class="summary-card highlight">
            <div class="summary-label">Total Deductible</div>
            <div class="summary-value">$${this.formatCurrency(report.totalDeductible)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Deduction Rate</div>
            <div class="summary-value">${((report.totalDeductible / report.totalExpenses) * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div class="report-section">
        <h3>Breakdown by Category</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Category</th>
              <th class="text-right">Count</th>
              <th class="text-right">Total Amount</th>
              <th class="text-right">Total Deductible</th>
              <th class="text-right">% of Total</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(report.byCategory)
        .sort((a, b) => b[1].totalDeductible - a[1].totalDeductible)
        .map(([category, data]) => `
                <tr>
                  <td>${this.escapeHtml(category)}</td>
                  <td class="text-right">${data.count}</td>
                  <td class="text-right">$${this.formatCurrency(data.totalAmount)}</td>
                  <td class="text-right">$${this.formatCurrency(data.totalDeductible)}</td>
                  <td class="text-right">${((data.totalDeductible / report.totalDeductible) * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td><strong>Total</strong></td>
              <td class="text-right"><strong>${report.expenseCount}</strong></td>
              <td class="text-right"><strong>$${this.formatCurrency(report.totalExpenses)}</strong></td>
              <td class="text-right"><strong>$${this.formatCurrency(report.totalDeductible)}</strong></td>
              <td class="text-right"><strong>100%</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="report-section">
        <h3>Detailed Expense List</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Description</th>
              <th>Category</th>
              <th class="text-right">Amount</th>
              <th class="text-center">% Work</th>
              <th class="text-right">Deductible</th>
              <th class="text-center">Receipts</th>
            </tr>
          </thead>
          <tbody>
            ${report.expenses
        .sort((a, b) => new Date(a.datePaid) - new Date(b.datePaid))
        .map(expense => `
                <tr>
                  <td>${this.formatDate(expense.datePaid)}</td>
                  <td>${this.escapeHtml(expense.merchant)}</td>
                  <td>${this.escapeHtml(expense.expenseDetails)}</td>
                  <td>${this.escapeHtml(expense.expenseCategory)}</td>
                  <td class="text-right">$${this.formatCurrency(expense.expenseAmount)}</td>
                  <td class="text-center">${expense.percentUsedForWork}%</td>
                  <td class="text-right">$${this.formatCurrency(expense.deductible)}</td>
                  <td class="text-center">${expense.receiptFiles?.length || 0} 📎</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>

      <div class="report-footer">
        <p><em>This report was generated by Tax Deductible Tracker for ZIMRA QPD submission purposes.</em></p>
        <p><em>Please verify all amounts and retain all receipts for audit purposes.</em></p>
      </div>
    `;
  }

  /**
   * Export report as CSV
   */
  async exportCSV(year, quarter) {
    const report = await this.generateReport(year, quarter);

    if (report.expenses.length === 0) {
      alert('No expenses to export for this period');
      return;
    }

    // Build CSV content
    let csv = 'Date Paid,Merchant,Expense Details,Expense Category,Expense Amount,% Used for Work,Deductible,Notes,Receipt Count\n';

    report.expenses.forEach(expense => {
      csv += [
        expense.datePaid,
        this.escapeCsv(expense.merchant),
        this.escapeCsv(expense.expenseDetails),
        this.escapeCsv(expense.expenseCategory),
        expense.expenseAmount.toFixed(2),
        expense.percentUsedForWork,
        expense.deductible.toFixed(2),
        this.escapeCsv(expense.notes || ''),
        expense.receiptFiles?.length || 0
      ].join(',') + '\n';
    });

    // Add summary
    csv += '\n';
    csv += `Summary,,,,,,,\n`;
    csv += `Total Expenses,,,,${report.totalExpenses.toFixed(2)},,,\n`;
    csv += `Total Deductible,,,,,,${report.totalDeductible.toFixed(2)},\n`;
    csv += `Report Period,Q${quarter} ${year},,,,,,\n`;
    csv += `Generated,${new Date().toISOString()},,,,,,\n`;

    // Download
    this.downloadFile(csv, `ZIMRA_QPD_Q${quarter}_${year}.csv`, 'text/csv');
  }

  /**
   * Export report as PDF (using jsPDF)
   */
  async exportPDF(year, quarter) {
    const report = await this.generateReport(year, quarter);

    if (report.expenses.length === 0) {
      alert('No expenses to export for this period');
      return;
    }

    // Check if jsPDF is available
    if (typeof jspdf === 'undefined') {
      alert('PDF export library not loaded. Please refresh the page and try again.');
      return;
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF();

    const quarterDates = this.getQuarterDates(year, quarter);
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('ZIMRA QPD Quarterly Report', 20, yPos);

    yPos += 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Period: Q${quarter} ${year} (${quarterDates.start} to ${quarterDates.end})`, 20, yPos);

    yPos += 7;
    doc.text(`Generated: ${this.formatDateTime(new Date())}`, 20, yPos);

    yPos += 7;
    doc.text(`Total Expenses: ${report.expenseCount}`, 20, yPos);

    // Summary Box
    yPos += 15;
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos, 170, 30, 'F');

    doc.setFontSize(10);
    doc.text(`Total Expense Amount: $${this.formatCurrency(report.totalExpenses)}`, 25, yPos + 10);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Deductible Amount: $${this.formatCurrency(report.totalDeductible)}`, 25, yPos + 20);
    doc.setFont(undefined, 'normal');

    // Category Breakdown
    yPos += 40;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Category Breakdown', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const categories = Object.entries(report.byCategory)
      .sort((a, b) => b[1].totalDeductible - a[1].totalDeductible);

    categories.forEach(([category, data]) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      const percentage = ((data.totalDeductible / report.totalDeductible) * 100).toFixed(1);
      doc.text(`${category}: $${this.formatCurrency(data.totalDeductible)} (${percentage}%) - ${data.count} expense(s)`, 25, yPos);
      yPos += 7;
    });

    // New page for expense details
    doc.addPage();
    yPos = 20;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Detailed Expense List', 20, yPos);

    yPos += 10;
    doc.setFontSize(8);

    // Expenses (simplified table)
    report.expenses.forEach((expense, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${this.formatDate(expense.datePaid)} - ${expense.merchant}`, 20, yPos);
      yPos += 5;

      doc.setFont(undefined, 'normal');
      doc.text(`   ${expense.expenseDetails} (${expense.expenseCategory})`, 20, yPos);
      yPos += 5;

      doc.text(`   Amount: $${this.formatCurrency(expense.expenseAmount)} | Work %: ${expense.percentUsedForWork}% | Deductible: $${this.formatCurrency(expense.deductible)}`, 20, yPos);
      yPos += 8;
    });

    // Footer
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Page ${i} of ${pageCount}`, 20, 285);
      doc.text('Generated by Tax Deductible Tracker', 150, 285);
    }

    // Save
    doc.save(`ZIMRA_QPD_Q${quarter}_${year}.pdf`);
  }

  /**
   * Get quarter date range
   */
  getQuarterDates(year, quarter) {
    const quarters = {
      1: { start: `${year}-01-01`, end: `${year}-03-31` },
      2: { start: `${year}-04-01`, end: `${year}-06-30` },
      3: { start: `${year}-07-01`, end: `${year}-09-30` },
      4: { start: `${year}-10-01`, end: `${year}-12-31` }
    };

    return quarters[quarter];
  }

  /**
   * Generate annual report
   */
  async generateAnnualReport(year) {
    const stats = await db.getAnnualStats(year);

    return {
      year,
      ...stats,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Display annual report in UI
   */
  async displayAnnualReport(year) {
    const report = await this.generateAnnualReport(year);
    const container = document.getElementById('report-content');

    if (!container) return;

    if (report.expenses.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">No expenses for ${year}</div>
          <div class="empty-state-text">Add expenses for this year to generate an annual report</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.renderAnnualReportHTML(report);
  }

  /**
   * Render annual report HTML
   */
  renderAnnualReportHTML(report) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const quarterLabels = {
      1: 'Q1 (Jan – Mar)',
      2: 'Q2 (Apr – Jun)',
      3: 'Q3 (Jul – Sep)',
      4: 'Q4 (Oct – Dec)'
    };

    return `
      <div class="report-header">
        <h2>ZIMRA Annual Tax Deduction Report</h2>
        <div class="report-meta">
          <div><strong>Tax Year:</strong> ${report.year} (1 January – 31 December)</div>
          <div><strong>Generated:</strong> ${this.formatDateTime(report.generatedAt)}</div>
          <div><strong>Total Expenses Recorded:</strong> ${report.expenseCount}</div>
        </div>
      </div>

      <div class="report-summary">
        <h3>Annual Summary</h3>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total Expenses</div>
            <div class="summary-value">$${this.formatCurrency(report.totalExpenses)}</div>
          </div>
          <div class="summary-card highlight">
            <div class="summary-label">Total Deductible</div>
            <div class="summary-value">$${this.formatCurrency(report.totalDeductible)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Avg. Deduction Rate</div>
            <div class="summary-value">${report.totalExpenses > 0 ? ((report.totalDeductible / report.totalExpenses) * 100).toFixed(1) : 0}%</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Avg. Monthly Deductible</div>
            <div class="summary-value">$${this.formatCurrency(report.totalDeductible / 12)}</div>
          </div>
        </div>
      </div>

      <div class="report-section">
        <h3>Quarterly Breakdown</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Quarter</th>
              <th class="text-right">Expenses</th>
              <th class="text-right">Total Amount</th>
              <th class="text-right">Total Deductible</th>
              <th class="text-right">% of Annual</th>
            </tr>
          </thead>
          <tbody>
            ${[1, 2, 3, 4].map(q => {
      const qData = report.byQuarter[q] || { expenseCount: 0, totalExpenses: 0, totalDeductible: 0 };
      const pct = report.totalDeductible > 0 ? ((qData.totalDeductible / report.totalDeductible) * 100).toFixed(1) : '0.0';
      return `
                <tr>
                  <td>${quarterLabels[q]}</td>
                  <td class="text-right">${qData.expenseCount}</td>
                  <td class="text-right">$${this.formatCurrency(qData.totalExpenses)}</td>
                  <td class="text-right">$${this.formatCurrency(qData.totalDeductible)}</td>
                  <td class="text-right">${pct}%</td>
                </tr>
              `;
    }).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td><strong>Full Year</strong></td>
              <td class="text-right"><strong>${report.expenseCount}</strong></td>
              <td class="text-right"><strong>$${this.formatCurrency(report.totalExpenses)}</strong></td>
              <td class="text-right"><strong>$${this.formatCurrency(report.totalDeductible)}</strong></td>
              <td class="text-right"><strong>100%</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="report-section">
        <h3>Monthly Trend</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Month</th>
              <th class="text-right">Expenses</th>
              <th class="text-right">Total Amount</th>
              <th class="text-right">Total Deductible</th>
            </tr>
          </thead>
          <tbody>
            ${monthNames.map((name, idx) => {
      const mData = report.byMonth[idx] || { count: 0, totalAmount: 0, totalDeductible: 0 };
      return `
                <tr>
                  <td>${name}</td>
                  <td class="text-right">${mData.count}</td>
                  <td class="text-right">$${this.formatCurrency(mData.totalAmount)}</td>
                  <td class="text-right">$${this.formatCurrency(mData.totalDeductible)}</td>
                </tr>
              `;
    }).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td><strong>Total</strong></td>
              <td class="text-right"><strong>${report.expenseCount}</strong></td>
              <td class="text-right"><strong>$${this.formatCurrency(report.totalExpenses)}</strong></td>
              <td class="text-right"><strong>$${this.formatCurrency(report.totalDeductible)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="report-section">
        <h3>Breakdown by Category</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Category</th>
              <th class="text-right">Count</th>
              <th class="text-right">Total Amount</th>
              <th class="text-right">Total Deductible</th>
              <th class="text-right">% of Total</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(report.byCategory)
        .sort((a, b) => b[1].totalDeductible - a[1].totalDeductible)
        .map(([category, data]) => `
                <tr>
                  <td>${this.escapeHtml(category)}</td>
                  <td class="text-right">${data.count}</td>
                  <td class="text-right">$${this.formatCurrency(data.totalAmount)}</td>
                  <td class="text-right">$${this.formatCurrency(data.totalDeductible)}</td>
                  <td class="text-right">${((data.totalDeductible / report.totalDeductible) * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td><strong>Total</strong></td>
              <td class="text-right"><strong>${report.expenseCount}</strong></td>
              <td class="text-right"><strong>$${this.formatCurrency(report.totalExpenses)}</strong></td>
              <td class="text-right"><strong>$${this.formatCurrency(report.totalDeductible)}</strong></td>
              <td class="text-right"><strong>100%</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="report-section">
        <h3>Detailed Expense List</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Description</th>
              <th>Category</th>
              <th class="text-right">Amount</th>
              <th class="text-center">% Work</th>
              <th class="text-right">Deductible</th>
              <th class="text-center">Receipts</th>
            </tr>
          </thead>
          <tbody>
            ${report.expenses
        .sort((a, b) => new Date(a.datePaid) - new Date(b.datePaid))
        .map(expense => `
                <tr>
                  <td>${this.formatDate(expense.datePaid)}</td>
                  <td>${this.escapeHtml(expense.merchant)}</td>
                  <td>${this.escapeHtml(expense.expenseDetails)}</td>
                  <td>${this.escapeHtml(expense.expenseCategory)}</td>
                  <td class="text-right">$${this.formatCurrency(expense.expenseAmount)}</td>
                  <td class="text-center">${expense.percentUsedForWork}%</td>
                  <td class="text-right">$${this.formatCurrency(expense.deductible)}</td>
                  <td class="text-center">${expense.receiptFiles?.length || 0} 📎</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>

      <div class="report-footer">
        <p><em>This annual report was generated by Tax Deductible Tracker for ZIMRA tax submission purposes.</em></p>
        <p><em>Please verify all amounts and retain all receipts for audit purposes.</em></p>
        <p><em>Tax Year: ${report.year} | Total Deductible Claimed: $${this.formatCurrency(report.totalDeductible)}</em></p>
      </div>
    `;
  }

  /**
   * Export annual report as CSV
   */
  async exportAnnualCSV(year) {
    const report = await this.generateAnnualReport(year);

    if (report.expenses.length === 0) {
      alert('No expenses to export for this year');
      return;
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    // Build CSV content
    let csv = 'ZIMRA Annual Tax Deduction Report\n';
    csv += `Tax Year,${year}\n`;
    csv += `Generated,${new Date().toISOString()}\n`;
    csv += '\n';

    // Annual Summary
    csv += 'ANNUAL SUMMARY\n';
    csv += `Total Expenses,$${report.totalExpenses.toFixed(2)}\n`;
    csv += `Total Deductible,$${report.totalDeductible.toFixed(2)}\n`;
    csv += `Total Expense Count,${report.expenseCount}\n`;
    csv += '\n';

    // Quarterly breakdown
    csv += 'QUARTERLY BREAKDOWN\n';
    csv += 'Quarter,Expense Count,Total Amount,Total Deductible\n';
    const quarterLabels = { 1: 'Q1 (Jan-Mar)', 2: 'Q2 (Apr-Jun)', 3: 'Q3 (Jul-Sep)', 4: 'Q4 (Oct-Dec)' };
    for (let q = 1; q <= 4; q++) {
      const qData = report.byQuarter[q] || { expenseCount: 0, totalExpenses: 0, totalDeductible: 0 };
      csv += `${quarterLabels[q]},${qData.expenseCount},${qData.totalExpenses.toFixed(2)},${qData.totalDeductible.toFixed(2)}\n`;
    }
    csv += '\n';

    // Monthly breakdown
    csv += 'MONTHLY BREAKDOWN\n';
    csv += 'Month,Expense Count,Total Amount,Total Deductible\n';
    monthNames.forEach((name, idx) => {
      const mData = report.byMonth[idx] || { count: 0, totalAmount: 0, totalDeductible: 0 };
      csv += `${name},${mData.count},${mData.totalAmount.toFixed(2)},${mData.totalDeductible.toFixed(2)}\n`;
    });
    csv += '\n';

    // Category breakdown
    csv += 'CATEGORY BREAKDOWN\n';
    csv += 'Category,Count,Total Amount,Total Deductible\n';
    Object.entries(report.byCategory)
      .sort((a, b) => b[1].totalDeductible - a[1].totalDeductible)
      .forEach(([category, data]) => {
        csv += `${this.escapeCsv(category)},${data.count},${data.totalAmount.toFixed(2)},${data.totalDeductible.toFixed(2)}\n`;
      });
    csv += '\n';

    // Detailed expense list
    csv += 'DETAILED EXPENSE LIST\n';
    csv += 'Date Paid,Merchant,Expense Details,Expense Category,Expense Amount,% Used for Work,Deductible,Notes,Receipt Count\n';
    report.expenses
      .sort((a, b) => new Date(a.datePaid) - new Date(b.datePaid))
      .forEach(expense => {
        csv += [
          expense.datePaid,
          this.escapeCsv(expense.merchant),
          this.escapeCsv(expense.expenseDetails),
          this.escapeCsv(expense.expenseCategory),
          expense.expenseAmount.toFixed(2),
          expense.percentUsedForWork,
          expense.deductible.toFixed(2),
          this.escapeCsv(expense.notes || ''),
          expense.receiptFiles?.length || 0
        ].join(',') + '\n';
      });

    // Download
    this.downloadFile(csv, `ZIMRA_Annual_Report_${year}.csv`, 'text/csv');
  }

  /**
   * Export annual report as PDF (using jsPDF)
   */
  async exportAnnualPDF(year) {
    const report = await this.generateAnnualReport(year);

    if (report.expenses.length === 0) {
      alert('No expenses to export for this year');
      return;
    }

    if (typeof jspdf === 'undefined') {
      alert('PDF export library not loaded. Please refresh the page and try again.');
      return;
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    let yPos = 20;

    // ── Title ──
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('ZIMRA Annual Tax Deduction Report', 20, yPos);

    yPos += 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Tax Year: ${year} (1 January – 31 December)`, 20, yPos);

    yPos += 7;
    doc.text(`Generated: ${this.formatDateTime(new Date())}`, 20, yPos);

    yPos += 7;
    doc.text(`Total Expenses Recorded: ${report.expenseCount}`, 20, yPos);

    // ── Annual Summary Box ──
    yPos += 15;
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos, 170, 30, 'F');

    doc.setFontSize(10);
    doc.text(`Total Expense Amount: $${this.formatCurrency(report.totalExpenses)}`, 25, yPos + 10);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Deductible Amount: $${this.formatCurrency(report.totalDeductible)}`, 25, yPos + 17);
    const rate = report.totalExpenses > 0 ? ((report.totalDeductible / report.totalExpenses) * 100).toFixed(1) : '0.0';
    doc.text(`Average Deduction Rate: ${rate}%`, 25, yPos + 24);
    doc.setFont(undefined, 'normal');

    // ── Quarterly Breakdown ──
    yPos += 40;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Quarterly Breakdown', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const quarterLabels = { 1: 'Q1 (Jan-Mar)', 2: 'Q2 (Apr-Jun)', 3: 'Q3 (Jul-Sep)', 4: 'Q4 (Oct-Dec)' };
    for (let q = 1; q <= 4; q++) {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      const qData = report.byQuarter[q] || { expenseCount: 0, totalExpenses: 0, totalDeductible: 0 };
      const pct = report.totalDeductible > 0 ? ((qData.totalDeductible / report.totalDeductible) * 100).toFixed(1) : '0.0';
      doc.text(`${quarterLabels[q]}: ${qData.expenseCount} expenses | Amount: $${this.formatCurrency(qData.totalExpenses)} | Deductible: $${this.formatCurrency(qData.totalDeductible)} (${pct}%)`, 25, yPos);
      yPos += 7;
    }

    // ── Monthly Trend ──
    yPos += 8;
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Monthly Trend', 20, yPos);

    yPos += 10;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');

    monthNames.forEach((name, idx) => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      const mData = report.byMonth[idx] || { count: 0, totalAmount: 0, totalDeductible: 0 };
      doc.text(`${name}: ${mData.count} expenses | $${this.formatCurrency(mData.totalAmount)} | Deductible: $${this.formatCurrency(mData.totalDeductible)}`, 25, yPos);
      yPos += 6;
    });

    // ── Category Breakdown ──
    yPos += 8;
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Category Breakdown', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    const categories = Object.entries(report.byCategory)
      .sort((a, b) => b[1].totalDeductible - a[1].totalDeductible);

    categories.forEach(([category, data]) => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      const percentage = report.totalDeductible > 0 ? ((data.totalDeductible / report.totalDeductible) * 100).toFixed(1) : '0.0';
      doc.text(`${category}: $${this.formatCurrency(data.totalDeductible)} (${percentage}%) - ${data.count} expense(s)`, 25, yPos);
      yPos += 7;
    });

    // ── Detailed Expense List (new page) ──
    doc.addPage();
    yPos = 20;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Detailed Expense List', 20, yPos);

    yPos += 10;
    doc.setFontSize(8);

    report.expenses
      .sort((a, b) => new Date(a.datePaid) - new Date(b.datePaid))
      .forEach((expense, index) => {
        if (yPos > 270) { doc.addPage(); yPos = 20; }

        doc.setFont(undefined, 'bold');
        doc.text(`${index + 1}. ${this.formatDate(expense.datePaid)} - ${expense.merchant}`, 20, yPos);
        yPos += 5;

        doc.setFont(undefined, 'normal');
        doc.text(`   ${expense.expenseDetails} (${expense.expenseCategory})`, 20, yPos);
        yPos += 5;

        doc.text(`   Amount: $${this.formatCurrency(expense.expenseAmount)} | Work %: ${expense.percentUsedForWork}% | Deductible: $${this.formatCurrency(expense.deductible)}`, 20, yPos);
        yPos += 8;
      });

    // ── Footer on all pages ──
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Page ${i} of ${pageCount}`, 20, 285);
      doc.text(`ZIMRA Annual Report ${year} – Tax Deductible Tracker`, 120, 285);
    }

    // Save
    doc.save(`ZIMRA_Annual_Report_${year}.pdf`);
  }

  /**
   * Escape CSV field
   */
  escapeCsv(text) {
    if (!text) return '';
    text = String(text);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  /**
   * Download file
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Format date
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  /**
   * Format date and time
   */
  formatDateTime(date) {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}


// Add CSS for report styling when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addReportStyles);
} else {
  addReportStyles();
}

function addReportStyles() {
  const style = document.createElement('style');
  style.textContent = `
  .report-header {
    margin-bottom: var(--spacing-xl);
    padding-bottom: var(--spacing-lg);
    border-bottom: 2px solid var(--glass-border);
  }

  .report-header h2 {
    margin-bottom: var(--spacing-md);
    color: var(--color-primary);
  }

  .report-meta {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .report-summary {
    margin-bottom: var(--spacing-xl);
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
    margin-top: var(--spacing-md);
  }

  .summary-card {
    padding: var(--spacing-lg);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--glass-border);
    border-radius: var(--border-radius-md);
    text-align: center;
  }

  .summary-card.highlight {
    background: rgba(78, 205, 196, 0.1);
    border-color: var(--color-deductible);
  }

  .summary-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-sm);
  }

  .summary-value {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .summary-card.highlight .summary-value {
    color: var(--color-deductible);
  }

  .report-section {
    margin-bottom: var(--spacing-xl);
  }

  .report-section h3 {
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--glass-border);
  }

  .report-table {
    width: 100%;
    font-size: var(--font-size-sm);
  }

  .report-table th {
    background: var(--color-bg-tertiary);
    font-weight: 600;
    padding: var(--spacing-md);
  }

  .report-table td {
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .report-table tfoot .total-row {
    background: rgba(78, 205, 196, 0.1);
    font-weight: 600;
  }

  .report-footer {
    margin-top: var(--spacing-2xl);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--glass-border);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    font-style: italic;
  }

  .report-footer p {
    margin-bottom: var(--spacing-xs);
  }

  @media print {
    body {
      background: white;
      color: black;
    }
    
    .sidebar,
    .btn,
    .nav-menu {
      display: none !important;
    }
    
    .main-content {
      margin-left: 0;
      width: 100%;
    }
  }
`;
  document.head.appendChild(style);
}

// Create singleton instance
const reportManager = new ReportManager();

// Export
window.reportManager = reportManager;
