"""Government API credentials — per-tenant, per-country."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional

from deps import get_db, require_tenant
from adapters import RealLHDNAdapter
from audit import audit

router = APIRouter(prefix="/api/gov-config", tags=["gov-config"])


class GovConfigIn(BaseModel):
    country: str = "MY"
    environment: str = "preprod"  # preprod | prod
    client_id: str
    client_secret: str
    certificate_pem: Optional[str] = None
    private_key_pem: Optional[str] = None
    enabled: bool = True


def _mask(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    if len(v) <= 6:
        return "•" * len(v)
    return v[:3] + "•" * (len(v) - 6) + v[-3:]


def _redact(doc: dict) -> dict:
    return {
        "id": str(doc.get("_id")) if doc.get("_id") else doc.get("id"),
        "country": doc.get("country"),
        "environment": doc.get("environment"),
        "client_id": _mask(doc.get("client_id")),
        "client_secret_set": bool(doc.get("client_secret")),
        "certificate_pem_set": bool(doc.get("certificate_pem")),
        "private_key_pem_set": bool(doc.get("private_key_pem")),
        "enabled": doc.get("enabled", False),
        "last_verified_at": doc.get("last_verified_at"),
        "last_verified_ok": doc.get("last_verified_ok"),
        "last_error": doc.get("last_error"),
        "updated_at": doc.get("updated_at"),
    }


@router.get("")
async def list_configs(ctx=Depends(require_tenant)):
    db = get_db()
    out = []
    async for d in db.gov_credentials.find({"tenant_id": ctx["tenant_id"]}):
        out.append(_redact(d))
    return out


@router.post("")
async def upsert_config(body: GovConfigIn, ctx=Depends(require_tenant)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = body.model_dump()
    doc["tenant_id"] = ctx["tenant_id"]
    doc["updated_at"] = now
    await db.gov_credentials.update_one(
        {"tenant_id": ctx["tenant_id"], "country": body.country},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                actor_email=ctx["user"]["email"], action="gov_config.upsert",
                entity="gov_credentials", entity_id=body.country,
                meta={"environment": body.environment, "enabled": body.enabled})
    saved = await db.gov_credentials.find_one({"tenant_id": ctx["tenant_id"],
                                                 "country": body.country})
    return _redact(saved)


@router.post("/{country}/verify")
async def verify(country: str, ctx=Depends(require_tenant)):
    """Attempt an OAuth token fetch against the configured LHDN environment."""
    db = get_db()
    cfg = await db.gov_credentials.find_one({"tenant_id": ctx["tenant_id"], "country": country})
    if not cfg:
        raise HTTPException(404, "No credentials configured")
    now = datetime.now(timezone.utc).isoformat()
    try:
        adapter = RealLHDNAdapter(cfg)
        auth = await adapter.authenticate()
        await db.gov_credentials.update_one(
            {"_id": cfg["_id"]},
            {"$set": {"last_verified_at": now, "last_verified_ok": True, "last_error": None}},
        )
        await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                    actor_email=ctx["user"]["email"], action="gov_config.verify_ok",
                    entity="gov_credentials", entity_id=country)
        return {"ok": True, "issuer": auth.get("issuer"), "verified_at": now}
    except Exception as e:
        msg = f"{type(e).__name__}: {str(e)[:250]}"
        await db.gov_credentials.update_one(
            {"_id": cfg["_id"]},
            {"$set": {"last_verified_at": now, "last_verified_ok": False, "last_error": msg}},
        )
        await audit(db, tenant_id=ctx["tenant_id"], actor_id=ctx["user"]["id"],
                    actor_email=ctx["user"]["email"], action="gov_config.verify_fail",
                    entity="gov_credentials", entity_id=country, meta={"error": msg})
        return {"ok": False, "error": msg, "verified_at": now}


@router.delete("/{country}")
async def delete_config(country: str, ctx=Depends(require_tenant)):
    db = get_db()
    await db.gov_credentials.delete_one({"tenant_id": ctx["tenant_id"], "country": country})
    return {"ok": True}
