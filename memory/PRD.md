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
### Iteration 5 — Perf + idempotent seed: centralized `ensure_indexes()`, dashboard `$facet` single-round-trip, list pagination + projections + `?q=`, GzipMiddleware, React.lazy on every page, QueryClient defaults, axios 30s timeout + 401 auto-logout, mongo/nginx production polish. Dashboard KPI testids + Recharts minHeight + DialogDescription a11y. Testing agent: 13/13 pass.
### Iteration 6 (this iteration — Feb 2026)
- **Clinic Switcher (global filter)**: `CompanyContext` gains an `ALL_COMPANIES` sentinel + `currentId`/`isAll` helpers. Topbar shows "All clinics · N" by default with a checked-item dropdown; selection persists in `localStorage.current_company_id`.
- **Backend scope**: `/api/dashboard/stats`, `/api/ics/summary`, `/api/ics/transactions`, `/api/invoices` all accept `?company_id=<id>`. Cross-tenant safety verified — a foreign `company_id` returns zero rows (tenant_id filter still applied first).
- **Frontend wire-up**: Dashboard + ICS Dashboard include `currentId` in the query key + URL. PageHeader kicker/subtitle update to reflect the active scope. All existing testids preserved.
- **Testing agent** (iteration_5.json): 6/6 backend pytest + full frontend Playwright pass. Scoped GLOCO Pilot Clinic → 14 invoices; All clinics → 70. Reload keeps selection.

## Verified perf (public ingress, iteration 5)
| Endpoint                | Latency  | Budget |
|-------------------------|---------:|-------:|
| /api/dashboard/stats    |   4 ms   | 400 ms |
| /api/invoices?limit=100 |   8 ms   | 500 ms |
| /api/customers          |   2 ms   | 300 ms |

## Backlog
### P1
- Notification center (email/SMS/webhook)
- Reports (Sales, Tax, Aging) with CSV/PDF export
- Credit note / Debit note first-class flows
- Migrate `invoices.created_at` to real BSON datetime
### P2
- Per-clinic Dashboard stats (invoices this month, RM billed, LHDN success %)
- Full Supplier & Product modules (Vendor mgmt, Inventory, Variants)
- Peppol / IRAS / GST / ZATCA adapters
### P3
- AI Invoice Assistant / Error Detection / Tax Suggestions / Fraud Detection
- Dynamic Form Engine (metadata-driven gov forms)

## Test credentials
`admin@einvoice.my` / `Admin@12345` (seeded idempotently on every boot).
Pilot clinic: id `6a7330392b20661e6a9c08c6`, TIN `C20923457010`.
