'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import {
  FileText, Download, Search, Filter, Eye, Printer,
  RefreshCw, ChevronLeft, ChevronRight, IndianRupee,
  CheckCircle2, Clock, XCircle, RotateCcw, AlertCircle,
  User, Store, Package, Tag, MapPin, Phone, Mail,
  TrendingUp, BarChart2, Wallet, CreditCard,
  Banknote, X, Shield,
  FileCheck, FileClock, FileSearch
} from 'lucide-react';
import {
  fetchPharmacyOrders,
  selectPharmacyOrders,
} from '@/store/slices/superadminSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const DELIVERY_STATUSES = ['Placed', 'Confirmed', 'Processing', 'Out-for-Delivery', 'Delivered', 'Cancelled', 'Returned'];
const PAYMENT_STATUSES  = ['Pending', 'Paid', 'Failed', 'Refunded'];

const PAYMENT_META = {
  Paid:     { cls: 'badge-success', icon: CheckCircle2 },
  Pending:  { cls: 'badge-warning', icon: Clock },
  Failed:   { cls: 'badge-error',   icon: XCircle },
  Refunded: { cls: 'badge-info',    icon: RotateCcw },
};

const DELIVERY_META = {
  Delivered:          { cls: 'badge-success', icon: CheckCircle2 },
  Placed:             { cls: 'badge-info',    icon: Clock },
  Confirmed:          { cls: 'badge-primary', icon: CheckCircle2 },
  Processing:         { cls: 'badge-warning', icon: Package },
  'Out-for-Delivery': { cls: 'badge-warning', icon: Package },
  Cancelled:          { cls: 'badge-error',   icon: XCircle },
  Returned:           { cls: 'badge-error',   icon: AlertCircle },
};

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)',
];

const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

// ─── Invoice Generator ────────────────────────────────────────────────────────

const generateAndPrintInvoice = (order) => {
  const itemsHTML = (order.items ?? []).map((item, i) => `
    <tr>
      <td class="td">${i + 1}</td>
      <td class="td"><strong>${item.name}</strong></td>
      <td class="td tr">${item.quantity}</td>
      <td class="td tr">₹${item.pricePerUnit?.toFixed(2)}</td>
      <td class="td tr">₹${(item.taxAmount ?? 0).toFixed(2)}</td>
      <td class="td tr bold">₹${item.totalPrice?.toFixed(2)}</td>
    </tr>`).join('');

  const pStatus   = order.payment?.status ?? 'Pending';
  const statusBg  = { Paid: '#dcfce7', Pending: '#fef3c7', Failed: '#fee2e2', Refunded: '#dbeafe' };
  const statusClr = { Paid: '#16a34a', Pending: '#d97706', Failed: '#dc2626', Refunded: '#2563eb' };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Tax Invoice – ${order.orderId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Plus Jakarta Sans',sans-serif;background:#f8fafc;color:#0f172a;padding:32px;}
    .page{max-width:760px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.08);}
    .header{background:linear-gradient(135deg,#1d4ed8,#0ea5e9);padding:36px 40px;position:relative;overflow:hidden;}
    .header::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:rgba(255,255,255,.08);border-radius:50%;}
    .header-inner{display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1;}
    .brand{color:#fff;} .brand-name{font-size:28px;font-weight:900;letter-spacing:-1px;margin-bottom:4px;}
    .brand-sub{font-size:12px;opacity:.7;font-weight:500;}
    .inv-meta{text-align:right;color:#fff;}
    .inv-meta h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;opacity:.7;margin-bottom:8px;}
    .inv-meta .inv-num{font-size:22px;font-weight:900;letter-spacing:-.5px;}
    .inv-meta .inv-date{font-size:12px;opacity:.7;margin-top:4px;}
    .strip{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:16px 40px;display:flex;align-items:center;gap:12px;}
    .sbadge{padding:5px 14px;border-radius:999px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;}
    .tag{font-size:11px;color:#64748b;background:#f1f5f9;border-radius:999px;padding:4px 12px;font-weight:700;border:1px solid #e2e8f0;}
    .body{padding:32px 40px;}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;}
    .party{background:#f8faff;border-radius:12px;padding:20px;border:1px solid #e0e7ff;}
    .party h4{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:12px;}
    .party .name{font-size:15px;font-weight:800;color:#0f172a;margin-bottom:6px;}
    .party p{font-size:12px;color:#64748b;line-height:1.7;}
    .sec-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:14px;}
    table.items{width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:28px;}
    table.items thead tr{background:linear-gradient(135deg,#1d4ed8,#0ea5e9);}
    table.items thead th{padding:11px 14px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#fff;}
    .td{padding:10px 14px;font-size:12px;color:#374151;border-bottom:1px solid #f1f5f9;}
    .tr{text-align:right;} .bold{font-weight:700;color:#0f172a;}
    tr:nth-child(even) td{background:#f8faff;}
    .bill-wrap{display:flex;justify-content:flex-end;margin-bottom:20px;}
    .bill-box{min-width:280px;background:#f8faff;border-radius:12px;padding:20px;border:1px solid #e0e7ff;}
    .br{display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:9px;}
    .bt{display:flex;justify-content:space-between;font-size:17px;font-weight:900;color:#0f172a;border-top:2px solid #1d4ed8;padding-top:12px;margin-top:8px;}
    .bt span:last-child{color:#1d4ed8;}
    .ref-note{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;font-size:12px;color:#92400e;display:flex;align-items:flex-start;gap:10px;}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;display:flex;align-items:center;justify-content:space-between;}
    .footer p{font-size:11px;color:#94a3b8;}
    @media print{body{background:#fff;padding:0;}.page{box-shadow:none;border-radius:0;}}
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-inner">
      <div class="brand">
        <div class="brand-name">LikesonHealth</div>
        <div class="brand-sub">Premium Healthcare Platform · Vijayawada, AP</div>
      </div>
      <div class="inv-meta">
        <h2>Tax Invoice</h2>
        <div class="inv-num">${order.orderId}</div>
        <div class="inv-date">${new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>
  </div>
  <div class="strip">
    <span class="sbadge" style="background:${statusBg[pStatus]};color:${statusClr[pStatus]}">${pStatus}</span>
    <span class="tag">${order.payment?.method ?? '—'}</span>
    <span class="tag">Delivery: ${order.delivery?.status ?? '—'}</span>
    ${order.billing?.promoCode ? `<span class="tag">Promo: ${order.billing.promoCode}</span>` : ''}
  </div>
  <div class="body">
    <div class="parties">
      <div class="party">
        <h4>Billed To</h4>
        <div class="name">${order.customer?.name ?? 'Customer'}</div>
        <p>${order.customer?.email ?? ''}</p>
        <p>${order.customer?.phone ?? ''}</p>
        <p>${order.delivery?.address?.line1 ?? ''}</p>
        <p>${order.delivery?.address?.city ?? ''} ${order.delivery?.address?.pincode ? '– ' + order.delivery.address.pincode : ''}</p>
      </div>
      <div class="party">
        <h4>Supplied By</h4>
        <div class="name">${order.store?.name ?? 'Pharmacy Store'}</div>
        <p>LikesonHealth Platform</p>
        <p>Vijayawada, Andhra Pradesh</p>
        <p>GSTIN: XXXXXXXXXX</p>
        <p>CIN: XXXXXXXXXX</p>
      </div>
    </div>
    <p class="sec-title">Order Items (${(order.items ?? []).length} items)</p>
    <table class="items">
      <thead><tr>
        <th>#</th><th>Item Description</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Tax</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    <div class="bill-wrap">
      <div class="bill-box">
        <div class="br"><span>Subtotal</span><span>₹${(order.billing?.subTotal ?? 0).toFixed(2)}</span></div>
        <div class="br"><span>GST</span><span>₹${(order.billing?.gstAmount ?? 0).toFixed(2)}</span></div>
        <div class="br"><span>Delivery</span><span>₹${(order.billing?.deliveryCharges ?? 0).toFixed(2)}</span></div>
        <div class="br"><span>Platform Fee</span><span>₹${(order.billing?.platformFee ?? 0).toFixed(2)}</span></div>
        ${order.billing?.discountAmount ? `<div class="br"><span>Discount</span><span style="color:#16a34a;font-weight:700">-₹${order.billing.discountAmount.toFixed(2)}</span></div>` : ''}
        <div class="bt"><span>Grand Total</span><span>₹${(order.billing?.totalPayable ?? 0).toFixed(2)}</span></div>
      </div>
    </div>
    ${order.payment?.razorpayPaymentId ? `
    <div class="ref-note">
      <span>🔒</span>
      <div><strong>Payment Reference:</strong> ${order.payment.razorpayPaymentId}<br/>
      ${order.payment?.razorpayOrderId ? `Razorpay Order: ${order.payment.razorpayOrderId}` : ''}</div>
    </div>` : ''}
  </div>
  <div class="footer">
    <p>Computer-generated invoice · No signature required</p>
    <p>🛡️ Secured · support@likesonhealth.com</p>
  </div>
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 600);
};

// ─── Shared Atoms ─────────────────────────────────────────────────────────────

const ChartTooltip = memo(({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-xs shadow-depth border border-base-300">
      <p className="font-black text-base-content mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="mb-0.5">
          {p.name}: <strong>
            {p.dataKey === 'revenue' || p.dataKey === 'value'
              ? `₹${Number(p.value).toLocaleString('en-IN')}`
              : p.value}
          </strong>
        </p>
      ))}
    </div>
  );
});
ChartTooltip.displayName = 'ChartTooltip';

const PayBadge = memo(({ status }) => {
  const { cls, icon: Icon } = PAYMENT_META[status] ?? { cls: 'badge-info', icon: Clock };
  return <span className={`badge ${cls} gap-1`}><Icon size={10} />{status}</span>;
});
PayBadge.displayName = 'PayBadge';

const DelBadge = memo(({ status }) => {
  const { cls, icon: Icon } = DELIVERY_META[status] ?? { cls: 'badge-info', icon: Clock };
  return <span className={`badge ${cls} gap-1`}><Icon size={10} />{status}</span>;
});
DelBadge.displayName = 'DelBadge';

const SkeletonCard = () => (
  <div className="glass-card p-5 space-y-4">
    <div className="flex justify-between">
      <div className="skeleton h-4 w-28 rounded" />
      <div className="skeleton h-5 w-16 rounded-full" />
    </div>
    <div className="flex items-center gap-2">
      <div className="skeleton w-8 h-8 rounded-full" />
      <div className="space-y-1.5 flex-1">
        <div className="skeleton h-3 w-32 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
    </div>
    <div className="flex justify-between">
      <div className="skeleton h-6 w-24 rounded" />
      <div className="skeleton h-5 w-20 rounded-full" />
    </div>
  </div>
);

const Pagination = ({ pagination, page, onPage }) => {
  const total = pagination?.total ?? 0;
  const pages = pagination?.pages ?? 0;
  const cur   = pagination?.page  ?? page;
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-base-300 bg-base-200/30">
      <p className="text-xs text-base-content/40">
        Page {cur} of {pages} · {total.toLocaleString()} invoices
      </p>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="btn-secondary btn-sm disabled:opacity-30"><ChevronLeft size={14} /></button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)}
          className="btn-secondary btn-sm disabled:opacity-30"><ChevronRight size={14} /></button>
      </div>
    </div>
  );
};

// ─── Invoice Card (Grid) ──────────────────────────────────────────────────────

const InvoiceCard = memo(({ order, onView }) => (
  <motion.div variants={fadeUp} whileHover={{ y: -3, transition: { duration: 0.2 } }}
    className="glass-card p-5 space-y-4 cursor-pointer group"
    onClick={() => onView(order)}>
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-mono font-black text-xs text-primary">{order.orderId}</p>
        <p className="text-xs text-base-content/40 mt-0.5">
          {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <PayBadge status={order.payment?.status} />
        <span className="text-xs text-base-content/40 flex items-center gap-1">
          {order.payment?.method === 'Razorpay' ? <CreditCard size={10} /> :
           order.payment?.method === 'Wallet'   ? <Wallet size={10} /> :
           <Banknote size={10} />}
          {order.payment?.method}
        </span>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <User size={13} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-base-content truncate">{order.customer?.name ?? '—'}</p>
        <p className="text-xs text-base-content/40 truncate flex items-center gap-1">
          <Store size={10} /> {order.store?.name ?? '—'}
        </p>
      </div>
    </div>

    <div className="flex items-center justify-between">
      <div>
        <p className="text-xl font-black text-base-content">
          ₹{order.billing?.totalPayable?.toLocaleString('en-IN') ?? '—'}
        </p>
        <p className="text-xs text-base-content/40">{order.items?.length ?? 0} items</p>
      </div>
      <DelBadge status={order.delivery?.status} />
    </div>

    <div className="flex gap-2 pt-1 border-t border-base-300 opacity-0 group-hover:opacity-100 transition-all duration-200">
      <button onClick={e => { e.stopPropagation(); onView(order); }}
        className="flex-1 btn-ghost btn-xs flex items-center justify-center gap-1.5 text-primary">
        <Eye size={13} /> Preview
      </button>
      <button onClick={e => { e.stopPropagation(); generateAndPrintInvoice(order); }}
        className="flex-1 btn-ghost btn-xs flex items-center justify-center gap-1.5 text-success">
        <Printer size={13} /> Print
      </button>
      <button onClick={e => { e.stopPropagation(); generateAndPrintInvoice(order); }}
        className="flex-1 btn-ghost btn-xs flex items-center justify-center gap-1.5 text-secondary">
        <Download size={13} /> PDF
      </button>
    </div>
  </motion.div>
));
InvoiceCard.displayName = 'InvoiceCard';

// ─── Invoice Modal ────────────────────────────────────────────────────────────

const InvoiceModal = memo(({ order, onClose }) => {
  if (!order) return null;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto pt-[5vh]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <motion.div className="relative w-full max-w-2xl z-10 mb-8 bg-base-100 rounded-box overflow-hidden"
        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
        transition={{ type: 'spring', damping: 28 }}>

        {/* Header */}
        <div className="sticky top-0 z-20 px-6 py-4 border-b border-base-300 flex items-center justify-between bg-base-200/80 backdrop-blur-strong">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/10">
              <FileText size={18} className="text-accent" />
            </div>
            <div>
              <p className="font-black text-base-content">{order.orderId}</p>
              <p className="text-xs text-base-content/40">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => generateAndPrintInvoice(order)}
              className="btn-primary-cta btn-sm flex items-center gap-1.5">
              <Printer size={13} /> Print
            </button>
            <button onClick={() => generateAndPrintInvoice(order)}
              className="btn-secondary btn-sm flex items-center gap-1.5">
              <Download size={13} /> Download
            </button>
            <button onClick={onClose} className="btn-ghost btn-sm btn-circle"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Invoice header preview */}
          <div className="rounded-box overflow-hidden border border-base-300">
            <div className="p-5 bg-gradient-to-br from-primary to-secondary text-primary-content">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xl font-black">LikesonHealth</p>
                  <p className="text-xs opacity-70 mt-1">Premium Healthcare Platform</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Tax Invoice</p>
                  <p className="text-lg font-black">{order.orderId}</p>
                  <p className="text-xs opacity-70">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-base-200/50 border-t border-base-300 flex items-center gap-3 flex-wrap">
              <PayBadge status={order.payment?.status} />
              <DelBadge status={order.delivery?.status} />
              <span className="text-xs text-base-content/50">{order.payment?.method}</span>
              {order.billing?.promoCode && (
                <span className="badge badge-success gap-1"><Tag size={10} />{order.billing.promoCode}</span>
              )}
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Billed To</p>
              <p className="font-black text-base-content">{order.customer?.name ?? '—'}</p>
              <p className="text-xs text-base-content/50 mt-1 flex items-center gap-1">
                <Mail size={10} />{order.customer?.email ?? '—'}
              </p>
              <p className="text-xs text-base-content/50 mt-1 flex items-center gap-1">
                <Phone size={10} />{order.customer?.phone ?? '—'}
              </p>
              <p className="text-xs text-base-content/50 mt-1 flex items-center gap-1">
                <MapPin size={10} />{order.delivery?.address?.line1}, {order.delivery?.address?.city}
              </p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Fulfilled By</p>
              <p className="font-black text-base-content">{order.store?.name ?? 'Pharmacy Store'}</p>
              <p className="text-xs text-base-content/50 mt-1">LikesonHealth Platform</p>
              <p className="text-xs text-base-content/50 mt-1">Method: {order.payment?.method}</p>
              <p className="text-xs text-base-content/50 mt-1">Delivery: {order.delivery?.deliveryType}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-base-300 flex items-center gap-2">
              <Package size={14} className="text-primary" />
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">
                Items ({order.items?.length ?? 0})
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    {['#', 'Medicine', 'Qty', 'Unit Price', 'Tax', 'Total'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(order.items ?? []).map((item, i) => (
                    <tr key={i}>
                      <td className="text-base-content/50">{i + 1}</td>
                      <td className="font-semibold text-base-content">{item.name}</td>
                      <td className="text-base-content/70">{item.quantity}</td>
                      <td className="text-base-content/70">₹{item.pricePerUnit?.toFixed(2)}</td>
                      <td className="text-base-content/50">₹{(item.taxAmount ?? 0).toFixed(2)}</td>
                      <td className="font-black text-base-content">₹{item.totalPrice?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Billing summary */}
          <div className="flex justify-end">
            <div className="glass-card p-5 w-full max-w-xs space-y-2">
              {[
                ['Subtotal',     order.billing?.subTotal        ?? 0, false],
                ['GST',          order.billing?.gstAmount       ?? 0, false],
                ['Delivery',     order.billing?.deliveryCharges ?? 0, false],
                ['Platform Fee', order.billing?.platformFee     ?? 0, false],
                ['Discount',    -(order.billing?.discountAmount ?? 0), true],
              ].filter(([, val]) => val !== 0).map(([label, val, isDiscount]) => (
                <div key={label} className="flex justify-between text-xs text-base-content/60">
                  <span>{label}</span>
                  <span className={isDiscount && val < 0 ? 'text-success font-semibold' : ''}>
                    {isDiscount && val < 0 ? '-' : ''}₹{Math.abs(val).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-black text-base-content border-t border-base-300 pt-3 mt-1 text-sm">
                <span>Grand Total</span>
                <span className="text-primary">₹{order.billing?.totalPayable?.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {order.payment?.razorpayPaymentId && (
            <div className="alert alert-info text-xs flex items-center gap-2">
              <Shield size={14} />
              Payment Ref: <strong className="font-mono">{order.payment.razorpayPaymentId}</strong>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});
InvoiceModal.displayName = 'InvoiceModal';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicePage() {
  const dispatch = useDispatch();
  const { data: orders, pagination, loading } = useSelector(selectPharmacyOrders);

  const [filters, setFilters] = useState({
    page: 1, limit: 18, search: '', paymentStatus: '', status: '',
    startDate: '', endDate: '', minAmount: '', maxAmount: '',
  });
  const [showFilters,   setShowFilters]   = useState(false);
  const [viewMode,      setViewMode]      = useState('grid');
  const [activeInvoice, setActiveInvoice] = useState(null);

  const setFilter = useCallback((key, val) =>
    setFilters(p => ({ ...p, [key]: val, ...(key !== 'page' ? { page: 1 } : {}) })), []);

  const fetchData = useCallback(() => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    dispatch(fetchPharmacyOrders(clean));
  }, [dispatch, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Analytics ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let paid = 0, pending = 0, failed = 0, totalRevenue = 0;
    orders.forEach(o => {
      if (o.payment?.status === 'Paid')    { paid++;    totalRevenue += o.billing?.totalPayable ?? 0; }
      if (o.payment?.status === 'Pending')   pending++;
      if (o.payment?.status === 'Failed')    failed++;
    });
    return { paid, pending, failed, totalRevenue };
  }, [orders]);

  const revenueByMethod = useMemo(() => {
    const m = {};
    orders.forEach(o => {
      if (o.payment?.status !== 'Paid') return;
      const method = o.payment?.method ?? 'Unknown';
      m[method] = (m[method] ?? 0) + (o.billing?.totalPayable ?? 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const revenueByDay = useMemo(() => {
    const m = {};
    orders.forEach(o => {
      if (o.payment?.status !== 'Paid') return;
      const d = new Date(o.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      m[d] = (m[d] ?? 0) + (o.billing?.totalPayable ?? 0);
    });
    return Object.entries(m).slice(-10).map(([date, revenue]) => ({ date, revenue }));
  }, [orders]);

  const exportAll = useCallback(() => {
    const rows = [
      'Invoice No,Customer,Email,Store,Items,Subtotal,GST,Delivery,Total,Method,Status,Date',
      ...orders.map(o =>
        `"${o.orderId}","${o.customer?.name ?? ''}","${o.customer?.email ?? ''}","${o.store?.name ?? ''}",` +
        `${o.items?.length ?? 0},${o.billing?.subTotal ?? 0},${o.billing?.gstAmount ?? 0},` +
        `${o.billing?.deliveryCharges ?? 0},${o.billing?.totalPayable ?? 0},` +
        `"${o.payment?.method ?? ''}","${o.payment?.status ?? ''}","${new Date(o.createdAt).toLocaleDateString('en-IN')}"`
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' }));
    a.download = `invoices-${Date.now()}.csv`;
    a.click();
  }, [orders]);

  const safeTotal = pagination?.total ?? 0;

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">

      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div variants={fadeUp}>
          <h1 className="text-responsive-xl font-black text-base-content flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-accent/10">
              <FileText size={26} className="text-accent" />
            </div>
            Invoice Manager
          </h1>
          <p className="text-base-content/40 text-sm mt-1 ml-1">
            Browse, preview &amp; print all tax invoices
          </p>
        </motion.div>
        <motion.div variants={fadeUp} className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1 glass-card p-1 rounded-xl">
            {[['grid', 'Grid'], ['list', 'List']].map(([k, l]) => (
              <button key={k} onClick={() => setViewMode(k)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  viewMode === k
                    ? 'bg-accent text-accent-content shadow-md'
                    : 'text-base-content/60 hover:text-base-content'
                }`}>{l}</button>
            ))}
          </div>
          <button onClick={fetchData} className="btn-secondary btn-sm flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportAll} className="btn-primary-cta btn-sm flex items-center gap-2">
            <Download size={14} /> Bulk Export
          </button>
        </motion.div>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { title: 'Total Invoices',  value: safeTotal.toLocaleString(),        icon: FileText,    colorCls: 'text-primary',  bgCls: 'bg-primary/10' },
          { title: 'Paid Invoices',   value: stats.paid,                         icon: FileCheck,   colorCls: 'text-success',  bgCls: 'bg-success/10' },
          { title: 'Pending',         value: stats.pending,                      icon: FileClock,   colorCls: 'text-warning',  bgCls: 'bg-warning/10' },
          { title: 'Revenue (Page)',  value: `₹${stats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: IndianRupee, colorCls: 'text-success', bgCls: 'bg-success/10' },
        ].map(({ title, value, icon: Icon, colorCls, bgCls }) => (
          <motion.div key={title} variants={fadeUp} className="glass-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/50">{title}</p>
              <div className={`p-2.5 rounded-xl ${bgCls}`}>
                <Icon size={17} className={colorCls} />
              </div>
            </div>
            <motion.p className="text-2xl font-black text-base-content"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: 'backOut' }}>
              {value}
            </motion.p>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-primary" />
            <h3 className="font-bold text-sm text-base-content">Daily Revenue Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={revenueByDay} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="invRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4 }}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="var(--accent)" fill="url(#invRevGrad)" strokeWidth={2.5} name="Revenue ₹" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className="text-secondary" />
            <h3 className="font-bold text-sm text-base-content">Revenue by Payment Method</h3>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revenueByMethod} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4 }}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Revenue ₹" radius={[6, 6, 0, 0]}>
                {revenueByMethod.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <div className="glass-card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input className="input-field pl-9" placeholder="Search order ID, customer…"
                value={filters.search} onChange={e => setFilter('search', e.target.value)} />
            </div>
            <select className="input-field sm:w-48" value={filters.paymentStatus}
              onChange={e => setFilter('paymentStatus', e.target.value)}>
              <option value="">All Payment Statuses</option>
              {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="input-field sm:w-48" value={filters.status}
              onChange={e => setFilter('status', e.target.value)}>
              <option value="">All Delivery Statuses</option>
              {DELIVERY_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={() => setShowFilters(p => !p)}
              className="btn-secondary btn-sm flex items-center gap-2 whitespace-nowrap">
              <Filter size={14} /> {showFilters ? 'Less' : 'More'}
            </button>
          </div>
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-base-300">
                  {[['Start Date', 'date', 'startDate'], ['End Date', 'date', 'endDate'],
                    ['Min Amount ₹', 'number', 'minAmount'], ['Max Amount ₹', 'number', 'maxAmount']
                  ].map(([l, t, k]) => (
                    <div key={k}>
                      <label className="label-text block mb-1">{l}</label>
                      <input className="input-field" type={t} value={filters[k]}
                        onChange={e => setFilter(k, e.target.value)} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Grid / List */}
      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(9).fill(0).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : orders.length === 0 ? (
              <div className="glass-card p-20 flex flex-col items-center justify-center gap-4 text-base-content/25">
                <FileSearch size={64} strokeWidth={0.7} />
                <p className="text-lg font-bold">No invoices found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <motion.div initial="hidden" animate="show" variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map(order => (
                  <InvoiceCard key={order._id} order={order} onView={setActiveInvoice} />
                ))}
              </motion.div>
            )}
            {!loading && orders.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button disabled={filters.page <= 1} onClick={() => setFilter('page', filters.page - 1)}
                  className="btn-secondary btn-sm flex items-center gap-1.5 disabled:opacity-30">
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="text-sm text-base-content/50 font-semibold">
                  {pagination?.page ?? 1} / {pagination?.pages ?? 1}
                </span>
                <button disabled={filters.page >= (pagination?.pages ?? 1)}
                  onClick={() => setFilter('page', filters.page + 1)}
                  className="btn-primary-cta btn-sm flex items-center gap-1.5 disabled:opacity-30">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {['Invoice No', 'Customer', 'Store', 'Items', 'Amount', 'Method', 'Payment', 'Delivery', 'Actions'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array(12).fill(0).map((_, i) => (
                      <tr key={i} className="border-b border-base-300">
                        {Array(9).fill(0).map((_, j) => (
                          <td key={j}><div className="skeleton h-4 rounded w-full" /></td>
                        ))}
                      </tr>
                    ))
                    : orders.length === 0
                      ? (
                        <tr><td colSpan={9}>
                          <div className="flex flex-col items-center justify-center py-20 gap-4 text-base-content/25">
                            <FileSearch size={56} strokeWidth={0.8} />
                            <p className="font-bold text-lg">No invoices</p>
                          </div>
                        </td></tr>
                      )
                      : orders.map((order, idx) => (
                        <motion.tr key={order._id}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }} className="group">
                          <td className="font-mono font-black text-primary text-xs">{order.orderId}</td>
                          <td>
                            <p className="font-semibold text-xs text-base-content">{order.customer?.name ?? '—'}</p>
                            <p className="text-xs text-base-content/40">{order.customer?.phone ?? ''}</p>
                          </td>
                          <td className="text-xs text-base-content/60">{order.store?.name ?? '—'}</td>
                          <td className="text-xs text-base-content/60">{order.items?.length ?? 0}</td>
                          <td className="font-black text-base-content">₹{order.billing?.totalPayable?.toLocaleString('en-IN') ?? '—'}</td>
                          <td className="text-xs text-base-content/60">{order.payment?.method ?? '—'}</td>
                          <td><PayBadge status={order.payment?.status} /></td>
                          <td><DelBadge status={order.delivery?.status} /></td>
                          <td>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => setActiveInvoice(order)}
                                className="btn-ghost btn-xs btn-circle text-primary" title="Preview">
                                <Eye size={14} />
                              </button>
                              <button onClick={() => generateAndPrintInvoice(order)}
                                className="btn-ghost btn-xs btn-circle text-success" title="Print">
                                <Printer size={14} />
                              </button>
                              <button onClick={() => generateAndPrintInvoice(order)}
                                className="btn-ghost btn-xs btn-circle text-secondary" title="Download">
                                <Download size={14} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={pagination} page={filters.page} onPage={p => setFilter('page', p)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {activeInvoice && <InvoiceModal order={activeInvoice} onClose={() => setActiveInvoice(null)} />}
      </AnimatePresence>
    </div>
  );
}