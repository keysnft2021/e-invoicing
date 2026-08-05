"""User + Role management within a tenant."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional, List

from deps import get_db, require_tenant
from security import hash_password

router = APIRouter(tags=["admin"])


ROLES = [
    "super_admin", "organization_owner", "company_admin", "branch_admin",
    "finance_manager", "finance_executive", "accountant", "auditor",
    "sales", "purchasing", "inventory", "customer", "vendor",
    "api_user", "government_user", "support", "read_only",
]

PERMISSIONS = {
    "menu": ["dashboard", "invoices", "customers", "suppliers", "products",
             "companies", "users", "roles", "mytax", "audit", "settings"],
    "invoice_actions": ["create", "edit", "delete", "submit", "approve",
                         "cancel", "download", "export"],
    "government": ["submit", "cancel", "resubmit"],
}


def _s(u):
    u["id"] = str(u.pop("_id"))
    u.pop("password_hash", None)
    return u


class UserIn(BaseModel):
    email: EmailStr
    name: str
    role: str
    password: Optional[str] = None
    status: str = "active"


@router.get("/api/users")
async def list_users(ctx=Depends(require_tenant)):
    db = get_db()
    return [_s(c) async for c in db.users.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1)]


@router.post("/api/users")
async def create_user(body: UserIn, ctx=Depends(require_tenant)):
    db = get_db()
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already exists")
    now = datetime.now(timezone.utc).isoformat()
    pw = body.password or "Welcome@123"
    doc = {
        "email": email,
        "password_hash": hash_password(pw),
        "name": body.name,
        "role": body.role,
        "status": body.status,
        "tenant_id": ctx["tenant_id"],
        "created_at": now,
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    out = _s(doc)
    out["temp_password"] = pw
    return out


@router.put("/api/users/{uid}")
async def update_user(uid: str, body: UserIn, ctx=Depends(require_tenant)):
    db = get_db()
    update = {"email": body.email.lower(), "name": body.name, "role": body.role,
              "status": body.status}
    if body.password:
        update["password_hash"] = hash_password(body.password)
    r = await db.users.update_one({"_id": ObjectId(uid), "tenant_id": ctx["tenant_id"]},
                                    {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.users.find_one({"_id": ObjectId(uid)})
    return _s(doc)


@router.delete("/api/users/{uid}")
async def delete_user(uid: str, ctx=Depends(require_tenant)):
    db = get_db()
    if uid == ctx["user"]["id"]:
        raise HTTPException(400, "You cannot delete yourself")
    await db.users.delete_one({"_id": ObjectId(uid), "tenant_id": ctx["tenant_id"]})
    return {"ok": True}


@router.get("/api/roles")
async def list_roles(ctx=Depends(require_tenant)):
    db = get_db()
    saved = {}
    async for r in db.role_permissions.find({"tenant_id": ctx["tenant_id"]}):
        saved[r["role"]] = r.get("permissions", {})
    return {"roles": ROLES, "permissions": PERMISSIONS, "saved": saved}


class RolePermsBody(BaseModel):
    role: str
    permissions: dict


@router.put("/api/roles/permissions")
async def save_role_permissions(body: RolePermsBody, ctx=Depends(require_tenant)):
    if body.role not in ROLES:
        raise HTTPException(400, f"Unknown role {body.role}")
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    await db.role_permissions.update_one(
        {"tenant_id": ctx["tenant_id"], "role": body.role},
        {"$set": {"permissions": body.permissions, "updated_at": now,
                    "updated_by": ctx["user"]["email"]}},
        upsert=True,
    )
    return {"ok": True, "role": body.role}
