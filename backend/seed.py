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
    {"name": "MediCare Hospital Berhad", "tin": "C77889900112", "brn": "199801023456",
     "email": "billing@medicare.my", "phone": "+60378889900",
     "billing_address": "Jalan Bukit Bintang, Kuala Lumpur",
     "credit_limit": 500000},
    {"name": "Wellness Family Clinic", "tin": "C11223344556", "brn": "202001019876",
     "email": "admin@wellnessfamily.my", "phone": "+60322334455",
     "billing_address": "12 Jalan Damai, Petaling Jaya",
     "credit_limit": 80000},
    {"name": "Sunway Medical Group", "tin": "C22334455667", "brn": "201501034567",
     "email": "ap@sunwaymed.my", "phone": "+60377712345",
     "billing_address": "Sunway Pyramid, Petaling Jaya",
     "credit_limit": 300000},
    {"name": "Retail Buyer Sdn Bhd", "tin": "C25845632020", "brn": "202699999999",
     "email": "buyer@retailbuyer.my", "phone": "+60312345678",
     "billing_address": "88 Jalan Sultan, Kuala Lumpur",
     "credit_limit": 100000},
    {"name": "KPJ Damansara Specialist", "tin": "C33445566778", "brn": "199906012345",
     "email": "ap@kpjdamansara.my", "phone": "+60377112233",
     "billing_address": "119 Jalan SS20/10, Damansara Utama",
     "credit_limit": 250000},
    {"name": "Pantai Hospital KL", "tin": "C44556677889", "brn": "202101056789",
     "email": "finance@pantai.my", "phone": "+60322960000",
     "billing_address": "8 Jalan Bukit Pantai, Kuala Lumpur",
     "credit_limit": 400000},
    {"name": "Gleneagles Medical Centre", "tin": "C55667788990", "brn": "201801067890",
     "email": "billing@gleneagles.my", "phone": "+60342574000",
     "billing_address": "Jalan Ampang, Kuala Lumpur",
     "credit_limit": 350000},
    {"name": "Columbia Asia Hospital", "tin": "C66778899001", "brn": "202001078901",
     "email": "ap@columbiaasia.my", "phone": "+60378418888",
     "billing_address": "Bukit Rimau, Shah Alam",
     "credit_limit": 220000},
]

DEMO_SUPPLIERS = [
    {"name": "Pharmaniaga Distribution", "tin": "C99887766550", "brn": "199901012345",
     "email": "orders@pharmaniaga.my", "phone": "+60312001200"},
    {"name": "Zuellig Pharma Malaysia", "tin": "C44332211009", "brn": "201801098765",
     "email": "billing@zuelligpharma.my", "phone": "+60322003000"},
    {"name": "DKSH Healthcare", "tin": "C11223344556", "brn": "199601045678",
     "email": "corporate@dksh.my", "phone": "+60315451500"},
    {"name": "Kotra Pharma", "tin": "C66778899001", "brn": "202001078901",
     "email": "sales@kotrapharma.my", "phone": "+60378889000"},
    {"name": "Hovid Berhad", "tin": "C88990011223", "brn": "202101089012",
     "email": "orders@hovid.my", "phone": "+60322778899"},
]

DEMO_PRODUCTS = [
    {"sku": "MED-CONSULT", "name": "General Medical Consultation",
     "type": "service", "unit_price": 80.00, "tax_rate": 0, "unit": "SES",
     "hs_code": "9993", "classification_code": "022",
     "msic_class": "Medical examination or vaccination expenses"},
    {"sku": "MED-VAX-FLU", "name": "Influenza Vaccination",
     "type": "goods", "unit_price": 150.00, "tax_rate": 0, "unit": "DOSE",
     "hs_code": "3002.20", "classification_code": "022",
     "msic_class": "Medical examination or vaccination expenses"},
    {"sku": "MED-BLOOD-FBC", "name": "Full Blood Count Test",
     "type": "service", "unit_price": 45.00, "tax_rate": 0, "unit": "TEST",
     "hs_code": "9993", "classification_code": "022",
     "msic_class": "Medical examination or vaccination expenses"},
    {"sku": "MED-DENTAL-SCALE", "name": "Dental Scaling & Polishing",
     "type": "service", "unit_price": 120.00, "tax_rate": 0, "unit": "SES",
     "hs_code": "9993", "classification_code": "022",
     "msic_class": "Medical examination or vaccination expenses"},
    {"sku": "MED-AESTHETIC-BOTOX", "name": "Botox Injection (per unit)",
     "type": "service", "unit_price": 25.00, "tax_rate": 6, "unit": "UNIT",
     "hs_code": "3004", "classification_code": "022",
     "msic_class": "Medical examination or vaccination expenses"},
    {"sku": "MED-XRAY-CHEST", "name": "Chest X-Ray",
     "type": "service", "unit_price": 65.00, "tax_rate": 0, "unit": "TEST",
     "hs_code": "9993", "classification_code": "022",
     "msic_class": "Medical examination or vaccination expenses"},
    {"sku": "MED-PHARMA-PARA", "name": "Paracetamol 500mg (strip)",
     "type": "goods", "unit_price": 3.50, "tax_rate": 0, "unit": "STRIP",
     "hs_code": "3004.90", "classification_code": "022",
     "msic_class": "Medical examination or vaccination expenses"},
    {"sku": "MED-PHYSIO", "name": "Physiotherapy Session",
     "type": "service", "unit_price": 90.00, "tax_rate": 0, "unit": "SES",
     "hs_code": "9993", "classification_code": "022",
     "msic_class": "Medical examination or vaccination expenses"},
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

    # One-time cleanup: nuke the older non-medical demo rows so the platform
    # is purely clinic-focused. Only removes exact seed SKUs/names we shipped.
    _NON_MEDICAL_SKUS = ["PRD-STEEL-A1", "SW-LIC-ANNUAL", "PRD-LAPTOP-BIZ",
                          "SVC-SUPPORT-MO", "PRD-CEMENT-BAG", "SVC-TRAINING",
                          "SVC-CONSULT", "SVC-MEDICAL"]
    _NON_MEDICAL_CUST = ["Global Retail Sdn Bhd", "Sinar Cahaya Enterprise",
                          "Pantai Steel Trading", "Kuching Trading Co",
                          "Penang Tech Solutions", "Johor Logistics Berhad"]
    _NON_MEDICAL_SUP = ["SteelWorks Malaysia", "TransLogistics Bhd",
                         "Tenaga Utilities", "Office Supplies Direct",
                         "Cloud Hosting MY"]
    await db.products.delete_many({"sku": {"$in": _NON_MEDICAL_SKUS}})
    await db.customers.delete_many({"name": {"$in": _NON_MEDICAL_CUST}})
    await db.suppliers.delete_many({"name": {"$in": _NON_MEDICAL_SUP}})

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
