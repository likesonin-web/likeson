'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  AreaChart, Area,
  LineChart, Line,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend,
} from 'recharts';
import {
  Search, Users, FileText, Activity, Calendar,
  CheckCircle2, AlertCircle, Download, X, Eye,
  TrendingUp, Stethoscope, Car, FlaskConical,
  ChevronDown, ChevronUp, Filter, RefreshCw,
  Printer, Sparkles, Clock, BadgeCheck,
} from 'lucide-react';

import {
  fetchActiveSubscriptions,
  selectActiveSubscribers,
  selectPlanLoading,
} from '@/store/slices/subscriptionPlanSlice';

/* ─────────────────────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────────────────────── */
const LOGO_URL =
  'https://ik.imagekit.io/zxxzgk3iq/ChatGPT%20Image%20Feb%202,%202026,%2005_21_49%20PM.png?updatedAt=1770278792983';

/* ─────────────────────────────────────────────────────────────────
   ANIMATION VARIANTS
   ───────────────────────────────────────────────────────────────── */
const containerV = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};
const itemV = {
  hidden:  { opacity: 0, y: 22, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.44, ease: [0.22, 1, 0.36, 1] } },
};
const drawerV = {
  hidden:  { opacity: 0, x: 64 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 64, transition: { duration: 0.28 } },
};

/* ─────────────────────────────────────────────────────────────────
   PDF HELPERS
   ───────────────────────────────────────────────────────────────── */
async function fetchB64(url) {
  const r  = await fetch(url);
  const bl = await r.blob();
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onload  = () => res(rd.result);
    rd.onerror = rej;
    rd.readAsDataURL(bl);
  });
}

/* ─────────────────────────────────────────────────────────────────
   INVOICE PDF GENERATOR
   Key fixes:
   • No Unicode symbols (✓ ● → ✗) — replaced with ASCII-safe text
   • All column x+w coordinates verified to stay within page bounds
   • Period string split into 2 lines to avoid overflow
   • Amount col right edge anchored at PW-MR (196), text drawn 2mm inside
   • Ribbon labels use calculated x positions, never overlap
   • SUBSCRIPTION ACTIVE text fits inside stamp box
   ───────────────────────────────────────────────────────────────── */
async function generateInvoicePDF(sub) {
  const { jsPDF } = await import('jspdf');

  /* page setup */
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const PW = 210;   // page width
  const PH = 297;   // page height
  const ML = 14;    // left margin
  const MR = 14;    // right margin
  const CW = PW - ML - MR;          // 182 mm — usable content width
  const RE = PW - MR;               // 196 mm — right edge of content

  /* ── colours ────────────────────────────────────────────────── */
  const navy    = [15,  28,  80];
  const blue    = [37,  99, 235];
  const teal    = [20, 184, 166];
  const dark    = [15,  23,  42];
  const mid     = [71,  85, 105];
  const muted   = [148,163, 184];
  const light   = [241,245, 249];
  const white   = [255,255, 255];
  const green   = [22, 163,  74];
  const greenBg = [220,252, 231];
  const bdr     = [226,232, 240];

  /* ── tiny helpers ────────────────────────────────────────────── */
  const fc  = (c)          => doc.setFillColor(...c);
  const dc  = (c, w = 0.3) => { doc.setDrawColor(...c); doc.setLineWidth(w); };
  const box = (x, y, w, h, c, r = 0) => {
    fc(c);
    r > 0 ? doc.roundedRect(x, y, w, h, r, r, 'F') : doc.rect(x, y, w, h, 'F');
  };
  const hl  = (x1, x2, y, c = bdr, lw = 0.25) => { dc(c, lw); doc.line(x1, y, x2, y); };
  const sf  = (s, sz, col) => {
    doc.setFont('helvetica', s);
    doc.setFontSize(sz);
    doc.setTextColor(...col);
  };
  const t   = (str, x, y, o = {}) => doc.text(String(str), x, y, o);

  /* ── data ───────────────────────────────────────────────────── */
  const invNo   = `INV-${Date.now().toString().slice(-8)}`;
  const today   = new Date();
  const expiry  = new Date(sub.expiryDate);
  const start   = sub.startDate ? new Date(sub.startDate) : today;
  const fmt     = (d) => d.toLocaleDateString('en-IN', { day:'2-digit', month:'short',  year:'numeric' });
  const fmtL    = (d) => d.toLocaleDateString('en-IN', { day:'2-digit', month:'long',   year:'numeric' });
  // Safe ASCII currency — avoids Rs. symbol corruption in some viewers
  const cur     = (n) => 'Rs. ' + Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const price    = Number(sub.priceMonthly || 0);
  const subtotal = price;
  const tax      = Math.round(subtotal * 0.18 * 100) / 100;
  const total    = Math.round((subtotal + tax) * 100) / 100;

  /* ════════════════════════════════════════════════════
     1. HEADER BLOCK   y: 0 → 50
     ════════════════════════════════════════════════════ */
  box(0, 0, PW, 50, navy);
  // teal corner triangle
  doc.setFillColor(...teal);
  doc.triangle(PW - 48, 0, PW, 0, PW, 50, 'F');
  // indigo mid-triangle
  doc.setFillColor(79, 70, 229);
  doc.triangle(PW - 72, 0, PW - 48, 0, PW, 50, 'F');

  /* logo */
  try {
    const b64 = await fetchB64(LOGO_URL);
    doc.addImage(b64, 'PNG', ML, 7, 22, 22);
  } catch {
    box(ML, 7, 22, 22, blue, 3);
    sf('bold', 12, white); t('L', ML + 11, 21, { align: 'center' });
  }

  /* brand text */
  sf('bold', 16, white);
  t('Likeson', ML + 28, 16);
  sf('normal', 8, [180, 210, 255]);
  t('Enterprise Healthcare Subscription Services', ML + 28, 22);
  sf('normal', 7, [130, 165, 235]);
  t('support@likeson.in  |  www.likeson.in  |  +91 98765 43210', ML + 28, 28);

  /* INVOICE label — right side stays inside teal zone so white is readable */
  sf('bold', 24, white);
  t('INVOICE', RE - 2, 16, { align: 'right' });
  sf('normal', 8.5, [180, 210, 255]);
  t('No: ' + invNo, RE - 2, 24, { align: 'right' });
  sf('normal', 7.5, [130, 165, 235]);
  t('Issued: ' + fmtL(today), RE - 2, 30, { align: 'right' });

  /* ── ribbon strip (dark sub-bar inside header) ─────────────── */
  box(0, 40, PW, 10, [8, 18, 55]);

  // Ribbon: STATUS | PLAN | RENEWAL | MEMBER
  // Each item: label at rx, value at rx+label_width+2
  // Spacing calculated: 4 items across 182mm = ~45mm each, with ML offset
  const ribbonDefs = [
    { k: 'STATUS',  v: 'ACTIVE'           },
    { k: 'PLAN',    v: sub.planName||'N/A' },
    { k: 'RENEWAL', v: fmt(expiry)         },
    { k: 'MEMBER',  v: sub.userName||'N/A' },
  ];
  const ribbonSlot = CW / 4;  // 45.5 mm per slot
  ribbonDefs.forEach(({ k, v }, i) => {
    const rx = ML + i * ribbonSlot;
    sf('bold',   6,   [90, 120, 190]);
    t(k, rx, 47);
    sf('normal', 8,   [160, 210, 255]);
    // Truncate value if too long (max ~20 chars per slot)
    const safeV = v.length > 18 ? v.slice(0, 17) + '.' : v;
    t(safeV, rx + 14, 47);
  });

  /* ════════════════════════════════════════════════════
     2. BILL-TO  +  INVOICE META   y: 58 → 92
     ════════════════════════════════════════════════════ */
  let y = 58;
  const halfW = (CW - 5) / 2;   // ~88.5 mm each

  /* LEFT — Bill To */
  box(ML, y, halfW, 32, light, 3);
  box(ML, y, 3, 32, blue);      // left accent bar
  sf('bold',   7,  blue);  t('BILL TO',                     ML + 7,  y + 7);
  sf('bold',   11, dark);  t(sub.userName  || 'Subscriber', ML + 7,  y + 15);
  sf('normal',  9, mid);   t(sub.userEmail || '—',          ML + 7,  y + 22);
  sf('normal',  8, muted); t('Subscription Member',         ML + 7,  y + 28);

  /* RIGHT — Invoice Meta */
  const metaX = ML + halfW + 5;
  const metaW = halfW;          // right col same width
  box(metaX, y, metaW, 32, light, 3);

  const metaRows = [
    { l: 'Invoice No.', v: invNo },
    { l: 'Issue Date',  v: fmt(today) },
    // Split period across label+value to avoid overflow
    { l: 'From', v: fmt(start) },
    { l: 'To',   v: fmt(expiry) },
  ];
  metaRows.forEach(({ l, v }, i) => {
    const ry = y + 7 + i * 6.5;
    sf('bold',   7.5, muted); t(l, metaX + 4,         ry);
    sf('bold',   8,   dark);  t(v, metaX + metaW - 4, ry, { align: 'right' });
    if (i < metaRows.length - 1) hl(metaX + 4, metaX + metaW - 4, ry + 2, bdr, 0.2);
  });

  /* ════════════════════════════════════════════════════
     3. LINE ITEMS TABLE   y: 98 onwards
     ════════════════════════════════════════════════════
     Column layout (all absolute x positions, total = 182mm):
       #          : x=14,  w=7    → text anchor at 14+3.5 (center)
       Description: x=23,  w=63   → text anchor at 23+1.5 (left)
       Category   : x=88,  w=30   → text anchor at 88+1.5 (left)
       Unit       : x=120, w=18   → text anchor at 120+9 (center)
       Qty        : x=140, w=12   → text anchor at 140+6 (center)
       Amount     : x=154, w=28   → text anchor at 154+26=180 (right, 2mm inside RE=196)
       SUM: 7+63+30+18+12+28 = 158 ... gaps: 2+2+2+2+2=10 → total 168 OK, RE=196 safe
  */
  y = 98;

  const cols = [
    { h: '#',           x: ML,       w: 7,   a: 'center' },
    { h: 'Description', x: ML + 9,   w: 63,  a: 'left'   },
    { h: 'Category',    x: ML + 74,  w: 30,  a: 'left'   },
    { h: 'Unit',        x: ML + 106, w: 18,  a: 'center' },
    { h: 'Qty',         x: ML + 126, w: 12,  a: 'center' },
    { h: 'Amount',      x: ML + 140, w: 40,  a: 'right'  },
    // Amount right edge: 14+140+40=194 — 2mm inside RE(196) ✓
  ];

  /* table header row */
  box(ML, y, CW, 9, navy, 2);
  cols.forEach(c => {
    sf('bold', 7.5, white);
    const tx = c.a === 'right'  ? c.x + c.w - 2
             : c.a === 'center' ? c.x + c.w / 2
             :                    c.x + 1.5;
    t(c.h, tx, y + 6, { align: c.a });
  });
  y += 9;

  /* table data rows */
  const tableRows = [
    {
      desc: (sub.planName || 'Healthcare') + ' - Monthly Subscription',
      cat: 'Subscription', unit: 'Month',
      qty: 1,
      amt: price > 0 ? cur(price) : 'Included',
      hi: true,
    },
    {
      desc: 'Doctor Consultations Used',
      cat: 'Healthcare', unit: 'Session',
      qty: sub.usage?.doctorConsultationsUsed || 0,
      amt: 'Included', hi: false,
    },
    {
      desc: 'Transport Rides Used',
      cat: 'Transport', unit: 'Ride',
      qty: sub.usage?.transportRidesUsed || 0,
      amt: 'Included', hi: false,
    },
    {
      desc: 'Lab / Diagnostic Tests Used',
      cat: 'Diagnostics', unit: 'Test',
      qty: sub.usage?.labTestsUsed || 0,
      amt: 'Included', hi: false,
    },
  ];

  const RH = 9.5;
  tableRows.forEach((r, i) => {
    box(ML, y, CW, RH, i % 2 === 0 ? white : light);
    hl(ML, RE, y + RH, bdr, 0.2);

    const cell = (col, val, bold, color) => {
      sf(bold ? 'bold' : 'normal', 8.5, color);
      const tx = col.a === 'right'  ? col.x + col.w - 2
               : col.a === 'center' ? col.x + col.w / 2
               :                      col.x + 1.5;
      t(String(val), tx, y + 6.5, { align: col.a });
    };

    cell(cols[0], i + 1,    false, muted);
    cell(cols[1], r.desc,   r.hi,  r.hi ? dark : mid);
    cell(cols[2], r.cat,    false, muted);
    cell(cols[3], r.unit,   false, muted);
    cell(cols[4], r.qty,    false, r.hi ? dark : muted);

    // Amount — use cols[5] right anchor
    sf(r.hi ? 'bold' : 'normal', r.hi ? 9 : 8.5, r.hi ? blue : muted);
    t(r.amt, cols[5].x + cols[5].w - 2, y + 6.5, { align: 'right' });

    y += RH;
  });

  /* ════════════════════════════════════════════════════
     4. TOTALS BLOCK   (right-aligned)
     ════════════════════════════════════════════════════ */
  y += 6;
  const totW = 70;                // fixed width
  const totX = RE - totW;        // left edge of totals box

  box(totX, y, totW, 40, light, 3);

  let ty = y + 8;

  // Subtotal row
  sf('normal', 8.5, mid);  t('Subtotal',  totX + 5,       ty);
  sf('bold',   8.5, dark); t(cur(subtotal), totX + totW - 4, ty, { align: 'right' });
  hl(totX + 5, totX + totW - 4, ty + 3, bdr, 0.2);
  ty += 9;

  // GST row
  sf('normal', 8.5, mid);  t('GST (18%)', totX + 5,       ty);
  sf('bold',   8.5, dark); t(cur(tax),    totX + totW - 4, ty, { align: 'right' });
  ty += 9;

  // Separator
  hl(totX + 5, totX + totW - 4, ty - 2, blue, 0.5);

  // Total row
  sf('bold', 10, navy); t('TOTAL DUE',  totX + 5,        ty + 2);
  sf('bold', 11, blue); t(cur(total),   totX + totW - 4,  ty + 2, { align: 'right' });

  /* SUBSCRIPTION ACTIVE stamp */
  ty += 11;
  box(totX, ty, totW, 11, greenBg, 2);
  dc(green, 0.3); doc.rect(totX, ty, totW, 11);
  sf('bold', 8.5, green);
  // ASCII-safe — no Unicode tick
  t('[ ACTIVE ] SUBSCRIPTION', totX + totW / 2, ty + 7.5, { align: 'center' });

  /* ════════════════════════════════════════════════════
     5. USAGE SUMMARY CARDS
     ════════════════════════════════════════════════════ */
  y = ty + 18;

  sf('bold', 7.5, muted);
  t('SERVICE USAGE - THIS BILLING CYCLE', ML, y);
  hl(ML, ML + 85, y + 2, bdr, 0.25);
  y += 7;

  const uCards = [
    { label: 'Doctor Consultations', val: sub.usage?.doctorConsultationsUsed || 0, c: blue   },
    { label: 'Transport Rides',      val: sub.usage?.transportRidesUsed      || 0, c: teal   },
    { label: 'Lab / Diagnostics',    val: sub.usage?.labTestsUsed            || 0, c: [90, 80, 220] },
  ];
  const cardW = (CW - 8) / 3;   // ~57.3 mm each
  uCards.forEach(({ label, val, c }, i) => {
    const cx = ML + i * (cardW + 4);
    box(cx, y, cardW, 24, light, 3);
    box(cx, y, cardW, 3, c, 3);              // coloured top stripe
    sf('bold', 20, c);
    t(String(val), cx + cardW / 2, y + 16, { align: 'center' });
    sf('normal', 7.5, muted);
    t(label, cx + cardW / 2, y + 22, { align: 'center' });
  });

  /* ════════════════════════════════════════════════════
     6. NOTES  +  TAX INFO BOX
     ════════════════════════════════════════════════════ */
  y += 32;
  const noteW = Math.floor(CW * 0.62);  // 112 mm
  const taxW  = CW - noteW - 5;         // 65 mm

  /* Notes */
  box(ML, y, noteW, 28, light, 3);
  sf('bold', 7.5, blue);
  t('NOTES & PAYMENT TERMS', ML + 4, y + 7);
  const notes = [
    '- System-generated invoice, no signature required.',
    '- Subscription auto-renews unless cancelled 24 hrs before expiry.',
    '- Disputes: billing@likeson.in within 7 days of issue date.',
  ];
  notes.forEach((n, i) => {
    sf('normal', 7, muted);
    t(n, ML + 4, y + 14 + i * 5.5);
  });

  /* Tax info */
  const taxX = ML + noteW + 5;
  box(taxX, y, taxW, 28, light, 3);
  sf('bold',   8,   mid); t('TAX INFORMATION', taxX + taxW / 2, y + 7,  { align: 'center' });
  sf('normal', 7.5, muted);
  t('GSTIN: 37XXXXX1234X1ZX',  taxX + taxW / 2, y + 13, { align: 'center' });
  t('SAC Code: 999313',         taxX + taxW / 2, y + 19, { align: 'center' });
  t('HSN Code: 9993',           taxX + taxW / 2, y + 25, { align: 'center' });

  /* ════════════════════════════════════════════════════
     7. FOOTER
     ════════════════════════════════════════════════════ */
  box(0, PH - 16, PW, 16, navy);
  box(0, PH - 16, PW, 2, teal);
  sf('normal', 7.5, [160, 185, 230]);
  t(
    'Likeson Healthcare Pvt. Ltd.  |  Nellore, Andhra Pradesh 524 001  |  CIN: U85100AP2024PTC123456',
    PW / 2, PH - 9.5, { align: 'center' }
  );
  sf('normal', 7, [100, 130, 180]);
  t(
    'www.likeson.in  |  support@likeson.in  |  Computer-generated document',
    PW / 2, PH - 5, { align: 'center' }
  );
  sf('normal', 7, [100, 130, 180]);
  t('Page 1 of 1', RE, PH - 5, { align: 'right' });

  /* ── save ─────────────────────────────────────────────────────── */
  const safe = (sub.userName || 'subscriber').replace(/\s+/g, '_');
  doc.save(`Likeson_Invoice_${safe}_${invNo}.pdf`);
}

/* ─────────────────────────────────────────────────────────────────
   LIKESON BACKGROUND EFFECT
   ───────────────────────────────────────────────────────────────── */
const LikesonBg = () => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
    {/* Mesh gradient */}
    <div className="absolute inset-0" style={{
      background: [
        'radial-gradient(ellipse 80% 55% at 12%  8%,  color-mix(in srgb,var(--primary)   11%,transparent), transparent 60%)',
        'radial-gradient(ellipse 60% 65% at 88% 18%,  color-mix(in srgb,var(--secondary)  8%,transparent), transparent 55%)',
        'radial-gradient(ellipse 50% 55% at 50% 82%,  color-mix(in srgb,var(--accent)     7%,transparent), transparent 50%)',
        'radial-gradient(ellipse 40% 40% at 82% 88%,  color-mix(in srgb,var(--primary)    5%,transparent), transparent 50%)',
      ].join(','),
    }} />
    {/* Floating orbs */}
    {[
      { w:500, h:500, top:'-6%',  left:'-5%',  color:'var(--primary)',   dur:'26s', del:'0s'   },
      { w:380, h:380, top:'58%',  left:'73%',  color:'var(--secondary)', dur:'32s', del:'-9s'  },
      { w:320, h:320, top:'33%',  left:'44%',  color:'var(--accent)',    dur:'21s', del:'-5s'  },
      { w:240, h:240, top:'78%',  left:'4%',   color:'var(--primary)',   dur:'29s', del:'-15s' },
      { w:170, h:170, top:'8%',   left:'68%',  color:'var(--secondary)', dur:'23s', del:'-7s'  },
    ].map((o, i) => (
      <div key={i} className="absolute rounded-full animate-pulse-glow" style={{
        width: o.w, height: o.h, top: o.top, left: o.left,
        background: `radial-gradient(circle, color-mix(in srgb,${o.color} 14%,transparent), transparent 70%)`,
        filter: 'blur(52px)',
        animationDuration: o.dur, animationDelay: o.del,
        animationTimingFunction: 'ease-in-out',
      }} />
    ))}
    {/* Dot grid */}
    <div className="absolute inset-0 opacity-[0.025]" style={{
      backgroundImage: 'radial-gradient(circle, var(--base-content) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    }} />
    {/* Noise texture */}
    <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat', backgroundSize: '256px 256px',
    }} />
  </div>
);

/* ─────────────────────────────────────────────────────────────────
   RECHARTS CUSTOM TOOLTIP
   ───────────────────────────────────────────────────────────────── */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs font-poppins shadow-xl border border-base-300 min-w-[110px]">
      {label && <p className="font-bold text-base-content mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="flex justify-between gap-4">
          <span>{p.name}</span><span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   STAT CARD
   ───────────────────────────────────────────────────────────────── */
const StatCard = React.memo(({ title, value, icon: Icon, trend, cv, sub }) => (
  <motion.div variants={itemV} className="glass-card p-5 relative overflow-hidden group cursor-default">
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{
      background: `radial-gradient(ellipse 80% 80% at 80% 20%, color-mix(in srgb,var(${cv}) 12%,transparent), transparent)`,
    }} />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-[10px] font-bold text-base-content/40 font-poppins uppercase tracking-widest mb-2">{title}</p>
        <h3 className="text-4xl font-black font-montserrat text-base-content leading-none">{value}</h3>
        {trend && (
          <p className="text-[11px] mt-2.5 font-semibold flex items-center gap-1.5" style={{ color: `var(${cv})` }}>
            <TrendingUp className="w-3 h-3" />{trend}
          </p>
        )}
        {sub && <p className="text-[10px] mt-1 text-base-content/30">{sub}</p>}
      </div>
      <div className="p-3 rounded-2xl transition-transform duration-300 group-hover:scale-110"
           style={{ background: `color-mix(in srgb,var(${cv}) 15%,transparent)` }}>
        <Icon className="w-5 h-5" style={{ color: `var(${cv})` }} />
      </div>
    </div>
  </motion.div>
));
StatCard.displayName = 'StatCard';

/* ─────────────────────────────────────────────────────────────────
   LOADING SKELETON
   ───────────────────────────────────────────────────────────────── */
const Skeleton = () => (
  <div className="space-y-6 animate-pulse w-full">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
      {[1,2,3,4].map(i => <div key={i} className="h-32 bg-base-300 rounded-2xl" />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {[1,2,3].map(i => <div key={i} className="h-72 bg-base-300 rounded-2xl" />)}
    </div>
    <div className="h-96 bg-base-300 rounded-2xl" />
  </div>
);

/* ─────────────────────────────────────────────────────────────────
   SUBSCRIBER DETAIL DRAWER
   ───────────────────────────────────────────────────────────────── */
const Drawer = ({ sub, onClose, onInvoice, pdfLoading }) => {
  const expiry   = new Date(sub.expiryDate);
  const daysLeft = Math.ceil((expiry - new Date()) / 864e5);
  const radarData = [
    { s: 'Consults',  A: sub.usage?.doctorConsultationsUsed || 0 },
    { s: 'Transport', A: sub.usage?.transportRidesUsed      || 0 },
    { s: 'Labs',      A: sub.usage?.labTestsUsed            || 0 },
  ];
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-base-content/20 backdrop-blur-sm" onClick={onClose} />
      <motion.div variants={drawerV} initial="hidden" animate="visible" exit="exit"
        className="relative z-10 w-full max-w-md h-full bg-base-100 border-l border-base-300 flex flex-col overflow-y-auto"
        style={{ boxShadow: 'var(--shadow-xl)' }}>

        {/* header */}
        <div className="p-6 border-b border-base-300 flex items-center justify-between"
             style={{ background: 'linear-gradient(135deg,color-mix(in srgb,var(--primary) 8%,var(--base-100)),color-mix(in srgb,var(--secondary) 6%,var(--base-100)))' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-content font-montserrat font-black text-lg">
              {sub.userName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-montserrat font-bold text-base-content">{sub.userName}</p>
              <p className="text-xs text-base-content/50">{sub.userEmail}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors">
            <X className="w-5 h-5 text-base-content/60" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 p-6 space-y-5">
          <div className="glass-card p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-base-content/40 uppercase tracking-widest font-poppins mb-1">Current Plan</p>
              <p className="text-xl font-montserrat font-black text-primary">{sub.planName}</p>
            </div>
            <span className="badge badge-success text-[10px]">
              <CheckCircle2 className="w-3 h-3" /> {sub.status}
            </span>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-base-content/40 uppercase tracking-widest font-poppins">Days Until Renewal</p>
              <Clock className="w-4 h-4 text-warning" />
            </div>
            <p className="text-3xl font-montserrat font-black text-base-content">{daysLeft}</p>
            <p className="text-xs text-base-content/40 mt-0.5">
              Expires {expiry.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
            <div className="mt-3 h-1.5 bg-base-300 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{
                width: `${Math.min(100, Math.max(5, (daysLeft / 30) * 100))}%`,
                background: daysLeft < 7 ? 'var(--error)' : daysLeft < 15 ? 'var(--warning)' : 'var(--success)',
              }} />
            </div>
          </div>

          <div className="glass-card p-4">
            <p className="text-[10px] text-base-content/40 uppercase tracking-widest font-poppins mb-3">Usage Radar</p>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--base-300)" />
                <PolarAngleAxis dataKey="s" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.6 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar dataKey="A" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { l: 'Consults', v: sub.usage?.doctorConsultationsUsed || 0, I: Stethoscope, c: '--primary'   },
              { l: 'Rides',    v: sub.usage?.transportRidesUsed      || 0, I: Car,         c: '--secondary' },
              { l: 'Labs',     v: sub.usage?.labTestsUsed            || 0, I: FlaskConical,c: '--accent'    },
            ].map(({ l, v, I, c }) => (
              <div key={l} className="glass-card p-3 text-center">
                <I className="w-4 h-4 mx-auto mb-1" style={{ color: `var(${c})` }} />
                <p className="text-2xl font-montserrat font-black text-base-content">{v}</p>
                <p className="text-[10px] text-base-content/40">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="p-5 border-t border-base-300">
          <button onClick={() => onInvoice(sub)} disabled={pdfLoading}
            className="btn-primary-cta w-full flex items-center justify-center gap-2 text-xs">
            {pdfLoading ? <span className="spinner w-4 h-4" /> : <Download className="w-4 h-4" />}
            Generate Invoice PDF
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────────────── */
export default function ActiveSubscriptionManagement() {
  const dispatch       = useDispatch();
  const subscribers    = useSelector(selectActiveSubscribers) || [];
  const isLoading      = useSelector(selectPlanLoading);

  const [search, setSearch]         = useState('');
  const [sortField, setSortField]   = useState('userName');
  const [sortDir, setSortDir]       = useState('asc');
  const [planFilter, setPlanFilter] = useState('All');
  const [drawer, setDrawer]         = useState(null);
  const [selected, setSelected]     = useState(new Set());
  const [pdfLoading, setPdf]        = useState(false);
  const [bulkLoading, setBulk]      = useState(false);
  const [chartMode, setChartMode]   = useState('area');

  useEffect(() => {
    dispatch(fetchActiveSubscriptions({ page: 1, limit: 100 }));
  }, [dispatch]);

  /* ── derived data ─────────────────────────────────────────────── */
  const planOptions = useMemo(() => {
    const p = [...new Set(subscribers.map(s => s.planName).filter(Boolean))];
    return ['All', ...p];
  }, [subscribers]);

  const filtered = useMemo(() => {
    let r = [...subscribers];
    if (planFilter !== 'All') r = r.filter(s => s.planName === planFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(s =>
        s.userName?.toLowerCase().includes(q) ||
        s.userEmail?.toLowerCase().includes(q) ||
        s.planName?.toLowerCase().includes(q)
      );
    }
    r.sort((a, b) => {
      const va = (a[sortField] ?? '').toString().toLowerCase();
      const vb = (b[sortField] ?? '').toString().toLowerCase();
      return va < vb ? (sortDir === 'asc' ? -1 : 1) : va > vb ? (sortDir === 'asc' ? 1 : -1) : 0;
    });
    return r;
  }, [subscribers, search, planFilter, sortField, sortDir]);

  const planDist = useMemo(() => {
    const d = subscribers.reduce((a, s) => { a[s.planName] = (a[s.planName] || 0) + 1; return a; }, {});
    return Object.entries(d).map(([name, value], i) => ({
      name, value,
      color: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'][i % 4],
    }));
  }, [subscribers]);

  const usageData = useMemo(() => {
    const t = subscribers.reduce((a, s) => {
      a.c += s.usage?.doctorConsultationsUsed || 0;
      a.t += s.usage?.transportRidesUsed      || 0;
      a.l += s.usage?.labTestsUsed            || 0;
      return a;
    }, { c: 0, t: 0, l: 0 });
    return [
      { name: 'Consultations', value: t.c, fill: 'var(--chart-1)' },
      { name: 'Transport',     value: t.t, fill: 'var(--chart-2)' },
      { name: 'Lab Tests',     value: t.l, fill: 'var(--chart-3)' },
    ];
  }, [subscribers]);

  const timeline = useMemo(() => {
    const g = {};
    subscribers.forEach(s => {
      if (!s.expiryDate) return;
      const k = new Date(s.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      g[k] = (g[k] || 0) + 1;
    });
    return Object.entries(g).map(([month, count]) => ({ month, count })).slice(0, 6);
  }, [subscribers]);

  const totalUsage   = usageData.reduce((a, c) => a + c.value, 0);
  const expiringSoon = useMemo(() => {
    const cut = new Date(); cut.setDate(cut.getDate() + 7);
    return subscribers.filter(s => s.expiryDate && new Date(s.expiryDate) <= cut).length;
  }, [subscribers]);

  /* ── handlers ─────────────────────────────────────────────────── */
  const doSort = useCallback((f) => {
    setSortField(p => {
      if (p === f) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return f; }
      setSortDir('asc'); return f;
    });
  }, []);

  const toggleRow = useCallback((id) => {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(p =>
      p.size === filtered.length && filtered.length > 0
        ? new Set()
        : new Set(filtered.map(s => s._id))
    );
  }, [filtered]);

  const doInvoice = useCallback(async (sub) => {
    setPdf(true);
    try { await generateInvoicePDF(sub); }
    catch (e) { console.error(e); alert('PDF failed — run: npm install jspdf'); }
    finally { setPdf(false); }
  }, []);

  const doBulk = useCallback(async () => {
    if (!selected.size) return;
    setBulk(true);
    try {
      for (const s of filtered.filter(x => selected.has(x._id))) await generateInvoicePDF(s);
    } catch (e) { console.error(e); }
    finally { setBulk(false); }
  }, [selected, filtered]);

  const SortIcon = ({ f }) =>
    sortField !== f
      ? <ChevronDown className="w-3 h-3 opacity-30 inline" />
      : sortDir === 'asc'
        ? <ChevronUp   className="w-3 h-3 text-primary inline" />
        : <ChevronDown className="w-3 h-3 text-primary inline" />;

  /* ── loading ──────────────────────────────────────────────────── */
  if (isLoading && subscribers.length === 0) {
    return <div className="container-custom py-8 relative"><LikesonBg /><Skeleton /></div>;
  }

  /* ── render ───────────────────────────────────────────────────── */
  return (
    <>
      <LikesonBg />

      <motion.div
        className="container-custom py-8 w-full max-w-[1440px] mx-auto space-y-7 relative z-0"
        variants={containerV} initial="hidden" animate="visible"
      >
        {/* ══ HEADER ══════════════════════════════════════════════ */}
        <motion.div variants={itemV}
          className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            {/* Logo + brand */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-base-300 shadow-sm bg-base-200 flex-shrink-0">
                <img src={LOGO_URL} alt="Likeson"
                     className="w-full h-full object-cover"
                     onError={e => { e.currentTarget.style.display = 'none'; }} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-montserrat font-black text-primary">Likeson</span>
                <span className="text-[10px] font-poppins text-base-content/40 uppercase tracking-widest border-l border-base-300 pl-2">
                  Enterprise Analytics
                </span>
              </div>
            </div>
            <h1 className="section-heading mb-1 text-3xl md:text-4xl !leading-tight">
              Active Subscriptions
            </h1>
            <p className="section-subheading mb-0 text-sm md:text-base">
              Monitor subscriber health, usage metrics, and generate invoices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => dispatch(fetchActiveSubscriptions({ page: 1, limit: 100 }))}
              className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            {selected.size > 0 && (
              <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                onClick={doBulk} disabled={bulkLoading}
                className="btn-primary-cta flex items-center gap-2 py-2 px-4 text-xs">
                {bulkLoading ? <span className="spinner w-4 h-4" /> : <Printer className="w-3.5 h-3.5" />}
                Invoice {selected.size} Selected
              </motion.button>
            )}
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
              <input type="text" placeholder="Search name, email, plan…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="input-field w-full pl-9 py-2 text-sm" aria-label="Search" />
            </div>
          </div>
        </motion.div>

        {/* ══ STAT CARDS ══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard title="Total Subscribers"    value={subscribers.length}   icon={Users}      cv="--primary"   trend="Live count"            sub="All active plans" />
          <StatCard title="Plan Tiers Active"    value={planDist.length}      icon={BadgeCheck} cv="--secondary" trend="Unique plan types"      sub="Across portfolio" />
          <StatCard title="Total Service Events" value={totalUsage}           icon={Activity}   cv="--accent"    trend="This billing cycle"     sub="Consults + rides + labs" />
          <StatCard title="Expiring in 7 Days"   value={expiringSoon}         icon={Clock}      cv="--warning"   trend={expiringSoon ? 'Needs attention' : 'All good'} sub="Renewal required" />
        </div>

        {/* ══ CHARTS ══════════════════════════════════════════════ */}
        {subscribers.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Donut — plan distribution */}
            <motion.div variants={itemV} className="glass-card p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-montserrat font-bold">Plan Distribution</h3>
                <FileText className="w-4 h-4 text-base-content/30" />
              </div>
              <div className="flex-1 min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<ChartTip />} />
                    <Legend iconType="circle"
                      wrapperStyle={{ fontFamily: 'var(--font-family-poppins)', fontSize: 11 }} />
                    <Pie data={planDist} cx="50%" cy="44%"
                         innerRadius={55} outerRadius={82}
                         paddingAngle={4} dataKey="value" stroke="none">
                      {planDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Bar — usage */}
            <motion.div variants={itemV} className="glass-card p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-montserrat font-bold">Service Usage</h3>
                <Activity className="w-4 h-4 text-base-content/30" />
              </div>
              <div className="flex-1 min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                    <XAxis dataKey="name"
                      tick={{ fontFamily: 'var(--font-family-poppins)', fontSize: 10, fill: 'var(--base-content)', opacity: 0.6 }}
                      axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontFamily: 'var(--font-family-poppins)', fontSize: 10, fill: 'var(--base-content)', opacity: 0.6 }}
                      axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--base-200)' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={52}>
                      {usageData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Area/Line — expiry timeline */}
            <motion.div variants={itemV} className="glass-card p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-montserrat font-bold">Expiry Timeline</h3>
                <div className="flex gap-1">
                  {['area', 'line'].map(m => (
                    <button key={m} onClick={() => setChartMode(m)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-poppins font-bold uppercase tracking-wider transition-all
                        ${chartMode === m ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/50 hover:bg-base-300'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'area' ? (
                    <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--secondary)" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.6, fontFamily: 'var(--font-family-poppins)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.6, fontFamily: 'var(--font-family-poppins)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="count" name="Renewals"
                        stroke="var(--secondary)" fill="url(#tg)" strokeWidth={2.5}
                        dot={{ r: 4, fill: 'var(--secondary)', strokeWidth: 0 }} />
                    </AreaChart>
                  ) : (
                    <LineChart data={timeline} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.6, fontFamily: 'var(--font-family-poppins)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.6, fontFamily: 'var(--font-family-poppins)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Line type="monotone" dataKey="count" name="Renewals"
                        stroke="var(--accent)" strokeWidth={2.5}
                        dot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        )}

        {/* ══ TABLE ═══════════════════════════════════════════════ */}
        <motion.div variants={itemV} className="glass-card overflow-hidden">

          {/* toolbar */}
          <div className="p-5 border-b border-base-300 flex flex-wrap items-center justify-between gap-4 bg-base-100/50">
            <div>
              <h3 className="text-lg font-montserrat font-bold">Subscriber Directory</h3>
              <p className="text-[11px] text-base-content/40 mt-0.5">
                {filtered.length} of {subscribers.length} subscribers
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-base-content/40" />
              <div className="flex gap-1.5 flex-wrap">
                {planOptions.map(p => (
                  <button key={p} onClick={() => setPlanFilter(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-poppins font-semibold transition-all
                      ${planFilter === p
                        ? 'bg-primary text-primary-content'
                        : 'bg-base-200 text-base-content/60 hover:bg-base-300'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* table */}
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center text-base-content/40">
                <AlertCircle className="w-14 h-14 mb-4 opacity-30" />
                <p className="text-lg font-poppins font-medium">No subscribers found.</p>
                {search && <p className="text-sm mt-1 opacity-70">Try a different search.</p>}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-base-200/60 text-[10px] uppercase tracking-widest text-base-content/50 font-poppins font-bold border-b border-base-300">
                    <th className="px-5 py-3.5 w-10">
                      <input type="checkbox" className="rounded w-4 h-4 accent-primary cursor-pointer"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} />
                    </th>
                    {[
                      { l: 'Customer',      f: 'userName'   },
                      { l: 'Plan & Status', f: 'planName'   },
                      { l: 'Usage',         f: null         },
                      { l: 'Renewal',       f: 'expiryDate' },
                      { l: 'Actions',       f: null         },
                    ].map(({ l, f }) => (
                      <th key={l}
                          className={`px-5 py-3.5 ${f ? 'cursor-pointer hover:text-primary select-none' : ''}`}
                          onClick={() => f && doSort(f)}>
                        <span className="flex items-center gap-1.5">
                          {l}{f && <SortIcon f={f} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map((sub, idx) => {
                      const exp     = new Date(sub.expiryDate);
                      const dl      = Math.ceil((exp - new Date()) / 864e5);
                      const isSel   = selected.has(sub._id);
                      return (
                        <motion.tr key={sub._id}
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          transition={{ delay: Math.min(idx * 0.03, 0.25) }}
                          className={`border-b border-base-300/40 transition-colors group
                            ${isSel ? 'bg-primary/5' : 'hover:bg-base-200/30'}`}>

                          {/* checkbox */}
                          <td className="px-5 py-4">
                            <input type="checkbox" className="rounded w-4 h-4 accent-primary cursor-pointer"
                              checked={isSel} onChange={() => toggleRow(sub._id)} />
                          </td>

                          {/* customer */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-montserrat font-black text-sm flex-shrink-0">
                                {sub.userName?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-base-content">{sub.userName}</p>
                                <p className="text-[11px] text-base-content/50">{sub.userEmail}</p>
                              </div>
                            </div>
                          </td>

                          {/* plan */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <p className="font-semibold text-sm text-primary">{sub.planName}</p>
                            <span className="badge badge-success text-[9px] mt-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> {sub.status}
                            </span>
                          </td>

                          {/* usage */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex gap-3 text-[11px] font-poppins text-base-content/70">
                              <span className="flex items-center gap-1">
                                <Stethoscope className="w-3 h-3" style={{ color: 'var(--chart-1)' }} />
                                {sub.usage?.doctorConsultationsUsed || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Car className="w-3 h-3" style={{ color: 'var(--chart-2)' }} />
                                {sub.usage?.transportRidesUsed || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <FlaskConical className="w-3 h-3" style={{ color: 'var(--chart-3)' }} />
                                {sub.usage?.labTestsUsed || 0}
                              </span>
                            </div>
                          </td>

                          {/* renewal */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-sm text-base-content/70">
                              <Calendar className="w-3.5 h-3.5 text-base-content/40" />
                              {exp.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            <span className={`text-[10px] font-semibold font-poppins ${
                              dl < 0 ? 'text-error' : dl < 7 ? 'text-error' : dl < 15 ? 'text-warning' : 'text-success'
                            }`}>
                              {dl < 0 ? 'Expired' : `${dl}d left`}
                            </span>
                          </td>

                          {/* actions */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setDrawer(sub)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                                title="View details">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button onClick={() => doInvoice(sub)} disabled={pdfLoading}
                                className="p-1.5 rounded-lg hover:bg-secondary/10 text-secondary transition-colors"
                                title="Download invoice">
                                {pdfLoading
                                  ? <span className="spinner w-4 h-4" />
                                  : <Download className="w-4 h-4" />
                                }
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>

          {/* table footer */}
          {filtered.length > 0 && (
            <div className="px-5 py-3.5 border-t border-base-300 bg-base-100/50 flex items-center justify-between">
              <span className="text-xs text-base-content/40 font-poppins">
                {selected.size > 0
                  ? `${selected.size} row${selected.size > 1 ? 's' : ''} selected — use Invoice button above`
                  : `Showing ${filtered.length} subscriber${filtered.length !== 1 ? 's' : ''}`
                }
              </span>
              <span className="flex items-center gap-1.5 text-xs text-base-content/30 font-poppins">
                <Sparkles className="w-3 h-3 text-primary" /> Hover a row to reveal actions
              </span>
            </div>
          )}
        </motion.div>

      </motion.div>

      {/* ══ DRAWER ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {drawer && (
          <Drawer
            sub={drawer}
            onClose={() => setDrawer(null)}
            onInvoice={doInvoice}
            pdfLoading={pdfLoading}
          />
        )}
      </AnimatePresence>
    </>
  );
}