/**
 * formGenerator.js
 *
 * Generates printable HTML-based registration forms for:
 *   - Hospital (hospital-manager | doctor-owner)
 *   - Doctor   (hospital-manager affiliated | doctor-owner independent)
 *
 * Returns an HTML string that can be streamed directly as a response
 * or converted to PDF via a headless browser / wkhtmltopdf.
 *
 * Usage:
 *   import { generateHospitalForm, generateDoctorForm } from './formGenerator.js';
 *   const html = generateHospitalForm('hospital-manager');
 *   const html = generateDoctorForm('doctor-owner');
 */

// ── Shared Styles ──────────────────────────────────────────────────────────────

const BASE_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    color: #1e293b;
    background: #fff;
    padding: 0;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 18mm 18mm 14mm 18mm;
  }

  /* ── Header ── */
  .form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid var(--accent);
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .form-header .brand { font-size: 20pt; font-weight: 800; color: var(--primary); }
  .form-header .brand span { color: var(--accent); }
  .form-header .form-meta { text-align: right; font-size: 8.5pt; color: #64748b; line-height: 1.6; }
  .form-title {
    font-size: 14pt;
    font-weight: 700;
    color: var(--primary);
    text-align: center;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .form-subtitle {
    font-size: 9pt;
    color: #64748b;
    text-align: center;
    margin-bottom: 20px;
  }

  /* ── Info Banner ── */
  .info-banner {
    background: var(--banner-bg);
    border-left: 4px solid var(--accent);
    border-radius: 0 6px 6px 0;
    padding: 10px 14px;
    margin-bottom: 18px;
    font-size: 9pt;
    color: #334155;
    line-height: 1.7;
  }
  .info-banner strong { color: var(--primary); }

  /* ── Section ── */
  .section {
    margin-bottom: 18px;
    break-inside: avoid;
  }
  .section-title {
    font-size: 10pt;
    font-weight: 700;
    color: #fff;
    background: var(--primary);
    padding: 5px 10px;
    border-radius: 4px;
    margin-bottom: 10px;
    letter-spacing: 0.3px;
  }

  /* ── Field Grid ── */
  .field-grid {
    display: grid;
    gap: 10px 14px;
  }
  .col-1 { grid-template-columns: 1fr; }
  .col-2 { grid-template-columns: 1fr 1fr; }
  .col-3 { grid-template-columns: 1fr 1fr 1fr; }

  .field { display: flex; flex-direction: column; }
  .field label {
    font-size: 8pt;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 3px;
  }
  .field label .req { color: #ef4444; margin-left: 2px; }
  .field .input-line {
    border: none;
    border-bottom: 1.5px solid #cbd5e1;
    height: 22px;
    width: 100%;
    background: transparent;
  }
  .field .input-box {
    border: 1.5px solid #cbd5e1;
    border-radius: 4px;
    height: 58px;
    width: 100%;
    background: transparent;
  }

  /* ── Checkbox / Radio Grid ── */
  .check-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin-top: 6px;
  }
  .check-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 9pt;
    color: #334155;
  }
  .check-box {
    width: 13px;
    height: 13px;
    border: 1.5px solid #94a3b8;
    border-radius: 2px;
    display: inline-block;
    flex-shrink: 0;
  }
  .radio-box {
    width: 13px;
    height: 13px;
    border: 1.5px solid #94a3b8;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }

  /* ── Pricing Table ── */
  .pricing-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin-top: 6px;
  }
  .pricing-table th {
    background: var(--primary);
    color: #fff;
    padding: 5px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 8.5pt;
  }
  .pricing-table td {
    padding: 6px 8px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: middle;
  }
  .pricing-table tr:nth-child(even) td { background: #f8fafc; }
  .pricing-table .amount-line {
    border-bottom: 1px solid #94a3b8;
    display: inline-block;
    width: 80px;
    height: 16px;
  }

  /* ── Days Table (availability) ── */
  .avail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin-top: 6px;
  }
  .avail-table th {
    background: var(--primary);
    color: #fff;
    padding: 5px 8px;
    font-size: 8.5pt;
    text-align: center;
  }
  .avail-table td {
    padding: 5px 8px;
    border-bottom: 1px solid #e2e8f0;
    text-align: center;
    vertical-align: middle;
  }
  .avail-table tr:nth-child(even) td { background: #f8fafc; }
  .avail-table .time-line {
    border-bottom: 1px solid #94a3b8;
    display: inline-block;
    width: 60px;
    height: 16px;
  }

  /* ── Declaration ── */
  .declaration {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px 14px;
    font-size: 8.5pt;
    color: #475569;
    line-height: 1.7;
    margin-top: 16px;
    break-inside: avoid;
  }
  .sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 16px;
  }
  .sig-box { display: flex; flex-direction: column; gap: 4px; }
  .sig-line {
    border-bottom: 1.5px solid #94a3b8;
    height: 40px;
    width: 100%;
  }
  .sig-label { font-size: 8pt; color: #64748b; margin-top: 4px; }

  /* ── Footer ── */
  .form-footer {
    margin-top: 18px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 8pt;
    color: #94a3b8;
    text-align: center;
    line-height: 1.6;
  }

  /* ── Office Use Box ── */
  .office-use {
    border: 1.5px dashed #94a3b8;
    border-radius: 6px;
    padding: 10px 14px;
    margin-top: 16px;
    break-inside: avoid;
  }
  .office-use .office-title {
    font-size: 8pt;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 8px;
  }

  @media print {
    body { padding: 0; }
    .page { padding: 12mm 14mm; width: 100%; }
    .no-print { display: none; }
  }
`;

// ── Colour Themes ──────────────────────────────────────────────────────────────

const HOSPITAL_THEME = `
  :root {
    --primary:    #0f3460;
    --accent:     #e94560;
    --banner-bg:  #eff6ff;
  }
`;

const DOCTOR_THEME = `
  :root {
    --primary:    #134e30;
    --accent:     #f0a500;
    --banner-bg:  #f0fdf4;
  }
`;

// ── Shared HTML helpers ────────────────────────────────────────────────────────

const field = (label, required = false, type = 'line', span = 1) => `
  <div class="field" style="grid-column: span ${span};">
    <label>${label}${required ? '<span class="req">*</span>' : ''}</label>
    ${type === 'line'
      ? '<div class="input-line"></div>'
      : '<div class="input-box"></div>'}
  </div>`;

const checkItem = (label, type = 'check') =>
  `<div class="check-item"><div class="${type === 'radio' ? 'radio-box' : 'check-box'}"></div>${label}</div>`;

const sectionOpen = (title) =>
  `<div class="section"><div class="section-title">${title}</div>`;

const sectionClose = () => `</div>`;

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL FORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {'hospital-manager' | 'doctor-owner'} managementModel
 * @returns {string} Full HTML string
 */
export function generateHospitalForm(managementModel = 'hospital-manager') {
  const isManaged = managementModel === 'hospital-manager';

  const typeLabel     = isManaged ? 'Managed Hospital' : 'Doctor-Owner Hospital (Clinic / Nursing Home)';
  const managerLabel  = isManaged ? 'Hospital Manager' : 'Owner-Doctor';
  const managerRole   = isManaged ? 'role: "hospital"' : 'role: "doctor"';
  const pricingNote   = isManaged
    ? 'Consultation pricing is set at the <strong>hospital level</strong> (Section 7). All linked doctors follow this pricing. platformFee is set by superadmin only.'
    : 'Consultation pricing is set at the <strong>doctor level</strong> (via DoctorProfile.fees). Section 7 is <strong>NOT applicable</strong> for this type.';

  const typeOptions = isManaged
    ? ['Multi-Specialty', 'Super-Specialty', 'Trust', 'Government']
    : ['Clinic', 'Nursing Home'];

  const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Likeson Healthcare — Hospital Registration Form (${managementModel})</title>
  <style>
    ${BASE_STYLES}
    ${HOSPITAL_THEME}
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="form-header">
    <div>
      <div class="brand">LIKESON<span>.</span>IN</div>
      <div style="font-size:8.5pt;color:#64748b;margin-top:3px;">Advanced Healthcare Logistics</div>
    </div>
    <div class="form-meta">
      <div><strong>Form Type:</strong> Hospital Registration</div>
      <div><strong>Management Model:</strong> ${managementModel}</div>
      <div><strong>Date:</strong> ${now}</div>
      <div><strong>Form Ref:</strong> HOSP-${managementModel === 'hospital-manager' ? 'MGR' : 'OWN'}-001</div>
    </div>
  </div>

  <div class="form-title">Hospital Registration Form</div>
  <div class="form-subtitle">${typeLabel} — ${managerLabel} Account (${managerRole})</div>

  <!-- INFO BANNER -->
  <div class="info-banner">
    <strong>Management Model: ${managementModel}</strong><br/>
    ${pricingNote}<br/>
    <strong>Note:</strong> Fields marked <span style="color:#ef4444;">*</span> are mandatory. Submit this form along with all required documents to the Likeson admin team.
  </div>

  <!-- SECTION 1: HOSPITAL IDENTITY -->
  ${sectionOpen('1. Hospital Identity')}
  <div class="field-grid col-2">
    ${field('Hospital / Clinic Name', true)}
    <div class="field">
      <label>Hospital Type <span class="req">*</span></label>
      <div class="check-grid" style="margin-top:6px;">
        ${typeOptions.map(t => checkItem(t, 'radio')).join('')}
      </div>
    </div>
    ${field('Year Established')}
    ${field('Website URL')}
    ${field('Description / Overview', false, 'box', 2)}
  </div>
  ${sectionClose()}

  <!-- SECTION 2: CONTACT -->
  ${sectionOpen('2. Contact Information')}
  <div class="field-grid col-3">
    ${field('Primary Phone', true)}
    ${field('Emergency Phone')}
    ${field('Alternate Phone')}
    ${field('Official Email')}
    ${field('WhatsApp Number')}
    ${field('Google Maps URL')}
  </div>
  ${sectionClose()}

  <!-- SECTION 3: ADDRESS -->
  ${sectionOpen('3. Address')}
  <div class="field-grid col-2">
    ${field('Address Line 1', true, 'line', 2)}
    ${field('Address Line 2 / Landmark')}
    ${field('City', true)}
    ${field('State', true)}
    ${field('PIN Code', true)}
    ${field('GPS Coordinates (lat, lng)')}
  </div>
  ${sectionClose()}

  <!-- SECTION 4: MANAGER ACCOUNT -->
  ${sectionOpen(`4. ${managerLabel} Account (${managerRole})`)}
  <div class="info-banner" style="margin-bottom:10px;">
    ${isManaged
      ? 'A <strong>User{ role: "hospital" }</strong> account will be created with these credentials. This user manages Hospital.consultationPricing for all linked doctors.'
      : 'A <strong>User{ role: "doctor" }</strong> account will be created. This doctor is also the owner of this Clinic/Nursing Home and controls their own pricing via DoctorProfile.fees.'}
  </div>
  <div class="field-grid col-3">
    ${field('Full Name', true)}
    ${field('Email Address', true)}
    ${field('Mobile Number')}
    ${isManaged ? field('Designation') : field('Medical Specialization', true)}
    ${isManaged ? field('Department') : field('Years of Experience', true)}
    ${isManaged ? field('Contact Person Email') : field('MCI / State Registration No.')}
  </div>
  ${sectionClose()}

  <!-- SECTION 5: REGISTRATION & LEGAL -->
  ${sectionOpen('5. Registration &amp; Legal Documents')}
  <div class="field-grid col-2">
    ${field('License / Registration Number', true)}
    ${field('License Expiry Date')}
    ${field('GST Number')}
    ${field('PAN Number')}
    ${field('NABH / NABL / ISO / JCI Accreditation No.')}
    ${field('Document Upload URL / Reference')}
  </div>
  <div style="margin-top:8px;">
    <label style="font-size:8pt;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Accreditations Held</label>
    <div class="check-grid" style="margin-top:6px;">
      ${['NABH', 'NABL', 'JCI', 'ISO', 'AHPI', 'Other'].map(a => checkItem(a)).join('')}
    </div>
  </div>
  ${sectionClose()}

  <!-- SECTION 6: FACILITIES & SERVICES -->
  ${sectionOpen('6. Facilities &amp; Services')}
  <div class="field-grid col-3">
    ${field('Total Bed Count')}
    ${field('ICU Bed Count')}
    ${field('Specialties Offered (comma separated)', false, 'line', 1)}
  </div>
  <div style="margin-top:10px;">
    <label style="font-size:8pt;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Facility Flags</label>
    <div class="check-grid" style="margin-top:6px;">
      ${['24×7 Open', 'ICU Available', 'Emergency Ready', 'Blood Bank', 'Pharmacy', 'Diagnostics / Lab', 'Ambulance', 'Wheelchair Access', 'NABL Lab Available'].map(f => checkItem(f)).join('')}
    </div>
  </div>
  <div style="margin-top:10px;">
    <label style="font-size:8pt;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Government Schemes / TPA Accepted</label>
    <div class="check-grid" style="margin-top:6px;">
      ${['Ayushman Bharat', 'CGHS', 'ECHS', 'ESI', 'Arogyasri', 'Other (specify below)'].map(f => checkItem(f)).join('')}
    </div>
    <div style="margin-top:8px;">${field('Other Schemes / TPA')}</div>
  </div>
  ${sectionClose()}

  <!-- SECTION 7: CONSULTATION PRICING (managed only) -->
  ${sectionOpen(`7. Consultation Pricing ${isManaged ? '(Hospital-Level — Managed Type)' : '(N/A for Doctor-Owner Type)'}`)}
  ${isManaged ? `
  <div class="info-banner" style="margin-bottom:10px;">
    These prices apply to <strong>all doctors</strong> linked to this hospital. Doctor-level fees are ignored for hospital-manager type.
    <strong>platformFee is set by superadmin only</strong> — leave blank.
  </div>
  <table class="pricing-table">
    <thead>
      <tr>
        <th>Consultation Type</th>
        <th>Enabled?</th>
        <th>Fee Charged to Patient (₹)</th>
        <th>Doctor Honorarium (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>In-Person Consultation</td>
        <td><div class="check-box"></div></td>
        <td><div class="amount-line"></div></td>
        <td><div class="amount-line"></div></td>
      </tr>
      <tr>
        <td>Video Consultation</td>
        <td><div class="check-box"></div></td>
        <td><div class="amount-line"></div></td>
        <td><div class="amount-line"></div></td>
      </tr>
      <tr>
        <td>Home Visit</td>
        <td><div class="check-box"></div></td>
        <td><div class="amount-line"></div></td>
        <td><div class="amount-line"></div></td>
      </tr>
    </tbody>
  </table>
  <div class="field-grid col-3" style="margin-top:12px;">
    ${field('Follow-Up Fee (₹, 0 = free)')}
    ${field('Follow-Up Discount (%)')}
    ${field('Follow-Up Valid Days (1–90)')}
  </div>
  ` : `
  <div class="info-banner">
    ✖ Not applicable. This Clinic / Nursing Home uses <strong>doctor-level pricing</strong> (DoctorProfile.fees).
    Complete the doctor's fees in the separate Doctor Registration Form.
  </div>
  `}
  ${sectionClose()}

  <!-- SECTION 8: OPERATING HOURS -->
  ${sectionOpen('8. Operating Hours')}
  <table class="avail-table">
    <thead>
      <tr>
        <th>Day</th>
        <th>Open (✓)</th>
        <th>24 Hours (✓)</th>
        <th>Open Time (HH:MM)</th>
        <th>Close Time (HH:MM)</th>
      </tr>
    </thead>
    <tbody>
      ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => `
      <tr>
        <td style="text-align:left;font-weight:600;">${d}</td>
        <td><div class="check-box" style="margin:0 auto;"></div></td>
        <td><div class="check-box" style="margin:0 auto;"></div></td>
        <td><div class="time-line"></div></td>
        <td><div class="time-line"></div></td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${sectionClose()}

  <!-- SECTION 9: SETTLEMENT -->
  ${sectionOpen('9. Settlement &amp; Banking (Admin Fills)')}
  <div class="info-banner" style="margin-bottom:10px;">
    Settlement cycle and platform fee are set by admin / superadmin. Hospital manager does <strong>not</strong> fill this section.
  </div>
  <div class="field-grid col-3">
    <div class="field">
      <label>Settlement Cycle</label>
      <div class="check-grid" style="margin-top:6px;">
        ${['Weekly','Bi-weekly','Monthly'].map(c => checkItem(c, 'radio')).join('')}
      </div>
    </div>
    ${field('Platform Fee Type (fixed / percentage)')}
    ${field('Platform Fee Value')}
  </div>
  ${sectionClose()}

  <!-- DECLARATION -->
  <div class="declaration">
    <strong>Declaration:</strong> I / We hereby declare that all information furnished in this form is true, accurate and complete to the best of my / our knowledge. I / We authorise Likeson Healthcare to verify the documents submitted and to create login credentials for the above-mentioned manager/owner account. I / We agree to abide by Likeson's Partner Terms &amp; Conditions.
  </div>

  <!-- SIGNATURES -->
  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Authorised Signatory — Name &amp; Designation</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Hospital Seal &amp; Date</div>
    </div>
  </div>

  <!-- OFFICE USE -->
  <div class="office-use">
    <div class="office-title">For Office Use Only</div>
    <div class="field-grid col-3">
      ${field('Received By')}
      ${field('Received Date')}
      ${field('Hospital ID (auto)')}
      ${field('Manager User ID (auto)')}
      ${field('Verified By')}
      ${field('Verification Date')}
    </div>
  </div>

  <!-- FOOTER -->
  <div class="form-footer">
    Likeson.in · Advanced Healthcare Logistics · support@likeson.in<br/>
    Form: HOSP-${managementModel === 'hospital-manager' ? 'MGR' : 'OWN'}-001 · Management Model: <strong>${managementModel}</strong> · Generated ${now}
  </div>

</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR FORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {'hospital-manager' | 'doctor-owner'} managementModel
 * @returns {string} Full HTML string
 */
export function generateDoctorForm(managementModel = 'doctor-owner') {
  const isManaged = managementModel === 'hospital-manager';

  const formSubtitle = isManaged
    ? 'Hospital-Affiliated Doctor — Fees set by Hospital Manager'
    : 'Owner / Independent Doctor — Doctor controls own Fees';

  const pricingNote = isManaged
    ? 'Consultation fees for this doctor are <strong>set at the hospital level</strong> (Hospital.consultationPricing). The doctor controls only their <strong>weekly availability / slots</strong>. Section 6 (Fees) is <strong>informational only</strong> and has no billing effect while affiliated.'
    : 'This doctor <strong>owns and manages</strong> a Clinic or Nursing Home. Fees entered in Section 6 are the <strong>active billing fees</strong> (DoctorProfile.fees).';

  const specializations = [
    'General Physician','Cardiologist','Neurologist','Pediatrician',
    'Oncologist','Orthopedic Surgeon','Gastroenterologist','Gynecologist',
    'Dermatologist','Urologist','Psychiatry','Physiotherapist',
  ];

  const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Likeson Healthcare — Doctor Registration Form (${managementModel})</title>
  <style>
    ${BASE_STYLES}
    ${DOCTOR_THEME}
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="form-header">
    <div>
      <div class="brand">LIKESON<span>.</span>IN</div>
      <div style="font-size:8.5pt;color:#64748b;margin-top:3px;">Advanced Healthcare Logistics</div>
    </div>
    <div class="form-meta">
      <div><strong>Form Type:</strong> Doctor Registration</div>
      <div><strong>Management Model:</strong> ${managementModel}</div>
      <div><strong>Date:</strong> ${now}</div>
      <div><strong>Form Ref:</strong> DOC-${managementModel === 'hospital-manager' ? 'AFF' : 'OWN'}-001</div>
    </div>
  </div>

  <div class="form-title">Doctor Registration Form</div>
  <div class="form-subtitle">${formSubtitle}</div>

  <!-- INFO BANNER -->
  <div class="info-banner">
    <strong>Management Model: ${managementModel}</strong><br/>
    ${pricingNote}<br/>
    <strong>Note:</strong> Fields marked <span style="color:#ef4444;">*</span> are mandatory.
  </div>

  <!-- SECTION 1: PERSONAL DETAILS -->
  ${sectionOpen('1. Personal Details')}
  <div class="field-grid col-3">
    ${field('Full Name (as on Aadhaar)', true)}
    ${field('Date of Birth')}
    ${field('Gender')}
    ${field('Email Address', true)}
    ${field('Mobile Number', true)}
    ${field('Alternate Phone')}
  </div>
  ${sectionClose()}

  <!-- SECTION 2: PROFESSIONAL CREDENTIALS -->
  ${sectionOpen('2. Professional Credentials')}
  <div style="margin-bottom:8px;">
    <label style="font-size:8pt;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">
      Specialization <span style="color:#ef4444;">*</span>
    </label>
    <div class="check-grid" style="margin-top:6px;">
      ${specializations.map(s => checkItem(s, 'radio')).join('')}
    </div>
  </div>
  <div class="field-grid col-2" style="margin-top:8px;">
    ${field('Years of Experience', true)}
    ${field('MCI / State Medical Council Registration No.')}
    ${field('Registration Council / State')}
    ${field('Languages Spoken (comma separated)')}
  </div>
  <div style="margin-top:10px;">
    <label style="font-size:8pt;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">
      Consultation Types Offered ${isManaged ? '(synced from hospital for affiliated doctors)' : ''}
    </label>
    <div class="check-grid" style="margin-top:6px;">
      ${['In-Person', 'Video Consultation', 'Home Visit'].map(c => checkItem(c)).join('')}
    </div>
  </div>
  ${sectionClose()}

  <!-- SECTION 3: QUALIFICATIONS -->
  ${sectionOpen('3. Qualifications')}
  <table class="pricing-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Degree / Certificate</th>
        <th>Institution / College</th>
        <th>Year of Passing</th>
      </tr>
    </thead>
    <tbody>
      ${[1,2,3,4].map(n => `
      <tr>
        <td style="text-align:center;">${n}</td>
        <td><div class="amount-line" style="width:100%;"></div></td>
        <td><div class="amount-line" style="width:100%;"></div></td>
        <td><div class="amount-line" style="width:60px;"></div></td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${sectionClose()}

  <!-- SECTION 4: HOSPITAL AFFILIATION -->
  ${sectionOpen('4. Hospital Affiliation')}
  <div class="info-banner" style="margin-bottom:10px;">
    ${isManaged
      ? '<strong>Affiliated Doctor:</strong> Pricing is controlled by the hospital manager. The doctor\'s DoctorProfile.fees is informational only while this affiliation is active.'
      : '<strong>Owner-Doctor:</strong> This doctor is the owner/manager of a Clinic / Nursing Home. Hospital.managedBy → this doctor\'s User._id (managementModel: "doctor-owner").'}
  </div>
  <div class="field-grid col-2">
    ${field('Primary Hospital Name / ID', isManaged)}
    ${field('Other Hospital Affiliations')}
    ${isManaged ? field('Hospital License No. (cross-reference)') : field('Clinic / Nursing Home Name', true)}
    ${field('Partnership Status')}
  </div>
  ${sectionClose()}

  <!-- SECTION 5: KYC DOCUMENTS -->
  ${sectionOpen('5. KYC Documents')}
  <div class="field-grid col-2">
    ${field('Aadhaar Number (last 4 digits visible)', true)}
    ${field('Aadhaar Front Side URL / Ref')}
    ${field('Aadhaar Back Side URL / Ref')}
    ${field('PAN Card Number', true)}
    ${field('PAN Card URL / Ref')}
    ${field('MCI Certificate URL / Ref')}
  </div>
  ${sectionClose()}

  <!-- SECTION 6: CONSULTATION FEES -->
  ${sectionOpen(`6. Consultation Fees ${isManaged ? '(Informational — Hospital Controls Active Fees)' : '(Active Billing Fees — Doctor-Owner)'}`)}
  ${isManaged ? `
  <div class="info-banner" style="margin-bottom:10px;">
    ℹ️ These values are <strong>stored</strong> on DoctorProfile.fees but are <strong>NOT used for billing</strong> while affiliated with a hospital-manager type hospital.
    Active billing fees come from <strong>Hospital.consultationPricing</strong>.
  </div>` : `
  <div class="info-banner" style="margin-bottom:10px;">
    ✅ These values are the <strong>active billing fees</strong> (DoctorProfile.fees) used at booking time.
  </div>`}
  <table class="pricing-table">
    <thead>
      <tr>
        <th>Consultation Type</th>
        <th>Fee (₹)</th>
        <th>Follow-Up Fee (₹)</th>
        <th>Follow-Up Discount (%)</th>
        <th>Follow-Up Valid Days</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>In-Person</td>
        <td><div class="amount-line"></div></td>
        <td rowspan="3" style="text-align:center;vertical-align:middle;"><div class="amount-line"></div></td>
        <td rowspan="3" style="text-align:center;vertical-align:middle;"><div class="amount-line"></div></td>
        <td rowspan="3" style="text-align:center;vertical-align:middle;"><div class="amount-line"></div></td>
      </tr>
      <tr>
        <td>Video Consultation</td>
        <td><div class="amount-line"></div></td>
      </tr>
      <tr>
        <td>Home Visit</td>
        <td><div class="amount-line"></div></td>
      </tr>
    </tbody>
  </table>
  ${sectionClose()}

  <!-- SECTION 7: WEEKLY AVAILABILITY -->
  ${sectionOpen('7. Weekly Availability &amp; Slot Schedule')}
  <div class="info-banner" style="margin-bottom:10px;">
    ${isManaged
      ? 'Both hospital-manager and doctor-owner doctors manage their own slots. The hospital controls <strong>pricing only</strong>; the doctor controls <strong>availability</strong>.'
      : 'Set your weekly slot schedule. Each slot has a start time, end time and max patients. Slots within the same day must not overlap.'}
  </div>
  <table class="avail-table">
    <thead>
      <tr>
        <th>Day</th>
        <th>Available? (✓)</th>
        <th>Slot 1 Start</th>
        <th>Slot 1 End</th>
        <th>Max Patients</th>
        <th>Slot 2 Start</th>
        <th>Slot 2 End</th>
        <th>Max Patients</th>
      </tr>
    </thead>
    <tbody>
      ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => `
      <tr>
        <td style="text-align:left;font-weight:600;">${d}</td>
        <td><div class="check-box" style="margin:0 auto;"></div></td>
        <td><div class="time-line"></div></td>
        <td><div class="time-line"></div></td>
        <td><div class="time-line" style="width:40px;"></div></td>
        <td><div class="time-line"></div></td>
        <td><div class="time-line"></div></td>
        <td><div class="time-line" style="width:40px;"></div></td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${sectionClose()}

  <!-- SECTION 8: BANK DETAILS -->
  ${sectionOpen('8. Bank Details (for Settlement)')}
  <div class="field-grid col-3">
    ${field('Account Holder Name', true)}
    ${field('Bank Name', true)}
    ${field('Branch Name')}
    ${field('Account Number', true)}
    ${field('IFSC Code', true)}
    ${field('UPI ID')}
    ${field('GST Number (if applicable)')}
    ${field('Cancelled Cheque URL / Ref')}
    ${field('Settlement Cycle Preference')}
  </div>
  ${sectionClose()}

  <!-- SECTION 9: CONTACT PERSON -->
  ${sectionOpen('9. Authorised Contact Person')}
  <div class="field-grid col-2">
    ${field('Contact Person Name')}
    ${field('Designation')}
    ${field('Phone')}
    ${field('Email')}
  </div>
  ${sectionClose()}

  <!-- SECTION 10: BIO / PROFILE -->
  ${sectionOpen('10. Professional Profile')}
  ${field('Biography / About (max 1000 chars)', false, 'box', 1)}
  <div class="field-grid col-1" style="margin-top:8px;">
    ${field('Key Achievements / Awards (comma separated)')}
  </div>
  ${sectionClose()}

  <!-- DECLARATION -->
  <div class="declaration">
    <strong>Declaration:</strong> I hereby declare that all information furnished in this form is true, accurate and complete. I consent to Likeson Healthcare creating a partner account in my name and verifying my KYC documents. I agree to abide by the Likeson Partner Terms &amp; Conditions and understand that my consultation fees and billing model are governed by the management model indicated above.
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Doctor's Signature &amp; Date</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label">Witness / Hospital Seal &amp; Date</div>
    </div>
  </div>

  <!-- OFFICE USE -->
  <div class="office-use">
    <div class="office-title">For Office Use Only</div>
    <div class="field-grid col-3">
      ${field('Received By')}
      ${field('Received Date')}
      ${field('Doctor Profile ID (auto)')}
      ${field('User ID (auto)')}
      ${field('KYC Verified By')}
      ${field('KYC Verification Date')}
      ${field('Partnership Status Set')}
      ${field('Partner Since Date')}
      ${field('Admin Notes')}
    </div>
  </div>

  <div class="form-footer">
    Likeson.in · Advanced Healthcare Logistics · support@likeson.in<br/>
    Form: DOC-${managementModel === 'hospital-manager' ? 'AFF' : 'OWN'}-001 · Management Model: <strong>${managementModel}</strong> · Generated ${now}
  </div>

</div>
</body>
</html>`;
}