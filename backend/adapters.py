"""Government Adapter Layer — pluggable per-country implementations.

Every adapter implements the same async interface so business logic
(routers, workflow engine) never depends on the target authority.
"""
import asyncio
import random
import string
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rand(prefix: str, n: int = 12) -> str:
    return f"{prefix}-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=n))


class GovernmentAdapter(ABC):
    """Abstract base — extend per country (LHDN, IRAS, ZATCA, Peppol...)."""
    name: str = "base"
    country: str = "XX"

    @abstractmethod
    async def authenticate(self) -> dict: ...
    @abstractmethod
    async def submit_invoice(self, invoice: dict) -> dict: ...
    @abstractmethod
    async def cancel_invoice(self, uuid: str, reason: str) -> dict: ...
    @abstractmethod
    async def reject_invoice(self, uuid: str, reason: str) -> dict: ...
    @abstractmethod
    async def search_invoice(self, uuid: str) -> dict: ...
    @abstractmethod
    async def invoice_status(self, uuid: str) -> dict: ...
    @abstractmethod
    async def get_qr(self, uuid: str) -> str: ...
    @abstractmethod
    async def health_check(self) -> dict: ...


class MockLHDNAdapter(GovernmentAdapter):
    """Simulates Malaysia LHDN MyInvois end-to-end flow.

    submit → validating (async 1-2s) → validated (uuid + qr) OR rejected.
    Deterministic-ish: totals ending in .13 auto-reject to demo failure paths.
    """
    name = "mock_lhdn"
    country = "MY"

    async def authenticate(self) -> dict:
        await asyncio.sleep(0.05)
        return {
            "access_token": _rand("MYINVOIS-TKN", 24),
            "expires_at": _now_iso(),
            "issuer": "LHDN MyInvois (Mock/PreProd)",
        }

    async def submit_invoice(self, invoice: dict) -> dict:
        await asyncio.sleep(0.4)
        total = float(invoice.get("total", 0) or 0)
        # Trigger deterministic rejection to demo error handling
        cents = round((total - int(total)) * 100)
        if cents == 13:
            return {
                "status": "rejected",
                "submission_uid": _rand("SUB", 10),
                "errors": [{
                    "code": "CF321",
                    "message": "Line item tax rate does not match SST classification.",
                    "path": "invoice.lines[0].tax_rate",
                }],
                "timestamp": _now_iso(),
            }
        uuid_ = _rand("LHDN-UUID", 16)
        return {
            "status": "validated",
            "submission_uid": _rand("SUB", 10),
            "uuid": uuid_,
            "long_id": _rand("LID", 20),
            "validation_id": _rand("VAL", 10),
            "qr": f"https://preprod.myinvois.hasil.gov.my/{uuid_}",
            "signed_at": _now_iso(),
            "timestamp": _now_iso(),
        }

    async def cancel_invoice(self, uuid: str, reason: str) -> dict:
        await asyncio.sleep(0.2)
        return {"status": "cancelled", "uuid": uuid, "reason": reason, "timestamp": _now_iso()}

    async def reject_invoice(self, uuid: str, reason: str) -> dict:
        await asyncio.sleep(0.2)
        return {"status": "rejected", "uuid": uuid, "reason": reason, "timestamp": _now_iso()}

    async def search_invoice(self, uuid: str) -> dict:
        return {"uuid": uuid, "status": "validated", "found": True, "timestamp": _now_iso()}

    async def invoice_status(self, uuid: str) -> dict:
        return {"uuid": uuid, "status": "validated", "timestamp": _now_iso()}

    async def get_qr(self, uuid: str) -> str:
        return f"https://preprod.myinvois.hasil.gov.my/{uuid}"

    async def health_check(self) -> dict:
        return {"adapter": self.name, "country": self.country, "healthy": True,
                "latency_ms": 42, "checked_at": _now_iso()}


# --- Registry ---
_ADAPTERS: dict[str, GovernmentAdapter] = {
    "MY": MockLHDNAdapter(),
}


def get_adapter(country: str = "MY") -> GovernmentAdapter:
    if country not in _ADAPTERS:
        raise ValueError(f"No adapter registered for country {country}")
    return _ADAPTERS[country]


def list_adapters() -> list[dict]:
    return [{"country": a.country, "name": a.name} for a in _ADAPTERS.values()]
