"""Fire-and-forget webhook delivery to external client systems.

Called after every LHDN submission result (validated or rejected) whenever
the invoice was pushed via the bridge. Retries on transient failures with
exponential backoff. Every attempt is logged in `webhook_deliveries`.
"""
import asyncio
import json
from datetime import datetime, timezone
import httpx


async def fire_webhook(db, invoice_id: str):
    """Look up invoice → external_client_id → client.webhook_url, POST payload."""
    from bson import ObjectId
    inv = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not inv or not inv.get("external_client_id"):
        return
    client = await db.api_clients.find_one({"client_id": inv["external_client_id"]})
    if not client or not client.get("webhook_url"):
        return

    gov = inv.get("government") or {}
    payload = {
        "event": f"invoice.{inv.get('status', 'unknown')}",
        "invoice_id": str(inv["_id"]),
        "invoice_number": inv.get("invoice_number"),
        "external_ref": inv.get("external_ref"),
        "status": inv.get("status"),
        "total": inv.get("total"),
        "currency": inv.get("currency"),
        "government": {
            "uuid": gov.get("uuid"),
            "long_id": gov.get("long_id"),
            "submission_uid": gov.get("submission_uid"),
            "qr": gov.get("qr"),
            "errors": gov.get("errors"),
        },
        "delivered_at": datetime.now(timezone.utc).isoformat(),
    }

    delivery = {
        "tenant_id": inv["tenant_id"],
        "invoice_id": str(inv["_id"]),
        "client_id": client["client_id"],
        "webhook_url": client["webhook_url"],
        "payload": payload,
        "attempts": 0,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    delivery_res = await db.webhook_deliveries.insert_one(delivery)
    delivery_id = delivery_res.inserted_id

    async with httpx.AsyncClient(timeout=10.0) as http:
        last_err = None
        for attempt in range(1, 4):  # 3 attempts
            try:
                r = await http.post(client["webhook_url"], json=payload,
                                    headers={"Content-Type": "application/json",
                                             "X-Client-Id": client["client_id"]})
                if r.status_code < 300:
                    await db.webhook_deliveries.update_one(
                        {"_id": delivery_id},
                        {"$set": {"status": "delivered", "attempts": attempt,
                                   "response_status": r.status_code,
                                   "response_body": r.text[:500],
                                   "delivered_at": datetime.now(timezone.utc).isoformat()}},
                    )
                    return
                last_err = f"{r.status_code}: {r.text[:200]}"
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"
            await asyncio.sleep(1.5 ** attempt)
        await db.webhook_deliveries.update_one(
            {"_id": delivery_id},
            {"$set": {"status": "failed", "attempts": 3, "last_error": last_err,
                       "failed_at": datetime.now(timezone.utc).isoformat()}},
        )
