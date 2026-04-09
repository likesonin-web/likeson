/**
 * form.utils.js — Likeson Healthcare
 * Generates printable HTML registration forms (Hospital & Doctor) as full HTML strings.
 * QR codes are rendered via the `qrcode` npm package (import QRCode from 'qrcode').
 *
 * Usage:
 *   import { generateForm } from './form.utils.js';
 *   const html = await generateForm('hospital-manager');
 *   // then write html to a file, serve it, or open it in a browser
 *
 * Supported formType values:
 *   'hospital-manager'   → Hospital Registration (Multi-Specialty / Super-Specialty / Trust / Government)
 *   'hospital-doctor-owner' → Hospital Registration (Clinic / Nursing Home, Doctor-Owner)
 *   'doctor-hospital'    → Doctor Registration (Hospital-Manager Affiliated)
 *   'doctor-owner'       → Doctor Registration (Doctor-Owner, Clinic / Nursing Home)
 */

import QRCode from 'qrcode';

// ─────────────────────────────────────────────
// QR HELPER
// ─────────────────────────────────────────────

/**
 * Returns a base64 PNG data-URI for the given URL string.
 * @param {string} url
 * @returns {Promise<string>} data:image/png;base64,...
 */
async function generateQRDataURL(url) {
  return QRCode.toDataURL(url, {
    width: 120,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// ─────────────────────────────────────────────
// SHARED CSS
// ─────────────────────────────────────────────

/**
 * Returns the shared base CSS string.
 * @param {'green'|'navy'} theme
 */
function baseCSS(theme) {
  const isGreen = theme === 'green';
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      ${isGreen ? `
      --primary: #134e30;
      --mid:     #1a6b40;
      --accent:  #f0a500;
      --light:   #e8f5ee;
      --border:  #b0d9c0;
      --text:    #0d2d1a;
      --muted:   #5a8070;
      --bg:      #f2fbf5;
      --dash:    #90c4a8;
      --red:     #e94560;
      ` : `
      --primary: #0f3460;
      --mid:     #1a4a80;
      --accent:  #e94560;
      --light:   #eef4ff;
      --border:  #c8d8f0;
      --text:    #1a1a2e;
      --muted:   #7a8cb0;
      --bg:      #f5f8ff;
      --dash:    #b0c4e8;
      --red:     #e94560;
      `}
      --white:   #ffffff;
    }
    body { font-family: 'Poppins', sans-serif; background: var(--bg); color: var(--text); font-size: 11px; line-height: 1.5; }
    .page { width: 794px; min-height: 1123px; margin: 0 auto; background: var(--white); padding: 28px 32px 36px; }

    /* HEADER */
    .header { background: var(--primary); border-radius: 10px; display: flex; align-items: stretch; overflow: hidden; margin-bottom: 14px; }
    .header-left { flex: 1; padding: 18px 22px; }
    .brand-name { font-size: 18px; font-weight: 700; color: var(--white); letter-spacing: 0.5px; }
    .brand-tagline { font-size: 8.5px; color: ${isGreen ? '#90cca8' : '#99bbdd'}; margin-top: 2px; font-weight: 300; }
    .form-title { font-size: 14px; font-weight: 600; color: var(--accent); margin-top: 10px; }
    .form-subtitle { font-size: 8px; color: ${isGreen ? '#80aa90' : '#88aacc'}; margin-top: 3px; font-weight: 400; }
    .header-right { width: 90px; background: rgba(255,255,255,0.06); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px; border-left: 1px solid rgba(255,255,255,0.1); }
    .qr-box { width: 62px; height: 62px; background: var(--white); border: 2px solid var(--accent); border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .qr-box img { width: 100%; height: 100%; object-fit: contain; }
    .qr-label { font-size: 7px; color: ${isGreen ? '#90cca8' : '#aac4e0'}; margin-top: 5px; text-align: center; font-weight: 500; }

    /* INSTRUCTION */
    .instr { background: var(--light); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 6px; padding: 8px 12px; font-size: 8.5px; color: ${isGreen ? '#1a4030' : '#3a4a6a'}; margin-bottom: 14px; }
    .instr strong { font-weight: 600; }

    /* SECTIONS */
    .section { margin-bottom: 12px; break-inside: avoid; }
    .section-title { font-size: 10.5px; font-weight: 600; color: var(--primary); background: var(--light); padding: 6px 10px; border-radius: 5px 5px 0 0; border-bottom: 2px solid var(--accent); letter-spacing: 0.2px; }
    .section-body { border: 1px solid var(--border); border-top: none; border-radius: 0 0 6px 6px; padding: 10px 10px 6px; background: var(--white); }

    /* FIELDS */
    .row { display: flex; gap: 8px; margin-bottom: 8px; }
    .field { flex: 1; display: flex; flex-direction: column; }
    .field-full { width: 100%; display: flex; flex-direction: column; margin-bottom: 8px; }
    .field-label { font-size: 8.5px; font-weight: 600; color: var(--primary); margin-bottom: 4px; }
    .req { color: var(--red); margin-left: 2px; }
    .field-input { border: none; border-bottom: 1.5px dashed var(--dash); height: 26px; background: transparent; font-family: 'Poppins', sans-serif; font-size: 10px; }
    .field-input-tall { border: 1.5px dashed var(--dash); border-radius: 4px; min-height: 44px; background: transparent; }
    .field-note { font-size: 7.5px; color: var(--muted); margin-top: 2px; }

    /* CHECKBOXES */
    .checkbox-label { font-size: 8.5px; font-weight: 600; color: var(--primary); margin-bottom: 5px; }
    .checkbox-grid { display: grid; gap: 4px 8px; border: 1.5px dashed var(--dash); border-radius: 4px; padding: 6px 8px; margin-bottom: 8px; }
    .checkbox-grid.cols3 { grid-template-columns: repeat(3, 1fr); }
    .checkbox-grid.cols4 { grid-template-columns: repeat(4, 1fr); }
    .checkbox-grid.cols6 { grid-template-columns: repeat(6, 1fr); }
    .check-item { display: flex; align-items: center; gap: 5px; font-size: 8.5px; color: var(--text); }
    .check-box { width: 11px; height: 11px; border: 1.5px solid var(--border); border-radius: 2px; flex-shrink: 0; background: var(--bg); }

    /* TABLE */
    .tbl { width: 100%; border-collapse: collapse; font-size: 8.5px; margin-bottom: 8px; border-radius: 5px; overflow: hidden; }
    .tbl th { background: var(--primary); color: var(--white); font-weight: 600; padding: 6px 8px; text-align: left; font-size: 8px; }
    .tbl td { padding: 5px 8px; border-bottom: 1px solid var(--border); font-size: 8.5px; }
    .tbl tr:nth-child(even) td { background: var(--bg); }
    .tbl tr:nth-child(odd)  td { background: var(--white); }
    .tbl .write-line { border-bottom: 1.5px dashed var(--dash); min-width: 70px; display: block; height: 16px; }
    .tbl .cb { text-align: center; }

    /* NOTES */
    .info-note { background: #fff8e6; border: 1px solid #f5d98b; border-left: 3px solid #f0a500; border-radius: 4px; padding: 7px 10px; font-size: 8px; color: #5a4000; margin-bottom: 8px; line-height: 1.6; }
    .skip-note { background: #ffeaea; border: 1px solid #f5b0b0; border-left: 3px solid #e94560; border-radius: 4px; padding: 7px 10px; font-size: 8px; color: #5a0000; margin-bottom: 8px; }

    /* DECLARATION & SIGNATURE */
    .decl { background: var(--light); border: 1px dashed var(--border); border-radius: 5px; padding: 9px 12px; font-size: 8px; color: ${isGreen ? '#1a4030' : '#3a4a6a'}; margin-bottom: 10px; line-height: 1.6; }
    .sig-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .sig-box { flex: 1; border: 1.5px dashed var(--dash); border-radius: 5px; height: 56px; display: flex; flex-direction: column; justify-content: flex-end; padding: 5px 8px; background: var(--bg); }
    .sig-title { font-size: 7.5px; font-weight: 600; color: var(--muted); }

    /* FOOTER */
    .footer { border-top: 1px solid var(--border); margin-top: 20px; padding-top: 8px; text-align: center; font-size: 7.5px; color: var(--muted); }

    @media print { body { background: white; } .page { box-shadow: none; margin: 0; } @page { margin: 0; size: A4; } }
  `;
}

// ─────────────────────────────────────────────
// HTML SHELL
// ─────────────────────────────────────────────

function htmlShell(title, css, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// SHARED BUILDING-BLOCK HELPERS
// ─────────────────────────────────────────────

function header(qrDataURL, brandName, tagline, formTitle, subtitle) {
  return `
  <div class="header">
    <div class="header-left">
      <div class="brand-name">${brandName}</div>
      <div class="brand-tagline">${tagline}</div>
      <div class="form-title">${formTitle}</div>
      <div class="form-subtitle">${subtitle}</div>
    </div>
    <div class="header-right">
      <div class="qr-box">
        <img src="${qrDataURL}" alt="QR Code">
      </div>
      <div class="qr-label">Scan to register<br>online</div>
    </div>
  </div>`;
}

function instructions(text) {
  return `<div class="instr">${text}</div>`;
}

function section(num, title, body) {
  return `
  <div class="section">
    <div class="section-title">${num}. ${title}</div>
    <div class="section-body">${body}</div>
  </div>`;
}

function fieldFull(label, req, note, tall = false) {
  const reqMark = req ? `<span class="req">*</span>` : '';
  const inputEl = tall
    ? `<div class="field-input-tall"></div>`
    : `<div class="field-input"></div>`;
  const noteEl = note ? `<div class="field-note">${note}</div>` : '';
  return `
    <div class="field-full">
      <div class="field-label">${label} ${reqMark}</div>
      ${inputEl}
      ${noteEl}
    </div>`;
}

function fieldInline(label, req, note, tall = false) {
  const reqMark = req ? `<span class="req">*</span>` : '';
  const inputEl = tall
    ? `<div class="field-input-tall"></div>`
    : `<div class="field-input"></div>`;
  const noteEl = note ? `<div class="field-note">${note}</div>` : '';
  return `
    <div class="field">
      <div class="field-label">${label} ${reqMark}</div>
      ${inputEl}
      ${noteEl}
    </div>`;
}

function row(...fields) {
  return `<div class="row">${fields.join('')}</div>`;
}

function checkboxGrid(label, cols, items, req = false) {
  const reqMark = req ? `<span style="color:var(--red)">*</span>` : '';
  const colClass = `cols${cols}`;
  const checkItems = items
    .map(item => `<div class="check-item"><div class="check-box"></div>${item}</div>`)
    .join('');
  return `
    <div class="checkbox-label">${label} ${reqMark}</div>
    <div class="checkbox-grid ${colClass}">${checkItems}</div>`;
}

function writeLine() {
  return `<span class="write-line"></span>`;
}

function infoNote(html) {
  return `<div class="info-note">${html}</div>`;
}

function skipNote(html) {
  return `<div class="skip-note">${html}</div>`;
}

function declarationSection(declarationText, sigRows) {
  const sigRowsHTML = sigRows
    .map(row => {
      const boxes = row
        .map(({ label, height }) =>
          `<div class="sig-box"${height ? ` style="height:${height}px"` : ''}><div class="sig-title">${label}</div></div>`
        )
        .join('');
      return `<div class="sig-row">${boxes}</div>`;
    })
    .join('');
  return `
  <div class="section">
    <div class="section-title">Declaration &amp; Signature</div>
    <div class="section-body">
      <div class="decl">${declarationText}</div>
      ${sigRowsHTML}
    </div>
  </div>`;
}

function footer(text) {
  return `<div class="footer">${text}</div>`;
}

// ─────────────────────────────────────────────
// SHARED SECTION BODIES
// ─────────────────────────────────────────────

function personalInfoBody() {
  return `
    ${fieldFull('Full Name', true, 'As per government-issued ID (include Dr. prefix)')}
    ${row(
      fieldInline('Email Address', true, 'Login credentials will be sent here'),
      fieldInline('Phone Number', false, '+91XXXXXXXXXX')
    )}
    ${row(
      fieldInline('Date of Birth', false, 'DD / MM / YYYY'),
      fieldInline('Gender', false, 'Male / Female / Other / Prefer not to say')
    )}
    ${fieldFull('Profile Photo URL / Attachment', false, 'JPG/PNG, min 400×400 px, professional photo on plain background')}
  `;
}

function professionalCredentialsBody(qualificationRows = 3) {
  const qRows = Array.from({ length: qualificationRows }, () =>
    `<tr><td>${writeLine()}</td><td>${writeLine()}</td><td>${writeLine()}</td></tr>`
  ).join('');

  return `
    ${checkboxGrid('Specialization (☑ one)', 4, [
      'General Physician', 'Cardiologist', 'Neurologist', 'Pediatrician',
      'Oncologist', 'Orthopedic Surgeon', 'Gastroenterologist', 'Gynecologist',
      'Dermatologist', 'Urologist', 'Psychiatry', 'Physiotherapist',
    ], true)}
    ${row(
      fieldInline('Years of Experience', true, 'Post-qualification clinical experience (0–70)'),
      fieldInline('Registration Number', false, 'MCI / State Medical Council Reg. No.')
    )}
    ${fieldFull('Registration Council', false, 'e.g. Andhra Pradesh Medical Council, NMC')}
    <div class="field-label" style="margin-bottom:6px">Qualifications (add rows as needed)</div>
    <table class="tbl">
      <thead>
        <tr>
          <th style="width:25%">Degree</th>
          <th style="width:50%">College / University</th>
          <th style="width:25%">Year of Passing</th>
        </tr>
      </thead>
      <tbody>${qRows}</tbody>
    </table>
    ${fieldFull('Biography / Professional Summary', false, 'Max 1000 characters — shown to patients on your public profile', true)}
    ${row(
      fieldInline('Languages Spoken', false, 'e.g. Telugu, English, Hindi'),
      fieldInline('Achievements / Awards', false, 'Notable recognitions, publications (comma-separated)')
    )}
  `;
}

function kycBody() {
  return `
    ${row(
      fieldInline('Aadhaar Number', false, '12-digit — will be masked after submission'),
      fieldInline('PAN Number', false, 'Format: AAAAA9999A')
    )}
    ${row(
      fieldInline('Aadhaar Front Side URL / Attachment', false, ''),
      fieldInline('Aadhaar Back Side URL / Attachment', false, '')
    )}
    ${fieldFull('PAN Card URL / Attachment', false, 'Self-attested copy required for settlement payout processing')}
  `;
}

function bankBody() {
  return `
    ${fieldFull('Account Holder Name', true, 'Exactly as per bank records')}
    ${row(
      fieldInline('Bank Account Number', true, 'Masked — only last 4 digits stored (accountLast4)'),
      fieldInline('IFSC Code', true, 'Format: ABCD0123456')
    )}
    ${row(
      fieldInline('Bank Name', false, ''),
      fieldInline('Branch Name', false, '')
    )}
    ${row(
      fieldInline('UPI ID', false, 'Optional — for instant payouts'),
      fieldInline('Settlement Cycle', false, 'Weekly / Bi-weekly / Monthly')
    )}
    ${fieldFull('Cancelled Cheque / Bank Document', false, 'Attach scanned copy or provide a secure document URL')}
  `;
}

function weeklyAvailabilityBody() {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const rows = days
    .map(d =>
      `<tr>
        <td>${d}</td>
        <td class="cb">☐ Yes &nbsp; ☐ No</td>
        <td>${writeLine()}</td>
        <td>${writeLine()}</td>
        <td>${writeLine()}</td>
      </tr>`
    )
    .join('');
  return `
    <div class="field-note" style="margin-bottom:8px">Fill time slots in 24-hour format e.g. 09:00 – 13:00. startTime must be before endTime; slots must not overlap.</div>
    <table class="tbl">
      <thead>
        <tr>
          <th style="width:15%">Day</th>
          <th style="width:14%" class="cb">Available?</th>
          <th style="width:26%">Slot 1 (HH:MM – HH:MM)</th>
          <th style="width:26%">Slot 2 (HH:MM – HH:MM)</th>
          <th style="width:19%">Max Patients / Slot</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function operatingHoursBody() {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const rows = days
    .map(d =>
      `<tr>
        <td>${d}</td>
        <td>${writeLine()}</td>
        <td>${writeLine()}</td>
        <td class="cb">☐</td>
        <td class="cb">☐</td>
      </tr>`
    )
    .join('');
  return `
    <table class="tbl">
      <thead>
        <tr>
          <th style="width:18%">Day</th>
          <th style="width:24%">Open Time (HH:MM)</th>
          <th style="width:24%">Close Time (HH:MM)</th>
          <th style="width:17%" class="cb">24 Hrs?</th>
          <th style="width:17%" class="cb">Closed?</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function hospitalIdentityBody() {
  return `
    ${fieldFull('Hospital Name', true, 'Full legal name as per registration certificate')}
    ${row(
      fieldInline('Hospital Type', true, 'Multi-Specialty / Super-Specialty / Trust / Government'),
      fieldInline('Year Established', false, 'e.g. 2005')
    )}
    ${fieldFull('Description / Tagline', false, 'Brief summary of services (max 200 characters)', true)}
    ${row(
      fieldInline('Google Maps URL', false, 'Paste direct Google Maps share link'),
      fieldInline('Logo (attach image)', false, 'JPG/PNG, min 200×200 px')
    )}
  `;
}

function clinicIdentityBody() {
  return `
    ${fieldFull('Clinic / Nursing Home Name', true, 'Full legal name as per registration certificate')}
    ${row(
      fieldInline('Type', true, 'Clinic / Nursing Home'),
      fieldInline('Year Established', false, 'e.g. 2010')
    )}
    ${fieldFull('Description / Tagline', false, 'Brief summary of services (max 200 characters)', true)}
    ${row(
      fieldInline('Google Maps URL', false, 'Paste direct Google Maps share link'),
      fieldInline('Logo (attach image)', false, 'JPG/PNG, min 200×200 px')
    )}
  `;
}

function hospitalContactBody() {
  return `
    ${row(
      fieldInline('Primary Phone', true, 'Include country code: +91XXXXXXXXXX'),
      fieldInline('Emergency Phone', false, '24×7 emergency line (if different)'),
      fieldInline('WhatsApp Number', false, '')
    )}
    ${row(
      fieldInline('Email Address', false, 'Official hospital email'),
      fieldInline('Website URL', false, 'https://...')
    )}
  `;
}

function clinicContactBody() {
  return `
    ${row(
      fieldInline('Primary Phone', true, '+91XXXXXXXXXX'),
      fieldInline('WhatsApp Number', false, ''),
      fieldInline('Email Address', false, '')
    )}
    ${row(
      fieldInline('Website URL', false, 'https://...'),
      `<div class="field"></div>`
    )}
  `;
}

function addressBody(defaultCity = 'Vijayawada', defaultState = 'Andhra Pradesh') {
  return `
    ${fieldFull('Address Line 1', true, 'Building/plot number and street')}
    ${fieldFull('Address Line 2', false, 'Area / Colony / Landmark')}
    ${row(
      fieldInline('City', true, `Default: ${defaultCity}`),
      fieldInline('State', true, `Default: ${defaultState}`),
      fieldInline('PIN Code', true, '6-digit Indian PIN code')
    )}
  `;
}

function legalDocsBody() {
  return `
    ${row(
      fieldInline('License Number', true, 'State health authority registration number (must be unique)'),
      fieldInline('License Expiry Date', false, 'DD / MM / YYYY')
    )}
    ${row(
      fieldInline('GST Number', false, '15-digit GSTIN (if applicable)'),
      fieldInline('PAN Number', false, 'Format: AAAAA9999A — required for settlement payouts')
    )}
    ${fieldFull('Document URL / Attachment', false, 'Share a Google Drive / Dropbox link OR attach physical copy')}
    ${checkboxGrid('Accreditations (☑ all that apply)', 6, ['NABH', 'NABL', 'JCI', 'ISO', 'AHPI', 'Other'])}
  `;
}

function hospitalServicesBody() {
  return `
    ${fieldFull('Specialties Offered', false, 'Comma-separated: Cardiology, Neurology, Orthopedics...', true)}
    ${fieldFull('Facilities Available', false, 'e.g. MRI, CT Scan, Blood Bank, Pharmacy, ICU, NICU...', true)}
    ${fieldFull('Accepted Government Schemes', false, 'e.g. PMJAY, Aarogyasri, ESI, CGHS, ECHS...')}
    ${row(
      fieldInline('Total Bed Count', false, 'bedCount.total'),
      fieldInline('ICU Bed Count', false, 'bedCount.icu — sets hasICU flag automatically')
    )}
    ${checkboxGrid('Facility Flags (☑ all that apply)', 3, [
      'Emergency Ready', 'ICU', 'Blood Bank',
      'Pharmacy', 'Diagnostics / Lab', 'Ambulance',
      'Wheelchair Access', '24×7 Operations (is24x7)', 'NABL Lab Available',
    ])}
  `;
}

function clinicServicesBody() {
  return `
    ${fieldFull('Specialties Offered', false, 'Comma-separated: General Medicine, Dermatology...', true)}
    ${fieldFull('Facilities Available', false, 'e.g. Lab, Pharmacy, X-Ray...')}
    ${checkboxGrid('Facility Flags (☑ all that apply)', 3, [
      'Emergency Ready', 'Pharmacy', 'Diagnostics / Lab',
      'Ambulance', 'Wheelchair Access', '24×7 Operations',
    ])}
  `;
}

// ─────────────────────────────────────────────
// FORM BUILDERS
// ─────────────────────────────────────────────

/**
 * Hospital Registration Form — hospital-manager model
 * (Multi-Specialty / Super-Specialty / Trust / Government)
 */
async function buildHospitalManagerForm(qrDataURL) {
  const consultationPricingBody = `
    ${infoNote(`<strong>Note:</strong> For hospital-manager hospitals, ALL doctor consultation fees are set at the hospital level.
    Individual doctors cannot override these prices.
    The platform fee within this section can only be set/overridden by Superadmin. <em>(Schema: Hospital.consultationPricing)</em>`)}
    <table class="tbl">
      <thead>
        <tr>
          <th style="width:28%">Consultation Type</th>
          <th style="width:24%">Charge to Patient (₹)</th>
          <th style="width:24%">Doctor Honorarium (₹)</th>
          <th style="width:24%" class="cb">Offered?</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>In-Person</td><td>${writeLine()}</td><td>${writeLine()}</td><td class="cb">☐</td></tr>
        <tr><td>Video / Tele</td><td>${writeLine()}</td><td>${writeLine()}</td><td class="cb">☐</td></tr>
        <tr><td>Home Visit</td><td>${writeLine()}</td><td>${writeLine()}</td><td class="cb">☐</td></tr>
      </tbody>
    </table>
    ${row(
      fieldInline('Follow-Up Fee (₹)', false, '0 = free follow-up within validity window'),
      fieldInline('Follow-Up Discount (%)', false, 'e.g. 20 — % off from full fee (0–100)'),
      fieldInline('Follow-Up Valid Days', false, '1–90 days after first consultation')
    )}
    ${row(
      fieldInline('Settlement Cycle', false, 'Select: Weekly / Bi-weekly / Monthly'),
      `<div class="field"></div>`
    )}
  `;

  const hospitalManagerAccountBody = `
    ${infoNote(`Login credentials will be emailed automatically. <strong>User.role = "hospital"</strong> — only for Multi-Specialty / Super-Specialty / Trust / Government hospitals.`)}
    ${fieldFull('Full Name', true, '')}
    ${row(
      fieldInline('Email Address', true, 'Login credentials will be sent here'),
      fieldInline('Phone Number', false, '+91XXXXXXXXXX')
    )}
  `;

  const sections = [
    section(1, 'Hospital Identity', hospitalIdentityBody()),
    section(2, 'Contact Details', hospitalContactBody()),
    section(3, 'Address', addressBody()),
    section(4, 'Registration &amp; Legal Documents', legalDocsBody()),
    section(5, 'Services &amp; Facilities', hospitalServicesBody()),
    section(6, 'Operating Hours', operatingHoursBody()),
    section(7, `Consultation Pricing &nbsp;<span style="font-size:8px;font-weight:400;color:var(--accent)">(Hospital-Manager Type — fees set at hospital level)</span>`, consultationPricingBody),
    section(8, `Hospital Manager Account Details &nbsp;<span style="font-size:8px;font-weight:400;color:var(--muted)">(Role: "hospital" — managed hospital types only)</span>`, hospitalManagerAccountBody),
    section(9, 'Bank &amp; Settlement Details', bankBody()),
  ].join('');

  const decl = declarationSection(
    `I / We hereby certify that the information provided in this form is true, accurate, and complete to the best of my / our knowledge.
     I authorise Likeson Healthcare to verify all details and documents submitted.
     I agree to the Likeson Healthcare Partner Terms &amp; Conditions available at <strong>likeson.in/terms</strong>.`,
    [
      [
        { label: 'Authorised Signatory Name' },
        { label: 'Designation' },
        { label: 'Date (DD/MM/YYYY)' },
      ],
      [
        { label: 'Signature', height: 64 },
        { label: 'Hospital Seal / Stamp', height: 64 },
        { label: '', height: 64 },
      ],
    ]
  );

  const body = [
    header(qrDataURL, 'LIKESON HEALTHCARE', 'Advanced Healthcare Logistics Platform · likeson.in',
      'Hospital Registration Form',
      'Management Type: Multi-Specialty / Super-Specialty / Trust / Government &nbsp;·&nbsp; Model: hospital-manager'),
    instructions(`<strong>Instructions:</strong> Complete all fields marked <strong style="color:var(--accent)">*</strong>. Write in block letters. Attach self-attested document copies. Submit to your assigned Likeson Healthcare representative or scan the QR code to register online.`),
    sections,
    decl,
    footer('Likeson Healthcare &nbsp;·&nbsp; likeson.in &nbsp;·&nbsp; support@likeson.in &nbsp;·&nbsp; Hospital Onboarding Form v1.0 &nbsp;·&nbsp; Model: hospital-manager'),
  ].join('');

  return htmlShell(
    'Hospital Registration Form – Likeson Healthcare',
    baseCSS('navy'),
    body
  );
}

/**
 * Hospital Registration Form — doctor-owner model
 * (Clinic / Nursing Home)
 */
async function buildHospitalDoctorOwnerForm(qrDataURL) {
  const ownerDoctorAccountBody = `
    ${infoNote(`<strong>Note:</strong> The owner-doctor uses <strong>User.role = "doctor"</strong> — NOT "hospital".
    Pricing for this Clinic/Nursing Home is set at the doctor's profile level (<code>DoctorProfile.fees</code>), not at the hospital level.
    Fill in the Doctor Registration Form as well.`)}
    ${fieldFull('Owner Doctor Full Name', true, '')}
    ${row(
      fieldInline('Email Address', true, 'Login credentials will be sent here'),
      fieldInline('Phone Number', false, '+91XXXXXXXXXX')
    )}
  `;

  const sections = [
    section(1, 'Clinic / Nursing Home Identity', clinicIdentityBody()),
    section(2, 'Contact Details', clinicContactBody()),
    section(3, 'Address', addressBody()),
    section(4, 'Registration &amp; Legal Documents', legalDocsBody()),
    section(5, 'Services &amp; Facilities', clinicServicesBody()),
    section(6, 'Operating Hours', operatingHoursBody()),
    section(7, `Owner-Doctor Account Details &nbsp;<span style="font-size:8px;font-weight:400;color:var(--muted)">(Role: "doctor" — owns &amp; manages this Clinic/Nursing Home)</span>`, ownerDoctorAccountBody),
    section(8, 'Bank &amp; Settlement Details', bankBody()),
  ].join('');

  const decl = declarationSection(
    `I / We hereby certify that the information provided in this form is true, accurate, and complete.
     I authorise Likeson Healthcare to verify all details and documents submitted.
     I agree to the Partner Terms &amp; Conditions at <strong>likeson.in/terms</strong>.`,
    [
      [
        { label: 'Owner-Doctor Full Name' },
        { label: 'Designation' },
        { label: 'Date (DD/MM/YYYY)' },
      ],
      [
        { label: 'Signature with Stamp', height: 64 },
        { label: '', height: 64 },
        { label: '', height: 64 },
      ],
    ]
  );

  const body = [
    header(qrDataURL, 'LIKESON HEALTHCARE', 'Advanced Healthcare Logistics Platform · likeson.in',
      'Hospital Registration Form',
      'Management Type: Clinic / Nursing Home (Doctor-Owner) &nbsp;·&nbsp; Model: doctor-owner'),
    instructions(`<strong>Instructions:</strong> Complete all fields marked <strong style="color:var(--accent)">*</strong>. Write in block letters. Attach self-attested document copies. Submit to your assigned Likeson Healthcare representative or scan the QR code to register online.`),
    sections,
    decl,
    footer('Likeson Healthcare &nbsp;·&nbsp; likeson.in &nbsp;·&nbsp; support@likeson.in &nbsp;·&nbsp; Hospital Onboarding Form v1.0 &nbsp;·&nbsp; Model: doctor-owner'),
  ].join('');

  return htmlShell(
    'Hospital Registration Form (Clinic / Nursing Home) – Likeson Healthcare',
    baseCSS('navy'),
    body
  );
}

/**
 * Doctor Registration Form — hospital-manager affiliated
 */
async function buildDoctorHospitalForm(qrDataURL) {
  const affiliationBody = `
    ${infoNote(`<strong>Hospital-Affiliated Doctor:</strong> Consultation fees are set by the hospital (<code>Hospital.consultationPricing</code>).
    Your <code>DoctorProfile.fees</code> is not used for billing. You still control your own availability/slots.`)}
    ${fieldFull('Primary Hospital Name', true, 'The managed hospital you are affiliated with (primaryHospital)')}
    ${fieldFull('Other Hospital(s)', false, 'Comma-separated — additional hospitals where you also practice (otherHospitals[])')}
    ${checkboxGrid('Consultation Types Offered (☑ all that apply)', 3, [
      'In-Person Consultation', 'Video / Tele Consultation', 'Home Visit',
    ])}
  `;

  const feesBody = `
    ${skipNote(`<strong>⚠ Skip this section.</strong> You are affiliated with a hospital-manager hospital.
    All consultation fees (inPerson, video, homeVisit, followUp) are set by the hospital manager via
    <code>Hospital.consultationPricing</code>. Your <code>DoctorProfile.fees</code> is informational only and will not affect billing.`)}
  `;

  const availTitle = `Weekly Availability &nbsp;<span style="font-size:8px;font-weight:400;color:var(--muted)">(weeklyAvailability — you control this independently)</span>`;

  const sections = [
    section(1, 'Personal Information', personalInfoBody()),
    section(2, 'Professional Credentials', professionalCredentialsBody(3)),
    section(3, 'Hospital Affiliation', affiliationBody),
    section(4, `Consultation Fees &nbsp;<span style="font-size:8px;font-weight:400;color:var(--red)">(Set by Hospital — Not applicable for this form)</span>`, feesBody),
    section(5, availTitle, weeklyAvailabilityBody()),
    section(6, 'KYC Documents', kycBody()),
    section(7, 'Bank &amp; Settlement Details', bankBody()),
  ].join('');

  const decl = declarationSection(
    `I hereby certify that all information provided is accurate and complete. I authorise Likeson Healthcare to verify my credentials and documents.
     I agree to the Doctor Partner Terms &amp; Conditions at <strong>likeson.in/terms</strong> and consent to the Privacy Policy at <strong>likeson.in/privacy</strong>.`,
    [
      [
        { label: 'Doctor Full Name' },
        { label: 'Date (DD/MM/YYYY)' },
        { label: 'Place' },
      ],
      [
        { label: 'Signature with Stamp', height: 64 },
        { label: '', height: 64 },
        { label: '', height: 64 },
      ],
    ]
  );

  const body = [
    header(qrDataURL, 'LIKESON HEALTHCARE', 'Advanced Healthcare Logistics Platform · likeson.in',
      'Doctor Registration Form',
      'Affiliation Type: Hospital-Manager Affiliated Doctor &nbsp;·&nbsp; Hospital.consultationPricing controls pricing'),
    instructions(`<strong>Instructions:</strong> Complete all fields marked <strong style="color:#e94560">*</strong>. Write in block letters. Attach self-attested certificates and KYC documents. Submit to your Likeson Healthcare representative or scan the QR above.`),
    sections,
    decl,
    footer('Likeson Healthcare &nbsp;·&nbsp; likeson.in &nbsp;·&nbsp; support@likeson.in &nbsp;·&nbsp; Doctor Onboarding Form v1.0 &nbsp;·&nbsp; Model: hospital-manager'),
  ].join('');

  return htmlShell(
    'Doctor Registration Form (Hospital-Affiliated) – Likeson Healthcare',
    baseCSS('green'),
    body
  );
}

/**
 * Doctor Registration Form — doctor-owner (Clinic / Nursing Home)
 */
async function buildDoctorOwnerForm(qrDataURL) {
  const affiliationBody = `
    ${infoNote(`<strong>Doctor-Owner:</strong> You manage your own Clinic/Nursing Home. Pricing is set at your doctor profile level
    (<code>DoctorProfile.fees</code>). Hospital.managedBy → your User._id. managementModel = "doctor-owner".`)}
    ${fieldFull('Primary Clinic / Hospital Name', true, 'The Clinic/Nursing Home you own and operate')}
    ${fieldFull('Other Hospital(s)', false, 'Comma-separated — hospitals where you also practice (otherHospitals[])')}
    ${checkboxGrid('Consultation Types Offered (☑ all that apply)', 3, [
      'In-Person Consultation', 'Video / Tele Consultation', 'Home Visit',
    ])}
  `;

  const feesBody = `
    ${infoNote(`<strong>Note:</strong> These fees apply because you are a Doctor-Owner (Clinic/Nursing Home).
    For doctors affiliated to hospital-manager hospitals, fees are set by the hospital — skip this section.
    <em>(Schema: DoctorProfile.fees — inPersonFee, videoFee, homeVisitFee, followUpFee)</em>`)}
    <table class="tbl">
      <thead>
        <tr>
          <th style="width:60%">Consultation Type</th>
          <th style="width:40%">Fee (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>In-Person Fee (inPersonFee)</td><td>${writeLine()}</td></tr>
        <tr><td>Video / Tele Fee (videoFee)</td><td>${writeLine()}</td></tr>
        <tr><td>Home Visit Fee (homeVisitFee)</td><td>${writeLine()}</td></tr>
        <tr><td>Follow-Up Fee — 0 = free (followUpFee)</td><td>${writeLine()}</td></tr>
      </tbody>
    </table>
    ${row(
      fieldInline('Follow-Up Discount (%)', false, 'e.g. 20 — % off from full fee (0–100) · followUpDiscountPercent'),
      fieldInline('Follow-Up Valid Days', false, '1–90 days after first consultation · followUpValidDays')
    )}
  `;

  const contactPersonBody = `
    ${fieldFull('Contact Person Name', false, 'Administrative contact (clinic manager, PA, or family member)')}
    ${row(
      fieldInline('Designation', false, 'e.g. Clinic Manager, Personal Assistant'),
      fieldInline('Phone Number', false, ''),
      fieldInline('Email Address', false, '')
    )}
  `;

  const availTitle = `Weekly Availability &nbsp;<span style="font-size:8px;font-weight:400;color:var(--muted)">(weeklyAvailability — doctor controls this regardless of model)</span>`;

  const sections = [
    section(1, 'Personal Information', personalInfoBody()),
    section(2, 'Professional Credentials', professionalCredentialsBody(4)),
    section(3, 'Hospital Affiliation', affiliationBody),
    section(4, `Consultation Fees &nbsp;<span style="font-size:8px;font-weight:400;color:var(--red)">(Doctor-Owner — You control pricing via DoctorProfile.fees)</span>`, feesBody),
    section(5, availTitle, weeklyAvailabilityBody()),
    section(6, 'KYC Documents', kycBody()),
    section(7, 'Bank &amp; Settlement Details', bankBody()),
    section(8, 'Emergency / Contact Person', contactPersonBody),
  ].join('');

  const decl = declarationSection(
    `I hereby certify that all information provided is accurate and complete. I authorise Likeson Healthcare to verify my credentials and documents.
     I agree to the Likeson Healthcare Doctor Partner Terms &amp; Conditions at <strong>likeson.in/terms</strong> and consent to the Privacy Policy at <strong>likeson.in/privacy</strong>.`,
    [
      [
        { label: 'Doctor Full Name' },
        { label: 'Date (DD/MM/YYYY)' },
        { label: 'Place' },
      ],
      [
        { label: 'Signature with Stamp', height: 64 },
        { label: '', height: 64 },
        { label: '', height: 64 },
      ],
    ]
  );

  const body = [
    header(qrDataURL, 'LIKESON HEALTHCARE', 'Advanced Healthcare Logistics Platform · likeson.in',
      'Doctor Registration Form',
      'Affiliation Type: Doctor-Owner (Clinic / Nursing Home) &nbsp;·&nbsp; DoctorProfile.fees controls pricing'),
    instructions(`<strong>Instructions:</strong> Complete all fields marked <strong style="color:#e94560">*</strong>. Write in block letters. Attach self-attested copies of all certificates and KYC documents. Submit to your Likeson Healthcare representative or scan the QR code to register online.`),
    sections,
    decl,
    footer('Likeson Healthcare &nbsp;·&nbsp; likeson.in &nbsp;·&nbsp; support@likeson.in &nbsp;·&nbsp; Doctor Onboarding Form v1.0 &nbsp;·&nbsp; Model: doctor-owner'),
  ].join('');

  return htmlShell(
    'Doctor Registration Form – Likeson Healthcare',
    baseCSS('green'),
    body
  );
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────

/**
 * @typedef {'hospital-manager'|'hospital-doctor-owner'|'doctor-hospital'|'doctor-owner'} FormType
 */

/**
 * Valid form types with their metadata.
 */
export const FORM_TYPES = {
  'hospital-manager':      { label: 'Hospital — Multi-Specialty / Super-Specialty / Trust / Government', qrUrl: 'https://likeson.in' },
  'hospital-doctor-owner': { label: 'Hospital — Clinic / Nursing Home (Doctor-Owner)',                   qrUrl: 'https://likeson.in' },
  'doctor-hospital':       { label: 'Doctor — Hospital-Manager Affiliated',                              qrUrl: 'https://likeson.in/doctor' },
  'doctor-owner':          { label: 'Doctor — Owner (Clinic / Nursing Home)',                            qrUrl: 'https://likeson.in/doctor' },
};

/**
 * Generate a complete printable HTML string for the specified Likeson Healthcare registration form.
 *
 * @param {FormType} formType  - One of the keys in FORM_TYPES
 * @returns {Promise<string>}  - Full HTML document string (ready to write to .html file or serve)
 *
 * @example
 * import { generateForm } from './form.utils.js';
 * import fs from 'fs/promises';
 *
 * const html = await generateForm('hospital-manager');
 * await fs.writeFile('hospital-manager-form.html', html, 'utf-8');
 *
 * const doctorHtml = await generateForm('doctor-owner');
 * await fs.writeFile('doctor-owner-form.html', doctorHtml, 'utf-8');
 */
export async function generateForm(formType) {
  const meta = FORM_TYPES[formType];
  if (!meta) {
    throw new Error(
      `Unknown formType "${formType}". Valid options: ${Object.keys(FORM_TYPES).join(', ')}`
    );
  }

  const qrDataURL = await generateQRDataURL(meta.qrUrl);

  switch (formType) {
    case 'hospital-manager':
      return buildHospitalManagerForm(qrDataURL);

    case 'hospital-doctor-owner':
      return buildHospitalDoctorOwnerForm(qrDataURL);

    case 'doctor-hospital':
      return buildDoctorHospitalForm(qrDataURL);

    case 'doctor-owner':
      return buildDoctorOwnerForm(qrDataURL);

    default:
      throw new Error(`Unhandled formType: ${formType}`);
  }
}

/**
 * Generate ALL four forms at once.
 *
 * @returns {Promise<Record<FormType, string>>} Object mapping formType → HTML string
 *
 * @example
 * import { generateAllForms } from './form.utils.js';
 * import fs from 'fs/promises';
 *
 * const forms = await generateAllForms();
 * for (const [type, html] of Object.entries(forms)) {
 *   await fs.writeFile(`${type}-form.html`, html, 'utf-8');
 * }
 */
export async function generateAllForms() {
  const results = {};
  await Promise.all(
    Object.keys(FORM_TYPES).map(async (type) => {
      results[type] = await generateForm(type);
    })
  );
  return results;
}