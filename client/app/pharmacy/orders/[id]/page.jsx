'use client';

 

import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Truck, CheckCircle2, XCircle, Clock,
  MapPin, Phone, CreditCard, Wallet, Banknote, Pill,
  FileText, AlertCircle, ChevronDown, ChevronUp,
  BadgeCheck, RotateCcw, PackageOpen, Copy,
  Star, RefreshCw, Home, Zap, FlaskConical,
  Tag, Ban, Building2, Upload, FileImage,
  ShieldCheck, ShieldX, Eye, Loader2, StickyNote, CheckCircle,
  Package, ArrowLeftRight, Bike, ClipboardCheck,
  PackageCheck, Undo2, Image, Video, PlusCircle,
  Trash2, Info, KeyRound, Receipt, DollarSign,
  Landmark, Hash, User, GitBranch, AlertTriangle, Replace,
} from 'lucide-react';
import Link from 'next/link';

import {
  fetchOrderById,
  fetchOrderInvoice,
  selectCurrentOrder,
  selectPharmacyGlobalLoading,
  selectOrderError,
  selectInvoiceLoading,
  selectPrescriptionUploadLoading,
  clearCurrentOrder,
  clearPharmacyErrors,
  clearInvoiceData,
  clearPrescriptionUpload,
  cancelOrder,
  requestReturn,
  submitFeedback,
  uploadOrderPrescription,
  uploadPrescriptionFile,
  verifyDeliveryOtp,
  selectPharmacyActionLoading,
} from '@/store/slices/pharmacyOrderSlice';

// uploadSingleFile from uploadSlice is used ONLY for return evidence (images/videos)
// If you want to remove it entirely, replace with your own CDN uploader.
import { uploadSingleFile } from '@/store/slices/uploadSlice';

// ═══════════════════════════════════════════════════════════════════════════════
// § CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const FORWARD_STEPS = [
  { key: 'Placed',           label: 'Order Placed',     icon: PackageOpen,   desc: 'Your order has been received'   },
  { key: 'Confirmed',        label: 'Confirmed',         icon: BadgeCheck,    desc: 'Store has confirmed your order' },
  { key: 'Processing',       label: 'Processing',        icon: RotateCcw,     desc: 'Medicines are being packed'     },
  { key: 'Out-for-Delivery', label: 'Out for Delivery',  icon: Truck,         desc: 'On the way to you'              },
  { key: 'Delivered',        label: 'Delivered',         icon: CheckCircle2,  desc: 'Order delivered successfully'   },
];

const RETURN_STEPS = [
  { key: 'Delivered',        label: 'Delivered',         icon: CheckCircle2,   desc: 'Order was delivered'          },
  { key: 'Return_Requested', label: 'Return Requested',  icon: Undo2,          desc: 'You raised a return request'  },
  { key: 'Return_Accepted',  label: 'Return Accepted',   icon: ClipboardCheck, desc: 'Store accepted the return'    },
  { key: 'Pickup_Assigned',  label: 'Pickup Assigned',   icon: Bike,           desc: 'Pickup partner assigned'      },
  { key: 'Pickup_Done',      label: 'Pickup Done',       icon: PackageCheck,   desc: 'Items picked up from you'     },
  { key: 'Returned',         label: 'Returned',          icon: ArrowLeftRight, desc: 'Return completed'             },
];

const RETURN_FLOW_STATUSES = new Set([
  'Return_Requested', 'Return_Accepted', 'Return_Rejected',
  'Pickup_Assigned',  'Pickup_Done',     'Returned',
]);

const STATUS_LABEL_MAP = {
  Placed:            'Order Placed',     Confirmed:         'Confirmed',
  Processing:        'Processing',       'Out-for-Delivery':'Out for Delivery',
  Delivered:         'Delivered',        Cancelled:         'Cancelled',
  Return_Requested:  'Return Requested', Return_Accepted:   'Return Accepted',
  Return_Rejected:   'Return Rejected',  Pickup_Assigned:   'Pickup Assigned',
  Pickup_Done:       'Pickup Done',      Returned:          'Returned',
};

const STATUS_META = {
  Placed:            { color: 'text-info',    bg: 'bg-info/15',    ring: 'ring-info/40',    grad: 'from-info/20 to-info/5'         },
  Confirmed:         { color: 'text-primary', bg: 'bg-primary/15', ring: 'ring-primary/40', grad: 'from-primary/20 to-primary/5'   },
  Processing:        { color: 'text-warning', bg: 'bg-warning/15', ring: 'ring-warning/40', grad: 'from-warning/20 to-warning/5'   },
  'Out-for-Delivery':{ color: 'text-accent',  bg: 'bg-accent/15',  ring: 'ring-accent/40',  grad: 'from-accent/20 to-accent/5'     },
  Delivered:         { color: 'text-success', bg: 'bg-success/15', ring: 'ring-success/40', grad: 'from-success/20 to-success/5'   },
  Cancelled:         { color: 'text-error',   bg: 'bg-error/15',   ring: 'ring-error/40',   grad: 'from-error/20 to-error/5'       },
  Return_Requested:  { color: 'text-warning', bg: 'bg-warning/15', ring: 'ring-warning/40', grad: 'from-warning/20 to-warning/5'   },
  Return_Accepted:   { color: 'text-info',    bg: 'bg-info/15',    ring: 'ring-info/40',    grad: 'from-info/20 to-info/5'         },
  Return_Rejected:   { color: 'text-error',   bg: 'bg-error/15',   ring: 'ring-error/40',   grad: 'from-error/20 to-error/5'       },
  Pickup_Assigned:   { color: 'text-accent',  bg: 'bg-accent/15',  ring: 'ring-accent/40',  grad: 'from-accent/20 to-accent/5'     },
  Pickup_Done:       { color: 'text-primary', bg: 'bg-primary/15', ring: 'ring-primary/40', grad: 'from-primary/20 to-primary/5'   },
  Returned:          { color: 'text-success', bg: 'bg-success/15', ring: 'ring-success/40', grad: 'from-success/20 to-success/5'   },
};

const STATUS_ICON_MAP = {
  Placed:            PackageOpen, Confirmed:         BadgeCheck,    Processing:  RotateCcw,
  'Out-for-Delivery':Truck,       Delivered:         CheckCircle2,  Cancelled:   XCircle,
  Return_Requested:  Undo2,       Return_Accepted:   ClipboardCheck,Return_Rejected: XCircle,
  Pickup_Assigned:   Bike,        Pickup_Done:       PackageCheck,  Returned:    ArrowLeftRight,
};

const RX_STATUS_CFG = {
  Not_Uploaded: { color: 'text-base-content/50', bg: 'bg-base-300/50', border: 'border-base-300',   icon: FileImage,   label: 'Not Uploaded'   },
  Pending:      { color: 'text-warning',          bg: 'bg-warning/10',  border: 'border-warning/30', icon: Clock,       label: 'Pending Review' },
  Approved:     { color: 'text-success',          bg: 'bg-success/10',  border: 'border-success/30', icon: ShieldCheck, label: 'Approved'       },
  Rejected:     { color: 'text-error',            bg: 'bg-error/10',    border: 'border-error/30',   icon: ShieldX,     label: 'Rejected'       },
};

/** Valid refund methods matching the router's enum */
const REFUND_METHODS = [
  { value: 'Wallet',        label: 'Wallet',             icon: Wallet,    desc: 'Instant refund to your Likeson wallet'   },
  { value: 'Online',        label: 'Online / UPI',       icon: Zap,       desc: 'Refund to original payment source'       },
  { value: 'Bank_Transfer', label: 'Bank Transfer',      icon: Landmark,  desc: 'Direct bank transfer (2–5 working days)' },
  { value: 'Custom_Bank',   label: 'Other Bank Account', icon: Building2, desc: 'Specify a different bank account'         },
];

// ═══════════════════════════════════════════════════════════════════════════════
// § UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const formatDate = (date, includeTime = false) => {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    if (includeTime) { options.hour = '2-digit'; options.minute = '2-digit'; }
    return d.toLocaleDateString('en-IN', options);
  } catch { return '—'; }
};

const formatCurrency = (amount) => {
  const num = Number(amount ?? 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const safeString = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const isPdfUrl = (url) => typeof url === 'string' && url.toLowerCase().includes('.pdf');

function useCopy() {
  const [copiedKey, setCopiedKey] = useState('');
  const copy = (value, key) => {
    navigator.clipboard.writeText(safeString(value)).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  };
  return { copy, copiedKey };
}

const getStatusTimestamp = (statusHistory = [], statusKey) => {
  const entries = [...statusHistory].filter((h) => h.status === statusKey);
  if (!entries.length) return null;
  return entries[entries.length - 1].timestamp;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── InfoRow ──────────────────────────────────────────────────────────────────
/** A label-value pair row. copyable=true adds a copy-to-clipboard button. */
function InfoRow({ label, value, copyable = false }) {
  const { copy, copiedKey } = useCopy();
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-base-300/40 last:border-0">
      <span className="text-xs text-base-content/45">{label}</span>
      {copyable ? (
        <button type="button" onClick={() => copy(value, label)}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80">
          {copiedKey === label
            ? <><BadgeCheck className="w-3.5 h-3.5 text-success" /><span className="text-success">Copied</span></>
            : <><Copy className="w-3.5 h-3.5" /><span className="truncate">{safeString(value).slice(-16)}</span></>}
        </button>
      ) : (
        <span className="text-xs font-semibold text-base-content">{value}</span>
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
/** Collapsible card section used throughout the page. */
function Section({ title, icon: Icon, children, defaultOpen = true, accentClass, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-base-100 rounded-2xl border border-base-300 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-base-200/50">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentClass || 'bg-primary/10'}`}>
            <Icon className={`w-4 h-4 ${accentClass ? 'text-white' : 'text-primary'}`} />
          </div>
          <span className="font-bold text-sm">{title}</span>
          {badge && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-base-content/30" /> : <ChevronDown className="w-4 h-4 text-base-content/30" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── TrackingTimeline ─────────────────────────────────────────────────────────
/**
 * Shows forward delivery steps OR return flow steps depending on order state.
 * Cancelled and Return_Rejected orders show a banner instead.
 */
function TrackingTimeline({ order }) {
  const currentStatus = safeString(order.delivery?.status) || 'Placed';
  const statusHistory = order.delivery?.statusHistory || [];
  const isCancelled   = order.cancellation?.isCancelled === true;
  const isReturnFlow  = RETURN_FLOW_STATUSES.has(currentStatus) || order.cancellation?.isReturnRequested === true;
  const isRejected    = currentStatus === 'Return_Rejected';
  const meta          = STATUS_META[currentStatus] || STATUS_META.Placed;
  const steps         = isReturnFlow ? RETURN_STEPS : FORWARD_STEPS;
  const currentIdx    = steps.findIndex((s) => s.key === currentStatus);
  const effectiveIdx  = currentIdx === -1 ? 0 : currentIdx;

  return (
    <div>
      {/* Cancelled banner */}
      {isCancelled && (
        <div className="flex items-center gap-3 p-3.5 mb-4 rounded-xl bg-error/10 border border-error/30">
          <XCircle className="w-5 h-5 text-error shrink-0" />
          <div>
            <p className="font-black text-sm text-error">Order Cancelled</p>
            {order.cancellation?.cancelledAt && (
              <p className="text-xs text-base-content/50 mt-0.5">{formatDate(order.cancellation.cancelledAt, true)}</p>
            )}
            {order.cancellation?.reason && (
              <p className="text-xs text-base-content/60 mt-0.5 italic">"{order.cancellation.reason}"</p>
            )}
          </div>
        </div>
      )}

      {/* Return Rejected banner */}
      {isRejected && (
        <div className="flex items-center gap-3 p-3.5 mb-4 rounded-xl bg-error/10 border border-error/30">
          <XCircle className="w-5 h-5 text-error shrink-0" />
          <div>
            <p className="font-black text-sm text-error">Return Rejected</p>
            {order.cancellation?.returnDecisionNote && (
              <p className="text-xs text-base-content/60 mt-0.5">{order.cancellation.returnDecisionNote}</p>
            )}
          </div>
        </div>
      )}

      {/* Steps */}
      {!isCancelled && !isRejected && steps.map((step, i) => {
        const isDone    = i < effectiveIdx;
        const isCurrent = i === effectiveIdx;
        const isFuture  = i > effectiveIdx;
        const StepIcon  = step.icon;
        const ts        = getStatusTimestamp(statusHistory, step.key);

        return (
          <div key={step.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.08 }}
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ring-4 z-10 relative ${
                  isCurrent ? `${meta.bg} ${meta.color} ${meta.ring} shadow-lg`
                  : isDone   ? 'bg-success/15 text-success ring-success/30'
                             : 'bg-base-300 text-base-content/25 ring-base-300/30'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                {isCurrent && (
                  <motion.span className={`absolute inset-0 rounded-full ${meta.bg}`}
                    animate={{ scale: [1, 1.45, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }} />
                )}
              </motion.div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 flex-1 my-1 rounded-full min-h-[24px] ${isDone ? 'bg-success/50' : 'bg-base-300'}`} />
              )}
            </div>
            <div className="pb-4 pt-1.5 flex-1">
              <p className={`font-bold text-sm ${isCurrent ? meta.color : isDone ? 'text-success' : 'text-base-content/30'}`}>{step.label}</p>
              {/* Note: Timestamp when this step was reached, or description if not yet */}
              <p className={`text-xs mt-0.5 ${isFuture ? 'text-base-content/20' : 'text-base-content/50'}`}>
                {(isDone || isCurrent) && ts ? formatDate(ts, true) : step.desc}
              </p>
            </div>
          </div>
        );
      })}

      {/* Full status history */}
      {statusHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-base-300/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-base-content/30 mb-3">Full History</p>
          <div className="space-y-2">
            {[...statusHistory].reverse().map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-base-content/70">{STATUS_LABEL_MAP[h.status] || h.status}</span>
                {/* Note: Exact date and time this status change happened */}
                <span className="text-base-content/35">{formatDate(h.timestamp, true)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ItemRow ──────────────────────────────────────────────────────────────────
function ItemRow({ item, index }) {
  const name        = safeString(item.name || item.medicine?.brandName || 'Medicine');
  const quantity    = Number(item.quantity) || 1;
  const unitPrice   = Number(item.pricePerUnit) || 0;
  const taxAmount   = Number(item.taxAmount) || 0;
  const totalPrice  = Number(item.totalPrice) || 0;
  const imageUrl    = safeString(item.medicineImage || '');
  const genericName = safeString(item.genericName || '');
  const isValidImg  = imageUrl && imageUrl.startsWith('http');

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.07 }}
      className="flex items-start gap-3 p-3 bg-base-200 rounded-xl">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-base-300">
        {isValidImg
          ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
          : <Pill className="w-6 h-6 text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-sm text-base-content truncate">{name}</p>
            {genericName && (
              <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-0.5 font-medium">{genericName}</span>
            )}
          </div>
          {/* Note: Total price for this line (quantity × unit price) */}
          <span className="font-black text-sm text-base-content flex-shrink-0">{formatCurrency(totalPrice)}</span>
        </div>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
          <span className="text-xs text-base-content/50">Qty: {quantity}</span>
          <span className="text-xs text-base-content/50">@ {formatCurrency(unitPrice)}</span>
          {taxAmount > 0 && <span className="text-xs text-base-content/40">+{formatCurrency(taxAmount)} tax</span>}
          {item.isPrescriptionRequired && (
            <span className="text-xs text-warning font-semibold flex items-center gap-1">
              <FlaskConical className="w-3 h-3" /> Requires Rx
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── StoreInfo ────────────────────────────────────────────────────────────────
function StoreInfo({ store }) {
  if (!store) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-3 bg-base-200 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{safeString(store.storeName)}</p>
        </div>
      </div>
      {store.address && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 text-base-content/30 mt-0.5 flex-shrink-0" />
          <p className="text-base-content/60">
            {[safeString(store.address.line1), safeString(store.address.city), safeString(store.address.pincode)].filter(Boolean).join(', ')}
          </p>
        </div>
      )}
      {store.contact?.phone && (
        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-base-content/30 flex-shrink-0" />
          <span className="text-base-content/60">{safeString(store.contact.phone)}</span>
        </div>
      )}
    </div>
  );
}

// ─── BillingBreakdown ─────────────────────────────────────────────────────────
function BillingBreakdown({ billing }) {
  if (!billing) return null;
  const rows = [
    { label: 'Sub Total',        amount: billing.subTotal        },
    { label: 'GST',              amount: billing.gstAmount       },
    { label: 'Delivery Charges', amount: billing.deliveryCharges },
    { label: 'Platform Fee',     amount: billing.platformFee     },
  ].filter((r) => Number(r.amount) > 0);

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <motion.div key={row.label} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
          className="flex items-center justify-between text-sm">
          <span className="text-base-content/50">{row.label}</span>
          <span className="font-semibold">{formatCurrency(row.amount)}</span>
        </motion.div>
      ))}
      {Number(billing.discountAmount) > 0 && (
        <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between text-sm">
          <span className="text-success flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            Discount {billing.promoCode ? `(${billing.promoCode})` : ''}
          </span>
          {/* Note: Amount saved via coupon or subscription discount */}
          <span className="font-bold text-success">-{formatCurrency(billing.discountAmount)}</span>
        </motion.div>
      )}
      {Number(billing.walletAmountUsed) > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-info flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Wallet Used</span>
          <span className="font-bold text-info">-{formatCurrency(billing.walletAmountUsed)}</span>
        </div>
      )}
      <div className="border-t border-base-300 pt-2 mt-2 flex items-center justify-between">
        <span className="font-black">Total Paid</span>
        <span className="font-black text-lg text-primary">{formatCurrency(billing.totalPayable)}</span>
      </div>
    </div>
  );
}

// ─── PrescriptionSection ──────────────────────────────────────────────────────
/**
 * Handles prescription display + upload for an existing order.
 *
 * Upload flow:
 *   1. User picks file → local preview shown immediately
 *   2. On "Submit" → dispatch(uploadPrescriptionFile({ file }))
 *      → CDN upload via pharmacy slice → returns { imageUrl }
 *   3. dispatch(uploadOrderPrescription({ orderId, imageUrl }))
 *      → attaches URL to the order on the server
 */
function PrescriptionSection({ order, orderId, isUploading, actionLoading, onUpload }) {
  const rx           = order?.prescription;
  const fileInputRef = useRef(null);
  const [file,        setFile]       = useState(null);
  const [previewUrl,  setPreviewUrl] = useState(null);
  const [showForm,    setShowForm]   = useState(false);
  const [showImage,   setShowImage]  = useState(false);

  if (!rx?.isRequired) return null;

  const verificationStatus = rx.verificationStatus || 'Not_Uploaded';
  const cfg    = RX_STATUS_CFG[verificationStatus] || RX_STATUS_CFG.Not_Uploaded;
  const RxIcon = cfg.icon;

  const canReUpload    = ['Not_Uploaded', 'Rejected', 'Pending'].includes(verificationStatus);
  const deliveryStatus = safeString(order.delivery?.status);
  const uploadBlocked  = ['Out-for-Delivery', 'Delivered', 'Cancelled'].includes(deliveryStatus);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selected.type)) { alert('Please upload JPG, PNG, WebP, or PDF only.'); return; }
    if (selected.size > 5 * 1024 * 1024) { alert('File must be under 5 MB.'); return; }
    setFile(selected);
    setPreviewUrl(selected.type.startsWith('image/') ? URL.createObjectURL(selected) : null);
  };

  // Triggers parent handler which calls uploadPrescriptionFile → uploadOrderPrescription
  const handleSubmit = () => {
    if (!file) return;
    onUpload(file);
    setFile(null); setPreviewUrl(null); setShowForm(false);
  };

  return (
    <div className="space-y-3">
      {/* Status badge */}
      <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
        <RxIcon className={`w-5 h-5 shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`font-black text-sm ${cfg.color}`}>{cfg.label}</p>
          {rx.uploadedAt && (
            <p className="text-[10px] text-base-content/40 mt-0.5">Uploaded: {formatDate(rx.uploadedAt, true)}</p>
          )}
          {rx.verifiedAt && verificationStatus !== 'Not_Uploaded' && (
            <p className="text-[10px] text-base-content/40">
              Reviewed: {formatDate(rx.verifiedAt, true)}
              {rx.verifiedBy?.name ? ` by ${rx.verifiedBy.name}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {verificationStatus === 'Rejected' && rx.rejectionReason && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-error/5 border border-error/20">
          <ShieldX className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-error uppercase tracking-wider mb-1">Rejection Reason</p>
            {/* Note: Reason why the pharmacist rejected your prescription */}
            <p className="text-sm text-error/80">{rx.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Pharmacist notes */}
      {rx.verificationNotes && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-info/5 border border-info/20">
          <StickyNote className="w-4 h-4 text-info shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-info uppercase tracking-wider mb-1">Pharmacist Notes</p>
            <p className="text-sm text-info/80">{rx.verificationNotes}</p>
          </div>
        </div>
      )}

      {/* View current prescription image */}
      {rx.imageUrl && (
        <div className="space-y-2">
          <button type="button" onClick={() => setShowImage((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-base-200 border border-base-300 text-sm font-bold hover:bg-base-300 transition-colors">
            <span className="flex items-center gap-2"><Eye className="w-4 h-4 text-primary" />{showImage ? 'Hide' : 'View'} Prescription</span>
            {showImage ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showImage && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="rounded-xl overflow-hidden border border-base-300 bg-base-200">
                  {isPdfUrl(rx.imageUrl) ? (
                    <div className="p-6 text-center">
                      <FileText className="w-10 h-10 text-error mx-auto mb-2" />
                      <p className="text-xs font-bold text-base-content/60">PDF prescription</p>
                      <a href={rx.imageUrl} target="_blank" rel="noreferrer" className="text-xs text-primary font-bold hover:underline mt-1 block">Open PDF ↗</a>
                    </div>
                  ) : (
                    <img src={rx.imageUrl} alt="Prescription" className="w-full max-h-64 object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  <div className="px-3 py-2 border-t border-base-300">
                    <a href={rx.imageUrl} target="_blank" rel="noreferrer" className="text-xs text-primary font-bold hover:underline">Open Full Image ↗</a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Upload / Replace button */}
      {canReUpload && !uploadBlocked && (
        <div>
          {!showForm ? (
            <button type="button" onClick={() => setShowForm(true)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed font-bold text-sm transition-all ${
                verificationStatus === 'Rejected'
                  ? 'border-error/40 text-error hover:bg-error/5 bg-error/5'
                  : 'border-primary/30 text-primary hover:bg-primary/5'
              }`}>
              <Upload className="w-4 h-4" />
              {verificationStatus === 'Rejected' ? 'Re-Upload Prescription' : rx.imageUrl ? 'Replace Prescription' : 'Upload Prescription'}
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-base-content/40">
                {rx.imageUrl ? 'Upload New Prescription' : 'Upload Prescription'}
              </p>

              {/* File picker drop zone */}
              <div onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-xl p-5 text-center transition-all ${file ? 'border-success/50 bg-success/5' : 'border-base-300 hover:border-primary/50 hover:bg-primary/5'}`}>
                <input ref={fileInputRef} type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange} className="hidden" />
                {previewUrl ? (
                  <div className="space-y-2">
                    {/* Note: Preview of the selected prescription image */}
                    <img src={previewUrl} alt="Preview" className="mx-auto max-h-28 rounded-lg object-contain border border-base-300" />
                    <p className="text-[10px] font-bold text-success flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {file.name}
                    </p>
                    <p className="text-[9px] text-base-content/40">Click to change</p>
                  </div>
                ) : file ? (
                  <div className="space-y-2">
                    <FileImage className="w-8 h-8 text-success mx-auto" />
                    <p className="text-[10px] font-bold text-success">{file.name}</p>
                    <p className="text-[9px] text-base-content/40">Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-8 h-8 text-base-content/20 mx-auto" />
                    {/* Note: Accepts JPG, PNG, WebP image or PDF, maximum 5 MB */}
                    <p className="text-xs font-bold text-base-content/50">Click to upload</p>
                    <p className="text-[10px] text-base-content/30">JPG, PNG, WebP or PDF · Max 5 MB</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setShowForm(false); setFile(null); setPreviewUrl(null); }}
                  disabled={isUploading || actionLoading}
                  className="flex-1 py-2.5 rounded-lg bg-base-300 font-bold text-sm hover:bg-base-400 disabled:opacity-40">
                  Cancel
                </button>
                <button type="button" onClick={handleSubmit}
                  disabled={!file || isUploading || actionLoading}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:bg-primary/80 disabled:opacity-40 flex items-center justify-center gap-2">
                  {(isUploading || actionLoading)
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                    : <><Upload className="w-4 h-4" /> Submit</>}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Blocked message — cannot upload at this delivery stage */}
      {uploadBlocked && !['Approved'].includes(verificationStatus) && (
        <p className="text-center text-[10px] font-bold text-base-content/30 uppercase tracking-wider py-1">
          Prescription upload not available at this stage
        </p>
      )}
    </div>
  );
}

// ─── EvidenceUploader ─────────────────────────────────────────────────────────
/**
 * Manages return evidence (images/videos).
 * Uses uploadSingleFile (from uploadSlice) for evidence upload.
 * Up to 5 files. Each item: { mediaType: 'image'|'video', url: string }
 */
function EvidenceUploader({ evidence, onEvidenceChange, dispatch }) {
  const fileInputRef  = useRef(null);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const isUploading = useSelector((s) => s.upload?.isUploading ?? false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { alert('Only images or videos allowed.'); return; }
    if (file.size > 20 * 1024 * 1024) { alert('File must be under 20 MB.'); return; }
    const mediaType = isImage ? 'image' : 'video';
    const newIdx = evidence.length;
    setUploadingIdx(newIdx);
    try {
      const result = await dispatch(uploadSingleFile({ file, folder: 'return-evidence' })).unwrap();
      if (result?.url) onEvidenceChange([...evidence, { mediaType, url: result.url }]);
    } catch { /* handled by slice */ }
    finally { setUploadingIdx(null); e.target.value = ''; }
  };

  const removeItem = (idx) => onEvidenceChange(evidence.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {/* Note: Upload photos/videos of the medicine, packaging, damage, or any issue */}
        <p className="text-xs font-black uppercase tracking-widest text-base-content/40">Evidence ({evidence.length}/5)</p>
        <p className="text-[10px] text-base-content/30">Min 1 image/video required</p>
      </div>
      {evidence.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {evidence.map((item, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden border border-base-300 bg-base-200 aspect-square">
              {item.mediaType === 'image'
                ? <img src={item.url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-1"><Video className="w-6 h-6 text-primary" /><p className="text-[9px] font-bold text-base-content/50">Video {i + 1}</p></div>}
              <button type="button" onClick={() => removeItem(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-error flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3 h-3 text-white" />
              </button>
              <div className="absolute bottom-1 left-1">
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${item.mediaType === 'image' ? 'bg-info/80 text-white' : 'bg-primary/80 text-white'}`}>
                  {item.mediaType === 'image' ? 'IMG' : 'VID'}
                </span>
              </div>
            </div>
          ))}
          {uploadingIdx !== null && (
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 aspect-square flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}
        </div>
      )}
      {evidence.length < 5 && uploadingIdx === null && (
        <>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-base-300 hover:border-primary/50 hover:bg-primary/5 font-bold text-sm text-base-content/50 hover:text-primary transition-all disabled:opacity-40">
            <PlusCircle className="w-4 h-4" /> Add Photo / Video
          </button>
        </>
      )}
      <p className="text-[10px] text-base-content/30 flex items-start gap-1">
        <Info className="w-3 h-3 shrink-0 mt-0.5" />
        Upload clear photos or videos of medicines and packaging. This speeds up return approval.
      </p>
    </div>
  );
}

// ─── BankDetailsForm ──────────────────────────────────────────────────────────
/** Collects bank account details needed for Bank_Transfer or Custom_Bank refund methods */
function BankDetailsForm({ bankDetails, onBankDetailsChange }) {
  const fields = [
    { key: 'accountHolderName', label: 'Account Holder Name', icon: User,      placeholder: 'Full name as per bank',       note: 'Must match bank records exactly' },
    { key: 'accountNumber',     label: 'Account Number',      icon: Hash,      placeholder: 'Enter account number',        note: 'Savings or current account number' },
    { key: 'ifscCode',          label: 'IFSC Code',           icon: GitBranch, placeholder: 'E.g. SBIN0001234',            note: '11-character bank branch code' },
    { key: 'bankName',          label: 'Bank Name',           icon: Landmark,  placeholder: 'E.g. State Bank of India',    note: 'Full name of your bank' },
    { key: 'branchName',        label: 'Branch Name',         icon: Building2, placeholder: 'Branch name (optional)',      note: 'Optional — helps processing' },
  ];
  return (
    <div className="space-y-2.5 p-3.5 bg-base-200 rounded-xl border border-base-300">
      <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Bank Account Details</p>
      {fields.map(({ key, label, icon: FieldIcon, placeholder, note }) => (
        <div key={key}>
          <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-1 flex items-center gap-1">
            <FieldIcon className="w-3 h-3" /> {label}
          </label>
          <input type="text" value={bankDetails[key] || ''} onChange={(e) => onBankDetailsChange({ ...bankDetails, [key]: e.target.value })}
            placeholder={placeholder}
            className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg text-sm focus:outline-none focus:border-primary placeholder-base-content/25" />
          {/* Note: Inline hint for each bank detail field */}
          <p className="text-[9px] text-base-content/30 mt-0.5">{note}</p>
        </div>
      ))}
    </div>
  );
}

// ─── ReturnOrderSection ───────────────────────────────────────────────────────
/**
 * Full return request form:
 *  Step 1 — Return reason (min 10 characters)
 *  Step 2 — Evidence upload (min 1 photo/video)
 *  Step 3 — Refund method selection
 *  Step 4 — Bank details (only for Bank_Transfer or Custom_Bank)
 */
function ReturnOrderSection({ order, dispatch, isLoading }) {
  const [isOpen,       setIsOpen]       = useState(false);
  const [reason,       setReason]       = useState('');
  const [evidence,     setEvidence]     = useState([]);
  const [refundMethod, setRefundMethod] = useState('');
  const [bankDetails,  setBankDetails]  = useState({ accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '', branchName: '' });

  const status            = safeString(order.delivery?.status);
  const isReturnRequested = order.cancellation?.isReturnRequested === true;
  const canReturn         = status === 'Delivered' && !isReturnRequested;
  const deliveredAt       = order.delivery?.deliveredAt;
  const daysElapsed       = deliveredAt ? (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24) : 999;

  if (!canReturn || daysElapsed > 7) return null;

  const needsBankDetails = ['Bank_Transfer', 'Custom_Bank'].includes(refundMethod);
  const bankFilled = !needsBankDetails || (bankDetails.accountHolderName && bankDetails.accountNumber && bankDetails.ifscCode && bankDetails.bankName);
  const isFormValid = reason.length >= 10 && evidence.length >= 1 && refundMethod !== '' && bankFilled;

  const handleSubmit = async () => {
    if (!isFormValid) return;
    try {
      await dispatch(requestReturn({
        orderId: safeString(order._id || order.orderId),
        returnReason: reason, evidence, refundMethod,
        bankDetails: needsBankDetails ? bankDetails : undefined,
      })).unwrap();
      setIsOpen(false);
    } catch { /* thunk fires toast */ }
  };

  return !isOpen ? (
    <motion.button type="button" onClick={() => setIsOpen(true)}
      className="w-full px-4 py-3 bg-warning/10 border border-warning/30 rounded-xl text-warning font-bold hover:bg-warning/15 flex items-center justify-center gap-2 text-sm">
      <RotateCcw className="w-4 h-4" /> Request Return
      {/* Note: Return window — how many days remain to submit a return request */}
      <span className="text-[10px] text-warning/60 font-normal">({Math.max(0, Math.ceil(7 - daysElapsed))} days left)</span>
    </motion.button>
  ) : (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-warning/5 border border-warning/30 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-black text-sm text-warning">Request Return</p>
        <button type="button" onClick={() => setIsOpen(false)} className="text-xs text-base-content/40 hover:text-base-content">✕ Close</button>
      </div>

      {/* Step 1 — Return Reason */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">
          1. Return Reason <span className="text-error">*</span>
        </p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))}
          placeholder="Describe the issue clearly (wrong medicine, damaged packaging, expiry, etc.)…"
          minLength={10} rows={3}
          className="w-full p-3 bg-base-100 border border-base-300 rounded-xl text-sm focus:outline-none focus:border-warning resize-none" />
        {/* Note: Minimum 10 characters, maximum 500 characters */}
        <p className={`text-[10px] mt-1 text-right ${reason.length < 10 ? 'text-error' : 'text-base-content/30'}`}>
          {reason.length}/500 · Min 10 characters
        </p>
      </div>

      {/* Step 2 — Evidence */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">
          2. Upload Evidence <span className="text-error">*</span>
        </p>
        <EvidenceUploader evidence={evidence} onEvidenceChange={setEvidence} dispatch={dispatch} />
      </div>

      {/* Step 3 — Refund Method */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">
          3. Refund Method <span className="text-error">*</span>
        </p>
        {/* Note: Choose how you want your refund processed */}
        <div className="grid grid-cols-2 gap-2">
          {REFUND_METHODS.map((method) => {
            const MethodIcon = method.icon;
            const isSelected = refundMethod === method.value;
            return (
              <button key={method.value} type="button" onClick={() => setRefundMethod(method.value)}
                className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-base-300 bg-base-100 text-base-content/60 hover:border-primary/40'}`}>
                <div className="flex items-center gap-1.5">
                  <MethodIcon className={`w-4 h-4 ${isSelected ? 'text-primary' : ''}`} />
                  <span className="font-bold text-xs">{method.label}</span>
                </div>
                <p className={`text-[9px] leading-snug ${isSelected ? 'text-primary/70' : 'text-base-content/40'}`}>{method.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 4 — Bank Details (conditional) */}
      {needsBankDetails && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">
            4. Bank Account Details <span className="text-error">*</span>
          </p>
          <BankDetailsForm bankDetails={bankDetails} onBankDetailsChange={setBankDetails} />
        </motion.div>
      )}

      {/* Submit */}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => { setIsOpen(false); setReason(''); setEvidence([]); setRefundMethod(''); }}
          disabled={isLoading} className="flex-1 px-3 py-2.5 bg-base-300 text-base-content rounded-xl font-semibold text-sm hover:bg-base-400 disabled:opacity-50">
          Cancel
        </button>
        <button type="button" onClick={handleSubmit} disabled={!isFormValid || isLoading}
          className="flex-1 px-3 py-2.5 bg-warning text-white rounded-xl font-bold text-sm hover:bg-warning/80 disabled:opacity-50 flex items-center justify-center gap-2">
          {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><RotateCcw className="w-4 h-4" /> Submit Return</>}
        </button>
      </div>
    </motion.div>
  );
}

// ─── DeliveryOtpSection ───────────────────────────────────────────────────────
/**
 * Shown when delivery status is Out-for-Delivery.
 * Customer shares the 6-digit OTP (sent to their email) with the delivery partner.
 * Note: Only the delivery partner can complete this — do not share OTP with anyone else.
 */
function DeliveryOtpSection({ order, orderId, dispatch, isLoading }) {
  const [otp, setOtp] = useState('');
  const [done, setDone] = useState(false);
  if (safeString(order.delivery?.status) !== 'Out-for-Delivery') return null;

  const handleSubmit = async () => {
    if (otp.length !== 6) return;
    try {
      await dispatch(verifyDeliveryOtp({ orderId, otp })).unwrap();
      setDone(true);
    } catch { /* thunk fires toast */ }
  };

  if (done) return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-success/10 border border-success/30">
      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
      <p className="text-sm font-bold text-success">OTP verified! Order marked as Delivered.</p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-accent/5 border border-accent/30 rounded-2xl space-y-3">
      <div className="flex items-center gap-2.5">
        <KeyRound className="w-5 h-5 text-accent" />
        <div>
          <p className="font-black text-sm text-accent">Delivery OTP</p>
          {/* Note: Your 6-digit OTP was emailed to your registered email address */}
          <p className="text-[10px] text-base-content/40">Your OTP was sent to your registered email</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input type="text" inputMode="numeric" maxLength={6} value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Enter 6-digit OTP"
          className="flex-1 px-4 py-2.5 bg-base-100 border border-base-300 rounded-xl text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-accent text-center placeholder-base-content/25" />
        <button type="button" onClick={handleSubmit} disabled={otp.length !== 6 || isLoading}
          className="px-4 py-2.5 bg-accent text-white rounded-xl font-bold text-sm hover:bg-accent/80 disabled:opacity-50 flex items-center gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Verify
        </button>
      </div>
      {/* Note: Share OTP only when the delivery partner is physically at your door */}
      <p className="text-[10px] text-base-content/30 flex items-start gap-1">
        <Info className="w-3 h-3 shrink-0 mt-0.5" />
        Share this OTP with the delivery partner only when they are at your door.
      </p>
    </motion.div>
  );
}

// ─── ReturnEvidenceDisplay ────────────────────────────────────────────────────
/** Displays submitted return evidence in a grid. Click image to open lightbox. */
function ReturnEvidenceDisplay({ evidence = [] }) {
  const [lightbox, setLightbox] = useState(null);
  if (!evidence.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Evidence Submitted ({evidence.length})</p>
      <div className="grid grid-cols-3 gap-2">
        {evidence.map((item, i) => (
          <div key={i}
            className="relative rounded-xl overflow-hidden border border-base-300 bg-base-200 aspect-square cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => item.mediaType === 'image' && setLightbox(item.url)}>
            {item.mediaType === 'image'
              ? <img src={item.url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <Video className="w-6 h-6 text-primary" />
                  <p className="text-[9px] font-bold text-base-content/50">Video</p>
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-[8px] text-primary underline" onClick={(e) => e.stopPropagation()}>Open ↗</a>
                </div>}
            <div className="absolute bottom-1 left-1">
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${item.mediaType === 'image' ? 'bg-info/80 text-white' : 'bg-primary/80 text-white'}`}>
                {item.mediaType === 'image' ? 'IMG' : 'VID'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}>
            <motion.img initial={{ scale: 0.8 }} animate={{ scale: 1 }} src={lightbox} alt="Evidence"
              className="max-w-full max-h-full rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
            <button type="button" onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold hover:bg-white/30">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── RefundStatusBadge ────────────────────────────────────────────────────────
function RefundStatusBadge({ refundStatus }) {
  const cfgMap = {
    None:          { bg: 'bg-base-300/50', text: 'text-base-content/40', label: 'No Refund'   },
    Requested:     { bg: 'bg-warning/15',  text: 'text-warning',          label: 'Requested'   },
    'In-Progress': { bg: 'bg-info/15',     text: 'text-info',             label: 'In Progress' },
    Processed:     { bg: 'bg-success/15',  text: 'text-success',          label: 'Processed'   },
    Failed:        { bg: 'bg-error/15',    text: 'text-error',            label: 'Failed'      },
  };
  const cfg = cfgMap[refundStatus] || cfgMap.None;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
  );
}

// ─── CancelOrderSection ───────────────────────────────────────────────────────
/** Cancel button — only shown for Placed / Confirmed status and non-cancelled orders */
function CancelOrderSection({ order, dispatch, isLoading }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const status      = safeString(order.delivery?.status) || 'Placed';
  const isCancelled = order.cancellation?.isCancelled === true;
  const canCancel   = ['Placed', 'Confirmed'].includes(status) && !isCancelled;
  const orderId     = safeString(order._id || order.orderId);

  if (!canCancel) {
    return (
      <div className="w-full px-4 py-3 bg-base-300/30 border border-base-300 rounded-xl text-base-content/40 font-bold flex items-center justify-center gap-2 cursor-not-allowed text-sm">
        <Ban className="w-4 h-4" /> Cannot Cancel Order
        {status === 'Processing' && <span className="text-xs ml-1 font-normal">(Processing)</span>}
      </div>
    );
  }

  if (!showConfirm) {
    return (
      <motion.button type="button" onClick={() => setShowConfirm(true)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
        className="w-full px-4 py-3 bg-error/10 border border-error/30 rounded-xl text-error font-bold hover:bg-error/15 flex items-center justify-center gap-2 text-sm">
        <Ban className="w-4 h-4" /> Cancel Order
      </motion.button>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-error/5 border border-error/30 rounded-2xl space-y-3">
      <p className="text-sm font-black text-error">Confirm Cancellation</p>
      {/* Note: Optional — briefly state why you are cancelling (helps us improve) */}
      <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))}
        placeholder="Reason for cancellation (optional)" rows={2}
        className="w-full p-3 bg-base-100 border border-base-300 rounded-xl text-sm focus:outline-none focus:border-error resize-none" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setShowConfirm(false)} disabled={isLoading}
          className="flex-1 py-2.5 bg-base-300 rounded-xl font-bold text-sm hover:bg-base-400 disabled:opacity-50">
          Keep Order
        </button>
        <button type="button"
          onClick={() => dispatch(cancelOrder({ orderId, reason: reason || 'Customer requested cancellation' }))}
          disabled={isLoading}
          className="flex-1 py-2.5 bg-error text-white rounded-xl font-bold text-sm hover:bg-error/80 disabled:opacity-50 flex items-center justify-center gap-2">
          {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</> : <><Ban className="w-4 h-4" /> Yes, Cancel</>}
        </button>
      </div>
    </motion.div>
  );
}

// ─── FeedbackSection ──────────────────────────────────────────────────────────
/** Star rating + comment form — only shown for Delivered orders without prior feedback */
function FeedbackSection({ order, dispatch, isLoading }) {
  const [rating,  setRating]  = useState(0);
  const [comment, setComment] = useState('');
  const orderId        = safeString(order._id || order.orderId);
  const isDelivered    = safeString(order.delivery?.status) === 'Delivered';
  const existingRating = Number(order.customerFeedback?.rating || 0);

  if (!isDelivered) return null;

  if (existingRating > 0) {
    return (
      <div className="text-center py-3">
        <div className="flex items-center justify-center gap-1 mb-2">
          {[1,2,3,4,5].map((n) => (
            <Star key={n} className={`w-6 h-6 ${n <= existingRating ? 'text-warning fill-warning' : 'text-base-300'}`} />
          ))}
        </div>
        {order.customerFeedback?.comment && (
          <p className="text-xs text-base-content/60 mt-1 italic">"{order.customerFeedback.comment}"</p>
        )}
        <p className="text-xs text-base-content/40 mt-2">Thank you for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="text-center py-2">
      <p className="text-sm text-base-content/50 mb-3">Rate your experience</p>
      {/* Note: Tap a star to set your rating (1 = poor, 5 = excellent) */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {[1,2,3,4,5].map((n) => (
          <motion.button key={n} type="button" whileHover={{ scale: 1.2 }} onClick={() => setRating(n)} disabled={isLoading}>
            <Star className={`w-8 h-8 ${n <= rating ? 'text-warning fill-warning' : 'text-base-300 hover:text-warning/60'}`} />
          </motion.button>
        ))}
      </div>
      {rating > 0 && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          {/* Note: Optional — share any additional thoughts about your order */}
          <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="Share your experience (optional)" rows={2} disabled={isLoading}
            className="w-full p-2 bg-base-100 border border-base-300 rounded-lg text-sm focus:outline-none focus:border-warning disabled:opacity-50 resize-none" />
          <p className="text-xs text-base-content/40 text-right">{comment.length}/500</p>
          <button type="button"
            onClick={() => { dispatch(submitFeedback({ orderId, rating, comment })); setRating(0); setComment(''); }}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-primary/80 disabled:opacity-50">
            {isLoading ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─── DetailSkeleton ───────────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div className="space-y-4">
      {[128, 256, 192, 160].map((h, i) => (
        <div key={i} style={{ height: `${h}px` }} className="skeleton w-full rounded-2xl animate-pulse bg-base-300" />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function OrderDetails() {
  const dispatch       = useDispatch();
  const router         = useRouter();
  const params         = useParams();
  const orderId        = params?.orderId || params?.id;

  const order          = useSelector(selectCurrentOrder);
  const loading        = useSelector(selectPharmacyGlobalLoading);
  const actionLoading  = useSelector(selectPharmacyActionLoading);
  const invoiceLoading = useSelector(selectInvoiceLoading);
  const error          = useSelector(selectOrderError);
  const rxUploadLoading = useSelector(selectPrescriptionUploadLoading);

  useEffect(() => {
    if (orderId) dispatch(fetchOrderById(orderId));
    return () => {
      dispatch(clearCurrentOrder());
      dispatch(clearPharmacyErrors());
      dispatch(clearInvoiceData());
    };
  }, [orderId, dispatch]);

  /**
   * handlePrescriptionUpload
   * ─────────────────────────────────────────────────────────────────────────
   * Uses pharmacy slice thunks only:
   *   1. uploadPrescriptionFile({ file }) → CDN upload → returns { imageUrl }
   *   2. uploadOrderPrescription({ orderId, imageUrl }) → attaches to order
   */
  const handlePrescriptionUpload = async (file) => {
    try {
      const uploadResult = await dispatch(uploadPrescriptionFile({ file })).unwrap();
      const imageUrl = uploadResult?.imageUrl;
      if (!imageUrl) return;
      await dispatch(uploadOrderPrescription({ orderId, imageUrl })).unwrap();
      dispatch(clearPrescriptionUpload());
      dispatch(fetchOrderById(orderId));
    } catch { /* errors handled by thunks */ }
  };

  /** Download order invoice as an HTML file */
  const handleInvoiceDownload = async () => {
    try {
      const result = await dispatch(fetchOrderInvoice(order._id)).unwrap();
      if (result?.html) {
        const blob = new Blob([result.html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `Invoice_${safeString(order.orderId)}.html`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* handled by thunk */ }
  };

  // ── Loading state ──
  if (loading && !order) {
    return (
      <div className="min-h-screen bg-base-200 py-6 px-4">
        <div className="max-w-2xl mx-auto"><DetailSkeleton /></div>
      </div>
    );
  }

  // ── Error / not found state ──
  if (error || !order) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-3xl bg-error/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-error" />
          </div>
          <h2 className="font-black text-lg mb-1">Order not found</h2>
          <p className="text-sm text-base-content/40 mb-4">{error || 'Could not load this order.'}</p>
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/80">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const status            = safeString(order.delivery?.status) || 'Placed';
  const meta              = STATUS_META[status] || STATUS_META.Placed;
  const isCancelled       = order.cancellation?.isCancelled === true;
  const isDelivered       = status === 'Delivered';
  const isOutForDelivery  = status === 'Out-for-Delivery';
  const isReturnFlow      = RETURN_FLOW_STATUSES.has(status) || order.cancellation?.isReturnRequested === true;

  const orderId_safe      = safeString(order.orderId);
  const paymentMethod     = safeString(order.payment?.method) || 'COD';
  const paymentStatus     = safeString(order.payment?.status) || 'Pending';
  const razorpayOrderId   = safeString(order.payment?.razorpayOrderId);
  const razorpayPaymentId = safeString(order.payment?.razorpayPaymentId);
  const paidAt            = order.payment?.paidAt;

  const PaymentIcon = { Razorpay: CreditCard, Wallet, COD: Banknote }[paymentMethod] || Banknote;
  const StatusIcon  = STATUS_ICON_MAP[status] || PackageOpen;
  const statusLabel = STATUS_LABEL_MAP[status] || status;
  const storeData   = order.store && typeof order.store === 'object' ? order.store : null;
  const itemCount   = Array.isArray(order.items) ? order.items.length : 0;

  const rxStatus = order.prescription?.verificationStatus;
  const rxBadge  = rxStatus && rxStatus !== 'Not_Uploaded' ? {
    label: RX_STATUS_CFG[rxStatus]?.label || rxStatus,
    className: rxStatus === 'Approved' ? 'bg-success/10 text-success border-success/30'
      : rxStatus === 'Rejected' ? 'bg-error/10 text-error border-error/30'
      : 'bg-warning/10 text-warning border-warning/30',
  } : null;

  const trackingBadge = {
    label: statusLabel,
    className: isCancelled ? 'bg-error/10 text-error border-error/30'
      : isReturnFlow ? 'bg-warning/10 text-warning border-warning/30'
      : isDelivered  ? 'bg-success/10 text-success border-success/30'
      : `${meta.bg} ${meta.color}`,
  };

  const cancellation   = order.cancellation || {};
  const hasReturn      = cancellation.isReturnRequested === true;
  const returnDecision = safeString(cancellation.returnDecision);
  const refundStatus   = safeString(cancellation.refundStatus);
  const refundAmount   = Number(cancellation.refundAmount ?? 0);
  const selectedRefund = safeString(cancellation.selectedRefundMethod);
  const returnEvidence = Array.isArray(cancellation.returnEvidence) ? cancellation.returnEvidence : [];
  const hasBankDetails = cancellation.bankDetails?.accountHolderName;
  const adminNotesList = Array.isArray(order.adminNotes) ? order.adminNotes : [];

  const returnDecisionAccentClass = returnDecision === 'Accepted' ? 'bg-success' : returnDecision === 'Rejected' ? 'bg-error' : 'bg-warning';

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-base-200 py-4 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Top bar — back button + refresh */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between mb-5">
          <button type="button" onClick={() => router.back()}
            className="flex items-center gap-2 text-base-content/60 hover:text-primary group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-semibold">Back</span>
          </button>
          <button type="button" onClick={() => dispatch(fetchOrderById(orderId))} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-base-100 border border-base-300 rounded-xl text-xs font-semibold text-base-content/50 hover:border-primary hover:text-primary disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </motion.div>

        {/* Hero status card */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className={`relative rounded-3xl border border-base-300 overflow-hidden mb-4 bg-gradient-to-br ${meta.grad}`}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={`absolute -right-12 -top-12 w-40 h-40 rounded-full ${meta.bg} opacity-30`} />
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${meta.bg} opacity-20`} />
          </div>
          <div className="relative p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <motion.div
                  className={`w-11 h-11 rounded-2xl ${meta.bg} ${meta.color} flex items-center justify-center ring-4 ${meta.ring} shadow-lg relative overflow-hidden`}
                  animate={status === 'Processing' ? { rotate: 360 } : {}}
                  transition={{ duration: 3, repeat: status === 'Processing' ? Infinity : 0 }}>
                  <StatusIcon className="w-5 h-5" />
                </motion.div>
                <div>
                  <p className={`font-black text-base leading-tight ${meta.color}`}>{statusLabel}</p>
                  <p className="text-xs text-base-content/40">
                    {isDelivered ? `Delivered ${formatDate(order.delivery?.deliveredAt)}` : `Order placed ${formatDate(order.createdAt)}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {/* Note: Unique order reference number — use this when contacting support */}
                <span className="px-3 py-1.5 bg-base-100/60 backdrop-blur-sm rounded-xl text-xs font-mono font-bold text-base-content/70 border border-base-300/50">
                  {orderId_safe}
                </span>
                <p className="text-xs text-base-content/30">{formatDate(order.createdAt, true)}</p>
                {/* Invoice download button */}
                <button type="button" onClick={handleInvoiceDownload} disabled={invoiceLoading}
                  className="mt-2 flex items-center gap-1.5 bg-secondary px-3 py-1.5 rounded-lg hover:bg-secondary/80 text-white text-xs font-bold disabled:opacity-50">
                  {invoiceLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</> : <><Receipt className="w-3 h-3" /> Invoice</>}
                </button>
              </div>
            </div>

            {/* Status pills row */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${paymentStatus === 'Paid' ? 'bg-success/20 text-success border-success/30' : 'bg-warning/20 text-warning border-warning/30'}`}>
                <PaymentIcon className="w-3 h-3" />
                {paymentMethod} · {paymentStatus}
              </span>
              {order.prescription?.isRequired && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${rxStatus === 'Approved' ? 'bg-success/20 text-success border-success/30' : rxStatus === 'Rejected' ? 'bg-error/20 text-error border-error/30' : 'bg-warning/20 text-warning border-warning/30'}`}>
                  <FileText className="w-3 h-3" />
                  {/* Note: Rx = prescription; shows pharmacist verification status */}
                  Rx: {RX_STATUS_CFG[rxStatus]?.label || 'Required'}
                </span>
              )}
              {isReturnFlow && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-warning/20 text-warning border-warning/30">
                  <RotateCcw className="w-3 h-3" /> Return: {statusLabel}
                </span>
              )}
              {refundStatus && refundStatus !== 'None' && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${refundStatus === 'Processed' ? 'bg-success/20 text-success border-success/30' : refundStatus === 'Failed' ? 'bg-error/20 text-error border-error/30' : 'bg-info/20 text-info border-info/30'}`}>
                  <DollarSign className="w-3 h-3" /> Refund: {refundStatus}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="space-y-3">

          {/* Delivery OTP — shown when Out-for-Delivery */}
          {isOutForDelivery && (
            <DeliveryOtpSection order={order} orderId={orderId} dispatch={dispatch} isLoading={actionLoading} />
          )}

          {/* Order Tracking timeline */}
          <Section title="Order Tracking" icon={isReturnFlow ? RotateCcw : Truck}
            accentClass={isReturnFlow ? 'bg-warning' : 'bg-primary'} badge={trackingBadge}>
            <div className="pt-3"><TrackingTimeline order={order} /></div>
          </Section>

          {/* Items list */}
          <Section title={`Items (${itemCount})`} icon={Pill} accentClass="bg-secondary">
            <div className="space-y-2.5">
              {(order.items || []).map((item, i) => (
                <ItemRow key={safeString(item._id || i)} item={item} index={i} />
              ))}
            </div>
          </Section>

          {/* Prescription section — only when Rx required */}
          {order.prescription?.isRequired && (
            <Section title="Prescription" icon={FileText}
              accentClass={rxStatus === 'Approved' ? 'bg-success' : rxStatus === 'Rejected' ? 'bg-error' : 'bg-warning'}
              defaultOpen={['Rejected', 'Not_Uploaded'].includes(rxStatus)} badge={rxBadge}>
              <PrescriptionSection order={order} orderId={orderId}
                isUploading={rxUploadLoading} actionLoading={actionLoading}
                onUpload={handlePrescriptionUpload} />
            </Section>
          )}

          {/* Bill summary */}
          <Section title="Bill Summary" icon={CreditCard} accentClass="bg-accent">
            <BillingBreakdown billing={order.billing} />
          </Section>

          {/* Store details */}
          {storeData && (
            <Section title="Store Details" icon={Building2} defaultOpen={false}>
              <StoreInfo store={storeData} />
            </Section>
          )}

          {/* Delivery address */}
          <Section title="Delivery Address" icon={MapPin} defaultOpen={false}>
            {order.delivery?.address ? (
              <div className="p-3 bg-base-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Home className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    {order.delivery.address.fullName && <p className="font-bold text-sm mb-0.5">{safeString(order.delivery.address.fullName)}</p>}
                    <p className="text-sm text-base-content/70">{safeString(order.delivery.address.line1)}</p>
                    {order.delivery.address.landmark && <p className="text-sm text-base-content/50">Near: {safeString(order.delivery.address.landmark)}</p>}
                    <p className="text-sm text-base-content/70">
                      {safeString(order.delivery.address.city)}{order.delivery.address.state ? `, ${safeString(order.delivery.address.state)}` : ''} — {safeString(order.delivery.address.pincode)}
                    </p>
                    {order.delivery.address.phone && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-base-content/50">
                        <Phone className="w-3.5 h-3.5" /> {safeString(order.delivery.address.phone)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-base-content/40 text-center py-3">No address available</p>
            )}
          </Section>

          {/* Payment details */}
          <Section title="Payment Details" icon={CreditCard} defaultOpen={false}>
            <div className="space-y-0">
              {/* Note: How the customer paid for this order */}
              <InfoRow label="Method"  value={paymentMethod} />
              <InfoRow label="Status"  value={<span className={paymentStatus === 'Paid' ? 'font-bold text-success' : 'font-bold text-warning'}>{paymentStatus}</span>} />
              {paidAt            && <InfoRow label="Paid At"           value={formatDate(paidAt, true)} />}
              {razorpayOrderId   && <InfoRow label="Razorpay Order ID" value={razorpayOrderId}   copyable />}
              {razorpayPaymentId && <InfoRow label="Payment ID"        value={razorpayPaymentId} copyable />}
            </div>
          </Section>

          {/* Return request detail — shown when return has been submitted */}
          {hasReturn && (
            <Section title="Return Request" icon={RotateCcw} accentClass={returnDecisionAccentClass} defaultOpen
              badge={{ label: returnDecision || 'Pending', className: returnDecision === 'Accepted' ? 'bg-success/10 text-success border-success/30' : returnDecision === 'Rejected' ? 'bg-error/10 text-error border-error/30' : 'bg-warning/10 text-warning border-warning/30' }}>
              <div className="space-y-3 pt-1">
                {cancellation.returnReason && (
                  <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-warning/70 mb-1">Return Reason</p>
                    <p className="text-sm text-base-content/70">{safeString(cancellation.returnReason)}</p>
                  </div>
                )}
                <div className="space-y-0">
                  {cancellation.returnRequestedAt && <InfoRow label="Requested At" value={formatDate(cancellation.returnRequestedAt, true)} />}
                  {returnDecision && (
                    <InfoRow label="Store Decision" value={
                      <span className={returnDecision === 'Accepted' ? 'font-bold text-success' : returnDecision === 'Rejected' ? 'font-bold text-error' : 'font-bold text-warning'}>{returnDecision}</span>
                    } />
                  )}
                  {cancellation.returnDecisionAt && <InfoRow label="Decision At" value={formatDate(cancellation.returnDecisionAt, true)} />}
                </div>
                {cancellation.returnDecisionNote && (
                  <div className="p-3 bg-base-200 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-base-content/40 mb-1">Store Note</p>
                    <p className="text-xs text-base-content/60">{safeString(cancellation.returnDecisionNote)}</p>
                  </div>
                )}
                <ReturnEvidenceDisplay evidence={returnEvidence} />
                {cancellation.pickupVerifiedAt && (
                  <div className="p-3 bg-base-200 rounded-xl space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-base-content/40 mb-1">Pickup Verification</p>
                    <InfoRow label="Condition" value={
                      <span className={cancellation.pickupConditionGood ? 'font-bold text-success' : 'font-bold text-error'}>
                        {cancellation.pickupConditionGood ? '✓ Good' : '✗ Issue Found'}
                      </span>
                    } />
                    {cancellation.pickupConditionNotes && <p className="text-xs text-base-content/60 pt-1">{safeString(cancellation.pickupConditionNotes)}</p>}
                    <InfoRow label="Verified At" value={formatDate(cancellation.pickupVerifiedAt, true)} />
                  </div>
                )}
                {refundStatus && refundStatus !== 'None' && (
                  <div className="p-3 bg-base-200 rounded-xl space-y-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-base-content/40 mb-2">Refund Details</p>
                    <div className="flex items-center justify-between py-1.5 border-b border-base-300/40">
                      <span className="text-xs text-base-content/45">Status</span>
                      <RefundStatusBadge refundStatus={refundStatus} />
                    </div>
                    {refundAmount > 0 && <InfoRow label="Refund Amount" value={<span className="font-black text-success">{formatCurrency(refundAmount)}</span>} />}
                    {selectedRefund && <InfoRow label="Refund Method" value={selectedRefund} />}
                    {cancellation.refundInitiatedAt && <InfoRow label="Initiated At" value={formatDate(cancellation.refundInitiatedAt, true)} />}
                    {cancellation.refundedAt && <InfoRow label="Processed At" value={formatDate(cancellation.refundedAt, true)} />}
                  </div>
                )}
                {hasBankDetails && (
                  <div className="p-3 bg-base-200 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-base-content/40 mb-2">Bank Account Provided</p>
                    <div className="space-y-0">
                      <InfoRow label="Holder Name" value={safeString(cancellation.bankDetails.accountHolderName)} />
                      <InfoRow label="Bank"        value={safeString(cancellation.bankDetails.bankName)} />
                      {cancellation.bankDetails.branchName && <InfoRow label="Branch" value={safeString(cancellation.bankDetails.branchName)} />}
                      {/* Note: Only last 4 digits shown for security */}
                      <InfoRow label="Account No." value={`****${safeString(cancellation.bankDetails.accountNumber).slice(-4)}`} />
                      <InfoRow label="IFSC Code"   value={safeString(cancellation.bankDetails.ifscCode)} copyable />
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Cancellation info */}
          {isCancelled && (
            <Section title="Cancellation" icon={XCircle} accentClass="bg-error" defaultOpen>
              <div className="space-y-2 pt-1">
                {cancellation.reason && (
                  <div className="p-3 bg-error/5 border border-error/20 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-wider text-error/70 mb-1">Reason</p>
                    <p className="text-sm text-base-content/70">{safeString(cancellation.reason)}</p>
                  </div>
                )}
                {cancellation.cancelledAt && <InfoRow label="Cancelled At" value={formatDate(cancellation.cancelledAt, true)} />}
                {refundStatus && refundStatus !== 'None' && (
                  <div className="flex items-center justify-between py-1.5 border-b border-base-300/40">
                    <span className="text-xs text-base-content/45">Refund Status</span>
                    <RefundStatusBadge refundStatus={refundStatus} />
                  </div>
                )}
                {refundAmount > 0 && <InfoRow label="Refund Amount" value={<span className="font-black text-success">{formatCurrency(refundAmount)}</span>} />}
                {cancellation.refundMethod && cancellation.refundMethod !== 'None' && <InfoRow label="Refund Method" value={safeString(cancellation.refundMethod)} />}
                {cancellation.refundedAt && <InfoRow label="Refunded At" value={formatDate(cancellation.refundedAt, true)} />}
              </div>
            </Section>
          )}

          {/* Admin notes — each note is { text, addedBy, addedAt } */}
          {adminNotesList.length > 0 && (
            <Section title="Notes" icon={StickyNote} defaultOpen={false}>
              <div className="space-y-2 pt-1">
                {adminNotesList.map((note, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3.5 rounded-xl bg-base-200 border border-base-300">
                    <StickyNote className="w-4 h-4 text-base-content/40 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-base-content/70">{safeString(note.text)}</p>
                      {/* Note: When this note was added by the pharmacist or admin */}
                      {note.addedAt && <p className="text-[10px] text-base-content/30 mt-1">{formatDate(note.addedAt, true)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Feedback — only for Delivered orders */}
          {isDelivered && (
            <Section title="Rate Your Order" icon={Star} defaultOpen={false}>
              <FeedbackSection order={order} dispatch={dispatch} isLoading={actionLoading} />
            </Section>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            <CancelOrderSection order={order} dispatch={dispatch} isLoading={actionLoading} />
            <ReturnOrderSection order={order} dispatch={dispatch} isLoading={actionLoading} />
          </div>

        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}