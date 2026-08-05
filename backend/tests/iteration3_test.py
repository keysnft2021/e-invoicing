"""Iteration-3 backend tests:
- SDK snippets endpoint (GET /api/api-clients/{id}/snippets)
- Per-client rate-limit (PUT /api/api-clients/{id}/rate-limit + enforcement on /api/external/invoices)
- Registration accepts rate_limit_per_hour
- Real LHDN preprod pilot submission (GLOCO Pilot Clinic → real UUID)
- Cross-tenant isolation for the two new endpoints
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@einvoice.my"
ADMIN_PASSWORD = "Admin@12345"
PILOT_COMPANY_ID = "6a7330392b20661e6a9c08c6"  # GLOCO Pilot Clinic
GLOCO_TIN = "C20923457010"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def second_tenant_session():
    s = requests.Session()
    uniq = uuid.uuid4().hex[:8]
    r = s.post(f"{API}/auth/register", json={
        "email": f"iso3_{uniq}@test.my", "password": "Owner@12345",
        "name": "Iso3 Owner", "tenant_name": f"TEST_Iso3_{uniq}"}, timeout=15)
    assert r.status_code in (200, 201), r.text
    tok = r.json().get("token") or r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


def _register_and_activate(session, name, rate_limit=None, company_id=PILOT_COMPANY_ID):
    body = {"name": name, "system_type": "EMR", "company_id": company_id}
    if rate_limit is not None:
        body["rate_limit_per_hour"] = rate_limit
    r = session.post(f"{API}/api-clients", json=body, timeout=15)
    assert r.status_code in (200, 201), r.text
    d = r.json()
    secret = d["client_secret"]
    cid = d["id"]
    client_id = d["client_id"]
    code = d["activation_code"]
    r2 = session.post(f"{API}/api-clients/{cid}/activate", json={"activation_code": code}, timeout=10)
    assert r2.status_code == 200, r2.text
    return {"id": cid, "client_id": client_id, "secret": secret,
            "rate_limit_per_hour": d.get("rate_limit_per_hour", 100)}


# ---------------- Snippets endpoint ----------------
def test_snippets_requires_auth(admin_session):
    # register a client we can query
    c = _register_and_activate(admin_session, f"TEST_Snip_{uuid.uuid4().hex[:6]}")
    # No auth
    r = requests.get(f"{API}/api-clients/{c['id']}/snippets", timeout=10)
    assert r.status_code in (401, 403), r.status_code


def test_snippets_shape_and_content(admin_session):
    c = _register_and_activate(admin_session, f"TEST_Snip_{uuid.uuid4().hex[:6]}", rate_limit=42)
    r = admin_session.get(f"{API}/api-clients/{c['id']}/snippets", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["client_id"] == c["client_id"]
    assert body["rate_limit_per_hour"] == 42
    assert body["bridge_url"].endswith("/api/external/invoices")
    snips = body.get("snippets") or {}
    for k in ("curl", "node", "python", "health"):
        assert k in snips and isinstance(snips[k], str) and len(snips[k]) > 20, f"missing snippet {k}"
    # curl snippet must contain the real client_id
    assert c["client_id"] in snips["curl"]
    assert c["client_id"] in snips["node"]
    assert c["client_id"] in snips["python"]
    assert c["client_id"] in snips["health"]


def test_snippets_404_for_wrong_id(admin_session):
    r = admin_session.get(f"{API}/api-clients/{uuid.uuid4().hex[:24]}/snippets", timeout=10)
    assert r.status_code in (400, 404), r.status_code


def test_snippets_cross_tenant_isolation(admin_session, second_tenant_session):
    c = _register_and_activate(admin_session, f"TEST_Snip_Iso_{uuid.uuid4().hex[:6]}")
    r = second_tenant_session.get(f"{API}/api-clients/{c['id']}/snippets", timeout=10)
    assert r.status_code in (403, 404), r.status_code


# ---------------- Rate-limit PUT ----------------
def test_rate_limit_put_updates_and_reflects(admin_session):
    c = _register_and_activate(admin_session, f"TEST_RL_{uuid.uuid4().hex[:6]}", rate_limit=5)
    r = admin_session.put(f"{API}/api-clients/{c['id']}/rate-limit",
                          json={"rate_limit_per_hour": 25}, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json().get("rate_limit_per_hour") == 25
    # Reflected on list
    lst = admin_session.get(f"{API}/api-clients", timeout=10).json()
    entry = next((x for x in lst if x["id"] == c["id"]), None)
    assert entry and entry["rate_limit_per_hour"] == 25
    # Reflected on snippets
    snip = admin_session.get(f"{API}/api-clients/{c['id']}/snippets", timeout=10).json()
    assert snip["rate_limit_per_hour"] == 25


def test_rate_limit_validation(admin_session):
    c = _register_and_activate(admin_session, f"TEST_RLv_{uuid.uuid4().hex[:6]}")
    r = admin_session.put(f"{API}/api-clients/{c['id']}/rate-limit",
                          json={"rate_limit_per_hour": 0}, timeout=10)
    assert r.status_code in (400, 422), r.status_code
    r = admin_session.put(f"{API}/api-clients/{c['id']}/rate-limit",
                          json={"rate_limit_per_hour": -5}, timeout=10)
    assert r.status_code in (400, 422), r.status_code


def test_rate_limit_cross_tenant(admin_session, second_tenant_session):
    c = _register_and_activate(admin_session, f"TEST_RL_Iso_{uuid.uuid4().hex[:6]}")
    r = second_tenant_session.put(f"{API}/api-clients/{c['id']}/rate-limit",
                                  json={"rate_limit_per_hour": 99}, timeout=10)
    assert r.status_code in (403, 404), r.status_code


def test_register_with_rate_limit(admin_session):
    c = _register_and_activate(admin_session, f"TEST_RegRL_{uuid.uuid4().hex[:6]}", rate_limit=7)
    assert c["rate_limit_per_hour"] == 7
    snip = admin_session.get(f"{API}/api-clients/{c['id']}/snippets", timeout=10).json()
    assert snip["rate_limit_per_hour"] == 7


# ---------------- Rate-limit enforcement ----------------
def _bridge_post(client_id, secret, auto_submit=False):
    return requests.post(
        f"{API}/external/invoices",
        headers={"Authorization": f"Bearer {secret}", "X-Client-Id": client_id,
                 "Content-Type": "application/json"},
        json={
            "external_ref": f"RL-{uuid.uuid4().hex[:6]}",
            "customer_tin": "C25845632020",
            "customer_name": "Retail Buyer Sdn Bhd",
            "customer_email": "buyer@example.my",
            "invoice_date": "2026-02-15",
            "currency": "MYR",
            "lines": [{"description": "Rate limit test", "quantity": 1,
                       "unit_price": 10, "tax_rate": 0}],
            "auto_submit": auto_submit,
        },
        timeout=20,
    )


def test_rate_limit_enforcement(admin_session):
    c = _register_and_activate(admin_session, f"TEST_RLenf_{uuid.uuid4().hex[:6]}", rate_limit=2)
    r1 = _bridge_post(c["client_id"], c["secret"])
    r2 = _bridge_post(c["client_id"], c["secret"])
    r3 = _bridge_post(c["client_id"], c["secret"])
    assert r1.status_code == 200, r1.text
    assert r2.status_code == 200, r2.text
    assert r3.status_code == 429, f"expected 429 got {r3.status_code}: {r3.text}"
    detail = (r3.json().get("detail") or "").lower()
    assert "rate limit" in detail, f"unexpected message: {detail}"

    # Bump limit and try again — 4th should succeed
    r = admin_session.put(f"{API}/api-clients/{c['id']}/rate-limit",
                          json={"rate_limit_per_hour": 10}, timeout=10)
    assert r.status_code == 200
    r4 = _bridge_post(c["client_id"], c["secret"])
    assert r4.status_code == 200, f"expected 200 after bump got {r4.status_code}: {r4.text}"


# ---------------- Real LHDN preprod pilot submission ----------------
def _get_pilot_customer(session):
    custs = session.get(f"{API}/customers", timeout=10).json()
    for c in custs:
        if c.get("phone"):
            return c
    pytest.skip("no customer with phone number in tenant")


def _new_signing(session, action, entity_id):
    r = session.post(f"{API}/signing/sessions",
                     json={"action": action, "entity": "invoice", "entity_id": entity_id}, timeout=10)
    assert r.status_code in (200, 201), r.text
    return r.json()["session_id"], r.json()["code"]


def test_real_lhdn_preprod_submission(admin_session):
    cust = _get_pilot_customer(admin_session)
    payload = {
        "company_id": PILOT_COMPANY_ID,
        "customer_id": cust["id"],
        "invoice_date": "2026-02-15",
        "lines": [{"description": "Pilot consultation", "quantity": 1,
                   "unit_price": 250.00, "tax_rate": 6}],
    }
    r = admin_session.post(f"{API}/invoices", json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    inv_id = r.json()["id"]

    sid, code = _new_signing(admin_session, "invoice.submit", inv_id)
    ar = admin_session.post(f"{API}/signing/{sid}/approve", json={"code": code}, timeout=10)
    assert ar.status_code == 200, ar.text

    r = admin_session.post(f"{API}/invoices/{inv_id}/submit",
                            json={"signing_session_id": sid}, timeout=20)
    assert r.status_code in (200, 202), r.text

    # Poll up to 20s for real LHDN preprod UUID
    final = None
    for _ in range(40):
        time.sleep(0.5)
        cur = admin_session.get(f"{API}/invoices/{inv_id}", timeout=10).json()
        if cur.get("status") in ("validated", "rejected"):
            final = cur
            break
    assert final is not None, "invoice did not transition within 20s"
    gov = final.get("government") or {}
    assert final["status"] == "validated", \
        f"expected validated, got {final['status']}. gov={gov}"
    real_uuid = gov.get("uuid") or ""
    assert real_uuid, f"missing government.uuid: {gov}"
    assert len(real_uuid) >= 20, f"UUID too short — mock-looking: {real_uuid}"
    # LHDN preprod UUIDs use uppercase alphanumerics
    assert real_uuid.isupper() or any(ch.isdigit() for ch in real_uuid), \
        f"uuid does not look like real LHDN preprod: {real_uuid}"
    assert any(ch.isalpha() for ch in real_uuid) and any(ch.isdigit() for ch in real_uuid), \
        f"UUID pattern unexpected: {real_uuid}"
    print(f"REAL LHDN UUID: {real_uuid} for invoice {final.get('invoice_number')}")
