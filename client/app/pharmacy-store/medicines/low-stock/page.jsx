'use client';

/**
 * LowStockPage.jsx — Pharmacy Low Stock Monitor
 *
 * Design Direction: "Command Centre"
 *   Full-width operational dashboard. Stats strip at top, bar chart for at-a-glance
 *   severity, then a rich card list with inline restock trigger.
 *   Modal sheet stays bottom-anchored on mobile, centred on desktop.
 *   All state local; API only via slice thunks.
 */

import {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
  memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingDown,
  AlertTriangle,
  Package,
  Send,
  Loader2,
  RefreshCw,
  Search,
  MailCheck,
  Zap,
  ShoppingCart,
  BarChart3,
  Settings,
  AlertCircle,
  X,
  Clock,
  IndianRupee,
  Filter,
  ChevronDown,
  Check,
  Info,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  fetchLowStock,
  requestStock,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

// ─── Animation Variants ──────────────────────────────────────────────────────

const FADE_UP = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const MODAL_SLIDE = {
  hidden:  { opacity: 0, y: 40, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1,    transition: { type: 'spring', stiffness: 280, damping: 28 } },
  exit:    { opacity: 0, y: 40, scale: 0.97, transition: { duration: 0.2 } },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];

const URGENCY_STYLES = {
  Low:      'bg-success/10 border-success text-success',
  Medium:   'bg-warning/10 border-warning text-warning',
  High:     'bg-error/10 border-error text-error',
  Critical: 'bg-error text-error-content border-error',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSeverity(qty) {
  if (qty === 0) return 'out';
  if (qty <= 2)  return 'critical';
  return 'low';
}

function getSeverityColor(qty) {
  if (qty === 0) return 'var(--error)';
  if (qty <= 2)  return 'var(--error)';
  return 'var(--warning)';
}

function getSeverityLabel(qty) {
  if (qty === 0) return { text: 'Out of Stock', cls: 'badge bg-error/10 text-error border-error/30 border' };
  if (qty <= 2)  return { text: 'Critical',     cls: 'badge bg-error/10 text-error border-error/30 border' };
  return           { text: `${qty} left`,       cls: 'badge bg-warning/10 text-warning border-warning/30 border' };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="card p-4 flex items-start gap-3 animate-pulse">
      <div className="w-11 h-11 rounded-xl bg-base-300 shrink-0" />
      <div className="flex-1 space-y-2.5">
        <div className="flex justify-between">
          <div className="h-3.5 bg-base-300 rounded w-1/3" />
          <div className="h-5 bg-base-300 rounded-full w-20" />
        </div>
        <div className="h-3 bg-base-300 rounded w-1/2" />
        <div className="flex items-center gap-4 mt-2">
          <div className="h-2.5 bg-base-300 rounded-full flex-1" />
          <div className="h-6 bg-base-300 rounded-xl w-20" />
        </div>
      </div>
    </div>
  );
});

// ─── Stock Level Bar ──────────────────────────────────────────────────────────

const LevelBar = memo(function LevelBar({ qty, threshold }) {
  const pct   = Math.min(100, threshold > 0 ? (qty / threshold) * 100 : 0);
  const color = getSeverityColor(qty);

  return (
    <div className="flex items-center gap-2 w-28" aria-label={`${qty} of ${threshold} units`}>
      <div className="flex-1 h-1.5 rounded-full bg-base-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-xs font-black tabular-nums w-5 text-right" style={{ color }}>
        {qty}
      </span>
    </div>
  );
});

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = memo(function StatCard({ label, value, color, icon: Icon, index }) {
  return (
    <motion.div
      variants={FADE_UP}
      initial="hidden"
      animate="visible"
      custom={index}
      className="stat-card"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <div className="stat-card-value" style={{ color }}>{value}</div>
      <div className="stat-card-label">{label}</div>
    </motion.div>
  );
});

// ─── Stock Item Card ──────────────────────────────────────────────────────────

const StockItemCard = memo(function StockItemCard({ item, index, threshold, onRestock }) {
  const qty        = item.stockQuantity;
  const severity   = getSeverity(qty);
  const label      = getSeverityLabel(qty);
  const accentColor = getSeverityColor(qty);
  const expDate    = item.expiryDate ? new Date(item.expiryDate) : null;
  const daysLeft   = expDate ? Math.ceil((expDate.getTime() - Date.now()) / 86400000) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      layout
      className="card p-4 hover:shadow-depth transition-all duration-200"
      style={{ borderLeft: `3px solid ${accentColor}` }}
      aria-label={`${item.brandName || item.name} — ${qty} units`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}
          aria-hidden="true"
        >
          {qty === 0
            ? <Package size={18} style={{ color: accentColor }} />
            : <TrendingDown size={18} style={{ color: accentColor }} />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="font-bold text-sm text-base-content truncate leading-tight">
                {item.brandName || item.name}
              </p>
              <p className="text-xs text-base-content/45 mt-0.5 truncate">
                {item.category}
                {item.batchNumber && <span> · Batch: <span className="font-mono">{item.batchNumber}</span></span>}
              </p>
            </div>
            <span className={`${label.cls} text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0`}>
              {label.text}
            </span>
          </div>

          {/* Meta + actions row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <LevelBar qty={qty} threshold={threshold} />

            <div className="flex items-center gap-3 text-[11px] text-base-content/40">
              {daysLeft !== null && (
                <span className={`flex items-center gap-1 ${daysLeft <= 30 ? 'text-error font-semibold' : ''}`}>
                  <Clock size={10} />
                  {daysLeft <= 0 ? 'Expired' : `Exp ${new Date(item.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}`}
                </span>
              )}
              {item.pricePerUnit != null && (
                <span className="flex items-center gap-0.5">
                  <IndianRupee size={10} />{item.pricePerUnit}/u
                </span>
              )}
            </div>

            <button
              onClick={() => onRestock(item)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 px-3 py-1.5 rounded-xl border border-primary/30 hover:bg-primary/5 transition-colors whitespace-nowrap ml-auto"
              aria-label={`Request restock for ${item.brandName || item.name}`}
            >
              <ShoppingCart size={11} />
              Restock
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
});

// ─── Custom Tooltip for chart ──────────────────────────────────────────────────

const CustomTooltip = memo(function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const qty = payload[0].value;
  return (
    <div className="card px-3 py-2 text-xs shadow-depth border border-base-300 bg-base-100 min-w-[100px]">
      <p className="font-bold text-base-content truncate mb-1">{label}</p>
      <p style={{ color: getSeverityColor(qty) }} className="font-black">{qty} units</p>
    </div>
  );
});

// ─── Restock Modal ────────────────────────────────────────────────────────────

const RestockModal = memo(function RestockModal({ item, onClose, onSubmit, loading }) {
  const [urgency,  setUrgency]  = useState('Medium');
  const [quantity, setQuantity] = useState('50');
  const [error,    setError]    = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

  const handleSubmit = useCallback(() => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) { setError('Enter a valid quantity'); return; }
    onSubmit({ medicineId: item.medicineId, requiredQuantity: qty, urgency });
  }, [item, quantity, urgency, onSubmit]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={`Request restock for ${item.brandName || item.name}`}
    >
      <motion.div
        variants={MODAL_SLIDE}
        initial="hidden"
        animate="visible"
        exit="exit"
        data-theme="pharmacy"
        className="card p-6 w-full max-w-sm relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-base-content/40 hover:bg-base-200 hover:text-base-content transition-colors"
          aria-label="Close modal"
        >
          <X size={14} />
        </button>

        {/* Title */}
        <div className="mb-5 pr-8">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart size={16} className="text-primary" />
            <h3 className="font-black text-base-content text-base">Request Restock</h3>
          </div>
          <p className="text-sm text-base-content/50 truncate">{item.brandName || item.name}</p>
          <p className="text-[11px] text-base-content/35 mt-0.5">
            Current: <span className="font-bold" style={{ color: getSeverityColor(item.stockQuantity) }}>{item.stockQuantity} units</span>
          </p>
        </div>

        <div className="space-y-4">
          {/* Quantity */}
          <div>
            <label htmlFor="restockQty" className="block text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1.5">
              Quantity Needed <span className="text-error" aria-hidden="true">*</span>
            </label>
            <input
              ref={inputRef}
              id="restockQty"
              type="number"
              min="1"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => { setQuantity(e.target.value); setError(''); }}
              className={`input-field w-full ${error ? 'border-error focus:border-error' : ''}`}
              aria-invalid={!!error}
              aria-describedby={error ? 'restock-qty-error' : undefined}
            />
            {error && (
              <p id="restock-qty-error" className="mt-1 text-[11px] text-error flex items-center gap-1" role="alert">
                <AlertCircle size={10} /> {error}
              </p>
            )}
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-2">
              Urgency
            </label>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Select urgency level">
              {URGENCY_OPTIONS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  aria-pressed={urgency === u}
                  className={[
                    'py-2 rounded-xl text-[11px] font-bold border transition-all',
                    urgency === u ? URGENCY_STYLES[u] : 'bg-base-200 border-base-300 text-base-content/50 hover:border-base-content/25',
                  ].join(' ')}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={onClose}
              className="btn-secondary flex-1 py-2.5 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              aria-busy={loading}
              className="btn-primary-cta flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading
                ? <Loader2 size={14} className="animate-spin" />
                : <ShoppingCart size={14} />
              }
              Submit
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LowStockPage() {
  const dispatch = useDispatch();
  const { lowStockItems, lowStockMeta, loading } = useSelector((s) => s.pharmacyStore);

  // ── Local state ───────────────────────────────────────────────────────────
  const [threshold,    setThreshold]   = useState(5);
  const [threshEdit,   setThreshEdit]  = useState(false);
  const [threshInput,  setThreshInput] = useState('5');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent,    setEmailSent]   = useState(false);
  const [search,       setSearch]      = useState('');
  const [sortBy,       setSortBy]      = useState('qty_asc');   // qty_asc | qty_desc | alpha
  const [restockItem,  setRestockItem] = useState(null);
  const [restockLoading, setRestockLoading] = useState(false);

  const threshRef = useRef(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const doFetch = useCallback((opts = {}) => {
    dispatch(fetchLowStock({ threshold, ...opts }));
  }, [dispatch, threshold]);

  useEffect(() => { doFetch(); }, [doFetch]);

  // ── Email alert ───────────────────────────────────────────────────────────
  const handleSendEmail = useCallback(async () => {
    setSendingEmail(true);
    await dispatch(fetchLowStock({ threshold, sendEmail: true }));
    setSendingEmail(false);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 4000);
  }, [dispatch, threshold]);

  // ── Threshold editor ──────────────────────────────────────────────────────
  const handleThresholdCommit = useCallback(() => {
    const v = Math.max(1, Math.min(50, Number(threshInput)));
    setThreshold(v);
    setThreshInput(String(v));
    setThreshEdit(false);
  }, [threshInput]);

  useEffect(() => {
    if (threshEdit) threshRef.current?.focus();
  }, [threshEdit]);

  // ── Restock ───────────────────────────────────────────────────────────────
  const handleRestockSubmit = useCallback(async (payload) => {
    setRestockLoading(true);
    await dispatch(requestStock(payload));
    setRestockLoading(false);
    setRestockItem(null);
  }, [dispatch]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const outOfStock = useMemo(() => lowStockItems.filter((i) => i.stockQuantity === 0).length, [lowStockItems]);
  const critical   = useMemo(() => lowStockItems.filter((i) => i.stockQuantity > 0 && i.stockQuantity <= 2).length, [lowStockItems]);
  const lowCount   = useMemo(() => lowStockItems.filter((i) => i.stockQuantity > 2).length, [lowStockItems]);

  const chartData = useMemo(() =>
    lowStockItems.slice(0, 10).map((i) => ({
      name: (i.brandName || i.name || '').slice(0, 10),
      qty:  i.stockQuantity,
      full: i.brandName || i.name,
    })),
    [lowStockItems]
  );

  const filtered = useMemo(() => {
    let list = lowStockItems;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) => (i.brandName || i.name || '').toLowerCase().includes(q) ||
               (i.category || '').toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'qty_asc':  return [...list].sort((a, b) => a.stockQuantity - b.stockQuantity);
      case 'qty_desc': return [...list].sort((a, b) => b.stockQuantity - a.stockQuantity);
      case 'alpha':    return [...list].sort((a, b) => (a.brandName || a.name || '').localeCompare(b.brandName || b.name || ''));
      default:         return list;
    }
  }, [lowStockItems, search, sortBy]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-10">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <motion.header
          variants={FADE_UP}
          initial="hidden"
          animate="visible"
          custom={0}
          className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-error/15 flex items-center justify-center">
                <TrendingDown size={16} className="text-error" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-base-content font-montserrat">
                Low <span className="text-error">Stock</span>
              </h1>
            </div>
            <p className="text-sm text-base-content/50 ml-10">
              {lowStockMeta.count} medicine{lowStockMeta.count !== 1 ? 's' : ''} at or below{' '}
              <strong>{lowStockMeta.threshold}</strong> units
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Threshold editor */}
            <div className="flex items-center gap-2 bg-base-100 border border-base-300 rounded-xl px-3 py-2">
              <Settings size={13} className="text-base-content/40" />
              <span className="text-xs text-base-content/50">Threshold:</span>
              {threshEdit ? (
                <input
                  ref={threshRef}
                  type="number"
                  min="1"
                  max="50"
                  value={threshInput}
                  onChange={(e) => setThreshInput(e.target.value)}
                  onBlur={handleThresholdCommit}
                  onKeyDown={(e) => e.key === 'Enter' && handleThresholdCommit()}
                  className="w-10 bg-transparent text-xs font-bold text-primary outline-none text-right"
                  aria-label="Set threshold"
                />
              ) : (
                <button
                  onClick={() => { setThreshEdit(true); setThreshInput(String(threshold)); }}
                  className="text-xs font-bold text-primary hover:underline tabular-nums"
                  aria-label="Edit threshold"
                >
                  {threshold}
                </button>
              )}
            </div>

            {/* Email alert */}
            <AnimatePresence mode="wait">
              {emailSent ? (
                <motion.div key="sent" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10 border border-success/30 text-success text-xs font-bold"
                  role="status" aria-live="polite"
                >
                  <MailCheck size={13} /> Alert Sent!
                </motion.div>
              ) : (
                <motion.button key="send" onClick={handleSendEmail}
                  disabled={sendingEmail || lowStockItems.length === 0}
                  className="btn-secondary px-3.5 py-2 text-xs flex items-center gap-2 disabled:opacity-50"
                  aria-label="Send low-stock email alert"
                >
                  {sendingEmail ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Email Alert
                </motion.button>
              )}
            </AnimatePresence>

            {/* Refresh */}
            <button
              onClick={() => doFetch()}
              disabled={loading.lowStock}
              aria-label="Refresh low stock data"
              className="w-9 h-9 rounded-xl bg-base-100 border border-base-300 flex items-center justify-center text-base-content/50 hover:border-error hover:text-error transition-all"
            >
              <RefreshCw size={15} className={loading.lowStock ? 'animate-spin' : ''} />
            </button>
          </div>
        </motion.header>

        {/* ── Urgent Banner ──────────────────────────────────────────── */}
        <AnimatePresence>
          {outOfStock > 0 && (
            <motion.div
              key="sos"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="alert alert-error mb-5 rounded-xl"
              role="alert"
            >
              <Zap size={16} className="text-error shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold text-sm">
                  {outOfStock} medicine{outOfStock !== 1 ? 's' : ''} completely out of stock
                </p>
                <p className="text-xs opacity-75 mt-0.5">
                  These cannot be dispensed. Request restock immediately.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stat Strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Out of Stock"    value={outOfStock} color="var(--error)"   icon={Package}     index={1} />
          <StatCard label="Critical (1–2)"  value={critical}   color="var(--error)"   icon={AlertTriangle} index={2} />
          <StatCard label={`Low (3–${threshold})`} value={lowCount} color="var(--warning)" icon={TrendingDown} index={3} />
        </div>

        {/* ── Chart ────────────────────────────────────────────────────── */}
        {chartData.length > 0 && (
          <motion.div variants={FADE_UP} initial="hidden" animate="visible" custom={4} className="card p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm text-base-content flex items-center gap-2">
                <BarChart3 size={14} className="text-error" />
                Stock Severity
              </h2>
              <span className="text-[11px] text-base-content/40">Top {chartData.length} items</span>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={chartData} barSize={18} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--base-content)', fillOpacity: 0.45 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--base-content)', fillOpacity: 0.45 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--base-300)', fillOpacity: 0.5 }} />
                <Bar dataKey="qty" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={getSeverityColor(entry.qty)} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* ── Filters Row ──────────────────────────────────────────────── */}
        <motion.div variants={FADE_UP} initial="hidden" animate="visible" custom={5} className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <div className="flex-1 card p-3 flex items-center gap-2.5">
            <Search size={14} className="text-base-content/40 shrink-0" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or category…"
              aria-label="Filter medicines"
              className="flex-1 bg-transparent text-sm text-base-content placeholder:text-base-content/35 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear filter"
                className="w-5 h-5 rounded-full flex items-center justify-center text-base-content/40 hover:bg-base-300 transition-colors">
                <X size={11} />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <div className="card px-3.5 py-3 flex items-center gap-2 text-xs font-semibold text-base-content/60 cursor-pointer">
              <Filter size={13} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent outline-none text-xs font-semibold text-base-content/70 cursor-pointer pr-4 appearance-none"
                aria-label="Sort order"
              >
                <option value="qty_asc">Qty: Low → High</option>
                <option value="qty_desc">Qty: High → Low</option>
                <option value="alpha">Alphabetical</option>
              </select>
              <ChevronDown size={12} className="text-base-content/35 pointer-events-none shrink-0" />
            </div>
          </div>
        </motion.div>

        {/* ── List ─────────────────────────────────────────────────────── */}
        {loading.lowStock && lowStockItems.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div variants={FADE_UP} initial="hidden" animate="visible" className="card p-16 text-center">
            {lowStockItems.length === 0 ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <Check size={28} className="text-success" />
                </div>
                <h3 className="font-black text-lg text-base-content mb-1">All Stocked Up!</h3>
                <p className="text-sm text-base-content/45">No medicines below the threshold of {threshold} units.</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mx-auto mb-4">
                  <Search size={22} className="text-base-content/30" />
                </div>
                <p className="text-sm font-semibold text-base-content/50">No results for "{search}"</p>
              </>
            )}
          </motion.div>
        ) : (
          <div className="space-y-2.5" role="list" aria-label="Low stock medicines">
            <AnimatePresence>
              {filtered.map((item, i) => (
                <StockItemCard
                  key={`${item.medicineId}-${item.batchNumber ?? i}`}
                  item={item}
                  index={i}
                  threshold={threshold}
                  onRestock={setRestockItem}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Restock Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {restockItem && (
          <RestockModal
            item={restockItem}
            onClose={() => setRestockItem(null)}
            onSubmit={handleRestockSubmit}
            loading={restockLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}