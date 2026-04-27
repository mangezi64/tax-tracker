"""
Database Models for Tax Deductible Tracker
Uses SQLAlchemy with SQLite for local data persistence.
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Create the SQLAlchemy instance (initialized in app.py)
db = SQLAlchemy()


class Category(db.Model):
    """Expense categories (e.g., Internet, Electricity, Furniture)"""

    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    icon = db.Column(db.String(10), default="📦")
    color = db.Column(db.String(20), default="#4c9aff")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "icon": self.icon,
            "color": self.color,
        }


class Expense(db.Model):
    """Individual expense records with deductible calculations"""

    __tablename__ = "expenses"

    id = db.Column(db.Integer, primary_key=True)
    date_paid = db.Column(db.Date, nullable=False)
    merchant = db.Column(db.String(200), nullable=False)
    expense_details = db.Column(db.String(500), nullable=False)
    expense_category = db.Column(db.String(100), nullable=False)
    expense_amount = db.Column(db.Float, nullable=False)
    percent_used_for_work = db.Column(db.Integer, nullable=False, default=100)
    deductible = db.Column(db.Float, nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationship to receipts (deletes receipts when expense is deleted)
    receipts = db.relationship(
        "Receipt", backref="expense", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "date_paid": self.date_paid.isoformat(),
            "merchant": self.merchant,
            "expense_details": self.expense_details,
            "expense_category": self.expense_category,
            "expense_amount": self.expense_amount,
            "percent_used_for_work": self.percent_used_for_work,
            "deductible": self.deductible,
            "notes": self.notes or "",
            "created_at": self.created_at.isoformat() if self.created_at else "",
            "receipts": [r.to_dict() for r in self.receipts],
        }


class Receipt(db.Model):
    """Receipt files attached to expenses (stored on disk in uploads/)"""

    __tablename__ = "receipts"

    id = db.Column(db.Integer, primary_key=True)
    expense_id = db.Column(db.Integer, db.ForeignKey("expenses.id"), nullable=False)
    filename = db.Column(db.String(255), nullable=False)  # UUID filename on disk
    original_filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50))
    file_size = db.Column(db.Integer, default=0)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "expense_id": self.expense_id,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "file_type": self.file_type,
            "file_size": self.file_size,
        }


class Setting(db.Model):
    """Key-value settings store (Google credentials, preferences, etc.)"""

    __tablename__ = "settings"

    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text)
