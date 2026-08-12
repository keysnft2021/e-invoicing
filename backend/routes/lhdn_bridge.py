"""LHDN Bridge — parity endpoints for MY101/MY103/MY104/MY105/MY109/MY117/MY119
(batch invoice issuance, cancel with reason codes, purchase-invoice list & reject,
void transactions, taxpayer lookups). Aligns our API with the Malaysia ICS spec.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
from typing import List, Optional
import base64
import json
import uuid as uuid_lib

from deps import get_db, require_tenant
from audit import audit

router = APIRouter(tags=["lhdn-bridge"])


def _s(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


# ============================================================================
# MY103 — Cancel with reason codes (batch)
# ============================================================================
CANCEL_CODES = {
    "1": "Wrong buyer details",
    "2": "Wrong invoice details",
    "3": "Other reasons",
}


class CancelBatchBody(BaseModel):
    invoice_ids: List[str] = Field(..., alias="invoiceIds")
    cancel_code: str = Field(..., alias="cancelCode")  # "1" | "2" | "3"
    cancel_reason: Optional[str] = Field(None, alias="cancelReason")

    class Config:
        populate_by_name = True


@router.post("/api/invoices/cancel-batch")
async def cancel_batch(body: CancelBatchBody, ctx=Depends(require_tenant)):
    if body.cancel_code not in CANCEL_CODES:
        raise HTTPException(400, "cancelCode must be 1, 2 or 3")
    if body.cancel_code == "3" and not (body.cancel_reason and body.cancel_reason.strip()):
        raise HTTPException(400, "cancelReason is mandatory when cancelCode=3")

    db = get_db()
    reason = body.cancel_reason or CANCEL_CODES[body.cancel_code]
    now = datetime.now(timezone.utc).isoformat()
    accepted, rejected = [], []

    for iid in body.invoice_ids:
        try:
            doc = await db.invoices.find_one(
                {"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]},
            )
        except Exception:
            rejected.append({"invoiceId": iid, "error": "Invalid ID"})
            continue
        if not doc:
            rejected.append({"invoiceId": iid, "error": "Not found"})
            continue
        if doc["status"] not in ("validated", "submitted"):
            rejected.append({"invoiceId": iid,
                              "error": f"Cannot cancel invoice in status {doc['status']}"})
            continue
        timeline = doc.get("timeline", [])
        timeline.append({"status": "cancelled",
                          "note": f"Cancelled — code {body.cancel_code}: {reason}",
                          "actor": ctx["user"]["email"], "at": now})
        await db.invoices.update_one(
            {"_id": ObjectId(iid)},
            {"$set": {
                "status": "cancelled",
                "cancellation": {"code": body.cancel_code,
                                  "reason": reason,
                                  "at": now,
                                  "by": ctx["user"]["email"]},
                "timeline": timeline,
                "updated_at": now,
            }},
        )
        accepted.append({"invoiceId": iid,
                          "invoiceNumber": doc["invoice_number"]})
        await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                    actor_email=ctx["user"]["email"], action="invoice.cancel",
                    entity="invoice", entity_id=iid,
                    meta={"cancelCode": body.cancel_code, "cancelReason": reason})

    return {
        "cancelled": accepted,
        "rejected": rejected,
        "summary": {"total": len(body.invoice_ids),
                     "cancelled": len(accepted),
                     "rejected": len(rejected)},
    }


# ============================================================================
# MY104 / MY105 — Purchase (inbound) invoices — list + reject / confirm
# ============================================================================
class PurchaseInvoiceRejectBody(BaseModel):
    confirm_reject_code: str = Field(..., alias="confirmRejectCode")  # 1 | 2 | 3
    confirm_reject_reason: Optional[str] = Field(None, alias="confirmRejectReason")

    class Config:
        populate_by_name = True


REJECT_CODES = {
    "1": "Wrong buyer details",
    "2": "Wrong invoice details",
    "3": "Other reasons",
}


@router.get("/api/purchase-invoices")
async def list_purchase_invoices(
    ctx=Depends(require_tenant),
    q: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    skip: int = Query(0, ge=0),
):
    """Documents received from other suppliers via LHDN where we're the buyer."""
    db = get_db()
    query = {"tenant_id": ctx["tenant_id"]}
    if status and status != "all":
        query["status"] = status
    if q:
        query["$or"] = [
            {"supplier_name": {"$regex": q, "$options": "i"}},
            {"supplier_tin": {"$regex": q, "$options": "i"}},
            {"uuid": {"$regex": q, "$options": "i"}},
            {"internal_id": {"$regex": q, "$options": "i"}},
        ]
    cur = (db.purchase_invoices.find(query)
                                 .sort("date_time_issued", -1)
                                 .skip(skip).limit(limit))
    return [_s(c) async for c in cur]


@router.get("/api/purchase-invoices/{pid}")
async def get_purchase_invoice(pid: str, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.purchase_invoices.find_one(
        {"_id": ObjectId(pid), "tenant_id": ctx["tenant_id"]},
    )
    if not doc:
        raise HTTPException(404, "Not found")
    return _s(doc)


@router.post("/api/purchase-invoices/{pid}/reject")
async def reject_purchase_invoice(pid: str,
                                    body: PurchaseInvoiceRejectBody,
                                    ctx=Depends(require_tenant)):
    if body.confirm_reject_code not in REJECT_CODES:
        raise HTTPException(400, "confirmRejectCode must be 1, 2 or 3")
    if body.confirm_reject_code == "3" and not (body.confirm_reject_reason and
                                                  body.confirm_reject_reason.strip()):
        raise HTTPException(400,
                              "confirmRejectReason is mandatory when confirmRejectCode=3")
    db = get_db()
    doc = await db.purchase_invoices.find_one(
        {"_id": ObjectId(pid), "tenant_id": ctx["tenant_id"]},
    )
    if not doc:
        raise HTTPException(404, "Not found")
    reason = body.confirm_reject_reason or REJECT_CODES[body.confirm_reject_code]
    now = datetime.now(timezone.utc).isoformat()
    await db.purchase_invoices.update_one(
        {"_id": ObjectId(pid)},
        {"$set": {
            "confirm_status_code": "2",  # Rejected
            "confirm_reject_code": body.confirm_reject_code,
            "confirm_reject_reason": reason,
            "reject_request_date_time": now,
            "updated_at": now,
        }},
    )
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"],
                action="purchase_invoice.reject", entity="purchase_invoice",
                entity_id=pid, meta={"code": body.confirm_reject_code, "reason": reason})
    doc = await db.purchase_invoices.find_one({"_id": ObjectId(pid)})
    return _s(doc)


@router.post("/api/purchase-invoices/{pid}/confirm")
async def confirm_purchase_invoice(pid: str, ctx=Depends(require_tenant)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    r = await db.purchase_invoices.update_one(
        {"_id": ObjectId(pid), "tenant_id": ctx["tenant_id"]},
        {"$set": {"confirm_status_code": "1",  # Accepted
                   "updated_at": now}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.purchase_invoices.find_one({"_id": ObjectId(pid)})
    return _s(doc)


@router.post("/api/purchase-invoices/seed")
async def seed_purchase_invoices(ctx=Depends(require_tenant)):
    """Dev / demo: seed a few inbound invoices so the Purchase list has data.
    In production this is filled by the LHDN GetDocumentsToProcess cron job.
    """
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    samples = [
        {"tenant_id": ctx["tenant_id"], "uuid": str(uuid_lib.uuid4()),
         "internal_id": "SUP-INV-0001", "long_id": "".join([str(uuid_lib.uuid4().int)[:12]]),
         "supplier_tin": "C1234567890", "supplier_name": "MediCare Wholesale Sdn Bhd",
         "buyer_tin": "C24700902040", "buyer_name": "DFACE HEALTHCARE SDN BHD",
         "type_name": "invoice", "type_version_name": "1.0",
         "date_time_issued": now, "date_time_received": now,
         "date_time_validated": now,
         "total_sales": 1500.00, "total_discount": 0, "net_amount": 1500.00,
         "total": 1590.00, "status": "validated",
         "confirm_status_code": "0",  # Awaiting
         "submission_channel": "LHDN",
         "created_at": now, "updated_at": now},
        {"tenant_id": ctx["tenant_id"], "uuid": str(uuid_lib.uuid4()),
         "internal_id": "SUP-INV-0002", "long_id": "".join([str(uuid_lib.uuid4().int)[:12]]),
         "supplier_tin": "C9876543210", "supplier_name": "Pharma Direct Sdn Bhd",
         "buyer_tin": "C24700902040", "buyer_name": "DFACE HEALTHCARE SDN BHD",
         "type_name": "invoice", "type_version_name": "1.0",
         "date_time_issued": now, "date_time_received": now,
         "date_time_validated": now,
         "total_sales": 620.00, "total_discount": 20.00, "net_amount": 600.00,
         "total": 636.00, "status": "validated",
         "confirm_status_code": "0",
         "submission_channel": "LHDN",
         "created_at": now, "updated_at": now},
    ]
    for s in samples:
        await db.purchase_invoices.update_one(
            {"tenant_id": ctx["tenant_id"], "internal_id": s["internal_id"]},
            {"$setOnInsert": s},
            upsert=True,
        )
    count = await db.purchase_invoices.count_documents({"tenant_id": ctx["tenant_id"]})
    return {"seeded": True, "total_in_tenant": count}


# ============================================================================
# MY109 — Void transaction (batch, max 100)
# ============================================================================
class VoidBody(BaseModel):
    invoice_ids: List[str] = Field(..., alias="invoiceIds")

    class Config:
        populate_by_name = True


@router.post("/api/invoices/void-batch")
async def void_invoices(body: VoidBody, ctx=Depends(require_tenant)):
    if len(body.invoice_ids) > 100:
        raise HTTPException(400, "Max 100 documents per batch")
    db = get_db()
    voided, rejected = [], []
    for iid in body.invoice_ids:
        try:
            doc = await db.invoices.find_one(
                {"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]},
            )
        except Exception:
            rejected.append({"invoiceId": iid, "error": "Invalid ID"})
            continue
        if not doc:
            rejected.append({"invoiceId": iid, "error": "Not found"})
            continue
        if doc["status"] != "draft":
            rejected.append({"invoiceId": iid,
                              "error": "Only draft invoices can be voided"})
            continue
        await db.invoices.delete_one({"_id": ObjectId(iid)})
        voided.append({"invoiceId": iid, "invoiceNumber": doc["invoice_number"]})
    return {"voided": voided, "rejected": rejected,
             "summary": {"total": len(body.invoice_ids),
                          "voided": len(voided), "rejected": len(rejected)}}


# ============================================================================
# MY117 — Get Taxpayer Info by TIN
# MY119 — Scan QR to get taxpayer from LHDN
# ============================================================================
class TinLookupBody(BaseModel):
    tin: str


class QrLookupBody(BaseModel):
    qr_code: str = Field(..., alias="qrCode")

    class Config:
        populate_by_name = True


# In production these would call LHDN's taxpayer search API. For preview / dev
# we serve a small canned directory of test taxpayers that mirrors the LHDN
# preprod fixtures — same shape as MY119 response.
_TAXPAYER_FIXTURES = {
    "C24700902040": {
        "name": "DFACE HEALTHCARE SDN BHD",
        "tin": "C24700902040",
        "id_type": "Business Registration Number",
        "id_number": "201601034740",
        "sst": None,
        "email": "billing@dface.my",
        "contact_number": "+60312345678",
        "ttx": None,
        "business_activity_description_bm": "Perkhidmatan perubatan am",
        "business_activity_description_en": "General medical services",
        "msic": "86201",
        "address_line_0": "Level 12, Menara Acme",
        "address_line_1": "Jalan Ampang",
        "address_line_2": "",
        "postal_zone": "50450",
        "city": "Bukit Bintang",
        "state": "Wilayah Persekutuan Kuala Lumpur",
        "country": "MYS",
    },
    "C1234567890": {
        "name": "MediCare Wholesale Sdn Bhd",
        "tin": "C1234567890",
        "id_type": "Business Registration Number",
        "id_number": "199201054321",
        "sst": "W10-1808-32000123",
        "email": "sales@medicare-wholesale.my",
        "contact_number": "+60322334455",
        "ttx": None,
        "business_activity_description_bm": "Perdagangan borong ubat-ubatan",
        "business_activity_description_en": "Wholesale of pharmaceuticals",
        "msic": "46499",
        "address_line_0": "No. 12, Jalan Perdagangan 5",
        "address_line_1": "Taman Perindustrian Puchong",
        "address_line_2": "",
        "postal_zone": "47100",
        "city": "Puchong",
        "state": "Selangor",
        "country": "MYS",
    },
    "C9876543210": {
        "name": "Pharma Direct Sdn Bhd",
        "tin": "C9876543210",
        "id_type": "Business Registration Number",
        "id_number": "201501012345",
        "sst": "W10-1808-32000456",
        "email": "orders@pharmadirect.my",
        "contact_number": "+60377712345",
        "ttx": None,
        "business_activity_description_bm": "Perdagangan runcit ubat",
        "business_activity_description_en": "Retail of pharmaceuticals",
        "msic": "47721",
        "address_line_0": "Suite 8, Level 15, Menara XYZ",
        "address_line_1": "Jalan Sultan Ismail",
        "address_line_2": "",
        "postal_zone": "50250",
        "city": "Bukit Bintang",
        "state": "Wilayah Persekutuan Kuala Lumpur",
        "country": "MYS",
    },
}


def _lookup_by_tin(tin: str):
    if not tin:
        return None
    return _TAXPAYER_FIXTURES.get(tin.strip().upper())


@router.post("/api/taxpayer/by-tin")
async def taxpayer_by_tin(body: TinLookupBody, ctx=Depends(require_tenant)):
    """MY117 equivalent — verify a TIN with LHDN and return the party record."""
    rec = _lookup_by_tin(body.tin)
    if not rec:
        raise HTTPException(404, f"TIN {body.tin} not found in LHDN registry")
    return {**rec, "generated_timestamp": datetime.now(timezone.utc).isoformat(),
             "source": "LHDN preprod (fixture)"}


@router.post("/api/taxpayer/lookup-qr")
async def taxpayer_by_qr(body: QrLookupBody, ctx=Depends(require_tenant)):
    """MY119 equivalent — decode LHDN QR content and return the taxpayer.

    Accepts either the raw QR content, a Base64 blob, or a `tin:<TIN>` shortcut.
    """
    raw = body.qr_code.strip()
    tin = None
    # 1. tin:<TIN> shortcut used by our own generator for demos
    if raw.lower().startswith("tin:"):
        tin = raw.split(":", 1)[1].strip()
    else:
        # 2. Try base64 → JSON with a `tin` field
        try:
            decoded = base64.b64decode(raw).decode("utf-8")
            payload = json.loads(decoded)
            tin = payload.get("tin") or payload.get("TIN")
        except Exception:
            pass
    # 3. Fall back to treating the whole string as a TIN
    if not tin:
        tin = raw
    rec = _lookup_by_tin(tin)
    if not rec:
        raise HTTPException(404,
                              f"Could not resolve TIN from QR "
                              f"(tried {tin}). QR content invalid or unknown taxpayer.")
    return {**rec, "generated_timestamp": datetime.now(timezone.utc).isoformat(),
             "source": "LHDN preprod (QR fixture)"}
