"use client";

/**
 * AppointmentManagement.jsx — Likeson.in Doctor Portal
 *
 * Thunks used (from operationsSlice + hospitalSlice):
 *   fetchDoctorOps           GET /bookings/doctor/ops
 *   fetchDoctorOpByNumber    GET /bookings/doctor/ops/:opNumber
 *   completeOp               PATCH /bookings/:id/op/complete
 *   fetchOpByNumber          GET /bookings/op/:opNumber
 *   fetchOpFollowUps         GET /bookings/op/:opNumber/follow-ups
 *   downloadOpZip            GET /bookings/op/:opNumber/download
 *   fetchMyDoctorProfile     GET /hospitals/doctors/me
 *   fetchMyManagedHospitals  GET /hospitals/doctors/me/hospitals
 *   fetchMyEffectivePricing  GET /hospitals/doctors/me/pricing
 *   updateDoctorAvailability PUT /hospitals/doctors/:id/availability
 *   updateDoctorSettings     PUT /hospitals/doctors/:id/settings
 *
 * Models: DoctorProfile, OutPatientRecord, Booking, Hospital
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Calendar, Clock, User, FileText, Activity, CheckCircle2, XCircle,
  ChevronRight, Download, Eye, RefreshCw, Filter, Search,
  Stethoscope, Heart, TrendingUp, AlertCircle, Bell,
  Video, Home, Building2, ChevronDown, ChevronUp, Star,
  Phone, Mail, Edit3, Save, X, Plus, Trash2, ToggleLeft,
  ToggleRight, Zap, Users, ClipboardList, ArrowRight,
  Layers, BarChart2, PieChart as PieIcon, Loader2,
  CheckCheck, Pill, FileCheck, BookOpen, Shield, Info,
  MoreVertical, ExternalLink, Copy, Inbox, TimerReset,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

// ── Redux thunks ──────────────────────────────────────────────────────────────
import {
  fetchDoctorOps,
  fetchDoctorOpByNumber,
  completeOp,
  fetchOpByNumber,
  fetchOpFollowUps,
  downloadOpZip,
  resetOpCompleteAction,
  clearDoctorOpDetail,
  clearOpFollowUps,
  selectDoctorOps,
  selectDoctorOpsMeta,
  selectDoctorOpsLoading,
  selectDoctorOpDetail,
  selectDoctorOpFollowUps,
  selectDoctorOpDetailMeta,
  selectOpCompleteAction,
  selectOpCompleteLoading,
  selectOpRecord,
  selectOpRecordFollowUps,
  selectOpRecordMeta,
  selectOpFollowUps,
  selectOpFollowUpsMeta,
  selectOpDownload,
  selectOpDownloadLoading,
} from "@/store/slices/operationsSlice";

import {
  fetchMyDoctorProfile,
  fetchMyManagedHospitals,
  fetchMyEffectivePricing,
  updateDoctorAvailability,
  updateDoctorSettings,
  selectMyDoctorProfile,
  selectMyManagedHospitals,
  selectMyEffectivePricing,
  selectHospitalLoading,
} from "@/store/slices/hospitalSlice";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CONSULTATION_ICONS = { inPerson: Building2, video: Video, homeVisit: Home };
const CONSULTATION_LABELS = { inPerson: "In-Person", video: "Video", homeVisit: "Home Visit" };
const OP_STATUS_CONFIG = {
  scheduled:   { label: "Scheduled",   color: "var(--info)",    bg: "var(--color-info-bg)",    icon: Clock },
  in_progress: { label: "In Progress", color: "var(--warning)", bg: "var(--color-warn-bg)",    icon: Activity },
  completed:   { label: "Completed",   color: "var(--success)", bg: "var(--color-succ-bg)",    icon: CheckCircle2 },
  cancelled:   { label: "Cancelled",   color: "var(--error)",   bg: "var(--color-err-bg)",     icon: XCircle },
  no_show:     { label: "No Show",     color: "#9ca3af",        bg: "rgba(156,163,175,0.12)",  icon: AlertCircle },
};

const CHART_COLORS = [
  "var(--primary)", "var(--secondary)", "var(--success)",
  "var(--warning)", "var(--accent)", "var(--info)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (date) =>
  date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtTime = (date) =>
  date ? new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const fmtCurrency = (n) =>
  n != null ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

const daysUntil = (date) => {
  if (!date) return null;
  const diff = new Date(date) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ── Sub-components ────────────────────────────────────────────────────────────

const Spinner = ({ size = 20 }) => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
 
    className="rounded-full border-2 border-transparent"
    style={{ width: size, height: size, borderTop: "2px solid var(--primary)", borderRight: "2px solid var(--primary)", borderRadius: "50%" }}
  />
);

const StatPill = ({ value, label, icon: Icon, color, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="stat-card   flex flex-col gap-1 relative overflow-hidden"
    style={{ border: `1px solid ${color}`, background: `color-mix(in srgb,${color},transparent 82%)` }}
  >
    <div className="flex items-center justify-between">
      <span className="stat-card-label">{label}</span>
      <span className="p-1.5 rounded-lg" style={{ background: `color-mix(in srgb,${color},transparent 82%)` }}>
        <Icon size={14} style={{ color }} />
      </span>
    </div>
    <div className="stat-card-value" style={{ color }}>{value}</div>
    {trend != null && (
      <div className="flex items-center gap-1 text-xs" style={{ color: trend >= 0 ? "var(--success)" : "var(--error)" }}>
        <TrendingUp size={10} style={{ transform: trend < 0 ? "scaleY(-1)" : "none" }} />
        {Math.abs(trend)}% vs last month
      </div>
    )}
  </motion.div>
);

const StatusBadge = ({ status }) => {
  const cfg = OP_STATUS_CONFIG[status] || OP_STATUS_CONFIG.scheduled;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-wide"
      style={{ background: `color-mix(in srgb,${cfg.color},transparent 85%)`, color: cfg.color, border: `1px solid color-mix(in srgb,${cfg.color},transparent 60%)` }}
    >
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

const TabButton = ({ active, onClick, children, icon: Icon, count }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97 }}
    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all relative"
    style={{
      background: active ? "var(--primary)" : "transparent",
      color: active ? "var(--primary-content)" : "color-mix(in oklch,var(--base-content) 60%,transparent)",
      boxShadow: active ? "0 4px 14px color-mix(in srgb,var(--primary),transparent 60%)" : "none",
    }}
  >
    {Icon && <Icon size={15} />}
    {children}
    {count != null && count > 0 && (
      <span
        className="px-1.5 py-0.5 rounded-full text-xs font-black"
        style={{
          background: active ? "rgba(255,255,255,0.25)" : "var(--primary)",
          color: active ? "white" : "var(--primary-content)",
          minWidth: "1.25rem",
          textAlign: "center",
        }}
      >
        {count}
      </span>
    )}
  </motion.button>
);

// ── SlotEditor Component ──────────────────────────────────────────────────────

const SlotEditor = ({ day, dayEntry, onChange }) => {
  const addSlot = () => {
    const newSlot = { startTime: "09:00", endTime: "17:00", maxPatients: 10, consultationType: "any", isActive: true };
    onChange(day, { ...dayEntry, slots: [...(dayEntry.slots || []), newSlot] });
  };

  const removeSlot = (idx) => {
    const slots = dayEntry.slots.filter((_, i) => i !== idx);
    onChange(day, { ...dayEntry, slots });
  };

  const updateSlot = (idx, field, value) => {
    const slots = dayEntry.slots.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    onChange(day, { ...dayEntry, slots });
  };

  return (
    <div className="space-y-2">
      {(dayEntry.slots || []).map((slot, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg"
        
        >
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Clock size={12} style={{ color: "var(--primary)" }} className="flex-shrink-0" />
            <input
              type="time"
              value={slot.startTime}
              onChange={(e) => updateSlot(idx, "startTime", e.target.value)}
              className="input-field text-xs py-1 px-2 flex-1 min-w-0"
              style={{ minWidth: 90 }}
            />
            <span className="text-xs" style={{ color: "var(--base-content)" }}>→</span>
            <input
              type="time"
              value={slot.endTime}
              onChange={(e) => updateSlot(idx, "endTime", e.target.value)}
              className="input-field text-xs py-1 px-2 flex-1 min-w-0"
              style={{ minWidth: 90 }}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={slot.consultationType}
              onChange={(e) => updateSlot(idx, "consultationType", e.target.value)}
              className="input-field text-xs py-1 px-2"
              style={{ minWidth: 100 }}
            >
              <option value="any">Any</option>
              <option value="inPerson">In-Person</option>
              <option value="video">Video</option>
              <option value="homeVisit">Home Visit</option>
            </select>
            <input
              type="number"
              value={slot.maxPatients}
              min={1}
              onChange={(e) => updateSlot(idx, "maxPatients", Number(e.target.value))}
              className="input-field text-xs py-1 px-2 w-16"
              title="Max patients"
            />
    <button
  onClick={() => updateSlot(idx, "isActive", !slot.isActive)}
  // Use Tailwind for the container to keep it clean
  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none  focus:ring-primary`}
  style={{ 
    backgroundColor: slot.isActive ? "var(--success)" : "var(--base-300)" 
  }}
  title={slot.isActive ? "Active" : "Inactive"}
  role="switch"
  aria-checked={slot.isActive}
>
  <span className="sr-only">Toggle Slot</span>
  <motion.span
    // Use animate instead of manual marginLeft for smoother transitions
    animate={{ x: slot.isActive ? 24 : 4 }}
    transition={{ type: "spring", stiffness: 500, damping: 30 }}
    className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0"
  />
</button>
            <button onClick={() => removeSlot(idx)} className="p-1" style={{ color: "var(--error)" }}>
              <Trash2 size={14} />
            </button>
          </div>
        </motion.div>
      ))}
      <button
        onClick={addSlot}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
        style={{ color: "var(--primary)", background: "color-mix(in srgb,var(--primary),transparent 90%)" }}
      >
        <Plus size={12} /> Add Slot
      </button>
    </div>
  );
};

// ── OPCard Detail Panel ───────────────────────────────────────────────────────

const OPDetailPanel = ({ opNumber, onClose }) => {
  const dispatch = useDispatch();
  const op = useSelector(selectDoctorOpDetail);
  const followUps = useSelector(selectDoctorOpFollowUps);
  const meta = useSelector(selectDoctorOpDetailMeta);
  const completeAction = useSelector(selectOpCompleteAction);
  const completeLoading = useSelector(selectOpCompleteLoading);
  const opDownloadLoading = useSelector(selectOpDownloadLoading);

  const [form, setForm] = useState({ doctorNotes: "", prescriptionUrl: "", diagnosisCode: "", reasonForVisit: "" });
  const [showCompleteForm, setShowCompleteForm] = useState(false);

  useEffect(() => {
    if (opNumber) dispatch(fetchDoctorOpByNumber(opNumber));
    return () => dispatch(clearDoctorOpDetail());
  }, [opNumber, dispatch]);

  useEffect(() => {
    if (op) {
      dispatch(fetchOpFollowUps(opNumber));
      setForm({
        doctorNotes:     op.doctorNotes     || "",
        prescriptionUrl: op.prescriptionUrl || "",
        diagnosisCode:   op.diagnosisCode   || "",
        reasonForVisit:  op.reasonForVisit  || "",
      });
    }
  }, [op, dispatch, opNumber]);

  const handleComplete = () => {
    if (!op) return;
    dispatch(completeOp({ bookingId: op.booking?._id || op.booking, ...form }));
  };

  const handleDownload = () => {
    if (opNumber) dispatch(downloadOpZip(opNumber));
  };

  if (meta.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Spinner size={36} />
        <span className="text-xs font-medium" style={{ color: "var(--base-content)" }}>Loading OP record…</span>
      </div>
    );
  }

  if (!op) return null;

  const daysLeft = daysUntil(op.followUpExpiry);
  const patient = op.patient || {};

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="flex flex-col h-full overflow-y-auto"
      style={{ gap: "1.25rem" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between sticky top-0 z-10 pb-4"
        style={{ background: "var(--base-100)", borderBottom: "1px solid var(--base-300)" }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className=" text-xs font-montserrat" style={{ color: "var(--base-content)" }}>
              {op.opNumber}
            </span>
            <StatusBadge status={op.status} />
            {op.isFollowUp && (
              <span className="badge badge-warning badge-sm">Follow-Up</span>
            )}
          </div>
          <p className="text-[10px]" style={{ color: "color-mix(in oklch,var(--base-content) 55%,transparent)" }}>
            {fmt(op.scheduledAt)} · {CONSULTATION_LABELS[op.consultationType] || "Consultation"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDownload}
            disabled={opDownloadLoading}
            className="btn btn-sm btn-outline flex items-center gap-1.5"
          >
            {opDownloadLoading ? <Spinner size={14} /> : <Download size={14} />}
            ZIP
          </motion.button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-base-200 transition-colors">
            <X size={16} style={{ color: "var(--base-content)" }} />
          </button>
        </div>
      </div>

      {/* Patient Info */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs"
            style={{ background: "color-mix(in srgb,var(--primary),transparent 82%)", color: "var(--primary)" }}>
            {(patient.name || "?")[0].toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-xs" style={{ color: "var(--base-content)" }}>{patient.name || "—"}</div>
            <div className="text-xs flex text-[10px] items-center gap-2" style={{ color: "color-mix(in oklch,var(--base-content) 55%,transparent)" }}>
              {patient.phone && <><Phone size={10} /> {patient.phone}</>}
              {patient.email && <><Mail size={10} /> {patient.email}</>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Booking Code", op.booking?.bookingCode],
            ["Type", op.booking?.bookingType?.replace(/_/g, " ")],
            ["Consultation", CONSULTATION_LABELS[op.consultationType]],
            ["Hospital", op.hospital?.name],
          ].map(([label, val]) => val && (
            <div key={label}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-0.5"
                style={{ color: "color-mix(in oklch,var(--base-content) 40%,transparent)" }}>{label}</div>
              <div className="text-xs font-medium" style={{ color: "var(--base-content)" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Follow-up Eligibility */}
      {op.followUpExpiry && (
        <div className="  p-3 flex items-center gap-3"
          style={{ borderLeft: `3px solid ${daysLeft > 0 ? "var(--success)" : "var(--error)"}` }}>
          <TimerReset size={16} style={{ color: daysLeft > 0 ? "var(--success)" : "var(--error)" }} />
          <div>
            <div className="text-xs font-bold" style={{ color: daysLeft > 0 ? "var(--success)" : "var(--error)" }}>
              {daysLeft > 0 ? `Follow-up valid — ${daysLeft}d left` : "Follow-up window expired"}
            </div>
            <div className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>
              Expires: {fmt(op.followUpExpiry)} · Fee: {fmtCurrency(op.followUpFee)}
            </div>
          </div>
        </div>
      )}

      {/* Clinical Notes */}
      {(op.doctorNotes || op.diagnosisCode || op.reasonForVisit) && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <FileCheck size={15} style={{ color: "var(--primary)" }} />
            <span className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Clinical Notes</span>
          </div>
          {op.reasonForVisit && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-0.5"
                style={{ color: "color-mix(in oklch,var(--base-content) 40%,transparent)" }}>Reason for Visit</div>
              <div className="text-xs" style={{ color: "var(--base-content)" }}>{op.reasonForVisit}</div>
            </div>
          )}
          {op.diagnosisCode && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-0.5"
                style={{ color: "color-mix(in oklch,var(--base-content) 40%,transparent)" }}>Diagnosis Code</div>
              <div className="text-xs font-mono" style={{ color: "var(--base-content)" }}>{op.diagnosisCode}</div>
            </div>
          )}
          {op.doctorNotes && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-0.5"
                style={{ color: "color-mix(in oklch,var(--base-content) 40%,transparent)" }}>Notes</div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--base-content)" }}>{op.doctorNotes}</div>
            </div>
          )}
          {op.prescriptionUrl && (
            <a href={op.prescriptionUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--primary)" }}>
              <Pill size={12} /> View Prescription <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      {/* Follow-up Chain */}
      {followUps.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={15} style={{ color: "var(--accent)" }} />
            <span className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Follow-up Chain ({followUps.length})</span>
          </div>
          <div className="space-y-2">
            {followUps.map((fu) => (
              <div key={fu._id} className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ background: "var(--base-200)" }}>
                <div>
                  <div className="text-xs font-bold" style={{ color: "var(--base-content)" }}>{fu.opNumber}</div>
                  <div className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>{fmt(fu.scheduledAt)}</div>
                </div>
                <StatusBadge status={fu.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Complete OP Form */}
      {op.status !== "completed" && op.status !== "cancelled" && (
        <div className="card p-4">
          <button
            onClick={() => setShowCompleteForm(!showCompleteForm)}
            className="flex items-center gap-2 w-full text-left"
          >
            <CheckCheck size={15} style={{ color: "var(--success)" }} />
            <span className="font-bold text-xs flex-1" style={{ color: "var(--base-content)" }}>Mark as Completed</span>
            {showCompleteForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <AnimatePresence>
            {showCompleteForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-3">
                  {[
                    ["reasonForVisit", "Reason for Visit", "text", "Chief complaint"],
                    ["diagnosisCode", "Diagnosis Code (ICD-10)", "text", "e.g. J06.9"],
                    ["prescriptionUrl", "Prescription URL", "url", "https://..."],
                  ].map(([key, label, type, placeholder]) => (
                    <div key={key}>
                      <label className="label-text mb-1 block">{label}</label>
                      <input
                        type={type}
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="input-field w-full text-xs"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="label-text mb-1 block">Clinical Notes</label>
                    <textarea
                      value={form.doctorNotes}
                      onChange={(e) => setForm((f) => ({ ...f, doctorNotes: e.target.value }))}
                      rows={3}
                      placeholder="Detailed clinical observations, treatment plan..."
                      className="input-field w-full text-xs resize-none"
                    />
                  </div>
                  {completeAction.error && (
                    <div className="alert alert-error text-xs">{completeAction.error}</div>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleComplete}
                    disabled={completeLoading}
                    className="btn btn-success w-full flex items-center justify-center gap-2"
                  >
                    {completeLoading ? <Spinner size={16} /> : <CheckCircle2 size={16} />}
                    Complete Consultation
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {op.status === "completed" && (
        <div className="card p-3 flex items-center gap-2"
          style={{ borderLeft: "3px solid var(--success)", background: "color-mix(in srgb,var(--success),transparent 92%)" }}>
          <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--success)" }}>
            Consultation completed on {fmt(op.completedAt)}
          </span>
        </div>
      )}
    </motion.div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function AppointmentManagement() {
  const dispatch = useDispatch();

  // ── Selectors ─────────────────────────────────────────────
  const ops        = useSelector(selectDoctorOps);
  const opsMeta    = useSelector(selectDoctorOpsMeta);
  const opsLoading = useSelector(selectDoctorOpsLoading);
  const profile    = useSelector(selectMyDoctorProfile);
  const myHospitals    = useSelector(selectMyManagedHospitals);
  const effectivePricing = useSelector(selectMyEffectivePricing);
  const hospitalLoading  = useSelector(selectHospitalLoading);

  // ── Local state ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("appointments");
  const [selectedOp, setSelectedOp] = useState(null);
  const [filters, setFilters] = useState({ status: "", consultationType: "", date: "", page: 1, limit: 15 });
  const [showFilters, setShowFilters] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [availDraft, setAvailDraft] = useState({});
  const [availSaving, setAvailSaving] = useState(false);
  const [onlineDraft, setOnlineDraft] = useState(null);
  const [onlineSaving, setOnlineSaving] = useState(false);
  const searchTimeout = useRef(null);

  // ── Fetch on mount ─────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchMyDoctorProfile());
    dispatch(fetchMyManagedHospitals());
    dispatch(fetchMyEffectivePricing());
    dispatch(fetchDoctorOps({}));
  }, [dispatch]);

  // ── Sync availability draft from profile ──────────────────
  useEffect(() => {
    if (profile?.weeklyAvailability?.length) {
      const draft = {};
      profile.weeklyAvailability.forEach((d) => { draft[d.day] = d; });
      // Fill missing days
      DAYS.forEach((day) => {
        if (!draft[day]) draft[day] = { day, isAvailable: false, slots: [] };
      });
      setAvailDraft(draft);
    } else {
      const draft = {};
      DAYS.forEach((d) => { draft[d] = { day: d, isAvailable: false, slots: [] }; });
      setAvailDraft(draft);
    }
    if (profile) setOnlineDraft(profile.isOnline ?? false);
  }, [profile]);

  // ── Fetch ops on filter change ────────────────────────────
  useEffect(() => {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.date) params.date = filters.date;
    params.page = filters.page;
    params.limit = filters.limit;
    dispatch(fetchDoctorOps(params));
  }, [dispatch, filters.status, filters.date, filters.page]);

  // ── Stats derived from ops ────────────────────────────────
  const stats = useMemo(() => {
    const total = ops.length;
    const completed  = ops.filter((o) => o.status === "completed").length;
    const scheduled  = ops.filter((o) => o.status === "scheduled").length;
    const followUps  = ops.filter((o) => o.isFollowUp).length;
    const noShow     = ops.filter((o) => o.status === "no_show").length;
    return { total, completed, scheduled, followUps, noShow };
  }, [ops]);

  // ── Chart data ────────────────────────────────────────────
  const statusChartData = useMemo(() => {
    const counts = {};
    ops.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: OP_STATUS_CONFIG[name]?.label || name, value }));
  }, [ops]);

  const consultationChartData = useMemo(() => {
    const counts = { inPerson: 0, video: 0, homeVisit: 0 };
    ops.forEach((o) => { if (o.consultationType) counts[o.consultationType] = (counts[o.consultationType] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({ name: CONSULTATION_LABELS[key], value }));
  }, [ops]);

  const weeklyChartData = useMemo(() => {
    const buckets = {};
    ops.forEach((o) => {
      if (!o.scheduledAt) return;
      const day = new Date(o.scheduledAt).toLocaleDateString("en-IN", { weekday: "short" });
      buckets[day] = (buckets[day] || 0) + 1;
    });
    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return order.map((d) => ({ day: d, appointments: buckets[d] || 0 }));
  }, [ops]);

  // ── Filter ops client-side by search ─────────────────────
  const filteredOps = useMemo(() => {
    if (!searchQ.trim()) return ops;
    const q = searchQ.toLowerCase();
    return ops.filter((o) =>
      o.opNumber?.toLowerCase().includes(q) ||
      o.patient?.name?.toLowerCase().includes(q) ||
      o.booking?.bookingCode?.toLowerCase().includes(q)
    );
  }, [ops, searchQ]);

  // ── Handlers ──────────────────────────────────────────────
  const handleRefresh = () => dispatch(fetchDoctorOps({ page: filters.page, limit: filters.limit, status: filters.status }));

  const handleAvailDayToggle = (day) => {
    setAvailDraft((d) => ({ ...d, [day]: { ...d[day], isAvailable: !d[day].isAvailable } }));
  };

  const handleSlotChange = (day, dayEntry) => {
    setAvailDraft((d) => ({ ...d, [day]: dayEntry }));
  };

  const handleSaveAvailability = async () => {
    if (!profile?._id) return;
    setAvailSaving(true);
    const weeklyAvailability = DAYS.map((d) => availDraft[d]).filter(Boolean);
    await dispatch(updateDoctorAvailability({ id: profile._id, availability: weeklyAvailability }));
    setAvailSaving(false);
  };

  const handleToggleOnline = async () => {
    if (!profile?._id) return;
    setOnlineSaving(true);
    const newVal = !onlineDraft;
    setOnlineDraft(newVal);
    await dispatch(updateDoctorSettings({ id: profile._id, isOnline: newVal }));
    setOnlineSaving(false);
  };

  const handlePageChange = (p) => setFilters((f) => ({ ...f, page: p }));

  // ── Pricing display ───────────────────────────────────────
  const pricing = effectivePricing?.fees || {};
  const pricingSource = effectivePricing?.source;

  // ── Tab counts ────────────────────────────────────────────
  const pendingCount = ops.filter((o) => o.status === "scheduled").length;

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen relative"
      style={{ background: "var(--base-100)", fontFamily: "var(--font-family-poppins)" }}
    >
      {/* Ambient background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle,var(--primary),transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-8"
          style={{ background: "radial-gradient(circle,var(--secondary),transparent 70%)" }}
        />
      </div>

      <div className="relative" style={{ zIndex: 1 }}>

        {/* ── Top Header ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-30"
          style={{
            background: "color-mix(in srgb,var(--base-100) 92%,transparent)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid var(--base-300)",
          }}
        >
          <div className="container-custom py-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

              {/* Identity */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--bg-gradient-primary)" }}
                >
                  <Stethoscope size={20} style={{ color: "var(--primary-content)" }} />
                </div>
                <div>
                  <h1 className="font-black text-base leading-tight" style={{ fontFamily: "var(--font-family-montserrat)", color: "var(--base-content)" }}>
                    {profile?.user?.name || "Doctor Portal"}
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>
                      {profile?.specialization} · {profile?.registrationNumber || "Reg pending"}
                    </span>
                    {pricingSource && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-bold uppercase"
                        style={{
                          background: pricingSource === "hospital"
                            ? "color-mix(in srgb,var(--info),transparent 85%)"
                            : "color-mix(in srgb,var(--success),transparent 85%)",
                          color: pricingSource === "hospital" ? "var(--info)" : "var(--success)",
                        }}
                      >
                        {pricingSource === "hospital" ? "Hospital Pricing" : "Own Pricing"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Online toggle + refresh */}
             <div className="flex items-center gap-3">
  <button
    onClick={handleToggleOnline}
    disabled={onlineSaving}
    className="group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all relative overflow-hidden"
    style={{
      background: onlineDraft
        ? "color-mix(in srgb, var(--success), transparent 92%)"
        : "var(--base-200)",
      border: `1px solid ${
        onlineDraft 
          ? "color-mix(in srgb, var(--success), transparent 70%)" 
          : "var(--base-300)"
      }`,
      color: onlineDraft 
        ? "var(--success)" 
        : "color-mix(in oklch, var(--base-content) 55%, transparent)",
    }}
  >
    {/* The Pill Shape Switch */}
    <div 
      className="relative flex items-center h-5 w-9 rounded-full transition-colors duration-300"
      style={{ 
        background: onlineDraft ? "var(--success)" : "var(--base-300)" 
      }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 700, damping: 35 }}
        className="h-3.5 w-3.5 bg-white rounded-full shadow-sm"
        style={{ 
          marginLeft: onlineDraft ? "1.1rem" : "0.25rem" 
        }}
      />
    </div>

    <span className="min-w-[45px] text-left">
      {onlineSaving ? "Saving..." : onlineDraft ? "Online" : "Offline"}
    </span>

    {/* Optional: Subtle Loading Overlay */}
    {onlineSaving && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
        <Spinner size={14} />
      </div>
    )}
  </button>

  <motion.button
    whileHover={{ rotate: 180 }}
    whileTap={{ scale: 0.9 }}
    transition={{ duration: 0.4 }}
    onClick={handleRefresh}
    className="p-2 rounded-xl transition-colors border border-transparent hover:border-[var(--base-300)]"
    style={{ background: "var(--base-200)", color: "var(--base-content)" }}
  >
    <RefreshCw size={16} />
  </motion.button>
</div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mt-3 flex-wrap">
              {[
                { id: "appointments", label: "Appointments", icon: ClipboardList, count: pendingCount },
                { id: "analytics",   label: "Analytics",    icon: BarChart2 },
                { id: "availability",label: "Availability",  icon: Calendar },
                { id: "pricing",     label: "Pricing",       icon: Zap },
              ].map(({ id, label, icon, count }) => (
                <TabButton key={id} active={activeTab === id} onClick={() => setActiveTab(id)} icon={icon} count={count}>
                  {label}
                </TabButton>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Main Content ────────────────────────────────── */}
        <div className="  py-6">
          <AnimatePresence mode="wait">

            {/* ════════════════════════════════════════════
                TAB: APPOINTMENTS
            ════════════════════════════════════════════ */}
            {activeTab === "appointments" && (
              <motion.div
                key="appointments"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-2"
              >
                {/* Left: List */}
                <div className="lg:col-span-2 space-y-4">

                  {/* Quick Stats Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatPill value={stats.total}     label="Total OPs"   icon={ClipboardList}  color="var(--primary)" />
                    <StatPill value={stats.scheduled} label="Scheduled"   icon={Clock}          color="var(--info)" />
                    <StatPill value={stats.completed} label="Completed"   icon={CheckCircle2}   color="var(--success)" />
                    <StatPill value={stats.followUps} label="Follow-ups"  icon={Layers}         color="var(--accent)" />
                  </div>

                  {/* Search + Filters */}
                  <div className="card p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex-1 min-w-0 flex items-center gap-2 input-field" style={{ padding: "0.5rem 0.75rem" }}>
                        <Search size={14} style={{ color: "color-mix(in oklch,var(--base-content) 40%,transparent)" }} />
                        <input
                          value={searchQ}
                          onChange={(e) => setSearchQ(e.target.value)}
                          placeholder="Search OP, patient, booking code…"
                          className="bg-transparent outline-none text-xs flex-1 min-w-0"
                          style={{ color: "var(--base-content)" }}
                        />
                        {searchQ && (
                          <button onClick={() => setSearchQ("")}>
                            <X size={12} style={{ color: "var(--base-content)" }} />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-1.5 btn btn-sm btn-outline"
                      >
                        <Filter size={13} /> Filters
                        {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    <AnimatePresence>
                      {showFilters && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-wrap gap-3 pt-3 mt-3" style={{ borderTop: "1px solid var(--base-300)" }}>
                            <div>
                              <label className="label-text mb-1 block">Status</label>
                              <select
                                value={filters.status}
                                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
                                className="input-field text-xs"
                              >
                                <option value="">All Status</option>
                                {Object.entries(OP_STATUS_CONFIG).map(([val, cfg]) => (
                                  <option key={val} value={val}>{cfg.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label-text mb-1 block">Date</label>
                              <input
                                type="date"
                                value={filters.date}
                                onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value, page: 1 }))}
                                className="input-field text-xs"
                              />
                            </div>
                            <div className="flex items-end justify-center mb-1">
                              <button
                                onClick={() => setFilters({ status: "", date: "", page: 1, limit: 15 })}
                                className="btn btn-sm btn-ghost h-10 flex items-center gap-1.5"
                              >
                                <X size={12} /> Clear
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* OP List */}
                  <div className="space-y-2">
                    {opsLoading && (
                      <div className="flex items-center justify-center py-12 gap-3">
                        <Spinner size={28} />
                        <span className="text-xs" style={{ color: "var(--base-content)" }}>Loading appointments…</span>
                      </div>
                    )}

                    {!opsLoading && filteredOps.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="card p-12 flex flex-col items-center gap-3 text-center"
                      >
                        <Inbox size={40} style={{ color: "color-mix(in oklch,var(--base-content) 25%,transparent)" }} />
                        <div className="font-bold" style={{ color: "var(--base-content)" }}>No appointments found</div>
                        <div className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>
                          {searchQ || filters.status ? "Try adjusting your filters" : "Your appointment list is empty"}
                        </div>
                      </motion.div>
                    )}

                    <AnimatePresence>
                      {filteredOps.map((op, idx) => {
                        const isSelected = selectedOp?.opNumber === op.opNumber;
                        const patient = op.patient || {};
                        const ConsIcon = CONSULTATION_ICONS[op.consultationType] || Building2;
                        return (
                          <motion.div
                            key={op._id || op.opNumber}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ delay: idx * 0.025 }}
                            onClick={() => setSelectedOp(isSelected ? null : op)}
                            className="card p-4 cursor-pointer group relative overflow-hidden"
                            style={{
                              borderLeft: isSelected ? "3px solid var(--primary)" : "3px solid transparent",
                              background: isSelected
                                ? "color-mix(in srgb,var(--primary),transparent 94%)"
                                : "var(--base-100)",
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div
                                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-xs"
                                  style={{ background: "color-mix(in srgb,var(--primary),transparent 85%)", color: "var(--primary)" }}
                                >
                                  {(patient.name || "?")?.[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                    <span className="font-bold text-xs truncate" style={{ color: "var(--base-content)" }}>
                                      {patient.name || "Unknown Patient"}
                                    </span>
                                    <StatusBadge status={op.status} />
                                    {op.isFollowUp && <span className="badge badge-warning badge-xs">Follow-up</span>}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>
                                    <span className="flex items-center gap-1">
                                      <BookOpen size={10} /> {op.opNumber}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Calendar size={10} /> {fmt(op.scheduledAt)} {fmtTime(op.scheduledAt)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <ConsIcon size={10} /> {CONSULTATION_LABELS[op.consultationType] || "—"}
                                    </span>
                                    {op.hospital?.name && (
                                      <span className="flex items-center gap-1 truncate max-w-[120px]">
                                        <Building2 size={10} /> {op.hospital.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <motion.div
                                animate={{ x: isSelected ? 4 : 0 }}
                                className="flex-shrink-0"
                              >
                                <ChevronRight size={16} style={{ color: isSelected ? "var(--primary)" : "color-mix(in oklch,var(--base-content) 30%,transparent)" }} />
                              </motion.div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Pagination */}
                  {opsMeta.pages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => handlePageChange(filters.page - 1)}
                        disabled={filters.page <= 1}
                        className="btn btn-sm btn-ghost"
                      >
                        ←
                      </button>
                      <span className="text-xs font-semibold" style={{ color: "var(--base-content)" }}>
                        {filters.page} / {opsMeta.pages}
                      </span>
                      <button
                        onClick={() => handlePageChange(filters.page + 1)}
                        disabled={filters.page >= opsMeta.pages}
                        className="btn btn-sm btn-ghost"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: Detail Panel */}
                <div className="lg:col-span-1">
                  <div
                    className="card  p-4 sticky top-28"
                    style={{ maxHeight: "calc(100vh - 7rem)", overflowY: "auto", minHeight: 300 }}
                  >
                    <AnimatePresence mode="wait">
                      {selectedOp ? (
                        <OPDetailPanel
                          key={selectedOp.opNumber}
                          opNumber={selectedOp.opNumber}
                          onClose={() => setSelectedOp(null)}
                        />
                      ) : (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center gap-4 py-16 text-center"
                        >
                          <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center"
                            style={{ background: "color-mix(in srgb,var(--primary),transparent 88%)" }}
                          >
                            <FileText size={28} style={{ color: "var(--primary)" }} />
                          </div>
                          <div>
                            <div className="font-bold mb-1" style={{ color: "var(--base-content)" }}>Select an OP record</div>
                            <div className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>
                              Click any appointment to view full details, clinical notes, and follow-up chain.
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════
                TAB: ANALYTICS
            ════════════════════════════════════════════ */}
            {activeTab === "analytics" && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-6"
              >
                {/* Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatPill value={stats.total}     label="Total OPs"   icon={ClipboardList} color="var(--primary)"  trend={12} />
                  <StatPill value={stats.completed} label="Completed"   icon={CheckCircle2}  color="var(--success)"  trend={8} />
                  <StatPill value={stats.followUps} label="Follow-ups"  icon={Layers}        color="var(--accent)"   trend={-3} />
                  <StatPill value={stats.noShow}    label="No Shows"    icon={AlertCircle}   color="var(--error)"    trend={-15} />
                </div>

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Weekly Appointments Bar Chart */}
                  <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart2 size={16} style={{ color: "var(--primary)" }} />
                      <span className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Appointments by Day</span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={weeklyChartData} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "color-mix(in oklch,var(--base-content) 50%,transparent)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "color-mix(in oklch,var(--base-content) 50%,transparent)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: "var(--base-200)", border: "1px solid var(--base-300)", borderRadius: 8, fontSize: 12 }}
                          cursor={{ fill: "color-mix(in srgb,var(--primary),transparent 90%)" }}
                        />
                        <Bar dataKey="appointments" fill="var(--primary)" radius={[6, 6, 0, 0]} name="Appointments" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Status Distribution Pie */}
                  <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <PieIcon size={16} style={{ color: "var(--secondary)" }} />
                      <span className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Status Distribution</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="60%" height={220}>
                        <PieChart>
                          <Pie
                            data={statusChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {statusChartData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "var(--base-200)", border: "1px solid var(--base-300)", borderRadius: 8, fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-col gap-2 flex-1">
                        {statusChartData.map((d, i) => (
                          <div key={d.name} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-xs font-medium flex-1 truncate" style={{ color: "var(--base-content)" }}>{d.name}</span>
                            <span className="text-xs font-bold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Consultation Types */}
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={16} style={{ color: "var(--accent)" }} />
                    <span className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Consultation Type Breakdown</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {consultationChartData.map((d, i) => {
                      const pct = stats.total > 0 ? Math.round((d.value / stats.total) * 100) : 0;
                      const color = CHART_COLORS[i];
                      const Icon = Object.values(CONSULTATION_ICONS)[i] || Building2;
                      return (
                        <div key={d.name} className="p-4 rounded-xl" style={{ background: `color-mix(in srgb,${color},transparent 90%)` }}>
                          <div className="flex items-center gap-2 mb-2">
                            <Icon size={16} style={{ color }} />
                            <span className="font-bold text-xs" style={{ color }}>{d.name}</span>
                          </div>
                          <div className="text-md font-black mb-1" style={{ color, fontFamily: "var(--font-family-montserrat)" }}>{d.value}</div>
                          <div className="progress-bar">
                            <motion.div
                              className="progress-bar-fill"
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: i * 0.15 }}
                              style={{ background: color }}
                            />
                          </div>
                          <div className="text-xs mt-1 font-semibold" style={{ color }}>{pct}% of total</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Profile Completion */}
                {profile && (
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Shield size={16} style={{ color: "var(--info)" }} />
                        <span className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Profile Completion</span>
                      </div>
                      <span className="font-black text-lg" style={{ color: "var(--primary)", fontFamily: "var(--font-family-montserrat)" }}>
                        {profile.profileCompletionPercent ?? 0}%
                      </span>
                    </div>
                    <div className="progress-bar mb-4">
                      <motion.div
                        className="progress-bar-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${profile.profileCompletionPercent ?? 0}%` }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        ["KYC Status",       profile.kycStatus,          profile.kycStatus === "verified"],
                        ["Partnership",      profile.partnershipStatus,  profile.partnershipStatus === "Active"],
                        ["Bank Verified",    profile.bankDetails?.isBankVerified ? "Verified" : "Pending", profile.bankDetails?.isBankVerified],
                        ["Online Status",    profile.isOnline ? "Online" : "Offline", profile.isOnline],
                        ["Availability",     profile.weeklyAvailability?.length > 0 ? "Set" : "Not set", profile.weeklyAvailability?.length > 0],
                        ["Profile Photo",    profile.profilePhotoUrl ? "Uploaded" : "Missing", !!profile.profilePhotoUrl],
                      ].map(([label, value, ok]) => (
                        <div key={label} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: "var(--base-200)" }}>
                          {ok
                            ? <CheckCircle2 size={13} style={{ color: "var(--success)" }} />
                            : <AlertCircle size={13} style={{ color: "var(--warning)" }} />
                          }
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "color-mix(in oklch,var(--base-content) 45%,transparent)" }}>{label}</div>
                            <div className="text-xs font-bold capitalize" style={{ color: ok ? "var(--success)" : "var(--warning)" }}>{value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ════════════════════════════════════════════
                TAB: AVAILABILITY
            ════════════════════════════════════════════ */}
            {activeTab === "availability" && (
              <motion.div
                key="availability"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-6"
              >
                {/* Info Banner */}
                <div className="card p-4 flex items-start gap-3"
                  style={{ borderLeft: "3px solid var(--info)", background: "color-mix(in srgb,var(--info),transparent 93%)" }}>
                  <Info size={16} style={{ color: "var(--info)", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="text-xs font-bold" style={{ color: "var(--info)" }}>Availability Controls Slots, Not Pricing</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--base-content)" }}>
                      {pricingSource === "hospital"
                        ? "Your fees are set by the hospital manager. You control your appointment slots independently."
                        : "As a doctor-owner, you control both your slots and your pricing."
                      }
                    </div>
                  </div>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-1 gap-3">
                  {DAYS.map((day) => {
                    const entry = availDraft[day] || { day, isAvailable: false, slots: [] };
                    return (
                      <motion.div
                        key={day}
                        layout
                        className="card overflow-hidden"
                        style={{ borderLeft: `3px solid ${entry.isAvailable ? "var(--success)" : "var(--base-300)"}` }}
                      >
                        {/* Day Header */}
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer"
                          onClick={() => handleAvailDayToggle(day)}
                          style={{ background: entry.isAvailable ? "color-mix(in srgb,var(--success),transparent 94%)" : "var(--base-200)" }}
                        >
                          <div className="flex items-center gap-3">
                          <button
  onClick={(e) => { 
    e.stopPropagation(); 
    handleAvailDayToggle(day); 
  }}
  className="relative flex items-center h-6 w-11 rounded-full transition-all duration-300 focus:outline-none"
  style={{ 
    // The track background color
    background: entry.isAvailable 
      ? "var(--success)" 
      : "color-mix(in oklch, var(--base-content) 15%, transparent)",
    // Optional subtle border to define the shape in dark/light modes
    border: `1px solid ${entry.isAvailable ? "transparent" : "var(--base-300)"}`
  }}
>
  <motion.div
    layout
    transition={{ 
      type: "spring", 
      stiffness: 600, 
      damping: 35 
    }}
    className="h-4.5 w-4.5 bg-white rounded-full shadow-md"
    style={{ 
      // Manual positioning logic based on state
      marginLeft: entry.isAvailable ? "1.4rem" : "0.25rem",
      // Optional: Add a tiny icon or dot inside the knob if you want extra detail
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    {/* Very subtle inner dot (optional) */}
    <div 
      className="w-1 h-1 rounded-full" 
      style={{ 
        background: entry.isAvailable ? "var(--success)" : "var(--base-300)",
        opacity: 0.4 
      }} 
    />
  </motion.div>
</button>
                            <span className="font-black text-xs" style={{ fontFamily: "var(--font-family-montserrat)", color: "var(--base-content)" }}>{day}</span>
                            {entry.isAvailable && entry.slots?.length > 0 && (
                              <span className="badge badge-success badge-sm">{entry.slots.filter(s => s.isActive).length} slot{entry.slots.filter(s => s.isActive).length !== 1 ? "s" : ""}</span>
                            )}
                          </div>
                          {entry.isAvailable
                            ? <span className="text-xs font-semibold" style={{ color: "var(--success)" }}>Available</span>
                            : <span className="text-xs font-semibold" style={{ color: "color-mix(in oklch,var(--base-content) 40%,transparent)" }}>Day Off</span>
                          }
                        </div>

                        {/* Slots Editor */}
                        <AnimatePresence>
                          {entry.isAvailable && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4" style={{ background: "color-mix(in srgb,var(--success),transparent 92%)" }}>
                                <SlotEditor
                                  day={day}
                                  dayEntry={entry}
                                  onChange={handleSlotChange}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Save Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSaveAvailability}
                  disabled={availSaving}
                  className="btn-primary-cta w-full flex items-center justify-center gap-2"
                >
                  {availSaving ? <Spinner size={18} /> : <Save size={18} />}
                  {availSaving ? "Saving…" : "Save Availability Schedule"}
                </motion.button>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════
                TAB: PRICING
            ════════════════════════════════════════════ */}
            {activeTab === "pricing" && (
              <motion.div
                key="pricing"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-6"
              >
                {/* Source Banner */}
                <div
                  className="card p-4 flex items-start gap-3"
                  style={{
                    borderLeft: `3px solid ${pricingSource === "hospital" ? "var(--info)" : "var(--success)"}`,
                    background: pricingSource === "hospital"
                      ? "color-mix(in srgb,var(--info),transparent 93%)"
                      : "color-mix(in srgb,var(--success),transparent 93%)",
                  }}
                >
                  {pricingSource === "hospital" ? (
                    <Building2 size={16} style={{ color: "var(--info)", flexShrink: 0, marginTop: 2 }} />
                  ) : (
                    <User size={16} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }} />
                  )}
                  <div>
                    <div className="text-xs font-bold" style={{ color: pricingSource === "hospital" ? "var(--info)" : "var(--success)" }}>
                      {pricingSource === "hospital" ? "Hospital-Managed Pricing" : "Doctor-Controlled Pricing"}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--base-content)" }}>
                      {effectivePricing?.note || (pricingSource === "hospital"
                        ? "Fees are set by your hospital manager. Contact them to adjust rates."
                        : "You control your own consultation fees. Update them in your profile settings."
                      )}
                    </div>
                  </div>
                </div>

                {/* Consultation Fees Grid */}
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <Zap size={16} style={{ color: "var(--primary)" }} />
                    <span className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Effective Consultation Fees</span>
                    <span className="badge badge-primary badge-sm ml-auto capitalize">{pricingSource || "—"}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      ["inPerson",  "In-Person",  Building2, pricing.inPersonFee],
                      ["video",     "Video",       Video,     pricing.videoFee],
                      ["homeVisit", "Home Visit",  Home,      pricing.homeVisitFee],
                    ].map(([key, label, Icon, fee]) => (
                      <motion.div
                        key={key}
                        whileHover={{ y: -2 }}
                        className="p-5 rounded-xl text-center"
                        style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                          style={{ background: "var(--bg-gradient-primary)" }}>
                          <Icon size={18} style={{ color: "var(--primary-content)" }} />
                        </div>
                        <div className="text-xs font-bold uppercase tracking-wide mb-1"
                          style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>{label}</div>
                        <div className="text-2xl font-black" style={{ color: "var(--primary)", fontFamily: "var(--font-family-montserrat)" }}>
                          {fmtCurrency(fee)}
                        </div>
                        {pricingSource === "hospital" && pricing[`${key === "inPerson" ? "inPerson" : key === "video" ? "video" : "homeVisit"}Honorarium`] != null && (
                          <div className="text-xs mt-1" style={{ color: "var(--success)" }}>
                            Honorarium: {fmtCurrency(pricing[`${key === "inPerson" ? "inPerson" : key === "video" ? "video" : "homeVisit"}Honorarium`])}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Follow-up Policy */}
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers size={16} style={{ color: "var(--accent)" }} />
                    <span className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Follow-up Policy</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      ["Follow-up Fee",     fmtCurrency(pricing.followUpFee),           pricing.followUpFee === 0 ? "Free!" : null],
                      ["Discount",          `${pricing.followUpDiscountPercent ?? 0}%`,  "off full fee"],
                      ["Valid Window",      `${pricing.followUpValidDays ?? 7} days`,    "after first visit"],
                    ].map(([label, value, sub]) => (
                      <div key={label} className="p-4 rounded-xl" style={{ background: "var(--base-200)" }}>
                        <div className="text-xs font-bold uppercase tracking-wide mb-1"
                          style={{ color: "color-mix(in oklch,var(--base-content) 45%,transparent)" }}>{label}</div>
                        <div className="text-md font-black" style={{ color: "var(--accent)", fontFamily: "var(--font-family-montserrat)" }}>{value}</div>
                        {sub && <div className="text-xs font-semibold mt-0.5" style={{ color: "var(--success)" }}>{sub}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Consultation Types Offered */}
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCheck size={16} style={{ color: "var(--success)" }} />
                    <span className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Consultation Types Offered</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {[
                      ["inPerson",  "In-Person",  Building2],
                      ["video",     "Video",       Video],
                      ["homeVisit", "Home Visit",  Home],
                    ].map(([key, label, Icon]) => {
                      const offered = pricing?.consultationTypes?.[key] ?? profile?.consultationTypes?.[key];
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                          style={{
                            background: offered
                              ? "color-mix(in srgb,var(--success),transparent 88%)"
                              : "var(--base-200)",
                            border: `1px solid ${offered ? "color-mix(in srgb,var(--success),transparent 60%)" : "var(--base-300)"}`,
                          }}
                        >
                          <Icon size={14} style={{ color: offered ? "var(--success)" : "color-mix(in oklch,var(--base-content) 35%,transparent)" }} />
                          <span className="text-xs font-bold" style={{ color: offered ? "var(--success)" : "color-mix(in oklch,var(--base-content) 40%,transparent)" }}>
                            {label}
                          </span>
                          {offered
                            ? <CheckCircle2 size={13} style={{ color: "var(--success)" }} />
                            : <XCircle size={13} style={{ color: "color-mix(in oklch,var(--base-content) 30%,transparent)" }} />
                          }
                        </div>
                      );
                    })}
                  </div>
                  {pricingSource === "hospital" && (
                    <p className="text-xs mt-3" style={{ color: "color-mix(in oklch,var(--base-content) 45%,transparent)" }}>
                      Consultation types are managed by your hospital. Contact your hospital manager to update.
                    </p>
                  )}
                </div>

                {/* Platform Fee */}
                {effectivePricing?.platformFee && (
                  <div className="card p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "color-mix(in srgb,var(--warning),transparent 85%)" }}>
                      <Info size={18} style={{ color: "var(--warning)" }} />
                    </div>
                    <div>
                      <div className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Platform Fee Applied</div>
                      <div className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 55%,transparent)" }}>
                        {effectivePricing.platformFee.type === "percentage"
                          ? `${effectivePricing.platformFee.value}% of each consultation`
                          : `₹${effectivePricing.platformFee.value} flat per consultation`
                        }
                        {" · "}{pricingSource === "hospital" ? "Set by superadmin" : "Custom override active"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Managed Hospitals */}
                {(myHospitals?.primaryHospital || myHospitals?.managedHospitals?.length > 0) && (
                  <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 size={16} style={{ color: "var(--secondary)" }} />
                      <span className="font-bold text-xs" style={{ color: "var(--base-content)" }}>Associated Hospitals</span>
                    </div>
                    <div className="space-y-2">
                      {myHospitals?.primaryHospital && (
                        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--base-200)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: "color-mix(in srgb,var(--primary),transparent 85%)" }}>
                            <Building2 size={14} style={{ color: "var(--primary)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate" style={{ color: "var(--base-content)" }}>
                              {myHospitals.primaryHospital.name}
                            </div>
                            <div className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>
                              Primary Hospital · {myHospitals.primaryHospital.address?.city}
                            </div>
                          </div>
                          <span className="badge badge-primary badge-sm">Primary</span>
                        </div>
                      )}
                      {(myHospitals?.otherHospitals || []).map((h) => (
                        <div key={h._id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--base-200)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: "color-mix(in srgb,var(--secondary),transparent 85%)" }}>
                            <Building2 size={14} style={{ color: "var(--secondary)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate" style={{ color: "var(--base-content)" }}>{h.name}</div>
                            <div className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>{h.address?.city}</div>
                          </div>
                          <span className="badge badge-sm" style={{ background: "var(--base-300)", color: "var(--base-content)" }}>Affiliated</span>
                        </div>
                      ))}
                      {(myHospitals?.managedHospitals || []).map((h) => (
                        <div key={h._id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--base-200)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: "color-mix(in srgb,var(--accent),transparent 85%)" }}>
                            <Building2 size={14} style={{ color: "var(--accent)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate" style={{ color: "var(--base-content)" }}>{h.name}</div>
                            <div className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>
                              {h.address?.city} · {h.isVerified ? "Verified" : "Pending"}
                            </div>
                          </div>
                          <span className="badge badge-accent badge-sm">Owned</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}