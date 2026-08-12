"""MY121 — Download invoice PDF by ID or LHDN UUID.
Uses ReportLab to render a compact LHDN-styled A4 PDF from the invoice document.
"""
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from bson import ObjectId
from datetime import datetime, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)

from deps import get_db, require_tenant

router = APIRouter(tags=["invoice-pdf"])

LHDN_RED = colors.HexColor("#E30514")


def _fmt_money(n):
    try:
        return f"{float(n):,.2f}"
    except Exception:
        return str(n or "0.00")


def _build_pdf(inv: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                              leftMargin=15 * mm, rightMargin=15 * mm,
                              topMargin=15 * mm, bottomMargin=15 * mm,
                              title=f"Invoice {inv.get('invoice_number', '')}")
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"],
                          textColor=LHDN_RED, fontSize=18, spaceAfter=4)
    label = ParagraphStyle("l", parent=styles["Normal"],
                             textColor=colors.HexColor("#666666"), fontSize=8)
    val = ParagraphStyle("v", parent=styles["Normal"], fontSize=9)
    story = []

    # Header
    story.append(Paragraph("eInvoices.world", h1))
    story.append(Paragraph(
        f"E-Invoice · {inv.get('invoice_number', '—')}", styles["Normal"],
    ))
    gov = inv.get("government", {}) or {}
    if gov.get("uuid"):
        story.append(Paragraph(
            f"LHDN UUID: <b>{gov.get('uuid')}</b>", val,
        ))
    story.append(Spacer(1, 6))

    # Meta grid (Section A)
    meta = [
        ["E-Invoice Type", inv.get("invoice_type", "invoice").replace("_", " ").title(),
         "Issue Date", (inv.get("invoice_date") or "")[:10]],
        ["Currency", inv.get("currency", "MYR"),
         "Exchange Rate", str(inv.get("exchange_rate", "1.0"))],
        ["Status", (inv.get("status") or "draft").upper(),
         "Total Payable", f"{inv.get('currency', 'MYR')} {_fmt_money(inv.get('total', 0))}"],
    ]
    t = Table(meta, colWidths=[35 * mm, 55 * mm, 35 * mm, 55 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#666666")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    # Supplier + Buyer side-by-side
    cust = inv.get("customer_snapshot", {}) or {}
    parties = [
        [Paragraph("<b>SUPPLIER</b>", styles["Normal"]),
         Paragraph("<b>BUYER</b>", styles["Normal"])],
        [Paragraph(
            f"{inv.get('supplier_name', '') or ''}<br/>"
            f"TIN: {inv.get('supplier_tin', '—')}<br/>"
            f"MSIC: {inv.get('supplier_msic', '86201')} — "
            f"{inv.get('supplier_msic_desc', 'General medical services')}",
            val),
         Paragraph(
            f"{cust.get('name', '') or ''}<br/>"
            f"TIN: {cust.get('tin', '—')}<br/>"
            f"BRN: {cust.get('brn', '—')}<br/>"
            f"{cust.get('billing_address', '')}",
            val)],
    ]
    p = Table(parties, colWidths=[90 * mm, 90 * mm])
    p.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F5F5F5")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(p)
    story.append(Spacer(1, 8))

    # Line items
    story.append(Paragraph("<b>Section D · Line Item Details</b>", styles["Normal"]))
    story.append(Spacer(1, 4))
    rows = [["#", "Classification", "Description", "Qty", "Unit", "Line Total"]]
    for i, ln in enumerate(inv.get("lines", []), 1):
        line_net = (ln.get("quantity", 0) * ln.get("unit_price", 0)) - ln.get("discount", 0)
        rows.append([
            str(i),
            f"({ln.get('msic_code', '86201')}) "
            f"{(ln.get('msic_description', 'General medical services') or '')[:32]}",
            (ln.get("description", "") or "")[:40],
            f"{ln.get('quantity', 0)}",
            _fmt_money(ln.get("unit_price", 0)),
            _fmt_money(line_net),
        ])
    lt = Table(rows, colWidths=[10 * mm, 55 * mm, 55 * mm, 15 * mm, 20 * mm, 25 * mm])
    lt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), LHDN_RED),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(lt)
    story.append(Spacer(1, 8))

    # Totals
    totals = [
        ["Subtotal (excl. tax)", _fmt_money(inv.get("subtotal", 0))],
        ["Tax", _fmt_money(inv.get("tax_total", 0))],
        ["Shipping", _fmt_money(inv.get("shipping", 0))],
        ["Charges", _fmt_money(inv.get("charges", 0))],
        ["Rounding", _fmt_money(inv.get("round_off", 0))],
        ["Total Payable", _fmt_money(inv.get("total", 0))],
    ]
    tt = Table(totals, colWidths=[140 * mm, 40 * mm])
    tt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, LHDN_RED),
        ("TEXTCOLOR", (0, -1), (-1, -1), LHDN_RED),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(tt)

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} · "
        f"eInvoices.world · LHDN MyInvois Intermediary",
        label,
    ))

    doc.build(story)
    return buf.getvalue()


@router.get("/api/invoices/{iid}/pdf")
async def download_invoice_pdf(iid: str, ctx=Depends(require_tenant)):
    db = get_db()
    doc = await db.invoices.find_one(
        {"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]},
    )
    if not doc:
        raise HTTPException(404, "Invoice not found")
    pdf = _build_pdf(doc)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{doc.get("invoice_number", "invoice")}.pdf"',
        },
    )
