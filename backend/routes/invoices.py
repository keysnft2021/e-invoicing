"""Invoice CRUD + lifecycle (draft → submit → validated/rejected → cancelled)."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
from typing import List, Optional
import asyncio

from deps import get_db, require_tenant
from adapters import resolve_adapter
from audit import audit
from routes.signing import consume_signing_session

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


class Line(BaseModel):
    product_id: Optional[str] = None
    description: str
    quantity: float = 1
    unit_price: float = 0
    tax_rate: float = 6
    hs_code: Optional[str] = None
    classification_code: Optional[str] = None
    discount: float = 0


class InvoiceIn(BaseModel):
    company_id: Optional[str] = None
    branch_code: Optional[str] = "HQ"
    customer_id: str
    customer_snapshot: Optional[dict] = None
    invoice_date: str
    due_date: Optional[str] = None
    currency: str = "MYR"
    exchange_rate: float = 1.0
    lines: List[Line]
    shipping: float = 0
    charges: float = 0
    round_off: float = 0
    notes: Optional[str] = None
    terms: Optional[str] = None
    invoice_type: str = "invoice"  # invoice | credit_note | debit_note
    # ICS-specific fields (all optional)
    business_system: Optional[str] = None
    store_code: Optional[str] = None
    source: Optional[str] = "portal"
    invoice_confirmation_status: Optional[str] = "pending"
    validation_result: Optional[str] = "pending"
    supplier_tin: Optional[str] = None
    supplier_name: Optional[str] = None


class CancelBody(BaseModel):
    reason: str
    signing_session_id: str


class SubmitBody(BaseModel):
    signing_session_id: str


def _calc_totals(lines, shipping=0, charges=0, round_off=0):
    subtotal = 0.0
    tax_total = 0.0
    for ln in lines:
        line_net = (ln["quantity"] * ln["unit_price"]) - ln.get("discount", 0)
        line_tax = line_net * (ln["tax_rate"] / 100)
        subtotal += line_net
        tax_total += line_tax
    total = subtotal + tax_total + shipping + charges + round_off
    return round(subtotal, 2), round(tax_total, 2), round(total, 2)


def _next_number(prefix="INV"):
    dt = datetime.now(timezone.utc)
    return f"{prefix}-{dt.strftime('%Y%m')}-{int(dt.timestamp()) % 100000:05d}"


def _s(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


def _append_event(doc, status, note, actor):
    doc.setdefault("timeline", []).append({
        "status": status,
        "note": note,
        "actor": actor,
        "at": datetime.now(timezone.utc).isoformat(),
    })


@router.get("")
async def list_invoices(ctx=Depends(require_tenant), status: Optional[str] = None,
                        limit: int = 100, skip: int = 0):
    db = get_db()
    q = {"tenant_id": ctx["tenant_id"]}
    if status:
        q["status"] = status
    proj = {"invoice_number": 1, "invoice_type": 1, "invoice_date": 1,
            "due_date": 1, "currency": 1, "customer_snapshot": 1, "status": 1,
            "subtotal": 1, "tax_total": 1, "total": 1, "government.uuid": 1,
            "government.qr": 1, "source": 1, "company_id": 1,
            "invoice_confirmation_status": 1, "validation_result": 1,
            "created_at": 1, "updated_at": 1}
    cur = db.invoices.find(q, proj).sort("created_at", -1).skip(max(0, skip)).limit(min(500, max(1, limit)))
    return [_s(c) async for c in cur]


@router.post("")
async def create_invoice(body: InvoiceIn, ctx=Depends(require_tenant)):
    db = get_db()
    user = ctx["user"]
    lines = [ln.model_dump() for ln in body.lines]
    subtotal, tax, total = _calc_totals(lines, body.shipping, body.charges, body.round_off)

    # Fetch customer for snapshot
    cust = await db.customers.find_one({"_id": ObjectId(body.customer_id),
                                         "tenant_id": ctx["tenant_id"]})
    if not cust:
        raise HTTPException(404, "Customer not found")
    cust_snap = {
        "id": str(cust["_id"]), "name": cust["name"], "tin": cust.get("tin"),
        "brn": cust.get("brn"), "email": cust.get("email"),
        "billing_address": cust.get("billing_address"),
    }

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **body.model_dump(exclude={"lines"}),
        "tenant_id": ctx["tenant_id"],
        "invoice_number": _next_number("CN" if body.invoice_type == "credit_note" else "INV"),
        "lines": lines,
        "subtotal": subtotal, "tax_total": tax, "total": total,
        "status": "draft",
        "customer_snapshot": cust_snap,
        "government": {},
        "timeline": [],
        "created_at": now, "updated_at": now,
        "created_by": user["id"], "created_by_email": user["email"],
    }
    _append_event(doc, "draft", "Invoice created", user["email"])
    res = await db.invoices.insert_one(doc)
    doc["_id"] = res.inserted_id
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=user["id"], actor_email=user["email"],
                action="invoice.create", entity="invoice", entity_id=str(res.inserted_id),
                meta={"number": doc["invoice_number"], "total": total})
    return _s(doc)


@router.get("/{iid}")
async def get_invoice(iid: str, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    return _s(doc)


@router.put("/{iid}")
async def update_invoice(iid: str, body: InvoiceIn, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    if doc["status"] not in ("draft", "rejected"):
        raise HTTPException(400, f"Cannot edit invoice in status {doc['status']}")
    lines = [ln.model_dump() for ln in body.lines]
    subtotal, tax, total = _calc_totals(lines, body.shipping, body.charges, body.round_off)
    update = {**body.model_dump(exclude={"lines"}),
              "lines": lines, "subtotal": subtotal, "tax_total": tax, "total": total,
              "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.invoices.update_one({"_id": ObjectId(iid)}, {"$set": update})
    doc = await db.invoices.find_one({"_id": ObjectId(iid)})
    return _s(doc)


async def _submit_task(invoice_id: str, tenant_id: str):
    """Background task: submit to gov adapter, update invoice with result."""
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
    result = await adapter.submit_invoice(payload)
    timeline = doc.get("timeline", [])
    now = datetime.now(timezone.utc).isoformat()
    if result["status"] == "validated":
        gov = {
            "adapter": adapter.name, "submission_uid": result["submission_uid"],
            "uuid": result["uuid"], "long_id": result.get("long_id"),
            "validation_id": result.get("validation_id"), "qr": result.get("qr"),
            "signed_at": result.get("signed_at"),
        }
        timeline.append({"status": "validated", "note": f"Accepted by LHDN — UUID {result['uuid']}",
                          "actor": "government", "at": now})
        await db.invoices.update_one({"_id": ObjectId(invoice_id)},
            {"$set": {"status": "validated", "government": gov, "timeline": timeline,
                       "updated_at": now}})
        from webhooks import fire_webhook
        asyncio.create_task(fire_webhook(db, invoice_id))
    else:
        errs = result.get("errors", [])
        timeline.append({"status": "rejected",
                          "note": f"Rejected: {errs[0]['message'] if errs else 'Unknown error'}",
                          "actor": "government", "at": now})
        await db.invoices.update_one({"_id": ObjectId(invoice_id)},
            {"$set": {"status": "rejected", "government": {"errors": errs, "adapter": adapter.name},
                       "timeline": timeline, "updated_at": now}})
        from webhooks import fire_webhook
        asyncio.create_task(fire_webhook(db, invoice_id))


@router.post("/{iid}/submit")
async def submit_invoice(iid: str, body: SubmitBody, bg: BackgroundTasks,
                          ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    if doc["status"] not in ("draft", "rejected"):
        raise HTTPException(400, f"Cannot submit invoice in status {doc['status']}")
    # Step-up MFA gate
    await consume_signing_session(db, session_id=body.signing_session_id,
                                    tenant_id=ctx["tenant_id"],
                                    expected_action="invoice.submit",
                                    expected_entity_id=iid)
    now = datetime.now(timezone.utc).isoformat()
    timeline = doc.get("timeline", [])
    timeline.append({"status": "submitting", "note": "Queued for LHDN MyInvois submission (signed)",
                      "actor": ctx["user"]["email"], "at": now})
    await db.invoices.update_one({"_id": ObjectId(iid)},
        {"$set": {"status": "submitting", "timeline": timeline, "updated_at": now,
                   "signing_session_id": body.signing_session_id}})
    bg.add_task(_submit_task, iid, ctx["tenant_id"])
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="invoice.submit",
                entity="invoice", entity_id=iid,
                meta={"number": doc["invoice_number"],
                       "signing_session_id": body.signing_session_id})
    doc = await db.invoices.find_one({"_id": ObjectId(iid)})
    return _s(doc)


@router.post("/{iid}/cancel")
async def cancel_invoice(iid: str, body: CancelBody, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Invoice not found")
    if doc["status"] not in ("validated", "submitted"):
        raise HTTPException(400, f"Cannot cancel invoice in status {doc['status']}")
    # Step-up MFA gate
    await consume_signing_session(db, session_id=body.signing_session_id,
                                    tenant_id=ctx["tenant_id"],
                                    expected_action="invoice.cancel",
                                    expected_entity_id=iid)
    adapter = await resolve_adapter(doc.get("country", "MY"), db, ctx["tenant_id"],
                                       company_id=doc.get("company_id"))
    gov_uuid = doc.get("government", {}).get("uuid", "")
    result = await adapter.cancel_invoice(gov_uuid, body.reason)
    now = datetime.now(timezone.utc).isoformat()
    timeline = doc.get("timeline", [])
    timeline.append({"status": "cancelled", "note": f"Cancelled: {body.reason}",
                      "actor": ctx["user"]["email"], "at": now})
    await db.invoices.update_one({"_id": ObjectId(iid)},
        {"$set": {"status": "cancelled", "cancellation": result,
                   "timeline": timeline, "updated_at": now}})
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="invoice.cancel",
                entity="invoice", entity_id=iid,
                meta={"reason": body.reason, "signing_session_id": body.signing_session_id})
    doc = await db.invoices.find_one({"_id": ObjectId(iid)})
    return _s(doc)


@router.delete("/{iid}")
async def delete_invoice(iid: str, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Not found")
    if doc["status"] != "draft":
        raise HTTPException(400, "Only draft invoices can be deleted")
    await db.invoices.delete_one({"_id": ObjectId(iid)})
    return {"ok": True}
