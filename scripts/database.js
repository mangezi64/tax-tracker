/**
 * IndexedDB Database Manager
 * Handles all data persistence for the Tax Deductible Tracker
 */

const DB_NAME = 'TaxDeductibleTracker';
const DB_VERSION = 1;

class Database {
    constructor() {
        this.db = null;
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('Database failed to open', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Expenses Store
                if (!db.objectStoreNames.contains('expenses')) {
                    const expenseStore = db.createObjectStore('expenses', {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    // Create indexes for efficient querying
                    expenseStore.createIndex('datePaid', 'datePaid', { unique: false });
                    expenseStore.createIndex('merchant', 'merchant', { unique: false });
                    expenseStore.createIndex('category', 'expenseCategory', { unique: false });
                    expenseStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Categories Store
                if (!db.objectStoreNames.contains('categories')) {
                    const categoryStore = db.createObjectStore('categories', {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    categoryStore.createIndex('name', 'name', { unique: true });
                }

                // Settings Store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                console.log('Database setup complete');
            };
        });
    }

    /**
     * Add a new expense
     */
    async addExpense(expense) {
        const transaction = this.db.transaction(['expenses'], 'readwrite');
        const store = transaction.objectStore('expenses');

        const expenseData = {
            ...expense,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const request = store.add(expenseData);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get expense by ID
     */
    async getExpense(id) {
        const transaction = this.db.transaction(['expenses'], 'readonly');
        const store = transaction.objectStore('expenses');

        return new Promise((resolve, reject) => {
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get all expenses
     */
    async getAllExpenses() {
        const transaction = this.db.transaction(['expenses'], 'readonly');
        const store = transaction.objectStore('expenses');

        return new Promise((resolve, reject) => {
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get expenses by date range
     */
    async getExpensesByDateRange(startDate, endDate) {
        const transaction = this.db.transaction(['expenses'], 'readonly');
        const store = transaction.objectStore('expenses');
        const index = store.index('datePaid');

        const range = IDBKeyRange.bound(startDate, endDate);

        return new Promise((resolve, reject) => {
            const request = index.getAll(range);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get expenses by category
     */
    async getExpensesByCategory(category) {
        const transaction = this.db.transaction(['expenses'], 'readonly');
        const store = transaction.objectStore('expenses');
        const index = store.index('category');

        return new Promise((resolve, reject) => {
            const request = index.getAll(category);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Update an expense
     */
    async updateExpense(id, updates) {
        const expense = await this.getExpense(id);

        if (!expense) {
            throw new Error(`Expense with ID ${id} not found`);
        }

        const updatedExpense = {
            ...expense,
            ...updates,
            id: id,
            updatedAt: new Date().toISOString()
        };

        const transaction = this.db.transaction(['expenses'], 'readwrite');
        const store = transaction.objectStore('expenses');

        return new Promise((resolve, reject) => {
            const request = store.put(updatedExpense);

            request.onsuccess = () => {
                resolve(updatedExpense);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Delete an expense
     */
    async deleteExpense(id) {
        const transaction = this.db.transaction(['expenses'], 'readwrite');
        const store = transaction.objectStore('expenses');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Add a category
     */
    async addCategory(category) {
        const transaction = this.db.transaction(['categories'], 'readwrite');
        const store = transaction.objectStore('categories');

        return new Promise((resolve, reject) => {
            const request = store.add(category);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get all categories
     */
    async getAllCategories() {
        const transaction = this.db.transaction(['categories'], 'readonly');
        const store = transaction.objectStore('categories');

        return new Promise((resolve, reject) => {
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Delete a category
     */
    async deleteCategory(id) {
        const transaction = this.db.transaction(['categories'], 'readwrite');
        const store = transaction.objectStore('categories');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Initialize default categories
     */
    async initializeDefaultCategories() {
        const existingCategories = await this.getAllCategories();

        // Migration: Rename Desk/Chair to Furniture if they exist
        if (existingCategories.length > 0) {
            const desk = existingCategories.find(c => c.name === 'Desk');
            const chair = existingCategories.find(c => c.name === 'Chair');
            const furniture = existingCategories.find(c => c.name === 'Furniture');

            if ((desk || chair) && !furniture) {
                // Create Furniture category
                await this.addCategory({ name: 'Furniture', color: '#ff5630', icon: '🪑' });

                // Delete old categories
                if (desk) await this.deleteCategory(desk.id);
                if (chair) await this.deleteCategory(chair.id);

                // Note: Expenses associated with Desk/Chair will need to be updated manually or via a more complex migration
                // For now, we just ensure the category list is correct
                console.log('Migrated Desk/Chair categories to Furniture');
                return await this.getAllCategories();
            }

            return existingCategories;
        }

        const defaultCategories = [
            { name: 'Internet', color: '#4c9aff', icon: '🌐' },
            { name: 'Electricity', color: '#ffab00', icon: '⚡' },
            { name: 'Computer', color: '#36b37e', icon: '💻' },
            { name: 'Furniture', color: '#ff5630', icon: '🪑' },
            { name: 'Office Supplies', color: '#00b8d9', icon: '📎' },
            { name: 'Software', color: '#ff8b00', icon: '💿' },
            { name: 'Professional Services', color: '#00875a', icon: '🤝' },
            { name: 'Travel', color: '#5243aa', icon: '✈️' },
            { name: 'Mobile Device', color: '#ff991f', icon: '📱' },
            { name: 'Other', color: '#8993a4', icon: '📋' }
        ];

        for (const category of defaultCategories) {
            await this.addCategory(category);
        }

        return await this.getAllCategories();
    }

    /**
     * Get or set setting
     */
    async getSetting(key, defaultValue = null) {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');

        return new Promise((resolve, reject) => {
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.value : defaultValue);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async setSetting(key, value) {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');

        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Export all data as JSON
     */
    async exportData() {
        const expenses = await this.getAllExpenses();
        const categories = await this.getAllCategories();

        return {
            expenses,
            categories,
            exportDate: new Date().toISOString(),
            version: DB_VERSION
        };
    }

    /**
     * Import data from JSON
     */
    async importData(data) {
        // Clear existing data
        const transaction = this.db.transaction(['expenses', 'categories'], 'readwrite');

        const expenseStore = transaction.objectStore('expenses');
        const categoryStore = transaction.objectStore('categories');

        await new Promise((resolve, reject) => {
            expenseStore.clear().onsuccess = resolve;
        });

        await new Promise((resolve, reject) => {
            categoryStore.clear().onsuccess = resolve;
        });

        // Import categories
        if (data.categories) {
            for (const category of data.categories) {
                await this.addCategory(category);
            }
        }

        // Import expenses
        if (data.expenses) {
            for (const expense of data.expenses) {
                await this.addExpense(expense);
            }
        }

        return true;
    }

    /**
     * Get quarterly statistics
     */
    async getQuarterlyStats(year, quarter) {
        const quarters = {
            1: { start: `${year}-01-01`, end: `${year}-03-31` },
            2: { start: `${year}-04-01`, end: `${year}-06-30` },
            3: { start: `${year}-07-01`, end: `${year}-09-30` },
            4: { start: `${year}-10-01`, end: `${year}-12-31` }
        };

        const { start, end } = quarters[quarter];
        const expenses = await this.getExpensesByDateRange(start, end);

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.expenseAmount, 0);
        const totalDeductible = expenses.reduce((sum, exp) => sum + exp.deductible, 0);

        // Group by category
        const byCategory = {};
        expenses.forEach(exp => {
            if (!byCategory[exp.expenseCategory]) {
                byCategory[exp.expenseCategory] = {
                    count: 0,
                    totalAmount: 0,
                    totalDeductible: 0
                };
            }
            byCategory[exp.expenseCategory].count++;
            byCategory[exp.expenseCategory].totalAmount += exp.expenseAmount;
            byCategory[exp.expenseCategory].totalDeductible += exp.deductible;
        });

        return {
            quarter,
            year,
            totalExpenses,
            totalDeductible,
            expenseCount: expenses.length,
            byCategory,
            expenses
        };
    }

    /**
     * Clear all data from all stores
     */
    async clearAllData() {
        const transaction = this.db.transaction(['expenses', 'categories', 'settings'], 'readwrite');

        const expenseStore = transaction.objectStore('expenses');
        const categoryStore = transaction.objectStore('categories');
        const settingsStore = transaction.objectStore('settings');

        await new Promise((resolve, reject) => {
            expenseStore.clear().onsuccess = resolve;
            expenseStore.clear().onerror = reject;
        });

        await new Promise((resolve, reject) => {
            categoryStore.clear().onsuccess = resolve;
            categoryStore.clear().onerror = reject;
        });

        await new Promise((resolve, reject) => {
            settingsStore.clear().onsuccess = resolve;
            settingsStore.clear().onerror = reject;
        });

        return true;
    }
}

// Create a singleton instance
const db = new Database();

// Export the instance
window.db = db;
