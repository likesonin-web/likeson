'use client';

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
  Search,
  Package,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pill,
  ArrowLeft,
  Info,
  Hash,
  Calendar,
  IndianRupee,
  Layers,
  ShieldAlert,
  Clock,
  BarChart3,
  RefreshCcw,
  X,
  Sparkles,
  Check,
  AlertTriangle,
  MapPin,
  Truck,
  Percent,
  Tag
} from 'lucide-react';
import {
  addStock,
  fetchMedicines,
  fetchSuppliers,
  clearSuccess,
  clearError,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

// ─── Animation Variants ──────────────────────────────────────────────────────

const FADE_UP = {
  hidden:   { opacity: 0, y: 20 },
  visible:  (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
  exit:     { opacity: 0, y: -12, transition: { duration: 0.2 } },
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

const CATEGORY_COLORS = {
  Tablet:     'bg-info/10 text-info border-info/30',
  Capsule:    'bg-secondary/10 text-secondary border-secondary/30',
  Syrup:      'bg-accent/10 text-accent border-accent/30',
  Injection:  'bg-error/10 text-error border-error/30',
  Cream:      'bg-success/10 text-success border-success/30',
  Ointment:   'bg-warning/10 text-warning border-warning/30',
  Inhaler:    'bg-primary/10 text-primary border-primary/30',
  default:    'bg-base-300 text-base-content/60 border-base-300',
};

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

const MedicineSkeleton = memo(function MedicineSkeleton() {
  return (
    <div className="card p-4 flex items-start gap-4 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-base-300 shrink-0" />
      <div className="flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="h-3.5 bg-base-300 rounded w-1/3" />
          <div className="h-4 bg-base-300 rounded-full w-14" />
        </div>
        <div className="h-3 bg-base-300 rounded w-2/3" />
        <div className="flex gap-3">
          <div className="h-3 bg-base-300 rounded w-20" />
          <div className="h-3 bg-base-300 rounded w-24" />
        </div>
      </div>
      <div className="w-5 h-5 bg-base-300 rounded-full shrink-0 mt-2" />
    </div>
  );
});

// ─── Step indicator ───────────────────────────────────────────────────────────

const StepIndicator = memo(function StepIndicator({ step }) {
  const steps = ['Select Medicine', 'Stock Details', 'Confirm'];
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
                active   ? 'bg-primary text-primary-content shadow-primary' : '',
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

// ─── Medicine Card ────────────────────────────────────────────────────────────

const MedicineCard = memo(function MedicineCard({ med, onSelect, index }) {
  const medicineDetails = med.medicineId || {};
  const storeQty = med.stockQuantity || 0;
  
  const isOut  = storeQty === 0;
  const isLow  = storeQty > 0 && storeQty <= LOW_STOCK_THRESHOLD;
  const catCls = CATEGORY_COLORS[medicineDetails.category] ?? CATEGORY_COLORS.default;
  const primaryImg = medicineDetails.images?.find((img) => img.isPrimary)?.url;

  const nearestExpiry = med.batchId?.expiryDate ? new Date(med.batchId.expiryDate) : null;

  const daysToExpiry = nearestExpiry
    ? Math.ceil((nearestExpiry.getTime() - Date.now()) / 86400000)
    : null;

  return (
    <motion.article
      variants={FADE_UP}
      initial="hidden"
      animate="visible"
      custom={index * 0.3}
      layout
      onClick={() => onSelect(med)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(med)}
      aria-label={`Select ${medicineDetails.brandName} for restocking`}
      className={[
        'group card p-4 cursor-pointer flex items-start gap-4',
        'hover:border-primary hover:shadow-primary transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        isOut ? 'border-error/30 bg-error/[0.02]' : '',
      ].join(' ')}
    >
      <div className="relative shrink-0">
        <div className={[
          'w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden',
          'bg-gradient-to-br from-primary/20 to-secondary/20',
        ].join(' ')}>
          {primaryImg
            ? <img src={primaryImg} alt={medicineDetails.brandName} className="w-full h-full object-cover" />
            : <Pill size={20} className="text-primary" aria-hidden="true" />
          }
        </div>
        <span
          className={[
            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-base-100',
            isOut ? 'bg-error' : isLow ? 'bg-warning' : 'bg-success',
          ].join(' ')}
          aria-hidden="true"
          title={isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1">
          <span className="font-bold text-sm text-base-content leading-tight truncate">
            {medicineDetails.brandName}
          </span>
          <span className={`badge text-[10px] px-2 py-0.5 border rounded-full font-semibold ${catCls}`}>
            {medicineDetails.category}
          </span>
          {medicineDetails.schedule && medicineDetails.schedule !== 'None' && (
            <span className="badge text-[10px] px-2 py-0.5 border rounded-full font-semibold bg-error/10 text-error border-error/30">
              Sch {medicineDetails.schedule}
            </span>
          )}
        </div>

        <p className="text-xs text-base-content/55 truncate mb-2">
          {medicineDetails.genericName}
          {medicineDetails.dosage ? <span className="text-base-content/35"> · {medicineDetails.dosage}</span> : null}
          {medicineDetails.manufacturer ? <span className="text-base-content/35"> · {medicineDetails.manufacturer}</span> : null}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] font-semibold">
            <Layers size={11} className="text-base-content/35" />
            <span className={isOut ? 'text-error' : isLow ? 'text-warning' : 'text-success'}>
              {storeQty} units
            </span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-base-content/45">
            <IndianRupee size={11} />
            MRP {med.mrp || medicineDetails.referenceMrp || 0}
          </span>
          {daysToExpiry !== null && daysToExpiry <= 90 && (
            <span className={`flex items-center gap-1 text-[11px] font-semibold ${daysToExpiry <= 30 ? 'text-error' : 'text-warning'}`}>
              <Clock size={11} />
              Exp in {daysToExpiry}d
            </span>
          )}
          {medicineDetails.isPrescriptionRequired && (
            <span className="flex items-center gap-1 text-[11px] text-base-content/40">
              <ShieldAlert size={11} />
              Rx
            </span>
          )}
        </div>
      </div>

      <ChevronRight
        size={16}
        className="text-base-content/25 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
        aria-hidden="true"
      />
    </motion.article>
  );
});

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptySearch = memo(function EmptySearch({ query }) {
  return (
    <motion.div
      variants={FADE_UP}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center py-20 text-center"
    >
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

// ─── Live Stock Preview Panel ──────────────────────────────────────────────────

const StockPreview = memo(function StockPreview({ medicine, form }) {
  const currentQty = medicine?.stockQuantity || 0;
  const addingQty  = Number(form.stockQuantity) || 0;
  const newTotal   = currentQty + addingQty;
  const isLow      = newTotal <= LOW_STOCK_THRESHOLD && newTotal > 0;
  const isOut      = newTotal === 0;

  if (!medicine) return null;

  return (
    <div className="rounded-xl border border-base-300 bg-base-200/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-300 flex items-center gap-2">
        <BarChart3 size={13} className="text-primary" />
        <span className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Stock Preview</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Current', value: currentQty, color: 'text-base-content' },
          { label: 'Adding',  value: addingQty > 0 ? `+${addingQty}` : '—', color: 'text-primary' },
          { label: 'New Total', value: addingQty > 0 ? newTotal : '—',
            color: isOut ? 'text-error' : isLow ? 'text-warning' : addingQty > 0 ? 'text-success' : 'text-base-content' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <div className={`text-xl font-black tabular-nums ${color}`}>{value}</div>
            <div className="text-[10px] text-base-content/40 uppercase tracking-wider mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      {addingQty > 0 && newTotal <= LOW_STOCK_THRESHOLD && (
        <div className="mx-3 mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/25">
          <AlertTriangle size={13} className="text-warning mt-0.5 shrink-0" />
          <p className="text-[11px] text-warning font-medium leading-snug">
            Final stock will be ≤{LOW_STOCK_THRESHOLD} — a low-stock alert will be sent.
          </p>
        </div>
      )}
    </div>
  );
});

// ─── Form Field ───────────────────────────────────────────────────────────────

const FormField = memo(function FormField({
  id, label, required, hint, icon: Icon, error, children,
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold text-base-content/60 uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35 pointer-events-none" aria-hidden="true">
            <Icon size={14} />
          </div>
        )}
        {children}
      </div>
      {hint && !error && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-base-content/40">
          <Info size={10} /> {hint}
        </p>
      )}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-error" role="alert">
          <AlertCircle size={10} /> {error}
        </p>
      )}
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
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h3 className="text-2xl font-black text-base-content tracking-tight mb-1">Stock Added!</h3>
        <p className="text-sm text-base-content/55">
          <span className="font-semibold text-base-content">{qty} units</span> added to{' '}
          <span className="font-semibold text-primary">{medicine?.medicineId?.brandName}</span>
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

// ─── Selected Medicine Badge (Step 2 header) ──────────────────────────────────

const SelectedMedicineBanner = memo(function SelectedMedicineBanner({ medicine, onBack }) {
  const medicineDetails = medicine.medicineId || {};
  const storeQty = medicine.stockQuantity || 0;
  const primaryImg = medicineDetails.images?.find((img) => img.isPrimary)?.url;

  return (
    <div className="glass-card p-4 flex items-center gap-4">
      {/* Back */}
      <button
        onClick={onBack}
        aria-label="Go back to medicine selection"
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base-content/50 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
      >
        <ArrowLeft size={16} />
      </button>

      {/* Medicine identity */}
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 overflow-hidden">
        {primaryImg
          ? <img src={primaryImg} alt="" className="w-full h-full object-cover" />
          : <Pill size={18} className="text-white" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-base-content text-sm leading-tight">{medicineDetails.brandName}</span>
          <span className={`badge text-[10px] px-2 py-0.5 border rounded-full font-semibold ${CATEGORY_COLORS[medicineDetails.category] ?? CATEGORY_COLORS.default}`}>
            {medicineDetails.category}
          </span>
        </div>
        <p className="text-xs text-base-content/45 truncate mt-0.5">
          {medicineDetails.genericName} · {medicineDetails.dosage}
        </p>
      </div>

      {/* Live stock */}
      <div className="text-right shrink-0">
        <div className={`text-lg font-black tabular-nums ${storeQty <= LOW_STOCK_THRESHOLD ? (storeQty === 0 ? 'text-error' : 'text-warning') : 'text-success'}`}>
          {storeQty}
        </div>
        <div className="text-[10px] text-base-content/35 uppercase tracking-wide">in stock</div>
      </div>
    </div>
  );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AddStockPage() {
  const dispatch = useDispatch();
  const { medicines, suppliers, loading, errors, success } = useSelector((s) => s.pharmacyStore);

  // ── Local state ───────────────────────────────────────────────────────────
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);
  const [step, setStep]           = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    stockQuantity:   '',
    batchNumber:     '',
    expiryDate:      '',
    mrp:             '',
    sellingPrice:    '',
    purchasePrice:   '',
    discountPercent: '',
    supplierId:      '',
    rackLocation:    '',
  });

  const searchRef  = useRef(null);
  const qtyRef     = useRef(null);

  // ── Auto-focus management ─────────────────────────────────────────────────
  useEffect(() => {
    if (step === 1) searchRef.current?.focus();
    if (step === 2) setTimeout(() => qtyRef.current?.focus(), 350);
  }, [step]);

  // ── Fetch medicines & suppliers ───────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchMedicines({ search: search.trim(), limit: 12 }));
  }, [search, dispatch]);

  useEffect(() => {
    // Fetch suppliers once so the dropdown is populated
    dispatch(fetchSuppliers({ limit: 100 }));
  }, [dispatch]);

  // ── Handle add-stock success ──────────────────────────────────────────────
  useEffect(() => {
    if (!success.addStock) return;
    setSubmitted(true);
    dispatch(clearSuccess('addStock'));
    const timer = setTimeout(() => {
      setSubmitted(false);
      setSelected(null);
      setStep(1);
      setForm({
        stockQuantity: '', batchNumber: '', expiryDate: '', mrp: '', 
        sellingPrice: '', purchasePrice: '', discountPercent: '', 
        supplierId: '', rackLocation: ''
      });
      setFieldErrors({});
    }, 2800);
    return () => clearTimeout(timer);
  }, [success.addStock, dispatch]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelect = useCallback((med) => {
    setSelected(med);
    
    // Auto-fill existing inventory values if they exist, otherwise fallback to reference MRP
    setForm((f) => ({
      ...f,
      mrp:             med.mrp != null ? String(med.mrp) : (med.medicineId?.referenceMrp ? String(med.medicineId.referenceMrp) : ''),
      sellingPrice:    med.sellingPrice != null ? String(med.sellingPrice) : (med.medicineId?.referenceMrp ? String(med.medicineId.referenceMrp) : ''),
      purchasePrice:   '',
      discountPercent: med.discountPercent != null ? String(med.discountPercent) : '',
      rackLocation:    med.rackLocation || '',
      supplierId:      med.supplierId?._id || '',
    }));
    
    setFieldErrors({});
    dispatch(clearError('addStock'));
    setStep(2);
  }, [dispatch]);

  const handleBack = useCallback(() => {
    setStep(1);
    setSelected(null);
    setForm({
      stockQuantity: '', batchNumber: '', expiryDate: '', mrp: '', 
      sellingPrice: '', purchasePrice: '', discountPercent: '', 
      supplierId: '', rackLocation: ''
    });
    setFieldErrors({});
    dispatch(clearError('addStock'));
  }, [dispatch]);

  const handleFieldChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: undefined }));
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch('');
    searchRef.current?.focus();
  }, []);

  // ── Client-side validation ────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    if (!form.stockQuantity || Number(form.stockQuantity) <= 0)
      errs.stockQuantity = 'Enter a valid quantity';
    if (!form.batchNumber.trim())
      errs.batchNumber = 'Batch number is required';
    if (!form.expiryDate)
      errs.expiryDate = 'Expiry date is required';
    else if (new Date(form.expiryDate) <= new Date())
      errs.expiryDate = 'Expiry date must be in the future';
    if (!form.mrp || Number(form.mrp) <= 0)
      errs.mrp = 'Valid MRP is required';
    if (!form.sellingPrice || Number(form.sellingPrice) <= 0)
      errs.sellingPrice = 'Valid Selling Price is required';
    
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!selected || !validate()) return;

    dispatch(addStock({
      medicineId:      selected.medicineId._id,
      stockQuantity:   Number(form.stockQuantity),
      batchNumber:     form.batchNumber.trim().toUpperCase(),
      expiryDate:      form.expiryDate,
      mrp:             Number(form.mrp),
      sellingPrice:    Number(form.sellingPrice),
      // Optional fields mapped safely
      ...(form.purchasePrice   && { purchasePrice: Number(form.purchasePrice) }),
      ...(form.discountPercent && { discountPercent: Number(form.discountPercent) }),
      ...(form.supplierId      && { supplierId: form.supplierId }),
      ...(form.rackLocation    && { rackLocation: form.rackLocation.trim() }),
    }));
  }, [selected, form, validate, dispatch]);

  // ── Min expiry date (tomorrow) ────────────────────────────────────────────
  const minExpiryDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // ── Shared input class ────────────────────────────────────────────────────
  const inputCls = (hasErr) =>
    `input-field w-full pl-9 ${hasErr ? 'border-error focus:border-error focus:ring-error/30' : ''}`;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-10">

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
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Layers size={16} className="text-primary" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-base-content font-montserrat">
                  <span className="text-gradient-primary">Add Stock</span>
                </h1>
                <Sparkles size={16} className="text-primary/60" aria-hidden="true" />
              </div>
              <p className="text-sm text-base-content/50 ml-10">
                {step === 1
                  ? 'Search and select a medicine to restock'
                  : `Restocking · ${selected?.medicineId?.brandName}`}
              </p>
            </div>

            {/* Step indicator */}
            <StepIndicator step={step} />
          </div>
        </motion.header>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* STEP 1: Medicine Selection */}
          {step === 1 && (
            <motion.div
              key="step1"
              variants={SLIDE_RIGHT}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Search bar */}
              <motion.div
                variants={FADE_UP}
                initial="hidden"
                animate="visible"
                custom={1}
                className="mb-5 max-w-4xl mx-auto"
              >
                <div className="card p-3 flex items-center gap-3">
                  <Search size={16} className="text-primary shrink-0" aria-hidden="true" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by brand name, generic name, or manufacturer…"
                    aria-label="Search medicines"
                    className="flex-1 bg-transparent text-sm text-base-content placeholder:text-base-content/35 outline-none"
                  />
                  {search && (
                    <button
                      onClick={handleClearSearch}
                      aria-label="Clear search"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-base-content/40 hover:bg-base-300 hover:text-base-content transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                  {loading.medicines && (
                    <Loader2 size={15} className="text-primary animate-spin shrink-0" aria-label="Loading…" />
                  )}
                </div>
              </motion.div>

              {/* Results */}
              <div className="max-w-4xl mx-auto">
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
                        <MedicineCard
                          key={med._id}
                          med={med}
                          onSelect={handleSelect}
                          index={i}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 2: Stock Form */}
          {step === 2 && (
            <motion.div
              key="step2"
              variants={SLIDE_LEFT}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Selected medicine banner */}
              <motion.div variants={FADE_UP} initial="hidden" animate="visible" custom={0} className="mb-5">
                <SelectedMedicineBanner medicine={selected} onBack={handleBack} />
              </motion.div>

              <AnimatePresence mode="wait">
                {/* Success state */}
                {submitted ? (
                  <motion.div key="success" variants={FADE_UP} initial="hidden" animate="visible" exit="exit" className="max-w-2xl mx-auto">
                    <SuccessOverlay medicine={selected} qty={form.stockQuantity} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    variants={FADE_UP}
                    initial="hidden"
                    animate="visible"
                    custom={1}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-5"
                  >
                    {/* ── Main Form (8/12 width) ───────────────────────── */}
                    <form
                      onSubmit={handleSubmit}
                      noValidate
                      className="lg:col-span-8 card p-6 space-y-6"
                      aria-label="Add stock form"
                    >
                      {/* Section 1: Basic Info */}
                      <div>
                        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-base-300">
                          <Package size={15} className="text-primary" />
                          <span className="text-xs font-bold text-primary/80 uppercase tracking-widest">
                            Batch & Quantity
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <FormField id="stockQuantity" label="Quantity" required icon={Hash} error={fieldErrors.stockQuantity}>
                            <input
                              ref={qtyRef}
                              id="stockQuantity"
                              type="number"
                              min="1"
                              inputMode="numeric"
                              value={form.stockQuantity}
                              onChange={(e) => handleFieldChange('stockQuantity', e.target.value)}
                              placeholder="e.g. 100"
                              aria-required="true"
                              className={inputCls(fieldErrors.stockQuantity)}
                            />
                          </FormField>

                          <FormField id="batchNumber" label="Batch Number" required icon={Hash} error={fieldErrors.batchNumber}>
                            <input
                              id="batchNumber"
                              type="text"
                              value={form.batchNumber}
                              onChange={(e) => handleFieldChange('batchNumber', e.target.value)}
                              placeholder="e.g. BATCH-001"
                              aria-required="true"
                              className={inputCls(fieldErrors.batchNumber)}
                            />
                          </FormField>

                          <FormField id="expiryDate" label="Expiry Date" required icon={Calendar} error={fieldErrors.expiryDate}>
                            <input
                              id="expiryDate"
                              type="date"
                              min={minExpiryDate}
                              value={form.expiryDate}
                              onChange={(e) => handleFieldChange('expiryDate', e.target.value)}
                              aria-required="true"
                              className={inputCls(fieldErrors.expiryDate)}
                            />
                          </FormField>
                        </div>
                      </div>

                      {/* Section 2: Pricing */}
                      <div>
                        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-base-300">
                          <IndianRupee size={15} className="text-primary" />
                          <span className="text-xs font-bold text-primary/80 uppercase tracking-widest">
                            Pricing Configuration
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <FormField id="mrp" label="MRP (₹)" required icon={IndianRupee} error={fieldErrors.mrp}>
                            <input
                              id="mrp"
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.mrp}
                              onChange={(e) => handleFieldChange('mrp', e.target.value)}
                              placeholder="0.00"
                              className={inputCls(fieldErrors.mrp)}
                            />
                          </FormField>

                          <FormField id="sellingPrice" label="Selling Price (₹)" required icon={Tag} error={fieldErrors.sellingPrice}>
                            <input
                              id="sellingPrice"
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.sellingPrice}
                              onChange={(e) => handleFieldChange('sellingPrice', e.target.value)}
                              placeholder="0.00"
                              className={inputCls(fieldErrors.sellingPrice)}
                            />
                          </FormField>

                          <FormField id="discountPercent" label="Discount (%)" icon={Percent} hint="Optional">
                            <input
                              id="discountPercent"
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={form.discountPercent}
                              onChange={(e) => handleFieldChange('discountPercent', e.target.value)}
                              placeholder="0"
                              className={inputCls(false)}
                            />
                          </FormField>

                          <FormField id="purchasePrice" label="Purchase Price (₹)" icon={IndianRupee} hint="Optional PTR">
                            <input
                              id="purchasePrice"
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.purchasePrice}
                              onChange={(e) => handleFieldChange('purchasePrice', e.target.value)}
                              placeholder="0.00"
                              className={inputCls(false)}
                            />
                          </FormField>
                        </div>
                      </div>

                      {/* Section 3: Supply & Storage */}
                      <div>
                        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-base-300">
                          <Truck size={15} className="text-primary" />
                          <span className="text-xs font-bold text-primary/80 uppercase tracking-widest">
                            Source & Storage
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField id="supplierId" label="Supplier" icon={Truck} hint="Where did this stock come from?">
                            <select
                              id="supplierId"
                              value={form.supplierId}
                              onChange={(e) => handleFieldChange('supplierId', e.target.value)}
                              className={inputCls(false)}
                            >
                              <option value="">Select Supplier (Optional)</option>
                              {(suppliers || []).map((s) => (
                                <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                              ))}
                            </select>
                          </FormField>

                          <FormField id="rackLocation" label="Rack Location" icon={MapPin} hint="e.g. Aisle-3 / Rack-B">
                            <input
                              id="rackLocation"
                              type="text"
                              value={form.rackLocation}
                              onChange={(e) => handleFieldChange('rackLocation', e.target.value)}
                              placeholder="Physical storage location"
                              className={inputCls(false)}
                            />
                          </FormField>
                        </div>
                      </div>

                      {/* Info alert */}
                      <div className="alert alert-info text-xs py-2" role="note">
                        <Info size={14} className="text-info shrink-0 mt-0.5" aria-hidden="true" />
                        <span>
                          A low-stock alert is automatically dispatched when units drop to or below{' '}
                          <strong>{LOW_STOCK_THRESHOLD}</strong>.
                        </span>
                      </div>

                      {/* API Error */}
                      {errors.addStock && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="alert alert-error text-xs"
                          role="alert"
                        >
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{errors.addStock?.message || 'Failed to add stock. Please try again.'}</span>
                        </motion.div>
                      )}

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={loading.addStock}
                        aria-busy={loading.addStock}
                        className="btn-primary-cta w-full flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                      >
                        {loading.addStock ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Adding Stock…
                          </>
                        ) : (
                          <>
                            <Layers size={16} />
                            Add {form.stockQuantity ? `${form.stockQuantity} Units` : 'Stock'}
                          </>
                        )}
                      </button>
                    </form>

                    {/* ── Side Panel (4/12 width) ───────────────────────── */}
                    <aside className="lg:col-span-4 space-y-4" aria-label="Stock details sidebar">
                      {/* Stock preview widget */}
                      <motion.div variants={FADE_UP} initial="hidden" animate="visible" custom={2}>
                        <StockPreview medicine={selected} form={form} />
                      </motion.div>

                      {/* Medicine meta card */}
                      <motion.div
                        variants={FADE_UP}
                        initial="hidden"
                        animate="visible"
                        custom={3}
                        className="card p-4 space-y-3"
                      >
                        <div className="flex items-center gap-2 pb-2 border-b border-base-300">
                          <Info size={13} className="text-primary" />
                          <span className="text-[11px] font-bold text-base-content/50 uppercase tracking-widest">
                            Medicine Details
                          </span>
                        </div>

                        {[
                          { label: 'Generic',      value: selected?.medicineId?.genericName },
                          { label: 'Manufacturer', value: selected?.medicineId?.manufacturer },
                          { label: 'Packaging',    value: selected?.medicineId?.packaging },
                          { label: 'Ref MRP',      value: selected?.medicineId?.referenceMrp != null ? `₹${selected.medicineId.referenceMrp}` : null },
                          { label: 'Schedule',     value: selected?.medicineId?.schedule && selected?.medicineId?.schedule !== 'None' ? `Schedule ${selected?.medicineId?.schedule}` : 'OTC' },
                          { label: 'GST',          value: selected?.medicineId?.gstPercentage != null ? `${selected.medicineId.gstPercentage}%` : null },
                        ].filter((r) => r.value).map(({ label, value }) => (
                          <div key={label} className="flex justify-between items-baseline gap-2">
                            <span className="text-xs text-base-content/40 shrink-0">{label}</span>
                            <span className="text-xs font-semibold text-base-content text-right truncate">{value}</span>
                          </div>
                        ))}
                      </motion.div>

                      {/* Active batch summary */}
                      {selected?.batchId && (
                        <motion.div
                          variants={FADE_UP}
                          initial="hidden"
                          animate="visible"
                          custom={4}
                          className="card p-4"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <RefreshCcw size={13} className="text-primary" />
                            <span className="text-[11px] font-bold text-base-content/50 uppercase tracking-widest">
                              Active Batch
                            </span>
                          </div>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-base-200">
                              <span className="font-mono text-base-content/60 text-[11px]">
                                {selected.batchId.batchNumber || '—'}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className={`font-bold tabular-nums ${selected.batchId.remainingQuantity <= LOW_STOCK_THRESHOLD ? 'text-warning' : 'text-success'}`}>
                                  {selected.batchId.remainingQuantity} u
                                </span>
                                {selected.batchId.expiryDate && (
                                  <span className="text-base-content/35 text-[10px]">
                                    {new Date(selected.batchId.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
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