"""Shared dependencies: DB client, tenant scoping, and centralized indexes."""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import Depends, HTTPException
from pymongo import ASCENDING, DESCENDING
from security import get_current_user

_client: AsyncIOMotorClient | None = None
_db = None


def init_db():
    global _client, _db
    _client = AsyncIOMotorClient(
        os.environ["MONGO_URL"],
        maxPoolSize=50,
        minPoolSize=5,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=20000,
    )
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


async def ensure_indexes(db) -> None:
    """Create every index the app needs. Idempotent: `create_index` is a no-op
    when the index already exists.
    """
    # users
    await db.users.create_index("email", unique=True)
    await db.users.create_index([("tenant_id", ASCENDING), ("created_at", DESCENDING)])
    await db.users.create_index([("tenant_id", ASCENDING), ("role", ASCENDING)])
    # tenants
    await db.tenants.create_index("slug", unique=True)
    # companies
    await db.companies.create_index([("tenant_id", ASCENDING), ("created_at", DESCENDING)])
    await db.companies.create_index([("tenant_id", ASCENDING), ("tin", ASCENDING)])
    # customers
    await db.customers.create_index([("tenant_id", ASCENDING), ("created_at", DESCENDING)])
    await db.customers.create_index([("tenant_id", ASCENDING), ("tin", ASCENDING)])
    await db.customers.create_index([("tenant_id", ASCENDING), ("name", ASCENDING)])
    # suppliers
    await db.suppliers.create_index([("tenant_id", ASCENDING), ("created_at", DESCENDING)])
    await db.suppliers.create_index([("tenant_id", ASCENDING), ("name", ASCENDING)])
    # products
    await db.products.create_index([("tenant_id", ASCENDING), ("created_at", DESCENDING)])
    await db.products.create_index([("tenant_id", ASCENDING), ("sku", ASCENDING)])
    await db.products.create_index([("tenant_id", ASCENDING), ("name", ASCENDING)])
    # invoices — the hottest collection
    await db.invoices.create_index([("tenant_id", ASCENDING), ("created_at", DESCENDING)])
    await db.invoices.create_index([("tenant_id", ASCENDING), ("status", ASCENDING),
                                     ("created_at", DESCENDING)])
    await db.invoices.create_index([("tenant_id", ASCENDING), ("invoice_number", ASCENDING)])
    await db.invoices.create_index([("tenant_id", ASCENDING), ("invoice_date", DESCENDING)])
    await db.invoices.create_index([("tenant_id", ASCENDING), ("customer_id", ASCENDING)])
    await db.invoices.create_index([("tenant_id", ASCENDING), ("company_id", ASCENDING)])
    await db.invoices.create_index([("tenant_id", ASCENDING), ("external_client_id", ASCENDING),
                                     ("created_at", DESCENDING)])
    await db.invoices.create_index([("tenant_id", ASCENDING),
                                     ("customer_snapshot.tin", ASCENDING)])
    await db.invoices.create_index([("tenant_id", ASCENDING), ("government.uuid", ASCENDING)])
    # audit logs
    await db.audit_logs.create_index([("tenant_id", ASCENDING), ("created_at", DESCENDING)])
    await db.audit_logs.create_index([("tenant_id", ASCENDING), ("entity_id", ASCENDING),
                                       ("created_at", DESCENDING)])
    await db.audit_logs.create_index([("tenant_id", ASCENDING), ("action", ASCENDING)])
    # api clients + bridge
    await db.api_clients.create_index("client_id", unique=True)
    await db.api_clients.create_index([("tenant_id", ASCENDING), ("registered_at", DESCENDING)])
    await db.api_clients.create_index([("tenant_id", ASCENDING), ("status", ASCENDING)])
    # signing sessions (5-min TTL fields plus lookups)
    await db.signing_sessions.create_index([("tenant_id", ASCENDING), ("status", ASCENDING)])
    await db.signing_sessions.create_index("expires_at")
    # gov credentials
    await db.gov_credentials.create_index([("tenant_id", ASCENDING), ("country", ASCENDING)],
                                             unique=True)
    # ICS consolidated
    await db.consolidated_tasks.create_index([("tenant_id", ASCENDING),
                                                ("created_at", DESCENDING)])
    # MyTax
    await db.mytax_role_apps.create_index([("tenant_id", ASCENDING),
                                             ("created_at", DESCENDING)])
    await db.mytax_representatives.create_index([("tenant_id", ASCENDING),
                                                    ("created_at", DESCENDING)])
    await db.mytax_intermediaries.create_index([("tenant_id", ASCENDING),
                                                   ("created_at", DESCENDING)])


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
