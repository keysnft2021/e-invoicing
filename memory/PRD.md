# Enterprise E-Invoicing Platform — PRD

## Problem statement
Modern Enterprise E-Invoicing Platform for Malaysia LHDN MyInvois (with future support for Singapore IRAS, India GST, Saudi ZATCA, Peppol). API-first, multi-tenant, RBAC, pluggable government adapter layer.

## Stack
- React (CRA) + Tailwind + Shadcn UI + Tanstack Query + Sonner
- FastAPI + Python + JWT auth + MongoDB
- Pluggable adapters (`MockLHDNAdapter`, `RealLHDNAdapter` — OAuth2 + RSA-SHA256)
- `qrcode` + step-up MFA sessions for privileged government actions
- Emergent LLM key: not wired yet (user chose placeholders)

## Personas
- Super Admin, Organization Owner, Company Admin / Finance Manager / Executive
- Auditor (read-only), Sales, Purchasing
- External: Customer/Vendor (future), API User, Support

## What is implemented
### Iteration 1 (Feb 2026)
- Multi-tenant + JWT auth, bcrypt, 17-role catalog, admin seed
- Companies (CRUD + branches, TIN/BRN/SST)
- Master data: Customers, Suppliers, Products (HS codes, tax codes)
- Invoice module: draft → submit → validated / rejected → cancel with live timeline; deterministic `.13` rejection path in mock
- Government Adapter Layer (`GovernmentAdapter` ABC + `MockLHDNAdapter`)
- Dashboard: live stats, 14-day trend chart, adapter health, recent invoices
- MyTax / MyInvois onboarding: Role Application, Representative Permissions, Intermediary
- User management + Roles/RBAC page + Audit trail + Settings + Command palette
- Enterprise design (Manrope headings, IBM Plex body, JetBrains Mono for numbers)

### Iteration 2 (this update)
- **Real LHDN adapter (`RealLHDNAdapter`)** — OAuth2 client_credentials, RSA-SHA256 signing (when certificate + private key configured), submits to `preprod-api.myinvois.hasil.gov.my/api/v1.0/documentsubmissions/`, parses accepted/rejected documents, returns UUID/LongID/ValidationID
- **Auto-switching adapter resolution** — `resolve_adapter(country, db, tenant_id)` returns real adapter only when THIS tenant has enabled credentials, else mock. Verified multi-tenant isolation (Tenant B never sees Tenant A's LHDN mode).
- **Government Credentials admin page** (`/gov-config`) — save `client_id`, `client_secret`, X.509 cert PEM, private key PEM; "Verify connection" hits `/connect/token` and stores `last_verified_ok` / `last_error`; secrets are redacted in GET responses.
- **QR + 6-digit step-up MFA (`/api/signing/*`)** — every invoice submit and cancel must first create a signing session, then be approved (via 6-digit code OR by scanning the QR that opens `/sign/:sessionId?c=CODE`). Sessions are 5-min TTL, single-use, tenant-scoped, bound to `(action, entity_id)`. Consumed sessions cannot be reused; cross-entity and cross-tenant attempts are rejected.
- **SigningGate** React component — modal that renders QR + shows code + accepts OTP input + polls approval status.
- **/sign/:sessionId public approval page** — after login, user can Approve or Reject the pending government action.

## What is deferred (backlog)
### P0
- OpenAPI docs polish + Postman collection
- Approval workflow engine (multi-level, department/amount-based)
- Attachments (PDF/XML/JSON) with object storage
- Wire real LHDN certificate + preprod credentials once obtained

### P1
- AI Invoice Assistant, AI Error Detection (Claude via Emergent Universal Key)
- Notification center (email/SMS/webhook)
- Reports (Sales, Tax, Aging) with CSV/PDF export
- Credit note / Debit note first-class flows
- Batch submission + retry queue visualization
- Peppol / IRAS / GST / ZATCA adapters

### P2
- Command palette full-text search
- Column chooser + saved filters + bulk actions
- Inline editing on tables + optimistic updates
- MFA / 2FA / IP whitelisting / API keys per user

## Test credentials
See `/app/memory/test_credentials.md`. Admin: `admin@einvoice.my` / `Admin@12345`.

## Test results
- Iteration 1: `/app/test_reports/iteration_1.json` — 16/16 backend, all frontend flows pass.
- Iteration 2: `/app/test_reports/iteration_2.json` — 30/30 backend, all frontend flows pass. Cross-tenant leak identified in `resolve_adapter` was **fixed and verified live** (Tenant A `preprod`, Tenant B `mock`).
