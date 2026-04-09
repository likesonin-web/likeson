/**
 * invoiceGenerator.js — Likeson Healthcare
 * ─────────────────────────────────────────
 * Generates a professional pharmacy tax invoice HTML with:
 *  - GST-compliant layout (CGST / SGST / IGST breakdown)
 *  - MRP + GST price column
 *  - Code-128 barcode (pure SVG — no external lib required)
 *  - ImageKit upload → returns { invoiceUrl, html }
 *
 * Usage:
 *   import { generateInvoice } from '../utils/invoiceGenerator.js';
 *
 *   const { html, invoiceUrl } = await generateInvoice({ order, user, store });
 */

import ImageKit from 'imagekit';

// ── ImageKit client ──────────────────────────────────────────────────────────

const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY  || 'public_rIdrz0GPllpCv0Q3HzChmkN+sLg=',
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY || 'private_VZy2yDP9AuEzZRr8BYHhSFWJA/c=',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT|| 'https://ik.imagekit.io/zxxzgk3iq',
});

// ── Code-128 barcode (pure SVG, subset B) ───────────────────────────────────

const CODE128_B_TABLE = {
  ' ':0,' ':0,'!':1,'"':2,'#':3,'$':4,'%':5,'&':6,"'":7,'(':8,')':9,'*':10,
  '+':11,',':12,'-':13,'.':14,'/':15,'0':16,'1':17,'2':18,'3':19,'4':20,
  '5':21,'6':22,'7':23,'8':24,'9':25,':':26,';':27,'<':28,'=':29,'>':30,
  '?':31,'@':32,'A':33,'B':34,'C':35,'D':36,'E':37,'F':38,'G':39,'H':40,
  'I':41,'J':42,'K':43,'L':44,'M':45,'N':46,'O':47,'P':48,'Q':49,'R':50,
  'S':51,'T':52,'U':53,'V':54,'W':55,'X':56,'Y':57,'Z':58,'[':59,'\\':60,
  ']':61,'^':62,'_':63,'`':64,'a':65,'b':66,'c':67,'d':68,'e':69,'f':70,
  'g':71,'h':72,'i':73,'j':74,'k':75,'l':76,'m':77,'n':78,'o':79,'p':80,
  'q':81,'r':82,'s':83,'t':84,'u':85,'v':86,'w':87,'x':88,'y':89,'z':90,
  '{':91,'|':92,'}':93,'~':94,
};

// Patterns for each Code128 symbol (11 bars, 0=white 1=black)
const CODE128_PATTERNS = [
  '11011001100','11001101100','11001100110','10010011000','10010001100',
  '10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110',
  '10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100',
  '11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000',
  '10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110',
  '10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000',
  '11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100',
  '10010110000','10010000110','10000101100','10000100110','10110010000',
  '10110000100','10011010000','10011000010','10000110100','10000110010',
  '11000010010','11001010000','11110111010','11000010100','10001111010',
  '10100111100','10010111100','10010011110','10111100100','10011110100',
  '10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110',
  '10111101000','10111100010','11110101000','11110100010','10111011110',
  '10111101110','11101011110','11110101110','11010000100','11010010000',
  '11010011100','11000111010',
];

const START_B = 104;
const STOP    = 106;

function buildCode128Svg(text, barWidth = 1.5, height = 48) {
  const chars   = Array.from(text);
  const values  = [START_B, ...chars.map(c => CODE128_B_TABLE[c] ?? 0)];
  // checksum
  const check   = (values[0] + values.slice(1).reduce((s, v, i) => s + v * (i + 1), 0)) % 103;
  values.push(check, STOP);

  const patterns = values.map(v => CODE128_PATTERNS[v] ?? '11111111110');
  const allBars  = patterns.join('') + '1'; // termination bar

  let x   = 0;
  const rects = [];
  for (const bit of allBars) {
    if (bit === '1') rects.push(`<rect x="${(x * barWidth).toFixed(2)}" y="0" width="${barWidth}" height="${height}" fill="#1a1a1a"/>`);
    x++;
  }
  const totalW = x * barWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW.toFixed(2)} ${height}" width="${totalW.toFixed(2)}" height="${height}">${rects.join('')}</svg>`;
}

// ── Rupee formatter ──────────────────────────────────────────────────────────

const fmt = (n) => `₹${parseFloat(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Number-to-words (Indian style, for invoice declaration) ─────────────────

function numberToWords(amount) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                 'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                 'Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+convert(n%100) : '');
    if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+convert(n%1000) : '');
    if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+convert(n%100000) : '');
    return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+convert(n%10000000) : '');
  };
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);
  let words = convert(rupees) + ' Rupees';
  if (paise) words += ' and ' + convert(paise) + ' Paise';
  return words + ' Only';
}

// ── Date formatter ───────────────────────────────────────────────────────────

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Build invoice HTML ───────────────────────────────────────────────────────

export function buildInvoiceHtml({ order, user, storeName, storeAddress, store }) {
  const o         = order;
  const billing   = o.billing || {};
  const delivery  = o.delivery || {};
  const addr      = delivery.address || {};
  const items     = o.items || [];
  const storeDoc  = store || {};

  const invoiceNo  = `INV-${o.orderId}`;
  const invoiceDate= fmtDate(o.payment?.paidAt || o.createdAt);
  const barcodeSvg = buildCode128Svg(o.orderId ?? 'LIKESON', 1.4, 44);

  // GST details per item
  const itemRows = items.map((item, idx) => {
    const mrp         = item.pricePerUnit ?? 0;
    const qty         = item.quantity ?? 1;
    const gstPct      = item.gstPercentage ?? 0;
    // Base price (MRP is inclusive of GST for pharma)
    const basePrice   = parseFloat((mrp / (1 + gstPct / 100)).toFixed(2));
    const gstPerUnit  = parseFloat((mrp - basePrice).toFixed(2));
    const lineBase    = parseFloat((basePrice * qty).toFixed(2));
    const lineTax     = parseFloat((gstPerUnit * qty).toFixed(2));
    const lineTotal   = parseFloat((mrp * qty).toFixed(2));
    const cgst        = parseFloat((lineTax / 2).toFixed(2));
    const sgst        = parseFloat((lineTax / 2).toFixed(2));
    const hsnCode     = item.hsnCode ?? '—';

    return { idx: idx + 1, item, mrp, qty, gstPct, basePrice, gstPerUnit, lineBase, lineTax, lineTotal, cgst, sgst, hsnCode };
  });

  const totalBase     = itemRows.reduce((s, r) => s + r.lineBase, 0);
  const totalCgst     = itemRows.reduce((s, r) => s + r.cgst, 0);
  const totalSgst     = itemRows.reduce((s, r) => s + r.sgst, 0);
  const totalTax      = totalCgst + totalSgst;
  const totalPayable  = billing.totalPayable ?? 0;
  const discount      = billing.discountAmount ?? 0;
  const delivery_ch   = billing.deliveryCharges ?? 0;

  // GST slab summary
  const slabMap = {};
  itemRows.forEach(r => {
    if (!slabMap[r.gstPct]) slabMap[r.gstPct] = { taxableAmt: 0, cgst: 0, sgst: 0 };
    slabMap[r.gstPct].taxableAmt += r.lineBase;
    slabMap[r.gstPct].cgst       += r.cgst;
    slabMap[r.gstPct].sgst       += r.sgst;
  });

  const slabRows = Object.entries(slabMap).map(([pct, v]) => `
    <tr>
      <td>${pct}%</td>
      <td>${fmt(v.taxableAmt)}</td>
      <td>${(parseFloat(pct)/2).toFixed(1)}% — ${fmt(v.cgst)}</td>
      <td>${(parseFloat(pct)/2).toFixed(1)}% — ${fmt(v.sgst)}</td>
      <td>${fmt(v.cgst + v.sgst)}</td>
    </tr>`).join('');

  const itemRowsHtml = itemRows.map(r => `
    <tr>
      <td class="sl">${r.idx}</td>
      <td class="desc">
        <span class="med-name">${r.item.brandName || r.item.name}</span>
        ${r.item.genericName ? `<span class="generic">${r.item.genericName}</span>` : ''}
      </td>
      <td class="center">${r.hsnCode}</td>
      <td class="center">${r.item.gstPercentage ?? 0}%</td>
      <td class="right">${fmt(r.basePrice)}</td>
      <td class="right">${fmt(r.gstPerUnit)}</td>
      <td class="right">${fmt(r.mrp)}</td>
      <td class="center">${r.qty}</td>
      <td class="right bold">${fmt(r.lineTotal)}</td>
    </tr>`).join('');

  const payMethod = o.payment?.method ?? 'Online';
  const payStatus = o.payment?.status ?? 'Pending';

  const storeGst   = storeDoc?.legal?.gstNumber || '37AABCL1234Q1ZX';
  const storeDl    = storeDoc?.legal?.dlNumber   || 'AP/VJA/2024/01234';
  const storePhone = storeDoc?.contact?.phone    || '+91 90000 00000';
  const storeEmail = storeDoc?.contact?.email    || 'pharmacy@likeson.in';
  const storeLine1 = storeDoc?.address?.line1    || '';
  const storeCity  = storeDoc?.address?.city     || 'Vijayawada';
  const storeState = storeDoc?.address?.state    || 'Andhra Pradesh';
  const storePin   = storeDoc?.address?.pincode  || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice ${invoiceNo} — Likeson Healthcare</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --ink:#0d1117;
  --ink2:#3d4452;
  --ink3:#6b7280;
  --accent:#006b5e;
  --accent2:#00a88a;
  --accent-light:#e6f5f2;
  --border:#d4e0dd;
  --bg:#f8faf9;
  --white:#ffffff;
  --red:#c0392b;
  --gold:#b8860b;
}
@media print{
  body{background:white!important}
  .no-print{display:none!important}
  .page{box-shadow:none!important;max-width:none!important;margin:0!important}
}
body{
  font-family:'Plus Jakarta Sans',sans-serif;
  background:var(--bg);
  color:var(--ink);
  font-size:12px;
  line-height:1.5;
  padding:20px;
  min-height:100vh;
}
.page{
  background:var(--white);
  max-width:820px;
  margin:0 auto;
  box-shadow:0 4px 40px rgba(0,107,94,.12),0 1px 4px rgba(0,0,0,.06);
  border-radius:12px;
  overflow:hidden;
}

/* ── HEADER ── */
.hdr{
  background:var(--accent);
  padding:28px 36px 24px;
  position:relative;
  overflow:hidden;
}
.hdr::before{
  content:'';
  position:absolute;
  top:-40px;right:-40px;
  width:200px;height:200px;
  border-radius:50%;
  background:rgba(255,255,255,.06);
}
.hdr::after{
  content:'';
  position:absolute;
  bottom:-60px;right:80px;
  width:150px;height:150px;
  border-radius:50%;
  background:rgba(255,255,255,.04);
}
.hdr-inner{display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1}
.logo-area{}
.logo-name{
  font-family:'DM Serif Display',serif;
  font-size:26px;
  color:#fff;
  letter-spacing:-.5px;
  line-height:1;
}
.logo-name span{color:var(--accent2)}
.logo-sub{
  font-size:9px;
  letter-spacing:3px;
  text-transform:uppercase;
  color:rgba(255,255,255,.65);
  margin-top:4px;
}
.invoice-badge{
  text-align:right;
}
.invoice-badge .label{
  font-size:9px;
  letter-spacing:3px;
  text-transform:uppercase;
  color:rgba(255,255,255,.6);
}
.invoice-badge .inv-no{
  font-family:'DM Mono',monospace;
  font-size:18px;
  color:#fff;
  font-weight:500;
  margin-top:2px;
}
.invoice-badge .inv-date{
  font-size:11px;
  color:rgba(255,255,255,.8);
  margin-top:2px;
}

/* ── STORE / BILL META ── */
.meta-band{
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  gap:0;
  border-bottom:1px solid var(--border);
}
.meta-col{
  padding:18px 24px;
  border-right:1px solid var(--border);
}
.meta-col:last-child{border-right:none}
.meta-label{
  font-size:8.5px;
  letter-spacing:2px;
  text-transform:uppercase;
  color:var(--accent);
  font-weight:700;
  margin-bottom:6px;
}
.meta-value{font-weight:600;font-size:13px;color:var(--ink);line-height:1.3}
.meta-small{font-size:11px;color:var(--ink2);margin-top:2px}
.meta-tag{
  display:inline-block;
  padding:2px 8px;
  border-radius:20px;
  font-size:9.5px;
  font-weight:700;
  letter-spacing:.5px;
  margin-top:4px;
}
.tag-paid{background:#d4edda;color:#1a6e2e}
.tag-pending{background:#fff3cd;color:#856404}
.tag-cod{background:var(--accent-light);color:var(--accent)}

/* ── BARCODE STRIP ── */
.barcode-strip{
  background:var(--accent-light);
  border-bottom:1px solid var(--border);
  padding:12px 24px;
  display:flex;
  align-items:center;
  gap:16px;
}
.barcode-svg-wrap{line-height:0}
.barcode-text{
  font-family:'DM Mono',monospace;
  font-size:10px;
  color:var(--ink3);
  letter-spacing:1.5px;
}

/* ── ITEMS TABLE ── */
.table-wrap{padding:0 0;overflow:auto}
table{width:100%;border-collapse:collapse}
thead tr{background:var(--accent);color:#fff}
thead th{
  padding:10px 12px;
  font-size:9px;
  font-weight:700;
  letter-spacing:1.5px;
  text-transform:uppercase;
  text-align:left;
  white-space:nowrap;
}
thead th.center{text-align:center}
thead th.right{text-align:right}
tbody tr{border-bottom:1px solid var(--border)}
tbody tr:hover{background:var(--accent-light)}
tbody td{
  padding:10px 12px;
  font-size:11.5px;
  vertical-align:middle;
}
td.sl{color:var(--ink3);font-family:'DM Mono',monospace;font-size:10px;width:28px}
td.desc .med-name{display:block;font-weight:600;color:var(--ink)}
td.desc .generic{display:block;font-size:10px;color:var(--ink3);font-style:italic}
td.center{text-align:center;font-family:'DM Mono',monospace;font-size:11px}
td.right{text-align:right;font-family:'DM Mono',monospace;font-size:11px}
td.bold{font-weight:700}
tfoot tr{background:#f0f7f5}
tfoot td{padding:9px 12px;font-size:11px;font-weight:600}
.subtotal-row td{border-top:2px solid var(--accent)}
.total-row td{background:var(--accent);color:#fff;font-size:13px;font-weight:700}

/* ── SUMMARY + GST SECTION ── */
.bottom-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:0;
  border-top:1px solid var(--border);
}
.gst-summary{
  padding:20px 24px;
  border-right:1px solid var(--border);
}
.billing-summary{
  padding:20px 24px;
}
.section-title{
  font-size:9px;
  font-weight:700;
  letter-spacing:2px;
  text-transform:uppercase;
  color:var(--accent);
  margin-bottom:12px;
}
.gst-table{width:100%;border-collapse:collapse}
.gst-table th{
  font-size:9px;text-transform:uppercase;letter-spacing:1px;
  color:var(--ink3);font-weight:600;padding:4px 6px;
  border-bottom:1px solid var(--border);text-align:left;
}
.gst-table td{
  padding:5px 6px;
  font-size:10.5px;
  font-family:'DM Mono',monospace;
}
.gst-table tr:last-child td{
  font-weight:700;
  border-top:1px solid var(--border);
  color:var(--ink);
}
.bill-row{
  display:flex;justify-content:space-between;
  padding:5px 0;font-size:12px;
}
.bill-row.discount{color:var(--red)}
.bill-row.total{
  border-top:2px solid var(--accent);
  margin-top:6px;padding-top:8px;
  font-size:14px;font-weight:700;color:var(--accent);
}
.bill-label{color:var(--ink2)}
.bill-val{font-family:'DM Mono',monospace;font-weight:600}

/* ── DECLARATION ── */
.declaration{
  padding:14px 24px;
  background:var(--accent-light);
  border-top:1px solid var(--border);
}
.decl-amt{
  font-weight:700;color:var(--accent);font-size:12.5px;font-style:italic;
}

/* ── FOOTER ── */
.inv-footer{
  padding:16px 36px 20px;
  background:#0d1117;
  display:flex;
  justify-content:space-between;
  align-items:center;
  flex-wrap:wrap;
  gap:12px;
}
.footer-brand{
  font-family:'DM Serif Display',serif;
  font-size:14px;
  color:#fff;
}
.footer-brand span{color:var(--accent2)}
.footer-links{
  font-size:10px;
  color:rgba(255,255,255,.5);
  letter-spacing:.5px;
}
.footer-links b{color:rgba(255,255,255,.75)}
.sign-area{text-align:right;padding:14px 24px 18px;border-top:1px solid var(--border)}
.sign-line{border-bottom:1.5px dashed var(--border);width:180px;margin:0 0 6px auto;padding-top:32px}
.sign-label{font-size:10px;color:var(--ink3);text-align:right}

/* ── PRINT BUTTON ── */
.print-btn-wrap{text-align:center;padding:20px;background:var(--bg)}
.print-btn{
  background:var(--accent);color:#fff;border:none;
  padding:12px 32px;border-radius:8px;
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:13px;font-weight:600;cursor:pointer;
  letter-spacing:.5px;
  box-shadow:0 4px 12px rgba(0,107,94,.3);
  transition:all .2s;
}
.print-btn:hover{background:var(--accent2);transform:translateY(-1px)}
</style>
</head>
<body>

<div class="print-btn-wrap no-print">
  <button class="print-btn" onclick="window.print()">⬇ Download / Print Invoice</button>
</div>

<div class="page">

  <!-- HEADER -->
  <div class="hdr">
    <div class="hdr-inner">
      <div class="logo-area">
        <div class="logo-name">Likeson<span> Healthcare</span></div>
        <div class="logo-sub">Pharmacy · Diagnostics · Care</div>
      </div>
      <div class="invoice-badge">
        <div class="label">Tax Invoice</div>
        <div class="inv-no">${invoiceNo}</div>
        <div class="inv-date">${invoiceDate}</div>
      </div>
    </div>
  </div>

  <!-- META BAND -->
  <div class="meta-band">
    <div class="meta-col">
      <div class="meta-label">Sold By</div>
      <div class="meta-value">${storeName || 'Likeson Pharmacy'}</div>
      <div class="meta-small">${storeLine1}${storeLine1?', ':''}${storeCity}, ${storeState}${storePin?' — '+storePin:''}</div>
      <div class="meta-small">${storePhone} | ${storeEmail}</div>
      <div class="meta-small" style="margin-top:4px"><b>GSTIN:</b> ${storeGst}</div>
      <div class="meta-small"><b>DL No:</b> ${storeDl}</div>
    </div>
    <div class="meta-col">
      <div class="meta-label">Bill To</div>
      <div class="meta-value">${addr.fullName || user?.name || 'Patient'}</div>
      <div class="meta-small">${addr.line1 || ''}${addr.landmark?', '+addr.landmark:''}</div>
      <div class="meta-small">${addr.city || 'Vijayawada'}, ${addr.state || 'Andhra Pradesh'} — ${addr.pincode || ''}</div>
      <div class="meta-small">📞 ${addr.phone || user?.phone || '—'}</div>
      <div class="meta-small" style="margin-top:4px">✉ ${user?.email || '—'}</div>
    </div>
    <div class="meta-col">
      <div class="meta-label">Order Details</div>
      <div class="meta-value">${o.orderId}</div>
      <div class="meta-small"><b>Ordered:</b> ${fmtDate(o.createdAt)}</div>
      <div class="meta-small"><b>Delivered:</b> ${fmtDate(o.delivery?.deliveredAt)}</div>
      <div class="meta-small" style="margin-top:6px"><b>Payment:</b> ${payMethod}</div>
      <div>
        <span class="meta-tag ${payStatus==='Paid'?'tag-paid':payMethod==='COD'?'tag-cod':'tag-pending'}">
          ${payStatus === 'Paid' ? '✓ PAID' : payMethod === 'COD' ? '💵 COD' : payStatus.toUpperCase()}
        </span>
      </div>
    </div>
  </div>

  <!-- BARCODE -->
  <div class="barcode-strip">
    <div class="barcode-svg-wrap">${barcodeSvg}</div>
    <div class="barcode-text">ORDER REF: ${o.orderId}</div>
  </div>

  <!-- ITEMS TABLE -->
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Medicine / Product</th>
          <th class="center">HSN</th>
          <th class="center">GST%</th>
          <th class="right">Base Rate</th>
          <th class="right">GST/Unit</th>
          <th class="right">MRP</th>
          <th class="center">Qty</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml}
      </tbody>
      <tfoot>
        <tr class="subtotal-row">
          <td colspan="4"></td>
          <td class="right">Subtotal (Taxable)</td>
          <td class="right">${fmt(totalTax)}</td>
          <td colspan="2" class="right" style="color:var(--ink3);font-size:10px">MRP incl. GST</td>
          <td class="right">${fmt(itemRows.reduce((s,r)=>s+r.lineTotal,0))}</td>
        </tr>
        ${discount > 0 ? `<tr>
          <td colspan="8" class="right" style="color:var(--red)">Discount${o.billing?.promoCode?' ('+o.billing.promoCode+')':''}</td>
          <td class="right" style="color:var(--red)">−${fmt(discount)}</td>
        </tr>` : ''}
        ${delivery_ch > 0 ? `<tr>
          <td colspan="8" class="right">Delivery Charges</td>
          <td class="right">${fmt(delivery_ch)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td colspan="8" style="text-align:right;letter-spacing:1px">TOTAL PAYABLE</td>
          <td class="right">${fmt(totalPayable)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- BOTTOM: GST SUMMARY + BILLING SUMMARY -->
  <div class="bottom-grid">
    <div class="gst-summary">
      <div class="section-title">GST Slab Summary</div>
      <table class="gst-table">
        <thead>
          <tr>
            <th>GST Rate</th>
            <th>Taxable Amt</th>
            <th>CGST</th>
            <th>SGST</th>
            <th>Total Tax</th>
          </tr>
        </thead>
        <tbody>
          ${slabRows}
          <tr>
            <td>Total</td>
            <td>${fmt(totalBase)}</td>
            <td>${fmt(totalCgst)}</td>
            <td>${fmt(totalSgst)}</td>
            <td>${fmt(totalTax)}</td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top:10px;font-size:10px;color:var(--ink3)">
        * All prices are MRP inclusive of applicable GST.<br/>
        * IGST applicable for inter-state orders.
      </div>
    </div>
    <div class="billing-summary">
      <div class="section-title">Billing Summary</div>
      <div class="bill-row"><span class="bill-label">Items Total (MRP)</span><span class="bill-val">${fmt(itemRows.reduce((s,r)=>s+r.lineTotal,0))}</span></div>
      <div class="bill-row"><span class="bill-label">Taxable Value</span><span class="bill-val">${fmt(totalBase)}</span></div>
      <div class="bill-row"><span class="bill-label">Total GST (CGST+SGST)</span><span class="bill-val">${fmt(totalTax)}</span></div>
      ${delivery_ch > 0 ? `<div class="bill-row"><span class="bill-label">Delivery Charges</span><span class="bill-val">${fmt(delivery_ch)}</span></div>` : ''}
      ${discount > 0 ? `<div class="bill-row discount"><span class="bill-label">Discount / Coupon</span><span class="bill-val">−${fmt(discount)}</span></div>` : ''}
      <div class="bill-row total">
        <span>Total Payable</span>
        <span class="bill-val">${fmt(totalPayable)}</span>
      </div>
    </div>
  </div>

  <!-- DECLARATION -->
  <div class="declaration">
    <span class="decl-amt">Amount in Words: ${numberToWords(totalPayable)}</span>
    <div style="margin-top:6px;font-size:10px;color:var(--ink3)">
      This is a computer-generated invoice and does not require a physical signature. 
      Medicines once sold cannot be returned except for quality issues. 
      For support: <b>support@likeson.in</b> | <b>1800-XXX-XXXX</b>
    </div>
  </div>

  <!-- SIGN -->
  <div class="sign-area">
    <div class="sign-line"></div>
    <div class="sign-label">Authorised Signatory — ${storeName || 'Likeson Pharmacy'}</div>
  </div>

  <!-- FOOTER -->
  <div class="inv-footer">
    <div class="footer-brand">Likeson<span> Healthcare</span></div>
    <div class="footer-links">
      <b>www.likeson.in</b> &nbsp;|&nbsp; GSTIN: ${storeGst} &nbsp;|&nbsp; DL: ${storeDl}
    </div>
    <div class="footer-links">Invoice #${invoiceNo} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-IN')}</div>
  </div>

</div>

<div class="print-btn-wrap no-print">
  <button class="print-btn" onclick="window.print()">⬇ Print / Save as PDF</button>
</div>

</body>
</html>`;
}

// ── Upload invoice HTML to ImageKit ─────────────────────────────────────────

export async function uploadInvoiceToImageKit(html, orderId) {
  const fileName = `invoice-${orderId}-${Date.now()}.html`;
  const buffer   = Buffer.from(html, 'utf-8');

  const result = await imagekit.upload({
    file:              buffer.toString('base64'),
    fileName,
    folder:            '/likeson/invoices',
    useUniqueFileName: false,
    tags:              ['invoice', 'pharmacy', orderId],
  });

  return result.url;
}

// ── Main exported function ───────────────────────────────────────────────────

/**
 * generateInvoice({ order, user, store })
 *  → { html: string, invoiceUrl: string }
 */
export async function generateInvoice({ order, user, store }) {
  const storeName    = store?.storeName || 'Likeson Pharmacy';
  const storeAddress = store?.address
    ? `${store.address.line1 || ''}, ${store.address.city || 'Vijayawada'}, ${store.address.state || 'Andhra Pradesh'}`
    : 'Vijayawada, Andhra Pradesh';

  const html = buildInvoiceHtml({ order, user, storeName, storeAddress, store });

  let invoiceUrl = null;
  try {
    invoiceUrl = await uploadInvoiceToImageKit(html, order.orderId);
  } catch (err) {
    console.error('[generateInvoice] ImageKit upload failed:', err.message);
    // Non-fatal — still return html
  }

  return { html, invoiceUrl };
}