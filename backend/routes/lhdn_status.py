"""LHDN status enum translation layer.

Maps our internal invoice statuses ↔ LHDN's numeric codes:

    LHDN 101 Valid       ↔ internal "validated"
    LHDN 102 Invalid     ↔ internal "rejected"
    LHDN 103 Cancelled   ↔ internal "cancelled"
    LHDN 104 Submitted   ↔ internal "submitted"
    (no LHDN code)       ← internal "draft"     (never leaves our system)

Also handles the buyer-side confirmation enum:

    confirmStatusCode  0 Awaiting / 1 Accepted / 2 Rejected
"""
from typing import Optional
from fastapi import APIRouter, Depends
from deps import require_tenant


LHDN_STATUS_LABELS = {
    "101": "Valid",
    "102": "Invalid",
    "103": "Cancelled",
    "104": "Submitted",
}

CONFIRM_STATUS_LABELS = {
    "0": "Awaiting",
    "1": "Accepted",
    "2": "Rejected",
}

_INTERNAL_TO_LHDN = {
    "validated": "101",
    "rejected": "102",
    "cancelled": "103",
    "submitted": "104",
    "submitting": "104",
    "draft": None,
}

_LHDN_TO_INTERNAL = {
    "101": "validated",
    "102": "rejected",
    "103": "cancelled",
    "104": "submitted",
}


def to_lhdn_status(internal_status: Optional[str]) -> Optional[str]:
    if not internal_status:
        return None
    return _INTERNAL_TO_LHDN.get(internal_status.lower())


def to_internal_status(lhdn_code: Optional[str]) -> Optional[str]:
    if not lhdn_code:
        return None
    return _LHDN_TO_INTERNAL.get(str(lhdn_code))


def enrich_invoice(doc: dict) -> dict:
    """Adds LHDN-code fields alongside internal fields — non-destructive."""
    if not doc:
        return doc
    lhdn = to_lhdn_status(doc.get("status"))
    doc["lhdn_status_code"] = lhdn
    doc["lhdn_status_label"] = LHDN_STATUS_LABELS.get(lhdn) if lhdn else None
    csc = doc.get("confirm_status_code")
    if csc is not None:
        doc["confirm_status_label"] = CONFIRM_STATUS_LABELS.get(str(csc))
    return doc


router = APIRouter(prefix="/api/lhdn", tags=["lhdn-status"])


@router.get("/status-catalogue")
async def status_catalogue(ctx=Depends(require_tenant)):
    """Publish the LHDN status + confirmation enums so the UI can pull them
    without hard-coding. Handy for API-Client-Bridge integrators too."""
    return {
        "invoice_status": [{"code": c, "label": l}
                            for c, l in LHDN_STATUS_LABELS.items()],
        "confirm_status": [{"code": c, "label": l}
                            for c, l in CONFIRM_STATUS_LABELS.items()],
        "internal_to_lhdn": {k: v for k, v in _INTERNAL_TO_LHDN.items() if v},
    }
