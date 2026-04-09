"""
invoiceGenerator.py
Likeson Health — Top-level Tax Invoice PDF Generator

Usage:
    from invoiceGenerator import build_invoice_pdf
    pdf_bytes = build_invoice_pdf(invoice_data)

invoice_data shape:
    {
        invoiceId, date, expiryDate, appliedCoupon,
        user:    { name, email, phone, id },
        plan:    { name, idealFor, supportTier, featuresSummary[], benefits{} },
        payment: { transactionId, method, amount, paidAt, promoDiscount }
    }
"""

import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)

# ─────────────────────────────────────────────────────────────────────────────
# Palette — matches global.css design tokens
# ─────────────────────────────────────────────────────────────────────────────
TEAL        = colors.HexColor('#0d9488')
TEAL_LIGHT  = colors.HexColor('#ccfbf1')
TEAL_DARK   = colors.HexColor('#065f46')
TEAL_MID    = colors.HexColor('#14b8a6')
SLATE_900   = colors.HexColor('#0f172a')
SLATE_800   = colors.HexColor('#1e293b')
SLATE_700   = colors.HexColor('#334155')
SLATE_500   = colors.HexColor('#64748b')
SLATE_400   = colors.HexColor('#94a3b8')
SLATE_200   = colors.HexColor('#e2e8f0')
SLATE_100   = colors.HexColor('#f1f5f9')
SLATE_50    = colors.HexColor('#f8fafc')
WHITE       = colors.white
SUCCESS     = colors.HexColor('#16a34a')
GOLD        = colors.HexColor('#f59e0b')
ERROR       = colors.HexColor('#dc2626')

W, H    = A4                      # 595.28 x 841.89 pt
ML      = 14 * mm
MR      = 14 * mm
MT      = 26 * mm
MB      = 16 * mm
UW      = W - ML - MR             # usable width ≈ 567.28 pt


# ─────────────────────────────────────────────────────────────────────────────
# Helper: build a Paragraph with inline kwargs
# ─────────────────────────────────────────────────────────────────────────────
def _p(text: str, **kw) -> Paragraph:
    kw.setdefault('fontSize', 9)
    kw.setdefault('fontName', 'Helvetica')
    kw.setdefault('textColor', SLATE_700)
    kw.setdefault('leading', 13)
    return Paragraph(text, ParagraphStyle('_tmp_', **kw))


def _rp(text: str, **kw) -> Paragraph:
    """Right-aligned paragraph."""
    kw['alignment'] = TA_RIGHT
    return _p(text, **kw)


# ─────────────────────────────────────────────────────────────────────────────
# Page chrome (banner + footer + watermark)
# ─────────────────────────────────────────────────────────────────────────────
def _draw_chrome(canv, doc):
    canv.saveState()

    # ── Top banner ─────────────────────────────────────────────────────────
    canv.setFillColor(SLATE_900)
    canv.rect(0, H - 22 * mm, W, 22 * mm, fill=1, stroke=0)

    canv.setFillColor(TEAL)                          # left accent stripe
    canv.rect(0, H - 22 * mm, 5 * mm, 22 * mm, fill=1, stroke=0)

    canv.setFont('Helvetica-Bold', 18)
    canv.setFillColor(WHITE)
    canv.drawString(10 * mm, H - 13 * mm, 'LIKESON')

    canv.setFont('Helvetica', 8.5)
    canv.setFillColor(TEAL_LIGHT)
    canv.drawString(10 * mm, H - 19 * mm, 'Healthcare Platform — likeson.in')

    canv.setFont('Helvetica-Bold', 12)
    canv.setFillColor(WHITE)
    canv.drawRightString(W - 12 * mm, H - 12.5 * mm, 'TAX INVOICE')

    canv.setFont('Helvetica', 8)
    canv.setFillColor(SLATE_400)
    canv.drawRightString(W - 12 * mm, H - 19 * mm, 'GSTIN: 37AABCL1234F1Z5')

    # ── Thin teal underline below banner ───────────────────────────────────
    canv.setStrokeColor(TEAL)
    canv.setLineWidth(1.5)
    canv.line(0, H - 22 * mm, W, H - 22 * mm)

    # ── Bottom footer ───────────────────────────────────────────────────────
    canv.setFillColor(SLATE_900)
    canv.rect(0, 0, W, 12 * mm, fill=1, stroke=0)

    canv.setFillColor(TEAL)
    canv.rect(0, 0, 5 * mm, 12 * mm, fill=1, stroke=0)

    canv.setFont('Helvetica', 7.5)
    canv.setFillColor(SLATE_400)
    canv.drawString(10 * mm, 5 * mm,
                    'Likeson Health Pvt. Ltd.  |  D.No. 40-7-74, MG Road, Vijayawada – 520010  |  '
                    'support@likeson.in  |  1800-XXX-XXXX')
    canv.drawRightString(W - 12 * mm, 5 * mm, f'Page {doc.page}')

    # ── Diagonal watermark ──────────────────────────────────────────────────
    canv.saveState()
    canv.translate(W / 2, H / 2)
    canv.rotate(42)
    canv.setFont('Helvetica-Bold', 88)
    canv.setFillColor(TEAL)
    canv.setFillAlpha(0.028)
    canv.drawCentredString(0, 0, 'LIKESON')
    canv.restoreState()

    canv.restoreState()


# ─────────────────────────────────────────────────────────────────────────────
# Address card helper (Billed From / To)
# ─────────────────────────────────────────────────────────────────────────────
def _addr_card(title: str, lines: list, width: float) -> Table:
    rows = [
        [_p(title, fontSize=7, textColor=SLATE_400, fontName='Helvetica')],
    ]
    for i, line in enumerate(lines):
        rows.append([_p(
            line,
            fontSize=9.5 if i == 0 else 8.5,
            fontName='Helvetica-Bold' if i == 0 else 'Helvetica',
            textColor=SLATE_900 if i == 0 else SLATE_700,
        )])

    t = Table(rows, colWidths=[width])
    t.setStyle(TableStyle([
        ('BOX',           (0, 0), (-1, -1), 0.4, SLATE_200),
        ('LINEBELOW',     (0, 0), (-1, 0),  2.0, TEAL),
        ('BACKGROUND',    (0, 0), (-1, -1), WHITE),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING',   (0, 0), (-1, -1), 9),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 9),
    ]))
    return t


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────
def build_invoice_pdf(invoice_data: dict) -> bytes:
    """
    Build a Likeson Tax Invoice PDF and return raw bytes.

    Parameters
    ----------
    invoice_data : dict
        See module docstring for full schema.

    Returns
    -------
    bytes
        Raw PDF content ready to send via email attachment or HTTP response.
    """
    buf  = io.BytesIO()
    inv  = invoice_data
    user = inv.get('user', {})
    plan = inv.get('plan', {})
    pay  = inv.get('payment', {})

    # ── Document setup ───────────────────────────────────────────────────
    class _InvoiceDoc(BaseDocTemplate):
        def __init__(self, f, **kw):
            super().__init__(f, **kw)
            frame = Frame(
                ML, MB, UW, H - MT - MB,
                leftPadding=0, rightPadding=0,
                topPadding=0,  bottomPadding=0,
            )
            self.addPageTemplates([
                PageTemplate(id='main', frames=[frame], onPage=_draw_chrome)
            ])

    doc = _InvoiceDoc(
        buf, pagesize=A4,
        topMargin=MT, bottomMargin=MB,
        leftMargin=ML, rightMargin=MR,
    )

    story = []
    story.append(Spacer(1, 3 * mm))

    # ── Invoice meta band ─────────────────────────────────────────────────
    qw = UW / 4
    meta_tbl = Table(
        [
            [
                _p('INVOICE NO.',  fontSize=7, textColor=SLATE_400),
                _p('INVOICE DATE', fontSize=7, textColor=SLATE_400),
                _p('VALID UNTIL',  fontSize=7, textColor=SLATE_400),
                _p('STATUS',       fontSize=7, textColor=SLATE_400),
            ],
            [
                _p(inv.get('invoiceId', 'INV-000000'),
                   fontSize=9.5, fontName='Helvetica-Bold', textColor=SLATE_900),
                _p(inv.get('date', datetime.now().strftime('%d %b %Y')),
                   fontSize=9.5, fontName='Helvetica-Bold', textColor=SLATE_900),
                _p(inv.get('expiryDate', '—'),
                   fontSize=9.5, fontName='Helvetica-Bold', textColor=SLATE_900),
                _p('<font color="#16a34a"><b>✓ PAID</b></font>', fontSize=9.5),
            ],
        ],
        colWidths=[qw, qw, qw, qw],
    )
    meta_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), SLATE_50),
        ('BOX',           (0, 0), (-1, -1), 0.4, SLATE_200),
        ('LINEBELOW',     (0, 0), (-1, 0),  0.4, SLATE_200),
        ('INNERGRID',     (0, 0), (-1, -1), 0.3, SLATE_200),
        ('TOPPADDING',    (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 4 * mm))

    # ── Billed From / To ─────────────────────────────────────────────────
    card_w = (UW - 6 * mm) / 2

    from_card = _addr_card('BILLED FROM', [
        'Likeson Health Pvt. Ltd.',
        'D.No. 40-7-74, MG Road, Vijayawada',
        'Andhra Pradesh – 520010, India',
        'support@likeson.in  |  +91-863-900-XXXX',
    ], card_w)

    to_card = _addr_card('BILLED TO', [
        user.get('name', 'Customer'),
        user.get('email', '—'),
        user.get('phone', '—'),
        f"User ID: {str(user.get('id', '—'))[:22]}",
    ], card_w)

    addr_row = Table(
        [[from_card, Spacer(6 * mm, 1), to_card]],
        colWidths=[card_w, 6 * mm, card_w],
    )
    addr_row.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(addr_row)
    story.append(Spacer(1, 5 * mm))

    # ── Line items ────────────────────────────────────────────────────────
    story.append(_p('SUBSCRIPTION DETAILS',
                    fontSize=7.5, textColor=TEAL, fontName='Helvetica-Bold'))
    story.append(Spacer(1, 1.5 * mm))

    NUM_W  = 12
    QTY_W  = UW * 0.14
    RATE_W = UW * 0.13
    AMT_W  = UW * 0.14
    DESC_W = UW - NUM_W - QTY_W - RATE_W - AMT_W
    cw_items = [NUM_W, DESC_W, QTY_W, RATE_W, AMT_W]

    amt_val = pay.get('amount', 0)

    header_row = [
        _p(''),
        _p('<b>DESCRIPTION</b>',
           fontSize=7, textColor=WHITE, fontName='Helvetica-Bold'),
        _rp('QTY / LIMIT',
            fontSize=7, textColor=WHITE, fontName='Helvetica-Bold'),
        _rp('UNIT RATE',
            fontSize=7, textColor=WHITE, fontName='Helvetica-Bold'),
        _rp('AMOUNT',
            fontSize=7, textColor=WHITE, fontName='Helvetica-Bold'),
    ]

    plan_row = [
        _p('1', fontName='Helvetica-Bold', textColor=SLATE_900),
        Paragraph(
            f"<b>{plan.get('name', 'Plan')}</b> — Monthly Healthcare Subscription<br/>"
            f"<font size='8' color='#64748b'>30-day billing cycle · "
            f"Support: {plan.get('supportTier', 'Standard')}</font>",
            ParagraphStyle('_pr_', fontSize=9, textColor=SLATE_900,
                           fontName='Helvetica', leading=13),
        ),
        _rp('1 Month', textColor=SLATE_700),
        _rp(f'Rs.{amt_val:,.0f}', textColor=SLATE_700),
        _rp(f'<b>Rs.{amt_val:,.0f}</b>',
            fontName='Helvetica-Bold', textColor=SLATE_900),
    ]

    benefits = plan.get('benefits', {})
    benefit_defs = [
        ('Doctor Consultations',   f"{benefits.get('doctorConsultations', 0)}/month"),
        ('Transport Rides',        f"{benefits.get('transportRides', 0)}/month"),
        ('Lab Tests Included',     f"{benefits.get('labTestsIncluded', 0)}/month"),
        ('Pharmacy Discount',      f"{benefits.get('pharmacyDiscount', 0)}%"),
        ('Diagnostic Discount',    f"{benefits.get('diagnosticDiscount', 0)}%"),
        ('Care Assistant',         'Included' if benefits.get('careAssistantIncluded') else 'Not included'),
        ('Home Sample Collection', 'Included' if benefits.get('hasHomeSampleCollection') else 'Not included'),
        ('Max Members',            str(plan.get('maxMembers', 1))),
    ]

    item_rows = [header_row, plan_row]
    for label, qty in benefit_defs:
        item_rows.append([
            _p('↳', textColor=TEAL, fontName='Helvetica'),
            _p(f'  {label}', fontSize=8.5, textColor=SLATE_500),
            _rp(qty,         fontSize=8.5, textColor=SLATE_700),
            _rp('—',         fontSize=8.5, textColor=SLATE_400),
            _rp('Included',  fontSize=8.5, textColor=TEAL, fontName='Helvetica-Oblique'),
        ])

    n = len(item_rows)
    items_tbl = Table(item_rows, colWidths=cw_items)
    items_tbl.setStyle(TableStyle([
        # Header
        ('BACKGROUND',    (0, 0), (-1, 0),  SLATE_900),
        # Main plan row
        ('BACKGROUND',    (0, 1), (-1, 1),  SLATE_50),
        ('LINEBELOW',     (0, 1), (-1, 1),  1.5, TEAL),
        # Benefit rows
        ('BACKGROUND',    (0, 2), (-1, -1), WHITE),
        # Borders
        ('BOX',           (0, 0), (-1, -1), 0.4, SLATE_200),
        ('LINEBELOW',     (0, 0), (-1, n-2), 0.3, SLATE_200),
        # Padding
        ('TOPPADDING',    (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (-1, -1), 5),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 5),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(items_tbl)
    story.append(Spacer(1, 4 * mm))

    # ── Totals block ──────────────────────────────────────────────────────
    base_amt   = round(amt_val / 1.18, 2)
    gst_amt    = round(amt_val - base_amt, 2)
    promo_disc = pay.get('promoDiscount', 0)
    coupon     = inv.get('appliedCoupon', '')

    LW = UW * 0.46
    RW = UW * 0.46
    GAP = UW - LW - RW

    lw1, lw2 = LW * 0.38, LW * 0.62

    left_rows = [
        [_p('Transaction ID', fontSize=7.5, textColor=SLATE_500),
         _p(pay.get('transactionId', '—'), fontName='Helvetica-Bold', textColor=SLATE_900)],
        [_p('Payment Method', fontSize=7.5, textColor=SLATE_500),
         _p(pay.get('method', 'Online'),   fontName='Helvetica-Bold', textColor=SLATE_900)],
        [_p('Payment Date',   fontSize=7.5, textColor=SLATE_500),
         _p(pay.get('paidAt', '—'),         fontName='Helvetica-Bold', textColor=SLATE_900)],
        [_p('Promo Code',     fontSize=7.5, textColor=SLATE_500),
         _p(coupon if coupon else '—',      fontName='Helvetica-Bold', textColor=TEAL)],
        [_p('Plan Ideal For', fontSize=7.5, textColor=SLATE_500),
         _p(plan.get('idealFor', '—'),     fontSize=8, textColor=SLATE_700)],
    ]
    left_tbl = Table(left_rows, colWidths=[lw1, lw2])
    left_tbl.setStyle(TableStyle([
        ('TOPPADDING',    (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 4),
    ]))

    rw1, rw2 = RW * 0.52, RW * 0.48
    right_rows = [
        [_p('Subtotal (excl. GST)', fontSize=8, textColor=SLATE_500),
         _rp(f'Rs.{base_amt:,.2f}', fontSize=9, textColor=SLATE_700)],
        [_p('GST @ 18% (IGST)',     fontSize=8, textColor=SLATE_500),
         _rp(f'Rs.{gst_amt:,.2f}',  fontSize=9, textColor=SLATE_700)],
    ]
    if promo_disc:
        right_rows.append([
            _p(f'Promo Discount ({coupon})', fontSize=8, textColor=SLATE_500),
            _rp(f'- Rs.{promo_disc:,.2f}',
                fontSize=9, textColor=SUCCESS, fontName='Helvetica-Bold'),
        ])
    right_rows.append([
        _p('<b>TOTAL AMOUNT PAID</b>',
           fontSize=10, textColor=SLATE_900, fontName='Helvetica-Bold'),
        _rp(f'<b>Rs.{amt_val:,.2f}</b>',
            fontSize=15, textColor=TEAL_DARK, fontName='Helvetica-Bold'),
    ])

    right_tbl = Table(right_rows, colWidths=[rw1, rw2])
    right_tbl.setStyle(TableStyle([
        ('TOPPADDING',    (0, 0),  (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0),  (-1, -1), 5),
        ('LEFTPADDING',   (0, 0),  (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0),  (-1, -1), 0),
        ('LINEABOVE',     (0, 0),  (-1, 0),  0.4, SLATE_200),
        ('LINEABOVE',     (0, -1), (-1, -1), 1.5, TEAL),
        ('LINEBELOW',     (0, -1), (-1, -1), 0.4, SLATE_200),
        ('BACKGROUND',    (0, -1), (-1, -1), TEAL_LIGHT),
        ('TOPPADDING',    (0, -1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 9),
        ('LEFTPADDING',   (0, -1), (-1, -1), 8),
        ('RIGHTPADDING',  (0, -1), (-1, -1), 8),
    ]))

    totals_row = Table(
        [[left_tbl, Spacer(GAP, 1), right_tbl]],
        colWidths=[LW, GAP, RW],
    )
    totals_row.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(totals_row)
    story.append(Spacer(1, 5 * mm))

    # ── Plan highlights grid ──────────────────────────────────────────────
    feats = plan.get('featuresSummary', [])
    if feats:
        story.append(_p('PLAN HIGHLIGHTS',
                        fontSize=7.5, textColor=TEAL, fontName='Helvetica-Bold'))
        story.append(Spacer(1, 1.5 * mm))

        ncols  = 3
        padded = feats + [''] * ((-len(feats)) % ncols)
        frows  = [padded[i:i + ncols] for i in range(0, len(padded), ncols)]
        fdata  = [
            [
                _p(f'<font color="#0d9488">✓</font>  {cell}',
                   fontSize=8, textColor=SLATE_700) if cell else _p('')
                for cell in row
            ]
            for row in frows
        ]
        ftbl = Table(fdata, colWidths=[UW / ncols] * ncols)
        ftbl.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), SLATE_50),
            ('BOX',           (0, 0), (-1, -1), 0.4, SLATE_200),
            ('INNERGRID',     (0, 0), (-1, -1), 0.3, SLATE_200),
            ('TOPPADDING',    (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LEFTPADDING',   (0, 0), (-1, -1), 10),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
        ]))
        story.append(ftbl)
        story.append(Spacer(1, 5 * mm))

    # ── Notice strip ──────────────────────────────────────────────────────
    notice = Table(
        [[_p(
            '<b>Note:</b> This is a computer-generated invoice and does not require a signature. '
            'All prices are inclusive of 18% GST. For support: support@likeson.in or '
            '1800-XXX-XXXX (Mon–Sat, 9am–6pm IST). '
            'Subscription auto-renews 48 hours before expiry unless cancelled.',
            fontSize=7.5, textColor=SLATE_700,
        )]],
        colWidths=[UW],
    )
    notice.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), TEAL_LIGHT),
        ('BOX',           (0, 0), (-1, -1), 0.5, TEAL),
        ('TOPPADDING',    (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING',   (0, 0), (-1, -1), 10),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
    ]))
    story.append(notice)

    doc.build(story)
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# Express.js integration helper (call from a Node child_process or via API)
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import json, sys

    if len(sys.argv) > 1:
        # Called as: python invoiceGenerator.py '{"invoiceId":...}' output.pdf
        data     = json.loads(sys.argv[1])
        out_path = sys.argv[2] if len(sys.argv) > 2 else 'invoice.pdf'
        pdf      = build_invoice_pdf(data)
        with open(out_path, 'wb') as f:
            f.write(pdf)
        print(f'Invoice written: {out_path} ({len(pdf):,} bytes)')
    else:
        # Demo run
        demo = {
            'invoiceId':    'INV-1710001234-A4B7',
            'date':         '14 Mar 2026',
            'expiryDate':   '13 Apr 2026',
            'appliedCoupon': 'LIKESON20',
            'user': {
                'name':  'Ravi Kumar',
                'email': 'ravi.kumar@email.com',
                'phone': '+91 98765 43210',
                'id':    '6612abc4e7f8d9c0a1b2c3d4',
            },
            'plan': {
                'name':        'Premium Care',
                'idealFor':    'Individuals needing comprehensive healthcare',
                'supportTier': 'Dedicated Executive',
                'maxMembers':  1,
                'featuresSummary': [
                    'Monthly Health Summary',
                    'No Cancellation Charges',
                    'Priority Support 24/7',
                    'Free Home Sample Collection',
                    'Dedicated Care Manager',
                    'Digital Health Records',
                ],
                'benefits': {
                    'doctorConsultations':     10,
                    'transportRides':           8,
                    'labTestsIncluded':         4,
                    'pharmacyDiscount':        20,
                    'diagnosticDiscount':      15,
                    'careAssistantIncluded':   True,
                    'hasHomeSampleCollection': True,
                },
            },
            'payment': {
                'transactionId': 'TXN-PAY-8834991122',
                'method':        'UPI — Google Pay',
                'amount':        2999,
                'paidAt':        '14 Mar 2026, 11:42 AM',
                'promoDiscount': 0,
            },
        }
        pdf = build_invoice_pdf(demo)
        with open('likeson_invoice_demo.pdf', 'wb') as f:
            f.write(pdf)
        print(f'Demo invoice: likeson_invoice_demo.pdf ({len(pdf):,} bytes)')