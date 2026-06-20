'use client';

/**
 * @file    Transactions.jsx
 * @desc    Superadmin Financial Transactions page
 *          — Pharmacy Orders | Bookings | Financial Ledger | Revenue Analytics
 *          — Invoice PDF download | Multi-tab | Filters | Pagination
 * @stack   Next.js · Redux Toolkit · Tailwind (global CSS) · Lucide · Framer Motion
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ShoppingBag, Calendar, Wallet,
  Download, Search, Filter, ChevronLeft, ChevronRight,
  RefreshCw, Eye, Receipt, ArrowUpRight, ArrowDownRight,
  IndianRupee, Package, Stethoscope, CreditCard, FileText,
  Clock, CheckCircle, XCircle, AlertCircle, BarChart3,
  SlidersHorizontal, X, ExternalLink, Loader2,
} from 'lucide-react';

import {
  fetchPharmacyOrders,
  fetchBookings,
  fetchFinancialLedger,
  fetchRevenueAnalytics,
  selectPharmacyOrders,
  selectBookings,
  selectFinancialLedger,
  selectRevenueAnalytics,
} from '@/store/slices/superadminSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview',    icon: BarChart3   },
  { id: 'pharmacy',  label: 'Pharmacy',    icon: Package     },
  { id: 'bookings',  label: 'Bookings',    icon: Stethoscope },
  { id: 'ledger',    label: 'Ledger',      icon: Wallet      },
];

const PAYMENT_STATUS_MAP = {
  Paid:                { label: 'Paid',             color: 'badge-success' },
  paid:                { label: 'Paid',             color: 'badge-success' },
  pay_at_service_paid: { label: 'Pay@Service',      color: 'badge-success' },
  Pending:             { label: 'Pending',          color: 'badge-warning' },
  pending:             { label: 'Pending',          color: 'badge-warning' },
  payment_pending:     { label: 'Payment Pending',  color: 'badge-warning' },
  Failed:              { label: 'Failed',           color: 'badge-error'   },
  failed:              { label: 'Failed',           color: 'badge-error'   },
  Refunded:            { label: 'Refunded',         color: 'badge-info'    },
  refunded:            { label: 'Refunded',         color: 'badge-info'    },
  Partially_Refunded:  { label: 'Part. Refunded',   color: 'badge-accent'  },
  COD:                 { label: 'COD',              color: 'badge-secondary'},
  unpaid:              { label: 'Unpaid',           color: 'badge-error'   },
};

const DELIVERY_STATUS_MAP = {
  Placed:           'badge-info',
  Confirmed:        'badge-primary',
  Processing:       'badge-warning',
  'Out-for-Delivery':'badge-accent',
  Delivered:        'badge-success',
  Cancelled:        'badge-error',
  Return_Requested: 'badge-warning',
  Return_Accepted:  'badge-info',
  Return_Rejected:  'badge-error',
  Returned:         'badge-secondary',
};

const BOOKING_STATUS_MAP = {
  pending:         'badge-warning',
  confirmed:       'badge-primary',
  in_progress:     'badge-accent',
  completed:       'badge-success',
  cancelled:       'badge-error',
  no_show:         'badge-error',
  refund_pending:  'badge-warning',
  refunded:        'badge-info',
  draft:           'badge-secondary',
};

const DATE_RANGES = [
  { label: 'Today',      days: 0  },
  { label: 'Last 7d',   days: 7  },
  { label: 'Last 30d',  days: 30 },
  { label: 'Last 90d',  days: 90 },
  { label: 'This Year', days: 365},
  { label: 'Custom',    days: -1 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const getDateRange = (days) => {
  const to = new Date();
  const from = days === 0
    ? new Date(to.toDateString())
    : new Date(Date.now() - days * 86400000);
  return {
    startDate: from.toISOString().split('T')[0],
    endDate:   to.toISOString().split('T')[0],
  };
};

/** Generate inline PDF-like invoice via browser print dialog */
const downloadInvoice = (data, type) => {
  const isPharmacy = type === 'pharmacy';
  const orderId    = isPharmacy ? data.orderId    : data.bookingCode;
  const total      = isPharmacy ? data.billing?.totalPayable : data.fareBreakdown?.totalAmount;
  const customer   = data.customer?.name ?? 'N/A';
  const date       = fmtDateTime(data.createdAt);
  const items      = isPharmacy
    ? (data.items ?? []).map(i => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${i.name}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">${i.quantity}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">₹${i.pricePerUnit}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">₹${i.totalPrice}</td></tr>`).join('')
    : `<tr><td style="padding:6px 8px">${data.bookingType?.replace(/_/g,' ')} — ${data.consultationType ?? ''}</td><td style="padding:6px 8px;text-align:center">1</td><td style="padding:6px 8px;text-align:right">₹${data.fareBreakdown?.consultationFee ?? 0}</td><td style="padding:6px 8px;text-align:right">₹${total}</td></tr>`;

  const html = `
  <!DOCTYPE html><html><head><title>Invoice ${orderId}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;color:#111827;padding:40px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #6366f1}
  .brand{font-size:22px;font-weight:800;color:#6366f1}.meta{text-align:right;font-size:13px;color:#6b7280}
  .meta strong{display:block;font-size:18px;font-weight:700;color:#111827;margin-bottom:4px}
  .section{margin-bottom:24px}.section h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:8px}
  table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:8px;font-size:12px;text-align:left;font-weight:600}
  .total-row td{padding:10px 8px;font-weight:700;font-size:15px;border-top:2px solid #6366f1}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
  @media print{body{padding:20px}}</style></head><body>
  <div class="hdr">
    <div><div class="brand">Likeson Health</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Tax Invoice</div></div>
    <div class="meta"><strong>${orderId}</strong><span>${date}</span></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px">
    <div class="section"><h3>Bill To</h3><strong>${customer}</strong><div style="font-size:13px;color:#6b7280">${data.customer?.email ?? ''}</div><div style="font-size:13px;color:#6b7280">${data.customer?.phone ?? ''}</div></div>
    <div class="section" style="text-align:right"><h3>Payment</h3><div style="font-size:13px">${isPharmacy ? data.payment?.method : data.payments?.[0]?.gateway ?? 'N/A'}</div><div style="font-size:13px;color:#16a34a;font-weight:600">${isPharmacy ? data.payment?.status : data.paymentStatus}</div></div>
  </div>
  <div class="section"><h3>Items</h3>
  <table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${items}</tbody>
  <tfoot><tr class="total-row"><td colspan="3" style="text-align:right">Total Payable</td><td style="text-align:right;color:#6366f1">₹${total}</td></tr></tfoot></table></div>
  ${isPharmacy && data.billing ? `<div style="font-size:12px;color:#6b7280;margin-top:8px">SubTotal: ₹${data.billing.subTotal} · GST: ₹${data.billing.gstAmount} · Delivery: ₹${data.billing.deliveryCharges} · Discount: ₹${data.billing.discountAmount}</div>` : ''}
  <div class="footer">Likeson Health Pvt. Ltd. · Vijayawada, Andhra Pradesh · GSTIN: XXXXXXXXXXXX · Generated ${new Date().toLocaleString('en-IN')}</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, icon: Icon, trend, trendVal, color = 'primary', delay = 0 }) => (
  <motion.div
    className="stat-card relative overflow-hidden"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: 'easeOut' }}
  >
    <div className={`absolute inset-0 opacity-5 bg-${color}`} />
    <div className="relative">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-${color}/10 border border-${color}/20`}>
          <Icon size={18} className={`text-${color}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trendVal ?? trend)}%
          </div>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="text-xs text-base-content/40 mt-1">{sub}</div>}
    </div>
  </motion.div>
);

const StatusBadge = ({ status, map }) => {
  const entry = map?.[status];
  return (
    <span className={`badge badge-xs ${entry?.color ?? 'badge-secondary'}`}>
      {entry?.label ?? status ?? '—'}
    </span>
  );
};

const EmptyState = ({ message = 'No records found' }) => (
  <motion.div
    className="flex flex-col items-center justify-center py-20 gap-4 text-base-content/30"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <FileText size={40} strokeWidth={1} />
    <span className="text-sm font-medium">{message}</span>
  </motion.div>
);

const TableSkeleton = ({ rows = 6, cols = 6 }) => (
  <div className="space-y-px">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-4 p-4 border-b border-base-300">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="skeleton h-4 flex-1 rounded" style={{ opacity: 1 - c * 0.12 }} />
        ))}
      </div>
    ))}
  </div>
);

const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-base-300 bg-base-200/40">
      <span className="text-xs text-base-content/50">{total} records · page {page} of {pages}</span>
      <div className="flex items-center gap-1">
        <button
          className="btn btn-ghost btn-sm btn-circle"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const pg = pages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= pages - 2 ? pages - 4 + i : page - 2 + i;
          return (
            <button
              key={pg}
              className={`btn btn-sm btn-circle text-xs ${pg === page ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onPageChange(pg)}
            >
              {pg}
            </button>
          );
        })}
        <button
          className="btn btn-ghost btn-sm btn-circle"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

// Detail Drawer
const DetailDrawer = ({ item, type, onClose }) => {
  if (!item) return null;
  const isPharmacy = type === 'pharmacy';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="flex-1 bg-neutral/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="w-full max-w-2xl bg-base-100 border-l border-base-300 flex flex-col overflow-hidden shadow-depth-lg"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-200/60 backdrop-blur-sm">
            <div>
              <div className="text-xs text-base-content/40 font-semibold uppercase tracking-wider mb-0.5">
                {isPharmacy ? 'Pharmacy Order' : 'Booking'} Detail
              </div>
              <div className="font-bold text-base-content font-montserrat">
                {isPharmacy ? item.orderId : item.bookingCode}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-sm btn-primary gap-2"
                onClick={() => downloadInvoice(item, type)}
              >
                <Download size={13} /> Invoice
              </button>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Customer */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">Customer</h3>
              <div className="card p-4 space-y-1.5">
                <div className="font-semibold">{item.customer?.name ?? '—'}</div>
                <div className="text-sm text-base-content/60">{item.customer?.email}</div>
                <div className="text-sm text-base-content/60">{item.customer?.phone}</div>
              </div>
            </section>

            {/* Status row */}
            <section className="grid grid-cols-2 gap-3">
              {isPharmacy ? (
                <>
                  <div className="stat-card !p-4 space-y-1">
                    <div className="stat-card-label">Payment</div>
                    <StatusBadge status={item.payment?.status} map={PAYMENT_STATUS_MAP} />
                  </div>
                  <div className="stat-card !p-4 space-y-1">
                    <div className="stat-card-label">Delivery</div>
                    <StatusBadge status={item.delivery?.status} map={Object.fromEntries(Object.entries(DELIVERY_STATUS_MAP).map(([k,v])=>([k,{label:k.replace(/_/g,' '),color:v}])))} />
                  </div>
                </>
              ) : (
                <>
                  <div className="stat-card !p-4 space-y-1">
                    <div className="stat-card-label">Booking Status</div>
                    <StatusBadge status={item.status} map={Object.fromEntries(Object.entries(BOOKING_STATUS_MAP).map(([k,v])=>([k,{label:k.replace(/_/g,' '),color:v}])))} />
                  </div>
                  <div className="stat-card !p-4 space-y-1">
                    <div className="stat-card-label">Payment</div>
                    <StatusBadge status={item.paymentStatus} map={PAYMENT_STATUS_MAP} />
                  </div>
                </>
              )}
            </section>

            {/* Financials */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">
                {isPharmacy ? 'Billing' : 'Fare Breakdown'}
              </h3>
              <div className="card p-4 divide-y divide-base-300">
                {isPharmacy ? (
                  <>
                    {[
                      ['Subtotal', item.billing?.subTotal],
                      ['GST', item.billing?.gstAmount],
                      ['Delivery', item.billing?.deliveryCharges],
                      ['Discount', item.billing?.discountAmount, true],
                      ['Wallet Applied', item.billing?.walletAmountUsed, true],
                    ].map(([label, val, neg]) => val > 0 ? (
                      <div key={label} className="flex justify-between py-2 text-sm">
                        <span className="text-base-content/60">{label}</span>
                        <span className={neg ? 'text-success' : ''}>{neg ? '-' : ''}{fmt(val)}</span>
                      </div>
                    ) : null)}
                    <div className="flex justify-between py-2.5 font-bold">
                      <span>Total Payable</span>
                      <span className="text-primary text-base">{fmt(item.billing?.totalPayable)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    {[
                      ['Consultation Fee', item.fareBreakdown?.consultationFee],
                      ['Care Assistant', item.fareBreakdown?.careAssistantFee],
                      ['Transport', item.fareBreakdown?.transportFee],
                      ['Diagnostic', item.fareBreakdown?.diagnosticFee],
                      ['Platform Fee', item.fareBreakdown?.platformFee],
                      ['Taxes', item.fareBreakdown?.taxes],
                      ['Discount', item.fareBreakdown?.discount, true],
                      ['Wallet Applied', item.fareBreakdown?.walletApplied, true],
                    ].map(([label, val, neg]) => val > 0 ? (
                      <div key={label} className="flex justify-between py-2 text-sm">
                        <span className="text-base-content/60">{label}</span>
                        <span className={neg ? 'text-success' : ''}>{neg ? '-' : ''}{fmt(val)}</span>
                      </div>
                    ) : null)}
                    <div className="flex justify-between py-2.5 font-bold">
                      <span>Amount Paid</span>
                      <span className="text-primary text-base">{fmt(item.fareBreakdown?.amountPaid)}</span>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Items (pharmacy only) */}
            {isPharmacy && item.items?.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">Items</h3>
                <div className="card overflow-hidden">
                  {item.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border-b border-base-300 last:border-0 hover:bg-base-200/50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Package size={14} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{it.name}</div>
                        <div className="text-xs text-base-content/50">{it.genericName} · x{it.quantity}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-sm">{fmt(it.totalPrice)}</div>
                        <div className="text-xs text-base-content/40">{fmt(it.pricePerUnit)} ea</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Booking meta (bookings only) */}
            {!isPharmacy && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">Details</h3>
                <div className="card p-4 grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Type', item.bookingType?.replace(/_/g, ' ')],
                    ['Consult Mode', item.consultationType ?? '—'],
                    ['Scheduled', fmtDateTime(item.scheduledAt)],
                    ['Completed', fmtDateTime(item.completedAt)],
                    ['Doctor', item.doctorSnapshot?.name ?? '—'],
                    ['Specialization', item.doctorSnapshot?.specialization ?? '—'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-base-content/40 text-xs mb-0.5">{k}</div>
                      <div className="font-medium capitalize">{v}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="text-xs text-base-content/30 text-center pt-2">
              Created {fmtDateTime(item.createdAt)}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Filter Panel ─────────────────────────────────────────────────────────────

const FilterPanel = ({ filters, onChange, onReset, type }) => {
  const isPharmacy = type === 'pharmacy';
  const isBooking  = type === 'bookings';
  const isLedger   = type === 'ledger';

  return (
    <motion.div
      className="card p-4 mb-4 border border-primary/10 bg-primary/5"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="label-text text-xs mb-1 block">Start Date</label>
          <input type="date" className="input-field text-sm h-9"
            value={filters.startDate ?? ''} onChange={e => onChange('startDate', e.target.value)} />
        </div>
        <div>
          <label className="label-text text-xs mb-1 block">End Date</label>
          <input type="date" className="input-field text-sm h-9"
            value={filters.endDate ?? ''} onChange={e => onChange('endDate', e.target.value)} />
        </div>

        {(isPharmacy || isLedger) && (
          <div>
            <label className="label-text text-xs mb-1 block">Payment Status</label>
            <select className="input-field text-sm h-9"
              value={filters.paymentStatus ?? ''} onChange={e => onChange('paymentStatus', e.target.value)}>
              <option value="">All</option>
              {isPharmacy
                ? ['Pending','Paid','Failed','Refunded','Partially_Refunded'].map(s => <option key={s}>{s}</option>)
                : ['Credit','Debit'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {isPharmacy && (
          <div>
            <label className="label-text text-xs mb-1 block">Delivery Status</label>
            <select className="input-field text-sm h-9"
              value={filters.deliveryStatus ?? ''} onChange={e => onChange('deliveryStatus', e.target.value)}>
              <option value="">All</option>
              {['Placed','Confirmed','Processing','Out-for-Delivery','Delivered','Cancelled','Returned'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}

        {isBooking && (
          <>
            <div>
              <label className="label-text text-xs mb-1 block">Status</label>
              <select className="input-field text-sm h-9"
                value={filters.status ?? ''} onChange={e => onChange('status', e.target.value)}>
                <option value="">All</option>
                {['pending','confirmed','in_progress','completed','cancelled','refunded'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text text-xs mb-1 block">Booking Type</label>
              <select className="input-field text-sm h-9"
                value={filters.bookingType ?? ''} onChange={e => onChange('bookingType', e.target.value)}>
                <option value="">All</option>
                {['full_care_ride','doctor_consultation','doctor_online','care_assistant','diagnostic_center','diagnostic_home','patient_transport'].map(s => <option key={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </>
        )}

        {isLedger && (
          <div>
            <label className="label-text text-xs mb-1 block">Purpose</label>
            <select className="input-field text-sm h-9"
              value={filters.purpose ?? ''} onChange={e => onChange('purpose', e.target.value)}>
              <option value="">All</option>
              {['Refund','Booking_Payment','Pharmacy_Payment','Admin_Credit','Admin_Debit','Withdrawal'].map(s => <option key={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
          </div>
        )}

        <div className="flex items-end">
          <button className="btn btn-ghost btn-sm w-full gap-2 text-error" onClick={onReset}>
            <X size={13} /> Reset
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Revenue Overview Chart (bar, CSS-only) ───────────────────────────────────
const MiniBarChart = ({ data = [] }) => {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.revenue ?? 0), 1);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full rounded-t-sm transition-all duration-500 relative cursor-pointer"
            style={{
              height: `${Math.round((d.revenue / max) * 80)}px`,
              background: 'linear-gradient(180deg, var(--primary) 0%, var(--secondary) 100%)',
              opacity: 0.7 + (d.revenue / max) * 0.3,
            }}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral text-neutral-content text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
              {fmt(d.revenue)}
            </div>
          </div>
          <span className="text-xs text-base-content/30">{months[(d.month ?? 1) - 1]?.slice(0,1)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Transactions() {
  const dispatch = useDispatch();

  const pharmacyOrders  = useSelector(selectPharmacyOrders);
  const bookings        = useSelector(selectBookings);
  const ledger          = useSelector(selectFinancialLedger);
  const revenue         = useSelector(selectRevenueAnalytics);

  const [activeTab,    setActiveTab]    = useState('overview');
  const [showFilters,  setShowFilters]  = useState(false);
  const [search,       setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRange, setSelectedRange] = useState(1); // Last 7d index
  const [drawerItem,   setDrawerItem]   = useState(null);
  const [drawerType,   setDrawerType]   = useState(null);
  const searchTimer = useRef(null);

  const [pharmacyFilters, setPharmacyFilters] = useState({});
  const [bookingFilters,  setBookingFilters]  = useState({});
  const [ledgerFilters,   setLedgerFilters]   = useState({});
  const [pharmacyPage,    setPharmacyPage]    = useState(1);
  const [bookingPage,     setBookingPage]     = useState(1);
  const [ledgerPage,      setLedgerPage]      = useState(1);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Fetch revenue on mount
  useEffect(() => {
    const { startDate, endDate } = getDateRange(DATE_RANGES[selectedRange].days);
    dispatch(fetchRevenueAnalytics({ startDate, endDate }));
  }, [selectedRange, dispatch]);

  // Fetch tab data
  useEffect(() => {
    if (activeTab === 'pharmacy' || activeTab === 'overview') {
      dispatch(fetchPharmacyOrders({ page: pharmacyPage, limit: 20, search: debouncedSearch, ...pharmacyFilters }));
    }
    if (activeTab === 'bookings' || activeTab === 'overview') {
      dispatch(fetchBookings({ page: bookingPage, limit: 20, search: debouncedSearch, ...bookingFilters }));
    }
    if (activeTab === 'ledger') {
      dispatch(fetchFinancialLedger({ page: ledgerPage, limit: 20, ...ledgerFilters }));
    }
  }, [activeTab, pharmacyPage, bookingPage, ledgerPage, debouncedSearch, pharmacyFilters, bookingFilters, ledgerFilters, dispatch]);

  const handleFilterChange = useCallback((tab, key, val) => {
    const setter = tab === 'pharmacy' ? setPharmacyFilters : tab === 'bookings' ? setBookingFilters : setLedgerFilters;
    setter(prev => ({ ...prev, [key]: val || undefined }));
  }, []);

  const handleFilterReset = useCallback((tab) => {
    if (tab === 'pharmacy') { setPharmacyFilters({}); setPharmacyPage(1); }
    if (tab === 'bookings')  { setBookingFilters({});  setBookingPage(1);  }
    if (tab === 'ledger')    { setLedgerFilters({});   setLedgerPage(1);   }
  }, []);

  const rev = revenue.data?.revenue ?? {};
  const grandTotal = rev.grandTotal ?? 0;

  // ── Render ──

  return (
    <div data-theme="superadmin" className="min-h-screen bg-base-100">
      {/* Page Header */}
      <div className="border-b border-base-300 bg-base-200/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-montserrat font-extrabold text-base-content tracking-tight leading-none">
              Transactions
            </h1>
            <p className="text-xs text-base-content/40 mt-0.5">Platform-wide financial activity</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Date range pills */}
            <div className="flex items-center gap-1 bg-base-300/60 rounded-xl p-1">
              {DATE_RANGES.slice(0, 5).map((r, i) => (
                <button
                  key={r.label}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 ${selectedRange === i ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'}`}
                  onClick={() => setSelectedRange(i)}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => {
                const { startDate, endDate } = getDateRange(DATE_RANGES[selectedRange].days);
                dispatch(fetchRevenueAnalytics({ startDate, endDate }));
                if (activeTab === 'pharmacy') dispatch(fetchPharmacyOrders({ page: pharmacyPage, ...pharmacyFilters }));
                if (activeTab === 'bookings') dispatch(fetchBookings({ page: bookingPage, ...bookingFilters }));
              }}
            >
              <RefreshCw size={14} className={revenue.loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={fmt(grandTotal)}
            icon={IndianRupee}
            color="primary"
            delay={0}
          />
          <StatCard
            label="Pharmacy Revenue"
            value={fmt(rev.pharmacy?.total)}
            sub={`${rev.pharmacy?.count ?? 0} orders`}
            icon={Package}
            color="success"
            delay={0.05}
          />
          <StatCard
            label="Booking Revenue"
            value={fmt(rev.bookings?.total)}
            sub={`${rev.bookings?.count ?? 0} bookings`}
            icon={Stethoscope}
            color="accent"
            delay={0.1}
          />
          <StatCard
            label="Subscription Revenue"
            value={fmt(rev.subscription?.total)}
            sub={`${rev.subscription?.count ?? 0} payments`}
            icon={CreditCard}
            color="secondary"
            delay={0.15}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-base-300">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-200 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-base-content/40 hover:text-base-content'
              }`}
              onClick={() => { setActiveTab(tab.id); setSearch(''); }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Revenue timeline chart */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-montserrat font-bold text-base">Subscription Revenue Timeline</h2>
                    <p className="text-xs text-base-content/40 mt-0.5">Monthly payments · last 12 months</p>
                  </div>
                  <BarChart3 size={18} className="text-primary/50" />
                </div>
                {revenue.loading ? (
                  <div className="h-24 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-primary/40" />
                  </div>
                ) : (
                  <MiniBarChart data={[]} />
                )}
              </div>

              {/* Recent pharmacy */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-base-300 flex items-center justify-between">
                  <h2 className="font-montserrat font-bold text-sm">Recent Pharmacy Orders</h2>
                  <button className="btn btn-ghost btn-xs gap-1" onClick={() => setActiveTab('pharmacy')}>
                    View All <ArrowUpRight size={11} />
                  </button>
                </div>
                {pharmacyOrders.loading ? <TableSkeleton rows={4} cols={5} /> : (
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead><tr><th>Order ID</th><th>Customer</th><th>Amount</th><th>Payment</th><th>Delivery</th><th></th></tr></thead>
                      <tbody>
                        {(pharmacyOrders.data ?? []).slice(0, 5).map(o => (
                          <tr key={o._id}>
                            <td className="font-mono text-xs text-primary">{o.orderId}</td>
                            <td>
                              <div className="font-medium text-sm">{o.customer?.name ?? '—'}</div>
                              <div className="text-xs text-base-content/40">{fmtDate(o.createdAt)}</div>
                            </td>
                            <td className="font-semibold">{fmt(o.billing?.totalPayable)}</td>
                            <td><StatusBadge status={o.payment?.status} map={PAYMENT_STATUS_MAP} /></td>
                            <td><span className={`badge badge-xs ${DELIVERY_STATUS_MAP[o.delivery?.status] ?? 'badge-secondary'}`}>{o.delivery?.status}</span></td>
                            <td>
                              <button className="btn btn-ghost btn-xs btn-circle" onClick={() => { setDrawerItem(o); setDrawerType('pharmacy'); }}>
                                <Eye size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!pharmacyOrders.data?.length && <EmptyState message="No pharmacy orders" />}
                  </div>
                )}
              </div>

              {/* Recent bookings */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-base-300 flex items-center justify-between">
                  <h2 className="font-montserrat font-bold text-sm">Recent Bookings</h2>
                  <button className="btn btn-ghost btn-xs gap-1" onClick={() => setActiveTab('bookings')}>
                    View All <ArrowUpRight size={11} />
                  </button>
                </div>
                {bookings.loading ? <TableSkeleton rows={4} cols={5} /> : (
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead><tr><th>Code</th><th>Customer</th><th>Type</th><th>Amount Paid</th><th>Status</th><th></th></tr></thead>
                      <tbody>
                        {(bookings.data ?? []).slice(0, 5).map(b => (
                          <tr key={b._id}>
                            <td className="font-mono text-xs text-primary">{b.bookingCode}</td>
                            <td>
                              <div className="font-medium text-sm">{b.customer?.name ?? '—'}</div>
                              <div className="text-xs text-base-content/40">{fmtDate(b.scheduledAt)}</div>
                            </td>
                            <td className="text-xs capitalize">{b.bookingType?.replace(/_/g,' ')}</td>
                            <td className="font-semibold">{fmt(b.fareBreakdown?.amountPaid)}</td>
                            <td><StatusBadge status={b.status} map={Object.fromEntries(Object.entries(BOOKING_STATUS_MAP).map(([k,v])=>([k,{label:k.replace(/_/g,' '),color:v}])))} /></td>
                            <td>
                              <button className="btn btn-ghost btn-xs btn-circle" onClick={() => { setDrawerItem(b); setDrawerType('booking'); }}>
                                <Eye size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!bookings.data?.length && <EmptyState message="No bookings" />}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── PHARMACY TAB ── */}
          {activeTab === 'pharmacy' && (
            <motion.div key="pharmacy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                  <input className="input-field pl-9 h-9 text-sm" placeholder="Search by order ID…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button
                  className={`btn btn-sm gap-2 ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setShowFilters(p => !p)}
                >
                  <SlidersHorizontal size={13} /> Filters
                  {Object.keys(pharmacyFilters).length > 0 && (
                    <span className="badge badge-xs badge-primary">{Object.keys(pharmacyFilters).length}</span>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <FilterPanel
                    filters={pharmacyFilters}
                    onChange={(k, v) => handleFilterChange('pharmacy', k, v)}
                    onReset={() => handleFilterReset('pharmacy')}
                    type="pharmacy"
                  />
                )}
              </AnimatePresence>

              <div className="card overflow-hidden">
                {pharmacyOrders.loading ? <TableSkeleton rows={8} cols={7} /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Store</th>
                            <th>Items</th>
                            <th>Amount</th>
                            <th>Payment</th>
                            <th>Delivery</th>
                            <th>Date</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pharmacyOrders.data ?? []).map(o => (
                            <tr key={o._id} className="cursor-pointer" onClick={() => { setDrawerItem(o); setDrawerType('pharmacy'); }}>
                              <td className="font-mono text-xs font-semibold text-primary">{o.orderId}</td>
                              <td>
                                <div className="font-medium text-sm whitespace-nowrap">{o.customer?.name ?? '—'}</div>
                                <div className="text-xs text-base-content/40">{o.customer?.phone}</div>
                              </td>
                              <td className="text-xs text-base-content/60">{o.store?.storeName ?? '—'}</td>
                              <td>
                                <span className="badge badge-xs badge-secondary">{o.items?.length ?? 0} items</span>
                              </td>
                              <td className="font-bold whitespace-nowrap">{fmt(o.billing?.totalPayable)}</td>
                              <td><StatusBadge status={o.payment?.status} map={PAYMENT_STATUS_MAP} /></td>
                              <td>
                                <span className={`badge badge-xs ${DELIVERY_STATUS_MAP[o.delivery?.status] ?? 'badge-secondary'}`}>
                                  {o.delivery?.status?.replace(/_/g,' ') ?? '—'}
                                </span>
                              </td>
                              <td className="text-xs text-base-content/40 whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                              <td onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <button className="btn btn-ghost btn-xs btn-circle" onClick={() => { setDrawerItem(o); setDrawerType('pharmacy'); }}>
                                    <Eye size={12} />
                                  </button>
                                  <button className="btn btn-ghost btn-xs btn-circle text-primary" onClick={() => downloadInvoice(o, 'pharmacy')}>
                                    <Download size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!pharmacyOrders.data?.length && <EmptyState message="No pharmacy orders match your filters" />}
                    </div>
                    <Pagination pagination={pharmacyOrders.pagination} onPageChange={setPharmacyPage} />
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* ── BOOKINGS TAB ── */}
          {activeTab === 'bookings' && (
            <motion.div key="bookings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                  <input className="input-field pl-9 h-9 text-sm" placeholder="Search by booking code…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button
                  className={`btn btn-sm gap-2 ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setShowFilters(p => !p)}
                >
                  <SlidersHorizontal size={13} /> Filters
                  {Object.keys(bookingFilters).length > 0 && (
                    <span className="badge badge-xs badge-primary">{Object.keys(bookingFilters).length}</span>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <FilterPanel
                    filters={bookingFilters}
                    onChange={(k, v) => handleFilterChange('bookings', k, v)}
                    onReset={() => handleFilterReset('bookings')}
                    type="bookings"
                  />
                )}
              </AnimatePresence>

              <div className="card overflow-hidden">
                {bookings.loading ? <TableSkeleton rows={8} cols={7} /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Patient</th>
                            <th>Type</th>
                            <th>Doctor</th>
                            <th>Scheduled</th>
                            <th>Amount</th>
                            <th>Payment</th>
                            <th>Status</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(bookings.data ?? []).map(b => (
                            <tr key={b._id} className="cursor-pointer" onClick={() => { setDrawerItem(b); setDrawerType('booking'); }}>
                              <td className="font-mono text-xs font-semibold text-primary">{b.bookingCode}</td>
                              <td>
                                <div className="font-medium text-sm whitespace-nowrap">{b.customer?.name ?? b.patientInfo?.name ?? '—'}</div>
                                <div className="text-xs text-base-content/40">{b.customer?.phone}</div>
                              </td>
                              <td>
                                <span className="text-xs capitalize whitespace-nowrap">{b.bookingType?.replace(/_/g,' ') ?? '—'}</span>
                              </td>
                              <td className="text-xs text-base-content/60">{b.doctorSnapshot?.name ?? '—'}</td>
                              <td className="text-xs text-base-content/50 whitespace-nowrap">{fmtDate(b.scheduledAt)}</td>
                              <td className="font-bold whitespace-nowrap">{fmt(b.fareBreakdown?.amountPaid)}</td>
                              <td><StatusBadge status={b.paymentStatus} map={PAYMENT_STATUS_MAP} /></td>
                              <td>
                                <StatusBadge
                                  status={b.status}
                                  map={Object.fromEntries(Object.entries(BOOKING_STATUS_MAP).map(([k,v])=>([k,{label:k.replace(/_/g,' '),color:v}])))}
                                />
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <button className="btn btn-ghost btn-xs btn-circle" onClick={() => { setDrawerItem(b); setDrawerType('booking'); }}>
                                    <Eye size={12} />
                                  </button>
                                  <button className="btn btn-ghost btn-xs btn-circle text-primary" onClick={() => downloadInvoice(b, 'booking')}>
                                    <Download size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!bookings.data?.length && <EmptyState message="No bookings match your filters" />}
                    </div>
                    <Pagination pagination={bookings.pagination} onPageChange={setBookingPage} />
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* ── LEDGER TAB ── */}
          {activeTab === 'ledger' && (
            <motion.div key="ledger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  className={`btn btn-sm gap-2 ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setShowFilters(p => !p)}
                >
                  <Filter size={13} /> Filters
                  {Object.keys(ledgerFilters).length > 0 && (
                    <span className="badge badge-xs badge-primary">{Object.keys(ledgerFilters).length}</span>
                  )}
                </button>

                {/* Ledger summary badges */}
                {(ledger.summary ?? []).map(s => (
                  <div key={s._id} className={`badge ${s._id === 'Credit' ? 'badge-success' : 'badge-error'} gap-1.5`}>
                    {s._id === 'Credit' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {s._id} · {fmt(s.totalAmount)} ({s.count})
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {showFilters && (
                  <FilterPanel
                    filters={ledgerFilters}
                    onChange={(k, v) => handleFilterChange('ledger', k, v)}
                    onReset={() => handleFilterReset('ledger')}
                    type="ledger"
                  />
                )}
              </AnimatePresence>

              <div className="card overflow-hidden">
                {ledger.loading ? <TableSkeleton rows={8} cols={6} /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Type</th>
                            <th>Purpose</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Wallet Balance</th>
                            <th>Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(ledger.data ?? []).map((entry, i) => {
                            const txn = entry.transaction ?? {};
                            const isCredit = txn.type === 'Credit';
                            return (
                              <tr key={`${entry.walletId}-${i}`}>
                                <td>
                                  <div className="font-medium text-sm">{entry.userId?.name ?? '—'}</div>
                                  <div className="text-xs text-base-content/40">{entry.userId?.email}</div>
                                </td>
                                <td>
                                  <div className={`flex items-center gap-1.5 font-semibold text-sm ${isCredit ? 'text-success' : 'text-error'}`}>
                                    {isCredit ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    {txn.type}
                                  </div>
                                </td>
                                <td className="text-xs text-base-content/60">{txn.purpose?.replace(/_/g,' ') ?? '—'}</td>
                                <td className={`font-bold whitespace-nowrap ${isCredit ? 'text-success' : 'text-error'}`}>
                                  {isCredit ? '+' : '-'}{fmt(txn.amount)}
                                </td>
                                <td>
                                  <span className={`badge badge-xs ${txn.status === 'Success' ? 'badge-success' : txn.status === 'Failed' ? 'badge-error' : 'badge-warning'}`}>
                                    {txn.status}
                                  </span>
                                </td>
                                <td className="font-mono text-xs">{fmt(entry.balance)}</td>
                                <td className="text-xs text-base-content/40 whitespace-nowrap">{fmtDateTime(txn.timestamp)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!ledger.data?.length && <EmptyState message="No ledger entries match your filters" />}
                    </div>
                    <Pagination pagination={ledger.pagination} onPageChange={setLedgerPage} />
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {drawerItem && (
          <DetailDrawer
            item={drawerItem}
            type={drawerType}
            onClose={() => { setDrawerItem(null); setDrawerType(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}