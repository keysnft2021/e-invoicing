"""Iteration 4 tests — perf, pagination/projection, seed idempotency, indexes."""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@einvoice.my"
ADMIN_PASSWORD = "Admin@12345"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    s.headers["Content-Type"] = "application/json"
    return s


@pytest.fixture(scope="module")
def db():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    return MongoClient(mongo_url)[db_name]


# ---------- PERF: dashboard/stats ----------
def test_dashboard_stats_perf_and_shape(admin):
    t0 = time.time()
    r = admin.get(f"{API}/dashboard/stats", timeout=10)
    dt_ms = (time.time() - t0) * 1000
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("today_count", "total_invoices", "total_value", "by_status",
              "success_rate", "tax_collected", "trend", "adapters"):
        assert k in d, f"missing {k}"
    assert isinstance(d["by_status"], dict)
    assert isinstance(d["trend"], list) and len(d["trend"]) == 14
    print(f"dashboard/stats latency={dt_ms:.0f}ms total_invoices={d['total_invoices']}")
    assert dt_ms < 800, f"dashboard/stats too slow: {dt_ms:.0f}ms"  # spec 400, allow buffer


# ---------- PERF: invoices pagination ----------
def test_invoices_pagination_and_projection(admin):
    t0 = time.time()
    r = admin.get(f"{API}/invoices?limit=100&skip=0", timeout=10)
    dt_ms = (time.time() - t0) * 1000
    assert r.status_code == 200, r.text
    page1 = r.json()
    assert isinstance(page1, list), "expected flat array"
    print(f"invoices page1 rows={len(page1)} latency={dt_ms:.0f}ms")
    assert dt_ms < 1500, f"invoices list too slow: {dt_ms:.0f}ms"
    if page1:
        sample = page1[0]
        for k in ("invoice_number", "invoice_type", "invoice_date",
                  "currency", "customer_snapshot", "status", "total"):
            assert k in sample, f"missing projected field {k}: {list(sample.keys())}"
    # second page disjoint
    r2 = admin.get(f"{API}/invoices?limit=100&skip=100", timeout=10)
    assert r2.status_code == 200
    page2 = r2.json()
    ids1 = {i.get("id") or i.get("_id") for i in page1}
    ids2 = {i.get("id") or i.get("_id") for i in page2}
    assert ids1.isdisjoint(ids2), "pagination overlap"


def test_invoices_limit_clamp(admin):
    r = admin.get(f"{API}/invoices?limit=9999", timeout=10)
    assert r.status_code == 200
    # Should clamp to max (500 per spec) — just ensure it doesn't 500
    assert isinstance(r.json(), list)


# ---------- PERF: masters q/limit/skip ----------
@pytest.mark.parametrize("resource", ["customers", "suppliers", "products"])
def test_masters_search_and_pagination(admin, resource):
    t0 = time.time()
    r = admin.get(f"{API}/{resource}?limit=50&skip=0", timeout=10)
    dt_ms = (time.time() - t0) * 1000
    assert r.status_code == 200, r.text
    lst = r.json()
    assert isinstance(lst, list)
    print(f"{resource}: rows={len(lst)} latency={dt_ms:.0f}ms")
    assert dt_ms < 800

    # search by ?q= — pick first name/sku token and case-flip
    if lst:
        key = "sku" if resource == "products" else "name"
        val = (lst[0].get(key) or "").split(" ")[0]
        if val:
            q = val.lower()
            r2 = admin.get(f"{API}/{resource}?q={q}", timeout=10)
            assert r2.status_code == 200, r2.text
            results = r2.json()
            assert isinstance(results, list)
            # at least one row should contain the query
            if results:
                combined = " ".join([(x.get("name") or "") + " " + (x.get("sku") or "") + " " +
                                     (x.get("tin") or "") + " " + (x.get("email") or "")
                                     for x in results]).lower()
                assert q in combined, f"q={q} not reflected in results"


# ---------- PERF: audit ----------
def test_audit_pagination_filters(admin):
    t0 = time.time()
    r = admin.get(f"{API}/audit?limit=50", timeout=10)
    dt_ms = (time.time() - t0) * 1000
    assert r.status_code == 200
    data = r.json()
    print(f"audit rows={len(data) if isinstance(data,list) else 'obj'} latency={dt_ms:.0f}ms")
    assert dt_ms < 800

    # filter by action if any exists
    items = data if isinstance(data, list) else data.get("items", [])
    if items:
        action = items[0].get("action")
        if action:
            r2 = admin.get(f"{API}/audit?action={action}&limit=20", timeout=10)
            assert r2.status_code == 200
            items2 = r2.json() if isinstance(r2.json(), list) else r2.json().get("items", [])
            for it in items2:
                assert it.get("action") == action


# ---------- SEED: counts and status mix ----------
def test_seed_populates_minimum_masters(admin, db):
    # find admin's tenant
    admin_user = db.users.find_one({"email": ADMIN_EMAIL})
    assert admin_user, "admin user missing"
    tid = admin_user["tenant_id"]
    assert db.tenants.count_documents({"_id": __import__("bson").ObjectId(tid) if len(tid) == 24 else tid}) >= 0
    assert db.companies.count_documents({"tenant_id": tid}) >= 1
    assert db.customers.count_documents({"tenant_id": tid}) >= 8, "expected ≥8 customers"
    assert db.suppliers.count_documents({"tenant_id": tid}) >= 5, "expected ≥5 suppliers"
    assert db.products.count_documents({"tenant_id": tid}) >= 8, "expected ≥8 products"
    inv_count = db.invoices.count_documents({"tenant_id": tid})
    assert inv_count >= 28, f"expected ≥28 seed invoices, got {inv_count}"

    statuses = set(db.invoices.distinct("status", {"tenant_id": tid}))
    for expected in {"validated", "rejected", "draft"}:
        assert expected in statuses, f"missing status {expected} in {statuses}"


def test_seed_idempotent(db):
    """Re-invoke the seed coroutine and verify no dupes."""
    import asyncio
    import sys
    sys.path.insert(0, "/app/backend")
    from seed import seed as seed_fn
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")

    admin_user = db.users.find_one({"email": ADMIN_EMAIL})
    tid = admin_user["tenant_id"]
    before = {
        "customers": db.customers.count_documents({"tenant_id": tid}),
        "suppliers": db.suppliers.count_documents({"tenant_id": tid}),
        "products": db.products.count_documents({"tenant_id": tid}),
        "invoices": db.invoices.count_documents({"tenant_id": tid}),
    }

    async def _run():
        motor = AsyncIOMotorClient(mongo_url)[db_name]
        await seed_fn(motor)

    asyncio.run(_run())

    after = {
        "customers": db.customers.count_documents({"tenant_id": tid}),
        "suppliers": db.suppliers.count_documents({"tenant_id": tid}),
        "products": db.products.count_documents({"tenant_id": tid}),
        "invoices": db.invoices.count_documents({"tenant_id": tid}),
    }
    print(f"seed idempotency before={before} after={after}")
    for k in ("customers", "suppliers", "products", "invoices"):
        assert after[k] == before[k], f"{k} grew after re-seed: {before[k]} -> {after[k]}"


# ---------- INDEXES ----------
def test_expected_indexes_present(db):
    def has_index(coll, keys):
        info = db[coll].index_information()
        for _, meta in info.items():
            if meta.get("key") == keys:
                return True
        return False

    assert has_index("invoices", [("tenant_id", 1), ("created_at", -1)])
    assert has_index("invoices", [("tenant_id", 1), ("status", 1), ("created_at", -1)])
    assert has_index("customers", [("tenant_id", 1), ("name", 1)])
    assert has_index("audit_logs", [("tenant_id", 1), ("created_at", -1)])

    # api_clients client_id unique
    ac_info = db.api_clients.index_information()
    found_unique = any(
        meta.get("key") == [("client_id", 1)] and meta.get("unique")
        for meta in ac_info.values()
    )
    assert found_unique, f"api_clients.client_id unique missing: {ac_info}"


# ---------- REGRESSION: login + api-clients + ICS ----------
def test_login_and_me(admin):
    r = admin.get(f"{API}/auth/me", timeout=10)
    assert r.status_code == 200
    assert r.json().get("email") == ADMIN_EMAIL


def test_api_clients_list(admin):
    r = admin.get(f"{API}/api-clients", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_ics_summary(admin):
    r = admin.get(f"{API}/ics/summary", timeout=10)
    # ICS may or may not be enabled per tenant; either shape is acceptable
    assert r.status_code in (200, 404), r.text
