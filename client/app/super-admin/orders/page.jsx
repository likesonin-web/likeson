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
  ReceiptText, MapPin, Phone, Mail, Tag
} from 'lucide-react';
import {
  fetchPharmacyOrders, processOrderRefund,
  selectPharmacyOrders, selectRefundState
} from '@/store/slices/superadminSlice';

// ─── Constants ────────────────────────────────────────────────────────────────
const DELIVERY_STATUSES = ['Placed','Confirmed','Processing','Out-for-Delivery','Delivered','Cancelled','Returned'];
const PAYMENT_STATUSES  = ['Pending','Paid','Failed','Refunded'];
const STATUS_CFG = {
  Placed:             { cls: 'badge-info',    icon: Clock },
  Confirmed:          { cls: 'badge-primary', icon: CheckCircle2 },
  Processing:         { cls: 'badge-warning', icon: Package },
  'Out-for-Delivery': { cls: 'badge-warning', icon: Truck },
  Delivered:          { cls: 'badge-success', icon: CheckCircle2 },
  Cancelled:          { cls: 'badge-error',   icon: XCircle },
  Returned:           { cls: 'badge-error',   icon: AlertCircle },
};
const PAYMENT_CFG = { Pending:'badge-warning', Paid:'badge-success', Failed:'badge-error', Refunded:'badge-info' };
const CHART_COLORS = ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)','var(--chart-6)'];
const fadeUp  = { hidden:{ opacity:0, y:20 }, show:{ opacity:1, y:0 } };
const stagger = { show:{ transition:{ staggerChildren:0.07 } } };

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
    <div><div class="brand">Likeson<span>Health</span></div><p style="font-size:11px;color:#9ca3af;margin-top:4px;">Premium Healthcare Platform · Vijayawada, AP</p></div>
    <div class="imeta"><h2>INVOICE</h2><p><strong>${order.orderId}</strong></p><p>${new Date(order.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p><p>Status: ${order.payment?.status ?? 'N/A'}</p></div>
  </div>
  <div class="parties">
    <div class="pbox"><h4>Billed To</h4><strong>${order.customer?.name ?? 'Customer'}</strong>
      <p>${order.customer?.email ?? ''}</p><p>${order.customer?.phone ?? ''}</p>
      <p>${order.delivery?.address?.line1 ?? ''}</p>
      <p>${order.delivery?.address?.city ?? ''} – ${order.delivery?.address?.pincode ?? ''}</p>
    </div>
    <div class="pbox"><h4>Fulfilled By</h4><strong>${order.store?.name ?? 'Pharmacy Store'}</strong>
      <p>Payment: ${order.payment?.method ?? '—'}</p>
      <p>Delivery: ${order.delivery?.deliveryType ?? '—'}</p>
      <p>Status: ${order.delivery?.status ?? '—'}</p>
    </div>
  </div>
  <table><thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Unit Price</th><th>Tax</th><th>Total</th></tr></thead>
  <tbody>${(order.items ?? []).map((item, i) => `
    <tr><td>${i+1}</td><td>${item.name}</td><td>${item.quantity}</td>
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
  <div class="foot"><p>Thank you for choosing LikesonHealth · This is a system-generated invoice</p><p>support@likesonhealth.com</p></div>
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
    <div className="glass-card px-4 py-3 text-sm shadow-xl border border-base-300">
      <p className="font-bold text-base-content mb-1 text-xs">{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{color:p.color}} className="text-xs">
          {p.name}: <strong>₹{Number(p.value).toLocaleString('en-IN')}</strong>
        </p>
      ))}
    </div>
  );
});
CustomTooltip.displayName = 'CustomTooltip';

const StatCard = memo(({ title, value, icon: Icon, trend, color }) => (
  <motion.div variants={fadeUp} className="glass-card p-5 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">{title}</span>
      <div className="p-2.5 rounded-xl" style={{background:`color-mix(in srgb, ${color} 15%, transparent)`}}>
        <Icon size={17} style={{color}}/>
      </div>
    </div>
    <p className="text-2xl font-black text-base-content">{value}</p>
    {trend && <div className="flex items-center gap-1 text-xs text-success font-semibold"><ArrowUpRight size={13}/>{trend}</div>}
  </motion.div>
));
StatCard.displayName = 'StatCard';

const DeliveryBadge = memo(({ status }) => {
  const {cls, icon:Icon} = STATUS_CFG[status] ?? {cls:'badge-info', icon:Clock};
  return <span className={`badge ${cls} gap-1`}><Icon size={11}/>{status}</span>;
});
DeliveryBadge.displayName = 'DeliveryBadge';

const PaymentBadge = memo(({ status }) => (
  <span className={`badge ${PAYMENT_CFG[status] ?? 'badge-info'}`}>{status}</span>
));
PaymentBadge.displayName = 'PaymentBadge';

const SkeletonRow = () => (
  <tr className="border-b border-base-300">
    {Array(8).fill(0).map((_,i) => <td key={i} className="py-4 px-4"><div className="skeleton h-4 rounded w-full"/></td>)}
  </tr>
);

const EmptyState = () => (
  <tr><td colSpan={8}>
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-base-content/30">
      <Package size={64} strokeWidth={0.8}/>
      <p className="text-lg font-bold">No orders found</p>
      <p className="text-sm">Try adjusting your filters</p>
    </div>
  </td></tr>
);

// ─── Order Drawer ─────────────────────────────────────────────────────────────
const OrderDrawer = memo(({ order, onClose }) => {
  if (!order) return null;
  return (
    <motion.div className="fixed inset-0 z-50 flex" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <motion.div
        className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto shadow-2xl"
        style={{background:'var(--base-100)'}}
        initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
        transition={{type:'spring',damping:28,stiffness:280}}>
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-base-300 flex items-center justify-between"
          style={{background:'color-mix(in srgb, var(--base-100) 95%, transparent)', backdropFilter:'blur(16px)'}}>
          <div>
            <p className="font-black text-base-content">{order.orderId}</p>
            <p className="text-xs text-base-content/40">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => downloadInvoice(order)}
              className="btn-primary-cta !py-2 !px-3 flex items-center gap-1.5 text-xs">
              <ReceiptText size={13}/> Print Invoice
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-base-200 transition-colors">
              <X size={18}/>
            </button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* Statuses */}
          <div className="flex gap-2 flex-wrap">
            <DeliveryBadge status={order.delivery?.status}/>
            <PaymentBadge status={order.payment?.status}/>
            <span className="badge badge-primary">{order.payment?.method}</span>
          </div>
          {/* Customer */}
          <div className="glass-card p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Customer Details</p>
            <div className="flex items-center gap-2 text-sm font-semibold"><User size={13} className="text-primary"/>{order.customer?.name ?? '—'}</div>
            <div className="flex items-center gap-2 text-xs text-base-content/50"><Mail size={12}/>{order.customer?.email ?? '—'}</div>
            <div className="flex items-center gap-2 text-xs text-base-content/50"><Phone size={12}/>{order.customer?.phone ?? '—'}</div>
            <div className="flex items-center gap-2 text-xs text-base-content/50"><MapPin size={12}/>{order.delivery?.address?.line1}, {order.delivery?.address?.city} – {order.delivery?.address?.pincode}</div>
          </div>
          {/* Items */}
          <div className="glass-card p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Items ({order.items?.length ?? 0})</p>
            <div className="space-y-3">
              {(order.items ?? []).map((item,i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-base-300 pb-2.5 last:border-0">
                  <div>
                    <p className="font-semibold text-base-content">{item.name}</p>
                    <p className="text-xs text-base-content/40">{item.quantity} × ₹{item.pricePerUnit?.toLocaleString('en-IN')}</p>
                  </div>
                  <p className="font-black text-base-content">₹{item.totalPrice?.toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Billing */}
          <div className="glass-card p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Billing Breakdown</p>
            {[
              ['Subtotal',     order.billing?.subTotal ?? 0],
              ['GST',          order.billing?.gstAmount ?? 0],
              ['Delivery',     order.billing?.deliveryCharges ?? 0],
              ['Platform Fee', order.billing?.platformFee ?? 0],
              ['Discount',     -(order.billing?.discountAmount ?? 0)],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm text-base-content/60 mb-2">
                <span>{label}</span>
                <span className={val < 0 ? 'text-success font-semibold' : ''}>
                  {val < 0 ? '-' : ''}₹{Math.abs(val).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-black text-base-content text-base border-t border-base-300 pt-3 mt-2">
              <span>Total Payable</span>
              <span>₹{order.billing?.totalPayable?.toLocaleString('en-IN')}</span>
            </div>
          </div>
          {order.billing?.promoCode && (
            <div className="alert alert-success text-sm flex items-center gap-2">
              <Tag size={14}/> Promo: <strong>{order.billing.promoCode}</strong>
            </div>
          )}
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
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
      <motion.div className="glass-card relative w-full max-w-md p-6 z-10"
        initial={{scale:0.92, y:20}} animate={{scale:1, y:0}} exit={{scale:0.92, y:20}}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black text-base-content flex items-center gap-2">
            <IndianRupee size={20} className="text-success"/> Process Refund
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-base-200"><X size={16}/></button>
        </div>
        <p className="text-xs text-base-content/40 mb-5 font-mono bg-base-200 rounded-lg px-3 py-2">Order: {order.orderId}</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-base-content/50 mb-1.5 block uppercase tracking-wider">Amount (₹)</label>
            <input className="input-field w-full" type="number" value={form.amount}
              onChange={e => setForm(p => ({...p, amount: e.target.value}))}/>
          </div>
          <div>
            <label className="text-xs font-bold text-base-content/50 mb-1.5 block uppercase tracking-wider">Refund Method</label>
            <select className="input-field w-full" value={form.method}
              onChange={e => setForm(p => ({...p, method: e.target.value}))}>
              <option value="Wallet">Wallet</option>
              <option value="Original_Source">Original Source</option>
              <option value="Bank_Transfer">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-base-content/50 mb-1.5 block uppercase tracking-wider">Reason</label>
            <textarea className="input-field w-full resize-none" rows={3} value={form.reason}
              onChange={e => setForm(p => ({...p, reason: e.target.value}))} placeholder="Reason for refund…"/>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-success flex-1 flex items-center justify-center gap-2"
            onClick={handleSubmit} disabled={processing || !form.amount || !form.reason}>
            {processing ? <Loader2 size={15} className="animate-spin"/> : <IndianRupee size={15}/>}
            {processing ? 'Processing…' : 'Confirm Refund'}
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
  const [filters, setFilters]       = useState({ page:1, limit:15, search:'', status:'', paymentStatus:'', startDate:'', endDate:'', minAmount:'', maxAmount:'' });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundOrder, setRefundOrder] = useState(null);

  const fetchData = useCallback(() => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== ''));
    dispatch(fetchPharmacyOrders(clean));
  }, [dispatch, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setFilter = useCallback((key, val) => {
    setFilters(p => ({...p, [key]: val, ...(key !== 'page' ? {page:1} : {})}));
  }, []);

  const statusData = useMemo(() => {
    const m = {};
    DELIVERY_STATUSES.forEach(s => { m[s] = 0; });
    orders.forEach(o => { if (o.delivery?.status) m[o.delivery.status] = (m[o.delivery.status]||0)+1; });
    return Object.entries(m).filter(([,v]) => v > 0).map(([name,value]) => ({name,value}));
  }, [orders]);

  const revenueData = useMemo(() => {
    const m = {};
    [...orders].sort((a,b) => new Date(a.createdAt)-new Date(b.createdAt)).forEach(o => {
      const d = new Date(o.createdAt).toLocaleDateString('en-IN',{month:'short',day:'numeric'});
      m[d] = (m[d]||0) + (o.billing?.totalPayable||0);
    });
    return Object.entries(m).slice(-12).map(([date,revenue]) => ({date,revenue}));
  }, [orders]);

  const stats = useMemo(() => ({
    revenue:   orders.reduce((a,o) => a + (o.payment?.status==='Paid' ? o.billing?.totalPayable||0 : 0), 0),
    delivered: orders.filter(o => o.delivery?.status==='Delivered').length,
    pending:   orders.filter(o => o.delivery?.status==='Placed').length,
  }), [orders]);

  const exportCSV = useCallback(() => {
    const rows = ['Order ID,Customer,Phone,Amount,Payment,Status,Date',
      ...orders.map(o => `${o.orderId},"${o.customer?.name??''}","${o.customer?.phone??''}",${o.billing?.totalPayable??0},${o.payment?.status??''},${o.delivery?.status??''},${new Date(o.createdAt).toLocaleDateString('en-IN')}`)
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows],{type:'text/csv'}));
    a.download = `orders-${Date.now()}.csv`;
    a.click();
  }, [orders]);

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={stagger}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div variants={fadeUp}>
          <h1 className="text-responsive-xl font-black text-base-content flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10"><ShoppingBag size={26} className="text-primary"/></div>
            Pharmacy Orders
          </h1>
          <p className="text-base-content/40 text-sm mt-1 ml-1">Real-time order monitoring &amp; management</p>
        </motion.div>
        <motion.div variants={fadeUp} className="flex gap-2 flex-wrap">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2 !py-2 !px-4">
            <RefreshCw size={14}/> Refresh
          </button>
          <button onClick={exportCSV} className="btn-primary-cta flex items-center gap-2 !py-2 !px-4">
            <Download size={14}/> Export CSV
          </button>
        </motion.div>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="show" variants={stagger} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Orders"  value={pagination.total.toLocaleString()} icon={ShoppingBag} trend="+12% this week" color="var(--primary)"/>
        <StatCard title="Page Revenue"  value={`₹${stats.revenue.toLocaleString('en-IN',{maximumFractionDigits:0})}`} icon={IndianRupee} trend="+8% vs last" color="var(--success)"/>
        <StatCard title="Delivered"     value={stats.delivered} icon={CheckCircle2} color="var(--success)"/>
        <StatCard title="Pending"       value={stats.pending}   icon={Clock}        color="var(--warning)"/>
      </motion.div>

      {/* Charts */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.18}}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-primary"/>
            <h3 className="font-bold text-base-content text-sm">Revenue Trend (Current Page)</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{top:4,right:4,bottom:0,left:4}}>
              <defs>
                <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)"/>
              <XAxis dataKey="date" tick={{fontSize:10,fill:'var(--base-content)',opacity:0.4}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:'var(--base-content)',opacity:0.4}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="url(#revG)" strokeWidth={2.5} name="Revenue ₹"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Package size={16} className="text-secondary"/>
            <h3 className="font-bold text-base-content text-sm">Status Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                outerRadius={72} innerRadius={38} paddingAngle={4}>
                {statusData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
              </Pie>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{fontSize:10}} iconType="circle"/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.25}}>
        <div className="glass-card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"/>
              <input className="input-field w-full pl-9" placeholder="Search order ID…"
                value={filters.search} onChange={e => setFilter('search', e.target.value)}/>
            </div>
            <select className="input-field" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              {DELIVERY_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="input-field" value={filters.paymentStatus} onChange={e => setFilter('paymentStatus', e.target.value)}>
              <option value="">Payment Status</option>
              {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={() => setShowFilters(p=>!p)}
              className="btn-secondary flex items-center gap-2 !py-2 !px-4 whitespace-nowrap">
              <Filter size={14}/> {showFilters ? 'Less' : 'More Filters'}
            </button>
          </div>
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-base-300">
                  {[['Start Date','date','startDate'],['End Date','date','endDate'],['Min ₹','number','minAmount'],['Max ₹','number','maxAmount']].map(([label,type,key]) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-base-content/40 block mb-1">{label}</label>
                      <input className="input-field w-full" type={type}
                        value={filters[key]} onChange={e => setFilter(key, e.target.value)}/>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.3}} className="glass-card overflow-hidden">
        {error && (
          <div className="alert alert-error m-4 text-sm">
            <AlertCircle size={15}/> Failed to load. <button onClick={fetchData} className="underline ml-2">Retry</button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base-300 bg-base-200/50">
                {['Order ID','Customer','Store','Items','Amount','Payment','Status','Actions'].map(h => (
                  <th key={h} className="text-left py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-base-content/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array(10).fill(0).map((_,i) => <SkeletonRow key={i}/>)
               : orders.length === 0 ? <EmptyState/>
               : orders.map((order, idx) => (
                <motion.tr key={order._id}
                  initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:idx*0.025}}
                  className="border-b border-base-300/40 hover:bg-base-200/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-black text-primary text-xs tracking-wide">{order.orderId}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User size={13} className="text-primary"/>
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-base-content">{order.customer?.name ?? '—'}</p>
                        <p className="text-xs text-base-content/40">{order.customer?.phone ?? ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1 text-xs text-base-content/60">
                      <Store size={12}/> {order.store?.name ?? '—'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-base-content/60">{order.items?.length ?? 0} items</td>
                  <td className="py-3.5 px-4 font-black text-base-content">
                    ₹{order.billing?.totalPayable?.toLocaleString('en-IN') ?? '—'}
                  </td>
                  <td className="py-3.5 px-4"><PaymentBadge status={order.payment?.status}/></td>
                  <td className="py-3.5 px-4"><DeliveryBadge status={order.delivery?.status}/></td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedOrder(order)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="View">
                        <Eye size={14}/>
                      </button>
                      <button onClick={() => downloadInvoice(order)}
                        className="p-1.5 rounded-lg hover:bg-secondary/10 text-secondary transition-colors" title="Invoice">
                        <ReceiptText size={14}/>
                      </button>
                      {order.cancellation?.isCancelled && order.cancellation?.refundStatus !== 'Processed' && (
                        <button onClick={() => setRefundOrder(order)}
                          className="p-1.5 rounded-lg hover:bg-success/10 text-success transition-colors" title="Refund">
                          <IndianRupee size={14}/>
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-base-300 bg-base-200/30">
            <p className="text-xs text-base-content/40">Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} total</p>
            <div className="flex gap-2">
              <button disabled={pagination.page<=1} onClick={() => setFilter('page', filters.page-1)}
                className="btn-secondary !py-1.5 !px-3 disabled:opacity-30"><ChevronLeft size={14}/></button>
              <button disabled={pagination.page>=pagination.pages} onClick={() => setFilter('page', filters.page+1)}
                className="btn-secondary !py-1.5 !px-3 disabled:opacity-30"><ChevronRight size={14}/></button>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedOrder && <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)}/>}
        {refundOrder   && <RefundModal order={refundOrder}   onClose={() => setRefundOrder(null)}/>}
      </AnimatePresence>
    </div>
  );
}