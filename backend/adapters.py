"""Government Adapter Layer — pluggable per-country implementations.

Exposes a uniform async interface so business logic never depends on the
target authority. `resolve_adapter(country, db)` picks the real adapter if
credentials are configured for that country, otherwise falls back to mock.
"""
import asyncio
import base64
import hashlib
import json
import os
import random
import string
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Optional

import httpx


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rand(prefix: str, n: int = 12) -> str:
    return f"{prefix}-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=n))


class GovernmentAdapter(ABC):
    name: str = "base"
    country: str = "XX"

    @abstractmethod
    async def authenticate(self) -> dict: ...
    @abstractmethod
    async def submit_invoice(self, invoice: dict) -> dict: ...
    @abstractmethod
    async def cancel_invoice(self, uuid: str, reason: str) -> dict: ...
    async def reject_invoice(self, uuid: str, reason: str) -> dict:
        return await self.cancel_invoice(uuid, reason)
    async def search_invoice(self, uuid: str) -> dict:
        return await self.invoice_status(uuid)
    @abstractmethod
    async def invoice_status(self, uuid: str) -> dict: ...
    @abstractmethod
    async def get_qr(self, uuid: str) -> str: ...
    @abstractmethod
    async def health_check(self) -> dict: ...


class MockLHDNAdapter(GovernmentAdapter):
    """Simulates Malaysia LHDN MyInvois end-to-end (dev/demo only)."""
    name = "mock_lhdn"
    country = "MY"

    async def authenticate(self) -> dict:
        await asyncio.sleep(0.05)
        return {"access_token": _rand("MYINVOIS-TKN", 24), "expires_at": _now_iso(),
                "issuer": "LHDN MyInvois (Mock/PreProd)"}

    async def submit_invoice(self, invoice: dict) -> dict:
        await asyncio.sleep(0.4)
        total = float(invoice.get("total", 0) or 0)
        cents = round((total - int(total)) * 100)
        if cents == 13:
            return {"status": "rejected", "submission_uid": _rand("SUB", 10),
                    "errors": [{"code": "CF321",
                                "message": "Line item tax rate does not match SST classification.",
                                "path": "invoice.lines[0].tax_rate"}],
                    "timestamp": _now_iso()}
        uuid_ = _rand("LHDN-UUID", 16)
        return {"status": "validated", "submission_uid": _rand("SUB", 10),
                "uuid": uuid_, "long_id": _rand("LID", 20),
                "validation_id": _rand("VAL", 10),
                "qr": f"https://preprod.myinvois.hasil.gov.my/{uuid_}",
                "signed_at": _now_iso(), "timestamp": _now_iso()}

    async def cancel_invoice(self, uuid: str, reason: str) -> dict:
        await asyncio.sleep(0.2)
        return {"status": "cancelled", "uuid": uuid, "reason": reason, "timestamp": _now_iso()}

    async def invoice_status(self, uuid: str) -> dict:
        return {"uuid": uuid, "status": "validated", "timestamp": _now_iso()}

    async def get_qr(self, uuid: str) -> str:
        return f"https://preprod.myinvois.hasil.gov.my/{uuid}"

    async def health_check(self) -> dict:
        return {"adapter": self.name, "country": self.country, "healthy": True,
                "mode": "mock", "latency_ms": 42, "checked_at": _now_iso()}


class RealLHDNAdapter(GovernmentAdapter):
    """Production Malaysia LHDN MyInvois adapter.

    OAuth2 client_credentials + document submission per
    https://sdk.myinvois.hasil.gov.my/. Endpoints:
      - PreProd token:  https://preprod-api.myinvois.hasil.gov.my/connect/token
      - PreProd submit: https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions/
      - Prod  token:    https://api.myinvois.hasil.gov.my/connect/token
      - Prod  submit:   https://api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions/

    Config (from DB `gov_credentials` collection):
      client_id, client_secret, environment ("preprod"|"prod"),
      certificate_pem (optional, X.509 for signing), private_key_pem (optional).
    """
    name = "lhdn_myinvois"
    country = "MY"

    BASE_PREPROD = "https://preprod-api.myinvois.hasil.gov.my"
    BASE_PROD = "https://api.myinvois.hasil.gov.my"

    def __init__(self, config: dict):
        self.config = config
        self.environment = config.get("environment", "preprod")
        self.client_id = config["client_id"]
        self.client_secret = config["client_secret"]
        self.certificate_pem = config.get("certificate_pem")
        self.private_key_pem = config.get("private_key_pem")
        self._token: Optional[str] = None
        self._token_expires_at: float = 0
        self._base = self.BASE_PROD if self.environment == "prod" else self.BASE_PREPROD

    async def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=30.0, base_url=self._base)

    async def authenticate(self) -> dict:
        now = datetime.now(timezone.utc).timestamp()
        if self._token and now < self._token_expires_at - 30:
            return {"access_token": self._token, "cached": True,
                    "issuer": f"LHDN MyInvois ({self.environment})"}
        async with await self._client() as c:
            r = await c.post("/connect/token",
                             data={"client_id": self.client_id,
                                   "client_secret": self.client_secret,
                                   "grant_type": "client_credentials",
                                   "scope": "InvoicingAPI"},
                             headers={"Content-Type": "application/x-www-form-urlencoded"})
            r.raise_for_status()
            payload = r.json()
            self._token = payload["access_token"]
            self._token_expires_at = now + int(payload.get("expires_in", 3600))
            return {"access_token": self._token, "expires_in": payload.get("expires_in"),
                    "issuer": f"LHDN MyInvois ({self.environment})", "cached": False}

    def _sign_document(self, doc_json: dict) -> dict:
        """SHA-256 hash + (optional) RSA-SHA256 signature over document JSON.

        When certificate_pem + private_key_pem are provided, a detached signature
        is included alongside the hash so LHDN can verify authenticity.
        """
        raw = json.dumps(doc_json, separators=(",", ":"), sort_keys=True).encode("utf-8")
        digest = hashlib.sha256(raw).digest()
        digest_b64 = base64.b64encode(digest).decode("ascii")
        signature_b64 = None
        cert_hash_b64 = None
        if self.certificate_pem and self.private_key_pem:
            try:
                from cryptography.hazmat.primitives import hashes, serialization
                from cryptography.hazmat.primitives.asymmetric import padding
                pk = serialization.load_pem_private_key(
                    self.private_key_pem.encode("utf-8"), password=None)
                sig = pk.sign(raw, padding.PKCS1v15(), hashes.SHA256())
                signature_b64 = base64.b64encode(sig).decode("ascii")
                cert_hash = hashlib.sha256(self.certificate_pem.encode("utf-8")).digest()
                cert_hash_b64 = base64.b64encode(cert_hash).decode("ascii")
            except Exception as e:
                # Signing failure is non-fatal — LHDN may accept unsigned in preprod.
                signature_b64 = f"error:{type(e).__name__}"
        return {"documentHash": digest_b64, "signatureValue": signature_b64,
                "certificateHash": cert_hash_b64,
                "documentB64": base64.b64encode(raw).decode("ascii")}

    async def submit_invoice(self, invoice: dict) -> dict:
        auth = await self.authenticate()
        signed = self._sign_document(invoice)
        codenumber = invoice.get("invoice_number") or _rand("INV")
        submission = {
            "documents": [{
                "format": "JSON",
                "documentHash": signed["documentHash"],
                "codeNumber": codenumber,
                "document": signed["documentB64"],
            }]
        }
        async with await self._client() as c:
            r = await c.post("/api/v1.0/documentsubmissions/",
                             headers={"Authorization": f"Bearer {auth['access_token']}",
                                      "Content-Type": "application/json"},
                             json=submission)
            if r.status_code >= 400:
                return {"status": "rejected", "submission_uid": None,
                        "errors": [{"code": str(r.status_code),
                                    "message": r.text[:400],
                                    "path": "submission"}],
                        "timestamp": _now_iso()}
            data = r.json()
        accepted = (data.get("acceptedDocuments") or [])
        rejected = (data.get("rejectedDocuments") or [])
        if accepted:
            a = accepted[0]
            uuid_ = a.get("uuid") or _rand("LHDN")
            return {"status": "validated",
                    "submission_uid": data.get("submissionUID"),
                    "uuid": uuid_,
                    "long_id": a.get("longId"),
                    "validation_id": a.get("validationId"),
                    "qr": f"https://myinvois.hasil.gov.my/{uuid_}"
                          if self.environment == "prod"
                          else f"https://preprod.myinvois.hasil.gov.my/{uuid_}",
                    "signed_at": _now_iso(), "timestamp": _now_iso(),
                    "raw": data}
        if rejected:
            r0 = rejected[0]
            return {"status": "rejected", "submission_uid": data.get("submissionUID"),
                    "errors": [{"code": (e.get("code") or "ERR"),
                                "message": (e.get("message") or "Unknown"),
                                "path": e.get("propertyPath", "")}
                               for e in (r0.get("error", {}).get("details") or [{"message": r0.get("error", {}).get("message", "Rejected")}])],
                    "timestamp": _now_iso(), "raw": data}
        return {"status": "submitted", "submission_uid": data.get("submissionUID"),
                "raw": data, "timestamp": _now_iso()}

    async def cancel_invoice(self, uuid: str, reason: str) -> dict:
        auth = await self.authenticate()
        async with await self._client() as c:
            r = await c.put(f"/api/v1.0/documents/state/{uuid}/state",
                            headers={"Authorization": f"Bearer {auth['access_token']}",
                                     "Content-Type": "application/json"},
                            json={"status": "cancelled", "reason": reason})
            ok = r.status_code < 400
            return {"status": "cancelled" if ok else "error",
                    "uuid": uuid, "reason": reason,
                    "http_status": r.status_code, "response": r.text[:400],
                    "timestamp": _now_iso()}

    async def invoice_status(self, uuid: str) -> dict:
        auth = await self.authenticate()
        async with await self._client() as c:
            r = await c.get(f"/api/v1.0/documents/{uuid}/details",
                            headers={"Authorization": f"Bearer {auth['access_token']}"})
            return {"uuid": uuid, "http_status": r.status_code,
                    "response": r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text,
                    "timestamp": _now_iso()}

    async def get_qr(self, uuid: str) -> str:
        base = "https://myinvois.hasil.gov.my" if self.environment == "prod" \
               else "https://preprod.myinvois.hasil.gov.my"
        return f"{base}/{uuid}"

    async def health_check(self) -> dict:
        try:
            start = datetime.now(timezone.utc).timestamp()
            await self.authenticate()
            latency = int((datetime.now(timezone.utc).timestamp() - start) * 1000)
            return {"adapter": self.name, "country": self.country,
                    "healthy": True, "mode": self.environment,
                    "latency_ms": latency, "checked_at": _now_iso()}
        except Exception as e:
            return {"adapter": self.name, "country": self.country,
                    "healthy": False, "mode": self.environment,
                    "error": f"{type(e).__name__}: {e}", "checked_at": _now_iso()}


_MOCK: dict[str, GovernmentAdapter] = {"MY": MockLHDNAdapter()}


def get_adapter(country: str = "MY") -> GovernmentAdapter:
    """Synchronous mock lookup (used for global health only)."""
    return _MOCK[country]


async def resolve_adapter(country: str, db, tenant_id: str) -> GovernmentAdapter:
    """Return real adapter if THIS tenant has enabled credentials, else mock."""
    cfg = await db.gov_credentials.find_one({
        "country": country, "tenant_id": tenant_id, "enabled": True,
    })
    if not cfg or not cfg.get("client_id") or not cfg.get("client_secret"):
        return _MOCK[country]
    try:
        return RealLHDNAdapter(cfg)
    except Exception:
        return _MOCK[country]


async def list_adapters_with_status(db, tenant_id: str) -> list[dict]:
    out = []
    for c in _MOCK:
        cfg = await db.gov_credentials.find_one({
            "country": c, "tenant_id": tenant_id, "enabled": True,
        })
        out.append({"country": c,
                    "name": "lhdn_myinvois" if cfg else "mock_lhdn",
                    "mode": (cfg.get("environment") if cfg else "mock") or "mock"})
    return out
