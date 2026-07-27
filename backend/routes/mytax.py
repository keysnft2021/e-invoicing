"""MyTax / MyInvois onboarding: Role Applications, Representative Permissions,
Intermediary appointments. Modeled from LHDN Appendix 2, 3.1–3.3 docs.

This is an INTERNAL workflow — no calls to the real government portal.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional, List

from deps import get_db, require_tenant
from audit import audit

router = APIRouter(prefix="/api/mytax", tags=["mytax"])


ROLE_TYPES = [
    "estate_administrator", "company_director", "tax_agent_admin_firm",
    "representative_non_able", "employer", "lawyer",
]

DOCUMENT_PERMISSIONS = ["view", "submit", "cancel", "reject"]
TAXPAYER_PERMISSIONS = ["edit_profile", "manage_person_reps", "manage_erps",
                        "manage_intermediaries", "edit_visual_templates"]
NOTIFICATION_PERMISSIONS = ["view"]
INTERMEDIARY_PERMISSIONS = ["view_companies_summary"]


def _s(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


# ---------- Role Application ----------
class RoleAppIn(BaseModel):
    application_type: str = Field(default="new")  # new | termination
    role_type: str
    identification_type: str = "NRIC"
    identification_no: str
    applicant_name: str
    applicant_email: str
    supporting_document_name: Optional[str] = None
    supporting_document_url: Optional[str] = None
    notes: Optional[str] = None


@router.get("/role-applications")
async def list_role_apps(ctx=Depends(require_tenant)):
    db = get_db()
    return [_s(c) async for c in db.role_applications.find(
        {"tenant_id": ctx["tenant_id"]}).sort("created_at", -1)]


@router.post("/role-applications")
async def create_role_app(body: RoleAppIn, ctx=Depends(require_tenant)):
    if body.role_type not in ROLE_TYPES:
        raise HTTPException(400, f"Invalid role_type. Must be one of {ROLE_TYPES}")
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = body.model_dump()
    doc.update({
        "tenant_id": ctx["tenant_id"],
        "status": "new",  # new | pending | accepted | rejected
        "timeline": [{"status": "new", "note": "Application submitted", "at": now,
                       "actor": ctx["user"]["email"]}],
        "created_at": now,
    })
    res = await db.role_applications.insert_one(doc)
    doc["_id"] = res.inserted_id
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="role_application.create",
                entity="role_application", entity_id=str(res.inserted_id),
                meta={"role_type": body.role_type})
    return _s(doc)


@router.post("/role-applications/{rid}/approve")
async def approve_role_app(rid: str, ctx=Depends(require_tenant)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = await db.role_applications.find_one({"_id": ObjectId(rid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Not found")
    timeline = doc.get("timeline", [])
    timeline.append({"status": "accepted", "note": "Approved by administrator",
                      "at": now, "actor": ctx["user"]["email"]})
    await db.role_applications.update_one({"_id": ObjectId(rid)},
        {"$set": {"status": "accepted", "timeline": timeline, "updated_at": now}})
    doc = await db.role_applications.find_one({"_id": ObjectId(rid)})
    return _s(doc)


@router.post("/role-applications/{rid}/reject")
async def reject_role_app(rid: str, ctx=Depends(require_tenant)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = await db.role_applications.find_one({"_id": ObjectId(rid), "tenant_id": ctx["tenant_id"]})
    if not doc:
        raise HTTPException(404, "Not found")
    timeline = doc.get("timeline", [])
    timeline.append({"status": "rejected", "note": "Rejected by administrator",
                      "at": now, "actor": ctx["user"]["email"]})
    await db.role_applications.update_one({"_id": ObjectId(rid)},
        {"$set": {"status": "rejected", "timeline": timeline, "updated_at": now}})
    doc = await db.role_applications.find_one({"_id": ObjectId(rid)})
    return _s(doc)


# ---------- Representatives ----------
class RepPermissions(BaseModel):
    document: List[str] = ["view"]  # view is always enabled
    taxpayer: List[str] = []
    notifications: List[str] = []
    intermediary: List[str] = []


class RepresentativeIn(BaseModel):
    name: str
    identification_type: str = "NRIC"
    identification_no: str
    email: Optional[str] = None
    role_type: str = "company_director"
    permissions: RepPermissions = RepPermissions()
    status: str = "active"


@router.get("/representatives")
async def list_reps(ctx=Depends(require_tenant)):
    db = get_db()
    return [_s(c) async for c in db.representatives.find(
        {"tenant_id": ctx["tenant_id"]}).sort("created_at", -1)]


@router.post("/representatives")
async def create_rep(body: RepresentativeIn, ctx=Depends(require_tenant)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = body.model_dump()
    # ensure View doc is always enabled
    doc["permissions"]["document"] = list(set(doc["permissions"].get("document", []) + ["view"]))
    doc.update({"tenant_id": ctx["tenant_id"], "created_at": now})
    res = await db.representatives.insert_one(doc)
    doc["_id"] = res.inserted_id
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="representative.create",
                entity="representative", entity_id=str(res.inserted_id))
    return _s(doc)


@router.put("/representatives/{rid}")
async def update_rep(rid: str, body: RepresentativeIn, ctx=Depends(require_tenant)):
    db = get_db()
    update = body.model_dump()
    update["permissions"]["document"] = list(set(update["permissions"].get("document", []) + ["view"]))
    r = await db.representatives.update_one(
        {"_id": ObjectId(rid), "tenant_id": ctx["tenant_id"]},
        {"$set": update},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.representatives.find_one({"_id": ObjectId(rid)})
    return _s(doc)


@router.delete("/representatives/{rid}")
async def delete_rep(rid: str, ctx=Depends(require_tenant)):
    db = get_db()
    await db.representatives.delete_one({"_id": ObjectId(rid), "tenant_id": ctx["tenant_id"]})
    return {"ok": True}


# ---------- Intermediaries ----------
class InterPermissions(BaseModel):
    doc_view: bool = True  # always
    doc_submit: bool = False
    doc_cancel: bool = False
    doc_request_rejection: bool = False
    notifications_view: bool = False


class IntermediaryIn(BaseModel):
    tin: str
    brn: str
    name: str
    representation_from: str
    representation_to: str
    is_foreign_company: bool = False
    is_peppol_supported: bool = False
    is_registered_intermediary: bool = True
    status: str = "active"  # active | blocked | expired
    permissions: InterPermissions = InterPermissions()


@router.get("/intermediaries")
async def list_inter(ctx=Depends(require_tenant)):
    db = get_db()
    return [_s(c) async for c in db.intermediaries.find(
        {"tenant_id": ctx["tenant_id"]}).sort("created_at", -1)]


@router.post("/intermediaries")
async def create_inter(body: IntermediaryIn, ctx=Depends(require_tenant)):
    if body.representation_to < body.representation_from:
        raise HTTPException(400, "Representation To cannot be earlier than From")
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = body.model_dump()
    doc["permissions"]["doc_view"] = True
    doc.update({"tenant_id": ctx["tenant_id"], "created_at": now})
    res = await db.intermediaries.insert_one(doc)
    doc["_id"] = res.inserted_id
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="intermediary.create",
                entity="intermediary", entity_id=str(res.inserted_id),
                meta={"tin": body.tin, "name": body.name})
    return _s(doc)


@router.put("/intermediaries/{iid}")
async def update_inter(iid: str, body: IntermediaryIn, ctx=Depends(require_tenant)):
    db = get_db()
    update = body.model_dump()
    update["permissions"]["doc_view"] = True
    r = await db.intermediaries.update_one(
        {"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]},
        {"$set": update},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.intermediaries.find_one({"_id": ObjectId(iid)})
    return _s(doc)


@router.delete("/intermediaries/{iid}")
async def delete_inter(iid: str, ctx=Depends(require_tenant)):
    db = get_db()
    await db.intermediaries.delete_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    return {"ok": True}


@router.get("/reference")
async def reference():
    """Metadata for dynamic forms."""
    return {
        "role_types": ROLE_TYPES,
        "document_permissions": DOCUMENT_PERMISSIONS,
        "taxpayer_permissions": TAXPAYER_PERMISSIONS,
        "notification_permissions": NOTIFICATION_PERMISSIONS,
        "intermediary_permissions": INTERMEDIARY_PERMISSIONS,
    }
