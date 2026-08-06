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
