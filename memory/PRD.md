# eInvoices.world — PRD

## Problem statement
Enterprise E-Invoicing Platform for Malaysia LHDN MyInvois. Multi-tenant SaaS
acting as an Intermediary (GLOCO) between clinics'/retailers' EMR/POS/ERP
systems and the government LHDN API. API-first, RBAC, pluggable government
adapter layer with future support for Singapore IRAS, India GST, Saudi ZATCA,
Peppol.

## Stack
- React (CRA) + Tailwind + Shadcn UI + Tanstack Query + Sonner
- FastAPI + Python + JWT auth + MongoDB (motor)
- Pluggable adapters (MockLHDNAdapter, RealLHDNAdapter — OAuth2 + RSA-SHA256)
- qrcode + step-up MFA sessions for privileged government actions
- LHDN MyInvois **preprod** (preprod-api.myinvois.hasil.gov.my)

## What is implemented
### Iteration 1 — Multi-tenant + JWT + companies + masters + invoice lifecycle + mock adapter + dashboard + MyTax onboarding + audit + RBAC
### Iteration 2 — Real LHDN adapter (OAuth2 + RSA-SHA256), gov-config admin, QR + 6-digit step-up MFA, SigningGate
### Iteration 3 — ICS console mirroring LHDN portal, bulk CSV/Excel, signed PDF, API Client Bridge with QR activation + webhooks, UBL 2.1 with OnBehalfOf intermediary header, dynamic Roles page, Clinic Onboarding Wizard, brand rename
### Iteration 4 — REAL LHDN preprod UUID (`K1YBN0YP691SD7BTHYHCZ8ZK10`), UBL 2.1 hash fix (SHA-256 hex), UBL enrichment (Telephone/MSIC), `gloco_tin` bypass, API client SDK snippets endpoint, per-client sliding-hour rate limits (HTTP 429), production-ready Docker/Compose/nginx (DEPLOYMENT.md), Emergent dependencies stripped
### Iteration 5 (this iteration — Feb 2026)
- **Backend perf**: centralized `ensure_indexes()` covering invoices (7 compound indexes), customers, suppliers, products, audit, api_clients, users, companies, signing_sessions, gov_credentials, mytax. GzipMiddleware on all JSON responses > 500 B.
- **Dashboard**: single `$facet` aggregation replaces 3+ round trips (by_status + today count + 14-day trend in one pipeline).
- **Lists**: pagination (`?limit=&skip=`), server-side `?q=` search, and projections on customers/suppliers/products/invoices/audit — no more full-doc bloat in list responses.
- **Auth**: user fetch uses projection (no `password_hash` on wire).
- **Seed**: idempotent, demo-scale (8 customers, 5 suppliers, 8 products, ~28 realistic invoices with mixed statuses). Guarded by name/sku/count. Running the seed twice is a no-op.
- **Frontend**: `React.lazy` on every authenticated page + Suspense fallback (smaller initial bundle). QueryClient defaults hardened (`staleTime 60s`, no refetch-on-focus, no retry on 401/404). Axios 30s timeout + 401 auto-logout. Dashboard KPIs have data-testids; Recharts ResponsiveContainer has `minHeight` (silences the width/height=-1 warning).
- **A11y**: `DialogDescription` on api-clients SDK-snippets + rate-limit modals.
- **Docker/nginx**: mongo cache tuned, healthchecks with `condition: service_healthy`, brotli-free nginx with gzip + rate limits + immutable static caching + security headers. Uvicorn worker count via `${UVICORN_WORKERS}`, access log off.
- **Branding**: Emergent-only meta/script tags removed from `public/index.html`.

## Verified perf (public ingress, iteration 5 testing agent)
| Endpoint                | Latency  | Budget |
|-------------------------|---------:|-------:|
| /api/dashboard/stats    |   4 ms   | 400 ms |
| /api/invoices?limit=100 |   8 ms   | 500 ms |
| /api/customers          |   2 ms   | 300 ms |
| /api/suppliers          |   2 ms   | 300 ms |
| /api/products           |   2 ms   | 300 ms |
| /api/audit?limit=100    |   3 ms   | 300 ms |
Testing agent: 13/13 iteration-5 pytest pass, all frontend flows pass.

## Backlog
### P1
- Migrate `invoices.created_at` from ISO string → real BSON datetime for stricter aggregations
- Notification center (email/SMS/webhook)
- Reports (Sales, Tax, Aging) with CSV/PDF export
- Credit note / Debit note first-class flows
### P2
- Clinic-level filter/switcher across every ICS page + per-clinic dashboard
- Peppol / IRAS / GST / ZATCA adapters
### P3
- AI Invoice Assistant / Error Detection / Tax Suggestions / Fraud Detection
- Dynamic Form Engine (metadata-driven gov forms)

## Test credentials
`admin@einvoice.my` / `Admin@12345` (seeded idempotently on every boot).
