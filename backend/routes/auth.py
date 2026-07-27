from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone
from bson import ObjectId

from security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, get_current_user,
)
from deps import get_db
from audit import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    tenant_name: str


def _serialize_user(u: dict) -> dict:
    return {
        "id": str(u["_id"]),
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "user"),
        "tenant_id": u.get("tenant_id"),
        "status": u.get("status", "active"),
    }


@router.post("/register")
async def register(body: RegisterBody, response: Response, request: Request):
    db = get_db()
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    now = datetime.now(timezone.utc).isoformat()
    tenant_res = await db.tenants.insert_one({
        "name": body.tenant_name,
        "slug": body.tenant_name.lower().replace(" ", "-")[:40] + "-" + str(int(datetime.now().timestamp())),
        "country": "MY",
        "currency": "MYR",
        "created_at": now,
    })
    tenant_id = str(tenant_res.inserted_id)
    user_res = await db.users.insert_one({
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "organization_owner",
        "tenant_id": tenant_id,
        "status": "active",
        "created_at": now,
    })
    user = await db.users.find_one({"_id": user_res.inserted_id})
    access = create_access_token(str(user["_id"]), user["email"], user["role"], tenant_id)
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    await audit(db, tenant_id=tenant_id, actor_id=str(user["_id"]), actor_email=email,
                action="register", entity="user", entity_id=str(user["_id"]),
                ip=request.client.host if request.client else None)
    return {"user": _serialize_user(user), "token": access}


@router.post("/login")
async def login(body: LoginBody, response: Response, request: Request):
    db = get_db()
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Account inactive")
    access = create_access_token(str(user["_id"]), user["email"], user["role"], user.get("tenant_id", ""))
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    await audit(db, tenant_id=user.get("tenant_id", ""), actor_id=str(user["_id"]),
                actor_email=email, action="login", entity="user", entity_id=str(user["_id"]),
                ip=request.client.host if request.client else None)
    return {"user": _serialize_user(user), "token": access}


@router.post("/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return user
