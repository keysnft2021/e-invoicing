# Enterprise E-Invoicing Platform — PRD

## Problem statement
Build a modern Enterprise E-Invoicing Platform for Malaysia LHDN MyInvois (with future support for Singapore IRAS, India GST, Saudi ZATCA, Peppol). API-first, multi-tenant, RBAC, government adapter layer.

## Stack (agreed)
- React (CRA) + Tailwind + Shadcn UI + Framer/Motion (deferred) + Tanstack Query + Sonner
- FastAPI + Python + JWT auth + MongoDB
- Mock Malaysia LHDN adapter (pluggable via `adapters.py`)
- Emergent LLM key: NOT wired yet (user chose placeholders)

## Personas
- Super Admin (platform ops)
- Organization Owner (workspace billing + companies)
- Company Admin / Finance Manager / Finance Executive
- Auditor (read-only), Sales, Purchasing
- External: Customer/Vendor (future portal), API User, Support

## What is implemented (Feb 2026 — v1)
- Multi-tenant + JWT auth (bcrypt, cookies + Bearer fallback), 17-role catalog, admin seed
- Companies module (CRUD + branches, TIN/BRN/SST)
- Master data: Customers, Suppliers, Products (HS codes, tax codes)
- Invoice module: draft → submit (background task) → validated / rejected → cancel; live timeline; LHDN mock adapter with deterministic `.13` rejection path
- Government Adapter Layer (`GovernmentAdapter` ABC + `MockLHDNAdapter`) — pluggable per-country
- Dashboard: live stats, 14-day trend chart, adapter health, recent invoices
- MyTax / MyInvois onboarding (from LHDN Appendix 2, 3.1–3.3):
  * Role Application (6 role types, approve/reject workflow, supporting document field)
  * Representative permissions (Document / Taxpayer / Notifications / Intermediary — view always on)
  * Intermediary appointment (TIN/BRN/Name, representation dates, permissions)
- User management + Roles/RBAC catalog page
- Audit trail (auto-logged on login, create/submit/cancel invoice, role app, etc.)
- Settings page (theme, profile)
- Command palette (Cmd+K), sidebar nav, sticky glassmorphic topbar, dark/light theme, sonner toasts
- Enterprise design (Manrope headings, IBM Plex body, JetBrains Mono for financial data)

## What is deferred (backlog)
### P0
- Real LHDN production adapter (certificate signing, OAuth, real endpoints)
- Approval workflow engine (multi-level, department/amount-based)
- Attachments (PDF/XML/JSON upload with object storage)
- OpenAPI documentation polish + Postman collection

### P1
- AI Invoice Assistant, AI Error Detection (Claude Sonnet via Emergent Universal Key)
- Notification center (email/SMS/webhook)
- Reports module (Sales, Tax, Aging) with CSV/PDF export
- Credit note / Debit note first-class flows
- Batch submission + retry queue with visualization
- Peppol / Singapore IRAS / India GST / Saudi ZATCA adapters
- Digital certificate management screen

### P2
- Command palette full-text search across invoices/customers
- Column chooser + saved filters on tables
- Bulk actions on invoices
- Inline editing on tables
- Optimistic updates + skeleton polish
- Webhook framework
- OCR / Document management with version history
- MFA / 2FA / IP whitelisting / API keys per user

## Test credentials
See `/app/memory/test_credentials.md`.
Admin: `admin@einvoice.my` / `Admin@12345`

## Test results
`/app/test_reports/iteration_1.json` — backend 16/16 passed, frontend 100% of tested flows passed.
