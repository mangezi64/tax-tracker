# Tax Deductible Tracker

A beautiful, Python-powered web application for tracking tax deductible expenses for ZIMRA quarterly and annual tax submissions.

## ✨ Features

- 💰 **Expense Tracking**: Record expenses with automatic deductible calculations
- 📎 **Receipt Management**: Upload and store receipt images/PDFs with each expense
- 📊 **Dashboard**: Visualizations of expenses by category and monthly trends
- 📅 **Quarterly Reports**: Generate ZIMRA QPD-ready reports by quarter
- 📆 **Annual Reports**: Full-year reports with quarterly breakdowns, monthly trends, and category summaries
- 📥 **Export Options**: Download reports as CSV or PDF (both quarterly and annual)
- 🌙 **Dark Mode**: Premium dark theme
- 💾 **Backup/Restore**: JSON export/import of all data
- ☁️ **Google Drive**: Optional cloud backup integration
- 🔒 **Privacy**: All data stored locally in SQLite — no external servers

## 🚀 Quick Start

```bash
# Navigate to project
cd /home/mangezi/projects/tax_deductables

# Activate virtual environment
source venv/bin/activate

# Run the app
python app.py

# Open in browser
# http://localhost:8000
```

### First-time setup (if venv doesn't exist):
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

## 🐍 Tech Stack

- **Backend**: Python 3 + Flask
- **Database**: SQLite via SQLAlchemy
- **Templates**: Jinja2 (server-side rendered)
- **PDF Export**: fpdf2 (pure Python)
- **Google Drive**: google-api-python-client
- **Styling**: Custom CSS dark theme
- **JavaScript**: Minimal (~50 lines) — only for modals and deductible preview

## 📖 How to Use

### Adding an Expense
1. Click **"Add Expense"** in the sidebar
2. Fill in: Date, Merchant, Details, Category, Amount, % Work Use
3. Upload receipt files (optional)
4. Click **"Save Expense"** — deductible is auto-calculated

### Reports
1. Go to **"Reports"** in the sidebar
2. Click **Quarterly** or **Annual**
3. Select the Year (and Quarter if quarterly)
4. Click **"Generate"** to preview
5. Export as **CSV** or **PDF**

### Backup & Restore
- **Export**: Downloads all data as a JSON file
- **Import**: Upload a JSON backup to restore
- **Google Drive**: Save credentials, sign in, then backup/restore to the cloud

## 📁 Project Structure

```
tax_deductables/
├── app.py                  # Flask app — all routes and logic
├── models.py               # Database models (Expense, Category, Receipt, Setting)
├── requirements.txt        # Python dependencies
├── templates/
│   ├── base.html           # Layout: sidebar, modals, flash messages
│   ├── dashboard.html      # Stats cards, category breakdown, trends
│   ├── expenses.html       # Expense list with server-side filters
│   ├── reports.html        # Quarterly + Annual reports
│   └── settings.html       # Backup, Google Drive, data management
├── static/css/
│   └── main.css            # Dark theme stylesheet
├── uploads/                # Receipt files (auto-created)
├── instance/
│   └── tax_tracker.db      # SQLite database (auto-created)
└── venv/                   # Python virtual environment
```

## 🏷️ Default Categories

Internet 🌐 · Electricity ⚡ · Computer 💻 · Furniture 🪑 · Office Supplies 📎 · Software 💿 · Professional Services 🤝 · Travel ✈️ · Mobile Device 📱 · Other 📋

Custom categories can be added anytime.

## 🔐 Privacy & Security

- ✅ All data stays on your computer (SQLite file)
- ✅ No external servers or tracking
- ✅ Receipts stored locally in `uploads/` directory
- ✅ Google Drive integration is optional and uses your own credentials

## 🐛 Troubleshooting

**App won't start**: Make sure you've activated the venv: `source venv/bin/activate`

**Port in use**: Change the port in `app.py` — last line: `app.run(debug=True, port=8001)`

**Missing dependencies**: Run `pip install -r requirements.txt`

## 🧪 Testing

The application includes a `pytest` test suite to verify all routes and database models.

To run the tests:
```bash
# Ensure your virtual environment is active
source venv/bin/activate

# Install test dependencies (if not already installed)
pip install pytest pytest-flask

# Run the test suite
pytest test_app.py -v
```

---

**Made with ❤️ and Python for Zimbabwean contractors**
