"""Dashboard aggregation — single-round-trip $facet for enterprise-grade speed."""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from deps import get_db, require_tenant
from adapters import get_adapter, list_adapters_with_status

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def stats(ctx=Depends(require_tenant), company_id: str | None = None):
    """One aggregation pipeline returns status breakdown, today's count, and
    14-day trend — three previous queries collapsed to one."""
    db = get_db()
    tenant_id = ctx["tenant_id"]
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    window_start = (now - timedelta(days=13)).date().isoformat()
    base_match = {"tenant_id": tenant_id}
    if company_id:
        base_match["company_id"] = company_id

    pipeline = [
        {"$match": base_match},
        {"$facet": {
            "by_status": [
                {"$group": {"_id": "$status", "count": {"$sum": 1},
                             "sum": {"$sum": "$total"}}},
            ],
            "today": [
                {"$match": {"created_at": {"$gte": today}}},
                {"$count": "n"},
            ],
            "trend": [
                {"$match": {"created_at": {"$gte": window_start}}},
                {"$group": {
                    "_id": {"$substrBytes": ["$created_at", 0, 10]},
                    "count": {"$sum": 1},
                }},
            ],
        }},
    ]
    facet = None
    async for row in db.invoices.aggregate(pipeline):
        facet = row
        break
    facet = facet or {"by_status": [], "today": [], "trend": []}

    by_status = {r["_id"]: {"count": r["count"], "sum": r.get("sum", 0) or 0}
                  for r in facet["by_status"] if r["_id"]}

    total_invoices = sum(v["count"] for v in by_status.values())
    total_value = sum(v["sum"] for v in by_status.values())
    validated = by_status.get("validated", {}).get("count", 0)
    submitting = by_status.get("submitting", {}).get("count", 0)
    submitted_like = validated + submitting
    success_rate = round((validated / submitted_like) * 100, 1) if submitted_like else 0
    today_count = (facet["today"][0]["n"] if facet["today"] else 0)
    tax_collected = round(by_status.get("validated", {}).get("sum", 0) * 0.06, 2)

    # Fill trend with zero-buckets for missing days
    trend_map = {r["_id"]: r["count"] for r in facet["trend"]}
    trend = []
    for i in range(13, -1, -1):
        d = (now - timedelta(days=i)).date().isoformat()
        trend.append({"date": d, "count": trend_map.get(d, 0)})

    return {
        "today_count": today_count,
        "total_invoices": total_invoices,
        "total_value": round(total_value, 2),
        "by_status": by_status,
        "success_rate": success_rate,
        "tax_collected": tax_collected,
        "trend": trend,
        "adapters": await list_adapters_with_status(db, tenant_id),
    }


@router.get("/health")
async def health(ctx=Depends(require_tenant)):
    db = get_db()
    my = await get_adapter("MY").health_check()
    return {
        "server": {"healthy": True, "uptime": "ok"},
        "database": {"healthy": True},
        "storage": {"healthy": True},
        "adapters": [my],
        "adapter_modes": await list_adapters_with_status(db, ctx["tenant_id"]),
    }
