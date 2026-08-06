"""ICS (Integration Console for Sellers) — LHDN-style transaction management.

Provides:
  - Summary metrics (Sales Invoices card, Statistics Type donut)
  - Transaction Data Management (basic + advanced search, void, submit, export)
  - Transaction Consolidated Task (monthly aggregation runs)
  - Uploaded records + operation logs
"""
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from deps import get_db, require_tenant
from audit import audit

router = APIRouter(prefix="/api/ics", tags=["ics"])


DOCUMENT_TYPES = ["invoice", "credit_note", "debit_note", "refund_note", "self_billed_invoice"]
SOURCES = ["portal", "erp", "csv_upload", "api"]
CONFIRMATION_STATUSES = ["pending", "confirmed", "rejected"]
VALIDATION_RESULTS = ["valid", "invalid", "pending"]
CURRENCIES = ["MYR", "USD", "SGD", "EUR", "CNY"]
INVOICE_ISSUED = ["yes", "no"]


def _s(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


# ---------- Summary ----------
@router.get("/summary")
async def summary(ctx=Depends(require_tenant), month: Optional[int] = None):
    """Sales Invoices card + Statistics Type donut data."""
    db = get_db()
    tenant_id = ctx["tenant_id"]
    q = {"tenant_id": tenant_id}
    if month:
        # month = 1..12, filter by created_at month in current year
        year = datetime.now(timezone.utc).year
        start = f"{year}-{month:02d}-01"
        nxt_month = month + 1 if month < 12 else 1
        nxt_year = year if month < 12 else year + 1
        end = f"{nxt_year}-{nxt_month:02d}-01"
        q["created_at"] = {"$gte": start, "$lt": end}

    pipeline = [
        {"$match": q},
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "sum": {"$sum": "$total"}}},
    ]
    by_status = {r["_id"]: {"count": r["count"], "sum": r["sum"]}
                  async for r in db.invoices.aggregate(pipeline)}

    awaiting = (by_status.get("submitting", {}).get("count", 0)
                + by_status.get("draft", {}).get("count", 0))
    accepted = by_status.get("validated", {}).get("count", 0)
    rejected = by_status.get("rejected", {}).get("count", 0)
    total_qty = awaiting + accepted + rejected + by_status.get("cancelled", {}).get("count", 0)
    total_amount = sum((by_status.get(s, {}).get("sum", 0) or 0)
                       for s in ("validated", "submitting", "rejected", "cancelled", "draft"))

    # Statistics buckets
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_start = (now.date().toordinal() - 7)
    week_start_iso = datetime.fromordinal(week_start).date().isoformat()
    month_start = f"{now.year}-{now.month:02d}-01"
    year_start = f"{now.year}-01-01"

    daily = await db.invoices.count_documents({"tenant_id": tenant_id, "created_at": {"$gte": today}})
    weekly = await db.invoices.count_documents({"tenant_id": tenant_id, "created_at": {"$gte": week_start_iso}})
    monthly = await db.invoices.count_documents({"tenant_id": tenant_id, "created_at": {"$gte": month_start}})
    yearly = await db.invoices.count_documents({"tenant_id": tenant_id, "created_at": {"$gte": year_start}})

    return {
        "sales_invoices": {
            "total_invoice_quantity": total_qty,
            "total_invoice_amount": round(total_amount, 2),
            "awaiting": awaiting,
            "accepted": accepted,
            "rejected": rejected,
        },
        "statistics_type": {
            "daily": daily,
            "weekly": weekly,
            "monthly": monthly,
            "yearly": yearly,
        },
    }


# ---------- Transactions (advanced search over invoices) ----------
@router.get("/transactions")
async def list_transactions(
    ctx=Depends(require_tenant),
    document_type: Optional[str] = None,
    document_no: Optional[str] = None,
    supplier_tin: Optional[str] = None,
    supplier_name: Optional[str] = None,
    buyer_tin: Optional[str] = None,
    buyer_name: Optional[str] = None,
    transaction_date_from: Optional[str] = None,
    transaction_date_to: Optional[str] = None,
    transaction_status: Optional[str] = None,
    invoice_issued: Optional[str] = None,
    e_invoice_uuid: Optional[str] = None,
    invoice_status: Optional[str] = None,
    source: Optional[str] = None,
    invoice_confirmation_status: Optional[str] = None,
    business_system: Optional[str] = None,
    validation_result: Optional[str] = None,
    store_code: Optional[str] = None,
    currency: Optional[str] = None,
    amount_from: Optional[float] = None,
    amount_to: Optional[float] = None,
    limit: int = 200,
):
    db = get_db()
    q = {"tenant_id": ctx["tenant_id"]}
    if document_type: q["invoice_type"] = document_type
    if document_no: q["invoice_number"] = {"$regex": document_no, "$options": "i"}
    if supplier_tin: q["supplier_tin"] = {"$regex": supplier_tin, "$options": "i"}
    if supplier_name: q["supplier_name"] = {"$regex": supplier_name, "$options": "i"}
    if buyer_tin: q["customer_snapshot.tin"] = {"$regex": buyer_tin, "$options": "i"}
    if buyer_name: q["customer_snapshot.name"] = {"$regex": buyer_name, "$options": "i"}
    if transaction_date_from or transaction_date_to:
        rng = {}
        if transaction_date_from: rng["$gte"] = transaction_date_from
        if transaction_date_to: rng["$lte"] = transaction_date_to
        q["invoice_date"] = rng
    if transaction_status: q["status"] = transaction_status
    if invoice_issued == "yes": q["government.uuid"] = {"$exists": True, "$ne": None}
    if invoice_issued == "no": q["$or"] = [{"government.uuid": None}, {"government.uuid": {"$exists": False}}]
    if e_invoice_uuid: q["government.uuid"] = {"$regex": e_invoice_uuid, "$options": "i"}
    if invoice_status: q["status"] = invoice_status
    if source: q["source"] = source
    if invoice_confirmation_status: q["invoice_confirmation_status"] = invoice_confirmation_status
    if business_system: q["business_system"] = {"$regex": business_system, "$options": "i"}
    if validation_result: q["validation_result"] = validation_result
    if store_code: q["store_code"] = {"$regex": store_code, "$options": "i"}
    if currency: q["currency"] = currency
    if amount_from is not None or amount_to is not None:
        rng = {}
        if amount_from is not None: rng["$gte"] = amount_from
        if amount_to is not None: rng["$lte"] = amount_to
        q["total"] = rng

    rows = [_s(d) async for d in db.invoices.find(q).sort("created_at", -1).skip(0).limit(min(500, max(1, limit)))]
    total = sum(r.get("total", 0) for r in rows)
    return {"rows": rows, "total": total, "count": len(rows)}


@router.post("/transactions/{iid}/void")
async def void_transaction(iid: str, body: dict, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Not found")
    now = datetime.now(timezone.utc).isoformat()
    timeline = doc.get("timeline", [])
    timeline.append({"status": "voided",
                      "note": f"Voided: {body.get('reason', 'N/A')}",
                      "actor": ctx["user"]["email"], "at": now})
    await db.invoices.update_one({"_id": ObjectId(iid)},
        {"$set": {"status": "voided", "voided_at": now, "timeline": timeline,
                   "void_reason": body.get("reason")}})
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="ics.void",
                entity="invoice", entity_id=iid, meta={"reason": body.get("reason")})
    return {"ok": True}


@router.get("/transactions/{iid}/operation-log")
async def transaction_log(iid: str, ctx=Depends(require_tenant)):
    db = get_db()
    logs = []
    async for l in db.audit_logs.find({"tenant_id": ctx["tenant_id"],
                                         "entity_id": iid}).sort("created_at", -1):
        l["id"] = str(l.pop("_id"))
        logs.append(l)
    return logs


@router.get("/transactions/{iid}/invalid-reasons")
async def invalid_reasons(iid: str, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Not found")
    return {"errors": (doc.get("government") or {}).get("errors", []),
             "status": doc.get("status")}


# ---------- Consolidated Task ----------
class ConsolidateBody(BaseModel):
    document_type: str = "all"  # all | invoice | credit_note | debit_note
    issuer_tin: str
    period_month: int  # 1..12
    period_year: int


@router.get("/consolidated")
async def list_consolidated(
    ctx=Depends(require_tenant),
    monthly_task_serial_number: Optional[str] = None,
    issuer_tin: Optional[str] = None,
    document_type: Optional[str] = None,
    status: Optional[str] = None,
    operation_date_from: Optional[str] = None,
    operation_date_to: Optional[str] = None,
):
    db = get_db()
    q = {"tenant_id": ctx["tenant_id"]}
    if monthly_task_serial_number:
        q["serial_number"] = {"$regex": monthly_task_serial_number, "$options": "i"}
    if issuer_tin: q["issuer_tin"] = {"$regex": issuer_tin, "$options": "i"}
    if document_type and document_type != "all": q["document_type"] = document_type
    if status: q["status"] = status
    if operation_date_from or operation_date_to:
        rng = {}
        if operation_date_from: rng["$gte"] = operation_date_from
        if operation_date_to: rng["$lte"] = operation_date_to
        q["created_at"] = rng
    return [_s(d) async for d in db.consolidated_tasks.find(q).sort("created_at", -1)]


@router.post("/consolidated/run")
async def run_consolidate(body: ConsolidateBody, ctx=Depends(require_tenant)):
    db = get_db()
    now = datetime.now(timezone.utc)
    # Aggregate invoices for this period + issuer_tin
    period_start = f"{body.period_year}-{body.period_month:02d}-01"
    nxt_m = body.period_month + 1 if body.period_month < 12 else 1
    nxt_y = body.period_year if body.period_month < 12 else body.period_year + 1
    period_end = f"{nxt_y}-{nxt_m:02d}-01"
    q = {"tenant_id": ctx["tenant_id"], "invoice_date": {"$gte": period_start, "$lt": period_end}}
    if body.document_type != "all":
        q["invoice_type"] = body.document_type
    matched = await db.invoices.count_documents(q)
    agg = [{"$match": q}, {"$group": {"_id": None, "sum": {"$sum": "$total"}}}]
    total = 0
    async for r in db.invoices.aggregate(agg):
        total = r["sum"]

    serial = f"CT-{body.period_year}{body.period_month:02d}-{int(now.timestamp()) % 100000:05d}"
    doc = {
        "tenant_id": ctx["tenant_id"],
        "serial_number": serial,
        "issuer_tin": body.issuer_tin,
        "document_type": body.document_type,
        "invoice_period": f"{body.period_year}-{body.period_month:02d}",
        "task_start_time": now.isoformat(),
        "task_end_time": now.isoformat(),  # instantaneous for MVP
        "task_type": "monthly_consolidation",
        "status": "completed" if matched else "no_data",
        "matched_documents": matched,
        "total_amount": round(total, 2),
        "created_at": now.isoformat(),
        "created_by": ctx["user"]["email"],
        "failure_reasons": [] if matched else ["No documents matched for the period"],
    }
    res = await db.consolidated_tasks.insert_one(doc)
    doc["_id"] = res.inserted_id
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="ics.consolidate.run",
                entity="consolidated_task", entity_id=str(res.inserted_id),
                meta={"serial": serial, "matched": matched})
    return _s(doc)


@router.get("/consolidated/{cid}/failure-reasons")
async def failure_reasons(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    t = await db.consolidated_tasks.find_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    if not t:
        raise HTTPException(404, "Not found")
    return {"failure_reasons": t.get("failure_reasons", []),
             "matched_documents": t.get("matched_documents", 0)}


@router.get("/reference")
async def reference():
    """Metadata dropdowns used across ICS forms."""
    return {
        "document_types": DOCUMENT_TYPES,
        "sources": SOURCES,
        "invoice_confirmation_statuses": CONFIRMATION_STATUSES,
        "validation_results": VALIDATION_RESULTS,
        "currencies": CURRENCIES,
        "invoice_issued": INVOICE_ISSUED,
        "transaction_statuses": ["draft", "submitting", "validated", "rejected", "cancelled", "voided"],
        "invoice_statuses": ["draft", "submitting", "validated", "rejected", "cancelled", "voided"],
    }


@router.get("/tin-list")
async def tin_list(ctx=Depends(require_tenant)):
    """Companies registered for this tenant, used as Issuer TIN dropdown."""
    db = get_db()
    out = []
    async for c in db.companies.find({"tenant_id": ctx["tenant_id"]}):
        out.append({
            "id": str(c["_id"]),
            "tin": c.get("tin"),
            "name": c.get("name"),
            "brn": c.get("brn"),
            "label": f"{c.get('tin')}({c.get('name', '')})",
        })
    return out


@router.post("/transactions/{iid}/request-cancel")
async def request_cancel(iid: str, body: dict, ctx=Depends(require_tenant)):
    """Fiscal-document 'Cancel' action — marks a validated document as cancel-requested."""
    db = get_db()
    doc = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Not found")
    now = datetime.now(timezone.utc).isoformat()
    timeline = doc.get("timeline", [])
    timeline.append({"status": "cancel_requested",
                      "note": f"Cancel requested: {body.get('reason', 'N/A')}",
                      "actor": ctx["user"]["email"], "at": now})
    await db.invoices.update_one({"_id": ObjectId(iid)},
        {"$set": {"cancel_requested": True, "cancel_requested_at": now,
                   "cancel_request_reason": body.get("reason"), "timeline": timeline}})
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="ics.cancel_request",
                entity="invoice", entity_id=iid, meta={"reason": body.get("reason")})
    return {"ok": True}


@router.post("/transactions/{iid}/request-credit-note")
async def request_credit_note(iid: str, ctx=Depends(require_tenant)):
    """Fiscal-document 'Request Credit Note' — creates a linked CN draft referencing original."""
    db = get_db()
    src = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not src:
        raise HTTPException(404, "Original not found")
    now = datetime.now(timezone.utc)
    cn = {
        **{k: v for k, v in src.items() if k not in ("_id", "government", "timeline",
                                                       "signing_session_id", "created_at",
                                                       "updated_at", "status")},
        "tenant_id": ctx["tenant_id"],
        "invoice_type": "credit_note",
        "invoice_number": f"CN-{now.strftime('%Y%m')}-{int(now.timestamp()) % 100000:05d}",
        "original_invoice_id": iid,
        "original_invoice_uuid": (src.get("government") or {}).get("uuid"),
        "original_invoice_number": src.get("invoice_number"),
        "status": "draft",
        "government": {},
        "timeline": [{"status": "draft", "note": f"Credit note requested against {src['invoice_number']}",
                        "actor": ctx["user"]["email"], "at": now.isoformat()}],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": ctx["user"]["id"],
        "created_by_email": ctx["user"]["email"],
    }
    res = await db.invoices.insert_one(cn)
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="ics.request_credit_note",
                entity="invoice", entity_id=str(res.inserted_id),
                meta={"original": src["invoice_number"]})
    return {"id": str(res.inserted_id), "invoice_number": cn["invoice_number"]}


@router.post("/transactions/{iid}/reject")
async def reject_purchase(iid: str, body: dict, ctx=Depends(require_tenant)):
    """My Purchase Invoices 'Reject' — buyer rejects a supplier's issued invoice."""
    db = get_db()
    doc = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Not found")
    now = datetime.now(timezone.utc).isoformat()
    timeline = doc.get("timeline", [])
    timeline.append({"status": "buyer_rejected",
                      "note": f"Rejected by buyer: {body.get('reason', 'N/A')}",
                      "actor": ctx["user"]["email"], "at": now})
    await db.invoices.update_one({"_id": ObjectId(iid)},
        {"$set": {"buyer_rejection_reason": body.get("reason"),
                   "invoice_confirmation_status": "rejected",
                   "timeline": timeline, "updated_at": now}})
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="ics.buyer_reject",
                entity="invoice", entity_id=iid, meta={"reason": body.get("reason")})
    return {"ok": True}
