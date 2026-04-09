"use client";
 

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";

// ── All real thunks from pharmacyStoreSlice ───────────────────────────────────
import {
  fetchOrders,
  fetchOrderDetails,
  verifyPrescription,
  confirmOrder,
  updateOrderStatus,
  acceptReturn,
  processRefund,
  addOrderNote,
  assignDeliveryPartner,
  exportOrder,
  verifyPickup,
  fetchOrderInvoice,
  fetchOrderLabel,
  clearOrderDocuments,
  clearExportedOrder,
  clearError,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";

import {
  ClipboardCheck, PackageCheck, Truck, CheckCheck, RotateCcw,
  CreditCard, Search, StickyNote, FileDown, FileText, Tag,
  ChevronRight, ChevronDown, X, AlertCircle, Clock,
  User, MapPin, Phone, Mail, ShoppingBag, IndianRupee, Pill,
  Eye, RefreshCw, Activity, Ban, UserCheck, Scan,
  Banknote, Hash, Calendar, HeartPulse, Loader2,
  Info, AlertTriangle, Check, Navigation, Package,
  FlaskConical, Shield, Star, Inbox, CheckCircle2, ChevronLeft,
  Layers, TrendingUp, BarChart2,
  Download,
  PackageOpen,
} from "lucide-react";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, PieChart,
  Pie, Cell, Legend,
} from "recharts";

// ═══════════════════════════════════════════════════════════════════════════════
// § STATUS CONFIG — mirrors PharmacyOrder delivery.status enum exactly
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CFG = {
  Placed: {
    label: "Placed",
    cls: "bg-warning/10 text-warning border-warning/30",
    dot: "bg-warning",
    icon: Clock,
  },
  Confirmed: {
    label: "Confirmed",
    cls: "bg-info/10 text-info border-info/30",
    dot: "bg-info",
    icon: CheckCircle2,
  },
  Processing: {
    label: "Processing",
    cls: "bg-primary/10 text-primary border-primary/30",
    dot: "bg-primary",
    icon: Activity,
  },
  "Out-for-Delivery": {
    label: "Out for Delivery",
    cls: "bg-secondary/10 text-secondary border-secondary/30",
    dot: "bg-secondary",
    icon: Truck,
  },
  Delivered: {
    label: "Delivered",
    cls: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
    icon: CheckCheck,
  },
  Cancelled: {
    label: "Cancelled",
    cls: "bg-error/10 text-error border-error/30",
    dot: "bg-error",
    icon: Ban,
  },
  Return_Requested: {
    label: "Return Requested",
    cls: "bg-warning/15 text-warning border-warning/40",
    dot: "bg-warning",
    icon: RotateCcw,
  },
  Return_Accepted: {
    label: "Return Accepted",
    cls: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
    icon: PackageCheck,
  },
  Return_Rejected: {
    label: "Return Rejected",
    cls: "bg-error/10 text-error border-error/30",
    dot: "bg-error",
    icon: X,
  },
  Pickup_Assigned: {
    label: "Pickup Assigned",
    cls: "bg-accent/10 text-accent border-accent/30",
    dot: "bg-accent",
    icon: Navigation,
  },
  Pickup_Done: {
    label: "Pickup Done",
    cls: "bg-success/15 text-success border-success/40",
    dot: "bg-success",
    icon: Scan,
  },
  Returned: {
    label: "Returned",
    cls: "bg-neutral/10 text-neutral-content/60 border-neutral/20",
    dot: "bg-neutral-content/40",
    icon: RefreshCw,
  },
};

const RX_STATUS_CFG = {
  Not_Uploaded: {
    label: "No Rx",
    cls: "text-base-content/40",
    bg: "bg-base-200 border-base-300",
  },
  Pending: {
    label: "Rx Pending",
    cls: "text-warning",
    bg: "bg-warning/10 border-warning/30",
  },
  Approved: {
    label: "Rx Approved",
    cls: "text-success",
    bg: "bg-success/10 border-success/30",
  },
  Rejected: {
    label: "Rx Rejected",
    cls: "text-error",
    bg: "bg-error/10 border-error/30",
  },
};

// Valid transitions — mirrors router validTransitions exactly
const VALID_TRANSITIONS = {
  Placed:             ["Confirmed", "Cancelled"],
  Confirmed:          ["Processing", "Cancelled"],
  Processing:         ["Out-for-Delivery", "Cancelled"],
  "Out-for-Delivery": ["Delivered", "Cancelled"],
  Delivered:          ["Return_Requested"],
  Return_Requested:   ["Return_Accepted", "Return_Rejected"],
  Return_Accepted:    ["Pickup_Assigned"],
  Pickup_Assigned:    ["Pickup_Done"],
  Pickup_Done:        ["Returned"],
};

const DATE_FILTERS = [
  { value: "today",      label: "Today" },
  { value: "yesterday",  label: "Yesterday" },
  { value: "last7days",  label: "Last 7 Days" },
  { value: "last30days", label: "Last 30 Days" },
  { value: "custom",     label: "Custom Range" },
];

const STATUS_TABS = [
  { value: "all",              label: "All Orders",     icon: Layers },
  { value: "Placed",           label: "Placed",         icon: Clock },
  { value: "Confirmed",        label: "Confirmed",      icon: CheckCircle2 },
  { value: "Processing",       label: "Processing",     icon: Activity },
  { value: "Out-for-Delivery", label: "Out for Del.",   icon: Truck },
  { value: "Delivered",        label: "Delivered",      icon: CheckCheck },
  { value: "Return_Requested", label: "Returns",        icon: RotateCcw },
  { value: "Cancelled",        label: "Cancelled",      icon: Ban },
];

// ═══════════════════════════════════════════════════════════════════════════════
// § ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.045, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const slideRight = {
  hidden:  { opacity: 0, x: 28 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 28, transition: { duration: 0.2 } },
};

const scaleModal = {
  hidden:  { opacity: 0, scale: 0.93, y: 12 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, scale: 0.93, y: 12, transition: { duration: 0.18 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// § FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmt      = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtD     = (d) => d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtShort = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";
const ini      = (s = "") => s.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");

// ═══════════════════════════════════════════════════════════════════════════════
// § SHARED TAILWIND CLASSES — all semantic, dark/light safe
// ═══════════════════════════════════════════════════════════════════════════════

const INP  = "w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all duration-200";
const BTN  = "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
const btnP = `${BTN} bg-primary text-primary-content hover:brightness-110 shadow-sm px-4 py-2.5`;
const btnS = `${BTN} bg-base-200 text-base-content hover:bg-base-300 px-4 py-2.5`;
const btnE = `${BTN} bg-error/10 text-error border border-error/30 hover:bg-error/20 px-4 py-2.5`;
const btnG = `${BTN} bg-success/10 text-success border border-success/30 hover:bg-success/20 px-4 py-2.5`;
const btnW = `${BTN} bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 px-4 py-2.5`;
const btnO = `${BTN} bg-warning/15 text-warning border border-warning/40 hover:bg-warning/25 px-4 py-2.5`;

// ═══════════════════════════════════════════════════════════════════════════════
// § INFO PILL COLOR MAP — semantic tokens only
// ═══════════════════════════════════════════════════════════════════════════════

// Maps logical color names → semantic Tailwind classes (dark/light safe)
const PILL_COLORS = {
  blue:    "bg-info/10 border-info/30 text-info",
  amber:   "bg-warning/10 border-warning/30 text-warning",
  red:     "bg-error/10 border-error/30 text-error",
  violet:  "bg-accent/10 border-accent/30 text-accent",
  emerald: "bg-success/10 border-success/30 text-success",
  orange:  "bg-warning/15 border-warning/40 text-warning",
};

// Stat card icon background map — semantic tokens only
const STAT_COLORS = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-success/10 text-success",
  orange:  "bg-warning/10 text-warning",
  violet:  "bg-accent/10 text-accent",
  blue:    "bg-info/10 text-info",
  red:     "bg-error/10 text-error",
};

// ═══════════════════════════════════════════════════════════════════════════════
// § PRIMITIVE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status, sm }) {
  const cfg  = STATUS_CFG[status] || STATUS_CFG.Placed;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full font-semibold
      ${sm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${cfg.cls}`}>
      <Icon size={sm ? 9 : 11} />
      {cfg.label}
    </span>
  );
}

function RxBadge({ status }) {
  const cfg = RX_STATUS_CFG[status] || RX_STATUS_CFG.Not_Uploaded;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-1.5 py-0.5 ${cfg.cls} ${cfg.bg}`}>
      <FlaskConical size={9} />
      {cfg.label}
    </span>
  );
}

function Spin({ size = 14 }) {
  return <Loader2 size={size} className="animate-spin shrink-0" />;
}

function Avatar({ name, src, size = "sm" }) {
  const dim = size === "lg" ? "w-10 h-10 text-sm" : "w-7 h-7 text-[10px]";
  if (src) return <img src={src} alt={name} className={`${dim} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${dim} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0`}>
      {ini(name)}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={11} className="text-primary/70" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold text-base-content/40 uppercase tracking-wider">{label}</p>
        <p className={`text-xs font-semibold text-base-content mt-0.5 break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
      </div>
    </div>
  );
}

function Field({ label, hint, note, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">{label}</label>
        {hint && <span className="text-[10px] text-base-content/30">{hint}</span>}
      </div>
      {children}
      {note && (
        <p className="text-[10px] text-base-content/40 flex items-start gap-1 leading-relaxed">
          <Info size={9} className="shrink-0 mt-0.5 text-primary/50" />
          {note}
        </p>
      )}
    </div>
  );
}

function InfoPill({ icon: Icon, text, color = "blue" }) {
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs font-medium ${PILL_COLORS[color] || PILL_COLORS.blue}`}>
      <Icon size={13} className="shrink-0 mt-0.5" />
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § MODAL WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            variants={scaleModal} initial="hidden" animate="visible" exit="exit"
            className={`relative z-10 bg-base-300 w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}
              max-h-[92vh] flex flex-col rounded-t-2xl pb-20 sm:rounded-2xl shadow-2xl overflow-hidden`}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-200 shrink-0 bg-base-100/50">
              <h3 className="text-sm font-extrabold text-base-content">{title}</h3>
              <button onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-base-200 text-base-content/40 transition">
                <X size={15} />
              </button>
            </div>
      
<div className="overflow-y-auto flex-1 p-5 flex flex-col justify-start">
  {children}
</div>
          </motion.div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § COLLAPSIBLE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function Section({ id, title, icon: Icon, badge, expanded, onToggle, children, accent }) {
  const accCls = accent
    ? "bg-primary/5 border-primary/20"
    : "bg-base-200/60 border-base-200";
  return (
    <div className={`border rounded-2xl overflow-hidden ${expanded ? "border-primary/30" : "border-base-200"}`}>
      <button onClick={() => onToggle(id)}
        className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors ${accCls}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${expanded ? "bg-primary text-primary-content" : "bg-primary/10 text-primary"}`}>
            <Icon size={13} />
          </div>
          <span className="text-xs font-bold text-base-content">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-content text-[9px] font-extrabold flex items-center justify-center">
              {badge}
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-base-content/30" />
        </motion.div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-base-200">
            <div className="p-4 bg-base-300">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § ORDER CARD
// ═══════════════════════════════════════════════════════════════════════════════

function OrderCard({ order, selected, onClick, index }) {
  const cfg       = STATUS_CFG[order.delivery?.status] || STATUS_CFG.Placed;
  const itemCount = (order.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
  const names     = (order.items || []).map(i => i.brandName || i.name).filter(Boolean);

  // Payment status badge — semantic tokens
  const payStatusCls =
    order.payment?.status === "Paid"     ? "bg-success/10 text-success" :
    order.payment?.status === "Refunded" ? "bg-info/10 text-info"       :
                                           "bg-warning/10 text-warning";

  return (
    <motion.button
      custom={index} variants={fadeUp} initial="hidden" animate="visible"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 p-3.5 transition-all duration-200 relative overflow-hidden group
        ${selected
          ? " border border-primary shadow-md"
          : "  bg-base-300 hover:border-primary/20 hover:shadow-sm"}`}
      >

      {/* Colored left strip */}
      <div className={`absolute left-0 inset-y-0 w-1 rounded-l-2xl transition-all duration-300 ${selected ? cfg.dot : "bg-transparent group-hover:bg-base-200"}`} />

      <div className="flex items-start justify-between gap-2 mb-2 pl-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-primary/60">
              #{order.orderId?.slice(-12) || "—"}
            </span>
            <RxBadge status={order.prescription?.verificationStatus} />
          </div>
          <div className="flex items-center gap-1.5">
            <Avatar name={order.customer?.name} src={order.customer?.avatar} />
            <span className="text-xs font-extrabold text-base-content truncate">
              {order.customer?.name || "Unknown Customer"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-sm font-extrabold text-base-content">{fmt(order.billing?.totalPayable)}</span>
          <StatusBadge status={order.delivery?.status} sm />
        </div>
      </div>

      <div className="pl-2">
        <p className="text-[10px] text-base-content/40 truncate mb-2">
          {names.slice(0, 3).join(" · ") || "No items"}
          {itemCount > 0 && <span className="text-primary/50"> ({itemCount} unit{itemCount !== 1 ? "s" : ""})</span>}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-base-200 text-base-content/50">
            {order.payment?.method || "—"}
          </span>
          {/* Payment status — semantic */}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${payStatusCls}`}>
            {order.payment?.status || "—"}
          </span>
          {order.isReturnPending && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-warning/15 text-warning">
              ⚡ Return
            </span>
          )}
          <span className="text-[9px] text-base-content/30 ml-auto">{fmtShort(order.createdAt)}</span>
        </div>
      </div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § ACTION MODAL BODY
// ═══════════════════════════════════════════════════════════════════════════════

function ActionModalBody({ action, order, onSubmit, onClose, isLoading }) {
  const [form, setForm] = useState({
    isVerified: true, verificationNotes: "", rejectionReason: "",
    deliveryType: "Internal",
    internalPartner: "",
    extName: "", extPhone: "", extAgencyName: "", extTrackingUrl: "",
    targetStatus: "", note: "", estimatedArrival: "",
    deliveryPartnerId: "",
    pickupPartner: "", pickupEstimatedAt: "",
    amount: order?.billing?.totalPayable || 0, reason: "",
    pickupConditionGood: true, pickupConditionNotes: "",
    noteText: "",
  });

  const set = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), []);

  const currentStatus = order?.delivery?.status;
  const nextStatuses  = VALID_TRANSITIONS[currentStatus] || [];
  const forwardOnly   = nextStatuses.filter(s => s !== "Cancelled");

  const buildPayload = () => {
    switch (action) {
      case "verifyRx":
        return {
          orderId:           order.orderId,
          isVerified:        form.isVerified,
          verificationNotes: form.verificationNotes.trim() || undefined,
          rejectionReason:   !form.isVerified ? (form.rejectionReason.trim() || undefined) : undefined,
        };
      case "confirm":
        return {
          orderId:         order.orderId,
          deliveryType:    form.deliveryType,
          internalPartner: form.deliveryType === "Internal" ? (form.internalPartner.trim() || undefined) : undefined,
          externalPartner: form.deliveryType === "Third-Party"
            ? {
                name:        form.extName.trim()        || undefined,
                phone:       form.extPhone.trim()       || undefined,
                agencyName:  form.extAgencyName.trim()  || undefined,
                trackingUrl: form.extTrackingUrl.trim() || undefined,
              }
            : undefined,
        };
      case "updateStatus":
        return {
          orderId:          order.orderId,
          status:           form.targetStatus,
          note:             form.note.trim() || undefined,
          estimatedArrival: form.estimatedArrival || undefined,
        };
      case "cancel":
        return {
          orderId: order.orderId,
          status:  "Cancelled",
          note:    form.note.trim() || undefined,
        };
      case "assignDriver":
        return { orderId: order.orderId, deliveryPartnerId: form.deliveryPartnerId.trim() };
      case "acceptReturn":
        return {
          orderId:           order.orderId,
          pickupPartner:     form.pickupPartner.trim() || undefined,
          pickupEstimatedAt: form.pickupEstimatedAt || undefined,
        };
      case "refund":
        return {
          orderId: order.orderId,
          amount:  parseFloat(form.amount),
          reason:  form.reason.trim() || undefined,
        };
      case "verifyPickup":
        return {
          orderId:              order.orderId,
          pickupConditionGood:  form.pickupConditionGood,
          pickupConditionNotes: form.pickupConditionNotes.trim() || undefined,
        };
      case "addNote":
        return { orderId: order.orderId, note: form.noteText.trim() };
      case "export":
        return order.orderId;
      case "invoice":
        return order.orderId;
      case "label":
        return order.orderId;
      default:
        return null;
    }
  };

  const handleSubmit = () => {
    const payload = buildPayload();
    if (payload !== null) onSubmit(action, payload);
  };

  // ── Toggle button helper ──────────────────────────────────────────────────
  const Toggle = ({ value, onChange, options }) => (
    <div className="flex gap-2">
      {options.map(opt => (
        <button key={String(opt.val)} type="button"
          onClick={() => onChange(opt.val)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all
            ${value === opt.val ? opt.active : "border-base-300 text-base-content/40 hover:border-base-400 bg-base-300"}`}>
          {opt.val === true  && <Check size={11} className="inline mr-1" />}
          {opt.val === false && <X size={11} className="inline mr-1" />}
          {opt.label}
        </button>
      ))}
    </div>
  );

  const body = (() => {
    switch (action) {

      // ── Route 03: Verify Prescription ──────────────────────────────────────
      case "verifyRx":
        return (
          <div className="space-y-4">
            {order.prescription?.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-base-200 bg-base-200/50">
                <img src={order.prescription.imageUrl} alt="Prescription"
                  className="w-full h-44 object-cover"
                  onError={e => { e.target.parentElement.style.display = "none"; }} />
                <p className="text-[10px] text-center text-base-content/40 py-1.5">
                  Prescription — uploaded {fmtD(order.prescription?.uploadedAt)}
                </p>
              </div>
            )}
            <Field
              label="Decision *"
              note="Approving notifies the customer and marks Rx as verified. Rejecting requires them to re-upload a valid prescription before the order can proceed."
            >
              <Toggle
                value={form.isVerified}
                onChange={v => set("isVerified", v)}
                options={[
                  { val: true,  label: "Approve Rx", active: "border-success bg-success/10 text-success" },
                  { val: false, label: "Reject Rx",  active: "border-error bg-error/10 text-error" },
                ]}
              />
            </Field>
            <Field
              label="Verification Notes"
              hint="optional"
              note="Internal staff notes about this prescription check — not visible to the customer."
            >
              <textarea className={INP} rows={2} value={form.verificationNotes}
                onChange={e => set("verificationNotes", e.target.value)}
                placeholder="e.g. Valid original prescription, doctor signature present…" />
            </Field>
            {!form.isVerified && (
              <Field
                label="Rejection Reason *"
                note="This reason is sent to the customer so they know what to correct on re-upload."
              >
                <textarea className={INP} rows={2} value={form.rejectionReason}
                  onChange={e => set("rejectionReason", e.target.value)}
                  placeholder="e.g. Prescription is expired, doctor name missing, illegible scan…" />
              </Field>
            )}
            <InfoPill icon={Info} color={form.isVerified ? "emerald" : "red"}
              text={form.isVerified
                ? "Approving sets verificationStatus → Approved. Customer notified via push + email."
                : "Rejecting sets verificationStatus → Rejected. Customer must re-upload before order can proceed."} />
          </div>
        );

      // ── Route 04: Confirm Order ─────────────────────────────────────────────
      case "confirm":
        return (
          <div className="space-y-4">
            <Field
              label="Delivery Type *"
              note="Choose Internal if using your own delivery fleet. Choose Third-Party if handing off to a courier agency."
            >
              <select className={INP} value={form.deliveryType}
                onChange={e => set("deliveryType", e.target.value)}>
                <option value="Internal">Internal (own delivery fleet)</option>
                <option value="Third-Party">Third-Party (external courier agency)</option>
              </select>
            </Field>

            {form.deliveryType === "Internal" && (
              <Field
                label="Internal Partner User ID"
                hint="optional"
                note="MongoDB ObjectId of the delivery staff member. Leave blank to assign later via the 'Assign Partner' action."
              >
                <input className={INP}
                  placeholder="e.g. 64f3a2b1c0d9e8f7a6b5c4d3"
                  value={form.internalPartner}
                  onChange={e => set("internalPartner", e.target.value)} />
              </Field>
            )}

            {form.deliveryType === "Third-Party" && (
              <div className="space-y-3 p-3 rounded-xl bg-accent/10 border border-accent/30">
                <p className="text-[10px] font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                  <Truck size={11} />
                  External Courier Details
                </p>
                <Field label="Agency Name" hint="optional" note="Name of the courier company (e.g. Delhivery, Shiprocket, Ekart).">
                  <input className={INP} placeholder="e.g. Delhivery, Shiprocket, Ekart…"
                    value={form.extAgencyName} onChange={e => set("extAgencyName", e.target.value)} />
                </Field>
                <Field label="Courier Person Name" hint="optional" note="Name of the individual pickup/delivery person assigned by the agency.">
                  <input className={INP} placeholder="e.g. Ravi Kumar"
                    value={form.extName} onChange={e => set("extName", e.target.value)} />
                </Field>
                <Field label="Courier Phone" hint="optional" note="Mobile number of the courier person for direct contact by the customer.">
                  <input className={INP} placeholder="e.g. +91 98765 43210"
                    value={form.extPhone} onChange={e => set("extPhone", e.target.value)} />
                </Field>
                <Field label="Tracking URL" hint="optional" note="Public shipment tracking URL shared with the customer.">
                  <input className={INP} placeholder="https://track.courier.com/AWB123456"
                    value={form.extTrackingUrl} onChange={e => set("extTrackingUrl", e.target.value)} />
                </Field>
              </div>
            )}

            <InfoPill icon={PackageCheck} color="emerald"
              text="Placed → Confirmed. Customer receives email + push notification. All partner fields are optional — they can be updated later." />
          </div>
        );

      // ── Route 05: Advance Status ────────────────────────────────────────────
      case "updateStatus":
        return (
          <div className="space-y-4">
            <Field
              label="Move Order To *"
              note="Only valid next states for this order are listed. Transitions are enforced server-side as well."
            >
              <select className={INP} value={form.targetStatus}
                onChange={e => set("targetStatus", e.target.value)}>
                <option value="">— Select next status —</option>
                {forwardOnly.map(s => (
                  <option key={s} value={s}>{STATUS_CFG[s]?.label || s}</option>
                ))}
              </select>
            </Field>
            {form.targetStatus && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-base-200 border border-base-300">
                <StatusBadge status={currentStatus} sm />
                <ChevronRight size={12} className="text-base-content/30 shrink-0" />
                <StatusBadge status={form.targetStatus} sm />
              </div>
            )}
            <Field label="Status Note" hint="optional" note="This note is recorded in the order's status history log for internal audit. Not shown to the customer.">
              <textarea className={INP} rows={2} value={form.note}
                onChange={e => set("note", e.target.value)}
                placeholder="e.g. Packed and ready to dispatch, picked up at 3 PM…" />
            </Field>
            {form.targetStatus === "Out-for-Delivery" && (
              <>
                <Field label="Estimated Arrival Time" hint="optional" note="Expected delivery date and time shown to the customer.">
                  <input type="datetime-local" className={INP}
                    value={form.estimatedArrival}
                    onChange={e => set("estimatedArrival", e.target.value)} />
                </Field>
                <InfoPill icon={Shield} color="blue"
                  text="Moving to Out-for-Delivery auto-generates a 6-digit OTP and emails it to the customer for doorstep delivery confirmation." />
              </>
            )}
            {form.targetStatus === "Delivered" && order.payment?.method === "COD" && (
              <InfoPill icon={Info} color="emerald"
                text="COD order: payment.status auto-set to Paid and paidAt stamped when this transition saves (via pre-save hook)." />
            )}
          </div>
        );

      // ── Route 05: Cancel Order ──────────────────────────────────────────────
      case "cancel":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-base-200 border border-base-300">
              <StatusBadge status={currentStatus} sm />
              <ChevronRight size={12} className="text-base-content/30 shrink-0" />
              <StatusBadge status="Cancelled" sm />
            </div>
            <InfoPill icon={AlertTriangle} color="red"
              text={`Cancels from "${currentStatus}" status via updateOrderStatus route (Route 05). For Razorpay-paid orders, use the Refund action separately after cancellation.`} />
            <Field label="Cancellation Reason" hint="optional" note="Reason is stored in the status history. Helps with dispute resolution and analytics.">
              <textarea className={INP} rows={3} value={form.note}
                onChange={e => set("note", e.target.value)}
                placeholder="e.g. Customer requested cancellation, item out of stock, payment failed…" />
            </Field>
          </div>
        );

      // ── Route 09: Assign Delivery Partner ───────────────────────────────────
      case "assignDriver":
        return (
          <div className="space-y-4">
            <Field
              label="Delivery Partner User ID *"
              note="MongoDB ObjectId (_id) of the User document with the 'delivery' role. This sets delivery.internalPartner on the order."
            >
              <input className={INP}
                placeholder="e.g. 64f3a2b1c0d9e8f7a6b5c4d3"
                value={form.deliveryPartnerId}
                onChange={e => set("deliveryPartnerId", e.target.value)} />
            </Field>
            <InfoPill icon={UserCheck} color="amber"
              text="Sets delivery.internalPartner on the order. Combine with Advance Status (→ Out-for-Delivery) to route to the partner." />
          </div>
        );

      // ── Route 06: Accept Return ─────────────────────────────────────────────
      case "acceptReturn":
        return (
          <div className="space-y-4">
            {order.cancellation?.returnReason && (
              <div className="p-3 rounded-xl bg-warning/10 border border-warning/30">
                <p className="text-[10px] font-bold text-warning uppercase tracking-wider mb-1">Customer Return Reason</p>
                <p className="text-xs text-base-content">{order.cancellation.returnReason}</p>
              </div>
            )}
            {order.cancellation?.selectedRefundMethod && (
              <div className="p-3 rounded-xl bg-base-200 border border-base-300">
                <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-1">Customer's Requested Refund Method</p>
                <p className="text-sm font-extrabold text-base-content">{order.cancellation.selectedRefundMethod}</p>
              </div>
            )}
            {(order.cancellation?.returnEvidence?.length || 0) > 0 && (
              <div className="p-3 rounded-xl bg-base-200 border border-base-300">
                <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-1">
                  Return Evidence ({order.cancellation.returnEvidence.length} file{order.cancellation.returnEvidence.length !== 1 ? "s" : ""})
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {order.cancellation.returnEvidence.slice(0, 4).map((ev, i) => (
                    <a key={i} href={ev.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-primary underline">
                      {ev.mediaType} {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <Field label="Pickup Partner User ID" hint="optional" note="MongoDB ObjectId of the staff member who will collect the returned items.">
              <input className={INP} placeholder="e.g. 64f3a2b1c0d9e8f7a6b5c4d3"
                value={form.pickupPartner} onChange={e => set("pickupPartner", e.target.value)} />
            </Field>
            <Field label="Estimated Pickup Time" hint="optional" note="When the pickup is expected to happen at the customer's address.">
              <input type="datetime-local" className={INP}
                value={form.pickupEstimatedAt} onChange={e => set("pickupEstimatedAt", e.target.value)} />
            </Field>
            <InfoPill icon={RotateCcw} color="amber"
              text="Return_Requested → Return_Accepted. Sets returnDecision = Accepted. Customer notified. Partner fields optional." />
          </div>
        );

      // ── Route 07: Process Refund ────────────────────────────────────────────
      case "refund":
        return (
          <div className="space-y-4">
            {!order.payment?.razorpayPaymentId && (
              <InfoPill icon={AlertTriangle} color="red"
                text="No Razorpay payment ID found. This route (Route 07) requires razorpayPaymentId — only applies to Razorpay-paid orders." />
            )}
            <Field
              label={`Refund Amount (₹) — Max: ${fmt(order.billing?.totalPayable)}`}
              note="Enter the amount in rupees (₹). The server converts to paise (×100) internally before calling Razorpay."
            >
              <input type="number" className={INP}
                min={1} max={order.billing?.totalPayable}
                value={form.amount}
                onChange={e => set("amount", e.target.value)} />
            </Field>
            <Field label="Refund Reason" hint="optional" note="Stored inside the Razorpay refund record's 'notes' field for payment reconciliation.">
              <textarea className={INP} rows={2} value={form.reason}
                onChange={e => set("reason", e.target.value)}
                placeholder="e.g. Customer return approved, damaged goods, order cancelled…" />
            </Field>
            <InfoPill icon={Shield} color="red"
              text="Calls razorpay.payments.refund(). On success: refundId stored, refundStatus → Processed, payment.status → Refunded." />
          </div>
        );

      // ── Route 11: Verify Pickup ─────────────────────────────────────────────
      case "verifyPickup":
        return (
          <div className="space-y-4">
            <p className="text-xs text-base-content/60 leading-relaxed">
              Physically inspect the returned items. Good condition triggers refund; poor condition rejects with no refund.
            </p>
            <Field
              label="Item Condition *"
              note="Good = items are sealed / undamaged → refund is initiated. Poor = items are damaged / tampered → return rejected, no refund."
            >
              <Toggle
                value={form.pickupConditionGood}
                onChange={v => set("pickupConditionGood", v)}
                options={[
                  { val: true,  label: "Good Condition", active: "border-success bg-success/10 text-success" },
                  { val: false, label: "Poor Condition",  active: "border-error bg-error/10 text-error" },
                ]}
              />
            </Field>
            <Field label="Condition Notes" hint="optional" note="Describe the state of packaging, item damage, missing seals, etc.">
              <textarea className={INP} rows={2} value={form.pickupConditionNotes}
                onChange={e => set("pickupConditionNotes", e.target.value)}
                placeholder="e.g. Outer box intact, strip seal broken on 2 tablets…" />
            </Field>
            {form.pickupConditionGood && order.cancellation?.selectedRefundMethod && (
              <div className="p-3 rounded-xl bg-base-200 border border-base-300">
                <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-1">Refund Routes Via</p>
                <p className="text-sm font-extrabold text-base-content">{order.cancellation.selectedRefundMethod}</p>
                {order.cancellation.selectedRefundMethod === "Wallet" && (
                  <p className="text-[10px] text-success mt-1">✓ Immediate credit inside MongoDB session-safe transaction</p>
                )}
                {order.cancellation.selectedRefundMethod === "Online" && (
                  <p className="text-[10px] text-info mt-1">Mapped → Original_Source (Razorpay reversal). Requires razorpayPaymentId.</p>
                )}
                {order.cancellation.selectedRefundMethod === "Custom_Bank" && (
                  <p className="text-[10px] text-accent mt-1">Mapped → Bank_Transfer. Customer provided custom bank details at return-request time.</p>
                )}
              </div>
            )}
            <InfoPill
              icon={form.pickupConditionGood ? Shield : AlertTriangle}
              color={form.pickupConditionGood ? "emerald" : "red"}
              text={form.pickupConditionGood
                ? "Good → status: Returned, refund initiated per selectedRefundMethod."
                : "Poor → return rejected. No refund. Customer notified."} />
          </div>
        );

      // ── Route 08: Add Internal Note ─────────────────────────────────────────
      case "addNote":
        return (
          <div className="space-y-4">
            <Field label="Internal Note *" note="Only visible to pharmacy staff. Never shown to the customer. Stored in adminNotes[] on the order document.">
              <textarea className={INP} rows={4} value={form.noteText}
                onChange={e => set("noteText", e.target.value)}
                placeholder="e.g. Customer called to confirm delivery slot, contacted supplier for restock…" />
            </Field>
            <InfoPill icon={StickyNote} color="amber"
              text="Appended to adminNotes[] on PharmacyOrder. Visible only to pharmacy staff, not customers." />
          </div>
        );

      // ── Route 10: Export ────────────────────────────────────────────────────
      case "export":
        return (
          <div className="space-y-3">
            <InfoPill icon={FileDown} color="blue"
              text="Fetches the fully-populated order (findOrderPopulated with virtuals). Stored in state.exportedOrder — NOT currentOrder, so the live detail view is preserved." />
            <InfoPill icon={Download} color="blue"
              text="A JSON file download triggers automatically in your browser when exportedOrder arrives in Redux state." />
          </div>
        );

      // ── Route 12: Invoice ───────────────────────────────────────────────────
      case "invoice":
        return (
          <div className="space-y-3">
            <InfoPill icon={FileText} color="blue"
              text="Fetches the invoice as raw HTML from the server (responseType: 'text'). The file will automatically download to your device." />
            <InfoPill icon={Download} color="emerald"
              text="The invoice HTML file downloads automatically. Open in any browser and use Ctrl+P / Cmd+P to print or save as PDF." />
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} disabled={isLoading} className={`flex-1 ${btnP}`}>
                {isLoading ? <Spin /> : <Download size={14} />}
                Download Invoice
              </button>
              <button onClick={onClose} className={btnS}>Cancel</button>
            </div>
          </div>
        );

      // ── Route 13: Label ─────────────────────────────────────────────────────
      case "label":
        return (
          <div className="space-y-3">
            <InfoPill icon={Tag} color="blue"
              text="Generates a delivery label via generateDeliveryLabel(). Returns raw HTML from the server. The file will automatically download to your device." />
            <InfoPill icon={Download} color="emerald"
              text="The label HTML file downloads automatically. Open in any browser and use Ctrl+P / Cmd+P to print on a label printer or standard paper." />
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} disabled={isLoading} className={`flex-1 ${btnP}`}>
                {isLoading ? <Spin /> : <Download size={14} />}
                Download Label
              </button>
              <button onClick={onClose} className={btnS}>Cancel</button>
            </div>
          </div>
        );

      default:
        return <p className="text-xs text-base-content/40">Unknown action.</p>;
    }
  })();

  const submitLabels = {
    verifyRx:     form.isVerified ? "Approve Prescription" : "Reject Prescription",
    confirm:      "Confirm Order",
    updateStatus: form.targetStatus ? `Move → ${STATUS_CFG[form.targetStatus]?.label || form.targetStatus}` : "Select Status",
    cancel:       "Cancel This Order",
    assignDriver: "Assign Partner",
    acceptReturn: "Accept Return",
    refund:       `Initiate Refund ${fmt(form.amount)}`,
    verifyPickup: "Submit Pickup Verification",
    addNote:      "Save Note",
    export:       "Export JSON",
  };

  const hasInlineSubmit = ["invoice", "label"].includes(action);

  return (
    // ✅ Fixed: added `w-full` so the flex child in Modal doesn't stretch/center this
    <div className="space-y-5 w-full">
      {body}
      {!hasInlineSubmit && (
        <div className="flex gap-2 pt-2 border-t border-base-200">
          <button onClick={handleSubmit} disabled={isLoading}
            className={`flex-1 ${action === "cancel" ? btnE : action === "confirm" ? btnG : btnP} py-3`}>
            {isLoading && <Spin />}
            {!isLoading && (action === "cancel" ? <Ban size={14} /> : null)}
            {submitLabels[action] || "Submit"}
          </button>
          <button onClick={onClose} className={`${btnS} py-3`}>Discard</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § ORDER DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function OrderDetail({ order, onAction, loadingAction }) {
  const [expanded, setExpanded] = useState({ items: true });
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const currentStatus   = order.delivery?.status;
  const nextStatuses    = VALID_TRANSITIONS[currentStatus] || [];
  const forwardStatuses = nextStatuses.filter(s => s !== "Cancelled");
  const hasForward      = forwardStatuses.length > 0 && currentStatus !== "Placed";

  const canCancel    = ["Placed","Confirmed","Processing","Out-for-Delivery"].includes(currentStatus);
  const canRefund    = !!order.payment?.razorpayPaymentId
    && order.payment?.status === "Paid"
    && !["Processed","In-Progress"].includes(order.cancellation?.refundStatus);
  const canAssignDrv = ["Processing","Out-for-Delivery"].includes(currentStatus);

  // Payment pill — semantic
  const payPillCls =
    order.payment?.status === "Paid"     ? "bg-success/10 text-success" :
    order.payment?.status === "Refunded" ? "bg-info/10 text-info"       :
                                           "bg-warning/10 text-warning";

  return (
    <div className="space-y-3.5">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-base-200">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono text-primary/50 mb-1 truncate">
            Order #{order.orderId}
          </p>
          <div className="flex items-center gap-2.5 mb-2">
            <Avatar name={order.customer?.name} src={order.customer?.avatar} size="lg" />
            <div>
              <h2 className="text-base font-extrabold text-base-content leading-tight">{order.customer?.name || "—"}</h2>
              <p className="text-[10px] text-base-content/40">{order.customer?.email || "—"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={currentStatus} />
            <RxBadge status={order.prescription?.verificationStatus} />
            {order.isReturnPending && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30">
                ⚡ Return Pending
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-extrabold text-primary leading-none">{fmt(order.billing?.totalPayable)}</p>
          <p className="text-[10px] text-base-content/40 mt-1">{fmtD(order.createdAt)}</p>
          <span className={`mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${payPillCls}`}>
            {order.payment?.method} · {order.payment?.status}
          </span>
        </div>
      </div>

      {/* ── ACTION BAR ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-base-200/60 border border-base-200 p-4">
        <p className="text-[9px] font-extrabold text-base-content/30 uppercase tracking-widest mb-3">
          Available Actions — <span className="text-primary/60">{currentStatus?.replace(/_/g, " ")}</span>
        </p>
        <div className="flex flex-wrap gap-2">

          {/* ① VERIFY PRESCRIPTION */}
          {currentStatus === "Placed"
            && order.prescription?.isRequired
            && !order.prescription?.isVerified && (
            <button onClick={() => onAction("verifyRx")} disabled={!!loadingAction} className={btnW}>
              {loadingAction === "verifyRx" ? <Spin /> : <ClipboardCheck size={14} />}
              Verify Rx
            </button>
          )}

          {/* ② CONFIRM ORDER */}
          {currentStatus === "Placed" && (
            <button onClick={() => onAction("confirm")} disabled={!!loadingAction} className={btnG}>
              {loadingAction === "confirm" ? <Spin /> : <PackageCheck size={14} />}
              Confirm Order
            </button>
          )}

          {/* ③ ADVANCE STATUS */}
          {hasForward && (
            <button onClick={() => onAction("updateStatus")} disabled={!!loadingAction} className={btnP}>
              {loadingAction === "updateStatus" ? <Spin /> : <Activity size={14} />}
              Advance Status
            </button>
          )}

          {/* ④ ASSIGN DELIVERY PARTNER */}
          {canAssignDrv && (
            <button onClick={() => onAction("assignDriver")} disabled={!!loadingAction} className={btnW}>
              {loadingAction === "assignDriver" ? <Spin /> : <UserCheck size={14} />}
              Assign Partner
            </button>
          )}

          {/* ⑤ ACCEPT RETURN */}
          {currentStatus === "Return_Requested" && (
            <button onClick={() => onAction("acceptReturn")} disabled={!!loadingAction} className={btnO}>
              {loadingAction === "acceptReturn" ? <Spin /> : <RotateCcw size={14} />}
              Accept Return
            </button>
          )}

          {/* ⑥ PROCESS REFUND */}
          {canRefund && (
            <button onClick={() => onAction("refund")} disabled={!!loadingAction} className={btnE}>
              {loadingAction === "refund" ? <Spin /> : <CreditCard size={14} />}
              Refund
            </button>
          )}

          {/* ⑦ VERIFY PICKUP */}
          {currentStatus === "Pickup_Done" && (
            <button onClick={() => onAction("verifyPickup")} disabled={!!loadingAction} className={btnP}>
              {loadingAction === "verifyPickup" ? <Spin /> : <Scan size={14} />}
              Verify Pickup
            </button>
          )}

          {/* ⑧ ADD NOTE */}
          <button onClick={() => onAction("addNote")} disabled={!!loadingAction} className={btnS}>
            {loadingAction === "addNote" ? <Spin /> : <StickyNote size={14} />}
            Note
          </button>

          {/* ⑨ EXPORT */}
          <button onClick={() => onAction("export")} disabled={!!loadingAction} className={btnS}>
            {loadingAction === "export" ? <Spin /> : <FileDown size={14} />}
            Export
          </button>

          {/* ⑩ INVOICE */}
          <button onClick={() => onAction("invoice")} disabled={!!loadingAction} className={btnS}>
            {loadingAction === "invoice" ? <Spin /> : <FileText size={14} />}
            Invoice
          </button>

          {/* ⑪ LABEL */}
          <button onClick={() => onAction("label")} disabled={!!loadingAction} className={btnS}>
            {loadingAction === "label" ? <Spin /> : <Tag size={14} />}
            Label
          </button>

          {/* ⑫ CANCEL */}
          {canCancel && (
            <button onClick={() => onAction("cancel")} disabled={!!loadingAction} className={btnE}>
              {loadingAction === "cancel" ? <Spin /> : <Ban size={14} />}
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── DETAIL SECTIONS ────────────────────────────────────────────────── */}

      {/* ORDER ITEMS + BILLING */}
      <Section id="items" title={`Order Items (${order.items?.length || 0})`}
        icon={ShoppingBag} badge={order.items?.length}
        expanded={!!expanded.items} onToggle={toggle}>
        <div className="space-y-2 mb-4">
          {(order.items || []).map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-base-200/60 border border-base-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Pill size={14} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-base-content truncate">{item.brandName || item.name}</p>
                  <p className="text-[10px] text-base-content/40 truncate">
                    {item.genericName || item.name}
                    {item.gstPercentage !== undefined && ` · GST ${item.gstPercentage}%`}
                    {item.hsnCode && ` · HSN ${typeof item.hsnCode === "object" ? item.hsnCode.hsnCode : item.hsnCode}`}
                    {item.isPrescriptionRequired && " · Rx"}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold text-base-content">{fmt(item.totalPrice)}</p>
                <p className="text-[10px] text-base-content/40">×{item.quantity} @ {fmt(item.pricePerUnit)}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Billing breakdown */}
        <div className="space-y-1.5 pt-3 border-t border-base-200">
          {[
            ["Subtotal",         fmt(order.billing?.subTotal)],
            ["GST",              fmt(order.billing?.gstAmount)],
            ["Delivery Charges", fmt(order.billing?.deliveryCharges)],
            ["Platform Fee",     fmt(order.billing?.platformFee)],
            ["Discount",         order.billing?.discountAmount > 0 ? `–${fmt(order.billing.discountAmount)}` : "—"],
            ["Wallet Used",      order.billing?.walletAmountUsed > 0 ? fmt(order.billing.walletAmountUsed) : "—"],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between text-[10px] text-base-content/50">
              <span>{l}</span><span className="font-semibold">{v}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-extrabold text-base-content pt-2 border-t border-base-200">
            <span>Total Payable</span>
            <span className="text-primary">{fmt(order.billing?.totalPayable)}</span>
          </div>
          {order.billing?.promoCode && (
            <p className="text-[10px] text-base-content/40">Promo: {order.billing.promoCode}</p>
          )}
        </div>
      </Section>

      {/* PRESCRIPTION */}
      <Section id="rx" title="Prescription" icon={FlaskConical}
        expanded={!!expanded.rx} onToggle={toggle}>
        {order.prescription?.isRequired ? (
          <div className="space-y-3">
            <div className="flex items-center flex-wrap gap-2">
              <RxBadge status={order.prescription.verificationStatus} />
              {order.prescription.uploadedAt && (
                <span className="text-[10px] text-base-content/40">Uploaded {fmtD(order.prescription.uploadedAt)}</span>
              )}
              {order.prescription.verifiedAt && (
                <span className="text-[10px] text-base-content/40">· Verified {fmtD(order.prescription.verifiedAt)}</span>
              )}
            </div>
            {order.prescription.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-base-200">
                <img src={order.prescription.imageUrl} alt="Rx" className="w-full h-36 object-cover"
                  onError={e => { e.target.parentElement.style.display = "none"; }} />
              </div>
            )}
            {order.prescription.verificationNotes && (
              <div className="p-2.5 rounded-xl bg-info/10 border border-info/30">
                <p className="text-[10px] font-bold text-info mb-1">Notes</p>
                <p className="text-xs text-base-content">{order.prescription.verificationNotes}</p>
              </div>
            )}
            {order.prescription.rejectionReason && (
              <div className="p-2.5 rounded-xl bg-error/10 border border-error/30 flex items-start gap-2">
                <AlertTriangle size={11} className="text-error mt-0.5 shrink-0" />
                <p className="text-xs text-error">{order.prescription.rejectionReason}</p>
              </div>
            )}
            {order.prescription.verifiedBy?.name && (
              <p className="text-[10px] text-base-content/40">
                By: {order.prescription.verifiedBy.name} ({order.prescription.verifiedBy.role})
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-base-content/40">
            <CheckCircle2 size={13} className="text-success" />
            No prescription required for this order
          </div>
        )}
      </Section>

      {/* CUSTOMER & DELIVERY */}
      <Section id="delivery" title="Customer & Delivery" icon={MapPin}
        expanded={!!expanded.delivery} onToggle={toggle}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <InfoRow icon={User}     label="Customer"    value={order.customer?.name} />
          <InfoRow icon={Phone}    label="Phone"       value={order.customer?.phone} />
          <InfoRow icon={Mail}     label="Email"       value={order.customer?.email} />
          <InfoRow icon={Truck}    label="Delivery"    value={order.delivery?.deliveryType} />
          {order.delivery?.address && (
            <div className="col-span-2">
              <InfoRow icon={MapPin} label="Address"
                value={[
                  order.delivery.address.line1,
                  order.delivery.address.landmark,
                  order.delivery.address.city,
                  order.delivery.address.pincode,
                ].filter(Boolean).join(", ")} />
            </div>
          )}
          {order.delivery?.estimatedArrival && (
            <InfoRow icon={Calendar}   label="ETA"       value={fmtD(order.delivery.estimatedArrival)} />
          )}
          {order.delivery?.deliveredAt && (
            <InfoRow icon={CheckCheck} label="Delivered"  value={fmtD(order.delivery.deliveredAt)} />
          )}
          {order.delivery?.pickupEstimatedAt && (
            <InfoRow icon={Navigation} label="Pickup ETA" value={fmtD(order.delivery.pickupEstimatedAt)} />
          )}
        </div>

        {/* Internal delivery partner */}
        {order.delivery?.internalPartner && (
          <div className="p-3 rounded-xl bg-base-200/60 border border-base-200 flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
              <UserCheck size={13} className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-base-content">{order.delivery.internalPartner?.name || "Partner assigned"}</p>
              {order.delivery.internalPartner?.phone && (
                <p className="text-[10px] text-base-content/40">{order.delivery.internalPartner.phone}</p>
              )}
            </div>
            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              Internal
            </span>
          </div>
        )}

        {/* Pickup partner */}
        {order.delivery?.pickupPartner && (
          <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
              <PackageCheck size={13} className="text-warning" />
            </div>
            <div>
              <p className="text-xs font-bold text-base-content">{order.delivery.pickupPartner?.name || "Pickup partner"}</p>
              {order.delivery.pickupPartner?.phone && (
                <p className="text-[10px] text-warning/70">{order.delivery.pickupPartner.phone}</p>
              )}
            </div>
            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-warning/20 text-warning">
              Pickup
            </span>
          </div>
        )}

        {/* External partner */}
        {(order.delivery?.externalPartner?.agencyName || order.delivery?.externalPartner?.name) && (
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/30">
            <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">External Courier Partner</p>
            <div className="grid grid-cols-2 gap-2">
              {order.delivery.externalPartner.agencyName && (
                <InfoRow icon={PackageOpen} label="Agency" value={order.delivery.externalPartner.agencyName} />
              )}
              {order.delivery.externalPartner.name && (
                <InfoRow icon={User} label="Person" value={order.delivery.externalPartner.name} />
              )}
              {order.delivery.externalPartner.phone && (
                <InfoRow icon={Phone} label="Phone" value={order.delivery.externalPartner.phone} />
              )}
            </div>
            {order.delivery.externalPartner.trackingUrl && (
              <a href={order.delivery.externalPartner.trackingUrl} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-primary underline mt-2 inline-flex items-center gap-1">
                <Navigation size={9} />
                Track shipment →
              </a>
            )}
          </div>
        )}
      </Section>

      {/* PAYMENT */}
      <Section id="payment" title="Payment Details" icon={IndianRupee}
        expanded={!!expanded.payment} onToggle={toggle}>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <InfoRow icon={Banknote}     label="Method"  value={order.payment?.method} />
          <InfoRow icon={CheckCircle2} label="Status"  value={order.payment?.status} />
          <InfoRow icon={RefreshCw}    label="Refund"  value={order.cancellation?.refundStatus || "None"} />
        </div>
        {order.payment?.razorpayPaymentId && (
          <InfoRow icon={Hash} label="Razorpay Payment ID" mono value={order.payment.razorpayPaymentId} />
        )}
        {order.payment?.razorpayOrderId && (
          <div className="mt-2">
            <InfoRow icon={Hash} label="Razorpay Order ID" mono value={order.payment.razorpayOrderId} />
          </div>
        )}
        {order.payment?.paidAt && (
          <div className="mt-2">
            <InfoRow icon={Calendar} label="Paid At" value={fmtD(order.payment.paidAt)} />
          </div>
        )}
        {(order.payment?.transactionLog?.length || 0) > 0 && (
          <div className="mt-3 pt-3 border-t border-base-200">
            <p className="text-[9px] font-bold text-base-content/40 uppercase tracking-wider mb-2">
              Transaction Log ({order.payment.transactionLog.length})
            </p>
            {order.payment.transactionLog.slice(-3).map((t, i) => (
              <div key={i} className="flex justify-between text-[10px] text-base-content/50 mb-1">
                <span>{t.action} · <span className="font-semibold">{t.status}</span></span>
                <span>{fmtShort(t.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* STATUS TIMELINE */}
      {(order.delivery?.statusHistory?.length || 0) > 0 && (
        <Section id="timeline" title="Status Timeline"
          icon={Activity} badge={order.delivery.statusHistory.length}
          expanded={!!expanded.timeline} onToggle={toggle}>
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2.5 top-1 bottom-1 w-px bg-gradient-to-b from-primary to-base-300" />
            {[...order.delivery.statusHistory].reverse().map((h, i) => {
              const cfg = STATUS_CFG[h.status] || STATUS_CFG.Placed;
              return (
                <div key={i} className="relative">
                  <div className={`absolute -left-3.5 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-base-300 shadow-sm ${cfg.dot}`} />
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <StatusBadge status={h.status} sm />
                    {h.note && (
                      <span className="text-[10px] text-base-content/40 italic">"{h.note}"</span>
                    )}
                  </div>
                  <p className="text-[10px] text-base-content/40">
                    {fmtD(h.timestamp)}
                    {h.changedBy?.name && ` · ${h.changedBy.name}`}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* RETURN / CANCELLATION */}
      {(order.cancellation?.isReturnRequested || order.cancellation?.isCancelled) && (
        <Section id="return" title="Return / Cancellation" icon={RotateCcw}
          expanded={!!expanded.return} onToggle={toggle} accent>
          <div className="grid grid-cols-2 gap-3">
            {order.cancellation.returnReason && (
              <div className="col-span-2">
                <InfoRow icon={AlertCircle} label="Return Reason" value={order.cancellation.returnReason} />
              </div>
            )}
            {order.cancellation.returnDecision && (
              <InfoRow icon={CheckCircle2} label="Decision"       value={order.cancellation.returnDecision} />
            )}
            {order.cancellation.selectedRefundMethod && (
              <InfoRow icon={CreditCard}   label="Refund Method"  value={order.cancellation.selectedRefundMethod} />
            )}
            {order.cancellation.refundAmount > 0 && (
              <InfoRow icon={IndianRupee}  label="Refund Amount"  value={fmt(order.cancellation.refundAmount)} />
            )}
            {order.cancellation.refundStatus && order.cancellation.refundStatus !== "None" && (
              <InfoRow icon={RefreshCw}    label="Refund Status"  value={order.cancellation.refundStatus} />
            )}
            {order.cancellation.pickupConditionGood !== undefined && (
              <InfoRow icon={Scan} label="Pickup Condition"
                value={order.cancellation.pickupConditionGood ? "✓ Good" : "✗ Poor"} />
            )}
            {order.cancellation.pickupConditionNotes && (
              <div className="col-span-2">
                <InfoRow icon={StickyNote} label="Pickup Notes" value={order.cancellation.pickupConditionNotes} />
              </div>
            )}
            {order.cancellation.returnEvidence?.length > 0 && (
              <InfoRow icon={FileText} label="Evidence"
                value={`${order.cancellation.returnEvidence.length} file(s)`} />
            )}
            {order.cancellation.refundId && (
              <div className="col-span-2">
                <InfoRow icon={Hash} label="Razorpay Refund ID" mono value={order.cancellation.refundId} />
              </div>
            )}
            {order.cancellation.refundedAt && (
              <div className="col-span-2">
                <InfoRow icon={Calendar} label="Refunded At" value={fmtD(order.cancellation.refundedAt)} />
              </div>
            )}
            {/* Custom bank details */}
            {order.cancellation.bankDetails?.accountNumber && (
              <div className="col-span-2 p-3 rounded-xl bg-accent/10 border border-accent/30">
                <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">Customer Bank Details</p>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-base-content">
                  <span className="font-semibold text-base-content/60">Name:</span>
                  <span>{order.cancellation.bankDetails.accountHolderName}</span>
                  <span className="font-semibold text-base-content/60">Account:</span>
                  <span className="font-mono">{order.cancellation.bankDetails.accountNumber}</span>
                  <span className="font-semibold text-base-content/60">IFSC:</span>
                  <span className="font-mono">{order.cancellation.bankDetails.ifscCode}</span>
                  {order.cancellation.bankDetails.bankName && (
                    <>
                      <span className="font-semibold text-base-content/60">Bank:</span>
                      <span>{order.cancellation.bankDetails.bankName}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ADMIN NOTES */}
      <Section id="notes" title="Admin Notes" icon={StickyNote}
        badge={order.adminNotes?.length || 0}
        expanded={!!expanded.notes} onToggle={toggle}>
        {!order.adminNotes?.length ? (
          <p className="text-xs text-base-content/40">No notes yet. Use the Note button to add one.</p>
        ) : (
          <div className="space-y-2">
            {[...order.adminNotes].reverse().map((n, i) => (
              <div key={i} className="p-3 rounded-xl bg-warning/10 border border-warning/30">
                <p className="text-xs text-base-content leading-relaxed">{n.text}</p>
                <p className="text-[10px] text-warning/70 mt-1.5 flex items-center gap-1">
                  <User size={9} />
                  {n.addedBy?.name || "Staff"} · {fmtD(n.addedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* CUSTOMER FEEDBACK */}
      {order.customerFeedback?.rating && (
        <Section id="feedback" title="Customer Feedback" icon={Star}
          expanded={!!expanded.feedback} onToggle={toggle}>
          <div className="flex items-center gap-1.5 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={16}
                className={i < order.customerFeedback.rating
                  ? "text-warning fill-warning"
                  : "text-base-300 fill-base-300"} />
            ))}
            <span className="text-sm font-extrabold text-base-content ml-1">
              {order.customerFeedback.rating}/5
            </span>
          </div>
          {order.customerFeedback.comment && (
            <p className="text-xs text-base-content/60 italic leading-relaxed">
              "{order.customerFeedback.comment}"
            </p>
          )}
          {order.customerFeedback.createdAt && (
            <p className="text-[10px] text-base-content/40 mt-1">{fmtD(order.customerFeedback.createdAt)}</p>
          )}
        </Section>
      )}

      {/* DELIVERY OTP */}
      {order.deliveryOtp?.sentAt && !order.deliveryOtp?.verified && (
        <div className="p-3 rounded-xl bg-info/10 border border-info/30 flex items-center gap-2.5">
          <Shield size={14} className="text-info shrink-0" />
          <div>
            <p className="text-xs font-bold text-info">Delivery OTP Sent</p>
            <p className="text-[10px] text-info/70">
              Emailed to customer at {fmtD(order.deliveryOtp.sentAt)} · Expires {fmtD(order.deliveryOtp.expiresAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § STATS CARD
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({ label, value, icon: Icon, color, sub, index }) {
  return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible"
      className="bg-base-300 rounded-2xl border border-base-200 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${STAT_COLORS[color] || STAT_COLORS.primary}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-base-content leading-none mb-1">{value}</p>
      <p className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-[10px] text-base-content/30 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PharmacyOrderManagement() {
  const dispatch = useDispatch();

  const {
    orders,
    ordersPagination,
    currentOrder,
    currentOrderInvoiceHtml,
    currentOrderLabelHtml,
    exportedOrder,
    loading,
    errors,
  } = useSelector(s => s.pharmacyStore);

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [activeAction,    setActiveAction]     = useState(null);
  const [loadingAction,   setLoadingAction]    = useState(null);
  const [searchQuery,     setSearchQuery]      = useState("");
  const [statusFilter,    setStatusFilter]     = useState("all");
  const [dateFilter,      setDateFilter]       = useState("today");
  const [customStartDate, setCustomStartDate]  = useState("");
  const [customEndDate,   setCustomEndDate]    = useState("");
  const [page,            setPage]             = useState(1);
  const [activeTab,       setActiveTab]        = useState("orders");
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (dateFilter === "custom" && (!customStartDate || !customEndDate)) return;
    hasFetchedRef.current = false;
    dispatch(fetchOrders({
      dateFilter,
      startDate: dateFilter === "custom" ? customStartDate : undefined,
      endDate:   dateFilter === "custom" ? customEndDate   : undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      page,
      limit: 20,
    }));
  }, [dispatch, dateFilter, statusFilter, page, customStartDate, customEndDate]);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    if (orders.length === 0) return;
    hasFetchedRef.current = true;
    const first = orders[0];
    if (!selectedOrderId) {
      setSelectedOrderId(first.orderId);
      dispatch(fetchOrderDetails(first.orderId));
    }
  }, [orders]);

  // Invoice auto-download
  useEffect(() => {
    if (currentOrderInvoiceHtml) {
      const blob = new Blob([currentOrderInvoiceHtml], { type: "text/html;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `invoice-${currentOrder?.orderId || Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      dispatch(clearOrderDocuments());
      setActiveAction(null);
      setLoadingAction(null);
    }
  }, [currentOrderInvoiceHtml, currentOrder, dispatch]);

  // Label auto-download
  useEffect(() => {
    if (currentOrderLabelHtml) {
      const blob = new Blob([currentOrderLabelHtml], { type: "text/html;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `label-${currentOrder?.orderId || Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      dispatch(clearOrderDocuments());
      setActiveAction(null);
      setLoadingAction(null);
    }
  }, [currentOrderLabelHtml, currentOrder, dispatch]);

  // Export JSON auto-download
  useEffect(() => {
    if (exportedOrder) {
      const blob = new Blob([JSON.stringify(exportedOrder, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `order-${exportedOrder.orderId || Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      dispatch(clearExportedOrder());
      setActiveAction(null);
      setLoadingAction(null);
    }
  }, [exportedOrder, dispatch]);

  const handleSelectOrder = useCallback((order) => {
    setSelectedOrderId(order.orderId);
    dispatch(fetchOrderDetails(order.orderId));
    setActiveAction(null);
    setLoadingAction(null);
  }, [dispatch]);

  const handleActionSubmit = useCallback(async (action, payload) => {
    setLoadingAction(action);
    try {
      let result;
      switch (action) {
        case "verifyRx":      result = await dispatch(verifyPrescription(payload));    break;
        case "confirm":       result = await dispatch(confirmOrder(payload));           break;
        case "updateStatus":  result = await dispatch(updateOrderStatus(payload));     break;
        case "cancel":        result = await dispatch(updateOrderStatus(payload));     break;
        case "assignDriver":  result = await dispatch(assignDeliveryPartner(payload)); break;
        case "acceptReturn":  result = await dispatch(acceptReturn(payload));          break;
        case "refund":        result = await dispatch(processRefund(payload));         break;
        case "verifyPickup":  result = await dispatch(verifyPickup(payload));          break;
        case "addNote":       result = await dispatch(addOrderNote(payload));          break;
        case "export":        result = await dispatch(exportOrder(payload));           break;
        case "invoice":       result = await dispatch(fetchOrderInvoice(payload));     break;
        case "label":         result = await dispatch(fetchOrderLabel(payload));       break;
        default: break;
      }
      if (!["export", "invoice", "label"].includes(action)) {
        if (result && !result.error) {
          setActiveAction(null);
          if (selectedOrderId) dispatch(fetchOrderDetails(selectedOrderId));
          dispatch(fetchOrders({
            dateFilter,
            startDate: dateFilter === "custom" ? customStartDate : undefined,
            endDate:   dateFilter === "custom" ? customEndDate   : undefined,
            status: statusFilter === "all" ? undefined : statusFilter,
            page,
            limit: 20,
          }));
        }
        setLoadingAction(null);
      }
    } catch {
      setLoadingAction(null);
    }
  }, [dispatch, selectedOrderId, dateFilter, statusFilter, page, customStartDate, customEndDate]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchOrders({
      dateFilter,
      startDate: dateFilter === "custom" ? customStartDate : undefined,
      endDate:   dateFilter === "custom" ? customEndDate   : undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      page,
    }));
    if (selectedOrderId) dispatch(fetchOrderDetails(selectedOrderId));
  }, [dispatch, dateFilter, statusFilter, page, selectedOrderId, customStartDate, customEndDate]);

  const filteredOrders = orders.filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (o.orderId || "").toLowerCase().includes(q)        ||
      (o.customer?.name || "").toLowerCase().includes(q) ||
      (o.customer?.phone || "").includes(q)
    );
  });

  const totalRevenue   = orders.filter(o => o.payment?.status === "Paid")
    .reduce((s, o) => s + (o.billing?.totalPayable || 0), 0);
  const pendingRx      = orders.filter(o => o.prescription?.verificationStatus === "Pending").length;
  const pendingReturns = orders.filter(o => o.delivery?.status === "Return_Requested").length;
  const deliveredCount = orders.filter(o => o.delivery?.status === "Delivered").length;

  const statusDistribution = Object.entries(
    orders.reduce((acc, o) => {
      const s = o.delivery?.status || "Unknown";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {})
  )
  .filter(([, v]) => v > 0)
  .map(([name, value], i) => ({
    name: STATUS_CFG[name]?.label || name,
    value,
    // Use CSS variable hex equivalents that work in both modes
    color: ["var(--success)","var(--info)","var(--primary)","var(--warning)","var(--error)","var(--accent)","var(--secondary)","var(--neutral)"][i % 8],
  }));

  const revenueByDate = Object.entries(
    orders
      .filter(o => o.payment?.status === "Paid")
      .reduce((acc, o) => {
        const d = new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        if (!acc[d]) acc[d] = { revenue: 0, orders: 0 };
        acc[d].revenue += o.billing?.totalPayable || 0;
        acc[d].orders  += 1;
        return acc;
      }, {})
  ).map(([day, v]) => ({ day, ...v })).slice(-10);

  const MODAL_TITLES = {
    verifyRx:     "Verify Prescription (Route 03)",
    confirm:      "Confirm Order (Route 04)",
    updateStatus: "Advance Order Status (Route 05)",
    cancel:       "Cancel Order (Route 05)",
    assignDriver: "Assign Delivery Partner (Route 09)",
    acceptReturn: "Accept Return Request (Route 06)",
    refund:       "Process Refund (Route 07)",
    verifyPickup: "Verify Pickup Condition (Route 11)",
    addNote:      "Add Internal Note (Route 08)",
    export:       "Export Order (Route 10)",
    invoice:      "Download Order Invoice (Route 12)",
    label:        "Download Delivery Label (Route 13)",
  };

  const isWide = ["updateStatus","refund","verifyPickup","verifyRx","acceptReturn","confirm","invoice","label"].includes(activeAction);

  return (
    <div data-theme="pharmacy" className=" min-h-screen   overflow-y-auto bg-base-200 font-poppins">

      {/* ── Action Modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={!!activeAction}
        onClose={() => { setActiveAction(null); setLoadingAction(null); }}
        title={MODAL_TITLES[activeAction] || activeAction}
        wide={isWide}>
        {activeAction && currentOrder && (
          <ActionModalBody
            action={activeAction}
            order={currentOrder}
            onSubmit={handleActionSubmit}
            onClose={() => { setActiveAction(null); setLoadingAction(null); }}
            isLoading={!!loadingAction}
          />
        )}
      </Modal>

      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-base-300 bg-base-300/96 backdrop-blur-md">
        <div className="max-w-[1680px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <HeartPulse size={17} className="text-primary-content" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-extrabold text-base-content leading-none">Likeson Pharmacy</p>
              <p className="text-[10px] text-primary/60 font-semibold">Order Management</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center bg-base-200 rounded-xl p-1 gap-1">
            {[
              { id: "orders",    label: "Orders",    icon: ShoppingBag },
              { id: "analytics", label: "Analytics", icon: BarChart2 },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all
                  ${activeTab === t.id
                    ? "bg-base-300 text-primary shadow-sm"
                    : "text-base-content/50 hover:text-base-content"}`}>
                <t.icon size={12} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-base-content/50 font-semibold">Store Open</span>
            </div>
            <button onClick={handleRefresh} disabled={loading.orders}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-base-200 hover:bg-base-300 text-base-content/50 transition">
              <RefreshCw size={14} className={loading.orders ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1680px] mx-auto px-4 py-5">

        {/* ════════════════════════════════════════════════════════════════════
            ORDERS TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "orders" && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <StatCard label="Total Orders"    value={ordersPagination?.totalItems || orders.length} icon={Package}      color="primary" index={0} />
              <StatCard label="Paid Revenue"    value={fmt(totalRevenue)}                             icon={IndianRupee}  color="emerald" index={1} sub={`${orders.filter(o => o.payment?.status === "Paid").length} paid orders`} />
              <StatCard label="Return Requests" value={pendingReturns}                                icon={RotateCcw}    color="orange"  index={2} sub="Awaiting acceptance" />
              <StatCard label="Rx Pending"      value={pendingRx}                                     icon={FlaskConical} color="violet"  index={3} sub="Prescriptions to verify" />
            </div>

            {/* Search + date filter */}
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible"
              className="flex gap-2 mb-2 w-full flex-wrap sm:flex-nowrap">
              <div className=" relative flex-1 md:min-w-2xl max-w-sm w-full">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" />
                <input className={`${INP} pl-10`}
                  placeholder="Search by order ID, customer name, phone…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <select className={`${INP} w-fit   cursor-pointer`}
                value={dateFilter}
                onChange={e => { setDateFilter(e.target.value); setPage(1); }}>
                {DATE_FILTERS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </motion.div>

            {/* Custom date range */}
            <AnimatePresence>
              {dateFilter === "custom" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                  className="mb-3 overflow-hidden">
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider block mb-1">Start Date</label>
                      <input type="date" className={INP} value={customStartDate}
                        max={customEndDate || undefined}
                        onChange={e => { setCustomStartDate(e.target.value); setPage(1); }} />
                    </div>
                    <div className="flex items-end pb-2.5 shrink-0 text-base-content/30">
                      <ChevronRight size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider block mb-1">End Date</label>
                      <input type="date" className={INP} value={customEndDate}
                        min={customStartDate || undefined}
                        onChange={e => { setCustomEndDate(e.target.value); setPage(1); }} />
                    </div>
                    {(customStartDate || customEndDate) && (
                      <button
                        onClick={() => { setCustomStartDate(""); setCustomEndDate(""); }}
                        className="self-end mb-0.5 text-[10px] text-base-content/40 hover:text-base-content flex items-center gap-1 shrink-0 px-2 py-2.5">
                        <X size={12} /> Clear
                      </button>
                    )}
                  </div>
                  {customStartDate && customEndDate && (
                    <p className="text-[10px] text-primary/70 mt-1 ml-1 font-semibold">
                      Showing orders from {new Date(customStartDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} to {new Date(customEndDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status filter pills */}
            <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible"
              className="flex gap-1.5 mb-4 overflow-x-auto pb-1 no-scrollbar">
              {STATUS_TABS.map(t => {
                const count = t.value === "all"
                  ? orders.length
                  : orders.filter(o => o.delivery?.status === t.value).length;
                return (
                  <button key={t.value}
                    onClick={() => { setStatusFilter(t.value); setPage(1); }}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all
                      ${statusFilter === t.value
                        ? "bg-primary text-primary-content border-primary shadow-sm"
                        : "bg-base-300 border-base-200 text-base-content/60 hover:border-primary/30 hover:text-base-content"}`}>
                    <t.icon size={10} />
                    {t.label}
                    {count > 0 && (
                      <span className={`ml-0.5 min-w-[16px] h-4 rounded-full text-[8px] font-extrabold px-1 flex items-center justify-center
                        ${statusFilter === t.value ? "bg-primary-content/20 text-primary-content" : "bg-base-200 text-base-content/50"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </motion.div>

            {/* Error banner */}
            {errors?.orders && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-error/10 border border-error/30 text-xs text-error mb-4">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errors.orders.message || "Failed to load orders"}</span>
                <button onClick={() => dispatch(clearError("orders"))} className="ml-auto text-error/60 hover:text-error">
                  <X size={13} />
                </button>
              </div>
            )}

            {/* 2-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">

              {/* LEFT: Order list */}
              <div className="lg:sticky lg:top-[72px] space-y-2 lg:max-h-[calc(100vh-130px)] lg:overflow-y-auto pr-0.5">
                {loading.orders && orders.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-base-content/30">
                    <Spin size={28} />
                    <p className="text-xs font-semibold">Fetching orders…</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <motion.div variants={fadeUp} initial="hidden" animate="visible"
                    className="flex flex-col items-center gap-3 py-16 text-base-content/30">
                    <Inbox size={44} strokeWidth={1.2} />
                    <p className="text-sm font-semibold">No orders found</p>
                    <p className="text-xs text-center max-w-[200px]">
                      {dateFilter === "custom" && (!customStartDate || !customEndDate)
                        ? "Select a start and end date to search"
                        : "Try a different date filter or status tab"}
                    </p>
                  </motion.div>
                ) : (
                  <>
                    <p className="text-[10px] text-base-content/40 font-semibold pb-1">
                      {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
                      {searchQuery && ` matching "${searchQuery}"`}
                    </p>
                    {filteredOrders.map((order, i) => (
                      <OrderCard
                        key={order._id || order.orderId}
                        order={order}
                        index={i}
                        selected={selectedOrderId === order.orderId}
                        onClick={() => handleSelectOrder(order)}
                      />
                    ))}
                    {ordersPagination?.totalPages > 1 && (
                      <div className="flex items-center justify-between gap-2 pt-2 pb-1">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                          className={`${btnS} text-xs py-1.5 px-3`}>
                          <ChevronLeft size={13} /> Prev
                        </button>
                        <span className="text-xs text-base-content/50 font-bold">
                          {page} / {ordersPagination.totalPages}
                          <span className="text-[10px] text-base-content/30 ml-1">
                            ({ordersPagination.totalItems} total)
                          </span>
                        </span>
                        <button disabled={page >= ordersPagination.totalPages} onClick={() => setPage(p => p + 1)}
                          className={`${btnS} text-xs py-1.5 px-3`}>
                          Next <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT: Detail panel */}
              <AnimatePresence mode="wait">
                {loading.orderDetails ? (
                  <motion.div key="loading-detail"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="hidden lg:flex flex-col items-center justify-center gap-3
                      bg-base-300 rounded-2xl border border-base-200 min-h-[500px] text-base-content/30">
                    <Spin size={28} />
                    <p className="text-xs font-semibold">Loading order details…</p>
                  </motion.div>
                ) : currentOrder ? (
                  <motion.div
                    key={currentOrder._id || currentOrder.orderId}
                    variants={slideRight} initial="hidden" animate="visible" exit="exit"
                    className="bg-base-300 rounded-2xl border border-base-200 shadow-sm p-5
                      lg:max-h-[calc(100vh-130px)] lg:overflow-y-auto">
                    <OrderDetail
                      order={currentOrder}
                      onAction={setActiveAction}
                      loadingAction={loadingAction}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="empty-detail"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="hidden lg:flex flex-col items-center justify-center gap-3
                      bg-base-300 rounded-2xl border-2 border-dashed border-base-200 min-h-[500px] text-base-content/20">
                    <Eye size={48} strokeWidth={1} />
                    <div className="text-center">
                      <p className="text-sm font-semibold mb-1">No order selected</p>
                      <p className="text-xs">Click any order card on the left to view its full details</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            ANALYTICS TAB
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "analytics" && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-5">

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Revenue"  value={fmt(totalRevenue)} icon={TrendingUp} color="primary" index={0} />
              <StatCard label="Orders Today"   value={orders.length}     icon={Package}    color="blue"    index={1} />
              <StatCard label="Delivered"      value={deliveredCount}    icon={CheckCheck} color="emerald" index={2} />
              <StatCard label="Active Returns" value={pendingReturns}    icon={RotateCcw}  color="orange"  index={3} />
            </div>

            {/* Revenue trend */}
            <div className="bg-base-300 rounded-2xl border border-base-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-base-content">Revenue Trend</h3>
                  <p className="text-[10px] text-base-content/40 mt-0.5">Derived from current orders in state</p>
                </div>
                <span className="text-xs font-bold text-primary">{fmt(totalRevenue)} total</span>
              </div>
              {revenueByDate.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revenueByDate} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={v => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--base-300)", background: "var(--base-200)", color: "var(--base-content)", fontSize: 11 }} />
                    <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5}
                      fill="url(#revGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-base-content/30 text-xs">
                  <div className="text-center">
                    <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No paid orders in current filter period</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Status distribution */}
              <div className="bg-base-300 rounded-2xl border border-base-200 p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-base-content mb-0.5">Status Distribution</h3>
                <p className="text-[10px] text-base-content/40 mb-4">Current orders by delivery status</p>
                {statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusDistribution} cx="50%" cy="50%"
                        innerRadius={50} outerRadius={78}
                        paddingAngle={3} dataKey="value">
                        {statusDistribution.map((s, i) => <Cell key={i} fill={s.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--base-300)", background: "var(--base-200)", color: "var(--base-content)", fontSize: 11 }} />
                      <Legend
                        formatter={v => <span style={{ fontSize: 10, color: "var(--base-content)" }}>{v}</span>}
                        wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-base-content/30 text-xs">No orders in filter</div>
                )}
              </div>

              {/* Payment method breakdown */}
              <div className="bg-base-300 rounded-2xl border border-base-200 p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-base-content mb-0.5">Payment Methods</h3>
                <p className="text-[10px] text-base-content/40 mb-4">Order count by payment method</p>
                {(() => {
                  const methodData = Object.entries(
                    orders.reduce((acc, o) => {
                      const m = o.payment?.method || "Unknown";
                      acc[m] = (acc[m] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([name, value]) => ({ name, value }));
                  return methodData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={methodData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--base-300)", background: "var(--base-200)", color: "var(--base-content)", fontSize: 11 }} />
                        <Bar dataKey="value" name="Orders" fill="var(--secondary)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-base-content/30 text-xs">No data</div>
                  );
                })()}
              </div>
            </div>

            {/* Order lifecycle reference */}
            <div className="bg-base-300 rounded-2xl border border-base-200 p-5 shadow-sm">
              <h3 className="text-sm font-extrabold text-base-content mb-0.5">Order Lifecycle Reference</h3>
              <p className="text-[10px] text-base-content/40 mb-5">
                Every action maps 1:1 to a Redux thunk + Express route on /pharmacy-store
              </p>
              <div className="space-y-0">
                {[
                  { step: 1,   from: "Placed",           thunk: "verifyPrescription",   route: "03", desc: "Check Rx image; isVerified bool required; rejectionReason required when false.", icon: ClipboardCheck, color: "text-accent" },
                  { step: 2,   from: "Placed",           thunk: "confirmOrder",          route: "04", desc: "deliveryType required (Internal|Third-Party); all partner fields optional → Confirmed.", icon: PackageCheck, color: "text-success" },
                  { step: 3,   from: "Confirmed",        thunk: "updateOrderStatus",     route: "05", desc: "→ Processing. Order moves to pharmacy picking queue.", icon: Activity, color: "text-info" },
                  { step: 4,   from: "Processing",       thunk: "assignDeliveryPartner", route: "09", desc: "Sets delivery.internalPartner. Do before OFD transition.", icon: UserCheck, color: "text-warning" },
                  { step: 5,   from: "Processing",       thunk: "updateOrderStatus",     route: "05", desc: "→ Out-for-Delivery. Auto-generates 6-digit OTP, emails to customer.", icon: Truck, color: "text-secondary" },
                  { step: 6,   from: "Out-for-Delivery", thunk: "updateOrderStatus",     route: "05", desc: "→ Delivered. COD auto-Paid + paidAt stamped by pre-save hook.", icon: CheckCheck, color: "text-success" },
                  { step: 7,   from: "Return_Requested", thunk: "acceptReturn",           route: "06", desc: "→ Return_Accepted. returnDecision=Accepted. pickupPartner optional.", icon: RotateCcw, color: "text-warning" },
                  { step: 8,   from: "Return_Accepted",  thunk: "updateOrderStatus",     route: "05", desc: "→ Pickup_Assigned → Pickup_Done. Track pickup journey.", icon: Navigation, color: "text-accent" },
                  { step: 9,   from: "Pickup_Done",      thunk: "verifyPickup",           route: "11", desc: "Good → Returned + refund per selectedRefundMethod. Bad → rejected.", icon: Scan, color: "text-success" },
                  { step: "●", from: "Any",              thunk: "addOrderNote",           route: "08", desc: "Appended to adminNotes[]. Never visible to customers.", icon: StickyNote, color: "text-warning" },
                  { step: "●", from: "Any (Razorpay)",   thunk: "processRefund",          route: "07", desc: "razorpay.payments.refund(). Amount ₹ → paise. Requires razorpayPaymentId.", icon: CreditCard, color: "text-error" },
                  { step: "●", from: "Any",              thunk: "exportOrder",            route: "10", desc: "findOrderPopulated with virtuals → stored in exportedOrder, NOT currentOrder.", icon: FileDown, color: "text-info" },
                  { step: "●", from: "Any",              thunk: "fetchOrderInvoice",      route: "12", desc: "responseType:'text'. Raw HTML → auto-downloads as invoice-{orderId}.html file.", icon: FileText, color: "text-secondary" },
                  { step: "●", from: "Any",              thunk: "fetchOrderLabel",        route: "13", desc: "responseType:'text'. Raw HTML → auto-downloads as label-{orderId}.html file.", icon: Tag, color: "text-accent" },
                  { step: "✕", from: "Placed–OFD",      thunk: "updateOrderStatus",     route: "05", desc: "status: 'Cancelled'. For Razorpay orders: use processRefund separately.", icon: Ban, color: "text-error" },
                ].map((row, i) => (
                  <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" animate="visible"
                    className="flex items-start gap-3 py-3 border-b border-base-200 last:border-0">
                    <div className="flex flex-col items-center shrink-0 pt-0.5">
                      <div className={`w-7 h-7 rounded-xl bg-base-200 flex items-center justify-center ${row.color}`}>
                        <row.icon size={13} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-extrabold text-base-content/30 uppercase">Step {row.step}</span>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-primary/8 rounded-md text-primary/70">
                          Route {row.route}
                        </span>
                        {!["Any","Any (Razorpay)","Any–OFD","Placed–OFD"].includes(row.from) && (
                          <StatusBadge status={row.from} sm />
                        )}
                      </div>
                      <p className="text-[11px] font-extrabold text-base-content font-mono">{row.thunk}()</p>
                      <p className="text-[10px] text-base-content/50 mt-0.5 leading-relaxed">{row.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}