 

import io
import qrcode
from PIL import Image as PILImage

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, HRFlowable, Image, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

W, H = A4
MARGIN = 18 * mm

# ─── BRAND COLOURS ────────────────────────────────────────────────────────────
HOSP_DARK   = colors.HexColor("#0f3460")   # deep navy
HOSP_MID    = colors.HexColor("#16213e")   # dark blue
HOSP_ACCENT = colors.HexColor("#e94560")   # crimson accent
HOSP_LIGHT  = colors.HexColor("#dde8f8")   # pale blue tint
HOSP_TEXT   = colors.HexColor("#1a1a2e")   # near-black

DOC_DARK    = colors.HexColor("#134e30")   # deep green
DOC_MID     = colors.HexColor("#1a6b40")   # forest green
DOC_ACCENT  = colors.HexColor("#f0a500")   # amber accent
DOC_LIGHT   = colors.HexColor("#d9f0e8")   # pale mint tint
DOC_TEXT    = colors.HexColor("#0d2d1a")   # near-black green

FIELD_BG    = colors.HexColor("#f7f9fc")
BORDER_CLR  = colors.HexColor("#c5cfe0")
NOTE_CLR    = colors.HexColor("#8899bb")


# ─── QR CODE ─────────────────────────────────────────────────────────────────
def make_qr_image(url: str, size_mm: int = 28) -> Image:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    size = size_mm * mm
    return Image(buf, width=size, height=size)


# ─── STYLE FACTORY ────────────────────────────────────────────────────────────
def make_styles(dark, accent, text_clr):
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=9, textColor=text_clr,
                          leading=13, spaceAfter=0)
    return {
        "brand":    ParagraphStyle("brand",  parent=base, fontName="Helvetica-Bold",
                                   fontSize=20, textColor=colors.white, leading=24),
        "tagline":  ParagraphStyle("tagline", parent=base, fontSize=9,
                                   textColor=colors.HexColor("#aabbdd"), leading=12),
        "scan":     ParagraphStyle("scan",   parent=base, fontSize=8, textColor=dark,
                                   fontName="Helvetica-Bold", alignment=TA_CENTER),
        "h1":       ParagraphStyle("h1",     parent=base, fontName="Helvetica-Bold",
                                   fontSize=13, textColor=dark, spaceBefore=12,
                                   spaceAfter=4, leading=16),
        "h2":       ParagraphStyle("h2",     parent=base, fontName="Helvetica-Bold",
                                   fontSize=10, textColor=accent, spaceBefore=8,
                                   spaceAfter=2, leading=12),
        "label":    ParagraphStyle("label",  parent=base, fontName="Helvetica-Bold",
                                   fontSize=8.5, textColor=dark, leading=11),
        "note":     ParagraphStyle("note",   parent=base, fontSize=7.5,
                                   textColor=NOTE_CLR, leading=10, fontName="Helvetica-Oblique"),
        "small":    ParagraphStyle("small",  parent=base, fontSize=7.5,
                                   textColor=text_clr, leading=10),
        "footer":   ParagraphStyle("footer", parent=base, fontSize=7.5,
                                   textColor=colors.HexColor("#888888"),
                                   alignment=TA_CENTER, leading=10),
        "required": ParagraphStyle("req",    parent=base, fontSize=8.5,
                                   textColor=accent, fontName="Helvetica-Bold"),
    }


# ─── BUILDING BLOCKS ─────────────────────────────────────────────────────────

def field_box(label: str, note: str, styles: dict, required=False, tall=False):
    """Single labelled field row."""
    req_star = " *" if required else ""
    lbl = Paragraph(f"{label}{req_star}", styles["label"])
    nt  = Paragraph(note, styles["note"]) if note else Spacer(0, 0)
    box_h = 18 if not tall else 32
    inner = [
        [lbl],
        [nt],
        [Spacer(0, box_h)],
    ]
    t = Table(inner, colWidths=[W - 2 * MARGIN - 4])
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), FIELD_BG),
        ("BOX",         (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ("TOPPADDING",  (0, 0), (-1, 0), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",(0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, -1),(-1,-1), 4),
    ]))
    return KeepTogether([t, Spacer(0, 4)])


def two_fields(data, styles, dark):
    """Row of two side-by-side fields."""
    col_w = (W - 2 * MARGIN - 8) / 2
    cells = []
    for (lbl, note, req) in data:
        req_star = " *" if req else ""
        l  = Paragraph(f"{lbl}{req_star}", styles["label"])
        n  = Paragraph(note, styles["note"]) if note else Spacer(0, 0)
        cells.append([l, n, Spacer(0, 16)])
    if len(cells) == 1:
        cells.append(["", "", ""])
    t = Table(
        [[cells[0], cells[1]]],
        colWidths=[col_w, col_w],
        rowHeights=None,
    )
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), FIELD_BG),
        ("BOX",          (0, 0), (0, 0), 0.5, BORDER_CLR),
        ("BOX",          (1, 0), (1, 0), 0.5, BORDER_CLR),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
    ]))
    return KeepTogether([t, Spacer(0, 4)])


def section_header(title: str, styles: dict, dark, accent, full_width=True):
    col_w = W - 2 * MARGIN
    t = Table(
        [[Paragraph(title, styles["h1"])]],
        colWidths=[col_w],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), colors.HexColor("#eef3fb")),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LINEBELOW",    (0, 0), (-1, -1), 1.5, accent),
    ]))
    return KeepTogether([Spacer(0, 6), t, Spacer(0, 6)])


def checkbox_row(options: list, label: str, styles: dict, cols=3):
    """Render inline checkboxes."""
    col_w = (W - 2 * MARGIN) / cols
    row = []
    for opt in options:
        row.append(Paragraph(f"☐  {opt}", styles["small"]))
    while len(row) % cols != 0:
        row.append(Paragraph("", styles["small"]))
    rows = [row[i:i+cols] for i in range(0, len(row), cols)]
    data = []
    for r in rows:
        data.append(r)
    lbl = Paragraph(label, styles["label"])
    t = Table(data, colWidths=[col_w] * cols)
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), FIELD_BG),
        ("BOX",          (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, -1),(-1,-1),  8),
        ("ROWBACKGROUNDS",(0,0),(-1,-1), [FIELD_BG]),
    ]))
    return KeepTogether([lbl, Spacer(0, 3), t, Spacer(0, 4)])


# ─── HEADER BUILDER ──────────────────────────────────────────────────────────
def build_header(title: str, subtitle: str, dark, mid, accent, light, styles, qr_url: str):
    qr_img = make_qr_image(qr_url, size_mm=26)
    qr_block = Table(
        [
            [qr_img],
            [Paragraph("Scan Here", styles["scan"])],
        ],
        colWidths=[30 * mm],
    )
    qr_block.setStyle(TableStyle([
        ("ALIGN",       (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND",  (0, 0), (-1, -1), colors.white),
        ("BOX",         (0, 0), (-1, -1), 1, accent),
        ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0,-1),(-1,-1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",(0, 0), (-1, -1), 4),
    ]))

    brand_col = Table(
        [
            [Paragraph("🏥 LIKESON HEALTHCARE", styles["brand"])],
            [Paragraph("Advanced Healthcare Logistics Platform", styles["tagline"])],
            [Spacer(0, 8)],
            [Paragraph(title, ParagraphStyle("ht", fontName="Helvetica-Bold",
                                              fontSize=13, textColor=accent, leading=16))],
            [Paragraph(subtitle, ParagraphStyle("hs", fontName="Helvetica",
                                                 fontSize=9, textColor=colors.HexColor("#99aabb"), leading=12))],
        ],
        colWidths=[W - 2 * MARGIN - 36 * mm - 6],
    )
    brand_col.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 0),
        ("TOPPADDING",   (0, 0), (-1, -1), 0),
    ]))

    header = Table(
        [[brand_col, qr_block]],
        colWidths=[W - 2 * MARGIN - 36 * mm - 6, 36 * mm],
    )
    header.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), mid),
        ("LEFTPADDING",  (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 14),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [6]),
    ]))
    return header


# ═══════════════════════════════════════════════════════════════════════════════
# HOSPITAL FORM
# ═══════════════════════════════════════════════════════════════════════════════

def generate_hospital_form(output_path: str, management_model: str = "hospital-manager"):
    is_managed = management_model == "hospital-manager"
    model_label = "Multi-Specialty / Super-Specialty / Trust / Government" if is_managed \
                  else "Clinic / Nursing Home (Doctor-Owner)"

    dark, mid, accent, light, text_clr = HOSP_DARK, HOSP_MID, HOSP_ACCENT, HOSP_LIGHT, HOSP_TEXT
    styles = make_styles(dark, accent, text_clr)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=14*mm,   bottomMargin=14*mm,
        title="Likeson Healthcare — Hospital Registration Form",
        author="Likeson Healthcare",
    )

    story = []

    # ── HEADER ────────────────────────────────────────────────────────────────
    hdr = build_header(
        "Hospital Registration Form",
        f"Management Type: {model_label}",
        dark, mid, accent, light, styles,
        "https://likeson.in",
    )
    story.append(hdr)
    story.append(Spacer(0, 10))

    # ── INSTRUCTIONS ──────────────────────────────────────────────────────────
    instr = Table(
        [[Paragraph(
            "Please complete all fields marked with <b>*</b> (required). "
            "Write clearly in block letters. Attach self-attested copies of all documents. "
            "Submit this form to your assigned Likeson Healthcare representative.",
            styles["small"]
        )]],
        colWidths=[W - 2 * MARGIN],
    )
    instr.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), light),
        ("BOX",          (0, 0), (-1, -1), 0.5, accent),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
    ]))
    story.append(instr)
    story.append(Spacer(0, 8))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 1: HOSPITAL IDENTITY
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("1. Hospital Identity", styles, dark, accent))

    story.append(field_box(
        "Hospital Name", "Full legal name as per registration certificate", styles, required=True
    ))
    story.append(two_fields([
        ("Hospital Type", f"{'Select: Multi-Specialty / Super-Specialty / Trust / Government' if is_managed else 'Select: Clinic / Nursing Home'}", True),
        ("Established Year", "e.g. 2005", False),
    ], styles, dark))
    story.append(field_box(
        "Description / Tagline",
        "Brief summary of services (max 200 characters) — shown on patient-facing pages",
        styles, tall=True
    ))
    story.append(two_fields([
        ("Logo (attach image)", "JPG/PNG, min 200x200 px", False),
        ("Google Maps URL", "Paste direct Google Maps share link", False),
    ], styles, dark))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 2: CONTACT DETAILS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("2. Contact Details", styles, dark, accent))

    story.append(two_fields([
        ("Primary Phone *", "Include country code: +91XXXXXXXXXX", True),
        ("Emergency Phone", "24×7 emergency line (if different)", False),
    ], styles, dark))
    story.append(two_fields([
        ("Alternate Phone", "", False),
        ("WhatsApp Number", "", False),
    ], styles, dark))
    story.append(two_fields([
        ("Email Address", "Official hospital email", False),
        ("Website URL", "https://...", False),
    ], styles, dark))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 3: ADDRESS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("3. Address", styles, dark, accent))

    story.append(field_box("Address Line 1 *", "Building/plot number and street", styles, required=True))
    story.append(field_box("Address Line 2", "Area / Colony / Landmark", styles))
    story.append(two_fields([
        ("City *", "Default: Vijayawada", True),
        ("State *", "Default: Andhra Pradesh", True),
    ], styles, dark))
    story.append(two_fields([
        ("PIN Code *", "6-digit Indian PIN code", True),
        ("Landmark", "Nearest landmark for navigation", False),
    ], styles, dark))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 4: REGISTRATION & LEGAL
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("4. Registration & Legal Documents", styles, dark, accent))

    story.append(field_box(
        "License Number *",
        "Hospital registration/license number issued by state health authority — must be unique",
        styles, required=True
    ))
    story.append(two_fields([
        ("License Expiry Date", "DD / MM / YYYY", False),
        ("GST Number", "15-digit GSTIN (if applicable)", False),
    ], styles, dark))
    story.append(field_box(
        "PAN Number",
        "Format: AAAAA9999A — required for settlement payouts",
        styles
    ))
    story.append(field_box(
        "Document URL / Attachment",
        "Share a Google Drive / Dropbox link OR attach physical copy with this form",
        styles
    ))

    story.append(story.append(Spacer(0, 2)) or Spacer(0, 2))
    story.append(checkbox_row(
        ["NABH", "NABL", "JCI", "ISO", "AHPI", "Other"],
        "Accreditations (☑ all that apply)", styles, cols=6
    ))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 5: SERVICES & FACILITIES
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("5. Services & Facilities", styles, dark, accent))

    story.append(field_box(
        "Specialties Offered",
        "Comma-separated: Cardiology, Neurology, Orthopedics…",
        styles, tall=True
    ))
    story.append(field_box(
        "Facilities Available",
        "e.g. MRI, CT Scan, Blood Bank, Pharmacy, ICU, NICU…",
        styles, tall=True
    ))
    story.append(field_box(
        "Accepted Government Schemes",
        "e.g. PMJAY, Aarogyasri, ESI, CGHS, ECHS…",
        styles, tall=True
    ))

    story.append(two_fields([
        ("Total Bed Count", "Number of total beds", False),
        ("ICU Bed Count",   "Number of ICU/critical care beds", False),
    ], styles, dark))

    story.append(checkbox_row(
        ["Emergency Ready", "ICU", "Blood Bank", "Pharmacy", "Diagnostics/Lab",
         "Ambulance", "Wheelchair Access", "24×7 Operations", "NABL Lab Available"],
        "Facility Flags (☑ all that apply)", styles, cols=3
    ))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 6: OPERATING HOURS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("6. Operating Hours", styles, dark, accent))

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    oh_data = [
        [
            Paragraph("<b>Day</b>", styles["label"]),
            Paragraph("<b>Open Time</b>", styles["label"]),
            Paragraph("<b>Close Time</b>", styles["label"]),
            Paragraph("<b>24 Hrs?</b>", styles["label"]),
            Paragraph("<b>Closed?</b>", styles["label"]),
        ]
    ]
    for d in days:
        oh_data.append([
            Paragraph(d, styles["small"]),
            Paragraph("  :  ", styles["small"]),
            Paragraph("  :  ", styles["small"]),
            Paragraph("☐", styles["small"]),
            Paragraph("☐", styles["small"]),
        ])
    col_w = (W - 2 * MARGIN) / 5
    oh_t = Table(oh_data, colWidths=[col_w * 1.6, col_w * 1.1, col_w * 1.1, col_w * 0.6, col_w * 0.6])
    oh_t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), dark),
        ("TEXTCOLOR",    (0, 0), (-1, 0), colors.white),
        ("BACKGROUND",   (0, 1), (-1, -1), FIELD_BG),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [FIELD_BG, colors.white]),
        ("BOX",          (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ("INNERGRID",    (0, 0), (-1, -1), 0.3, BORDER_CLR),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("ALIGN",        (3, 0), (4, -1), "CENTER"),
    ]))
    story.append(oh_t)
    story.append(Spacer(0, 6))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 7: CONSULTATION PRICING (hospital-manager only)
    # ══════════════════════════════════════════════════════════════════════════
    if is_managed:
        story.append(section_header("7. Consultation Pricing  (Hospital-Manager Type)", styles, dark, accent))

        notice = Table(
            [[Paragraph(
                "⚠  For hospital-manager hospitals, ALL doctor consultation fees are set at "
                "the HOSPITAL level. Individual doctors cannot override these prices. "
                "The platform fee within this section is set/overridden by Superadmin only.",
                styles["small"]
            )]],
            colWidths=[W - 2 * MARGIN],
        )
        notice.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, -1), colors.HexColor("#fff4f4")),
            ("BOX",         (0, 0), (-1, -1), 0.5, accent),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",(0, 0), (-1, -1), 8),
            ("TOPPADDING",  (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
        ]))
        story.append(notice)
        story.append(Spacer(0, 6))

        price_data = [
            [
                Paragraph("<b>Consultation Type</b>", styles["label"]),
                Paragraph("<b>Charge to Patient (₹)</b>", styles["label"]),
                Paragraph("<b>Doctor Honorarium (₹)</b>", styles["label"]),
                Paragraph("<b>Offered?</b>", styles["label"]),
            ],
            ["In-Person", "", "", "☐"],
            ["Video / Tele", "", "", "☐"],
            ["Home Visit", "", "", "☐"],
        ]
        col_w4 = (W - 2 * MARGIN) / 4
        pt = Table(price_data, colWidths=[col_w4] * 4)
        pt.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), dark),
            ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
            ("BACKGROUND",    (0, 1), (-1, -1), FIELD_BG),
            ("ROWBACKGROUNDS",(0,1),(-1,-1), [FIELD_BG, colors.white]),
            ("BOX",           (0, 0), (-1, -1), 0.5, BORDER_CLR),
            ("INNERGRID",     (0, 0), (-1, -1), 0.3, BORDER_CLR),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("ALIGN",         (3, 0), (3, -1), "CENTER"),
        ]))
        story.append(pt)
        story.append(Spacer(0, 4))

        story.append(two_fields([
            ("Follow-Up Fee (₹)", "0 = free follow-up within validity window", False),
            ("Follow-Up Discount (%)", "e.g. 20 — % off from full fee", False),
        ], styles, dark))
        story.append(two_fields([
            ("Follow-Up Valid Days", "1–90 days after first consultation", False),
            ("Settlement Cycle", "Select: Weekly / Bi-weekly / Monthly", False),
        ], styles, dark))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 8: MANAGER DETAILS
    # ══════════════════════════════════════════════════════════════════════════
    sec_num = "8" if is_managed else "7"
    manager_title = "Hospital Manager Account Details" if is_managed else "Owner-Doctor Account Details"
    story.append(section_header(f"{sec_num}. {manager_title}", styles, dark, accent))

    manager_note = (
        "The account created here will have role 'hospital' and will manage this hospital. "
        "Login credentials will be emailed automatically."
    ) if is_managed else (
        "The account created here will have role 'doctor' and will own and manage this Clinic/Nursing Home. "
        "Pricing is set at the doctor profile level, not hospital level."
    )
    story.append(field_box("Full Name *", manager_note, styles, required=True))
    story.append(two_fields([
        ("Email Address *", "Login credentials will be sent here", True),
        ("Phone Number",    "+91XXXXXXXXXX", False),
    ], styles, dark))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 9: BANK & SETTLEMENT
    # ══════════════════════════════════════════════════════════════════════════
    sec_num2 = "9" if is_managed else "8"
    story.append(section_header(f"{sec_num2}. Bank & Settlement Details", styles, dark, accent))

    story.append(field_box("Account Holder Name *", "As per bank records", styles, required=True))
    story.append(two_fields([
        ("Bank Account Number *", "Will be masked after submission", True),
        ("IFSC Code *", "Format: ABCD0123456", True),
    ], styles, dark))
    story.append(two_fields([
        ("Bank Name",   "", False),
        ("Branch Name", "", False),
    ], styles, dark))
    story.append(two_fields([
        ("UPI ID", "Optional — for instant payouts", False),
        ("GST Number (Bank)", "If registered under GST", False),
    ], styles, dark))
    story.append(field_box(
        "Cancelled Cheque / Bank Document",
        "Attach scanned copy or share a secure URL",
        styles
    ))

    # ══════════════════════════════════════════════════════════════════════════
    # DECLARATION
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("Declaration & Signature", styles, dark, accent))

    decl = Table(
        [[Paragraph(
            "I / We hereby certify that the information provided in this form is true, "
            "accurate, and complete to the best of my / our knowledge. I authorise Likeson "
            "Healthcare to verify all details and documents submitted. I agree to the "
            "Likeson Healthcare Partner Terms & Conditions available at <b>likeson.in/terms</b>.",
            styles["small"]
        )]],
        colWidths=[W - 2 * MARGIN],
    )
    decl.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), light),
        ("BOX",          (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
    ]))
    story.append(decl)
    story.append(Spacer(0, 10))

    sig_data = [
        [
            Paragraph("<b>Authorised Signatory Name</b>", styles["label"]),
            Paragraph("<b>Designation</b>", styles["label"]),
            Paragraph("<b>Date</b>", styles["label"]),
        ],
        [Spacer(0, 24), Spacer(0, 24), Spacer(0, 24)],
        [
            Paragraph("<b>Signature</b>", styles["label"]),
            Paragraph("<b>Hospital Seal / Stamp</b>", styles["label"]),
            Paragraph("", styles["label"]),
        ],
        [Spacer(0, 30), Spacer(0, 30), Spacer(0, 0)],
    ]
    col_w3 = (W - 2 * MARGIN) / 3
    sig_t = Table(sig_data, colWidths=[col_w3] * 3)
    sig_t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), FIELD_BG),
        ("BOX",          (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ("INNERGRID",    (0, 0), (-1, -1), 0.3, BORDER_CLR),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, -1),(-1,-1), 5),
    ]))
    story.append(sig_t)
    story.append(Spacer(0, 12))

    # ── FOOTER ────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_CLR))
    story.append(Spacer(0, 5))
    story.append(Paragraph(
        "Likeson Healthcare  ·  likeson.in  ·  support@likeson.in  ·  "
        "Hospital Onboarding Form v1.0  ·  Management Model: " + management_model,
        styles["footer"]
    ))

    doc.build(story)
    print(f"[OK] Hospital form saved → {output_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# DOCTOR FORM
# ═══════════════════════════════════════════════════════════════════════════════

def generate_doctor_form(output_path: str, management_model: str = "doctor-owner"):
    is_owner = management_model == "doctor-owner"
    model_label = "Doctor-Owner (Clinic / Nursing Home)" if is_owner \
                  else "Hospital-Manager Affiliated Doctor"

    dark, mid, accent, light, text_clr = DOC_DARK, DOC_MID, DOC_ACCENT, DOC_LIGHT, DOC_TEXT
    styles = make_styles(dark, accent, text_clr)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=14*mm, bottomMargin=14*mm,
        title="Likeson Healthcare — Doctor Registration Form",
        author="Likeson Healthcare",
    )

    story = []

    # ── HEADER ────────────────────────────────────────────────────────────────
    hdr = build_header(
        "Doctor Registration Form",
        f"Affiliation Type: {model_label}",
        dark, mid, accent, light, styles,
        "https://likeson.in/doctor",
    )
    story.append(hdr)
    story.append(Spacer(0, 10))

    instr = Table(
        [[Paragraph(
            "Please complete all fields marked with <b>*</b>. Write in block letters. "
            "Attach self-attested copies of all certificates and KYC documents. "
            "Submit to your Likeson Healthcare representative or scan the QR code above to register online.",
            styles["small"]
        )]],
        colWidths=[W - 2 * MARGIN],
    )
    instr.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), light),
        ("BOX",          (0, 0), (-1, -1), 0.5, accent),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
    ]))
    story.append(instr)
    story.append(Spacer(0, 8))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 1: PERSONAL INFORMATION
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("1. Personal Information", styles, dark, accent))

    story.append(field_box("Full Name *", "As per government-issued ID (include Dr. prefix)", styles, required=True))
    story.append(two_fields([
        ("Email Address *", "Login credentials will be sent here", True),
        ("Phone Number",    "+91XXXXXXXXXX", False),
    ], styles, dark))
    story.append(two_fields([
        ("Date of Birth", "DD / MM / YYYY", False),
        ("Gender", "Select: Male / Female / Other / Prefer not to say", False),
    ], styles, dark))
    story.append(field_box(
        "Profile Photo",
        "JPG/PNG, min 400×400 px, professional photo on plain background",
        styles
    ))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 2: PROFESSIONAL CREDENTIALS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("2. Professional Credentials", styles, dark, accent))

    specs = ["General Physician", "Cardiologist", "Neurologist", "Pediatrician",
             "Oncologist", "Orthopedic Surgeon", "Gastroenterologist", "Gynecologist",
             "Dermatologist", "Urologist", "Psychiatry", "Physiotherapist"]
    story.append(checkbox_row(specs, "Specialization * (☑ one)", styles, cols=3))

    story.append(two_fields([
        ("Years of Experience *", "Post-qualification clinical experience in years", True),
        ("Registration Number", "MCI / State Medical Council registration number", False),
    ], styles, dark))
    story.append(field_box(
        "Registration Council",
        "e.g. Andhra Pradesh Medical Council, NMC — the council that issued your registration",
        styles
    ))

    # Qualifications table
    story.append(Paragraph("Qualifications (add rows as needed)", styles["label"]))
    story.append(Spacer(0, 3))
    q_data = [
        [
            Paragraph("<b>Degree</b>", styles["label"]),
            Paragraph("<b>College / University</b>", styles["label"]),
            Paragraph("<b>Year of Passing</b>", styles["label"]),
        ],
    ]
    for _ in range(4):
        q_data.append([Spacer(0, 18), Spacer(0, 18), Spacer(0, 18)])
    col_w3 = (W - 2 * MARGIN) / 3
    qt = Table(q_data, colWidths=[col_w3 * 0.8, col_w3 * 1.5, col_w3 * 0.7])
    qt.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), dark),
        ("TEXTCOLOR",    (0, 0), (-1, 0), colors.white),
        ("BACKGROUND",   (0, 1), (-1, -1), FIELD_BG),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [FIELD_BG, colors.white]),
        ("BOX",          (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ("INNERGRID",    (0, 0), (-1, -1), 0.3, BORDER_CLR),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, -1),(-1,-1), 5),
    ]))
    story.append(qt)
    story.append(Spacer(0, 6))

    story.append(field_box(
        "Biography / Professional Summary",
        "Max 1000 characters — shown to patients on your public profile",
        styles, tall=True
    ))

    story.append(field_box(
        "Languages Spoken",
        "Comma-separated: Telugu, English, Hindi…",
        styles
    ))
    story.append(field_box(
        "Achievements / Awards",
        "Notable recognitions, publications, research (comma-separated)",
        styles, tall=True
    ))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 3: HOSPITAL AFFILIATION
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("3. Hospital Affiliation", styles, dark, accent))

    if is_owner:
        hosp_note = (
            "As a Doctor-Owner, you will manage your own Clinic / Nursing Home. "
            "List the hospital(s) you own or operate. Pricing is set at YOUR doctor profile level."
        )
    else:
        hosp_note = (
            "As a Hospital-Manager-affiliated doctor, your consultation fees are set by the hospital. "
            "List your primary hospital and any additional hospitals where you practice."
        )

    story.append(field_box(
        "Primary Hospital *",
        hosp_note,
        styles, required=True
    ))
    story.append(field_box(
        "Other Hospital(s)",
        "Comma-separated hospital names / IDs where you also practice",
        styles
    ))

    story.append(checkbox_row(
        ["In-Person Consultation", "Video / Tele Consultation", "Home Visit"],
        "Consultation Types Offered (☑ all that apply)", styles, cols=3
    ))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 4: CONSULTATION FEES (doctor-owner only)
    # ══════════════════════════════════════════════════════════════════════════
    if is_owner:
        story.append(section_header("4. Consultation Fees  (Doctor-Owner — You Control Pricing)", styles, dark, accent))

        notice_o = Table(
            [[Paragraph(
                "⚠  These fees apply because you are a Doctor-Owner (Clinic / Nursing Home). "
                "For doctors affiliated to hospital-manager hospitals, fees are set by the hospital — skip this section.",
                styles["small"]
            )]],
            colWidths=[W - 2 * MARGIN],
        )
        notice_o.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, -1), colors.HexColor("#f0fff8")),
            ("BOX",         (0, 0), (-1, -1), 0.5, accent),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",(0, 0), (-1, -1), 8),
            ("TOPPADDING",  (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
        ]))
        story.append(notice_o)
        story.append(Spacer(0, 6))

        fee_data = [
            [
                Paragraph("<b>Consultation Type</b>", styles["label"]),
                Paragraph("<b>Fee (₹)</b>", styles["label"]),
            ],
            ["In-Person Fee", ""],
            ["Video / Tele Fee", ""],
            ["Home Visit Fee", ""],
            ["Follow-Up Fee (0 = free)", ""],
        ]
        col_wf = (W - 2 * MARGIN) / 2
        ft = Table(fee_data, colWidths=[col_wf, col_wf])
        ft.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), dark),
            ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
            ("BACKGROUND",    (0, 1), (-1, -1), FIELD_BG),
            ("ROWBACKGROUNDS",(0,1),(-1,-1), [FIELD_BG, colors.white]),
            ("BOX",           (0, 0), (-1, -1), 0.5, BORDER_CLR),
            ("INNERGRID",     (0, 0), (-1, -1), 0.3, BORDER_CLR),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(ft)
        story.append(Spacer(0, 4))
        story.append(two_fields([
            ("Follow-Up Discount (%)", "e.g. 20 — % off from full fee (0–100)", False),
            ("Follow-Up Valid Days",   "1–90 days after first consultation", False),
        ], styles, dark))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 5: WEEKLY AVAILABILITY
    # ══════════════════════════════════════════════════════════════════════════
    sec_n = "5" if is_owner else "4"
    story.append(section_header(f"{sec_n}. Weekly Availability", styles, dark, accent))

    story.append(Paragraph(
        "Fill time slots in 24-hour format (e.g. 09:00 – 13:00). "
        "Add multiple slots per day separated by commas. "
        "Both hospital-manager and doctor-owner doctors control their own availability.",
        styles["note"]
    ))
    story.append(Spacer(0, 4))

    days_avail = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    av_data = [
        [
            Paragraph("<b>Day</b>", styles["label"]),
            Paragraph("<b>Available?</b>", styles["label"]),
            Paragraph("<b>Slot 1 (HH:MM – HH:MM)</b>", styles["label"]),
            Paragraph("<b>Slot 2</b>", styles["label"]),
            Paragraph("<b>Max Patients / Slot</b>", styles["label"]),
        ]
    ]
    for d in days_avail:
        av_data.append([
            Paragraph(d, styles["small"]),
            Paragraph("☐ Yes  ☐ No", styles["small"]),
            Spacer(0, 16),
            Spacer(0, 16),
            Spacer(0, 16),
        ])
    col_ws = [(W - 2 * MARGIN) * p for p in [0.18, 0.14, 0.26, 0.22, 0.20]]
    av_t = Table(av_data, colWidths=col_ws)
    av_t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), dark),
        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
        ("BACKGROUND",    (0, 1), (-1, -1), FIELD_BG),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [FIELD_BG, colors.white]),
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, BORDER_CLR),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, -1),(-1,-1), 4),
    ]))
    story.append(av_t)
    story.append(Spacer(0, 6))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 6: KYC DOCUMENTS
    # ══════════════════════════════════════════════════════════════════════════
    sec_n2 = "6" if is_owner else "5"
    story.append(section_header(f"{sec_n2}. KYC Documents", styles, dark, accent))

    story.append(two_fields([
        ("Aadhaar Number", "12-digit — will be masked after submission", False),
        ("PAN Number", "Format: AAAAA9999A", False),
    ], styles, dark))
    story.append(two_fields([
        ("Aadhaar Front Side URL / Attachment", "", False),
        ("Aadhaar Back Side URL / Attachment",  "", False),
    ], styles, dark))
    story.append(field_box(
        "PAN Card URL / Attachment",
        "Self-attested copy required for settlement payout processing",
        styles
    ))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 7: BANK DETAILS
    # ══════════════════════════════════════════════════════════════════════════
    sec_n3 = "7" if is_owner else "6"
    story.append(section_header(f"{sec_n3}. Bank & Settlement Details", styles, dark, accent))

    story.append(field_box("Account Holder Name *", "Exactly as per bank records", styles, required=True))
    story.append(two_fields([
        ("Bank Account Number *", "Will be masked — only last 4 digits stored", True),
        ("IFSC Code *", "Format: ABCD0123456", True),
    ], styles, dark))
    story.append(two_fields([
        ("Bank Name",   "", False),
        ("Branch Name", "", False),
    ], styles, dark))
    story.append(two_fields([
        ("UPI ID",       "Optional — for instant payouts", False),
        ("GST Number",   "If applicable", False),
    ], styles, dark))
    story.append(field_box(
        "Cancelled Cheque / Bank Document",
        "Attach scanned copy or provide a secure document URL",
        styles
    ))
    story.append(two_fields([
        ("Settlement Cycle", "Select: Weekly / Bi-weekly / Monthly", False),
        ("Partnership Status", "Admin will set — Pending / Active", False),
    ], styles, dark))

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 8: CONTACT PERSON
    # ══════════════════════════════════════════════════════════════════════════
    sec_n4 = "8" if is_owner else "7"
    story.append(section_header(f"{sec_n4}. Emergency / Contact Person", styles, dark, accent))

    story.append(field_box(
        "Contact Person Name",
        "Administrative contact (clinic manager, PA, or family member)", styles
    ))
    story.append(two_fields([
        ("Designation", "e.g. Clinic Manager, Personal Assistant", False),
        ("Phone Number", "", False),
    ], styles, dark))
    story.append(field_box("Contact Person Email", "", styles))

    # ══════════════════════════════════════════════════════════════════════════
    # DECLARATION
    # ══════════════════════════════════════════════════════════════════════════
    story.append(section_header("Declaration & Signature", styles, dark, accent))

    decl = Table(
        [[Paragraph(
            "I hereby certify that all information provided is accurate and complete. "
            "I authorise Likeson Healthcare to verify my credentials and documents. "
            "I agree to the Likeson Healthcare Doctor Partner Terms & Conditions at "
            "<b>likeson.in/terms</b> and consent to the Privacy Policy at <b>likeson.in/privacy</b>.",
            styles["small"]
        )]],
        colWidths=[W - 2 * MARGIN],
    )
    decl.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), light),
        ("BOX",          (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
    ]))
    story.append(decl)
    story.append(Spacer(0, 10))

    sig_data = [
        [
            Paragraph("<b>Doctor Full Name</b>", styles["label"]),
            Paragraph("<b>Date</b>", styles["label"]),
            Paragraph("<b>Place</b>", styles["label"]),
        ],
        [Spacer(0, 22), Spacer(0, 22), Spacer(0, 22)],
        [
            Paragraph("<b>Signature with Stamp</b>", styles["label"]),
            Paragraph("", styles["label"]),
            Paragraph("", styles["label"]),
        ],
        [Spacer(0, 30), Spacer(0, 0), Spacer(0, 0)],
    ]
    col_w3 = (W - 2 * MARGIN) / 3
    sig_t = Table(sig_data, colWidths=[col_w3] * 3)
    sig_t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), FIELD_BG),
        ("BOX",          (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ("INNERGRID",    (0, 0), (-1, -1), 0.3, BORDER_CLR),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, -1),(-1,-1), 5),
    ]))
    story.append(sig_t)
    story.append(Spacer(0, 12))

    # ── FOOTER ────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_CLR))
    story.append(Spacer(0, 5))
    story.append(Paragraph(
        "Likeson Healthcare  ·  likeson.in  ·  support@likeson.in  ·  "
        "Doctor Onboarding Form v1.0  ·  Affiliation: " + management_model,
        styles["footer"]
    ))

    doc.build(story)
    print(f"[OK] Doctor form saved → {output_path}")


# ─── ENTRY POINT ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    generate_hospital_form("/home/claude/hospital_form_managed.pdf",   "hospital-manager")
    generate_hospital_form("/home/claude/hospital_form_owner.pdf",     "doctor-owner")
    generate_doctor_form("/home/claude/doctor_form_owner.pdf",         "doctor-owner")
    generate_doctor_form("/home/claude/doctor_form_affiliated.pdf",    "hospital-manager")
    print("All forms generated successfully.")