from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional, List

from deps import get_db, require_tenant

router = APIRouter(prefix="/api/companies", tags=["companies"])


class Branch(BaseModel):
    code: str
    name: str
    city: Optional[str] = None


class CompanyIn(BaseModel):
    name: str
    legal_name: Optional[str] = None
    tin: str
    brn: str
    sst_number: Optional[str] = None
    country: str = "MY"
    currency: str = "MYR"
    timezone: str = "Asia/Kuala_Lumpur"
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    branches: List[Branch] = []


def _s(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def list_companies(ctx=Depends(require_tenant)):
    db = get_db()
    cur = db.companies.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1)
    return [_s(c) async for c in cur]


@router.post("")
async def create_company(body: CompanyIn, ctx=Depends(require_tenant)):
    db = get_db()
    doc = body.model_dump()
    doc["tenant_id"] = ctx["tenant_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.companies.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _s(doc)


@router.get("/{cid}")
async def get_company(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.companies.find_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Company not found")
    return _s(doc)


@router.put("/{cid}")
async def update_company(cid: str, body: CompanyIn, ctx=Depends(require_tenant)):
    db = get_db()
    res = await db.companies.update_one(
        {"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
        {"$set": body.model_dump()},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Company not found")
    doc = await db.companies.find_one({"_id": ObjectId(cid)})
    return _s(doc)


@router.delete("/{cid}")
async def delete_company(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    await db.companies.delete_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    return {"ok": True}
