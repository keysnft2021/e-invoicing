# eInvoices.world — PRD

Malaysia LHDN MyInvois multi-tenant Intermediary SaaS. React + FastAPI + MongoDB.
Purely clinic/medical vertical.

## Iterations 1–9
See git history. Highlights: real LHDN preprod UUID, SDK snippets, rate
limits, clinic switcher, red LHDN accent #E30514, EIW rebrand, 32-column
Consolidated Management + A–H Invoice Preview, Debit Note Management,
Operation Log Report, Section B/C/D forms with Malaysia dropdowns, clinic-
only seed (8 buyers / 5 suppliers / 8 products).

## Iteration 10 (this)
- **Invoice Management** on `/ics/fiscal-document` rewritten to match LHDN
  portal screenshot:
  - 12 columns: checkbox, NO., Document Type, Document NO. (S-…-S-…),
    Submission UID, E-Invoice UUID, Description of Product or Service,
    Supplier's TIN, Supplier's Name (defaults to DFACE HEALTHCARE SDN BHD /
    C24700902040), Buyer's TIN (EI00000000010), Buyer's Name (General
    Public), Total Net Amount.
  - Toolbar: Cancel, View, View Invoice PDF, Share Invoice PDF, View Invalid
    Reasons, Operation Log, Export, Export QR Code List (each requires
    exactly one selected row; toast error otherwise).
  - Expand-collapse filter panel: Document NO., Document Type, Submission
    UID, E-Invoice UUID, Supplier's TIN, Buyer's TIN + Search / Reset.
  - Footer Total row aggregates Total Net Amount.
  - Export produces LHDN-aligned CSV; Export QR Code List produces a
    QR/uuid list CSV + confirmation modal.

Testing agent iteration_10 launched.

## Iteration 11 (this)
- **Global MSIC dropdown** (Malaysia Standard Industrial Classification):
  - New reusable searchable combobox: `/app/frontend/src/components/common/MsicSelect.jsx`
    (shadcn Command + Popover, ~1300 codes from `/app/frontend/src/lib/msic.js`,
    case-insensitive filter on code + description).
  - Wired into: Products (`prod-msic`), Suppliers (`sup-msic`),
    New Invoice per line (`line-msic-{i}`).
  - Invoice Detail Section D Classification column now reads `l.msic_code` /
    `l.msic_description` per line (was hardcoded "Medical examination").
  - Invoice Detail Section B supplier MSIC reads from
    `inv.supplier_msic` / `inv.supplier_msic_desc` (falls back to 86201).
- **Backend persistence**:
  - `masters.py` — `SupplierIn` / `ProductIn` accept + project
    `msic_code`, `msic_description`.
  - `invoices.py` — `Line` accepts `msic_code`, `msic_description`;
    `InvoiceIn` accepts `supplier_msic`, `supplier_msic_desc`.
- **Line-vs-Product precedence** — picking a product on an invoice line
  only inherits its MSIC when the product actually has one, so a
  manually-selected line MSIC is preserved.

Tested: iteration_11.json — Products/Suppliers/Invoice line MSIC persistence
verified via curl; frontend combobox verified by testing agent (95% success,
1 filter bug fixed).

## Backlog (P1 → P3)
- Reusable MalaysiaAddressBlock (DRY across Customers/Suppliers/DebitNotes)
- Backend `/api/auth/change-password` + `/api/profile`
- Extend `/api/products` schema with `msic_class`, `discount_rate`,
  `country_of_origin`, `tariff_code`
- Notification center for LHDN rejections
- Peppol / IRAS / GST / ZATCA adapters
- Recharts minHeight fix on Dashboard trend chart

## Test credentials
`admin@einvoice.my` / `Admin@12345` — pilot company_id `6a7330392b20661e6a9c08c6`.
