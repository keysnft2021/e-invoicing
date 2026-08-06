# eInvoices.world — PRD

Malaysia LHDN MyInvois multi-tenant Intermediary SaaS. React + FastAPI + MongoDB.

## Iterations
1–7 as previously recorded (auth, RBAC, real LHDN preprod UUID, SDK snippets,
rate limits, clinic switcher, EIW rebrand, red accent, 32-col Consolidated
Management + A-H Invoice Preview).

### Iteration 8 (this)
- **Red primary buttons** — `--primary` CSS var repointed to Malaysia LHDN red
  `#E30514` (355 96%) so every default shadcn button now matches accent.
- **Malaysia address data** (`/lib/malaysia.js`) — 17 states, per-state city
  lists, per-city area lists, ISO country codes.
- **Debit Note Management** (`/debit-notes`) — LHDN-style source-invoice list
  with 13 columns matching screenshot (NO, Document Type, Document NO.,
  E-Invoice UUID, Buyer's TIN, Buyer's Name pinned to General Public,
  Excl Tax, Incl Tax, Payable, Tax, Date Time Issued, Issuer TIN). Click a
  row → wizard-style Request Debit Note with Sections A (Basic Info), B
  (Supplier's Info), C (Buyer's Details) matching screenshots pixel-for-pixel;
  Country/State/City/Area cascading dropdowns; Next/Previous/Cancel/Submit.
- **Operation Log Report** (`/operation-log`) — 5-column LHDN table (NO,
  Operator, Operation Date, Operation Details) with Expand-collapse filter
  (Operator + Date from/to + Search + Reset), View Details modal (Operated
  Account + Operation Details textarea + Close), Export CSV.
- **Profile flow** — topbar user avatar dropdown (View My Profile / Modify
  Password / Account Security / Logout). `/profile` renders Section A: Basic
  Information (Account, User Name, Contact Number) + Section B: My Company
  (Taxpayer's Info Maintenance / User Binding / Contract Details buttons + a
  9-column company table). Modify Password + Account Security dialogs match
  screenshots (Old/New/Confirm with show-hide eye + rules; Enable Authorized
  Login radio + Generate Authorization Code + timestamp).
- **New Buyer / New Supplier forms** now render as LHDN Sections C / B with
  Country/State/City/Area cascading Malaysia dropdowns; Save via primary bar.
- **Sidebar cleanup** — Debit Note Management + Operation Log Report moved
  inside the EIW Console submenu (removed from top-level).
- **Lint / a11y polish** — fixed `no-unstable-nested-components` on Profile,
  duplicate-key warning in Consolidated Run dialog, DialogDescription on
  every new modal.

Testing agent: iteration_7 100% frontend pass; iteration_8 launched.

## Backlog (P1 → P3)
- Notification center (email/SMS/webhook) for LHDN rejections
- Backend `/api/auth/change-password` + `/api/profile` endpoints
- Peppol / IRAS / GST / ZATCA adapters
- Backend enforcement of "General Public" buyer on consolidated submit

## Test credentials
`admin@einvoice.my` / `Admin@12345` — pilot company_id `6a7330392b20661e6a9c08c6`.
