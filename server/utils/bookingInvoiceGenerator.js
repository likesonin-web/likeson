/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOKING INVOICE GENERATOR — Likeson.in
 * utils/bookingInvoiceGenerator.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Generates a production-grade PDF invoice for any booking service type.
 * Uses puppeteer-core + @sparticuz/chromium for serverless-compatible rendering.
 *
 * FALLBACK: If puppeteer is unavailable (dev), returns a plain HTML buffer.
 *
 * SUPPORTS ALL SERVICE TYPES:
 *   full_care_ride, transport_only, care_assistant_only,
 *   doctor_consultation, diagnostic, pharmacy_order, blood_bank
 *
 * USAGE:
 *   import { generateBookingInvoicePdf } from '../utils/bookingInvoiceGenerator.js';
 *   const pdfBuffer = await generateBookingInvoicePdf(populatedBooking);
 *   // Returns Buffer — send as HTTP response or email attachment
 *
 * SENDGRID ATTACHMENT FORMAT:
 *   {
 *     content:     pdfBuffer.toString('base64'),
 *     filename:    `invoice-${booking.bookingNumber}.pdf`,
 *     type:        'application/pdf',
 *     disposition: 'attachment',
 *   }
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmtRs = (n) => `₹${(Number(n) || 0).toFixed(2)}`;

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const fmtDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const capitalize = (s) =>
  (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE TYPE → LABEL + ICON
// ─────────────────────────────────────────────────────────────────────────────

const SERVICE_META = {
  full_care_ride:       { label: 'Full Care Ride',         icon: '🚑', color: '#0f3460' },
  transport_only:       { label: 'Transport Only',         icon: '🚗', color: '#1d4ed8' },
  care_assistant_only:  { label: 'Care Assistant',         icon: '🧑‍⚕️', color: '#0369a1' },
  doctor_consultation:  { label: 'Doctor Consultation',    icon: '👨‍⚕️', color: '#7c3aed' },
  diagnostic:           { label: 'Diagnostic / Lab',       icon: '🧪', color: '#0891b2' },
  pharmacy_order:       { label: 'Pharmacy Order',         icon: '💊', color: '#15803d' },
  blood_bank:           { label: 'Blood Bank Request',     icon: '🩸', color: '#b91c1c' },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE COLORS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  completed:        { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  pending:          { bg: '#fef9c3', color: '#92400e', border: '#fde68a' },
  confirmed:        { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  assigned:         { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
  in_progress:      { bg: '#fdf4ff', color: '#7c3aed', border: '#e9d5ff' },
  cancelled:        { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  refunded:         { bg: '#faf5ff', color: '#6d28d9', border: '#ddd6fe' },
  no_show:          { bg: '#f9fafb', color: '#374151', border: '#e5e7eb' },
  refund_initiated: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML INVOICE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a complete HTML invoice string from a populated Booking document.
 * @param {object} booking — populated Booking lean object
 * @returns {string} — full HTML page string
 */
export const buildBookingInvoiceHtml = (booking) => {
  const meta = SERVICE_META[booking.serviceType] || { label: capitalize(booking.serviceType), icon: '📋', color: '#374151' };
  const statusStyle = STATUS_COLORS[booking.status] || STATUS_COLORS.pending;

  // ── Billing rows ────────────────────────────────────────────────────────────
  const b = booking.billing || {};
  const billingRows = [
    { label: 'Gross Amount',    value: fmtRs(b.grossAmount),    highlight: false },
    b.discountAmount > 0
      ? { label: `Discount${b.couponCode ? ` (${b.couponCode})` : ''}`, value: `- ${fmtRs(b.discountAmount + (b.couponDiscount || 0))}`, color: '#15803d', highlight: false }
      : null,
    b.coinsDiscount > 0
      ? { label: 'Coins Redeemed', value: `- ${fmtRs(b.coinsDiscount)}`, color: '#7c3aed', highlight: false }
      : null,
    b.taxAmount > 0
      ? { label: `Tax (${b.taxPercent || 0}%)`, value: fmtRs(b.taxAmount), highlight: false }
      : null,
    { label: 'Net Amount', value: fmtRs(b.netAmount), highlight: true },
  ].filter(Boolean);

  const billingHtml = billingRows.map((row) => `
    <tr>
      <td style="padding:7px 0;color:${row.highlight ? '#1a1a2e' : '#6b7280'};font-size:13px;font-weight:${row.highlight ? '700' : '400'};">
        ${row.label}
      </td>
      <td style="text-align:right;padding:7px 0;color:${row.color || (row.highlight ? '#0f3460' : '#1a1a2e')};font-size:${row.highlight ? '16px' : '13px'};font-weight:${row.highlight ? '800' : '500'};">
        ${row.value}
      </td>
    </tr>`).join('');

  // ── Transport section ───────────────────────────────────────────────────────
  const transportSection = booking.transport ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
        🚗 Transport Details
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
        ${booking.transport.pickupAddress ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;width:140px;">Pickup</td>
          <td style="padding:4px 0;font-weight:500;">
            ${[
              booking.transport.pickupAddress.street,
              booking.transport.pickupAddress.city,
              booking.transport.pickupAddress.state,
              booking.transport.pickupAddress.pinCode,
            ].filter(Boolean).join(', ')}
          </td>
        </tr>` : ''}
        ${booking.transport.dropAddress ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Drop</td>
          <td style="padding:4px 0;font-weight:500;">
            ${[
              booking.transport.dropAddress.street,
              booking.transport.dropAddress.city,
              booking.transport.dropAddress.state,
            ].filter(Boolean).join(', ')}
          </td>
        </tr>` : ''}
        ${booking.transport.distanceKm > 0 ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Distance</td>
          <td style="padding:4px 0;font-weight:500;">${booking.transport.distanceKm} km</td>
        </tr>` : ''}
        ${booking.transport.vehicleSnapshot?.registrationNumber ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Vehicle</td>
          <td style="padding:4px 0;font-weight:500;">
            ${[
              booking.transport.vehicleSnapshot.make,
              booking.transport.vehicleSnapshot.model,
              `(${booking.transport.vehicleSnapshot.registrationNumber})`,
            ].filter(Boolean).join(' ')}
          </td>
        </tr>` : ''}
        ${booking.transport.rideStartedAt ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Ride Started</td>
          <td style="padding:4px 0;">${fmtDateTime(booking.transport.rideStartedAt)}</td>
        </tr>` : ''}
        ${booking.transport.rideEndedAt ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Ride Ended</td>
          <td style="padding:4px 0;">${fmtDateTime(booking.transport.rideEndedAt)}</td>
        </tr>` : ''}
        ${booking.transport.waitingCharges > 0 ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Waiting Charges</td>
          <td style="padding:4px 0;">${fmtRs(booking.transport.waitingCharges)}</td>
        </tr>` : ''}
      </table>
    </div>` : '';

  // ── Consultation section ────────────────────────────────────────────────────
  const consultSection = booking.consultation ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
        👨‍⚕️ Consultation Details
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
        ${booking.consultation.consultationType ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;width:140px;">Type</td>
          <td style="padding:4px 0;font-weight:500;">${capitalize(booking.consultation.consultationType)}</td>
        </tr>` : ''}
        ${booking.consultation.doctor?.user?.name ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Doctor</td>
          <td style="padding:4px 0;font-weight:500;">Dr. ${booking.consultation.doctor.user.name}</td>
        </tr>` : ''}
        ${booking.consultation.specialization ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Specialization</td>
          <td style="padding:4px 0;">${booking.consultation.specialization}</td>
        </tr>` : ''}
        ${booking.consultation.hospital?.name ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Hospital</td>
          <td style="padding:4px 0;font-weight:500;">${booking.consultation.hospital.name}</td>
        </tr>` : ''}
        ${booking.consultation.scheduledAt ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Scheduled</td>
          <td style="padding:4px 0;">${fmtDateTime(booking.consultation.scheduledAt)}</td>
        </tr>` : ''}
        ${booking.consultation.durationMinutes ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Duration</td>
          <td style="padding:4px 0;">${booking.consultation.durationMinutes} minutes</td>
        </tr>` : ''}
        ${booking.consultation.reasonForVisit ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Reason</td>
          <td style="padding:4px 0;">${booking.consultation.reasonForVisit}</td>
        </tr>` : ''}
      </table>
    </div>` : '';

  // ── Diagnostic section ──────────────────────────────────────────────────────
  const diagnosticSection = booking.diagnostic?.testsRequested?.length ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
        🧪 Diagnostic Tests
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;">TEST</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;font-weight:600;">CODE</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#9ca3af;font-weight:600;">PRICE</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:#9ca3af;font-weight:600;">REPORT</th>
          </tr>
        </thead>
        <tbody>
          ${booking.diagnostic.testsRequested.map((t, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'};">
            <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#1a1a2e;border-bottom:1px solid #f0f0f0;">${t.testName}</td>
            <td style="padding:8px 12px;font-size:11px;color:#6b7280;border-bottom:1px solid #f0f0f0;font-family:monospace;">${t.testCode || '—'}</td>
            <td style="padding:8px 12px;font-size:12px;text-align:right;font-weight:500;border-bottom:1px solid #f0f0f0;">${t.price ? fmtRs(t.price) : '—'}</td>
            <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #f0f0f0;">
              ${t.reportReady
                ? `<span style="background:#f0fdf4;color:#15803d;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">✅ Ready</span>`
                : `<span style="background:#fef9c3;color:#92400e;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">Pending</span>`}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${booking.diagnostic.labPartner?.labName ? `
      <div style="margin-top:8px;font-size:12px;color:#6b7280;">
        Lab Partner: <strong style="color:#1a1a2e;">${booking.diagnostic.labPartner.labName}</strong>
        ${booking.diagnostic.isHomeSampleCollection ? ' &bull; Home Sample Collection' : ' &bull; Lab Visit'}
      </div>` : ''}
    </div>` : '';

  // ── Blood bank section ──────────────────────────────────────────────────────
  const bloodBankSection = booking.bloodBank ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
        🩸 Blood Bank Request
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;width:140px;">Blood Group</td>
          <td style="padding:4px 0;font-weight:700;color:#b91c1c;">${booking.bloodBank.bloodGroup || '—'}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Component</td>
          <td style="padding:4px 0;font-weight:500;">${booking.bloodBank.componentRequired || '—'}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Units Required</td>
          <td style="padding:4px 0;font-weight:500;">${booking.bloodBank.unitsRequired || 1}</td>
        </tr>
        ${booking.bloodBank.requestedForDate ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Required By</td>
          <td style="padding:4px 0;">${fmtDate(booking.bloodBank.requestedForDate)}</td>
        </tr>` : ''}
        ${booking.bloodBank.notes ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;">Notes</td>
          <td style="padding:4px 0;">${booking.bloodBank.notes}</td>
        </tr>` : ''}
      </table>
    </div>` : '';

  // ── Timeline section ────────────────────────────────────────────────────────
  const timelineSection = booking.timeline?.length ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
        📋 Status Timeline
      </div>
      <div style="position:relative;padding-left:20px;border-left:2px solid #e5e7eb;">
        ${booking.timeline.slice(-6).map((t) => {
          const sc = STATUS_COLORS[t.status] || STATUS_COLORS.pending;
          return `
          <div style="margin-bottom:12px;position:relative;">
            <div style="position:absolute;left:-26px;top:3px;width:10px;height:10px;border-radius:50%;background:${sc.color};border:2px solid ${sc.border};"></div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <span style="background:${sc.bg};color:${sc.color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">
                  ${capitalize(t.status)}
                </span>
                ${t.note ? `<div style="font-size:11px;color:#6b7280;margin-top:3px;">${t.note}</div>` : ''}
              </div>
              <div style="font-size:10px;color:#9ca3af;white-space:nowrap;margin-left:8px;">
                ${t.createdAt ? fmtDateTime(t.createdAt) : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  // ── Payment section ─────────────────────────────────────────────────────────
  const paymentMethods = {
    upi: '📱 UPI',
    card: '💳 Card',
    netbanking: '🏦 Net Banking',
    wallet: '💰 Wallet',
    cash: '💵 Cash',
    subscription_credit: '🎟️ Subscription Credit',
  };

  const paymentHtml = booking.payment ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;margin-top:6px;">
      <tr>
        <td style="padding:4px 0;color:#6b7280;width:140px;">Payment Status</td>
        <td style="padding:4px 0;font-weight:700;color:${booking.payment.status === 'paid' ? '#15803d' : '#b91c1c'};">
          ${capitalize(booking.payment.status)}
        </td>
      </tr>
      ${booking.payment.method ? `
      <tr>
        <td style="padding:4px 0;color:#6b7280;">Payment Method</td>
        <td style="padding:4px 0;">${paymentMethods[booking.payment.method] || capitalize(booking.payment.method)}</td>
      </tr>` : ''}
      ${booking.payment.paidAt ? `
      <tr>
        <td style="padding:4px 0;color:#6b7280;">Paid At</td>
        <td style="padding:4px 0;">${fmtDateTime(booking.payment.paidAt)}</td>
      </tr>` : ''}
      ${booking.payment.gatewayPaymentId ? `
      <tr>
        <td style="padding:4px 0;color:#6b7280;">Transaction ID</td>
        <td style="padding:4px 0;font-family:monospace;font-size:11px;">${booking.payment.gatewayPaymentId}</td>
      </tr>` : ''}
    </table>` : '';

  // ── Subscription context ────────────────────────────────────────────────────
  const subscriptionHtml = booking.subscriptionPlan?.isCoveredByPlan ? `
    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 14px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:600;color:#7c3aed;">
        🎟️ Subscription Plan Applied
        ${booking.subscriptionPlan.planSlug ? ` — ${capitalize(booking.subscriptionPlan.planSlug)}` : ''}
      </div>
    </div>` : '';

  // ── Full HTML document ──────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice — ${booking.bookingNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f3f4f6;
      padding: 24px;
      color: #1a1a2e;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      max-width: 800px;
      margin: 0 auto;
    }
    .section { padding: 24px 40px; border-bottom: 1px solid #f1f5f9; }
    .section:last-child { border-bottom: none; }
    .divider { border: none; border-top: 1px solid #f1f5f9; margin: 16px 0; }
    @media print {
      body { background: #fff; padding: 0; }
      .card { box-shadow: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

<!-- Print button (hidden in PDF) -->
<div class="no-print" style="text-align:right;max-width:800px;margin:0 auto 12px;">
  <button onclick="window.print()"
          style="background:#0f3460;color:#fff;border:none;padding:10px 22px;
                 border-radius:8px;font-size:13px;cursor:pointer;font-weight:600;">
    🖨️ Print / Save PDF
  </button>
</div>

<div class="card">

  <!-- ═══ HEADER ══════════════════════════════════════════════════════════════ -->
  <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%);padding:32px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:2px;">
            🏥 LIKESON HEALTHCARE
          </div>
          <div style="color:#94a3b8;font-size:12px;margin-top:4px;">
            Vijayawada &bull; Hyderabad &bull; Amaravathi
          </div>
          <div style="color:#64748b;font-size:11px;margin-top:4px;">
            support@likeson.in &bull; likeson.in
          </div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="background:rgba(255,255,255,.1);border-radius:10px;padding:14px 20px;display:inline-block;text-align:right;">
            <div style="color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;">
              SERVICE INVOICE
            </div>
            <div style="color:#fff;font-size:20px;font-weight:900;font-family:monospace;margin-top:4px;letter-spacing:1px;">
              ${booking.bookingNumber}
            </div>
            <div style="color:#94a3b8;font-size:11px;margin-top:6px;">
              ${fmtDate(booking.createdAt)}
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- ═══ SERVICE TYPE BANNER ═════════════════════════════════════════════════ -->
  <div style="background:${meta.color}14;border-bottom:3px solid ${meta.color};padding:16px 40px;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="font-size:28px;">${meta.icon}</span>
      <div>
        <div style="font-size:16px;font-weight:700;color:${meta.color};">${meta.label}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">
          Scheduled: ${fmtDateTime(booking.scheduledAt)}
        </div>
      </div>
    </div>
    <div>
      <span style="background:${statusStyle.bg};color:${statusStyle.color};border:1px solid ${statusStyle.border};padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;">
        ${capitalize(booking.status)}
      </span>
    </div>
  </div>

  <!-- ═══ PATIENT & CUSTOMER ══════════════════════════════════════════════════ -->
  <div class="section">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" style="vertical-align:top;padding-right:20px;">
          <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
            Patient
          </div>
          <div style="font-size:15px;font-weight:700;color:#1a1a2e;">${booking.patientName || '—'}</div>
          ${booking.customer?.name && booking.customer.name !== booking.patientName ? `
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">Booked by: ${booking.customer.name}</div>` : ''}
          ${booking.customer?.phone ? `<div style="font-size:12px;color:#6b7280;">${booking.customer.phone}</div>` : ''}
          ${booking.customer?.email ? `<div style="font-size:12px;color:#6b7280;">${booking.customer.email}</div>` : ''}
        </td>
        <td width="50%" style="vertical-align:top;padding-left:20px;border-left:1px solid #f1f5f9;">
          <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
            Booking Info
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;color:#374151;">
            <tr>
              <td style="color:#6b7280;padding:3px 0;width:100px;">Booking #</td>
              <td style="font-weight:700;font-family:monospace;color:#0f3460;">${booking.bookingNumber}</td>
            </tr>
            <tr>
              <td style="color:#6b7280;padding:3px 0;">Service</td>
              <td style="font-weight:500;">${meta.label}</td>
            </tr>
            <tr>
              <td style="color:#6b7280;padding:3px 0;">Source</td>
              <td>${capitalize(booking.bookingSource || 'app')}</td>
            </tr>
            ${booking.subscriptionPlan?.isCoveredByPlan ? `
            <tr>
              <td style="color:#6b7280;padding:3px 0;">Plan</td>
              <td style="color:#7c3aed;font-weight:600;">${capitalize(booking.subscriptionPlan.planSlug || 'Subscription')}</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>
  </div>

  <!-- ═══ SERVICE DETAILS ══════════════════════════════════════════════════════ -->
  <div class="section">
    <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:16px;">Service Details</div>

    ${subscriptionHtml}
    ${transportSection}
    ${consultSection}
    ${diagnosticSection}
    ${bloodBankSection}

    ${!booking.transport && !booking.consultation && !booking.diagnostic && !booking.bloodBank ? `
    <div style="color:#9ca3af;font-size:13px;text-align:center;padding:16px 0;">
      No additional service detail records for this booking type.
    </div>` : ''}
  </div>

  <!-- ═══ BILLING ══════════════════════════════════════════════════════════════ -->
  <div class="section">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="55%" style="vertical-align:top;padding-right:20px;">
          <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:12px;">Payment</div>
          ${paymentHtml}
        </td>
        <td width="45%" style="vertical-align:top;">
          <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;">
            <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:12px;">Bill Summary</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tbody>${billingHtml}</tbody>
            </table>
            ${b.currency ? `<div style="font-size:10px;color:#9ca3af;margin-top:8px;text-align:right;">Currency: ${b.currency}</div>` : ''}
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- ═══ TIMELINE ════════════════════════════════════════════════════════════ -->
  ${booking.timeline?.length ? `
  <div class="section">
    <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:16px;">Status Timeline</div>
    ${timelineSection}
  </div>` : ''}

  <!-- ═══ CANCELLATION ════════════════════════════════════════════════════════ -->
  ${booking.cancellation ? `
  <div class="section" style="background:#fef2f2;">
    <div style="font-size:14px;font-weight:700;color:#b91c1c;margin-bottom:10px;">❌ Cancellation</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
      <tr>
        <td style="color:#6b7280;width:140px;padding:4px 0;">Reason</td>
        <td style="padding:4px 0;">${booking.cancellation.reason || '—'}</td>
      </tr>
      <tr>
        <td style="color:#6b7280;padding:4px 0;">Refund Amount</td>
        <td style="padding:4px 0;font-weight:700;color:#15803d;">${fmtRs(booking.cancellation.refundAmount)} (${booking.cancellation.refundPercent || 0}%)</td>
      </tr>
      <tr>
        <td style="color:#6b7280;padding:4px 0;">Refund Status</td>
        <td style="padding:4px 0;font-weight:600;text-transform:capitalize;">${booking.cancellation.refundStatus || 'none'}</td>
      </tr>
    </table>
  </div>` : ''}

  <!-- ═══ CUSTOMER NOTES ═══════════════════════════════════════════════════════ -->
  ${booking.customerNotes ? `
  <div class="section">
    <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Customer Notes</div>
    <div style="font-size:13px;color:#374151;font-style:italic;">${booking.customerNotes}</div>
  </div>` : ''}

  <!-- ═══ RATINGS ══════════════════════════════════════════════════════════════ -->
  ${booking.customerRating?.ratingValue ? `
  <div class="section">
    <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Customer Rating</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:18px;">${'⭐'.repeat(booking.customerRating.ratingValue)}</span>
      <span style="font-size:13px;color:#374151;">${booking.customerRating.review || ''}</span>
    </div>
  </div>` : ''}

  <!-- ═══ FOOTER ═══════════════════════════════════════════════════════════════ -->
  <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
    <div style="font-size:11px;color:#9ca3af;">
      This is a computer-generated invoice. No physical signature required.
    </div>
    <div style="font-size:11px;color:#9ca3af;margin-top:4px;">
      For support: <a href="mailto:support@likeson.in" style="color:#0f3460;text-decoration:none;">support@likeson.in</a>
      &bull; <a href="https://likeson.in" style="color:#0f3460;text-decoration:none;">likeson.in</a>
    </div>
    <div style="font-size:10px;color:#d1d5db;margin-top:6px;">
      Generated: ${new Date().toLocaleString('en-IN')} &bull; ${booking.bookingNumber}
    </div>
  </div>

</div>
</body>
</html>`;
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF GENERATOR (puppeteer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate PDF buffer from a populated Booking document.
 *
 * Uses puppeteer-core + @sparticuz/chromium for Lambda/serverless.
 * Falls back to returning the HTML as a Buffer if puppeteer is unavailable.
 *
 * @param {object} booking — populated Booking lean object
 * @returns {Promise<Buffer>}
 */
export const generateBookingInvoicePdf = async (booking) => {
  const html = buildBookingInvoiceHtml(booking);

  let browser = null;

  try {
    // Try @sparticuz/chromium (serverless / Lambda)
    let puppeteer;
    let launchOptions;

    try {
      const chromium = (await import('@sparticuz/chromium')).default;
      puppeteer = (await import('puppeteer-core')).default;

      launchOptions = {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      };
    } catch {
      // Local dev fallback — standard puppeteer
      puppeteer = (await import('puppeteer')).default;
      launchOptions = { headless: 'new' };
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      displayHeaderFooter: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (err) {
    console.error('[generateBookingInvoicePdf] PDF generation failed:', err.message);
    // Fallback: return HTML as buffer (browser will render it)
    return Buffer.from(html, 'utf-8');
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
};