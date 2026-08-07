"""Frequent Contacts (LHDN 'Supplier & Buyer' registry) — unified party master
list used across e-invoices. Contacts can be tagged as supplier, buyer, or both.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional, Literal

from deps import get_db, require_tenant

router = APIRouter(tags=["frequent-contacts"])


def _s(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


class FrequentContactIn(BaseModel):
    company_id: Optional[str] = None
    party_type: Literal["supplier", "buyer", "both"] = "both"
    id_type: str = "Business Registration Number"  # BRN | NRIC | Passport | Army
    id_value: str
    tin: str
    name: str
    sst_registration_number: Optional[str] = None
    tourism_tax_registration_number: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    buyer_code: Optional[str] = None
    msic_code: Optional[str] = None
    msic_description: Optional[str] = None
    authorisation_number: Optional[str] = None
    business_activity: Optional[str] = None
    country: str = "MYS"
    state: Optional[str] = None
    city: Optional[str] = None
    addr_line_0: Optional[str] = None
    addr_line_1: Optional[str] = None
    addr_line_2: Optional[str] = None
    postal_zone: Optional[str] = None
    enabled: bool = True


PROJ = {
    "company_id": 1, "party_type": 1, "id_type": 1, "id_value": 1,
    "tin": 1, "name": 1, "sst_registration_number": 1,
    "tourism_tax_registration_number": 1, "contact_number": 1, "email": 1,
    "buyer_code": 1, "msic_code": 1, "msic_description": 1,
    "authorisation_number": 1, "business_activity": 1,
    "country": 1, "state": 1, "city": 1,
    "addr_line_0": 1, "addr_line_1": 1, "addr_line_2": 1, "postal_zone": 1,
    "enabled": 1, "created_at": 1, "updated_at": 1, "created_by": 1,
}


@router.get("/api/frequent-contacts")
async def list_contacts(
    ctx=Depends(require_tenant),
    q: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    skip: int = Query(0, ge=0),
):
    db = get_db()
    query = {"tenant_id": ctx["tenant_id"]}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"tin": {"$regex": q, "$options": "i"}},
            {"id_value": {"$regex": q, "$options": "i"}},
            {"buyer_code": {"$regex": q, "$options": "i"}},
        ]
    cur = (db.frequent_contacts.find(query, PROJ)
                                .sort("created_at", -1).skip(skip).limit(limit))
    return [_s(c) async for c in cur]


@router.get("/api/frequent-contacts/{cid}")
async def get_contact(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.frequent_contacts.find_one(
        {"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
    )
    if not doc:
        raise HTTPException(404, "Not found")
    return _s(doc)


@router.post("/api/frequent-contacts")
async def create_contact(body: FrequentContactIn, ctx=Depends(require_tenant)):
    db = get_db()
    doc = body.model_dump()
    doc["tenant_id"] = ctx["tenant_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = ctx.get("user_email") or ctx.get("user_id")
    res = await db.frequent_contacts.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _s(doc)


@router.put("/api/frequent-contacts/{cid}")
async def update_contact(cid: str, body: FrequentContactIn, ctx=Depends(require_tenant)):
    db = get_db()
    patch = body.model_dump()
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = await db.frequent_contacts.update_one(
        {"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
        {"$set": patch},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.frequent_contacts.find_one({"_id": ObjectId(cid)}, PROJ)
    return _s(doc)


@router.delete("/api/frequent-contacts/{cid}")
async def delete_contact(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    await db.frequent_contacts.delete_one(
        {"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
    )
    return {"ok": True}
