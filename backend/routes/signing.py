"""QR / 6-digit step-up MFA for privileged actions.

Flow:
 1. Client calls POST /api/signing/sessions with {action, entity_id, meta}
    - Response: { session_id, code, qr_data_url, approve_url, expires_at }
 2. User scans QR (which opens /sign/{session_id}?c={code} in a browser)
    OR types the 6-digit code into the initiating tab.
 3. POST /api/signing/{session_id}/approve with {code}
    - Marks the session approved and stores approver identity.
 4. Client (originator) polls GET /api/signing/{session_id} until approved.
 5. Client calls the actual privileged endpoint passing signing_session_id.
    The endpoint verifies session is approved, matches action+entity, then
    marks it consumed (single-use). Expiry: 5 min.
"""
import base64
import io
import os
import secrets
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

import qrcode

from deps import get_db, require_tenant
from audit import audit

router = APIRouter(prefix="/api/signing", tags=["signing"])

SESSION_TTL_SECONDS = 300  # 5 minutes


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _qr_data_url(payload: str) -> str:
    img = qrcode.make(payload, box_size=6, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _serialize(s: dict) -> dict:
    s = dict(s)
    s["id"] = str(s.pop("_id"))
    s.pop("code", None)  # never return code once created
    return s


class CreateSessionBody(BaseModel):
    action: str  # e.g. "invoice.submit" | "invoice.cancel" | "gov.config"
    entity: str = "invoice"
    entity_id: Optional[str] = None
    meta: Optional[dict] = None


class ApproveBody(BaseModel):
    code: str


@router.post("/sessions")
async def create_session(body: CreateSessionBody, ctx=Depends(require_tenant)):
    db = get_db()
    code = _generate_code()
    session_id = secrets.token_urlsafe(16)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=SESSION_TTL_SECONDS)
    frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    approve_url = f"{frontend}/sign/{session_id}?c={code}"
    doc = {
        "_id": session_id,
        "tenant_id": ctx["tenant_id"],
        "initiator_id": ctx["user"]["id"],
        "initiator_email": ctx["user"]["email"],
        "action": body.action,
        "entity": body.entity,
        "entity_id": body.entity_id,
        "meta": body.meta or {},
        "code": code,
        "status": "pending",  # pending | approved | expired | consumed | rejected
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "approved_at": None,
        "approved_by": None,
        "consumed_at": None,
    }
    await db.signing_sessions.insert_one(doc)
    qr = _qr_data_url(approve_url)
    return {
        "session_id": session_id,
        "code": code,          # returned ONCE to initiator so they can display it
        "qr_data_url": qr,
        "approve_url": approve_url,
        "expires_at": expires_at.isoformat(),
        "status": "pending",
        "action": body.action,
        "entity": body.entity,
        "entity_id": body.entity_id,
        "ttl_seconds": SESSION_TTL_SECONDS,
    }


async def _load_session(db, session_id: str, tenant_id: str):
    s = await db.signing_sessions.find_one({"_id": session_id})
    if not s:
        raise HTTPException(404, "Signing session not found")
    if s["tenant_id"] != tenant_id:
        raise HTTPException(403, "Signing session belongs to another tenant")
    now = datetime.now(timezone.utc)
    if now.isoformat() > s["expires_at"] and s["status"] == "pending":
        await db.signing_sessions.update_one({"_id": session_id}, {"$set": {"status": "expired"}})
        s["status"] = "expired"
    return s


@router.get("/{session_id}")
async def get_session(session_id: str, ctx=Depends(require_tenant)):
    db = get_db()
    s = await _load_session(db, session_id, ctx["tenant_id"])
    return _serialize(s)


@router.post("/{session_id}/approve")
async def approve_session(session_id: str, body: ApproveBody, ctx=Depends(require_tenant)):
    db = get_db()
    s = await _load_session(db, session_id, ctx["tenant_id"])
    if s["status"] != "pending":
        raise HTTPException(400, f"Session is {s['status']}, cannot approve")
    if s["code"] != body.code.strip():
        raise HTTPException(400, "Invalid approval code")
    now = datetime.now(timezone.utc).isoformat()
    await db.signing_sessions.update_one(
        {"_id": session_id},
        {"$set": {"status": "approved", "approved_at": now,
                   "approved_by": ctx["user"]["email"],
                   "approved_by_id": ctx["user"]["id"]}},
    )
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="signing.approve",
                entity="signing_session", entity_id=session_id,
                meta={"target_action": s["action"], "target_entity_id": s.get("entity_id")})
    s["status"] = "approved"
    s["approved_at"] = now
    return _serialize(s)


@router.post("/{session_id}/reject")
async def reject_session(session_id: str, ctx=Depends(require_tenant)):
    db = get_db()
    s = await _load_session(db, session_id, ctx["tenant_id"])
    if s["status"] != "pending":
        raise HTTPException(400, f"Session is {s['status']}, cannot reject")
    await db.signing_sessions.update_one({"_id": session_id},
        {"$set": {"status": "rejected", "approved_by": ctx["user"]["email"],
                   "approved_at": datetime.now(timezone.utc).isoformat()}})
    s["status"] = "rejected"
    return _serialize(s)


async def consume_signing_session(db, *, session_id: str, tenant_id: str,
                                    expected_action: str, expected_entity_id: str) -> dict:
    """Validate a session is approved for this exact action+entity, then consume it.
    Raises HTTPException on any failure. Returns the session.
    """
    if not session_id:
        raise HTTPException(400, "signing_session_id is required for this action")
    s = await db.signing_sessions.find_one({"_id": session_id})
    if not s or s["tenant_id"] != tenant_id:
        raise HTTPException(403, "Invalid signing session")
    if s["status"] != "approved":
        raise HTTPException(400, f"Signing session status is {s['status']}, must be approved")
    if s["action"] != expected_action:
        raise HTTPException(400, "Signing session action mismatch")
    if s.get("entity_id") and expected_entity_id and s["entity_id"] != expected_entity_id:
        raise HTTPException(400, "Signing session bound to different entity")
    now = datetime.now(timezone.utc)
    if now.isoformat() > s["expires_at"]:
        raise HTTPException(400, "Signing session expired")
    await db.signing_sessions.update_one({"_id": session_id},
        {"$set": {"status": "consumed", "consumed_at": now.isoformat()}})
    return s
