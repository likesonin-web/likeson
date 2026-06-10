/**
 * generateEPrescriptionPdf.js
 * Likeson Healthcare — ePrescription PDF Generator (Node.js / PDFKit)
 *
 * Production-grade | Auto-Pagination | Dynamic Fonts & Validity
 */

import PDFDocument from 'pdfkit';
import QRCode      from 'qrcode';
import fs          from 'fs';
import path        from 'path';

// ─── Poppins font paths (Graceful Fallback) ───────────────────────────────────
const FONT_DIR = '/usr/share/fonts/truetype/google-fonts';
const FONTS = {
  Regular: `${FONT_DIR}/Poppins-Regular.ttf`,
  Bold:    `${FONT_DIR}/Poppins-Bold.ttf`,
  Medium:  `${FONT_DIR}/Poppins-Medium.ttf`,
  Light:   `${FONT_DIR}/Poppins-Light.ttf`,
  Italic:  `${FONT_DIR}/Poppins-Italic.ttf`,
};

const hasPoppins = fs.existsSync(FONTS.Regular);
const F = {
  Regular: hasPoppins ? FONTS.Regular : 'Helvetica',
  Bold:    hasPoppins ? FONTS.Bold    : 'Helvetica-Bold',
  Medium:  hasPoppins ? FONTS.Medium  : 'Helvetica-Bold',
  Light:   hasPoppins ? FONTS.Light   : 'Helvetica',
  Italic:  hasPoppins ? FONTS.Italic  : 'Helvetica-Oblique',
};

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary:    '#0B2E5E',
  accent:     '#1A56DB',
  accentLight:'#EBF2FF',
  teal:       '#0D9488',
  tealLight:  '#F0FDFA',
  red:        '#DC2626',
  redLight:   '#FEF2F2',
  green:      '#15803D',
  greenLight: '#F0FDF4',
  amber:      '#B45309',
  amberLight: '#FFFBEB',
  dark:       '#111827',
  slate:      '#374151',
  muted:      '#6B7280',
  border:     '#E5E7EB',
  light:      '#F9FAFB',
  white:      '#FFFFFF',
  blueDark:   '#1E3A5F',
  blueFaint:  '#93C5FD',
  bluePale:   '#64A8F8',
  rowAlt:     '#F3F6FB',
};

// ─── Layout Constants ─────────────────────────────────────────────────────────
const W  = 595.28;
const H  = 841.89;
const ML = 28;
const MR = 28;
const CW = W - ML - MR;
const FOOTER_H = 32;

// ─── Primitives ───────────────────────────────────────────────────────────────
const fillRect = (doc, x, y, w, h, color) =>
  doc.save().rect(x, y, w, h).fill(color).restore();

const strokeRect = (doc, x, y, w, h, color, lw = 0.5) =>
  doc.save().lineWidth(lw).rect(x, y, w, h).stroke(color).restore();

const filledStrokedRect = (doc, x, y, w, h, fill, stroke, lw = 0.5) =>
  doc.save().lineWidth(lw).rect(x, y, w, h).fillAndStroke(fill, stroke).restore();

const hLine = (doc, y, x1 = ML, x2 = W - MR, color = C.border, lw = 0.5) =>
  doc.save().lineWidth(lw).moveTo(x1, y).lineTo(x2, y).stroke(color).restore();

const vLine = (doc, x, y1, y2, color = C.border, lw = 0.5) =>
  doc.save().lineWidth(lw).moveTo(x, y1).lineTo(x, y2).stroke(color).restore();

const txt = (doc, text, x, y, {
  font = F.Regular, size = 8, color = C.dark,
  align = 'left', width, lineBreak = false
} = {}) => {
  doc.font(font).fontSize(size).fillColor(color);
  const opts = { align, lineBreak };
  if (width != null) opts.width = width;
  doc.text(String(text ?? '—'), x, y, opts);
};

const sectionBar = (doc, y, label, {
  bg = C.primary, fg = C.white, h = 17, iconText = null
} = {}) => {
  fillRect(doc, ML, y, CW, h, bg);
  const lx = ML + 10;
  txt(doc, label, lx, y + (h / 2) - 4.5, { font: F.Bold, size: 7.5, color: fg });
  return y + h;
};

// ─── Formatting ───────────────────────────────────────────────────────────────
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    }) + ' IST'
  : '—';

const fmtFreq = (f) => ({
  OD: 'Once Daily', BD: 'Twice Daily', TDS: 'Thrice Daily',
  QID: '4x Daily', SOS: 'As Needed', HS: 'Bedtime',
  AC: 'Before Meals', PC: 'After Meals',
  STAT: 'Immediately', Weekly: 'Weekly', Monthly: 'Monthly',
  'As Directed': 'As Directed',
}[f] || f || '—');

const generateQR = async (data) =>
  QRCode.toBuffer(data, {
    type: 'png', width: 120, margin: 1,
    color: { dark: '#0B2E5E', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });

const checkPageBreak = (doc, y, neededHeight) => {
  if (y + neededHeight > H - FOOTER_H - 20) {
    doc.addPage();
    return 20;
  }
  return y;
};

// ─── MAIN GENERATOR ───────────────────────────────────────────────────────────
const generateEPrescriptionPdf = async (rx) => {
  const d    = rx.doctor   || {};
  const p    = rx.patient  || {};
  const h    = rx.hospital || {};
  const v    = rx.vitals   || {};
  const meds = rx.medicines || [];
  const labs = rx.labTests  || [];

  const issuedAt  = rx.issuedAt ? new Date(rx.issuedAt) : new Date();
  const followUp  = rx.followUpDate ? new Date(rx.followUpDate) : null;
  const expiresAt = rx.expiresAt
    ? new Date(rx.expiresAt)
    : new Date(issuedAt.getTime() + 30 * 864e5);
  const validityLabel = `Valid till: ${fmtDate(followUp || expiresAt)}`;

  const verifyUrl = `${process.env.FRONTEND_URL || 'https://likeson.in'}/rx/verify/${rx.rxNumber}`;
  const qrBuf = await generateQR(verifyUrl);

  // ── Pre-fetch signature BEFORE entering Promise (no await inside Promise) ──
  let sigBuffer = null;
  let sigLoaded = false;

  if (d.doctorSignature) {
    try {
      if (typeof d.doctorSignature === 'string' && d.doctorSignature.startsWith('http')) {
        const res = await fetch(d.doctorSignature);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          sigBuffer = Buffer.from(arrayBuffer);
          sigLoaded = true;
        }
      } else {
        // Local path or Buffer already
        sigBuffer = d.doctorSignature;
        sigLoaded = true;
      }
    } catch (err) {
      console.error('[PDF Generation] Failed to pre-fetch signature image:', err.message);
    }
  }

  // ── Everything from here is synchronous inside Promise ──
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: ML, right: MR },
        info: {
          Title:  `ePrescription ${rx.rxNumber}`,
          Author: d.name || 'Likeson Healthcare',
        },
        bufferPages: true,
      });

      if (hasPoppins) {
        for (const [variant, fontPath] of Object.entries(FONTS)) {
          if (fs.existsSync(fontPath)) doc.registerFont(`Poppins-${variant}`, fontPath);
        }
        doc.registerFont('Poppins', FONTS.Regular);
      }

      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = 0;

      // ════════════════════════════════════════════════════════════════════
      // 1. HEADER
      // ════════════════════════════════════════════════════════════════════
      const HDR_H = 72;
      fillRect(doc, 0, 0, W, HDR_H, C.primary);

      txt(doc, 'LIKESON', ML, 13, { font: F.Bold, size: 21, color: C.white });
      txt(doc, 'HEALTHCARE', ML, 33, { font: F.Regular, size: 8.5, color: C.blueFaint });
      txt(doc, 'Digital ePrescription', ML, 47, { font: F.Light, size: 7, color: C.bluePale });

      vLine(doc, ML + 148, 10, 62, '#2a4a7f', 0.7);

      txt(doc, 'Rx', ML + 158, 12, { font: F.Bold, size: 26, color: C.blueFaint });
      txt(doc, 'PRESCRIPTION', ML + 194, 17, { font: F.Bold, size: 13.5, color: C.white });
      txt(doc, 'Electronically generated — Likeson Healthcare', ML + 194, 33, { font: F.Light, size: 7, color: C.blueFaint });
      txt(doc, validityLabel, ML + 194, 44, { font: F.Light, size: 7, color: C.bluePale });

      const bx = W - MR - 128;
      fillRect(doc, bx, 7, 128, 58, '#0f3875');
      strokeRect(doc, bx, 7, 128, 58, '#2a4a7f', 0.5);
      txt(doc, 'PRESCRIPTION ID', bx + 8, 13, { font: F.Bold, size: 6.5, color: C.blueFaint, width: 112 });
      txt(doc, rx.rxNumber || '—', bx + 8, 24, { font: F.Bold, size: 9.5, color: C.white, width: 112 });
      hLine(doc, 39, bx + 8, bx + 120, '#2a4a7f', 0.4);
      txt(doc, `Issued: ${fmtDate(issuedAt)}`,  bx + 8, 43, { font: F.Light, size: 6.5, color: C.blueFaint, width: 112 });
      txt(doc, validityLabel,                   bx + 8, 54, { font: F.Light, size: 6.5, color: C.bluePale, width: 112 });

      y = HDR_H + 5;

      const status = rx.status || 'issued';
      if (status !== 'issued') {
        const sc = { cancelled: C.red, expired: C.amber, dispensed: C.green }[status] || C.muted;
        fillRect(doc, 0, y, W, 17, sc);
        txt(doc,
          `STATUS: ${status.toUpperCase()}${rx.cancelReason ? `  —  ${rx.cancelReason}` : ''}`,
          0, y + 4.5,
          { font: F.Bold, size: 7.5, color: C.white, align: 'center', width: W }
        );
        y += 21;
      }

      // ════════════════════════════════════════════════════════════════════
      // 2. DOCTOR + PATIENT PANELS
      // ════════════════════════════════════════════════════════════════════
      const colW  = (CW - 8) / 2;
      const col2X = ML + colW + 8;
      const INFO_H = 108;

      filledStrokedRect(doc, ML, y, colW, INFO_H, C.light, C.border, 0.5);
      fillRect(doc, ML, y, colW, 5, C.primary);

      txt(doc, 'PRESCRIBING DOCTOR', ML + 8, y + 9,  { font: F.Medium, size: 6.5, color: C.muted });
      txt(doc, d.name || '—',         ML + 8, y + 20, { font: F.Bold, size: 11, color: C.primary, width: colW - 16 });

      const quals = [d.qualifications, d.specialization].filter(Boolean).join('  •  ');
      if (quals) txt(doc, quals, ML + 8, y + 34, { font: F.Regular, size: 7.5, color: C.slate, width: colW - 16 });

      let dY = y + 48;
      if (d.registrationNumber) {
        txt(doc, `Reg. No: ${d.registrationNumber}${d.registrationCouncil ? ` (${d.registrationCouncil})` : ''}`,
          ML + 8, dY, { font: F.Light, size: 7, color: C.muted });
        dY += 12;
      }
      const contact = [d.phone, d.email].filter(Boolean).join('  |  ');
      if (contact) {
        txt(doc, contact, ML + 8, dY, { font: F.Light, size: 7, color: C.muted });
        dY += 12;
      }
      if (h.name) {
        hLine(doc, dY + 2, ML + 6, ML + colW - 6, C.border, 0.4);
        dY += 7;
        txt(doc, h.name, ML + 8, dY, { font: F.Bold, size: 7.5, color: C.accent });
        dY += 11;
        if (h.address) txt(doc, h.address, ML + 8, dY, { font: F.Light, size: 6.5, color: C.muted });
      }

      filledStrokedRect(doc, col2X, y, colW, INFO_H, C.light, C.border, 0.5);
      fillRect(doc, col2X, y, colW, 5, C.teal);

      txt(doc, 'PATIENT DETAILS', col2X + 8, y + 9,  { font: F.Medium, size: 6.5, color: C.muted });
      txt(doc, p.name || '—',      col2X + 8, y + 20, { font: F.Bold, size: 11, color: C.primary, width: colW - 16 });

      const patMeta = [
        p.age        ? `Age: ${p.age}`        : null,
        p.gender     ? p.gender               : null,
        p.bloodGroup ? `BG: ${p.bloodGroup}`  : null,
        p.weight     ? `Wt: ${p.weight}`      : null,
      ].filter(Boolean);
      if (patMeta.length)
        txt(doc, patMeta.join('   •   '), col2X + 8, y + 34, { font: F.Regular, size: 7.5, color: C.slate });

      let pY = y + 48;
      if (p.phone) {
        txt(doc, `Ph: ${p.phone}`, col2X + 8, pY, { font: F.Light, size: 7, color: C.muted });
        pY += 12;
      }

      const allergies = Array.isArray(p.allergies)
        ? p.allergies
        : (p.allergies ? [p.allergies] : []);
      if (allergies.length) {
        fillRect(doc, col2X + 6, pY, colW - 12, 14, C.redLight);
        txt(doc, `Allergies: ${allergies.join(', ')}`,
          col2X + 10, pY + 3,
          { font: F.Bold, size: 7, color: C.red, width: colW - 20 }
        );
        pY += 17;
      }

      const vFields = [
        v.bloodPressure ? `BP: ${v.bloodPressure}` : null,
        v.pulseRate     ? `Pulse: ${v.pulseRate}`   : null,
        v.temperature   ? `Temp: ${v.temperature}C` : null,
        v.spO2          ? `SpO2: ${v.spO2}%`        : null,
      ].filter(Boolean);
      if (vFields.length && pY < y + INFO_H - 14) {
        hLine(doc, pY + 2, col2X + 6, col2X + colW - 6, C.border, 0.4);
        pY += 7;
        txt(doc, vFields.join('   '), col2X + 8, pY, { font: F.Light, size: 6.5, color: C.muted });
      }

      y += INFO_H + 9;

      // ════════════════════════════════════════════════════════════════════
      // 3. CLINICAL DETAILS
      // ════════════════════════════════════════════════════════════════════
      const clinRows = [
        rx.chiefComplaints?.length ? ['Chief Complaints', rx.chiefComplaints.join(', ')] : null,
        rx.diagnosis ? ['Diagnosis', rx.diagnosisCode ? `${rx.diagnosis}  (ICD-10: ${rx.diagnosisCode})` : rx.diagnosis] : null,
        rx.clinicalFindings ? ['Clinical Findings', rx.clinicalFindings] : null,
      ].filter(Boolean);

      if (clinRows.length) {
        y = checkPageBreak(doc, y, clinRows.length * 16 + 26);
        y = sectionBar(doc, y, 'CLINICAL DETAILS');
        const blockH = clinRows.length * 16 + 5;
        filledStrokedRect(doc, ML, y, CW, blockH, C.white, C.border, 0.4);
        clinRows.forEach(([lbl, val], i) => {
          const ry = y + 5 + i * 16;
          if (i > 0) hLine(doc, ry - 1, ML + 4, ML + CW - 4, C.border, 0.3);
          txt(doc, lbl, ML + 8,  ry + 1, { font: F.Medium, size: 7, color: C.muted, width: 114 });
          txt(doc, val, ML + 124, ry + 1, { font: F.Regular, size: 7.5, color: C.dark, width: CW - 132 });
        });
        y += blockH + 7;
      }

      // ════════════════════════════════════════════════════════════════════
      // 4. MEDICINES TABLE
      // ════════════════════════════════════════════════════════════════════
      y = checkPageBreak(doc, y, 60);
      y = sectionBar(doc, y, 'PRESCRIBED MEDICINES');

      txt(doc, `${meds.length} medication${meds.length !== 1 ? 's' : ''}`,
        ML, y - 12.5,
        { font: F.Light, size: 7, color: C.blueFaint, align: 'right', width: CW - 8 }
      );

      if (meds.length === 0) {
        fillRect(doc, ML, y, CW, 26, C.light);
        txt(doc, 'No medicines prescribed.', ML, y + 9,
          { font: F.Light, size: 8.5, color: C.muted, align: 'center', width: CW }
        );
        y += 30;
      } else {
        const BASE_COLS = [
          ['#',         18],
          ['Medicine',  144],
          ['Dose',       50],
          ['Frequency',  76],
          ['Days',       32],
          ['Timing',     64],
          ['Route',      46],
          ['Qty',        28],
        ];
        const takenW = BASE_COLS.reduce((s, c) => s + c[1], 0);
        const COLS   = [...BASE_COLS, ['Sub?', CW - takenW]];

        let cx = ML;
        const COL_X = COLS.map(([, w]) => { const x = cx; cx += w; return x; });

        const TH = 14;
        fillRect(doc, ML, y, CW, TH, C.blueDark);
        COLS.forEach(([lbl, w], i) => {
          txt(doc, lbl, COL_X[i] + 3, y + 3.5,
            { font: F.Bold, size: 6.5, color: '#94A3B8', width: w - 6 }
          );
        });
        y += TH;

        meds.forEach((med, idx) => {
          const hasGeneric = med.genericName && med.genericName !== med.medicineName;
          const hasInstr   = !!med.instructions;
          const ROW_H = 20 + (hasGeneric ? 11 : 0) + (hasInstr ? 11 : 0);

          y = checkPageBreak(doc, y, ROW_H + 2);

          fillRect(doc, ML, y, CW, ROW_H, idx % 2 === 0 ? C.white : C.rowAlt);

          txt(doc, String(idx + 1), COL_X[0] + 3, y + 6,
            { font: F.Regular, size: 7, color: C.muted, width: COLS[0][1] - 6 }
          );

          txt(doc, med.medicineName || '—', COL_X[1] + 3, y + 5,
            { font: F.Bold, size: 8.5, color: C.dark, width: COLS[1][1] - 6, lineBreak: false }
          );
          if (hasGeneric) {
            txt(doc, med.genericName, COL_X[1] + 3, y + 16,
              { font: F.Light, size: 6.5, color: C.muted, width: COLS[1][1] - 6, lineBreak: false }
            );
          }

          txt(doc, med.dosage || '—', COL_X[2] + 3, y + 6,
            { font: F.Regular, size: 7.5, color: C.dark, width: COLS[2][1] - 6 }
          );

          txt(doc, fmtFreq(med.frequency), COL_X[3] + 3, y + 6,
            { font: F.Bold, size: 7.5, color: C.accent, width: COLS[3][1] - 6 }
          );

          txt(doc, med.durationDays ? `${med.durationDays}d` : 'PRN', COL_X[4] + 3, y + 6,
            { font: F.Regular, size: 7.5, color: C.slate, width: COLS[4][1] - 6 }
          );

          txt(doc, med.timing || '—', COL_X[5] + 3, y + 6,
            { font: F.Light, size: 7, color: C.slate, width: COLS[5][1] - 6 }
          );

          txt(doc, med.route || 'Oral', COL_X[6] + 3, y + 6,
            { font: F.Light, size: 7, color: C.slate, width: COLS[6][1] - 6 }
          );

          txt(doc, med.quantity != null ? String(med.quantity) : '—', COL_X[7] + 3, y + 6,
            { font: F.Bold, size: 7.5, color: C.dark, width: COLS[7][1] - 6 }
          );

          if (med.isSubstitutable === false) {
            filledStrokedRect(doc, COL_X[8] + 2, y + 4, COLS[8][1] - 4, 11, C.redLight, C.red + '44', 0.4);
            txt(doc, 'DAW', COL_X[8] + 5, y + 6.5,
              { font: F.Bold, size: 6.5, color: C.red, width: COLS[8][1] - 9 }
            );
          } else {
            txt(doc, 'OK', COL_X[8] + 5, y + 6.5,
              { font: F.Bold, size: 7, color: C.green, width: COLS[8][1] - 9 }
            );
          }

          if (hasInstr) {
            const instrY = y + 5 + (hasGeneric ? 22 : 11);
            txt(doc, `  ${med.instructions}`, COL_X[1] + 3, instrY,
              { font: F.Italic || F.Light, size: 6.5, color: C.muted, width: CW - COL_X[1] + ML - 6 }
            );
          }

          hLine(doc, y + ROW_H, ML, ML + CW, C.border, 0.3);
          y += ROW_H;
        });
      }

      y += 8;

      // ════════════════════════════════════════════════════════════════════
      // 5. LAB TESTS
      // ════════════════════════════════════════════════════════════════════
      if (labs.length) {
        y = checkPageBreak(doc, y, labs.length * 18 + 32);
        y = sectionBar(doc, y, `LAB TESTS ORDERED  (${labs.length})`, { bg: C.blueDark });

        const urgColor = (u) => ({ stat: C.red, urgent: C.amber, routine: C.green }[u?.toLowerCase()] || C.green);

        const LAB_NAME_W  = CW * 0.52;
        const LAB_URG_X   = ML + LAB_NAME_W + 8;
        const LAB_URG_W   = 54;
        const LAB_INSTR_X = LAB_URG_X + LAB_URG_W + 6;
        const LAB_INSTR_W = CW - LAB_NAME_W - LAB_URG_W - 22;

        labs.forEach((lt, i) => {
          const rowH = 18;
          fillRect(doc, ML, y, CW, rowH, i % 2 === 0 ? C.white : C.rowAlt);

          txt(doc, `${i + 1}.  ${lt.testName}${lt.testCode ? `  (${lt.testCode})` : ''}`,
            ML + 8, y + 5,
            { font: F.Bold, size: 8, color: C.dark, width: LAB_NAME_W - 8 }
          );

          const urg = (lt.urgency || 'routine').toUpperCase();
          txt(doc, urg, LAB_URG_X, y + 5,
            { font: F.Bold, size: 7, color: urgColor(lt.urgency), width: LAB_URG_W }
          );

          if (lt.instructions) {
            txt(doc, lt.instructions, LAB_INSTR_X, y + 5,
              { font: F.Light, size: 7, color: C.muted, width: LAB_INSTR_W }
            );
          }

          hLine(doc, y + rowH, ML, ML + CW, C.border, 0.3);
          y += rowH;
        });
        y += 7;
      }

      // ════════════════════════════════════════════════════════════════════
      // 6. INSTRUCTIONS & FOLLOW-UP
      // ════════════════════════════════════════════════════════════════════
      const hasAdvice = rx.advice || rx.referralNote || rx.followUpDate || rx.followUpInstructions;
      if (hasAdvice) {
        y = checkPageBreak(doc, y, 70);
        y = sectionBar(doc, y, 'INSTRUCTIONS & FOLLOW-UP', { bg: C.blueDark });
        y += 4;

        const PILL_H = 19;

        if (rx.advice) {
          filledStrokedRect(doc, ML, y, CW, PILL_H, C.accentLight, '#BFDBFE', 0.5);
          txt(doc, 'Advice', ML + 8, y + 5.5,  { font: F.Bold, size: 7, color: C.accent, width: 50 });
          txt(doc, rx.advice, ML + 62, y + 5.5, { font: F.Regular, size: 7.5, color: C.dark, width: CW - 72 });
          y += PILL_H + 3;
        }
        if (rx.referralNote) {
          filledStrokedRect(doc, ML, y, CW, PILL_H, C.amberLight, '#FDE68A', 0.5);
          txt(doc, 'Referral', ML + 8, y + 5.5,    { font: F.Bold, size: 7, color: C.amber, width: 50 });
          txt(doc, rx.referralNote, ML + 62, y + 5.5, { font: F.Regular, size: 7.5, color: C.dark, width: CW - 72 });
          y += PILL_H + 3;
        }
        if (rx.followUpDate || rx.followUpInstructions) {
          filledStrokedRect(doc, ML, y, CW, PILL_H, C.greenLight, '#BBF7D0', 0.5);
          txt(doc, 'Follow-Up', ML + 8, y + 5.5, { font: F.Bold, size: 7, color: C.green, width: 56 });
          const fuText = [
            rx.followUpDate ? fmtDate(rx.followUpDate) : null,
            rx.followUpInstructions || null,
          ].filter(Boolean).join('  —  ');
          txt(doc, fuText, ML + 68, y + 5.5, { font: F.Regular, size: 7.5, color: C.dark, width: CW - 78 });
          y += PILL_H + 3;
        }
        y += 6;
      }

      // ════════════════════════════════════════════════════════════════════
      // 7. SECURITY SECTION
      // ════════════════════════════════════════════════════════════════════
      const SEC_H = 100;
      const minSecY = FOOTER_H + SEC_H + 20;

      if (y < H - minSecY - 18) y = H - minSecY - 18;
      if (y + SEC_H + 18 + FOOTER_H > H) {
        doc.addPage();
        y = H - minSecY - 18;
      }

      y = sectionBar(doc, y, 'AUTHENTICITY & SECURITY', { bg: C.blueDark });
      txt(doc, 'Verify at likeson.in/rx/verify', ML, y - 13,
        { font: F.Light, size: 7, color: C.bluePale, align: 'right', width: CW - 8 }
      );

      filledStrokedRect(doc, ML, y, CW, SEC_H, C.light, C.border, 0.5);

      const sigW   = CW * 0.29;
      const detW   = CW * 0.38;
      const qrSecW = CW - sigW - detW;
      const sigX   = ML + 8;
      const detX   = ML + sigW + 10;
      const qrSecX = ML + sigW + detW + 8;

      // ── Signature box ──
      txt(doc, 'DOCTOR SIGNATURE', sigX, y + 9, { font: F.Bold, size: 6.5, color: C.muted });
      const sigBoxY = y + 20;
      const sigBoxH = 46;
      const sigBoxW = sigW - 10;

      fillRect(doc, sigX, sigBoxY, sigBoxW, sigBoxH, C.white);

      // ── Use pre-fetched sigBuffer (NO await here) ──
      let imageLoaded = false;
      if (sigLoaded && sigBuffer) {
        try {
          doc.image(sigBuffer, sigX + 3, sigBoxY + 3, {
            width:  sigBoxW - 6,
            height: sigBoxH - 6,
            fit:    [sigBoxW - 6, sigBoxH - 6],
          });
          imageLoaded = true;
        } catch (err) {
          console.error('[PDF Generation] Failed to render signature image:', err.message);
        }
      }

      if (!imageLoaded) {
        txt(doc,
          rx.isDigitallySigned ? 'Signature on record' : 'Signature pending',
          sigX + 4, sigBoxY + sigBoxH / 2 - 6,
          { font: F.Light, size: 7, color: rx.isDigitallySigned ? C.green : C.muted, align: 'center', width: sigBoxW - 8 }
        );
      }

      hLine(doc, y + 70, sigX, sigX + sigBoxW, C.border, 0.5);
      txt(doc, d.name || '—', sigX, y + 73, { font: F.Bold,  size: 8,   color: C.dark });
      txt(doc, d.specialization || '', sigX, y + 84, { font: F.Light, size: 6.5, color: C.muted });

      // ── Security info grid ──
      txt(doc, 'PRESCRIPTION SECURITY', detX, y + 9, { font: F.Bold, size: 6.5, color: C.muted });

      const secItems = [
        ['Prescription ID', rx.rxNumber || '—'],
        ['Issued At',       fmtDateTime(issuedAt)],
        ['Valid Until',     fmtDate(followUp || expiresAt)],
        ['Status',          (rx.status || 'ISSUED').toUpperCase()],
        ['Digitally Signed',rx.isDigitallySigned ? 'Yes' : 'Pending'],
        ['Platform',        'Likeson Healthcare'],
      ];
      secItems.forEach(([lbl, val], i) => {
        const iy = y + 21 + i * 12.5;
        txt(doc, lbl, detX,       iy, { font: F.Light, size: 6.5, color: C.muted,  width: 86 });
        txt(doc, val, detX + 88,  iy, { font: F.Bold,  size: 6.5, color: C.dark,   width: detW - 94 });
      });

      // ── QR ──
      const qrSize = 70;
      txt(doc, 'SCAN TO VERIFY', qrSecX, y + 9,
        { font: F.Bold, size: 6.5, color: C.muted, align: 'center', width: qrSecW }
      );
      doc.image(qrBuf, qrSecX + (qrSecW - qrSize) / 2, y + 18, { width: qrSize, height: qrSize });
      txt(doc, 'Official Verification', qrSecX, y + 91,
        { font: F.Light, size: 6, color: C.muted, align: 'center', width: qrSecW }
      );

      // ════════════════════════════════════════════════════════════════════
      // 8. FOOTER + WATERMARK (all pages)
      // ════════════════════════════════════════════════════════════════════
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);

        fillRect(doc, 0, H - FOOTER_H, W, FOOTER_H, C.primary);
        txt(doc,
          'LIKESON.IN  •  Vijayawada  •  Hyderabad  •  Amaravathi',
          0, H - FOOTER_H + 7,
          { font: F.Regular, size: 7, color: C.blueFaint, align: 'center', width: W }
        );
        txt(doc,
          `Computer-generated prescription  •  support@likeson.in  •  (c) ${new Date().getFullYear()} Likeson Healthcare`,
          0, H - FOOTER_H + 19,
          { font: F.Light, size: 6, color: '#475569', align: 'center', width: W }
        );

        doc.save()
          .opacity(0.04)
          .font(F.Bold)
          .fontSize(44)
          .fillColor(C.primary)
          .rotate(-45, { origin: [W / 2, H / 2] })
          .text('LIKESON HEALTHCARE', W / 2 - 200, H / 2 - 22, { width: 400, align: 'center' })
          .restore();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export default generateEPrescriptionPdf;