"""Iteration 5 tests — global clinic filter (company_id scope) across
Dashboard, ICS, Invoices, plus cross-tenant safety."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@einvoice.my"
ADMIN_PASSWORD = "Admin@12345"
PILOT_COMPANY_ID = "6a7330392b20661e6a9c08c6"  # GLOCO Pilot Clinic


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    s.headers["Content-Type"] = "application/json"
    return s


@pytest.fixture(scope="module")
def other_tenant():
    """Register a fresh tenant and return (session, its company_id)."""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    suffix = uuid.uuid4().hex[:8]
    email = f"tenant_{suffix}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email,
        "password": "Passw0rd!2345",
        "name": "Other Tenant",
        "tenant_name": f"OtherTenant-{suffix}",
        "company_name": "Other Tenant Sdn Bhd",
        "tin": "C99999999999",
        "brn": "202599991111",
    }, timeout=20)
    if r.status_code not in (200, 201):
        pytest.skip(f"Cannot register second tenant: {r.status_code} {r.text}")
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    # Fetch that tenant's companies (create if none)
    cr = s.get(f"{API}/companies", timeout=10)
    assert cr.status_code == 200, cr.text
    companies = cr.json()
    if not companies:
        create = s.post(f"{API}/companies", json={
            "name": "Other Tenant Sdn Bhd",
            "tin": "C99999999999",
            "brn": "202599991111",
        }, timeout=10)
        if create.status_code not in (200, 201):
            pytest.skip(f"Cannot create company for second tenant: {create.status_code} {create.text}")
        companies = [create.json()]
    return s, companies[0]["id"]


# ---------- Dashboard stats scope ----------
def test_dashboard_stats_unscoped_vs_scoped(admin):
    r_all = admin.get(f"{API}/dashboard/stats", timeout=15)
    assert r_all.status_code == 200
    r_pilot = admin.get(f"{API}/dashboard/stats?company_id={PILOT_COMPANY_ID}", timeout=15)
    assert r_pilot.status_code == 200
    total_all = r_all.json()["total_invoices"]
    total_pilot = r_pilot.json()["total_invoices"]
    assert total_pilot <= total_all, (total_pilot, total_all)
    assert total_pilot > 0, "Expected some invoices for pilot clinic"
    assert total_pilot < total_all, "Scoped should be strictly less than unscoped"


# ---------- ICS summary scope ----------
def test_ics_summary_unscoped_vs_scoped(admin):
    r_all = admin.get(f"{API}/ics/summary", timeout=15)
    r_pilot = admin.get(f"{API}/ics/summary?company_id={PILOT_COMPANY_ID}", timeout=15)
    assert r_all.status_code == 200 and r_pilot.status_code == 200
    a = r_all.json()
    p = r_pilot.json()
    assert p["sales_invoices"]["total_invoice_quantity"] <= a["sales_invoices"]["total_invoice_quantity"]
    for bucket in ("daily", "weekly", "monthly", "yearly"):
        assert p["statistics_type"][bucket] <= a["statistics_type"][bucket], bucket


# ---------- ICS transactions scope ----------
def test_ics_transactions_scoped(admin):
    r_all = admin.get(f"{API}/ics/transactions?limit=500", timeout=15)
    r_p = admin.get(f"{API}/ics/transactions?limit=500&company_id={PILOT_COMPANY_ID}", timeout=15)
    assert r_all.status_code == 200 and r_p.status_code == 200
    all_rows = r_all.json()["rows"]
    p_rows = r_p.json()["rows"]
    assert len(p_rows) <= len(all_rows)
    # Every scoped row must have company_id == pilot
    for row in p_rows:
        assert row.get("company_id") == PILOT_COMPANY_ID, row.get("company_id")


# ---------- Invoices list scope ----------
def test_invoices_scoped(admin):
    r_all = admin.get(f"{API}/invoices?limit=500", timeout=15)
    r_p = admin.get(f"{API}/invoices?limit=500&company_id={PILOT_COMPANY_ID}", timeout=15)
    assert r_all.status_code == 200 and r_p.status_code == 200
    all_rows = r_all.json()
    p_rows = r_p.json()
    assert len(p_rows) <= len(all_rows)
    for row in p_rows:
        assert row.get("company_id") == PILOT_COMPANY_ID


# ---------- Cross-tenant safety ----------
def test_cross_tenant_company_id_returns_no_data(admin, other_tenant):
    _, other_cid = other_tenant
    # Query with admin's token but the OTHER tenant's company_id
    r = admin.get(f"{API}/invoices?company_id={other_cid}&limit=500", timeout=15)
    assert r.status_code == 200
    assert r.json() == [] or all(row.get("company_id") == other_cid and False for row in r.json())

    r2 = admin.get(f"{API}/ics/transactions?company_id={other_cid}&limit=500", timeout=15)
    assert r2.status_code == 200
    assert r2.json()["rows"] == []

    r3 = admin.get(f"{API}/dashboard/stats?company_id={other_cid}", timeout=15)
    assert r3.status_code == 200
    assert r3.json()["total_invoices"] == 0

    r4 = admin.get(f"{API}/ics/summary?company_id={other_cid}", timeout=15)
    assert r4.status_code == 200
    assert r4.json()["sales_invoices"]["total_invoice_quantity"] == 0


# ---------- Regression ----------
def test_regression_login_and_api_clients(admin):
    r = admin.get(f"{API}/api-clients", timeout=10)
    assert r.status_code == 200
    r2 = admin.get(f"{API}/auth/me", timeout=10)
    assert r2.status_code == 200
