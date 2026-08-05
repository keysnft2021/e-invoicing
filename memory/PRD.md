# eInvoices.world — PRD

## Problem statement
Enterprise E-Invoicing Platform for Malaysia LHDN MyInvois. Multi-tenant SaaS
acting as an **Intermediary (GLOCO)** between clinics'/retailers' EMR/POS/ERP
systems and the government LHDN API. API-first, RBAC, pluggable government
adapter layer with future support for Singapore IRAS, India GST, Saudi ZATCA,
Peppol.

## Stack
- React (CRA) + Tailwind + Shadcn UI + Tanstack Query + Sonner
- FastAPI + Python + JWT auth + MongoDB
- Pluggable adapters (`MockLHDNAdapter`, `RealLHDNAdapter` — OAuth2 + RSA-SHA256)
- `qrcode` + step-up MFA sessions for privileged government actions
- LHDN MyInvois **preprod** (`preprod-api.myinvois.hasil.gov.my`)

## Personas
- Super Admin, Organization Owner, Company Admin / Finance Manager / Executive
- Auditor (read-only), Sales, Purchasing
- External: API User (EMR/POS/ERP), Customer/Vendor, Support

## What is implemented
### Iteration 1 (Feb 2026)
- Multi-tenant + JWT auth, bcrypt, 17-role catalog, admin seed
- Companies (CRUD + branches, TIN/BRN/SST)
- Master data: Customers, Suppliers, Products (HS codes, tax codes)
- Invoice module: draft → submit → validated / rejected → cancel with live timeline
- Government Adapter Layer (`GovernmentAdapter` ABC + `MockLHDNAdapter`)
- Dashboard: live stats, 14-day trend chart, adapter health, recent invoices
- MyTax / MyInvois onboarding: Role Application, Representative Permissions, Intermediary
- User management + Roles/RBAC page + Audit trail + Settings + Command palette

### Iteration 2
- **Real LHDN adapter** — OAuth2 client_credentials, RSA-SHA256 signing,
  submits to `preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions/`
- Auto-switching adapter resolution (per-tenant real vs mock)
- Government Credentials admin page (`/gov-config`)
- **QR + 6-digit step-up MFA** on every submit/cancel
- SigningGate React component + `/sign/:sessionId` public approval page

### Iteration 3
- ICS (Integration Console for Sellers) UI matching LHDN portal
- Bulk CSV/Excel upload, signed PDF generation
- API Client Bridge (EMR/POS/ERP) with QR activation + webhook callbacks
- UBL 2.1 transformer with intermediary `OnBehalfOf` header
- Configurable Roles page + Clinic Onboarding Wizard + brand rename to eInvoices.world

### Iteration 4 (this update — Feb 2026)
- **Real LHDN preprod UUID obtained** end-to-end. Pilot clinic (`GLOCO Pilot
  Clinic`, TIN `C20923457010`) submitted invoice `INV-202608-34003` →
  `uuid: K1YBN0YP691SD7BTHYHCZ8ZK10`.
- **UBL 2.1 hash fix** — `documentHash` now sent as SHA-256 **hex** (was base64)
  matching LHDN spec. Base64 doc + hex hash use identical minified UTF-8 bytes.
- **UBL enrichment** — supplier & buyer `Contact.Telephone`,
  `IndustryClassificationCode` (MSIC) with description, `TTX` party identifier.
- **GLOCO taxpayer TIN** stored in `gov_credentials.gloco_tin`. Adapter skips
  `onbehalfof` header when clinic TIN equals GLOCO's own TIN (direct
  submission, no intermediary hop needed until LHDN registers GLOCO as
  intermediary).
- **API Client SDK snippets** — new `GET /api/api-clients/{id}/snippets`
  returns copy-pasteable curl / Node.js / Python / health-probe examples with
  the client's real `X-Client-Id` and bridge URL prefilled. Rendered in a
  Tabs modal on `/api-clients` (SDK Snippets button, active clients only).
- **Per-client rate limits** — new `rate_limit_per_hour` field (default 100)
  editable via `PUT /api/api-clients/{id}/rate-limit` and inline modal.
  Enforced on `/api/external/invoices` with sliding-hour count → HTTP 429
  when exceeded. Verified: 3rd call rejected with limit=2.

## Backlog
### P1
- Notification center (email/SMS/webhook)
- Reports (Sales, Tax, Aging) with CSV/PDF export
- Credit note / Debit note first-class flows
- Batch submission + retry queue visualization

### P2
- Clinic-level filter/switcher across every ICS page
- Per-clinic dashboard stats (invoices this month, RM billed, LHDN success %)
- Full Supplier & Product modules (Vendor mgmt, Inventory, Variants)
- Peppol / IRAS / GST / ZATCA adapters
- MFA / 2FA / IP whitelisting / API keys per user

### P3
- AI Invoice Assistant / Error Detection / Tax Suggestions / Fraud Detection
- Dynamic Form Engine (metadata-driven gov forms)
- Command palette full-text search

## Refactoring
- `/app/backend/adapters.py` is ~470 lines. Candidate split:
  `lhdn/oauth.py`, `lhdn/ubl.py`, `lhdn/submit.py`, `lhdn/sign.py`.

## Test credentials
See `/app/memory/test_credentials.md`. Admin: `admin@einvoice.my` / `Admin@12345`.

## Test results
- Iteration 1: 16/16 backend + all frontend flows pass
- Iteration 2: 30/30 backend + cross-tenant leak fixed and verified
- Iteration 3: bridge + UBL 2.1 verified
- Iteration 4 (this): real LHDN UUID `K1YBN0YP691SD7BTHYHCZ8ZK10`, rate-limit
  enforcement verified (limit=2 → HTTP 429 on 3rd call), snippets endpoint
  returns valid curl/Node/Python for active clients.
