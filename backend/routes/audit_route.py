from fastapi import APIRouter, Depends
from deps import get_db, require_tenant

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
async def list_audit(ctx=Depends(require_tenant), limit: int = 200):
    db = get_db()
    logs = []
    async for l in db.audit_logs.find({"tenant_id": ctx["tenant_id"]}).sort("created_at", -1).limit(limit):
        l["id"] = str(l.pop("_id"))
        logs.append(l)
    return logs
