"""Signed Invoice PDF rendering with LHDN UUID + QR code."""
import io
import base64
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether,
)

from deps import get_db, require_tenant

router = APIRouter(prefix="/api/invoices", tags=["pdf"])


def _qr_png(payload: str) -> io.BytesIO:
    img = qrcode.make(payload, box_size=5, border=1)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def _fmt_money(v, ccy="MYR"):
    try:
        return f"{ccy} {float(v):,.2f}"
    except Exception:
        return f"{ccy} 0.00"


def _build_pdf(inv: dict, company: dict) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                             leftMargin=18 * mm, rightMargin=18 * mm,
                             topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    h_title = ParagraphStyle("t", parent=styles["Title"], fontSize=22, leading=26,
                              textColor=colors.HexColor("#111827"))
    h_kicker = ParagraphStyle("k", parent=styles["Normal"], fontSize=9,
                                textColor=colors.HexColor("#6b7280"), spaceAfter=0)
    body = ParagraphStyle("b", parent=styles["Normal"], fontSize=10, leading=13)
    small = ParagraphStyle("s", parent=styles["Normal"], fontSize=8,
                             textColor=colors.HexColor("#6b7280"))
    mono = ParagraphStyle("m", parent=styles["Normal"], fontSize=8, fontName="Courier",
                            textColor=colors.HexColor("#111827"))

    story = []
    ccy = inv.get("currency", "MYR")
    gov = inv.get("government") or {}
    status = inv.get("status", "draft").upper()

    # Header
    left = [
        [Paragraph(f"<b>{company.get('name', 'Company')}</b>", body)],
        [Paragraph(company.get("address_line1", "") or "", small)],
        [Paragraph(f"{company.get('city', '')} {company.get('postal_code', '')} · {company.get('country', 'MY')}", small)],
        [Paragraph(f"TIN <font name='Courier'>{company.get('tin', '')}</font>", small)],
        [Paragraph(f"BRN <font name='Courier'>{company.get('brn', '')}</font>", small)],
        [Paragraph(f"SST <font name='Courier'>{company.get('sst_number', '')}</font>", small)],
    ]
    right_cells = [
        [Paragraph("E-INVOICE", h_kicker)],
        [Paragraph(inv.get("invoice_number", ""), h_title)],
        [Paragraph(f"Status: <b>{status}</b>", small)],
        [Paragraph(f"Date: {inv.get('invoice_date', '')}", small)],
    ]
    hdr = Table([[Table(left), Table(right_cells)]], colWidths=[95 * mm, 75 * mm])
    hdr.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(hdr)
    story.append(Spacer(1, 10))

    # Bill-to / Gov info
    cust = inv.get("customer_snapshot") or {}
    bill = [
        [Paragraph("BILL TO", h_kicker), Paragraph("LHDN MYINVOIS", h_kicker)],
        [Paragraph(f"<b>{cust.get('name', '')}</b>", body),
         Paragraph(f"UUID <font name='Courier'>{gov.get('uuid') or '—'}</font>", small)],
        [Paragraph(f"TIN <font name='Courier'>{cust.get('tin') or '—'}</font>", small),
         Paragraph(f"Long ID <font name='Courier'>{gov.get('long_id') or '—'}</font>", small)],
        [Paragraph(cust.get("billing_address") or "", small),
         Paragraph(f"Validation ID <font name='Courier'>{gov.get('validation_id') or '—'}</font>", small)],
        ["",
         Paragraph(f"Signed at {gov.get('signed_at') or '—'}", small)],
    ]
    bt = Table(bill, colWidths=[90 * mm, 80 * mm])
    bt.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(bt)
    story.append(Spacer(1, 12))

    # Lines table
    line_head = ["#", "Description", "Qty", "Unit price", "Tax %", "Line total"]
    lines_data = [line_head]
    for i, l in enumerate(inv.get("lines", []), start=1):
        net = l["quantity"] * l["unit_price"] - (l.get("discount") or 0)
        tax = net * (l["tax_rate"] / 100)
        lines_data.append([
            str(i),
            l.get("description", ""),
            f"{l['quantity']:g}",
            _fmt_money(l["unit_price"], ccy),
            f"{l['tax_rate']:g}%",
            _fmt_money(net + tax, ccy),
        ])
    lt = Table(lines_data, colWidths=[10 * mm, 70 * mm, 15 * mm, 30 * mm, 15 * mm, 30 * mm])
    lt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (1, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
    ]))
    story.append(lt)
    story.append(Spacer(1, 10))

    # Totals + QR
    totals = [
        ["Subtotal", _fmt_money(inv.get("subtotal"), ccy)],
        ["Tax total", _fmt_money(inv.get("tax_total"), ccy)],
        ["Grand total", _fmt_money(inv.get("total"), ccy)],
    ]
    tt = Table(totals, colWidths=[35 * mm, 40 * mm])
    tt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LINEABOVE", (0, 2), (-1, 2), 0.5, colors.HexColor("#111827")),
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ]))

    qr_url = gov.get("qr") or f"invoice:{inv.get('invoice_number')}"
    qr_flow = Image(_qr_png(qr_url), width=32 * mm, height=32 * mm)
    qr_cap = Paragraph(
        f"<font size=7 color='#6b7280'>Scan to verify · UUID</font><br/>"
        f"<font name='Courier' size=7>{gov.get('uuid') or 'not-submitted'}</font>", small)
    qr_block = Table([[qr_flow], [qr_cap]], colWidths=[35 * mm])
    qr_block.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))

    bottom = Table([[qr_block, tt]], colWidths=[45 * mm, 125 * mm])
    bottom.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(bottom)
    story.append(Spacer(1, 14))

    if inv.get("notes"):
        story.append(Paragraph(f"<b>Notes.</b> {inv['notes']}", small))
    if inv.get("terms"):
        story.append(Paragraph(f"<b>Terms.</b> {inv['terms']}", small))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        f"<font size=7 color='#9ca3af'>Generated {datetime.now(timezone.utc).isoformat()} · "
        f"adapter={gov.get('adapter', 'mock_lhdn')} · Ledger.gov E-Invoicing</font>", small))

    doc.build(story)
    buf.seek(0)
    return buf


@router.get("/{iid}/pdf")
async def invoice_pdf(iid: str, ctx=Depends(require_tenant)):
    db = get_db()
    inv = await db.invoices.find_one({"_id": ObjectId(iid), "tenant_id": ctx["tenant_id"]})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    company = await db.companies.find_one({"tenant_id": ctx["tenant_id"]}) or {}
    buf = _build_pdf(inv, company)
    fname = f"{inv.get('invoice_number', 'invoice')}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{fname}"'},
    )
