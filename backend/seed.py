"""Idempotent seed: admin user, tenant, sample company, tax codes."""
import os
from datetime import datetime, timezone
from bson import ObjectId
from security import hash_password, verify_password


async def seed(db):
    now = datetime.now(timezone.utc).isoformat()
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@einvoice.my")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@12345")

    # Tenant (Organization)
    tenant = await db.tenants.find_one({"slug": "acme"})
    if not tenant:
        res = await db.tenants.insert_one({
            "name": "Acme Holdings",
            "slug": "acme",
            "country": "MY",
            "currency": "MYR",
            "created_at": now,
        })
        tenant_id = str(res.inserted_id)
    else:
        tenant_id = str(tenant["_id"])

    # Admin user
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Platform Administrator",
            "role": "super_admin",
            "tenant_id": tenant_id,
            "status": "active",
            "created_at": now,
        })
    elif not verify_password(admin_password, admin.get("password_hash", "")):
        await db.users.update_one(
            {"_id": admin["_id"]},
            {"$set": {"password_hash": hash_password(admin_password), "tenant_id": tenant_id}},
        )
    else:
        # Ensure tenant_id set
        if not admin.get("tenant_id"):
            await db.users.update_one({"_id": admin["_id"]}, {"$set": {"tenant_id": tenant_id}})

    # Sample company
    if not await db.companies.find_one({"tenant_id": tenant_id}):
        await db.companies.insert_one({
            "tenant_id": tenant_id,
            "name": "Acme Manufacturing Sdn Bhd",
            "legal_name": "Acme Manufacturing Sdn Bhd",
            "tin": "C24681012340",
            "brn": "202301012345",
            "sst_number": "W10-2201-32000123",
            "country": "MY",
            "currency": "MYR",
            "timezone": "Asia/Kuala_Lumpur",
            "address_line1": "Level 12, Menara Acme",
            "address_line2": "Jalan Ampang",
            "city": "Kuala Lumpur",
            "state": "Wilayah Persekutuan",
            "postal_code": "50450",
            "email": "billing@acme.my",
            "phone": "+60312345678",
            "branches": [
                {"code": "HQ", "name": "Head Office", "city": "Kuala Lumpur"},
                {"code": "PG", "name": "Penang Plant", "city": "Bayan Lepas"},
            ],
            "created_at": now,
        })

    # Sample customers
    if await db.customers.count_documents({"tenant_id": tenant_id}) == 0:
        await db.customers.insert_many([
            {"tenant_id": tenant_id, "name": "Global Retail Sdn Bhd", "tin": "C11112223334",
             "brn": "202001019876", "email": "ap@globalretail.my", "phone": "+60322334455",
             "country": "MY", "currency": "MYR", "credit_limit": 250000,
             "billing_address": "Menara Global, Kuala Lumpur", "created_at": now},
            {"tenant_id": tenant_id, "name": "Sinar Cahaya Enterprise", "tin": "IG55667788990",
             "brn": "SA0088776655", "email": "finance@sinarcahaya.my", "phone": "+60355667788",
             "country": "MY", "currency": "MYR", "credit_limit": 80000,
             "billing_address": "12 Jalan Damai, Petaling Jaya", "created_at": now},
        ])

    # Sample suppliers
    if await db.suppliers.count_documents({"tenant_id": tenant_id}) == 0:
        await db.suppliers.insert_many([
            {"tenant_id": tenant_id, "name": "SteelWorks Malaysia", "tin": "C99887766550",
             "brn": "199901012345", "email": "sales@steelworks.my", "country": "MY",
             "currency": "MYR", "created_at": now},
            {"tenant_id": tenant_id, "name": "TransLogistics Bhd", "tin": "C44332211009",
             "brn": "201801098765", "email": "billing@translog.my", "country": "MY",
             "currency": "MYR", "created_at": now},
        ])

    # Sample products
    if await db.products.count_documents({"tenant_id": tenant_id}) == 0:
        await db.products.insert_many([
            {"tenant_id": tenant_id, "sku": "SVC-CONSULT", "name": "Consulting Services (per hour)",
             "type": "service", "unit_price": 350.00, "tax_code": "SST-6", "tax_rate": 6,
             "hs_code": "9983", "classification_code": "022", "unit": "HR", "created_at": now},
            {"tenant_id": tenant_id, "sku": "PRD-STEEL-A1", "name": "Stainless Steel Sheet A1",
             "type": "goods", "unit_price": 1200.00, "tax_code": "SST-6", "tax_rate": 6,
             "hs_code": "7219.13", "classification_code": "004", "unit": "PCS", "created_at": now},
            {"tenant_id": tenant_id, "sku": "SW-LIC-ANNUAL", "name": "Software License (annual)",
             "type": "service", "unit_price": 4800.00, "tax_code": "SST-8", "tax_rate": 8,
             "hs_code": "8523", "classification_code": "022", "unit": "LIC", "created_at": now},
        ])

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.tenants.create_index("slug", unique=True)
    await db.invoices.create_index([("tenant_id", 1), ("invoice_number", 1)])
    await db.audit_logs.create_index([("tenant_id", 1), ("created_at", -1)])
