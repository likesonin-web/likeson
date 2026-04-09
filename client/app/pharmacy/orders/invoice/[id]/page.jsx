'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download, Printer, XCircle,
  Truck, MapPin, Pill, AlertCircle, Building2, RefreshCw,
  BadgeCheck, Loader2,
} from 'lucide-react';

import {
  fetchOrderById,
  selectCurrentOrder,
  selectPharmacyGlobalLoading,
  selectOrderError,
  clearCurrentOrder,
  clearPharmacyErrors,
} from '@/store/slices/pharmacyOrderSlice';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  indigo:     '#4f46e5',
  indigoDark: '#3730a3',
  violet:     '#7c3aed',
  green:      '#16a34a',
  greenBg:    '#f0fdf4',
  amber:      '#d97706',
  amberBg:    '#fffbeb',
  red:        '#dc2626',
  redBg:      '#fef2f2',
  blue:       '#2563eb',
  blueBg:     '#eff6ff',
  gray:       '#6b7280',
  white:      '#ffffff',
  s900:       '#0f172a',
  s800:       '#1e293b',
  s700:       '#334155',
  s600:       '#475569',
  s500:       '#64748b',
  s400:       '#94a3b8',
  s300:       '#cbd5e1',
  s200:       '#e2e8f0',
  s100:       '#f1f5f9',
  s50:        '#f8fafc',
  text:       '#111827',
  textMid:    '#374151',
  textLight:  '#9ca3af',
};

const STATUS_META = {
  Placed:             { hex: '#38bdf8', label: 'Placed'           },
  Confirmed:          { hex: C.indigo,  label: 'Confirmed'        },
  Processing:         { hex: C.amber,   label: 'Processing'       },
  'Out-for-Delivery': { hex: '#06b6d4', label: 'Out for Delivery' },
  Delivered:          { hex: C.green,   label: 'Delivered'        },
  Cancelled:          { hex: C.red,     label: 'Cancelled'        },
};

const RX_CFG = {
  Not_Uploaded: { hex: C.gray,  label: 'Not Uploaded'   },
  Pending:      { hex: C.amber, label: 'Pending Review'  },
  Approved:     { hex: C.green, label: 'Approved'        },
  Rejected:     { hex: C.red,   label: 'Rejected'        },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const sv  = (v) => (v == null ? '' : String(v));
const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d, time = false) => {
  if (!d) return '—';
  const o = { day: 'numeric', month: 'short', year: 'numeric' };
  if (time) { o.hour = '2-digit'; o.minute = '2-digit'; }
  return new Date(d).toLocaleDateString('en-IN', o);
};
const hex2rgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});
const rgba = (hex, a) => { const { r, g, b } = hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; };

// ─── PDF HTML BUILDER ─────────────────────────────────────────────────────────
// Renders a pure HTML/CSS document using mm-based A4 sizing with a proper
// @page rule. Opened in a new window and printed via the browser's native
// print-to-PDF — no html2canvas, no canvas scaling, no blank page bugs.
function buildInvoiceHTML(order) {
  const ds  = sv(order.delivery?.status) || 'Placed';
  const sm  = STATUS_META[ds] || STATUS_META.Placed;
  const H   = sm.hex;
  const pm  = sv(order.payment?.method)  || 'COD';
  const ps  = sv(order.payment?.status)  || 'Pending';
  const bl  = order.billing || {};
  const st  = order.store   || {};
  const rxS = sv(order.prescription?.verificationStatus) || 'Not_Uploaded';
  const rx  = RX_CFG[rxS] || RX_CFG.Not_Uploaded;

  const addr = order.delivery?.address;
  const addrBlock = addr
    ? `<p class="addr-name">${sv(addr.fullName)}</p>
       <p class="addr-line">${sv(addr.line1)}${addr.landmark ? `, Near ${sv(addr.landmark)}` : ''}</p>
       <p class="addr-line">${sv(addr.city)}, ${sv(addr.state)} — ${sv(addr.pincode)}</p>
       ${addr.phone ? `<p class="addr-line">📞 ${sv(addr.phone)}</p>` : ''}`
    : `<p class="muted-sm">No delivery address</p>`;

  const billRowsHTML = [
    ['Sub Total',    fmt(bl.subTotal),  ''],
    Number(bl.gstAmount)        > 0 ? ['GST',          fmt(bl.gstAmount),                '']       : null,
    Number(bl.deliveryCharges)  > 0 ? ['Delivery',     fmt(bl.deliveryCharges),           '']       : null,
    Number(bl.platformFee)      > 0 ? ['Platform Fee', fmt(bl.platformFee),               '']       : null,
    Number(bl.discountAmount)   > 0 ? ['Discount',     `— ${fmt(bl.discountAmount)}`,     C.green]  : null,
    Number(bl.walletAmountUsed) > 0 ? ['Wallet Used',  `— ${fmt(bl.walletAmountUsed)}`,   C.indigo] : null,
  ].filter(Boolean).map(([l, v, c]) =>
    `<div class="bill-row">
       <span class="bill-label">${l}</span>
       <span class="bill-val"${c ? ` style="color:${c}"` : ''}>${v}</span>
     </div>`
  ).join('');

  const itemsHTML = (order.items || []).map((item, i) => {
    const name   = sv(item.name || item.medicine?.brandName || 'Medicine');
    const gen    = sv(item.genericName || '');
    const dos    = sv(item.medicine?.dosage || '');
    const qty    = Number(item.quantity) || 1;
    const unit   = Number(item.pricePerUnit) || 0;
    const tax    = Number(item.taxAmount) || 0;
    const total  = Number(item.totalPrice) || 0;
    const gst    = Number(item.gstPercentage) || 0;
    const hsn    = sv(item.hsnCode || '3004');
    const needRx = item.isPrescriptionRequired;
    return `
    <div class="item-row${i % 2 === 0 ? ' item-alt' : ''}">
      <div class="item-info">
        <div class="pill-icon">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="${C.indigo}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
            <path d="m8.5 8.5 7 7"/>
          </svg>
        </div>
        <div class="item-text">
          <p class="item-name">${name}</p>
          ${gen ? `<p class="item-sub">${gen}</p>` : ''}
          ${dos ? `<p class="item-sub">${dos}</p>` : ''}
          <div class="badge-row">
            ${gst > 0   ? `<span class="badge badge-blue">GST ${gst}%</span>` : ''}
            ${needRx    ? `<span class="badge badge-amber">Rx Required</span>` : ''}
          </div>
        </div>
      </div>
      <div class="cell-center item-hsn">${hsn}</div>
      <div class="cell-right item-qty">${qty}</div>
      <div class="cell-right item-price">
        <span class="price-main">${fmt(unit)}</span>
        ${tax > 0 ? `<br/><span class="price-tax">+${fmt(tax)} tax</span>` : ''}
      </div>
      <div class="cell-right item-total">${fmt(total)}</div>
    </div>`;
  }).join('');

  const histHTML = (order.delivery?.statusHistory || []).map((h, i, arr) => `
    <div class="hist-step">
      <div class="hist-dot"></div>
      <div>
        <p class="hist-status">${sv(h.status)}</p>
        <p class="hist-time">${fmtDate(h.timestamp, true)}</p>
      </div>
      ${i < arr.length - 1 ? `<div class="hist-line"></div>` : ''}
    </div>`).join('');

  const rxBlock = order.prescription?.isRequired
    ? `<div class="rx-box" style="background:${rgba(rx.hex, .08)};border:1px solid ${rgba(rx.hex, .3)}">
         <p class="rx-status" style="color:${rx.hex}">${rx.label}</p>
         ${order.prescription.verifiedAt
           ? `<p class="rx-meta">${fmtDate(order.prescription.verifiedAt, true)}${order.prescription.verifiedBy?.name ? ` · ${order.prescription.verifiedBy.name}` : ''}</p>`
           : ''}
         ${rxS === 'Rejected' && order.prescription.rejectionReason
           ? `<p class="rx-reject">${sv(order.prescription.rejectionReason)}</p>`
           : ''}
       </div>`
    : `<p class="muted-sm">No prescription required</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<title>Invoice ${sv(order.orderId)}</title>
<style>
/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Base ── */
html, body {
  font-family: 'Poppins', sans-serif;
  background: #fff;
  color: ${C.text};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── A4 page ── */
@page { size: A4 portrait; margin: 0; }

.page {
  width: 210mm;
  background: #fff;
  margin: 0 auto;
  overflow: hidden;
}

/* ── HEADER ── */
.header {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, ${C.s900} 0%, ${C.s800} 55%, ${C.s900} 100%);
  padding: 16mm 22mm 0;
}
.blob1 {
  position: absolute; top: -12mm; right: -12mm;
  width: 44mm; height: 44mm; border-radius: 50%;
  background: ${rgba(H, .13)};
}
.blob2 {
  position: absolute; bottom: -7mm; left: -7mm;
  width: 36mm; height: 36mm; border-radius: 50%;
  background: ${rgba(C.indigo, .15)};
}
.header-inner {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4mm;
  margin-bottom: 5mm;
}
.brand-row { display: flex; align-items: center; gap: 3mm; margin-bottom: 4mm; }
.brand-logo {
  width: 10mm; height: 10mm; border-radius: 2.5mm;
  background: linear-gradient(135deg, ${C.indigo}, ${C.violet});
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.brand-logo span { color: #fff; font-weight: 900; font-size: 5mm; }
.brand-name { color: #fff; font-weight: 800; font-size: 4mm; line-height: 1; }
.brand-sub  { color: rgba(255,255,255,.44); font-size: 2.2mm; letter-spacing: .5mm; text-transform: uppercase; margin-top: .5mm; }
.invoice-title { color: #fff; font-weight: 900; font-size: 10mm; letter-spacing: -.5mm; line-height: 1; margin-bottom: .5mm; }
.invoice-sub   { color: rgba(255,255,255,.34); font-size: 2mm; letter-spacing: .4mm; text-transform: uppercase; font-weight: 600; }

.header-meta { text-align: right; flex-shrink: 0; }
.status-badge {
  display: inline-block;
  padding: 1.2mm 3.5mm;
  border-radius: 2mm;
  background: ${rgba(H, .18)};
  border: .3mm solid ${rgba(H, .4)};
  margin-bottom: 2.5mm;
}
.status-badge span { color: ${H}; font-weight: 800; font-size: 2.4mm; letter-spacing: .4mm; text-transform: uppercase; }
.order-id   { color: #fff; font-weight: 800; font-size: 3.5mm; margin-bottom: .5mm; }
.order-date { color: rgba(255,255,255,.38); font-size: 2.4mm; line-height: 1.6; }

.header-bar { height: .9mm; background: linear-gradient(90deg, ${C.indigo}, ${H}, ${C.green}); }

/* ── TWO-COL (Sold By / Ship To) ── */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: .3mm solid ${C.s200};
}
.col-box { padding: 4mm 6mm; }
.col-box.br { border-right: .3mm solid ${C.s200}; }

.sec-label {
  font-size: 2mm; font-weight: 700;
  letter-spacing: .4mm; text-transform: uppercase;
  color: ${C.s500}; margin-bottom: 2.5mm;
}
.icon-row { display: flex; align-items: flex-start; gap: 2.5mm; }
.icon-box {
  width: 7.5mm; height: 7.5mm; border-radius: 2mm;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.store-name { font-weight: 700; font-size: 3mm; color: ${C.text}; margin-bottom: .7mm; }
.store-line { font-size: 2.5mm; color: ${C.s500}; line-height: 1.55; margin-bottom: .3mm; }
.addr-name  { font-weight: 700; font-size: 3mm; color: ${C.text}; margin-bottom: .7mm; }
.addr-line  { font-size: 2.5mm; color: ${C.s500}; line-height: 1.55; margin-bottom: .3mm; }
.muted-sm   { font-size: 2.5mm; color: ${C.s300}; }

/* ── ITEMS TABLE ── */
.items-section { padding: 4mm 6mm 3mm; }

.table-head,
.item-row {
  display: grid;
  grid-template-columns: 42% 14% 7% 19% 18%;
  align-items: center;
  padding: 2.2mm 3mm;
  border-radius: 2mm;
  margin-bottom: 1mm;
}
.table-head {
  background: linear-gradient(135deg, ${C.s900}, ${C.s800});
}
.th {
  font-size: 2mm; font-weight: 700;
  letter-spacing: .3mm; text-transform: uppercase;
  color: #fff;
}
.th.center { text-align: center; }
.th.right  { text-align: right; }

.item-row { border: .3mm solid ${C.s200}; }
.item-alt { background: ${C.s50}; }

.item-info { display: flex; align-items: flex-start; gap: 2mm; }
.pill-icon {
  width: 5.5mm; height: 5.5mm; border-radius: 1.5mm; flex-shrink: 0;
  background: ${rgba(C.indigo, .09)};
  display: flex; align-items: center; justify-content: center;
  margin-top: .3mm;
}
.item-text {}
.item-name { font-weight: 700; font-size: 2.8mm; color: ${C.text}; line-height: 1.3; margin-bottom: .3mm; }
.item-sub  { font-size: 2.2mm; color: ${C.s500}; margin-bottom: .3mm; line-height: 1.4; }
.badge-row { display: flex; gap: 1mm; flex-wrap: wrap; margin-top: .6mm; }
.badge {
  font-size: 2mm; font-weight: 700;
  padding: .3mm 1.2mm; border-radius: 1mm;
}
.badge-blue  { background: ${C.blueBg};  color: ${C.blue};  border: .25mm solid ${rgba(C.blue, .2)}; }
.badge-amber { background: ${C.amberBg}; color: ${C.amber}; border: .25mm solid ${rgba(C.amber, .25)}; }

.cell-center { text-align: center; }
.cell-right  { text-align: right; }
.item-hsn   { font-size: 2.5mm; color: ${C.s500}; }
.item-qty   { font-size: 2.8mm; font-weight: 600; color: ${C.textMid}; }
.item-price { font-size: 2.8mm; }
.price-main { font-weight: 600; color: ${C.textMid}; }
.price-tax  { font-size: 2.2mm; color: ${C.s500}; }
.item-total { font-size: 3mm; font-weight: 800; color: ${C.text}; }

/* ── BILLING ── */
.billing-wrap { padding: 0 6mm 3.5mm; display: flex; justify-content: flex-end; }
.billing-box  { width: 65mm; border-radius: 2.5mm; overflow: hidden; border: .3mm solid ${C.s200}; }
.billing-rows { padding: 3mm 4mm; background: ${C.s50}; }
.bill-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: .7mm 0; font-size: 2.8mm;
}
.bill-label { color: ${C.s500}; font-weight: 400; }
.bill-val   { font-weight: 600; color: ${C.text}; }
.billing-total {
  padding: 3mm 4mm;
  display: flex; align-items: center; justify-content: space-between;
  background: linear-gradient(135deg, ${C.s900}, ${C.s800});
}
.total-label { color: #fff; font-weight: 700; font-size: 2.4mm; letter-spacing: .2mm; text-transform: uppercase; }
.total-val   { color: #fff; font-weight: 800; font-size: 5mm; }

/* ── DIVIDER ── */
.divider { height: .3mm; background: ${C.s200}; }

/* ── PAYMENT + PRESCRIPTION ── */
.pay-rx { display: grid; grid-template-columns: 1fr 1fr; }
.pay-box { padding: 3.5mm 6mm; border-right: .3mm solid ${C.s200}; }
.rx-wrap { padding: 3.5mm 6mm; }
.pay-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: .7mm 0; font-size: 3mm;
}
.pay-label { color: ${C.s500}; font-weight: 400; }
.pay-val   { font-weight: 600; color: ${C.text}; }
.rx-box { padding: 2.5mm 3mm; border-radius: 2.5mm; }
.rx-status { font-weight: 700; font-size: 3.2mm; }
.rx-meta   { font-size: 2.3mm; color: ${C.s500}; margin-top: .6mm; }
.rx-reject { font-size: 2.3mm; color: ${C.red};   margin-top: .6mm; font-style: italic; }

/* ── DELIVERY TIMELINE ── */
.delivery-wrap { margin: 3mm 6mm; }
.delivery-box  { border-radius: 2.5mm; overflow: hidden; border: .3mm solid ${C.s200}; }
.delivery-head {
  padding: 2.2mm 4mm;
  display: flex; align-items: center; gap: 2mm;
  background: ${rgba(H, .1)};
}
.delivery-title { font-weight: 700; font-size: 2.3mm; letter-spacing: .35mm; text-transform: uppercase; color: ${H}; }
.delivery-body  { padding: 2.5mm 4mm; display: flex; align-items: center; gap: 4mm; flex-wrap: wrap; }
.hist-step { display: flex; align-items: center; gap: 1.5mm; flex-shrink: 0; }
.hist-dot  { width: 2mm; height: 2mm; border-radius: 50%; background: ${H}; flex-shrink: 0; }
.hist-status { font-size: 2.4mm; font-weight: 700; color: ${C.textMid}; }
.hist-time   { font-size: 2.1mm; color: ${C.textLight}; }
.hist-line   { width: 5mm; height: .3mm; background: ${C.s300}; margin-left: .5mm; }

/* ── FOOTER ── */
.footer { background: ${C.s50}; border-top: .3mm solid ${C.s200}; }
.footer-inner {
  padding: 4mm 7mm;
  display: flex; align-items: flex-end; justify-content: space-between;
  flex-wrap: wrap; gap: 3mm;
}
.footer-brand { font-weight: 800; font-size: 3mm; color: ${C.text}; margin-bottom: .5mm; }
.footer-gstin { font-size: 2mm; color: ${C.textLight}; letter-spacing: .3mm; text-transform: uppercase; margin-bottom: 1mm; }
.footer-note  { font-size: 2mm; color: ${C.textLight}; max-width: 100mm; line-height: 1.65; }
.footer-right { text-align: right; }
.footer-gen   { font-size: 2.2mm; color: ${C.s500}; font-weight: 600; margin-bottom: .3mm; }
.footer-date  { font-size: 2.8mm; font-weight: 800; color: ${C.text}; margin-bottom: .5mm; }
.footer-oid   { font-size: 2.2mm; color: ${C.textLight}; }
.footer-bar   { height: 1.2mm; background: linear-gradient(90deg, ${C.indigo}, ${H}, ${C.green}); }

/* ── Print ── */
@media print {
  html, body { margin: 0; padding: 0; background: #fff; }
  .page { margin: 0; }
}
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="blob1"></div>
    <div class="blob2"></div>
    <div class="header-inner">
      <div>
        <div class="brand-row">
          <div class="brand-logo"><span>L</span></div>
          <div>
            <p class="brand-name">LIKESON</p>
            <p class="brand-sub">Medicheck Hub</p>
          </div>
        </div>
        <h1 class="invoice-title">INVOICE</h1>
        <p class="invoice-sub">Tax Invoice / Bill of Supply</p>
      </div>
      <div class="header-meta">
        <div class="status-badge"><span>${sm.label}</span></div><br/>
        <p class="order-id">${sv(order.orderId)}</p>
        <p class="order-date">${fmtDate(order.createdAt, true)}</p>
        ${order.payment?.paidAt ? `<p class="order-date">Paid: ${fmtDate(order.payment.paidAt, true)}</p>` : ''}
      </div>
    </div>
    <div class="header-bar"></div>
  </div>

  <!-- SOLD BY / SHIP TO -->
  <div class="two-col">
    <div class="col-box br">
      <p class="sec-label">Sold By</p>
      <div class="icon-row">
        <div class="icon-box" style="background:${rgba(C.indigo, .08)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${C.indigo}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
            <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
          </svg>
        </div>
        <div>
          <p class="store-name">${sv(st.storeName) || 'Likeson Medicheck Hub'}</p>
          ${st.address ? `<p class="store-line">${[st.address.line1, st.address.city, st.address.state, st.address.pincode].filter(Boolean).join(', ')}</p>` : ''}
          ${st.contact?.phone ? `<p class="store-line">📞 ${sv(st.contact.phone)}</p>` : ''}
          ${st.contact?.email ? `<p class="store-line">✉ ${sv(st.contact.email)}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="col-box">
      <p class="sec-label">Ship To</p>
      <div class="icon-row">
        <div class="icon-box" style="background:${rgba(H, .1)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${H}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div>${addrBlock}</div>
      </div>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <div class="items-section">
    <p class="sec-label">Items Ordered</p>
    <div class="table-head">
      <div class="th">Medicine</div>
      <div class="th center">HSN Code</div>
      <div class="th right">Qty</div>
      <div class="th right">Unit Price</div>
      <div class="th right">Amount</div>
    </div>
    ${itemsHTML}
  </div>

  <!-- BILLING SUMMARY -->
  <div class="billing-wrap">
    <div class="billing-box">
      <div class="billing-rows">${billRowsHTML}</div>
      <div class="billing-total">
        <span class="total-label">Total Payable</span>
        <span class="total-val">${fmt(bl.totalPayable)}</span>
      </div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- PAYMENT + PRESCRIPTION -->
  <div class="pay-rx">
    <div class="pay-box">
      <p class="sec-label">Payment Info</p>
      <div class="pay-row">
        <span class="pay-label">Method</span>
        <span class="pay-val">${pm}</span>
      </div>
      <div class="pay-row">
        <span class="pay-label">Status</span>
        <span class="pay-val" style="color:${ps === 'Paid' ? C.green : C.amber}">${ps}</span>
      </div>
      ${order.payment?.paidAt
        ? `<div class="pay-row">
             <span class="pay-label">Paid At</span>
             <span class="pay-val">${fmtDate(order.payment.paidAt, true)}</span>
           </div>` : ''}
      ${order.payment?.razorpayPaymentId
        ? `<div class="pay-row">
             <span class="pay-label">Txn ID</span>
             <span class="pay-val" style="font-size:2.3mm">…${sv(order.payment.razorpayPaymentId).slice(-12)}</span>
           </div>` : ''}
    </div>
    <div class="rx-wrap">
      <p class="sec-label">Prescription</p>
      ${rxBlock}
    </div>
  </div>

  <div class="divider"></div>

  <!-- DELIVERY TIMELINE -->
  <div class="delivery-wrap">
    <div class="delivery-box">
      <div class="delivery-head">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${H}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/>
          <path d="M14 9h4l4 4v4h-8V9Z"/>
          <circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>
        </svg>
        <span class="delivery-title">Delivery Status: ${sm.label}</span>
      </div>
      ${histHTML ? `<div class="delivery-body">${histHTML}</div>` : ''}
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-inner">
      <div>
        <p class="footer-brand">LIKESON MEDICHECK HUB</p>
        <p class="footer-gstin">Authorized Pharmacy · GSTIN: XXXXXXXXXXXXXXXXX</p>
        <p class="footer-note">This is a computer-generated invoice and does not require a physical signature. All medicines are dispensed as per applicable pharmacy regulations.</p>
      </div>
      <div class="footer-right">
        <p class="footer-gen">Generated on</p>
        <p class="footer-date">${fmtDate(new Date(), true)}</p>
        <p class="footer-oid">${sv(order.orderId)}</p>
      </div>
    </div>
    <div class="footer-bar"></div>
  </div>

</div>
</body>
</html>`;
}

// ─── PDF DOWNLOAD via browser print-to-PDF ────────────────────────────────────
// Opens a new window with the invoice HTML and triggers the browser print dialog.
// User selects "Save as PDF" (or it auto-saves depending on browser).
// This guarantees pixel-perfect layout with no canvas scaling artifacts.
function openPrintWindow(html) {
  const win = window.open('', '_blank', 'width=950,height=750');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
      win.onafterprint = () => win.close();
    }, 850);
  };
  return true;
}

// ─── SCREEN INVOICE (Tailwind — never captured) ───────────────────────────────
function InvoicePreview({ order }) {
  const ds  = sv(order.delivery?.status) || 'Placed';
  const sm  = STATUS_META[ds] || STATUS_META.Placed;
  const H   = sm.hex;
  const bl  = order.billing || {};
  const st  = order.store   || {};
  const pm  = sv(order.payment?.method) || 'COD';
  const ps  = sv(order.payment?.status) || 'Pending';
  const rxS = sv(order.prescription?.verificationStatus) || 'Not_Uploaded';
  const rx  = RX_CFG[rxS] || RX_CFG.Not_Uploaded;

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-2xl text-gray-900"
      style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}>

      {/* Header */}
      <div className="relative overflow-hidden" style={{
        background: `linear-gradient(135deg, ${C.s900} 0%, ${C.s800} 55%, ${C.s900} 100%)`,
        minHeight: 190,
      }}>
        <div className="absolute rounded-full" style={{ top: -60, right: -60, width: 240, height: 240, background: rgba(H, .12) }} />
        <div className="absolute rounded-full" style={{ bottom: -30, left: -30, width: 180, height: 180, background: rgba(C.indigo, .14) }} />
        <div className="relative p-8">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${C.indigo}, ${C.violet})`, boxShadow: `0 6px 18px ${rgba(C.indigo, .42)}` }}>
                  <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>L</span>
                </div>
                <div>
                  <p style={{ color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: -.5 }}>LIKESON</p>
                  <p style={{ color: 'rgba(255,255,255,.44)', fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', marginTop: 2 }}>Medicheck Hub</p>
                </div>
              </div>
              <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 38, letterSpacing: -2, lineHeight: 1, marginBottom: 3 }}>INVOICE</h1>
              <p style={{ color: 'rgba(255,255,255,.34)', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700 }}>Tax Invoice / Bill of Supply</p>
            </div>
            <div className="text-right">
              <div className="inline-block px-4 py-1.5 rounded-xl mb-3"
                style={{ background: rgba(H, .18), border: `1px solid ${rgba(H, .4)}` }}>
                <span style={{ color: H, fontWeight: 900, fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase' }}>{sm.label}</span>
              </div>
              <p style={{ color: '#fff', fontWeight: 900, fontSize: 14, marginBottom: 3 }}>{sv(order.orderId)}</p>
              <p style={{ color: 'rgba(255,255,255,.38)', fontSize: 10 }}>{fmtDate(order.createdAt, true)}</p>
              {order.payment?.paidAt && <p style={{ color: 'rgba(255,255,255,.38)', fontSize: 10 }}>Paid: {fmtDate(order.payment.paidAt, true)}</p>}
            </div>
          </div>
        </div>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${C.indigo}, ${H}, ${C.green})` }} />
      </div>

      {/* Sold By / Ship To */}
      <div className="grid grid-cols-2" style={{ borderBottom: `1px solid ${C.s200}` }}>
        <div className="p-5" style={{ borderRight: `1px solid ${C.s200}` }}>
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: C.s500, marginBottom: 8 }}>Sold By</p>
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: rgba(C.indigo, .08) }}>
              <Building2 size={15} color={C.indigo} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{sv(st.storeName) || 'Likeson Medicheck Hub'}</p>
              {st.address && <p style={{ fontSize: 10, color: C.s500, marginTop: 3, lineHeight: 1.5 }}>{[st.address.line1, st.address.city, st.address.state, st.address.pincode].filter(Boolean).join(', ')}</p>}
              {st.contact?.phone && <p style={{ fontSize: 10, color: C.s500, marginTop: 2 }}>📞 {sv(st.contact.phone)}</p>}
              {st.contact?.email && <p style={{ fontSize: 10, color: C.s500, marginTop: 1 }}>✉ {sv(st.contact.email)}</p>}
            </div>
          </div>
        </div>
        <div className="p-5">
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: C.s500, marginBottom: 8 }}>Ship To</p>
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: rgba(H, .1) }}>
              <MapPin size={15} color={H} />
            </div>
            <div>
              {order.delivery?.address ? (
                <>
                  <p style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{sv(order.delivery.address.fullName)}</p>
                  <p style={{ fontSize: 10, color: C.s500, marginTop: 3, lineHeight: 1.5 }}>{sv(order.delivery.address.line1)}{order.delivery.address.landmark ? `, Near ${sv(order.delivery.address.landmark)}` : ''}</p>
                  <p style={{ fontSize: 10, color: C.s500 }}>{sv(order.delivery.address.city)}, {sv(order.delivery.address.state)} — {sv(order.delivery.address.pincode)}</p>
                  {order.delivery.address.phone && <p style={{ fontSize: 10, color: C.s500, marginTop: 2 }}>📞 {sv(order.delivery.address.phone)}</p>}
                </>
              ) : <p style={{ fontSize: 11, color: C.s300 }}>No delivery address</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="p-5">
        <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: C.s500, marginBottom: 10 }}>Items Ordered</p>
        <div className="grid px-3 py-2 rounded-xl mb-1.5 text-white"
          style={{ gridTemplateColumns: '42% 14% 7% 19% 18%', background: `linear-gradient(135deg, ${C.s900}, ${C.s800})` }}>
          {[['Medicine','left'],['HSN Code','center'],['Qty','right'],['Unit Price','right'],['Amount','right']].map(([h, a]) => (
            <div key={h} style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase', textAlign: a }}>{h}</div>
          ))}
        </div>
        <div className="space-y-1">
          {(order.items || []).map((item, i) => {
            const name = sv(item.name || item.medicine?.brandName || 'Medicine');
            const gen  = sv(item.genericName || '');
            const dos  = sv(item.medicine?.dosage || '');
            const qty  = Number(item.quantity) || 1;
            const unit = Number(item.pricePerUnit) || 0;
            const tax  = Number(item.taxAmount) || 0;
            const tot  = Number(item.totalPrice) || 0;
            const gst  = Number(item.gstPercentage) || 0;
            const hsn  = sv(item.hsnCode || '3004');
            return (
              <div key={i} className="grid px-3 py-2.5 rounded-xl items-center"
                style={{ gridTemplateColumns: '42% 14% 7% 19% 18%', background: i % 2 === 0 ? C.s50 : C.white, border: `1px solid ${C.s200}` }}>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: rgba(C.indigo, .08) }}>
                    <Pill size={10} color={C.indigo} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 11, color: C.text, lineHeight: 1.3 }}>{name}</p>
                    {gen && <p style={{ fontSize: 9, color: C.s500 }}>{gen}</p>}
                    {dos && <p style={{ fontSize: 9, color: C.s500 }}>{dos}</p>}
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {gst > 0 && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: C.blueBg, color: C.blue, border: `1px solid ${rgba(C.blue, .2)}` }}>GST {gst}%</span>}
                      {item.isPrescriptionRequired && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: C.amberBg, color: C.amber, border: `1px solid ${rgba(C.amber, .25)}` }}>Rx Required</span>}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontSize: 10, color: C.s500 }}>{hsn}</div>
                <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.textMid }}>{qty}</div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.textMid }}>{fmt(unit)}</p>
                  {tax > 0 && <p style={{ fontSize: 9, color: C.s500 }}>+{fmt(tax)} tax</p>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: C.text }}>{fmt(tot)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing */}
      <div className="px-5 pb-5 flex justify-end">
        <div style={{ width: 260, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.s200}` }}>
          <div style={{ padding: '12px 14px', background: C.s50 }}>
            {[
              ['Sub Total', fmt(bl.subTotal), null],
              Number(bl.gstAmount)        > 0 ? ['GST',          fmt(bl.gstAmount),               null]    : null,
              Number(bl.deliveryCharges)  > 0 ? ['Delivery',     fmt(bl.deliveryCharges),          null]    : null,
              Number(bl.platformFee)      > 0 ? ['Platform Fee', fmt(bl.platformFee),              null]    : null,
              Number(bl.discountAmount)   > 0 ? ['Discount',     `— ${fmt(bl.discountAmount)}`,    C.green] : null,
              Number(bl.walletAmountUsed) > 0 ? ['Wallet Used',  `— ${fmt(bl.walletAmountUsed)}`,  C.indigo]: null,
            ].filter(Boolean).map(([l, v, c], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 12 }}>
                <span style={{ color: C.s500 }}>{l}</span>
                <span style={{ fontWeight: 600, color: c || C.text }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `linear-gradient(135deg, ${C.s900}, ${C.s800})` }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase' }}>Total Payable</span>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{fmt(bl.totalPayable)}</span>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: C.s200 }} />

      {/* Payment + Prescription */}
      <div className="grid grid-cols-2">
        <div className="p-5" style={{ borderRight: `1px solid ${C.s200}` }}>
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: C.s500, marginBottom: 8 }}>Payment Info</p>
          {[
            ['Method', pm, null],
            ['Status', ps, ps === 'Paid' ? C.green : C.amber],
            order.payment?.paidAt ? ['Paid At', fmtDate(order.payment.paidAt, true), null] : null,
          ].filter(Boolean).map(([l, v, c], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: C.s500 }}>{l}</span>
              <span style={{ fontWeight: 600, color: c || C.text }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="p-5">
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: C.s500, marginBottom: 8 }}>Prescription</p>
          {order.prescription?.isRequired ? (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: rgba(rx.hex, .08), border: `1px solid ${rgba(rx.hex, .28)}` }}>
              <p style={{ fontWeight: 700, fontSize: 11, color: rx.hex }}>{rx.label}</p>
              {order.prescription.verifiedAt && <p style={{ fontSize: 9, color: C.s500, marginTop: 2 }}>{fmtDate(order.prescription.verifiedAt, true)}{order.prescription.verifiedBy?.name ? ` · ${order.prescription.verifiedBy.name}` : ''}</p>}
              {rxS === 'Rejected' && order.prescription.rejectionReason && <p style={{ fontSize: 9, color: C.red, marginTop: 2, fontStyle: 'italic' }}>{sv(order.prescription.rejectionReason)}</p>}
            </div>
          ) : <p style={{ fontSize: 11, color: C.s300 }}>No prescription required</p>}
        </div>
      </div>

      <div style={{ height: 1, background: C.s200 }} />

      {/* Delivery timeline */}
      <div style={{ margin: '14px 20px' }}>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.s200}` }}>
          <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 7, background: rgba(H, .1) }}>
            <Truck size={13} color={H} />
            <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: H }}>Delivery Status: {sm.label}</span>
          </div>
          {order.delivery?.statusHistory?.length > 0 && (
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: C.white }}>
              {order.delivery.statusHistory.map((h, i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: H }} />
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: C.textMid }}>{sv(h.status)}</p>
                    <p style={{ fontSize: 8, color: C.textLight }}>{fmtDate(h.timestamp, true)}</p>
                  </div>
                  {i < arr.length - 1 && <div style={{ width: 18, height: 1, background: C.s300, marginLeft: 3 }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: C.s50, borderTop: `1px solid ${C.s200}` }}>
        <div style={{ padding: '18px 28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: 12, color: C.text, marginBottom: 2 }}>LIKESON MEDICHECK HUB</p>
            <p style={{ fontSize: 8, color: C.textLight, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>Authorized Pharmacy · GSTIN: XXXXXXXXXXXXXXXXX</p>
            <p style={{ fontSize: 8, color: C.textLight, maxWidth: 340, lineHeight: 1.65 }}>This is a computer-generated invoice and does not require a physical signature. All medicines are dispensed as per applicable pharmacy regulations.</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 9, color: C.s500, fontWeight: 600, marginBottom: 1 }}>Generated on</p>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.text, marginBottom: 3 }}>{fmtDate(new Date(), true)}</p>
            <p style={{ fontSize: 9, color: C.textLight }}>{sv(order.orderId)}</p>
          </div>
        </div>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${C.indigo}, ${H}, ${C.green})` }} />
      </div>
    </div>
  );
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────
function InvoiceSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[190, 110, 240, 140].map((h, i) => (
        <div key={i} style={{ height: h }} className="bg-base-300 rounded-2xl" />
      ))}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function OrderInvoice() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const params   = useParams();

  const orderId = params?.orderId || params?.id;
  const order   = useSelector(selectCurrentOrder);
  const loading = useSelector(selectPharmacyGlobalLoading);
  const error   = useSelector(selectOrderError);

  const [downloading, setDownloading] = useState(false);
  const [printed,     setPrinted]     = useState(false);
  const [dlError,     setDlError]     = useState('');

  useEffect(() => {
    if (orderId) dispatch(fetchOrderById(orderId));
    return () => { dispatch(clearCurrentOrder()); dispatch(clearPharmacyErrors()); };
  }, [orderId, dispatch]);

  const handleDownload = () => {
    if (!order || downloading) return;
    setDownloading(true);
    setDlError('');
    try {
      const html = buildInvoiceHTML(order);
      const opened = openPrintWindow(html);
      if (!opened) {
        setDlError('Pop-up was blocked. Please allow pop-ups for this site and try again.');
      }
    } catch (e) {
      console.error('PDF failed:', e);
      setDlError('Could not open print window. Please use the Print button instead.');
    } finally {
      setTimeout(() => setDownloading(false), 1200);
    }
  };

  const handlePrint = () => {
    window.print();
    setPrinted(true);
    setTimeout(() => setPrinted(false), 2500);
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-base-200 py-8 px-4">
        <div className="max-w-3xl mx-auto"><InvoiceSkeleton /></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-3xl bg-error/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-error" />
          </div>
          <h2 className="font-black text-lg mb-1">Invoice not found</h2>
          <p className="text-sm text-base-content/40 mb-4">{error || 'Could not load this order.'}</p>
          <button onClick={() => router.back()} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/80">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
        body, * { font-family: 'Poppins', system-ui, sans-serif; }
        @media print {
          body * { visibility: hidden !important; }
          #invoice-screen, #invoice-screen * { visibility: visible !important; }
          #invoice-screen { position: fixed; left: 0; top: 0; width: 100%; z-index: 9999; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-base-200 py-6 px-4">
        <div className="max-w-3xl mx-auto">

          {/* Top bar */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
            className="no-print flex items-center justify-between mb-6 flex-wrap gap-3">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-base-content/60 hover:text-primary group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-sm font-semibold">Back</span>
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => dispatch(fetchOrderById(orderId))} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 bg-base-100 border border-base-300 rounded-xl text-xs font-semibold text-base-content/50 hover:border-primary hover:text-primary disabled:opacity-40 transition-all">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <motion.button onClick={handlePrint} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${printed ? 'bg-success/10 border-success/30 text-success' : 'bg-base-100 border-base-300 text-base-content/60 hover:border-primary hover:text-primary'}`}>
                {printed ? <BadgeCheck className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
                {printed ? 'Sent to Printer' : 'Print'}
              </motion.button>
              <motion.button onClick={handleDownload} disabled={downloading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black text-white disabled:opacity-60 shadow-lg transition-all"
                style={{ background: downloading ? C.gray : `linear-gradient(135deg, ${C.indigo}, ${C.indigoDark})` }}>
                {downloading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening…</>
                  : <><Download className="w-4 h-4" /> Download PDF</>}
              </motion.button>
            </div>
          </motion.div>

          {/* Error banner */}
          {dlError && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="no-print mb-4 flex items-center gap-3 p-3.5 bg-error/10 border border-error/30 rounded-xl text-sm text-error font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{dlError}</span>
              <button onClick={() => setDlError('')}><XCircle className="w-4 h-4 text-error/60 hover:text-error" /></button>
            </motion.div>
          )}

          {/* Invoice preview */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, type: 'spring', damping: 20 }}>
            <div id="invoice-screen">
              <InvoicePreview order={order} />
            </div>
          </motion.div>

          {/* Bottom CTAs */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="no-print mt-6 flex items-center justify-center gap-3 flex-wrap">
            <button onClick={() => router.push(`/pharmacy/orders/${orderId}`)}
              className="px-5 py-2.5 bg-base-100 border border-base-300 rounded-xl text-sm font-bold text-base-content/60 hover:border-primary hover:text-primary transition-all">
              ← Back to Order Details
            </button>
            <motion.button onClick={handleDownload} disabled={downloading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white shadow-lg disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${C.indigo}, ${C.indigoDark})` }}>
              {downloading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening…</>
                : <><Download className="w-4 h-4" /> Save Invoice as PDF</>}
            </motion.button>
          </motion.div>

          <div className="h-8" />
        </div>
      </div>
    </>
  );
}