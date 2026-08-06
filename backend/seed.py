"""Idempotent seed: admin, tenant, sample company, and a modest set of
realistic demo data so the dashboard and every module look populated
without ballooning the database.

Running this multiple times is a no-op — every insert is guarded by an
existence check keyed on a natural identifier (name / SKU / invoice_number).
"""
import os
import random
from datetime import datetime, timezone, timedelta
from security import hash_password, verify_password


DEMO_CUSTOMERS = [
    {"name": "Global Retail Sdn Bhd", "tin": "C11112223334", "brn": "202001019876",
     "email": "ap@globalretail.my", "phone": "+60322334455",
     "billing_address": "Menara Global, Jalan Ampang, Kuala Lumpur",
     "credit_limit": 250000},
    {"name": "Sinar Cahaya Enterprise", "tin": "IG55667788990", "brn": "SA0088776655",
     "email": "finance@sinarcahaya.my", "phone": "+60355667788",
     "billing_address": "12 Jalan Damai, Petaling Jaya",
     "credit_limit": 80000},
    {"name": "MediCare Hospital Berhad", "tin": "C77889900112", "brn": "199801023456",
     "email": "billing@medicare.my", "phone": "+60378889900",
     "billing_address": "Jalan Bukit Bintang, Kuala Lumpur",
     "credit_limit": 500000},
    {"name": "Pantai Steel Trading", "tin": "C22334455667", "brn": "201501034567",
     "email": "orders@pantai-steel.my", "phone": "+60377712345",
     "billing_address": "Kawasan Perindustrian, Shah Alam",
     "credit_limit": 150000},
    {"name": "Retail Buyer Sdn Bhd", "tin": "C25845632020", "brn": "202699999999",
     "email": "buyer@retailbuyer.my", "phone": "+60312345678",
     "billing_address": "88 Jalan Sultan, Kuala Lumpur",
     "credit_limit": 100000},
    {"name": "Kuching Trading Co", "tin": "C33445566778", "brn": "199906012345",
     "email": "ap@kuchingtrading.my", "phone": "+60822334455",
     "billing_address": "Lot 12, Jalan Padungan, Kuching",
     "credit_limit": 60000},
    {"name": "Penang Tech Solutions", "tin": "C44556677889", "brn": "202101056789",
     "email": "finance@penangtech.my", "phone": "+60466778899",
     "billing_address": "Bayan Lepas Free Industrial Zone, Penang",
     "credit_limit": 200000},
    {"name": "Johor Logistics Berhad", "tin": "C55667788990", "brn": "201801067890",
     "email": "billing@johorlog.my", "phone": "+60712345678",
     "billing_address": "Pasir Gudang, Johor",
     "credit_limit": 300000},
]

DEMO_SUPPLIERS = [
    {"name": "SteelWorks Malaysia", "tin": "C99887766550", "brn": "199901012345",
     "email": "sales@steelworks.my", "phone": "+60312001200"},
    {"name": "TransLogistics Bhd", "tin": "C44332211009", "brn": "201801098765",
     "email": "billing@translog.my", "phone": "+60322003000"},
    {"name": "Tenaga Utilities", "tin": "C11223344556", "brn": "199601045678",
     "email": "corporate@tenaga.my", "phone": "+60315451500"},
    {"name": "Office Supplies Direct", "tin": "C66778899001", "brn": "202001078901",
     "email": "sales@officesupplies.my", "phone": "+60378889000"},
    {"name": "Cloud Hosting MY", "tin": "C88990011223", "brn": "202101089012",
     "email": "billing@cloudhost.my", "phone": "+60322778899"},
]

DEMO_PRODUCTS = [
    {"sku": "SVC-CONSULT", "name": "Consulting Services (per hour)",
     "type": "service", "unit_price": 350.00, "tax_rate": 6, "unit": "HR",
     "hs_code": "9983", "classification_code": "022"},
    {"sku": "PRD-STEEL-A1", "name": "Stainless Steel Sheet A1",
     "type": "goods", "unit_price": 1200.00, "tax_rate": 6, "unit": "PCS",
     "hs_code": "7219.13", "classification_code": "004"},
    {"sku": "SW-LIC-ANNUAL", "name": "Software License (annual)",
     "type": "service", "unit_price": 4800.00, "tax_rate": 8, "unit": "LIC",
     "hs_code": "8523", "classification_code": "022"},
    {"sku": "SVC-MEDICAL", "name": "Medical Consultation",
     "type": "service", "unit_price": 250.00, "tax_rate": 6, "unit": "SES",
     "hs_code": "9993", "classification_code": "022"},
    {"sku": "PRD-LAPTOP-BIZ", "name": "Business Laptop 14\"",
     "type": "goods", "unit_price": 4200.00, "tax_rate": 6, "unit": "PCS",
     "hs_code": "8471.30", "classification_code": "004"},
    {"sku": "SVC-SUPPORT-MO", "name": "Managed Support (monthly)",
     "type": "service", "unit_price": 1800.00, "tax_rate": 8, "unit": "MO",
     "hs_code": "9983", "classification_code": "022"},
    {"sku": "PRD-CEMENT-BAG", "name": "Portland Cement (50kg)",
     "type": "goods", "unit_price": 22.00, "tax_rate": 6, "unit": "BAG",
     "hs_code": "2523", "classification_code": "004"},
    {"sku": "SVC-TRAINING", "name": "Corporate Training Day",
     "type": "service", "unit_price": 6500.00, "tax_rate": 6, "unit": "DAY",
     "hs_code": "9992", "classification_code": "022"},
]


def _demo_invoices(customers, products, tenant_id, company_id, now):
    """Return ~30 demo invoices spread over the last 14 days with a realistic
    status mix so the dashboard chart and pie look enterprise-like."""
    rng = random.Random(42)
    rows = []
    statuses = (["validated"] * 12 + ["rejected"] * 4 +
                ["draft"] * 8 + ["submitting"] * 2 + ["cancelled"] * 2)
    for i, status in enumerate(statuses):
        created_days_ago = rng.randint(0, 13)
        created_dt = now - timedelta(days=created_days_ago,
                                       hours=rng.randint(0, 23),
                                       minutes=rng.randint(0, 59))
        cust = rng.choice(customers)
        prods = rng.sample(products, k=rng.randint(1, 3))
        lines = []
        for p in prods:
            qty = rng.choice([1, 1, 1, 2, 3, 5])
            lines.append({
                "product_id": str(p["_id"]),
                "description": p["name"],
                "quantity": qty,
                "unit_price": p["unit_price"],
                "tax_rate": p["tax_rate"],
                "hs_code": p.get("hs_code"),
                "classification_code": p.get("classification_code"),
                "discount": 0,
            })
        subtotal = round(sum(l["quantity"] * l["unit_price"] for l in lines), 2)
        tax = round(sum(l["quantity"] * l["unit_price"] * (l["tax_rate"] / 100)
                          for l in lines), 2)
        total = round(subtotal + tax, 2)
        inv_num = f"INV-{created_dt.strftime('%Y%m')}-{10000 + i:05d}"
        gov = {}
        if status == "validated":
            uid = f"DEMO{rng.randint(10**19, 10**20 - 1)}"[:26].upper()
            gov = {"adapter": "demo_lhdn", "uuid": uid,
                    "long_id": f"L{rng.randint(10**14, 10**15-1)}",
                    "qr": f"https://preprod.myinvois.hasil.gov.my/{uid}",
                    "signed_at": created_dt.isoformat()}
        elif status == "rejected":
            gov = {"adapter": "demo_lhdn", "errors": [
                {"code": "CF321",
                 "message": "Line item tax rate does not match SST classification.",
                 "path": "invoice.lines[0].tax_rate"}]}
        row = {
            "tenant_id": tenant_id,
            "company_id": company_id,
            "invoice_number": inv_num,
            "invoice_type": "invoice",
            "invoice_date": created_dt.date().isoformat(),
            "due_date": (created_dt + timedelta(days=30)).date().isoformat(),
            "currency": "MYR",
            "customer_id": str(cust["_id"]),
            "customer_snapshot": {
                "id": str(cust["_id"]), "name": cust["name"],
                "tin": cust.get("tin"), "email": cust.get("email"),
                "billing_address": cust.get("billing_address"),
            },
            "lines": lines,
            "shipping": 0, "charges": 0, "round_off": 0,
            "subtotal": subtotal, "tax_total": tax, "total": total,
            "status": status,
            "government": gov,
            "source": rng.choice(["portal", "erp", "api", "csv_upload"]),
            "invoice_confirmation_status": "confirmed" if status == "validated" else "pending",
            "validation_result": "valid" if status == "validated" else "pending",
            "business_system": "eInvoices.world Portal",
            "timeline": [{"status": "draft",
                            "note": "Invoice created (demo seed)",
                            "actor": "seed", "at": created_dt.isoformat()}],
            "created_at": created_dt.isoformat(),
            "updated_at": created_dt.isoformat(),
            "created_by_email": "seed@einvoice.my",
        }
        rows.append(row)
    return rows


async def seed(db):
    """Idempotent seed. Never truncates. Guards every insert."""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@einvoice.my")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@12345")

    # 1. Tenant
    tenant = await db.tenants.find_one({"slug": "acme"}, {"_id": 1})
    if not tenant:
        res = await db.tenants.insert_one({
            "name": "Acme Holdings", "slug": "acme",
            "country": "MY", "currency": "MYR", "created_at": now_iso,
        })
        tenant_id = str(res.inserted_id)
    else:
        tenant_id = str(tenant["_id"])

    # 2. Admin user
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Platform Administrator", "role": "super_admin",
            "tenant_id": tenant_id, "status": "active", "created_at": now_iso,
        })
    else:
        updates = {}
        if not verify_password(admin_password, admin.get("password_hash", "")):
            updates["password_hash"] = hash_password(admin_password)
        if not admin.get("tenant_id"):
            updates["tenant_id"] = tenant_id
        if updates:
            await db.users.update_one({"_id": admin["_id"]}, {"$set": updates})

    # 3. Sample company
    company = await db.companies.find_one({"tenant_id": tenant_id, "tin": "C24681012340"},
                                             {"_id": 1})
    if not company:
        res = await db.companies.insert_one({
            "tenant_id": tenant_id,
            "name": "Acme Manufacturing Sdn Bhd",
            "legal_name": "Acme Manufacturing Sdn Bhd",
            "tin": "C24681012340", "brn": "202301012345",
            "sst_number": "W10-2201-32000123",
            "country": "MY", "currency": "MYR",
            "timezone": "Asia/Kuala_Lumpur",
            "address_line1": "Level 12, Menara Acme",
            "address_line2": "Jalan Ampang", "city": "Kuala Lumpur",
            "state": "Wilayah Persekutuan", "postal_code": "50450",
            "email": "billing@acme.my", "phone": "+60312345678",
            "branches": [
                {"code": "HQ", "name": "Head Office", "city": "Kuala Lumpur"},
                {"code": "PG", "name": "Penang Plant", "city": "Bayan Lepas"},
            ],
            "created_at": now_iso,
        })
        company_id = str(res.inserted_id)
    else:
        company_id = str(company["_id"])

    # 4. Customers — batch insert missing ones only
    existing_cust_names = {
        d["name"] async for d in
        db.customers.find({"tenant_id": tenant_id}, {"name": 1, "_id": 0})
    }
    to_insert = [
        {**c, "tenant_id": tenant_id, "country": "MY", "currency": "MYR",
         "payment_terms": "NET30", "created_at": now_iso}
        for c in DEMO_CUSTOMERS if c["name"] not in existing_cust_names
    ]
    if to_insert:
        await db.customers.insert_many(to_insert, ordered=False)

    # 5. Suppliers
    existing_sup_names = {
        d["name"] async for d in
        db.suppliers.find({"tenant_id": tenant_id}, {"name": 1, "_id": 0})
    }
    to_insert = [
        {**s, "tenant_id": tenant_id, "country": "MY", "currency": "MYR",
         "payment_terms": "NET30", "created_at": now_iso}
        for s in DEMO_SUPPLIERS if s["name"] not in existing_sup_names
    ]
    if to_insert:
        await db.suppliers.insert_many(to_insert, ordered=False)

    # 6. Products
    existing_prod_skus = {
        d["sku"] async for d in
        db.products.find({"tenant_id": tenant_id}, {"sku": 1, "_id": 0})
    }
    to_insert = [
        {**p, "tenant_id": tenant_id, "tax_code": f"SST-{p['tax_rate']}",
         "created_at": now_iso}
        for p in DEMO_PRODUCTS if p["sku"] not in existing_prod_skus
    ]
    if to_insert:
        await db.products.insert_many(to_insert, ordered=False)

    # 7. Invoices — seed 28 realistic docs if the tenant has none yet.
    # Idempotent by presence: we only seed once, and only when the tenant
    # invoice list is empty (so real invoices are never touched).
    if await db.invoices.count_documents({"tenant_id": tenant_id}) == 0:
        customers = [c async for c in
                     db.customers.find({"tenant_id": tenant_id},
                                        {"_id": 1, "name": 1, "tin": 1,
                                         "email": 1, "billing_address": 1})]
        products = [p async for p in
                    db.products.find({"tenant_id": tenant_id},
                                       {"_id": 1, "name": 1, "unit_price": 1,
                                        "tax_rate": 1, "hs_code": 1,
                                        "classification_code": 1})]
        if customers and products:
            rows = _demo_invoices(customers, products, tenant_id, company_id, now)
            if rows:
                await db.invoices.insert_many(rows, ordered=False)
