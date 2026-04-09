"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import {
  Hospital, UserRound, ShieldCheck, Trash2, ToggleLeft, ToggleRight,
  MapPin, Upload, Link2, ImagePlus, BadgeCheck, BadgeX, Settings2,
  DollarSign, Stethoscope, ChevronDown, ChevronUp, Search, Filter,
  Plus, Edit3, X, Eye, EyeOff, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, Building2, Siren, Ambulance, FlaskConical, Droplets,
  Accessibility, BedDouble, Star, Activity, TrendingUp, Users,
  FileText, Key, CreditCard, Calendar, Phone, Mail, Globe, MessageSquare,
  Percent, Hash, Banknote, Lock, Unlink, Link, LayoutDashboard, Zap,
  ChevronRight, ArrowUpRight, Layers, Shield,
} from "lucide-react";

import {
  fetchAllHospitals, fetchHospitalById,
  createHospital, updateHospitalProfile, updateHospitalSettings,
  updateHospitalSecurity, updateHospitalPlatformFee,
  uploadHospitalImages, deleteHospitalImage, updateHospitalLocation,
  linkDoctorToHospital, unlinkDoctorFromHospital,
  verifyHospital, toggleHospitalActive, deleteHospital,
  fetchAllDoctors, createDoctorProfile, updateDoctorProfile,
  updateDoctorSettings, updateDoctorAvailability, updateDoctorBankDetails,
  updateDoctorKyc, uploadDoctorPhoto, updateDoctorSecurity,
  updateDoctorPlatformFee, updateDoctorPartnership, verifyDoctorKyc,
  toggleDoctorActive, deleteDoctorProfile,
  clearSelectedHospital, clearSelectedDoctor, clearError,
  selectHospitals, selectSelectedHospital, selectHospitalLoading,
  selectHospitalError, selectDoctors, selectSelectedDoctor,
  selectHospitalTotal, selectDoctorTotal,
} from "@/store/slices/hospitalSlice";

// ─── Constants ────────────────────────────────────────────────────────────────
const HOSPITAL_TYPES = ["Multi-Specialty","Super-Specialty","Clinic","Diagnostic Center","Government","Nursing Home","Trust"];
const SPECIALIZATIONS = ["General Physician","Cardiologist","Neurologist","Pediatrician","Oncologist","Orthopedic Surgeon","Gastroenterologist","Gynecologist","Dermatologist","Urologist","Psychiatry","Physiotherapist"];
const ACCREDITATIONS  = ["NABH","NABL","JCI","ISO","AHPI","Other"];
const SETTLEMENT_OPTS = ["weekly","biweekly","monthly"];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const KYC_STATUSES = ["not-submitted","pending","under-review","verified","rejected"];
const PARTNERSHIP_STATUSES = ["Pending","Active","Inactive","Suspended"];

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } }
};
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };
const slideRight = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } }
};
const scaleUp = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] } }
};

// ─── Design Tokens ────────────────────────────────────────────────────────────
const tokens = {
  primary: "var(--color-primary)",
  secondary: "var(--color-secondary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
};

const chartPalette = [
  "var(--color-primary)", "var(--color-secondary)", "var(--color-success)",
  "var(--color-warning)", "var(--color-error)", "var(--color-accent)",
];

// ══════════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ══════════════════════════════════════════════════════════════════════════════

function Input({ className = "", label, note, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="hm-label">{label}</label>}
      <input className={`hm-input ${className}`} {...props} />
      {note && <p className="hm-note">{note}</p>}
    </div>
  );
}

function Textarea({ className = "", label, note, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="hm-label">{label}</label>}
      <textarea className={`hm-input resize-none ${className}`} rows={3} {...props} />
      {note && <p className="hm-note">{note}</p>}
    </div>
  );
}

function Select({ className = "", label, note, children, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="hm-label">{label}</label>}
      <select className={`hm-input ${className}`} {...props}>{children}</select>
      {note && <p className="hm-note">{note}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${checked ? "bg-primary shadow-[0_0_10px_var(--color-primary,_rgba(99,102,241,0.5))]" : "bg-base-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${checked ? "translate-x-5" : ""}`} />
      </button>
      {label && <span className="text-xs font-semibold text-base-content/70 group-hover:text-base-content transition-colors">{label}</span>}
    </label>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all duration-200 ${active ? "bg-primary text-primary-content border-primary shadow-[0_0_12px_var(--color-primary,rgba(99,102,241,0.4))]" : "border-base-300 text-base-content/50 hover:border-primary/60 hover:text-base-content"}`}>
      {children}
    </button>
  );
}

function StatusBadge({ children, variant = "info" }) {
  const map = {
    success: "hm-badge-success",
    warning: "hm-badge-warning",
    error:   "hm-badge-error",
    info:    "hm-badge-info",
    primary: "hm-badge-primary",
  };
  return <span className={`hm-badge ${map[variant]}`}>{children}</span>;
}

function Btn({ children, variant = "primary", size = "md", loading = false, className = "", icon, ...props }) {
  const base = "inline-flex items-center gap-2 font-bold rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { xs: "px-2.5 py-1 text-[11px]", sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-sm" };
  const variants = {
    primary:   "hm-btn-primary focus-visible:ring-primary",
    secondary: "hm-btn-secondary focus-visible:ring-primary",
    success:   "hm-btn-success focus-visible:ring-success",
    danger:    "hm-btn-danger focus-visible:ring-error",
    ghost:     "hm-btn-ghost focus-visible:ring-primary",
    warning:   "hm-btn-warning focus-visible:ring-warning",
    subtle:    "hm-btn-subtle focus-visible:ring-primary",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={loading} {...props}>
      {loading ? <RefreshCw size={13} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, className = "", collapsible = false, defaultOpen = true, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`hm-section-card ${className}`}>
      <button onClick={() => collapsible && setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-5 py-3.5 ${collapsible ? "cursor-pointer" : "cursor-default"} transition-colors`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent || "bg-primary/15"}`}>
          <Icon size={14} className="text-primary" />
        </div>
        <span className="hm-section-title">{title}</span>
        {collapsible && (
          <ChevronDown size={14} className={`ml-auto text-base-content/30 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {(!collapsible || open) && (
          <motion.div key="c"
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden">
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ open, message, onConfirm, onCancel, danger = true }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <motion.div initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="hm-modal-surface max-w-sm w-full p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${danger ? "bg-error/15" : "bg-warning/15"}`}>
                <AlertTriangle size={18} className={danger ? "text-error" : "text-warning"} />
              </div>
              <div>
                <h3 className="font-bold text-base-content text-sm mb-1">Confirm Action</h3>
                <p className="text-xs text-base-content/60 leading-relaxed">{message}</p>
              </div>
            </div>
            <div className="flex gap-2.5 justify-end">
              <Btn variant="ghost" size="sm" onClick={onCancel}>Cancel</Btn>
              <Btn variant={danger ? "danger" : "warning"} size="sm" onClick={onConfirm}>Confirm</Btn>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, subtitle, icon: Icon, children, maxW = "max-w-2xl", accentColor }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center bg-black/65 backdrop-blur-md p-4 overflow-y-auto">
          <motion.div initial={{ scale: 0.94, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
            className={`hm-modal-surface w-full ${maxW} my-8`}>
            {/* Header */}
            <div className="hm-modal-header">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {Icon && (
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accentColor || "bg-primary/15"}`}>
                    <Icon size={16} className="text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-bold text-sm text-base-content truncate">{title}</h2>
                  {subtitle && <p className="text-[11px] text-base-content/45 mt-0.5 truncate">{subtitle}</p>}
                </div>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-300 transition-colors text-base-content/50 hover:text-base-content shrink-0">
                <X size={15} />
              </button>
            </div>
            {/* Body */}
            <div className="p-5 space-y-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── InfoBanner ───────────────────────────────────────────────────────────────
function InfoBanner({ children, variant = "info" }) {
  const map = {
    info:    "bg-info/8 border-info/25 text-info",
    warning: "bg-warning/8 border-warning/25 text-warning",
    success: "bg-success/8 border-success/25 text-success",
    error:   "bg-error/8 border-error/25 text-error",
  };
  return (
    <div className={`border rounded-xl p-3.5 text-[11px] leading-relaxed font-medium ${map[variant]}`}>
      {children}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, trend, color = "primary", sublabel }) {
  const colorMap = {
    primary:   { bg: "bg-primary/10",   text: "text-primary",   glow: "shadow-[0_0_20px_var(--color-primary,rgba(99,102,241,0.2))]" },
    secondary: { bg: "bg-secondary/10", text: "text-secondary", glow: "shadow-[0_0_20px_var(--color-secondary,rgba(99,102,241,0.2))]" },
    success:   { bg: "bg-success/10",   text: "text-success",   glow: "" },
    warning:   { bg: "bg-warning/10",   text: "text-warning",   glow: "" },
    error:     { bg: "bg-error/10",     text: "text-error",     glow: "" },
    info:      { bg: "bg-info/10",      text: "text-info",      glow: "" },
  };
  const c = colorMap[color] || colorMap.primary;

  return (
    <motion.div variants={fadeUp} className="hm-stat-card group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${c.bg} transition-all duration-300 group-hover:scale-110`}>
          <Icon size={20} className={c.text} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-[11px] font-bold ${trend >= 0 ? "text-success" : "text-error"}`}>
            <ArrowUpRight size={12} className={trend < 0 ? "rotate-180" : ""} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="hm-stat-value">{value}</p>
      <p className="hm-stat-label">{label}</p>
      {sublabel && <p className="text-[10px] text-base-content/35 mt-0.5">{sublabel}</p>}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOSPITAL FORMS
// ══════════════════════════════════════════════════════════════════════════════

function CreateHospitalModal({ open, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({
    name: "", hospitalType: "Multi-Specialty", description: "",
    contact: { phone: "", email: "", emergencyPhone: "", alternatePhone: "", website: "", whatsapp: "" },
    address: { line1: "", line2: "", landmark: "", city: "Vijayawada", state: "Andhra Pradesh", pincode: "" },
    registrationDetails: { licenseNumber: "", gstNumber: "", panNumber: "" },
    specialties: "", facilities: "", acceptedSchemes: "",
    bedCount: { total: 0, icu: 0 }, accreditations: [],
    isEmergencyReady: false, hasICU: false, hasBloodBank: false,
    hasPharmacy: false, hasDiagnostics: false, hasAmbulance: false,
    hasWheelchairAccess: false, is24x7: false, nabledLabAvailable: false,
    googleMapsUrl: "",
  });
  const set = (path, val) => setForm(prev => {
    const keys = path.split(".");
    const next = { ...prev };
    let cur = next;
    for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = { ...cur[keys[i]] }; cur = cur[keys[i]]; }
    cur[keys.at(-1)] = val; return next;
  });
  const handleSubmit = () => onSubmit({
    ...form,
    specialties: form.specialties.split(",").map(s => s.trim()).filter(Boolean),
    facilities: form.facilities.split(",").map(s => s.trim()).filter(Boolean),
    acceptedSchemes: form.acceptedSchemes.split(",").map(s => s.trim()).filter(Boolean),
  });

  const flags = [
    { key: "isEmergencyReady", label: "Emergency Ready", icon: Siren },
    { key: "hasICU", label: "ICU", icon: Activity },
    { key: "hasBloodBank", label: "Blood Bank", icon: Droplets },
    { key: "hasPharmacy", label: "Pharmacy", icon: Pill },
    { key: "hasDiagnostics", label: "Diagnostics", icon: FlaskConical },
    { key: "hasAmbulance", label: "Ambulance", icon: Ambulance },
    { key: "hasWheelchairAccess", label: "Wheelchair", icon: Accessibility },
    { key: "is24x7", label: "24×7", icon: Clock },
    { key: "nabledLabAvailable", label: "NABL Lab", icon: Shield },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Create New Hospital" subtitle="Register a hospital on the platform" icon={Building2} maxW="max-w-4xl">
      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
        <SectionCard title="Basic Identity" icon={Building2} collapsible defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <Input label="Hospital Name *" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Apollo Hospitals, Vijayawada" note="Official registered name" />
            <Select label="Hospital Type *" value={form.hospitalType} onChange={e => set("hospitalType", e.target.value)} note="Primary category">
              {HOSPITAL_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
            <Textarea label="Description" className="md:col-span-2" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Describe services, mission, and key features..." maxLength={1000} note="Public-facing overview (max 1000 chars)" />
            <Input label="Google Maps URL" value={form.googleMapsUrl} onChange={e => set("googleMapsUrl", e.target.value)} placeholder="https://maps.google.com/?q=..." note="For patient navigation" />
          </div>
        </SectionCard>

        <SectionCard title="Contact Details" icon={Phone} collapsible>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <Input label="Phone *" value={form.contact.phone} onChange={e => set("contact.phone", e.target.value)} placeholder="+91 98765 43210" note="Primary reception number" />
            <Input label="Email" type="email" value={form.contact.email} onChange={e => set("contact.email", e.target.value)} placeholder="info@hospital.com" />
            <Input label="Emergency Phone" value={form.contact.emergencyPhone} onChange={e => set("contact.emergencyPhone", e.target.value)} placeholder="+91 99999 00000" note="24/7 emergency helpline" />
            <Input label="Alternate Phone" value={form.contact.alternatePhone} onChange={e => set("contact.alternatePhone", e.target.value)} placeholder="+91 91234 56789" />
            <Input label="Website" value={form.contact.website} onChange={e => set("contact.website", e.target.value)} placeholder="https://hospital.com" />
            <Input label="WhatsApp" value={form.contact.whatsapp} onChange={e => set("contact.whatsapp", e.target.value)} placeholder="+91 98765 43210" />
          </div>
        </SectionCard>

        <SectionCard title="Address" icon={MapPin} collapsible>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <Input label="Address Line 1 *" className="md:col-span-2" value={form.address.line1} onChange={e => set("address.line1", e.target.value)} placeholder="123, MG Road, Benz Circle" />
            <Input label="Address Line 2" value={form.address.line2} onChange={e => set("address.line2", e.target.value)} placeholder="2nd Floor, Block B" />
            <Input label="Landmark" value={form.address.landmark} onChange={e => set("address.landmark", e.target.value)} placeholder="Near Benz Circle Flyover" />
            <Input label="City" value={form.address.city} onChange={e => set("address.city", e.target.value)} placeholder="Vijayawada" />
            <Input label="State" value={form.address.state} onChange={e => set("address.state", e.target.value)} placeholder="Andhra Pradesh" />
            <Input label="PIN Code *" value={form.address.pincode} onChange={e => set("address.pincode", e.target.value)} placeholder="520001" maxLength={6} />
          </div>
        </SectionCard>

        <SectionCard title="Registration / Legal" icon={FileText} collapsible>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
            <Input label="License Number *" value={form.registrationDetails.licenseNumber} onChange={e => set("registrationDetails.licenseNumber", e.target.value)} placeholder="AP/HOS/2024/001" note="Unique registration number" />
            <Input label="GST Number" value={form.registrationDetails.gstNumber} onChange={e => set("registrationDetails.gstNumber", e.target.value)} placeholder="37AABCU9603R1ZX" maxLength={15} />
            <Input label="PAN Number" value={form.registrationDetails.panNumber} onChange={e => set("registrationDetails.panNumber", e.target.value)} placeholder="ABCDE1234F" maxLength={10} />
          </div>
        </SectionCard>

        <SectionCard title="Specialties & Facilities" icon={Stethoscope} collapsible>
          <div className="space-y-3 mt-1">
            <Input label="Specialties" value={form.specialties} onChange={e => set("specialties", e.target.value)} placeholder="Cardiology, Neurology, Orthopedics" note="Comma-separated" />
            <Input label="Facilities" value={form.facilities} onChange={e => set("facilities", e.target.value)} placeholder="ICU, OT, Blood Bank, Cafeteria" note="Comma-separated" />
            <Input label="Accepted Schemes" value={form.acceptedSchemes} onChange={e => set("acceptedSchemes", e.target.value)} placeholder="Ayushman Bharat, CGHS, ESI" note="Comma-separated" />
            <div>
              <label className="hm-label mb-2 block">Accreditations</label>
              <div className="flex flex-wrap gap-1.5">
                {ACCREDITATIONS.map(a => (
                  <Pill key={a} active={form.accreditations.includes(a)} onClick={() => set("accreditations", form.accreditations.includes(a) ? form.accreditations.filter(x => x !== a) : [...form.accreditations, a])}>{a}</Pill>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Bed Count & Flags" icon={BedDouble} collapsible>
          <div className="mt-1 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Total Beds" type="number" min={0} value={form.bedCount.total} onChange={e => set("bedCount.total", +e.target.value)} placeholder="250" note="Inpatient capacity" />
              <Input label="ICU Beds" type="number" min={0} value={form.bedCount.icu} onChange={e => set("bedCount.icu", +e.target.value)} placeholder="20" />
            </div>
            <div className="hm-flags-grid">
              {flags.map(({ key, label, icon: FlagIcon }) => (
                <div key={key} className="hm-flag-item">
                  <FlagIcon size={13} className="text-primary/60 shrink-0" />
                  <Toggle checked={form[key]} onChange={v => set(key, v)} label={label} />
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </motion.div>

      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} onClick={handleSubmit} icon={<Plus size={14} />}>Create Hospital</Btn>
      </div>
    </Modal>
  );
}

function UpdateHospitalProfileModal({ open, onClose, hospital, onSubmit, loading }) {
  const [form, setForm] = useState({ name: "", description: "", hospitalType: "Multi-Specialty", googleMapsUrl: "", logo: "", images: "", specialties: "", facilities: "", acceptedSchemes: "", contact: {}, address: {}, accreditations: [], nabledLabAvailable: false });
  useEffect(() => {
    if (hospital) setForm({ name: hospital.name || "", description: hospital.description || "", hospitalType: hospital.hospitalType || "Multi-Specialty", googleMapsUrl: hospital.googleMapsUrl || "", logo: hospital.logo || "", images: (hospital.images || []).join(", "), specialties: (hospital.specialties || []).join(", "), facilities: (hospital.facilities || []).join(", "), acceptedSchemes: (hospital.acceptedSchemes || []).join(", "), contact: { ...hospital.contact }, address: { ...hospital.address }, accreditations: hospital.accreditations || [], nabledLabAvailable: hospital.nabledLabAvailable || false });
  }, [hospital]);
  const set = (path, val) => setForm(prev => { const keys = path.split("."); const next = { ...prev }; let cur = next; for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = { ...cur[keys[i]] }; cur = cur[keys[i]]; } cur[keys.at(-1)] = val; return next; });
  if (!hospital) return null;
  return (
    <Modal open={open} onClose={onClose} title="Edit Hospital Profile" subtitle={hospital.name} icon={Edit3} maxW="max-w-3xl">
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Hospital Name *" value={form.name} onChange={e => set("name", e.target.value)} />
          <Select label="Hospital Type *" value={form.hospitalType} onChange={e => set("hospitalType", e.target.value)}>
            {HOSPITAL_TYPES.map(t => <option key={t}>{t}</option>)}
          </Select>
          <Textarea label="Description" className="md:col-span-2" value={form.description} onChange={e => set("description", e.target.value)} maxLength={1000} />
        </div>
        <Input label="Logo URL" value={form.logo} onChange={e => set("logo", e.target.value)} placeholder="https://ik.imagekit.io/.../logo.png" />
        <Textarea label="Gallery Image URLs" value={form.images} onChange={e => set("images", e.target.value)} placeholder="Comma-separated CDN URLs" rows={2} />
        <Input label="Google Maps URL" value={form.googleMapsUrl} onChange={e => set("googleMapsUrl", e.target.value)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Phone" value={form.contact?.phone || ""} onChange={e => set("contact.phone", e.target.value)} placeholder="+91 98765 43210" />
          <Input label="Email" value={form.contact?.email || ""} onChange={e => set("contact.email", e.target.value)} />
          <Input label="Specialties" value={form.specialties} onChange={e => set("specialties", e.target.value)} placeholder="Comma-separated" />
          <Input label="Accepted Schemes" value={form.acceptedSchemes} onChange={e => set("acceptedSchemes", e.target.value)} placeholder="Comma-separated" />
        </div>
        <div>
          <label className="hm-label mb-2 block">Accreditations</label>
          <div className="flex flex-wrap gap-1.5">
            {ACCREDITATIONS.map(a => <Pill key={a} active={form.accreditations?.includes(a)} onClick={() => set("accreditations", form.accreditations?.includes(a) ? form.accreditations.filter(x => x !== a) : [...(form.accreditations || []), a])}>{a}</Pill>)}
          </div>
        </div>
        <Toggle checked={form.nabledLabAvailable} onChange={v => set("nabledLabAvailable", v)} label="NABL Lab Available" />
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} icon={<Edit3 size={14} />} onClick={() => onSubmit({ id: hospital._id, ...form, logo: form.logo || null, images: form.images ? form.images.split(",").map(s => s.trim()).filter(Boolean) : [], specialties: form.specialties.split(",").map(s => s.trim()).filter(Boolean), facilities: form.facilities.split(",").map(s => s.trim()).filter(Boolean), acceptedSchemes: form.acceptedSchemes.split(",").map(s => s.trim()).filter(Boolean) })}>Update Profile</Btn>
      </div>
    </Modal>
  );
}

function UpdateHospitalSettingsModal({ open, onClose, hospital, onSubmit, loading }) {
  const [form, setForm] = useState({ isEmergencyReady: false, hasICU: false, hasBloodBank: false, hasPharmacy: false, hasDiagnostics: false, hasAmbulance: false, hasWheelchairAccess: false, is24x7: false, nabledLabAvailable: false, bedCount: { total: 0, icu: 0 }, acceptedSchemes: "" });
  useEffect(() => { if (hospital) setForm({ isEmergencyReady: hospital.isEmergencyReady || false, hasICU: hospital.hasICU || false, hasBloodBank: hospital.hasBloodBank || false, hasPharmacy: hospital.hasPharmacy || false, hasDiagnostics: hospital.hasDiagnostics || false, hasAmbulance: hospital.hasAmbulance || false, hasWheelchairAccess: hospital.hasWheelchairAccess || false, is24x7: hospital.is24x7 || false, nabledLabAvailable: hospital.nabledLabAvailable || false, bedCount: { ...hospital.bedCount } || { total: 0, icu: 0 }, acceptedSchemes: (hospital.acceptedSchemes || []).join(", ") }); }, [hospital]);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setNested = (path, val) => setForm(prev => { const [k1, k2] = path.split("."); return { ...prev, [k1]: { ...prev[k1], [k2]: val } }; });
  if (!hospital) return null;
  const flags = [{ key: "isEmergencyReady", label: "Emergency Ready", icon: Siren }, { key: "hasICU", label: "Has ICU", icon: Activity }, { key: "hasBloodBank", label: "Blood Bank", icon: Droplets }, { key: "hasPharmacy", label: "Pharmacy", icon: Pill }, { key: "hasDiagnostics", label: "Diagnostics", icon: FlaskConical }, { key: "hasAmbulance", label: "Ambulance", icon: Ambulance }, { key: "hasWheelchairAccess", label: "Wheelchair", icon: Accessibility }, { key: "is24x7", label: "24×7 Open", icon: Clock }, { key: "nabledLabAvailable", label: "NABL Lab", icon: Shield }];
  return (
    <Modal open={open} onClose={onClose} title="Hospital Settings" subtitle={hospital.name} icon={Settings2}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Total Beds" type="number" min={0} value={form.bedCount.total} onChange={e => setNested("bedCount.total", +e.target.value)} note="Inpatient capacity" />
          <Input label="ICU Beds" type="number" min={0} value={form.bedCount.icu} onChange={e => setNested("bedCount.icu", +e.target.value)} />
        </div>
        <Input label="Accepted Schemes" value={form.acceptedSchemes} onChange={e => set("acceptedSchemes", e.target.value)} placeholder="CGHS, ESI, Ayushman Bharat" note="Comma-separated" />
        <div className="hm-flags-grid">
          {flags.map(({ key, label, icon: FlagIcon }) => (
            <div key={key} className="hm-flag-item"><FlagIcon size={13} className="text-primary/60 shrink-0" /><Toggle checked={form[key]} onChange={v => set(key, v)} label={label} /></div>
          ))}
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} icon={<Settings2 size={14} />} onClick={() => onSubmit({ id: hospital._id, ...form, acceptedSchemes: form.acceptedSchemes.split(",").map(s => s.trim()).filter(Boolean) })}>Save Settings</Btn>
      </div>
    </Modal>
  );
}

function UpdateHospitalSecurityModal({ open, onClose, hospital, onSubmit, loading }) {
  const [form, setForm] = useState({ licenseNumber: "", gstNumber: "", panNumber: "", documentUrl: "", licenseExpiry: "" });
  useEffect(() => { if (hospital?.registrationDetails) { const r = hospital.registrationDetails; setForm({ licenseNumber: r.licenseNumber || "", gstNumber: r.gstNumber || "", panNumber: r.panNumber || "", documentUrl: r.documentUrl || "", licenseExpiry: r.licenseExpiry ? r.licenseExpiry.split("T")[0] : "" }); } }, [hospital]);
  if (!hospital) return null;
  return (
    <Modal open={open} onClose={onClose} title="Registration Details" subtitle={hospital.name} icon={Lock}>
      <div className="space-y-3">
        <Input label="License Number" value={form.licenseNumber} onChange={e => setForm(p => ({ ...p, licenseNumber: e.target.value }))} placeholder="AP/HOS/2024/001" note="Must be unique on the platform" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="GST Number" value={form.gstNumber} onChange={e => setForm(p => ({ ...p, gstNumber: e.target.value }))} placeholder="37AABCU9603R1ZX" maxLength={15} />
          <Input label="PAN Number" value={form.panNumber} onChange={e => setForm(p => ({ ...p, panNumber: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" maxLength={10} />
          <Input label="License Expiry" type="date" value={form.licenseExpiry} onChange={e => setForm(p => ({ ...p, licenseExpiry: e.target.value }))} />
          <Input label="Document URL" value={form.documentUrl} onChange={e => setForm(p => ({ ...p, documentUrl: e.target.value }))} placeholder="https://cdn.example.com/license.pdf" />
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="warning" loading={loading} icon={<Key size={14} />} onClick={() => onSubmit({ id: hospital._id, ...form })}>Update Registration</Btn>
      </div>
    </Modal>
  );
}

function UpdateHospitalPlatformFeeModal({ open, onClose, hospital, onSubmit, loading }) {
  const [feeType, setFeeType] = useState("percentage");
  const [feeValue, setFeeValue] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [clearFee, setClearFee] = useState(false);
  const [clearCycle, setClearCycle] = useState(false);
  useEffect(() => { if (hospital) { setFeeType(hospital.platformFee?.type || "percentage"); setFeeValue(hospital.platformFee?.value ?? ""); setCycle(hospital.settlementCycle || "monthly"); setClearFee(!hospital.platformFee); setClearCycle(!hospital.settlementCycle); } }, [hospital]);
  if (!hospital) return null;
  return (
    <Modal open={open} onClose={onClose} title="Platform Fee Override" subtitle={hospital.name} icon={DollarSign}>
      <div className="space-y-4">
        <InfoBanner variant="info">Override applies only to this hospital. Clear to revert to global default.</InfoBanner>
        <div>
          <label className="hm-label mb-2 block">Fee Override</label>
          <Toggle checked={!clearFee} onChange={v => setClearFee(!v)} label="Enable custom fee" />
          {!clearFee && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Select label="Fee Type" value={feeType} onChange={e => setFeeType(e.target.value)}>
                <option value="fixed">Fixed (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </Select>
              <Input label={feeType === "fixed" ? "Amount (₹)" : "Percentage (%)"} type="number" min={0} max={feeType === "percentage" ? 100 : undefined} value={feeValue} onChange={e => setFeeValue(+e.target.value)} placeholder={feeType === "fixed" ? "200" : "8"} />
            </div>
          )}
        </div>
        <div>
          <label className="hm-label mb-2 block">Settlement Cycle</label>
          <Toggle checked={!clearCycle} onChange={v => setClearCycle(!v)} label="Enable custom cycle" />
          {!clearCycle && (
            <Select className="mt-3" value={cycle} onChange={e => setCycle(e.target.value)}>
              {SETTLEMENT_OPTS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
            </Select>
          )}
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="warning" loading={loading} icon={<DollarSign size={14} />} onClick={() => onSubmit({ id: hospital._id, platformFee: clearFee ? null : { type: feeType, value: +feeValue }, settlementCycle: clearCycle ? null : cycle })}>Save Fee</Btn>
      </div>
    </Modal>
  );
}

function UploadImagesModal({ open, onClose, hospital, onSubmit, loading }) {
  const [logoFile, setLogoFile] = useState(null);
  const [imgFiles, setImgFiles] = useState([]);
  const logoRef = useRef(), imgRef = useRef();
  if (!hospital) return null;
  return (
    <Modal open={open} onClose={onClose} title="Upload Images" subtitle={hospital.name} icon={ImagePlus}>
      <div className="space-y-4">
        <InfoBanner variant="warning">JPEG, PNG, WebP only. Max 5 MB per file. Gallery max: 20 images.</InfoBanner>
        <div className="hm-upload-zone" onClick={() => logoRef.current?.click()}>
          <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setLogoFile(e.target.files[0])} />
          <Upload size={20} className="text-base-content/30 mb-2" />
          <p className="text-xs font-semibold text-base-content/50">{logoFile ? logoFile.name : "Click to upload hospital logo"}</p>
          <p className="text-[11px] text-base-content/30 mt-1">Recommended: 512×512 px, transparent PNG</p>
          {hospital.logo && <img src={hospital.logo} alt="logo" className="mt-3 h-10 w-10 rounded-lg object-cover border border-base-300 mx-auto" />}
        </div>
        <div className="hm-upload-zone" onClick={() => imgRef.current?.click()}>
          <input ref={imgRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => setImgFiles(Array.from(e.target.files))} />
          <ImagePlus size={20} className="text-base-content/30 mb-2" />
          <p className="text-xs font-semibold text-base-content/50">{imgFiles.length > 0 ? `${imgFiles.length} file(s) selected` : "Click to upload gallery images"}</p>
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} icon={<Upload size={14} />} onClick={() => onSubmit({ id: hospital._id, logo: logoFile || undefined, images: imgFiles.length ? imgFiles : undefined })}>Upload</Btn>
      </div>
    </Modal>
  );
}

function UpdateLocationModal({ open, onClose, hospital, onSubmit, loading }) {
  const [lat, setLat] = useState(""); const [lng, setLng] = useState(""); const [mapsUrl, setMapsUrl] = useState("");
  useEffect(() => { if (hospital?.location?.coordinates) { setLng(hospital.location.coordinates[0]); setLat(hospital.location.coordinates[1]); } if (hospital?.googleMapsUrl) setMapsUrl(hospital.googleMapsUrl); }, [hospital]);
  if (!hospital) return null;
  return (
    <Modal open={open} onClose={onClose} title="Update Location" subtitle={hospital.name} icon={MapPin}>
      <div className="space-y-3">
        <InfoBanner variant="info">GeoJSON stores coordinates as [longitude, latitude].</InfoBanner>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Latitude" type="number" step="0.0001" value={lat} onChange={e => setLat(e.target.value)} placeholder="16.5062" note="Range: -90 to 90" />
          <Input label="Longitude" type="number" step="0.0001" value={lng} onChange={e => setLng(e.target.value)} placeholder="80.6480" note="Range: -180 to 180" />
        </div>
        <Input label="Google Maps URL" value={mapsUrl} onChange={e => setMapsUrl(e.target.value)} placeholder="https://maps.google.com/?q=16.5062,80.6480" />
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} icon={<MapPin size={14} />} onClick={() => onSubmit({ id: hospital._id, lat: +lat, lng: +lng, googleMapsUrl: mapsUrl || undefined })}>Update Location</Btn>
      </div>
    </Modal>
  );
}

function LinkDoctorModal({ open, onClose, hospital, doctors, onLink, onUnlink, loadingLink, loadingUnlink }) {
  const [search, setSearch] = useState("");
  if (!hospital) return null;
  const filtered = doctors.filter(d => { const name = d.user?.name || ""; return name.toLowerCase().includes(search.toLowerCase()) || (d.specialization || "").toLowerCase().includes(search.toLowerCase()); });
  const linked = hospital.linkedDoctors || [];
  return (
    <Modal open={open} onClose={onClose} title="Manage Linked Doctors" subtitle={hospital.name} icon={Stethoscope}>
      <div className="space-y-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/35" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or specialization..." className="hm-input w-full pl-9" />
        </div>
        <div className="max-h-52 overflow-y-auto space-y-1 hm-scrollarea">
          {filtered.slice(0, 12).map(doc => (
            <div key={doc._id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-base-200 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-secondary/15 flex items-center justify-center"><Stethoscope size={12} className="text-secondary" /></div>
                <div><p className="text-xs font-semibold text-base-content leading-tight">{doc.user?.name || "—"}</p><p className="text-[11px] text-base-content/45">{doc.specialization}</p></div>
              </div>
              <Btn size="xs" variant={linked.includes(doc._id) ? "subtle" : "primary"} loading={loadingLink || loadingUnlink}
                onClick={() => linked.includes(doc._id) ? onUnlink({ hospitalId: hospital._id, doctorId: doc._id }) : onLink({ hospitalId: hospital._id, doctorId: doc._id })}>
                {linked.includes(doc._id) ? <><Unlink size={11} /> Unlink</> : <><Link size={11} /> Link</>}
              </Btn>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-[11px] text-base-content/35 p-6 text-center">No doctors found</p>}
        </div>
        {linked.length > 0 && (
          <div><p className="hm-label mb-1.5">Currently Linked ({linked.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {linked.map((id, i) => { const doc = doctors.find(d => d._id === id); return <span key={i} className="hm-badge hm-badge-primary">{doc?.user?.name || id}</span>; })}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end pt-4 mt-2 border-t border-base-300"><Btn variant="ghost" onClick={onClose}>Close</Btn></div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCTOR FORMS
// ══════════════════════════════════════════════════════════════════════════════

function CreateDoctorModal({ open, onClose, onSubmit, loading, hospitals }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", specialization: "General Physician", experienceYears: 0, registrationNumber: "", registrationCouncil: "", biography: "", languagesSpoken: "", primaryHospital: "", fees: { inPersonFee: 0, videoFee: 0, homeVisitFee: 0, followUpFee: 0 }, consultationTypes: { inPerson: true, video: false, homeVisit: false } });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setNested = (path, val) => setForm(prev => { const [k1, k2] = path.split("."); return { ...prev, [k1]: { ...prev[k1], [k2]: val } }; });
  return (
    <Modal open={open} onClose={onClose} title="Create Doctor Account" subtitle="A user account is auto-created with credentials emailed to the doctor" icon={Stethoscope} maxW="max-w-3xl" accentColor="bg-success/15">
      <div className="space-y-4">
        <InfoBanner variant="success">A secure temporary password is emailed to the doctor upon creation.</InfoBanner>
        <SectionCard title="Identity & Contact" icon={UserRound} collapsible defaultOpen>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <Input label="Full Name *" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Dr. Ramesh Kumar" note="Appears on profile and emails" />
            <Input label="Email *" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="dr.ramesh@hospital.com" note="Login credentials sent here" />
            <Input label="Phone" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" />
            <Select label="Primary Hospital" value={form.primaryHospital} onChange={e => set("primaryHospital", e.target.value)}>
              <option value="">— None —</option>
              {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
            </Select>
          </div>
        </SectionCard>
        <SectionCard title="Professional Details" icon={Stethoscope} collapsible>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <Select label="Specialization *" value={form.specialization} onChange={e => set("specialization", e.target.value)}>{SPECIALIZATIONS.map(s => <option key={s}>{s}</option>)}</Select>
            <Input label="Experience (Years) *" type="number" min={0} max={70} value={form.experienceYears} onChange={e => set("experienceYears", +e.target.value)} placeholder="10" />
            <Input label="Registration Number" value={form.registrationNumber} onChange={e => set("registrationNumber", e.target.value)} placeholder="AP-12345/2015" note="Must be unique" />
            <Input label="Registration Council" value={form.registrationCouncil} onChange={e => set("registrationCouncil", e.target.value)} placeholder="AP Medical Council" />
            <Input label="Languages Spoken" className="md:col-span-2" value={form.languagesSpoken} onChange={e => set("languagesSpoken", e.target.value)} placeholder="Telugu, Hindi, English" note="Comma-separated" />
            <Textarea label="Biography" className="md:col-span-2" value={form.biography} onChange={e => set("biography", e.target.value)} placeholder="Professional bio..." maxLength={1000} />
          </div>
        </SectionCard>
        <SectionCard title="Fees & Consultation Types" icon={DollarSign} collapsible>
          <div className="mt-1 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label="In-Person (₹)" type="number" min={0} value={form.fees.inPersonFee} onChange={e => setNested("fees.inPersonFee", +e.target.value)} placeholder="500" />
              <Input label="Video (₹)" type="number" min={0} value={form.fees.videoFee} onChange={e => setNested("fees.videoFee", +e.target.value)} placeholder="300" />
              <Input label="Home Visit (₹)" type="number" min={0} value={form.fees.homeVisitFee} onChange={e => setNested("fees.homeVisitFee", +e.target.value)} placeholder="1000" />
              <Input label="Follow-Up (₹)" type="number" min={0} value={form.fees.followUpFee} onChange={e => setNested("fees.followUpFee", +e.target.value)} placeholder="200" />
            </div>
            <div className="flex flex-wrap gap-4">
              {[{ k: "inPerson", l: "In-Person" }, { k: "video", l: "Video" }, { k: "homeVisit", l: "Home Visit" }].map(({ k, l }) => (
                <Toggle key={k} checked={form.consultationTypes[k]} onChange={v => setNested(`consultationTypes.${k}`, v)} label={l} />
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" loading={loading} icon={<Plus size={14} />} onClick={() => onSubmit({ ...form, languagesSpoken: form.languagesSpoken.split(",").map(s => s.trim()).filter(Boolean) })}>Create Doctor</Btn>
      </div>
    </Modal>
  );
}

function UpdateDoctorProfileModal({ open, onClose, doctor, hospitals, onSubmit, loading }) {
  const [form, setForm] = useState({ specialization: "General Physician", experienceYears: 0, biography: "", languagesSpoken: "", achievements: "", fees: { inPersonFee: 0, videoFee: 0, homeVisitFee: 0, followUpFee: 0 }, consultationTypes: { inPerson: true, video: false, homeVisit: false }, primaryHospital: "", notifPrefs: { sms: true, email: true, push: true, whatsapp: true } });
  useEffect(() => { if (doctor) setForm({ specialization: doctor.specialization || "General Physician", experienceYears: doctor.experienceYears || 0, biography: doctor.biography || "", languagesSpoken: (doctor.languagesSpoken || []).join(", "), achievements: (doctor.achievements || []).join(", "), fees: { ...doctor.fees } || {}, consultationTypes: { ...doctor.consultationTypes } || {}, primaryHospital: doctor.primaryHospital?._id || doctor.primaryHospital || "", notifPrefs: { ...doctor.notifPrefs } || {} }); }, [doctor]);
  const setNested = (path, val) => setForm(prev => { const [k1, k2] = path.split("."); return { ...prev, [k1]: { ...prev[k1], [k2]: val } }; });
  if (!doctor) return null;
  return (
    <Modal open={open} onClose={onClose} title="Edit Doctor Profile" subtitle={doctor.user?.name} icon={Edit3} maxW="max-w-3xl">
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select label="Specialization" value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))}>{SPECIALIZATIONS.map(s => <option key={s}>{s}</option>)}</Select>
          <Input label="Experience (Years)" type="number" min={0} max={70} value={form.experienceYears} onChange={e => setForm(p => ({ ...p, experienceYears: +e.target.value }))} />
          <Select label="Primary Hospital" value={form.primaryHospital} onChange={e => setForm(p => ({ ...p, primaryHospital: e.target.value }))}><option value="">— None —</option>{hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}</Select>
          <Input label="Languages Spoken" value={form.languagesSpoken} onChange={e => setForm(p => ({ ...p, languagesSpoken: e.target.value }))} placeholder="Telugu, Hindi, English" note="Comma-separated" />
          <Input label="Achievements" className="md:col-span-2" value={form.achievements} onChange={e => setForm(p => ({ ...p, achievements: e.target.value }))} placeholder="Best Cardiologist 2022, AIIMS Fellowship" note="Comma-separated" />
          <Textarea label="Biography" className="md:col-span-2" value={form.biography} onChange={e => setForm(p => ({ ...p, biography: e.target.value }))} maxLength={1000} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input label="In-Person (₹)" type="number" min={0} value={form.fees.inPersonFee} onChange={e => setNested("fees.inPersonFee", +e.target.value)} />
          <Input label="Video (₹)" type="number" min={0} value={form.fees.videoFee} onChange={e => setNested("fees.videoFee", +e.target.value)} />
          <Input label="Home Visit (₹)" type="number" min={0} value={form.fees.homeVisitFee} onChange={e => setNested("fees.homeVisitFee", +e.target.value)} />
          <Input label="Follow-Up (₹)" type="number" min={0} value={form.fees.followUpFee} onChange={e => setNested("fees.followUpFee", +e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-4">
          {[{ k: "inPerson", l: "In-Person" }, { k: "video", l: "Video" }, { k: "homeVisit", l: "Home Visit" }].map(({ k, l }) => (
            <Toggle key={k} checked={form.consultationTypes[k]} onChange={v => setNested(`consultationTypes.${k}`, v)} label={l} />
          ))}
        </div>
        <div><p className="hm-label mb-2">Notifications</p>
          <div className="flex flex-wrap gap-4">
            {["sms", "email", "push", "whatsapp"].map(ch => <Toggle key={ch} checked={form.notifPrefs?.[ch] ?? true} onChange={v => setNested(`notifPrefs.${ch}`, v)} label={ch.charAt(0).toUpperCase() + ch.slice(1)} />)}
          </div>
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} icon={<Edit3 size={14} />} onClick={() => onSubmit({ id: doctor._id, ...form, languagesSpoken: form.languagesSpoken.split(",").map(s => s.trim()).filter(Boolean), achievements: form.achievements.split(",").map(s => s.trim()).filter(Boolean) })}>Update</Btn>
      </div>
    </Modal>
  );
}

function UpdateDoctorKycModal({ open, onClose, doctor, onSubmit, loading }) {
  const [form, setForm] = useState({ aadhaarNumber: "", aadhaarFrontUrl: "", aadhaarBackUrl: "", panNumber: "", panCardUrl: "" });
  useEffect(() => { if (doctor?.kyc) { const k = doctor.kyc; setForm({ aadhaarNumber: "", aadhaarFrontUrl: k.aadhaarFrontUrl || "", aadhaarBackUrl: k.aadhaarBackUrl || "", panNumber: "", panCardUrl: k.panCardUrl || "" }); } }, [doctor]);
  if (!doctor) return null;
  return (
    <Modal open={open} onClose={onClose} title="KYC Documents" subtitle={doctor.user?.name} icon={ShieldCheck}>
      <InfoBanner variant="warning">Aadhaar & PAN numbers stored with select:false — never returned in API responses.</InfoBanner>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <Input label="Aadhaar Number" type="password" value={form.aadhaarNumber} onChange={e => setForm(p => ({ ...p, aadhaarNumber: e.target.value }))} placeholder="XXXX XXXX XXXX" maxLength={12} note="Stored encrypted" />
        <Input label="PAN Number" type="password" value={form.panNumber} onChange={e => setForm(p => ({ ...p, panNumber: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" maxLength={10} note="Stored encrypted" />
        <Input label="Aadhaar Front URL" value={form.aadhaarFrontUrl} onChange={e => setForm(p => ({ ...p, aadhaarFrontUrl: e.target.value }))} placeholder="https://cdn.example.com/aadhaar_front.jpg" />
        <Input label="Aadhaar Back URL" value={form.aadhaarBackUrl} onChange={e => setForm(p => ({ ...p, aadhaarBackUrl: e.target.value }))} placeholder="https://cdn.example.com/aadhaar_back.jpg" />
        <Input label="PAN Card URL" className="md:col-span-2" value={form.panCardUrl} onChange={e => setForm(p => ({ ...p, panCardUrl: e.target.value }))} placeholder="https://cdn.example.com/pan_card.jpg" />
      </div>
      <div className="flex items-center gap-2 p-2.5 bg-base-200 rounded-lg mt-1">
        <span className="hm-label">KYC Status:</span>
        <StatusBadge variant={doctor.kycStatus === "verified" ? "success" : doctor.kycStatus === "rejected" ? "error" : "warning"}>{doctor.kycStatus}</StatusBadge>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} icon={<ShieldCheck size={14} />} onClick={() => onSubmit({ id: doctor._id, ...form })}>Submit KYC</Btn>
      </div>
    </Modal>
  );
}

function VerifyDoctorKycModal({ open, onClose, doctor, onSubmit, loading }) {
  const [action, setAction] = useState("approve");
  const [reason, setReason] = useState("");
  if (!doctor) return null;
  return (
    <Modal open={open} onClose={onClose} title="KYC Review" subtitle={doctor.user?.name} icon={ShieldCheck}>
      <div className="flex gap-2.5">
        {["approve", "reject"].map(a => (
          <button key={a} type="button" onClick={() => setAction(a)}
            className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center justify-center gap-1.5 ${action === a ? (a === "approve" ? "bg-success/15 text-success border-success/40" : "bg-error/15 text-error border-error/40") : "border-base-300 text-base-content/40 hover:border-base-300/80"}`}>
            {a === "approve" ? <><BadgeCheck size={14} /> Approve</> : <><BadgeX size={14} /> Reject</>}
          </button>
        ))}
      </div>
      {action === "reject" && <Textarea label="Rejection Reason *" value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why KYC is being rejected so the doctor can resubmit correctly..." />}
      <InfoBanner variant={action === "approve" ? "success" : "error"}>
        {action === "approve" ? "Approving sets kycStatus to 'verified' and activates the doctor account." : "Rejecting sets kycStatus to 'rejected'. Doctor must resubmit documents."}
      </InfoBanner>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant={action === "approve" ? "success" : "danger"} loading={loading} icon={action === "approve" ? <BadgeCheck size={14} /> : <BadgeX size={14} />} onClick={() => onSubmit({ id: doctor._id, action, rejectionReason: reason })}>
          {action === "approve" ? "Approve KYC" : "Reject KYC"}
        </Btn>
      </div>
    </Modal>
  );
}

function UpdateDoctorBankModal({ open, onClose, doctor, onSubmit, loading }) {
  const [form, setForm] = useState({ accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "", branchName: "", upiId: "", gstNumber: "", cancelledChequeUrl: "" });
  useEffect(() => { if (doctor?.bankDetails) { const b = doctor.bankDetails; setForm({ accountHolderName: b.accountHolderName || "", accountNumber: "", ifscCode: b.ifscCode || "", bankName: b.bankName || "", branchName: b.branchName || "", upiId: b.upiId || "", gstNumber: b.gstNumber || "", cancelledChequeUrl: b.cancelledChequeUrl || "" }); } }, [doctor]);
  if (!doctor) return null;
  return (
    <Modal open={open} onClose={onClose} title="Bank Details" subtitle={doctor.user?.name} icon={CreditCard}>
      <InfoBanner variant="warning">Account number stored with select:false. Last-4 digits shown publicly. Submitting triggers admin re-verification.</InfoBanner>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <Input label="Account Holder Name" value={form.accountHolderName} onChange={e => setForm(p => ({ ...p, accountHolderName: e.target.value }))} placeholder="Dr. Ramesh Kumar" note="Exactly as in passbook" />
        <Input label="Account Number" type="password" value={form.accountNumber} onChange={e => setForm(p => ({ ...p, accountNumber: e.target.value }))} placeholder="XXXXXXXXXXXXXXXX" note="Stored encrypted" />
        <Input label="IFSC Code" value={form.ifscCode} onChange={e => setForm(p => ({ ...p, ifscCode: e.target.value.toUpperCase() }))} placeholder="SBIN0001234" maxLength={11} />
        <Input label="Bank Name" value={form.bankName} onChange={e => setForm(p => ({ ...p, bankName: e.target.value }))} placeholder="State Bank of India" />
        <Input label="Branch Name" value={form.branchName} onChange={e => setForm(p => ({ ...p, branchName: e.target.value }))} placeholder="Benz Circle, Vijayawada" />
        <Input label="UPI ID" value={form.upiId} onChange={e => setForm(p => ({ ...p, upiId: e.target.value }))} placeholder="drramesh@oksbi" />
        <Input label="GST Number" value={form.gstNumber} onChange={e => setForm(p => ({ ...p, gstNumber: e.target.value }))} placeholder="37AABCD1234E1Z1" />
        <Input label="Cancelled Cheque URL" value={form.cancelledChequeUrl} onChange={e => setForm(p => ({ ...p, cancelledChequeUrl: e.target.value }))} placeholder="https://cdn.example.com/cheque.jpg" />
      </div>
      {doctor.bankDetails?.accountLast4 && <p className="text-[11px] text-base-content/40 mt-1">On file: ****{doctor.bankDetails.accountLast4} | Verified: {doctor.bankDetails.isBankVerified ? "✅" : "❌ Pending"}</p>}
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="warning" loading={loading} icon={<CreditCard size={14} />} onClick={() => onSubmit({ id: doctor._id, ...form })}>Update Bank</Btn>
      </div>
    </Modal>
  );
}

function UpdateDoctorSecurityModal({ open, onClose, doctor, onSubmit, loading }) {
  const [form, setForm] = useState({ registrationNumber: "", registrationCouncil: "", contractUrl: "", adminNotes: "" });
  useEffect(() => { if (doctor) setForm({ registrationNumber: doctor.registrationNumber || "", registrationCouncil: doctor.registrationCouncil || "", contractUrl: doctor.contractUrl || "", adminNotes: "" }); }, [doctor]);
  if (!doctor) return null;
  return (
    <Modal open={open} onClose={onClose} title="Security Details" subtitle={doctor.user?.name} icon={Lock}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Registration Number" value={form.registrationNumber} onChange={e => setForm(p => ({ ...p, registrationNumber: e.target.value }))} placeholder="AP-12345/2015" note="Must be globally unique" />
          <Input label="Registration Council" value={form.registrationCouncil} onChange={e => setForm(p => ({ ...p, registrationCouncil: e.target.value }))} placeholder="AP Medical Council" />
          <Input label="Contract URL" className="md:col-span-2" value={form.contractUrl} onChange={e => setForm(p => ({ ...p, contractUrl: e.target.value }))} placeholder="https://cdn.example.com/contract.pdf" note="Signed partner agreement (PDF)" />
          <Textarea label="Admin Notes (Private)" className="md:col-span-2" value={form.adminNotes} onChange={e => setForm(p => ({ ...p, adminNotes: e.target.value }))} placeholder="Internal notes, never shown to doctor..." />
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="warning" loading={loading} icon={<Lock size={14} />} onClick={() => onSubmit({ id: doctor._id, ...form })}>Save</Btn>
      </div>
    </Modal>
  );
}

function UpdateDoctorPlatformFeeModal({ open, onClose, doctor, onSubmit, loading }) {
  const [feeType, setFeeType] = useState("percentage"); const [feeValue, setFeeValue] = useState(""); const [clearFee, setClearFee] = useState(false);
  useEffect(() => { if (doctor) { setFeeType(doctor.platformFee?.type || "percentage"); setFeeValue(doctor.platformFee?.value ?? ""); setClearFee(!doctor.platformFee); } }, [doctor]);
  if (!doctor) return null;
  return (
    <Modal open={open} onClose={onClose} title="Platform Fee Override" subtitle={doctor.user?.name} icon={DollarSign}>
      <InfoBanner variant="info">Overrides global doctor platform fee for this doctor only. Clear to use global default.</InfoBanner>
      <div className="mt-3 space-y-3">
        <Toggle checked={!clearFee} onChange={v => setClearFee(!v)} label="Enable custom fee override" />
        {!clearFee && (
          <div className="grid grid-cols-2 gap-3">
            <Select label="Fee Type" value={feeType} onChange={e => setFeeType(e.target.value)}><option value="fixed">Fixed (₹)</option><option value="percentage">Percentage (%)</option></Select>
            <Input label={feeType === "fixed" ? "Amount (₹)" : "Percentage (%)"} type="number" min={0} max={feeType === "percentage" ? 100 : undefined} value={feeValue} onChange={e => setFeeValue(+e.target.value)} />
          </div>
        )}
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="warning" loading={loading} icon={<DollarSign size={14} />} onClick={() => onSubmit({ id: doctor._id, platformFee: clearFee ? null : { type: feeType, value: +feeValue } })}>Save</Btn>
      </div>
    </Modal>
  );
}

function UpdateDoctorPartnershipModal({ open, onClose, doctor, onSubmit, loading }) {
  const [form, setForm] = useState({ partnershipStatus: "Pending", partnerSince: "", contractUrl: "", adminNotes: "" });
  useEffect(() => { if (doctor) setForm({ partnershipStatus: doctor.partnershipStatus || "Pending", partnerSince: doctor.partnerSince ? doctor.partnerSince.split("T")[0] : "", contractUrl: doctor.contractUrl || "", adminNotes: "" }); }, [doctor]);
  if (!doctor) return null;
  return (
    <Modal open={open} onClose={onClose} title="Partnership Status" subtitle={doctor.user?.name} icon={BadgeCheck}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select label="Partnership Status" value={form.partnershipStatus} onChange={e => setForm(p => ({ ...p, partnershipStatus: e.target.value }))} note="'Active' required for public visibility">
            {PARTNERSHIP_STATUSES.map(s => <option key={s}>{s}</option>)}
          </Select>
          <Input label="Partner Since" type="date" value={form.partnerSince} onChange={e => setForm(p => ({ ...p, partnerSince: e.target.value }))} note="Auto-set on first 'Active' status" />
          <Input label="Contract URL" className="md:col-span-2" value={form.contractUrl} onChange={e => setForm(p => ({ ...p, contractUrl: e.target.value }))} placeholder="https://cdn.example.com/contract.pdf" />
          <Textarea label="Admin Notes (Private)" className="md:col-span-2" value={form.adminNotes} onChange={e => setForm(p => ({ ...p, adminNotes: e.target.value }))} placeholder="Partnership terms, special conditions..." />
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} icon={<BadgeCheck size={14} />} onClick={() => onSubmit({ id: doctor._id, ...form })}>Update</Btn>
      </div>
    </Modal>
  );
}

function UpdateDoctorSettingsModal({ open, onClose, doctor, onSubmit, loading }) {
  const [form, setForm] = useState({ isOnline: false, settlementCycle: "monthly", onboarding: { step: 1, isComplete: false } });
  useEffect(() => { if (doctor) setForm({ isOnline: doctor.isOnline || false, settlementCycle: doctor.settlementCycle || "monthly", onboarding: { ...doctor.onboarding } || { step: 1, isComplete: false } }); }, [doctor]);
  if (!doctor) return null;
  return (
    <Modal open={open} onClose={onClose} title="Doctor Settings" subtitle={doctor.user?.name} icon={Settings2}>
      <div className="space-y-4">
        <Select label="Settlement Cycle" value={form.settlementCycle} onChange={e => setForm(p => ({ ...p, settlementCycle: e.target.value }))} note="Overrides global default for this doctor">
          {SETTLEMENT_OPTS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
        </Select>
        <div className="hm-flag-item"><Activity size={13} className="text-primary/60 shrink-0" /><Toggle checked={form.isOnline} onChange={v => setForm(p => ({ ...p, isOnline: v }))} label="Currently Online (visible for live consultations)" /></div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Onboarding Step" type="number" min={1} value={form.onboarding.step} onChange={e => setForm(p => ({ ...p, onboarding: { ...p.onboarding, step: +e.target.value } }))} />
          <div className="flex flex-col gap-1.5"><label className="hm-label">Onboarding Complete?</label><Toggle checked={form.onboarding.isComplete} onChange={v => setForm(p => ({ ...p, onboarding: { ...p.onboarding, isComplete: v } }))} label="Mark complete" /></div>
        </div>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} icon={<Settings2 size={14} />} onClick={() => onSubmit({ id: doctor._id, ...form })}>Save Settings</Btn>
      </div>
    </Modal>
  );
}

function UpdateDoctorAvailabilityModal({ open, onClose, doctor, onSubmit, loading }) {
  const [slots, setSlots] = useState(DAYS.map(day => ({ day, slots: [] })));
  useEffect(() => { if (doctor?.availability?.length) { const filled = DAYS.map(day => { const found = doctor.availability.find(a => a.day === day); return found || { day, slots: [] }; }); setSlots(filled); } }, [doctor]);
  const addSlot = di => setSlots(prev => prev.map((d, i) => i === di ? { ...d, slots: [...d.slots, { startTime: "09:00", endTime: "17:00", maxPatients: 10 }] } : d));
  const removeSlot = (di, si) => setSlots(prev => prev.map((d, i) => i === di ? { ...d, slots: d.slots.filter((_, j) => j !== si) } : d));
  const updateSlot = (di, si, key, val) => setSlots(prev => prev.map((d, i) => i === di ? { ...d, slots: d.slots.map((s, j) => j === si ? { ...s, [key]: val } : s) } : d));
  if (!doctor) return null;
  return (
    <Modal open={open} onClose={onClose} title="Weekly Availability" subtitle={doctor.user?.name} icon={Calendar} maxW="max-w-3xl">
      <p className="text-[11px] text-base-content/40 mb-3">Configure weekly slots. Multiple time windows per day allowed. 24-hour HH:MM format.</p>
      <div className="space-y-2">
        {slots.map((daySlot, di) => (
          <div key={daySlot.day} className="hm-avail-day">
            <div className="flex items-center justify-between px-4 py-2.5 bg-base-200/60">
              <span className="text-xs font-bold text-base-content">{daySlot.day}</span>
              <Btn size="xs" variant="subtle" onClick={() => addSlot(di)} icon={<Plus size={11} />}>Add Slot</Btn>
            </div>
            {daySlot.slots.length > 0 ? (
              <div className="p-3 space-y-2">
                {daySlot.slots.map((slot, si) => (
                  <div key={si} className="flex items-end gap-2">
                    <Input label="Start" type="time" value={slot.startTime} onChange={e => updateSlot(di, si, "startTime", e.target.value)} />
                    <Input label="End" type="time" value={slot.endTime} onChange={e => updateSlot(di, si, "endTime", e.target.value)} />
                    <Input label="Max Patients" type="number" min={1} value={slot.maxPatients} onChange={e => updateSlot(di, si, "maxPatients", +e.target.value)} className="w-24" />
                    <button onClick={() => removeSlot(di, si)} className="mb-1 p-1.5 text-error/60 hover:text-error hover:bg-error/10 rounded-lg transition-colors"><X size={13} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-2 text-[11px] text-base-content/30">Unavailable this day</p>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} icon={<Calendar size={14} />} onClick={() => onSubmit({ id: doctor._id, availability: slots })}>Save Availability</Btn>
      </div>
    </Modal>
  );
}

function UploadDoctorPhotoModal({ open, onClose, doctor, onSubmit, loading }) {
  const [file, setFile] = useState(null);
  const fileRef = useRef();
  if (!doctor) return null;
  return (
    <Modal open={open} onClose={onClose} title="Profile Photo" subtitle={doctor.user?.name} icon={ImagePlus}>
      <div className="hm-upload-zone" onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setFile(e.target.files[0])} />
        {doctor.user?.avatar ? <img src={doctor.user.avatar} alt="profile" className="h-16 w-16 rounded-full object-cover border-2 border-primary/30 mb-3 mx-auto" /> : <UserRound size={28} className="text-base-content/20 mb-2" />}
        <p className="text-xs font-semibold text-base-content/50">{file ? file.name : "Click to upload photo"}</p>
        <p className="text-[11px] text-base-content/30 mt-1">JPEG/PNG/WebP, max 5 MB, recommended 400×400 px</p>
      </div>
      <div className="flex gap-2.5 justify-end pt-4 mt-2 border-t border-base-300">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={loading} disabled={!file} icon={<Upload size={14} />} onClick={() => onSubmit({ id: doctor._id, photo: file })}>Upload</Btn>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TABLE ROWS
// ══════════════════════════════════════════════════════════════════════════════

function HospitalRow({ hospital, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const actions = [
    { label: "Edit Profile", icon: Edit3, action: "editProfile", variant: "subtle" },
    { label: "Settings", icon: Settings2, action: "settings", variant: "subtle" },
    { label: "Registration", icon: Lock, action: "security", variant: "subtle" },
    { label: "Platform Fee", icon: DollarSign, action: "platformFee", variant: "subtle" },
    { label: "Images", icon: ImagePlus, action: "uploadImages", variant: "subtle" },
    { label: "Location", icon: MapPin, action: "location", variant: "subtle" },
    { label: "Doctors", icon: Stethoscope, action: "linkDoctors", variant: "subtle" },
    { label: hospital.isVerified ? "Unverify" : "Verify", icon: hospital.isVerified ? BadgeX : BadgeCheck, action: "verify", variant: hospital.isVerified ? "warning" : "success" },
    { label: hospital.isActive ? "Deactivate" : "Activate", icon: hospital.isActive ? ToggleLeft : ToggleRight, action: "toggle", variant: "ghost" },
    { label: "Delete", icon: Trash2, action: "delete", variant: "danger" },
  ];
  return (
    <>
      <motion.tr variants={fadeUp} className={`hm-table-row ${expanded ? "hm-table-row-active" : ""}`} onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            {hospital.logo ? <img src={hospital.logo} alt="" className="h-9 w-9 rounded-xl object-cover ring-1 ring-base-300" /> : <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Building2 size={15} className="text-primary" /></div>}
            <div><p className="text-xs font-bold text-base-content leading-tight">{hospital.name}</p><p className="text-[11px] text-base-content/45 mt-0.5">{hospital.hospitalType}</p></div>
          </div>
        </td>
        <td className="px-4 py-3.5 text-[11px] text-base-content/55">{hospital.address?.city}, {hospital.address?.state}</td>
        <td className="px-4 py-3.5"><StatusBadge variant={hospital.isVerified ? "success" : "warning"}>{hospital.isVerified ? "Verified" : "Unverified"}</StatusBadge></td>
        <td className="px-4 py-3.5"><StatusBadge variant={hospital.isActive ? "success" : "error"}>{hospital.isActive ? "Active" : "Inactive"}</StatusBadge></td>
        <td className="px-4 py-3.5 text-[11px] text-base-content/55">{hospital.rating?.averageRating?.toFixed(1) || "—"} ★</td>
        <td className="px-4 py-3.5 text-right pr-5"><ChevronDown size={14} className={`text-base-content/30 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} /></td>
      </motion.tr>
      <AnimatePresence>
        {expanded && (
          <motion.tr key="exp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <td colSpan={6} className="px-4 pb-4 pt-0">
              <div className="hm-action-bar">
                {actions.map(({ label, icon: Icon, action, variant }) => (
                  <Btn key={action} size="sm" variant={variant} icon={<Icon size={12} />}
                    onClick={e => { e.stopPropagation(); onAction(action, hospital); }}>
                    {label}
                  </Btn>
                ))}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

function DoctorRow({ doctor, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const actions = [
    { label: "Edit", icon: Edit3, action: "editProfile", variant: "subtle" },
    { label: "Settings", icon: Settings2, action: "settings", variant: "subtle" },
    { label: "Availability", icon: Calendar, action: "availability", variant: "subtle" },
    { label: "Bank", icon: CreditCard, action: "bankDetails", variant: "subtle" },
    { label: "KYC Docs", icon: ShieldCheck, action: "kyc", variant: "subtle" },
    { label: "Verify KYC", icon: BadgeCheck, action: "verifyKyc", variant: "success" },
    { label: "Photo", icon: ImagePlus, action: "uploadPhoto", variant: "subtle" },
    { label: "Security", icon: Lock, action: "security", variant: "subtle" },
    { label: "Platform Fee", icon: DollarSign, action: "platformFee", variant: "subtle" },
    { label: "Partnership", icon: BadgeCheck, action: "partnership", variant: "subtle" },
    { label: doctor.isActive ? "Deactivate" : "Activate", icon: doctor.isActive ? ToggleLeft : ToggleRight, action: "toggle", variant: "ghost" },
    { label: "Delete", icon: Trash2, action: "delete", variant: "danger" },
  ];
  return (
    <>
      <motion.tr variants={fadeUp} className={`hm-table-row ${expanded ? "hm-table-row-active" : ""}`} onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-3">
            {doctor.user?.avatar ? <img src={doctor.user.avatar} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-base-300" /> : <div className="h-9 w-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0"><Stethoscope size={15} className="text-secondary" /></div>}
            <div><p className="text-xs font-bold text-base-content leading-tight">{doctor.user?.name || "—"}</p><p className="text-[11px] text-base-content/45 mt-0.5">{doctor.specialization}</p></div>
          </div>
        </td>
        <td className="px-4 py-3.5 text-[11px] text-base-content/55">{doctor.experienceYears} yrs</td>
        <td className="px-4 py-3.5"><StatusBadge variant={doctor.kycStatus === "verified" ? "success" : doctor.kycStatus === "rejected" ? "error" : "warning"}>{doctor.kycStatus}</StatusBadge></td>
        <td className="px-4 py-3.5"><StatusBadge variant={doctor.partnershipStatus === "Active" ? "success" : doctor.partnershipStatus === "Suspended" ? "error" : "warning"}>{doctor.partnershipStatus}</StatusBadge></td>
        <td className="px-4 py-3.5"><StatusBadge variant={doctor.isActive ? "success" : "error"}>{doctor.isActive ? "Active" : "Inactive"}</StatusBadge></td>
        <td className="px-4 py-3.5 text-right pr-5"><ChevronDown size={14} className={`text-base-content/30 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} /></td>
      </motion.tr>
      <AnimatePresence>
        {expanded && (
          <motion.tr key="exp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <td colSpan={6} className="px-4 pb-4 pt-0">
              <div className="hm-action-bar">
                {actions.map(({ label, icon: Icon, action, variant }) => (
                  <Btn key={action} size="sm" variant={variant} icon={<Icon size={12} />}
                    onClick={e => { e.stopPropagation(); onAction(action, doctor); }}>
                    {label}
                  </Btn>
                ))}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW PANEL
// ══════════════════════════════════════════════════════════════════════════════

function OverviewPanel({ hospitals, doctors }) {
  const hospitalTypeData = HOSPITAL_TYPES.map(t => ({ name: t.split("-")[0], count: hospitals.filter(h => h.hospitalType === t).length })).filter(d => d.count > 0);
  const kycData = KYC_STATUSES.map(s => ({ name: s.replace("-", " "), count: doctors.filter(d => d.kycStatus === s).length })).filter(d => d.count > 0);
  const partnerData = PARTNERSHIP_STATUSES.map(s => ({ name: s, count: doctors.filter(d => d.partnershipStatus === s).length })).filter(d => d.count > 0);
  const specializationData = SPECIALIZATIONS.map(s => ({ name: s.split(" ")[0], count: doctors.filter(d => d.specialization === s).length })).filter(d => d.count > 0).slice(0, 8);
  const verifiedH = hospitals.filter(h => h.isVerified).length;
  const activeH = hospitals.filter(h => h.isActive).length;
  const activeD = doctors.filter(d => d.isActive).length;
  const onlineD = doctors.filter(d => d.isOnline).length;

  const tooltipStyle = { background: "var(--base-200)", border: "1px solid var(--base-300)", borderRadius: 8, fontSize: 11, color: "var(--base-content)" };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Hospitals" value={hospitals.length} icon={Building2} color="primary" sublabel="Platform-wide" />
        <StatCard label="Verified" value={verifiedH} icon={BadgeCheck} color="success" sublabel={`${hospitals.length ? Math.round(verifiedH / hospitals.length * 100) : 0}% of total`} />
        <StatCard label="Active Doctors" value={activeD} icon={Stethoscope} color="secondary" sublabel={`${doctors.length} total registered`} />
        <StatCard label="Online Now" value={onlineD} icon={Activity} color="info" sublabel="Live consultation" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp} className="hm-chart-card">
          <div className="hm-chart-header"><span className="hm-chart-title">Hospital Types</span><Layers size={14} className="text-base-content/30" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hospitalTypeData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--primary)", opacity: 0.06 }} />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[5, 5, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={fadeUp} className="hm-chart-card">
          <div className="hm-chart-header"><span className="hm-chart-title">Doctor KYC Status</span><ShieldCheck size={14} className="text-base-content/30" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={kycData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                {kycData.map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--base-content)", opacity: 0.6 }} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={fadeUp} className="hm-chart-card">
          <div className="hm-chart-header"><span className="hm-chart-title">Specializations</span><Stethoscope size={14} className="text-base-content/30" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={specializationData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 52 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.6 }} width={52} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)", opacity: 0.06 }} />
              <Bar dataKey="count" fill="var(--color-secondary)" radius={[0, 5, 5, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={fadeUp} className="hm-chart-card">
          <div className="hm-chart-header"><span className="hm-chart-title">Partnership Status</span><BadgeCheck size={14} className="text-base-content/30" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={partnerData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                {partnerData.map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--base-content)", opacity: 0.6 }} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div variants={fadeUp} className="hm-chart-card">
        <div className="hm-chart-header"><span className="hm-chart-title">Quick Stats</span><Zap size={14} className="text-base-content/30" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
          {[
            { label: "Active Hospitals", value: activeH, color: "text-success" },
            { label: "KYC Pending", value: doctors.filter(d => d.kycStatus === "pending").length, color: "text-warning" },
            { label: "KYC Verified", value: doctors.filter(d => d.kycStatus === "verified").length, color: "text-success" },
            { label: "Active Partners", value: doctors.filter(d => d.partnershipStatus === "Active").length, color: "text-primary" },
          ].map(({ label, value, color }) => (
            <div key={label} className="hm-quick-stat">
              <p className={`text-3xl font-black tabular-nums ${color}`}>{value}</p>
              <p className="text-[11px] text-base-content/40 mt-1 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SIDE NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, badge: null },
  { id: "hospitals", label: "Hospitals", icon: Building2, badge: "hospitalTotal" },
  { id: "doctors", label: "Doctors", icon: Stethoscope, badge: "doctorTotal" },
];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function HospitalManagement() {
  const dispatch = useDispatch();
  const hospitals = useSelector(selectHospitals) || [];
  const doctors = useSelector(selectDoctors) || [];
  const loading = useSelector(selectHospitalLoading) || {};
  const error = useSelector(selectHospitalError);
  const hospitalTotal = useSelector(selectHospitalTotal) || 0;
  const doctorTotal = useSelector(selectDoctorTotal) || 0;

  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modals, setModals] = useState({});
  const [active, setActive] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, message: "", onConfirm: null });

  const openModal = (key, entity = null) => { setActive(entity); setModals(m => ({ ...m, [key]: true })); };
  const closeModal = key => setModals(m => ({ ...m, [key]: false }));
  const askConfirm = (message, fn) => setConfirm({ open: true, message, onConfirm: fn });
  const cancelConfirm = () => setConfirm({ open: false, message: "", onConfirm: null });

  useEffect(() => {
    dispatch(fetchAllHospitals({ page, limit: 20 }));
    dispatch(fetchAllDoctors({ page: 1, limit: 50 }));
  }, [dispatch, page]);

  useEffect(() => {
    if (error) { const t = setTimeout(() => dispatch(clearError()), 5000); return () => clearTimeout(t); }
  }, [error, dispatch]);

  const handleHospitalAction = (action, hospital) => {
    const map = {
      editProfile: () => openModal("editHospitalProfile", hospital),
      settings: () => openModal("editHospitalSettings", hospital),
      security: () => openModal("editHospitalSecurity", hospital),
      platformFee: () => openModal("editHospitalFee", hospital),
      uploadImages: () => openModal("uploadHospitalImages", hospital),
      location: () => openModal("editHospitalLocation", hospital),
      linkDoctors: () => openModal("linkDoctors", hospital),
      verify: () => askConfirm(`${hospital.isVerified ? "Unverify" : "Verify"} "${hospital.name}"?`, () => { dispatch(verifyHospital({ id: hospital._id, isVerified: !hospital.isVerified })); cancelConfirm(); }),
      toggle: () => askConfirm(`${hospital.isActive ? "Deactivate" : "Activate"} "${hospital.name}"?`, () => { dispatch(toggleHospitalActive(hospital._id)); cancelConfirm(); }),
      delete: () => askConfirm(`Permanently delete "${hospital.name}"? This cannot be undone.`, () => { dispatch(deleteHospital(hospital._id)); cancelConfirm(); }),
    };
    map[action]?.();
  };

  const handleDoctorAction = (action, doctor) => {
    const map = {
      editProfile: () => openModal("editDoctorProfile", doctor),
      settings: () => openModal("editDoctorSettings", doctor),
      availability: () => openModal("editDoctorAvailability", doctor),
      bankDetails: () => openModal("editDoctorBank", doctor),
      kyc: () => openModal("editDoctorKyc", doctor),
      verifyKyc: () => openModal("verifyDoctorKyc", doctor),
      uploadPhoto: () => openModal("uploadDoctorPhoto", doctor),
      security: () => openModal("editDoctorSecurity", doctor),
      platformFee: () => openModal("editDoctorFee", doctor),
      partnership: () => openModal("editDoctorPartnership", doctor),
      toggle: () => askConfirm(`${doctor.isActive ? "Deactivate" : "Activate"} Dr. ${doctor.user?.name}?`, () => { dispatch(toggleDoctorActive(doctor._id)); cancelConfirm(); }),
      delete: () => askConfirm(`Permanently delete Dr. ${doctor.user?.name}? This cannot be undone.`, () => { dispatch(deleteDoctorProfile(doctor._id)); cancelConfirm(); }),
    };
    map[action]?.();
  };

  const filteredHospitals = hospitals.filter(h =>
    h.name?.toLowerCase().includes(search.toLowerCase()) ||
    h.address?.city?.toLowerCase().includes(search.toLowerCase()) ||
    h.hospitalType?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDoctors = doctors.filter(d =>
    (d.user?.name || "").toLowerCase().includes(search.toLowerCase()) ||
    d.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  const tabCounts = { hospitals: hospitalTotal, doctors: doctorTotal };

  return (
    <>
      {/* ─── Scoped Styles ─────────────────────────────────────────────────── */}
      <style>{`
        /* ── Layout ── */
        .hm-root { display: flex; min-height: 100vh; background: var(--base-100); font-family: var(--font-family-poppins, ui-sans-serif, system-ui, sans-serif); }
        .hm-sidebar { width: 220px; shrink: 0; border-right: 1px solid var(--base-300); background: var(--base-100); display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; }
        .hm-content { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .hm-topbar { position: sticky; top: 0; z-index: 50; background: color-mix(in oklch, var(--base-100) 85%, transparent); backdrop-filter: blur(16px); border-bottom: 1px solid var(--base-300); padding: 0 1.5rem; height: 56px; display: flex; align-items: center; gap: 1rem; }
        .hm-main { flex: 1; padding: 1.5rem; max-width: 1200px; margin: 0 auto; width: 100%; }

        /* ── Sidebar ── */
        .hm-logo { padding: 1rem 1.25rem; border-bottom: 1px solid var(--base-300); display: flex; align-items: center; gap: 0.625rem; }
        .hm-logo-icon { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); display: flex; align-items: center; justify-content: center; }
        .hm-logo-text { font-size: 0.8rem; font-weight: 800; color: var(--base-content); line-height: 1.2; letter-spacing: -0.01em; }
        .hm-logo-sub { font-size: 0.6rem; color: color-mix(in oklch, var(--base-content) 40%, transparent); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
        .hm-nav { padding: 0.75rem 0.75rem; display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .hm-nav-item { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.78rem; font-weight: 600; color: color-mix(in oklch, var(--base-content) 55%, transparent); cursor: pointer; border: none; background: none; width: 100%; transition: all 0.18s; position: relative; }
        .hm-nav-item:hover { background: var(--base-200); color: var(--base-content); }
        .hm-nav-item.active { background: color-mix(in oklch, var(--color-primary) 10%, transparent); color: var(--color-primary); }
        .hm-nav-item.active::before { content: ''; position: absolute; left: 0; top: 20%; bottom: 20%; width: 3px; border-radius: 0 2px 2px 0; background: var(--color-primary); }
        .hm-nav-count { margin-left: auto; font-size: 0.65rem; font-weight: 700; background: var(--base-300); padding: 1px 6px; border-radius: 9999px; color: var(--base-content); opacity: 0.7; }
        .hm-nav-section { padding: 0.75rem 1rem 0.25rem; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: color-mix(in oklch, var(--base-content) 30%, transparent); }
        .hm-sidebar-bottom { padding: 0.75rem; border-top: 1px solid var(--base-300); }

        /* ── Topbar ── */
        .hm-topbar-title { font-size: 0.82rem; font-weight: 700; color: var(--base-content); flex: 1; }
        .hm-search-wrap { position: relative; }
        .hm-search-wrap svg { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: color-mix(in oklch, var(--base-content) 35%, transparent); pointer-events: none; }
        .hm-search { background: var(--base-200); border: 1px solid var(--base-300); border-radius: 8px; padding: 0.375rem 0.75rem 0.375rem 2.125rem; font-size: 0.78rem; color: var(--base-content); outline: none; width: 220px; transition: border-color 0.2s, box-shadow 0.2s; }
        .hm-search:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 15%, transparent); }
        .hm-search::placeholder { color: color-mix(in oklch, var(--base-content) 35%, transparent); }
        .hm-count-badge { font-size: 0.65rem; font-weight: 700; color: color-mix(in oklch, var(--base-content) 40%, transparent); }

        /* ── Form Primitives ── */
        .hm-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: color-mix(in oklch, var(--base-content) 55%, transparent); }
        .hm-note { font-size: 0.67rem; color: color-mix(in oklch, var(--base-content) 38%, transparent); line-height: 1.4; }
        .hm-input { background: var(--base-200); border: 1px solid var(--base-300); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.78rem; color: var(--base-content); outline: none; width: 100%; font-family: inherit; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; }
        .hm-input:hover { border-color: color-mix(in oklch, var(--color-primary) 50%, var(--base-300)); }
        .hm-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 12%, transparent); background: var(--base-100); }
        .hm-input::placeholder { color: color-mix(in oklch, var(--base-content) 30%, transparent); }

        /* ── Buttons ── */
        .hm-btn-primary { background: var(--color-primary); color: var(--color-primary-content); }
        .hm-btn-primary:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 4px 12px color-mix(in oklch, var(--color-primary) 40%, transparent); }
        .hm-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .hm-btn-secondary { background: transparent; color: var(--color-primary); border: 1.5px solid var(--color-primary); }
        .hm-btn-secondary:hover:not(:disabled) { background: color-mix(in oklch, var(--color-primary) 10%, transparent); }
        .hm-btn-success { background: var(--color-success); color: var(--color-success-content); }
        .hm-btn-success:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        .hm-btn-danger { background: color-mix(in oklch, var(--color-error) 15%, transparent); color: var(--color-error); border: 1px solid color-mix(in oklch, var(--color-error) 30%, transparent); }
        .hm-btn-danger:hover:not(:disabled) { background: var(--color-error); color: var(--color-error-content); }
        .hm-btn-ghost { background: var(--base-200); color: var(--base-content); border: 1px solid var(--base-300); }
        .hm-btn-ghost:hover:not(:disabled) { background: var(--base-300); }
        .hm-btn-warning { background: color-mix(in oklch, var(--color-warning) 15%, transparent); color: var(--color-warning); border: 1px solid color-mix(in oklch, var(--color-warning) 30%, transparent); }
        .hm-btn-warning:hover:not(:disabled) { background: var(--color-warning); color: var(--color-warning-content); }
        .hm-btn-subtle { background: var(--base-200); color: color-mix(in oklch, var(--base-content) 70%, transparent); border: 1px solid var(--base-300); }
        .hm-btn-subtle:hover:not(:disabled) { background: color-mix(in oklch, var(--color-primary) 8%, var(--base-200)); color: var(--color-primary); border-color: color-mix(in oklch, var(--color-primary) 35%, transparent); }

        /* ── Badges ── */
        .hm-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid; }
        .hm-badge-success { background: color-mix(in oklch, var(--color-success) 12%, transparent); color: var(--color-success); border-color: color-mix(in oklch, var(--color-success) 30%, transparent); }
        .hm-badge-warning { background: color-mix(in oklch, var(--color-warning) 12%, transparent); color: var(--color-warning); border-color: color-mix(in oklch, var(--color-warning) 30%, transparent); }
        .hm-badge-error   { background: color-mix(in oklch, var(--color-error) 12%, transparent); color: var(--color-error); border-color: color-mix(in oklch, var(--color-error) 30%, transparent); }
        .hm-badge-info    { background: color-mix(in oklch, var(--color-info) 12%, transparent); color: var(--color-info); border-color: color-mix(in oklch, var(--color-info) 30%, transparent); }
        .hm-badge-primary { background: color-mix(in oklch, var(--color-primary) 12%, transparent); color: var(--color-primary); border-color: color-mix(in oklch, var(--color-primary) 30%, transparent); }

        /* ── Cards & Sections ── */
        .hm-section-card { background: var(--base-100); border: 1px solid var(--base-300); border-radius: 12px; overflow: hidden; }
        .hm-section-title { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: color-mix(in oklch, var(--base-content) 60%, transparent); }
        .hm-stat-card { background: var(--base-100); border: 1px solid var(--base-300); border-radius: 14px; padding: 1.25rem; transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s; }
        .hm-stat-card:hover { border-color: color-mix(in oklch, var(--color-primary) 40%, transparent); box-shadow: 0 4px 20px color-mix(in oklch, var(--color-primary) 8%, transparent); transform: translateY(-2px); }
        .hm-stat-value { font-size: 1.75rem; font-weight: 900; color: var(--base-content); line-height: 1; letter-spacing: -0.03em; font-family: var(--font-family-montserrat, ui-sans-serif); }
        .hm-stat-label { font-size: 0.68rem; font-weight: 600; color: color-mix(in oklch, var(--base-content) 45%, transparent); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
        .hm-chart-card { background: var(--base-100); border: 1px solid var(--base-300); border-radius: 14px; padding: 1.125rem 1.25rem 1.25rem; }
        .hm-chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .hm-chart-title { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: color-mix(in oklch, var(--base-content) 55%, transparent); }
        .hm-quick-stat { background: var(--base-200); border-radius: 10px; padding: 1rem; text-align: center; }

        /* ── Table ── */
        .hm-table-wrap { background: var(--base-100); border: 1px solid var(--base-300); border-radius: 14px; overflow: hidden; }
        .hm-table-row { transition: background 0.15s; cursor: pointer; }
        .hm-table-row:hover { background: color-mix(in oklch, var(--base-content) 3%, transparent); }
        .hm-table-row-active { background: color-mix(in oklch, var(--color-primary) 4%, transparent) !important; }
        .hm-action-bar { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 0 4px; background: color-mix(in oklch, var(--base-content) 2%, transparent); border-radius: 10px; padding: 10px; }
        .hm-pagination { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-top: 1px solid var(--base-300); background: var(--base-200); }

        /* ── Modal ── */
        .hm-modal-surface { background: var(--base-100); border: 1px solid var(--base-300); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.2); }
        .hm-modal-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1.25rem; background: var(--base-200); border-bottom: 1px solid var(--base-300); }

        /* ── Misc ── */
        .hm-flags-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
        .hm-flag-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--base-300); background: var(--base-200); }
        .hm-upload-zone { border: 1.5px dashed var(--base-300); border-radius: 12px; padding: 1.5rem; text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
        .hm-upload-zone:hover { border-color: var(--color-primary); background: color-mix(in oklch, var(--color-primary) 4%, transparent); }
        .hm-avail-day { border: 1px solid var(--base-300); border-radius: 10px; overflow: hidden; }
        .hm-scrollarea { border: 1px solid var(--base-300); border-radius: 10px; padding: 4px; }
        .hm-error-banner { padding: 0.75rem 1rem; background: color-mix(in oklch, var(--color-error) 10%, transparent); border: 1px solid color-mix(in oklch, var(--color-error) 25%, transparent); border-radius: 10px; color: var(--color-error); font-size: 0.78rem; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
        .hm-empty { padding: 3rem; text-align: center; font-size: 0.8rem; color: color-mix(in oklch, var(--base-content) 35%, transparent); }

        @keyframes hm-spin { to { transform: rotate(360deg); } }
        .hm-spinner { display: inline-block; width: 28px; height: 28px; border-radius: 50%; border: 3px solid color-mix(in oklch, var(--color-primary) 25%, transparent); border-top-color: var(--color-primary); animation: hm-spin 0.7s linear infinite; }
      `}</style>

      <div className="hm-root">
        {/* ── Sidebar ── */}
        <aside className="hm-sidebar">
          <div className="hm-logo">
            <div className="hm-logo-icon">
              <Hospital size={16} color="white" />
            </div>
            <div>
              <div className="hm-logo-text">MedAdmin</div>
              <div className="hm-logo-sub">Superadmin</div>
            </div>
          </div>

          <nav className="hm-nav">
            <div className="hm-nav-section">Manage</div>
            {NAV_ITEMS.map(({ id, label, icon: Icon, badge }) => (
              <button key={id} className={`hm-nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
                <Icon size={15} />
                {label}
                {badge && tabCounts[badge] > 0 && <span className="hm-nav-count">{tabCounts[badge]}</span>}
              </button>
            ))}
          </nav>

          <div className="hm-sidebar-bottom">
            <button
              className="hm-nav-item w-full"
              onClick={() => { dispatch(fetchAllHospitals({ page, limit: 20 })); dispatch(fetchAllDoctors({ page: 1, limit: 50 })); }}>
              <RefreshCw size={14} />
              Refresh Data
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="hm-content">
          {/* Topbar */}
          <header className="hm-topbar">
            <div className="flex items-center gap-2 flex-1">
              <span className="hm-topbar-title">
                {tab === "overview" && "Analytics Overview"}
                {tab === "hospitals" && "Hospital Management"}
                {tab === "doctors" && "Doctor Management"}
              </span>
            </div>

            {tab !== "overview" && (
              <div className="hm-search-wrap">
                <Search size={13} />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={tab === "hospitals" ? "Search hospitals…" : "Search doctors…"}
                  className="hm-search" />
              </div>
            )}

            {tab !== "overview" && (
              <span className="hm-count-badge">
                {tab === "hospitals" ? `${filteredHospitals.length} / ${hospitalTotal}` : `${filteredDoctors.length} / ${doctorTotal}`}
              </span>
            )}

            {tab === "hospitals" && (
              <Btn variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => openModal("createHospital")}>New Hospital</Btn>
            )}
            {tab === "doctors" && (
              <Btn variant="success" size="sm" icon={<Plus size={13} />} onClick={() => openModal("createDoctor")}>New Doctor</Btn>
            )}
          </header>

          {/* Main */}
          <main className="hm-main">
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="hm-error-banner">
                  <AlertTriangle size={15} /> {error}
                  <button onClick={() => dispatch(clearError())} className="ml-auto opacity-60 hover:opacity-100"><X size={13} /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Overview Tab */}
            {tab === "overview" && <OverviewPanel hospitals={hospitals} doctors={doctors} />}

            {/* Hospitals Tab */}
            {tab === "hospitals" && (
              <motion.div variants={stagger} initial="hidden" animate="visible">
                <div className="hm-table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--base-300)", background: "var(--base-200)" }}>
                        {["Hospital", "Location", "Verified", "Status", "Rating", ""].map(h => (
                          <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "color-mix(in oklch, var(--base-content) 40%, transparent)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading.fetchAllHospitals ? (
                        <tr><td colSpan={6} className="hm-empty"><div className="hm-spinner" style={{ margin: "0 auto" }} /></td></tr>
                      ) : filteredHospitals.length === 0 ? (
                        <tr><td colSpan={6} className="hm-empty">No hospitals found.</td></tr>
                      ) : (
                        filteredHospitals.map(h => <HospitalRow key={h._id} hospital={h} onAction={handleHospitalAction} />)
                      )}
                    </tbody>
                  </table>
                  {hospitalTotal > 20 && (
                    <div className="hm-pagination">
                      <Btn size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Btn>
                      <span style={{ fontSize: "0.72rem", color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>Page {page}</span>
                      <Btn size="sm" variant="ghost" disabled={hospitals.length < 20} onClick={() => setPage(p => p + 1)}>Next →</Btn>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Doctors Tab */}
            {tab === "doctors" && (
              <motion.div variants={stagger} initial="hidden" animate="visible">
                <div className="hm-table-wrap">
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--base-300)", background: "var(--base-200)" }}>
                        {["Doctor", "Experience", "KYC", "Partnership", "Status", ""].map(h => (
                          <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "color-mix(in oklch, var(--base-content) 40%, transparent)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading.fetchAllDoctors ? (
                        <tr><td colSpan={6} className="hm-empty"><div className="hm-spinner" style={{ margin: "0 auto" }} /></td></tr>
                      ) : filteredDoctors.length === 0 ? (
                        <tr><td colSpan={6} className="hm-empty">No doctors found.</td></tr>
                      ) : (
                        filteredDoctors.map(d => <DoctorRow key={d._id} doctor={d} onAction={handleDoctorAction} />)
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </main>
        </div>
      </div>

      {/* ════ MODALS ════ */}
      <CreateHospitalModal open={!!modals.createHospital} onClose={() => closeModal("createHospital")} loading={loading.createHospital} onSubmit={body => dispatch(createHospital(body)).unwrap().then(() => closeModal("createHospital"))} />
      <UpdateHospitalProfileModal open={!!modals.editHospitalProfile} onClose={() => closeModal("editHospitalProfile")} hospital={active} loading={loading.updateHospitalProfile} onSubmit={body => dispatch(updateHospitalProfile(body)).unwrap().then(() => closeModal("editHospitalProfile"))} />
      <UpdateHospitalSettingsModal open={!!modals.editHospitalSettings} onClose={() => closeModal("editHospitalSettings")} hospital={active} loading={loading.updateHospitalSettings} onSubmit={body => dispatch(updateHospitalSettings(body)).unwrap().then(() => closeModal("editHospitalSettings"))} />
      <UpdateHospitalSecurityModal open={!!modals.editHospitalSecurity} onClose={() => closeModal("editHospitalSecurity")} hospital={active} loading={loading.updateHospitalSecurity} onSubmit={body => dispatch(updateHospitalSecurity(body)).unwrap().then(() => closeModal("editHospitalSecurity"))} />
      <UpdateHospitalPlatformFeeModal open={!!modals.editHospitalFee} onClose={() => closeModal("editHospitalFee")} hospital={active} loading={loading.updateHospitalPlatformFee} onSubmit={body => dispatch(updateHospitalPlatformFee(body)).unwrap().then(() => closeModal("editHospitalFee"))} />
      <UploadImagesModal open={!!modals.uploadHospitalImages} onClose={() => closeModal("uploadHospitalImages")} hospital={active} loading={loading.uploadHospitalImages} onSubmit={body => dispatch(uploadHospitalImages(body)).unwrap().then(() => closeModal("uploadHospitalImages"))} />
      <UpdateLocationModal open={!!modals.editHospitalLocation} onClose={() => closeModal("editHospitalLocation")} hospital={active} loading={loading.updateHospitalLocation} onSubmit={body => dispatch(updateHospitalLocation(body)).unwrap().then(() => closeModal("editHospitalLocation"))} />
      <LinkDoctorModal open={!!modals.linkDoctors} onClose={() => closeModal("linkDoctors")} hospital={active} doctors={doctors} onLink={body => dispatch(linkDoctorToHospital(body))} onUnlink={body => dispatch(unlinkDoctorFromHospital(body))} loadingLink={loading.linkDoctorToHospital} loadingUnlink={loading.unlinkDoctorFromHospital} />
      <CreateDoctorModal open={!!modals.createDoctor} onClose={() => closeModal("createDoctor")} hospitals={hospitals} loading={loading.createDoctorProfile} onSubmit={body => dispatch(createDoctorProfile(body)).unwrap().then(() => closeModal("createDoctor"))} />
      <UpdateDoctorProfileModal open={!!modals.editDoctorProfile} onClose={() => closeModal("editDoctorProfile")} doctor={active} hospitals={hospitals} loading={loading.updateDoctorProfile} onSubmit={body => dispatch(updateDoctorProfile(body)).unwrap().then(() => closeModal("editDoctorProfile"))} />
      <UpdateDoctorSettingsModal open={!!modals.editDoctorSettings} onClose={() => closeModal("editDoctorSettings")} doctor={active} loading={loading.updateDoctorSettings} onSubmit={body => dispatch(updateDoctorSettings(body)).unwrap().then(() => closeModal("editDoctorSettings"))} />
      <UpdateDoctorAvailabilityModal open={!!modals.editDoctorAvailability} onClose={() => closeModal("editDoctorAvailability")} doctor={active} loading={loading.updateDoctorAvailability} onSubmit={body => dispatch(updateDoctorAvailability(body)).unwrap().then(() => closeModal("editDoctorAvailability"))} />
      <UpdateDoctorBankModal open={!!modals.editDoctorBank} onClose={() => closeModal("editDoctorBank")} doctor={active} loading={loading.updateDoctorBankDetails} onSubmit={body => dispatch(updateDoctorBankDetails(body)).unwrap().then(() => closeModal("editDoctorBank"))} />
      <UpdateDoctorKycModal open={!!modals.editDoctorKyc} onClose={() => closeModal("editDoctorKyc")} doctor={active} loading={loading.updateDoctorKyc} onSubmit={body => dispatch(updateDoctorKyc(body)).unwrap().then(() => closeModal("editDoctorKyc"))} />
      <VerifyDoctorKycModal open={!!modals.verifyDoctorKyc} onClose={() => closeModal("verifyDoctorKyc")} doctor={active} loading={loading.verifyDoctorKyc} onSubmit={body => dispatch(verifyDoctorKyc(body)).unwrap().then(() => closeModal("verifyDoctorKyc"))} />
      <UploadDoctorPhotoModal open={!!modals.uploadDoctorPhoto} onClose={() => closeModal("uploadDoctorPhoto")} doctor={active} loading={loading.uploadDoctorPhoto} onSubmit={body => dispatch(uploadDoctorPhoto(body)).unwrap().then(() => closeModal("uploadDoctorPhoto"))} />
      <UpdateDoctorSecurityModal open={!!modals.editDoctorSecurity} onClose={() => closeModal("editDoctorSecurity")} doctor={active} loading={loading.updateDoctorSecurity} onSubmit={body => dispatch(updateDoctorSecurity(body)).unwrap().then(() => closeModal("editDoctorSecurity"))} />
      <UpdateDoctorPlatformFeeModal open={!!modals.editDoctorFee} onClose={() => closeModal("editDoctorFee")} doctor={active} loading={loading.updateDoctorPlatformFee} onSubmit={body => dispatch(updateDoctorPlatformFee(body)).unwrap().then(() => closeModal("editDoctorFee"))} />
      <UpdateDoctorPartnershipModal open={!!modals.editDoctorPartnership} onClose={() => closeModal("editDoctorPartnership")} doctor={active} loading={loading.updateDoctorPartnership} onSubmit={body => dispatch(updateDoctorPartnership(body)).unwrap().then(() => closeModal("editDoctorPartnership"))} />
      <ConfirmDialog open={confirm.open} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={cancelConfirm} />
    </>
  );
}