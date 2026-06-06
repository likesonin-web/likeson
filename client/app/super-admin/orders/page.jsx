'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  ShoppingBag, Filter, Search, RefreshCw, Download, Eye,
  ChevronLeft, ChevronRight, TrendingUp, Package, Clock,
  CheckCircle2, XCircle, Truck, AlertCircle, IndianRupee,
  Store, User, ArrowUpRight, Loader2, X,
  ReceiptText, MapPin, Phone, Mail, Tag, Navigation
} from 'lucide-react';
import {
  fetchPharmacyOrders, processOrderRefund,
  selectPharmacyOrders, selectRefundState
} from '@/store/slices/superadminSlice';

// ─── Constants ────────────────────────────────────────────────────────────────
const DELIVERY_STATUSES = ['Placed', 'Confirmed', 'Processing', 'Out-for-Delivery', 'Delivered', 'Cancelled', 'Returned'];
const PAYMENT_STATUSES  = ['Pending', 'Paid', 'Failed', 'Refunded'];
const STATUS_CFG = {
  Placed:             { cls: 'badge-info',    icon: Clock },
  Confirmed:          { cls: 'badge-primary', icon: CheckCircle2 },
  Processing:         { cls: 'badge-warning', icon: Package },
  'Out-for-Delivery': { cls: 'badge-warning', icon: Truck },
  Delivered:          { cls: 'badge-success', icon: CheckCircle2 },
  Cancelled:          { cls: 'badge-error',   icon: XCircle },
  Returned:           { cls: 'badge-error',   icon: AlertCircle },
};
const PAYMENT_CFG = { Pending: 'badge-warning', Paid: 'badge-success', Failed: 'badge-error', Refunded: 'badge-info' };
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const fadeUp  = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

// ─── Invoice Generator ────────────────────────────────────────────────────────
const downloadInvoice = (order) => {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Invoice – ${order.orderId}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',sans-serif;color:#1a1a2e;padding:40px;background:#fff;}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #2563eb;margin-bottom:36px;}
    .brand{font-size:26px;font-weight:900;color:#2563eb;}.brand span{color:#0ea5e9;}
    .imeta h2{font-size:22px;font-weight:800;margin-bottom:6px;text-align:right;}
    .imeta p{font-size:12px;color:#6b7280;text-align:right;}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;}
    .pbox{background:#f8faff;border-radius:10px;padding:18px;border:1px solid #e0e7ff;}
    .pbox h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:10px;}
    .pbox strong{font-size:14px;font-weight:800;color:#1a1a2e;display:block;margin-bottom:4px;}
    .pbox p{font-size:12px;color:#6b7280;margin-bottom:2px;}
    table{width:100%;border-collapse:collapse;margin-bottom:28px;}
    thead tr{background:#2563eb;}
    thead th{padding:11px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#fff;}
    tbody tr:nth-child(even){background:#f8faff;}
    tbody td{padding:10px 14px;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;}
    .tots{display:flex;justify-content:flex-end;margin-bottom:30px;}
    .tbox{min-width:260px;background:#f8faff;border-radius:10px;padding:20px;border:1px solid #e0e7ff;}
    .tr{display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-bottom:8px;}
    .tr.tot{font-size:16px;font-weight:900;color:#1a1a2e;border-top:2px solid #e0e7ff;padding-top:10px;margin-top:8px;}
    .foot{text-align:center;font-size:11px;color:#9ca3af;margin-top:30px;padding-top:18px;border-top:1px solid #e5e7eb;}
  </style></head><body>
  <div class="hdr">
    <div><div class="brand">Likeson<span>Health</span></div><p style="font-size:11px;color:#9ca3af;margin-top:4px;">Premium Healthcare Platform</p></div>
    <div class="imeta"><h2>INVOICE</h2><p><strong>${order.orderId}</strong></p><p>${new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p><p>Status: ${order.payment?.status ?? 'N/A'}</p></div>
  </div>
  <div class="parties">
    <div class="pbox"><h4>Billed To</h4><strong>${order.customer?.name ?? 'Customer'}</strong>
      <p>${order.customer?.email ?? ''}</p><p>${order.customer?.phone ?? ''}</p>
      <p>${order.delivery?.address?.line1 ?? ''}</p>
      <p>${order.delivery?.address?.city ?? ''} – ${order.delivery?.address?.pincode ?? ''}</p>
    </div>
    <div class="pbox"><h4>Fulfilled By</h4><strong>${order.store?.storeName ?? 'Pharmacy Store'}</strong>
      <p>${order.store?.contact?.phone ?? ''} | ${order.store?.contact?.email ?? ''}</p>
      <p>${order.store?.address?.line1 ?? ''}, ${order.store?.address?.city ?? ''}</p>
      <p style="margin-top:8px"><strong>Payment:</strong> ${order.payment?.method ?? '—'}</p>
      <p><strong>Delivery:</strong> ${order.delivery?.deliveryType ?? '—'} (${order.delivery?.status ?? '—'})</p>
    </div>
  </div>
  <table><thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Unit Price</th><th>Tax</th><th>Total</th></tr></thead>
  <tbody>${(order.items ?? []).map((item, i) => `
    <tr><td>${i + 1}</td><td>${item.name}</td><td>${item.quantity}</td>
    <td>₹${item.pricePerUnit?.toFixed(2)}</td>
    <td>₹${(item.taxAmount ?? 0).toFixed(2)}</td>
    <td>₹${item.totalPrice?.toFixed(2)}</td></tr>`).join('')}
  </tbody></table>
  <div class="tots"><div class="tbox">
    <div class="tr"><span>Subtotal</span><span>₹${order.billing?.subTotal?.toFixed(2) ?? '0.00'}</span></div>
    <div class="tr"><span>GST</span><span>₹${(order.billing?.gstAmount ?? 0).toFixed(2)}</span></div>
    <div class="tr"><span>Delivery</span><span>₹${(order.billing?.deliveryCharges ?? 0).toFixed(2)}</span></div>
    <div class="tr"><span>Platform Fee</span><span>₹${(order.billing?.platformFee ?? 0).toFixed(2)}</span></div>
    ${order.billing?.discountAmount ? `<div class="tr"><span>Discount</span><span>-₹${order.billing.discountAmount.toFixed(2)}</span></div>` : ''}
    <div class="tr tot"><span>Total Payable</span><span>₹${order.billing?.totalPayable?.toFixed(2) ?? '0.00'}</span></div>
  </div></div>
  <div class="foot"><p>Thank you for choosing LikesonHealth · This is a system-generated invoice</p><p>support@likeson.in</p></div>
  </body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 500);
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
const CustomTooltip = memo(({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100/90 backdrop-blur-md px-4 py-3 rounded-xl shadow-xl border border-base-300">
      <p className="font-bold text-base-content mb-2 text-[11px] border-b border-base-300 pb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-3 justify-between text-[11px] my-1">
          <span className="flex items-center gap-1.5 text-base-content/80">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
            {p.name}
          </span>
          <strong className="text-base-content font-black">
            {p.name.includes('Revenue') ? `₹${Number(p.value).toLocaleString('en-IN')}` : p.value}
          </strong>
        </div>
      ))}
    </div>
  );
});
CustomTooltip.displayName = 'CustomTooltip';

const StatCard = memo(({ title, value, icon: Icon, trend, color }) => (
  <motion.div variants={fadeUp} className="bg-base-100 rounded-2xl p-5 flex flex-col gap-3 shadow-sm border border-base-200">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold text-base-content/50 uppercase tracking-widest">{title}</span>
      <div className="p-2.5 rounded-xl" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <Icon size={17} style={{ color }} />
      </div>
    </div>
    <p className="text-2xl font-black text-base-content">{value}</p>
    {trend && <div className="flex items-center gap-1 text-[11px] text-success font-bold"><ArrowUpRight size={13} />{trend}</div>}
  </motion.div>
));
StatCard.displayName = 'StatCard';

// Updated: Reduced font size and padding for DeliveryBadge
const DeliveryBadge = memo(({ status }) => {
  const { cls, icon: Icon } = STATUS_CFG[status] ?? { cls: 'badge-info', icon: Clock };
  return <span className={`badge ${cls} gap-1 font-semibold text-[9px] px-2 py-1 h-auto min-h-0`}><Icon size={10} />{status}</span>;
});
DeliveryBadge.displayName = 'DeliveryBadge';

// Updated: Reduced font size and padding for PaymentBadge
const PaymentBadge = memo(({ status }) => (
  <span className={`badge ${PAYMENT_CFG[status] ?? 'badge-info'} font-semibold text-[9px] px-2 py-1 h-auto min-h-0`}>{status}</span>
));
PaymentBadge.displayName = 'PaymentBadge';

const SkeletonRow = () => (
  <tr className="border-b border-base-200">
    {Array(8).fill(0).map((_, i) => <td key={i} className="py-4 px-4"><div className="skeleton h-4 rounded-md w-full bg-base-300" /></td>)}
  </tr>
);

const EmptyState = () => (
  <tr><td colSpan={8}>
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-base-content/30">
      <Package size={64} strokeWidth={1} />
      <p className="text-md font-bold text-base-content/70">No orders found</p>
      <p className="text-xs">Try adjusting your filters to find what you need.</p>
    </div>
  </td></tr>
);

// ─── Order Drawer ─────────────────────────────────────────────────────────────
const OrderDrawer = memo(({ order, onClose }) => {
  if (!order) return null;
  return (
    <motion.div className="fixed inset-0 z-50 flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto shadow-2xl bg-base-100 border-l border-base-200"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
        
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-5 border-b border-base-200 flex items-center justify-between bg-base-100/90 backdrop-blur-md">
          <div>
            <p className="font-black text-md text-primary tracking-wide">{order.orderId}</p>
            <p className="text-[11px] font-medium text-base-content/50 mt-0.5">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => downloadInvoice(order)} className="btn btn-sm btn-primary rounded-lg text-[11px] gap-1.5 shadow-sm">
              <ReceiptText size={14} /> Invoice
            </button>
            <button onClick={onClose} className="btn btn-sm btn-square btn-ghost rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Statuses */}
          <div className="flex gap-2 flex-wrap items-center">
            <DeliveryBadge status={order.delivery?.status} />
            <PaymentBadge status={order.payment?.status} />
            {/* Updated: Reduced font size for Payment Method Tag */}
            <span className="badge badge-outline border-base-300 font-semibold text-[9px] px-2 py-1 h-auto min-h-0 bg-base-200">{order.payment?.method}</span>
          </div>

          {/* Store Details */}
          <div className="bg-base-100 border border-base-200 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">Fulfilled By</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Store size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-base-content text-xs">{order.store?.storeName ?? '—'}</p>
                {/* Updated: Reduced font size for Store Status Tag */}
                <span className="badge badge-success badge-outline text-[9px] px-1.5 py-0.5 h-auto min-h-0 mt-1">{order.store?.status ?? 'Unknown'}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 mt-4 pt-3 border-t border-base-200">
              <div className="flex items-start gap-2 text-[11px] text-base-content/70">
                <Navigation size={13} className="mt-0.5 shrink-0" />
                <span>{order.store?.address?.line1}, {order.store?.address?.city} - {order.store?.address?.pincode}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-base-content/70">
                <Phone size={13} className="shrink-0" />
                <span>{order.store?.contact?.phone ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-base-content/70">
                <Mail size={13} className="shrink-0" />
                <span>{order.store?.contact?.email ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-base-100 border border-base-200 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">Customer Info</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-secondary" />
              </div>
              <div>
                <p className="font-bold text-base-content text-xs">{order.customer?.name ?? '—'}</p>
                <p className="text-[11px] text-base-content/50 mt-0.5">{order.customer?.phone ?? '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 mt-4 pt-3 border-t border-base-200">
               <div className="flex items-start gap-2 text-[11px] text-base-content/70">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                <span>{order.delivery?.address?.line1}, {order.delivery?.address?.city} - {order.delivery?.address?.pincode}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-base-content/70">
                <Mail size={13} className="shrink-0" />
                <span>{order.customer?.email ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-base-100 border border-base-200 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">Order Items ({order.items?.length ?? 0})</p>
            <div className="space-y-4">
              {(order.items ?? []).map((item, i) => (
                <div key={i} className="flex items-start justify-between text-xs border-b border-base-200 pb-3 last:border-0 last:pb-0">
                  <div className="flex gap-3">
                     {item.medicineImage ? (
                        <img src={item.medicineImage} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-base-200 shrink-0" />
                     ) : (
                        <div className="w-10 h-10 rounded-lg bg-base-200 flex items-center justify-center shrink-0"><Package size={16} className="text-base-content/40"/></div>
                     )}
                    <div>
                      <p className="font-bold text-base-content">{item.name}</p>
                      <p className="text-[11px] text-base-content/50 mt-0.5">{item.genericName || item.brandName}</p>
                      <p className="text-[11px] font-semibold text-base-content/60 mt-1">{item.quantity} × ₹{item.pricePerUnit?.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <p className="font-black text-base-content mt-1">₹{item.totalPrice?.toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Billing */}
          <div className="bg-base-100 border border-base-200 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">Billing Summary</p>
            <div className="space-y-2.5">
              {[
                ['Subtotal',     order.billing?.subTotal ?? 0],
                ['GST',          order.billing?.gstAmount ?? 0],
                ['Delivery Fee', order.billing?.deliveryCharges ?? 0],
                ['Platform Fee', order.billing?.platformFee ?? 0],
                ['Discount',     -(order.billing?.discountAmount ?? 0)],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-[11px] font-medium text-base-content/70">
                  <span>{label}</span>
                  <span className={val < 0 ? 'text-success font-bold' : ''}>
                    {val < 0 ? '-' : ''}₹{Math.abs(val).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-black text-md text-primary border-t border-base-200 pt-3 mt-3">
              <span>Total Payable</span>
              <span>₹{order.billing?.totalPayable?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
OrderDrawer.displayName = 'OrderDrawer';

// ─── Refund Modal ─────────────────────────────────────────────────────────────
const RefundModal = memo(({ order, onClose }) => {
  const dispatch = useDispatch();
  const { processing } = useSelector(selectRefundState);
  const [form, setForm] = useState({ amount: order?.billing?.totalPayable ?? '', reason: '', method: 'Wallet' });

  const handleSubmit = useCallback(async () => {
    if (!form.amount || !form.reason) return;
    await dispatch(processOrderRefund({ orderId: order.orderId, refundData: form }));
    onClose();
  }, [dispatch, form, order, onClose]);

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="bg-base-100 rounded-2xl relative w-full max-w-md p-6 z-10 shadow-2xl border border-base-200"
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-md font-black text-base-content flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center"><IndianRupee size={16} className="text-success" /></div>
            Process Refund
          </h3>
          <button onClick={onClose} className="btn btn-sm btn-square btn-ghost rounded-lg"><X size={16} /></button>
        </div>
        <p className="text-[11px] font-medium text-base-content/60 mb-5 bg-base-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <ShoppingBag size={14}/> {order.orderId}
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-base-content/50 mb-1.5 block uppercase tracking-wider">Amount (₹)</label>
            <input className="input w-full bg-base-200/50 border-base-300 focus:border-primary text-xs" type="number" value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-base-content/50 mb-1.5 block uppercase tracking-wider">Refund Method</label>
            <select className="select w-full bg-base-200/50 border-base-300 focus:border-primary text-xs" value={form.method}
              onChange={e => setForm(p => ({ ...p, method: e.target.value }))}>
              <option value="Wallet">Wallet</option>
              <option value="Original_Source">Original Source</option>
              <option value="Bank_Transfer">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-base-content/50 mb-1.5 block uppercase tracking-wider">Reason</label>
            <textarea className="textarea w-full bg-base-200/50 border-base-300 focus:border-primary resize-none text-xs" rows={3} value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Provide reason for refund..." />
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-2">
          <button className="btn btn-outline border-base-300 hover:bg-base-200 hover:text-base-content flex-1 rounded-xl text-xs" onClick={onClose}>Cancel</button>
          <button className="btn btn-success text-white flex-1 flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-success/30 text-xs"
            onClick={handleSubmit} disabled={processing || !form.amount || !form.reason}>
            {processing ? <Loader2 size={16} className="animate-spin" /> : <IndianRupee size={16} />}
            {processing ? 'Processing...' : 'Confirm Refund'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
RefundModal.displayName = 'RefundModal';

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PharmacyOrdersPage() {
  const dispatch = useDispatch();
  const { data: orders, pagination, loading, error } = useSelector(selectPharmacyOrders);
  const [filters, setFilters] = useState({ page: 1, limit: 15, search: '', status: '', paymentStatus: '', startDate: '', endDate: '', minAmount: '', maxAmount: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundOrder, setRefundOrder] = useState(null);

  const fetchData = useCallback(() => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    dispatch(fetchPharmacyOrders(clean));
  }, [dispatch, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setFilter = useCallback((key, val) => {
    setFilters(p => ({ ...p, [key]: val, ...(key !== 'page' ? { page: 1 } : {}) }));
  }, []);

  const statusData = useMemo(() => {
    const m = {};
    DELIVERY_STATUSES.forEach(s => { m[s] = 0; });
    orders.forEach(o => { if (o.delivery?.status) m[o.delivery.status] = (m[o.delivery.status] || 0) + 1; });
    return Object.entries(m).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const chartData = useMemo(() => {
    const m = {};
    [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach(o => {
      const d = new Date(o.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (!m[d]) m[d] = { date: d, Revenue: 0, Orders: 0 };
      m[d].Revenue += (o.billing?.totalPayable || 0);
      m[d].Orders += 1;
    });
    return Object.values(m).slice(-12);
  }, [orders]);

  const stats = useMemo(() => ({
    revenue: orders.reduce((a, o) => a + (o.payment?.status === 'Paid' ? o.billing?.totalPayable || 0 : 0), 0),
    delivered: orders.filter(o => o.delivery?.status === 'Delivered').length,
    pending: orders.filter(o => o.delivery?.status === 'Placed').length,
  }), [orders]);

  const exportCSV = useCallback(() => {
    const rows = ['Order ID,Store Name,Customer,Phone,Amount,Payment,Status,Date',
      ...orders.map(o => `${o.orderId},"${o.store?.storeName ?? ''}","${o.customer?.name ?? ''}","${o.customer?.phone ?? ''}",${o.billing?.totalPayable ?? 0},${o.payment?.status ?? ''},${o.delivery?.status ?? ''},${new Date(o.createdAt).toLocaleDateString('en-IN')}`)
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' }));
    a.download = `orders-${Date.now()}.csv`;
    a.click();
  }, [orders]);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-base-200 pb-4">
        <motion.div variants={fadeUp}>
          <h1 className="text-3xl font-black text-base-content flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 shadow-inner"><ShoppingBag size={28} className="text-primary" /></div>
            Pharmacy Orders
          </h1>
          <p className="text-base-content/50 text-xs mt-2 ml-1 font-medium tracking-wide">Monitor and manage all incoming pharmacy orders in real-time.</p>
        </motion.div>
        <motion.div variants={fadeUp} className="flex gap-3">
          <button onClick={fetchData} className="btn bg-base-100 border-base-300 hover:border-primary hover:text-primary transition-all rounded-xl shadow-sm">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={exportCSV} className="btn btn-primary text-white rounded-xl shadow-lg shadow-primary/30">
            <Download size={16} /> Export Data
          </button>
        </motion.div>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="show" variants={stagger} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Orders" value={pagination.total.toLocaleString()} icon={ShoppingBag} color="#3b82f6" />
        <StatCard title="Page Revenue" value={`₹${stats.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={IndianRupee} color="#10b981" />
        <StatCard title="Delivered" value={stats.delivered} icon={CheckCircle2} color="#10b981" />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="#f59e0b" />
      </motion.div>

      {/* Advanced Charts Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Revenue Area Chart */}
        <div className="lg:col-span-2 bg-base-100 rounded-2xl p-5 border border-base-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10"><TrendingUp size={16} className="text-primary" /></div>
              <h3 className="font-bold text-xl text-base-content">Revenue Analytics</h3>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--base-300)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="Revenue" stroke="var(--primary)" strokeWidth={3} fill="url(#colorRev)" activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--primary)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="bg-base-100 rounded-2xl p-5 border border-base-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-secondary/10"><Package size={16} className="text-secondary" /></div>
            <h3 className="font-bold text-xl text-base-content">Status Breakdown</h3>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  outerRadius={85} innerRadius={55} paddingAngle={3} stroke="none">
                  {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="hover:opacity-80 transition-opacity outline-none" />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: '10px' }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="bg-base-100 rounded-2xl p-5 border border-base-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input className="input w-full pl-10 bg-base-200/50 border-base-300 focus:border-primary rounded-xl" placeholder="Search order ID or customer..."
                value={filters.search} onChange={e => setFilter('search', e.target.value)} />
            </div>
            <select className="select bg-base-200/50 border-base-300 focus:border-primary rounded-xl min-w-[160px]" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              {DELIVERY_STATUSES.map(s => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}
            </select>
            <select className="select bg-base-200/50 border-base-300 focus:border-primary rounded-xl min-w-[160px]" value={filters.paymentStatus} onChange={e => setFilter('paymentStatus', e.target.value)}>
              <option value="">Payment Status</option>
              {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setShowFilters(p => !p)}
              className="btn btn-outline border-base-300 hover:bg-base-200 hover:text-base-content rounded-xl gap-2">
              <Filter size={16} /> {showFilters ? 'Hide Filters' : 'More Filters'}
            </button>
          </div>
          
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-base-200 mt-2">
                  {[['Start Date', 'date', 'startDate'], ['End Date', 'date', 'endDate'], ['Min Amount (₹)', 'number', 'minAmount'], ['Max Amount (₹)', 'number', 'maxAmount']].map(([label, type, key]) => (
                    <div key={key}>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-base-content/50 block mb-1.5 ml-1">{label}</label>
                      <input className="input w-full bg-base-200/50 border-base-300 rounded-xl text-xs" type={type}
                        value={filters[key]} onChange={e => setFilter(key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
        {error && (
          <div className="alert alert-error m-4 text-xs rounded-xl">
            <AlertCircle size={16} /> Failed to fetch orders. <button onClick={fetchData} className="underline ml-2 font-bold">Try Again</button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-base-200 bg-base-200/30">
                {['Order ID', 'Customer Info', 'Store Details', 'Items', 'Amount', 'Payment', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left py-4 px-5 text-[10px] font-black uppercase tracking-widest text-base-content/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array(10).fill(0).map((_, i) => <SkeletonRow key={i} />)
                : orders.length === 0 ? <EmptyState />
                  : orders.map((order, idx) => (
                    <motion.tr key={order._id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                      className="border-b border-base-200/60 hover:bg-base-200/30 transition-colors">
                      <td className="py-4 px-5 font-mono font-bold text-primary text-[11px]">{order.orderId}</td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                            <User size={15} className="text-secondary" />
                          </div>
                          <div>
                            <p className="font-bold text-[11px] text-base-content">{order.customer?.name ?? '—'}</p>
                            <p className="text-[11px] text-base-content/50 font-medium mt-0.5">{order.customer?.phone ?? ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                           <Store size={14} className="text-blue-500 shrink-0"/>
                           <div>
                              <p className="font-bold text-[11px] text-base-content line-clamp-1">{order.store?.storeName ?? '—'}</p>
                              <p className="text-[10px] text-base-content/50 mt-0.5 line-clamp-1">{order.store?.address?.city ?? '—'}</p>
                           </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        {/* Updated: Reduced font size for Items Count Tag */}
                        <span className="badge badge-outline border-base-300 text-[10px] px-2 py-1 h-auto min-h-0 font-semibold">{order.items?.length ?? 0}</span>
                      </td>
                      <td className="py-4 px-5 font-black text-base-content text-xs">
                        ₹{order.billing?.totalPayable?.toLocaleString('en-IN') ?? '—'}
                      </td>
                      <td className="py-4 px-5"><PaymentBadge status={order.payment?.status} /></td>
                      <td className="py-4 px-5"><DeliveryBadge status={order.delivery?.status} /></td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setSelectedOrder(order)}
                            className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-colors tooltip tooltip-top" data-tip="View Details">
                            <Eye size={16} />
                          </button>
                          <button onClick={() => downloadInvoice(order)}
                            className="p-2 rounded-xl hover:bg-secondary/10 text-secondary transition-colors tooltip tooltip-top" data-tip="Download Invoice">
                            <ReceiptText size={16} />
                          </button>
                          {order.cancellation?.isCancelled && order.cancellation?.refundStatus !== 'Processed' && (
                            <button onClick={() => setRefundOrder(order)}
                              className="p-2 rounded-xl hover:bg-success/10 text-success transition-colors tooltip tooltip-top" data-tip="Process Refund">
                              <IndianRupee size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-base-200 bg-base-200/20">
            <p className="text-[11px] font-medium text-base-content/50">Showing page <strong className="text-base-content">{pagination.page}</strong> of <strong>{pagination.pages}</strong> ({pagination.total.toLocaleString()} total)</p>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => setFilter('page', filters.page - 1)}
                className="btn btn-sm btn-outline border-base-300 rounded-lg px-3 disabled:opacity-30"><ChevronLeft size={14} /></button>
              <button disabled={pagination.page >= pagination.pages} onClick={() => setFilter('page', filters.page + 1)}
                className="btn btn-sm btn-outline border-base-300 rounded-lg px-3 disabled:opacity-30"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedOrder && <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
        {refundOrder && <RefundModal order={refundOrder} onClose={() => setRefundOrder(null)} />}
      </AnimatePresence>
    </div>
  );
}