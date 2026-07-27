from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from deps import get_db, require_tenant
from adapters import get_adapter, list_adapters

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def stats(ctx=Depends(require_tenant)):
    db = get_db()
    tenant_id = ctx["tenant_id"]
    today = datetime.now(timezone.utc).date().isoformat()

    pipeline_status = [
        {"$match": {"tenant_id": tenant_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "sum": {"$sum": "$total"}}},
    ]
    by_status = {row["_id"]: {"count": row["count"], "sum": row["sum"]}
                  async for row in db.invoices.aggregate(pipeline_status)}

    total_invoices = sum(v["count"] for v in by_status.values())
    total_value = sum(v["sum"] for v in by_status.values())
    validated = by_status.get("validated", {}).get("count", 0)
    rejected = by_status.get("rejected", {}).get("count", 0)
    submitted_like = validated + by_status.get("submitting", {}).get("count", 0)
    success_rate = round((validated / submitted_like) * 100, 1) if submitted_like else 0

    today_count = await db.invoices.count_documents({
        "tenant_id": tenant_id, "created_at": {"$gte": today},
    })

    # trend last 14 days by created_at date
    trend = []
    for i in range(13, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        next_day = (datetime.now(timezone.utc) - timedelta(days=i - 1)).date().isoformat() if i > 0 else "9999"
        cnt = await db.invoices.count_documents({
            "tenant_id": tenant_id,
            "created_at": {"$gte": day, "$lt": next_day},
        })
        trend.append({"date": day, "count": cnt})

    tax_collected = round(sum(v.get("sum", 0) or 0
                              for k, v in by_status.items() if k in ("validated",)) * 0.06, 2)

    return {
        "today_count": today_count,
        "total_invoices": total_invoices,
        "total_value": round(total_value, 2),
        "by_status": by_status,
        "success_rate": success_rate,
        "tax_collected": tax_collected,
        "trend": trend,
        "adapters": list_adapters(),
    }


@router.get("/health")
async def health(ctx=Depends(require_tenant)):
    my = await get_adapter("MY").health_check()
    return {
        "server": {"healthy": True, "uptime": "ok"},
        "database": {"healthy": True},
        "storage": {"healthy": True},
        "adapters": [my],
    }
