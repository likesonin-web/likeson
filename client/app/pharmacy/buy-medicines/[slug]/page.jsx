'use client';
import Container from '@/components/ui/Container';

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
  CreditCard, UploadCloud, CheckCheck, Building2, BookOpen,
  AlertTriangle, Ban, Minus, Plus,
  MapPin, Clock, Star, Thermometer, Hash, Percent,
  RefreshCw, ArrowLeft, Info, Zap, HeartPulse, Wallet,
  Ticket, BadgePercent, CircleSlash, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { selectMySubscription, selectMySubPlanName } from '@/store/slices/subscriptionSlice';
// ─── Redux Actions ────────────────────────────────────────────────────────────
import {
  fetchMedicineBySlug,
  resetCurrentMedicine,
  selectCurrentMedicine,
  selectMedicineLoading,
  selectMedicineError,
} from '@/store/slices/medicineSlice';
import {
  fetchSimilarMedicines,
  selectSimilarMedicines,
  selectSimilarMedicinesLoading,
  addToCart,
  placeDirectOrder,
  verifyDirectPayment,
  validateCoupon,
  clearCoupon,
  uploadCartItemPrescription,
  selectPharmacyActionLoading,
  selectCurrentOrder,
  clearCurrentOrder,
  selectCoupon,
  selectCouponLoading,
  selectCouponError,
} from '@/store/slices/pharmacyOrderSlice';
import { selectWalletBalance } from '@/store/slices/walletSlice';
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

const PAYMENT_METHODS = [
  { id: 'Razorpay', label: 'Pay Online',       icon: CreditCard, desc: 'UPI, Cards, Net Banking' },
  { id: 'Wallet',   label: 'Wallet',           icon: Wallet,     desc: 'Use Likeson wallet balance' },
  { id: 'COD',      label: 'Cash on Delivery', icon: Package,    desc: 'Pay when delivered' },
];

const RZP_KEY_PUBLIC = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';

// ─── Utility ─────────────────────────────────────────────────────────────────

const getBestInventory = (inventory = []) =>
  inventory.find((inv) => inv.stockQuantity > 0) ?? inventory[0] ?? null;

/**
 * extractStoreId — always returns a plain hex string regardless of input shape.
 * The GET /medicines API populates inventory[].storeId as a full object.
 * Passing the object directly causes "[object Object]" failures in the backend.
 */
const extractStoreId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value._id) return value._id.toString();
  if (typeof value === 'object' && value.$oid) return value.$oid.toString();
  return value.toString();
};

const openRazorpayModal = ({ rzpKey, rzpOrderId, amount, name, description, prefill }) =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.Razorpay) {
      reject(new Error('Razorpay SDK not loaded. Please refresh the page.'));
      return;
    }
    const key = RZP_KEY_PUBLIC || rzpKey;
    if (!key) {
      reject(new Error('Razorpay key is missing. Please contact support.'));
      return;
    }
    const rzp = new window.Razorpay({
      key,
      order_id:    rzpOrderId,
      amount:      Math.round(amount * 100),
      currency:    'INR',
      name:        name        || 'Likeson Healthcare',
      description: description || 'Medicine Purchase',
      prefill:     prefill     ?? {},
      theme:       { color: '#2563eb' },
      handler:     (response) => resolve(response),
      modal:       { ondismiss: () => reject(new Error('Payment cancelled by user.')) },
    });
    rzp.open();
  });

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
      <div className="aspect-square rounded-md bg-base-200 flex items-center justify-center border border-base-300">
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
          className="relative aspect-square rounded-md overflow-hidden bg-white border border-base-300 cursor-crosshair select-none"
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
            className="absolute top-3 right-3 p-2 rounded-md bg-white/80 backdrop-blur border border-base-200 hover:bg-primary hover:text-primary-content transition-all z-30 shadow-sm"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <AnimatePresence>
          {hovering && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-[105%] top-0 w-full h-full z-[100] rounded-md overflow-hidden border border-base-300 bg-white hidden lg:block shadow-xl"
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

      <div ref={thumbsRef} className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => onIdxChange(i)}
            aria-label={`View image ${i + 1}`}
            className={`relative shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${
              i === activeIdx ? 'border-primary scale-105 shadow-sm' : 'border-base-200 opacity-50 hover:opacity-100'
            }`}
          >
            <img src={img.url} className="w-full h-full object-cover" alt={`thumbnail ${i + 1}`} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
});
ImageGallery.displayName = 'ImageGallery';

// ─── Sub-Component: InfoBox ───────────────────────────────────────────────────
const InfoBox = React.memo(({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 rounded-md bg-base-200/60 border border-base-300">
    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">{label}</p>
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
    <div className={`p-4 rounded-md border-2 ${styles}`}>
      <h5 className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest mb-3">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h5>
      {list.length === 0 ? (
        <p className="text-[10px] text-base-content/40 italic">None listed.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {list.map((item, i) => (
            <span key={i} className="px-2 py-0.5 bg-white/60 border border-current/20 rounded-md text-[10px] font-bold">
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
  const isLow      = best?.isLowStock || totalStock < 10;
  const isOut      = totalStock === 0;

  if (isOut) return <span className="badge badge-error text-[9px]">Out of Stock</span>;
  if (isLow) return (
    <span className="badge badge-warning text-[9px]">
      <AlertTriangle className="w-2.5 h-2.5" /> Low Stock ({totalStock} left)
    </span>
  );
  return (
    <span className="badge badge-success text-[9px]">
      <CheckCircle2 className="w-2.5 h-2.5" /> In Stock ({totalStock} units)
    </span>
  );
});
StockBadge.displayName = 'StockBadge';

// ─── Sub-Component: SubscriptionBanner ───────────────────────────────────────
const SubscriptionBanner = React.memo(({ discount, planName }) => {
  if (!discount || discount === 0) return null;
  return (
    <div className="flex items-center gap-3 p-3 rounded-md bg-success/10 border border-success/20">
      <div className="w-8 h-8 rounded-md bg-success/20 flex items-center justify-center shrink-0">
        <Star className="w-4 h-4 text-success" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-success">{planName} Benefit Applied</p>
        <p className="text-xs text-base-content/60">
          You save <strong className="text-success">{discount}%</strong> on this medicine with your active plan.
        </p>
      </div>
    </div>
  );
});
SubscriptionBanner.displayName = 'SubscriptionBanner';

// ─── Sub-Component: PrescriptionUploader ─────────────────────────────────────
/**
 * PrescriptionUploader
 *
 * Props:
 *  - prescriptionUrl   : string | null   — currently uploaded URL
 *  - isUploading       : boolean         — shows spinner while uploading
 *  - onUpload          : (e) => void     — file input onChange handler
 *  - showRequiredError : boolean         — highlights the border red when user
 *                                          tried to proceed without uploading
 */
const PrescriptionUploader = React.memo(({
  prescriptionUrl,
  isUploading,
  onUpload,
  showRequiredError = false,
}) => (
  <div className={`p-4 rounded-md border-2 border-dashed transition-all ${
    prescriptionUrl
      ? 'border-success bg-success/5'
      : showRequiredError
      ? 'border-error bg-error/5 animate-pulse'
      : 'border-error/30 bg-error/5'
  }`}>
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-md flex items-center justify-center shadow-sm ${
          prescriptionUrl ? 'bg-success text-white' : 'bg-error text-white'
        }`}>
          {isUploading
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : prescriptionUrl
            ? <CheckCheck className="w-5 h-5" />
            : <UploadCloud className="w-5 h-5" />}
        </div>
        <div>
          <h4 className="text-xs font-black text-base-content flex items-center gap-1.5">
            Prescription Required
            {!prescriptionUrl && (
              <span className="text-[9px] font-black text-error bg-error/10 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                Required
              </span>
            )}
          </h4>
          <p className="text-[10px] text-base-content/50">
            {prescriptionUrl
              ? 'Prescription uploaded successfully. You can replace it if needed.'
              : showRequiredError
              ? 'Upload a valid Rx before you can add to cart or place an order.'
              : 'Upload a valid Rx from a licensed doctor to proceed.'}
          </p>
          {prescriptionUrl && (
            <a
              href={prescriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary underline mt-0.5 inline-block hover:text-primary/80 transition-colors"
            >
              View uploaded prescription ↗
            </a>
          )}
        </div>
      </div>

      <label className={`cursor-pointer text-[10px] py-2 px-4 rounded-md shrink-0 font-black uppercase tracking-wider transition-all ${
        isUploading
          ? 'bg-base-200 text-base-content/40 cursor-not-allowed'
          : prescriptionUrl
          ? 'bg-base-200 text-base-content hover:bg-base-300'
          : 'bg-error text-white hover:bg-error/90'
      }`}>
        {isUploading ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
          </span>
        ) : prescriptionUrl ? (
          'Replace Rx'
        ) : (
          <span className="flex items-center gap-1.5">
            <UploadCloud className="w-3 h-3" /> Upload Rx
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
      className="w-9 h-9 flex items-center justify-center rounded-md bg-base-200 hover:bg-primary hover:text-primary-content disabled:opacity-30 transition-all border border-base-300"
    >
      <Minus className="w-3.5 h-3.5" />
    </button>
    <span className="w-10 text-center text-base font-black text-base-content">{quantity}</span>
    <button
      onClick={onIncrement}
      disabled={max !== undefined && quantity >= max}
      aria-label="Increase quantity"
      className="w-9 h-9 flex items-center justify-center rounded-md bg-base-200 hover:bg-primary hover:text-primary-content disabled:opacity-30 transition-all border border-base-300"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  </div>
));
QuantitySelector.displayName = 'QuantitySelector';

// ─── Sub-Component: FullscreenZoomModal ──────────────────────────────────────
const FullscreenZoomModal = React.memo(({ images, activeIdx, onIdxChange, onClose, brandName }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')     onClose();
      i// in useEffect inside FullscreenZoomModal:
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-200 bg-base-100">
        <span className="text-sm font-black text-base-content">{brandName} — HD View</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setScale((s) => Math.max(s - 0.5, 1))} className="p-2 bg-base-200 rounded-md hover:bg-base-300 transition-colors" aria-label="Zoom out">
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-base-content/50 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(s + 0.5, 5))} className="p-2 bg-base-200 rounded-md hover:bg-base-300 transition-colors" aria-label="Zoom in">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => { onClose(); setScale(1); }} className="p-2 bg-neutral text-neutral-content rounded-md ml-2 hover:opacity-80 transition-opacity" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center bg-white p-4">
        <motion.img
          src={images[activeIdx]?.url}
          animate={{ scale }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="max-w-full max-h-full object-contain"
          onDoubleClick={() => setScale((s) => (s === 1 ? 2.5 : 1))}
          alt={`${brandName} zoom`}
          draggable={false}
        />
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-2 p-3 border-t border-base-200 bg-base-100 overflow-x-auto">
          {images.map((img, i) => (
            <button key={i} onClick={() => { onIdxChange(i); setScale(1); }}
              className={`shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${i === activeIdx ? 'border-primary' : 'border-transparent opacity-50'}`}
            >
              <img src={img.url} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-[9px] font-bold text-base-content/30 uppercase tracking-widest py-2 bg-base-50">
        Double-click to zoom • Arrow keys to navigate
      </p>
    </motion.div>
  );
});
FullscreenZoomModal.displayName = 'FullscreenZoomModal';

// ─── Sub-Component: CouponInput ───────────────────────────────────────────────
const CouponInput = React.memo(({
  orderTotal,
  coupon,
  couponLoading,
  couponError,
  onApply,
  onRemove,
}) => {
  const [inputCode, setInputCode] = useState('');
  const isApplied = Boolean(coupon?.code);

  const handleApply = useCallback(() => {
    const trimmed = inputCode.trim();
    if (!trimmed) { toast.error('Enter a coupon code first.'); return; }
    onApply(trimmed, orderTotal);
  }, [inputCode, orderTotal, onApply]);

  const handleRemove = useCallback(() => {
    setInputCode('');
    onRemove();
  }, [onRemove]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleApply();
  }, [handleApply]);

  return (
    <div className="space-y-2">
      <label className="block text-[9px] font-black uppercase tracking-widest text-base-content/40">
        Promo Code
      </label>

      {isApplied ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-2.5 rounded-md bg-success/10 border border-success/30"
        >
          <div className="w-7 h-7 rounded-md bg-success/20 flex items-center justify-center shrink-0">
            <BadgePercent className="w-3.5 h-3.5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-success uppercase tracking-wider truncate">
              {coupon.code} applied
            </p>
            <p className="text-[10px] text-base-content/50">
              You save <strong className="text-success">₹{coupon.discountAmount?.toFixed(2)}</strong>
              {coupon.benefitType === 'Percentage'
                ? ` (${coupon.benefitValue}%${coupon.maxCap ? `, max ₹${coupon.maxCap}` : ''})`
                : ''}
            </p>
          </div>
          <button
            onClick={handleRemove}
            aria-label="Remove coupon"
            className="p-1.5 rounded-md hover:bg-error/10 text-base-content/40 hover:text-error transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      ) : (
        <div className="flex gap-2">
          <input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Enter coupon code"
            maxLength={20}
            disabled={couponLoading}
            className="input-field flex-1 text-xs uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal"
          />
          <button
            onClick={handleApply}
            disabled={couponLoading || !inputCode.trim()}
            className="shrink-0 px-3.5 py-2 rounded-md bg-primary text-primary-content text-[10px] font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1.5"
          >
            {couponLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Ticket className="w-3.5 h-3.5" />}
            {couponLoading ? '' : 'Apply'}
          </button>
        </div>
      )}

      <AnimatePresence>
        {couponError && !isApplied && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-[10px] text-error font-bold"
          >
            <CircleSlash className="w-3 h-3 shrink-0" />
            {couponError}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});
CouponInput.displayName = 'CouponInput';

// ─── Sub-Component: BuyNowModal ───────────────────────────────────────────────
/**
 * BuyNowModal
 *
 * NEW: now also accepts prescriptionRequired + prescriptionUrl so it can
 * gate the Confirm button and surface an inline prescription upload widget
 * inside the payment step when Rx is missing.
 *
 * Props additions vs original:
 *  - isPrescriptionRequired : boolean
 *  - prescriptionUrl        : string | null
 *  - isUploadingRx          : boolean
 *  - onUploadRx             : (e) => void  — same handler as page-level
 */
const BuyNowModal = React.memo(({
  med,
  quantity,
  baseTotal,
  storeId,
  isPrescriptionRequired,
  prescriptionUrl,
  isUploadingRx,
  onUploadRx,
  walletBalance,
  coupon,
  couponLoading,
  couponError,
  onApplyCoupon,
  onRemoveCoupon,
  onClose,
  onSuccess,
}) => {
  const dispatch = useDispatch();
  const isActing = useSelector(selectPharmacyActionLoading);

  const [paymentMethod, setPaymentMethod] = useState('Razorpay');
  const [address, setAddress] = useState({
    fullName: '',
    line1:    '',
    landmark: '',
    city:     'Vijayawada',
    pincode:  '',
    phone:    '',
  });
  const [step, setStep] = useState('address');
  // Highlight prescription area inside modal when user tries to confirm without Rx
  const [rxError, setRxError] = useState(false);

  const finalTotal = coupon?.code ? (coupon.finalTotal ?? baseTotal) : baseTotal;
  const isWalletInsufficient = paymentMethod === 'Wallet' && walletBalance < finalTotal;

  const handleAddressChange = useCallback((e) => {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
  }, []);

  const isAddressValid = address.line1.trim() && address.pincode.trim() && address.fullName.trim();

  // Reset rx error once user uploads
  useEffect(() => {
    if (prescriptionUrl) setRxError(false);
  }, [prescriptionUrl]);

  const handleConfirm = useCallback(async () => {
    // ── Guard: prescription required but not uploaded ──
    if (isPrescriptionRequired && !prescriptionUrl) {
      setRxError(true);
      toast.error('Please upload a valid prescription before placing the order.');
      return;
    }

    if (!isAddressValid) {
      toast.error('Please fill in name, address line, and pincode.');
      return;
    }
    if (isWalletInsufficient) {
      toast.error(`Insufficient wallet balance. Available: ₹${walletBalance?.toFixed(2)}`);
      return;
    }

    const orderPayload = {
      medicineId:    med._id,
      quantity,
      storeId,
      address,
      paymentMethod,
      ...(prescriptionUrl && { prescription: { imageUrl: prescriptionUrl } }),
      ...(coupon?.code     && { couponCode: coupon.code }),
    };

    try {
      if (paymentMethod === 'COD' || paymentMethod === 'Wallet') {
        const result = await dispatch(placeDirectOrder(orderPayload)).unwrap();
        onSuccess(result.order ?? result);
        return;
      }

      if (paymentMethod === 'Razorpay') {
        const result = await dispatch(placeDirectOrder(orderPayload)).unwrap();
        const { order, razorpayKey } = result;

        let paymentResponse;
        try {
          paymentResponse = await openRazorpayModal({
            rzpKey:      razorpayKey,
            rzpOrderId:  order.payment.razorpayOrderId,
            amount:      order.billing.totalPayable,
            name:        'Likeson Healthcare',
            description: `${med.brandName} × ${quantity}`,
          });
        } catch (err) {
          toast.error(err.message || 'Payment was not completed.');
          onClose();
          return;
        }

        const verified = await dispatch(
          verifyDirectPayment({
            razorpay_order_id:   paymentResponse.razorpay_order_id,
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_signature:  paymentResponse.razorpay_signature,
          })
        ).unwrap();

        onSuccess(verified.order ?? verified);
      }
    } catch (err) {
      console.error('[BuyNowModal] order error:', err);
    }
  }, [
    dispatch, med, quantity, storeId, address, paymentMethod,
    prescriptionUrl, isPrescriptionRequired, coupon,
    isAddressValid, isWalletInsufficient, walletBalance, onSuccess, onClose,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9000] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="w-full max-w-lg bg-base-100 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200">
          <div>
            <h3 className="font-black text-base text-base-content">Buy Now</h3>
            <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-0.5">
              {med.brandName} × {quantity} —{' '}
              {coupon?.code ? (
                <>
                  <span className="line-through text-base-content/30">₹{baseTotal}</span>{' '}
                  <span className="text-success">₹{finalTotal?.toFixed(2)}</span>
                </>
              ) : (
                <span className="text-primary">₹{baseTotal}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-base-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-base-200">
          {['address', 'payment'].map((s, i) => (
            <button
              key={s}
              onClick={() => step === 'payment' && s === 'address' && setStep('address')}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors relative ${
                step === s ? 'text-primary' : 'text-base-content/30'
              }`}
            >
              {i + 1}. {s}
              {step === s && (
                <motion.div layoutId="modalTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* ── STEP 1: Address ── */}
          {step === 'address' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">Full Name *</label>
                  <input name="fullName" value={address.fullName} onChange={handleAddressChange}
                    placeholder="Patient's full name" className="input-field w-full text-xs" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">Address Line 1 *</label>
                  <input name="line1" value={address.line1} onChange={handleAddressChange}
                    placeholder="Flat / Building / Street" className="input-field w-full text-xs" />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">Landmark</label>
                  <input name="landmark" value={address.landmark} onChange={handleAddressChange}
                    placeholder="Near..." className="input-field w-full text-xs" />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">City</label>
                  <input name="city" value={address.city} onChange={handleAddressChange}
                    className="input-field w-full text-xs" />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">Pincode *</label>
                  <input name="pincode" value={address.pincode} onChange={handleAddressChange}
                    placeholder="500001" maxLength={6} className="input-field w-full text-xs" />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">Phone</label>
                  <input name="phone" value={address.phone} onChange={handleAddressChange}
                    placeholder="10-digit mobile" maxLength={10} className="input-field w-full text-xs" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Payment ── */}
          {step === 'payment' && (
            <div className="space-y-4">

              {/* ── Inline Prescription Upload (inside modal, payment step) ── */}
              {isPrescriptionRequired && (
                <div className={`p-3.5 rounded-md border-2 border-dashed transition-all ${
                  prescriptionUrl
                    ? 'border-success bg-success/5'
                    : rxError
                    ? 'border-error bg-error/5'
                    : 'border-error/40 bg-error/5'
                }`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-error" />
                    Prescription Required
                    {!prescriptionUrl && (
                      <span className="text-error font-black">— Must upload to proceed</span>
                    )}
                  </p>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                        prescriptionUrl ? 'bg-success text-white' : 'bg-error/20 text-error'
                      }`}>
                        {isUploadingRx
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : prescriptionUrl
                          ? <CheckCheck className="w-4 h-4" />
                          : <UploadCloud className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-base-content">
                          {prescriptionUrl ? 'Prescription uploaded ✓' : 'No prescription uploaded'}
                        </p>
                        {prescriptionUrl && (
                          <a
                            href={prescriptionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary underline hover:text-primary/80"
                          >
                            View file ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <label className={`cursor-pointer text-[9px] font-black uppercase tracking-wider py-2 px-3 rounded-md shrink-0 transition-all ${
                      isUploadingRx
                        ? 'bg-base-200 text-base-content/40 cursor-not-allowed'
                        : prescriptionUrl
                        ? 'bg-base-200 text-base-content hover:bg-base-300'
                        : 'bg-error text-white hover:bg-error/90'
                    }`}>
                      {isUploadingRx ? 'Uploading…' : prescriptionUrl ? 'Replace' : 'Upload Rx'}
                      <input
                        type="file"
                        className="hidden"
                        onChange={onUploadRx}
                        accept="image/*,application/pdf"
                        disabled={isUploadingRx}
                      />
                    </label>
                  </div>
                  <AnimatePresence>
                    {rxError && !prescriptionUrl && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[10px] text-error font-bold mt-2 flex items-center gap-1"
                      >
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Upload a valid prescription to place this order.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <CouponInput
                orderTotal={baseTotal}
                coupon={coupon}
                couponLoading={couponLoading}
                couponError={couponError}
                onApply={onApplyCoupon}
                onRemove={onRemoveCoupon}
              />

              <div className="border-t border-base-200" />

              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40">Payment Method</p>
                {PAYMENT_METHODS.map(({ id, label, icon: Icon, desc }) => {
                  const isInsufficient = id === 'Wallet' && walletBalance < finalTotal;
                  return (
                    <button
                      key={id}
                      onClick={() => !isInsufficient && setPaymentMethod(id)}
                      disabled={isInsufficient}
                      className={`w-full flex items-center gap-4 p-3.5 rounded-md border-2 transition-all ${
                        paymentMethod === id
                          ? 'border-primary bg-primary/5'
                          : isInsufficient
                          ? 'border-base-200 opacity-40 cursor-not-allowed'
                          : 'border-base-200 hover:border-primary/40'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                        paymentMethod === id ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/60'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-xs font-black text-base-content">{label}</p>
                        <p className="text-[10px] text-base-content/40">
                          {id === 'Wallet'
                            ? `Balance: ₹${walletBalance?.toFixed(2) ?? '0.00'}${isInsufficient ? ' — Insufficient' : ''}`
                            : desc}
                        </p>
                      </div>
                      {paymentMethod === id && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Order Summary */}
              <div className="p-3.5 rounded-md bg-base-200/60 border border-base-300 space-y-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-2">Order Summary</p>
                <div className="flex justify-between text-xs text-base-content/60">
                  <span>{med.brandName} × {quantity}</span>
                  <span>₹{baseTotal}</span>
                </div>
                <AnimatePresence>
                  {coupon?.code && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex justify-between text-xs text-success font-bold">
                        <span className="flex items-center gap-1">
                          <BadgePercent className="w-3 h-3" /> Coupon ({coupon.code})
                        </span>
                        <span>- ₹{coupon.discountAmount?.toFixed(2)}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {isPrescriptionRequired && (
                  <div className="flex justify-between text-xs text-base-content/60">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-error" /> Prescription
                    </span>
                    <span className={prescriptionUrl ? 'text-success font-bold' : 'text-error font-bold'}>
                      {prescriptionUrl ? 'Uploaded ✓' : 'Not uploaded ✗'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-base-content/60">
                  <span>Payment Method</span>
                  <span className="font-bold text-base-content">{paymentMethod}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-base-content border-t border-base-300 pt-1.5 mt-1.5">
                  <span>Total Payable</span>
                  <span className="text-primary">₹{finalTotal?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-base-200 flex gap-3">
          {step === 'address' ? (
            <>
              <button onClick={onClose} className="flex-1 btn-secondary py-2.5 text-xs rounded-md">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!isAddressValid) { toast.error('Please fill required fields.'); return; }
                  setStep('payment');
                }}
                className="flex-1 btn-primary-cta py-2.5 text-xs rounded-md flex items-center justify-center gap-2"
              >
                Continue <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep('address')} className="flex-1 btn-secondary py-2.5 text-xs rounded-md flex items-center justify-center gap-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={isActing || isWalletInsufficient || (isPrescriptionRequired && !prescriptionUrl)}
                className="flex-1 btn-primary-cta py-2.5 text-xs rounded-md flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {isActing ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                ) : isPrescriptionRequired && !prescriptionUrl ? (
                  <><ShieldCheck className="w-4 h-4" /> Upload Rx First</>
                ) : paymentMethod === 'COD' ? (
                  <><Package className="w-4 h-4" /> Place Order</>
                ) : paymentMethod === 'Wallet' ? (
                  <><Wallet className="w-4 h-4" /> Pay ₹{finalTotal?.toFixed(2)}</>
                ) : (
                  <><CreditCard className="w-4 h-4" /> Pay ₹{finalTotal?.toFixed(2)}</>
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});
BuyNowModal.displayName = 'BuyNowModal';

// ─── Sub-Component: OrderSuccessModal ────────────────────────────────────────
const OrderSuccessModal = React.memo(({ order, onClose, onViewOrders }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[9100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
  >
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.85, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="w-full max-w-sm bg-base-100 rounded-xl shadow-2xl p-6 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-9 h-9 text-success" />
      </div>
      <h3 className="text-lg font-black text-base-content mb-1">Order Placed!</h3>
      <p className="text-xs text-base-content/50 mb-1">
        Order ID: <span className="font-bold text-base-content">{order?.orderId}</span>
      </p>
      <p className="text-xs text-base-content/50 mb-1">
        Payment: <span className="font-bold text-success capitalize">{order?.payment?.status}</span>
        {' · '} Method: <span className="font-bold">{order?.payment?.method}</span>
      </p>
      {order?.billing?.promoCode && (
        <p className="text-xs text-success font-bold mb-1 flex items-center justify-center gap-1">
          <BadgePercent className="w-3.5 h-3.5" />
          Coupon <span className="uppercase">{order.billing.promoCode}</span> saved you ₹{order.billing.discountAmount?.toFixed(2)}
        </p>
      )}
      {order?.prescription?.isRequired && (
        <p className="text-xs text-base-content/50 mb-1 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-warning" />
          Prescription pending pharmacist verification
        </p>
      )}
      <p className="text-xs text-base-content/50 mb-5">
        Total Paid: <span className="font-black text-primary">₹{order?.billing?.totalPayable?.toFixed(2)}</span>
      </p>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 btn-secondary py-2.5 text-xs rounded-md">
          Continue Shopping
        </button>
        <button onClick={onViewOrders} className="flex-1 btn-primary-cta py-2.5 text-xs rounded-md">
          View Orders
        </button>
      </div>
    </motion.div>
  </motion.div>
));
OrderSuccessModal.displayName = 'OrderSuccessModal';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MedicineDetails() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { slug } = useParams();

  // ── Selectors ──
  const med             = useSelector(selectCurrentMedicine);
  const medLoading      = useSelector(selectMedicineLoading);
  const medError        = useSelector(selectMedicineError);
  const isActing        = useSelector(selectPharmacyActionLoading);
  const walletBalance   = useSelector(selectWalletBalance);
  const coupon          = useSelector(selectCoupon);
  const couponLoading   = useSelector(selectCouponLoading);
  const couponError     = useSelector(selectCouponError);
  const similarMedicines        = useSelector(selectSimilarMedicines);
  const similarMedicinesLoading = useSelector(selectSimilarMedicinesLoading);
  // ── Auth / subscription ──
  const user                 = useSelector((state) => state.user?.user) ?? null;
const mySub              = useSelector(selectMySubscription);
const subscriptionDiscount = mySub?.limits?.pharmacyDiscountPercent ?? 0;
const subscriptionPlanName = useSelector(selectMySubPlanName) ?? '';

  // ── Local state ──
  const [activeTab,        setActiveTab]        = useState('overview');
  const [imgIdx,           setImgIdx]           = useState(0);
  const [quantity,         setQuantity]         = useState(1);
  const [zoomOpen,         setZoomOpen]         = useState(false);
  const [prescriptionUrl,  setPrescriptionUrl]  = useState(null);
  const [isUploading,      setIsUploading]      = useState(false);
  const [showBuyNowModal,  setShowBuyNowModal]  = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedOrder,   setCompletedOrder]   = useState(null);
  // Whether to show the "rx required" highlight on the page-level uploader
  const [rxHighlight,      setRxHighlight]      = useState(false);

  // ── Fetch medicine ──
  useEffect(() => {
    if (slug) dispatch(fetchMedicineBySlug(slug));
    return () => {
      dispatch(resetCurrentMedicine());
      dispatch(clearCurrentOrder());
      dispatch(clearCoupon());
    };
  }, [slug, dispatch]);
useEffect(() => {
  if (med?._id) dispatch(fetchSimilarMedicines({ id: med._id }));
}, [med?._id, dispatch]);
  // Clear rx highlight once user uploads
  useEffect(() => {
    if (prescriptionUrl) setRxHighlight(false);
  }, [prescriptionUrl]);

  // ── Derived values ──
  const bestInv  = useMemo(() => getBestInventory(med?.inventory), [med?.inventory]);
  const maxStock = useMemo(
    () => (med?.inventory ?? []).reduce((s, i) => s + (i.stockQuantity ?? 0), 0),
    [med?.inventory]
  );

  /**
   * bestStoreId — ALWAYS a plain string, never a populated object.
   * extractStoreId() unwraps the populated inventory[].storeId object to a hex string.
   */
  const bestStoreId = useMemo(
    () => extractStoreId(bestInv?.storeId),
    [bestInv]
  );

  const effectiveMrp = useMemo(() => {
    if (!med) return 0;
    const base = bestInv?.pricePerUnit ?? med.mrp;
    return parseFloat((base * (1 - subscriptionDiscount / 100)).toFixed(2));
  }, [med, bestInv, subscriptionDiscount]);

  const baseTotal = useMemo(
    () => parseFloat((effectiveMrp * quantity).toFixed(2)),
    [effectiveMrp, quantity]
  );

  const gstAmount = useMemo(
    () => parseFloat(((baseTotal * (med?.gstPercentage ?? 12)) / (100 + (med?.gstPercentage ?? 12))).toFixed(2)),
    [baseTotal, med?.gstPercentage]
  );

  const displayTotal = coupon?.code ? (coupon.finalTotal ?? baseTotal) : baseTotal;

  // ── Prescription upload (shared between page-level uploader and BuyNowModal) ──
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so the same file can be re-selected after a replace
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

  // ── Pre-flight guard for Add to Cart & Buy Now ──
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
    // Prescription check: highlight uploader and block action
    if (med.isPrescriptionRequired && !prescriptionUrl) {
      setRxHighlight(true);
      toast.error('Please upload a valid prescription before proceeding.');
      // Scroll prescription uploader into view
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
  try {
    const result = await dispatch(addToCart({
      medicineId: med._id,
      quantity,
      storeId: bestStoreId,
      ...(prescriptionUrl && { prescription: { imageUrl: prescriptionUrl } }),
    })).unwrap();
    toast.success('Added to cart successfully.');
  } catch (err) {
    toast.error(err?.message || 'Failed to add to cart. Please try again.');
  }
}, [dispatch, med, quantity, bestStoreId, prescriptionUrl, guardPreFlight]);

  // ── Buy Now ──
  const handleBuyNow = useCallback(() => {
    if (!guardPreFlight()) return;
    setShowBuyNowModal(true);
  }, [guardPreFlight]);

  // ── Coupon ──
  const handleApplyCoupon = useCallback((code, orderTotal) => {
    dispatch(validateCoupon({ couponCode: code, orderTotal }));
  }, [dispatch]);

  const handleRemoveCoupon = useCallback(() => {
    dispatch(clearCoupon());
  }, [dispatch]);

  // ── Order success ──
  const handleOrderSuccess = useCallback((order) => {
    setCompletedOrder(order);
    setShowBuyNowModal(false);
    setShowSuccessModal(true);
    dispatch(clearCurrentOrder());
    dispatch(clearCoupon());
  }, [dispatch]);

  // ── Quantity ──
  const decrement = useCallback(() => setQuantity((q) => Math.max(1, q - 1)), []);
  const increment = useCallback(() => setQuantity((q) => Math.min(q + 1, maxStock || 999)), [maxStock]);

  // Clear coupon when quantity changes (it was validated against the old total)
 useEffect(() => {
  dispatch(clearCoupon());
}, [quantity, dispatch]);

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
        <div className="skeleton h-8 w-48 rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-3">
            <div className="skeleton aspect-square w-full rounded-md" />
            <div className="flex gap-2">{[...Array(4)].map((_, i) => <div key={i} className="skeleton w-16 h-16 rounded-md" />)}</div>
          </div>
          <div className="lg:col-span-7 space-y-4">
            <div className="skeleton h-8 w-3/4 rounded-md" />
            <div className="skeleton h-4 w-1/2 rounded-md" />
            <div className="skeleton h-28 w-full rounded-md" />
            <div className="skeleton h-16 w-full rounded-md" />
            <div className="grid grid-cols-2 gap-3">
              <div className="skeleton h-12 rounded-md" />
              <div className="skeleton h-12 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────────
  if (medError || !med) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-base-100">
        <div className="w-20 h-20 rounded-md bg-error/10 flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-error" />
        </div>
        <h1 className="text-2xl font-black text-base-content mb-2">Product Unavailable</h1>
        <p className="text-sm text-base-content/50 mb-8 max-w-xs">
          {medError || 'This medicine could not be found. It may have been removed or the link is invalid.'}
        </p>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="btn-secondary text-xs px-4 py-2 rounded-md flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <button onClick={() => dispatch(fetchMedicineBySlug(slug))} className="btn-primary-cta text-xs px-4 py-2 rounded-md flex items-center gap-2">
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
<Container className='' >
    <div className="bg-base-100 min-h-screen pb-20">

      {/* Breadcrumb + Header */}
      <div className="bg-base-200/50 border-b border-base-300">
        <div className="container-custom py-6">
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
                <span className={`badge ${Sched.colorClass} text-[9px]`}>{Sched.label}</span>
                {med.isPrescriptionRequired && (
                  <span className="badge badge-error text-[9px] gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" /> Rx Required
                  </span>
                )}
                {med.isDiscontinued && <span className="badge badge-warning text-[9px]">Discontinued</span>}
                <StockBadge inventory={med.inventory} />
              </div>
              <h1 className="text-3xl lg:text-5xl font-black text-base-content leading-tight">{med.brandName}</h1>
              <p className="text-base text-base-content/60 font-medium italic mt-1">{med.genericName} &bull; {med.dosage}</p>
              <p className="text-xs text-base-content/40 font-bold mt-1 uppercase tracking-wider">by {med.manufacturer}</p>
            </div>
            <div className="flex gap-2 no-print shrink-0">
              <button onClick={handleShare} aria-label="Share" className="p-2.5 rounded-md border border-base-300 hover:bg-base-200 transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
              <button onClick={() => window.print()} aria-label="Print" className="p-2.5 rounded-md border border-base-300 hover:bg-base-200 transition-colors">
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="container-custom py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* LEFT: Gallery */}
          <div className="lg:col-span-5 relative z-10">
            <ImageGallery
              images={med.images ?? []}
              activeIdx={imgIdx}
              onIdxChange={setImgIdx}
              onOpenFull={() => setZoomOpen(true)}
            />

            <div className="mt-6 p-4 rounded-md bg-primary/5 border border-primary/10">
              <div className="flex gap-3">
                <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-1">Quality Assured</p>
                  <p className="text-xs text-base-content/60 leading-relaxed">
                    Sourced directly from <strong>{med.manufacturer}</strong>. Verified by licensed pharmacists before dispatch. Authentic product guaranteed.
                  </p>
                </div>
              </div>
            </div>

            {bestInv && (
              <div className="mt-3 p-4 rounded-md bg-base-200/60 border border-base-300 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-base-content/40">Fulfillment Info</p>
                <div className="grid grid-cols-2 gap-2">
                  {bestInv.batchNumber && (
                    <div className="flex items-center gap-2 text-[10px] text-base-content/60">
                      <Hash className="w-3 h-3 text-primary" />
                      <span>Batch: <strong>{bestInv.batchNumber}</strong></span>
                    </div>
                  )}
                  {bestInv.expiryDate && (
                    <div className="flex items-center gap-2 text-[10px] text-base-content/60">
                      <Clock className="w-3 h-3 text-primary" />
                      <span>Expiry: <strong>{new Date(bestInv.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Purchase + Tabs */}
          <div className="lg:col-span-7 space-y-5 relative z-0">
            <SubscriptionBanner discount={subscriptionDiscount} planName={subscriptionPlanName} />

            {/* Purchase Card */}
            <div className="glass-card p-5">
              <div className="flex flex-col sm:flex-row justify-between gap-5 mb-5">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 block mb-1">Total Amount</span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-4xl font-black text-primary">₹{displayTotal?.toFixed(2)}</span>
                    {(subscriptionDiscount > 0 || coupon?.code) && (
                      <span className="text-sm font-bold text-base-content/30 line-through">
                        ₹{(med.mrp * quantity).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    <p className="text-[10px] font-bold text-success flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> GST incl. (₹{gstAmount})
                    </p>
                    {subscriptionDiscount > 0 && (
                      <p className="text-[10px] font-bold text-success flex items-center gap-1">
                        <Zap className="w-3 h-3" /> {subscriptionDiscount}% plan discount
                      </p>
                    )}
                    {coupon?.code && (
                      <p className="text-[10px] font-bold text-success flex items-center gap-1">
                        <BadgePercent className="w-3 h-3" /> Coupon saves ₹{coupon.discountAmount?.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] text-base-content/40 mt-0.5">MRP ₹{med.mrp} / unit</p>
                </div>

                <div className="space-y-2">
                  <QuantitySelector quantity={quantity} onDecrement={decrement} onIncrement={increment} max={maxStock || undefined} />
                  <p className="text-[10px] text-center font-bold text-base-content/40 uppercase tracking-wider">{med.packaging}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={isActing || isOutOfStock}
                  className="btn-secondary flex items-center justify-center gap-2 py-3 text-xs rounded-md disabled:opacity-40"
                >
                  {isActing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                  Add to Cart
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={isActing || isOutOfStock}
                  className="btn-primary-cta flex items-center justify-center gap-2 py-3 text-xs rounded-md disabled:opacity-40"
                >
                  {isActing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Buy Now
                </button>
              </div>

              {isOutOfStock && (
                <p className="text-center text-xs font-bold text-error mt-3 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Currently out of stock across all stores.
                </p>
              )}

              {/* Inline Rx warning below buttons when guard fires */}
              <AnimatePresence>
                {med.isPrescriptionRequired && rxHighlight && !prescriptionUrl && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-center text-xs font-bold text-error mt-3 flex items-center justify-center gap-1 overflow-hidden"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    Upload a valid prescription below before adding to cart or buying.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Prescription Uploader — always visible when Rx is required */}
            {med.isPrescriptionRequired && (
              <div id="rx-uploader">
                <PrescriptionUploader
                  prescriptionUrl={prescriptionUrl}
                  isUploading={isUploading}
                  onUpload={handleFileUpload}
                  showRequiredError={rxHighlight && !prescriptionUrl}
                />
              </div>
            )}

            {med.schedule !== 'None' && (
              <div className="alert alert-warning rounded-md py-2 px-3">
                <Info className="w-4 h-4 shrink-0" />
                <p className="text-[10px] font-medium leading-relaxed">
                  <strong>{Sched.label}:</strong> {Sched.desc}
                </p>
              </div>
            )}

            {/* Tabs */}
            <div>
              <div className="flex gap-0 border-b border-base-300 overflow-x-auto" role="tablist" style={{ scrollbarWidth: 'none' }}>
                {TABS.map((tab) => {
                  const key = tab.toLowerCase();
                  return (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={activeTabKey === key}
                      onClick={() => setActiveTab(key)}
                      className={`pb-3 px-4 text-[10px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${
                        activeTabKey === key ? 'text-primary' : 'text-base-content/40 hover:text-base-content'
                      }`}
                    >
                      {tab}
                      {activeTabKey === key && (
                        <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
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
                  className="pt-5 min-h-[220px]"
                >
                  {activeTabKey === 'overview' && (
                    <div className="space-y-5">
                      {med.description && (
                        <div className="p-4 rounded-md bg-base-200/50 border border-base-300">
                          <p className="text-[10px] font-black uppercase tracking-wider text-base-content/40 flex items-center gap-1.5 mb-2">
                            <BookOpen className="w-3.5 h-3.5" /> Description
                          </p>
                          <p className="text-sm text-base-content/80 leading-relaxed">{med.description}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <InfoBox icon={Building2}   label="Manufacturer" value={med.manufacturer} />
                        <InfoBox icon={CatIcon}     label="Category"     value={med.category} />
                        <InfoBox icon={Package}     label="Packaging"    value={med.packaging} />
                        <InfoBox icon={Thermometer} label="Dosage"       value={med.dosage} />
                      </div>
                      {med.indications?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2.5">Common Indications</p>
                          <div className="flex flex-wrap gap-1.5">
                            {med.indications.map((ind, i) => (
                              <span key={i} className="badge badge-primary text-[9px]">{ind}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {med.searchKeywords?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2">Also Known As</p>
                          <div className="flex flex-wrap gap-1.5">
                            {med.searchKeywords.map((kw, i) => (
                              <span key={i} className="px-2 py-0.5 bg-base-200 text-base-content/50 rounded-md text-[9px] font-bold">#{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTabKey === 'composition' && (
                    <div>
                      {!med.saltComposition?.length ? (
                        <p className="text-sm text-base-content/40 italic">No composition data available.</p>
                      ) : (
                        <div className="rounded-md border border-base-300 overflow-hidden">
                          <table className="w-full text-left" aria-label="Salt Composition">
                            <thead className="bg-base-200 text-[10px] font-black uppercase tracking-widest text-base-content/50">
                              <tr>
                                <th className="p-4">Ingredient</th>
                                <th className="p-4 text-right">Strength</th>
                              </tr>
                            </thead>
                            <tbody>
                              {med.saltComposition.map((salt, i) => (
                                <tr key={i} className="border-t border-base-300 hover:bg-primary/5 transition-colors">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SafetyCard title="Side Effects"      list={med.sideEffects}      icon={AlertTriangle} variant="warning" />
                      <SafetyCard title="Contraindications" list={med.contraindications} icon={Ban}           variant="error" />
                    </div>
                  )}

                  {activeTabKey === 'legal' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <InfoBox icon={Tag}        label="Schedule"    value={med.schedule === 'None' ? 'OTC (No Schedule)' : med.schedule} />
                        <InfoBox icon={Percent}    label="GST Rate"    value={`${med.gstPercentage}%`} />
                        <InfoBox icon={Hash}       label="HSN Code"    value={med.hsnCode} />
                        <InfoBox icon={HeartPulse} label="Rx Required" value={med.isPrescriptionRequired ? 'Yes' : 'No'} />
                      </div>
                      <div className="p-4 rounded-md bg-base-200/50 border border-base-300 space-y-3">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">Database ID</p>
                          <p className="font-mono text-xs text-base-content/60 break-all">{med._id}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40 mb-1">Last Updated</p>
                          <p className="text-xs text-base-content/60">
                            {med.updatedAt ? new Date(med.updatedAt).toLocaleString('en-IN') : '—'}
                          </p>
                        </div>
                        {med.isDiscontinued && (
                          <div className="alert alert-error rounded-md py-2 px-3 text-[10px]">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            This product has been marked as discontinued by the manufacturer.
                          </div>
                        )}
                      </div>
                      <div className="p-4 rounded-md bg-warning/5 border border-warning/20">
                        <p className="text-[10px] font-black uppercase tracking-wider text-warning mb-1.5">Regulatory Notice</p>
                        <p className="text-xs text-base-content/60 leading-relaxed">{Sched.desc}</p>
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
{/* Similar Medicines */}
{(similarMedicinesLoading || similarMedicines.length > 0) && (
  <div className="container-custom pb-10">
    <h2 className="text-base font-black text-base-content uppercase tracking-widest mb-4 flex items-center gap-2">
      <RefreshCw className="w-4 h-4 text-primary" /> Similar Medicines
    </h2>
 
 {!similarMedicinesLoading && similarMedicines.length > 0 && (
  <p className="text-[10px] text-base-content/40 font-medium -mt-2 mb-4">
    Medicines with similar salt composition or therapeutic class to{' '}
    <span className="font-black text-primary">{med.brandName}</span>
    {med.genericName ? (
      <> — alternatives containing <span className="font-black text-base-content/60">{med.genericName}</span></>
    ) : null}
  </p>
)}
    {similarMedicinesLoading ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-52 rounded-md" />
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
              whileHover={{ y: -2 }}
              onClick={() => router.push(`/pharmacy/buy-medicines/${item?.slug}`)}
              className="glass-card p-3 text-left flex flex-col gap-2 hover:border-primary/40 transition-all"
            >
              {/* Image */}
              <div className="aspect-square rounded-md bg-base-200 overflow-hidden flex items-center justify-center relative">
                {item.images?.[0]?.url
                  ? <img src={item.images[0].url} alt={item.brandName} className="w-full h-full object-contain p-2" loading="lazy" />
                  : <Pill className="w-8 h-8 text-primary/20" />}
                {/* Stock badge overlay */}
                <span className={`absolute top-1.5 right-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-md ${
                  isOut  ? 'bg-error text-white' :
                  isLow  ? 'bg-warning text-white' :
                           'bg-success text-white'
                }`}>
                  {isOut ? 'Out' : isLow ? 'Low' : 'In Stock'}
                </span>
              </div>

              {/* Name + generic */}
              <div className="min-w-0">
                <p className="text-[11px] font-black text-base-content truncate">{item.brandName}</p>
                <p className="text-[9px] text-base-content/40 truncate italic">{item.genericName}</p>
              </div>

              {/* Dosage + packaging */}
              <div className="space-y-0.5">
                {item.dosage && (
                  <p className="text-[9px] text-base-content/50 flex items-center gap-1">
                    <Pill className="w-2.5 h-2.5 text-primary/50 shrink-0" />
                    {item.dosage}
                  </p>
                )}
                {item.packaging && (
                  <p className="text-[9px] text-base-content/50 flex items-center gap-1 truncate">
                    <Package className="w-2.5 h-2.5 text-primary/50 shrink-0" />
                    {item.packaging}
                  </p>
                )}
                {expiry && (
                  <p className="text-[9px] text-base-content/40 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-primary/50 shrink-0" />
                    Exp: {expiry}
                  </p>
                )}
              </div>

              {/* Price + MRP */}
              <div className="flex items-end justify-between mt-auto pt-1 border-t border-base-200">
                <div>
                  <p className="text-xs font-black text-primary">₹{price}</p>
                  {item.mrp && item.mrp !== price && (
                    <p className="text-[9px] text-base-content/30 line-through">₹{item.mrp}</p>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-base-content/30" />
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

      <AnimatePresence>
        {showBuyNowModal && (
          <BuyNowModal
            med={med}
            quantity={quantity}
            baseTotal={baseTotal}
            storeId={bestStoreId}
            isPrescriptionRequired={med.isPrescriptionRequired ?? false}
            prescriptionUrl={prescriptionUrl}
            isUploadingRx={isUploading}
            onUploadRx={handleFileUpload}
            walletBalance={walletBalance}
            coupon={coupon}
            couponLoading={couponLoading}
            couponError={couponError}
            onApplyCoupon={handleApplyCoupon}
            onRemoveCoupon={handleRemoveCoupon}
            onClose={() => setShowBuyNowModal(false)}
            onSuccess={handleOrderSuccess}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessModal && completedOrder && (
          <OrderSuccessModal
            order={completedOrder}
            onClose={() => {
              setShowSuccessModal(false);
              setCompletedOrder(null);
            }}
            onViewOrders={() => router.push('/pharmacy/orders')}
          />
        )}
      </AnimatePresence>
    </div>
</Container>
    

  );
}