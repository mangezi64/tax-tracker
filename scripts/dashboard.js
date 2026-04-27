/**
 * Dashboard Module
 * Displays statistics, charts, and summaries
 */

class DashboardManager {
  constructor() {
    this.currentYear = new Date().getFullYear();
    this.currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  }

  /**
   * Refresh entire dashboard
   */
  async refreshDashboard() {
    await this.renderStatsCards();
    await this.renderCategoryBreakdown();
    await this.renderRecentExpenses();
    await this.renderMonthlyTrend();
  }

  /**
   * Render stats cards
   */
  async renderStatsCards() {
    const expenses = await db.getAllExpenses();

    // Calculate current quarter stats
    const quarterExpenses = this.filterByQuarter(expenses, this.currentYear, this.currentQuarter);

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.expenseAmount, 0);
    const totalDeductible = expenses.reduce((sum, exp) => sum + exp.deductible, 0);
    const quarterTotal = quarterExpenses.reduce((sum, exp) => sum + exp.deductible, 0);
    const expenseCount = expenses.length;

    // Calculate average deductible percentage
    const avgPercent = expenses.length > 0
      ? expenses.reduce((sum, exp) => sum + exp.percentUsedForWork, 0) / expenses.length
      : 0;

    // Render cards
    const container = document.getElementById('stats-cards');
    if (!container) return;

    container.innerHTML = `
      <div class="stat-card" style="--stat-color: var(--color-expense);">
        <div class="stat-header">
          <span class="stat-label">Total Expenses</span>
          <div class="stat-icon" style="background: rgba(255, 107, 107, 0.1);">💰</div>
        </div>
        <div class="stat-value">$${this.formatCurrency(totalExpenses)}</div>
        <div class="stat-change text-muted">${expenseCount} transactions</div>
      </div>

      <div class="stat-card" style="--stat-color: var(--color-deductible);">
        <div class="stat-header">
          <span class="stat-label">Total Deductible</span>
          <div class="stat-icon" style="background: rgba(78, 205, 196, 0.1);">📊</div>
        </div>
        <div class="stat-value">$${this.formatCurrency(totalDeductible)}</div>
        <div class="stat-change text-success">
          ${((totalDeductible / totalExpenses) * 100).toFixed(1)}% of expenses
        </div>
      </div>

      <div class="stat-card" style="--stat-color: var(--color-primary);">
        <div class="stat-header">
          <span class="stat-label">Q${this.currentQuarter} ${this.currentYear} Deductible</span>
          <div class="stat-icon" style="background: rgba(76, 154, 255, 0.1);">📅</div>
        </div>
        <div class="stat-value">$${this.formatCurrency(quarterTotal)}</div>
        <div class="stat-change text-muted">${quarterExpenses.length} expenses</div>
      </div>

      <div class="stat-card" style="--stat-color: var(--color-success);">
        <div class="stat-header">
          <span class="stat-label">Avg Work Usage</span>
          <div class="stat-icon" style="background: rgba(54, 179, 126, 0.1);">📈</div>
        </div>
        <div class="stat-value">${avgPercent.toFixed(1)}%</div>
        <div class="stat-change text-muted">Average work percentage</div>
      </div>
    `;
  }

  /**
   * Render category breakdown (pie chart simulation)
   */
  async renderCategoryBreakdown() {
    const expenses = await db.getAllExpenses();
    const categories = await db.getAllCategories();

    // Group by category
    const categoryMap = {};
    expenses.forEach(exp => {
      if (!categoryMap[exp.expenseCategory]) {
        categoryMap[exp.expenseCategory] = {
          total: 0,
          deductible: 0,
          count: 0
        };
      }
      categoryMap[exp.expenseCategory].total += exp.expenseAmount;
      categoryMap[exp.expenseCategory].deductible += exp.deductible;
      categoryMap[exp.expenseCategory].count++;
    });

    // Sort by deductible amount
    const sortedCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1].deductible - a[1].deductible)
      .slice(0, 8); // Top 8 categories

    const container = document.getElementById('category-breakdown');
    if (!container) return;

    if (sortedCategories.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-title">No data yet</div>
          <div class="empty-state-text">Add expenses to see category breakdown</div>
        </div>
      `;
      return;
    }

    const totalDeductible = expenses.reduce((sum, exp) => sum + exp.deductible, 0);

    container.innerHTML = `
      <div class="category-list">
        ${sortedCategories.map(([category, data]) => {
      const percentage = (data.deductible / totalDeductible) * 100;
      const categoryInfo = categories.find(c => c.name === category) || {};

      return `
            <div class="category-item">
              <div class="category-header">
                <span class="category-icon">${categoryInfo.icon || '📦'}</span>
                <span class="category-name">${this.escapeHtml(category)}</span>
                <span class="category-amount">$${this.formatCurrency(data.deductible)}</span>
              </div>
              <div class="category-bar-container">
                <div class="category-bar" style="width: ${percentage}%; background: ${categoryInfo.color || 'var(--color-primary)'}"></div>
              </div>
              <div class="category-details">
                <span class="text-muted">${data.count} expense${data.count !== 1 ? 's' : ''}</span>
                <span class="text-muted">${percentage.toFixed(1)}%</span>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  /**
   * Render recent expenses
   */
  async renderRecentExpenses(limit = 5) {
    const expenses = await db.getAllExpenses();

    // Sort by date, most recent first
    const recentExpenses = expenses
      .sort((a, b) => new Date(b.datePaid) - new Date(a.datePaid))
      .slice(0, limit);

    const container = document.getElementById('recent-expenses');
    if (!container) return;

    if (recentExpenses.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No expenses yet</div>
          <div class="empty-state-text">Start tracking your expenses</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="expense-list">
        ${recentExpenses.map(expense => `
          <div class="expense-item" onclick="expenseManager.viewExpense(${expense.id})">
            <div class="expense-item-header">
              <div>
                <div class="expense-item-merchant">${this.escapeHtml(expense.merchant)}</div>
                <div class="expense-item-details">${this.escapeHtml(expense.expenseDetails)}</div>
              </div>
              <div class="expense-item-amount">$${this.formatCurrency(expense.deductible)}</div>
            </div>
            <div class="expense-item-footer">
              <span class="badge badge-primary">${this.escapeHtml(expense.expenseCategory)}</span>
              <span class="text-muted">${this.formatDate(expense.datePaid)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render monthly trend (simple bar chart)
   */
  async renderMonthlyTrend() {
    const expenses = await db.getAllExpenses();
    const container = document.getElementById('monthly-trend');

    if (!container) return;

    // Group by month (last 6 months)
    const monthlyData = this.groupByMonth(expenses, 6);

    if (monthlyData.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📈</div>
          <div class="empty-state-title">No trend data</div>
          <div class="empty-state-text">Add expenses to see trends</div>
        </div>
      `;
      return;
    }

    const maxDeductible = Math.max(...monthlyData.map(m => m.deductible));

    container.innerHTML = `
      <div class="trend-chart">
        ${monthlyData.map(month => {
      const height = maxDeductible > 0 ? (month.deductible / maxDeductible) * 100 : 0;

      return `
            <div class="trend-bar-container">
              <div class="trend-bar-label">$${this.formatCurrency(month.deductible)}</div>
              <div class="trend-bar-wrapper">
                <div class="trend-bar" style="height: ${height}%;"></div>
              </div>
              <div class="trend-month-label">${month.label}</div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  /**
   * Filter expenses by quarter
   */
  filterByQuarter(expenses, year, quarter) {
    const quarters = {
      1: { start: 0, end: 2 },
      2: { start: 3, end: 5 },
      3: { start: 6, end: 8 },
      4: { start: 9, end: 11 }
    };

    const { start, end } = quarters[quarter];

    return expenses.filter(exp => {
      const date = new Date(exp.datePaid);
      return date.getFullYear() === year &&
        date.getMonth() >= start &&
        date.getMonth() <= end;
    });
  }

  /**
   * Group expenses by month
   */
  groupByMonth(expenses, months = 6) {
    const now = new Date();
    const monthlyData = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthExpenses = expenses.filter(exp => {
        const expDate = new Date(exp.datePaid);
        return expDate.getFullYear() === date.getFullYear() &&
          expDate.getMonth() === date.getMonth();
      });

      monthlyData.push({
        label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        deductible: monthExpenses.reduce((sum, exp) => sum + exp.deductible, 0),
        count: monthExpenses.length
      });
    }

    return monthlyData;
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
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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


// Add CSS for dashboard components when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addDashboardStyles);
} else {
  addDashboardStyles();
}

function addDashboardStyles() {
  const style = document.createElement('style');
  style.textContent = `
  .category-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .category-item {
    padding: var(--spacing-md);
    background: rgba(255, 255, 255, 0.02);
    border-radius: var(--border-radius-md);
    border: 1px solid var(--glass-border);
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-sm);
  }

  .category-icon {
    font-size: 24px;
  }

  .category-name {
    flex: 1;
    font-weight: 500;
  }

  .category-amount {
    font-weight: 600;
    color: var(--color-success);
  }

  .category-bar-container {
    height: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: var(--spacing-xs);
  }

  .category-bar {
    height: 100%;
    transition: width var(--transition-base);
  }

  .category-details {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-xs);
  }

  .expense-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .expense-item {
    padding: var(--spacing-md);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--glass-border);
    border-radius: var(--border-radius-md);
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .expense-item:hover {
    background: var(--color-bg-hover);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .expense-item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-sm);
  }

  .expense-item-merchant {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .expense-item-details {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .expense-item-amount {
    font-weight: 700;
    font-size: var(--font-size-lg);
    color: var(--color-success);
  }

  .expense-item-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .trend-chart {
    display: flex;
    align-items: flex-end;
    gap: var(--spacing-md);
    height: 200px;
    padding: var(--spacing-md) 0;
  }

  .trend-bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  .trend-bar-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-xs);
    min-height: 20px;
  }

  .trend-bar-wrapper {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
    padding: 0 4px;
  }

  .trend-bar {
    width: 100%;
    background: linear-gradient(180deg, var(--color-primary), var(--color-primary-dark));
    border-radius: 4px 4px 0 0;
    min-height: 4px;
    transition: height var(--transition-base);
  }

  .trend-month-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--spacing-xs);
  }
`;
  document.head.appendChild(style);
}

// Create singleton instance
const dashboardManager = new DashboardManager();

// Export
window.dashboardManager = dashboardManager;
