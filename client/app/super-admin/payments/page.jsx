'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  ComposedChart, Line
} from 'recharts';
import {
  CreditCard, IndianRupee, TrendingUp, TrendingDown,
  ArrowDownCircle, RefreshCw, Download, Search, Filter,
  CheckCircle2, XCircle, Clock, AlertTriangle, ChevronLeft,
  ChevronRight, Eye, RotateCcw, Wallet, ReceiptText,
  Zap, Banknote, X, Loader2, Activity, BarChart2,
  User, Calendar, ArrowUpRight, ShieldAlert, PieChart as PieIcon,
  Layers, Star
} from 'lucide-react';
import {
  fetchPharmacyOrders,
  fetchFinancialLedger,
  fetchBillingSummary,
  fetchAuditLogs,
  fetchUserWallet,
  adjustUserWallet,
  processOrderRefund,
  selectPharmacyOrders,
  selectFinancialLedger,
  selectBillingAnalytics,
  selectAuditLogs,
  selectRefundState,
  selectWalletDetail,
  selectWalletAdjust,
  clearWalletDetail,
} from '@/store/slices/superadminSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Refunded'];
const TABS = [
  { key: 'orders',   label: 'Orders',   icon: CreditCard },
  { key: 'ledger',   label: 'Ledger',   icon: Layers },
  { key: 'billing',  label: 'Billing',  icon: PieIcon },
  { key: 'audit',    label: 'Audit',    icon: ShieldAlert },
  { key: 'wallet',   label: 'Wallet',   icon: Wallet },
  { key: 'analytics',label: 'Analytics',icon: BarChart2 },
];

const STATUS_META = {
  Pending:  { cls: 'badge-warning', icon: Clock },
  Paid:     { cls: 'badge-success', icon: CheckCircle2 },
  Failed:   { cls: 'badge-error',   icon: XCircle },
  Refunded: { cls: 'badge-info',    icon: RotateCcw },
  Active:   { cls: 'badge-success', icon: CheckCircle2 },
  Expired:  { cls: 'badge-error',   icon: XCircle },
  Cancelled:{ cls: 'badge-error',   icon: XCircle },
  Paused:   { cls: 'badge-warning', icon: Clock },
};

const METHOD_META = {
  Razorpay: { icon: CreditCard, cls: 'text-primary' },
  Wallet:   { icon: Wallet,     cls: 'text-secondary' },
  COD:      { icon: Banknote,   cls: 'text-accent' },
};

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
];

const fadeUp  = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

// ─── Receipt Printer ──────────────────────────────────────────────────────────

const printPaymentReceipt = (order) => {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Receipt – ${order.orderId}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',sans-serif;color:#0f172a;padding:48px;background:#fff;max-width:480px;margin:0 auto;}
    .top{text-align:center;margin-bottom:32px;}
    .logo{font-size:22px;font-weight:900;color:#2563eb;letter-spacing:-0.5px;}
    .logo span{color:#0ea5e9;}
    .seal{width:72px;height:72px;background:linear-gradient(135deg,#16a34a,#22c55e);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:20px auto 16px;}
    .seal svg{width:36px;height:36px;fill:none;stroke:#fff;stroke-width:3;}
    .amt{font-size:38px;font-weight:900;color:#0f172a;margin-bottom:4px;}
    .sublabel{font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;}
    .divider{border:none;border-top:1px dashed #e2e8f0;margin:24px 0;}
    .row{display:flex;justify-content:space-between;padding:8px 0;font-size:13px;}
    .row span{color:#64748b;}.row strong{color:#0f172a;font-weight:700;}
    .badge{display:inline-block;padding:3px 12px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.5px;}
    .paid{background:#dcfce7;color:#166534;}.pending{background:#fef9c3;color:#854d0e;}.failed{background:#fee2e2;color:#991b1b;}.refunded{background:#dbeafe;color:#1e40af;}
    .footer{text-align:center;margin-top:32px;font-size:11px;color:#94a3b8;padding-top:20px;border-top:1px solid #f1f5f9;}
  </style></head><body>
  <div class="top">
    <div class="logo">Likeson<span>Health</span></div>
    <div class="seal"><svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <p class="sublabel">Payment Receipt</p>
    <p class="amt">₹${order.billing?.totalPayable?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
    <span class="badge ${(order.payment?.status ?? '').toLowerCase()}">${order.payment?.status ?? 'N/A'}</span>
  </div>
  <hr class="divider"/>
  <div class="row"><span>Order ID</span><strong style="font-family:monospace;font-size:12px">${order.orderId}</strong></div>
  <div class="row"><span>Customer</span><strong>${order.customer?.name ?? '—'}</strong></div>
  <div class="row"><span>Method</span><strong>${order.payment?.method ?? '—'}</strong></div>
  ${order.payment?.razorpayPaymentId ? `<div class="row"><span>Razorpay ID</span><strong style="font-family:monospace;font-size:11px">${order.payment.razorpayPaymentId}</strong></div>` : ''}
  <div class="row"><span>Date</span><strong>${order.payment?.paidAt ? new Date(order.payment.paidAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' }) : '—'}</strong></div>
  <hr class="divider"/>
  <div class="row"><span>Subtotal</span><strong>₹${(order.billing?.subTotal ?? 0).toFixed(2)}</strong></div>
  <div class="row"><span>GST</span><strong>₹${(order.billing?.gstAmount ?? 0).toFixed(2)}</strong></div>
  <div class="row"><span>Delivery</span><strong>₹${(order.billing?.deliveryCharges ?? 0).toFixed(2)}</strong></div>
  <div class="row"><span>Platform Fee</span><strong>₹${(order.billing?.platformFee ?? 0).toFixed(2)}</strong></div>
  ${order.billing?.discountAmount ? `<div class="row"><span>Discount</span><strong style="color:#16a34a">-₹${order.billing.discountAmount.toFixed(2)}</strong></div>` : ''}
  <div class="row" style="font-size:15px;font-weight:900;border-top:2px solid #e2e8f0;padding-top:12px;margin-top:4px;"><span>Total Paid</span><strong style="color:#2563eb">₹${(order.billing?.totalPayable ?? 0).toFixed(2)}</strong></div>
  <div class="footer"><p>Thank you for choosing LikesonHealth</p><p style="margin-top:4px">support@likesonhealth.com · System-generated receipt</p></div>
  </body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 500);
};

// ─── Shared UI Atoms ──────────────────────────────────────────────────────────

const ChartTooltip = memo(({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 shadow-depth border-base-300">
      <p className="font-black text-base-content text-xs mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs mb-0.5" style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.name.includes('₹')
            ? `₹${p.value.toLocaleString('en-IN')}`
            : p.value}</strong>
        </p>
      ))}
    </div>
  );
});
ChartTooltip.displayName = 'ChartTooltip';

const StatCard = memo(({ title, value, sub, icon: Icon, colorVar, trendVal }) => (
  <motion.div variants={fadeUp} whileHover={{ y: -3, transition: { duration: 0.2 } }}
    className="glass-card p-5 flex flex-col gap-3 cursor-default">
    <div className="flex items-start justify-between">
      <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">{title}</p>
      <div className="p-2.5 rounded-xl bg-primary/10">
        <Icon size={17} className={colorVar} />
      </div>
    </div>
    <motion.p className="text-2xl font-black text-base-content"
      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'backOut' }}>
      {value}
    </motion.p>
    {sub && <p className="text-xs text-base-content/40">{sub}</p>}
    {trendVal != null && (
      <div className={`flex items-center gap-1 text-xs font-bold ${trendVal >= 0 ? 'text-success' : 'text-error'}`}>
        {trendVal >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {Math.abs(trendVal)}% vs last period
      </div>
    )}
  </motion.div>
));
StatCard.displayName = 'StatCard';

const PaymentBadge = memo(({ status }) => {
  const { cls, icon: Icon } = STATUS_META[status] ?? { cls: 'badge-info', icon: Clock };
  return <span className={`badge ${cls} gap-1`}><Icon size={10} />{status}</span>;
});
PaymentBadge.displayName = 'PaymentBadge';

const MethodBadge = memo(({ method }) => {
  const { icon: Icon, cls } = METHOD_META[method] ?? { icon: CreditCard, cls: 'text-primary' };
  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold ${cls}`}>
      <Icon size={12} /> {method}
    </div>
  );
});
MethodBadge.displayName = 'MethodBadge';

const SectionHeading = ({ icon: Icon, title, badge }) => (
  <div className="flex items-center gap-2 mb-5">
    <Icon size={16} className="text-primary" />
    <h3 className="font-bold text-sm text-base-content">{title}</h3>
    {badge && <span className="badge badge-info ml-auto text-xs">{badge}</span>}
  </div>
);

const SkeletonRow = ({ cols = 8 }) => (
  <tr className="border-b border-base-300">
    {Array(cols).fill(0).map((_, i) => (
      <td key={i} className="py-4 px-4"><div className="skeleton h-4 rounded w-full" /></td>
    ))}
  </tr>
);

const EmptyState = ({ icon: Icon, message, sub }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-4 text-base-content/25">
    <Icon size={60} strokeWidth={0.7} />
    <p className="text-lg font-bold">{message}</p>
    {sub && <p className="text-sm">{sub}</p>}
  </div>
);

const Pagination = ({ pagination, page, onPage }) => {
  if (pagination.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-base-300 bg-base-200/30">
      <p className="text-xs text-base-content/40">
        Page {pagination.page} of {pagination.pages} · {pagination.total?.toLocaleString()} total
      </p>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="btn-secondary btn-sm disabled:opacity-30"><ChevronLeft size={14} /></button>
        <button disabled={page >= pagination.pages} onClick={() => onPage(page + 1)}
          className="btn-secondary btn-sm disabled:opacity-30"><ChevronRight size={14} /></button>
      </div>
    </div>
  );
};

// ─── Refund Modal ─────────────────────────────────────────────────────────────

const RefundModal = memo(({ order, onClose }) => {
  const dispatch = useDispatch();
  const { processing } = useSelector(selectRefundState);
  const [form, setForm] = useState({
    amount: order?.billing?.totalPayable ?? '',
    reason: '',
    method: 'Wallet',
  });

  const handleSubmit = useCallback(async () => {
    if (!form.amount || !form.reason) return;
    await dispatch(processOrderRefund({ orderId: order.orderId, refundData: form }));
    onClose();
  }, [dispatch, form, order, onClose]);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <motion.div className="glass-card relative w-full max-w-md p-7 z-10"
        initial={{ scale: 0.9, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 24 }}
        transition={{ type: 'spring', damping: 26 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-base-content flex items-center gap-2">
              <RotateCcw size={20} className="text-info" /> Initiate Refund
            </h3>
            <p className="text-xs text-base-content/40 mt-1 font-mono">{order.orderId}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm btn-circle"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label-text mb-1.5 block">Refund Amount (₹)</label>
            <input className="input-field" type="number" value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              placeholder={`Max: ₹${order.billing?.totalPayable}`} />
          </div>
          <div>
            <label className="label-text mb-1.5 block">Refund Method</label>
            <select className="input-field" value={form.method}
              onChange={e => setForm(p => ({ ...p, method: e.target.value }))}>
              <option value="Wallet">Wallet (Instant)</option>
              <option value="Original_Source">Original Source</option>
              <option value="Bank_Transfer">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="label-text mb-1.5 block">Reason</label>
            <textarea className="input-field resize-none" rows={3} value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Reason for this refund…" />
          </div>
          <div className="alert alert-warning text-xs">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>This action is <strong>irreversible</strong>. Confirm before proceeding.</span>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-success flex-1 flex items-center justify-center gap-2"
            onClick={handleSubmit}
            disabled={processing || !form.amount || !form.reason}>
            {processing ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            {processing ? 'Processing…' : 'Process Refund'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
RefundModal.displayName = 'RefundModal';

// ─── Payment Drawer ───────────────────────────────────────────────────────────

const PaymentDrawer = memo(({ order, onClose }) => {
  if (!order) return null;
  const logs = order.payment?.transactionLog ?? [];
  return (
    <motion.div className="fixed inset-0 z-50 flex"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto shadow-depth-lg bg-base-100"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}>
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-base-300 flex items-center justify-between bg-base-200/80 backdrop-blur-strong">
          <div>
            <p className="font-black text-base-content">{order.orderId}</p>
            <p className="text-xs text-base-content/40">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => printPaymentReceipt(order)} className="btn-primary-cta btn-sm flex items-center gap-1.5">
              <ReceiptText size={13} /> Receipt
            </button>
            <button onClick={onClose} className="btn-ghost btn-sm btn-circle"><X size={18} /></button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="glass-card p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Total Amount</p>
            <p className="text-4xl font-black text-base-content">
              ₹{order.billing?.totalPayable?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <PaymentBadge status={order.payment?.status} />
              <MethodBadge method={order.payment?.method} />
            </div>
          </div>
          <div className="glass-card p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Payment Details</p>
            {[
              ['Order ID', order.orderId, 'font-mono text-xs'],
              ['Customer', order.customer?.name, ''],
              ['Method', order.payment?.method, ''],
              ...(order.payment?.razorpayOrderId ? [['Razorpay Order', order.payment.razorpayOrderId, 'font-mono text-xs']] : []),
              ...(order.payment?.razorpayPaymentId ? [['Razorpay Payment', order.payment.razorpayPaymentId, 'font-mono text-xs']] : []),
              ['Paid At', order.payment?.paidAt ? new Date(order.payment.paidAt).toLocaleString('en-IN') : '—', ''],
              ['Store', order.store?.name, ''],
            ].map(([label, val, extraCls]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-base-content/50 text-xs">{label}</span>
                <span className={`font-semibold text-base-content text-xs ${extraCls}`}>{val ?? '—'}</span>
              </div>
            ))}
          </div>
          <div className="glass-card p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Billing Breakdown</p>
            {[
              ['Subtotal', order.billing?.subTotal ?? 0, false],
              ['GST', order.billing?.gstAmount ?? 0, false],
              ['Delivery', order.billing?.deliveryCharges ?? 0, false],
              ['Platform Fee', order.billing?.platformFee ?? 0, false],
              ['Discount', -(order.billing?.discountAmount ?? 0), true],
            ].map(([label, val, isDiscount]) => (
              <div key={label} className="flex justify-between text-xs text-base-content/60">
                <span>{label}</span>
                <span className={isDiscount && val < 0 ? 'text-success font-semibold' : ''}>
                  {val < 0 ? '-' : ''}₹{Math.abs(val).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-black text-base-content border-t border-base-300 pt-2 mt-2">
              <span>Total Payable</span>
              <span>₹{order.billing?.totalPayable?.toLocaleString('en-IN')}</span>
            </div>
          </div>
          {logs.length > 0 && (
            <div className="glass-card p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Transaction Log</p>
              <div className="space-y-2 relative">
                <div className="absolute left-2.5 top-2 bottom-2 w-px bg-base-300" />
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 relative">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 z-10">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-base-content">{log.action ?? '—'}</p>
                      <p className="text-xs text-base-content/40">{log.status} · {new Date(log.timestamp).toLocaleTimeString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {order.cancellation?.isCancelled && (
            <div className="glass-card p-4 border border-error/30">
              <p className="text-xs font-bold uppercase tracking-widest text-error mb-2">Cancellation Info</p>
              <p className="text-xs text-base-content/60">Reason: <strong>{order.cancellation.reason ?? '—'}</strong></p>
              <div className="mt-1">Refund Status: <PaymentBadge status={order.cancellation.refundStatus} /></div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});
PaymentDrawer.displayName = 'PaymentDrawer';

// ─── Wallet Adjust Modal ──────────────────────────────────────────────────────

const WalletAdjustModal = memo(({ userId, onClose }) => {
  const dispatch = useDispatch();
  const { processing } = useSelector(selectWalletAdjust);
  const [form, setForm] = useState({ type: 'Credit', amount: '', description: '' });

  const handleSubmit = useCallback(async () => {
    if (!form.amount || !form.description) return;
    await dispatch(adjustUserWallet({ userId, adjustData: form }));
    // Refresh wallet after adjust
    dispatch(fetchUserWallet({ userId }));
    onClose();
  }, [dispatch, userId, form, onClose]);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      <motion.div className="glass-card relative w-full max-w-sm p-7 z-10"
        initial={{ scale: 0.9, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 24 }}
        transition={{ type: 'spring', damping: 26 }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-base-content flex items-center gap-2">
            <Wallet size={20} className="text-primary" /> Wallet Adjustment
          </h3>
          <button onClick={onClose} className="btn-ghost btn-sm btn-circle"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label-text mb-1.5 block">Type</label>
            <select className="input-field" value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              <option value="Credit">Credit</option>
              <option value="Debit">Debit</option>
            </select>
          </div>
          <div>
            <label className="label-text mb-1.5 block">Amount (₹)</label>
            <input className="input-field" type="number" min="1" value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Enter amount" />
          </div>
          <div>
            <label className="label-text mb-1.5 block">Description</label>
            <textarea className="input-field resize-none" rows={3} value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Reason for adjustment…" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 ${form.type === 'Credit' ? 'btn-success' : 'btn-error'}`}
            onClick={handleSubmit}
            disabled={processing || !form.amount || !form.description}>
            {processing ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
            {processing ? 'Applying…' : `Apply ${form.type}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
WalletAdjustModal.displayName = 'WalletAdjustModal';

// ─── Tab: Orders ──────────────────────────────────────────────────────────────

const OrdersTab = () => {
  const dispatch = useDispatch();
  const { data: orders, pagination, loading } = useSelector(selectPharmacyOrders);
  const [filters, setFilters] = useState({
    page: 1, limit: 15,
    paymentStatus: '', search: '',
    startDate: '', endDate: '', minAmount: '', maxAmount: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [refundOrder, setRefundOrder] = useState(null);

  const setFilter = useCallback((key, val) =>
    setFilters(p => ({ ...p, [key]: val, ...(key !== 'page' ? { page: 1 } : {}) })), []);

  const fetchOrders = useCallback(() => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    dispatch(fetchPharmacyOrders(clean));
  }, [dispatch, filters]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const exportCSV = useCallback(() => {
    const rows = [
      'Order ID,Customer,Amount,Method,Status,Razorpay ID,Date',
      ...orders.map(o => `"${o.orderId}","${o.customer?.name ?? ''}",${o.billing?.totalPayable ?? 0},"${o.payment?.method ?? ''}","${o.payment?.status ?? ''}","${o.payment?.razorpayPaymentId ?? ''}","${o.payment?.paidAt ? new Date(o.payment.paidAt).toLocaleDateString('en-IN') : ''}"`)
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' }));
    a.download = `payments-${Date.now()}.csv`;
    a.click();
  }, [orders]);

  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <button onClick={fetchOrders} className="btn-secondary btn-sm flex items-center gap-2">
          <RefreshCw size={13} /> Refresh
        </button>
        <button onClick={exportCSV} className="btn-primary-cta btn-sm flex items-center gap-2">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 space-y-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input className="input-field pl-9" placeholder="Search order ID…"
              value={filters.search} onChange={e => setFilter('search', e.target.value)} />
          </div>
          <select className="input-field sm:w-44" value={filters.paymentStatus}
            onChange={e => setFilter('paymentStatus', e.target.value)}>
            <option value="">All Statuses</option>
            {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => setShowFilters(p => !p)}
            className="btn-secondary btn-sm flex items-center gap-2 whitespace-nowrap">
            <Filter size={13} /> {showFilters ? 'Hide' : 'More Filters'}
          </button>
        </div>
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-base-300">
                {[['Start Date', 'date', 'startDate'], ['End Date', 'date', 'endDate'],
                  ['Min ₹', 'number', 'minAmount'], ['Max ₹', 'number', 'maxAmount']].map(([l, t, k]) => (
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

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {['Order ID', 'Customer', 'Amount', 'Method', 'Razorpay ID', 'Status', 'Paid At', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(10).fill(0).map((_, i) => <SkeletonRow key={i} />)
                : orders.length === 0
                  ? <tr><td colSpan={8}><EmptyState icon={CreditCard} message="No payment records" sub="Adjust filters to view payments" /></td></tr>
                  : orders.map((order, idx) => (
                    <motion.tr key={order._id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.025 }} className="group">
                      <td className="font-mono font-black text-primary text-xs tracking-wide">{order.orderId}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User size={12} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-base-content">{order.customer?.name ?? '—'}</p>
                            <p className="text-xs text-base-content/40">{order.customer?.phone ?? ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="font-black text-base-content text-sm">
                        ₹{order.billing?.totalPayable?.toLocaleString('en-IN') ?? '—'}
                      </td>
                      <td><MethodBadge method={order.payment?.method} /></td>
                      <td className="font-mono text-xs text-base-content/50 truncate max-w-28">
                        {order.payment?.razorpayPaymentId ?? '—'}
                      </td>
                      <td><PaymentBadge status={order.payment?.status} /></td>
                      <td className="text-xs text-base-content/50">
                        {order.payment?.paidAt
                          ? new Date(order.payment.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                          : '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setActiveOrder(order)}
                            className="btn-ghost btn-xs btn-circle opacity-60 group-hover:opacity-100"
                            title="View Details"><Eye size={14} /></button>
                          <button onClick={() => printPaymentReceipt(order)}
                            className="btn-ghost btn-xs btn-circle opacity-60 group-hover:opacity-100 text-secondary"
                            title="Print Receipt"><ReceiptText size={14} /></button>
                          {order.cancellation?.isCancelled && order.cancellation?.refundStatus !== 'Processed' && (
                            <button onClick={() => setRefundOrder(order)}
                              className="btn-ghost btn-xs btn-circle opacity-60 group-hover:opacity-100 text-error"
                              title="Process Refund"><RotateCcw size={14} /></button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} page={filters.page} onPage={p => setFilter('page', p)} />
      </div>

      <AnimatePresence>
        {activeOrder && <PaymentDrawer order={activeOrder} onClose={() => setActiveOrder(null)} />}
        {refundOrder && <RefundModal order={refundOrder} onClose={() => setRefundOrder(null)} />}
      </AnimatePresence>
    </>
  );
};

// ─── Tab: Ledger ──────────────────────────────────────────────────────────────

const LedgerTab = () => {
  const dispatch = useDispatch();
  const { data: ledger, pagination, loading } = useSelector(selectFinancialLedger);
  const [filters, setFilters] = useState({ page: 1, limit: 20, type: '', purpose: '', status: '' });

  const setFilter = useCallback((key, val) =>
    setFilters(p => ({ ...p, [key]: val, ...(key !== 'page' ? { page: 1 } : {}) })), []);

  useEffect(() => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    dispatch(fetchFinancialLedger(clean));
  }, [dispatch, filters]);

  return (
    <>
      <div className="glass-card p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          {[['Type', ['', 'Credit', 'Debit'], 'type'],
            ['Purpose', ['', 'Refund', 'Purchase', 'Admin_Credit', 'Admin_Debit', 'Withdrawal'], 'purpose'],
            ['Status', ['', 'Success', 'Pending', 'Failed'], 'status']
          ].map(([label, options, key]) => (
            <div key={key} className="flex flex-col gap-1 min-w-36">
              <label className="label-text">{label}</label>
              <select className="input-field" value={filters[key]}
                onChange={e => setFilter(key, e.target.value)}>
                {options.map(o => <option key={o} value={o}>{o || `All ${label}s`}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {['User', 'Role', 'Type', 'Purpose', 'Amount', 'Status', 'Currency', 'Timestamp'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(8).fill(0).map((_, i) => <SkeletonRow key={i} />)
                : ledger.length === 0
                  ? <tr><td colSpan={8}><EmptyState icon={Layers} message="No transactions" /></td></tr>
                  : ledger.map((item, idx) => {
                    const tx = item.transaction ?? {};
                    return (
                      <motion.tr key={idx}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}>
                        <td>
                          <div>
                            <p className="text-xs font-semibold text-base-content">{item.user?.name ?? '—'}</p>
                            <p className="text-xs text-base-content/40">{item.user?.email ?? ''}</p>
                          </div>
                        </td>
                        <td><span className="badge badge-secondary badge-xs">{item.user?.role ?? '—'}</span></td>
                        <td>
                          <span className={`badge badge-xs ${tx.type === 'Credit' ? 'badge-success' : 'badge-error'}`}>
                            {tx.type === 'Credit' ? <ArrowUpRight size={9} /> : <ArrowDownCircle size={9} />}
                            {tx.type ?? '—'}
                          </span>
                        </td>
                        <td className="text-xs text-base-content/60">{tx.purpose ?? '—'}</td>
                        <td className="font-black text-base-content">
                          <span className={tx.type === 'Credit' ? 'text-success' : 'text-error'}>
                            {tx.type === 'Credit' ? '+' : '-'}₹{(tx.amount ?? 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td><PaymentBadge status={tx.status} /></td>
                        <td className="text-xs text-base-content/50">{item.currency ?? 'INR'}</td>
                        <td className="text-xs text-base-content/50">
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                      </motion.tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} page={filters.page} onPage={p => setFilter('page', p)} />
      </div>
    </>
  );
};

// ─── Tab: Billing Summary ─────────────────────────────────────────────────────

const BillingTab = () => {
  const dispatch = useDispatch();
  const { summary, planBreakdown, upcomingRenewals, loading } = useSelector(selectBillingAnalytics);

  useEffect(() => { dispatch(fetchBillingSummary()); }, [dispatch]);

  const totalRevenue = useMemo(() =>
    summary.reduce((acc, s) => acc + (s.totalRevenue ?? 0), 0), [summary]);

  const totalSubs = useMemo(() =>
    summary.reduce((acc, s) => acc + (s.count ?? 0), 0), [summary]);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={IndianRupee} colorVar="text-success" />
        <StatCard title="Total Subscriptions" value={totalSubs.toLocaleString()}
          icon={Star} colorVar="text-primary" />
        {summary.map(s => (
          <StatCard key={s._id}
            title={`${s._id ?? 'Unknown'} Subs`}
            value={s.count?.toLocaleString() ?? '0'}
            sub={`₹${(s.totalRevenue ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} revenue`}
            icon={CheckCircle2}
            colorVar={s._id === 'Active' ? 'text-success' : 'text-warning'} />
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Plan Breakdown */}
        <div className="glass-card p-5">
          <SectionHeading icon={PieIcon} title="Active Subscriptions by Plan" />
          {loading
            ? <div className="flex justify-center py-10"><div className="loading loading-md loading-spinner" /></div>
            : planBreakdown.length === 0
              ? <EmptyState icon={PieIcon} message="No plan data" />
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={planBreakdown} dataKey="count" nameKey="planName"
                      cx="50%" cy="50%" outerRadius={85} innerRadius={48} paddingAngle={4}>
                      {planBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              )
          }
        </div>

        {/* Revenue by Status Bar */}
        <div className="glass-card p-5">
          <SectionHeading icon={BarChart2} title="Revenue by Subscription Status" />
          {loading
            ? <div className="flex justify-center py-10"><div className="loading loading-md loading-spinner" /></div>
            : summary.length === 0
              ? <EmptyState icon={BarChart2} message="No summary data" />
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={summary} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                    <XAxis dataKey="_id" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4 }}
                      tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="totalRevenue" name="Revenue ₹" radius={[6, 6, 0, 0]}>
                      {summary.map((s, i) => (
                        <Cell key={i} fill={s._id === 'Active' ? 'var(--success)' : s._id === 'Expired' ? 'var(--error)' : 'var(--warning)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
          }
        </div>
      </div>

      {/* Upcoming Renewals */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <SectionHeading icon={Calendar} title="Upcoming Renewals (next 7 days)" badge={`${upcomingRenewals.length} renewals`} />
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {['User', 'Email', 'Plan', 'Expiry', 'Status'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(5).fill(0).map((_, i) => <SkeletonRow key={i} cols={5} />)
                : upcomingRenewals.length === 0
                  ? <tr><td colSpan={5}><EmptyState icon={Calendar} message="No upcoming renewals" /></td></tr>
                  : upcomingRenewals.map((sub, i) => (
                    <tr key={i}>
                      <td className="font-semibold text-base-content text-sm">{sub.user?.name ?? '—'}</td>
                      <td className="text-xs text-base-content/50">{sub.user?.email ?? '—'}</td>
                      <td><span className="badge badge-primary badge-xs">{sub.plan?.name ?? '—'}</span></td>
                      <td className="text-xs text-base-content/60">
                        {sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                      </td>
                      <td><PaymentBadge status={sub.status} /></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Audit Logs ──────────────────────────────────────────────────────────

const AuditTab = () => {
  const dispatch = useDispatch();
  const { data: logs, pagination, loading } = useSelector(selectAuditLogs);
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchAuditLogs({ page, limit: 20 }));
  }, [dispatch, page]);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert size={16} className="text-error" />
          <h3 className="font-bold text-sm text-base-content">Suspicious Activity & High-Risk Users</h3>
          <span className="badge badge-error badge-xs ml-auto">{pagination.total ?? 0} flagged</span>
        </div>
        <p className="text-xs text-base-content/40 mb-4">Users with &gt;100 logins, blocked accounts, or &gt;3 device tokens</p>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {['User', 'Role', 'Login Count', 'Last IP', 'Last Login', 'Devices', 'Status'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(8).fill(0).map((_, i) => <SkeletonRow key={i} cols={7} />)
              : logs.length === 0
                ? <tr><td colSpan={7}><EmptyState icon={ShieldAlert} message="No suspicious activity" sub="All users within normal parameters" /></td></tr>
                : logs.map((user, i) => (
                  <motion.tr key={user._id ?? i}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}>
                    <td>
                      <div>
                        <p className="text-xs font-semibold text-base-content">{user.name ?? '—'}</p>
                        <p className="text-xs text-base-content/40">{user.email ?? ''}</p>
                      </div>
                    </td>
                    <td><span className="badge badge-secondary badge-xs">{user.role ?? '—'}</span></td>
                    <td>
                      <span className={`font-bold text-sm ${(user.loginCount ?? 0) > 100 ? 'text-error' : 'text-base-content'}`}>
                        {user.loginCount ?? 0}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-base-content/50">{user.lastLoginIp ?? '—'}</td>
                    <td className="text-xs text-base-content/50">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td>
                      <span className={`font-bold text-sm ${(user.deviceTokens?.length ?? 0) > 3 ? 'text-warning' : 'text-base-content'}`}>
                        {user.deviceTokens?.length ?? 0}
                      </span>
                    </td>
                    <td>
                      {user.isBlocked
                        ? <span className="badge badge-error badge-xs">Blocked</span>
                        : <span className="badge badge-success badge-xs">Active</span>}
                    </td>
                  </motion.tr>
                ))}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} page={page} onPage={setPage} />
    </div>
  );
};

// ─── Tab: Wallet Viewer ───────────────────────────────────────────────────────

const WalletTab = () => {
  const dispatch = useDispatch();
  const { data: wallet, transactions, pagination, loading } = useSelector(selectWalletDetail);
  const [userId, setUserId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const handleSearch = useCallback(() => {
    if (!searchInput.trim()) return;
    setUserId(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  useEffect(() => {
    if (!userId) return;
    dispatch(fetchUserWallet({ userId, params: { page, limit: 15 } }));
  }, [dispatch, userId, page]);

  useEffect(() => () => { dispatch(clearWalletDetail()); }, [dispatch]);

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="glass-card p-4">
        <label className="label-text block mb-2">Look Up User Wallet by User ID</label>
        <div className="flex gap-3">
          <input className="input-field flex-1" placeholder="Paste MongoDB ObjectId…"
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <button onClick={handleSearch} className="btn-primary-cta btn-sm flex items-center gap-2">
            <Search size={14} /> Lookup
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="loading loading-lg loading-spinner" />
        </div>
      )}

      {wallet && !loading && (
        <>
          {/* Wallet Summary */}
          <div className="glass-card p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <User size={22} className="text-primary" />
                </div>
                <div>
                  <p className="font-black text-base-content text-lg">{wallet.user?.name ?? '—'}</p>
                  <p className="text-xs text-base-content/40">{wallet.user?.email ?? ''}</p>
                  <span className="badge badge-secondary badge-xs mt-1">{wallet.user?.role ?? '—'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <span className={`badge ${wallet.isActive ? 'badge-success' : 'badge-error'}`}>
                  {wallet.isActive ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => setAdjustOpen(true)} className="btn-primary btn-sm flex items-center gap-2">
                  <Wallet size={13} /> Adjust
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Balance', wallet.balance, 'text-primary'],
                ['Available', wallet.availableBalance, 'text-success'],
                ['Withdrawable', wallet.withdrawableBalance, 'text-info'],
                ['Locked', wallet.lockedBalance, 'text-warning'],
                ['Total Credited', wallet.totalCredited, 'text-success'],
                ['Total Debited', wallet.totalDebited, 'text-error'],
                ['Total Withdrawn', wallet.totalWithdrawn, 'text-base-content'],
                ['Pending Withdrawals', wallet.pendingWithdrawals?.length ?? 0, 'text-warning'],
              ].map(([label, val, cls]) => (
                <div key={label} className="stat-card">
                  <p className="stat-card-label">{label}</p>
                  <p className={`stat-card-value text-xl ${cls}`}>
                    {typeof val === 'number' && label !== 'Pending Withdrawals'
                      ? `₹${val.toLocaleString('en-IN')}`
                      : val}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Transactions */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 pt-5 pb-2">
              <SectionHeading icon={Layers} title="Transaction History" badge={`${pagination.total} transactions`} />
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {['Type', 'Purpose', 'Amount', 'Balance After', 'Status', 'Reference', 'Date'].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0
                    ? <tr><td colSpan={7}><EmptyState icon={Layers} message="No transactions" /></td></tr>
                    : transactions.map((tx, i) => (
                      <tr key={i}>
                        <td>
                          <span className={`badge badge-xs ${tx.type === 'Credit' ? 'badge-success' : 'badge-error'}`}>
                            {tx.type === 'Credit' ? <ArrowUpRight size={9} /> : <ArrowDownCircle size={9} />}
                            {tx.type}
                          </span>
                        </td>
                        <td className="text-xs text-base-content/60">{tx.purpose ?? '—'}</td>
                        <td className={`font-black text-sm ${tx.type === 'Credit' ? 'text-success' : 'text-error'}`}>
                          {tx.type === 'Credit' ? '+' : '-'}₹{(tx.amount ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="text-xs font-semibold text-base-content">
                          ₹{(tx.balanceAfter ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td><PaymentBadge status={tx.status} /></td>
                        <td className="font-mono text-xs text-base-content/40 truncate max-w-24">
                          {tx.referenceId?.toString() ?? '—'}
                        </td>
                        <td className="text-xs text-base-content/50">
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('en-IN', { dateStyle: 'short' }) : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={pagination} page={page} onPage={setPage} />
          </div>
        </>
      )}

      {!wallet && !loading && userId && (
        <div className="glass-card p-10 text-center text-base-content/40">
          <Wallet size={40} strokeWidth={0.8} className="mx-auto mb-3" />
          <p className="font-bold">Wallet not found for this user</p>
        </div>
      )}

      <AnimatePresence>
        {adjustOpen && wallet && (
          <WalletAdjustModal userId={userId} onClose={() => setAdjustOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Tab: Analytics ───────────────────────────────────────────────────────────

const AnalyticsTab = () => {
  const dispatch = useDispatch();
  const { data: orders } = useSelector(selectPharmacyOrders);
  const { data: ledger, loading: ledgerLoading } = useSelector(selectFinancialLedger);

  useEffect(() => {
    dispatch(fetchFinancialLedger({ limit: 200 }));
  }, [dispatch]);

  const methodBreakdown = useMemo(() => {
    const m = { Razorpay: 0, Wallet: 0, COD: 0 };
    orders.forEach(o => {
      if (o.payment?.status === 'Paid' && o.payment?.method) {
        m[o.payment.method] = (m[o.payment.method] ?? 0) + (o.billing?.totalPayable ?? 0);
      }
    });
    return Object.entries(m).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const revenueTimeline = useMemo(() => {
    const m = {};
    ledger.forEach(item => {
      const tx = item.transaction ?? {};
      const d = new Date(tx.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (!m[d]) m[d] = { date: d, credit: 0, debit: 0 };
      if (tx.type === 'Credit') m[d].credit += tx.amount ?? 0;
      if (tx.type === 'Debit')  m[d].debit  += tx.amount ?? 0;
    });
    return Object.values(m).slice(-14);
  }, [ledger]);

  const statusPieData = useMemo(() => {
    const m = {};
    orders.forEach(o => {
      const s = o.payment?.status ?? 'Unknown';
      m[s] = (m[s] ?? 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [orders]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="lg:col-span-2 glass-card p-5">
          <SectionHeading icon={Activity} title="Wallet Flow Timeline (Last 14 Days)" badge="Live Ledger" />
          {ledgerLoading
            ? <div className="flex justify-center py-10"><div className="loading loading-md loading-spinner" /></div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={revenueTimeline} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--error)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--error)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4 }}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="credit" fill="url(#cGrad)" stroke="var(--success)" strokeWidth={2.5} name="Credits ₹" />
                  <Area type="monotone" dataKey="debit"  fill="url(#dGrad)" stroke="var(--error)"   strokeWidth={2}   name="Debits ₹" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
        </div>
        {/* Method split */}
        <div className="glass-card p-5">
          <SectionHeading icon={PieIcon} title="Payment Method Split" />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={methodBreakdown} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={5}>
                {methodBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <SectionHeading icon={Zap} title="Payment Status Distribution" />
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={statusPieData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Orders" radius={[6, 6, 0, 0]}>
                {statusPieData.map((d, i) => {
                  const fill = d.name === 'Paid' ? 'var(--success)' : d.name === 'Failed' ? 'var(--error)' : d.name === 'Refunded' ? 'var(--info)' : 'var(--warning)';
                  return <Cell key={i} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-5">
          <SectionHeading icon={IndianRupee} title="Revenue by Payment Method" />
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={methodBreakdown} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.4 }}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.6 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Revenue ₹" radius={[0, 6, 6, 0]}>
                {methodBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaymentPage() {
  const dispatch = useDispatch();
  const { data: orders } = useSelector(selectPharmacyOrders);
  const { data: ledger } = useSelector(selectFinancialLedger);
  const [activeTab, setActiveTab] = useState('orders');

  // Bootstrap: orders + ledger for summary stats
  useEffect(() => {
    dispatch(fetchPharmacyOrders({ page: 1, limit: 15 }));
    dispatch(fetchFinancialLedger({ limit: 200 }));
  }, [dispatch]);

  const orderStats = useMemo(() => {
    let totalPaid = 0, totalPending = 0, totalFailed = 0, totalRefunded = 0;
    orders.forEach(o => {
      const amt = o.billing?.totalPayable ?? 0;
      if (o.payment?.status === 'Paid')     totalPaid     += amt;
      if (o.payment?.status === 'Pending')  totalPending  += amt;
      if (o.payment?.status === 'Failed')   totalFailed   += amt;
      if (o.payment?.status === 'Refunded') totalRefunded += amt;
    });
    return { totalPaid, totalPending, totalFailed, totalRefunded };
  }, [orders]);

  const TAB_PANELS = {
    orders:    <OrdersTab />,
    ledger:    <LedgerTab />,
    billing:   <BillingTab />,
    audit:     <AuditTab />,
    wallet:    <WalletTab />,
    analytics: <AnalyticsTab />,
  };

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div variants={fadeUp}>
          <h1 className="text-responsive-xl font-black text-base-content flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10">
              <CreditCard size={26} className="text-primary" />
            </div>
            Payment Management
          </h1>
          <p className="text-base-content/40 text-sm mt-1 ml-1">
            Monitor, reconcile &amp; manage all financial transactions
          </p>
        </motion.div>
      </motion.div>

      {/* Global Stats */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Collected"
          value={`₹${orderStats.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={CheckCircle2} colorVar="text-success" trendVal={9.4} />
        <StatCard title="Pending"
          value={`₹${orderStats.totalPending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={Clock} colorVar="text-warning" trendVal={-3.1} />
        <StatCard title="Failed Payments"
          value={`₹${orderStats.totalFailed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={XCircle} colorVar="text-error" trendVal={-1.8} />
        <StatCard title="Refunded"
          value={`₹${orderStats.totalRefunded.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={RotateCcw} colorVar="text-info" sub="Current page" />
      </motion.div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 glass-card p-1.5 rounded-xl overflow-x-auto scrollbar-thin">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
              activeTab === key
                ? 'bg-primary text-primary-content shadow-md'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
            }`}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {TAB_PANELS[activeTab]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}