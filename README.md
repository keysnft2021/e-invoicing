# eInvoices.world — Enterprise E-Invoicing Platform

Malaysia LHDN MyInvois **Intermediary** platform (SaaS). Multi-tenant, RBAC,
API-first. Ships as a self-contained Docker Compose stack — no third-party
platform lock-in.

## Highlights

- Real LHDN MyInvois **preprod** integration (OAuth2 + UBL 2.1 + SHA-256 hex)
- QR + 6-digit **step-up MFA** on every government submission
- ICS (Integration Console for Sellers) UI mirroring the official portal
- API Client Bridge — external EMR / POS / ERP systems push invoices in via
  `Bearer` + `X-Client-Id`, get auto-filed to LHDN, receive webhook callbacks
- Per-client **sliding-hour rate limits** (HTTP 429 above quota)
- **SDK snippets** (curl / Node / Python) generated per active client
- Bulk CSV / Excel upload, signed PDF generation
- 17-role dynamic RBAC, audit trail, multi-tenant isolation

## Stack

- **Backend**: FastAPI · MongoDB (motor) · JWT · bcrypt
- **Frontend**: React 19 · Tailwind · Shadcn UI · Tanstack Query
- **Infra**: Docker Compose (backend + mongo + nginx-served SPA)

## Local development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # edit MONGO_URL, JWT_SECRET
uvicorn server:app --reload --port 8001

# Frontend
cd frontend
yarn install
cp .env.example .env    # REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

## Production deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — one-page DigitalOcean guide.

TL;DR:
```bash
git clone <this-repo> && cd einvoices
cp .env.example .env    # edit JWT_SECRET, ADMIN_*, FRONTEND_URL
docker compose up -d --build
```

## Test credentials (default seed)

- Email: `admin@einvoice.my`
- Password: value of `ADMIN_PASSWORD` in your `.env`

## License

Proprietary — all rights reserved.
