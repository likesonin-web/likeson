'use client';

 

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Package, Clock, CheckCircle2, XCircle, Truck,
  ChevronRight, Search, RefreshCw, FlaskConical,
  AlertCircle, CreditCard, Wallet, Star, Banknote,
  Calendar, ReceiptText, SlidersHorizontal, X, ChevronDown,
  PackageOpen, RotateCcw, BadgeCheck,
  TrendingUp, ShoppingCart, MapPin, Eye, FileText,
} from 'lucide-react';

import {
  fetchMyOrders,
  selectOrders,
  selectOrdersPagination,
  selectPharmacyGlobalLoading,
  selectOrderError,
} from '@/store/slices/pharmacyOrderSlice';
import BackButton from '../../../components/BackButton';

// ═══════════════════════════════════════════════════════════════════════════════
// § CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * STATUS_CONFIG — maps each delivery.status value to display metadata.
 * accentHex is used by the LIKESON SVG watermark pattern.
 */
const STATUS_CONFIG = {
  Placed:             { color: 'text-info',    bg: 'bg-info/10',    border: 'border-info/30',    icon: PackageOpen,  label: 'Placed',           accentHex: '#38bdf8' },
  Confirmed:          { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30', icon: BadgeCheck,   label: 'Confirmed',        accentHex: '#6366f1' },
  Processing:         { color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', icon: RotateCcw,    label: 'Processing',       accentHex: '#f59e0b' },
  'Out-for-Delivery': { color: 'text-accent',  bg: 'bg-accent/10',  border: 'border-accent/30',  icon: Truck,        label: 'Out for Delivery', accentHex: '#06b6d4' },
  Delivered:          { color: 'text-success', bg: 'bg-success/10', border: 'border-success/30', icon: CheckCircle2, label: 'Delivered',        accentHex: '#22c55e' },
  Cancelled:          { color: 'text-error',   bg: 'bg-error/10',   border: 'border-error/30',   icon: XCircle,      label: 'Cancelled',        accentHex: '#ef4444' },
  Returned:           { color: 'text-neutral', bg: 'bg-base-300',   border: 'border-base-300',   icon: RotateCcw,    label: 'Returned',         accentHex: '#6b7280' },
};

const PAYMENT_STATUS = {
  Paid:     { color: 'text-success', icon: BadgeCheck },
  Pending:  { color: 'text-warning', icon: Clock      },
  Failed:   { color: 'text-error',   icon: XCircle    },
  Refunded: { color: 'text-info',    icon: RotateCcw  },
};

const PAYMENT_METHOD_ICON = {
  Razorpay: CreditCard,
  Wallet:   Wallet,
  COD:      Banknote,
};

// ═══════════════════════════════════════════════════════════════════════════════
// § HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatCurrency = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ═══════════════════════════════════════════════════════════════════════════════
// § SVG WATERMARK — tiled "LIKESON" stroke pattern
// accentHex controls the stroke colour; opacity is very low so it's subtle.
// ═══════════════════════════════════════════════════════════════════════════════

function LikesonPattern({ accentHex = '#6366f1', opacity = 0.045 }) {
  const id = `lks-${accentHex.replace('#', '')}`;
  return (
    <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={id} x="0" y="0" width="120" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-22)">
          <line x1="0" y1="0" x2="0" y2="40" stroke={accentHex} strokeWidth="0.6" strokeOpacity={opacity * 2.5} />
          <line x1="60" y1="0" x2="60" y2="40" stroke={accentHex} strokeWidth="0.3" strokeOpacity={opacity} />
          <text x="4" y="26" fontFamily="'Arial Black', 'Arial', sans-serif" fontSize="11" fontWeight="900" letterSpacing="2" fill="none"
            stroke={accentHex} strokeWidth="0.9" strokeOpacity={opacity * 2}>LIKESON</text>
          <line x1="0" y1="40" x2="120" y2="0" stroke={accentHex} strokeWidth="0.4" strokeOpacity={opacity * 1.5} strokeDasharray="3 9" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function OrderSkeleton() {
  return (
    <div className="relative bg-base-100 rounded-2xl border border-base-300 p-4 space-y-3 overflow-hidden animate-pulse">
      <LikesonPattern accentHex="#6366f1" opacity={0.03} />
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 bg-base-300 rounded-lg" />
        <div className="h-6 w-24 bg-base-300 rounded-full" />
      </div>
      <div className="h-3 w-40 bg-base-300 rounded" />
      <div className="flex gap-3 mt-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-10 h-10 bg-base-300 rounded-xl" />
            <div className="space-y-1">
              <div className="h-3 w-24 bg-base-300 rounded" />
              <div className="h-3 w-16 bg-base-300 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-base-300">
        <div className="h-4 w-20 bg-base-300 rounded" />
        <div className="h-8 w-28 bg-base-300 rounded-xl" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § ORDER CARD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * OrderCard
 * ────────────────────────────────────────────────────────────────────────────
 * Each card shows:
 *  - Order ID + status pill
 *  - Date + delivery city
 *  - Total + payment status
 *  - Up to 2 medicine item previews (+N badge for more)
 *  - Prescription badge (Approved ✓ / Rejected ✗ / Pending •)
 *  - Payment method + discount
 *  - "Details" CTA button
 *  - LIKESON watermark pattern (subtle stroke lines + brand text)
 */
function OrderCard({ order, index, onView }) {
  const status     = order.delivery?.status || 'Placed';
  const cfg        = STATUS_CONFIG[status]   || STATUS_CONFIG.Placed;
  const StatusIcon = cfg.icon;

  const payMethod     = order.payment?.method;
  const PayIcon       = PAYMENT_METHOD_ICON[payMethod] || CreditCard;
  const payCfg        = PAYMENT_STATUS[order.payment?.status] || PAYMENT_STATUS.Pending;
  const PayStatusIcon = payCfg.icon;

  // Show first 2 items; extra count badge if more
  const displayItems = order.items?.slice(0, 2) || [];
  const extraCount   = (order.items?.length || 0) - 2;

  // Prescription state — check both order-level and item-level
  const hasRx    = order.prescription?.isRequired || order.items?.some((i) => i.isPrescriptionRequired);
  const rxStatus = order.prescription?.verificationStatus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: 'spring', damping: 18, stiffness: 120 }}
      className="group relative bg-base-100 rounded-2xl border border-base-300 hover:border-primary/40 hover:shadow-xl transition-all duration-300 overflow-hidden"
    >
      {/* LIKESON stroke watermark — purely decorative, aria-hidden */}
      <LikesonPattern accentHex={cfg.accentHex} opacity={0.04} />

      {/* Top status accent bar — colour matches delivery status */}
      <div className={`relative h-1.5 w-full overflow-hidden ${
        status === 'Delivered'        ? 'bg-success'  :
        status === 'Cancelled'        ? 'bg-error'    :
        status === 'Out-for-Delivery' ? 'bg-accent'   :
        status === 'Processing'       ? 'bg-warning'  : 'bg-primary'
      }`}>
        {/* Shimmer sweep on hover */}
        <motion.div className="absolute inset-0 bg-white/30" initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }} transition={{ duration: 0.6, ease: 'easeInOut' }} />
      </div>

      <div className="relative p-4">

        {/* Header — order ID, status pill, total, payment status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Note: Unique order reference number (ORD-XXXXXX-XXXXXXX) */}
              <span className="font-black text-sm text-base-content tracking-tight font-mono">{order.orderId}</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wide ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-base-content/40">
              {/* Note: Date the order was placed */}
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(order.createdAt)}</span>
              {order.delivery?.address?.city && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{order.delivery.address.city}</span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {/* Note: Total amount payable for this order including GST */}
            <p className="font-black text-base text-base-content">{formatCurrency(order.billing?.totalPayable)}</p>
            <div className={`flex items-center justify-end gap-1 text-[10px] font-bold ${payCfg.color}`}>
              <PayStatusIcon className="w-3 h-3" />
              {order.payment?.status}
            </div>
          </div>
        </div>

        {/* Medicine item previews */}
        <div className="flex flex-wrap gap-2 mb-3">
          {displayItems.map((item, i) => (
            <motion.div key={i}
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.06 + i * 0.05 }}
              className="flex items-center gap-2 bg-base-200/80 backdrop-blur-sm rounded-xl px-2.5 py-1.5 max-w-[190px] border border-base-300/50"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                <FlaskConical className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              <div className="min-w-0">
                {/* Note: Medicine brand name */}
                <p className="text-xs font-semibold text-base-content truncate">{item.name}</p>
                {/* Note: Quantity × line total price */}
                <p className="text-[10px] text-base-content/40">×{item.quantity} · {formatCurrency(item.totalPrice)}</p>
              </div>
            </motion.div>
          ))}
          {extraCount > 0 && (
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-base-300/70 text-xs font-black text-base-content/50 border border-base-300">
              +{extraCount}
            </div>
          )}
        </div>

        {/* Footer — payment method, discount, prescription badge, details button */}
        <div className="flex items-center justify-between pt-3 border-t border-base-300/60">
          <div className="flex items-center gap-3 text-xs text-base-content/50 flex-wrap">
            <span className="flex items-center gap-1">
              <PayIcon className="w-3.5 h-3.5" />
              {payMethod}
            </span>
            {order.billing?.discountAmount > 0 && (
              // Note: Discount from coupon or subscription plan
              <span className="flex items-center gap-1 text-success font-semibold">
                -{formatCurrency(order.billing.discountAmount)} off
              </span>
            )}
            {hasRx && (
              // Note: Rx = prescription required; ✓ approved, ✗ rejected, • pending
              <span className={`flex items-center gap-1 font-semibold ${
                rxStatus === 'Approved' ? 'text-success' : rxStatus === 'Rejected' ? 'text-error' : 'text-warning'
              }`}>
                <FileText className="w-3.5 h-3.5" />
                Rx {rxStatus === 'Approved' ? '✓' : rxStatus === 'Rejected' ? '✗' : '•'}
              </span>
            )}
          </div>

          <button onClick={() => onView(order._id)}
            className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 overflow-hidden ${cfg.bg} ${cfg.color} border ${cfg.border} hover:brightness-110 hover:shadow-md group/btn`}>
            <motion.span className="absolute inset-0 bg-white/20" initial={{ x: '-100%' }} whileHover={{ x: '100%' }} transition={{ duration: 0.4 }} />
            <Eye className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Details</span>
            <ChevronRight className="w-3 h-3 relative z-10 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* LIKESON corner text — brand watermark, aria-hidden */}
      <div aria-hidden="true" className="absolute bottom-3 right-4 font-black text-[9px] tracking-[0.35em] uppercase select-none pointer-events-none" style={{ color: cfg.accentHex, opacity: 0.18 }}>
        LIKESON
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § STATS ROW — summary metrics at the top of the page
// ═══════════════════════════════════════════════════════════════════════════════

function StatsRow({ orders }) {
  const total      = orders.length;
  const delivered  = orders.filter((o) => o.delivery?.status === 'Delivered').length;
  const pending    = orders.filter((o) => !['Delivered', 'Cancelled', 'Returned'].includes(o.delivery?.status)).length;
  const totalSpent = orders.filter((o) => o.payment?.status === 'Paid').reduce((s, o) => s + (o.billing?.totalPayable || 0), 0);

  const stats = [
    { label: 'Total Orders', value: total,                     icon: ShoppingBag,  color: 'text-primary',   bg: 'bg-primary/10',   accentHex: '#6366f1' },
    { label: 'Delivered',    value: delivered,                 icon: CheckCircle2, color: 'text-success',   bg: 'bg-success/10',   accentHex: '#22c55e' },
    { label: 'In Progress',  value: pending,                   icon: Truck,        color: 'text-accent',    bg: 'bg-accent/10',    accentHex: '#06b6d4' },
    { label: 'Total Spent',  value: formatCurrency(totalSpent), icon: TrendingUp,  color: 'text-secondary', bg: 'bg-secondary/10', accentHex: '#a855f7' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map((s, i) => (
        <motion.div key={s.label}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, type: 'spring', damping: 16 }}
          className="relative bg-base-100 rounded-2xl border border-base-300 p-4 flex items-center gap-3 overflow-hidden"
        >
          <LikesonPattern accentHex={s.accentHex} opacity={0.03} />
          <div className={`relative w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
            <s.icon className={`w-5 h-5 ${s.color}`} />
          </div>
          <div className="relative min-w-0">
            {/* Note: Stat value — order count or formatted currency */}
            <p className={`font-black text-lg leading-tight ${s.color}`}>{s.value}</p>
            <p className="text-xs text-base-content/40 truncate">{s.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

function EmptyState({ hasFilters, onClear }) {
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className="relative flex flex-col items-center justify-center py-20 text-center bg-base-100 rounded-3xl border border-base-300 overflow-hidden">
      <LikesonPattern accentHex="#6366f1" opacity={0.025} />
      <div className="relative w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-5">
        <ShoppingCart className="w-10 h-10 text-primary/40" />
      </div>
      <h3 className="relative font-black text-base-content text-lg mb-1">
        {hasFilters ? 'No matching orders' : 'No orders yet'}
      </h3>
      <p className="relative text-sm text-base-content/40 mb-6 max-w-xs">
        {hasFilters ? "Try adjusting your filters to find what you're looking for." : 'Your pharmacy order history will appear here once you place an order.'}
      </p>
      {hasFilters && (
        <button onClick={onClear} className="relative px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/80 transition-all">
          Clear Filters
        </button>
      )}
      <p className="relative mt-6 text-[10px] font-black tracking-[0.4em] text-base-content/15 uppercase">Likeson Healthcare</p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function MyOrders() {
  const dispatch   = useDispatch();
  const router     = useRouter();

  const orders     = useSelector(selectOrders);
  const pagination = useSelector(selectOrdersPagination);
  const loading    = useSelector(selectPharmacyGlobalLoading);
  const error      = useSelector(selectOrderError);

  // Client-side filter/search state (server paginates, client filters within the page)
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [page,          setPage]          = useState(1);
  const [showFilters,   setShowFilters]   = useState(false);

  useEffect(() => {
    dispatch(fetchMyOrders({ page, limit: 10 }));
  }, [dispatch, page]);

  /**
   * Client-side filtering within the current paginated page:
   *  - Matches order ID, medicine name, or store name against the search query
   *  - Filters by delivery status and payment method if chips are selected
   */
  const filtered = orders.filter((o) => {
    if (filterStatus  && o.delivery?.status !== filterStatus)  return false;
    if (filterPayment && o.payment?.method  !== filterPayment) return false;
    if (search) {
      const q        = search.toLowerCase();
      const matchId  = o.orderId?.toLowerCase().includes(q);
      const matchItem = o.items?.some((i) => i.name?.toLowerCase().includes(q));
      const matchStore = typeof o.store === 'object' ? o.store?.storeName?.toLowerCase().includes(q) : false;
      if (!matchId && !matchItem && !matchStore) return false;
    }
    return true;
  });

  const clearFilters = () => { setFilterStatus(''); setFilterPayment(''); setSearch(''); };
  const hasFilters   = !!(filterStatus || filterPayment || search);

  // Support both `pages` and `totalPages` shapes from the API
  const totalPages = pagination.totalPages ?? pagination.pages ?? 1;

  return (
    <div className="min-h-screen bg-base-200 pb-6 pt-2 px-4">
      <div className="max-w-3xl mx-auto">
       <BackButton className="mb-4" label="Back to Dashboard" />
        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shadow-sm overflow-hidden">
                <LikesonPattern accentHex="#6366f1" opacity={0.08} />
                <ShoppingBag className="relative w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-black text-xl text-base-content leading-tight">My Orders</h1>
                {/* Note: Total orders count from server pagination */}
                <p className="text-xs text-base-content/40">{pagination.total ?? orders.length} order{(pagination.total ?? orders.length) !== 1 ? 's' : ''} total</p>
              </div>
            </div>
            <button onClick={() => dispatch(fetchMyOrders({ page, limit: 10 }))} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-base-100 border border-base-300 rounded-xl text-xs font-semibold text-base-content/60 hover:border-primary hover:text-primary disabled:opacity-40 transition-all">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Stats row — only shown when orders are loaded */}
        {!loading && orders.length > 0 && <StatsRow orders={orders} />}

        {/* Search + Filter bar */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-base-100 rounded-2xl border border-base-300 p-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
              {/* Note: Search by order ID (e.g. ORD-ABC123), medicine name, or store name */}
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order ID, medicine or store…"
                className="w-full pl-9 pr-8 py-2.5 bg-base-200 rounded-xl text-sm text-base-content placeholder:text-base-content/30 border border-transparent focus:border-primary focus:outline-none transition-colors" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-error transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${showFilters || hasFilters ? 'bg-primary text-primary-content border-primary shadow-sm shadow-primary/20' : 'bg-base-200 text-base-content/60 border-transparent hover:border-primary/40'}`}>
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasFilters && (
                <span className="w-4 h-4 rounded-full bg-white/30 text-[10px] font-black flex items-center justify-center">!</span>
              )}
            </button>
          </div>

          {/* Expandable filter chips panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-3 mt-3 border-t border-base-300 space-y-2.5">

                  {/* Delivery status filter chips */}
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-[10px] text-base-content/40 font-black uppercase tracking-widest pt-1">Status:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button key={key} onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all uppercase tracking-wide ${filterStatus === key ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm` : 'bg-base-200 text-base-content/50 border-transparent hover:border-base-300'}`}>
                          <cfg.icon className="w-3 h-3" />
                          {/* Note: Filter orders by this delivery status */}
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment method filter chips */}
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-[10px] text-base-content/40 font-black uppercase tracking-widest pt-1">Payment:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['Razorpay', 'Wallet', 'COD'].map((m) => {
                        const Icon = PAYMENT_METHOD_ICON[m];
                        return (
                          <button key={m} onClick={() => setFilterPayment(filterPayment === m ? '' : m)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all uppercase tracking-wide ${filterPayment === m ? 'bg-primary/10 text-primary border-primary/30 shadow-sm' : 'bg-base-200 text-base-content/50 border-transparent hover:border-base-300'}`}>
                            <Icon className="w-3 h-3" />
                            {/* Note: Filter by how the customer paid */}
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {hasFilters && (
                    <button onClick={clearFilters}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-error bg-error/10 border border-error/20 hover:bg-error/15 transition-colors">
                      <X className="w-3 h-3" /> Clear All Filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Content area */}
        {loading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <OrderSkeleton key={i} />)}</div>
        ) : error ? (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex items-start gap-3 p-4 bg-error/10 border border-error/30 rounded-2xl text-sm">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-error">Failed to load orders</p>
              <p className="text-error/70 text-xs mt-0.5">{error}</p>
              <button onClick={() => dispatch(fetchMyOrders({ page, limit: 10 }))} className="mt-2 text-xs font-bold text-error underline">Try again</button>
            </div>
          </motion.div>
        ) : filtered.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
        ) : (
          <>
            {/* Result count when filters are active */}
            {hasFilters && (
              <p className="text-xs text-base-content/40 font-semibold mb-3 pl-1">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} found
              </p>
            )}

            <div className="space-y-3">
              {filtered.map((order, i) => (
                <OrderCard key={order._id} order={order} index={i} onView={(id) => router.push(`/pharmacy/orders/${id}`)} />
              ))}
            </div>

            {/* Pagination — shown only when total pages > 1 */}
            {totalPages > 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 mt-6">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-2 rounded-xl border border-base-300 text-sm font-semibold text-base-content/60 hover:border-primary hover:text-primary disabled:opacity-30 transition-all">
                  ← Prev
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button key={i} onClick={() => setPage(i + 1)}
                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${page === i + 1 ? 'bg-primary text-primary-content shadow-md shadow-primary/20' : 'bg-base-200 text-base-content/50 hover:bg-base-300'}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-4 py-2 rounded-xl border border-base-300 text-sm font-semibold text-base-content/60 hover:border-primary hover:text-primary disabled:opacity-30 transition-all">
                  Next →
                </button>
              </motion.div>
            )}
          </>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}