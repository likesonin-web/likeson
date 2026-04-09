/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PHARMACY ADMIN EMAIL TEMPLATES — LIKESON HEALTHCARE
 * Store Invoice · Low Stock Alert · Expiry Alert · Settlement Confirmation
 * All templates use inline-CSS for Gmail / Outlook / mobile compatibility.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─── Shared master layout (mirrors main emailTemplates.js) ────────────────────



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