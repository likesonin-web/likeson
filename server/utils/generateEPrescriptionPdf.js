/**
 * generateEPrescriptionPdf.js
 * Likeson.in — ePrescription PDF Generator
 *
 * Uses: pdfkit (npm i pdfkit)
 * Returns: Buffer (pipe to res or upload to S3/Cloudinary)
 *
 * Usage:
 *   import generateEPrescriptionPdf from '../utils/generateEPrescriptionPdf.js';
 *   const buffer = await generateEPrescriptionPdf(prescriptionDoc);
 */

import PDFDocument from 'pdfkit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtFreq = (f) => {
  const map = {
    OD: 'Once Daily', BD: 'Twice Daily', TDS: 'Thrice Daily',
    QID: 'Four Times Daily', SOS: 'As Needed', HS: 'At Bedtime',
    AC: 'Before Meals', PC: 'After Meals', STAT: 'Immediately',
    Weekly: 'Weekly', Monthly: 'Monthly', 'As Directed': 'As Directed',
  };
  return map[f] || f;
};

// ─── Color Palette ────────────────────────────────────────────────────────────
const C = {
  navy:       '#0F3460',
  dark:       '#1A1A2E',
  slate:      '#475569',
  muted:      '#94A3B8',
  border:     '#E2E8F0',
  bg:         '#F8FAFC',
  white:      '#FFFFFF',
  accent:     '#007BFF',
  red:        '#DC2626',
  green:      '#15803D',
};

// ─── Layout constants ─────────────────────────────────────────────────────────
const PAGE_W   = 595.28;   // A4 pt
const PAGE_H   = 841.89;
const MARGIN   = 40;
const CONTENT  = PAGE_W - MARGIN * 2;

// ─── Section helpers ──────────────────────────────────────────────────────────

/** Draw a full-width filled rect */
const fillRect = (doc, x, y, w, h, color) => {
  doc.save().rect(x, y, w, h).fill(color).restore();
};

/** Draw a horizontal rule */
const hRule = (doc, y, color = C.border) => {
  doc.save().moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(color).lineWidth(0.5).stroke().restore();
};

/** Small label + value row */
const labelVal = (doc, x, y, label, value, labelW = 110) => {
  doc.fontSize(8).fillColor(C.muted).font('Helvetica').text(label, x, y, { width: labelW });
  doc.fontSize(9).fillColor(C.dark).font('Helvetica-Bold').text(value || '—', x + labelW, y, { width: CONTENT - labelW });
};

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * @param {import('../models/EPrescription.js').default} rx  — lean or hydrated Mongoose doc
 * @returns {Promise<Buffer>}
 */
const generateEPrescriptionPdf = (rx) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        info: {
          Title:    `Prescription ${rx.rxNumber}`,
          Author:   rx.doctor?.name || 'Likeson Healthcare',
          Subject:  'ePrescription',
          Keywords: 'prescription,medicine,healthcare,likeson',
        },
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y = MARGIN;

      // ── 1. Header Bar ──────────────────────────────────────────────────────
      fillRect(doc, 0, 0, PAGE_W, 70, C.dark);

      doc.fontSize(16).font('Helvetica-Bold').fillColor(C.white)
         .text('🏥  LIKESON HEALTHCARE', MARGIN, 14, { width: CONTENT * 0.6 });

      doc.fontSize(8).font('Helvetica').fillColor(C.muted)
         .text('Your Trusted Health Partner', MARGIN, 34);

      // RX number badge (top-right)
      doc.fontSize(8).font('Helvetica').fillColor(C.muted)
         .text('PRESCRIPTION ID', PAGE_W - 180, 12, { width: 140, align: 'right' });
      doc.fontSize(11).font('Helvetica-Bold').fillColor(C.white)
         .text(rx.rxNumber || '—', PAGE_W - 180, 24, { width: 140, align: 'right' });
      doc.fontSize(8).font('Helvetica').fillColor(C.muted)
         .text(`Issued: ${fmtDate(rx.issuedAt)}  |  Expires: ${fmtDate(rx.expiresAt)}`,
               PAGE_W - 180, 40, { width: 140, align: 'right' });

      y = 80;

      // ── 2. Status ribbon (if not 'issued') ────────────────────────────────
      if (rx.status && rx.status !== 'issued') {
        const ribbonColor = rx.status === 'cancelled' ? C.red
                          : rx.status === 'expired'   ? '#B45309'
                          : rx.status === 'dispensed' ? C.green
                          : C.navy;
        fillRect(doc, 0, y, PAGE_W, 18, ribbonColor);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
           .text(`STATUS: ${rx.status.toUpperCase()}${rx.cancelReason ? `  —  ${rx.cancelReason}` : ''}`,
                 MARGIN, y + 4, { width: CONTENT, align: 'center' });
        y += 22;
      }

      y += 6;

      // ── 3. Doctor + Hospital block ─────────────────────────────────────────
      const d = rx.doctor || {};
      const h = rx.hospital || {};

      fillRect(doc, MARGIN, y, CONTENT, 78, C.bg);
      doc.rect(MARGIN, y, CONTENT, 78).strokeColor(C.border).lineWidth(0.5).stroke();

      const docColW = CONTENT * 0.55;
      const hospColX = MARGIN + docColW + 12;
      const hospColW = CONTENT - docColW - 12;

      doc.fontSize(7).font('Helvetica-Bold').fillColor(C.navy)
         .text('PRESCRIBING DOCTOR', MARGIN + 8, y + 8);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(C.dark)
         .text(d.name || '—', MARGIN + 8, y + 18, { width: docColW - 16 });
      doc.fontSize(8).font('Helvetica').fillColor(C.slate)
         .text([d.qualifications, d.specialization].filter(Boolean).join('  |  ') || '—',
               MARGIN + 8, y + 32, { width: docColW - 16 });

      if (d.registrationNumber) {
        doc.fontSize(7.5).font('Helvetica').fillColor(C.muted)
           .text(`Reg No: ${d.registrationNumber}${d.registrationCouncil ? ` (${d.registrationCouncil})` : ''}`,
                 MARGIN + 8, y + 46, { width: docColW - 16 });
      }
      if (d.phone || d.email) {
        doc.fontSize(7.5).font('Helvetica').fillColor(C.muted)
           .text([d.phone, d.email].filter(Boolean).join('  |  '),
                 MARGIN + 8, y + 58, { width: docColW - 16 });
      }

      // Vertical divider
      doc.save().moveTo(MARGIN + docColW, y + 6)
         .lineTo(MARGIN + docColW, y + 72)
         .strokeColor(C.border).lineWidth(0.5).stroke().restore();

      if (h.name) {
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.navy)
           .text('HOSPITAL / CLINIC', hospColX, y + 8, { width: hospColW });
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.dark)
           .text(h.name, hospColX, y + 18, { width: hospColW });
        doc.fontSize(7.5).font('Helvetica').fillColor(C.slate)
           .text([h.address, h.phone].filter(Boolean).join('\n') || '',
                 hospColX, y + 30, { width: hospColW });
        if (h.licenseNo) {
          doc.fontSize(7).font('Helvetica').fillColor(C.muted)
             .text(`License: ${h.licenseNo}`, hospColX, y + 58, { width: hospColW });
        }
      } else {
        doc.fontSize(8).font('Helvetica').fillColor(C.muted)
           .text('Independent Practice', hospColX, y + 30, { width: hospColW });
      }

      y += 86;

      // ── 4. Patient + Vitals block ──────────────────────────────────────────
      const p = rx.patient || {};
      const v = rx.vitals  || {};

      fillRect(doc, MARGIN, y, CONTENT, 58, C.white);
      doc.rect(MARGIN, y, CONTENT, 58).strokeColor(C.border).lineWidth(0.5).stroke();

      doc.fontSize(7).font('Helvetica-Bold').fillColor(C.navy)
         .text('PATIENT', MARGIN + 8, y + 7);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(C.dark)
         .text(p.name || '—', MARGIN + 8, y + 17, { width: CONTENT * 0.45 });

      const patMeta = [
        p.age     ? `Age: ${p.age}` : null,
        p.gender  ? p.gender        : null,
        p.bloodGroup ? `Blood: ${p.bloodGroup}` : null,
        p.weight  ? `Wt: ${p.weight}` : null,
      ].filter(Boolean).join('  |  ');

      doc.fontSize(8).font('Helvetica').fillColor(C.slate)
         .text(patMeta, MARGIN + 8, y + 31, { width: CONTENT * 0.45 });

      if (p.phone) {
        doc.fontSize(7.5).font('Helvetica').fillColor(C.muted)
           .text(`Ph: ${p.phone}`, MARGIN + 8, y + 44, { width: CONTENT * 0.45 });
      }

      // Allergies
      if (p.allergies?.length) {
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.red)
           .text(`⚠ Allergies: ${p.allergies.join(', ')}`,
                 MARGIN + 8, y + 44 + (p.phone ? 11 : 0), { width: CONTENT * 0.45 });
      }

      // Vitals strip (right side)
      const vx = MARGIN + CONTENT * 0.5;
      doc.fontSize(7).font('Helvetica-Bold').fillColor(C.navy)
         .text('VITALS AT CONSULTATION', vx, y + 7);

      const vFields = [
        ['BP',      v.bloodPressure ? `${v.bloodPressure} mmHg` : null],
        ['Pulse',   v.pulseRate     ? `${v.pulseRate} bpm`      : null],
        ['Temp',    v.temperature   ? `${v.temperature} °C`     : null],
        ['SpO2',    v.spO2          ? `${v.spO2}%`              : null],
        ['Sugar',   v.bloodSugar    ? `${v.bloodSugar} mg/dL`   : null],
        ['Wt/Ht',   (v.weightKg || v.heightCm) ? `${v.weightKg || '?'}kg / ${v.heightCm || '?'}cm` : null],
      ].filter(([, val]) => val);

      const vcols = 3;
      vFields.forEach(([label, val], i) => {
        const col = i % vcols;
        const row = Math.floor(i / vcols);
        const vvx = vx + col * (CONTENT * 0.5 / vcols);
        doc.fontSize(7).font('Helvetica').fillColor(C.muted)
           .text(label, vvx, y + 18 + row * 16, { width: 28 });
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.dark)
           .text(val, vvx + 30, y + 18 + row * 16, { width: CONTENT * 0.5 / vcols - 34 });
      });

      if (!vFields.length) {
        doc.fontSize(8).font('Helvetica').fillColor(C.muted)
           .text('Not recorded', vx, y + 25);
      }

      y += 66;

      // ── 5. Diagnosis / Clinical ────────────────────────────────────────────
      if (rx.diagnosis || rx.chiefComplaints?.length || rx.clinicalFindings) {
        fillRect(doc, MARGIN, y, CONTENT, 8, C.navy);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.white)
           .text('CLINICAL DETAILS', MARGIN + 6, y + 1);
        y += 12;

        fillRect(doc, MARGIN, y, CONTENT, 2, C.bg);
        y += 4;

        if (rx.chiefComplaints?.length) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor(C.slate)
             .text('Chief Complaints:', MARGIN + 6, y);
          doc.fontSize(8).font('Helvetica').fillColor(C.dark)
             .text(rx.chiefComplaints.join(', '), MARGIN + 110, y, { width: CONTENT - 116 });
          y += 14;
        }
        if (rx.diagnosis) {
          const diagLine = rx.diagnosisCode ? `${rx.diagnosis}  (ICD-10: ${rx.diagnosisCode})` : rx.diagnosis;
          doc.fontSize(8).font('Helvetica-Bold').fillColor(C.slate)
             .text('Diagnosis:', MARGIN + 6, y);
          doc.fontSize(8).font('Helvetica').fillColor(C.dark)
             .text(diagLine, MARGIN + 110, y, { width: CONTENT - 116 });
          y += 14;
        }
        if (rx.clinicalFindings) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor(C.slate)
             .text('Findings:', MARGIN + 6, y);
          doc.fontSize(8).font('Helvetica').fillColor(C.dark)
             .text(rx.clinicalFindings, MARGIN + 110, y, { width: CONTENT - 116 });
          y += 14;
        }
        y += 4;
      }

      // ── 6. Medicines Table ─────────────────────────────────────────────────
      const meds = rx.medicines || [];

      fillRect(doc, MARGIN, y, CONTENT, 18, C.navy);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
         .text(`℞  PRESCRIBED MEDICINES  (${meds.length})`, MARGIN + 6, y + 5);
      y += 20;

      if (meds.length === 0) {
        fillRect(doc, MARGIN, y, CONTENT, 24, C.bg);
        doc.fontSize(9).font('Helvetica').fillColor(C.muted)
           .text('No medicines prescribed.', MARGIN, y + 7, { width: CONTENT, align: 'center' });
        y += 28;
      } else {
        // Column widths
        const colW = {
          no:    24,
          name:  160,
          dosage: 55,
          freq:   80,
          dur:    45,
          timing: 70,
          route:  50,
          qty:    32,
        };
        const colX = {};
        let cx = MARGIN;
        Object.entries(colW).forEach(([k, w]) => { colX[k] = cx; cx += w; });

        // Header row
        fillRect(doc, MARGIN, y, CONTENT, 14, '#1E293B');
        const headers = [
          ['#',        colX.no,    colW.no   ],
          ['Medicine', colX.name,  colW.name ],
          ['Dose',     colX.dosage,colW.dosage],
          ['Frequency',colX.freq,  colW.freq ],
          ['Days',     colX.dur,   colW.dur  ],
          ['Timing',   colX.timing,colW.timing],
          ['Route',    colX.route, colW.route],
          ['Qty',      colX.qty,   colW.qty  ],
        ];
        headers.forEach(([label, hx, hw]) => {
          doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
             .text(label, hx + 2, y + 3, { width: hw - 4 });
        });
        y += 16;

        meds.forEach((med, i) => {
          const rowH = med.instructions ? 28 : 18;
          const bg   = i % 2 === 0 ? C.white : C.bg;
          fillRect(doc, MARGIN, y, CONTENT, rowH, bg);

          doc.fontSize(8).font('Helvetica-Bold').fillColor(C.dark)
             .text(String(i + 1), colX.no + 2, y + 4, { width: colW.no - 4 });

          // Medicine name + generic
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.dark)
             .text(med.medicineName || '—', colX.name + 2, y + 3, { width: colW.name - 4 });
          if (med.genericName && med.genericName !== med.medicineName) {
            doc.fontSize(7).font('Helvetica').fillColor(C.muted)
               .text(med.genericName, colX.name + 2, y + 13, { width: colW.name - 4 });
          }

          doc.fontSize(8).font('Helvetica').fillColor(C.dark)
             .text(med.dosage || '—', colX.dosage + 2, y + 4, { width: colW.dosage - 4 });

          doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.navy)
             .text(fmtFreq(med.frequency), colX.freq + 2, y + 4, { width: colW.freq - 4 });

          doc.fontSize(8).font('Helvetica').fillColor(C.dark)
             .text(med.durationDays ? `${med.durationDays}d` : 'Ongoing',
                   colX.dur + 2, y + 4, { width: colW.dur - 4 });

          doc.fontSize(7.5).font('Helvetica').fillColor(C.slate)
             .text(med.timing || '—', colX.timing + 2, y + 4, { width: colW.timing - 4 });

          doc.fontSize(7.5).font('Helvetica').fillColor(C.slate)
             .text(med.route || 'Oral', colX.route + 2, y + 4, { width: colW.route - 4 });

          doc.fontSize(8).font('Helvetica-Bold').fillColor(C.dark)
             .text(med.quantity ? String(med.quantity) : '—',
                   colX.qty + 2, y + 4, { width: colW.qty - 4 });

          if (med.instructions) {
            doc.fontSize(7).font('Helvetica').fillColor(C.slate)
               .text(`✎ ${med.instructions}`, colX.name + 2, y + 17, { width: CONTENT - colW.no - 8 });
          }

          // Substitution badge
          if (med.isSubstitutable === false) {
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor(C.red)
               .text('DAW', colX.qty + 2, y + 13, { width: colW.qty - 4 });
          }

          y += rowH;

          // Page break guard
          if (y > PAGE_H - 160) {
            doc.addPage();
            y = MARGIN + 10;
          }
        });
      }

      y += 6;

      // ── 7. Lab Tests ───────────────────────────────────────────────────────
      const labs = rx.labTests || [];
      if (labs.length) {
        fillRect(doc, MARGIN, y, CONTENT, 16, '#0F3460');
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
           .text(`🔬  LAB TESTS ORDERED  (${labs.length})`, MARGIN + 6, y + 4);
        y += 18;

        labs.forEach((lt, i) => {
          const bg = i % 2 === 0 ? C.white : C.bg;
          fillRect(doc, MARGIN, y, CONTENT, 16, bg);
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.dark)
             .text(`${i + 1}. ${lt.testName}${lt.testCode ? ` (${lt.testCode})` : ''}`,
                   MARGIN + 6, y + 3, { width: CONTENT * 0.6 });

          const urgencyColor = lt.urgency === 'stat' ? C.red
                             : lt.urgency === 'urgent' ? '#B45309'
                             : C.green;
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor(urgencyColor)
             .text(lt.urgency?.toUpperCase() || 'ROUTINE',
                   MARGIN + CONTENT * 0.62, y + 3, { width: 60 });

          if (lt.instructions) {
            doc.fontSize(7).font('Helvetica').fillColor(C.muted)
               .text(lt.instructions, MARGIN + CONTENT * 0.72, y + 3, { width: CONTENT * 0.28 - 6 });
          }
          y += 17;
        });
        y += 4;
      }

      // ── 8. Advice / Referral ───────────────────────────────────────────────
      if (rx.advice || rx.referralNote) {
        fillRect(doc, MARGIN, y, CONTENT, 14, '#1E3A5F');
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
           .text('ADVICE & INSTRUCTIONS', MARGIN + 6, y + 3);
        y += 16;

        if (rx.advice) {
          fillRect(doc, MARGIN, y, CONTENT, 14, '#EFF6FF');
          doc.fontSize(8).font('Helvetica').fillColor(C.dark)
             .text(rx.advice, MARGIN + 8, y + 3, { width: CONTENT - 16 });
          y += 18;
        }
        if (rx.referralNote) {
          fillRect(doc, MARGIN, y, CONTENT, 14, '#FEF9C3');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#92400E')
             .text(`Referral: ${rx.referralNote}`, MARGIN + 8, y + 3, { width: CONTENT - 16 });
          y += 18;
        }
        y += 4;
      }

      // ── 9. Follow-up ───────────────────────────────────────────────────────
      if (rx.followUpDate || rx.followUpInstructions) {
        fillRect(doc, MARGIN, y, CONTENT, 22, '#F0FDF4');
        doc.rect(MARGIN, y, CONTENT, 22).strokeColor('#BBF7D0').lineWidth(0.5).stroke();

        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.green)
           .text('📅  FOLLOW-UP', MARGIN + 8, y + 4);

        const fuText = [
          rx.followUpDate ? `Date: ${fmtDate(rx.followUpDate)}` : null,
          rx.followUpInstructions || null,
        ].filter(Boolean).join('   |   ');

        doc.fontSize(8).font('Helvetica').fillColor(C.dark)
           .text(fuText, MARGIN + 90, y + 4, { width: CONTENT - 98 });
        y += 26;
      }

      // ── 10. Dispensing info ────────────────────────────────────────────────
      if (rx.status === 'dispensed' && rx.dispensedAt) {
        fillRect(doc, MARGIN, y, CONTENT, 16, '#F0FDF4');
        doc.fontSize(7.5).font('Helvetica').fillColor(C.green)
           .text(`✅ Dispensed on ${fmtDate(rx.dispensedAt)}`, MARGIN + 8, y + 4, { width: CONTENT - 16 });
        y += 20;
      }

      // ── 11. Signature + QR row ─────────────────────────────────────────────
      y = Math.max(y, PAGE_H - 120);  // push to near-bottom

      hRule(doc, y);
      y += 8;

      // Left: Doctor Signature placeholder
      doc.fontSize(7).font('Helvetica').fillColor(C.muted)
         .text('Signature / Seal', MARGIN, y, { width: 140 });

      if (rx.doctor?.signatureUrl) {
        // If you have the image buffer, embed it here
        // doc.image(signatureBuffer, MARGIN, y + 8, { width: 120, height: 40 });
      }

      doc.moveTo(MARGIN, y + 48).lineTo(MARGIN + 140, y + 48)
         .strokeColor(C.border).lineWidth(0.5).stroke();
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.dark)
         .text(d.name || '', MARGIN, y + 52, { width: 140 });
      doc.fontSize(7).font('Helvetica').fillColor(C.muted)
         .text(d.specialization || '', MARGIN, y + 62, { width: 140 });

      // Center: Validity + DAW note
      const mid = MARGIN + (CONTENT - 180) / 2;
      fillRect(doc, mid, y, 180, 60, C.bg);
      doc.rect(mid, y, 180, 60).strokeColor(C.border).lineWidth(0.5).stroke();
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.navy)
         .text('PRESCRIPTION VALIDITY', mid + 8, y + 6, { width: 164 });
      doc.fontSize(7).font('Helvetica').fillColor(C.slate)
         .text(`Valid From: ${fmtDate(rx.issuedAt)}`, mid + 8, y + 18, { width: 164 });
      doc.fontSize(7).font('Helvetica').fillColor(C.slate)
         .text(`Valid Until: ${fmtDate(rx.expiresAt)}`, mid + 8, y + 28, { width: 164 });
      doc.fontSize(7).font('Helvetica').fillColor(C.red)
         .text('DAW = Dispense As Written (no substitution)', mid + 8, y + 42, { width: 164 });
      doc.fontSize(6.5).font('Helvetica').fillColor(C.muted)
         .text('Refills are subject to drug regulations.', mid + 8, y + 52, { width: 164 });

      // Right: QR placeholder
      const qrX = PAGE_W - MARGIN - 70;
      doc.rect(qrX, y, 70, 70).strokeColor(C.border).lineWidth(0.5).stroke();
      doc.fontSize(7).font('Helvetica').fillColor(C.muted)
         .text('Scan to Verify', qrX, y + 54, { width: 70, align: 'center' });
      // If rx.qrCodeUrl image buffer is available:
      // doc.image(qrBuffer, qrX + 5, y + 5, { width: 60, height: 48 });

      // ── 12. Footer ─────────────────────────────────────────────────────────
      fillRect(doc, 0, PAGE_H - 22, PAGE_W, 22, C.dark);
      doc.fontSize(7).font('Helvetica').fillColor(C.muted)
         .text(
           `© ${new Date().getFullYear()} LIKESON.IN  |  Vijayawada · Hyderabad · Amaravathi  |  support@likeson.in  |  This is a computer-generated prescription.`,
           0, PAGE_H - 14, { width: PAGE_W, align: 'center' }
         );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

export default generateEPrescriptionPdf;