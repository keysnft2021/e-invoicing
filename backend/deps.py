"""Shared dependencies: DB client + tenant scoping."""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import Depends, HTTPException
from security import get_current_user

_client: AsyncIOMotorClient | None = None
_db = None


def init_db():
    global _client, _db
    _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    _db = _client[os.environ["DB_NAME"]]
    return _db


def get_db():
    global _db
    if _db is None:
        init_db()
    return _db


def close_db():
    global _client
    if _client:
        _client.close()


async def require_tenant(user=Depends(get_current_user)):
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="User has no tenant assignment")
    return {"user": user, "tenant_id": tenant_id}


def require_role(*roles):
    async def _dep(user=Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Forbidden: insufficient role")
        return user
    return _dep
