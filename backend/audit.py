"""Central audit trail helper."""
from datetime import datetime, timezone


async def audit(db, *, tenant_id: str, actor_id: str | None, actor_email: str | None,
                action: str, entity: str, entity_id: str | None = None, meta: dict | None = None,
                ip: str | None = None):
    await db.audit_logs.insert_one({
        "tenant_id": tenant_id,
        "actor_id": actor_id,
        "actor_email": actor_email,
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "meta": meta or {},
        "ip": ip,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
