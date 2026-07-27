"""Iteration 2 tests — Signing sessions (QR step-up MFA), gov-config, adapter modes.

Focus areas:
- POST /api/gov-config saves creds (redacted); DELETE removes; verify fails gracefully.
- Dashboard adapters mode reflects gov_credentials.
- Signing sessions: create/approve/reject; TTL; single-use consume; entity/tenant binding.
- Invoice submit/cancel now REQUIRE signing_session_id.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@einvoice.my"
ADMIN_PASSWORD = "Admin@12345"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    s.headers.update({"Content-Type": "application/json"})
    yield s
    # cleanup any gov config so mock adapter is default
    s.delete(f"{API}/gov-config/MY", timeout=10)


@pytest.fixture(scope="module")
def other_tenant():
    s = requests.Session()
    uniq = uuid.uuid4().hex[:8]
    r = s.post(f"{API}/auth/register", json={
        "email": f"iso_{uniq}@test.my", "password": "Owner@12345",
        "name": "Iso Owner", "tenant_name": f"TEST_Iso_{uniq}"
    }, timeout=15)
    assert r.status_code in (200, 201), r.text
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    s.headers.update({"Content-Type": "application/json"})
    return s


def _customer_id(session):
    r = session.get(f"{API}/customers", timeout=10)
    r.raise_for_status()
    lst = r.json()
    if lst:
        return lst[0]["id"]
    r = session.post(f"{API}/customers", json={"name": f"TEST_Cust_{uuid.uuid4().hex[:6]}", "tin": "C11111111111"}, timeout=10)
    return r.json()["id"]


def _new_invoice(session):
    cid = _customer_id(session)
    r = session.post(f"{API}/invoices", json={
        "customer_id": cid, "invoice_date": "2025-01-15",
        "lines": [{"description": "Sign test", "quantity": 1, "unit_price": 100.0, "tax_rate": 6}],
    }, timeout=15)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _create_signing(session, action, entity_id):
    r = session.post(f"{API}/signing/sessions",
                     json={"action": action, "entity": "invoice", "entity_id": entity_id}, timeout=10)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _approve(session, sid, code):
    return session.post(f"{API}/signing/{sid}/approve", json={"code": code}, timeout=10)


# ---------------- Gov Config ----------------
class TestGovConfig:
    def test_upsert_redacted(self, admin):
        # clean slate
        admin.delete(f"{API}/gov-config/MY", timeout=10)
        payload = {"country": "MY", "environment": "preprod",
                   "client_id": "TEST_CLIENT_1234567890", "client_secret": "s3cret_value_dummy",
                   "certificate_pem": "-----BEGIN CERT-----\nabc\n-----END CERT-----",
                   "private_key_pem": "-----BEGIN KEY-----\nxyz\n-----END KEY-----",
                   "enabled": True}
        r = admin.post(f"{API}/gov-config", json=payload, timeout=10)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["country"] == "MY"
        assert d["environment"] == "preprod"
        # redacted
        assert d["client_id"] != payload["client_id"], "client_id must be masked"
        assert "•" in d["client_id"] or "*" in d["client_id"]
        assert "client_secret" not in d, "raw client_secret must not be returned"
        assert d.get("client_secret_set") is True
        assert d.get("certificate_pem_set") is True
        assert d.get("private_key_pem_set") is True
        assert d.get("enabled") is True

    def test_dashboard_adapter_mode_preprod(self, admin):
        r = admin.get(f"{API}/dashboard/stats", timeout=10)
        assert r.status_code == 200
        adapters = r.json().get("adapters", [])
        my = next((a for a in adapters if a.get("country") == "MY"), None)
        assert my is not None, adapters
        assert my["mode"] in ("preprod", "prod"), f"expected preprod/prod, got {my}"

    def test_verify_bogus_returns_ok_false(self, admin):
        r = admin.post(f"{API}/gov-config/MY/verify", timeout=30)
        assert r.status_code == 200, f"verify must NOT raise 500, got {r.status_code}: {r.text}"
        d = r.json()
        assert d.get("ok") is False, f"expected ok=False for dummy creds, got {d}"
        assert d.get("error"), "error message required"

    def test_delete_reverts_to_mock(self, admin):
        r = admin.delete(f"{API}/gov-config/MY", timeout=10)
        assert r.status_code == 200
        r = admin.get(f"{API}/dashboard/stats", timeout=10)
        adapters = r.json().get("adapters", [])
        my = next((a for a in adapters if a.get("country") == "MY"), None)
        assert my["mode"] == "mock", f"expected mock after delete, got {my}"


# ---------------- Signing Sessions ----------------
class TestSigningSession:
    def test_create_session_shape(self, admin):
        inv = _new_invoice(admin)
        d = _create_signing(admin, "invoice.submit", inv)
        assert "session_id" in d
        assert "code" in d and len(d["code"]) == 6 and d["code"].isdigit()
        assert d.get("qr_data_url", "").startswith("data:image/png;base64,")
        assert "/sign/" in d.get("approve_url", "")
        assert "c=" in d["approve_url"]
        assert d.get("expires_at")

    def test_approve_wrong_code(self, admin):
        inv = _new_invoice(admin)
        d = _create_signing(admin, "invoice.submit", inv)
        r = _approve(admin, d["session_id"], "000000" if d["code"] != "000000" else "111111")
        assert r.status_code == 400
        assert "invalid" in r.text.lower()

    def test_approve_correct_code_and_audit(self, admin):
        inv = _new_invoice(admin)
        d = _create_signing(admin, "invoice.submit", inv)
        r = _approve(admin, d["session_id"], d["code"])
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "approved"
        # audit
        audit = admin.get(f"{API}/audit", timeout=10).json()
        items = audit if isinstance(audit, list) else audit.get("items", [])
        assert any(x.get("action") == "signing.approve" for x in items), "signing.approve audit missing"

    def test_submit_without_signing_id_400(self, admin):
        inv = _new_invoice(admin)
        r = admin.post(f"{API}/invoices/{inv}/submit", json={}, timeout=10)
        assert r.status_code in (400, 422)
        # if 400, message includes signing_session_id
        if r.status_code == 400:
            assert "signing_session_id" in r.text

    def test_submit_with_invalid_signing_id(self, admin):
        inv = _new_invoice(admin)
        r = admin.post(f"{API}/invoices/{inv}/submit",
                       json={"signing_session_id": "bogus-does-not-exist"}, timeout=10)
        assert r.status_code == 403
        assert "invalid" in r.text.lower()

    def test_full_submit_flow_and_consume(self, admin):
        inv = _new_invoice(admin)
        d = _create_signing(admin, "invoice.submit", inv)
        _approve(admin, d["session_id"], d["code"])
        r = admin.post(f"{API}/invoices/{inv}/submit",
                       json={"signing_session_id": d["session_id"]}, timeout=15)
        assert r.status_code in (200, 202), r.text
        # verify state consumed
        s = admin.get(f"{API}/signing/{d['session_id']}", timeout=10).json()
        assert s["status"] == "consumed", s

        # poll for validated
        final = None
        for _ in range(20):
            time.sleep(0.5)
            cur = admin.get(f"{API}/invoices/{inv}", timeout=10).json()
            if cur.get("status") in ("validated", "rejected"):
                final = cur
                break
        assert final and final["status"] == "validated"

        # Cannot reuse consumed session
        inv2 = _new_invoice(admin)
        r = admin.post(f"{API}/invoices/{inv2}/submit",
                       json={"signing_session_id": d["session_id"]}, timeout=10)
        assert r.status_code == 400

    def test_session_bound_to_entity(self, admin):
        inv_a = _new_invoice(admin)
        inv_b = _new_invoice(admin)
        d = _create_signing(admin, "invoice.submit", inv_a)
        _approve(admin, d["session_id"], d["code"])
        r = admin.post(f"{API}/invoices/{inv_b}/submit",
                       json={"signing_session_id": d["session_id"]}, timeout=10)
        assert r.status_code == 400
        assert "different entity" in r.text.lower() or "entity" in r.text.lower()

    def test_session_tenant_scoped(self, admin, other_tenant):
        inv = _new_invoice(admin)
        d = _create_signing(admin, "invoice.submit", inv)
        # other tenant tries to approve
        r = _approve(other_tenant, d["session_id"], d["code"])
        assert r.status_code in (403, 404), f"other tenant should be blocked, got {r.status_code}"

    def test_cancel_requires_signing(self, admin):
        inv = _new_invoice(admin)
        d = _create_signing(admin, "invoice.submit", inv)
        _approve(admin, d["session_id"], d["code"])
        admin.post(f"{API}/invoices/{inv}/submit",
                   json={"signing_session_id": d["session_id"]}, timeout=15)
        for _ in range(20):
            time.sleep(0.4)
            cur = admin.get(f"{API}/invoices/{inv}", timeout=10).json()
            if cur.get("status") == "validated":
                break
        # cancel needs signing session with action=invoice.cancel bound to inv
        d2 = _create_signing(admin, "invoice.submit", inv)  # WRONG action
        _approve(admin, d2["session_id"], d2["code"])
        r = admin.post(f"{API}/invoices/{inv}/cancel",
                       json={"reason": "x", "signing_session_id": d2["session_id"]}, timeout=10)
        assert r.status_code == 400
        # correct action
        d3 = _create_signing(admin, "invoice.cancel", inv)
        _approve(admin, d3["session_id"], d3["code"])
        r = admin.post(f"{API}/invoices/{inv}/cancel",
                       json={"reason": "iter2 test", "signing_session_id": d3["session_id"]}, timeout=15)
        assert r.status_code in (200, 202), r.text

    def test_expired_session_status(self, admin):
        # Can't wait 5 minutes — just verify get returns valid status field.
        inv = _new_invoice(admin)
        d = _create_signing(admin, "invoice.submit", inv)
        r = admin.get(f"{API}/signing/{d['session_id']}", timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] in ("pending", "approved", "expired")
