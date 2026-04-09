"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, Search, Filter, Plus, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, Clock, Shield, Car, CreditCard,
  FileText, MapPin, Star, TrendingUp, Activity, Eye,
  Edit, Trash2, Ban, Unlock, UserCheck, Truck, ChevronDown,
  ChevronUp, ChevronLeft, ChevronRight, Download, Bell,
  Settings, MoreVertical, ArrowUpRight, ArrowDownRight,
  BadgeCheck, Zap, Package, DollarSign, X, Upload, Link2,
  StickyNote, RotateCcw, Check, Info, ExternalLink,
} from "lucide-react";

// ── Redux thunks ───────────────────────────────────────────────────────────────
import {
  adminFetchPartnerList,
  adminFetchPartnerDetail,
  adminFetchComplianceAlerts,
  adminVerifyKyc,
  adminVerifyVehicle,
  adminVerifyBank,
  adminUpdatePartnerStatus,
  adminBlockPartner,
  adminCreateCompanionDriver,
  adminUpdatePlatformFee,
  adminUpdateNotes,
  adminCreateSoloDriver,
  selectAdminPartnerList,
  selectAdminPagination,
  selectAdminSelectedPartner,
  selectAdminComplianceAlerts,
  selectAdminComplianceTotal,
  selectAdminLastCreated,
  selectLoading,
  selectError,
} from "@/store/slices/soloDriverSlice";

import { uploadSingleFile } from "@/store/slices/uploadSlice";

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  active:       { label: "Active",       color: "text-success",  bg: "bg-success/10",  border: "border-success/30",  icon: CheckCircle },
  pending:      { label: "Pending",      color: "text-warning",  bg: "bg-warning/10",  border: "border-warning/30",  icon: Clock },
  "under-review": { label: "Under Review", color: "text-info",   bg: "bg-info/10",     border: "border-info/30",     icon: Eye },
  suspended:    { label: "Suspended",    color: "text-error",    bg: "bg-error/10",    border: "border-error/30",    icon: Ban },
  rejected:     { label: "Rejected",     color: "text-error",    bg: "bg-error/10",    border: "border-error/30",    icon: XCircle },
};

const KYC_STATUS_CONFIG = {
  verified:      { label: "Verified",     color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  pending:       { label: "Pending",      color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  "under-review":{ label: "Under Review", color: "text-info",    bg: "bg-info/10",    border: "border-info/30"    },
  "not-submitted":{ label: "Not Submitted",color: "text-neutral-400", bg: "bg-base-300", border: "border-base-300" },
  rejected:      { label: "Rejected",     color: "text-error",   bg: "bg-error/10",   border: "border-error/30"   },
};

const VEHICLE_STATUS_CONFIG = {
  verified:   { label: "Verified",  color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  pending:    { label: "Pending",   color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  "under-review": { label: "Under Review", color: "text-info", bg: "bg-info/10", border: "border-info/30"   },
  rejected:   { label: "Rejected",  color: "text-error",   bg: "bg-error/10",   border: "border-error/30"   },
};

const fadeInUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } } };
const stagger  = { visible: { transition: { staggerChildren: 0.06 } } };

const StatusBadge = ({ status, config }) => {
  const cfg = config[status] || { label: status, color: "text-neutral-400", bg: "bg-base-300", border: "border-base-300" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, trend, color = "primary" }) => (
  <motion.div variants={fadeInUp} className="glass-card p-5 flex items-start gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-${color}/10 border border-${color}/20 shrink-0`}>
      <Icon size={20} className={`text-${color}`} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-base-content/50 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-2xl font-black text-base-content font-montserrat">{value}</p>
      {sub && <p className="text-xs text-base-content/40 mt-0.5">{sub}</p>}
      {trend !== undefined && (
        <p className={`text-xs flex items-center gap-0.5 mt-1 ${trend >= 0 ? "text-success" : "text-error"}`}>
          {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend)}% vs last month
        </p>
      )}
    </div>
  </motion.div>
);

// ══════════════════════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════════════════════

/** Generic confirmation modal */
const ConfirmModal = ({ open, title, description, onConfirm, onCancel, loading, danger = false }) => (
  <AnimatePresence>
    {open && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
        <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
          className="glass-card w-full max-w-md p-6 shadow-xl">
          <h3 className="text-lg font-black font-montserrat text-base-content mb-2">{title}</h3>
          <p className="text-sm text-base-content/60 mb-6">{description}</p>
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="btn-secondary px-4 py-2 text-xs rounded-lg">Cancel</button>
            <button onClick={onConfirm} disabled={loading}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg text-white transition-all ${danger ? "bg-error hover:brightness-110" : "bg-primary hover:brightness-110"} disabled:opacity-50`}>
              {loading ? "Processing…" : "Confirm"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/** Rejection / reason input modal */
const ReasonModal = ({ open, title, placeholder, onSubmit, onClose, loading }) => {
  const [reason, setReason] = useState("");
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
            className="glass-card w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-black font-montserrat text-base-content mb-4">{title}</h3>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
              placeholder={placeholder} className="input-field w-full resize-none mb-4" />
            <div className="flex gap-3 justify-end">
              <button onClick={onClose} className="btn-secondary px-4 py-2 text-xs rounded-lg">Cancel</button>
              <button onClick={() => { if (reason.trim()) { onSubmit(reason); setReason(""); } }} disabled={!reason.trim() || loading}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg text-white bg-error hover:brightness-110 disabled:opacity-50 transition-all">
                {loading ? "Submitting…" : "Submit"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Platform fee override modal */
const PlatformFeeModal = ({ open, onClose, onSubmit, loading, current }) => {
  const [type, setType]   = useState(current?.type || "percentage");
  const [value, setValue] = useState(current?.value ?? "");
  const [cycle, setCycle] = useState("Weekly");

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
            className="glass-card w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black font-montserrat">Platform Fee Override</h3>
              <button onClick={onClose}><X size={18} className="text-base-content/40 hover:text-base-content" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-base-content/60 mb-1.5 block">Fee Type</label>
                <div className="flex gap-3">
                  {["percentage", "fixed"].map(t => (
                    <button key={t} onClick={() => setType(t)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${type === t ? "bg-primary/10 border-primary text-primary" : "border-base-300 text-base-content/50"}`}>
                      {t === "percentage" ? "Percentage %" : "Fixed ₹"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-base-content/60 mb-1.5 block">Value {type === "percentage" ? "(0–100)" : "(INR)"}</label>
                <input type="number" value={value} onChange={e => setValue(e.target.value)} min={0} max={type === "percentage" ? 100 : undefined}
                  placeholder={type === "percentage" ? "e.g. 15" : "e.g. 50"} className="input-field w-full" />
              </div>
              <div>
                <label className="text-xs text-base-content/60 mb-1.5 block">Settlement Cycle</label>
                <select value={cycle} onChange={e => setCycle(e.target.value)} className="input-field w-full">
                  {["Daily", "Weekly", "Bi-Weekly", "Monthly"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={() => onSubmit({ platformFeeOverride: null, settlementCycle: cycle })} className="flex-1 py-2 text-xs rounded-lg border border-base-300 text-base-content/60 hover:border-primary hover:text-primary transition-all">
                  <RotateCcw size={12} className="inline mr-1" /> Use Global
                </button>
                <button onClick={() => onSubmit({ platformFeeOverride: { type, value: Number(value) }, settlementCycle: cycle })}
                  disabled={loading || !value} className="flex-1 py-2 text-xs font-bold rounded-lg bg-primary text-primary-content hover:brightness-110 disabled:opacity-50 transition-all">
                  {loading ? "Saving…" : "Save Override"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Create Solo Driver Partner Modal */
const CreatePartnerModal = ({ open, onClose, onSubmit, loading }) => {
  const dispatch = useDispatch();
  const isUploading = useSelector(s => s.upload?.isUploading);
  const lastUrl     = useSelector(s => s.upload?.lastUploadedUrl);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", legalName: "", displayName: "",
    dateOfBirth: "", gender: "",
    address: { street: "", city: "", state: "", pinCode: "", country: "India" },
    drivingLicenceNumber: "", drivingLicenceExpiry: "",
    aadhaarNumber: "",
    registrationNumber: "", vehicleType: "Sedan", make: "", vehicleModel: "",
    businessType: "individual", tradeName: "", settlementCycle: "Weekly",
    platformFeeOverride: null,
    internalNotes: "", adminNotes: "",
    // fee override UI state
    useFeeOverride: false, feeType: "percentage", feeValue: "",
  });

  const handleDocLink = (field, url) => setForm(f => ({ ...f, [field]: url }));

  const handleFileUpload = async (field, file) => {
    const res = await dispatch(uploadSingleFile({ file, folder: "solo-driver/onboarding" }));
    if (res?.payload?.url) setForm(f => ({ ...f, [field]: res.payload.url }));
  };

  const handleSubmit = () => {
    const payload = { ...form };
    if (form.useFeeOverride && form.feeValue)
      payload.platformFeeOverride = { type: form.feeType, value: Number(form.feeValue) };
    else payload.platformFeeOverride = null;
    delete payload.useFeeOverride; delete payload.feeType; delete payload.feeValue;
    onSubmit(payload);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAddr = (k, v) => setForm(f => ({ ...f, address: { ...f.address, [k]: v } }));

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
        <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
          className="glass-card w-full max-w-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black font-montserrat text-base-content">Create Solo Driver Partner</h3>
            <button onClick={onClose}><X size={20} className="text-base-content/40 hover:text-base-content" /></button>
          </div>

          <div className="space-y-5 text-sm">
            {/* User Details */}
            <Section title="User Account">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Full Name *" value={form.name} onChange={v => set("name", v)} />
                <FormField label="Email *" value={form.email} onChange={v => set("email", v)} type="email" />
                <FormField label="Phone *" value={form.phone} onChange={v => set("phone", v)} />
                <FormField label="Legal Name *" value={form.legalName} onChange={v => set("legalName", v)} />
                <FormField label="Display Name" value={form.displayName} onChange={v => set("displayName", v)} />
                <FormField label="Date of Birth" value={form.dateOfBirth} onChange={v => set("dateOfBirth", v)} type="date" />
                <div>
                  <label className="block text-xs text-base-content/60 mb-1">Gender</label>
                  <select value={form.gender} onChange={e => set("gender", e.target.value)} className="input-field w-full">
                    <option value="">Select</option>
                    {["Male", "Female", "Other", "Prefer Not to Say"].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </Section>

            {/* Address */}
            <Section title="Address">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Street" value={form.address.street} onChange={v => setAddr("street", v)} />
                <FormField label="City *" value={form.address.city} onChange={v => setAddr("city", v)} />
                <FormField label="State *" value={form.address.state} onChange={v => setAddr("state", v)} />
                <FormField label="Pin Code" value={form.address.pinCode} onChange={v => setAddr("pinCode", v)} />
              </div>
            </Section>

            {/* KYC */}
            <Section title="KYC Details">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Driving Licence No. *" value={form.drivingLicenceNumber} onChange={v => set("drivingLicenceNumber", v)} />
                <FormField label="DL Expiry *" value={form.drivingLicenceExpiry} onChange={v => set("drivingLicenceExpiry", v)} type="date" />
                <FormField label="Aadhaar Number" value={form.aadhaarNumber} onChange={v => set("aadhaarNumber", v)} maxLength={12} />
              </div>
            </Section>

            {/* Vehicle */}
            <Section title="Vehicle (Optional)">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Registration No." value={form.registrationNumber} onChange={v => set("registrationNumber", v)} />
                <div>
                  <label className="block text-xs text-base-content/60 mb-1">Vehicle Type</label>
                  <select value={form.vehicleType} onChange={e => set("vehicleType", e.target.value)} className="input-field w-full">
                    {["Sedan","SUV","Van","Minivan","Wheelchair-Van","Tempo-Traveller","Hatchback","Auto"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <FormField label="Make" value={form.make} onChange={v => set("make", v)} />
                <FormField label="Model" value={form.vehicleModel} onChange={v => set("vehicleModel", v)} />
              </div>
            </Section>

            {/* Business */}
            <Section title="Business & Settlement">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-base-content/60 mb-1">Business Type</label>
                  <select value={form.businessType} onChange={e => set("businessType", e.target.value)} className="input-field w-full">
                    <option value="individual">Individual</option>
                    <option value="proprietorship">Proprietorship</option>
                  </select>
                </div>
                <FormField label="Trade Name" value={form.tradeName} onChange={v => set("tradeName", v)} />
                <div>
                  <label className="block text-xs text-base-content/60 mb-1">Settlement Cycle</label>
                  <select value={form.settlementCycle} onChange={e => set("settlementCycle", e.target.value)} className="input-field w-full">
                    {["Daily","Weekly","Bi-Weekly","Monthly"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {/* Platform Fee Override */}
              <div className="mt-3 p-3 rounded-xl border border-base-300 bg-base-200/50">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold mb-2">
                  <input type="checkbox" className="rounded" checked={form.useFeeOverride} onChange={e => set("useFeeOverride", e.target.checked)} />
                  Set platform fee override (otherwise uses global config)
                </label>
                {form.useFeeOverride && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-xs text-base-content/60 mb-1">Type</label>
                      <select value={form.feeType} onChange={e => set("feeType", e.target.value)} className="input-field w-full">
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed INR</option>
                      </select>
                    </div>
                    <FormField label="Value" value={form.feeValue} onChange={v => set("feeValue", v)} type="number" />
                  </div>
                )}
              </div>
            </Section>

            {/* Notes */}
            <Section title="Internal Notes">
              <textarea value={form.adminNotes} onChange={e => set("adminNotes", e.target.value)} rows={3}
                placeholder="Admin notes (not visible to partner)" className="input-field w-full resize-none" />
            </Section>
          </div>

          <div className="flex gap-3 mt-6 justify-end">
            <button onClick={onClose} className="btn-secondary px-5 py-2.5 text-xs rounded-xl">Cancel</button>
            <button onClick={handleSubmit} disabled={loading}
              className="btn-primary-cta px-5 py-2.5 text-xs rounded-xl flex items-center gap-2">
              {loading ? <><RotateCcw size={14} className="animate-spin" /> Creating…</> : <><Plus size={14} /> Create Partner</>}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ── Tiny helpers inside modals ─────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <div>
    <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5">
      <span className="w-3 h-px bg-primary/50 inline-block" />{title}
    </p>
    {children}
  </div>
);
const FormField = ({ label, value, onChange, type = "text", maxLength }) => (
  <div>
    <label className="block text-xs text-base-content/60 mb-1">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} maxLength={maxLength}
      className="input-field w-full" />
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// PARTNER DETAIL DRAWER
// ══════════════════════════════════════════════════════════════════════════════

const DetailDrawer = ({ partner, onClose, dispatch, loading }) => {
  const [tab, setTab] = useState("overview");
  const [notesText, setNotesText] = useState(partner?.adminNotes || "");
  const [reasonModal, setReasonModal] = useState(null); // { type, action }
  const [feeModal, setFeeModal]       = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  const tabs = [
    { id: "overview",    label: "Overview",    icon: Eye },
    { id: "kyc",         label: "KYC",         icon: Shield },
    { id: "vehicle",     label: "Vehicle",     icon: Car },
    { id: "bank",        label: "Bank",        icon: CreditCard },
    { id: "compliance",  label: "Compliance",  icon: AlertTriangle },
    { id: "settings",    label: "Fee & Notes", icon: Settings },
  ];

  if (!partner) return null;

  const pId = partner._id;

  const handleVerifyKyc = async (action) => {
    if (action === "reject") { setReasonModal({ type: "kyc", action }); return; }
    await dispatch(adminVerifyKyc({ partnerId: pId, action }));
  };

  const handleVerifyVehicle = async (action) => {
    if (action === "reject") { setReasonModal({ type: "vehicle", action }); return; }
    await dispatch(adminVerifyVehicle({ partnerId: pId, action }));
  };

  const handleStatusChange = async (status) => {
    if (["suspended", "rejected"].includes(status)) { setReasonModal({ type: "status", action: status }); return; }
    await dispatch(adminUpdatePartnerStatus({ partnerId: pId, status }));
  };

  const handleBlock = async (action) => {
    if (action === "block") { setReasonModal({ type: "block", action }); return; }
    dispatch(adminBlockPartner({ partnerId: pId, action }));
  };

  const handleReasonSubmit = async (reason) => {
    const { type, action } = reasonModal;
    if (type === "kyc")     await dispatch(adminVerifyKyc({ partnerId: pId, action, rejectionReason: reason }));
    if (type === "vehicle") await dispatch(adminVerifyVehicle({ partnerId: pId, action, rejectionReason: reason }));
    if (type === "status")  await dispatch(adminUpdatePartnerStatus({ partnerId: pId, status: action, rejectionReason: reason }));
    if (type === "block")   await dispatch(adminBlockPartner({ partnerId: pId, action: "block", blockReason: reason }));
    setReasonModal(null);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full z-50 w-full max-w-2xl bg-base-100 border-l border-base-300 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-base-300 bg-base-200/50">
          <div className="relative">
            <img src={partner.user?.avatar || "/avatar.png"} alt={partner.legalName}
              className="w-11 h-11 rounded-full object-cover border-2 border-primary/30" />
            {partner.partnershipStatus === "active" && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-success rounded-full border-2 border-base-100" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black font-montserrat text-base-content text-base truncate">{partner.legalName}</p>
            <p className="text-xs text-base-content/50">{partner.partnerCode} · {partner.user?.email}</p>
          </div>
          <StatusBadge status={partner.partnershipStatus} config={STATUS_CONFIG} />
          <button onClick={onClose} className="ml-2 p-1.5 rounded-lg hover:bg-base-300 transition-colors">
            <X size={18} className="text-base-content/50" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-4 pt-3 pb-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-all
                ${tab === t.id ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-base-content/40 hover:text-base-content"}`}>
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* OVERVIEW */}
          {tab === "overview" && (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
              <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
                <InfoBlock label="Phone"           value={partner.phone} />
                <InfoBlock label="Alt Phone"        value={partner.altPhone || "—"} />
                <InfoBlock label="City"             value={`${partner.address?.city}, ${partner.address?.state}`} />
                <InfoBlock label="Business Type"    value={partner.businessType} />
                <InfoBlock label="Years Experience" value={partner.yearsOfExperience ?? "—"} />
                <InfoBlock label="Settlement Cycle" value={partner.settlementCycle} />
                <InfoBlock label="Partner Since"    value={partner.partnerSince ? new Date(partner.partnerSince).toLocaleDateString() : "—"} />
                <InfoBlock label="Profile Completion" value={`${partner.profileCompletionPercent ?? 0}%`} />
              </motion.div>

              {/* Progress bar */}
              <motion.div variants={fadeInUp} className="p-3 rounded-xl border border-base-300 bg-base-200/30">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-base-content/50 font-medium">Profile Completion</span>
                  <span className="font-bold text-primary">{partner.profileCompletionPercent ?? 0}%</span>
                </div>
                <div className="w-full h-2 bg-base-300 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${partner.profileCompletionPercent ?? 0}%` }}
                    transition={{ delay: 0.3, duration: 0.8 }} className="h-full bg-gradient-to-r from-primary to-secondary rounded-full" />
                </div>
              </motion.div>

              {/* Quick Stats */}
              <motion.div variants={fadeInUp} className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Rides",    value: partner.stats?.totalRidesCompleted ?? 0, icon: Activity },
                  { label: "Total Earnings", value: `₹${(partner.stats?.totalEarnings || 0).toLocaleString()}`, icon: DollarSign },
                  { label: "Rating",         value: (partner.rating?.averageRating || 0).toFixed(1) + " ⭐", icon: Star },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl border border-base-300 bg-base-200/30 text-center">
                    <s.icon size={16} className="text-primary mx-auto mb-1" />
                    <p className="text-lg font-black font-montserrat text-base-content">{s.value}</p>
                    <p className="text-xs text-base-content/40">{s.label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Action bar */}
              <motion.div variants={fadeInUp} className="flex flex-wrap gap-2">
                {partner.partnershipStatus !== "active" && (
                  <ActionBtn color="success" icon={CheckCircle} label="Activate" onClick={() => handleStatusChange("active")} />
                )}
                {!["suspended"].includes(partner.partnershipStatus) && (
                  <ActionBtn color="warning" icon={Ban} label="Suspend" onClick={() => handleStatusChange("suspended")} />
                )}
                {partner.user?.isBlocked ? (
                  <ActionBtn color="info" icon={Unlock} label="Unblock User" onClick={() => handleBlock("unblock")} />
                ) : (
                  <ActionBtn color="error" icon={Ban} label="Block User" onClick={() => handleBlock("block")} />
                )}
                {!partner.driverProfile && (
                  <ActionBtn color="primary" icon={UserCheck} label="Create Driver Profile"
                    loading={loading.adminCreateDriver}
                    onClick={() => setConfirmModal({ title: "Create Driver Profile", desc: "This will create a companion dispatch document for this partner.", action: () => dispatch(adminCreateCompanionDriver(pId)) })} />
                )}
                {["under-review", "pending"].includes(partner.partnershipStatus) && (
                  <ActionBtn color="info" icon={Eye} label="Mark Under Review" onClick={() => handleStatusChange("under-review")} />
                )}
              </motion.div>

              {/* Dispatch readiness */}
              <motion.div variants={fadeInUp} className={`p-3 rounded-xl border flex items-center gap-3 
                ${partner.driverProfile ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
                {partner.driverProfile
                  ? <><CheckCircle size={16} className="text-success shrink-0" /><p className="text-xs text-success font-medium">Driver dispatch profile linked — partner is dispatch-ready when KYC is verified.</p></>
                  : <><AlertTriangle size={16} className="text-warning shrink-0" /><p className="text-xs text-warning font-medium">No driver dispatch profile yet. Create one to enable ride acceptance.</p></>}
              </motion.div>
            </motion.div>
          )}

          {/* KYC */}
          {tab === "kyc" && (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
              <motion.div variants={fadeInUp} className="flex items-center justify-between p-3 rounded-xl border border-base-300 bg-base-200/30">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-primary" />
                  <span className="text-sm font-bold">KYC Status</span>
                </div>
                <StatusBadge status={partner.kyc?.verificationStatus || "not-submitted"} config={KYC_STATUS_CONFIG} />
              </motion.div>

              <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
                <InfoBlock label="Driving Licence No." value={partner.kyc?.drivingLicenceNumber || "—"} />
                <InfoBlock label="DL Expiry"           value={partner.kyc?.drivingLicenceExpiry ? new Date(partner.kyc.drivingLicenceExpiry).toLocaleDateString() : "—"} />
                <InfoBlock label="Aadhaar (Masked)"    value={`XXXX XXXX ${partner.kyc?.aadhaarLast4 || "****"}`} />
                <InfoBlock label="PSV Badge"           value={partner.kyc?.psvBadgeNumber || "—"} />
                <InfoBlock label="PSV Expiry"          value={partner.kyc?.psvBadgeExpiry ? new Date(partner.kyc.psvBadgeExpiry).toLocaleDateString() : "—"} />
                <InfoBlock label="Submitted At"        value={partner.kyc?.submittedAt ? new Date(partner.kyc.submittedAt).toLocaleDateString() : "—"} />
              </motion.div>

              {/* Doc links */}
              {[
                { label: "DL Document",     url: partner.kyc?.drivingLicenceDocUrl },
                { label: "Aadhaar Front",   url: partner.kyc?.aadhaarFrontUrl },
                { label: "Aadhaar Back",    url: partner.kyc?.aadhaarBackUrl },
                { label: "PSV Badge Doc",   url: partner.kyc?.psvBadgeDocUrl },
                { label: "PAN Card",        url: partner.kyc?.panCardUrl },
              ].map(d => d.url && (
                <motion.a key={d.label} variants={fadeInUp} href={d.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-base-300 hover:border-primary text-xs text-base-content/70 hover:text-primary transition-all">
                  <FileText size={13} />{d.label}<ExternalLink size={11} className="ml-auto" />
                </motion.a>
              ))}

              {/* Medical fitness */}
              <motion.div variants={fadeInUp} className="p-3 rounded-xl border border-base-300 bg-base-200/30 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-base-content/50">Medical Fitness</p>
                <div className="grid grid-cols-2 gap-2">
                  <InfoBlock label="Certificate No." value={partner.medicalFitness?.certificateNumber || "—"} />
                  <InfoBlock label="Expiry"          value={partner.medicalFitness?.expiryDate ? new Date(partner.medicalFitness.expiryDate).toLocaleDateString() : "—"} />
                  <InfoBlock label="Blood Group"     value={partner.medicalFitness?.bloodGroup || "Unknown"} />
                  <InfoBlock label="Valid"           value={partner.medicalFitness?.isValid ? "Yes" : "No"} />
                </div>
              </motion.div>

              {/* KYC actions */}
              {partner.kyc?.verificationStatus !== "verified" && (
                <motion.div variants={fadeInUp} className="flex gap-3">
                  <button onClick={() => handleVerifyKyc("approve")} disabled={loading.adminVerifyKyc}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-success/10 border border-success/30 text-success hover:bg-success hover:text-white transition-all flex items-center justify-center gap-1.5">
                    <CheckCircle size={13} /> Approve KYC
                  </button>
                  <button onClick={() => handleVerifyKyc("reject")} disabled={loading.adminVerifyKyc}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-error/10 border border-error/30 text-error hover:bg-error hover:text-white transition-all flex items-center justify-center gap-1.5">
                    <XCircle size={13} /> Reject KYC
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* VEHICLE */}
          {tab === "vehicle" && (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
              <motion.div variants={fadeInUp} className="flex items-center justify-between p-3 rounded-xl border border-base-300 bg-base-200/30">
                <div className="flex items-center gap-2">
                  <Car size={16} className="text-primary" />
                  <span className="text-sm font-bold">Vehicle Status</span>
                </div>
                <StatusBadge status={partner.vehicle?.verificationStatus || "pending"} config={VEHICLE_STATUS_CONFIG} />
              </motion.div>

              <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
                <InfoBlock label="Registration No."  value={partner.vehicle?.registrationNumber || "—"} />
                <InfoBlock label="Vehicle Type"      value={partner.vehicle?.vehicleType || "—"} />
                <InfoBlock label="Make"              value={partner.vehicle?.make || "—"} />
                <InfoBlock label="Model"             value={partner.vehicle?.model || "—"} />
                <InfoBlock label="Year"              value={partner.vehicle?.year || "—"} />
                <InfoBlock label="Color"             value={partner.vehicle?.color || "—"} />
                <InfoBlock label="Seating Capacity"  value={partner.vehicle?.seatingCapacity || "—"} />
              </motion.div>

              <motion.div variants={fadeInUp} className="grid grid-cols-3 gap-2">
                {[
                  { label: "AC",          val: partner.vehicle?.hasAC },
                  { label: "Wheelchair",  val: partner.vehicle?.isWheelchairAccessible },
                  { label: "Stretcher",   val: partner.vehicle?.hasStretcherSupport },
                  { label: "Oxygen",      val: partner.vehicle?.hasOxygenSupport },
                  { label: "Medical Kit", val: partner.vehicle?.hasMedicalKit },
                ].map(f => (
                  <div key={f.label} className={`p-2 rounded-lg text-xs flex items-center gap-1.5 border ${f.val ? "border-success/30 bg-success/5 text-success" : "border-base-300 bg-base-200/30 text-base-content/30"}`}>
                    {f.val ? <Check size={11} /> : <X size={11} />} {f.label}
                  </div>
                ))}
              </motion.div>

              {/* Doc expiries */}
              {[
                { label: "Insurance",         expiry: partner.vehicle?.insuranceExpiry },
                { label: "Pollution Cert",    expiry: partner.vehicle?.pollutionCertExpiry },
                { label: "Fitness Cert",      expiry: partner.vehicle?.fitnessCertExpiry },
                { label: "Permit",            expiry: partner.vehicle?.permitExpiry },
              ].map(d => d.expiry && (
                <ExpiryRow key={d.label} label={d.label} expiry={d.expiry} />
              ))}

              {/* Vehicle doc links */}
              {[
                { label: "RC Book",         url: partner.vehicle?.rcBookUrl },
                { label: "Insurance Policy",url: partner.vehicle?.insurancePolicyUrl },
                { label: "Pollution Cert",  url: partner.vehicle?.pollutionCertUrl },
                { label: "Fitness Cert",    url: partner.vehicle?.fitnessCertUrl },
              ].map(d => d.url && (
                <motion.a key={d.label} variants={fadeInUp} href={d.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-base-300 hover:border-primary text-xs text-base-content/70 hover:text-primary transition-all">
                  <FileText size={13} />{d.label}<ExternalLink size={11} className="ml-auto" />
                </motion.a>
              ))}

              {partner.vehicle?.verificationStatus !== "verified" && (
                <motion.div variants={fadeInUp} className="flex gap-3 mt-2">
                  <button onClick={() => handleVerifyVehicle("approve")} disabled={loading.adminVerifyVehicle}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-success/10 border border-success/30 text-success hover:bg-success hover:text-white transition-all flex items-center justify-center gap-1.5">
                    <CheckCircle size={13} /> Approve Vehicle
                  </button>
                  <button onClick={() => handleVerifyVehicle("reject")} disabled={loading.adminVerifyVehicle}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-error/10 border border-error/30 text-error hover:bg-error hover:text-white transition-all flex items-center justify-center gap-1.5">
                    <XCircle size={13} /> Reject
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* BANK */}
          {tab === "bank" && (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
              <motion.div variants={fadeInUp} className="p-4 rounded-xl border border-base-300 bg-gradient-to-br from-primary/5 to-secondary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-primary" />
                    <span className="text-sm font-bold">Bank Account</span>
                  </div>
                  {partner.bankDetails?.isVerified
                    ? <span className="badge badge-success text-xs">Verified</span>
                    : <span className="badge badge-warning text-xs">Unverified</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoBlock label="Account Holder" value={partner.bankDetails?.accountHolderName || "—"} />
                  <InfoBlock label="Account (Masked)" value={partner.bankDetails?.maskedAccount || `XXXX${partner.bankDetails?.accountLast4 || "****"}`} />
                  <InfoBlock label="IFSC Code"       value={partner.bankDetails?.ifscCode || "—"} />
                  <InfoBlock label="Bank Name"       value={partner.bankDetails?.bankName || "—"} />
                  <InfoBlock label="UPI ID"          value={partner.bankDetails?.upiId || "—"} />
                  <InfoBlock label="Account Type"    value={partner.bankDetails?.accountType || "—"} />
                </div>
              </motion.div>

              {partner.bankDetails?.cancelledChequeUrl && (
                <motion.a variants={fadeInUp} href={partner.bankDetails.cancelledChequeUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-base-300 hover:border-primary text-xs text-base-content/70 hover:text-primary transition-all">
                  <FileText size={13} />Cancelled Cheque<ExternalLink size={11} className="ml-auto" />
                </motion.a>
              )}

              {/* Settlement */}
              <motion.div variants={fadeInUp} className="p-3 rounded-xl border border-base-300 bg-base-200/30 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-base-content/50">Settlement Summary</p>
                <div className="grid grid-cols-2 gap-2">
                  <InfoBlock label="Pending"     value={`₹${(partner.settlement?.pendingAmount || 0).toLocaleString()}`} />
                  <InfoBlock label="Total Settled" value={`₹${(partner.settlement?.totalSettled || 0).toLocaleString()}`} />
                  <InfoBlock label="Last Settled" value={partner.settlement?.lastSettledAt ? new Date(partner.settlement.lastSettledAt).toLocaleDateString() : "—"} />
                  <InfoBlock label="Method"       value={partner.settlement?.preferredMethod || "—"} />
                </div>
              </motion.div>

              {!partner.bankDetails?.isVerified && partner.bankDetails?.accountLast4 && (
                <motion.div variants={fadeInUp}>
                  <button onClick={() => dispatch(adminVerifyBank(pId))} disabled={loading.adminVerifyBank}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-success/10 border border-success/30 text-success hover:bg-success hover:text-white transition-all flex items-center justify-center gap-2">
                    <BadgeCheck size={14} /> Verify Bank Account
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* COMPLIANCE */}
          {tab === "compliance" && (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
              {[
                { label: "Driving Licence",  expiry: partner.kyc?.drivingLicenceExpiry },
                { label: "PSV Badge",        expiry: partner.kyc?.psvBadgeExpiry },
                { label: "Medical Fitness",  expiry: partner.medicalFitness?.expiryDate },
                { label: "Vehicle Insurance",expiry: partner.vehicle?.insuranceExpiry },
                { label: "Pollution Cert",   expiry: partner.vehicle?.pollutionCertExpiry },
                { label: "Fitness Cert",     expiry: partner.vehicle?.fitnessCertExpiry },
                { label: "Vehicle Permit",   expiry: partner.vehicle?.permitExpiry },
              ].map(d => (
                <motion.div key={d.label} variants={fadeInUp}>
                  <ExpiryRow label={d.label} expiry={d.expiry} />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* FEE & NOTES */}
          {tab === "settings" && (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
              {/* Platform Fee */}
              <motion.div variants={fadeInUp} className="p-4 rounded-xl border border-base-300 bg-base-200/30">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold">Platform Fee</p>
                    <p className="text-xs text-base-content/40 mt-0.5">
                      {partner.platformFeeOverride
                        ? `Override: ${partner.platformFeeOverride.type === "percentage" ? `${partner.platformFeeOverride.value}%` : `₹${partner.platformFeeOverride.value} flat`}`
                        : "Using global config"}
                    </p>
                  </div>
                  <button onClick={() => setFeeModal(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-all flex items-center gap-1.5">
                    <Edit size={11} /> Edit
                  </button>
                </div>
                <InfoBlock label="Settlement Cycle" value={partner.settlementCycle} />
              </motion.div>

              {/* Admin Notes */}
              <motion.div variants={fadeInUp} className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-base-content/50 flex items-center gap-1.5">
                  <StickyNote size={12} /> Admin Notes (internal only)
                </label>
                <textarea value={notesText} onChange={e => setNotesText(e.target.value)} rows={5}
                  placeholder="Internal notes about this partner…" className="input-field w-full resize-none" />
                <button onClick={() => dispatch(adminUpdateNotes({ partnerId: pId, notes: notesText }))} disabled={loading.adminNotes}
                  className="btn-primary-cta px-4 py-2 text-xs rounded-xl w-full flex items-center justify-center gap-2">
                  {loading.adminNotes ? <><RotateCcw size={13} className="animate-spin" />Saving…</> : <><Check size={13} />Save Notes</>}
                </button>
              </motion.div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Sub-modals */}
      <ReasonModal open={!!reasonModal} title={`Reason Required`}
        placeholder="Provide a clear reason…" loading={false}
        onSubmit={handleReasonSubmit} onClose={() => setReasonModal(null)} />

      <PlatformFeeModal open={feeModal} onClose={() => setFeeModal(false)}
        current={partner.platformFeeOverride} loading={loading.adminPlatformFee}
        onSubmit={({ platformFeeOverride, settlementCycle }) => {
          dispatch(adminUpdatePlatformFee({ partnerId: pId, platformFeeOverride, settlementCycle }));
          setFeeModal(false);
        }} />

      <ConfirmModal open={!!confirmModal} title={confirmModal?.title} description={confirmModal?.desc}
        loading={false} onCancel={() => setConfirmModal(null)}
        onConfirm={() => { confirmModal?.action(); setConfirmModal(null); }} />
    </>
  );
};

// Helpers used inside drawer
const InfoBlock = ({ label, value }) => (
  <div>
    <p className="text-xs text-base-content/40">{label}</p>
    <p className="text-sm font-semibold text-base-content mt-0.5">{value}</p>
  </div>
);

const ExpiryRow = ({ label, expiry }) => {
  if (!expiry) return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-base-300 bg-base-200/30">
      <span className="text-xs text-base-content/50">{label}</span>
      <span className="text-xs text-base-content/30">Not provided</span>
    </div>
  );
  const d = new Date(expiry);
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 86400000);
  const daysLeft = Math.ceil((d - now) / 86400000);
  const isExpired = d < now;
  const isExpiring = d < soon && !isExpired;

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${isExpired ? "border-error/30 bg-error/5" : isExpiring ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5"}`}>
      <div className="flex items-center gap-2">
        {isExpired ? <XCircle size={13} className="text-error" /> : isExpiring ? <AlertTriangle size={13} className="text-warning" /> : <CheckCircle size={13} className="text-success" />}
        <span className="text-xs font-medium text-base-content">{label}</span>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold">{d.toLocaleDateString()}</p>
        <p className={`text-xs ${isExpired ? "text-error" : isExpiring ? "text-warning" : "text-success"}`}>
          {isExpired ? "Expired" : `${daysLeft}d left`}
        </p>
      </div>
    </div>
  );
};

const ActionBtn = ({ color, icon: Icon, label, onClick, loading }) => (
  <button onClick={onClick} disabled={loading}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border
      bg-${color}/10 border-${color}/30 text-${color} hover:bg-${color} hover:text-white transition-all disabled:opacity-50`}>
    {loading ? <RotateCcw size={12} className="animate-spin" /> : <Icon size={12} />}
    {label}
  </button>
);

// ══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE ALERTS PANEL
// ══════════════════════════════════════════════════════════════════════════════

const CompliancePanel = ({ alerts, total, dispatch }) => (
  <motion.div variants={fadeInUp} className="glass-card p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-warning" />
        <h3 className="font-black font-montserrat text-base-content text-sm">Compliance Alerts</h3>
        {total > 0 && <span className="badge badge-warning text-xs">{total}</span>}
      </div>
      <button onClick={() => dispatch(adminFetchComplianceAlerts({ days: 30 }))} className="p-1.5 rounded-lg hover:bg-base-300 transition-colors">
        <RefreshCw size={13} className="text-base-content/40" />
      </button>
    </div>
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {alerts.length === 0
        ? <p className="text-xs text-center text-base-content/30 py-6">No compliance alerts</p>
        : alerts.slice(0, 8).map(a => (
          <div key={a._id} className="flex items-start gap-3 p-2.5 rounded-xl border border-base-300 hover:border-warning/40 transition-colors">
            <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={13} className="text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-base-content truncate">{a.legalName || a.user?.name}</p>
              <p className="text-xs text-base-content/40">{a.partnerCode}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {a.expiringDocs?.map(d => (
                  <span key={d.label} className={`text-xs px-1.5 py-0.5 rounded border ${d.isExpired ? "border-error/30 bg-error/5 text-error" : "border-warning/30 bg-warning/5 text-warning"}`}>
                    {d.label}: {d.isExpired ? "Expired" : `${d.daysLeft}d`}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
    </div>
  </motion.div>
);

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS CHARTS
// ══════════════════════════════════════════════════════════════════════════════

const AnalyticsSection = ({ partners }) => {
  const statusDist = Object.entries(
    partners.reduce((acc, p) => { acc[p.partnershipStatus] = (acc[p.partnershipStatus] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const kycDist = Object.entries(
    partners.reduce((acc, p) => {
      const k = p.kyc?.verificationStatus || "not-submitted";
      acc[k] = (acc[k] || 0) + 1; return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ["var(--color-primary)", "var(--color-success)", "var(--color-warning)", "var(--color-error)", "var(--color-info)"];

  const vehicleTypes = Object.entries(
    partners.reduce((acc, p) => { const t = p.vehicle?.vehicleType || "Unknown"; acc[t] = (acc[t] || 0) + 1; return acc; }, {})
  ).map(([name, count]) => ({ name, count })).slice(0, 5);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <motion.div variants={fadeInUp} className="glass-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-3">Partner Status Distribution</p>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={statusDist} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value">
              {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--color-base-200)", border: "1px solid var(--color-base-300)", borderRadius: "8px", fontSize: "11px" }} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div variants={fadeInUp} className="glass-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-3">KYC Verification Status</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={kycDist} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={{ background: "var(--color-base-200)", border: "1px solid var(--color-base-300)", borderRadius: "8px", fontSize: "11px" }} />
            <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div variants={fadeInUp} className="glass-card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-3">Vehicle Types</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={vehicleTypes} barSize={18} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={70} />
            <Tooltip contentStyle={{ background: "var(--color-base-200)", border: "1px solid var(--color-base-300)", borderRadius: "8px", fontSize: "11px" }} />
            <Bar dataKey="count" fill="var(--color-secondary)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PARTNER TABLE ROW
// ══════════════════════════════════════════════════════════════════════════════

const PartnerRow = ({ partner, onView }) => {
  const kycCfg = KYC_STATUS_CONFIG[partner.kyc?.verificationStatus || "not-submitted"];
  const vhCfg  = VEHICLE_STATUS_CONFIG[partner.vehicle?.verificationStatus || "pending"];

  return (
    <motion.tr variants={fadeInUp} className="border-b border-base-200 hover:bg-base-200/50 transition-colors cursor-pointer group" onClick={() => onView(partner)}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={partner.user?.avatar || "/avatar.png"} alt={partner.legalName}
            className="w-8 h-8 rounded-full object-cover border border-base-300" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-base-content truncate max-w-[140px]">{partner.legalName}</p>
            <p className="text-xs text-base-content/40">{partner.partnerCode}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-base-content/60">{partner.phone}</td>
      <td className="px-4 py-3">
        <StatusBadge status={partner.partnershipStatus} config={STATUS_CONFIG} />
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${kycCfg?.bg} ${kycCfg?.color} ${kycCfg?.border}`}>
          {kycCfg?.label || "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${vhCfg?.bg} ${vhCfg?.color} ${vhCfg?.border}`}>
          {vhCfg?.label || "—"}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-base-content/60">
        {partner.address?.city && `${partner.address.city}, ${partner.address.state}`}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {partner.driverProfile
            ? <CheckCircle size={13} className="text-success" />
            : <Clock size={13} className="text-warning" />}
          <span className="text-xs text-base-content/40">{partner.driverProfile ? "Linked" : "Pending"}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <button onClick={e => { e.stopPropagation(); onView(partner); }}
          className="p-1.5 rounded-lg bg-primary/5 border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all opacity-0 group-hover:opacity-100">
          <Eye size={13} />
        </button>
      </td>
    </motion.tr>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function SoloDriverPartnerManagement() {
  const dispatch = useDispatch();

  // selectors
  const partners          = useSelector(selectAdminPartnerList);
  const pagination        = useSelector(selectAdminPagination);
  const selectedPartner   = useSelector(selectAdminSelectedPartner);
  const complianceAlerts  = useSelector(selectAdminComplianceAlerts);
  const complianceTotal   = useSelector(selectAdminComplianceTotal);

  const loadingList       = useSelector(selectLoading("adminList"));
  const loadingDetail     = useSelector(selectLoading("adminDetail"));
  const loadingCreate     = useSelector(selectLoading("adminCreate"));

  // all loading keys for drawer
  const drawerLoading = {
    adminVerifyKyc:    useSelector(selectLoading("adminVerifyKyc")),
    adminVerifyVehicle:useSelector(selectLoading("adminVerifyVehicle")),
    adminVerifyBank:   useSelector(selectLoading("adminVerifyBank")),
    adminStatus:       useSelector(selectLoading("adminStatus")),
    adminBlock:        useSelector(selectLoading("adminBlock")),
    adminCreateDriver: useSelector(selectLoading("adminCreateDriver")),
    adminPlatformFee:  useSelector(selectLoading("adminPlatformFee")),
    adminNotes:        useSelector(selectLoading("adminNotes")),
  };

  // local state
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [createOpen, setCreateOpen]   = useState(false);
  const [activeTab, setActiveTab]     = useState("list"); // list | analytics
  const [filters, setFilters]         = useState({ search: "", status: "", kycStatus: "", vehicleStatus: "", hasDriverProfile: "", city: "", state: "", sortBy: "createdAt", sortOrder: "desc" });
  const [page, setPage]               = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const fetchList = useCallback(() => {
    dispatch(adminFetchPartnerList({ page, limit: 15, ...filters }));
  }, [dispatch, page, filters]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { dispatch(adminFetchComplianceAlerts({ days: 30 })); }, [dispatch]);

  const handleViewPartner = async (p) => {
    await dispatch(adminFetchPartnerDetail(p._id));
    setDrawerOpen(true);
  };

  const handleCreatePartner = async (payload) => {
    const res = await dispatch(adminCreateSoloDriver(payload));
    if (!res.error) { setCreateOpen(false); fetchList(); }
  };

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  // derived stats
  const stats = {
    total:   partners.length,
    active:  partners.filter(p => p.partnershipStatus === "active").length,
    pending: partners.filter(p => ["pending", "under-review"].includes(p.partnershipStatus)).length,
    kycPending: partners.filter(p => ["pending", "under-review"].includes(p.kyc?.verificationStatus)).length,
  };

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-base-100/95 backdrop-blur border-b border-base-300 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black font-montserrat text-base-content leading-tight">Solo Driver Partners</h1>
            <p className="text-xs text-base-content/40 mt-0.5">Manage self-employed driver-partners · Admin Panel</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-base-200 rounded-xl p-0.5 gap-0.5">
              {[{id:"list",icon:Users},{id:"analytics",icon:TrendingUp}].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${activeTab === t.id ? "bg-base-100 text-primary shadow-sm" : "text-base-content/40 hover:text-base-content"}`}>
                  <t.icon size={13} /> {t.id === "list" ? "Partners" : "Analytics"}
                </button>
              ))}
            </div>
            <button onClick={fetchList}
              className="p-2 rounded-xl border border-base-300 hover:border-primary text-base-content/40 hover:text-primary transition-all">
              <RefreshCw size={15} className={loadingList ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setCreateOpen(true)}
              className="btn-primary-cta px-4 py-2 text-xs rounded-xl flex items-center gap-1.5">
              <Plus size={14} /> New Partner
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Stat Cards */}
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Users}        label="Total Partners" value={pagination?.total ?? stats.total} trend={12} />
          <StatCard icon={Zap}          label="Active"         value={stats.active}    color="success" />
          <StatCard icon={Clock}        label="Pending Review" value={stats.pending}   color="warning" />
          <StatCard icon={Shield}       label="KYC Pending"    value={stats.kycPending} color="info" />
        </motion.div>

        {activeTab === "analytics" && <AnalyticsSection partners={partners} />}

        {activeTab === "list" && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
            {/* Main table */}
            <div className="xl:col-span-3 space-y-3">
              {/* Search & Filters */}
              <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="glass-card p-3">
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                    <input value={filters.search} onChange={e => setFilter("search", e.target.value)}
                      placeholder="Search by name, code, phone…"
                      className="input-field w-full pl-9 py-2 text-xs" />
                  </div>
                  <button onClick={() => setShowFilters(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border transition-all
                      ${showFilters ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content/50 hover:border-primary"}`}>
                    <Filter size={13} /> Filters {showFilters ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  </button>
                </div>
                <AnimatePresence>
                  {showFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                        {[
                          { key: "status", label: "Status", opts: ["", "pending", "under-review", "active", "suspended", "rejected"] },
                          { key: "kycStatus", label: "KYC", opts: ["", "not-submitted", "pending", "under-review", "verified", "rejected"] },
                          { key: "vehicleStatus", label: "Vehicle", opts: ["", "pending", "under-review", "verified", "rejected"] },
                          { key: "hasDriverProfile", label: "Driver Profile", opts: [{ v: "", l: "All" }, { v: "true", l: "Has Profile" }, { v: "false", l: "No Profile" }] },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="text-xs text-base-content/40 mb-1 block">{f.label}</label>
                            <select value={filters[f.key]} onChange={e => setFilter(f.key, e.target.value)} className="input-field w-full text-xs py-1.5">
                              {f.opts.map(o =>
                                typeof o === "string"
                                  ? <option key={o} value={o}>{o || "All"}</option>
                                  : <option key={o.v} value={o.v}>{o.l}</option>
                              )}
                            </select>
                          </div>
                        ))}
                        <div>
                          <label className="text-xs text-base-content/40 mb-1 block">City</label>
                          <input value={filters.city} onChange={e => setFilter("city", e.target.value)} placeholder="e.g. Vijayawada"
                            className="input-field w-full text-xs py-1.5" />
                        </div>
                        <div>
                          <label className="text-xs text-base-content/40 mb-1 block">Sort By</label>
                          <select value={filters.sortBy} onChange={e => setFilter("sortBy", e.target.value)} className="input-field w-full text-xs py-1.5">
                            {["createdAt","legalName","partnershipStatus","kyc.verificationStatus"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-base-content/40 mb-1 block">Order</label>
                          <select value={filters.sortOrder} onChange={e => setFilter("sortOrder", e.target.value)} className="input-field w-full text-xs py-1.5">
                            <option value="desc">Newest First</option>
                            <option value="asc">Oldest First</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end mt-2">
                        <button onClick={() => { setFilters({ search:"",status:"",kycStatus:"",vehicleStatus:"",hasDriverProfile:"",city:"",state:"",sortBy:"createdAt",sortOrder:"desc" }); setPage(1); }}
                          className="text-xs text-base-content/40 hover:text-error flex items-center gap-1">
                          <RotateCcw size={11} /> Reset filters
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Table */}
              <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="glass-card overflow-hidden">
                {loadingList ? (
                  <div className="py-16 flex flex-col items-center gap-3">
                    <div className="spinner w-8 h-8" />
                    <p className="text-xs text-base-content/30">Loading partners…</p>
                  </div>
                ) : partners.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-3">
                    <Users size={32} className="text-base-content/20" />
                    <p className="text-sm text-base-content/30 font-medium">No partners found</p>
                    <button onClick={() => setCreateOpen(true)} className="btn-primary-cta px-4 py-2 text-xs rounded-xl flex items-center gap-1.5">
                      <Plus size={13} /> Create Partner
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-base-200/50 border-b border-base-300">
                          {["Partner", "Phone", "Status", "KYC", "Vehicle", "Location", "Driver", ""].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-base-content/40">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <motion.tbody variants={stagger} initial="hidden" animate="visible">
                        {partners.map(p => (
                          <PartnerRow key={p._id} partner={p} onView={handleViewPartner} />
                        ))}
                      </motion.tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {pagination && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-base-300 bg-base-200/30">
                    <p className="text-xs text-base-content/40">
                      Page {pagination.page} of {pagination.totalPages} · {pagination.total} partners
                    </p>
                    <div className="flex gap-1">
                      <button disabled={!pagination.hasPrev} onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="p-1.5 rounded-lg border border-base-300 hover:border-primary text-base-content/40 hover:text-primary disabled:opacity-30 transition-all">
                        <ChevronLeft size={14} />
                      </button>
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const p = pagination.page <= 3 ? i + 1 : pagination.page - 2 + i;
                        if (p < 1 || p > pagination.totalPages) return null;
                        return (
                          <button key={p} onClick={() => setPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${page === p ? "bg-primary text-primary-content" : "border border-base-300 text-base-content/40 hover:border-primary hover:text-primary"}`}>
                            {p}
                          </button>
                        );
                      })}
                      <button disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}
                        className="p-1.5 rounded-lg border border-base-300 hover:border-primary text-base-content/40 hover:text-primary disabled:opacity-30 transition-all">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Sidebar — compliance */}
            <div className="xl:col-span-1">
              <CompliancePanel alerts={complianceAlerts} total={complianceTotal} dispatch={dispatch} />
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {drawerOpen && selectedPartner && (
          <DetailDrawer partner={selectedPartner} onClose={() => setDrawerOpen(false)}
            dispatch={dispatch} loading={drawerLoading} />
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <CreatePartnerModal open={createOpen} onClose={() => setCreateOpen(false)}
        onSubmit={handleCreatePartner} loading={loadingCreate} />
    </div>
  );
}