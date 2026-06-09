'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill, Package, Tag, AlertCircle, CheckCircle2, ShieldCheck,
  Beaker, Syringe, Wind, Droplets, Layers, FlaskConical,
  Share2, Printer, Maximize2, X, ChevronRight, ShoppingCart,
  UploadCloud, CheckCheck, Building2, BookOpen,
  AlertTriangle, Ban, Minus, Plus,
  MapPin, Clock, Star, Thermometer, Hash, Percent,
  RefreshCw, ArrowLeft, Info, HeartPulse, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Container from '@/components/ui/Container';
import { selectMySubscription, selectMySubPlanName } from '@/store/slices/subscriptionSlice';

// ─── Redux Actions ────────────────────────────────────────────────────────────
import {
  fetchMedicineBySlug,
  resetCurrentMedicine,
  selectCurrentMedicine,
  selectMedicineLoading,
  selectMedicineError,
} from '@/store/slices/medicineSlice';
import { fetchWalletDetails } from '@/store/slices/walletSlice';
import {
  fetchSimilarMedicines,
  selectSimilarMedicines,
  selectSimilarMedicinesLoading,
  addToCart,
  selectPharmacyActionLoading,
  clearCurrentOrder,
  clearCoupon,
} from '@/store/slices/pharmacyOrderSlice';
import { uploadSingleFile } from '@/store/slices/uploadSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_ICONS = {
  Tablet:    Pill,
  Capsule:   FlaskConical,
  Syrup:     Beaker,
  Injection: Syringe,
  Ointment:  Package,
  Drops:     Droplets,
  Inhaler:   Wind,
  Powder:    Layers,
};

const SCHEDULE_META = {
  H:    { label: 'Schedule H',  colorClass: 'badge-error',   desc: 'Sold only on prescription of Registered Medical Practitioner.' },
  H1:   { label: 'Schedule H1', colorClass: 'badge-error',   desc: 'Dangerous drug — sold on Rx only. Sales must be recorded for 3 years.' },
  G:    { label: 'Schedule G',  colorClass: 'badge-warning', desc: 'Caution: Take only under medical supervision.' },
  X:    { label: 'Schedule X',  colorClass: 'badge-error',   desc: 'Narcotic/Psychotropic substance. Requires special Rx and record-keeping.' },
  None: { label: 'OTC',         colorClass: 'badge-success', desc: 'Over-the-counter. No prescription required.' },
};

const TABS = ['Overview', 'Composition', 'Safety', 'Legal'];

// ─── Utility ─────────────────────────────────────────────────────────────────

const getBestInventory = (inventory = []) =>
  inventory.find((inv) => inv.stockQuantity > 0) ?? inventory[0] ?? null;

const extractStoreId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value._id) return value._id.toString();
  if (typeof value === 'object' && value.$oid) return value.$oid.toString();
  return value.toString();
};

// ─── Sub-Component: ImageGallery ──────────────────────────────────────────────
const ImageGallery = React.memo(({ images, activeIdx, onIdxChange, onOpenFull }) => {
  const containerRef = useRef(null);
  const thumbsRef    = useRef(null);
  const [lensPos,  setLensPos]  = useState({ x: 0, y: 0 });
  const [zoomPos,  setZoomPos]  = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const LENS = 130;
  const ZOOM = 2.8;

  useEffect(() => {
    if (!thumbsRef.current) return;
    const el = thumbsRef.current.children[activeIdx];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeIdx]);

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    const lx   = Math.max(LENS / 2, Math.min(rect.width  - LENS / 2, x));
    const ly   = Math.max(LENS / 2, Math.min(rect.height - LENS / 2, y));
    setLensPos({ x: lx, y: ly });
    setZoomPos({
      x: ((lx - LENS / 2) / (rect.width  - LENS)) * 100,
      y: ((ly - LENS / 2) / (rect.height - LENS)) * 100,
    });
  }, []);

  const currentSrc = images?.[activeIdx]?.url ?? null;

  if (!images?.length) {
    return (
      <div className="aspect-square rounded-xl bg-base-200 flex items-center justify-center border border-base-300">
        <Pill className="w-20 h-20 text-primary/20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className="relative aspect-square rounded-2xl overflow-hidden bg-white border border-base-300 cursor-crosshair select-none"
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={activeIdx}
              src={currentSrc}
              alt="Medicine product"
              loading="lazy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full object-contain p-6"
            />
          </AnimatePresence>

          {hovering && (
            <div
              aria-hidden="true"
              className="absolute hidden lg:block border border-primary/40 bg-primary/5 pointer-events-none z-20"
              style={{
                width:  LENS, height: LENS,
                left:   lensPos.x - LENS / 2,
                top:    lensPos.y - LENS / 2,
                borderRadius: 'var(--r-field)',
              }}
            />
          )}

          <button
            onClick={onOpenFull}
            aria-label="Open fullscreen image"
            className="absolute top-4 right-4 p-2.5 rounded-xl bg-base-100 backdrop-blur hover:bg-primary hover:text-primary-content transition-all z-30 shadow-sm"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {hovering && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-[105%] top-0 w-full h-full z-[100] rounded-2xl overflow-hidden border border-base-300 bg-white hidden lg:block shadow-xl"
              style={{
                backgroundImage:    `url(${currentSrc})`,
                backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                backgroundSize:     `${ZOOM * 100}%`,
                backgroundRepeat:   'no-repeat',
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <div ref={thumbsRef} className="flex gap-2.5 overflow-x-auto p-1 pb-2" style={{ scrollbarWidth: 'none' }}>
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => onIdxChange(i)}
            aria-label={`View image ${i + 1}`}
            className={`relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
              i === activeIdx ? 'border-primary scale-105 shadow-sm' : 'border-base-200 opacity-60 hover:opacity-100'
            }`}
          >
            <img src={img.url} className="w-full h-full object-cover bg-white" alt={`thumbnail ${i + 1}`} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
});
ImageGallery.displayName = 'ImageGallery';

// ─── Sub-Component: InfoBox ───────────────────────────────────────────────────
const InfoBox = React.memo(({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-base-200/60 border border-base-300">
    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="w-4.5 h-4.5 text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{label}</p>
      <p className="text-xs font-bold text-base-content truncate">{value || '—'}</p>
    </div>
  </div>
));
InfoBox.displayName = 'InfoBox';

// ─── Sub-Component: SafetyCard ────────────────────────────────────────────────
const SafetyCard = React.memo(({ title, list = [], icon: Icon, variant }) => {
  const styles = variant === 'error'
    ? 'text-error border-error/20 bg-error/5'
    : 'text-warning border-warning/20 bg-warning/5';
  return (
    <div className={`p-5 rounded-xl border-2 ${styles}`}>
      <h5 className="flex items-center gap-2 font-black text-xs uppercase tracking-widest mb-3">
        <Icon className="w-4 h-4" /> {title}
      </h5>
      {list.length === 0 ? (
        <p className="text-xs text-base-content/40 italic">None listed.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((item, i) => (
            <span key={i} className="px-2.5 py-1 bg-white/60 border border-current/20 rounded-lg text-[10px] font-bold">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
SafetyCard.displayName = 'SafetyCard';

// ─── Sub-Component: StockBadge ────────────────────────────────────────────────
const StockBadge = React.memo(({ inventory }) => {
  const best       = getBestInventory(inventory);
  const totalStock = (inventory ?? []).reduce((s, i) => s + (i.stockQuantity ?? 0), 0);
  const isLow      = best?.isLowStock || (totalStock > 0 && totalStock < 10);
  const isOut      = totalStock === 0;

  if (isOut) return <span className="badge badge-error text-[10px] font-bold px-2.5 py-1">Out of Stock</span>;
  if (isLow) return (
    <span className="badge badge-warning text-[10px] font-bold px-2.5 py-1 flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" /> Low Stock ({totalStock} left)
    </span>
  );
  return (
    <span className="badge badge-success text-[10px] font-bold px-2.5 py-1 flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3" /> In Stock ({totalStock} units)
    </span>
  );
});
StockBadge.displayName = 'StockBadge';

// ─── Sub-Component: SubscriptionBanner ───────────────────────────────────────
const SubscriptionBanner = React.memo(({ discount, planName }) => {
  if (!discount || discount === 0) return null;
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20 mb-5">
      <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
        <Star className="w-5 h-5 text-success" />
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-success">{planName} Benefit Applied</p>
        <p className="text-sm text-base-content/70 mt-0.5">
          You save <strong className="text-success">{discount}%</strong> on this medicine with your active plan.
        </p>
      </div>
    </div>
  );
});
SubscriptionBanner.displayName = 'SubscriptionBanner';

// ─── Sub-Component: PrescriptionUploader ─────────────────────────────────────
const PrescriptionUploader = React.memo(({
  prescriptionUrl,
  isUploading,
  onUpload,
  showRequiredError = false,
}) => (
  <div className={`p-5 rounded-xl border-2 border-dashed transition-all ${
    prescriptionUrl
      ? 'border-success bg-success/5'
      : showRequiredError
      ? 'border-error bg-error/5 animate-pulse'
      : 'border-error/30 bg-error/5'
  }`}>
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
          prescriptionUrl ? 'bg-success text-white' : 'bg-error text-white'
        }`}>
          {isUploading
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : prescriptionUrl
            ? <CheckCheck className="w-6 h-6" />
            : <UploadCloud className="w-6 h-6" />}
        </div>
        <div>
          <h4 className="text-sm font-black text-base-content flex items-center gap-2">
            Prescription Required
            {!prescriptionUrl && (
              <span className="text-[9px] font-black text-error bg-error/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Required
              </span>
            )}
          </h4>
          <p className="text-xs text-base-content/60 mt-0.5">
            {prescriptionUrl
              ? 'Prescription uploaded successfully. You can replace it if needed.'
              : showRequiredError
              ? 'Upload a valid Rx before you can add to cart.'
              : 'Upload a valid Rx from a licensed doctor to proceed.'}
          </p>
          {prescriptionUrl && (
            <a
              href={prescriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-primary underline mt-1 inline-block hover:text-primary/80 transition-colors"
            >
              View uploaded prescription ↗
            </a>
          )}
        </div>
      </div>

      <label className={`cursor-pointer text-xs py-2.5 px-5 rounded-xl shrink-0 font-black uppercase tracking-wider transition-all shadow-sm ${
        isUploading
          ? 'bg-base-200 text-base-content/40 cursor-not-allowed'
          : prescriptionUrl
          ? 'bg-base-200 text-base-content hover:bg-base-300'
          : 'bg-error text-white hover:bg-error/90'
      }`}>
        {isUploading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
          </span>
        ) : prescriptionUrl ? (
          'Replace Rx'
        ) : (
          <span className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4" /> Upload Rx
          </span>
        )}
        <input
          type="file"
          className="hidden"
          onChange={onUpload}
          accept="image/*,application/pdf"
          disabled={isUploading}
        />
      </label>
    </div>
  </div>
));
PrescriptionUploader.displayName = 'PrescriptionUploader';

// ─── Sub-Component: QuantitySelector ─────────────────────────────────────────
const QuantitySelector = React.memo(({ quantity, onDecrement, onIncrement, max }) => (
  <div className="flex items-center gap-2">
    <button
      onClick={onDecrement}
      disabled={quantity <= 1}
      aria-label="Decrease quantity"
      className="w-10 h-10 flex items-center justify-center rounded-lg bg-base-200 hover:bg-primary hover:text-primary-content disabled:opacity-30 transition-all border border-base-300"
    >
      <Minus className="w-4 h-4" />
    </button>
    <span className="w-12 text-center text-lg font-black text-base-content">{quantity}</span>
    <button
      onClick={onIncrement}
      disabled={max !== undefined && quantity >= max}
      aria-label="Increase quantity"
      className="w-10 h-10 flex items-center justify-center rounded-lg bg-base-200 hover:bg-primary hover:text-primary-content disabled:opacity-30 transition-all border border-base-300"
    >
      <Plus className="w-4 h-4" />
    </button>
  </div>
));
QuantitySelector.displayName = 'QuantitySelector';

// ─── Sub-Component: FullscreenZoomModal ──────────────────────────────────────
const FullscreenZoomModal = React.memo(({ images, activeIdx, onIdxChange, onClose, brandName }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIdxChange((i) => Math.min(i + 1, images.length - 1));
      if (e.key === 'ArrowLeft')  onIdxChange((i) => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onIdxChange, images.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-white flex flex-col no-print"
      role="dialog"
      aria-modal="true"
      aria-label={`${brandName} image viewer`}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100 shadow-sm">
        <span className="text-base font-black text-base-content">{brandName} — HD View</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setScale((s) => Math.max(s - 0.5, 1))} className="p-2.5 bg-base-200 rounded-lg hover:bg-base-300 transition-colors" aria-label="Zoom out">
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-base-content/50 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(s + 0.5, 5))} className="p-2.5 bg-base-200 rounded-lg hover:bg-base-300 transition-colors" aria-label="Zoom in">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => { onClose(); setScale(1); }} className="p-2.5 bg-neutral text-neutral-content rounded-lg ml-4 hover:opacity-80 transition-opacity" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center bg-white p-6">
        <motion.img
          src={images[activeIdx]?.url}
          animate={{ scale }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="max-w-full max-h-full object-contain cursor-zoom-in"
          onDoubleClick={() => setScale((s) => (s === 1 ? 2.5 : 1))}
          alt={`${brandName} zoom`}
          draggable={false}
        />
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-3 p-4 border-t border-base-200 bg-base-100 overflow-x-auto">
          {images.map((img, i) => (
            <button key={i} onClick={() => { onIdxChange(i); setScale(1); }}
              className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === activeIdx ? 'border-primary shadow-md scale-105' : 'border-transparent opacity-50 hover:opacity-100'}`}
            >
              <img src={img.url} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-[10px] font-bold text-base-content/40 uppercase tracking-widest py-3 bg-base-50">
        Double-click to zoom • Arrow keys to navigate
      </p>
    </motion.div>
  );
});
FullscreenZoomModal.displayName = 'FullscreenZoomModal';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MedicineDetails() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { slug } = useParams();

  // Replace the old boolean state with this:
const [cartState, setCartState] = useState('idle'); // 'idle' | 'adding' | 'success'

  // ── Selectors ──
  const med                     = useSelector(selectCurrentMedicine);
  const medLoading              = useSelector(selectMedicineLoading);
  const medError                = useSelector(selectMedicineError);
  const isActing                = useSelector(selectPharmacyActionLoading);
  const similarMedicines        = useSelector(selectSimilarMedicines);
  const similarMedicinesLoading = useSelector(selectSimilarMedicinesLoading);

  // ── Subscription ──
  const mySub                = useSelector(selectMySubscription);
  const subscriptionDiscount = mySub?.limits?.pharmacyDiscountPercent ?? 0;
  const subscriptionPlanName = useSelector(selectMySubPlanName) ?? '';

  // ── Local state ──
  const [activeTab,         setActiveTab]         = useState('overview');
  const [imgIdx,            setImgIdx]            = useState(0);
  const [quantity,          setQuantity]          = useState(1);
  const [zoomOpen,          setZoomOpen]          = useState(false);
  const [prescriptionUrl,   setPrescriptionUrl]   = useState(null);
  const [isUploading,       setIsUploading]       = useState(false);
  const [rxHighlight,       setRxHighlight]       = useState(false);

  // Animation state for Add to Cart
  const [isCartAnimating, setIsCartAnimating]     = useState(false);

  // ── Fetch medicine & user metrics ──
  useEffect(() => {
    if (slug) {
      dispatch(fetchMedicineBySlug(slug));
      dispatch(fetchWalletDetails()); // Syncs user wallet state on mount
    }
    return () => {
      dispatch(resetCurrentMedicine());
      dispatch(clearCurrentOrder());
      dispatch(clearCoupon()); // Just in case, though coupon logic is moved out
    };
  }, [slug, dispatch]);

  useEffect(() => {
    if (med?._id) dispatch(fetchSimilarMedicines({ id: med._id }));
  }, [med?._id, dispatch]);

  useEffect(() => {
    if (prescriptionUrl) setRxHighlight(false);
  }, [prescriptionUrl]);

  // ── Derived values ──
  const bestInv  = useMemo(() => getBestInventory(med?.inventory), [med?.inventory]);
  const maxStock = useMemo(
    () => (med?.inventory ?? []).reduce((s, i) => s + (i.stockQuantity ?? 0), 0),
    [med?.inventory]
  );

  const bestStoreId = useMemo(
    () => extractStoreId(bestInv?.storeId),
    [bestInv]
  );

  // Price calculations - Aligned with tax-inclusive Cart Page logic
  const mrpTotal = useMemo(() => {
    if (!med) return '0.00';
    const base = bestInv?.pricePerUnit ?? med.mrp;
    return (base * quantity).toFixed(2);
  }, [med, bestInv, quantity]);

  const subDiscountAmt = useMemo(() => {
    if (!med || subscriptionDiscount === 0) return '0.00';
    const total = parseFloat(mrpTotal);
    return (total * (subscriptionDiscount / 100)).toFixed(2);
  }, [med, mrpTotal, subscriptionDiscount]);

  const baseTotal = useMemo(() => {
    const total = parseFloat(mrpTotal);
    const discount = parseFloat(subDiscountAmt);
    return parseFloat((total - discount).toFixed(2));
  }, [mrpTotal, subDiscountAmt]);

  const displayTotal = baseTotal;

  const gstAmount = useMemo(() => {
    if (!med) return 0;
    const payable = parseFloat(displayTotal);
    const gstPct = med.gstPercentage || 5;
    return parseFloat((payable * gstPct / (100 + gstPct)).toFixed(2));
  }, [displayTotal, med]);

  // ── Prescription upload ──
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large. Max 5MB allowed.'); return; }
    setIsUploading(true);
    try {
      const result = await dispatch(uploadSingleFile({ file, folder: 'prescriptions' }));
      if (uploadSingleFile.fulfilled.match(result)) {
        setPrescriptionUrl(result.payload.url);
        toast.success('Prescription uploaded successfully.');
      } else {
        toast.error('Upload failed. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  }, [dispatch]);

  // ── Pre-flight guard for Add to Cart ──
  const guardPreFlight = useCallback(() => {
    if (!med) return false;
    if (maxStock === 0) {
      toast.error('This medicine is currently out of stock.');
      return false;
    }
    if (!bestStoreId) {
      toast.error('No store available for this medicine. Please try again later.');
      return false;
    }
    if (med.isPrescriptionRequired && !prescriptionUrl) {
      setRxHighlight(true);
      toast.error('Please upload a valid prescription before proceeding.');
      document
        .getElementById('rx-uploader')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }, [med, prescriptionUrl, maxStock, bestStoreId]);

  // ── Add to Cart ──
const handleAddToCart = useCallback(async () => {
  if (!guardPreFlight()) return;

  // 1. Enter loading state
  setCartState('adding');

  try {
    // Wait for the actual cart API/Redux to finish
    await dispatch(addToCart({
      medicineId: med._id,
      quantity,
      storeId: bestStoreId,
      ...(prescriptionUrl && { prescription: { imageUrl: prescriptionUrl } }),
    })).unwrap();
    
    // 2. Enter Success state (Triggers the burst)
    setCartState('success');
    
    // 3. Reset back to idle after 2 seconds
    setTimeout(() => {
      setCartState('idle');
    }, 2000);
    
  } catch (err) {
    // Revert on error
    setCartState('idle');
    toast.error(err?.message || 'Failed to add to cart. Please try again.');
  }
}, [dispatch, med, quantity, bestStoreId, prescriptionUrl, guardPreFlight]);

  // ── Quantity ──
  const decrement = useCallback(() => setQuantity((q) => Math.max(1, q - 1)), []);
  const increment = useCallback(() => setQuantity((q) => Math.min(q + 1, maxStock || 999)), [maxStock]);

  // ── Share ──
  const handleShare = useCallback(async () => {
    if (!med) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: med.brandName, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard.');
      }
    } catch { /* share cancelled */ }
  }, [med]);

  const activeTabKey = activeTab.toLowerCase();

  // ─── Loading ──────────────────────────────────────────────────────────────────
  if (medLoading) {
    return (
      <div className="container-custom py-12 space-y-6">
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <div className="skeleton aspect-square w-full rounded-2xl" />
            <div className="flex gap-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton w-20 h-20 rounded-xl" />)}</div>
          </div>
          <div className="lg:col-span-7 space-y-5">
            <div className="skeleton h-10 w-3/4 rounded-xl" />
            <div className="skeleton h-5 w-1/2 rounded-lg" />
            <div className="skeleton h-32 w-full rounded-2xl" />
            <div className="skeleton h-20 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────────
  if (medError || !med) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center bg-base-100">
        <div className="w-24 h-24 rounded-2xl bg-error/10 flex items-center justify-center mb-6 shadow-sm">
          <AlertCircle className="w-12 h-12 text-error" />
        </div>
        <h1 className="text-3xl font-black text-base-content mb-3">Product Unavailable</h1>
        <p className="text-sm text-base-content/60 mb-8 max-w-md font-medium leading-relaxed">
          {medError || 'This medicine could not be found. It may have been removed or the link is invalid.'}
        </p>
        <div className="flex gap-4">
          <button onClick={() => router.back()} className="btn-secondary text-sm px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-sm">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <button onClick={() => dispatch(fetchMedicineBySlug(slug))} className="btn-primary-cta text-sm px-6 py-3 rounded-xl flex items-center gap-2 shadow-sm">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const Sched      = SCHEDULE_META[med.schedule] ?? SCHEDULE_META.None;
  const CatIcon    = CATEGORY_ICONS[med.category] ?? Pill;
  const isOutOfStock = maxStock === 0;

  return (
    <Container className=''>
      <div className="bg-base-100 min-h-screen pb-20">

        {/* Breadcrumb + Header */}
        <div className="bg-base-200/50 border-b border-base-300">
          <div className="container-custom py-3">
            <nav
              aria-label="breadcrumb"
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-5"
            >
              <button onClick={() => router.push('/pharmacy')} className="hover:text-primary transition-colors">Pharmacy</button>
              <ChevronRight className="w-3 h-3" />
              <button onClick={() => router.push(`/pharmacy?category=${med.category}`)} className="hover:text-primary transition-colors">{med.category}</button>
              <ChevronRight className="w-3 h-3" />
              <span className="text-primary truncate max-w-[120px]">{med.brandName}</span>
            </nav>

            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`badge ${Sched.colorClass} text-[10px] font-bold px-2.5 py-1`}>{Sched.label}</span>
                  {med.isPrescriptionRequired && (
                    <span className="badge badge-error text-[10px] font-bold px-2.5 py-1 gap-1">
                      <ShieldCheck className="w-3 h-3" /> Rx Required
                    </span>
                  )}
                  {med.isDiscontinued && <span className="badge badge-warning text-[10px] font-bold px-2.5 py-1">Discontinued</span>}
                  <StockBadge inventory={med.inventory} />
                </div>
                <h1 className="text-3xl lg:text-5xl font-black text-base-content leading-tight tracking-tight">{med.brandName}</h1>
                <p className="text-base text-base-content/60 font-medium italic mt-1.5">{med.genericName} &bull; {med.dosage}</p>
                <p className="text-xs text-base-content/40 font-bold mt-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> by {med.manufacturer}
                </p>
              </div>
              <div className="flex gap-2 no-print shrink-0 mt-2 md:mt-0">
                <button onClick={handleShare} aria-label="Share" className="p-3 rounded-xl border-2 border-base-200 hover:bg-base-200 transition-colors shadow-sm">
                  <Share2 className="w-4 h-4 text-base-content/70" />
                </button>
                <button onClick={() => window.print()} aria-label="Print" className="p-3 rounded-xl border-2 border-base-200 hover:bg-base-200 transition-colors shadow-sm">
                  <Printer className="w-4 h-4 text-base-content/70" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="container-custom py-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

            {/* LEFT: Gallery */}
            <div className="lg:col-span-5 relative z-10">
              <ImageGallery
                images={med.images ?? []}
                activeIdx={imgIdx}
                onIdxChange={setImgIdx}
                onOpenFull={() => setZoomOpen(true)}
              />

              <div className="mt-8 p-5 rounded-xl bg-primary/5 border border-primary/10 shadow-sm">
                <div className="flex gap-4">
                  <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-primary mb-1.5">Quality Assured</p>
                    <p className="text-sm text-base-content/70 leading-relaxed font-medium">
                      Sourced directly from <strong>{med.manufacturer}</strong>. Verified by licensed pharmacists before dispatch. Authentic product guaranteed.
                    </p>
                  </div>
                </div>
              </div>

              {bestInv && (
                <div className="mt-4 p-5 rounded-xl bg-base-200/60 border border-base-300 space-y-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-1">Fulfillment Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    {bestInv.batchNumber && (
                      <div className="flex items-center gap-2 text-xs font-medium text-base-content/70">
                        <Hash className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">Batch: <strong className="text-base-content">{bestInv.batchNumber}</strong></span>
                      </div>
                    )}
                    {bestInv.expiryDate && (
                      <div className="flex items-center gap-2 text-xs font-medium text-base-content/70">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">Expiry: <strong className="text-base-content">{new Date(bestInv.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Purchase + Tabs */}
            <div className="lg:col-span-7 space-y-6 relative z-0">
              <SubscriptionBanner discount={subscriptionDiscount} planName={subscriptionPlanName} />

              {/* Purchase Card */}
              <div className="glass-card p-6 shadow-md border-2 border-base-200/60">
                <div className="flex flex-col sm:flex-row justify-between gap-6 mb-6 border-b border-base-200 pb-6">
                  <div className="flex-1 space-y-4">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 block mb-1">Total Payable</span>
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-5xl font-black text-primary tracking-tight">₹{displayTotal?.toFixed(2)}</span>
                        {(subscriptionDiscount > 0) && (
                          <span className="text-lg font-bold text-base-content/30 line-through">
                            ₹{parseFloat(mrpTotal).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Aligned Cost Breakdown Matrix */}
                    <div className="bg-base-200/50 border border-base-300 rounded-xl p-4 space-y-2 text-xs font-medium max-w-md shadow-sm">
                      <div className="flex justify-between text-base-content/60">
                        <span>Items Subtotal (Base MRP)</span>
                        <span className="font-semibold text-base-content">₹{parseFloat(mrpTotal).toFixed(2)}</span>
                      </div>
                      {subscriptionDiscount > 0 && (
                        <div className="flex justify-between text-success font-semibold">
                          <span>{subscriptionPlanName || 'Plan'} Discount ({subscriptionDiscount}%)</span>
                          <span>- ₹{parseFloat(subDiscountAmt).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-success font-semibold">
                        <span>Delivery Charges</span>
                        <span className="uppercase tracking-wider text-[10px] font-bold">Free</span>
                      </div>
                      <div className="flex justify-between text-base-content/40 border-t border-base-300/80 pt-2 mt-1 text-[11px]">
                        <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Included GST Tax Subset ({med.gstPercentage || 5}%)</span>
                        <span>₹{gstAmount?.toFixed(2)}</span>
                      </div>
                    </div>

                    <p className="text-[11px] font-medium text-base-content/40 mt-1 flex items-center gap-1.5 pl-0.5">
                      <Tag className="w-3 h-3 text-primary/40" /> Unit Price MRP: ₹{med.mrp?.toFixed(2)} / {med.packUnit || 'unit'}
                    </p>
                  </div>

                  <div className="space-y-3 bg-base-200/50 p-4 rounded-xl border border-base-200 min-w-[160px] flex flex-col justify-center self-start sm:self-auto">
                    <p className="text-[10px] text-center font-black text-base-content/40 uppercase tracking-widest">Select Quantity</p>
                    <QuantitySelector quantity={quantity} onDecrement={decrement} onIncrement={increment} max={maxStock || undefined} />
                    <p className="text-[10px] text-center font-bold text-primary uppercase tracking-wider bg-primary/10 py-1 rounded-md">{med.packaging}</p>
                  </div>
                </div>

                {/* ANIMATED CART BUTTON CONTAINER */}
           {/* 10/10 ANIMATED CART BUTTON CONTAINER */}
<div className="w-full relative z-10">
  
  {/* The Confetti / Floating Element on Success */}
  <AnimatePresence>
    {cartState === 'success' && (
      <>
        {/* Floating +1 Pill */}
        <motion.div
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 0], y: -60, scale: [0.5, 1.2, 1] }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-primary text-white px-3 py-1 rounded-full font-black text-sm shadow-xl z-50 pointer-events-none"
        >
          <Package className="w-4 h-4" /> +{quantity}
        </motion.div>

        {/* Expanding Ripple Burst */}
        <motion.div
          initial={{ opacity: 0.6, scale: 0.9 }}
          animate={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0 border-2 border-primary rounded-xl z-0 pointer-events-none"
        />
      </>
    )}
  </AnimatePresence>

  {/* Morphing Button */}
  <motion.button
    whileHover={cartState === 'idle' && !isOutOfStock ? { scale: 1.02 } : {}}
    whileTap={cartState === 'idle' && !isOutOfStock ? { scale: 0.97 } : {}}
    onClick={handleAddToCart}
    disabled={cartState !== 'idle' || isOutOfStock}
    animate={{
      backgroundColor: cartState === 'success' ? '#10b981' : '', // Success Green hex
      color: cartState === 'success' ? '#ffffff' : '',
      borderColor: cartState === 'success' ? '#10b981' : '',
    }}
    transition={{ duration: 0.3 }}
    className={`group w-full relative overflow-hidden flex items-center justify-center py-4 text-sm font-bold shadow-md transition-all rounded-xl z-10 border-none ${
      cartState === 'idle' ? 'btn-primary-cta' : 'bg-base-200 text-base-content/50 cursor-not-allowed'
    } ${isOutOfStock ? 'opacity-40 grayscale' : ''}`}
  >
    {/* Diagonal Shine Effect (Only plays when idle) */}
    {cartState === 'idle' && !isOutOfStock && (
      <span className="absolute inset-0 w-[200%] h-full bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out skew-x-12 z-0" />
    )}
    
    {/* Content cross-fading based on state */}
    <span className="relative z-10 flex items-center justify-center">
      <AnimatePresence mode="wait">
        
        {/* State 1: Idle */}
        {cartState === 'idle' && (
          <motion.div 
            key="idle" 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2"
          >
            <ShoppingCart className="w-5 h-5 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
            Add to Shopping Cart
          </motion.div>
        )}

        {/* State 2: Loading / Action */}
        {cartState === 'adding' && (
          <motion.div 
            key="adding" 
            initial={{ opacity: 0, scale: 0.8 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.8 }} 
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 text-primary"
          >
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </motion.div>
        )}

        {/* State 3: Success */}
        {cartState === 'success' && (
          <motion.div 
            key="success" 
            initial={{ opacity: 0, scale: 0.5, rotate: -45 }} 
            animate={{ opacity: 1, scale: 1, rotate: 0 }} 
            transition={{ type: "spring", stiffness: 300, damping: 20 }} 
            className="flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Added to Cart!
          </motion.div>
        )}

      </AnimatePresence>
    </span>
  </motion.button>
</div>

                {isOutOfStock && (
                  <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-xl flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-error" />
                    <p className="text-xs font-bold text-error uppercase tracking-wider">Currently out of stock across all stores</p>
                  </div>
                )}

                {/* Inline Rx warning below buttons when guard fires */}
                <AnimatePresence>
                  {med.isPrescriptionRequired && rxHighlight && !prescriptionUrl && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-xl flex items-center justify-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-error shrink-0" />
                        <p className="text-xs font-bold text-error">Upload a valid prescription below before adding to cart.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Prescription Uploader — always visible when Rx is required */}
              {med.isPrescriptionRequired && (
                <div id="rx-uploader" className="scroll-mt-32">
                  <PrescriptionUploader
                    prescriptionUrl={prescriptionUrl}
                    isUploading={isUploading}
                    onUpload={handleFileUpload}
                    showRequiredError={rxHighlight && !prescriptionUrl}
                  />
                </div>
              )}

              {med.schedule !== 'None' && (
                <div className="alert alert-warning rounded-xl p-4 shadow-sm border border-warning/20">
                  <Info className="w-5 h-5 shrink-0" />
                  <p className="text-xs font-medium leading-relaxed">
                    <strong className="font-black uppercase tracking-wider">{Sched.label}:</strong> {Sched.desc}
                  </p>
                </div>
              )}

              {/* Tabs */}
              <div className="pt-4">
                <div className="flex gap-2 border-b border-base-300 overflow-x-auto" role="tablist" style={{ scrollbarWidth: 'none' }}>
                  {TABS.map((tab) => {
                    const key = tab.toLowerCase();
                    return (
                      <button
                        key={tab}
                        role="tab"
                        aria-selected={activeTabKey === key}
                        onClick={() => setActiveTab(key)}
                        className={`pb-3 px-5 text-[11px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${
                          activeTabKey === key ? 'text-primary' : 'text-base-content/40 hover:text-base-content/80'
                        }`}
                      >
                        {tab}
                        {activeTabKey === key && (
                          <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-md" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTabKey}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    role="tabpanel"
                    className="pt-6 min-h-[250px]"
                  >
                    {activeTabKey === 'overview' && (
                      <div className="space-y-6">
                        {med.description && (
                          <div className="p-5 rounded-xl bg-base-200/50 border border-base-200 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 flex items-center gap-2 mb-3">
                              <BookOpen className="w-4 h-4 text-primary" /> Description
                            </p>
                            <p className="text-sm text-base-content/80 leading-relaxed font-medium">{med.description}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <InfoBox icon={Building2}   label="Manufacturer" value={med.manufacturer} />
                          <InfoBox icon={CatIcon}     label="Category"     value={med.category} />
                          <InfoBox icon={Package}     label="Packaging"    value={med.packaging} />
                          <InfoBox icon={Thermometer} label="Dosage"       value={med.dosage} />
                        </div>
                        {med.indications?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-3 ml-1">Common Indications</p>
                            <div className="flex flex-wrap gap-2">
                              {med.indications.map((ind, i) => (
                                <span key={i} className="badge badge-primary text-[10px] font-bold px-3 py-1.5 rounded-lg">{ind}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {med.searchKeywords?.length > 0 && (
                          <div className="pt-2 border-t border-base-200">
                            <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-3 ml-1">Also Known As</p>
                            <div className="flex flex-wrap gap-2">
                              {med.searchKeywords.map((kw, i) => (
                                <span key={i} className="px-3 py-1 bg-base-200 text-base-content/60 rounded-lg text-[10px] font-bold border border-base-300">#{kw}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTabKey === 'composition' && (
                      <div>
                        {!med.saltComposition?.length ? (
                          <div className="p-6 text-center border-2 border-dashed border-base-300 rounded-xl">
                            <p className="text-sm text-base-content/40 font-bold uppercase tracking-wider">No composition data available.</p>
                          </div>
                        ) : (
                          <div className="rounded-xl border-2 border-base-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left" aria-label="Salt Composition">
                              <thead className="bg-base-200 border-b-2 border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/50">
                                <tr>
                                  <th className="p-4">Ingredient</th>
                                  <th className="p-4 text-right">Strength</th>
                                </tr>
                              </thead>
                              <tbody>
                                {med.saltComposition.map((salt, i) => (
                                  <tr key={i} className="border-b border-base-200 last:border-0 hover:bg-primary/5 transition-colors">
                                    <td className="p-4 text-sm font-bold text-base-content">{salt.ingredient}</td>
                                    <td className="p-4 text-right text-sm font-black text-primary italic">{salt.strength}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTabKey === 'safety' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <SafetyCard title="Side Effects"      list={med.sideEffects}      icon={AlertTriangle} variant="warning" />
                        <SafetyCard title="Contraindications" list={med.contraindications} icon={Ban}            variant="error" />
                      </div>
                    )}

                    {activeTabKey === 'legal' && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <InfoBox icon={Tag}        label="Schedule"    value={med.schedule === 'None' ? 'OTC (No Schedule)' : med.schedule} />
                          <InfoBox icon={Percent}    label="GST Rate"    value={`${med.gstPercentage}%`} />
                          <InfoBox icon={Hash}       label="HSN Code"    value={med.hsnCode && typeof med.hsnCode === 'object' ? med.hsnCode.hsnCode : (med.hsnCode || '—')} />
                          <InfoBox icon={HeartPulse} label="Rx Required" value={med.isPrescriptionRequired ? 'Yes' : 'No'} />
                        </div>
                        <div className="p-5 rounded-xl bg-base-200/50 border border-base-300 space-y-4 shadow-sm">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-1">Database ID</p>
                            <p className="font-mono text-xs font-bold text-base-content/60 break-all">{med._id}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-1">Last Updated</p>
                            <p className="text-xs font-bold text-base-content/60">
                              {med.updatedAt ? new Date(med.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                            </p>
                          </div>
                          {med.isDiscontinued && (
                            <div className="alert alert-error rounded-lg py-2.5 px-4 text-xs font-bold shadow-sm">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              This product has been marked as discontinued by the manufacturer.
                            </div>
                          )}
                        </div>
                        <div className="p-5 rounded-xl bg-warning/10 border border-warning/30 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-wider text-warning mb-2 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" /> Regulatory Notice
                          </p>
                          <p className="text-xs font-medium text-base-content/70 leading-relaxed">{Sched.desc}</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Similar Medicines */}
        {(similarMedicinesLoading || similarMedicines.length > 0) && (
          <div className="container-custom pb-12 border-t border-base-200 pt-10">
            <h2 className="text-lg font-black text-base-content uppercase tracking-widest mb-2 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" /> Similar Medicines
            </h2>
          
          {!similarMedicinesLoading && similarMedicines.length > 0 && (
            <p className="text-xs text-base-content/50 font-medium mb-6">
              Medicines with similar salt composition or therapeutic class to{' '}
              <span className="font-black text-primary">{med.brandName}</span>
              {med.genericName ? (
                <> — alternatives containing <span className="font-black text-base-content">{med.genericName}</span></>
              ) : null}
            </p>
          )}

            {similarMedicinesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton h-60 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {similarMedicines.map((item) => {
                  const inv      = getBestInventory(item.inventory);
                  const price    = inv?.pricePerUnit ?? item.mrp;
                  const stock    = (item.inventory ?? []).reduce((s, i) => s + (i.stockQuantity ?? 0), 0);
                  const isLow    = inv?.isLowStock || (stock > 0 && stock < 10);
                  const isOut    = stock === 0;
                  const expiry   = inv?.expiryDate
                    ? new Date(inv.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                    : null;

                  return (
                    <motion.button
                      key={item._id}
                      whileHover={{ y: -4 }}
                      onClick={() => router.push(`/pharmacy/buy-medicines/${item?.slug}`)}
                      className="glass-card p-2 text-left flex flex-col gap-3 hover:border-primary/40 transition-all border-2 shadow-sm rounded-2xl group"
                    >
                      {/* Image */}
                      <div className="aspect-square rounded-xl bg-white border border-base-200 overflow-hidden flex items-center justify-center relative">
                        {item.images?.[0]?.url
                          ? <img src={item.images[0].url} alt={item.brandName} className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          : <Pill className="w-10 h-10 text-primary/20" />}
                        {/* Stock badge overlay */}
                        <span className={`absolute top-2 right-2 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md shadow-sm ${
                          isOut  ? 'bg-error text-white' :
                          isLow  ? 'bg-warning text-white' :
                                   'bg-success text-white'
                        }`}>
                          {isOut ? 'Out' : isLow ? 'Low' : 'In Stock'}
                        </span>
                      </div>

                    <div className="px-2 py-1 flex flex-col gap-1">
                        {/* Name + generic */}
                      <div className="min-w-0">
                        <p className="text-sm font-black text-base-content truncate group-hover:text-primary transition-colors">{item.brandName}</p>
                        <p className="text-[10px] text-base-content/50 font-bold uppercase tracking-wider truncate mt-0.5">{item.genericName}</p>
                      </div>

                      {/* Dosage + packaging */}
                      <div className="space-y-1 mt-1">
                        {item.dosage && (
                          <p className="text-[10px] font-medium text-base-content/60 flex items-center gap-1.5">
                            <Pill className="w-3 h-3 text-primary/50 shrink-0" />
                            {item.dosage}
                          </p>
                        )}
                        {item.packaging && (
                          <p className="text-[10px] font-medium text-base-content/60 flex items-center gap-1.5 truncate">
                            <Package className="w-3 h-3 text-primary/50 shrink-0" />
                            {item.packaging}
                          </p>
                        )}
                        {expiry && (
                          <p className="text-[10px] font-medium text-base-content/60 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-primary/50 shrink-0" />
                            Exp: <strong className="text-base-content">{expiry}</strong>
                          </p>
                        )}
                      </div>

                      {/* Price + MRP */}
                      <div className="flex items-end justify-between mt-auto pt-2 border-t border-base-200">
                        <div>
                          <p className="text-sm font-black text-primary tracking-tight">₹{price}</p>
                          {item.mrp && item.mrp !== price && (
                            <p className="text-[9px] font-bold text-base-content/30 line-through">₹{item.mrp}</p>
                          )}
                        </div>
                        <div className="w-6 h-6 rounded-md bg-base-200 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-content transition-colors">
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        <AnimatePresence>
          {zoomOpen && med.images?.length > 0 && (
            <FullscreenZoomModal
              images={med.images}
              activeIdx={imgIdx}
              onIdxChange={setImgIdx}
              onClose={() => setZoomOpen(false)}
              brandName={med.brandName}
            />
          )}
        </AnimatePresence>
      </div>
    </Container>
  );
}