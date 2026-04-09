/**
 * deliveryLabel.utils.js — Likeson.in
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a production-grade, print-ready HTML delivery label.
 *
 * Changes from v1:
 *  - Poppins font (Google Fonts loaded at generation time)
 *  - Reduced font sizes throughout — fits on one 100mm × 150mm page
 *  - Store phone removed from Ship From block
 *  - hsnCode rendered as plain string (not ObjectId) — must be pre-populated
 *    via Medicine.populate('hsnCode') before calling generateDeliveryLabel,
 *    then pass item.hsnCode?.hsnCode (the string) in each items entry
 *  - Prescription verified badge shown when prescription.isVerified === true
 *  - HTML includes auto-download trigger (JS blob download on load)
 *    Router must set Content-Disposition: attachment; filename="label-xxx.html"
 *
 * Usage:
 *   import { generateDeliveryLabel } from '../utils/deliveryLabel.utils.js';
 *   const { html, labelId } = await generateDeliveryLabel({ order, store, customer });
 *   res.setHeader('Content-Disposition', `attachment; filename="label-${order.orderId}.html"`);
 *   res.status(200).send(html);
 *
 * Dependencies:
 *   npm install qrcode jsbarcode canvas
 * ─────────────────────────────────────────────────────────────────────────────
 */

import QRCode    from 'qrcode';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — QR CODE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

const generateQrDataUrl = async (text, size = 100) => {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      type:    'image/png',
      margin:  1,
      width:   size,
      color:   { dark: '#000000', light: '#ffffff' },
    });
  } catch {
    return `data:image/svg+xml;base64,${Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="9" fill="#999">QR Error</text>
      </svg>`
    ).toString('base64')}`;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — BARCODE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

const generateBarcodeDataUrl = (value) => {
  try {
    const canvas = createCanvas(280, 48);
    JsBarcode(canvas, value, {
      format:       'CODE128',
      width:        1.6,
      height:       38,
      displayValue: true,
      fontSize:     9,
      margin:       4,
      background:   '#ffffff',
      lineColor:    '#000000',
      textAlign:    'center',
      textPosition: 'bottom',
      fontOptions:  'bold',
    });
    return canvas.toDataURL('image/png');
  } catch {
    return `data:image/svg+xml;base64,${Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="48">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="9" fill="#999">Barcode Error</text>
      </svg>`
    ).toString('base64')}`;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — BADGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const badgeHtml = (text, color = '#c0392b', bg = '#fdecea') =>
  `<span style="display:inline-block;padding:1px 5px;border-radius:2px;background:${bg};
    color:${color};font-size:7.5px;font-weight:700;letter-spacing:0.3px;margin:1px 1px;line-height:1.4;">
    ${text}
  </span>`;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — LABEL ID GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

const generateLabelId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand  = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `LBL-${rand}-${String(Date.now()).slice(-6)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — MAIN LABEL GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateDeliveryLabel
 *
 * NOTE on hsnCode: Before calling this function, populate each order item's
 * hsnCode field from the HsnCode collection. The items array passed in should
 * have items where item.hsnCode is either:
 *   - A plain string (the HSN code itself), OR
 *   - An object with { hsnCode: string, gstPercentage: number }
 *
 * The router should do:
 *   await order.populate({ path: 'items.medicine', populate: { path: 'hsnCode' } });
 * then map items so each item has hsnCode as the string value.
 *
 * @param {object} params
 * @param {object} params.order    – PharmacyOrder document (.toObject())
 * @param {object} params.store    – PharmacyStore document (.lean() or .toObject())
 * @param {object} params.customer – User { name, phone, email }
 *
 * @returns {Promise<{ html: string, labelId: string }>}
 */
export const generateDeliveryLabel = async ({ order, store, customer }) => {
  const labelId     = generateLabelId();
  const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // ── QR payload ─────────────────────────────────────────────────────────────
  const qrPayload = JSON.stringify({
    labelId,
    orderId:   order.orderId,
    storeId:   String(store._id),
    storeName: store.storeName,
    customer:  customer?.name || 'Customer',
    phone:     order.delivery?.address?.phone || customer?.phone || '',
    address:   order.delivery?.address,
    items: (order.items || []).map((i) => ({
      name: i.name,
      qty:  i.quantity,
      // hsnCode may be object (populated) or string
      hsn:  typeof i.hsnCode === 'object' ? (i.hsnCode?.hsnCode || '') : (i.hsnCode || ''),
    })),
    generatedAt,
  });

  // ── Generate QR + Barcode concurrently ────────────────────────────────────
  const [qrDataUrl, barcodeDataUrl] = await Promise.all([
    generateQrDataUrl(qrPayload, 100),
    Promise.resolve(generateBarcodeDataUrl(order.orderId)),
  ]);

  // ── Address blocks ─────────────────────────────────────────────────────────
  const da = order.delivery?.address || {};
  const shipTo = [
    `<strong style="font-size:10px;">${da.fullName || customer?.name || 'Customer'}</strong>`,
    da.phone   ? `📞 ${da.phone}` : '',
    da.line1   ? da.line1 : '',
    da.landmark ? `Near: ${da.landmark}` : '',
    `${da.city || 'Vijayawada'}, ${da.state || 'Andhra Pradesh'}`,
    da.pincode ? `<strong style="font-size:11px;letter-spacing:2px;">PIN: ${da.pincode}</strong>` : '',
  ].filter(Boolean).join('<br>');

  const storeAddress = store.address
    ? `${store.address.line1 || ''}, ${store.address.city || 'Vijayawada'}, ${store.address.state || 'AP'} — ${store.address.pincode || ''}`
    : 'Vijayawada, Andhra Pradesh';

  // ── Medicine item rows ─────────────────────────────────────────────────────
  const itemRows = (order.items || []).map((item, idx) => {
    // Resolve HSN string whether it's a populated object or raw string
    const hsnString = typeof item.hsnCode === 'object'
      ? (item.hsnCode?.hsnCode || '')
      : (item.hsnCode || '');

    const badges = [];
    if (item.isPrescriptionRequired)  badges.push(badgeHtml('Rx', '#7b1fa2', '#f3e5f5'));
    if (hsnString)                    badges.push(badgeHtml(`HSN: ${hsnString}`, '#1565c0', '#e3f2fd'));
    if (item.gstPercentage != null)   badges.push(badgeHtml(`GST ${item.gstPercentage}%`, '#2e7d32', '#e8f5e9'));

    return `
      <tr style="border-bottom:1px solid #e8e8e8;">
        <td style="padding:2px 3px;font-size:8px;color:#555;">${idx + 1}</td>
        <td style="padding:2px 3px;font-size:8.5px;">
          <strong>${item.name || item.brandName || '—'}</strong>
          ${item.genericName ? `<br><span style="color:#888;font-size:7.5px;">${item.genericName}</span>` : ''}
          <br>${badges.join('')}
        </td>
        <td style="padding:2px 3px;font-size:8.5px;text-align:center;">${item.quantity}</td>
        <td style="padding:2px 3px;font-size:8.5px;text-align:right;">₹${(item.totalPrice || 0).toFixed(2)}</td>
      </tr>`;
  }).join('');

  // ── Compliance badges ──────────────────────────────────────────────────────
  const hasScheduleX  = (order.items || []).some((i) => i.schedule === 'X');
  const hasScheduleH1 = (order.items || []).some((i) => i.schedule === 'H1');
  const hasColdChain  = (order.items || []).some((i) => i.requiresColdChain);
  const hasRx         = (order.items || []).some((i) => i.isPrescriptionRequired);

  const complianceBadges = [
    hasScheduleX  ? badgeHtml('⚠ SCHEDULE X — NARCOTIC', '#7b1fa2', '#ede7f6') : '',
    hasScheduleH1 ? badgeHtml('⚠ SCHEDULE H1', '#e65100', '#fff3e0') : '',
    hasColdChain  ? badgeHtml('❄ COLD CHAIN', '#0277bd', '#e1f5fe') : '',
    hasRx         ? badgeHtml('Rx ONLY', '#c62828', '#fdecea') : '',
  ].filter(Boolean).join(' ');

  // ── Prescription verified badge ────────────────────────────────────────────
  const prescriptionVerifiedBadge = order.prescription?.isVerified
    ? badgeHtml('✔ PRESCRIPTION VERIFIED', '#1b5e20', '#e8f5e9')
    : '';

  // ── Payment / billing ──────────────────────────────────────────────────────
  const payMethod     = order.payment?.method  || 'N/A';
  const payStatus     = order.payment?.status  || 'Pending';
  const isCOD         = payMethod === 'COD';
  const payBadgeColor = payStatus === 'Paid'
    ? { color: '#1b5e20', bg: '#e8f5e9' }
    : payStatus === 'Pending'
      ? { color: '#e65100', bg: '#fff3e0' }
      : { color: '#b71c1c', bg: '#fdecea' };

  // ── HTML assembly ──────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Label — ${order.orderId}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Poppins', 'Segoe UI', Arial, sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 16px;
      min-height: 100vh;
    }

    /* 100mm × 150mm label */
    .label {
      width: 378px;
      background: #ffffff;
      border: 1.5px solid #212121;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 3px 10px rgba(0,0,0,0.12);
      page-break-after: always;
      font-size: 8.5px;
      line-height: 1.45;
    }

    /* Header */
    .label-header {
      background: #212121;
      color: #fff;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand  { font-size: 12px; font-weight: 800; letter-spacing: 0.8px; }
    .label-id { font-size: 7px; color: #bbb; text-align: right; }

    /* Barcode */
    .barcode-section {
      padding: 5px 10px 3px;
      text-align: center;
      border-bottom: 1px dashed #bbb;
      background: #fafafa;
    }
    .barcode-section img { max-width: 100%; height: 44px; object-fit: contain; }

    /* Payment strip */
    .payment-strip {
      padding: 4px 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1.5px solid #212121;
      background: ${isCOD ? '#fff8e1' : '#e8f5e9'};
      font-size: 8.5px;
    }
    .pay-label  { font-weight: 700; color: #212121; }
    .pay-method {
      font-weight: 700;
      color: ${isCOD ? '#e65100' : '#1b5e20'};
      border: 1px solid ${isCOD ? '#e65100' : '#1b5e20'};
      padding: 1px 5px;
      border-radius: 2px;
    }
    .pay-status {
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 2px;
      background: ${payBadgeColor.bg};
      color: ${payBadgeColor.color};
    }
    ${isCOD ? `.cod-amount {
      font-size: 10px; font-weight: 900; color: #c62828;
      border: 1.5px solid #c62828; padding: 1px 6px;
      border-radius: 2px; margin-left: auto;
    }` : ''}

    /* Address grid */
    .address-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #e0e0e0;
    }
    .address-block {
      padding: 6px 8px;
      font-size: 8px;
      line-height: 1.5;
      color: #212121;
    }
    .address-block:first-child { border-right: 1px solid #e0e0e0; }
    .block-title {
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #757575;
      margin-bottom: 3px;
    }

    /* QR + meta row */
    .qr-meta-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 5px 10px;
      border-bottom: 1px solid #e0e0e0;
      background: #fafafa;
    }
    .qr-meta-row img.qr { width: 68px; height: 68px; border: 1px solid #e0e0e0; border-radius: 2px; flex-shrink: 0; }
    .meta-info { font-size: 7.5px; line-height: 1.6; color: #333; flex: 1; }
    .meta-info strong { color: #212121; }

    /* Items table */
    .items-section { padding: 4px 8px; }
    .section-title {
      font-size: 7px; font-weight: 700;
      letter-spacing: 0.6px; text-transform: uppercase;
      color: #616161; margin-bottom: 3px;
    }
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table th {
      text-align: left; font-size: 7px; font-weight: 700;
      color: #757575; text-transform: uppercase; letter-spacing: 0.4px;
      padding: 2px 3px; border-bottom: 1.5px solid #212121;
    }

    /* Compliance strip */
    .compliance-strip {
      padding: 3px 8px;
      background: #fff9c4;
      border-top: 1px solid #f9a825;
      border-bottom: 1px solid #f9a825;
      font-size: 7.5px;
    }

    /* Billing */
    .billing-row {
      display: flex; justify-content: space-between;
      padding: 1.5px 10px; font-size: 8px; color: #424242;
    }
    .billing-row.total {
      font-weight: 700; font-size: 9.5px; color: #212121;
      border-top: 1.5px solid #212121; margin-top: 2px; padding-top: 3px;
    }

    /* Footer */
    .label-footer {
      background: #212121; color: #bbb;
      padding: 4px 10px; font-size: 7px;
      text-align: center; line-height: 1.5;
    }
    .label-footer strong { color: #fff; }

    /* Print */
    @media print {
      body { background: none; padding: 0; }
      .label { width: 100mm; border-radius: 0; box-shadow: none; page-break-after: always; }
      @page { size: 100mm 150mm; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="label">

    <!-- HEADER -->
    <div class="label-header">
      <div class="brand">⚕ LIKESON HEALTHCARE</div>
      <div class="label-id">
        <div>LABEL: ${labelId}</div>
        <div>${generatedAt}</div>
      </div>
    </div>

    <!-- BARCODE -->
    <div class="barcode-section">
      <img src="${barcodeDataUrl}" alt="Barcode ${order.orderId}">
    </div>

    <!-- PAYMENT STRIP -->
    <div class="payment-strip">
      <span class="pay-label">PAYMENT:</span>
      <span class="pay-method">${payMethod}</span>
      <span class="pay-status">${payStatus.toUpperCase()}</span>
      ${isCOD
        ? `<span class="cod-amount">COD: ₹${(order.billing?.totalPayable || 0).toFixed(2)}</span>`
        : ''}
    </div>

    <!-- ADDRESS GRID -->
    <div class="address-grid">
      <div class="address-block">
        <div class="block-title">📦 SHIP TO</div>
        ${shipTo}
      </div>
      <div class="address-block">
        <div class="block-title">🏪 SHIP FROM</div>
        <strong>${store.storeName}</strong><br>
        ${storeAddress}<br>
        ${store.legal?.gstNumber ? `GST: ${store.legal.gstNumber}` : ''}
        ${store.legal?.dlNumber  ? `<br>DL: ${store.legal.dlNumber}` : ''}
      </div>
    </div>

    <!-- QR + META -->
    <div class="qr-meta-row">
      <img src="${qrDataUrl}" alt="QR" class="qr">
      <div class="meta-info">
        <strong>Order ID:</strong> ${order.orderId}<br>
        <strong>Label ID:</strong> ${labelId}<br>
        <strong>Items:</strong> ${(order.items || []).length} medicine(s)<br>
        <strong>Delivery:</strong> ${order.delivery?.deliveryType || 'Internal'}<br>
        ${order.delivery?.estimatedArrival
          ? `<strong>Est. Arrival:</strong> ${new Date(order.delivery.estimatedArrival).toLocaleDateString('en-IN')}<br>`
          : ''}
        ${prescriptionVerifiedBadge}
        <br><strong>Generated:</strong> ${generatedAt}
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <div class="items-section">
      <div class="section-title">📋 Order Contents</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:14px;">#</th>
            <th>Medicine / Details</th>
            <th style="width:24px;text-align:center;">Qty</th>
            <th style="width:48px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <!-- COMPLIANCE -->
    ${complianceBadges
      ? `<div class="compliance-strip">⚠ <strong>COMPLIANCE:</strong> ${complianceBadges}</div>`
      : ''}

    <!-- BILLING -->
    <div style="padding:4px 0 2px;">
      <div class="billing-row"><span>Subtotal</span><span>₹${(order.billing?.subTotal || 0).toFixed(2)}</span></div>
      ${order.billing?.gstAmount
        ? `<div class="billing-row"><span>GST</span><span>₹${order.billing.gstAmount.toFixed(2)}</span></div>`
        : ''}
      ${order.billing?.deliveryCharges
        ? `<div class="billing-row"><span>Delivery</span><span>₹${order.billing.deliveryCharges.toFixed(2)}</span></div>`
        : ''}
      ${order.billing?.discountAmount
        ? `<div class="billing-row" style="color:#2e7d32;"><span>Discount</span><span>−₹${order.billing.discountAmount.toFixed(2)}</span></div>`
        : ''}
      <div class="billing-row total">
        <span>TOTAL PAYABLE</span>
        <span>₹${(order.billing?.totalPayable || 0).toFixed(2)}</span>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="label-footer">
      <strong>Likeson Healthcare Pvt. Ltd.</strong> — Vijayawada, Andhra Pradesh<br>
      support@likeson.in | www.likeson.in<br>
      Contains medicines. Handle with care. Keep away from heat &amp; moisture.<br>
      Label: ${labelId} | Order: ${order.orderId}
    </div>

  </div>

  <!--
    AUTO-DOWNLOAD SCRIPT
    When served from the router with Content-Disposition: attachment,
    the browser will download directly. This script is a fallback for
    any browser that opens the HTML in a tab instead of downloading.
  -->
  <script>
    (function () {
      try {
        const html     = document.documentElement.outerHTML;
        const blob     = new Blob([html], { type: 'text/html' });
        const url      = URL.createObjectURL(blob);
        const a        = document.createElement('a');
        a.href         = url;
        a.download     = 'label-${order.orderId}.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        // Silently ignore — the Content-Disposition header handles real downloads
      }
    })();
  </script>
</body>
</html>`;

  return { html, labelId };
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — BATCH LABEL GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateBatchLabels
 * Multiple labels in one printable HTML page.
 *
 * @param {Array<{ order, store, customer }>} labelDataArray
 * @returns {Promise<{ html: string, count: number, labelIds: string[] }>}
 */
export const generateBatchLabels = async (labelDataArray) => {
  const results  = await Promise.all(labelDataArray.map((d) => generateDeliveryLabel(d)));
  const labelIds = results.map((r) => r.labelId);

  const allBodies = results
    .map((r) => {
      const match = r.html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      return match ? match[1] : '';
    })
    .join('\n<div style="page-break-after:always;"></div>\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Batch Labels — Likeson Healthcare</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { background:#f5f5f5; display:flex; flex-wrap:wrap; gap:16px; padding:16px; font-family:'Poppins',sans-serif; }
    @media print {
      body { background:none; padding:0; gap:0; }
      @page { size: 100mm 150mm; margin: 0; }
    }
    ${results[0]?.html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || ''}
  </style>
</head>
<body>
  ${allBodies}
</body>
</html>`;

  return { html, count: results.length, labelIds };
};

export default { generateDeliveryLabel, generateBatchLabels };