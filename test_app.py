import pytest
from app import app
from models import db, Category, Expense


@pytest.fixture
def client():
    # Configure app for testing
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with app.test_client() as client:
        with app.app_context():
            db.create_all()

            # Initialize default categories
            if Category.query.count() == 0:
                cat = Category(name="Internet", icon="🌐", color="#4c9aff")
                db.session.add(cat)
                db.session.commit()

            yield client

            # Cleanup
            db.session.remove()
            db.drop_all()


def test_dashboard_loads(client):
    """Test that the dashboard page loads successfully"""
    rv = client.get("/")
    assert rv.status_code == 200
    assert b"Dashboard" in rv.data
    assert b"Total Expenses" in rv.data


def test_expenses_page_loads(client):
    """Test that the expenses list page loads"""
    rv = client.get("/expenses")
    assert rv.status_code == 200
    assert b"All Expenses" in rv.data


def test_add_expense(client):
    """Test adding a new expense"""
    rv = client.post(
        "/expenses/add",
        data={
            "date_paid": "2025-05-15",
            "merchant": "Econet",
            "expense_details": "Monthly Data",
            "expense_category": "Internet",
            "expense_amount": "50.00",
            "percent_used_for_work": "100",
            "notes": "Test note",
        },
        follow_redirects=True,
    )

    assert rv.status_code == 200
    assert b"Expense added successfully!" in rv.data

    # Verify in DB
    with app.app_context():
        exp = Expense.query.filter_by(merchant="Econet").first()
        assert exp is not None
        assert exp.expense_amount == 50.00
        assert exp.deductible == 50.00
        assert exp.percent_used_for_work == 100


def test_reports_page_loads(client):
    """Test that the reports page loads"""
    rv = client.get("/reports")
    assert rv.status_code == 200
    assert b"Reports" in rv.data
    assert b"Quarterly" in rv.data
    assert b"Annual" in rv.data
