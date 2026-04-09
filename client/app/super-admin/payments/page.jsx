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
  CreditCard, IndianRupee, TrendingUp, TrendingDown, ArrowUpCircle,
  ArrowDownCircle, RefreshCw, Download, Search, Filter,
  CheckCircle2, XCircle, Clock, AlertTriangle, ChevronLeft,
  ChevronRight, Eye, RotateCcw, Wallet, ReceiptText,
  ArrowUpRight, Zap, ShieldCheck, Banknote, Smartphone,
  X, Loader2, Activity, BarChart2, AlertCircle, User, Store
} from 'lucide-react';
import {
  fetchPharmacyOrders, fetchFinancialLedger,
  processOrderRefund,
  selectPharmacyOrders, selectFinancialLedger, selectRefundState
} from '@/store/slices/superadminSlice';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAYMENT_METHODS  = ['Razorpay', 'Wallet', 'COD'];
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Refunded'];

const METHOD_META = {
  Razorpay: { icon: CreditCard,   color: 'var(--primary)',  label: 'Razorpay' },
  Wallet:   { icon: Wallet,       color: 'var(--secondary)',label: 'Wallet' },
  COD:      { icon: Banknote,     color: 'var(--chart-4)',  label: 'Cash on Delivery' },
};

const STATUS_META = {
  Pending:  { cls: 'badge-warning', icon: Clock,        color: 'var(--warning)' },
  Paid:     { cls: 'badge-success', icon: CheckCircle2, color: 'var(--success)' },
  Failed:   { cls: 'badge-error',   icon: XCircle,      color: 'var(--error)' },
  Refunded: { cls: 'badge-info',    icon: RotateCcw,    color: 'var(--info)' },
};

const CHART_COLORS = [
  'var(--chart-1)','var(--chart-2)','var(--chart-3)',
  'var(--chart-4)','var(--chart-5)','var(--chart-6)',
];

const fadeUp  = { hidden:{ opacity:0, y:20 }, show:{ opacity:1, y:0 } };
const stagger = { show:{ transition:{ staggerChildren:0.07 } } };

// ─── Invoice Generator ────────────────────────────────────────────────────────
const printPaymentReceipt = (order) => {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Payment Receipt – ${order.orderId}</title>
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
    <div class="seal">
      <svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <p class="sublabel">Payment Receipt</p>
    <p class="amt">₹${order.billing?.totalPayable?.toLocaleString('en-IN',{minimumFractionDigits:2})}</p>
    <span class="badge ${(order.payment?.status ?? '').toLowerCase()}">${order.payment?.status ?? 'N/A'}</span>
  </div>
  <hr class="divider"/>
  <div class="row"><span>Order ID</span><strong style="font-family:monospace;font-size:12px">${order.orderId}</strong></div>
  <div class="row"><span>Customer</span><strong>${order.customer?.name ?? '—'}</strong></div>
  <div class="row"><span>Payment Method</span><strong>${order.payment?.method ?? '—'}</strong></div>
  ${order.payment?.razorpayPaymentId ? `<div class="row"><span>Razorpay ID</span><strong style="font-family:monospace;font-size:11px">${order.payment.razorpayPaymentId}</strong></div>` : ''}
  <div class="row"><span>Date</span><strong>${order.payment?.paidAt ? new Date(order.payment.paidAt).toLocaleString('en-IN',{dateStyle:'long',timeStyle:'short'}) : '—'}</strong></div>
  <hr class="divider"/>
  <div class="row"><span>Subtotal</span><strong>₹${order.billing?.subTotal?.toFixed(2) ?? '0.00'}</strong></div>
  <div class="row"><span>GST</span><strong>₹${(order.billing?.gstAmount??0).toFixed(2)}</strong></div>
  <div class="row"><span>Delivery</span><strong>₹${(order.billing?.deliveryCharges??0).toFixed(2)}</strong></div>
  <div class="row"><span>Platform Fee</span><strong>₹${(order.billing?.platformFee??0).toFixed(2)}</strong></div>
  ${order.billing?.discountAmount ? `<div class="row"><span>Discount</span><strong style="color:#16a34a">-₹${order.billing.discountAmount.toFixed(2)}</strong></div>` : ''}
  <div class="row" style="font-size:15px;font-weight:900;border-top:2px solid #e2e8f0;padding-top:12px;margin-top:4px;"><span style="color:#0f172a">Total Paid</span><strong style="color:#2563eb">₹${order.billing?.totalPayable?.toFixed(2) ?? '0.00'}</strong></div>
  <div class="footer"><p>Thank you for choosing LikesonHealth</p><p style="margin-top:4px">support@likesonhealth.com · This is a system-generated receipt</p></div>
  </body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 500);
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
const ChartTooltip = memo(({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-xs shadow-2xl border border-base-300 min-w-[140px]">
      <p className="font-black text-base-content mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="mb-0.5" style={{color: p.color}}>
          {p.name}: <strong>
            {typeof p.value === 'number' && (p.name.includes('₹') || p.name.toLowerCase().includes('revenue') || p.name.toLowerCase().includes('amount'))
              ? `₹${p.value.toLocaleString('en-IN')}`
              : p.value}
          </strong>
        </p>
      ))}
    </div>
  );
});
ChartTooltip.displayName = 'ChartTooltip';

const StatCard = memo(({ title, value, sub, icon: Icon, color, trend, trendVal, animate = true }) => (
  <motion.div
    variants={fadeUp}
    whileHover={{ y: -3, transition: { duration: 0.2 } }}
    className="glass-card p-5 flex flex-col gap-3 cursor-default"
  >
    <div className="flex items-start justify-between">
      <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">{title}</p>
      <div className="p-2.5 rounded-xl" style={{background:`color-mix(in srgb, ${color} 18%, transparent)`}}>
        <Icon size={17} style={{color}}/>
      </div>
    </div>
    <motion.p
      className="text-2xl font-black text-base-content"
      initial={animate ? {opacity:0, scale:0.8} : false}
      animate={animate ? {opacity:1, scale:1} : false}
      transition={{duration:0.4, ease:'backOut'}}
    >
      {value}
    </motion.p>
    {sub && <p className="text-xs text-base-content/40">{sub}</p>}
    {trendVal != null && (
      <div className={`flex items-center gap-1 text-xs font-bold ${trendVal >= 0 ? 'text-success' : 'text-error'}`}>
        {trendVal >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
        {Math.abs(trendVal)}% vs last period
      </div>
    )}
  </motion.div>
));
StatCard.displayName = 'StatCard';

const PaymentBadge = memo(({ status }) => {
  const { cls, icon: Icon } = STATUS_META[status] ?? { cls:'badge-info', icon: Clock };
  return <span className={`badge ${cls} gap-1`}><Icon size={10}/>{status}</span>;
});
PaymentBadge.displayName = 'PaymentBadge';

const MethodBadge = memo(({ method }) => {
  const { icon: Icon, color } = METHOD_META[method] ?? { icon: CreditCard, color:'var(--primary)' };
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold" style={{color}}>
      <Icon size={12}/> {method}
    </div>
  );
});
MethodBadge.displayName = 'MethodBadge';

const SkeletonRow = () => (
  <tr className="border-b border-base-300">
    {Array(8).fill(0).map((_,i) => <td key={i} className="py-4 px-4"><div className="skeleton h-4 rounded w-full"/></td>)}
  </tr>
);

const EmptyPayments = () => (
  <tr><td colSpan={8}>
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-base-content/25">
      <CreditCard size={60} strokeWidth={0.7}/>
      <p className="text-lg font-bold">No payment records</p>
      <p className="text-sm">Adjust filters to view payments</p>
    </div>
  </td></tr>
);

// ─── Refund Modal ─────────────────────────────────────────────────────────────
const RefundModal = memo(({ order, onClose }) => {
  const dispatch = useDispatch();
  const { processing } = useSelector(selectRefundState);
  const [form, setForm] = useState({
    amount: order?.billing?.totalPayable ?? '',
    reason: '',
    method: 'Wallet'
  });

  const handleSubmit = useCallback(async () => {
    if (!form.amount || !form.reason) return;
    await dispatch(processOrderRefund({ orderId: order.orderId, refundData: form }));
    onClose();
  }, [dispatch, form, order, onClose]);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}/>
      <motion.div className="glass-card relative w-full max-w-md p-7 z-10"
        initial={{scale:0.9, y:24}} animate={{scale:1, y:0}} exit={{scale:0.9, y:24}}
        transition={{type:'spring', damping:26}}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-base-content flex items-center gap-2">
              <RotateCcw size={20} className="text-info"/> Initiate Refund
            </h3>
            <p className="text-xs text-base-content/40 mt-1 font-mono">{order.orderId}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors"><X size={16}/></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-base-content/50 mb-1.5 block uppercase tracking-widest">Refund Amount (₹)</label>
            <input className="input-field w-full" type="number" value={form.amount}
              onChange={e => setForm(p => ({...p, amount: e.target.value}))}
              placeholder={`Max: ₹${order.billing?.totalPayable}`}/>
          </div>
          <div>
            <label className="text-xs font-bold text-base-content/50 mb-1.5 block uppercase tracking-widest">Refund Method</label>
            <select className="input-field w-full" value={form.method}
              onChange={e => setForm(p => ({...p, method: e.target.value}))}>
              <option value="Wallet">Wallet (Instant)</option>
              <option value="Original_Source">Original Source</option>
              <option value="Bank_Transfer">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-base-content/50 mb-1.5 block uppercase tracking-widest">Reason</label>
            <textarea className="input-field w-full resize-none" rows={3} value={form.reason}
              onChange={e => setForm(p => ({...p, reason: e.target.value}))}
              placeholder="Reason for this refund…"/>
          </div>
          <div className="alert alert-warning text-xs flex items-start gap-2 mt-1">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5"/>
            <span>This action is <strong>irreversible</strong>. Confirm before proceeding.</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-success flex-1 flex items-center justify-center gap-2"
            onClick={handleSubmit}
            disabled={processing || !form.amount || !form.reason}>
            {processing ? <Loader2 size={15} className="animate-spin"/> : <RotateCcw size={15}/>}
            {processing ? 'Processing…' : 'Process Refund'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
RefundModal.displayName = 'RefundModal';

// ─── Payment Detail Drawer ────────────────────────────────────────────────────
const PaymentDrawer = memo(({ order, onClose }) => {
  if (!order) return null;
  const logs = order.payment?.transactionLog ?? [];

  return (
    <motion.div className="fixed inset-0 z-50 flex"
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <motion.div
        className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto shadow-2xl"
        style={{background:'var(--base-100)'}}
        initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
        transition={{type:'spring', damping:28, stiffness:280}}>
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-base-300 flex items-center justify-between"
          style={{background:'color-mix(in srgb, var(--base-100) 92%, transparent)', backdropFilter:'blur(20px)'}}>
          <div>
            <p className="font-black text-base-content">{order.orderId}</p>
            <p className="text-xs text-base-content/40">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => printPaymentReceipt(order)}
              className="btn-primary-cta !py-2 !px-3 flex items-center gap-1.5 text-xs">
              <ReceiptText size={13}/> Receipt
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors"><X size={18}/></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Amount Hero */}
          <div className="glass-card p-5 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{background:'radial-gradient(circle at 50% 0%, var(--primary), transparent 70%)'}}/>
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Total Amount</p>
            <p className="text-4xl font-black text-base-content">
              ₹{order.billing?.totalPayable?.toLocaleString('en-IN', {minimumFractionDigits:2})}
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <PaymentBadge status={order.payment?.status}/>
              <MethodBadge method={order.payment?.method}/>
            </div>
          </div>

          {/* Payment Details */}
          <div className="glass-card p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Payment Details</p>
            {[
              ['Order ID',      order.orderId,                   'mono'],
              ['Customer',      order.customer?.name,            ''],
              ['Payment Method',order.payment?.method,           ''],
              ...(order.payment?.razorpayOrderId   ? [['Razorpay Order',   order.payment.razorpayOrderId,   'mono']] : []),
              ...(order.payment?.razorpayPaymentId ? [['Razorpay Payment', order.payment.razorpayPaymentId, 'mono']] : []),
              ['Paid At',       order.payment?.paidAt ? new Date(order.payment.paidAt).toLocaleString('en-IN') : '—', ''],
              ['Store',         order.store?.name,               ''],
            ].map(([label, val, style]) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-base-content/50 text-xs">{label}</span>
                <span className={`font-semibold text-base-content text-xs ${style === 'mono' ? 'font-mono' : ''}`}>
                  {val ?? '—'}
                </span>
              </div>
            ))}
          </div>

          {/* Billing Breakdown */}
          <div className="glass-card p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Billing Breakdown</p>
            {[
              ['Subtotal',     order.billing?.subTotal ?? 0],
              ['GST',          order.billing?.gstAmount ?? 0],
              ['Delivery',     order.billing?.deliveryCharges ?? 0],
              ['Platform Fee', order.billing?.platformFee ?? 0],
              ['Discount',     -(order.billing?.discountAmount ?? 0)],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-xs text-base-content/60">
                <span>{label}</span>
                <span className={val < 0 ? 'text-success font-semibold' : ''}>
                  {val < 0 ? '-' : ''}₹{Math.abs(val).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-black text-base-content border-t border-base-300 pt-2 mt-2">
              <span>Total Payable</span>
              <span>₹{order.billing?.totalPayable?.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Transaction Logs */}
          {logs.length > 0 && (
            <div className="glass-card p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Transaction Log</p>
              <div className="space-y-2 relative">
                {/* Timeline line */}
                <div className="absolute left-2.5 top-2 bottom-2 w-px bg-base-300"/>
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 relative">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 z-10">
                      <div className="w-2 h-2 rounded-full bg-primary"/>
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

          {/* Refund section */}
          {order.cancellation?.isCancelled && (
            <div className="glass-card p-4 border-error/20" style={{borderColor:'var(--error)'}}>
              <p className="text-xs font-bold uppercase tracking-widest text-error mb-2">Cancellation Info</p>
              <p className="text-xs text-base-content/60">Reason: <strong>{order.cancellation.reason ?? '—'}</strong></p>
              <p className="text-xs text-base-content/60 mt-1">Refund Status: <PaymentBadge status={order.cancellation.refundStatus}/></p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});
PaymentDrawer.displayName = 'PaymentDrawer';

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PaymentPage() {
  const dispatch = useDispatch();
  const { data: orders, pagination, loading } = useSelector(selectPharmacyOrders);
  const { data: ledger, loading: ledgerLoading } = useSelector(selectFinancialLedger);

  const [filters, setFilters] = useState({
    page: 1, limit: 15,
    paymentStatus: '', search: '',
    startDate: '', endDate: '', minAmount: '', maxAmount: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeOrder, setActiveOrder]   = useState(null);
  const [refundOrder, setRefundOrder]   = useState(null);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'analytics'

  // Fetch both datasets on load
  useEffect(() => {
    dispatch(fetchFinancialLedger({ limit: 200 }));
  }, [dispatch]);

  const fetchOrders = useCallback(() => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== ''));
    dispatch(fetchPharmacyOrders(clean));
  }, [dispatch, filters]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const setFilter = useCallback((key, val) => {
    setFilters(p => ({...p, [key]: val, ...(key !== 'page' ? {page:1} : {})}));
  }, []);

  // ── Derived analytics ─────────────────────────────────────────────────────
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

  const methodBreakdown = useMemo(() => {
    const m = { Razorpay:0, Wallet:0, COD:0 };
    orders.forEach(o => {
      if (o.payment?.status === 'Paid' && o.payment?.method) {
        m[o.payment.method] = (m[o.payment.method] ?? 0) + (o.billing?.totalPayable ?? 0);
      }
    });
    return Object.entries(m).filter(([,v]) => v > 0).map(([name, value]) => ({name, value}));
  }, [orders]);

  // Revenue timeline from ledger
  const revenueTimeline = useMemo(() => {
    const m = {};
    ledger.forEach(item => {
      const tx = item.transaction ?? {};
      if (tx.type !== 'Credit') return;
      const d = new Date(tx.timestamp).toLocaleDateString('en-IN', {month:'short', day:'numeric'});
      m[d] = { date:d, credit:(m[d]?.credit??0) + (tx.amount??0), debit:(m[d]?.debit??0) };
    });
    ledger.forEach(item => {
      const tx = item.transaction ?? {};
      if (tx.type !== 'Debit') return;
      const d = new Date(tx.timestamp).toLocaleDateString('en-IN', {month:'short', day:'numeric'});
      if (m[d]) m[d].debit += tx.amount ?? 0;
    });
    return Object.values(m).slice(-14);
  }, [ledger]);

  const statusPieData = useMemo(() => {
    const m = {};
    orders.forEach(o => {
      const s = o.payment?.status ?? 'Unknown';
      m[s] = (m[s]??0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({name, value}));
  }, [orders]);

  // Export CSV
  const exportCSV = useCallback(() => {
    const rows = [
      'Order ID,Customer,Amount,Method,Status,Razorpay ID,Date',
      ...orders.map(o => `"${o.orderId}","${o.customer?.name??''}",${o.billing?.totalPayable??0},"${o.payment?.method??''}","${o.payment?.status??''}","${o.payment?.razorpayPaymentId??''}","${o.payment?.paidAt ? new Date(o.payment.paidAt).toLocaleDateString('en-IN') : ''}"`)
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows],{type:'text/csv'}));
    a.download = `payments-${Date.now()}.csv`;
    a.click();
  }, [orders]);

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* ── Header ── */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div variants={fadeUp}>
          <h1 className="text-responsive-xl font-black text-base-content flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10">
              <CreditCard size={26} className="text-primary"/>
            </div>
            Payment Management
          </h1>
          <p className="text-base-content/40 text-sm mt-1 ml-1">
            Monitor, reconcile &amp; manage all payment transactions
          </p>
        </motion.div>
        <motion.div variants={fadeUp} className="flex gap-2 flex-wrap">
          {/* Tab toggle */}
          <div className="flex items-center gap-1 glass-card p-1 rounded-xl">
            {[['orders','Orders'],['analytics','Analytics']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === key
                    ? 'bg-primary text-primary-content shadow-md'
                    : 'text-base-content/60 hover:text-base-content'
                }`}>{label}</button>
            ))}
          </div>
          <button onClick={fetchOrders} className="btn-secondary flex items-center gap-2 !py-2 !px-4">
            <RefreshCw size={14}/> Refresh
          </button>
          <button onClick={exportCSV} className="btn-primary-cta flex items-center gap-2 !py-2 !px-4">
            <Download size={14}/> Export
          </button>
        </motion.div>
      </motion.div>

      {/* ── Stats ── */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Collected"  value={`₹${orderStats.totalPaid.toLocaleString('en-IN',{maximumFractionDigits:0})}`}
          icon={CheckCircle2} color="var(--success)" trendVal={9.4}/>
        <StatCard title="Pending"          value={`₹${orderStats.totalPending.toLocaleString('en-IN',{maximumFractionDigits:0})}`}
          icon={Clock}        color="var(--warning)" trendVal={-3.1}/>
        <StatCard title="Failed Payments"  value={`₹${orderStats.totalFailed.toLocaleString('en-IN',{maximumFractionDigits:0})}`}
          icon={XCircle}      color="var(--error)"   trendVal={-1.8}/>
        <StatCard title="Refunded"         value={`₹${orderStats.totalRefunded.toLocaleString('en-IN',{maximumFractionDigits:0})}`}
          icon={RotateCcw}    color="var(--info)"    sub="Current page"/>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ── ANALYTICS TAB ── */}
        {activeTab === 'analytics' && (
          <motion.div key="analytics"
            initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}}
            className="space-y-5">
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Revenue/Debit Timeline */}
              <div className="lg:col-span-2 glass-card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Activity size={16} className="text-primary"/>
                  <h3 className="font-bold text-sm text-base-content">Wallet Flow Timeline</h3>
                  <span className="badge badge-info ml-auto text-xs">Live Ledger</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={revenueTimeline} margin={{top:4,right:4,bottom:0,left:4}}>
                    <defs>
                      <linearGradient id="creditG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="debitG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--error)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--error)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)"/>
                    <XAxis dataKey="date" tick={{fontSize:10,fill:'var(--base-content)',opacity:0.4}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'var(--base-content)',opacity:0.4}}
                      tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
                    <Tooltip content={<ChartTooltip/>}/>
                    <Area type="monotone" dataKey="credit" fill="url(#creditG)" stroke="var(--success)" strokeWidth={2.5} name="Credits ₹"/>
                    <Area type="monotone" dataKey="debit"  fill="url(#debitG)"  stroke="var(--error)"   strokeWidth={2}   name="Debits ₹"/>
                    <Line type="monotone" dataKey="credit" stroke="var(--success)" strokeWidth={0} dot={{r:3,fill:'var(--success)'}} activeDot={false}/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Method Breakdown */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart2 size={16} className="text-secondary"/>
                  <h3 className="font-bold text-sm text-base-content">Method Split</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={methodBreakdown} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={5}>
                      {methodBreakdown.map((_,i) => <Cell key={i} fill={CHART_COLORS[i]}/>)}
                    </Pie>
                    <Tooltip content={<ChartTooltip/>}/>
                    <Legend wrapperStyle={{fontSize:10}} iconType="circle"/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Status Bar + Method Bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Zap size={16} className="text-accent"/>
                  <h3 className="font-bold text-sm text-base-content">Payment Status Distribution</h3>
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={statusPieData} margin={{top:4,right:4,bottom:0,left:4}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)"/>
                    <XAxis dataKey="name" tick={{fontSize:10,fill:'var(--base-content)',opacity:0.5}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'var(--base-content)',opacity:0.4}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<ChartTooltip/>}/>
                    <Bar dataKey="value" name="Orders" radius={[6,6,0,0]}>
                      {statusPieData.map((d,i) => {
                        const clr = d.name==='Paid' ? 'var(--success)' : d.name==='Failed' ? 'var(--error)' : d.name==='Refunded' ? 'var(--info)' : 'var(--warning)';
                        return <Cell key={i} fill={clr}/>;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Payment method revenue bars */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <IndianRupee size={16} className="text-primary"/>
                  <h3 className="font-bold text-sm text-base-content">Revenue by Method</h3>
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={methodBreakdown} layout="vertical" margin={{top:4,right:24,bottom:0,left:16}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)"/>
                    <XAxis type="number" tick={{fontSize:10,fill:'var(--base-content)',opacity:0.4}}
                      tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'var(--base-content)',opacity:0.6}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<ChartTooltip/>}/>
                    <Bar dataKey="value" name="Revenue ₹" radius={[0,6,6,0]}>
                      {methodBreakdown.map((_,i) => <Cell key={i} fill={CHART_COLORS[i]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ORDERS TAB ── */}
        {activeTab === 'orders' && (
          <motion.div key="orders"
            initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}}
            className="space-y-5">
            {/* Filters */}
            <div className="glass-card p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"/>
                  <input className="input-field w-full pl-9" placeholder="Search order ID…"
                    value={filters.search} onChange={e => setFilter('search', e.target.value)}/>
                </div>
                <select className="input-field" value={filters.paymentStatus}
                  onChange={e => setFilter('paymentStatus', e.target.value)}>
                  <option value="">All Statuses</option>
                  {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <button onClick={() => setShowFilters(p=>!p)}
                  className="btn-secondary flex items-center gap-2 !py-2 !px-4 whitespace-nowrap">
                  <Filter size={14}/> {showFilters ? 'Hide' : 'More Filters'}
                </button>
              </div>
              <AnimatePresence>
                {showFilters && (
                  <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-base-300">
                      {[['Start Date','date','startDate'],['End Date','date','endDate'],['Min ₹','number','minAmount'],['Max ₹','number','maxAmount']].map(([l,t,k]) => (
                        <div key={k}>
                          <label className="text-xs font-semibold text-base-content/40 block mb-1">{l}</label>
                          <input className="input-field w-full" type={t}
                            value={filters[k]} onChange={e => setFilter(k, e.target.value)}/>
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-base-300 bg-base-200/50">
                      {['Order ID','Customer','Amount','Method','Razorpay ID','Status','Paid At','Actions'].map(h => (
                        <th key={h} className="text-left py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-base-content/40">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? Array(10).fill(0).map((_,i) => <SkeletonRow key={i}/>)
                     : orders.length === 0 ? <EmptyPayments/>
                     : orders.map((order, idx) => (
                      <motion.tr key={order._id}
                        initial={{opacity:0, x:-8}} animate={{opacity:1, x:0}} transition={{delay:idx*0.025}}
                        className="border-b border-base-300/40 hover:bg-base-200/40 transition-colors group">
                        <td className="py-3.5 px-4 font-mono font-black text-primary text-xs tracking-wide">{order.orderId}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                              <User size={12} className="text-primary"/>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-base-content">{order.customer?.name ?? '—'}</p>
                              <p className="text-xs text-base-content/40">{order.customer?.phone ?? ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-black text-base-content text-sm">
                          ₹{order.billing?.totalPayable?.toLocaleString('en-IN') ?? '—'}
                        </td>
                        <td className="py-3.5 px-4"><MethodBadge method={order.payment?.method}/></td>
                        <td className="py-3.5 px-4 font-mono text-xs text-base-content/50 truncate max-w-[120px]">
                          {order.payment?.razorpayPaymentId ?? '—'}
                        </td>
                        <td className="py-3.5 px-4"><PaymentBadge status={order.payment?.status}/></td>
                        <td className="py-3.5 px-4 text-xs text-base-content/50">
                          {order.payment?.paidAt ? new Date(order.payment.paidAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setActiveOrder(order)}
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors opacity-60 group-hover:opacity-100"
                              title="View Details"><Eye size={14}/></button>
                            <button onClick={() => printPaymentReceipt(order)}
                              className="p-1.5 rounded-lg hover:bg-secondary/10 text-secondary transition-colors opacity-60 group-hover:opacity-100"
                              title="Print Receipt"><ReceiptText size={14}/></button>
                            {order.cancellation?.isCancelled && order.cancellation?.refundStatus !== 'Processed' && (
                              <button onClick={() => setRefundOrder(order)}
                                className="p-1.5 rounded-lg hover:bg-error/10 text-error transition-colors opacity-60 group-hover:opacity-100"
                                title="Process Refund"><RotateCcw size={14}/></button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-base-300 bg-base-200/30">
                  <p className="text-xs text-base-content/40">
                    Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} total
                  </p>
                  <div className="flex gap-2">
                    <button disabled={pagination.page<=1} onClick={() => setFilter('page', filters.page-1)}
                      className="btn-secondary !py-1.5 !px-3 disabled:opacity-30"><ChevronLeft size={14}/></button>
                    <button disabled={pagination.page>=pagination.pages} onClick={() => setFilter('page', filters.page+1)}
                      className="btn-secondary !py-1.5 !px-3 disabled:opacity-30"><ChevronRight size={14}/></button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {activeOrder && <PaymentDrawer order={activeOrder} onClose={() => setActiveOrder(null)}/>}
        {refundOrder  && <RefundModal  order={refundOrder}  onClose={() => setRefundOrder(null)}/>}
      </AnimatePresence>
    </div>
  );
}