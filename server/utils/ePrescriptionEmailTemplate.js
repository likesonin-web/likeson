/**
 * ePrescriptionEmailTemplate.js
 * Likeson Healthcare — Patient ePrescription Email
 * Sends after doctor creates prescription. PDF attached.
 */

/**
 * Build HTML email body for ePrescription notification.
 * @param {Object} opts
 * @param {string} opts.patientName
 * @param {string} opts.doctorName
 * @param {string} opts.specialization
 * @param {string} opts.rxNumber
 * @param {string} opts.issuedAt   — formatted date string
 * @param {string} opts.expiresAt  — formatted date string
 * @param {Array}  opts.medicines  — prescribed medicines array
 * @param {string} opts.verifyUrl  — public verification URL
 * @param {string} opts.downloadUrl — PDF download link (optional)
 * @returns {string} HTML
 */
export const buildEPrescriptionEmail = ({
  patientName,
  doctorName,
  specialization,
  rxNumber,
  issuedAt,
  expiresAt,
  medicines = [],
  verifyUrl,
  downloadUrl,
}) => {
  const medRows = medicines.slice(0, 6).map((m, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding:9px 12px;font-size:13px;font-weight:600;color:#111827;
                 border-bottom:1px solid #f0f0f0;">
        ${m.medicineName || '—'}
        ${m.genericName && m.genericName !== m.medicineName
          ? `<div style="font-size:11px;color:#9ca3af;margin-top:1px;">${m.genericName}</div>`
          : ''}
      </td>
      <td style="padding:9px 12px;font-size:12px;color:#374151;border-bottom:1px solid #f0f0f0;">
        ${m.dosage || '—'}
      </td>
      <td style="padding:9px 12px;font-size:12px;font-weight:600;color:#1A56DB;
                 border-bottom:1px solid #f0f0f0;">
        ${{
          OD: 'Once Daily', BD: 'Twice Daily', TDS: 'Thrice Daily',
          QID: '4x Daily', SOS: 'As Needed', HS: 'Bedtime',
          AC: 'Before Meals', PC: 'After Meals', STAT: 'Immediately',
        }[m.frequency] || m.frequency || '—'}
      </td>
      <td style="padding:9px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #f0f0f0;">
        ${m.durationDays ? `${m.durationDays} days` : 'Ongoing'}
      </td>
    </tr>`).join('');

  const hasMore = medicines.length > 6;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td align="center" style="padding:32px 10px;">
      <table border="0" cellpadding="0" cellspacing="0" width="620"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 8px 30px rgba(0,0,0,0.08);
                    border:1px solid #e2e8f0;max-width:620px;width:100%;">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#0B2E5E 0%,#1A3A6E 55%,#1A56DB 100%);
                     padding:32px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:11px;font-weight:700;color:#93C5FD;
                              letter-spacing:2px;text-transform:uppercase;">
                    LIKESON HEALTHCARE
                  </div>
                  <div style="font-size:26px;font-weight:800;color:#ffffff;margin-top:6px;">
                    Your ePrescription
                  </div>
                  <div style="font-size:13px;color:#93C5FD;margin-top:4px;">
                    Issued by Dr. ${doctorName}${specialization ? ` · ${specialization}` : ''}
                  </div>
                </td>
                <td align="right" valign="top">
                  <div style="background:rgba(255,255,255,0.12);border-radius:10px;
                              padding:12px 16px;text-align:center;border:1px solid rgba(255,255,255,0.15);">
                    <div style="font-size:10px;color:#93C5FD;letter-spacing:1px;">PRESCRIPTION ID</div>
                    <div style="font-size:16px;font-weight:800;color:#fff;font-family:monospace;
                                margin-top:4px;letter-spacing:1px;">
                      ${rxNumber}
                    </div>
                    <div style="font-size:10px;color:#93C5FD;margin-top:6px;">
                      Valid: ${issuedAt} — ${expiresAt}
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── GREETING ── -->
        <tr>
          <td style="padding:28px 36px 8px;">
            <p style="margin:0;font-size:15px;color:#111827;">
              Hi <strong>${patientName}</strong>,
            </p>
            <p style="margin:10px 0 0;font-size:13px;color:#6b7280;line-height:1.7;">
              Your doctor has issued a digital prescription through Likeson Healthcare.
              The full prescription PDF is attached to this email — you can also
              <strong>download or verify it online</strong> anytime.
            </p>
          </td>
        </tr>

        <!-- ── IMPORTANT NOTE ── -->
        <tr>
          <td style="padding:12px 36px;">
            <div style="background:#EBF2FF;border-left:4px solid #1A56DB;border-radius:0 8px 8px 0;
                        padding:12px 16px;">
              <div style="font-size:12px;color:#1d4ed8;line-height:1.6;">
                📎 <strong>Your prescription PDF is attached</strong> to this email.
                Please show it at the pharmacy or share the prescription ID <strong>${rxNumber}</strong>
                for verification.
              </div>
            </div>
          </td>
        </tr>

        ${medicines.length > 0 ? `
        <!-- ── MEDICINES TABLE ── -->
        <tr>
          <td style="padding:16px 36px 8px;">
            <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:10px;">
              💊 Medicines Prescribed (${medicines.length})
            </div>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#0B2E5E;">
                  <th style="padding:9px 12px;text-align:left;font-size:11px;color:#93C5FD;font-weight:600;">MEDICINE</th>
                  <th style="padding:9px 12px;text-align:left;font-size:11px;color:#93C5FD;font-weight:600;">DOSE</th>
                  <th style="padding:9px 12px;text-align:left;font-size:11px;color:#93C5FD;font-weight:600;">FREQUENCY</th>
                  <th style="padding:9px 12px;text-align:left;font-size:11px;color:#93C5FD;font-weight:600;">DURATION</th>
                </tr>
              </thead>
              <tbody>
                ${medRows}
                ${hasMore ? `
                <tr>
                  <td colspan="4" style="padding:10px 12px;text-align:center;
                      font-size:12px;color:#6b7280;background:#f9fafb;
                      border-top:1px solid #e5e7eb;">
                    + ${medicines.length - 6} more — see attached PDF
                  </td>
                </tr>` : ''}
              </tbody>
            </table>
          </td>
        </tr>` : ''}

        <!-- ── ACTIONS ── -->
        <tr>
          <td style="padding:20px 36px 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:6px;">
                  <a href="${verifyUrl}"
                     style="display:block;text-align:center;background:#0B2E5E;color:#fff;
                            text-decoration:none;padding:13px 20px;border-radius:8px;
                            font-size:13px;font-weight:700;">
                    🔍 Verify Prescription
                  </a>
                </td>
                ${downloadUrl ? `
                <td style="padding-left:6px;">
                  <a href="${downloadUrl}"
                     style="display:block;text-align:center;background:#f1f5f9;color:#0B2E5E;
                            text-decoration:none;padding:13px 20px;border-radius:8px;
                            font-size:13px;font-weight:700;border:1.5px solid #e2e8f0;">
                    ⬇ Download PDF
                  </a>
                </td>` : ''}
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── SECURITY NOTE ── -->
        <tr>
          <td style="padding:12px 36px 24px;">
            <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:11px;color:#6b7280;">
                <tr>
                  <td style="padding:2px 0;">🔒 Prescription ID</td>
                  <td style="text-align:right;font-family:monospace;color:#111827;font-weight:700;">${rxNumber}</td>
                </tr>
                <tr>
                  <td style="padding:2px 0;">📅 Issued</td>
                  <td style="text-align:right;color:#374151;">${issuedAt}</td>
                </tr>
                <tr>
                  <td style="padding:2px 0;">⏰ Expires</td>
                  <td style="text-align:right;color:#374151;">${expiresAt}</td>
                </tr>
                <tr>
                  <td style="padding:2px 0;">🌐 Verify at</td>
                  <td style="text-align:right;">
                    <a href="${verifyUrl}" style="color:#1A56DB;font-size:10px;">${verifyUrl}</a>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background:#0B2E5E;padding:18px 36px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#93C5FD;font-weight:600;letter-spacing:1px;">
              LIKESON HEALTHCARE
            </p>
            <p style="margin:5px 0 0;font-size:10px;color:#475569;">
              Vijayawada · Hyderabad · Amaravathi ·
              <a href="mailto:support@likeson.in" style="color:#60A5FA;text-decoration:none;">support@likeson.in</a>
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#374151;">
              This is a computer-generated prescription email. Do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
};