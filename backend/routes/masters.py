"""Customers, Suppliers, Products master data — paginated, projected, indexed."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional

from deps import get_db, require_tenant

router = APIRouter(tags=["masters"])


def _s(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


def _search_stage(q_text: Optional[str], fields: list[str]) -> dict:
    if not q_text:
        return {}
    esc = q_text.strip()
    if not esc:
        return {}
    return {"$or": [{f: {"$regex": esc, "$options": "i"}} for f in fields]}


# ---------- Customers ----------
class CustomerIn(BaseModel):
    name: str
    tin: Optional[str] = None
    brn: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: str = "MY"
    currency: str = "MYR"
    credit_limit: float = 0
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    payment_terms: str = "NET30"


CUST_LIST_PROJ = {
    "name": 1, "tin": 1, "brn": 1, "email": 1, "phone": 1,
    "country": 1, "currency": 1, "credit_limit": 1, "payment_terms": 1,
    "billing_address": 1, "created_at": 1,
}


@router.get("/api/customers")
async def list_customers(
    ctx=Depends(require_tenant),
    q: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
):
    db = get_db()
    query = {"tenant_id": ctx["tenant_id"], **_search_stage(q, ["name", "tin", "email"])}
    cur = (db.customers.find(query, CUST_LIST_PROJ)
                        .sort("created_at", -1).skip(skip).limit(limit))
    return [_s(c) async for c in cur]


@router.post("/api/customers")
async def create_customer(body: CustomerIn, ctx=Depends(require_tenant)):
    db = get_db()
    doc = body.model_dump()
    doc["tenant_id"] = ctx["tenant_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.customers.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _s(doc)


@router.put("/api/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, ctx=Depends(require_tenant)):
    db = get_db()
    r = await db.customers.update_one(
        {"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
        {"$set": body.model_dump()},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.customers.find_one({"_id": ObjectId(cid)}, CUST_LIST_PROJ)
    return _s(doc)


@router.delete("/api/customers/{cid}")
async def delete_customer(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    await db.customers.delete_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    return {"ok": True}


# ---------- Suppliers ----------
class SupplierIn(BaseModel):
    name: str
    tin: Optional[str] = None
    brn: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: str = "MY"
    currency: str = "MYR"
    payment_terms: str = "NET30"
    billing_address: Optional[str] = None
    msic_code: Optional[str] = None
    msic_description: Optional[str] = None
    # LHDN portal fields
    company_id: Optional[str] = None
    id_type: Optional[str] = "Business Registration Number"
    sst_registration_number: Optional[str] = None
    tourism_tax_registration_number: Optional[str] = None
    authorisation_number: Optional[str] = None
    business_activity: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    addr_line_0: Optional[str] = None
    addr_line_1: Optional[str] = None
    addr_line_2: Optional[str] = None
    postal_zone: Optional[str] = None
    enabled: Optional[bool] = True


SUP_LIST_PROJ = {
    "name": 1, "tin": 1, "brn": 1, "email": 1, "phone": 1,
    "country": 1, "currency": 1, "payment_terms": 1, "created_at": 1,
    "billing_address": 1, "msic_code": 1, "msic_description": 1,
    "company_id": 1, "id_type": 1, "sst_registration_number": 1,
    "tourism_tax_registration_number": 1, "authorisation_number": 1,
    "business_activity": 1, "state": 1, "city": 1,
    "addr_line_0": 1, "addr_line_1": 1, "addr_line_2": 1, "postal_zone": 1,
    "enabled": 1, "updated_at": 1,
}


@router.get("/api/suppliers")
async def list_suppliers(
    ctx=Depends(require_tenant),
    q: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
):
    db = get_db()
    query = {"tenant_id": ctx["tenant_id"], **_search_stage(q, ["name", "tin", "email"])}
    cur = (db.suppliers.find(query, SUP_LIST_PROJ)
                        .sort("created_at", -1).skip(skip).limit(limit))
    return [_s(c) async for c in cur]


@router.get("/api/suppliers/{cid}")
async def get_supplier(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.suppliers.find_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Not found")
    return _s(doc)


@router.post("/api/suppliers")
async def create_supplier(body: SupplierIn, ctx=Depends(require_tenant)):
    db = get_db()
    doc = body.model_dump()
    doc["tenant_id"] = ctx["tenant_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.suppliers.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _s(doc)


@router.put("/api/suppliers/{cid}")
async def update_supplier(cid: str, body: SupplierIn, ctx=Depends(require_tenant)):
    db = get_db()
    r = await db.suppliers.update_one(
        {"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
        {"$set": body.model_dump()},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.suppliers.find_one({"_id": ObjectId(cid)}, SUP_LIST_PROJ)
    return _s(doc)


@router.delete("/api/suppliers/{cid}")
async def delete_supplier(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    await db.suppliers.delete_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    return {"ok": True}


# ---------- Products ----------
class ProductIn(BaseModel):
    sku: str
    name: str
    type: str = "goods"
    unit_price: float = 0
    tax_code: str = "SST-6"
    tax_rate: float = 6
    hs_code: Optional[str] = None
    classification_code: Optional[str] = None
    unit: str = "PCS"
    description: Optional[str] = None
    msic_code: Optional[str] = None
    msic_description: Optional[str] = None
    # LHDN portal fields
    company_id: Optional[str] = None
    country_of_origin: Optional[str] = "MYS"
    discount_rate: float = 0
    discount_reason: Optional[str] = None
    fee_charge_rate: float = 0
    fee_charge_reason: Optional[str] = None
    remarks: Optional[str] = None
    tax_details: Optional[list] = None
    enabled: Optional[bool] = True


PROD_LIST_PROJ = {
    "sku": 1, "name": 1, "type": 1, "unit_price": 1, "tax_code": 1,
    "tax_rate": 1, "hs_code": 1, "classification_code": 1, "unit": 1,
    "description": 1, "created_at": 1, "msic_code": 1, "msic_description": 1,
    "company_id": 1, "country_of_origin": 1, "discount_rate": 1,
    "discount_reason": 1, "fee_charge_rate": 1, "fee_charge_reason": 1,
    "remarks": 1, "tax_details": 1, "enabled": 1,
}


@router.get("/api/products")
async def list_products(
    ctx=Depends(require_tenant),
    q: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
):
    db = get_db()
    query = {"tenant_id": ctx["tenant_id"], **_search_stage(q, ["name", "sku", "hs_code"])}
    cur = (db.products.find(query, PROD_LIST_PROJ)
                       .sort("created_at", -1).skip(skip).limit(limit))
    return [_s(c) async for c in cur]


@router.get("/api/products/{cid}")
async def get_product(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.products.find_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Not found")
    return _s(doc)


@router.post("/api/products")
async def create_product(body: ProductIn, ctx=Depends(require_tenant)):
    db = get_db()
    doc = body.model_dump()
    doc["tenant_id"] = ctx["tenant_id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.products.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _s(doc)


@router.put("/api/products/{cid}")
async def update_product(cid: str, body: ProductIn, ctx=Depends(require_tenant)):
    db = get_db()
    r = await db.products.update_one(
        {"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
        {"$set": body.model_dump()},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.products.find_one({"_id": ObjectId(cid)}, PROD_LIST_PROJ)
    return _s(doc)


@router.delete("/api/products/{cid}")
async def delete_product(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    await db.products.delete_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    return {"ok": True}
