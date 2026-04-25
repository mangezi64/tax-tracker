# Tax Deductible Tracker

A beautiful, local-first web application for tracking tax deductible expenses for ZIMRA quarterly and annual tax submissions.

## ✨ Features

- 💰 **Expense Tracking**: Record expenses with automatic deductible calculations
- 📎 **Receipt Management**: Upload and store receipt images/PDFs with each expense
- 📊 **Dashboard**: Beautiful visualizations of expenses by category and trends
- 📅 **Quarterly Reports**: Generate ZIMRA QPD-ready reports by quarter
- 📆 **Annual Reports**: Generate full-year ZIMRA tax deduction reports with quarterly breakdowns, monthly trends, and category summaries
- 📥 **Export Options**: Download reports as CSV or PDF (both quarterly and annual)
- 🌙 **Dark Mode**: Premium dark theme for comfortable viewing
- 💾 **Auto-Save**: All data persists locally in your browser (IndexedDB)
- 🔒 **Privacy**: Zero backend - all data stays on your computer

## 🚀 Quick Start

### Option 1: Open Directly (Simplest)
1. Navigate to the project folder
2. Double-click `index.html` to open in your browser
3. Start tracking expenses!

### Option 2: Local Server (Recommended)
For better file handling and testing:

```bash
# Navigate to project directory
cd /home/mangezi/projects/tax_deductables

# Start a simple HTTP server (Python 3)
python3 -m http.server 8000

# OR use Node.js (if you have it)
npx -y http-server -p 8000

# OR use PHP
php -S localhost:8000
```

Then open your browser to: `http://localhost:8000`

## 📖 How to Use

### Adding an Expense
1. Click **"Add Expense"** button in sidebar
2. Fill in the details:
   - Date Paid
   - Merchant (e.g., "Econet Wireless")
   - Expense Details (e.g., "Monthly internet subscription")
   - Category (select from pre-configured list or add custom)
   - Expense Amount
   - % Used for Work (0-100)
3. Upload receipt(s) by clicking or dragging files
4. Click **"Save Expense"**

The deductible amount is automatically calculated as:
```
Deductible = Expense Amount × (% Used for Work / 100)
```

### Managing Receipts
- Drag and drop receipt files (images or PDFs) into the upload zone
- Each expense can have multiple receipts attached
- View receipts by clicking on an expense
- Download individual receipts when needed

### Reports
1. Go to the **"Reports"** tab in the sidebar
2. Choose your **Report Type**:
   - **📊 Quarterly**: For individual QPD quarter submissions
   - **📅 Annual**: For full-year ZIMRA tax submissions
3. Select the **Year** (and **Quarter** if quarterly)
4. Click **"Generate Report"** to preview
5. Export as:
   - **CSV**: For spreadsheet import/editing
   - **PDF**: For submission/printing

#### Annual Report Contents
The annual report includes:
- **Annual Summary**: Total expenses, total deductible, average deduction rate, average monthly deductible
- **Quarterly Breakdown**: Side-by-side comparison of all four quarters with % of annual totals
- **Monthly Trend**: Month-by-month expense and deduction tracking
- **Category Breakdown**: Spending by category with percentages
- **Detailed Expense List**: Every expense for the year, sorted chronologically

### Filtering & Search
On the Expenses page:
- **Search**: Find expenses by merchant, description, or notes
- **Category Filter**: View expenses from specific categories
- **Date Range**: Filter by month, quarter, or year

## 📁 Data Storage

All data is stored locally using **IndexedDB**, including:
- Expense records
- Receipt files (stored as base64)
- Custom categories
- Settings

**No internet connection required** after initial load!

## 🏷️ Pre-configured Categories

- Internet 🌐
- Electricity ⚡
- Computer 💻
- Furniture 🪑
- Office Supplies 📎
- Software 💿
- Professional Services 🤝
- Travel ✈️
- Mobile Device 📱
- Other 📋

You can add custom categories anytime!

## 💡 Tips

1. **Regular Backups**: Although data persists, periodically export your data (via CSV) as backup
2. **Receipt Quality**: Take clear photos of receipts for audit purposes
3. **Consistent Categories**: Use the same category names for easier quarterly analysis
4. **Work Percentage**: Be conservative - only claim the actual work-related portion
5. **ZIMRA Audits**: Keep all receipts! The app links receipts to expenses for easy audit compliance

## 🖥️ Browser Compatibility

Works best on:
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ⚠️ Safari (limited File System API support)

Requires modern browser with:
- IndexedDB support
- ES6+ JavaScript
- File API

## 📱 Responsive Design

The app works on:
- 💻 Desktop (best experience)
- 📱 Tablet
- 📱 Mobile (limited)

## 🛠️ Technical Stack

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Database**: IndexedDB (browser-based)
- **Storage**: Local file storage via File API
- **Charts**: Custom CSS visualizations
- **PDF Export**: jsPDF library
- **Zero Dependencies**: No backend, no npm, no build process!

## 📊 Project Structure

```
tax_deductables/
├── index.html              # Main application
├── test.html               # Script loading tests
├── styles/
│   └── main.css           # Dark mode design system
├── scripts/
│   ├── app.js             # Main controller & report type routing
│   ├── database.js        # IndexedDB wrapper (quarterly + annual stats)
│   ├── expenses.js        # Expense management
│   ├── receipts.js        # Receipt handling
│   ├── dashboard.js       # Dashboard visualizations
│   ├── reports.js         # Quarterly & annual report generation
│   └── backup.js          # Data backup & restore (JSON, Google Drive)
└── README.md              # This file
```

## 🔐 Privacy & Security

- ✅ All data stays on your computer
- ✅ No external servers or APIs (except CDN for jsPDF)
- ✅ No tracking or analytics
- ✅ No user accounts needed
- ⚠️ Browser data can be cleared - export backups regularly!

## 🐛 Troubleshooting

**Q: My expenses disappeared after clearing browser data**
A: Browser data clearing removes IndexedDB. Always export CSV backups regularly.

**Q: Receipt uploads not working**
A: Make sure files are under 10MB and are JPG/PNG/GIF/PDF format.

**Q: PDF export not working**
A: Check your internet connection (jsPDF loads from CDN). Refresh the page.

**Q: Application won't load**
A: Try opening in Chrome/Edge. Check browser console for errors (F12).

## 📝 License

Personal use application - created for individual contractor tax tracking.

## 🙋 Support

For ZIMRA QPD information, visit: https://www.zimra.co.zw/

---

**Made with ❤️ for Zimbabwean contractors**

Happy tax tracking! 🎉
