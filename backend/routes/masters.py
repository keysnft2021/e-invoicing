"""Customers, Suppliers, Products master data (share CRUD pattern)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional

from deps import get_db, require_tenant

router = APIRouter(tags=["masters"])


def _s(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


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


@router.get("/api/customers")
async def list_customers(ctx=Depends(require_tenant)):
    db = get_db()
    return [_s(c) async for c in db.customers.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1)]


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
    r = await db.customers.update_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
                                       {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.customers.find_one({"_id": ObjectId(cid)})
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


@router.get("/api/suppliers")
async def list_suppliers(ctx=Depends(require_tenant)):
    db = get_db()
    return [_s(c) async for c in db.suppliers.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1)]


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
    r = await db.suppliers.update_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
                                       {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.suppliers.find_one({"_id": ObjectId(cid)})
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
    type: str = "goods"  # goods | service | bundle
    unit_price: float = 0
    tax_code: str = "SST-6"
    tax_rate: float = 6
    hs_code: Optional[str] = None
    classification_code: Optional[str] = None
    unit: str = "PCS"
    description: Optional[str] = None


@router.get("/api/products")
async def list_products(ctx=Depends(require_tenant)):
    db = get_db()
    return [_s(c) async for c in db.products.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1)]


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
    r = await db.products.update_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]},
                                      {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.products.find_one({"_id": ObjectId(cid)})
    return _s(doc)


@router.delete("/api/products/{cid}")
async def delete_product(cid: str, ctx=Depends(require_tenant)):
    db = get_db()
    await db.products.delete_one({"_id": ObjectId(cid), "tenant_id": ctx["tenant_id"]})
    return {"ok": True}
