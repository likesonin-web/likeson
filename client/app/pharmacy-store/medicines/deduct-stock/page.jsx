'use client';

/**
 * DeductStockPage.jsx — Pharmacy Inventory Deduction
 *
 * Design Direction: "Precision Reduction"
 *   Two-panel layout mirroring AddStockPage.
 *   Red/error accent palette signals destructive intent.
 *   Live animated stock bar, per-batch selector, reason chip grid.
 *   No prop drilling — all state local, all API via slice thunks.
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
  Minus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pill,
  ArrowLeft,
  ChevronRight,
  Hash,
  Package,
  TrendingDown,
  AlertCircle,
  Layers,
  Clock,
  IndianRupee,
  BarChart3,
  X,
  Check,
  Info,
  ShieldAlert,
} from 'lucide-react';
import {
  deductStock,
  fetchMedicines,
  clearSuccess,
  clearError,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

// ─── Animation Variants ──────────────────────────────────────────────────────

const FADE_UP = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

const SLIDE_RIGHT = {
  hidden:  { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, x: -24, transition: { duration: 0.2 } },
};

const SLIDE_LEFT = {
  hidden:  { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, x: 24, transition: { duration: 0.2 } },
};

const SCALE_IN = {
  hidden:  { scale: 0.85, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  exit:    { scale: 0.85, opacity: 0, transition: { duration: 0.18 } },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LOW_STOCK_THRESHOLD = 5;

const DEDUCT_REASONS = [
  { id: 'dispensed',  label: 'Dispensed to Patient' },
  { id: 'expired',    label: 'Expired — Disposed' },
  { id: 'damaged',    label: 'Damaged / Broken' },
  { id: 'qc',         label: 'QC Failure' },
  { id: 'adjustment', label: 'Stock Adjustment' },
  { id: 'internal',   label: 'Internal Use' },
  { id: 'other',      label: 'Other' },
];

const CATEGORY_COLORS = {
  Tablet:    'bg-info/10 text-info border-info/30',
  Capsule:   'bg-secondary/10 text-secondary border-secondary/30',
  Syrup:     'bg-accent/10 text-accent border-accent/30',
  Injection: 'bg-error/10 text-error border-error/30',
  Cream:     'bg-success/10 text-success border-success/30',
  Ointment:  'bg-warning/10 text-warning border-warning/30',
  Inhaler:   'bg-primary/10 text-primary border-primary/30',
  default:   'bg-base-300 text-base-content/60 border-base-300',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const MedicineSkeleton = memo(function MedicineSkeleton() {
  return (
    <div className="card p-4 flex items-start gap-4 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-base-300 shrink-0" />
      <div className="flex-1 space-y-2.5">
        <div className="flex gap-2">
          <div className="h-3.5 bg-base-300 rounded w-1/3" />
          <div className="h-4 bg-base-300 rounded-full w-14" />
        </div>
        <div className="h-3 bg-base-300 rounded w-2/3" />
        <div className="flex gap-3">
          <div className="h-3 bg-base-300 rounded w-20" />
          <div className="h-3 bg-base-300 rounded w-24" />
        </div>
      </div>
    </div>
  );
});

// ─── Step Indicator ───────────────────────────────────────────────────────────

const StepIndicator = memo(function StepIndicator({ step }) {
  const steps = ['Select Medicine', 'Deduct Details', 'Confirm'];
  return (
    <nav aria-label="Progress steps" className="flex items-center gap-1.5 select-none">
      {steps.map((label, i) => {
        const num      = i + 1;
        const active   = step === num;
        const complete = step > num;
        return (
          <div key={i} className="flex items-center gap-1.5">
            <div
              aria-current={active ? 'step' : undefined}
              className={[
                'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all duration-300',
                active   ? 'bg-error text-error-content shadow-md' : '',
                complete ? 'bg-success/15 text-success border border-success/30' : '',
                !active && !complete ? 'bg-base-200 text-base-content/40' : '',
              ].join(' ')}
            >
              {complete
                ? <Check size={11} strokeWidth={3} />
                : <span className="tabular-nums">{num}</span>
              }
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-4 h-px transition-colors duration-300 ${step > num ? 'bg-success/50' : 'bg-base-300'}`} />
            )}
          </div>
        );
      })}
    </nav>
  );
});

// ─── Medicine Card (Step 1) ───────────────────────────────────────────────────

const MedicineCard = memo(function MedicineCard({ med, onSelect, index }) {
  const storeQty = useMemo(
    () => (med.storeInventory || []).reduce((s, inv) => s + (inv.stockQuantity || 0), 0),
    [med.storeInventory]
  );
  const isOut  = storeQty === 0;
  const isLow  = storeQty > 0 && storeQty <= LOW_STOCK_THRESHOLD;
  const catCls = CATEGORY_COLORS[med.category] ?? CATEGORY_COLORS.default;
  const primaryImg = med.images?.find((img) => img.isPrimary)?.url;

  return (
    <motion.article
      variants={FADE_UP}
      initial="hidden"
      animate="visible"
      custom={index * 0.3}
      layout
      onClick={() => !isOut && onSelect(med)}
      role="button"
      tabIndex={isOut ? -1 : 0}
      onKeyDown={(e) => !isOut && e.key === 'Enter' && onSelect(med)}
      aria-label={`Select ${med.brandName} for deduction${isOut ? ' (out of stock)' : ''}`}
      aria-disabled={isOut}
      className={[
        'group card p-4 flex items-start gap-4 transition-all duration-200',
        isOut
          ? 'opacity-40 cursor-not-allowed'
          : 'cursor-pointer hover:border-error hover:shadow-[0_4px_20px_color-mix(in_srgb,var(--error),transparent_80%)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50',
      ].join(' ')}
    >
      {/* Icon */}
      <div className="relative shrink-0">
        <div className={[
          'w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden',
          isOut  ? 'bg-base-300' : isLow ? 'bg-warning/15' : 'bg-error/10',
        ].join(' ')}>
          {primaryImg
            ? <img src={primaryImg} alt={med.brandName} className="w-full h-full object-cover" />
            : <Pill size={20} className={isOut ? 'text-base-content/30' : isLow ? 'text-warning' : 'text-error'} aria-hidden="true" />
          }
        </div>
        <span
          className={[
            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-base-100',
            isOut ? 'bg-error' : isLow ? 'bg-warning' : 'bg-success',
          ].join(' ')}
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1">
          <span className="font-bold text-sm text-base-content leading-tight truncate">{med.brandName}</span>
          <span className={`badge text-[10px] px-2 py-0.5 border rounded-full font-semibold ${catCls}`}>
            {med.category}
          </span>
          {isOut  && <span className="badge text-[10px] px-2 py-0.5 border rounded-full font-semibold bg-error/10 text-error border-error/30">Out of Stock</span>}
          {isLow  && !isOut && <span className="badge text-[10px] px-2 py-0.5 border rounded-full font-semibold bg-warning/10 text-warning border-warning/30">Low Stock</span>}
          {med.schedule && med.schedule !== 'None' && (
            <span className="badge text-[10px] px-2 py-0.5 border rounded-full font-semibold bg-error/10 text-error border-error/30">
              Sch {med.schedule}
            </span>
          )}
        </div>
        <p className="text-xs text-base-content/55 truncate mb-2">
          {med.genericName}
          {med.dosage ? <span className="text-base-content/35"> · {med.dosage}</span> : null}
          {med.manufacturer ? <span className="text-base-content/35"> · {med.manufacturer}</span> : null}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-[11px] font-semibold ${isOut ? 'text-error' : isLow ? 'text-warning' : 'text-success'}`}>
            <Layers size={11} className="inline mr-1" />{storeQty} units
          </span>
          {med.mrp != null && (
            <span className="text-[11px] text-base-content/40 flex items-center gap-0.5">
              <IndianRupee size={10} />MRP {med.mrp}
            </span>
          )}
          {med.isPrescriptionRequired && (
            <span className="text-[11px] text-base-content/35 flex items-center gap-1">
              <ShieldAlert size={11} />Rx
            </span>
          )}
        </div>
      </div>

      <ChevronRight
        size={16}
        className={`shrink-0 mt-1 transition-all ${isOut ? 'text-base-content/20' : 'text-base-content/25 group-hover:text-error group-hover:translate-x-0.5'}`}
        aria-hidden="true"
      />
    </motion.article>
  );
});

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptySearch = memo(function EmptySearch({ query }) {
  return (
    <motion.div variants={FADE_UP} initial="hidden" animate="visible"
      className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-base-200 flex items-center justify-center mb-4">
        <Package size={24} className="text-base-content/30" />
      </div>
      <p className="text-sm font-semibold text-base-content/50">No medicines found</p>
      {query && (
        <p className="text-xs text-base-content/35 mt-1">
          No results for "<span className="font-medium text-base-content/50">{query}</span>"
        </p>
      )}
    </motion.div>
  );
});

// ─── Selected Medicine Banner (Step 2) ────────────────────────────────────────

const SelectedMedicineBanner = memo(function SelectedMedicineBanner({ medicine, onBack }) {
  const storeQty = useMemo(
    () => (medicine.storeInventory || []).reduce((s, inv) => s + (inv.stockQuantity || 0), 0),
    [medicine.storeInventory]
  );
  const primaryImg = medicine.images?.find((img) => img.isPrimary)?.url;

  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <button
        onClick={onBack}
        aria-label="Go back to medicine selection"
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base-content/50 hover:text-error hover:bg-error/10 transition-colors shrink-0"
      >
        <ArrowLeft size={16} />
      </button>
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-error/80 to-warning flex items-center justify-center shrink-0 overflow-hidden">
        {primaryImg
          ? <img src={primaryImg} alt="" className="w-full h-full object-cover" />
          : <Pill size={18} className="text-white" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-base-content text-sm leading-tight">{medicine.brandName}</span>
          <span className={`badge text-[10px] px-2 py-0.5 border rounded-full font-semibold ${CATEGORY_COLORS[medicine.category] ?? CATEGORY_COLORS.default}`}>
            {medicine.category}
          </span>
        </div>
        <p className="text-xs text-base-content/45 truncate mt-0.5">{medicine.genericName} · {medicine.dosage}</p>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-lg font-black tabular-nums ${storeQty <= LOW_STOCK_THRESHOLD ? (storeQty === 0 ? 'text-error' : 'text-warning') : 'text-success'}`}>
          {storeQty}
        </div>
        <div className="text-[10px] text-base-content/35 uppercase tracking-wide">in stock</div>
      </div>
    </div>
  );
});

// ─── Stock Bar Preview ────────────────────────────────────────────────────────

const StockPreview = memo(function StockPreview({ medicine, qty, batchNumber }) {
  const totalQty = useMemo(
    () => (medicine?.storeInventory || []).reduce((s, inv) => s + (inv.stockQuantity || 0), 0),
    [medicine?.storeInventory]
  );

  // If a batch is selected, show that batch's available qty
  const batchQty = useMemo(() => {
    if (!batchNumber) return totalQty;
    const match = (medicine?.storeInventory || []).find((inv) => inv.batchNumber === batchNumber);
    return match ? match.stockQuantity : totalQty;
  }, [medicine, batchNumber, totalQty]);

  const deducting = Number(qty) || 0;
  const remaining = batchQty - deducting;
  const isOver    = deducting > batchQty;
  const isLow     = remaining >= 0 && remaining <= LOW_STOCK_THRESHOLD;
  const pct       = batchQty > 0 ? Math.max(0, (remaining / batchQty) * 100) : 0;

  if (!medicine) return null;

  return (
    <div className="rounded-xl border border-base-300 bg-base-200/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-300 flex items-center gap-2">
        <BarChart3 size={13} className="text-error" />
        <span className="text-xs font-bold text-base-content/60 uppercase tracking-wider">
          {batchNumber ? `Batch Preview` : 'Stock Preview'}
        </span>
        {batchNumber && (
          <span className="text-[10px] font-mono text-base-content/40 ml-auto">{batchNumber}</span>
        )}
      </div>
      <div className="p-4 grid grid-cols-3 gap-3 mb-2">
        {[
          { label: 'Available', value: batchQty, color: 'text-base-content' },
          { label: 'Deducting', value: deducting > 0 ? `-${deducting}` : '—', color: isOver ? 'text-error' : 'text-error/70' },
          { label: 'Remaining', value: deducting > 0 ? (isOver ? 'Over!' : remaining) : '—',
            color: isOver ? 'text-error font-black' : isLow && deducting > 0 ? 'text-warning' : deducting > 0 ? 'text-success' : 'text-base-content' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <div className={`text-xl font-black tabular-nums ${color}`}>{value}</div>
            <div className="text-[10px] text-base-content/40 uppercase tracking-wider mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {deducting > 0 && !isOver && (
        <div className="px-4 pb-3">
          <div className="h-2 bg-base-300 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: isLow ? 'var(--warning)' : 'var(--success)' }}
            />
          </div>
        </div>
      )}

      {isOver && deducting > 0 && (
        <div className="mx-3 mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-error/10 border border-error/25">
          <AlertCircle size={13} className="text-error mt-0.5 shrink-0" />
          <p className="text-[11px] text-error font-medium leading-snug">
            Exceeds available stock of {batchQty} units.
          </p>
        </div>
      )}
      {isLow && !isOver && deducting > 0 && (
        <div className="mx-3 mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/25">
          <AlertTriangle size={13} className="text-warning mt-0.5 shrink-0" />
          <p className="text-[11px] text-warning font-medium leading-snug">
            Remaining will be ≤{LOW_STOCK_THRESHOLD} — a low-stock alert will be sent.
          </p>
        </div>
      )}
    </div>
  );
});

// ─── Reason Chip Grid ─────────────────────────────────────────────────────────

const ReasonGrid = memo(function ReasonGrid({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Select deduction reason">
      {DEDUCT_REASONS.map(({ id, label }) => {
        const active = value === label;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(active ? '' : label)}
            aria-pressed={active}
            className={[
              'px-3 py-2.5 rounded-xl text-xs font-semibold border text-left transition-all duration-150',
              active
                ? 'bg-error/10 border-error text-error'
                : 'bg-base-200 border-base-300 text-base-content/55 hover:border-error/40 hover:text-base-content',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
});

// ─── Batch Selector ───────────────────────────────────────────────────────────

const BatchSelector = memo(function BatchSelector({ batches, value, onChange }) {
  if (batches.length === 0) {
    return (
      <div className="relative">
        <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. BATCH-001 (leave blank for any)"
          className="input-field w-full pl-9"
          aria-label="Batch number"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* "Any batch" option */}
      <label
        className={[
          'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150',
          !value ? 'border-error/40 bg-error/5' : 'border-base-300 bg-base-200/50 hover:border-base-content/20',
        ].join(' ')}
      >
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${!value ? 'border-error bg-error' : 'border-base-content/25'}`}>
          {!value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-base-content">Any batch</span>
          <span className="text-[10px] text-base-content/40 ml-2">system selects automatically</span>
        </div>
        <input type="radio" className="sr-only" checked={!value} onChange={() => onChange('')} />
      </label>

      {batches.map((inv, i) => {
        const selected = value === inv.batchNumber;
        const expDate  = inv.expiryDate ? new Date(inv.expiryDate) : null;
        const daysLeft = expDate ? Math.ceil((expDate.getTime() - Date.now()) / 86400000) : null;
        const isExpired = daysLeft !== null && daysLeft <= 0;

        return (
          <label
            key={i}
            className={[
              'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150',
              selected ? 'border-error/40 bg-error/5' : 'border-base-300 bg-base-200/50 hover:border-base-content/20',
              isExpired ? 'opacity-60' : '',
            ].join(' ')}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'border-error bg-error' : 'border-base-content/25'}`}>
              {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-base-content font-mono">{inv.batchNumber || '—'}</span>
              {isExpired && <span className="ml-2 text-[10px] text-error font-bold">EXPIRED</span>}
            </div>
            <div className="flex items-center gap-3 text-[11px] shrink-0">
              <span className={`font-bold tabular-nums ${inv.stockQuantity <= LOW_STOCK_THRESHOLD ? 'text-warning' : 'text-success'}`}>
                {inv.stockQuantity} u
              </span>
              {daysLeft !== null && (
                <span className={`flex items-center gap-1 ${daysLeft <= 30 ? 'text-error' : 'text-base-content/35'}`}>
                  <Clock size={10} />
                  {isExpired ? 'Expired' : `${daysLeft}d`}
                </span>
              )}
            </div>
            <input
              type="radio"
              className="sr-only"
              checked={selected}
              onChange={() => onChange(inv.batchNumber)}
              aria-label={`Batch ${inv.batchNumber}`}
            />
          </label>
        );
      })}
    </div>
  );
});

// ─── Success Overlay ──────────────────────────────────────────────────────────

const SuccessOverlay = memo(function SuccessOverlay({ medicine, qty }) {
  return (
    <motion.div
      variants={SCALE_IN}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="card p-10 text-center border-success/30 bg-success/5 flex flex-col items-center"
      role="status"
      aria-live="polite"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 250, damping: 18, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mb-5"
      >
        <CheckCircle2 size={40} className="text-success" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h3 className="text-2xl font-black text-base-content tracking-tight mb-1">Stock Deducted!</h3>
        <p className="text-sm text-base-content/55">
          <span className="font-semibold text-base-content">{qty} units</span> removed from{' '}
          <span className="font-semibold text-error">{medicine?.brandName}</span>
        </p>
      </motion.div>
      <motion.div
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{ delay: 0.4, duration: 2.2, ease: 'linear' }}
        className="mt-6 h-0.5 bg-success/40 rounded-full"
        aria-hidden="true"
      />
      <p className="mt-3 text-[11px] text-base-content/35">Returning to medicine selection…</p>
    </motion.div>
  );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeductStockPage() {
  const dispatch = useDispatch();
  const { medicines, loading, errors, success } = useSelector((s) => s.pharmacyStore);

  // ── Local state ───────────────────────────────────────────────────────────
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState(null);
  const [step, setStep]             = useState(1);
  const [submitted, setSubmitted]   = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    quantity:    '',
    batchNumber: '',
    reason:      '',
  });

  const searchRef = useRef(null);
  const qtyRef    = useRef(null);

  // ── Auto-focus ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step === 1) searchRef.current?.focus();
    if (step === 2) setTimeout(() => qtyRef.current?.focus(), 350);
  }, [step]);

  // ── Fetch medicines ───────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchMedicines({ search: search.trim(), limit: 12 }));
  }, [search, dispatch]);

  // ── Handle success ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!success.deductStock) return;
    setSubmitted(true);
    dispatch(clearSuccess('deductStock'));
    const timer = setTimeout(() => {
      setSubmitted(false);
      setSelected(null);
      setStep(1);
      setForm({ quantity: '', batchNumber: '', reason: '' });
      setFieldErrors({});
    }, 2800);
    return () => clearTimeout(timer);
  }, [success.deductStock, dispatch]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelect = useCallback((med) => {
    setSelected(med);
    setForm({ quantity: '', batchNumber: '', reason: '' });
    setFieldErrors({});
    dispatch(clearError('deductStock'));
    setStep(2);
  }, [dispatch]);

  const handleBack = useCallback(() => {
    setStep(1);
    setSelected(null);
    setForm({ quantity: '', batchNumber: '', reason: '' });
    setFieldErrors({});
    dispatch(clearError('deductStock'));
  }, [dispatch]);

  const handleFieldChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch('');
    searchRef.current?.focus();
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  const totalStock = useMemo(
    () => (selected?.storeInventory || []).reduce((s, inv) => s + (inv.stockQuantity || 0), 0),
    [selected?.storeInventory]
  );

  const batchStock = useMemo(() => {
    if (!form.batchNumber || !selected) return totalStock;
    const match = (selected.storeInventory || []).find((inv) => inv.batchNumber === form.batchNumber);
    return match ? match.stockQuantity : totalStock;
  }, [selected, form.batchNumber, totalStock]);

  const isOverDeducting = Number(form.quantity) > batchStock;

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    if (!form.quantity || Number(form.quantity) <= 0)
      errs.quantity = 'Enter a quantity greater than 0';
    else if (isOverDeducting)
      errs.quantity = `Cannot exceed available stock (${batchStock} units)`;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form.quantity, isOverDeducting, batchStock]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!selected || !validate()) return;
    dispatch(deductStock({
      medicineId:  selected._id,
      quantity:    Number(form.quantity),
      batchNumber: form.batchNumber || undefined,
      reason:      form.reason || undefined,
    }));
  }, [selected, form, validate, dispatch]);

  const batches = useMemo(() => selected?.storeInventory || [], [selected?.storeInventory]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-10">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <motion.header
          variants={FADE_UP}
          initial="hidden"
          animate="visible"
          custom={0}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-xl bg-error/15 flex items-center justify-center">
                  <TrendingDown size={16} className="text-error" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-base-content font-montserrat">
                  Deduct{' '}
                  <span className="text-error">Stock</span>
                </h1>
              </div>
              <p className="text-sm text-base-content/50 ml-10">
                {step === 1
                  ? 'Select a medicine to reduce inventory'
                  : `Deducting from · ${selected?.brandName}`}
              </p>
            </div>
            <StepIndicator step={step} />
          </div>
        </motion.header>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* STEP 1 */}
          {step === 1 && (
            <motion.div key="step1" variants={SLIDE_RIGHT} initial="hidden" animate="visible" exit="exit">
              {/* Search */}
              <motion.div variants={FADE_UP} initial="hidden" animate="visible" custom={1} className="mb-5">
                <div className="card p-3 flex items-center gap-3">
                  <Search size={16} className="text-error shrink-0" aria-hidden="true" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by brand name, generic name, or manufacturer…"
                    aria-label="Search medicines"
                    className="flex-1 bg-transparent text-sm text-base-content placeholder:text-base-content/35 outline-none"
                  />
                  {search && (
                    <button onClick={handleClearSearch} aria-label="Clear search"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-base-content/40 hover:bg-base-300 hover:text-base-content transition-colors">
                      <X size={13} />
                    </button>
                  )}
                  {loading.medicines && (
                    <Loader2 size={15} className="text-error animate-spin shrink-0" aria-label="Loading…" />
                  )}
                </div>
              </motion.div>

              {/* Results */}
              {loading.medicines && medicines.length === 0 ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <MedicineSkeleton key={i} />)}
                </div>
              ) : medicines.length === 0 ? (
                <EmptySearch query={search} />
              ) : (
                <div className="space-y-2.5" role="list" aria-label="Medicine search results">
                  <AnimatePresence>
                    {medicines.map((med, i) => (
                      <MedicineCard key={med._id} med={med} onSelect={handleSelect} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <motion.div key="step2" variants={SLIDE_LEFT} initial="hidden" animate="visible" exit="exit">
              {/* Banner */}
              <motion.div variants={FADE_UP} initial="hidden" animate="visible" custom={0} className="mb-5">
                <SelectedMedicineBanner medicine={selected} onBack={handleBack} />
              </motion.div>

              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div key="success" variants={FADE_UP} initial="hidden" animate="visible" exit="exit">
                    <SuccessOverlay medicine={selected} qty={form.quantity} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    variants={FADE_UP}
                    initial="hidden"
                    animate="visible"
                    custom={1}
                    className="grid grid-cols-1 lg:grid-cols-5 gap-5"
                  >
                    {/* ── Main Form (3/5) ──────────────────────────────── */}
                    <form
                      onSubmit={handleSubmit}
                      noValidate
                      className="lg:col-span-3 card p-6 space-y-5"
                      aria-label="Deduct stock form"
                    >
                      {/* Section header */}
                      <div className="flex items-center gap-2 pb-3 border-b border-base-300">
                        <Minus size={15} className="text-error" />
                        <span className="text-xs font-bold text-error/80 uppercase tracking-widest">
                          Deduction Details
                        </span>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label htmlFor="deductQty" className="block text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1.5">
                          Quantity to Deduct <span className="text-error" aria-hidden="true">*</span>
                        </label>
                        <div className="relative">
                          <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35 pointer-events-none" />
                          <input
                            ref={qtyRef}
                            id="deductQty"
                            type="number"
                            min="1"
                            max={batchStock}
                            inputMode="numeric"
                            value={form.quantity}
                            onChange={(e) => handleFieldChange('quantity', e.target.value)}
                            placeholder={`Max: ${batchStock}`}
                            aria-required="true"
                            aria-invalid={!!fieldErrors.quantity}
                            className={`input-field w-full pl-9 ${fieldErrors.quantity ? 'border-error focus:border-error focus:ring-error/30' : ''}`}
                          />
                        </div>
                        {fieldErrors.quantity && (
                          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-error" role="alert">
                            <AlertCircle size={10} /> {fieldErrors.quantity}
                          </p>
                        )}
                      </div>

                      {/* Batch */}
                      <div>
                        <label className="block text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1.5">
                          Batch Number
                          <span className="ml-2 text-base-content/35 font-normal normal-case text-[10px]">
                            optional — deducts from any batch if blank
                          </span>
                        </label>
                        <BatchSelector
                          batches={batches}
                          value={form.batchNumber}
                          onChange={(v) => handleFieldChange('batchNumber', v)}
                        />
                      </div>

                      {/* Reason */}
                      <div>
                        <label className="block text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-2">
                          Reason
                          <span className="ml-2 text-base-content/35 font-normal normal-case text-[10px]">optional</span>
                        </label>
                        <ReasonGrid
                          value={form.reason}
                          onChange={(v) => handleFieldChange('reason', v)}
                        />
                        {form.reason === 'Other' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 overflow-hidden">
                            <textarea
                              placeholder="Describe the reason…"
                              rows={2}
                              className="input-field w-full resize-none text-xs"
                              aria-label="Custom reason"
                            />
                          </motion.div>
                        )}
                      </div>

                      {/* API error */}
                      {errors.deductStock && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                          className="alert alert-error text-xs" role="alert">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{errors.deductStock?.message || 'Failed to deduct stock. Please try again.'}</span>
                        </motion.div>
                      )}

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={loading.deductStock || isOverDeducting || !form.quantity}
                        aria-busy={loading.deductStock}
                        className={[
                          'w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider',
                          'bg-error text-error-content shadow-md',
                          'hover:brightness-110 active:scale-95 transition-all duration-150',
                          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60 focus-visible:ring-offset-2',
                        ].join(' ')}
                      >
                        {loading.deductStock ? (
                          <><Loader2 size={16} className="animate-spin" /> Processing…</>
                        ) : (
                          <><Minus size={16} /> Deduct {form.quantity ? `${form.quantity} Units` : 'Stock'}</>
                        )}
                      </button>
                    </form>

                    {/* ── Sidebar (2/5) ─────────────────────────────────── */}
                    <aside className="lg:col-span-2 space-y-4" aria-label="Deduction details sidebar">
                      {/* Live preview */}
                      <motion.div variants={FADE_UP} initial="hidden" animate="visible" custom={2}>
                        <StockPreview medicine={selected} qty={form.quantity} batchNumber={form.batchNumber} />
                      </motion.div>

                      {/* Medicine meta */}
                      <motion.div variants={FADE_UP} initial="hidden" animate="visible" custom={3} className="card p-4 space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-base-300">
                          <Info size={13} className="text-error" />
                          <span className="text-[11px] font-bold text-base-content/50 uppercase tracking-widest">Medicine Details</span>
                        </div>
                        {[
                          { label: 'Generic',      value: selected?.genericName },
                          { label: 'Manufacturer', value: selected?.manufacturer },
                          { label: 'Packaging',    value: selected?.packaging },
                          { label: 'MRP',          value: selected?.mrp != null ? `₹${selected.mrp}` : null },
                          { label: 'Schedule',     value: selected?.schedule !== 'None' ? `Schedule ${selected?.schedule}` : 'OTC' },
                          { label: 'GST',          value: selected?.gstPercentage != null ? `${selected.gstPercentage}%` : null },
                        ].filter((r) => r.value).map(({ label, value }) => (
                          <div key={label} className="flex justify-between items-baseline gap-2">
                            <span className="text-xs text-base-content/40 shrink-0">{label}</span>
                            <span className="text-xs font-semibold text-base-content text-right truncate">{value}</span>
                          </div>
                        ))}
                      </motion.div>
                    </aside>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}