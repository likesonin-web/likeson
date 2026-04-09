/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EMAIL TEMPLATES — LIKESON HEALTHCARE
 * All templates are fully inline-CSS compatible for Gmail / Outlook / mobile.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─── Master Layout ────────────────────────────────────────────────────────────

const masterLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
    @media print {
      body { background: #fff !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:'Poppins',Arial,sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:40px 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="700"
               style="background:#fff;border-radius:12px;overflow:hidden;
                      box-shadow:0 10px 25px rgba(0,0,0,.06);
                      border:1px solid #eef2f6;max-width:700px;width:100%;">
          ${content}
          <tr>
            <td align="center"
                style="background:#fcfdfe;border-top:1px solid #f1f5f9;padding:20px;">
              <p style="color:#94a3b8;font-size:11px;font-weight:500;margin:0;letter-spacing:.5px;">
                &copy; ${new Date().getFullYear()} LIKESON.IN | ADVANCED HEALTHCARE LOGISTICS
              </p>
              <p style="color:#cbd5e1;font-size:10px;margin:4px 0 0;">
                Vijayawada &bull; Hyderabad &bull; Amaravathi &bull;
                <a href="mailto:support@likeson.in" style="color:#007bff;text-decoration:none;">support@likeson.in</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;;

// ─── 1. OTP Template ──────────────────────────────────────────────────────────
// Used by: dispatchOtp (verification, login OTP)
// Validity shown: 10 minutes

export const otpTemplate = (props) => {
  const content = `
    <tr>
      <td align="center"
          style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);
                 padding:40px 20px;">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:1.5px;">
          🏥 LIKESON HEALTHCARE
        </div>
        <div style="color:#94a3b8;font-size:13px;margin-top:6px;">Your Trusted Health Partner</div>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <h2 style="color:#1e293b;font-size:20px;font-weight:600;text-align:center;margin:0 0 10px;">
          ${props.title}
        </h2>
        <p style="color:#64748b;font-size:13px;line-height:1.6;text-align:center;margin:0 0 30px;">
          ${props.body}
        </p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <div style="background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:8px;
                          padding:20px 30px;display:inline-block;">
                <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;
                             letter-spacing:10px;color:#1e293b;">${props.otpCode}</span>
              </div>
            </td>
          </tr>
        </table>
        <p style="color:#94a3b8;font-size:11px;text-align:center;margin:25px 0 0;">
          This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
        </p>
      </td>
    </tr>`;
  return masterLayout(content);
};

// ─── 2. Welcome Template ──────────────────────────────────────────────────────
// Used by: dispatchWelcome (after signup)

export const welcomeTemplate = (props) => {
  const content = `
    <tr>
      <td align="center"
          style="background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);padding:50px 20px;">
        <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">${props.header}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <h2 style="color:#1e293b;font-size:18px;font-weight:600;margin:0 0 15px;">${props.title}</h2>
        <p style="color:#64748b;font-size:13px;line-height:1.7;margin:0 0 25px;">${props.body}</p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <a href="${props.buttonLink}"
                 style="background:#007bff;color:#fff;padding:14px 35px;border-radius:50px;
                        text-decoration:none;font-size:14px;font-weight:600;display:inline-block;
                        box-shadow:0 4px 12px rgba(0,123,255,.3);">
                ${props.buttonText}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  return masterLayout(content);
};

// ─── 3. Transactional Template ────────────────────────────────────────────────

export const transactionalTemplate = (props) => {
  const content = `
    <tr>
      <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);
                 padding:28px 40px;">
        <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:1.5px;">
          🏥 LIKESON HEALTHCARE
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:30px 40px 40px;">
        <p style="color:#007bff;font-size:11px;font-weight:700;text-transform:uppercase;
                  margin:0 0 5px;letter-spacing:1px;">${props.header || 'NOTIFICATION'}</p>
        <h2 style="color:#1e293b;font-size:20px;font-weight:600;margin:0 0 20px;">${props.title}</h2>
        <table border="0" cellpadding="0" cellspacing="0" width="100%"
               style="background:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;">
          <tr>
            <td style="padding:25px;">
              <div style="color:#475569;font-size:13px;line-height:1.8;">${props.body}</div>
            </td>
          </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:30px;">
          <tr>
            <td>
              <a href="${props.buttonLink}"
                 style="background:#1e293b;color:#fff;padding:12px 25px;border-radius:8px;
                        text-decoration:none;font-size:13px;font-weight:600;display:inline-block;">
                ${props.buttonText}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  return masterLayout(content);
};

// ─── 4. Password Reset OTP Template ──────────────────────────────────────────
// Used by: dispatchPasswordResetOtp (forgot-password flow)
// Validity shown: 15 minutes (matches otpExpires = Date.now() + 15 * 60_000 in route)

export const passwordResetTemplate = (props) => {
  const content = `
    <tr>
      <td align="center"
          style="background:linear-gradient(135deg,#1a1a2e 0%,#7c2d12 60%,#991b1b 100%);
                 padding:40px 20px;">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:1.5px;">
          🏥 LIKESON HEALTHCARE
        </div>
        <div style="color:#fca5a5;font-size:13px;margin-top:6px;">Account Recovery</div>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <div style="text-align:center;margin-bottom:20px;">
          <span style="font-size:48px;">🔑</span>
        </div>
        <h2 style="color:#1e293b;font-size:20px;font-weight:600;text-align:center;margin:0 0 10px;">
          Reset Your Password
        </h2>
        <p style="color:#64748b;font-size:13px;line-height:1.6;text-align:center;margin:0 0 30px;">
          We received a request to reset your Likeson.in account password.
          Use the code below to proceed. If you did not request this, ignore this email.
        </p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <div style="background:#fef2f2;border:2px dashed #fca5a5;border-radius:8px;
                          padding:20px 30px;display:inline-block;">
                <div style="color:#991b1b;font-size:11px;font-weight:700;
                            text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">
                  Password Reset Code
                </div>
                <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;
                             letter-spacing:10px;color:#1e293b;">${props.otpCode}</span>
              </div>
            </td>
          </tr>
        </table>
        <p style="color:#94a3b8;font-size:11px;text-align:center;margin:25px 0 0;">
          This code expires in <strong>15 minutes</strong>. Do not share it with anyone.
        </p>
        <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;
                    padding:14px 18px;margin-top:24px;">
          <p style="color:#854d0e;font-size:12px;margin:0;line-height:1.6;">
            ⚠️ <strong>Security notice:</strong> Likeson staff will never ask for your OTP.
            If you did not request this reset, please contact
            <a href="mailto:support@likeson.in" style="color:#854d0e;">support@likeson.in</a>
            immediately.
          </p>
        </div>
      </td>
    </tr>`;
  return masterLayout(content);
};

// ─── 5. Password Changed Confirmation Template ────────────────────────────────
// Used by: dispatchPasswordChanged (reset-password and change-password flows)
// Sent after password is successfully changed — security confirmation.

export const passwordChangedTemplate = (props) => {
  const content = `
    <tr>
      <td align="center"
          style="background:linear-gradient(135deg,#1a1a2e 0%,#14532d 60%,#166534 100%);
                 padding:40px 20px;">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:1.5px;">
          🏥 LIKESON HEALTHCARE
        </div>
        <div style="color:#86efac;font-size:13px;margin-top:6px;">Account Security</div>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <div style="text-align:center;margin-bottom:20px;">
          <span style="font-size:48px;">🔒</span>
        </div>
        <h2 style="color:#1e293b;font-size:20px;font-weight:600;text-align:center;margin:0 0 10px;">
          ${props.title}
        </h2>
        <p style="color:#64748b;font-size:13px;line-height:1.6;text-align:center;margin:0 0 30px;">
          ${props.body}
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                    padding:18px 24px;margin-bottom:28px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="font-size:13px;color:#64748b;">Status</td>
              <td style="text-align:right;font-weight:700;color:#15803d;font-size:13px;">
                ✅ Password Updated Successfully
              </td>
            </tr>
          </table>
        </div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;
                    padding:14px 18px;margin-bottom:28px;">
          <p style="color:#991b1b;font-size:12px;margin:0;line-height:1.6;">
            ⚠️ <strong>Wasn't you?</strong> If you did not make this change, your account may be
            compromised. Secure it immediately by contacting support.
          </p>
        </div>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <a href="${props.buttonLink}"
                 style="background:linear-gradient(135deg,#166534,#14532d);color:#fff;
                        padding:14px 35px;border-radius:50px;text-decoration:none;
                        font-size:14px;font-weight:600;display:inline-block;
                        box-shadow:0 4px 12px rgba(22,101,52,.3);">
                ${props.buttonText}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  return masterLayout(content);
};

// ─── 6. Order Confirmation / Status Update Email ──────────────────────────────
// Used for: Order Placed, Payment Confirmed, Status Updates, Cancellation

export const buildOrderEmailHtml = ({
  userName,
  order,
  orderItems = [],
  billing,
  storeName,
  actionLink,
  headerNote = '',
  statusLabel = 'Order Confirmed!',
  statusIcon  = '✅',
  statusColor = '#15803d',
  statusBg    = '#f0fdf4',
  statusBorder= '#bbf7d0',
  extraSection= '',
}) => {
  const itemRows = orderItems.map((item) => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:12px 8px;vertical-align:middle;width:68px;">
        ${
          item.medicineImage
            ? `<img src="${item.medicineImage}" alt="${item.name || 'Medicine'}"
                   width="56" height="56"
                   style="border-radius:8px;object-fit:cover;display:block;
                          border:1px solid #e8e8e8;" />`
            : `<div style="width:56px;height:56px;border-radius:8px;background:#f5f5f5;
                          text-align:center;line-height:56px;font-size:22px;">💊</div>`
        }
      </td>
      <td style="padding:12px 8px;vertical-align:middle;">
        <div style="font-weight:600;color:#1a1a2e;font-size:14px;">${item.name || 'Medicine'}</div>
        ${item.genericName ? `<div style="color:#6b7280;font-size:12px;margin-top:2px;">${item.genericName}</div>` : ''}
        ${item.brandName && item.brandName !== item.name ? `<div style="color:#9ca3af;font-size:11px;">Brand: ${item.brandName}</div>` : ''}
        <div style="color:#6b7280;font-size:12px;margin-top:4px;">Qty: ${item.quantity}</div>
        ${item.isPrescriptionRequired ? `<div style="color:#dc2626;font-size:11px;margin-top:2px;">⚕ Prescription Required</div>` : ''}
      </td>
      <td style="padding:12px 8px;vertical-align:middle;text-align:right;white-space:nowrap;">
        <div style="font-weight:600;color:#1a1a2e;font-size:14px;">
          ₹${((item.pricePerUnit || 0) * (item.quantity || 1)).toFixed(2)}
        </div>
        <div style="color:#9ca3af;font-size:11px;">₹${(item.pricePerUnit || 0).toFixed(2)} each</div>
      </td>
    </tr>`).join('');

  const discountRow = (billing?.discountAmount > 0)
    ? `<tr>
        <td style="color:#6b7280;padding:4px 0;">Discount</td>
        <td style="color:#16a34a;font-weight:600;text-align:right;padding:4px 0;">
          - ₹${(billing.discountAmount || 0).toFixed(2)}
        </td>
       </tr>`
    : '';

  const promoRow = billing?.promoCode
    ? `<tr>
        <td style="color:#6b7280;padding:4px 0;">Promo Code</td>
        <td style="color:#7c3aed;font-weight:600;text-align:right;padding:4px 0;">
          ${billing.promoCode}
        </td>
       </tr>`
    : '';

  return masterLayout(`
    <tr>
      <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);
                 padding:32px 40px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:1.5px;">
          🏥 LIKESON HEALTHCARE
        </div>
        <div style="color:#94a3b8;font-size:13px;margin-top:6px;">Your Trusted Health Partner</div>
      </td>
    </tr>
    <tr>
      <td style="background:${statusBg};padding:20px 40px;text-align:center;
                 border-bottom:2px solid ${statusBorder};">
        <div style="font-size:32px;">${statusIcon}</div>
        <div style="font-size:20px;font-weight:700;color:${statusColor};margin-top:8px;">
          ${statusLabel}
        </div>
        ${headerNote ? `<div style="color:#6b7280;font-size:13px;margin-top:4px;">${headerNote}</div>` : ''}
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px 8px;">
        <p style="margin:0;font-size:15px;color:#374151;">
          Hi <strong>${userName || 'Valued Customer'}</strong>,
        </p>
        ${storeName
          ? `<p style="margin:12px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
               ${storeName ? `Your order is being handled by <strong>${storeName}</strong>.` : ''}
             </p>`
          : ''}
      </td>
    </tr>
    <tr>
      <td style="padding:12px 40px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                    padding:14px 20px;display:inline-block;">
          <span style="color:#6b7280;font-size:12px;">Order ID</span>
          <div style="font-size:18px;font-weight:800;color:#1a1a2e;letter-spacing:1px;
                      margin-top:2px;font-family:monospace;">
            #${order?.orderId || 'N/A'}
          </div>
        </div>
      </td>
    </tr>
    ${orderItems.length > 0 ? `
    <tr>
      <td style="padding:16px 40px 8px;">
        <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:12px;">
          🛒 Order Items
        </div>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 8px;text-align:left;font-size:12px;
                         color:#9ca3af;font-weight:600;width:68px;">IMG</th>
              <th style="padding:10px 8px;text-align:left;font-size:12px;
                         color:#9ca3af;font-weight:600;">MEDICINE</th>
              <th style="padding:10px 8px;text-align:right;font-size:12px;
                         color:#9ca3af;font-weight:600;">AMOUNT</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </td>
    </tr>` : ''}
    ${billing ? `
    <tr>
      <td style="padding:16px 40px 24px;">
        <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:12px;">
          🧾 Bill Summary
        </div>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:#f8fafc;border:1px solid #e5e7eb;
                      border-radius:10px;padding:16px 20px;">
          <tr><td colspan="2" style="padding:0 0 8px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="font-size:13px;color:#374151;">
              <tr>
                <td style="color:#6b7280;padding:4px 0;">Sub Total</td>
                <td style="text-align:right;padding:4px 0;">
                  ₹${(billing.subTotal || 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:4px 0;">GST</td>
                <td style="text-align:right;padding:4px 0;">
                  ₹${(billing.gstAmount || 0).toFixed(2)}
                </td>
              </tr>
              ${discountRow}
              ${promoRow}
              <tr>
                <td colspan="2">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0;" />
                </td>
              </tr>
              <tr>
                <td style="font-weight:700;color:#1a1a2e;font-size:15px;padding:4px 0;">
                  Total Paid
                </td>
                <td style="font-weight:800;color:#1a1a2e;font-size:15px;
                           text-align:right;padding:4px 0;">
                  ₹${(billing.totalPayable || 0).toFixed(2)}
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td>
    </tr>` : ''}
    ${extraSection}
    <tr>
      <td style="padding:0 40px 32px;text-align:center;">
        <a href="${actionLink || 'https://likeson.in/dashboard'}"
           style="display:inline-block;
                  background:linear-gradient(135deg,#0f3460,#1a1a2e);
                  color:#fff;text-decoration:none;padding:14px 36px;
                  border-radius:50px;font-weight:700;font-size:14px;letter-spacing:.5px;">
          📦 Track Your Order
        </a>
      </td>
    </tr>`);
};

// ─── 7. Status Update Email ───────────────────────────────────────────────────

export const buildStatusUpdateEmail = ({
  userName,
  order,
  orderItems = [],
  billing,
  storeName,
  actionLink,
  newStatus,
}) => {
  const statusConfig = {
    'Confirmed':         { icon: '✅', label: 'Order Confirmed',          color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
    'Processing':        { icon: '⚙️', label: 'Order Being Processed',    color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
    'Out-for-Delivery':  { icon: '🛵', label: 'Out for Delivery!',        color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    'Delivered':         { icon: '🎉', label: 'Order Delivered!',         color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
    'Cancelled':         { icon: '❌', label: 'Order Cancelled',          color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
    'Return_Requested':  { icon: '🔄', label: 'Return Requested',         color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    'Return_Accepted':   { icon: '📦', label: 'Return Accepted',          color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
    'Return_Rejected':   { icon: '⛔', label: 'Return Rejected',          color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
    'Pickup_Assigned':   { icon: '🏍️', label: 'Pickup Partner Assigned',  color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    'Pickup_Done':       { icon: '✔️', label: 'Pickup Completed',         color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
    'Returned':          { icon: '↩️', label: 'Order Returned',           color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
  };

  const cfg = statusConfig[newStatus] || {
    icon: '📋', label: `Status: ${newStatus}`, color: '#374151', bg: '#f9fafb', border: '#e5e7eb',
  };

  return buildOrderEmailHtml({
    userName, order, orderItems, billing, storeName, actionLink,
    statusLabel:  cfg.label,
    statusIcon:   cfg.icon,
    statusColor:  cfg.color,
    statusBg:     cfg.bg,
    statusBorder: cfg.border,
    headerNote:   `Your order #${order?.orderId} status has been updated.`,
  });
};

// ─── 8. Delivery OTP Email ────────────────────────────────────────────────────

export const buildDeliveryOtpEmail = ({
  userName,
  order,
  otpCode,
}) => {
  const content = `
    <tr>
      <td style="background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);
                 padding:32px 40px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:1.5px;">
          🏥 LIKESON HEALTHCARE
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#fffbeb;padding:20px 40px;text-align:center;
                 border-bottom:2px solid #fde68a;">
        <div style="font-size:32px;">🛵</div>
        <div style="font-size:20px;font-weight:700;color:#b45309;margin-top:8px;">
          Your delivery is arriving!
        </div>
        <div style="color:#6b7280;font-size:13px;margin-top:4px;">
          Share this OTP with the delivery partner to confirm receipt.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:30px 40px;">
        <p style="margin:0;font-size:15px;color:#374151;">
          Hi <strong>${userName || 'Valued Customer'}</strong>,
        </p>
        <p style="margin:12px 0 0;font-size:14px;color:#6b7280;">
          Order <strong>#${order?.orderId}</strong> is on its way.
          Use the OTP below to confirm delivery.
        </p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%"
               style="margin-top:24px;">
          <tr>
            <td align="center">
              <div style="background:#1e293b;border-radius:12px;padding:24px 40px;
                          display:inline-block;">
                <div style="color:#94a3b8;font-size:12px;letter-spacing:1px;
                            text-transform:uppercase;margin-bottom:8px;">
                  Delivery OTP
                </div>
                <div style="font-family:'Courier New',monospace;font-size:42px;
                            font-weight:900;letter-spacing:12px;color:#fff;">
                  ${otpCode}
                </div>
              </div>
            </td>
          </tr>
        </table>
        <p style="color:#94a3b8;font-size:11px;text-align:center;margin:20px 0 0;">
          Valid for <strong>30 minutes</strong>. Do not share with anyone other than your delivery partner.
        </p>
      </td>
    </tr>`;
  return masterLayout(content);
};

// ─── 9. Refund Confirmation Email ─────────────────────────────────────────────

export const buildRefundEmail = ({
  userName,
  order,
  refundAmount,
  refundMethod,
  bankDetails,
  actionLink,
}) => {
  const methodLabel = {
    Wallet:          '💰 Likeson Wallet',
    Online:          '💳 Original Payment Method (Razorpay)',
    Bank_Transfer:   '🏦 Bank Transfer (Standard)',
    Custom_Bank:     '🏦 Custom Bank Account',
    Original_Source: '💳 Original Payment Method',
  }[refundMethod] || refundMethod;

  const bankSection = ['Bank_Transfer', 'Custom_Bank'].includes(refundMethod) && bankDetails
    ? `<tr>
        <td style="padding:16px 40px 0;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                      padding:16px 20px;">
            <div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:8px;">
              🏦 Bank Details on File
            </div>
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="font-size:12px;color:#6b7280;">
              <tr><td style="padding:2px 0;">Account Holder</td>
                  <td style="text-align:right;color:#1a1a2e;font-weight:600;">
                    ${bankDetails.accountHolderName || 'N/A'}
                  </td></tr>
              <tr><td style="padding:2px 0;">Account Number</td>
                  <td style="text-align:right;color:#1a1a2e;font-weight:600;">
                    ****${(bankDetails.accountNumber || '').slice(-4)}
                  </td></tr>
              <tr><td style="padding:2px 0;">IFSC Code</td>
                  <td style="text-align:right;color:#1a1a2e;font-weight:600;">
                    ${bankDetails.ifscCode || 'N/A'}
                  </td></tr>
              <tr><td style="padding:2px 0;">Bank</td>
                  <td style="text-align:right;color:#1a1a2e;font-weight:600;">
                    ${bankDetails.bankName || 'N/A'}
                  </td></tr>
            </table>
          </div>
        </td>
       </tr>`
    : '';

  const content = `
    <tr>
      <td style="background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);
                 padding:32px 40px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:1.5px;">
          🏥 LIKESON HEALTHCARE
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#f0fdf4;padding:20px 40px;text-align:center;
                 border-bottom:2px solid #bbf7d0;">
        <div style="font-size:32px;">💸</div>
        <div style="font-size:20px;font-weight:700;color:#15803d;margin-top:8px;">
          Refund Initiated!
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px 8px;">
        <p style="margin:0;font-size:15px;color:#374151;">
          Hi <strong>${userName || 'Valued Customer'}</strong>,
        </p>
        <p style="margin:12px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
          Your refund for order <strong>#${order?.orderId}</strong> has been processed.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:#f8fafc;border:1px solid #e5e7eb;
                      border-radius:10px;padding:16px 20px;">
          <tr><td colspan="2" style="padding:0;">
            <table width="100%" style="font-size:13px;color:#374151;">
              <tr>
                <td style="color:#6b7280;padding:6px 0;">Refund Amount</td>
                <td style="text-align:right;font-weight:800;color:#15803d;
                           font-size:18px;padding:6px 0;">
                  ₹${(refundAmount || 0).toFixed(2)}
                </td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:6px 0;">Refund Method</td>
                <td style="text-align:right;font-weight:600;color:#1a1a2e;padding:6px 0;">
                  ${methodLabel}
                </td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:6px 0;">Order ID</td>
                <td style="text-align:right;font-weight:600;color:#1a1a2e;
                           font-family:monospace;padding:6px 0;">
                  #${order?.orderId}
                </td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:6px 0;">Expected Time</td>
                <td style="text-align:right;font-weight:600;color:#1a1a2e;padding:6px 0;">
                  ${refundMethod === 'Wallet' ? 'Instant' : '3–7 business days'}
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td>
    </tr>
    ${bankSection}
    <tr>
      <td style="padding:20px 40px 32px;text-align:center;">
        <a href="${actionLink || 'https://likeson.in/dashboard'}"
           style="display:inline-block;background:linear-gradient(135deg,#0f3460,#1a1a2e);
                  color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;
                  font-weight:700;font-size:14px;letter-spacing:.5px;">
          View Order Details
        </a>
      </td>
    </tr>`;
  return masterLayout(content);
};

// ─── 10. Customer Invoice HTML (for email attachment or PDF generation) ────────

export const buildInvoiceHtml = ({ order, user, storeName, storeAddress }) => {
  const invoiceDate = new Date(order.createdAt || Date.now());
  const dateStr     = invoiceDate.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const itemRows = (order.items || []).map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding:10px 12px;vertical-align:middle;width:48px;border-bottom:1px solid #f0f0f0;">
        ${
          item.medicineImage
            ? `<img src="${item.medicineImage}" alt="${item.name}"
                   width="40" height="40"
                   style="border-radius:6px;object-fit:cover;display:block;
                          border:1px solid #e8e8e8;" />`
            : `<div style="width:40px;height:40px;border-radius:6px;background:#e5e7eb;
                          text-align:center;line-height:40px;font-size:18px;">💊</div>`
        }
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
        <div style="font-weight:600;font-size:13px;color:#1a1a2e;">${item.name}</div>
        ${item.genericName ? `<div style="font-size:11px;color:#9ca3af;">${item.genericName}</div>` : ''}
        ${item.hsnCode ? `<div style="font-size:10px;color:#d1d5db;">HSN: ${item.hsnCode}</div>` : ''}
      </td>
      <td style="padding:10px 12px;text-align:center;font-size:13px;
                 border-bottom:1px solid #f0f0f0;">
        ${item.quantity}
      </td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;
                 border-bottom:1px solid #f0f0f0;">
        ₹${(item.pricePerUnit || 0).toFixed(2)}
      </td>
      <td style="padding:10px 12px;text-align:center;font-size:13px;
                 border-bottom:1px solid #f0f0f0;">
        ${item.gstPercentage || 0}%
      </td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;
                 font-weight:600;border-bottom:1px solid #f0f0f0;">
        ₹${((item.pricePerUnit || 0) * (item.quantity || 1)).toFixed(2)}
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice — ${order.orderId}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="720" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:12px;overflow:hidden;
                  box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:720px;width:100%;">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);
                   padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:2px;">
                  🏥 LIKESON HEALTHCARE
                </div>
                <div style="color:#94a3b8;font-size:12px;margin-top:4px;">
                  Your Trusted Health Partner
                </div>
                ${storeAddress ? `<div style="color:#64748b;font-size:11px;margin-top:8px;">${storeAddress}</div>` : ''}
              </td>
              <td align="right">
                <div style="background:rgba(255,255,255,.1);border-radius:8px;
                            padding:12px 20px;text-align:right;">
                  <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;
                              letter-spacing:1px;">TAX INVOICE</div>
                  <div style="color:#fff;font-size:20px;font-weight:800;
                              font-family:monospace;margin-top:4px;">
                    #${order.orderId}
                  </div>
                  <div style="color:#94a3b8;font-size:11px;margin-top:4px;">
                    ${dateStr}
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BILLED TO / FROM -->
      <tr>
        <td style="padding:24px 40px;border-bottom:1px solid #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding-right:20px;vertical-align:top;">
                <div style="font-size:11px;font-weight:700;color:#9ca3af;
                            text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                  Billed To
                </div>
                <div style="font-size:14px;font-weight:700;color:#1a1a2e;">
                  ${user?.name || order.delivery?.address?.fullName || 'Customer'}
                </div>
                ${user?.email ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${user.email}</div>` : ''}
                ${user?.phone || order.delivery?.address?.phone
                  ? `<div style="font-size:12px;color:#6b7280;">${user?.phone || order.delivery?.address?.phone}</div>`
                  : ''}
                ${order.delivery?.address
                  ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;line-height:1.5;">
                      ${order.delivery.address.line1 || ''},
                      ${order.delivery.address.city || 'Vijayawada'},
                      ${order.delivery.address.state || 'Andhra Pradesh'} —
                      ${order.delivery.address.pincode || ''}
                    </div>`
                  : ''}
              </td>
              <td width="50%" style="padding-left:20px;vertical-align:top;
                                     border-left:1px solid #f1f5f9;">
                <div style="font-size:11px;font-weight:700;color:#9ca3af;
                            text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                  Dispatched From
                </div>
                <div style="font-size:14px;font-weight:700;color:#1a1a2e;">
                  ${storeName || 'Likeson Pharmacy'}
                </div>
                ${storeAddress ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;line-height:1.5;">${storeAddress}</div>` : ''}
                <div style="font-size:12px;color:#6b7280;margin-top:4px;">
                  Payment: <strong>${order.payment?.method || 'N/A'}</strong>
                </div>
                <div style="font-size:12px;color:#6b7280;">
                  Status:
                  <strong style="color:${order.payment?.status === 'Paid' ? '#15803d' : '#b91c1c'};">
                    ${order.payment?.status || 'Pending'}
                  </strong>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ITEMS TABLE -->
      <tr>
        <td style="padding:24px 40px;">
          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:12px;">
            Order Items
          </div>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;
                           color:#9ca3af;font-weight:700;width:48px;">IMG</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;
                           color:#9ca3af;font-weight:700;">MEDICINE</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;
                           color:#9ca3af;font-weight:700;">QTY</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;
                           color:#9ca3af;font-weight:700;">UNIT PRICE</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;
                           color:#9ca3af;font-weight:700;">GST%</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;
                           color:#9ca3af;font-weight:700;">TOTAL</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </td>
      </tr>

      <!-- BILLING SUMMARY -->
      <tr>
        <td style="padding:0 40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="55%"></td>
              <td width="45%">
                <table width="100%" cellpadding="0" cellspacing="0"
                       style="background:#f8fafc;border:1px solid #e5e7eb;
                              border-radius:10px;padding:16px 20px;">
                  <tr><td colspan="2" style="padding:0 0 8px;">
                    <table width="100%" style="font-size:13px;color:#374151;">
                      <tr>
                        <td style="color:#6b7280;padding:4px 0;">Subtotal</td>
                        <td style="text-align:right;padding:4px 0;">
                          ₹${(order.billing?.subTotal || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td style="color:#6b7280;padding:4px 0;">GST</td>
                        <td style="text-align:right;padding:4px 0;">
                          ₹${(order.billing?.gstAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                      ${(order.billing?.discountAmount > 0)
                        ? `<tr>
                            <td style="color:#6b7280;padding:4px 0;">Discount</td>
                            <td style="text-align:right;color:#16a34a;font-weight:600;padding:4px 0;">
                              - ₹${(order.billing.discountAmount).toFixed(2)}
                            </td>
                           </tr>`
                        : ''}
                      ${order.billing?.promoCode
                        ? `<tr>
                            <td style="color:#6b7280;padding:4px 0;">Promo Code</td>
                            <td style="text-align:right;color:#7c3aed;font-weight:600;padding:4px 0;">
                              ${order.billing.promoCode}
                            </td>
                           </tr>`
                        : ''}
                      <tr>
                        <td colspan="2">
                          <hr style="border:none;border-top:2px solid #e5e7eb;margin:8px 0;" />
                        </td>
                      </tr>
                      <tr>
                        <td style="font-weight:800;color:#1a1a2e;font-size:16px;padding:4px 0;">
                          TOTAL
                        </td>
                        <td style="text-align:right;font-weight:900;color:#0f3460;
                                   font-size:18px;padding:4px 0;">
                          ₹${(order.billing?.totalPayable || 0).toFixed(2)}
                        </td>
                      </tr>
                    </table>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- FOOTER NOTE -->
      <tr>
        <td style="background:#f8fafc;border-top:1px solid #e5e7eb;
                   padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">
            This is a computer-generated invoice. No physical signature required.
          </p>
          <p style="margin:6px 0 0;font-size:11px;color:#9ca3af;">
            For queries: <a href="mailto:support@likeson.in"
                           style="color:#0f3460;text-decoration:none;">support@likeson.in</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
};

// ─── 11. Delivery / Shipping Label HTML ───────────────────────────────────────
// Designed for 4×6 inch thermal label printing

export const buildDeliveryLabelHtml = ({ order, storeName, storeAddress }) => {
  const addr = order.delivery?.address || {};
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Shipping Label — ${order.orderId}</title>
  <style>
    @media print { body { margin: 0; } .label { page-break-after: always; } }
    * { box-sizing: border-box; }
  </style>
</head>
<body style="margin:0;padding:16px;background:#fff;font-family:Arial,sans-serif;">
  <div class="label"
       style="width:384px;border:2px solid #1a1a2e;border-radius:8px;
              overflow:hidden;background:#fff;">

    <!-- Store Header -->
    <div style="background:#1a1a2e;padding:12px 16px;">
      <div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:1px;">
        🏥 LIKESON HEALTHCARE
      </div>
      <div style="font-size:10px;color:#94a3b8;margin-top:2px;">
        ${storeAddress || 'Vijayawada, Andhra Pradesh'}
      </div>
    </div>

    <!-- Order ID Barcode-style -->
    <div style="background:#f8fafc;border-bottom:2px dashed #e5e7eb;
                padding:10px 16px;text-align:center;">
      <div style="font-size:10px;color:#9ca3af;letter-spacing:1px;">ORDER ID</div>
      <div style="font-size:22px;font-weight:900;color:#1a1a2e;
                  font-family:'Courier New',monospace;letter-spacing:3px;">
        ${order.orderId}
      </div>
    </div>

    <!-- To / From -->
    <div style="padding:12px 16px;border-bottom:1px solid #f0f0f0;">
      <div style="font-size:9px;font-weight:700;color:#9ca3af;
                  text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">
        SHIP TO
      </div>
      <div style="font-size:14px;font-weight:700;color:#1a1a2e;">
        ${addr.fullName || 'Customer'}
      </div>
      <div style="font-size:12px;color:#374151;margin-top:2px;line-height:1.5;">
        ${addr.line1 || ''}${addr.landmark ? `, ${addr.landmark}` : ''}<br/>
        ${addr.city || 'Vijayawada'}, ${addr.state || 'Andhra Pradesh'}<br/>
        PIN: <strong>${addr.pincode || ''}</strong>
      </div>
      <div style="font-size:13px;font-weight:700;color:#0f3460;margin-top:6px;">
        📞 ${addr.phone || ''}
      </div>
    </div>

    <!-- Items List -->
    <div style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
      <div style="font-size:9px;font-weight:700;color:#9ca3af;
                  text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
        ITEMS (${order.items?.length || 0})
      </div>
      ${(order.items || []).map((item) => `
        <div style="display:flex;justify-content:space-between;
                    align-items:center;margin-bottom:4px;">
          <div style="font-size:11px;color:#374151;flex:1;">
            ${item.name} ${item.isPrescriptionRequired ? '⚕' : ''}
          </div>
          <div style="font-size:11px;font-weight:700;color:#1a1a2e;
                      margin-left:8px;white-space:nowrap;">
            ×${item.quantity}
          </div>
        </div>`).join('')}
      ${(order.items || []).some((i) => i.isPrescriptionRequired)
        ? `<div style="margin-top:6px;background:#fef2f2;border-radius:4px;
                       padding:4px 8px;font-size:10px;color:#dc2626;font-weight:700;">
             ⚕ PRESCRIPTION REQUIRED — VERIFY ID
           </div>`
        : ''}
    </div>

    <!-- Payment & Amount -->
    <div style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;color:#6b7280;">Payment Method</td>
          <td style="text-align:right;font-size:11px;font-weight:700;color:#1a1a2e;">
            ${order.payment?.method || 'N/A'}
            ${order.payment?.method === 'COD'
              ? '<span style="background:#fef9c3;color:#854d0e;padding:2px 6px;border-radius:4px;font-size:9px;margin-left:4px;">COLLECT CASH</span>'
              : ''}
          </td>
        </tr>
        <tr>
          <td style="font-size:13px;font-weight:700;color:#1a1a2e;padding-top:4px;">
            Total Amount
          </td>
          <td style="text-align:right;font-size:15px;font-weight:900;color:#0f3460;padding-top:4px;">
            ₹${(order.billing?.totalPayable || 0).toFixed(2)}
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:8px 16px;text-align:center;">
      <div style="font-size:9px;color:#9ca3af;">
        Packed by: <strong>${storeName || 'Likeson Pharmacy'}</strong>
        &bull; ${new Date().toLocaleDateString('en-IN')}
      </div>
      <div style="font-size:9px;color:#9ca3af;margin-top:2px;">
        support@likeson.in &bull; likeson.in
      </div>
    </div>
  </div>
</body>
</html>`;
};


/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PHARMACY ADMIN EMAIL TEMPLATES — LIKESON HEALTHCARE
 * Store Invoice · Low Stock Alert · Expiry Alert · Settlement Confirmation
 * All templates use inline-CSS for Gmail / Outlook / mobile compatibility.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
 
// ─── Shared header block ──────────────────────────────────────────────────────

const headerBlock = (subtitle = '') => `
  <tr>
    <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%);
               padding:28px 40px;">
      <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:1.5px;">
        🏥 LIKESON HEALTHCARE
      </div>
      ${subtitle ? `<div style="color:#94a3b8;font-size:12px;margin-top:4px;">${subtitle}</div>` : ''}
    </td>
  </tr>`;

// ─── Utility: format currency ─────────────────────────────────────────────────
const fmtRs = (n) => `₹${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ═══════════════════════════════════════════════════════════════════════════════
// 1. STORE INVOICE (HTML page — printable / PDF-ready)
//    Called by:  GET  /financials/store-invoice
//                POST /financials/store-invoice/send
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {Object}  store         – PharmacyStore document (lean)
 * @param {Array}   orders        – Paid orders in the period
 * @param {Object}  summary       – { grossRevenue, gstCollected, discounts, totalOrders }
 * @param {Object}  dateRange     – { start: Date, end: Date }
 * @param {Object}  generatedBy   – User object (name)
 */
export const buildStoreInvoiceHtml = ({ store, orders = [], summary = {}, dateRange = {}, generatedBy = {} }) => {
  const grossRevenue = Number(summary.grossRevenue || 0);
  const gstCollected = Number(summary.gstCollected || 0);
  const discounts    = Number(summary.discounts    || 0);
  const netRevenue   = grossRevenue - gstCollected;

  const storeAddress = store?.address
    ? `${store.address.line1 || ''}, ${store.address.city || 'Vijayawada'}, ${store.address.state || 'Andhra Pradesh'} — ${store.address.pincode || ''}`
    : 'Vijayawada, Andhra Pradesh';

  const orderRows = orders.map((o, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding:9px 12px;font-size:12px;font-family:'Courier New',monospace;
                 color:#0f3460;font-weight:700;border-bottom:1px solid #f0f0f0;">
        #${o.orderId}
      </td>
      <td style="padding:9px 12px;font-size:12px;color:#374151;border-bottom:1px solid #f0f0f0;">
        ${fmtDate(o.createdAt)}
      </td>
      <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #f0f0f0;">
        <span style="background:${o.payment?.method === 'COD' ? '#fef3c7' : '#eff6ff'};
                     color:${o.payment?.method === 'COD' ? '#92400e' : '#1d4ed8'};
                     padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">
          ${o.payment?.method || '—'}
        </span>
      </td>
      <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #f0f0f0;">
        <span style="background:#f0fdf4;color:#15803d;padding:2px 8px;
                     border-radius:20px;font-size:11px;font-weight:600;">
          ${o.delivery?.status || '—'}
        </span>
      </td>
      <td style="padding:9px 12px;text-align:right;font-size:12px;
                 color:#6b7280;border-bottom:1px solid #f0f0f0;">
        ${fmtRs(o.billing?.gstAmount)}
      </td>
      <td style="padding:9px 12px;text-align:right;font-size:13px;
                 font-weight:700;color:#1a1a2e;border-bottom:1px solid #f0f0f0;">
        ${fmtRs(o.billing?.totalPayable)}
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Store Invoice — ${store?.storeName || 'Likeson Pharmacy'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
    *{box-sizing:border-box}
    body{margin:0;padding:24px;background:#f3f4f6;font-family:'Poppins',Arial,sans-serif;}
    @media print{body{padding:0;background:#fff}.no-print{display:none!important}}
  </style>
</head>
<body>

<!-- Print Button -->
<div class="no-print" style="text-align:right;margin-bottom:16px;">
  <button onclick="window.print()"
          style="background:#0f3460;color:#fff;border:none;padding:10px 24px;
                 border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;">
    🖨️ Print / Save PDF
  </button>
</div>

<table width="800" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:12px;overflow:hidden;
              box-shadow:0 4px 24px rgba(0,0,0,.08);margin:0 auto;max-width:800px;width:100%;">

  <!-- ── HEADER ── -->
  <tr>
    <td style="background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);padding:32px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:2px;">
              🏥 LIKESON HEALTHCARE
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
              ${storeAddress}
            </div>
            ${store?.legal?.dlNumber ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">DL No: ${store.legal.dlNumber}${store.legal.gstNumber ? ` &nbsp;|&nbsp; GST: ${store.legal.gstNumber}` : ''}</div>` : ''}
          </td>
          <td align="right">
            <div style="background:rgba(255,255,255,.1);border-radius:10px;
                        padding:14px 20px;text-align:right;">
              <div style="color:#94a3b8;font-size:10px;text-transform:uppercase;
                          letter-spacing:1px;">STORE STATEMENT</div>
              <div style="color:#fff;font-size:18px;font-weight:800;margin-top:4px;">
                ${store?.storeName || 'Likeson Pharmacy'}
              </div>
              <div style="color:#94a3b8;font-size:11px;margin-top:6px;">
                ${dateRange.start ? fmtDate(dateRange.start) : '—'} →
                ${dateRange.end   ? fmtDate(dateRange.end)   : '—'}
              </div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── SUMMARY CARDS ── -->
  <tr>
    <td style="padding:24px 40px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${[
            { label: 'Gross Revenue',  value: fmtRs(grossRevenue), color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: 'GST Collected',  value: fmtRs(gstCollected), color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
            { label: 'Discounts',      value: fmtRs(discounts),    color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
            { label: 'Net Revenue',    value: fmtRs(netRevenue),   color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
            { label: 'Total Orders',   value: summary.totalOrders || 0, color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
          ].map((card) => `
            <td style="padding:0 6px;">
              <div style="background:${card.bg};border:1px solid ${card.border};
                          border-radius:10px;padding:14px 16px;text-align:center;">
                <div style="font-size:10px;font-weight:700;color:#9ca3af;
                            text-transform:uppercase;letter-spacing:.8px;">
                  ${card.label}
                </div>
                <div style="font-size:18px;font-weight:800;color:${card.color};margin-top:4px;">
                  ${card.value}
                </div>
              </div>
            </td>`).join('')}
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── ORDER TABLE ── -->
  <tr>
    <td style="padding:24px 40px;">
      <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:12px;">
        Order Details (${orders.length} orders)
      </div>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1a1a2e;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;
                       color:#94a3b8;font-weight:600;">ORDER ID</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;
                       color:#94a3b8;font-weight:600;">DATE</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;
                       color:#94a3b8;font-weight:600;">PAYMENT</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;
                       color:#94a3b8;font-weight:600;">STATUS</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;
                       color:#94a3b8;font-weight:600;">GST</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;
                       color:#94a3b8;font-weight:600;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>${orderRows || `
          <tr>
            <td colspan="6" style="padding:24px;text-align:center;color:#9ca3af;font-size:13px;">
              No paid orders in this period.
            </td>
          </tr>`}
        </tbody>
        <tfoot>
          <tr style="background:#f8fafc;border-top:2px solid #e5e7eb;">
            <td colspan="4" style="padding:12px;font-weight:700;color:#374151;font-size:13px;">
              TOTALS
            </td>
            <td style="padding:12px;text-align:right;font-weight:700;color:#0369a1;font-size:13px;">
              ${fmtRs(gstCollected)}
            </td>
            <td style="padding:12px;text-align:right;font-weight:800;color:#15803d;font-size:15px;">
              ${fmtRs(grossRevenue)}
            </td>
          </tr>
        </tfoot>
      </table>
    </td>
  </tr>

  <!-- ── FOOTER ── -->
  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;color:#9ca3af;">
            Generated by: <strong style="color:#374151;">${generatedBy?.name || 'System'}</strong>
            &nbsp;&bull;&nbsp; ${new Date().toLocaleString('en-IN')}
          </td>
          <td align="right" style="font-size:11px;color:#9ca3af;">
            Computer-generated statement. No signature required.
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</body>
</html>`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LOW STOCK ALERT EMAIL
//    Called by: GET /inventory/low-stock?sendEmail=true
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {string} userName   – Pharmacist name
 * @param {string} storeName  – Store name
 * @param {Array}  items      – Low-stock medicine objects
 * @param {number} threshold  – The configured threshold
 */
export const buildLowStockAlertEmail = ({ userName, storeName, items = [], threshold = 10 }) => {
  const rows = items.map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1a1a2e;
                 border-bottom:1px solid #f0f0f0;">
        ${item.name || '—'}
      </td>
      <td style="padding:10px 14px;font-size:12px;color:#6b7280;
                 border-bottom:1px solid #f0f0f0;">
        ${item.brandName || '—'}
      </td>
      <td style="padding:10px 14px;font-size:12px;color:#6b7280;
                 border-bottom:1px solid #f0f0f0;text-align:center;">
        ${item.batchNumber || '—'}
      </td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #f0f0f0;">
        <span style="background:${item.stockQuantity === 0 ? '#fef2f2' : '#fef9c3'};
                     color:${item.stockQuantity === 0 ? '#dc2626' : '#92400e'};
                     padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">
          ${item.stockQuantity}
        </span>
      </td>
      <td style="padding:10px 14px;font-size:12px;color:#6b7280;
                 border-bottom:1px solid #f0f0f0;text-align:center;">
        ${item.expiryDate ? fmtDate(item.expiryDate) : '—'}
      </td>
    </tr>`).join('');

  const content = `
    ${headerBlock('Inventory Alert System')}
    <tr>
      <td style="background:#fef9c3;padding:18px 40px;text-align:center;
                 border-bottom:2px solid #fde68a;">
        <div style="font-size:28px;">🔴</div>
        <div style="font-size:18px;font-weight:700;color:#92400e;margin-top:6px;">
          Low Stock Alert — Action Required
        </div>
        <div style="color:#78350f;font-size:13px;margin-top:4px;">
          ${items.length} medicine(s) in <strong>${storeName}</strong> are below the threshold of
          <strong>${threshold} units</strong>.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px 8px;">
        <p style="margin:0;font-size:14px;color:#374151;">
          Hi <strong>${userName || 'Pharmacist'}</strong>,
        </p>
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
          The following medicines in your store require immediate restocking.
          Please place replenishment requests or update stock quantities.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 40px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#1a1a2e;">
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">MEDICINE</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">BRAND</th>
              <th style="padding:10px 14px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;">BATCH</th>
              <th style="padding:10px 14px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;">QTY LEFT</th>
              <th style="padding:10px 14px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;">EXPIRY</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 32px;text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'https://likeson.in'}/pharmacy/inventory"
           style="display:inline-block;background:linear-gradient(135deg,#92400e,#78350f);
                  color:#fff;text-decoration:none;padding:13px 32px;
                  border-radius:50px;font-weight:700;font-size:14px;">
          📦 Manage Inventory
        </a>
      </td>
    </tr>`;

  return masterLayout(content);
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. BATCH EXPIRY ALERT EMAIL
//    Called by: GET /inventory/expiry-alerts?sendEmail=true
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {string} userName   – Pharmacist name
 * @param {string} storeName  – Store name
 * @param {Array}  items      – Expiring medicine objects (include daysLeft)
 * @param {number} days       – Alert window in days
 */
export const buildBatchExpiryAlertEmail = ({ userName, storeName, items = [], days = 30 }) => {
  const rows = items.map((item, idx) => {
    const urgency = item.daysLeft <= 7
      ? { bg: '#fef2f2', color: '#dc2626', label: 'CRITICAL' }
      : item.daysLeft <= 15
        ? { bg: '#fff7ed', color: '#ea580c', label: 'URGENT' }
        : { bg: '#fef9c3', color: '#ca8a04', label: 'WARNING' };

    return `
    <tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'};">
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1a1a2e;
                 border-bottom:1px solid #f0f0f0;">${item.name || '—'}</td>
      <td style="padding:10px 14px;font-size:12px;color:#6b7280;
                 border-bottom:1px solid #f0f0f0;">${item.brandName || '—'}</td>
      <td style="padding:10px 14px;font-size:12px;color:#6b7280;
                 border-bottom:1px solid #f0f0f0;text-align:center;">${item.batchNumber || '—'}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #f0f0f0;">
        ${fmtDate(item.expiryDate)}
      </td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #f0f0f0;">
        <span style="background:${urgency.bg};color:${urgency.color};
                     padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">
          ${item.daysLeft}d — ${urgency.label}
        </span>
      </td>
      <td style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;
                 color:#374151;border-bottom:1px solid #f0f0f0;">${item.stockQuantity}</td>
    </tr>`;
  }).join('');

  const content = `
    ${headerBlock('Batch Expiry Alert System')}
    <tr>
      <td style="background:#fef2f2;padding:18px 40px;text-align:center;
                 border-bottom:2px solid #fecaca;">
        <div style="font-size:28px;">⚠️</div>
        <div style="font-size:18px;font-weight:700;color:#b91c1c;margin-top:6px;">
          Expiry Alert — ${items.length} Batch(es) Expiring Soon
        </div>
        <div style="color:#991b1b;font-size:13px;margin-top:4px;">
          Medicines in <strong>${storeName}</strong> expiring within
          <strong>${days} days</strong>.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px 8px;">
        <p style="margin:0;font-size:14px;color:#374151;">
          Hi <strong>${userName || 'Pharmacist'}</strong>,
        </p>
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
          Please review the batches below and take appropriate action — return to supplier,
          mark for disposal, or apply promotions to clear stock.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 40px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#1a1a2e;">
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">MEDICINE</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;">BRAND</th>
              <th style="padding:10px 14px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;">BATCH</th>
              <th style="padding:10px 14px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;">EXPIRY DATE</th>
              <th style="padding:10px 14px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;">DAYS LEFT</th>
              <th style="padding:10px 14px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;">QTY</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:12px;background:#fef9c3;border:1px solid #fde68a;
                    border-radius:8px;padding:12px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:11px;">
            <tr>
              <td><span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:12px;font-weight:700;">CRITICAL</span></td>
              <td style="color:#374151;padding-left:8px;">≤ 7 days — Immediate action needed</td>
              <td style="padding-left:16px;"><span style="background:#fff7ed;color:#ea580c;padding:2px 8px;border-radius:12px;font-weight:700;">URGENT</span></td>
              <td style="color:#374151;padding-left:8px;">≤ 15 days — Plan clearance</td>
              <td style="padding-left:16px;"><span style="background:#fef9c3;color:#ca8a04;padding:2px 8px;border-radius:12px;font-weight:700;">WARNING</span></td>
              <td style="color:#374151;padding-left:8px;">≤ 30 days — Monitor</td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 32px;text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'https://likeson.in'}/pharmacy/inventory/batches"
           style="display:inline-block;background:linear-gradient(135deg,#991b1b,#7f1d1d);
                  color:#fff;text-decoration:none;padding:13px 32px;
                  border-radius:50px;font-weight:700;font-size:14px;">
          🧪 View Batch Details
        </a>
      </td>
    </tr>`;

  return masterLayout(content);
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SETTLEMENT CONFIRMATION EMAIL
//    Called by: POST /financials/settlements/request
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {string} userName   – Pharmacist name
 * @param {number} amount     – Settlement amount in ₹
 * @param {string} method     – Payment method used
 * @param {string} storeName  – Store name
 * @param {Date}   settledAt  – Settlement timestamp
 * @param {number} remaining  – Remaining pending balance
 */
export const buildSettlementEmail = ({ userName, amount, method, storeName, settledAt, remaining }) => {
  const methodLabel = {
    'Bank Transfer': '🏦 Bank Transfer',
    'UPI':           '📱 UPI',
    'Cheque':        '📋 Cheque',
    'Cash':          '💵 Cash',
  }[method] || method;

  const content = `
    ${headerBlock('Settlement & Payouts')}
    <tr>
      <td style="background:#f0fdf4;padding:18px 40px;text-align:center;
                 border-bottom:2px solid #bbf7d0;">
        <div style="font-size:28px;">💸</div>
        <div style="font-size:18px;font-weight:700;color:#15803d;margin-top:6px;">
          Settlement Processed Successfully
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 40px 12px;">
        <p style="margin:0;font-size:15px;color:#374151;">
          Hi <strong>${userName || 'Pharmacist'}</strong>,
        </p>
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
          A settlement has been processed for <strong>${storeName}</strong>.
          Here are the details:
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 40px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:#f8fafc;border:1px solid #e5e7eb;
                      border-radius:12px;padding:20px 24px;">
          <tr><td colspan="2" style="padding:0;">
            <table width="100%" style="font-size:13px;color:#374151;">
              <tr>
                <td style="color:#6b7280;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  Settlement Amount
                </td>
                <td style="text-align:right;font-weight:800;color:#15803d;
                           font-size:22px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  ${fmtRs(amount)}
                </td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  Payment Method
                </td>
                <td style="text-align:right;font-weight:600;color:#1a1a2e;
                           padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  ${methodLabel}
                </td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  Store
                </td>
                <td style="text-align:right;font-weight:600;color:#1a1a2e;
                           padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  ${storeName}
                </td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  Processed At
                </td>
                <td style="text-align:right;font-weight:600;color:#1a1a2e;
                           padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  ${settledAt ? new Date(settledAt).toLocaleString('en-IN') : '—'}
                </td>
              </tr>
              <tr>
                <td style="color:#6b7280;padding:8px 0;">
                  Remaining Pending Balance
                </td>
                <td style="text-align:right;font-weight:700;
                           color:${remaining > 0 ? '#0369a1' : '#15803d'};
                           font-size:15px;padding:8px 0;">
                  ${fmtRs(remaining)}
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 28px;">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;
                    padding:14px 18px;">
          <p style="color:#1d4ed8;font-size:12px;margin:0;line-height:1.6;">
            ℹ️ Settlement processing times vary by method.
            Bank Transfers may take <strong>1–3 business days</strong>.
            UPI settlements are typically <strong>instant to same-day</strong>.
            Contact <a href="mailto:support@likeson.in" style="color:#1d4ed8;">support@likeson.in</a> for queries.
          </p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 32px;text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'https://likeson.in'}/pharmacy/financials/settlements"
           style="display:inline-block;background:linear-gradient(135deg,#0f3460,#1a1a2e);
                  color:#fff;text-decoration:none;padding:13px 32px;
                  border-radius:50px;font-weight:700;font-size:14px;">
          📊 View Settlement History
        </a>
      </td>
    </tr>`;

  return masterLayout(content);
};