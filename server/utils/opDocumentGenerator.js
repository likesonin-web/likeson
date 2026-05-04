/**
 * OP Document Generator — Likeson.in
 * Generates a printable, ZIP-ready HTML document for OutPatientRecord.
 * Sent to customer as an email attachment in a .zip file.
 */

import archiver from 'archiver';
import { PassThrough } from 'stream';

// ─────────────────────────────────────────────────────────────────────────────
// HTML Template
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a fully self-contained, printable OP card HTML.
 *
 * @param {object} params
 * @param {object} params.op          – OutPatientRecord lean doc
 * @param {object} params.booking     – Booking lean doc
 * @param {object} params.doctor      – DoctorProfile lean doc (populated with user)
 * @param {object} params.hospital    – Hospital lean doc (may be null)
 * @param {object} params.patient     – User lean doc (customer)
 * @param {object[]} [params.followUps] – Array of child OutPatientRecord docs
 * @returns {string} HTML string
 */
export const generateOpHtml = ({ op, booking, doctor, hospital, patient, followUps = [] }) => {
  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const fmtDateTime = (d) =>
    d
      ? new Date(d).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—';

  const doctorName        = doctor?.user?.name        || 'N/A';
  const specialization    = doctor?.specialization     || 'N/A';
  const regNumber         = doctor?.registrationNumber || 'N/A';
  const hospitalName      = hospital?.name             || (booking?.doctorSnapshot?.name ? 'Doctor\'s Clinic' : 'N/A');
  const hospitalAddress   = hospital
    ? `${hospital.address?.line1 || ''}, ${hospital.address?.city || ''}, ${hospital.address?.state || ''} — ${hospital.address?.pincode || ''}`
    : '';
  const patientName       = booking?.patientInfo?.name    || patient?.name  || 'N/A';
  const patientAge        = booking?.patientInfo?.age      || '—';
  const patientGender     = booking?.patientInfo?.gender   || '—';
  const patientPhone      = booking?.patientInfo?.phone    || patient?.phone || '—';
  const patientBloodGroup = booking?.patientInfo?.bloodGroup || '—';
  const bookingCode       = booking?.bookingCode           || '—';
  const opNumber          = op?.opNumber                   || '—';
  const consultationType  = (op?.consultationType || '').replace(/_/g, ' ').toUpperCase() || '—';
  const scheduledAt       = fmtDateTime(op?.scheduledAt || booking?.scheduledAt);
  const completedAt       = op?.completedAt ? fmtDateTime(op.completedAt) : '—';
  const reasonForVisit    = op?.reasonForVisit || '—';
  const doctorNotes       = op?.doctorNotes    || '—';
  const diagnosisCode     = op?.diagnosisCode  || '';
  const followUpExpiry    = op?.followUpExpiry  ? fmtDate(op.followUpExpiry)  : '—';
  const followUpFee       = op?.followUpFee     != null   ? `₹${op.followUpFee}` : '—';
  const isFollowUpEligible = op?.followUpExpiry && new Date() < new Date(op.followUpExpiry);

  const followUpRows = followUps.length
    ? followUps.map((fu, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${fu.opNumber || '—'}</td>
          <td>${fmtDateTime(fu.scheduledAt)}</td>
          <td>${(fu.consultationType || '').replace(/_/g, ' ')}</td>
          <td><span class="badge badge-${fu.status === 'completed' ? 'green' : fu.status === 'scheduled' ? 'blue' : 'gray'}">${fu.status}</span></td>
        </tr>`).join('')
    : '<tr><td colspan="5" class="empty-row">No follow-up visits recorded.</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OP Card — ${opNumber}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f0f4f8;
      color: #1e293b;
      padding: 24px;
      font-size: 13px;
    }
    .card {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
      border: 1px solid #e2e8f0;
    }
    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%);
      padding: 28px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }
    .header-left .brand { font-size: 20px; font-weight: 800; color: #fff; letter-spacing: 1.5px; }
    .header-left .tagline { color: #94a3b8; font-size: 11px; margin-top: 4px; }
    .header-right { text-align: right; }
    .op-badge {
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 10px;
      padding: 12px 20px;
    }
    .op-badge .label { color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .op-badge .value { color: #fff; font-size: 19px; font-weight: 800; font-family: 'Courier New', monospace; margin-top: 3px; }
    .op-badge .sub   { color: #64748b; font-size: 10px; margin-top: 4px; }
    /* ── Status bar ── */
    .status-bar {
      background: ${op?.status === 'completed' ? '#f0fdf4' : op?.status === 'scheduled' ? '#eff6ff' : '#fef9c3'};
      border-bottom: 2px solid ${op?.status === 'completed' ? '#bbf7d0' : op?.status === 'scheduled' ? '#bfdbfe' : '#fde68a'};
      padding: 12px 36px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .status-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: ${op?.status === 'completed' ? '#15803d' : op?.status === 'scheduled' ? '#1d4ed8' : '#ca8a04'};
    }
    .status-text {
      font-weight: 700; font-size: 13px;
      color: ${op?.status === 'completed' ? '#15803d' : op?.status === 'scheduled' ? '#1d4ed8' : '#ca8a04'};
    }
    .status-meta { color: #64748b; font-size: 12px; margin-left: auto; }
    /* ── Body ── */
    .body { padding: 28px 36px; }
    .section { margin-bottom: 24px; }
    .section-title {
      font-size: 11px; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 1px;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #f1f5f9;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .info-block { background: #f8fafc; border-radius: 8px; padding: 12px 14px; }
    .info-block .ib-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
    .info-block .ib-value { font-size: 13px; font-weight: 600; color: #1e293b; }
    /* ── Doctor card ── */
    .doctor-card {
      background: linear-gradient(135deg, #f8fafc, #f1f5f9);
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .doctor-avatar {
      width: 52px; height: 52px; border-radius: 50%;
      background: linear-gradient(135deg, #0f3460, #1a1a2e);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 20px; flex-shrink: 0;
    }
    .doctor-info .name  { font-size: 15px; font-weight: 700; color: #1e293b; }
    .doctor-info .spec  { font-size: 12px; color: #0f3460; font-weight: 600; margin-top: 2px; }
    .doctor-info .reg   { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    /* ── Hospital card ── */
    .hospital-card {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .hospital-card .name    { font-size: 14px; font-weight: 700; color: #0369a1; }
    .hospital-card .address { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
    /* ── Notes box ── */
    .notes-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 14px 16px;
      font-size: 13px;
      line-height: 1.7;
      color: #374151;
      white-space: pre-line;
    }
    .notes-box.reason { background: #f0f9ff; border-color: #bae6fd; }
    /* ── Follow-up banner ── */
    .fu-banner {
      background: ${isFollowUpEligible ? '#f0fdf4' : '#f8fafc'};
      border: 1px solid ${isFollowUpEligible ? '#bbf7d0' : '#e2e8f0'};
      border-radius: 10px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .fu-icon { font-size: 24px; }
    .fu-text .fu-title { font-weight: 700; font-size: 13px; color: ${isFollowUpEligible ? '#15803d' : '#64748b'}; }
    .fu-text .fu-sub   { font-size: 11px; color: #64748b; margin-top: 3px; }
    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #1a1a2e;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .7px;
      padding: 9px 12px;
      text-align: left;
    }
    td {
      padding: 9px 12px;
      font-size: 12px;
      color: #374151;
      border-bottom: 1px solid #f1f5f9;
    }
    .empty-row { text-align: center; color: #94a3b8; font-style: italic; padding: 20px; }
    /* ── Badge ── */
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-green  { background: #f0fdf4; color: #15803d; }
    .badge-blue   { background: #eff6ff; color: #1d4ed8; }
    .badge-gray   { background: #f1f5f9; color: #64748b; }
    .badge-red    { background: #fef2f2; color: #b91c1c; }
    /* ── Prescription link ── */
    .rx-link {
      display: inline-flex; align-items: center; gap: 6px;
      background: #0f3460; color: #fff;
      padding: 8px 18px; border-radius: 8px;
      text-decoration: none; font-size: 12px; font-weight: 600;
    }
    /* ── Divider ── */
    .divider { border: none; border-top: 1px solid #f1f5f9; margin: 20px 0; }
    /* ── Footer ── */
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 16px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer .copy { font-size: 10px; color: #94a3b8; }
    .footer .booking-ref { font-size: 11px; color: #64748b; }
    /* ── Print ── */
    @media print {
      body { background: #fff; padding: 0; }
      .card { box-shadow: none; border: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right;margin-bottom:16px;">
    <button onclick="window.print()"
            style="background:#0f3460;color:#fff;border:none;padding:9px 22px;
                   border-radius:8px;font-size:13px;cursor:pointer;font-weight:600;">
      🖨️ Print / Save PDF
    </button>
  </div>

  <div class="card">
    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        <div class="brand">🏥 LIKESON HEALTHCARE</div>
        <div class="tagline">Out-Patient Record (OP Card)</div>
        ${hospitalName !== 'N/A' ? `<div style="color:#64748b;font-size:11px;margin-top:6px;">${hospitalName}</div>` : ''}
      </div>
      <div class="header-right">
        <div class="op-badge">
          <div class="label">OP Number</div>
          <div class="value">${opNumber}</div>
          <div class="sub">Booking: ${bookingCode}</div>
        </div>
      </div>
    </div>

    <!-- STATUS BAR -->
    <div class="status-bar">
      <div class="status-dot"></div>
      <div class="status-text">${(op?.status || 'scheduled').toUpperCase()}</div>
      ${diagnosisCode ? `<span class="badge badge-blue" style="margin-left:8px;">ICD: ${diagnosisCode}</span>` : ''}
      <div class="status-meta">Scheduled: ${scheduledAt}${completedAt !== '—' ? ` &nbsp;|&nbsp; Completed: ${completedAt}` : ''}</div>
    </div>

    <!-- BODY -->
    <div class="body">

      <!-- PATIENT INFORMATION -->
      <div class="section">
        <div class="section-title">Patient Information</div>
        <div class="grid-3">
          <div class="info-block">
            <div class="ib-label">Full Name</div>
            <div class="ib-value">${patientName}</div>
          </div>
          <div class="info-block">
            <div class="ib-label">Age / Gender</div>
            <div class="ib-value">${patientAge} yrs &nbsp;·&nbsp; ${patientGender}</div>
          </div>
          <div class="info-block">
            <div class="ib-label">Blood Group</div>
            <div class="ib-value">${patientBloodGroup}</div>
          </div>
          <div class="info-block">
            <div class="ib-label">Phone</div>
            <div class="ib-value">${patientPhone}</div>
          </div>
          <div class="info-block">
            <div class="ib-label">Consultation Type</div>
            <div class="ib-value">${consultationType}</div>
          </div>
          <div class="info-block">
            <div class="ib-label">Visit Type</div>
            <div class="ib-value">${op?.isFollowUp ? '🔄 Follow-Up' : '🆕 First Visit'}</div>
          </div>
        </div>
      </div>

      <!-- DOCTOR & HOSPITAL -->
      <div class="grid-2" style="margin-bottom:24px;">
        <div>
          <div class="section-title">Attending Doctor</div>
          <div class="doctor-card">
            <div class="doctor-avatar">👨‍⚕️</div>
            <div class="doctor-info">
              <div class="name">Dr. ${doctorName}</div>
              <div class="spec">${specialization}</div>
              <div class="reg">Reg. No: ${regNumber}</div>
            </div>
          </div>
        </div>
        ${hospitalName !== 'N/A' ? `
        <div>
          <div class="section-title">Hospital / Clinic</div>
          <div class="hospital-card">
            <div class="name">${hospitalName}</div>
            ${hospitalAddress ? `<div class="address">📍 ${hospitalAddress}</div>` : ''}
            ${hospital?.contact?.phone ? `<div class="address">📞 ${hospital.contact.phone}</div>` : ''}
          </div>
        </div>` : '<div></div>'}
      </div>

      <!-- REASON FOR VISIT -->
      <div class="section">
        <div class="section-title">Reason for Visit</div>
        <div class="notes-box reason">${reasonForVisit}</div>
      </div>

      <!-- DOCTOR NOTES / PRESCRIPTION -->
      ${doctorNotes !== '—' || op?.prescriptionUrl ? `
      <div class="section">
        <div class="section-title">Doctor Notes & Prescription</div>
        ${doctorNotes !== '—' ? `<div class="notes-box" style="margin-bottom:12px;">${doctorNotes}</div>` : ''}
        ${op?.prescriptionUrl ? `
        <div style="margin-top:10px;">
          <a href="${op.prescriptionUrl}" class="rx-link" target="_blank">
            📄 Download Prescription
          </a>
        </div>` : ''}
      </div>` : ''}

      <hr class="divider" />

      <!-- FOLLOW-UP STATUS -->
      <div class="section">
        <div class="section-title">Follow-Up Eligibility</div>
        <div class="fu-banner">
          <div class="fu-icon">${isFollowUpEligible ? '✅' : '⌛'}</div>
          <div class="fu-text">
            <div class="fu-title">
              ${isFollowUpEligible
                ? `Follow-up available until ${followUpExpiry}`
                : op?.followUpExpiry
                  ? `Follow-up window expired (${followUpExpiry})`
                  : 'Follow-up not applicable'}
            </div>
            <div class="fu-sub">
              Follow-up fee: <strong>${followUpFee}</strong>
              ${op?.isFollowUp && op?.parentOp ? ` &nbsp;·&nbsp; Parent OP: ${op.parentOp}` : ''}
            </div>
          </div>
          ${isFollowUpEligible ? `
          <div style="margin-left:auto;">
            <span class="badge badge-green">ELIGIBLE</span>
          </div>` : ''}
        </div>
      </div>

      <!-- FOLLOW-UP HISTORY -->
      ${followUps.length > 0 ? `
      <div class="section">
        <div class="section-title">Follow-Up Visit History (${followUps.length})</div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>OP No.</th>
                <th>Date</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${followUpRows}</tbody>
          </table>
        </div>
      </div>` : ''}

      <!-- BILLING SUMMARY -->
      <div class="section">
        <div class="section-title">Billing Summary</div>
        <div class="grid-3">
          <div class="info-block">
            <div class="ib-label">Consultation Fee</div>
            <div class="ib-value">₹${op?.consultationFee ?? booking?.fareBreakdown?.consultationFee ?? 0}</div>
          </div>
          <div class="info-block">
            <div class="ib-label">Fee Source</div>
            <div class="ib-value">${(op?.feeSource || '—').replace(/_/g, ' ').toUpperCase()}</div>
          </div>
          <div class="info-block">
            <div class="ib-label">Subscription Covered</div>
            <div class="ib-value">${op?.isCoveredBySubscription ? '✅ Yes' : '❌ No'}</div>
          </div>
        </div>
      </div>

    </div><!-- /body -->

    <!-- FOOTER -->
    <div class="footer">
      <div class="copy">
        © ${new Date().getFullYear()} Likeson Healthcare · support@likeson.in · likeson.in<br/>
        This is a computer-generated OP record. Valid without signature.
      </div>
      <div class="booking-ref">
        Booking: <strong>${bookingCode}</strong><br/>
        Generated: ${new Date().toLocaleString('en-IN')}
      </div>
    </div>
  </div>
</body>
</html>`;
};

// ─────────────────────────────────────────────────────────────────────────────
// ZIP Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a ZIP buffer containing the OP HTML file.
 *
 * @param {string} htmlContent  – Output of generateOpHtml()
 * @param {string} opNumber     – e.g. OP-20260501-VIJAYA-0001
 * @returns {Promise<Buffer>}   – ZIP file as Buffer
 */
export const buildOpZipBuffer = (htmlContent, opNumber) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const passThrough = new PassThrough();

    passThrough.on('data', (chunk) => chunks.push(chunk));
    passThrough.on('end', () => resolve(Buffer.concat(chunks)));
    passThrough.on('error', reject);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', reject);
    archive.pipe(passThrough);

    const safeOpNumber = (opNumber || 'OP-RECORD').replace(/[^a-zA-Z0-9\-_]/g, '_');
    archive.append(htmlContent, { name: `${safeOpNumber}.html` });

    archive.finalize();
  });
};