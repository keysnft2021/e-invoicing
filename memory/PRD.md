# eInvoices.world — PRD

Malaysia LHDN MyInvois multi-tenant Intermediary SaaS. React + FastAPI + MongoDB.
Purely clinic/medical vertical (as of iteration 9).

## Iterations
1–8 as previously recorded (auth, RBAC, real LHDN preprod UUID, SDK snippets,
rate limits, clinic switcher, EIW rebrand, red accent, 32-col Consolidated
Management + A-H Invoice Preview, Debit Notes, Operation Log Report, Profile
flow, Section B/C forms with Malaysia dropdowns).

### Iteration 9 (this)
- **Clinic-only vertical** — seed rewritten to purely medical: 8 buyers
  (MediCare, Wellness Family, Sunway Medical, KPJ Damansara, Pantai Hospital
  KL, Gleneagles, Columbia Asia, Retail Buyer), 5 pharma suppliers
  (Pharmaniaga, Zuellig, DKSH, Kotra, Hovid), 8 medical products (consultation,
  vaccination, FBC test, dental, botox, X-ray, paracetamol, physio).
  Startup cleanup deletes older non-medical rows (SteelWorks, TransLogistics,
  Tenaga, Office Supplies, Cloud Hosting, Laptop, Cement, etc.) — verified via
  `/api/products` and `/api/customers` after restart.
- **New Product form** now renders LHDN Section D: Line Item Details —
  Classification (MSIC-mapped medical dropdown), Item Name, SKU, Measurement
  (each/SES/DOSE/TEST/STRIP/UNIT/MO/HR/BOTTLE), Quantity, Unit Price,
  Total Before Discount (auto), Discount Rate, Total Excluding Tax (auto),
  Tax Rate, Tax Amount (auto), Subtotal (auto), Fee/Charge Rate, Fee/Charge
  Amount, Product Tariff Code, Country of Origin (Malaysia default).
  Live calculations verified against the LHDN screenshot (qty 15 × price 0.50
  → total before/excl 7.50).

Testing agent iteration_9 launched.

## Backlog (P1 → P3)
- Reusable MalaysiaAddressBlock component (DRY across Customers/Suppliers/DebitNotes)
- Backend `/api/auth/change-password` + `/api/profile` endpoints
- Notification center (email/SMS/webhook) for LHDN rejections
- Peppol / IRAS / GST / ZATCA adapters

## Test credentials
`admin@einvoice.my` / `Admin@12345` — pilot company_id `6a7330392b20661e6a9c08c6`.
