'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
  Download, ExternalLink, IndianRupee, Boxes, Timer,
} from 'lucide-react';
import Link from 'next/link';

// ── Redux ─────────────────────────────────────────────────────────────────────
import {
  fetchOrderById,
  fetchOrderInvoice,
  downloadOrderInvoice,
  selectCurrentOrder,
  selectPharmacyGlobalLoading,
  selectOrderError,
  selectInvoiceLoading,
  selectPrescriptionUploadLoading,
  selectPharmacyActionLoading,
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
} from '@/store/slices/pharmacyOrderSlice';

import { uploadSingleFile } from '@/store/slices/uploadSlice';

// ═══════════════════════════════════════════════════════════════════════════════
// § CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const FORWARD_STEPS = [
  { key: 'Placed',            label: 'Order Placed',    icon: PackageOpen,   desc: 'Order received' },
  { key: 'Confirmed',         label: 'Confirmed',       icon: BadgeCheck,    desc: 'Store confirmed' },
  { key: 'Processing',        label: 'Processing',      icon: RotateCcw,     desc: 'Being packed' },
  { key: 'Out-for-Delivery',  label: 'Out for Delivery',icon: Truck,         desc: 'On the way' },
  { key: 'Delivered',         label: 'Delivered',       icon: CheckCircle2,  desc: 'Delivered' },
];

const RETURN_STEPS = [
  { key: 'Delivered',         label: 'Delivered',       icon: CheckCircle2,   desc: 'Order delivered' },
  { key: 'Return_Requested',  label: 'Return Requested',icon: Undo2,          desc: 'Return raised' },
  { key: 'Return_Accepted',   label: 'Return Accepted', icon: ClipboardCheck, desc: 'Store accepted' },
  { key: 'Pickup_Assigned',   label: 'Pickup Assigned', icon: Bike,           desc: 'Pickup assigned' },
  { key: 'Pickup_Done',       label: 'Pickup Done',     icon: PackageCheck,   desc: 'Items collected' },
  { key: 'Returned',          label: 'Returned',        icon: ArrowLeftRight, desc: 'Return complete' },
];

const RETURN_FLOW_STATUSES = new Set([
  'Return_Requested', 'Return_Accepted', 'Return_Rejected',
  'Pickup_Assigned', 'Pickup_Done', 'Returned',
]);

const STATUS_LABEL_MAP = {
  Placed: 'Order Placed', Confirmed: 'Confirmed', Processing: 'Processing',
  'Out-for-Delivery': 'Out for Delivery', Delivered: 'Delivered',
  Cancelled: 'Cancelled', Return_Requested: 'Return Requested',
  Return_Accepted: 'Return Accepted', Return_Rejected: 'Return Rejected',
  Pickup_Assigned: 'Pickup Assigned', Pickup_Done: 'Pickup Done', Returned: 'Returned',
};

// Colour palette strictly from CSS design tokens (no hex/arbitrary)
const STATUS_META = {
  Placed:            { color: 'text-info',    bg: 'bg-info\/10',    ring: 'ring-2 ring-info\/30',    dot: 'bg-info'    },
  Confirmed:         { color: 'text-primary', bg: 'bg-primary\/10', ring: 'ring-2 ring-primary\/30', dot: 'bg-primary' },
  Processing:        { color: 'text-warning', bg: 'bg-warning\/10', ring: 'ring-2 ring-warning\/30', dot: 'bg-warning' },
  'Out-for-Delivery':{ color: 'text-accent',  bg: 'bg-accent\/10',  ring: 'ring-2 ring-accent\/30',  dot: 'bg-accent'  },
  Delivered:         { color: 'text-success', bg: 'bg-success\/10', ring: 'ring-2 ring-success\/30', dot: 'bg-success' },
  Cancelled:         { color: 'text-error',   bg: 'bg-error\/10',   ring: 'ring-2 ring-error\/30',   dot: 'bg-error'   },
  Return_Requested:  { color: 'text-warning', bg: 'bg-warning\/10', ring: 'ring-2 ring-warning\/30', dot: 'bg-warning' },
  Return_Accepted:   { color: 'text-info',    bg: 'bg-info\/10',    ring: 'ring-2 ring-info\/30',    dot: 'bg-info'    },
  Return_Rejected:   { color: 'text-error',   bg: 'bg-error\/10',   ring: 'ring-2 ring-error\/30',   dot: 'bg-error'   },
  Pickup_Assigned:   { color: 'text-accent',  bg: 'bg-accent\/10',  ring: 'ring-2 ring-accent\/30',  dot: 'bg-accent'  },
  Pickup_Done:       { color: 'text-primary', bg: 'bg-primary\/10', ring: 'ring-2 ring-primary\/30', dot: 'bg-primary' },
  Returned:          { color: 'text-success', bg: 'bg-success\/10', ring: 'ring-2 ring-success\/30', dot: 'bg-success' },
};

const STATUS_ICON_MAP = {
  Placed: PackageOpen, Confirmed: BadgeCheck, Processing: RotateCcw,
  'Out-for-Delivery': Truck, Delivered: CheckCircle2, Cancelled: XCircle,
  Return_Requested: Undo2, Return_Accepted: ClipboardCheck,
  Return_Rejected: XCircle, Pickup_Assigned: Bike,
  Pickup_Done: PackageCheck, Returned: ArrowLeftRight,
};

const RX_STATUS_CFG = {
  Not_Uploaded: { colorClass: 'text-base-content\/50', bgClass: 'bg-base-200', borderClass: 'border-base-300', icon: FileImage, label: 'Not Uploaded' },
  Pending:      { colorClass: 'text-warning',           bgClass: 'bg-warning\/10', borderClass: 'border-warning\/30', icon: Clock,       label: 'Pending Review' },
  Approved:     { colorClass: 'text-success',           bgClass: 'bg-success\/10', borderClass: 'border-success\/30', icon: ShieldCheck, label: 'Approved' },
  Rejected:     { colorClass: 'text-error',             bgClass: 'bg-error\/10',   borderClass: 'border-error\/30',   icon: ShieldX,     label: 'Rejected' },
};

const REFUND_METHODS = [
  { value: 'Wallet',        label: 'Wallet',             icon: Wallet,    desc: 'Instant to Likeson wallet' },
  { value: 'Online',        label: 'Online / UPI',       icon: Zap,       desc: 'Back to original source' },
  { value: 'Bank_Transfer', label: 'Bank Transfer',      icon: Landmark,  desc: '2–5 working days' },
  { value: 'Custom_Bank',   label: 'Other Bank Account', icon: Building2, desc: 'Different bank account' },
];

const PAYMENT_ICONS = { Razorpay: CreditCard, Wallet: Wallet, COD: Banknote };

// ═══════════════════════════════════════════════════════════════════════════════
// § UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const fmt = (date, time = false) => {
  if (!date) return '—';
  try {
    const d = new Date(date);
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    if (time) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    return d.toLocaleDateString('en-IN', opts);
  } catch { return '—'; }
};

const fmtCurrency = (n) => {
  const v = Number(n ?? 0);
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const str = (v) => {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
};

const isPdf = (url) => typeof url === 'string' && url.toLowerCase().includes('.pdf');

const getStatusTs = (history = [], key) => {
  const matches = history.filter((h) => h.status === key);
  return matches.length ? matches[matches.length - 1].timestamp : null;
};

function useCopy() {
  const [key, setKey] = useState('');
  const copy = useCallback((val, k) => {
    navigator.clipboard.writeText(str(val)).catch(() => {});
    setKey(k);
    setTimeout(() => setKey(''), 1600);
  }, []);
  return { copy, copiedKey: key };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § PRIMITIVE: InfoRow
// ═══════════════════════════════════════════════════════════════════════════════

function InfoRow({ label, value, copyable = false }) {
  const { copy, copiedKey } = useCopy();
  return (
    <div className="flex items-center justify-between py-2 border-b border-base-300 last:border-0 gap-2">
      <span className="text-xs font-medium text-base-content/50 shrink-0">{label}</span>
      {copyable ? (
        <button
          type="button"
          onClick={() => copy(value, label)}
          className="flex items-center gap-1.5 text-xs font-bold text-primary max-w-[60%]"
        >
          {copiedKey === label ? (
            <><BadgeCheck className="w-3.5 h-3.5 text-success" /><span className="text-success">Copied</span></>
          ) : (
            <><Copy className="w-3.5 h-3.5" /><span className="truncate">{str(value).slice(-18)}</span></>
          )}
        </button>
      ) : (
        <span className="text-xs font-bold text-base-content text-right">{value}</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § PRIMITIVE: Section (collapsible card)
// ═══════════════════════════════════════════════════════════════════════════════

function Section({ title, icon: Icon, children, defaultOpen = true, iconBgClass = 'bg-primary\/10', iconColorClass = 'text-primary', badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-base-200 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBgClass}`}>
            <Icon className={`w-4 h-4 ${iconColorClass}`} />
          </div>
          <span className="font-bold text-sm text-base-content">{title}</span>
          {badge && (
            <span className={`text-xs font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-base-content/30 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-base-content/30 shrink-0" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § TrackingTimeline
// ═══════════════════════════════════════════════════════════════════════════════

function TrackingTimeline({ order }) {
  const currentStatus = str(order.delivery?.status) || 'Placed';
  const history       = order.delivery?.statusHistory || [];
  const isCancelled   = order.cancellation?.isCancelled === true;
  const isReturnFlow  = RETURN_FLOW_STATUSES.has(currentStatus) || order.cancellation?.isReturnRequested;
  const isRejected    = currentStatus === 'Return_Rejected';
  const meta          = STATUS_META[currentStatus] || STATUS_META.Placed;
  const steps         = isReturnFlow ? RETURN_STEPS : FORWARD_STEPS;
  const currentIdx    = steps.findIndex((s) => s.key === currentStatus);
  const effectiveIdx  = currentIdx === -1 ? 0 : currentIdx;

  return (
    <div className="space-y-1">
      {/* Cancellation banner */}
      {isCancelled && (
        <div className="flex items-start gap-3 p-4 mb-4 rounded-xl bg-error\/10 border border-error\/30">
          <XCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-black text-sm text-error">Order Cancelled</p>
            {order.cancellation?.cancelledAt && (
              <p className="text-xs text-base-content/50 mt-0.5">{fmt(order.cancellation.cancelledAt, true)}</p>
            )}
            {order.cancellation?.reason && (
              <p className="text-xs text-base-content/60 mt-1 italic">"{str(order.cancellation.reason)}"</p>
            )}
          </div>
        </div>
      )}

      {/* Return rejected banner */}
      {isRejected && !isCancelled && (
        <div className="flex items-start gap-3 p-4 mb-4 rounded-xl bg-error\/10 border border-error\/30">
          <XCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-sm text-error">Return Rejected</p>
            {order.cancellation?.returnDecisionNote && (
              <p className="text-xs text-base-content/60 mt-1">{str(order.cancellation.returnDecisionNote)}</p>
            )}
          </div>
        </div>
      )}

      {/* Estimated arrival */}
      {order.delivery?.estimatedArrival && !['Delivered', 'Cancelled'].includes(currentStatus) && (
        <div className="flex items-center gap-2 p-3 mb-3 rounded-xl bg-info\/10 border border-info\/20">
          <Timer className="w-4 h-4 text-info shrink-0" />
          <p className="text-xs font-bold text-info">
            Estimated arrival: {fmt(order.delivery.estimatedArrival, true)}
          </p>
        </div>
      )}

      {/* Steps */}
      {!isCancelled && !isRejected && steps.map((step, i) => {
        const done    = i < effectiveIdx;
        const current = i === effectiveIdx;
        const future  = i > effectiveIdx;
        const Icon    = step.icon;
        const ts      = getStatusTs(history, step.key);

        return (
          <div key={step.key} className="flex gap-3">
            {/* Icon + connector */}
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.07, type: 'spring', stiffness: 260, damping: 22 }}
                className={`relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  current
                    ? `${meta.bg} ${meta.color} ${meta.ring}`
                    : done
                    ? 'bg-success\/10 text-success ring-2 ring-success\/25'
                    : 'bg-base-300 text-base-content/25'
                }`}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                {current && (
                  <motion.span
                    className={`absolute inset-0 rounded-full ${meta.bg}`}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2.2, repeat: Infinity }}
                  />
                )}
              </motion.div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-6 my-1 rounded-full ${done ? 'bg-success\/40' : 'bg-base-300'}`} />
              )}
            </div>

            {/* Label */}
            <div className="pb-5 pt-1.5 flex-1 min-w-0">
              <p className={`font-bold text-sm ${current ? meta.color : done ? 'text-success' : 'text-base-content/30'}`}>
                {step.label}
              </p>
              <p className={`text-xs mt-0.5 ${future ? 'text-base-content/20' : 'text-base-content/50'}`}>
                {(done || current) && ts ? fmt(ts, true) : step.desc}
              </p>
            </div>
          </div>
        );
      })}

      {/* Full history */}
      {history.length > 0 && (
        <div className="pt-4 mt-2 border-t border-base-300">
          <p className="text-xs font-black uppercase tracking-widest text-base-content/30 mb-3">Full History</p>
          <div className="space-y-2">
            {[...history].reverse().map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-base-content/70">
                  {STATUS_LABEL_MAP[h.status] || str(h.status)}
                </span>
                <span className="text-xs text-base-content/35 shrink-0">{fmt(h.timestamp, true)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § ItemRow
// ═══════════════════════════════════════════════════════════════════════════════

function ItemRow({ item, index }) {
  const name       = str(item.name || item.medicine?.brandName || 'Medicine');
  const qty        = Number(item.quantity) || 1;
  const unitPrice  = Number(item.pricePerUnit) || 0;
  const taxAmt     = Number(item.taxAmount) || 0;
  const total      = Number(item.totalPrice) || 0;
  const img        = str(item.medicineImage || '');
  const generic    = str(item.genericName || '');
  const isValidImg = img && img.startsWith('http');
  const hsnCode    = str(item.hsnCode || '');

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-start gap-3 p-3.5 bg-base-200 rounded-2xl border border-base-300"
    >
      {/* Image */}
      <div className="w-12 h-12 rounded-xl bg-primary\/10 flex items-center justify-center shrink-0 overflow-hidden border border-base-300">
        {isValidImg
          ? <img src={img} alt={name} className="w-full h-full object-cover" loading="lazy" />
          : <Pill className="w-6 h-6 text-primary" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-sm text-base-content truncate">{name}</p>
            {generic && (
              <span className="inline-block badge badge-primary badge-xs mt-0.5">{generic}</span>
            )}
          </div>
          <span className="font-black text-sm text-base-content shrink-0">{fmtCurrency(total)}</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
          <span className="text-xs text-base-content/50">Qty: {qty}</span>
          <span className="text-xs text-base-content/50">@ {fmtCurrency(unitPrice)}</span>
          {taxAmt > 0 && <span className="text-xs text-base-content/40">+{fmtCurrency(taxAmt)} GST</span>}
          {item.gstPercentage > 0 && (
            <span className="text-xs text-base-content/40">GST: {item.gstPercentage}%</span>
          )}
          {hsnCode && <span className="text-xs text-base-content/30">HSN: {hsnCode}</span>}
          {item.isPrescriptionRequired && (
            <span className="text-xs text-warning font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Rx Required
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § BillingBreakdown — full pricing detail from billing object
// ═══════════════════════════════════════════════════════════════════════════════

function BillingBreakdown({ billing }) {
  if (!billing) return null;

  const rows = [
    { label: 'Subtotal (MRP)',       value: billing.subTotal,        show: true },
    { label: 'GST (inclusive)',      value: billing.gstAmount,       show: Number(billing.gstAmount) > 0 },
    { label: 'Delivery Charges',     value: billing.deliveryCharges, show: true },
    { label: 'Platform Fee',         value: billing.platformFee,     show: Number(billing.platformFee) > 0 },
  ];

  return (
    <div className="space-y-0">
      {rows.filter((r) => r.show).map((row, i) => (
        <motion.div
          key={row.label}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center justify-between py-2 border-b border-base-300 last:border-0"
        >
          <span className="text-sm text-base-content/55">{row.label}</span>
          <span className="text-sm font-semibold text-base-content">{fmtCurrency(row.value)}</span>
        </motion.div>
      ))}

      {/* Coupon discount */}
      {Number(billing.discountAmount) > 0 && (
        <div className="flex items-center justify-between py-2 border-b border-base-300">
          <span className="text-sm text-success flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Discount {billing.promoCode ? `(${billing.promoCode})` : ''}
          </span>
          <span className="text-sm font-bold text-success">-{fmtCurrency(billing.discountAmount)}</span>
        </div>
      )}

      {/* Wallet used */}
      {Number(billing.walletAmountUsed) > 0 && (
        <div className="flex items-center justify-between py-2 border-b border-base-300">
          <span className="text-sm text-info flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" /> Wallet Used
          </span>
          <span className="text-sm font-bold text-info">-{fmtCurrency(billing.walletAmountUsed)}</span>
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between pt-3 mt-1">
        <span className="font-black text-base text-base-content">Total Paid</span>
        <span className="font-black text-xl text-primary">{fmtCurrency(billing.totalPayable)}</span>
      </div>

      {/* Delivery free note */}
      {Number(billing.deliveryCharges) === 0 && (
        <p className="text-xs text-success font-medium flex items-center gap-1 mt-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Free delivery applied
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § StoreInfo
// ═══════════════════════════════════════════════════════════════════════════════

function StoreInfo({ store }) {
  if (!store) return null;
  const addr = store.address;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-3.5 bg-base-200 rounded-xl border border-base-300">
        <div className="w-10 h-10 rounded-xl bg-secondary\/10 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-secondary" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-base-content">{str(store.storeName)}</p>
          {store.storeType && (
            <span className="badge badge-xs badge-secondary mt-0.5">{str(store.storeType)}</span>
          )}
        </div>
      </div>
      {addr && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 text-base-content/30 mt-0.5 shrink-0" />
          <p className="text-base-content/65 text-xs">
            {[str(addr.line1), addr.landmark && `Near ${str(addr.landmark)}`, str(addr.city), str(addr.pincode)].filter(Boolean).join(', ')}
          </p>
        </div>
      )}
      {store.contact?.phone && (
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-base-content/30 shrink-0" />
          <span className="text-xs text-base-content/65">{str(store.contact.phone)}</span>
        </div>
      )}
      {store.contact?.email && (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-base-content/30 shrink-0" />
          <span className="text-xs text-base-content/65">{str(store.contact.email)}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § PrescriptionSection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upload flow:
 *   file selected → local preview
 *   submit → dispatch(uploadPrescriptionFile({ file })) → { imageUrl }
 *          → dispatch(uploadOrderPrescription({ orderId, imageUrl }))
 *          → refetch order
 */
function PrescriptionSection({ order, orderId, isUploading, actionLoading, onUpload }) {
  const rx = order?.prescription;
  const fileRef = useRef(null);
  const [file,       setFile]       = useState(null);
  const [preview,    setPreview]    = useState(null);
  const [formOpen,   setFormOpen]   = useState(false);
  const [imgVisible, setImgVisible] = useState(false);

  if (!rx?.isRequired) return null;

  const rxStatus = rx.verificationStatus || 'Not_Uploaded';
  const cfg      = RX_STATUS_CFG[rxStatus] || RX_STATUS_CFG.Not_Uploaded;
  const RxIcon   = cfg.icon;
  const canUpload = ['Not_Uploaded', 'Rejected', 'Pending'].includes(rxStatus);
  const blocked   = ['Out-for-Delivery', 'Delivered', 'Cancelled'].includes(str(order.delivery?.status));

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(f.type)) { alert('JPG, PNG, WebP or PDF only.'); return; }
    if (f.size > 5 * 1024 * 1024) { alert('Max 5 MB.'); return; }
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  };

  const onSubmit = () => {
    if (!file) return;
    onUpload(file);
    setFile(null); setPreview(null); setFormOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${cfg.bgClass} ${cfg.borderClass}`}>
        <RxIcon className={`w-5 h-5 shrink-0 ${cfg.colorClass}`} />
        <div className="flex-1 min-w-0">
          <p className={`font-black text-sm ${cfg.colorClass}`}>{cfg.label}</p>
          {rx.uploadedAt && (
            <p className="text-xs text-base-content/40 mt-0.5">Uploaded: {fmt(rx.uploadedAt, true)}</p>
          )}
          {rx.verifiedAt && (
            <p className="text-xs text-base-content/40">
              Reviewed: {fmt(rx.verifiedAt, true)}{rx.verifiedBy?.name ? ` by ${str(rx.verifiedBy.name)}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {rxStatus === 'Rejected' && rx.rejectionReason && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-error\/5 border border-error\/20">
          <ShieldX className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-error uppercase tracking-wider mb-1">Rejection Reason</p>
            <p className="text-sm text-error/80">{str(rx.rejectionReason)}</p>
          </div>
        </div>
      )}

      {/* Pharmacist notes */}
      {rx.verificationNotes && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-info\/5 border border-info\/20">
          <StickyNote className="w-4 h-4 text-info shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-info uppercase tracking-wider mb-1">Pharmacist Notes</p>
            <p className="text-sm text-info/80">{str(rx.verificationNotes)}</p>
          </div>
        </div>
      )}

      {/* View existing image */}
      {rx.imageUrl && (
        <>
          <button
            type="button"
            onClick={() => setImgVisible((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-base-200 border border-base-300 text-sm font-bold hover:bg-base-300 transition-colors"
          >
            <span className="flex items-center gap-2 text-primary">
              <Eye className="w-4 h-4" />{imgVisible ? 'Hide' : 'View'} Prescription
            </span>
            {imgVisible ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {imgVisible && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl overflow-hidden border border-base-300 bg-base-200">
                  {isPdf(rx.imageUrl) ? (
                    <div className="p-6 text-center">
                      <FileText className="w-10 h-10 text-error mx-auto mb-2" />
                      <p className="text-xs font-bold text-base-content/50 mb-2">PDF Prescription</p>
                      <a href={rx.imageUrl} target="_blank" rel="noreferrer" className="text-xs text-primary font-bold underline flex items-center gap-1 justify-center">
                        <ExternalLink className="w-3.5 h-3.5" /> Open PDF
                      </a>
                    </div>
                  ) : (
                    <img src={rx.imageUrl} alt="Prescription" className="w-full max-h-64 object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  <div className="px-3 py-2 border-t border-base-300">
                    <a href={rx.imageUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-primary font-bold underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Full Image
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Upload button / form */}
      {canUpload && !blocked && (
        <>
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                rxStatus === 'Rejected'
                  ? 'border-error/40 text-error hover:bg-error\/5 bg-error\/5'
                  : 'border-primary/30 text-primary hover:bg-primary\/5'
              }`}
              style={{ borderStyle: 'dashed' }}
            >
              <Upload className="w-4 h-4" />
              {rxStatus === 'Rejected' ? 'Re-Upload Prescription' : rx.imageUrl ? 'Replace Prescription' : 'Upload Prescription'}
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-3"
            >
              <p className="text-xs font-black uppercase tracking-widest text-base-content/40">
                {rx.imageUrl ? 'Upload New Prescription' : 'Upload Prescription'}
              </p>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className={`cursor-pointer rounded-xl p-5 text-center transition-all border-2 ${
                  file ? 'border-success/50 bg-success\/5' : 'border-base-300 hover:border-primary/50 hover:bg-primary\/5'
                }`}
                style={{ borderStyle: 'dashed' }}
              >
                <input ref={fileRef} type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                  onChange={onFileChange} className="hidden" />
                {preview ? (
                  <div className="space-y-2">
                    <img src={preview} alt="Preview"
                      className="mx-auto max-h-28 rounded-lg object-contain border border-base-300" />
                    <p className="text-xs font-bold text-success flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {file?.name}
                    </p>
                    <p className="text-xs text-base-content/35">Click to change</p>
                  </div>
                ) : file ? (
                  <div className="space-y-2">
                    <FileImage className="w-8 h-8 text-success mx-auto" />
                    <p className="text-xs font-bold text-success">{file.name}</p>
                    <p className="text-xs text-base-content/35">Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Upload className="w-8 h-8 text-base-content/20 mx-auto" />
                    <p className="text-xs font-bold text-base-content/45">Click to upload</p>
                    <p className="text-xs text-base-content/30">JPG, PNG, WebP or PDF · Max 5 MB</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setFormOpen(false); setFile(null); setPreview(null); }}
                  disabled={isUploading || actionLoading}
                  className="btn flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!file || isUploading || actionLoading}
                  className="btn btn-primary flex-1"
                >
                  {(isUploading || actionLoading)
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                    : <><Upload className="w-4 h-4" /> Submit</>}
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}

      {blocked && rxStatus !== 'Approved' && (
        <p className="text-center text-xs text-base-content/30 font-bold uppercase tracking-wider py-1">
          Upload not available at this stage
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § EvidenceUploader
// ═══════════════════════════════════════════════════════════════════════════════

function EvidenceUploader({ evidence, onEvidenceChange, dispatch }) {
  const fileRef = useRef(null);
  const [uploadingIdx, setUploadingIdx] = useState(null);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImg = f.type.startsWith('image/');
    const isVid = f.type.startsWith('video/');
    if (!isImg && !isVid) { alert('Images or videos only.'); return; }
    if (f.size > 20 * 1024 * 1024) { alert('Max 20 MB.'); return; }
    const mediaType = isImg ? 'image' : 'video';
    setUploadingIdx(evidence.length);
    try {
      const result = await dispatch(uploadSingleFile({ file: f, folder: 'return-evidence' })).unwrap();
      if (result?.url) onEvidenceChange([...evidence, { mediaType, url: result.url }]);
    } catch { /* toast from slice */ }
    finally { setUploadingIdx(null); e.target.value = ''; }
  };

  const remove = (i) => onEvidenceChange(evidence.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-base-content/40">
          Evidence ({evidence.length}/5)
        </p>
        <p className="text-xs text-base-content/30">Min 1 required</p>
      </div>

      {evidence.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {evidence.map((item, i) => (
            <div key={i}
              className="relative group rounded-xl overflow-hidden border border-base-300 bg-base-200 aspect-square"
            >
              {item.mediaType === 'image'
                ? <img src={item.url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                    <Video className="w-6 h-6 text-primary" />
                    <p className="text-xs font-bold text-base-content/45">Video {i + 1}</p>
                    <a href={item.url} target="_blank" rel="noreferrer"
                      className="text-xs text-primary underline" onClick={(e) => e.stopPropagation()}>Open ↗</a>
                  </div>
                )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-error flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </button>
              <span className={`absolute bottom-1.5 left-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${item.mediaType === 'image' ? 'bg-info/80 text-white' : 'bg-primary/80 text-white'}`}>
                {item.mediaType === 'image' ? 'IMG' : 'VID'}
              </span>
            </div>
          ))}
          {uploadingIdx !== null && (
            <div className="rounded-xl border-2 border-primary/30 bg-primary\/5 aspect-square flex items-center justify-center"
              style={{ borderStyle: 'dashed' }}>
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}
        </div>
      )}

      {evidence.length < 5 && uploadingIdx === null && (
        <>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-base-300 hover:border-primary/50 hover:bg-primary\/5 font-bold text-sm text-base-content/45 hover:text-primary transition-all"
            style={{ borderStyle: 'dashed' }}
          >
            <PlusCircle className="w-4 h-4" /> Add Photo / Video
          </button>
        </>
      )}

      <p className="text-xs text-base-content/30 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Clear photos/videos of medicines and packaging speed up return approval.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § BankDetailsForm
// ═══════════════════════════════════════════════════════════════════════════════

function BankDetailsForm({ bankDetails, onChange }) {
  const fields = [
    { key: 'accountHolderName', label: 'Account Holder Name', icon: User,      placeholder: 'Full name as per bank' },
    { key: 'accountNumber',     label: 'Account Number',      icon: Hash,      placeholder: 'Account number' },
    { key: 'ifscCode',          label: 'IFSC Code',           icon: GitBranch, placeholder: 'E.g. SBIN0001234' },
    { key: 'bankName',          label: 'Bank Name',           icon: Landmark,  placeholder: 'E.g. State Bank of India' },
    { key: 'branchName',        label: 'Branch Name',         icon: Building2, placeholder: 'Branch (optional)' },
  ];
  return (
    <div className="space-y-2.5 p-3.5 bg-base-200 rounded-xl border border-base-300">
      <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">Bank Account Details</p>
      {fields.map(({ key, label, icon: FIcon, placeholder }) => (
        <div key={key}>
          <label className="text-xs font-bold text-base-content/40 mb-1 flex items-center gap-1.5">
            <FIcon className="w-3 h-3" /> {label}
          </label>
          <input
            type="text"
            value={bankDetails[key] || ''}
            onChange={(e) => onChange({ ...bankDetails, [key]: e.target.value })}
            placeholder={placeholder}
            className="input-field"
          />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § ReturnOrderSection
// ═══════════════════════════════════════════════════════════════════════════════

function ReturnOrderSection({ order, dispatch, isLoading }) {
  const [open,         setOpen]         = useState(false);
  const [reason,       setReason]       = useState('');
  const [evidence,     setEvidence]     = useState([]);
  const [refundMethod, setRefundMethod] = useState('');
  const [bankDetails,  setBankDetails]  = useState({
    accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '', branchName: '',
  });

  const currentStatus = str(order.delivery?.status);
  const isReturned    = order.cancellation?.isReturnRequested === true;
  const canReturn     = currentStatus === 'Delivered' && !isReturned;
  const deliveredAt   = order.delivery?.deliveredAt;
  const daysLeft      = deliveredAt
    ? Math.max(0, Math.ceil(7 - (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  if (!canReturn || daysLeft === 0) return null;

  const needsBank   = ['Bank_Transfer', 'Custom_Bank'].includes(refundMethod);
  const bankFilled  = !needsBank || (bankDetails.accountHolderName && bankDetails.accountNumber && bankDetails.ifscCode && bankDetails.bankName);
  const isValid     = reason.length >= 10 && evidence.length >= 1 && refundMethod && bankFilled;
  const orderId_val = str(order._id || order.orderId);

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      await dispatch(requestReturn({
        orderId: orderId_val,
        returnReason: reason,
        evidence,
        refundMethod,
        bankDetails: needsBank ? bankDetails : undefined,
      })).unwrap();
      setOpen(false);
    } catch { /* toast from thunk */ }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-4 py-3 bg-warning\/10 border border-warning\/30 rounded-xl text-warning font-bold hover:bg-warning\/15 flex items-center justify-center gap-2 text-sm transition-colors"
      >
        <RotateCcw className="w-4 h-4" /> Request Return
        <span className="text-xs text-warning/60 font-normal">({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)</span>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-warning\/5 border border-warning\/30 rounded-2xl space-y-5"
    >
      <div className="flex items-center justify-between">
        <p className="font-black text-sm text-warning">Request Return</p>
        <button type="button" onClick={() => setOpen(false)}
          className="text-xs text-base-content/40 hover:text-base-content font-bold">
          ✕ Close
        </button>
      </div>

      {/* Step 1 — Reason */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">
          1. Return Reason <span className="text-error">*</span>
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          placeholder="Describe the issue clearly (wrong medicine, damaged packaging, expired, etc.)…"
          rows={3}
          className="w-full p-3 bg-base-100 border border-base-300 rounded-xl text-sm focus:outline-none focus:border-warning resize-none"
        />
        <p className={`text-xs mt-1 text-right ${reason.length < 10 ? 'text-error' : 'text-base-content/30'}`}>
          {reason.length}/500 · Min 10 chars
        </p>
      </div>

      {/* Step 2 — Evidence */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">
          2. Upload Evidence <span className="text-error">*</span>
        </p>
        <EvidenceUploader evidence={evidence} onEvidenceChange={setEvidence} dispatch={dispatch} />
      </div>

      {/* Step 3 — Refund method */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">
          3. Refund Method <span className="text-error">*</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {REFUND_METHODS.map(({ value, label, icon: MIcon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRefundMethod(value)}
              className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${
                refundMethod === value
                  ? 'border-primary bg-primary\/10 text-primary'
                  : 'border-base-300 bg-base-100 text-base-content/55 hover:border-primary/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <MIcon className={`w-4 h-4 ${refundMethod === value ? 'text-primary' : ''}`} />
                <span className="font-bold text-xs">{label}</span>
              </div>
              <p className={`text-xs leading-snug ${refundMethod === value ? 'text-primary/70' : 'text-base-content/35'}`}>{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Step 4 — Bank details (conditional) */}
      <AnimatePresence>
        {needsBank && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-2">
              4. Bank Account Details <span className="text-error">*</span>
            </p>
            <BankDetailsForm bankDetails={bankDetails} onChange={setBankDetails} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setReason(''); setEvidence([]); setRefundMethod(''); }}
          disabled={isLoading}
          className="btn flex-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="btn btn-warning flex-1"
        >
          {isLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
            : <><RotateCcw className="w-4 h-4" /> Submit Return</>}
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § DeliveryOtpSection
// ═══════════════════════════════════════════════════════════════════════════════

function DeliveryOtpSection({ order, orderId, dispatch, isLoading }) {
  const [otp,  setOtp]  = useState('');
  const [done, setDone] = useState(false);

  if (str(order.delivery?.status) !== 'Out-for-Delivery') return null;

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    try {
      await dispatch(verifyDeliveryOtp({ orderId, otp })).unwrap();
      setDone(true);
    } catch { /* toast from thunk */ }
  };

  if (done) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-success\/10 border border-success\/30">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
        <p className="text-sm font-bold text-success">OTP verified! Order marked as Delivered.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-accent\/5 border border-accent\/30 rounded-2xl space-y-3"
    >
      <div className="flex items-start gap-2.5">
        <KeyRound className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div>
          <p className="font-black text-sm text-accent">Confirm Delivery — Enter OTP</p>
          <p className="text-xs text-base-content/40 mt-0.5">Your 6-digit OTP was sent to your registered email</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="• • • • • •"
          className="flex-1 px-4 py-3 bg-base-100 border border-base-300 rounded-xl text-base font-mono font-black tracking-[0.35em] focus:outline-none focus:border-accent text-center placeholder-base-content/20"
        />
        <button
          type="button"
          onClick={handleVerify}
          disabled={otp.length !== 6 || isLoading}
          className="btn btn-accent px-5"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-xs text-base-content/30 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Share this OTP only with the delivery partner when they are at your door.
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § ReturnEvidenceDisplay
// ═══════════════════════════════════════════════════════════════════════════════

function ReturnEvidenceDisplay({ evidence = [] }) {
  const [lightbox, setLightbox] = useState(null);
  if (!evidence.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-black uppercase tracking-widest text-base-content/40">
        Evidence ({evidence.length})
      </p>
      <div className="grid grid-cols-3 gap-2">
        {evidence.map((item, i) => (
          <div
            key={i}
            className="relative rounded-xl overflow-hidden border border-base-300 bg-base-200 aspect-square cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => item.mediaType === 'image' && setLightbox(item.url)}
          >
            {item.mediaType === 'image'
              ? <img src={item.url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
              : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <Video className="w-6 h-6 text-primary" />
                  <a href={item.url} target="_blank" rel="noreferrer"
                    className="text-xs text-primary underline" onClick={(e) => e.stopPropagation()}>Open ↗</a>
                </div>
              )}
            <span className={`absolute bottom-1.5 left-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${item.mediaType === 'image' ? 'bg-info/80 text-white' : 'bg-primary/80 text-white'}`}>
              {item.mediaType === 'image' ? 'IMG' : 'VID'}
            </span>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.85)' }}
            onClick={() => setLightbox(null)}
          >
            <motion.img
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              src={lightbox}
              alt="Evidence full"
              className="max-w-full max-h-full rounded-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-base-100/20 flex items-center justify-center font-bold text-white hover:bg-base-100/30"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § RefundStatusBadge
// ═══════════════════════════════════════════════════════════════════════════════

function RefundStatusBadge({ refundStatus }) {
  const map = {
    None:          'bg-base-300 text-base-content/40',
    Requested:     'bg-warning\/15 text-warning',
    'In-Progress': 'bg-info\/15 text-info',
    Processed:     'bg-success\/15 text-success',
    Failed:        'bg-error\/15 text-error',
  };
  const labels = {
    None: 'No Refund', Requested: 'Requested',
    'In-Progress': 'In Progress', Processed: 'Processed', Failed: 'Failed',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${map[refundStatus] || map.None}`}>
      {labels[refundStatus] || str(refundStatus)}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § CancelOrderSection
// ═══════════════════════════════════════════════════════════════════════════════

function CancelOrderSection({ order, dispatch, isLoading }) {
  const [confirm, setConfirm] = useState(false);
  const [reason,  setReason]  = useState('');

  const status      = str(order.delivery?.status) || 'Placed';
  const isCancelled = order.cancellation?.isCancelled === true;
  const canCancel   = ['Placed', 'Confirmed'].includes(status) && !isCancelled;
  const orderId_val = str(order._id || order.orderId);

  if (!canCancel) {
    return (
      <div className="w-full px-4 py-3 bg-base-200 border border-base-300 rounded-xl text-base-content/35 font-bold flex items-center justify-center gap-2 cursor-not-allowed text-sm">
        <Ban className="w-4 h-4" />
        Cannot Cancel
        {status === 'Processing' && <span className="text-xs font-normal">(Order is being processed)</span>}
      </div>
    );
  }

  if (!confirm) {
    return (
      <motion.button
        type="button"
        onClick={() => setConfirm(true)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full px-4 py-3 bg-error\/10 border border-error\/30 rounded-xl text-error font-bold hover:bg-error\/15 flex items-center justify-center gap-2 text-sm transition-colors"
      >
        <Ban className="w-4 h-4" /> Cancel Order
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-error\/5 border border-error\/30 rounded-2xl space-y-3"
    >
      <p className="font-black text-sm text-error">Confirm Cancellation</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 300))}
        placeholder="Reason (optional)"
        rows={2}
        className="w-full p-3 bg-base-100 border border-base-300 rounded-xl text-sm focus:outline-none focus:border-error resize-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirm(false)}
          disabled={isLoading}
          className="btn flex-1"
        >
          Keep Order
        </button>
        <button
          type="button"
          onClick={() => dispatch(cancelOrder({ orderId: orderId_val, reason: reason || 'Customer requested cancellation' }))}
          disabled={isLoading}
          className="btn btn-error flex-1"
        >
          {isLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</>
            : <><Ban className="w-4 h-4" /> Yes, Cancel</>}
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § FeedbackSection
// ═══════════════════════════════════════════════════════════════════════════════

function FeedbackSection({ order, dispatch, isLoading }) {
  const [rating,  setRating]  = useState(0);
  const [comment, setComment] = useState('');

  const isDelivered   = str(order.delivery?.status) === 'Delivered';
  const existingRating= Number(order.customerFeedback?.rating || 0);
  const orderId_val   = str(order._id || order.orderId);

  if (!isDelivered) return null;

  if (existingRating > 0) {
    return (
      <div className="text-center py-3 space-y-2">
        <div className="flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={`w-6 h-6 ${n <= existingRating ? 'text-warning fill-warning' : 'text-base-300'}`} />
          ))}
        </div>
        {order.customerFeedback?.comment && (
          <p className="text-xs text-base-content/60 italic max-w-xs mx-auto">"{str(order.customerFeedback.comment)}"</p>
        )}
        <p className="text-xs text-base-content/35">Thank you for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="text-center py-2">
      <p className="text-sm text-base-content/50 mb-3 font-medium">How was your experience?</p>
      <div className="flex items-center justify-center gap-2 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button key={n} type="button" whileHover={{ scale: 1.2 }} onClick={() => setRating(n)} disabled={isLoading}>
            <Star className={`w-8 h-8 ${n <= rating ? 'text-warning fill-warning' : 'text-base-300 hover:text-warning/60'}`} />
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {rating > 0 && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 max-w-sm mx-auto">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              placeholder="Share your experience (optional)"
              rows={2}
              disabled={isLoading}
              className="w-full p-2.5 bg-base-100 border border-base-300 rounded-xl text-sm focus:outline-none focus:border-warning disabled:opacity-50 resize-none"
            />
            <p className="text-xs text-base-content/35 text-right">{comment.length}/500</p>
            <button
              type="button"
              onClick={() => { dispatch(submitFeedback({ orderId: orderId_val, rating, comment })); setRating(0); setComment(''); }}
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § DetailSkeleton
// ═══════════════════════════════════════════════════════════════════════════════

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-36 w-full rounded-3xl" />
      {[128, 200, 160, 144].map((h, i) => (
        <div key={i} className="skeleton w-full rounded-2xl" style={{ height: h }} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § MAIN COMPONENT: OrderDetails
// ═══════════════════════════════════════════════════════════════════════════════

export default function OrderDetails() {
  const dispatch      = useDispatch();
  const router        = useRouter();
  const params        = useParams();
  const orderId       = str(params?.orderId || params?.id || '');

  const order         = useSelector(selectCurrentOrder);
  const loading       = useSelector(selectPharmacyGlobalLoading);
  const actionLoading = useSelector(selectPharmacyActionLoading);
  const invoiceLoading= useSelector(selectInvoiceLoading);
  const error         = useSelector(selectOrderError);
  const rxLoading     = useSelector(selectPrescriptionUploadLoading);

  useEffect(() => {
    if (orderId) dispatch(fetchOrderById(orderId));
    return () => {
      dispatch(clearCurrentOrder());
      dispatch(clearPharmacyErrors());
      dispatch(clearInvoiceData());
    };
  }, [orderId, dispatch]);

  // ── Prescription upload (two-step: CDN → order attach → refetch) ──────────
  const handleRxUpload = useCallback(async (file) => {
    try {
      const uploadResult = await dispatch(uploadPrescriptionFile({ file })).unwrap();
      const imageUrl = uploadResult?.imageUrl;
      if (!imageUrl) return;
      await dispatch(uploadOrderPrescription({ orderId, imageUrl })).unwrap();
      dispatch(clearPrescriptionUpload());
      dispatch(fetchOrderById(orderId));
    } catch { /* errors handled by thunks */ }
  }, [dispatch, orderId]);

  // ── Invoice download ───────────────────────────────────────────────────────
  const handleInvoiceDownload = useCallback(async () => {
    if (!order?._id) return;
    try {
      const result = await dispatch(fetchOrderInvoice(str(order._id))).unwrap();
      if (result?.html) {
        const blob = new Blob([result.html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `Invoice_${str(order.orderId)}.html`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* handled by thunk */ }
  }, [dispatch, order]);

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading && !order) {
    return (
      <div className="min-h-screen bg-base-200 py-6 px-4">
        <div className="max-w-2xl mx-auto"><DetailSkeleton /></div>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-3xl bg-error\/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-error" />
          </div>
          <h2 className="text-xl font-black mb-1">Order Not Found</h2>
          <p className="text-sm text-base-content/45 mb-5">{str(error) || 'Could not load this order.'}</p>
          <button type="button" onClick={() => router.back()} className="btn btn-primary">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  // ─── Derived values ─────────────────────────────────────────────────────────
  const status          = str(order.delivery?.status) || 'Placed';
  const meta            = STATUS_META[status] || STATUS_META.Placed;
  const StatusIcon      = STATUS_ICON_MAP[status] || PackageOpen;
  const statusLabel     = STATUS_LABEL_MAP[status] || status;
  const isCancelled     = order.cancellation?.isCancelled === true;
  const isDelivered     = status === 'Delivered';
  const isOutForDel     = status === 'Out-for-Delivery';
  const isReturnFlow    = RETURN_FLOW_STATUSES.has(status) || order.cancellation?.isReturnRequested;
  const itemCount       = Array.isArray(order.items) ? order.items.length : 0;
  const payMethod       = str(order.payment?.method) || 'COD';
  const payStatus       = str(order.payment?.status) || 'Pending';
  const paidAt          = order.payment?.paidAt;
  const rzpOrderId      = str(order.payment?.razorpayOrderId);
  const rzpPaymentId    = str(order.payment?.razorpayPaymentId);
  const PayIcon         = PAYMENT_ICONS[payMethod] || Banknote;
  const rxStatus        = str(order.prescription?.verificationStatus);
  const storeDoc        = order.store && typeof order.store === 'object' ? order.store : null;
  const cancellation    = order.cancellation || {};
  const hasReturn       = cancellation.isReturnRequested === true;
  const returnDecision  = str(cancellation.returnDecision);
  const refundStatus    = str(cancellation.refundStatus);
  const refundAmt       = Number(cancellation.refundAmount ?? 0);
  const refundEvidence  = Array.isArray(cancellation.returnEvidence) ? cancellation.returnEvidence : [];
  const adminNotes      = Array.isArray(order.adminNotes) ? order.adminNotes : [];
  const orderId_str     = str(order.orderId);
  const order_id        = str(order._id);

  const rxBadge = rxStatus && rxStatus !== 'Not_Uploaded' ? {
    label: RX_STATUS_CFG[rxStatus]?.label || rxStatus,
    className: rxStatus === 'Approved' ? 'bg-success\/10 text-success border-success\/30'
      : rxStatus === 'Rejected' ? 'bg-error\/10 text-error border-error\/30'
      : 'bg-warning\/10 text-warning border-warning\/30',
  } : null;

  const trackingBadge = {
    label: statusLabel,
    className: isCancelled
      ? 'bg-error\/10 text-error border-error\/30'
      : isReturnFlow
      ? 'bg-warning\/10 text-warning border-warning\/30'
      : isDelivered
      ? 'bg-success\/10 text-success border-success\/30'
      : `${meta.bg} ${meta.color} border-current`,
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-200 py-4 px-4">
      <div className="max-w-2xl mx-auto space-y-3">

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center justify-between"
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-2 text-base-content/55 hover:text-primary group transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-semibold">Back</span>
          </button>
          <button
            type="button"
            onClick={() => dispatch(fetchOrderById(orderId))}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-base-100 border border-base-300 rounded-xl text-xs font-semibold text-base-content/45 hover:border-primary hover:text-primary disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </motion.div>

        {/* ── Hero status card ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative card overflow-hidden border border-base-300`}
        >
          {/* Decorative circles */}
          <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-primary/5 pointer-events-none" />
          <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-primary/8 pointer-events-none" />

          <div className="relative p-5">
            {/* Status row */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <motion.div
                  className={`w-12 h-12 rounded-2xl ${meta.bg} ${meta.color} ${meta.ring} flex items-center justify-center shadow-sm relative overflow-hidden shrink-0`}
                  animate={status === 'Processing' ? { rotate: 360 } : {}}
                  transition={{ duration: 3, repeat: status === 'Processing' ? Infinity : 0 }}
                >
                  <StatusIcon className="w-5 h-5" />
                </motion.div>
                <div>
                  <p className={`font-black text-lg leading-tight ${meta.color}`}>{statusLabel}</p>
                  <p className="text-xs text-base-content/40 mt-0.5">
                    {isDelivered
                      ? `Delivered ${fmt(order.delivery?.deliveredAt)}`
                      : `Placed ${fmt(order.createdAt)}`}
                  </p>
                </div>
              </div>

              {/* Order ID + invoice */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="px-3 py-1.5 bg-base-200 rounded-xl text-xs font-mono font-bold text-base-content/65 border border-base-300">
                  {orderId_str}
                </span>
                <p className="text-xs text-base-content/30">{fmt(order.createdAt, true)}</p>
                <button
                  type="button"
                  onClick={handleInvoiceDownload}
                  disabled={invoiceLoading}
                  className="btn btn-sm btn-secondary mt-1 gap-1.5"
                >
                  {invoiceLoading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                    : <><Receipt className="w-3.5 h-3.5" /> Invoice</>}
                </button>
              </div>
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                payStatus === 'Paid'
                  ? 'bg-success\/15 text-success border-success\/30'
                  : 'bg-warning\/15 text-warning border-warning\/30'
              }`}>
                <PayIcon className="w-3 h-3" />
                {payMethod} · {payStatus}
              </span>

              {order.prescription?.isRequired && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  rxStatus === 'Approved' ? 'bg-success\/15 text-success border-success\/30'
                  : rxStatus === 'Rejected' ? 'bg-error\/15 text-error border-error\/30'
                  : 'bg-warning\/15 text-warning border-warning\/30'
                }`}>
                  <ShieldCheck className="w-3 h-3" />
                  Rx: {RX_STATUS_CFG[rxStatus]?.label || 'Required'}
                </span>
              )}

              {isReturnFlow && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-warning\/15 text-warning border-warning\/30">
                  <RotateCcw className="w-3 h-3" /> Return: {statusLabel}
                </span>
              )}

              {refundStatus && refundStatus !== 'None' && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  refundStatus === 'Processed' ? 'bg-success\/15 text-success border-success\/30'
                  : refundStatus === 'Failed' ? 'bg-error\/15 text-error border-error\/30'
                  : 'bg-info\/15 text-info border-info\/30'
                }`}>
                  <DollarSign className="w-3 h-3" /> Refund: {refundStatus}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Delivery OTP ────────────────────────────────────────────────── */}
        {isOutForDel && (
          <DeliveryOtpSection order={order} orderId={orderId} dispatch={dispatch} isLoading={actionLoading} />
        )}

        {/* ── Tracking ────────────────────────────────────────────────────── */}
        <Section
          title="Order Tracking"
          icon={isReturnFlow ? RotateCcw : Truck}
          iconBgClass={isReturnFlow ? 'bg-warning\/10' : 'bg-primary\/10'}
          iconColorClass={isReturnFlow ? 'text-warning' : 'text-primary'}
          badge={trackingBadge}
        >
          <div className="pt-2">
            <TrackingTimeline order={order} />
          </div>
        </Section>

        {/* ── Items ───────────────────────────────────────────────────────── */}
        <Section
          title={`Items (${itemCount})`}
          icon={Pill}
          iconBgClass="bg-secondary\/10"
          iconColorClass="text-secondary"
        >
          <div className="space-y-2.5 pt-1">
            {(order.items || []).map((item, i) => (
              <ItemRow key={str(item._id || i)} item={item} index={i} />
            ))}
          </div>
        </Section>

        {/* ── Prescription ────────────────────────────────────────────────── */}
        {order.prescription?.isRequired && (
          <Section
            title="Prescription"
            icon={FileText}
            iconBgClass={
              rxStatus === 'Approved' ? 'bg-success\/10'
              : rxStatus === 'Rejected' ? 'bg-error\/10'
              : 'bg-warning\/10'
            }
            iconColorClass={
              rxStatus === 'Approved' ? 'text-success'
              : rxStatus === 'Rejected' ? 'text-error'
              : 'text-warning'
            }
            defaultOpen={['Rejected', 'Not_Uploaded'].includes(rxStatus)}
            badge={rxBadge}
          >
            <PrescriptionSection
              order={order}
              orderId={orderId}
              isUploading={rxLoading}
              actionLoading={actionLoading}
              onUpload={handleRxUpload}
            />
          </Section>
        )}

        {/* ── Bill Summary ─────────────────────────────────────────────────── */}
        <Section
          title="Bill Summary"
          icon={IndianRupee}
          iconBgClass="bg-accent\/10"
          iconColorClass="text-accent"
        >
          <div className="pt-1">
            <BillingBreakdown billing={order.billing} />
          </div>
        </Section>

        {/* ── Store Details ────────────────────────────────────────────────── */}
        {storeDoc && (
          <Section
            title="Store Details"
            icon={Building2}
            defaultOpen={false}
            iconBgClass="bg-info\/10"
            iconColorClass="text-info"
          >
            <div className="pt-1">
              <StoreInfo store={storeDoc} />
            </div>
          </Section>
        )}

        {/* ── Delivery Address ─────────────────────────────────────────────── */}
        <Section
          title="Delivery Address"
          icon={MapPin}
          defaultOpen={false}
          iconBgClass="bg-success\/10"
          iconColorClass="text-success"
        >
          {order.delivery?.address ? (
            <div className="p-3.5 bg-base-200 rounded-xl border border-base-300 mt-1">
              <div className="flex items-start gap-3">
                <Home className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  {order.delivery.address.fullName && (
                    <p className="font-bold text-sm">{str(order.delivery.address.fullName)}</p>
                  )}
                  <p className="text-sm text-base-content/70">{str(order.delivery.address.line1)}</p>
                  {order.delivery.address.landmark && (
                    <p className="text-sm text-base-content/50">Near: {str(order.delivery.address.landmark)}</p>
                  )}
                  <p className="text-sm text-base-content/70">
                    {str(order.delivery.address.city)}{order.delivery.address.state ? `, ${str(order.delivery.address.state)}` : ''} — {str(order.delivery.address.pincode)}
                  </p>
                  {order.delivery.address.phone && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-base-content/50">
                      <Phone className="w-3.5 h-3.5" /> {str(order.delivery.address.phone)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-base-content/35 text-center py-4">No address on file</p>
          )}
        </Section>

        {/* ── Payment Details ──────────────────────────────────────────────── */}
        <Section
          title="Payment Details"
          icon={CreditCard}
          defaultOpen={false}
          iconBgClass="bg-primary\/10"
          iconColorClass="text-primary"
        >
          <div className="space-y-0 pt-1">
            <InfoRow label="Method"  value={payMethod} />
            <InfoRow
              label="Status"
              value={
                <span className={payStatus === 'Paid' ? 'font-bold text-success' : 'font-bold text-warning'}>
                  {payStatus}
                </span>
              }
            />
            {paidAt          && <InfoRow label="Paid At"             value={fmt(paidAt, true)} />}
            {rzpOrderId      && <InfoRow label="Razorpay Order ID"   value={rzpOrderId}   copyable />}
            {rzpPaymentId    && <InfoRow label="Payment ID"          value={rzpPaymentId} copyable />}
            {order.billing?.promoCode && (
              <InfoRow label="Promo Code" value={
                <span className="font-black text-success">{str(order.billing.promoCode)}</span>
              } />
            )}
          </div>
        </Section>

        {/* ── Return Request ───────────────────────────────────────────────── */}
        {hasReturn && (
          <Section
            title="Return Request"
            icon={RotateCcw}
            iconBgClass={
              returnDecision === 'Accepted' ? 'bg-success\/10'
              : returnDecision === 'Rejected' ? 'bg-error\/10'
              : 'bg-warning\/10'
            }
            iconColorClass={
              returnDecision === 'Accepted' ? 'text-success'
              : returnDecision === 'Rejected' ? 'text-error'
              : 'text-warning'
            }
            defaultOpen
            badge={{
              label: returnDecision || 'Pending',
              className: returnDecision === 'Accepted'
                ? 'bg-success\/10 text-success border-success\/30'
                : returnDecision === 'Rejected'
                ? 'bg-error\/10 text-error border-error\/30'
                : 'bg-warning\/10 text-warning border-warning\/30',
            }}
          >
            <div className="space-y-4 pt-1">
              {/* Return reason */}
              {cancellation.returnReason && (
                <div className="p-3.5 bg-warning\/5 border border-warning\/20 rounded-xl">
                  <p className="text-xs font-black uppercase tracking-wider text-warning/70 mb-1.5">Return Reason</p>
                  <p className="text-sm text-base-content/70">{str(cancellation.returnReason)}</p>
                </div>
              )}

              {/* Meta */}
              <div className="space-y-0">
                {cancellation.returnRequestedAt && (
                  <InfoRow label="Requested At" value={fmt(cancellation.returnRequestedAt, true)} />
                )}
                {returnDecision && (
                  <InfoRow label="Store Decision" value={
                    <span className={
                      returnDecision === 'Accepted' ? 'font-bold text-success'
                      : returnDecision === 'Rejected' ? 'font-bold text-error'
                      : 'font-bold text-warning'
                    }>{returnDecision}</span>
                  } />
                )}
                {cancellation.returnDecisionAt && (
                  <InfoRow label="Decision At" value={fmt(cancellation.returnDecisionAt, true)} />
                )}
              </div>

              {cancellation.returnDecisionNote && (
                <div className="p-3.5 bg-base-200 rounded-xl border border-base-300">
                  <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-1">Store Note</p>
                  <p className="text-xs text-base-content/65">{str(cancellation.returnDecisionNote)}</p>
                </div>
              )}

              {/* Evidence */}
              <ReturnEvidenceDisplay evidence={refundEvidence} />

              {/* Pickup verification */}
              {cancellation.pickupVerifiedAt && (
                <div className="p-3.5 bg-base-200 rounded-xl border border-base-300 space-y-0">
                  <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-2">Pickup Verification</p>
                  <InfoRow label="Condition" value={
                    <span className={cancellation.pickupConditionGood ? 'font-bold text-success' : 'font-bold text-error'}>
                      {cancellation.pickupConditionGood ? '✓ Good' : '✗ Issue Found'}
                    </span>
                  } />
                  {cancellation.pickupConditionNotes && (
                    <p className="text-xs text-base-content/60 pt-1">{str(cancellation.pickupConditionNotes)}</p>
                  )}
                  <InfoRow label="Verified At" value={fmt(cancellation.pickupVerifiedAt, true)} />
                </div>
              )}

              {/* Refund details */}
              {refundStatus && refundStatus !== 'None' && (
                <div className="p-3.5 bg-base-200 rounded-xl border border-base-300 space-y-0">
                  <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-2">Refund</p>
                  <div className="flex items-center justify-between py-2 border-b border-base-300">
                    <span className="text-xs text-base-content/50">Status</span>
                    <RefundStatusBadge refundStatus={refundStatus} />
                  </div>
                  {refundAmt > 0 && (
                    <InfoRow label="Amount" value={
                      <span className="font-black text-success">{fmtCurrency(refundAmt)}</span>
                    } />
                  )}
                  {cancellation.selectedRefundMethod && (
                    <InfoRow label="Method" value={str(cancellation.selectedRefundMethod)} />
                  )}
                  {cancellation.refundMethod && cancellation.refundMethod !== 'None' && (
                    <InfoRow label="Processed Via" value={str(cancellation.refundMethod)} />
                  )}
                  {cancellation.refundInitiatedAt && (
                    <InfoRow label="Initiated At" value={fmt(cancellation.refundInitiatedAt, true)} />
                  )}
                  {cancellation.refundedAt && (
                    <InfoRow label="Completed At" value={fmt(cancellation.refundedAt, true)} />
                  )}
                  {cancellation.refundId && (
                    <InfoRow label="Refund ID" value={str(cancellation.refundId)} copyable />
                  )}
                </div>
              )}

              {/* Bank details (masked) */}
              {cancellation.bankDetails?.accountHolderName && (
                <div className="p-3.5 bg-base-200 rounded-xl border border-base-300 space-y-0">
                  <p className="text-xs font-black uppercase tracking-wider text-base-content/40 mb-2">Bank Account</p>
                  <InfoRow label="Holder" value={str(cancellation.bankDetails.accountHolderName)} />
                  <InfoRow label="Bank"   value={str(cancellation.bankDetails.bankName)} />
                  {cancellation.bankDetails.branchName && (
                    <InfoRow label="Branch" value={str(cancellation.bankDetails.branchName)} />
                  )}
                  <InfoRow label="Acc No." value={`****${str(cancellation.bankDetails.accountNumber).slice(-4)}`} />
                  <InfoRow label="IFSC"    value={str(cancellation.bankDetails.ifscCode)} copyable />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Cancellation ─────────────────────────────────────────────────── */}
        {isCancelled && (
          <Section
            title="Cancellation"
            icon={XCircle}
            iconBgClass="bg-error\/10"
            iconColorClass="text-error"
            defaultOpen
          >
            <div className="space-y-3 pt-1">
              {cancellation.reason && (
                <div className="p-3.5 bg-error\/5 border border-error\/20 rounded-xl">
                  <p className="text-xs font-black uppercase tracking-wider text-error/70 mb-1">Reason</p>
                  <p className="text-sm text-base-content/70">{str(cancellation.reason)}</p>
                </div>
              )}
              <div className="space-y-0">
                {cancellation.cancelledAt && (
                  <InfoRow label="Cancelled At" value={fmt(cancellation.cancelledAt, true)} />
                )}
                {refundStatus && refundStatus !== 'None' && (
                  <div className="flex items-center justify-between py-2 border-b border-base-300">
                    <span className="text-xs text-base-content/50">Refund Status</span>
                    <RefundStatusBadge refundStatus={refundStatus} />
                  </div>
                )}
                {refundAmt > 0 && (
                  <InfoRow label="Refund Amount" value={
                    <span className="font-black text-success">{fmtCurrency(refundAmt)}</span>
                  } />
                )}
                {cancellation.refundMethod && cancellation.refundMethod !== 'None' && (
                  <InfoRow label="Refund Method" value={str(cancellation.refundMethod)} />
                )}
                {cancellation.refundedAt && (
                  <InfoRow label="Refunded At" value={fmt(cancellation.refundedAt, true)} />
                )}
              </div>
            </div>
          </Section>
        )}

        {/* ── Admin Notes ──────────────────────────────────────────────────── */}
        {adminNotes.length > 0 && (
          <Section
            title="Order Notes"
            icon={StickyNote}
            defaultOpen={false}
            iconBgClass="bg-warning\/10"
            iconColorClass="text-warning"
          >
            <div className="space-y-2 pt-1">
              {adminNotes.map((note, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3.5 rounded-xl bg-base-200 border border-base-300">
                  <StickyNote className="w-4 h-4 text-base-content/35 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-base-content/70 leading-relaxed">{str(note.text)}</p>
                    {note.addedAt && (
                      <p className="text-xs text-base-content/30 mt-1">{fmt(note.addedAt, true)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Feedback ─────────────────────────────────────────────────────── */}
        {isDelivered && (
          <Section
            title="Rate Your Order"
            icon={Star}
            iconBgClass="bg-warning\/10"
            iconColorClass="text-warning"
            defaultOpen={!order.customerFeedback?.rating}
          >
            <FeedbackSection order={order} dispatch={dispatch} isLoading={actionLoading} />
          </Section>
        )}

        {/* ── Action Buttons ───────────────────────────────────────────────── */}
        <div className="space-y-3 pb-2">
          <CancelOrderSection order={order} dispatch={dispatch} isLoading={actionLoading} />
          <ReturnOrderSection order={order} dispatch={dispatch} isLoading={actionLoading} />
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}