"""Audit trail — paginated + projected."""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from deps import get_db, require_tenant

router = APIRouter(prefix="/api/audit", tags=["audit"])


AUDIT_PROJ = {
    "action": 1, "entity": 1, "entity_id": 1,
    "actor_id": 1, "actor_email": 1,
    "meta": 1, "ip": 1, "created_at": 1,
}


@router.get("")
async def list_audit(
    ctx=Depends(require_tenant),
    limit: int = Query(200, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    action: Optional[str] = None,
    entity_id: Optional[str] = None,
):
    db = get_db()
    q = {"tenant_id": ctx["tenant_id"]}
    if action:
        q["action"] = action
    if entity_id:
        q["entity_id"] = entity_id
    cur = (db.audit_logs.find(q, AUDIT_PROJ)
                         .sort("created_at", -1).skip(skip).limit(limit))
    out = []
    async for l in cur:
        l["id"] = str(l.pop("_id"))
        out.append(l)
    return out
