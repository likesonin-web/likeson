/**
 * OP Email Templates — Likeson.in
 * Email HTML for sending OP card + ZIP attachment to customer.
 */

const masterLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{border:0;outline:none;text-decoration:none}
    body{margin:0;padding:0;background-color:#f4f7fa;font-family:Arial,sans-serif;}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:Arial,sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:40px 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="640"
               style="background:#fff;border-radius:12px;overflow:hidden;
                      box-shadow:0 10px 25px rgba(0,0,0,.06);
                      border:1px solid #eef2f6;max-width:640px;width:100%;">
          ${content}
          <tr>
            <td align="center"
                style="background:#fcfdfe;border-top:1px solid #f1f5f9;padding:18px;">
              <p style="color:#94a3b8;font-size:11px;margin:0;">
                &copy; ${new Date().getFullYear()} LIKESON.IN | ADVANCED HEALTHCARE LOGISTICS
              </p>
              <p style="color:#cbd5e1;font-size:10px;margin:4px 0 0;">
                Vijayawada &bull; support@likeson.in &bull; likeson.in
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/**
 * OP Confirmation Email
 * Sent when an OutPatientRecord is created.
 * ZIP file is sent as attachment.
 */
export const opConfirmationEmailTemplate = ({
  patientName,
  doctorName,
  hospitalName,
  opNumber,
  bookingCode,
  scheduledAt,
  consultationType,
  isFollowUp,
  followUpExpiry,
  followUpFee,
}) => {
  const fmtDT = (d) =>
    d
      ? new Date(d).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—';

  const content = `
    <tr>
      <td align="center"
          style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%);
                 padding:36px 20px;">
        <div style="font-size:21px;font-weight:800;color:#fff;letter-spacing:1.5px;">
          🏥 LIKESON HEALTHCARE
        </div>
        <div style="color:#94a3b8;font-size:12px;margin-top:5px;">Out-Patient Appointment Confirmation</div>
      </td>
    </tr>
    <tr>
      <td style="background:#f0fdf4;border-bottom:2px solid #bbf7d0;padding:16px 40px;text-align:center;">
        <div style="font-size:28px;">✅</div>
        <div style="font-size:17px;font-weight:700;color:#15803d;margin-top:6px;">
          Appointment Confirmed
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px 8px;">
        <p style="margin:0;font-size:14px;color:#374151;">
          Dear <strong>${patientName || 'Patient'}</strong>,
        </p>
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
          Your out-patient appointment has been confirmed. Please find your OP card
          attached as a ZIP file — open the HTML file inside for a printable version.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%"
               style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <tr>
            <td style="padding:18px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
                <tr>
                  <td style="color:#94a3b8;padding:5px 0;width:140px;">OP Number</td>
                  <td style="font-weight:700;color:#0f3460;font-family:monospace;
                             font-size:14px;padding:5px 0;">${opNumber}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;padding:5px 0;">Booking Code</td>
                  <td style="font-weight:600;color:#1e293b;padding:5px 0;">${bookingCode}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;padding:5px 0;">Doctor</td>
                  <td style="font-weight:600;color:#1e293b;padding:5px 0;">Dr. ${doctorName || '—'}</td>
                </tr>
                ${hospitalName ? `
                <tr>
                  <td style="color:#94a3b8;padding:5px 0;">Hospital / Clinic</td>
                  <td style="font-weight:600;color:#1e293b;padding:5px 0;">${hospitalName}</td>
                </tr>` : ''}
                <tr>
                  <td style="color:#94a3b8;padding:5px 0;">Scheduled At</td>
                  <td style="font-weight:600;color:#1e293b;padding:5px 0;">${fmtDT(scheduledAt)}</td>
                </tr>
                <tr>
                  <td style="color:#94a3b8;padding:5px 0;">Consultation</td>
                  <td style="padding:5px 0;">
                    <span style="background:#eff6ff;color:#1d4ed8;padding:2px 10px;
                                 border-radius:20px;font-size:11px;font-weight:700;">
                      ${(consultationType || '').replace(/_/g, ' ').toUpperCase()}
                    </span>
                    ${isFollowUp ? '<span style="background:#fef9c3;color:#92400e;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-left:6px;">FOLLOW-UP</span>' : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${followUpExpiry ? `
    <tr>
      <td style="padding:0 40px 20px;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:13px 16px;">
          <p style="color:#15803d;font-size:12px;margin:0;line-height:1.6;">
            🔄 <strong>Follow-Up Eligible</strong> &nbsp;·&nbsp;
            You can book a follow-up with the same doctor at
            <strong>₹${followUpFee ?? 0}</strong> until
            <strong>${new Date(followUpExpiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>.
          </p>
        </div>
      </td>
    </tr>` : ''}

    <tr>
      <td style="padding:0 40px 12px;">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:13px 16px;">
          <p style="color:#1d4ed8;font-size:12px;margin:0;line-height:1.6;">
            📎 <strong>Your OP card is attached</strong> as a ZIP file.
            Extract and open the HTML file in any browser to view or print your OP card.
          </p>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:16px 40px 32px;text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${bookingCode}"
           style="display:inline-block;background:linear-gradient(135deg,#0f3460,#1a1a2e);
                  color:#fff;text-decoration:none;padding:12px 30px;
                  border-radius:50px;font-weight:700;font-size:13px;">
          📋 View Booking Details
        </a>
      </td>
    </tr>`;

  return masterLayout(content);
};

/**
 * OP Follow-Up Reminder Email
 * Sent before the follow-up window expires.
 */
export const opFollowUpReminderTemplate = ({
  patientName,
  doctorName,
  hospitalName,
  opNumber,
  followUpExpiry,
  followUpFee,
  daysRemaining,
}) => {
  const content = `
    <tr>
      <td align="center"
          style="background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);
                 padding:32px 20px;">
        <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:1.5px;">
          🏥 LIKESON HEALTHCARE
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#fffbeb;border-bottom:2px solid #fde68a;
                 padding:16px 40px;text-align:center;">
        <div style="font-size:28px;">⏰</div>
        <div style="font-size:17px;font-weight:700;color:#92400e;margin-top:6px;">
          Follow-Up Window Closing Soon
        </div>
        <div style="font-size:12px;color:#78350f;margin-top:4px;">
          Only <strong>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</strong> remaining
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px;">
        <p style="margin:0;font-size:14px;color:#374151;">
          Dear <strong>${patientName}</strong>,
        </p>
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
          Your follow-up eligibility for OP <strong>${opNumber}</strong> with
          <strong>Dr. ${doctorName}</strong>${hospitalName ? ` at <strong>${hospitalName}</strong>` : ''}
          will expire on <strong>${new Date(followUpExpiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>.
        </p>
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;">
          Book your follow-up now at <strong>₹${followUpFee ?? 0}</strong> — same doctor, same hospital.
        </p>
        <div style="text-align:center;margin-top:24px;">
          <a href="${process.env.FRONTEND_URL || 'https://likeson.in'}/book/follow-up?opNumber=${opNumber}"
             style="display:inline-block;background:linear-gradient(135deg,#92400e,#78350f);
                    color:#fff;text-decoration:none;padding:12px 28px;
                    border-radius:50px;font-weight:700;font-size:13px;">
            🔄 Book Follow-Up Now
          </a>
        </div>
      </td>
    </tr>`;

  return masterLayout(content);
};