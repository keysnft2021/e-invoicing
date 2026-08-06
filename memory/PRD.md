# eInvoices.world — PRD

## Problem statement
Enterprise E-Invoicing Platform for Malaysia LHDN MyInvois (Intermediary
"GLOCO"). Multi-tenant SaaS bridging clinics'/retailers' EMR/POS/ERP systems
to LHDN. API-first, RBAC, pluggable adapter layer.

## Stack
React + Tailwind + Shadcn + Tanstack Query · FastAPI + MongoDB · JWT ·
LHDN MyInvois preprod (OAuth2 + RSA-SHA256 + UBL 2.1).

## Iterations
1. Multi-tenant + invoices + mock adapter + dashboard + MyTax + audit + RBAC.
2. Real LHDN OAuth2 + RSA-SHA256 + QR step-up MFA + gov-config admin.
3. ICS console + bulk CSV/Excel + signed PDF + API Client Bridge (webhooks)
   + UBL 2.1 with OnBehalfOf + configurable roles + Clinic Onboarding Wizard.
4. REAL LHDN preprod UUID (`K1YBN0YP691SD7BTHYHCZ8ZK10`), UBL hash fix
   (SHA-256 hex), UBL enrichment, `gloco_tin` bypass, API client SDK snippets
   + rate limits, Emergent-free Docker/Compose/nginx production package.
5. Perf: `ensure_indexes()`, `$facet` dashboard, projections + pagination on
   every list, GzipMiddleware, React.lazy + QueryClient tuning, idempotent
   demo-scale seed (8 buyers, 5 suppliers, 8 products, 28 invoices).
6. Global Clinic Switcher (`company_id` filter on dashboard, ICS, invoices),
   cross-tenant leak safe, localStorage persistence.
7. LHDN UI rebrand — Customers→Buyers, ICS→EIW, red accent #E30514 (355 96%),
   32-column Transaction Data Management table, InvoiceDetail rewritten with
   Sections A–H (Malaysian LHDN e-invoice layout) + Submit/Modify/Cancel wired
   to SigningGate.
8. **Iteration 8 (this)** — Invoicing Consolidated Management (`/ics/consolidated`)
   rebuilt to match LHDN portal exactly:
   - 32 LHDN columns identical to the screenshots, with buyer pinned to
     General Public (`EI00000000010`) and doc numbers in `S-XXXXXXX-S-XXXXXXX`
     format.
   - Expand-collapse filter panel + full toolbar (Invoice Preview, Submit,
     View Transaction Data, View Invalid Reasons, Operation Log, Check
     Incompleted Fields, Export, Run Consolidate Task).
   - Wizard-style Invoice Preview modal renders Sections A–H exactly like
     the Malaysian LHDN portal, with Previous / Next / Cancel navigation
     across pages *and* across selected rows.
   - React duplicate-key warning fixed; `Submit` uses `useNavigate` instead
     of `<Link>` so the disabled state actually blocks navigation.
   - Testing agent iteration_7.json: 100% frontend pass, no blocking issues.

## Backlog
### P1
- Notification center (email/SMS/webhook) for LHDN rejections
- Reports (Sales / Tax / Aging) with CSV & PDF export scoped by clinic
- Credit note / Debit note first-class flows
- Backend enforcement of "General Public" buyer at consolidation persist time
- Split IcsConsolidated.jsx dialogs into `./components/` for maintainability
### P2
- Per-clinic KPIs (RM billed, LHDN success %) on Dashboard
- Peppol / IRAS / GST / ZATCA adapters
- Convert `invoices.created_at` from ISO string → BSON datetime
### P3
- AI Invoice Assistant / Error Detection / Tax Suggestions / Fraud Detection

## Test credentials
`admin@einvoice.my` / `Admin@12345` — pilot company_id `6a7330392b20661e6a9c08c6`.
