"""Batch Import (CSV) for master-data lists.

- GET /api/batch-import/{entity}/template  → downloadable CSV template
- POST /api/batch-import/{entity}          → upload CSV, upsert rows

Entities: products | customers | suppliers
"""
import csv
import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from datetime import datetime, timezone

from deps import get_db, require_tenant
from audit import audit

router = APIRouter(prefix="/api/batch-import", tags=["batch-import"])


# Column definitions per entity — order matters for the template.
SCHEMAS = {
    "products": {
        "collection": "products",
        "key": "sku",
        "columns": [
            ("sku", True),
            ("name", True),
            ("classification_code", False),   # LHDN classification 001-045
            ("unit", False),                   # UN/ECE measurement
            ("unit_price", True),
            ("tax_rate", False),
            ("hs_code", False),                # product tariff code
            ("country_of_origin", False),
            ("msic_code", False),
            ("msic_description", False),
            ("description", False),
        ],
        "sample": [
            "MED-001", "Paracetamol 500mg", "018", "EA", "5.50", "6",
            "3004.90", "MYS", "86201", "General medical services",
            "Analgesic tablet",
        ],
    },
    "customers": {
        "collection": "customers",
        "key": "tin",
        "columns": [
            ("id_type", False),  # Business Registration Number / NRIC / Passport / Army
            ("brn", True),        # ID Value
            ("tin", True),
            ("name", True),
            ("sst_registration_number", False),
            ("phone", True),      # Contact Number
            ("email", False),
            ("buyer_code", False),
            ("country", False),
            ("state", False),
            ("city", False),
            ("addr_line_0", False),
            ("addr_line_1", False),
            ("postal_zone", False),
        ],
        "sample": [
            "Business Registration Number", "201601034740", "C24700902040",
            "Wellness Family Clinic", "W10-1808-32000123", "+60322334455",
            "billing@wellness.my", "B-1001", "MYS", "Selangor", "Petaling Jaya",
            "Level 8, Menara Wellness", "Jalan PJU 8", "47820",
        ],
    },
    "suppliers": {
        "collection": "suppliers",
        "key": "tin",
        "columns": [
            ("id_type", False),
            ("brn", True),         # ID Value
            ("tin", True),
            ("name", True),
            ("sst_registration_number", False),
            ("phone", True),       # Contact Number
            ("email", False),
            ("msic_code", False),
            ("msic_description", False),
            ("business_activity", False),
            ("country", False),
            ("state", False),
            ("city", False),
            ("addr_line_0", False),
            ("postal_zone", False),
        ],
        "sample": [
            "Business Registration Number", "199201054321", "C1234567890",
            "MediCare Wholesale Sdn Bhd", "W10-1808-32000456", "+60322334455",
            "sales@medicare-wholesale.my", "46499",
            "Wholesale of pharmaceuticals",
            "Distribution of medical supplies", "MYS", "Selangor", "Puchong",
            "No. 12, Jalan Perdagangan 5", "47100",
        ],
    },
}


@router.get("/{entity}/template")
async def download_template(entity: str, ctx=Depends(require_tenant)):
    if entity not in SCHEMAS:
        raise HTTPException(404, "Unknown entity")
    sch = SCHEMAS[entity]
    buf = io.StringIO()
    w = csv.writer(buf)
    # Header with * marker on required columns
    w.writerow([f"{c}*" if req else c for c, req in sch["columns"]])
    w.writerow(sch["sample"])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition":
                     f'attachment; filename="{entity}_import_template.csv"'},
    )


def _norm_header(h: str) -> str:
    return h.strip().rstrip("*").lower()


@router.post("/{entity}")
async def batch_import(entity: str,
                        file: UploadFile = File(...),
                        ctx=Depends(require_tenant)):
    if entity not in SCHEMAS:
        raise HTTPException(404, "Unknown entity")
    sch = SCHEMAS[entity]
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Upload a .csv file")
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    if not raw.strip():
        raise HTTPException(400, "CSV is empty")
    reader = csv.reader(io.StringIO(raw))
    try:
        header = [_norm_header(h) for h in next(reader)]
    except StopIteration:
        raise HTTPException(400, "CSV has no header row")
    col_names = [c for c, _ in sch["columns"]]
    required = {c for c, req in sch["columns"] if req}
    missing = required - set(header)
    if missing:
        raise HTTPException(400,
                              f"Missing required columns: {sorted(missing)}")

    db = get_db()
    coll = getattr(db, sch["collection"])
    key = sch["key"]
    now = datetime.now(timezone.utc).isoformat()
    created, updated, errors = [], [], []

    for row_i, row in enumerate(reader, start=2):  # start=2 → CSV row incl. header
        if not any(row):
            continue
        rec = {}
        for i, val in enumerate(row):
            if i >= len(header):
                break
            col = header[i]
            if col in col_names:
                rec[col] = val.strip() if isinstance(val, str) else val
        # Validate required
        row_missing = [c for c in required if not rec.get(c)]
        if row_missing:
            errors.append({"row": row_i,
                            "error": f"Missing required: {row_missing}"})
            continue
        # Coerce numerics for products
        if entity == "products":
            try:
                rec["unit_price"] = float(rec.get("unit_price", 0) or 0)
                if rec.get("tax_rate"):
                    rec["tax_rate"] = float(rec["tax_rate"])
            except ValueError as e:
                errors.append({"row": row_i, "error": f"Numeric parse: {e}"})
                continue
        rec["tenant_id"] = ctx["tenant_id"]
        rec["updated_at"] = now
        existing = await coll.find_one(
            {"tenant_id": ctx["tenant_id"], key: rec.get(key)},
        )
        if existing:
            await coll.update_one({"_id": existing["_id"]}, {"$set": rec})
            updated.append({"row": row_i, key: rec.get(key)})
        else:
            rec["created_at"] = now
            await coll.insert_one(rec)
            created.append({"row": row_i, key: rec.get(key)})

    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"],
                action=f"{entity}.batch_import",
                entity=entity, entity_id="-",
                meta={"created": len(created), "updated": len(updated),
                       "errors": len(errors)})

    return {
        "entity": entity,
        "summary": {"created": len(created),
                     "updated": len(updated),
                     "errors": len(errors),
                     "total": len(created) + len(updated) + len(errors)},
        "created": created,
        "updated": updated,
        "errors": errors,
    }
