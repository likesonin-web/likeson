'use client';

/**
 * RequestRestockPage
 * ────────────────────────────────────────────────────────────
 * Enterprise-grade 2-step restock request flow.
 * Architecture:
 * • All API calls via Redux thunks (pharmacyStoreSlice)
 * • Fully memoised sub-components to prevent re-renders
 * • Debounced search input (avoids hammering API on keypress)
 * • Skeleton loaders for medicine list
 * • Accessible: ARIA roles, keyboard navigable, live regions
 * • Mobile-first responsive layout
 * • Updated for flattened Inventory + Populated Medicine schema
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Search,
  ChevronRight,
  Loader2,
  Package,
  Pill,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Zap,
  TrendingUp,
  Hash,
  Info,
  Clock,
  BarChart3,
  Layers
} from 'lucide-react';

import {
  requestStock,
  fetchMedicines,
  clearSuccess,
  clearError,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS  (stable module-level, never re-created)
═══════════════════════════════════════════════════════════════ */
const URGENCY_CONFIG = {
  Low: {
    label: 'Low',
    desc:  'Replenish within the week',
    colorVar: 'var(--success)',
    bgClass:  'bg-success/15',
    borderClass: 'border-success',
    icon: Clock,
  },
  Medium: {
    label: 'Medium',
    desc:  'Restock within 2–3 days',
    colorVar: 'var(--warning)',
    bgClass:  'bg-warning/15',
    borderClass: 'border-warning',
    icon: TrendingUp,
  },
  High: {
    label: 'High',
    desc:  'Needed today or tomorrow',
    colorVar: 'var(--error)',
    bgClass:  'bg-error/15',
    borderClass: 'border-error',
    icon: Zap,
  },
  Critical: {
    label: 'Critical',
    desc:  'Out of stock — urgent!',
    colorVar: 'var(--error)',
    bgClass:  'bg-error/20',
    borderClass: 'border-error',
    icon: AlertCircle,
  },
};

const URGENCY_KEYS    = Object.keys(URGENCY_CONFIG);
const QUANTITY_PRESETS = [25, 50, 100, 200, 500];

const DEBOUNCE_MS = 320;

/* ═══════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
═══════════════════════════════════════════════════════════════ */
const fadeUp = {
  hidden:  { opacity: 0, y: 22 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.065, duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  }),
};

const slideInRight = {
  hidden:  { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 20, transition: { duration: 0.22 } },
};

const slideInLeft = {
  hidden:  { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: -20, transition: { duration: 0.22 } },
};

/* ═══════════════════════════════════════════════════════════════
   SKELETON LOADERS
═══════════════════════════════════════════════════════════════ */
function MedicineRowSkeleton() {
  return (
    <div className="card p-4 flex items-center gap-4 animate-pulse" aria-hidden="true">
      <div className="w-12 h-12 rounded-xl bg-base-300 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-base-300 rounded w-40" />
        <div className="h-2.5 bg-base-300 rounded w-24" />
      </div>
      <div className="w-5 h-5 bg-base-300 rounded" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UrgencyCard  — memoised
═══════════════════════════════════════════════════════════════ */
const UrgencyCard = memo(function UrgencyCard({ value, selected, onSelect }) {
  const cfg  = URGENCY_CONFIG[value];
  const Icon = cfg.icon;

  const handleClick = useCallback(() => onSelect(value), [onSelect, value]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={selected}
      className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
        ${selected
          ? `${cfg.bgClass} ${cfg.borderClass} shadow-md scale-[1.02]`
          : 'bg-base-200 border-transparent hover:border-base-content/20'}`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${cfg.bgClass}`}
        aria-hidden="true"
      >
        <Icon size={16} style={{ color: cfg.colorVar }} />
      </div>
      <p className="font-black text-sm text-base-content">{cfg.label}</p>
      <p className="text-[11px] text-base-content/50 mt-0.5 leading-snug">{cfg.desc}</p>
      {selected && (
        <div
          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: cfg.colorVar }}
          aria-hidden="true"
        >
          <CheckCircle2 size={11} className="text-white" />
        </div>
      )}
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   QuantityPreset button  — memoised
═══════════════════════════════════════════════════════════════ */
const QuantityPreset = memo(function QuantityPreset({ value, current, onClick }) {
  const handleClick = useCallback(() => onClick(value), [onClick, value]);
  const active = current === value;
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
        ${active
          ? 'bg-primary text-primary-content border-primary shadow'
          : 'bg-base-200 border-base-300 text-base-content/60 hover:border-primary'}`}
    >
      {value}
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   StepIndicator  — memoised
═══════════════════════════════════════════════════════════════ */
const STEPS = ['Select Medicine', 'Request Details'];

const StepIndicator = memo(function StepIndicator({ step }) {
  return (
    <nav aria-label="Request steps" className="flex items-center gap-2 mt-4 flex-wrap">
      {STEPS.map((label, i) => {
        const isActive   = step === i + 1;
        const isComplete = step > i + 1;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-300
                ${isActive   ? 'bg-primary text-primary-content shadow-md'
                  : isComplete ? 'bg-success text-success-content'
                  : 'bg-base-300 text-base-content/50'}`}
              aria-current={isActive ? 'step' : undefined}
            >
              {isComplete
                ? <CheckCircle2 size={12} aria-hidden="true" />
                : <span aria-hidden="true">{i + 1}</span>}
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight size={13} className="text-base-content/30" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </nav>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MedicineRow  — memoised list item (step 1)
═══════════════════════════════════════════════════════════════ */
const MedicineRow = memo(function MedicineRow({ invRecord, onSelect }) {
  const med = invRecord.medicineId || {};
  const inv = invRecord.availableStock ?? 0;
  const reorderThreshold = invRecord.reorderLevel || 5;
  const isLow = inv <= reorderThreshold;

  const handleClick = useCallback(() => onSelect(invRecord), [invRecord, onSelect]);

  return (
    <motion.button
      type="button"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      onClick={handleClick}
      className="card p-4 text-left w-full flex items-center gap-4 hover:border-primary group transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`Select ${med.brandName}, current stock: ${inv} units${isLow ? ', low stock' : ''}`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isLow ? 'bg-warning/15' : 'bg-primary/10'}`}
        aria-hidden="true"
      >
        <Pill size={20} className={isLow ? 'text-warning' : 'text-primary'} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-bold text-sm text-base-content">{med.brandName || 'Unknown Product'}</span>
          {isLow && inv > 0 && (
            <span className="badge badge-warning text-[10px]">Low Stock</span>
          )}
          {inv === 0 && (
            <span className="badge badge-error text-[10px]">Out of Stock</span>
          )}
        </div>
        <p className="text-xs text-base-content/50 truncate">
          {med.genericName} {med.dosage ? `· ${med.dosage}` : ''}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <p className="text-[11px] text-base-content/40 flex items-center gap-1">
            <Layers size={11}/>
            Current stock:{' '}
            <span className={`font-bold tabular-nums ${inv === 0 ? 'text-error' : isLow ? 'text-warning' : 'text-success'}`}>
              {inv} units
            </span>
          </p>
        </div>
      </div>

      <ChevronRight
        size={18}
        className="text-base-content/25 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0"
        aria-hidden="true"
      />
    </motion.button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SuccessState  — memoised
═══════════════════════════════════════════════════════════════ */
const SuccessState = memo(function SuccessState() {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1,    opacity: 1 }}
      exit={{   scale: 0.85, opacity: 0 }}
      role="status"
      aria-live="polite"
      className="card p-10 text-center mb-5 border-success/40 bg-success/5 shadow-sm"
    >
      <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={36} className="text-success" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-black text-base-content font-montserrat tracking-tight">Request Submitted!</h3>
      <p className="text-sm text-base-content/55 mt-2 max-w-sm mx-auto">
        Your restock request has been securely logged and forwarded to the procurement desk.
      </p>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   RecentRequestItem  — memoised
═══════════════════════════════════════════════════════════════ */
const RecentRequestItem = memo(function RecentRequestItem({ entry, index }) {
  const cfg  = URGENCY_CONFIG[entry.urgency] || URGENCY_CONFIG.Medium;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-3.5 rounded-xl bg-base-100 border border-base-200 shadow-sm"
      aria-label={`${entry.name}, ${entry.quantity} units, ${entry.urgency} urgency`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bgClass}`}
        aria-hidden="true"
      >
        <Icon size={14} style={{ color: cfg.colorVar }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-base-content truncate">{entry.name}</p>
        <p className="text-[10px] font-medium text-base-content/50 mt-0.5">{entry.quantity} units · <span style={{ color: cfg.colorVar }}>{entry.urgency}</span></p>
      </div>
      <CheckCircle2 size={14} className="text-success shrink-0" aria-hidden="true" />
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   UrgencyGuide sidebar  — memoised, pure static content
═══════════════════════════════════════════════════════════════ */
const UrgencyGuide = memo(function UrgencyGuide() {
  return (
    <div className="card p-5 bg-base-100 border border-base-200 shadow-sm">
      <h2 className="font-bold text-base-content text-sm mb-4 flex items-center gap-2">
        <Info size={14} className="text-info" aria-hidden="true" />
        Urgency Guide
      </h2>
      <dl className="space-y-3">
        {URGENCY_KEYS.map(k => {
          const cfg  = URGENCY_CONFIG[k];
          const Icon = cfg.icon;
          return (
            <div key={k} className="flex items-start gap-2.5">
              <div className={`p-1.5 rounded-md ${cfg.bgClass}`}>
                <Icon size={12} style={{ color: cfg.colorVar }} className="shrink-0" aria-hidden="true" />
              </div>
              <div>
                <dt className="text-xs font-bold text-base-content">{cfg.label}</dt>
                <dd className="text-[10px] font-medium text-base-content/50 mt-0.5">{cfg.desc}</dd>
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PAGE COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function RequestRestockPage() {
  const dispatch = useDispatch();

  /* ── Redux state (granular selectors) */
  const medicines       = useSelector(s => s.pharmacyStore.medicines);
  const loadingMeds     = useSelector(s => s.pharmacyStore.loading.medicines);
  const loadingRequest  = useSelector(s => s.pharmacyStore.loading.requestStock);
  const errorRequest    = useSelector(s => s.pharmacyStore.errors.requestStock);
  const successRequest  = useSelector(s => s.pharmacyStore.success.requestStock);

  /* ── Local state */
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState(null); // Full MedicineInventory doc
  const [step,      setStep]      = useState(1);
  const [urgency,   setUrgency]   = useState('Medium');
  const [quantity,  setQuantity]  = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [history,   setHistory]   = useState([]);

  /* ── Debounce search to avoid hammering the API on every keystroke */
  const debounceRef = useRef(null);

  const handleSearchChange = useCallback(e => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      dispatch(fetchMedicines({ search: val, limit: 12 }));
    }, DEBOUNCE_MS);
  }, [dispatch]);

  /* ── Initial fetch */
  useEffect(() => {
    dispatch(fetchMedicines({ search: '', limit: 12 }));
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [dispatch]);

  /* ── Handle success */
  useEffect(() => {
    if (!successRequest) return;

    setSubmitted(true);
    if (selected) {
      setHistory(h => [
        { 
          name: selected.medicineId?.brandName || selected.medicineId?.name || 'Unknown', 
          quantity: Number(quantity), 
          urgency, 
          time: new Date() 
        },
        ...h.slice(0, 4),
      ]);
    }
    dispatch(clearSuccess('requestStock'));

    const t = setTimeout(() => {
      setSubmitted(false);
      setSelected(null);
      setStep(1);
      setQuantity('');
      setUrgency('Medium');
      dispatch(clearError('requestStock'));
    }, 2800);

    return () => clearTimeout(t);
  }, [successRequest, dispatch, selected, quantity, urgency]);

  /* ── Derived */
  const currStock = useMemo(() => selected?.availableStock ?? 0, [selected]);
  const medData = selected?.medicineId;

  /* ── Callbacks */
  const handleMedSelect = useCallback((invRecord) => {
    setSelected(invRecord);
    setStep(2);
    dispatch(clearError('requestStock'));
  }, [dispatch]);

  const handleBack = useCallback(() => {
    setStep(1);
    setSelected(null);
    dispatch(clearError('requestStock'));
  }, [dispatch]);

  const handleUrgencySelect = useCallback(val => setUrgency(val), []);
  const handlePresetClick = useCallback(val => setQuantity(String(val)), []);
  const handleQuantityChange = useCallback(e => setQuantity(e.target.value), []);

  const handleSubmit = useCallback(e => {
    e.preventDefault();
    if (!selected || !quantity) return;
    
    // Crucial: Pass the actual Medicine _id, not the Inventory _id
    dispatch(requestStock({
      medicineId:       selected.medicineId._id,
      requiredQuantity: Number(quantity),
      urgency,
    }));
  }, [dispatch, selected, quantity, urgency]);

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div
      data-theme="pharmacy"
      className="min-h-screen bg-base-200 px-4 pt-6 pb-12 md:px-8"
    >
      {/* ── HEADER ───────────────────────────────────────────── */}
      <motion.header
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
        className="mb-8 max-w-6xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-0.5">
          {step === 2 && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back to medicine selection"
              className="p-2 rounded-xl bg-base-100 border border-base-300 text-base-content/60 hover:text-primary hover:border-primary transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tight font-montserrat flex items-center gap-2">
              <ShoppingCart size={24} className="text-primary" aria-hidden="true" />
              <span className="text-gradient-primary">Request Restock</span>
            </h1>
            <p className="text-sm text-base-content/55 mt-0.5 font-medium">
              {step === 1
                ? 'Select an inventory item to request replenishment'
                : `Restock request for ${medData?.brandName}`}
            </p>
          </div>
        </div>

        <StepIndicator step={step} />
      </motion.header>

      {/* ── LAYOUT GRID ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">

        {/* ── MAIN COLUMN ─────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">

            {/* ══ STEP 1 — Medicine picker ══════════════════════ */}
            {step === 1 && (
              <motion.section
                key="step1"
                variants={slideInLeft}
                initial="hidden"
                animate="visible"
                exit="exit"
                aria-label="Select a medicine"
              >
                {/* search */}
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={1}
                  className="card p-3 mb-4 shadow-sm border border-base-300"
                >
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={handleSearchChange}
                      placeholder="Search inventory by brand, generic name..."
                      aria-label="Search medicines"
                      className="input-field w-full pl-10 bg-base-200/50"
                      autoComplete="off"
                    />
                  </div>
                </motion.div>

                {/* list */}
                <div
                  className="space-y-3"
                  role="list"
                  aria-label="Medicine search results"
                  aria-busy={loadingMeds}
                >
                  {loadingMeds
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <MedicineRowSkeleton key={i} />
                      ))
                    : medicines.length > 0
                      ? medicines.map(invRecord => (
                          <div key={invRecord._id} role="listitem">
                            <MedicineRow invRecord={invRecord} onSelect={handleMedSelect} />
                          </div>
                        ))
                      : (
                          <div className="card p-12 text-center border-dashed border-base-300 bg-base-100/50" role="status">
                            <Package size={40} className="mx-auto mb-4 text-base-content/20" aria-hidden="true" />
                            <h3 className="font-bold text-lg text-base-content">No inventory found</h3>
                            <p className="text-sm text-base-content/50 mt-1">Try adjusting your search criteria.</p>
                          </div>
                        )
                  }
                </div>
              </motion.section>
            )}

            {/* ══ STEP 2 — Request form ══════════════════════════ */}
            {step === 2 && (
              <motion.section
                key="step2"
                variants={slideInRight}
                initial="hidden"
                animate="visible"
                exit="exit"
                aria-label="Restock request form"
              >
                {/* selected medicine card */}
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={0}
                  className="card bg-base-100 shadow-sm border border-base-200 p-5 mb-5"
                  aria-label={`Selected medicine: ${medData?.brandName}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <Pill size={24} className="text-primary" />
                    </div>
                    <div>
                      <h2 className="font-black text-xl text-base-content font-montserrat leading-tight">
                        {medData?.brandName}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="badge badge-info badge-outline text-[10px]">{medData?.category}</span>
                        <span className="text-xs text-base-content/50">
                          {medData?.genericName} {medData?.dosage ? `· ${medData.dosage}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] font-bold text-base-content/50 uppercase tracking-widest">
                          In Stock:
                        </span>
                        <span
                          className={`font-black text-sm tabular-nums ${
                            currStock === 0 ? 'text-error' : currStock <= (selected?.reorderLevel || 5) ? 'text-warning' : 'text-success'
                          }`}
                        >
                          {currStock} units
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* success overlay */}
                <AnimatePresence>
                  {submitted && <SuccessState />}
                </AnimatePresence>

                {/* form */}
                {!submitted && (
                  <motion.form
                    onSubmit={handleSubmit}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={1}
                    noValidate
                  >
                    <div className="card p-6 space-y-6 shadow-sm border border-base-200">

                      {/* urgency */}
                      <fieldset>
                        <legend className="block text-xs font-bold text-base-content/60 mb-3 uppercase tracking-wider">
                          Priority / Urgency Level <span className="text-error" aria-hidden="true">*</span>
                        </legend>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" role="group" aria-label="Select urgency level">
                          {URGENCY_KEYS.map(u => (
                            <UrgencyCard
                              key={u}
                              value={u}
                              selected={urgency === u}
                              onSelect={handleUrgencySelect}
                            />
                          ))}
                        </div>
                      </fieldset>

                      {/* quantity */}
                      <div>
                        <label
                          htmlFor="quantity-input"
                          className="block text-xs font-bold text-base-content/60 mb-2 uppercase tracking-wider"
                        >
                          Required Quantity <span className="text-error" aria-hidden="true">*</span>
                        </label>

                        {/* presets */}
                        <div
                          className="flex items-center gap-2 mb-3 flex-wrap bg-base-200/50 p-2 rounded-xl border border-base-200"
                          role="group"
                          aria-label="Quick quantity presets"
                        >
                          <span className="text-xs font-semibold text-base-content/40 px-2 uppercase tracking-wider">Presets:</span>
                          {QUANTITY_PRESETS.map(v => (
                            <QuantityPreset
                              key={v}
                              value={v}
                              current={Number(quantity)}
                              onClick={handlePresetClick}
                            />
                          ))}
                        </div>

                        {/* manual input */}
                        <div className="relative">
                          <Hash
                            size={14}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35"
                            aria-hidden="true"
                          />
                          <input
                            id="quantity-input"
                            type="number"
                            min="1"
                            required
                            value={quantity}
                            onChange={handleQuantityChange}
                            placeholder="Enter specific quantity..."
                            aria-label="Required quantity"
                            className="input-field w-full pl-9"
                          />
                        </div>
                      </div>

                      {/* info notice */}
                      <div className="alert bg-info/10 border-info/20 text-info-content text-xs rounded-xl flex items-start p-4" role="note">
                        <Info size={16} className="text-info shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="font-medium leading-relaxed text-base-content/70">
                          This request will be logged and procurement will be notified.
                          Your physical inventory will remain unchanged until the stock is formally received via a Purchase Order.
                        </span>
                      </div>

                      {/* error */}
                      {errorRequest && (
                        <div className="alert alert-error text-xs rounded-xl" role="alert">
                          <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
                          <span className="font-semibold">{errorRequest?.message || 'Failed to submit request. Please try again.'}</span>
                        </div>
                      )}

                      {/* submit */}
                      <button
                        type="submit"
                        disabled={loadingRequest || !quantity || Number(quantity) < 1}
                        className="btn btn-primary w-full flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-wider h-12 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        aria-busy={loadingRequest}
                      >
                        {loadingRequest
                          ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                          : <ShoppingCart size={16} aria-hidden="true" />}
                        {loadingRequest ? 'Transmitting Request...' : 'Submit Restock Request'}
                      </button>
                    </div>
                  </motion.form>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        <aside className="space-y-6" aria-label="Request history and guide">

          {/* recent requests */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="card p-5 bg-base-100 shadow-sm border border-base-200"
          >
            <h2 className="font-bold text-base-content text-sm mb-4 flex items-center gap-2 uppercase tracking-widest">
              <BarChart3 size={15} className="text-primary" aria-hidden="true" />
              Session Requests
            </h2>

            {history.length === 0 ? (
              <div className="text-center py-10 bg-base-200/50 rounded-xl border border-dashed border-base-300" role="status">
                <ShoppingCart size={28} className="mx-auto mb-3 opacity-20 text-base-content" aria-hidden="true" />
                <p className="text-xs font-semibold text-base-content/40">No requests submitted yet.</p>
              </div>
            ) : (
              <div className="space-y-3" role="list" aria-label="Recent restock requests">
                {history.map((entry, i) => (
                  <div key={i} role="listitem">
                    <RecentRequestItem entry={entry} index={i} />
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* urgency guide */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
          >
            <UrgencyGuide />
          </motion.div>
        </aside>
      </div>
    </div>
  ); 
}