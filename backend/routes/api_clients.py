"""External API clients (EMR / POS / ERP systems) that push invoices
into this platform, which then bridges them to LHDN MyInvois.

Registration flow:
 1. Admin registers a new client — platform generates client_id, client_secret
    (returned ONCE, then only the bcrypt hash is stored), and a 6-digit
    activation_code plus a QR that encodes {client_id, activation_code, base_url}.
 2. The client system operator scans the QR and enters the activation code in
    THIS platform → POST /api/api-clients/{id}/activate → status becomes active.
 3. The client system stores the client_id + client_secret and calls the bridge:
        Authorization: Bearer <client_secret>
        X-Client-Id: <client_id>
    to POST /api/external/invoices.
 4. Platform auto-submits the invoice to LHDN under the client's tenant.
"""
import base64
import io
import os
import secrets
import bcrypt
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field
import qrcode

from deps import get_db, require_tenant
from audit import audit
from adapters import resolve_adapter

router = APIRouter(tags=["api-clients"])


SYSTEM_TYPES = ["EMR", "POS", "ERP", "Custom"]


def _qr_data_url(payload: str) -> str:
    img = qrcode.make(payload, box_size=6, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _hash(secret: str) -> str:
    return bcrypt.hashpw(secret.encode(), bcrypt.gensalt()).decode()


def _check(secret: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(secret.encode(), hashed.encode())
    except Exception:
        return False


def _redact(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]) if "_id" in doc else doc.get("id"),
        "client_id": doc.get("client_id"),
        "name": doc.get("name"),
        "system_type": doc.get("system_type"),
        "status": doc.get("status"),
        "webhook_url": doc.get("webhook_url"),
        "activation_code": doc.get("activation_code") if doc.get("status") == "pending" else None,
        "qr_data_url": doc.get("qr_data_url") if doc.get("status") == "pending" else None,
        "registered_at": doc.get("registered_at"),
        "activated_at": doc.get("activated_at"),
        "last_used_at": doc.get("last_used_at"),
        "invoice_count": doc.get("invoice_count", 0),
        "rate_limit_per_hour": doc.get("rate_limit_per_hour", 100),
        "company_id": doc.get("company_id"),
        "company_name": doc.get("company_name"),
        "company_tin": doc.get("company_tin"),
    }


# ---------- Admin CRUD ----------
class RegisterBody(BaseModel):
    name: str
    system_type: str = "EMR"
    webhook_url: Optional[str] = None
    company_id: str  # clinic this EMR/POS pushes for — required
    rate_limit_per_hour: int = 100  # max /api/external/invoices calls per rolling hour


class RateLimitBody(BaseModel):
    rate_limit_per_hour: int = Field(ge=1, le=100000)


@router.get("/api/api-clients")
async def list_clients(ctx=Depends(require_tenant)):
    db = get_db()
    return [_redact(d) async for d in
             db.api_clients.find({"tenant_id": ctx["tenant_id"]}).sort("registered_at", -1)]


@router.post("/api/api-clients")
async def register_client(body: RegisterBody, ctx=Depends(require_tenant)):
    if body.system_type not in SYSTEM_TYPES:
        raise HTTPException(400, f"system_type must be one of {SYSTEM_TYPES}")
    db = get_db()
    # Validate company_id belongs to this tenant
    clinic = await db.companies.find_one({"_id": ObjectId(body.company_id),
                                            "tenant_id": ctx["tenant_id"]})
    if not clinic:
        raise HTTPException(400, "company_id (clinic) not found in this tenant")
    now = datetime.now(timezone.utc).isoformat()
    client_id = f"cli_{secrets.token_urlsafe(16)}"
    client_secret = f"sk_live_{secrets.token_urlsafe(32)}"
    activation_code = f"{secrets.randbelow(1_000_000):06d}"
    base_url = os.environ.get("FRONTEND_URL", "")

    qr_payload = f"{base_url}/api-clients/activate?cid={client_id}&code={activation_code}"
    qr = _qr_data_url(qr_payload)

    doc = {
        "tenant_id": ctx["tenant_id"],
        "company_id": body.company_id,
        "company_tin": clinic.get("tin"),
        "company_name": clinic.get("name"),
        "name": body.name,
        "system_type": body.system_type,
        "webhook_url": body.webhook_url,
        "client_id": client_id,
        "client_secret_hash": _hash(client_secret),
        "activation_code": activation_code,
        "qr_data_url": qr,
        "qr_payload": qr_payload,
        "status": "pending",
        "invoice_count": 0,
        "rate_limit_per_hour": body.rate_limit_per_hour,
        "registered_at": now,
        "registered_by": ctx["user"]["email"],
    }
    res = await db.api_clients.insert_one(doc)
    doc["_id"] = res.inserted_id
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="api_client.register",
                entity="api_client", entity_id=str(res.inserted_id),
                meta={"name": body.name, "system_type": body.system_type})

    out = _redact(doc)
    # Return the raw secret ONE TIME so the operator can copy it into the client system
    out["client_secret"] = client_secret
    out["qr_payload"] = qr_payload
    return out


class ActivateBody(BaseModel):
    activation_code: str


@router.post("/api/api-clients/{cid}/activate")
async def activate_client(cid: str, body: ActivateBody, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.api_clients.find_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Client not found")
    if doc["status"] != "pending":
        raise HTTPException(400, f"Client is {doc['status']}, cannot activate")
    if doc["activation_code"] != body.activation_code.strip():
        raise HTTPException(400, "Invalid activation code")
    now = datetime.now(timezone.utc).isoformat()
    await db.api_clients.update_one({"_id": doc["_id"]},
        {"$set": {"status": "active", "activated_at": now,
                   "activated_by": ctx["user"]["email"]},
         "$unset": {"activation_code": "", "qr_data_url": "", "qr_payload": ""}})
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="api_client.activate",
                entity="api_client", entity_id=cid)
    doc = await db.api_clients.find_one({"_id": ObjectId(cid)})
    return _redact(doc)


@router.put("/api/api-clients/{cid}/rate-limit")
async def set_rate_limit(cid: str, body: RateLimitBody, ctx=Depends(require_tenant)):
    db = get_db()
    r = await db.api_clients.update_one(
        {"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
        {"$set": {"rate_limit_per_hour": body.rate_limit_per_hour}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Client not found")
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="api_client.rate_limit",
                entity="api_client", entity_id=cid,
                meta={"rate_limit_per_hour": body.rate_limit_per_hour})
    doc = await db.api_clients.find_one({"_id": ObjectId(cid)})
    return _redact(doc)


@router.get("/api/api-clients/{cid}/snippets")
async def snippets(cid: str, ctx=Depends(require_tenant)):
    """Return copy-pasteable curl / Node / Python integration snippets for an
    active client. Secrets are shown as `<CLIENT_SECRET>` placeholders so the
    dashboard never reveals the actual credential (only shown once at creation).
    """
    db = get_db()
    doc = await db.api_clients.find_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Client not found")
    base = (os.environ.get("FRONTEND_URL") or "").rstrip("/") + "/api/external"
    client_id = doc["client_id"]
    curl = f"""curl -X POST {base}/invoices \\
  -H "Authorization: Bearer <CLIENT_SECRET>" \\
  -H "X-Client-Id: {client_id}" \\
  -H "Content-Type: application/json" \\
  -d '{{
    "external_ref": "EMR-2026-00001",
    "customer_tin": "C25845632020",
    "customer_name": "Retail Buyer Sdn Bhd",
    "customer_email": "buyer@example.my",
    "invoice_date": "2026-02-15",
    "currency": "MYR",
    "lines": [
      {{"description":"Consultation","quantity":1,"unit_price":250,"tax_rate":6}}
    ]
  }}'"""
    node = f"""// Node.js 18+ (native fetch)
const res = await fetch("{base}/invoices", {{
  method: "POST",
  headers: {{
    "Authorization": `Bearer ${{process.env.CLIENT_SECRET}}`,
    "X-Client-Id":  "{client_id}",
    "Content-Type": "application/json",
  }},
  body: JSON.stringify({{
    external_ref: "EMR-2026-00001",
    customer_tin:  "C25845632020",
    customer_name: "Retail Buyer Sdn Bhd",
    customer_email:"buyer@example.my",
    invoice_date:  "2026-02-15",
    currency:      "MYR",
    lines: [{{ description:"Consultation", quantity:1, unit_price:250, tax_rate:6 }}],
  }}),
}});
const data = await res.json();
console.log(data);  // {{ id, invoice_number, status, total, auto_submit_queued, external_ref }}"""
    python = f"""# Python 3.10+
import os, httpx

r = httpx.post(
    "{base}/invoices",
    headers={{
        "Authorization": f"Bearer {{os.environ['CLIENT_SECRET']}}",
        "X-Client-Id":   "{client_id}",
        "Content-Type":  "application/json",
    }},
    json={{
        "external_ref": "EMR-2026-00001",
        "customer_tin":  "C25845632020",
        "customer_name": "Retail Buyer Sdn Bhd",
        "customer_email":"buyer@example.my",
        "invoice_date":  "2026-02-15",
        "currency":      "MYR",
        "lines": [{{"description":"Consultation","quantity":1,"unit_price":250,"tax_rate":6}}],
    }},
)
print(r.json())"""
    health = f"""curl {base}/health \\
  -H "Authorization: Bearer <CLIENT_SECRET>" \\
  -H "X-Client-Id: {client_id}\""""
    return {
        "client_id": client_id,
        "base_url": base,
        "bridge_url": f"{base}/invoices",
        "health_url": f"{base}/health",
        "rate_limit_per_hour": doc.get("rate_limit_per_hour", 100),
        "snippets": {"curl": curl, "node": node, "python": python, "health": health},
    }


@router.post("/api/api-clients/{cid}/revoke")
async def revoke_client(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    r = await db.api_clients.update_one(
        {"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
        {"$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc).isoformat()}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Client not found")
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="api_client.revoke",
                entity="api_client", entity_id=cid)
    return {"ok": True}


@router.delete("/api/api-clients/{cid}")
async def delete_client(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    await db.api_clients.delete_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    return {"ok": True}


# ---------- External bridge endpoint ----------
class BridgeLine(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0
    tax_rate: float = 6
    discount: float = 0
    hs_code: Optional[str] = None


class BridgeInvoice(BaseModel):
    external_ref: Optional[str] = None
    customer_tin: str
    customer_name: str
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    invoice_date: str
    currency: str = "MYR"
    lines: list[BridgeLine]
    business_system: Optional[str] = None
    store_code: Optional[str] = None
    auto_submit: bool = True


async def _authenticate_client(request: Request):
    """Verify Bearer <secret> + X-Client-Id header, return client doc."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    secret = auth[7:].strip()
    client_id = request.headers.get("X-Client-Id", "").strip()
    if not client_id:
        raise HTTPException(401, "Missing X-Client-Id header")
    db = get_db()
    doc = await db.api_clients.find_one({"client_id": client_id, "status": "active"})
    if not doc or not _check(secret, doc["client_secret_hash"]):
        raise HTTPException(401, "Invalid client credentials")
    return doc


async def _enforce_rate_limit(db, client: dict):
    """Sliding-hour submission quota per API client (enforced on bridge writes)."""
    limit = int(client.get("rate_limit_per_hour") or 100)
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    count = await db.invoices.count_documents({
        "external_client_id": client["client_id"],
        "created_at": {"$gte": cutoff},
    })
    if count >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded — {count}/{limit} invoices in the last hour. "
                   f"Contact your administrator to raise the quota.",
        )


@router.post("/api/external/invoices")
async def bridge_create_invoice(body: BridgeInvoice, bg: BackgroundTasks, request: Request):
    """Third-party systems push invoices here. Auto-submits to LHDN under
    the tenant that owns the API client.
    """
    client = await _authenticate_client(request)
    db = get_db()
    await _enforce_rate_limit(db, client)
    tenant_id = client["tenant_id"]
    now = datetime.now(timezone.utc)

    # Upsert customer by TIN
    cust = await db.customers.find_one({"tenant_id": tenant_id, "tin": body.customer_tin})
    if not cust:
        res = await db.customers.insert_one({
            "tenant_id": tenant_id, "tin": body.customer_tin,
            "name": body.customer_name, "email": body.customer_email,
            "billing_address": body.customer_address,
            "country": "MY", "currency": body.currency, "credit_limit": 0,
            "created_at": now.isoformat(),
            "source": "bridge",
        })
        cust = {"_id": res.inserted_id, "name": body.customer_name, "tin": body.customer_tin,
                 "email": body.customer_email, "billing_address": body.customer_address}

    # Compute totals
    lines = [l.model_dump() for l in body.lines]
    subtotal = sum(l["quantity"] * l["unit_price"] - l.get("discount", 0) for l in lines)
    tax = sum((l["quantity"] * l["unit_price"] - l.get("discount", 0)) * (l["tax_rate"] / 100) for l in lines)
    total = round(subtotal + tax, 2)

    inv = {
        "tenant_id": tenant_id,
        "company_id": client.get("company_id"),  # clinic this invoice belongs to
        "invoice_number": f"BRDG-{now.strftime('%Y%m')}-{int(now.timestamp() * 1000) % 100000:05d}",
        "invoice_type": "invoice",
        "invoice_date": body.invoice_date,
        "currency": body.currency,
        "customer_id": str(cust["_id"]),
        "customer_snapshot": {"id": str(cust["_id"]), "name": cust["name"],
                                "tin": cust.get("tin"), "email": cust.get("email"),
                                "billing_address": cust.get("billing_address")},
        "lines": lines, "shipping": 0, "charges": 0, "round_off": 0,
        "subtotal": round(subtotal, 2), "tax_total": round(tax, 2), "total": total,
        "status": "draft", "government": {},
        "source": "bridge",
        "business_system": body.business_system or client["name"],
        "store_code": body.store_code,
        "external_ref": body.external_ref,
        "external_client_id": client["client_id"],
        "invoice_confirmation_status": "pending",
        "validation_result": "pending",
        "timeline": [{"status": "draft",
                        "note": f"Received from {client['name']} ({client['system_type']}) via bridge",
                        "actor": client["client_id"], "at": now.isoformat()}],
        "created_at": now.isoformat(), "updated_at": now.isoformat(),
    }
    res = await db.invoices.insert_one(inv)
    inv_id = str(res.inserted_id)

    # Update client usage
    await db.api_clients.update_one({"_id": client["_id"]},
        {"$inc": {"invoice_count": 1}, "$set": {"last_used_at": now.isoformat()}})

    await audit(db, tenant_id=tenant_id, actor_id=None, actor_email=client["name"],
                action="bridge.receive_invoice", entity="invoice", entity_id=inv_id,
                meta={"client_id": client["client_id"], "external_ref": body.external_ref,
                       "total": total})

    if body.auto_submit:
        # Fire and forget — background task submits to LHDN via resolved adapter
        bg.add_task(_bridge_submit, inv_id, tenant_id, client["client_id"])

    return {
        "id": inv_id,
        "invoice_number": inv["invoice_number"],
        "status": inv["status"],
        "total": total,
        "auto_submit_queued": body.auto_submit,
        "external_ref": body.external_ref,
    }


async def _bridge_submit(invoice_id: str, tenant_id: str, client_id: str):
    from deps import get_db as _gd
    db = _gd()
    doc = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not doc:
        return
    adapter = await resolve_adapter(doc.get("country", "MY"), db, tenant_id,
                                       company_id=doc.get("company_id"))
    payload = {"invoice_number": doc["invoice_number"], "total": doc["total"],
                "tax_total": doc["tax_total"], "customer": doc.get("customer_snapshot", {}),
                "lines": doc["lines"]}
    now = datetime.now(timezone.utc).isoformat()
    try:
        result = await adapter.submit_invoice(payload)
    except Exception as e:
        result = {"status": "rejected", "errors": [{"code": "EXC", "message": str(e)[:400]}]}

    timeline = doc.get("timeline", [])
    if result.get("status") == "validated":
        gov = {"adapter": adapter.name, "submission_uid": result.get("submission_uid"),
                "uuid": result.get("uuid"), "long_id": result.get("long_id"),
                "validation_id": result.get("validation_id"), "qr": result.get("qr"),
                "signed_at": result.get("signed_at")}
        timeline.append({"status": "validated",
                          "note": f"Bridge → LHDN accepted · UUID {result.get('uuid')}",
                          "actor": "bridge", "at": now})
        await db.invoices.update_one({"_id": ObjectId(invoice_id)},
            {"$set": {"status": "validated", "government": gov, "timeline": timeline, "updated_at": now}})
    else:
        errs = result.get("errors", [])
        timeline.append({"status": "rejected",
                          "note": f"Bridge → LHDN rejected: {errs[0]['message'][:80] if errs else 'error'}",
                          "actor": "bridge", "at": now})
        await db.invoices.update_one({"_id": ObjectId(invoice_id)},
            {"$set": {"status": "rejected",
                       "government": {"errors": errs, "adapter": adapter.name},
                       "timeline": timeline, "updated_at": now}})
    # Fire webhook to originating client system (fire-and-forget)
    from webhooks import fire_webhook
    import asyncio as _asyncio
    _asyncio.create_task(fire_webhook(db, invoice_id))


@router.get("/api/external/health")
async def bridge_health(request: Request):
    """Health probe usable by client systems to test their credentials."""
    client = await _authenticate_client(request)
    return {"ok": True, "client": client["name"], "system_type": client["system_type"],
             "tenant_id": client["tenant_id"]}
