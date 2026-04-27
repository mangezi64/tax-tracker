"""Tax Deductible Tracker - Flask Application"""

import os
import json
import uuid
import csv
import io
from datetime import datetime, date
from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    jsonify,
    send_file,
    session,
    Response,
)
from models import db, Expense, Category, Receipt, Setting
from fpdf import FPDF

# ── App Setup ──────────────────────────────────────────────
app = Flask(__name__)
app.config["SECRET_KEY"] = "change-this-to-a-random-secret-key"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///tax_tracker.db"
app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(__file__), "uploads")
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
db.init_app(app)
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]

DEFAULT_CATEGORIES = [
    ("Internet", "🌐", "#4c9aff"),
    ("Electricity", "⚡", "#ffab00"),
    ("Computer", "💻", "#36b37e"),
    ("Furniture", "🪑", "#ff5630"),
    ("Office Supplies", "📎", "#00b8d9"),
    ("Software", "💿", "#ff8b00"),
    ("Professional Services", "🤝", "#00875a"),
    ("Travel", "✈️", "#5243aa"),
    ("Mobile Device", "📱", "#ff991f"),
    ("Other", "📋", "#8993a4"),
]


def fmt_currency(amount):
    return f"{amount:,.2f}"


@app.template_filter("currency")
def currency_filter(amount):
    return fmt_currency(amount)


def init_defaults():
    if Category.query.count() == 0:
        for name, icon, color in DEFAULT_CATEGORIES:
            db.session.add(Category(name=name, icon=icon, color=color))
        db.session.commit()


# ── Dashboard ──────────────────────────────────────────────
@app.route("/")
def dashboard():
    expenses = Expense.query.all()
    total_exp = sum(e.expense_amount for e in expenses)
    total_ded = sum(e.deductible for e in expenses)
    now = datetime.now()
    q = (now.month - 1) // 3 + 1
    q_expenses = [
        e
        for e in expenses
        if e.date_paid.year == now.year and (e.date_paid.month - 1) // 3 + 1 == q
    ]
    q_ded = sum(e.deductible for e in q_expenses)
    cats = {}
    for e in expenses:
        c = cats.setdefault(
            e.expense_category, {"amount": 0, "deductible": 0, "count": 0}
        )
        c["amount"] += e.expense_amount
        c["deductible"] += e.deductible
        c["count"] += 1
    months = {}
    for e in expenses:
        key = e.date_paid.strftime("%Y-%m")
        months[key] = months.get(key, 0) + e.deductible
    sorted_months = sorted(months.items())[-6:]
    recent = sorted(expenses, key=lambda e: e.date_paid, reverse=True)[:5]
    return render_template(
        "dashboard.html",
        total_expenses=total_exp,
        total_deductible=total_ded,
        q_deductible=q_ded,
        quarter=q,
        year=now.year,
        expense_count=len(expenses),
        categories=cats,
        monthly_trend=sorted_months,
        recent=recent,
    )


# ── Expenses ──────────────────────────────────────────────
@app.route("/expenses")
def expenses():
    query = Expense.query
    search = request.args.get("search", "")
    cat_filter = request.args.get("category", "all")
    year_filter = request.args.get("year", "all")
    quarter_filter = request.args.get("quarter", "all")
    if search:
        query = query.filter(
            db.or_(
                Expense.merchant.ilike(f"%{search}%"),
                Expense.expense_details.ilike(f"%{search}%"),
            )
        )
    if cat_filter != "all":
        query = query.filter_by(expense_category=cat_filter)
    if year_filter != "all":
        y = int(year_filter)
        query = query.filter(db.extract("year", Expense.date_paid) == y)
    if quarter_filter != "all":
        q = int(quarter_filter)
        months = {1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]}
        query = query.filter(db.extract("month", Expense.date_paid).in_(months[q]))
    exp_list = query.order_by(Expense.date_paid.desc()).all()
    categories = Category.query.order_by(Category.name).all()
    current_year = datetime.now().year
    years = list(range(current_year, current_year - 11, -1))
    return render_template(
        "expenses.html",
        expenses=exp_list,
        categories=categories,
        years=years,
        search=search,
        cat_filter=cat_filter,
        year_filter=year_filter,
        quarter_filter=quarter_filter,
    )


@app.route("/expenses/add", methods=["POST"])
def add_expense():
    amount = float(request.form["expense_amount"])
    pct = int(request.form["percent_used_for_work"])
    exp = Expense(
        date_paid=date.fromisoformat(request.form["date_paid"]),
        merchant=request.form["merchant"],
        expense_details=request.form["expense_details"],
        expense_category=request.form["expense_category"],
        expense_amount=amount,
        percent_used_for_work=pct,
        deductible=round(amount * pct / 100, 2),
        notes=request.form.get("notes", ""),
    )
    db.session.add(exp)
    db.session.flush()
    for f in request.files.getlist("receipts"):
        if f and f.filename:
            ext = os.path.splitext(f.filename)[1]
            fname = str(uuid.uuid4()) + ext
            f.save(os.path.join(app.config["UPLOAD_FOLDER"], fname))
            db.session.add(
                Receipt(
                    expense_id=exp.id,
                    filename=fname,
                    original_filename=f.filename,
                    file_type=f.content_type,
                    file_size=f.content_length or 0,
                )
            )
    db.session.commit()
    flash("Expense added successfully!", "success")
    return redirect(url_for("expenses"))


@app.route("/expenses/<int:id>/edit", methods=["POST"])
def edit_expense(id):
    exp = Expense.query.get_or_404(id)
    exp.date_paid = date.fromisoformat(request.form["date_paid"])
    exp.merchant = request.form["merchant"]
    exp.expense_details = request.form["expense_details"]
    exp.expense_category = request.form["expense_category"]
    exp.expense_amount = float(request.form["expense_amount"])
    exp.percent_used_for_work = int(request.form["percent_used_for_work"])
    exp.deductible = round(exp.expense_amount * exp.percent_used_for_work / 100, 2)
    exp.notes = request.form.get("notes", "")
    for f in request.files.getlist("receipts"):
        if f and f.filename:
            ext = os.path.splitext(f.filename)[1]
            fname = str(uuid.uuid4()) + ext
            f.save(os.path.join(app.config["UPLOAD_FOLDER"], fname))
            db.session.add(
                Receipt(
                    expense_id=exp.id,
                    filename=fname,
                    original_filename=f.filename,
                    file_type=f.content_type,
                )
            )
    db.session.commit()
    flash("Expense updated!", "success")
    return redirect(url_for("expenses"))


@app.route("/expenses/<int:id>/delete", methods=["POST"])
def delete_expense(id):
    exp = Expense.query.get_or_404(id)
    for r in exp.receipts:
        path = os.path.join(app.config["UPLOAD_FOLDER"], r.filename)
        if os.path.exists(path):
            os.remove(path)
    db.session.delete(exp)
    db.session.commit()
    flash("Expense deleted.", "success")
    return redirect(url_for("expenses"))


@app.route("/api/expenses/<int:id>")
def get_expense_json(id):
    return jsonify(Expense.query.get_or_404(id).to_dict())


@app.route("/receipts/<int:id>/download")
def download_receipt(id):
    r = Receipt.query.get_or_404(id)
    path = os.path.join(app.config["UPLOAD_FOLDER"], r.filename)
    return send_file(path, download_name=r.original_filename)


@app.route("/receipts/<int:id>/delete", methods=["POST"])
def delete_receipt(id):
    r = Receipt.query.get_or_404(id)
    path = os.path.join(app.config["UPLOAD_FOLDER"], r.filename)
    if os.path.exists(path):
        os.remove(path)
    db.session.delete(r)
    db.session.commit()
    flash("Receipt deleted.", "success")
    return redirect(url_for("expenses"))


# ── Categories ─────────────────────────────────────────────
@app.route("/categories/add", methods=["POST"])
def add_category():
    name = request.form.get("name", "").strip()
    icon = request.form.get("icon", "📦")
    if name:
        if not Category.query.filter_by(name=name).first():
            db.session.add(Category(name=name, icon=icon, color="#4c9aff"))
            db.session.commit()
            flash(f'Category "{name}" added!', "success")
        else:
            flash("Category already exists.", "warning")
    return redirect(request.referrer or url_for("expenses"))


# ── Report Helpers ─────────────────────────────────────────
def get_quarterly_stats(year, quarter):
    months = {1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]}[quarter]
    exps = (
        Expense.query.filter(
            db.extract("year", Expense.date_paid) == year,
            db.extract("month", Expense.date_paid).in_(months),
        )
        .order_by(Expense.date_paid)
        .all()
    )
    total_exp = sum(e.expense_amount for e in exps)
    total_ded = sum(e.deductible for e in exps)
    cats = {}
    for e in exps:
        c = cats.setdefault(
            e.expense_category, {"count": 0, "amount": 0, "deductible": 0}
        )
        c["count"] += 1
        c["amount"] += e.expense_amount
        c["deductible"] += e.deductible
    return {
        "year": year,
        "quarter": quarter,
        "expenses": exps,
        "total_expenses": total_exp,
        "total_deductible": total_ded,
        "count": len(exps),
        "by_category": cats,
    }


def get_annual_stats(year):
    exps = (
        Expense.query.filter(db.extract("year", Expense.date_paid) == year)
        .order_by(Expense.date_paid)
        .all()
    )
    total_exp = sum(e.expense_amount for e in exps)
    total_ded = sum(e.deductible for e in exps)
    cats = {}
    for e in exps:
        c = cats.setdefault(
            e.expense_category, {"count": 0, "amount": 0, "deductible": 0}
        )
        c["count"] += 1
        c["amount"] += e.expense_amount
        c["deductible"] += e.deductible
    by_quarter = {}
    for q in range(1, 5):
        ms = {1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12]}[q]
        qe = [e for e in exps if e.date_paid.month in ms]
        by_quarter[q] = {
            "count": len(qe),
            "total": sum(e.expense_amount for e in qe),
            "deductible": sum(e.deductible for e in qe),
        }
    by_month = {}
    for e in exps:
        m = e.date_paid.month - 1
        c = by_month.setdefault(m, {"count": 0, "amount": 0, "deductible": 0})
        c["count"] += 1
        c["amount"] += e.expense_amount
        c["deductible"] += e.deductible
    return {
        "year": year,
        "expenses": exps,
        "total_expenses": total_exp,
        "total_deductible": total_ded,
        "count": len(exps),
        "by_category": cats,
        "by_quarter": by_quarter,
        "by_month": by_month,
    }


# ── Reports ────────────────────────────────────────────────
@app.route("/reports")
def reports():
    rtype = request.args.get("type", "")
    year = request.args.get("year", datetime.now().year, type=int)
    quarter = request.args.get("quarter", (datetime.now().month - 1) // 3 + 1, type=int)
    current_year = datetime.now().year
    years = list(range(current_year, current_year - 6, -1))
    report = None
    if rtype == "quarterly":
        report = get_quarterly_stats(year, quarter)
    elif rtype == "annual":
        report = get_annual_stats(year)
    return render_template(
        "reports.html",
        report=report,
        report_type=rtype,
        year=year,
        quarter=quarter,
        years=years,
        month_names=MONTH_NAMES,
    )


@app.route("/reports/csv")
def export_csv():
    rtype = request.args.get("type", "quarterly")
    year = request.args.get("year", type=int)
    quarter = request.args.get("quarter", 1, type=int)
    if rtype == "annual":
        stats = get_annual_stats(year)
        fname = f"ZIMRA_Annual_Report_{year}.csv"
    else:
        stats = get_quarterly_stats(year, quarter)
        fname = f"ZIMRA_QPD_Q{quarter}_{year}.csv"
    output = io.StringIO()
    w = csv.writer(output)
    w.writerow(
        [
            "Date Paid",
            "Merchant",
            "Details",
            "Category",
            "Amount",
            "% Work",
            "Deductible",
            "Notes",
        ]
    )
    for e in stats["expenses"]:
        w.writerow(
            [
                e.date_paid.isoformat(),
                e.merchant,
                e.expense_details,
                e.expense_category,
                f"{e.expense_amount:.2f}",
                e.percent_used_for_work,
                f"{e.deductible:.2f}",
                e.notes or "",
            ]
        )
    w.writerow([])
    w.writerow(["Total Expenses", f"${stats['total_expenses']:.2f}"])
    w.writerow(["Total Deductible", f"${stats['total_deductible']:.2f}"])
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


@app.route("/reports/pdf")
def export_pdf():
    rtype = request.args.get("type", "quarterly")
    year = request.args.get("year", type=int)
    quarter = request.args.get("quarter", 1, type=int)
    if rtype == "annual":
        stats = get_annual_stats(year)
        title = f"ZIMRA Annual Tax Deduction Report - {year}"
        fname = f"ZIMRA_Annual_Report_{year}.pdf"
    else:
        stats = get_quarterly_stats(year, quarter)
        title = f"ZIMRA QPD Quarterly Report - Q{quarter} {year}"
        fname = f"ZIMRA_QPD_Q{quarter}_{year}.pdf"
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(
        0,
        7,
        f"Generated: {datetime.now().strftime('%d %b %Y')}",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.cell(0, 7, f"Total Expenses: {stats['count']}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.set_fill_color(230, 230, 230)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(
        0,
        10,
        f"  Total Amount: ${fmt_currency(stats['total_expenses'])}   |   "
        f"Total Deductible: ${fmt_currency(stats['total_deductible'])}",
        fill=True,
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(5)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, "Expense Details", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    for i, e in enumerate(stats["expenses"]):
        if pdf.get_y() > 260:
            pdf.add_page()
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(
            0,
            5,
            f"{i + 1}. {e.date_paid} - {e.merchant}",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(
            0,
            5,
            f"   {e.expense_details} ({e.expense_category})",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        pdf.cell(
            0,
            5,
            f"   Amount: ${e.expense_amount:.2f} | Work: {e.percent_used_for_work}% | "
            f"Deductible: ${e.deductible:.2f}",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        pdf.ln(2)
    n = pdf.pages_count
    for i in range(1, n + 1):
        pdf.page = i
        pdf.set_y(285)
        pdf.set_font("Helvetica", "I", 8)
        pdf.cell(0, 5, f"Page {i}/{n} - Tax Deductible Tracker", align="C")
    buf = io.BytesIO(pdf.output())
    return send_file(buf, mimetype="application/pdf", download_name=fname)


# ── Backup ─────────────────────────────────────────────────
@app.route("/settings")
def settings():
    return render_template("settings.html")


@app.route("/backup/export")
def backup_export():
    data = {
        "expenses": [e.to_dict() for e in Expense.query.all()],
        "categories": [c.to_dict() for c in Category.query.all()],
        "export_date": datetime.now().isoformat(),
        "version": 1,
    }
    buf = io.BytesIO(json.dumps(data, indent=2).encode())
    return send_file(
        buf,
        mimetype="application/json",
        download_name=f"tax_tracker_backup_{datetime.now().strftime('%Y%m%d')}.json",
    )


@app.route("/backup/import", methods=["POST"])
def backup_import():
    f = request.files.get("backup_file")
    if not f:
        flash("No file selected.", "danger")
        return redirect(url_for("settings"))
    try:
        data = json.load(f)
        Expense.query.delete()
        Category.query.delete()
        for c in data.get("categories", []):
            db.session.add(
                Category(
                    name=c["name"],
                    icon=c.get("icon", "📦"),
                    color=c.get("color", "#4c9aff"),
                )
            )
        for e in data.get("expenses", []):
            db.session.add(
                Expense(
                    date_paid=date.fromisoformat(e["date_paid"]),
                    merchant=e["merchant"],
                    expense_details=e["expense_details"],
                    expense_category=e["expense_category"],
                    expense_amount=e["expense_amount"],
                    percent_used_for_work=e["percent_used_for_work"],
                    deductible=e["deductible"],
                    notes=e.get("notes", ""),
                )
            )
        db.session.commit()
        flash(f"Imported {len(data.get('expenses', []))} expenses!", "success")
    except Exception as ex:
        flash(f"Import failed: {ex}", "danger")
    return redirect(url_for("settings"))


@app.route("/data/clear", methods=["POST"])
def clear_data():
    Receipt.query.delete()
    Expense.query.delete()
    Category.query.delete()
    Setting.query.delete()
    db.session.commit()
    init_defaults()
    flash("All data cleared.", "success")
    return redirect(url_for("settings"))


# ── Google Drive ───────────────────────────────────────────
@app.route("/google/credentials", methods=["POST"])
def save_google_creds():
    cid = request.form.get("client_id", "").strip()
    csec = request.form.get("client_secret", "").strip()
    if cid and csec:
        for k, v in [("google_client_id", cid), ("google_client_secret", csec)]:
            s = Setting.query.get(k)
            if s:
                s.value = v
            else:
                db.session.add(Setting(key=k, value=v))
        db.session.commit()
        flash("Google credentials saved!", "success")
    else:
        flash("Both Client ID and Client Secret are required.", "danger")
    return redirect(url_for("settings"))


@app.route("/google/auth")
def google_auth():
    try:
        from google_auth_oauthlib.flow import Flow

        cid = Setting.query.get("google_client_id")
        csec = Setting.query.get("google_client_secret")
        if not cid or not csec:
            flash("Set Google credentials first.", "danger")
            return redirect(url_for("settings"))
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": cid.value,
                    "client_secret": csec.value,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=["https://www.googleapis.com/auth/drive.file"],
            redirect_uri=url_for("google_callback", _external=True),
        )
        auth_url, state = flow.authorization_url(prompt="consent")
        session["google_state"] = state
        return redirect(auth_url)
    except Exception as ex:
        flash(f"Google auth error: {ex}", "danger")
        return redirect(url_for("settings"))


@app.route("/google/callback")
def google_callback():
    try:
        from google_auth_oauthlib.flow import Flow

        cid = Setting.query.get("google_client_id")
        csec = Setting.query.get("google_client_secret")
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": cid.value,
                    "client_secret": csec.value,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=["https://www.googleapis.com/auth/drive.file"],
            redirect_uri=url_for("google_callback", _external=True),
        )
        flow.fetch_token(authorization_response=request.url)
        creds = flow.credentials
        token_data = json.dumps(
            {
                "token": creds.token,
                "refresh_token": creds.refresh_token,
                "token_uri": creds.token_uri,
                "client_id": creds.client_id,
                "client_secret": creds.client_secret,
            }
        )
        s = Setting.query.get("google_tokens")
        if s:
            s.value = token_data
        else:
            db.session.add(Setting(key="google_tokens", value=token_data))
        db.session.commit()
        flash("Connected to Google Drive!", "success")
    except Exception as ex:
        flash(f"Google auth failed: {ex}", "danger")
    return redirect(url_for("settings"))


def get_drive_service():
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    s = Setting.query.get("google_tokens")
    if not s:
        return None
    info = json.loads(s.value)
    creds = Credentials(
        token=info["token"],
        refresh_token=info.get("refresh_token"),
        token_uri=info["token_uri"],
        client_id=info["client_id"],
        client_secret=info["client_secret"],
    )
    return build("drive", "v3", credentials=creds)


@app.route("/google/backup", methods=["POST"])
def google_backup():
    try:
        from googleapiclient.http import MediaInMemoryUpload

        service = get_drive_service()
        if not service:
            flash("Not connected to Google Drive.", "danger")
            return redirect(url_for("settings"))
        data = json.dumps(
            {
                "expenses": [e.to_dict() for e in Expense.query.all()],
                "categories": [c.to_dict() for c in Category.query.all()],
                "export_date": datetime.now().isoformat(),
            },
            indent=2,
        )
        media = MediaInMemoryUpload(data.encode(), mimetype="application/json")
        fname = f"tax_tracker_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        service.files().create(
            body={"name": fname, "mimeType": "application/json"}, media_body=media
        ).execute()
        flash(f"Backup saved to Google Drive: {fname}", "success")
    except Exception as ex:
        flash(f"Google backup failed: {ex}", "danger")
    return redirect(url_for("settings"))


@app.route("/google/restore", methods=["POST"])
def google_restore():
    try:
        service = get_drive_service()
        if not service:
            flash("Not connected to Google Drive.", "danger")
            return redirect(url_for("settings"))
        results = (
            service.files()
            .list(
                q="name contains 'tax_tracker_backup' and mimeType='application/json'",
                orderBy="modifiedTime desc",
                pageSize=1,
                fields="files(id,name)",
            )
            .execute()
        )
        files = results.get("files", [])
        if not files:
            flash("No backup found on Google Drive.", "warning")
            return redirect(url_for("settings"))
        content = service.files().get_media(fileId=files[0]["id"]).execute()
        data = json.loads(content)
        Expense.query.delete()
        Category.query.delete()
        for c in data.get("categories", []):
            db.session.add(
                Category(
                    name=c["name"],
                    icon=c.get("icon", "📦"),
                    color=c.get("color", "#4c9aff"),
                )
            )
        for e in data.get("expenses", []):
            db.session.add(
                Expense(
                    date_paid=date.fromisoformat(e["date_paid"]),
                    merchant=e["merchant"],
                    expense_details=e["expense_details"],
                    expense_category=e["expense_category"],
                    expense_amount=e["expense_amount"],
                    percent_used_for_work=e["percent_used_for_work"],
                    deductible=e["deductible"],
                    notes=e.get("notes", ""),
                )
            )
        db.session.commit()
        flash(f"Restored from: {files[0]['name']}", "success")
    except Exception as ex:
        flash(f"Google restore failed: {ex}", "danger")
    return redirect(url_for("settings"))


# ── Run ────────────────────────────────────────────────────
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        init_defaults()
    app.run(debug=True, port=8000)
