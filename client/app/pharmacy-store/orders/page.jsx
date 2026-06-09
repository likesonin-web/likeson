"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";

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
  Layers, TrendingUp, BarChart2, Download, PackageOpen,
  Filter, Bell, Settings, ChevronUp, ArrowUpRight,
  Zap, Circle, MoreVertical, FileCheck, Boxes,
} from "lucide-react";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, PieChart,
  Pie, Cell, Legend,
} from "recharts";

// ═══════════════════════════════════════════════════════════════════════════════
// § STATUS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CFG = {
  Placed:             { label: "Placed",           cls: "bg-warning/10 text-warning border-warning/30",     dot: "bg-warning",            icon: Clock },
  Confirmed:          { label: "Confirmed",         cls: "bg-info/10 text-info border-info/30",             dot: "bg-info",               icon: CheckCircle2 },
  Processing:         { label: "Processing",        cls: "bg-primary/10 text-primary border-primary/30",    dot: "bg-primary",            icon: Activity },
  "Out-for-Delivery": { label: "Out for Delivery",  cls: "bg-secondary/10 text-secondary border-secondary/30", dot: "bg-secondary",       icon: Truck },
  Delivered:          { label: "Delivered",         cls: "bg-success/10 text-success border-success/30",    dot: "bg-success",            icon: CheckCheck },
  Cancelled:          { label: "Cancelled",         cls: "bg-error/10 text-error border-error/30",          dot: "bg-error",              icon: Ban },
  Return_Requested:   { label: "Return Requested",  cls: "bg-warning/15 text-warning border-warning/40",    dot: "bg-warning",            icon: RotateCcw },
  Return_Accepted:    { label: "Return Accepted",   cls: "bg-success/10 text-success border-success/30",    dot: "bg-success",            icon: PackageCheck },
  Return_Rejected:    { label: "Return Rejected",   cls: "bg-error/10 text-error border-error/30",          dot: "bg-error",              icon: X },
  Pickup_Assigned:    { label: "Pickup Assigned",   cls: "bg-accent/10 text-accent border-accent/30",       dot: "bg-accent",             icon: Navigation },
  Pickup_Done:        { label: "Pickup Done",       cls: "bg-success/15 text-success border-success/40",   dot: "bg-success",            icon: Scan },
  Returned:           { label: "Returned",          cls: "bg-neutral/10 text-neutral-content/60 border-neutral/20", dot: "bg-neutral-content/40", icon: RefreshCw },
};

const RX_STATUS_CFG = {
  Not_Uploaded: { label: "No Rx",      cls: "text-base-content/40", bg: "bg-base-200 border-base-300" },
  Pending:      { label: "Rx Pending", cls: "text-warning",          bg: "bg-warning/10 border-warning/30" },
  Approved:     { label: "Rx Verified",cls: "text-success",          bg: "bg-success/10 border-success/30" },
  Rejected:     { label: "Rx Rejected",cls: "text-error",            bg: "bg-error/10 border-error/30" },
};

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
  { value: "all",              label: "All",         icon: Layers },
  { value: "Placed",           label: "Placed",      icon: Clock },
  { value: "Confirmed",        label: "Confirmed",   icon: CheckCircle2 },
  { value: "Processing",       label: "Processing",  icon: Activity },
  { value: "Out-for-Delivery", label: "Out for Del.",icon: Truck },
  { value: "Delivered",        label: "Delivered",   icon: CheckCheck },
  { value: "Return_Requested", label: "Returns",     icon: RotateCcw },
  { value: "Cancelled",        label: "Cancelled",   icon: Ban },
];

// ═══════════════════════════════════════════════════════════════════════════════
// § ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

const fadeUp = {
  hidden:  { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

const slideIn = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.2 } },
};

const sidebarSlide = {
  hidden:  { opacity: 0, x: "100%" },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: "100%", transition: { duration: 0.25, ease: [0.36, 0, 0.78, 0] } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// § FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmt      = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtD     = (d) => d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtShort = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";
const ini      = (s = "") => s.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");

// ═══════════════════════════════════════════════════════════════════════════════
// § PRIMITIVE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status, sm }) {
  const cfg  = STATUS_CFG[status] || STATUS_CFG.Placed;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full font-semibold ${sm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${cfg.cls}`}>
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
  const dim = size === "lg" ? "w-10 h-10 text-sm" : size === "xl" ? "w-14 h-14 text-base" : "w-7 h-7 text-[10px]";
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
  const colorMap = {
    blue:    "bg-info/10 border-info/30 text-info",
    amber:   "bg-warning/10 border-warning/30 text-warning",
    red:     "bg-error/10 border-error/30 text-error",
    violet:  "bg-accent/10 border-accent/30 text-accent",
    emerald: "bg-success/10 border-success/30 text-success",
    orange:  "bg-warning/15 border-warning/40 text-warning",
  };
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs font-medium ${colorMap[color] || colorMap.blue}`}>
      <Icon size={13} className="shrink-0 mt-0.5" />
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § COLLAPSIBLE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function Section({ id, title, icon: Icon, badge, expanded, onToggle, children, accent }) {
  const accCls = accent ? "bg-primary/5 border-primary/20" : "bg-base-200/60 border-base-200";
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
            <div className="p-4 bg-base-200">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § RIGHT SIDEBAR — ACTION PANEL (replaces modal)
// ═══════════════════════════════════════════════════════════════════════════════

function ActionSidebar({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — only dims left portion */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sidebar panel */}
          <motion.aside
            variants={sidebarSlide} initial="hidden" animate="visible" exit="exit"
            className="fixed top-0 right-0 z-50 h-full w-full sm:w-[460px] lg:w-[500px] flex flex-col bg-base-100 shadow-2xl border-l border-base-300">

            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-base-200 bg-base-100 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-5 rounded-full bg-primary" />
                  <h2 className="text-sm font-extrabold text-base-content leading-tight truncate">{title}</h2>
                </div>
                {subtitle && (
                  <p className="text-[10px] text-base-content/40 font-medium pl-3.5">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-base-200 hover:bg-base-300 text-base-content/50 hover:text-base-content transition-all shrink-0">
                <X size={14} />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § ACTION SIDEBAR BODY — all 13 actions
// ═══════════════════════════════════════════════════════════════════════════════

function ActionSidebarBody({ action, order, onSubmit, onClose, isLoading }) {
  const [form, setForm] = useState({
    isVerified: true, verificationNotes: "", rejectionReason: "",
    deliveryType: "Internal", internalPartner: "",
    extName: "", extPhone: "", extAgencyName: "", extTrackingUrl: "",
    targetStatus: "", note: "", estimatedArrival: "", deliveryPartnerId: "",
    pickupPartner: "", pickupEstimatedAt: "",
    amount: order?.billing?.totalPayable || 0, reason: "",
    pickupConditionGood: true, pickupConditionNotes: "", noteText: "",
  });

  const set = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), []);
  const currentStatus = order?.delivery?.status;
  const nextStatuses  = VALID_TRANSITIONS[currentStatus] || [];
  const forwardOnly   = nextStatuses.filter(s => s !== "Cancelled");

  const buildPayload = () => {
    switch (action) {
      case "verifyRx":     return { orderId: order.orderId, isVerified: form.isVerified, verificationNotes: form.verificationNotes.trim() || undefined, rejectionReason: !form.isVerified ? (form.rejectionReason.trim() || undefined) : undefined };
      case "confirm":      return { orderId: order.orderId, deliveryType: form.deliveryType, internalPartner: form.deliveryType === "Internal" ? (form.internalPartner.trim() || undefined) : undefined, externalPartner: form.deliveryType === "Third-Party" ? { name: form.extName.trim() || undefined, phone: form.extPhone.trim() || undefined, agencyName: form.extAgencyName.trim() || undefined, trackingUrl: form.extTrackingUrl.trim() || undefined } : undefined };
      case "updateStatus": return { orderId: order.orderId, status: form.targetStatus, note: form.note.trim() || undefined, estimatedArrival: form.estimatedArrival || undefined };
      case "cancel":       return { orderId: order.orderId, status: "Cancelled", note: form.note.trim() || undefined };
      case "assignDriver": return { orderId: order.orderId, deliveryPartnerId: form.deliveryPartnerId.trim() };
      case "acceptReturn": return { orderId: order.orderId, pickupPartner: form.pickupPartner.trim() || undefined, pickupEstimatedAt: form.pickupEstimatedAt || undefined };
      case "refund":       return { orderId: order.orderId, amount: parseFloat(form.amount), reason: form.reason.trim() || undefined };
      case "verifyPickup": return { orderId: order.orderId, pickupConditionGood: form.pickupConditionGood, pickupConditionNotes: form.pickupConditionNotes.trim() || undefined };
      case "addNote":      return { orderId: order.orderId, note: form.noteText.trim() };
      case "export": case "invoice": case "label": return order.orderId;
      default: return null;
    }
  };

  const handleSubmit = () => { const p = buildPayload(); if (p !== null) onSubmit(action, p); };

  // Toggle helper
  const Toggle = ({ value, onChange, options }) => (
    <div className="flex gap-2">
      {options.map(opt => (
        <button key={String(opt.val)} type="button" onClick={() => onChange(opt.val)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1.5
            ${value === opt.val ? opt.active : "border-base-300 text-base-content/40 hover:border-base-400 bg-base-200"}`}>
          {opt.val === true  && <Check size={11} />}
          {opt.val === false && <X size={11} />}
          {opt.label}
        </button>
      ))}
    </div>
  );

  const body = (() => {
    switch (action) {

      case "verifyRx": return (
        <div className="space-y-4">
          {order.prescription?.imageUrl && (
            <div className="rounded-2xl overflow-hidden border border-base-200">
              <img src={order.prescription.imageUrl} alt="Prescription" className="w-full h-48 object-cover"
                onError={e => { e.target.parentElement.style.display = "none"; }} />
              <p className="text-[10px] text-center text-base-content/40 py-2">Uploaded {fmtD(order.prescription?.uploadedAt)}</p>
            </div>
          )}
          <Field label="Decision *" note="Approving notifies customer via push + email. Rejecting requires re-upload before order proceeds.">
            <Toggle value={form.isVerified} onChange={v => set("isVerified", v)} options={[
              { val: true,  label: "Approve Rx", active: "border-success bg-success/10 text-success" },
              { val: false, label: "Reject Rx",  active: "border-error bg-error/10 text-error" },
            ]} />
          </Field>
          <Field label="Verification Notes" hint="optional" note="Internal notes — not visible to customer.">
            <textarea className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" rows={2} value={form.verificationNotes} onChange={e => set("verificationNotes", e.target.value)} placeholder="e.g. Valid original, doctor signature present…" />
          </Field>
          {!form.isVerified && (
            <Field label="Rejection Reason *" note="Sent to customer so they know what to correct.">
              <textarea className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" rows={2} value={form.rejectionReason} onChange={e => set("rejectionReason", e.target.value)} placeholder="e.g. Prescription expired, doctor name missing…" />
            </Field>
          )}
          <InfoPill icon={Info} color={form.isVerified ? "emerald" : "red"}
            text={form.isVerified ? "Approving sets verificationStatus → Approved." : "Rejecting sets verificationStatus → Rejected. Customer must re-upload."} />
        </div>
      );

      case "confirm": return (
        <div className="space-y-4">
          <Field label="Delivery Type *" note="Internal = own fleet. Third-Party = external courier.">
            <select className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" value={form.deliveryType} onChange={e => set("deliveryType", e.target.value)}>
              <option value="Internal">Internal (own delivery fleet)</option>
              <option value="Third-Party">Third-Party (external courier)</option>
            </select>
          </Field>
          {form.deliveryType === "Internal" && (
            <Field label="Internal Partner User ID" hint="optional" note="MongoDB ObjectId of delivery staff. Leave blank to assign later.">
              <input className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" placeholder="e.g. 64f3a2b1c0d9e8f7a6b5c4d3" value={form.internalPartner} onChange={e => set("internalPartner", e.target.value)} />
            </Field>
          )}
          {form.deliveryType === "Third-Party" && (
            <div className="space-y-3 p-4 rounded-2xl bg-accent/10 border border-accent/30">
              <p className="text-[10px] font-bold text-accent uppercase tracking-wider flex items-center gap-1.5"><Truck size={11} /> External Courier Details</p>
              <Field label="Agency Name" hint="optional"><input className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" placeholder="e.g. Delhivery, Shiprocket…" value={form.extAgencyName} onChange={e => set("extAgencyName", e.target.value)} /></Field>
              <Field label="Courier Person" hint="optional"><input className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" placeholder="e.g. Ravi Kumar" value={form.extName} onChange={e => set("extName", e.target.value)} /></Field>
              <Field label="Courier Phone" hint="optional"><input className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" placeholder="+91 98765 43210" value={form.extPhone} onChange={e => set("extPhone", e.target.value)} /></Field>
              <Field label="Tracking URL" hint="optional"><input className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" placeholder="https://track.courier.com/AWB…" value={form.extTrackingUrl} onChange={e => set("extTrackingUrl", e.target.value)} /></Field>
            </div>
          )}
          <InfoPill icon={PackageCheck} color="emerald" text="Placed → Confirmed. Customer notified. All partner fields optional." />
        </div>
      );

      case "updateStatus": return (
        <div className="space-y-4">
          <Field label="Move Order To *" note="Only valid next states shown. Transitions enforced server-side.">
            <select className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" value={form.targetStatus} onChange={e => set("targetStatus", e.target.value)}>
              <option value="">— Select next status —</option>
              {forwardOnly.map(s => <option key={s} value={s}>{STATUS_CFG[s]?.label || s}</option>)}
            </select>
          </Field>
          {form.targetStatus && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-base-200 border border-base-300">
              <StatusBadge status={currentStatus} sm /><ChevronRight size={12} className="text-base-content/30 shrink-0" /><StatusBadge status={form.targetStatus} sm />
            </div>
          )}
          <Field label="Status Note" hint="optional" note="Stored in status history. Internal only.">
            <textarea className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" rows={2} value={form.note} onChange={e => set("note", e.target.value)} placeholder="e.g. Packed and ready to dispatch…" />
          </Field>
          {form.targetStatus === "Out-for-Delivery" && (
            <>
              <Field label="Estimated Arrival" hint="optional"><input type="datetime-local" className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" value={form.estimatedArrival} onChange={e => set("estimatedArrival", e.target.value)} /></Field>
              <InfoPill icon={Shield} color="blue" text="Moving to Out-for-Delivery auto-generates a 6-digit OTP emailed to customer." />
            </>
          )}
          {form.targetStatus === "Delivered" && order.payment?.method === "COD" && (
            <InfoPill icon={Info} color="emerald" text="COD order: payment.status auto-set to Paid via pre-save hook." />
          )}
        </div>
      );

      case "cancel": return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-base-200 border border-base-300">
            <StatusBadge status={currentStatus} sm /><ChevronRight size={12} className="text-base-content/30 shrink-0" /><StatusBadge status="Cancelled" sm />
          </div>
          <InfoPill icon={AlertTriangle} color="red" text={`Cancels from "${currentStatus}" status. For Razorpay-paid orders, use Refund action separately after cancellation.`} />
          <Field label="Cancellation Reason" hint="optional" note="Stored in status history for audit.">
            <textarea className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" rows={3} value={form.note} onChange={e => set("note", e.target.value)} placeholder="e.g. Customer requested cancellation, item out of stock…" />
          </Field>
        </div>
      );

      case "assignDriver": return (
        <div className="space-y-4">
          <Field label="Delivery Partner User ID *" note="MongoDB ObjectId of User with 'delivery' role.">
            <input className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all font-mono" placeholder="e.g. 64f3a2b1c0d9e8f7a6b5c4d3" value={form.deliveryPartnerId} onChange={e => set("deliveryPartnerId", e.target.value)} />
          </Field>
          <InfoPill icon={UserCheck} color="amber" text="Sets delivery.internalPartner. Combine with Advance Status → Out-for-Delivery." />
        </div>
      );

      case "acceptReturn": return (
        <div className="space-y-4">
          {order.cancellation?.returnReason && (
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/30">
              <p className="text-[10px] font-bold text-warning uppercase tracking-wider mb-1">Customer Return Reason</p>
              <p className="text-xs text-base-content">{order.cancellation.returnReason}</p>
            </div>
          )}
          {order.cancellation?.selectedRefundMethod && (
            <div className="p-3 rounded-xl bg-base-200 border border-base-300">
              <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-1">Requested Refund Method</p>
              <p className="text-sm font-extrabold text-base-content">{order.cancellation.selectedRefundMethod}</p>
            </div>
          )}
          <Field label="Pickup Partner User ID" hint="optional"><input className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" placeholder="e.g. 64f3a2b1c0d9e8f7a6b5c4d3" value={form.pickupPartner} onChange={e => set("pickupPartner", e.target.value)} /></Field>
          <Field label="Estimated Pickup Time" hint="optional"><input type="datetime-local" className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" value={form.pickupEstimatedAt} onChange={e => set("pickupEstimatedAt", e.target.value)} /></Field>
          <InfoPill icon={RotateCcw} color="amber" text="Return_Requested → Return_Accepted. Customer notified. Partner fields optional." />
        </div>
      );

      case "refund": return (
        <div className="space-y-4">
          {!order.payment?.razorpayPaymentId && <InfoPill icon={AlertTriangle} color="red" text="No Razorpay payment ID found. This route requires razorpayPaymentId." />}
          <Field label={`Refund Amount (₹) — Max: ${fmt(order.billing?.totalPayable)}`} note="Server converts ₹ → paise internally before calling Razorpay.">
            <input type="number" className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" min={1} max={order.billing?.totalPayable} value={form.amount} onChange={e => set("amount", e.target.value)} />
          </Field>
          <Field label="Refund Reason" hint="optional"><textarea className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" rows={2} value={form.reason} onChange={e => set("reason", e.target.value)} placeholder="e.g. Customer return approved, damaged goods…" /></Field>
          <InfoPill icon={Shield} color="red" text="Calls razorpay.payments.refund(). On success: refundId stored, payment.status → Refunded." />
        </div>
      );

      case "verifyPickup": return (
        <div className="space-y-4">
          <p className="text-xs text-base-content/60 leading-relaxed">Physically inspect returned items. Good condition triggers refund; poor condition rejects with no refund.</p>
          <Field label="Item Condition *" note="Good = sealed/undamaged → refund. Poor = damaged/tampered → rejected, no refund.">
            <Toggle value={form.pickupConditionGood} onChange={v => set("pickupConditionGood", v)} options={[
              { val: true,  label: "Good Condition", active: "border-success bg-success/10 text-success" },
              { val: false, label: "Poor Condition",  active: "border-error bg-error/10 text-error" },
            ]} />
          </Field>
          <Field label="Condition Notes" hint="optional"><textarea className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" rows={2} value={form.pickupConditionNotes} onChange={e => set("pickupConditionNotes", e.target.value)} placeholder="e.g. Outer box intact, strip seal broken…" /></Field>
          <InfoPill icon={form.pickupConditionGood ? Shield : AlertTriangle} color={form.pickupConditionGood ? "emerald" : "red"}
            text={form.pickupConditionGood ? "Good → status: Returned, refund initiated per selectedRefundMethod." : "Poor → return rejected. No refund. Customer notified."} />
        </div>
      );

      case "addNote": return (
        <div className="space-y-4">
          <Field label="Internal Note *" note="Only visible to pharmacy staff. Stored in adminNotes[] — never shown to customers.">
            <textarea className="w-full px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" rows={4} value={form.noteText} onChange={e => set("noteText", e.target.value)} placeholder="e.g. Customer called to confirm delivery slot…" />
          </Field>
          <InfoPill icon={StickyNote} color="amber" text="Appended to adminNotes[] on PharmacyOrder. Internal staff only." />
        </div>
      );

      case "export": return (
        <div className="space-y-3">
          <InfoPill icon={FileDown} color="blue" text="Fetches fully-populated order with virtuals. Stored in state.exportedOrder — preserves live detail view." />
          <InfoPill icon={Download} color="blue" text="JSON file downloads automatically when exportedOrder arrives in Redux state." />
        </div>
      );

      case "invoice": return (
        <div className="space-y-4">
          <InfoPill icon={FileText} color="blue" text="Fetches invoice as raw HTML. File auto-downloads to your device." />
          <InfoPill icon={Download} color="emerald" text="Open downloaded HTML in browser. Use Ctrl+P / Cmd+P to print or save as PDF." />
          <div className="flex gap-2 pt-2">
            <button onClick={handleSubmit} disabled={isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all bg-primary text-primary-content hover:brightness-110 shadow-sm px-4 py-3 disabled:opacity-50 disabled:pointer-events-none">
              {isLoading ? <Spin /> : <Download size={14} />} Download Invoice
            </button>
            <button onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold bg-base-200 text-base-content px-4 py-3">Cancel</button>
          </div>
        </div>
      );

      case "label": return (
        <div className="space-y-4">
          <InfoPill icon={Tag} color="blue" text="Generates delivery label via generateDeliveryLabel(). Returns raw HTML from server." />
          <InfoPill icon={Download} color="emerald" text="Label HTML downloads automatically. Print on label printer or standard paper." />
          <div className="flex gap-2 pt-2">
            <button onClick={handleSubmit} disabled={isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all bg-primary text-primary-content hover:brightness-110 shadow-sm px-4 py-3 disabled:opacity-50 disabled:pointer-events-none">
              {isLoading ? <Spin /> : <Download size={14} />} Download Label
            </button>
            <button onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold bg-base-200 text-base-content px-4 py-3">Cancel</button>
          </div>
        </div>
      );

      default: return <p className="text-xs text-base-content/40">Unknown action.</p>;
    }
  })();

  const submitLabels = {
    verifyRx:     form.isVerified ? "Approve Prescription" : "Reject Prescription",
    confirm:      "Confirm Order",
    updateStatus: form.targetStatus ? `Move to ${STATUS_CFG[form.targetStatus]?.label || form.targetStatus}` : "Select Status First",
    cancel:       "Cancel This Order",
    assignDriver: "Assign Partner",
    acceptReturn: "Accept Return",
    refund:       `Initiate Refund · ${fmt(form.amount)}`,
    verifyPickup: "Submit Pickup Verification",
    addNote:      "Save Note",
    export:       "Export JSON",
  };

  const hasInlineSubmit = ["invoice", "label"].includes(action);

  return (
    <div className="space-y-5">
      {body}
      {!hasInlineSubmit && (
        <div className="sticky bottom-0 bg-base-100 pt-4 pb-2 mt-6 border-t border-base-200">
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={isLoading}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none px-4 py-3 ${action === "cancel" ? "bg-error/10 text-error border border-error/30 hover:bg-error/20" : action === "confirm" ? "bg-success/10 text-success border border-success/30 hover:bg-success/20" : "bg-primary text-primary-content hover:brightness-110 shadow-sm"}`}>
              {isLoading && <Spin />}
              {!isLoading && action === "cancel" && <Ban size={14} />}
              {submitLabels[action] || "Submit"}
            </button>
            <button onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold bg-base-200 text-base-content hover:bg-base-300 px-4 py-3">
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § ORDER LIST CARD
// ═══════════════════════════════════════════════════════════════════════════════

function OrderCard({ order, selected, onClick, index }) {
  const cfg       = STATUS_CFG[order.delivery?.status] || STATUS_CFG.Placed;
  const itemCount = (order.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
  const names     = (order.items || []).map(i => i.brandName || i.name).filter(Boolean);
  const payStatusCls =
    order.payment?.status === "Paid"     ? "bg-success/10 text-success" :
    order.payment?.status === "Refunded" ? "bg-info/10 text-info"       :
                                           "bg-warning/10 text-warning";

  return (
    <motion.button
      custom={index} variants={fadeUp} initial="hidden" animate="visible"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border-2 p-3.5 transition-all duration-200 relative overflow-hidden group
        ${selected ? "border-primary bg-base-100 shadow-md" : "border-transparent bg-base-200 hover:border-primary/20 hover:shadow-sm"}`}>

      {/* Status accent bar */}
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full ${cfg.dot}`} />

      <div className="flex items-start justify-between gap-2 mb-2 pl-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-primary/60">#{order.orderId?.slice(-10) || "—"}</span>
            <RxBadge status={order.prescription?.verificationStatus} />
            {order.isReturnPending && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">↩ Return</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Avatar name={order.customer?.name} src={order.customer?.avatar} />
            <span className="text-xs font-extrabold text-base-content truncate">{order.customer?.name || "Unknown"}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-sm font-extrabold text-base-content">{fmt(order.billing?.totalPayable)}</span>
          <StatusBadge status={order.delivery?.status} sm />
        </div>
      </div>

      <div className="pl-3">
        <p className="text-[10px] text-base-content/40 truncate mb-2">
          {names.slice(0, 3).join(" · ") || "No items"}
          {itemCount > 0 && <span className="text-primary/50"> ({itemCount} unit{itemCount !== 1 ? "s" : ""})</span>}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-base-300/60 text-base-content/50">{order.payment?.method || "—"}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${payStatusCls}`}>{order.payment?.status || "—"}</span>
          <span className="text-[9px] text-base-content/30 ml-auto">{fmtShort(order.createdAt)}</span>
        </div>
      </div>

      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary animate-pulse" />
      )}
    </motion.button>
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
  const canRefund    = !!order.payment?.razorpayPaymentId && order.payment?.status === "Paid" && !["Processed","In-Progress"].includes(order.cancellation?.refundStatus);
  const canAssignDrv = ["Processing","Out-for-Delivery"].includes(currentStatus);

  const payPillCls =
    order.payment?.status === "Paid"     ? "bg-success/10 text-success" :
    order.payment?.status === "Refunded" ? "bg-info/10 text-info"       :
                                           "bg-warning/10 text-warning";

  // Action button classes
  const btnP = "inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-content hover:brightness-110 shadow-sm px-3.5 py-2";
  const btnS = "inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none bg-base-200 text-base-content hover:bg-base-300 px-3.5 py-2";
  const btnE = "inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none bg-error/10 text-error border border-error/30 hover:bg-error/20 px-3.5 py-2";
  const btnG = "inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none bg-success/10 text-success border border-success/30 hover:bg-success/20 px-3.5 py-2";
  const btnW = "inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 px-3.5 py-2";
  const btnO = "inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none bg-warning/15 text-warning border border-warning/40 hover:bg-warning/25 px-3.5 py-2";

  return (
    <div className="space-y-4">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-base-200">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono text-primary/50 mb-1.5 truncate">#{order.orderId}</p>
          <div className="flex items-center gap-2.5 mb-2.5">
            <Avatar name={order.customer?.name} src={order.customer?.avatar} size="lg" />
            <div>
              <h2 className="text-base font-extrabold text-base-content leading-tight">{order.customer?.name || "—"}</h2>
              <p className="text-[10px] text-base-content/40">{order.customer?.email || "—"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={currentStatus} />
            <RxBadge status={order.prescription?.verificationStatus} />
            {order.isReturnPending && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30">⚡ Return Pending</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-extrabold text-primary leading-none">{fmt(order.billing?.totalPayable)}</p>
          <p className="text-[10px] text-base-content/40 mt-1">{fmtD(order.createdAt)}</p>
          <span className={`mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${payPillCls}`}>{order.payment?.method} · {order.payment?.status}</span>
        </div>
      </div>

      {/* ── ACTION BAR ── */}
      <div className="rounded-2xl border border-base-200 overflow-hidden">
        <div className="px-4 py-3 bg-base-200/60 border-b border-base-200">
          <p className="text-[9px] font-extrabold text-base-content/30 uppercase tracking-widest">
            Available Actions — <span className="text-primary/60">{currentStatus?.replace(/_/g, " ")}</span>
          </p>
        </div>
        <div className="p-3 flex flex-wrap gap-2">
          {currentStatus === "Placed" && order.prescription?.isRequired && !order.prescription?.isVerified && (
            <button onClick={() => onAction("verifyRx")} disabled={!!loadingAction} className={btnW}>
              {loadingAction === "verifyRx" ? <Spin /> : <ClipboardCheck size={13} />} Verify Rx
            </button>
          )}
          {currentStatus === "Placed" && (
            <button onClick={() => onAction("confirm")} disabled={!!loadingAction} className={btnG}>
              {loadingAction === "confirm" ? <Spin /> : <PackageCheck size={13} />} Confirm
            </button>
          )}
          {hasForward && (
            <button onClick={() => onAction("updateStatus")} disabled={!!loadingAction} className={btnP}>
              {loadingAction === "updateStatus" ? <Spin /> : <Activity size={13} />} Advance Status
            </button>
          )}
          {canAssignDrv && (
            <button onClick={() => onAction("assignDriver")} disabled={!!loadingAction} className={btnW}>
              {loadingAction === "assignDriver" ? <Spin /> : <UserCheck size={13} />} Assign Partner
            </button>
          )}
          {currentStatus === "Return_Requested" && (
            <button onClick={() => onAction("acceptReturn")} disabled={!!loadingAction} className={btnO}>
              {loadingAction === "acceptReturn" ? <Spin /> : <RotateCcw size={13} />} Accept Return
            </button>
          )}
          {canRefund && (
            <button onClick={() => onAction("refund")} disabled={!!loadingAction} className={btnE}>
              {loadingAction === "refund" ? <Spin /> : <CreditCard size={13} />} Refund
            </button>
          )}
          {currentStatus === "Pickup_Done" && (
            <button onClick={() => onAction("verifyPickup")} disabled={!!loadingAction} className={btnP}>
              {loadingAction === "verifyPickup" ? <Spin /> : <Scan size={13} />} Verify Pickup
            </button>
          )}
          <button onClick={() => onAction("addNote")} disabled={!!loadingAction} className={btnS}>
            {loadingAction === "addNote" ? <Spin /> : <StickyNote size={13} />} Note
          </button>
          <button onClick={() => onAction("export")} disabled={!!loadingAction} className={btnS}>
            {loadingAction === "export" ? <Spin /> : <FileDown size={13} />} Export
          </button>
          <button onClick={() => onAction("invoice")} disabled={!!loadingAction} className={btnS}>
            {loadingAction === "invoice" ? <Spin /> : <FileText size={13} />} Invoice
          </button>
          <button onClick={() => onAction("label")} disabled={!!loadingAction} className={btnS}>
            {loadingAction === "label" ? <Spin /> : <Tag size={13} />} Label
          </button>
          {canCancel && (
            <button onClick={() => onAction("cancel")} disabled={!!loadingAction} className={btnE}>
              {loadingAction === "cancel" ? <Spin /> : <Ban size={13} />} Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── DETAIL SECTIONS ── */}

      <Section id="items" title={`Order Items (${order.items?.length || 0})`} icon={ShoppingBag} badge={order.items?.length} expanded={!!expanded.items} onToggle={toggle}>
        <div className="space-y-2 mb-4">
          {(order.items || []).map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-base-200/60 border border-base-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center shrink-0"><Pill size={14} className="text-primary" /></div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-base-content truncate">{item.brandName || item.name}</p>
                  <p className="text-[10px] text-base-content/40 truncate">{item.genericName || item.name}{item.gstPercentage !== undefined && ` · GST ${item.gstPercentage}%`}{item.isPrescriptionRequired && " · Rx"}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold text-base-content">{fmt(item.totalPrice)}</p>
                <p className="text-[10px] text-base-content/40">×{item.quantity} @ {fmt(item.pricePerUnit)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5 pt-3 border-t border-base-200">
          {[["Subtotal", fmt(order.billing?.subTotal)],["GST", fmt(order.billing?.gstAmount)],["Delivery", fmt(order.billing?.deliveryCharges)],["Platform Fee", fmt(order.billing?.platformFee)],["Discount", order.billing?.discountAmount > 0 ? `–${fmt(order.billing.discountAmount)}` : "—"],["Wallet Used", order.billing?.walletAmountUsed > 0 ? fmt(order.billing.walletAmountUsed) : "—"]].map(([l,v]) => (
            <div key={l} className="flex justify-between text-[10px] text-base-content/50"><span>{l}</span><span className="font-semibold">{v}</span></div>
          ))}
          <div className="flex justify-between text-sm font-extrabold text-base-content pt-2 border-t border-base-200">
            <span>Total Payable</span><span className="text-primary">{fmt(order.billing?.totalPayable)}</span>
          </div>
        </div>
      </Section>

      <Section id="rx" title="Prescription" icon={FlaskConical} expanded={!!expanded.rx} onToggle={toggle}>
        {order.prescription?.isRequired ? (
          <div className="space-y-3">
            <div className="flex items-center flex-wrap gap-2">
              <RxBadge status={order.prescription.verificationStatus} />
              {order.prescription.uploadedAt && <span className="text-[10px] text-base-content/40">Uploaded {fmtD(order.prescription.uploadedAt)}</span>}
              {order.prescription.verifiedAt && <span className="text-[10px] text-base-content/40">· Verified {fmtD(order.prescription.verifiedAt)}</span>}
            </div>
            {order.prescription.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-base-200">
                <img src={order.prescription.imageUrl} alt="Rx" className="w-full h-36 object-cover" onError={e => { e.target.parentElement.style.display = "none"; }} />
              </div>
            )}
            {order.prescription.verificationNotes && <div className="p-2.5 rounded-xl bg-info/10 border border-info/30"><p className="text-[10px] font-bold text-info mb-1">Notes</p><p className="text-xs text-base-content">{order.prescription.verificationNotes}</p></div>}
            {order.prescription.rejectionReason && <div className="p-2.5 rounded-xl bg-error/10 border border-error/30 flex items-start gap-2"><AlertTriangle size={11} className="text-error mt-0.5 shrink-0" /><p className="text-xs text-error">{order.prescription.rejectionReason}</p></div>}
          </div>
        ) : <div className="flex items-center gap-2 text-xs text-base-content/40"><CheckCircle2 size={13} className="text-success" /> No prescription required</div>}
      </Section>

      <Section id="delivery" title="Customer & Delivery" icon={MapPin} expanded={!!expanded.delivery} onToggle={toggle}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <InfoRow icon={User}   label="Customer" value={order.customer?.name} />
          <InfoRow icon={Phone}  label="Phone"    value={order.customer?.phone} />
          <InfoRow icon={Mail}   label="Email"    value={order.customer?.email} />
          <InfoRow icon={Truck}  label="Delivery" value={order.delivery?.deliveryType} />
          {order.delivery?.address && <div className="col-span-2"><InfoRow icon={MapPin} label="Address" value={[order.delivery.address.line1, order.delivery.address.landmark, order.delivery.address.city, order.delivery.address.pincode].filter(Boolean).join(", ")} /></div>}
          {order.delivery?.estimatedArrival && <InfoRow icon={Calendar} label="ETA" value={fmtD(order.delivery.estimatedArrival)} />}
          {order.delivery?.deliveredAt && <InfoRow icon={CheckCheck} label="Delivered" value={fmtD(order.delivery.deliveredAt)} />}
        </div>
        {order.delivery?.internalPartner && (
          <div className="p-3 rounded-xl bg-base-200/60 border border-base-200 flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-xl bg-primary/8 flex items-center justify-center shrink-0"><UserCheck size={13} className="text-primary" /></div>
            <div><p className="text-xs font-bold text-base-content">{order.delivery.internalPartner?.name || "Partner assigned"}</p>{order.delivery.internalPartner?.phone && <p className="text-[10px] text-base-content/40">{order.delivery.internalPartner.phone}</p>}</div>
            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Internal</span>
          </div>
        )}
        {(order.delivery?.externalPartner?.agencyName || order.delivery?.externalPartner?.name) && (
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/30">
            <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">External Courier</p>
            <div className="grid grid-cols-2 gap-2">
              {order.delivery.externalPartner.agencyName && <InfoRow icon={PackageOpen} label="Agency" value={order.delivery.externalPartner.agencyName} />}
              {order.delivery.externalPartner.name && <InfoRow icon={User} label="Person" value={order.delivery.externalPartner.name} />}
            </div>
            {order.delivery.externalPartner.trackingUrl && <a href={order.delivery.externalPartner.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline mt-2 inline-flex items-center gap-1"><Navigation size={9} /> Track shipment →</a>}
          </div>
        )}
      </Section>

      <Section id="payment" title="Payment Details" icon={IndianRupee} expanded={!!expanded.payment} onToggle={toggle}>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <InfoRow icon={Banknote}     label="Method" value={order.payment?.method} />
          <InfoRow icon={CheckCircle2} label="Status" value={order.payment?.status} />
          <InfoRow icon={RefreshCw}    label="Refund" value={order.cancellation?.refundStatus || "None"} />
        </div>
        {order.payment?.razorpayPaymentId && <InfoRow icon={Hash} label="Razorpay Payment ID" mono value={order.payment.razorpayPaymentId} />}
        {order.payment?.paidAt && <div className="mt-2"><InfoRow icon={Calendar} label="Paid At" value={fmtD(order.payment.paidAt)} /></div>}
        {(order.payment?.transactionLog?.length || 0) > 0 && (
          <div className="mt-3 pt-3 border-t border-base-200">
            <p className="text-[9px] font-bold text-base-content/40 uppercase tracking-wider mb-2">Transaction Log (last {Math.min(3, order.payment.transactionLog.length)})</p>
            {order.payment.transactionLog.slice(-3).map((t, i) => (
              <div key={i} className="flex justify-between text-[10px] text-base-content/50 mb-1">
                <span>{t.action} · <span className="font-semibold">{t.status}</span></span>
                <span>{fmtShort(t.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {(order.delivery?.statusHistory?.length || 0) > 0 && (
        <Section id="timeline" title="Status Timeline" icon={Activity} badge={order.delivery.statusHistory.length} expanded={!!expanded.timeline} onToggle={toggle}>
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2.5 top-1 bottom-1 w-px bg-gradient-to-b from-primary to-base-300" />
            {[...order.delivery.statusHistory].reverse().map((h, i) => {
              const cfg = STATUS_CFG[h.status] || STATUS_CFG.Placed;
              return (
                <div key={i} className="relative">
                  <div className={`absolute -left-3.5 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-base-300 shadow-sm ${cfg.dot}`} />
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5"><StatusBadge status={h.status} sm />{h.note && <span className="text-[10px] text-base-content/40 italic">"{h.note}"</span>}</div>
                  <p className="text-[10px] text-base-content/40">{fmtD(h.timestamp)}{h.changedBy?.name && ` · ${h.changedBy.name}`}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {(order.cancellation?.isReturnRequested || order.cancellation?.isCancelled) && (
        <Section id="return" title="Return / Cancellation" icon={RotateCcw} expanded={!!expanded.return} onToggle={toggle} accent>
          <div className="grid grid-cols-2 gap-3">
            {order.cancellation.returnReason && <div className="col-span-2"><InfoRow icon={AlertCircle} label="Return Reason" value={order.cancellation.returnReason} /></div>}
            {order.cancellation.returnDecision && <InfoRow icon={CheckCircle2} label="Decision" value={order.cancellation.returnDecision} />}
            {order.cancellation.selectedRefundMethod && <InfoRow icon={CreditCard} label="Refund Method" value={order.cancellation.selectedRefundMethod} />}
            {order.cancellation.refundAmount > 0 && <InfoRow icon={IndianRupee} label="Refund Amount" value={fmt(order.cancellation.refundAmount)} />}
            {order.cancellation.refundStatus && order.cancellation.refundStatus !== "None" && <InfoRow icon={RefreshCw} label="Refund Status" value={order.cancellation.refundStatus} />}
            {order.cancellation.pickupConditionGood !== undefined && <InfoRow icon={Scan} label="Pickup Condition" value={order.cancellation.pickupConditionGood ? "✓ Good" : "✗ Poor"} />}
            {order.cancellation.refundId && <div className="col-span-2"><InfoRow icon={Hash} label="Razorpay Refund ID" mono value={order.cancellation.refundId} /></div>}
          </div>
        </Section>
      )}

      <Section id="notes" title="Admin Notes" icon={StickyNote} badge={order.adminNotes?.length || 0} expanded={!!expanded.notes} onToggle={toggle}>
        {!order.adminNotes?.length ? (
          <p className="text-xs text-base-content/40">No notes yet. Use the Note button to add one.</p>
        ) : (
          <div className="space-y-2">
            {[...order.adminNotes].reverse().map((n, i) => (
              <div key={i} className="p-3 rounded-xl bg-warning/10 border border-warning/30">
                <p className="text-xs text-base-content leading-relaxed">{n.text}</p>
                <p className="text-[10px] text-warning/70 mt-1.5 flex items-center gap-1"><User size={9} />{n.addedBy?.name || "Staff"} · {fmtD(n.addedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {order.customerFeedback?.rating && (
        <Section id="feedback" title="Customer Feedback" icon={Star} expanded={!!expanded.feedback} onToggle={toggle}>
          <div className="flex items-center gap-1.5 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (<Star key={i} size={16} className={i < order.customerFeedback.rating ? "text-warning fill-warning" : "text-base-300 fill-base-300"} />))}
            <span className="text-sm font-extrabold text-base-content ml-1">{order.customerFeedback.rating}/5</span>
          </div>
          {order.customerFeedback.comment && <p className="text-xs text-base-content/60 italic leading-relaxed">"{order.customerFeedback.comment}"</p>}
        </Section>
      )}

      {order.deliveryOtp?.sentAt && !order.deliveryOtp?.verified && (
        <div className="p-3 rounded-xl bg-info/10 border border-info/30 flex items-center gap-2.5">
          <Shield size={14} className="text-info shrink-0" />
          <div>
            <p className="text-xs font-bold text-info">Delivery OTP Sent</p>
            <p className="text-[10px] text-info/70">Emailed to customer at {fmtD(order.deliveryOtp.sentAt)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § STAT CARD
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({ label, value, icon: Icon, color, sub, trend, index }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-success/10 text-success",
    orange:  "bg-warning/10 text-warning",
    violet:  "bg-accent/10 text-accent",
    blue:    "bg-info/10 text-info",
    red:     "bg-error/10 text-error",
  };
  return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible"
      className="bg-base-200 rounded-2xl border border-base-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          <Icon size={17} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-[10px] font-bold ${trend >= 0 ? "text-success" : "text-error"}`}>
            {trend >= 0 ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-extrabold text-base-content leading-none mb-1">{value}</p>
      <p className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-[10px] text-base-content/30 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-base-content/30">
      <Icon size={44} strokeWidth={1.2} />
      <p className="text-sm font-semibold">{title}</p>
      {desc && <p className="text-xs text-center max-w-[200px]">{desc}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// § MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PharmacyOrderManagement() {
  const dispatch = useDispatch();

  const {
    orders, ordersPagination, currentOrder,
    currentOrderInvoiceHtml, currentOrderLabelHtml, exportedOrder,
    loading, errors,
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
  const [detailOpen,      setDetailOpen]       = useState(false); // mobile: show detail
  const hasFetchedRef = useRef(false);

  // ── Fetch on filter change ────────────────────────────────────────────────
  useEffect(() => {
    if (dateFilter === "custom" && (!customStartDate || !customEndDate)) return;
    hasFetchedRef.current = false;
    dispatch(fetchOrders({
      dateFilter,
      startDate: dateFilter === "custom" ? customStartDate : undefined,
      endDate:   dateFilter === "custom" ? customEndDate   : undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      page, limit: 20,
    }));
  }, [dispatch, dateFilter, statusFilter, page, customStartDate, customEndDate]);

  // ── Auto-select first order ───────────────────────────────────────────────
  useEffect(() => {
    if (hasFetchedRef.current) return;
    if (orders.length === 0) return;
    hasFetchedRef.current = true;
    if (!selectedOrderId) {
      setSelectedOrderId(orders[0].orderId);
      dispatch(fetchOrderDetails(orders[0].orderId));
    }
  }, [orders]);

  // ── Invoice auto-download ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentOrderInvoiceHtml) return;
    const blob = new Blob([currentOrderInvoiceHtml], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `invoice-${currentOrder?.orderId || Date.now()}.html` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    dispatch(clearOrderDocuments()); setActiveAction(null); setLoadingAction(null);
  }, [currentOrderInvoiceHtml]);

  // ── Label auto-download ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentOrderLabelHtml) return;
    const blob = new Blob([currentOrderLabelHtml], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `label-${currentOrder?.orderId || Date.now()}.html` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    dispatch(clearOrderDocuments()); setActiveAction(null); setLoadingAction(null);
  }, [currentOrderLabelHtml]);

  // ── Export JSON auto-download ─────────────────────────────────────────────
  useEffect(() => {
    if (!exportedOrder) return;
    const blob = new Blob([JSON.stringify(exportedOrder, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `order-${exportedOrder.orderId || Date.now()}.json` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    dispatch(clearExportedOrder()); setActiveAction(null); setLoadingAction(null);
  }, [exportedOrder]);

  const handleSelectOrder = useCallback((order) => {
    setSelectedOrderId(order.orderId);
    dispatch(fetchOrderDetails(order.orderId));
    setActiveAction(null);
    setLoadingAction(null);
    setDetailOpen(true); // mobile: open detail
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
            dateFilter, startDate: dateFilter === "custom" ? customStartDate : undefined,
            endDate: dateFilter === "custom" ? customEndDate : undefined,
            status: statusFilter === "all" ? undefined : statusFilter, page, limit: 20,
          }));
        }
        setLoadingAction(null);
      }
    } catch { setLoadingAction(null); }
  }, [dispatch, selectedOrderId, dateFilter, statusFilter, page, customStartDate, customEndDate]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchOrders({ dateFilter, startDate: dateFilter === "custom" ? customStartDate : undefined, endDate: dateFilter === "custom" ? customEndDate : undefined, status: statusFilter === "all" ? undefined : statusFilter, page }));
    if (selectedOrderId) dispatch(fetchOrderDetails(selectedOrderId));
  }, [dispatch, dateFilter, statusFilter, page, selectedOrderId, customStartDate, customEndDate]);

  const filteredOrders = orders.filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (o.orderId || "").toLowerCase().includes(q) || (o.customer?.name || "").toLowerCase().includes(q) || (o.customer?.phone || "").includes(q);
  });

  // ── Analytics data ────────────────────────────────────────────────────────
  const totalRevenue   = orders.filter(o => o.payment?.status === "Paid").reduce((s, o) => s + (o.billing?.totalPayable || 0), 0);
  const pendingRx      = orders.filter(o => o.prescription?.verificationStatus === "Pending").length;
  const pendingReturns = orders.filter(o => o.delivery?.status === "Return_Requested").length;
  const deliveredCount = orders.filter(o => o.delivery?.status === "Delivered").length;

  const statusDistribution = Object.entries(orders.reduce((acc, o) => {
    const s = o.delivery?.status || "Unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {})).filter(([, v]) => v > 0).map(([name, value], i) => ({
    name: STATUS_CFG[name]?.label || name, value,
    color: ["var(--success)","var(--info)","var(--primary)","var(--warning)","var(--error)","var(--accent)","var(--secondary)","var(--neutral)"][i % 8],
  }));

  const revenueByDate = Object.entries(orders.filter(o => o.payment?.status === "Paid").reduce((acc, o) => {
    const d = new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    if (!acc[d]) acc[d] = { revenue: 0, orders: 0 };
    acc[d].revenue += o.billing?.totalPayable || 0; acc[d].orders += 1;
    return acc;
  }, {})).map(([day, v]) => ({ day, ...v })).slice(-10);

  const SIDEBAR_TITLES = {
    verifyRx:     { title: "Verify Prescription",   subtitle: "Route 03 · verify-prescription" },
    confirm:      { title: "Confirm Order",          subtitle: "Route 04 · confirm" },
    updateStatus: { title: "Advance Order Status",   subtitle: "Route 05 · status" },
    cancel:       { title: "Cancel Order",           subtitle: "Route 05 · status → Cancelled" },
    assignDriver: { title: "Assign Delivery Partner",subtitle: "Route 09 · assign-delivery-partner" },
    acceptReturn: { title: "Accept Return Request",  subtitle: "Route 06 · return-accept" },
    refund:       { title: "Process Refund",         subtitle: "Route 07 · process-refund" },
    verifyPickup: { title: "Verify Pickup Condition",subtitle: "Route 11 · pickup-verify" },
    addNote:      { title: "Add Internal Note",      subtitle: "Route 08 · add-admin-note" },
    export:       { title: "Export Order",           subtitle: "Route 10 · export" },
    invoice:      { title: "Download Invoice",       subtitle: "Route 12 · invoice" },
    label:        { title: "Download Delivery Label",subtitle: "Route 13 · label" },
  };

  const sidebarInfo = SIDEBAR_TITLES[activeAction] || {};

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200 font-poppins overflow-x-hidden">

      {/* ── RIGHT SIDEBAR (replaces modal) ─────────────────────────────────── */}
      <ActionSidebar
        open={!!activeAction}
        onClose={() => { setActiveAction(null); setLoadingAction(null); }}
        title={sidebarInfo.title || activeAction}
        subtitle={sidebarInfo.subtitle}>
        {activeAction && currentOrder && (
          <ActionSidebarBody
            action={activeAction}
            order={currentOrder}
            onSubmit={handleActionSubmit}
            onClose={() => { setActiveAction(null); setLoadingAction(null); }}
            isLoading={!!loadingAction}
          />
        )}
      </ActionSidebar>

      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/95 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Mobile back button — shown when viewing detail */}
            {detailOpen && (
              <button onClick={() => setDetailOpen(false)}
                className="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center bg-base-200 text-base-content/60">
                <ChevronLeft size={16} />
              </button>
            )}
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
            {[{ id: "orders", label: "Orders", icon: ShoppingBag }, { id: "analytics", label: "Analytics", icon: BarChart2 }].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${activeTab === t.id ? "bg-base-100 text-primary shadow-sm" : "text-base-content/50 hover:text-base-content"}`}>
                <t.icon size={12} />{t.label}
              </button>
            ))}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-base-content/50 font-semibold">Store Open</span>
            </div>
            <button onClick={handleRefresh} disabled={loading.orders}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-base-200 hover:bg-base-300 text-base-content/50 transition-all">
              <RefreshCw size={14} className={loading.orders ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-5">

        {/* ═══════════════════════════════════════════════════════════════════
            ORDERS TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "orders" && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <StatCard label="Total Orders"    value={ordersPagination?.totalItems || orders.length} icon={Package}      color="primary" index={0} />
              <StatCard label="Paid Revenue"    value={fmt(totalRevenue)}                             icon={IndianRupee}  color="emerald" index={1} sub={`${orders.filter(o => o.payment?.status === "Paid").length} paid orders`} />
              <StatCard label="Return Requests" value={pendingReturns}                                icon={RotateCcw}    color="orange"  index={2} sub="Awaiting acceptance" />
              <StatCard label="Rx Pending"      value={pendingRx}                                     icon={FlaskConical} color="violet"  index={3} sub="To verify" />
            </div>

            {/* Search + date filter */}
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible"
              className="flex gap-2 mb-3 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-0">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" />
                <input
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                  placeholder="Search by order ID, name, phone…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <select
                className="px-3.5 py-2.5 rounded-xl border border-base-300 bg-base-200 text-sm text-base-content focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all cursor-pointer w-full sm:w-auto"
                value={dateFilter}
                onChange={e => { setDateFilter(e.target.value); setPage(1); }}>
                {DATE_FILTERS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </motion.div>

            {/* Custom date range */}
            <AnimatePresence>
              {dateFilter === "custom" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mb-3 overflow-hidden">
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider block mb-1">Start Date</label>
                      <input type="date" className="w-full px-3 py-2 rounded-lg border border-base-300 bg-base-200 text-sm text-base-content focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" value={customStartDate} max={customEndDate || undefined} onChange={e => { setCustomStartDate(e.target.value); setPage(1); }} />
                    </div>
                    <div className="flex items-end pb-2 shrink-0 text-base-content/30"><ChevronRight size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider block mb-1">End Date</label>
                      <input type="date" className="w-full px-3 py-2 rounded-lg border border-base-300 bg-base-200 text-sm text-base-content focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all" value={customEndDate} min={customStartDate || undefined} onChange={e => { setCustomEndDate(e.target.value); setPage(1); }} />
                    </div>
                    {(customStartDate || customEndDate) && (
                      <button onClick={() => { setCustomStartDate(""); setCustomEndDate(""); }} className="self-end mb-0.5 text-[10px] text-base-content/40 hover:text-base-content flex items-center gap-1 shrink-0 px-2 py-2">
                        <X size={12} /> Clear
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status filter pills */}
            <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible"
              className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-thin">
              {STATUS_TABS.map(t => {
                const count = t.value === "all" ? orders.length : orders.filter(o => o.delivery?.status === t.value).length;
                return (
                  <button key={t.value}
                    onClick={() => { setStatusFilter(t.value); setPage(1); }}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all
                      ${statusFilter === t.value ? "bg-primary text-primary-content border-primary shadow-sm" : "bg-base-200 border-base-200 text-base-content/60 hover:border-primary/30 hover:text-base-content"}`}>
                    <t.icon size={10} />
                    {t.label}
                    {count > 0 && (
                      <span className={`ml-0.5 min-w-[16px] h-4 rounded-full text-[8px] font-extrabold px-1 flex items-center justify-center
                        ${statusFilter === t.value ? "bg-primary-content/20 text-primary-content" : "bg-base-300/60 text-base-content/50"}`}>
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
                <button onClick={() => dispatch(clearError("orders"))} className="ml-auto text-error/60 hover:text-error"><X size={13} /></button>
              </div>
            )}

            {/* 2-column layout — list + detail */}
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] gap-4 items-start">

              {/* LEFT: Order list — hidden on mobile when detail open */}
              <div className={`lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-130px)] lg:overflow-y-auto space-y-2 pr-0.5 scrollbar-thin ${detailOpen ? "hidden lg:block" : "block"}`}>
                {loading.orders && orders.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-base-content/30">
                    <Spin size={28} />
                    <p className="text-xs font-semibold">Fetching orders…</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <EmptyState icon={Inbox} title="No orders found"
                    desc={dateFilter === "custom" && (!customStartDate || !customEndDate) ? "Select start and end dates to search" : "Try a different date or status filter"} />
                ) : (
                  <>
                    <p className="text-[10px] text-base-content/40 font-semibold pb-1">
                      {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
                      {searchQuery && ` matching "${searchQuery}"`}
                    </p>
                    {filteredOrders.map((order, i) => (
                      <OrderCard
                        key={order._id || order.orderId}
                        order={order} index={i}
                        selected={selectedOrderId === order.orderId}
                        onClick={() => handleSelectOrder(order)} />
                    ))}
                    {ordersPagination?.totalPages > 1 && (
                      <div className="flex items-center justify-between gap-2 pt-2 pb-1">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                          className="inline-flex items-center gap-1 rounded-xl text-xs font-semibold bg-base-200 text-base-content hover:bg-base-300 px-3 py-1.5 disabled:opacity-40">
                          <ChevronLeft size={13} /> Prev
                        </button>
                        <span className="text-xs text-base-content/50 font-bold">
                          {page} / {ordersPagination.totalPages}
                          <span className="text-[10px] text-base-content/30 ml-1">({ordersPagination.totalItems} total)</span>
                        </span>
                        <button disabled={page >= ordersPagination.totalPages} onClick={() => setPage(p => p + 1)}
                          className="inline-flex items-center gap-1 rounded-xl text-xs font-semibold bg-base-200 text-base-content hover:bg-base-300 px-3 py-1.5 disabled:opacity-40">
                          Next <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT: Detail panel — full screen on mobile when open */}
              <AnimatePresence mode="wait">
                {loading.orderDetails ? (
                  <motion.div key="loading-detail"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={`flex flex-col items-center justify-center gap-3 bg-base-100 rounded-2xl border border-base-200 min-h-[500px] text-base-content/30 ${detailOpen ? "block" : "hidden lg:flex"}`}>
                    <Spin size={28} />
                    <p className="text-xs font-semibold">Loading order details…</p>
                  </motion.div>
                ) : currentOrder ? (
                  <motion.div
                    key={currentOrder._id || currentOrder.orderId}
                    variants={slideIn} initial="hidden" animate="visible" exit="exit"
                    className={`bg-base-100 rounded-2xl border border-base-200 shadow-sm p-5 lg:max-h-[calc(100vh-130px)] lg:overflow-y-auto scrollbar-thin ${detailOpen ? "block" : "hidden lg:block"}`}>
                    <OrderDetail
                      order={currentOrder}
                      onAction={setActiveAction}
                      loadingAction={loadingAction} />
                  </motion.div>
                ) : (
                  <motion.div key="empty-detail"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="hidden lg:flex flex-col items-center justify-center gap-4 bg-base-100 rounded-2xl border-2 border-dashed border-base-200 min-h-[500px] text-base-content/20">
                    <div className="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center">
                      <Eye size={28} strokeWidth={1} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold mb-1">No order selected</p>
                      <p className="text-xs">Click any order card to view full details</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ANALYTICS TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "analytics" && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-5">

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Revenue"  value={fmt(totalRevenue)} icon={TrendingUp} color="primary" index={0} />
              <StatCard label="Orders Period"  value={orders.length}     icon={Package}    color="blue"    index={1} />
              <StatCard label="Delivered"      value={deliveredCount}    icon={CheckCheck} color="emerald" index={2} />
              <StatCard label="Active Returns" value={pendingReturns}    icon={RotateCcw}  color="orange"  index={3} />
            </div>

            {/* Revenue trend */}
            <div className="bg-base-100 rounded-2xl border border-base-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-base-content">Revenue Trend</h3>
                  <p className="text-[10px] text-base-content/40 mt-0.5">From paid orders in current filter period</p>
                </div>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">{fmt(totalRevenue)}</span>
              </div>
              {revenueByDate.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revenueByDate} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={v => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--base-300)", background: "var(--base-100)", color: "var(--base-content)", fontSize: 11 }} />
                    <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={BarChart2} title="No paid orders in this period" />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Status distribution */}
              <div className="bg-base-100 rounded-2xl border border-base-200 p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-base-content mb-0.5">Status Distribution</h3>
                <p className="text-[10px] text-base-content/40 mb-4">Orders by delivery status</p>
                {statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value">
                        {statusDistribution.map((s, i) => <Cell key={i} fill={s.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--base-300)", background: "var(--base-100)", color: "var(--base-content)", fontSize: 11 }} />
                      <Legend formatter={v => <span style={{ fontSize: 10, color: "var(--base-content)" }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyState icon={Layers} title="No orders in filter" />}
              </div>

              {/* Payment method breakdown */}
              <div className="bg-base-100 rounded-2xl border border-base-200 p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-base-content mb-0.5">Payment Methods</h3>
                <p className="text-[10px] text-base-content/40 mb-4">Order count by method</p>
                {(() => {
                  const methodData = Object.entries(orders.reduce((acc, o) => {
                    const m = o.payment?.method || "Unknown";
                    acc[m] = (acc[m] || 0) + 1;
                    return acc;
                  }, {})).map(([name, value]) => ({ name, value }));
                  return methodData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={methodData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--base-300)", background: "var(--base-100)", color: "var(--base-content)", fontSize: 11 }} />
                        <Bar dataKey="value" name="Orders" fill="var(--secondary)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState icon={BarChart2} title="No data" />;
                })()}
              </div>
            </div>

            {/* Order lifecycle reference */}
            <div className="bg-base-100 rounded-2xl border border-base-200 p-5 shadow-sm">
              <h3 className="text-sm font-extrabold text-base-content mb-0.5">Order Lifecycle Reference</h3>
              <p className="text-[10px] text-base-content/40 mb-5">Every action maps 1:1 to a Redux thunk + Express route on /pharmacy-store</p>
              <div className="space-y-0">
                {[
                  { step: 1, from: "Placed",           thunk: "verifyPrescription",   route: "03", desc: "Check Rx image; isVerified bool required; rejectionReason required when false.", icon: ClipboardCheck, color: "text-accent" },
                  { step: 2, from: "Placed",           thunk: "confirmOrder",          route: "04", desc: "deliveryType required; partner fields optional → Confirmed.", icon: PackageCheck, color: "text-success" },
                  { step: 3, from: "Confirmed",        thunk: "updateOrderStatus",     route: "05", desc: "→ Processing. Order moves to pharmacy picking queue.", icon: Activity, color: "text-info" },
                  { step: 4, from: "Processing",       thunk: "assignDeliveryPartner", route: "09", desc: "Sets delivery.internalPartner. Do before OFD transition.", icon: UserCheck, color: "text-warning" },
                  { step: 5, from: "Processing",       thunk: "updateOrderStatus",     route: "05", desc: "→ Out-for-Delivery. Auto-generates 6-digit OTP, emails to customer.", icon: Truck, color: "text-secondary" },
                  { step: 6, from: "Out-for-Delivery", thunk: "updateOrderStatus",     route: "05", desc: "→ Delivered. COD auto-Paid + paidAt stamped by pre-save hook.", icon: CheckCheck, color: "text-success" },
                  { step: 7, from: "Return_Requested", thunk: "acceptReturn",          route: "06", desc: "→ Return_Accepted. returnDecision=Accepted. pickupPartner optional.", icon: RotateCcw, color: "text-warning" },
                  { step: 8, from: "Return_Accepted",  thunk: "updateOrderStatus",     route: "05", desc: "→ Pickup_Assigned → Pickup_Done.", icon: Navigation, color: "text-accent" },
                  { step: 9, from: "Pickup_Done",      thunk: "verifyPickup",          route: "11", desc: "Good → Returned + refund. Bad → rejected.", icon: Scan, color: "text-success" },
                  { step: "●", from: "Any",            thunk: "addOrderNote",          route: "08", desc: "Appended to adminNotes[]. Never visible to customers.", icon: StickyNote, color: "text-warning" },
                  { step: "●", from: "Razorpay paid",  thunk: "processRefund",         route: "07", desc: "razorpay.payments.refund(). Amount ₹ → paise. Requires razorpayPaymentId.", icon: CreditCard, color: "text-error" },
                  { step: "●", from: "Any",            thunk: "exportOrder",           route: "10", desc: "findOrderPopulated with virtuals → stored in exportedOrder, NOT currentOrder.", icon: FileDown, color: "text-info" },
                  { step: "●", from: "Any",            thunk: "fetchOrderInvoice",     route: "12", desc: "responseType:'text'. Raw HTML → auto-downloads as invoice-{orderId}.html.", icon: FileText, color: "text-secondary" },
                  { step: "●", from: "Any",            thunk: "fetchOrderLabel",       route: "13", desc: "responseType:'text'. Raw HTML → auto-downloads as label-{orderId}.html.", icon: Tag, color: "text-accent" },
                  { step: "✕", from: "Placed–OFD",    thunk: "updateOrderStatus",     route: "05", desc: "status:'Cancelled'. For Razorpay: use processRefund separately.", icon: Ban, color: "text-error" },
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
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-primary/8 rounded-md text-primary/70">Route {row.route}</span>
                        {!["Any","Razorpay paid","Placed–OFD"].includes(row.from) && <StatusBadge status={row.from} sm />}
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