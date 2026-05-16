"use client";

/**
 * ══════════════════════════════════════════════════════════════════
 * CARE ASSISTANT MANAGEMENT — LIKESON HEALTHCARE
 * Route: /admin/care-assistants  (admin | superadmin only)
 *
 * Covers ALL admin thunks:
 *  adminCreateCareAssistant · adminGetAll · adminGetStats
 *  adminGetNearby · adminGetOne · adminKycAction
 *  adminPoliceVerification · adminBlockCA · adminUnblockCA
 *  adminVerifyCertificate · adminUpdatePerformance
 *  adminUpdateNotes · adminVerifyBank
 * ══════════════════════════════════════════════════════════════════
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  Users, ShieldCheck, MapPin, TrendingUp, Star, Wallet,
  Search, Filter, Plus, Eye, Lock, Unlock, CheckCircle,
  XCircle, AlertTriangle, Clock, Activity, Award,
  ChevronLeft, ChevronRight, RefreshCw, X, Check,
  FileText, BadgeCheck, Building2, Loader2, BarChart2,
  CreditCard, StickyNote, Tag, Upload, Phone, Mail,
  Calendar, Briefcase, Globe, Shield, HeartPulse,
  Navigation, UserPlus, Zap, Layers, MoreVertical,
} from "lucide-react";

// ── Redux imports ──────────────────────────────────────────────────
import {
  adminCreateCareAssistant,
  adminGetAll,
  adminGetStats,
  adminGetNearby,
  adminGetOne,
  adminKycAction,
  adminPoliceVerification,
  adminBlockCA,
  adminUnblockCA,
  adminVerifyCertificate,
  adminUpdatePerformance,
  adminUpdateNotes,
  adminVerifyBank,
  clearError,
  clearAllErrors,
  selectAdminList,
  selectAdminPagination,
  selectAdminSelected,
  selectAdminStats,
  selectAdminNearby,
  selectAdminNearbyCount,
  selectLoading,
  selectErrors,
} from "@/store/slices/careAssistantSlice";

// ══════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════

const KYC_COLORS   = { Verified: "#22c55e", "Under-Review": "#f59e0b", Pending: "#94a3b8", Rejected: "#ef4444" };
const STATUS_COLORS = { Available: "#22c55e", "On-Task": "#3b82f6", Offline: "#94a3b8", "On-Break": "#f59e0b", Suspended: "#ef4444" };
const WORK_COLORS   = ["var(--primary)", "var(--secondary)", "var(--accent)", "#8b5cf6"];

const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};
const STAGGER = { show: { transition: { staggerChildren: 0.07 } } };

// ══════════════════════════════════════════════════════════════════
// SMALL HELPERS
// ══════════════════════════════════════════════════════════════════

const Badge = ({ label, variant = "info" }) => {
  const cls = {
    success: "badge-success",
    warning: "badge-warning",
    error:   "badge-error",
    info:    "badge-info",
    primary: "badge-primary",
    neutral: "bg-base-300 text-base-content/60",
  };
  return <span className={`badge badge-sm ${cls[variant] ?? cls.info}`}>{label}</span>;
};

const kycVariant = (s) =>
  s === "Verified" ? "success" : s === "Under-Review" ? "warning" : s === "Rejected" ? "error" : "neutral";

const statusVariant = (s) =>
  s === "Available" ? "success" : s === "On-Task" ? "info" : s === "Suspended" ? "error" : s === "On-Break" ? "warning" : "neutral";

const Spinner = ({ sm }) => (
  <Loader2 className={`animate-spin ${sm ? "w-4 h-4" : "w-5 h-5"}`} />
);

const SectionNote = ({ children }) => (
  <p className="text-xs text-base-content/50 mt-0.5 font-normal">{children}</p>
);

const FieldLabel = ({ label, note }) => (
  <div className="mb-1">
    <label className="label-text">{label}</label>
    {note && <SectionNote>{note}</SectionNote>}
  </div>
);

// Custom tooltip for recharts
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs border border-primary/20 shadow-primary">
      {label && <p className="font-semibold text-base-content mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// MODAL WRAPPER
// ══════════════════════════════════════════════════════════════════

const Modal = ({ open, onClose, title, subtitle, children, wide }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-neutral/60 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        />
        <motion.div
          className={`relative z-10 card bg-base-100 shadow-depth-lg border border-base-300 overflow-hidden
            ${wide ? "w-full max-w-4xl max-h-[90vh] overflow-y-auto" : "w-full max-w-xl"}`}
          initial={{ scale: 0.93, opacity: 0, y: 20 }}
          animate={{ scale: 1,    opacity: 1, y: 0 }}
          exit={  { scale: 0.93, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 28, stiffness: 340 }}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-base-300 bg-base-200/50">
            <div>
              <h3 className="text-lg font-bold text-base-content font-montserrat">{title}</h3>
              {subtitle && <p className="text-xs text-base-content/50 mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle ml-4 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ══════════════════════════════════════════════════════════════════
// CONFIRM MODAL
// ══════════════════════════════════════════════════════════════════

const ConfirmModal = ({ open, onClose, onConfirm, title, message, danger, loading }) => (
  <Modal open={open} onClose={onClose} title={title}>
    <p className="text-sm text-base-content/70 mb-6">{message}</p>
    <div className="flex gap-3 justify-end">
      <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className={`btn btn-sm ${danger ? "btn-error" : "btn-primary"}`}
      >
        {loading ? <Spinner sm /> : <Check className="w-4 h-4" />}
        Confirm
      </button>
    </div>
  </Modal>
);

// ══════════════════════════════════════════════════════════════════
// STAT CARD
// ══════════════════════════════════════════════════════════════════

const StatCard = ({ icon: Icon, label, value, sub, accent, trend }) => (
  <motion.div variants={FADE_UP} className="stat-card group relative overflow-hidden">
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary), transparent 96%) 0%, transparent 60%)" }}
    />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="stat-card-label">{label}</p>
        <p className="stat-card-value mt-2">{value ?? "—"}</p>
        {sub && <p className="text-xs text-base-content/50 mt-1">{sub}</p>}
        {trend !== undefined && (
          <p className={`text-xs font-semibold mt-1 ${trend >= 0 ? "text-success" : "text-error"}`}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </p>
        )}
      </div>
      <div className={`p-2.5 rounded-xl ${accent || "bg-primary/10"}`}>
        <Icon className="w-5 h-5 text-primary" />
      </div>
    </div>
  </motion.div>
);

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════

export default function CareAssistantManagement() {
  const dispatch   = useDispatch();
  const list       = useSelector(selectAdminList);
  const pagination = useSelector(selectAdminPagination);
  const selected   = useSelector(selectAdminSelected);
  const stats      = useSelector(selectAdminStats);
  const nearby     = useSelector(selectAdminNearby);
  const nearbyCount = useSelector(selectAdminNearbyCount);
  const loading    = useSelector(selectLoading);
  const errors     = useSelector(selectErrors);

  // ── Filter state ─────────────────────────────────────────────
  const [filters, setFilters] = useState({
    search: "", status: "", workType: "", kycStatus: "",
    isActive: "", isBlocked: "", page: 1, limit: 15,
    sortBy: "createdAt", sortOrder: "desc",
  });
  const searchTimer = useRef(null);

  // ── Modal state ───────────────────────────────────────────────
  const [modal, setModal] = useState({
    create: false,
    detail: false,
    kyc: false,
    block: false,
    unblock: false,
    police: false,
    perf: false,
    notes: false,
    bank: false,
    nearby: false,
  });
  const openModal  = (key) => setModal((m) => ({ ...m, [key]: true }));
  const closeModal = (key) => setModal((m) => ({ ...m, [key]: false }));
  const closeAll   = () => setModal(Object.fromEntries(Object.keys(modal).map((k) => [k, false])));

  // ── Form state ────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState({
    fullName: "", email: "", phone: "", gender: "",
    workType: "Part-Time", experienceYears: 0,
    bio: "", specializations: "", languagesKnown: "",
  });
  const [kycForm,   setKycForm]   = useState({ action: "approve", rejectionReason: "" });
  const [blockForm, setBlockForm] = useState({ blockReason: "", unblockAt: "" });
  const [policeForm,setPoliceForm]= useState({ status: "Completed", backgroundCheckUrl: "", backgroundCheckDate: "" });
  const [perfForm,  setPerfForm]  = useState({
    averageRating: "", totalTasksCompleted: "", totalEarnings: "",
    onTimeArrivalRate: "", repeatClientRate: "", totalPaid: "", pendingPayout: "",
  });
  const [notesForm, setNotesForm] = useState({ adminNotes: "", tags: "" });
  const [nearbyForm,setNearbyForm]= useState({ lng: "80.648", lat: "16.506", radiusKm: "10" });

  // ── Confirm dialogs ───────────────────────────────────────────
  const [confirm, setConfirm] = useState({ open: false, type: "", id: "" });

  // ══════════════════════════════════════════════════════════════
  // DATA FETCH
  // ══════════════════════════════════════════════════════════════

  const fetchList = useCallback(() => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v !== "") params[k] = v; });
    dispatch(adminGetAll(params));
  }, [dispatch, filters]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => { dispatch(adminGetStats()); }, [dispatch]);

  // ── Open detail ───────────────────────────────────────────────
  const handleViewDetail = (id) => {
    dispatch(adminGetOne(id));
    openModal("detail");
  };

  // ── Search debounce ───────────────────────────────────────────
  const handleSearch = (val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: val, page: 1 }));
    }, 400);
  };

  // ── Pagination ────────────────────────────────────────────────
  const goPage = (p) => setFilters((f) => ({ ...f, page: p }));

  // ══════════════════════════════════════════════════════════════
  // ACTION HANDLERS
  // ══════════════════════════════════════════════════════════════

  // Create
  const handleCreate = async () => {
    const payload = {
      ...createForm,
      specializations: createForm.specializations.split(",").map((s) => s.trim()).filter(Boolean),
      languagesKnown:  createForm.languagesKnown.split(",").map((s) => s.trim()).filter(Boolean),
      experienceYears: Number(createForm.experienceYears),
    };
    const res = await dispatch(adminCreateCareAssistant(payload));
    if (!res.error) { closeModal("create"); setCreateForm({ fullName:"",email:"",phone:"",gender:"",workType:"Part-Time",experienceYears:0,bio:"",specializations:"",languagesKnown:"" }); fetchList(); }
  };

  // KYC
  const handleKyc = async () => {
    if (!selected) return;
    const res = await dispatch(adminKycAction({ id: selected._id, ...kycForm }));
    if (!res.error) { closeModal("kyc"); dispatch(adminGetOne(selected._id)); }
  };

  // Block
  const handleBlock = async () => {
    if (!selected) return;
    const res = await dispatch(adminBlockCA({ id: selected._id, ...blockForm }));
    if (!res.error) { closeModal("block"); dispatch(adminGetOne(selected._id)); fetchList(); }
  };

  // Unblock
  const handleUnblock = async () => {
    if (!selected) return;
    const res = await dispatch(adminUnblockCA(selected._id));
    if (!res.error) { closeModal("unblock"); dispatch(adminGetOne(selected._id)); fetchList(); }
  };

  // Police verification
  const handlePolice = async () => {
    if (!selected) return;
    const res = await dispatch(adminPoliceVerification({ id: selected._id, ...policeForm }));
    if (!res.error) { closeModal("police"); dispatch(adminGetOne(selected._id)); }
  };

  // Performance update
  const handlePerf = async () => {
    if (!selected) return;
    const clean = {};
    Object.entries(perfForm).forEach(([k, v]) => { if (v !== "") clean[k] = Number(v); });
    const res = await dispatch(adminUpdatePerformance({ id: selected._id, ...clean }));
    if (!res.error) { closeModal("perf"); dispatch(adminGetOne(selected._id)); }
  };

  // Notes update
  const handleNotes = async () => {
    if (!selected) return;
    const payload = {
      id: selected._id,
      adminNotes: notesForm.adminNotes,
      tags: notesForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const res = await dispatch(adminUpdateNotes(payload));
    if (!res.error) { closeModal("notes"); }
  };

  // Bank verify
  const handleBankVerify = async () => {
    if (!selected) return;
    const res = await dispatch(adminVerifyBank(selected._id));
    if (!res.error) { closeModal("bank"); dispatch(adminGetOne(selected._id)); }
  };

  // Certificate verify
  const handleVerifyCert = async (certId) => {
    if (!selected) return;
    dispatch(adminVerifyCertificate({ id: selected._id, certId }));
  };

  // Nearby search
  const handleNearby = () => {
    dispatch(adminGetNearby({ lng: parseFloat(nearbyForm.lng), lat: parseFloat(nearbyForm.lat), radiusKm: nearbyForm.radiusKm }));
    openModal("nearby");
  };

  // Pre-fill notes/perf forms when selected changes
  useEffect(() => {
    if (selected) {
      setNotesForm({
        adminNotes: selected.adminNotes || "",
        tags:       (selected.tags || []).join(", "),
      });
      setPerfForm({
        averageRating:       selected.performance?.averageRating      ?? "",
        totalTasksCompleted: selected.performance?.totalTasksCompleted ?? "",
        totalEarnings:       selected.performance?.totalEarnings       ?? "",
        onTimeArrivalRate:   selected.performance?.onTimeArrivalRate   ?? "",
        repeatClientRate:    selected.performance?.repeatClientRate    ?? "",
        totalPaid:           selected.earnings?.totalPaid              ?? "",
        pendingPayout:       selected.earnings?.pendingPayout          ?? "",
      });
    }
  }, [selected]);

  // ══════════════════════════════════════════════════════════════
  // CHART DATA
  // ══════════════════════════════════════════════════════════════

  const kycPieData = stats ? [
    { name: "Verified",      value: stats.kyc?.verified,     fill: KYC_COLORS.Verified     },
    { name: "Under Review",  value: stats.kyc?.underReview,  fill: KYC_COLORS["Under-Review"] },
    { name: "Pending",       value: stats.kyc?.pending,      fill: KYC_COLORS.Pending      },
  ].filter((d) => d.value > 0) : [];

  const workTypeBar = stats?.workTypeBreakdown?.map((w, i) => ({
    name:  w._id || "Unknown",
    count: w.count,
    fill:  WORK_COLORS[i % WORK_COLORS.length],
  })) ?? [];

  const cityBar = stats?.topOnlineCities?.map((c) => ({
    city:   c._id || "Unknown",
    online: c.count,
  })) ?? [];

  const dispatchRadial = stats ? [
    { name: "Dispatchable", value: stats.dispatchableNow, fill: "var(--success)" },
    { name: "Total Active", value: stats.active,          fill: "var(--primary)" },
  ] : [];

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-base-100" data-theme="care-assistant">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="border-b border-base-300 bg-base-200/50 sticky top-0 z-30 backdrop-blur-strong">
        <div className="container-custom py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <HeartPulse className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black font-montserrat text-base-content leading-tight">
                Care Assistant Management
              </h1>
              <p className="text-xs text-base-content/50">
                Admin control panel · Likeson Healthcare
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchList()} className="btn btn-ghost btn-sm gap-2">
              <RefreshCw className={`w-4 h-4 ${loading.adminList ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button onClick={() => openModal("create")} className="btn btn-primary btn-sm gap-2">
              <UserPlus className="w-4 h-4" /> Add Care Assistant
            </button>
          </div>
        </div>
      </div>

      <div className="container-custom py-6 space-y-8">

        {/* ── STATS GRID ───────────────────────────────────────── */}
        {stats && (
          <motion.div
            variants={STAGGER} initial="hidden" animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
          >
            <StatCard icon={Users}      label="Total CAs"    value={stats.total}          sub="All registered"    />
            <StatCard icon={Activity}   label="Active"       value={stats.active}          sub="KYC verified"      accent="bg-success/10" />
            <StatCard icon={Zap}        label="Online Now"   value={stats.online}          sub="Currently online"  accent="bg-info/10"    />
            <StatCard icon={ShieldCheck}label="Dispatchable" value={stats.dispatchableNow} sub="Ready for task"    accent="bg-accent/10"  />
            <StatCard icon={AlertTriangle} label="Suspended" value={stats.suspended}       sub="Blocked accounts"  accent="bg-error/10"   />
            <StatCard icon={Clock}      label="KYC Pending"  value={stats.kyc?.pending}    sub="Awaiting review"   accent="bg-warning/10" />
          </motion.div>
        )}

        {/* ── CHARTS ROW ──────────────────────────────────────── */}
        {stats && (
          <motion.div variants={STAGGER} initial="hidden" animate="show"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* KYC Pie */}
            <motion.div variants={FADE_UP} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm font-montserrat">KYC Status Distribution</h3>
              </div>
              <SectionNote>Breakdown of all care assistants by KYC verification status.</SectionNote>
              <div className="h-48 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={kycPieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72}
                      dataKey="value" nameKey="name" paddingAngle={3}>
                      {kycPieData.map((e, i) => <Cell key={i} fill={e.fill} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(v) => <span className="text-xs text-base-content/70">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Work type bar */}
            <motion.div variants={FADE_UP} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm font-montserrat">Work Type Breakdown</h3>
              </div>
              <SectionNote>Number of care assistants registered per engagement type.</SectionNote>
              <div className="h-48 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workTypeBar} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.55 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.55 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {workTypeBar.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Top online cities */}
            <motion.div variants={FADE_UP} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm font-montserrat">Top Online Cities</h3>
              </div>
              <SectionNote>Cities with highest count of currently online care assistants.</SectionNote>
              <div className="h-48 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityBar} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.55 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="city" type="category" width={80} tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.55 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="online" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ── NEARBY SEARCH ────────────────────────────────────── */}
        <motion.div variants={FADE_UP} initial="hidden" animate="show"
          className="card p-5 border-primary/20"
        >
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm font-montserrat">Nearby Dispatch Search</h3>
          </div>
          <SectionNote>Find available, KYC-verified care assistants near a coordinate for dispatch.</SectionNote>
          <div className="flex flex-wrap gap-3 mt-3">
            <div>
              <FieldLabel label="Longitude" note="Decimal degrees (e.g. 80.648)" />
              <input className="input-field w-32" value={nearbyForm.lng}
                onChange={(e) => setNearbyForm((f) => ({ ...f, lng: e.target.value }))} />
            </div>
            <div>
              <FieldLabel label="Latitude" note="Decimal degrees (e.g. 16.506)" />
              <input className="input-field w-32" value={nearbyForm.lat}
                onChange={(e) => setNearbyForm((f) => ({ ...f, lat: e.target.value }))} />
            </div>
            <div>
              <FieldLabel label="Radius (km)" note="Search radius in kilometres" />
              <input className="input-field w-24" type="number" value={nearbyForm.radiusKm}
                onChange={(e) => setNearbyForm((f) => ({ ...f, radiusKm: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <button onClick={handleNearby} disabled={loading.adminNearby}
                className="btn btn-primary btn-sm gap-2">
                {loading.adminNearby ? <Spinner sm /> : <Navigation className="w-4 h-4" />}
                Find Nearby
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── FILTERS ──────────────────────────────────────────── */}
        <motion.div variants={FADE_UP} initial="hidden" animate="show" className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm font-montserrat">Filter & Search</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-2 sm:col-span-1 lg:col-span-2">
              <FieldLabel label="Search" note="Name, phone, or email" />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40" />
                <input className="input-field pl-9" placeholder="Search…"
                  onChange={(e) => handleSearch(e.target.value)} />
              </div>
            </div>
            {[
              { key: "status",    label: "Status",      note: "Current CA status", opts: ["","Available","On-Task","Offline","On-Break","Suspended"] },
              { key: "kycStatus", label: "KYC Status",  note: "Verification stage", opts: ["","Pending","Under-Review","Verified","Rejected"] },
              { key: "workType",  label: "Work Type",   note: "Engagement mode",   opts: ["","Full-Time","Part-Time","Weekends-Only","On-Call"] },
              { key: "isActive",  label: "Active?",     note: "Profile activated", opts: ["","true","false"] },
              { key: "isBlocked", label: "Blocked?",    note: "Suspended accounts",opts: ["","true","false"] },
            ].map(({ key, label, note, opts }) => (
              <div key={key}>
                <FieldLabel label={label} note={note} />
                <select className="input-field"
                  value={filters[key]}
                  onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value, page: 1 }))}>
                  {opts.map((o) => <option key={o} value={o}>{o || "All"}</option>)}
                </select>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── TABLE ────────────────────────────────────────────── */}
        <motion.div variants={FADE_UP} initial="hidden" animate="show" className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 bg-base-200/40">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm font-montserrat">Care Assistants</h3>
              <span className="badge badge-primary badge-sm">{pagination.total}</span>
            </div>
            <div className="flex items-center gap-2">
              <FieldLabel label="" note="" />
              <select className="input-field w-32 text-xs"
                value={filters.limit}
                onChange={(e) => setFilters((f) => ({ ...f, limit: e.target.value, page: 1 }))}>
                {[10, 15, 25, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </div>
          </div>

          {loading.adminList ? (
            <div className="flex justify-center items-center py-20">
              <Spinner /> <span className="ml-3 text-sm text-base-content/50">Loading…</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {["Care Assistant","Contact","Work Type","KYC","Status","Active","Actions"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-base-content/40 text-sm">No care assistants found.</td></tr>
                  ) : list.map((ca) => (
                    <tr key={ca._id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="avatar placeholder">
                            <div className="w-9 h-9 rounded-full">
                              {ca.photoUrl
                                ? <img src={ca.photoUrl} alt={ca.fullName} />
                                : <span className="text-sm">{ca.fullName?.[0]}</span>
                              }
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-sm leading-tight">{ca.fullName}</p>
                            <p className="text-xs text-base-content/50">{ca.email}</p>
                            {ca.performance?.averageRating != null && (
                              <p className="text-xs text-warning flex items-center gap-0.5 mt-0.5">
                                <Star className="w-3 h-3 fill-warning" />
                                {ca.performance.averageRating.toFixed(1)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-xs">{ca.phone || "—"}</p>
                        <p className="text-xs text-base-content/50">{ca.availability?.currentCity || "—"}</p>
                      </td>
                      <td><Badge label={ca.workType || "—"} variant="primary" /></td>
                      <td><Badge label={ca.kyc?.verificationStatus || "Pending"} variant={kycVariant(ca.kyc?.verificationStatus)} /></td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className={`status-dot ${STATUS_COLORS[ca.status] ? "" : "status-dot-info"}`}
                            style={{ backgroundColor: STATUS_COLORS[ca.status] || "#94a3b8" }} />
                          <Badge label={ca.status || "Offline"} variant={statusVariant(ca.status)} />
                        </div>
                      </td>
                      <td>
                        {ca.isActive
                          ? <CheckCircle className="w-4 h-4 text-success" />
                          : <XCircle    className="w-4 h-4 text-error"   />
                        }
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button title="View detail" onClick={() => handleViewDetail(ca._id)}
                            className="btn btn-ghost btn-xs btn-circle">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {ca.isBlocked ? (
                            <button title="Unblock" onClick={() => { dispatch(adminGetOne(ca._id)); openModal("unblock"); }}
                              className="btn btn-ghost btn-xs btn-circle text-success">
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button title="Block" onClick={() => { dispatch(adminGetOne(ca._id)); openModal("block"); }}
                              className="btn btn-ghost btn-xs btn-circle text-error">
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-base-300 bg-base-200/30">
              <p className="text-xs text-base-content/50">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => goPage(pagination.page - 1)} disabled={pagination.page <= 1}
                  className="btn btn-ghost btn-xs btn-circle">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4)) + i;
                  return (
                    <button key={p} onClick={() => goPage(p)}
                      className={`btn btn-xs btn-circle ${p === pagination.page ? "btn-primary" : "btn-ghost"}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => goPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
                  className="btn btn-ghost btn-xs btn-circle">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MODALS
          ════════════════════════════════════════════════════════ */}

      {/* ── CREATE ─────────────────────────────────────────────── */}
      <Modal open={modal.create} onClose={() => closeModal("create")}
        title="Add Care Assistant" subtitle="Creates User account + CareAssistantProfile. Welcome email auto-dispatched." wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Full Name *" note="Legal name as on Aadhaar card" />
            <input className="input-field" value={createForm.fullName}
              onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div>
            <FieldLabel label="Email Address *" note="Used for login credentials; welcome email sent here" />
            <input className="input-field" type="email" value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <FieldLabel label="Phone" note="Indian mobile number (10 digits, auto-prefixed +91)" />
            <input className="input-field" value={createForm.phone}
              onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <FieldLabel label="Gender" note="Optional — used for patient matching preferences" />
            <select className="input-field" value={createForm.gender}
              onChange={(e) => setCreateForm((f) => ({ ...f, gender: e.target.value }))}>
              <option value="">Select</option>
              {["Male","Female","Other","Prefer Not to Say"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel label="Work Type" note="Determines shift schedule constraints and dispatch priority" />
            <select className="input-field" value={createForm.workType}
              onChange={(e) => setCreateForm((f) => ({ ...f, workType: e.target.value }))}>
              {["Full-Time","Part-Time","Weekends-Only","On-Call"].map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel label="Experience (years)" note="Total years of professional caregiving experience" />
            <input className="input-field" type="number" min="0" value={createForm.experienceYears}
              onChange={(e) => setCreateForm((f) => ({ ...f, experienceYears: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel label="Specializations" note="Comma-separated — e.g. Dementia Care, Post-Surgery, Pediatric" />
            <input className="input-field" placeholder="Dementia Care, Post-Surgery"
              value={createForm.specializations}
              onChange={(e) => setCreateForm((f) => ({ ...f, specializations: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel label="Languages Known" note="Comma-separated — used to match bilingual patients" />
            <input className="input-field" placeholder="Telugu, Hindi, English"
              value={createForm.languagesKnown}
              onChange={(e) => setCreateForm((f) => ({ ...f, languagesKnown: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel label="Bio" note="Short professional summary shown to clients (max 500 chars)" />
            <textarea className="input-field h-20 resize-none" maxLength={500}
              value={createForm.bio}
              onChange={(e) => setCreateForm((f) => ({ ...f, bio: e.target.value }))} />
          </div>
        </div>
        {errors.adminCreate && (
          <div className="alert alert-error mt-4 text-sm">{errors.adminCreate}</div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => closeModal("create")} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handleCreate} disabled={loading.adminCreate} className="btn btn-primary btn-sm gap-2">
            {loading.adminCreate ? <Spinner sm /> : <UserPlus className="w-4 h-4" />}
            Create & Send Email
          </button>
        </div>
      </Modal>

      {/* ── DETAIL ─────────────────────────────────────────────── */}
      <Modal open={modal.detail} onClose={() => closeModal("detail")}
        title={selected?.fullName || "Care Assistant Detail"}
        subtitle={`Profile ID: ${selected?._id || "—"}`} wide>
        {loading.adminSingle ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : selected ? (
          <div className="space-y-6">
            {/* Profile header */}
            <div className="flex items-start gap-4 p-4 bg-base-200 rounded-xl border border-base-300">
              <div className="avatar placeholder">
                <div className="w-16 h-16 rounded-2xl">
                  {selected.photoUrl
                    ? <img src={selected.photoUrl} alt={selected.fullName} />
                    : <span className="text-2xl">{selected.fullName?.[0]}</span>
                  }
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-lg font-montserrat">{selected.fullName}</h4>
                <p className="text-xs text-base-content/50">{selected.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge label={selected.kyc?.verificationStatus || "Pending"} variant={kycVariant(selected.kyc?.verificationStatus)} />
                  <Badge label={selected.status || "Offline"} variant={statusVariant(selected.status)} />
                  <Badge label={selected.workType} variant="primary" />
                  {selected.isBlocked && <Badge label="BLOCKED" variant="error" />}
                  {selected.isActive && <Badge label="Active" variant="success" />}
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-primary font-montserrat">
                  {selected.profileCompletionPercent ?? 0}%
                </p>
                <p className="text-xs text-base-content/50">Profile complete</p>
                <div className="progress-bar w-24 mt-1">
                  <div className="progress-bar-fill" style={{ width: `${selected.profileCompletionPercent ?? 0}%` }} />
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {[
                { icon: Phone,     label: "Phone",          value: selected.phone || "—",                         note: "Registered mobile number" },
                { icon: MapPin,    label: "Current City",   value: selected.availability?.currentCity || "—",     note: "Last known city" },
                { icon: Briefcase, label: "Experience",     value: `${selected.experienceYears ?? 0} yrs`,         note: "Total caregiving years" },
                { icon: Star,      label: "Rating",         value: `${selected.performance?.averageRating ?? 5} / 5`, note: "Avg client rating" },
                { icon: Activity,  label: "Tasks Done",     value: selected.performance?.totalTasksCompleted ?? 0, note: "Completed bookings" },
                { icon: Wallet,    label: "Total Earned",   value: `₹${selected.earnings?.totalEarnings ?? 0}`,   note: "Lifetime earnings" },
              ].map(({ icon: Icon, label, value, note }) => (
                <div key={label} className="flex items-start gap-2 p-3 bg-base-200 rounded-lg border border-base-300">
                  <Icon className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-base-content">{value}</p>
                    <p className="text-base-content/50">{label}</p>
                    <p className="text-base-content/30 text-[10px]">{note}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* KYC info */}
            <div className="p-4 bg-base-200 rounded-xl border border-base-300">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h5 className="font-bold text-sm">KYC & Verification</h5>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-base-content/50">KYC Status</p>
                  <Badge label={selected.kyc?.verificationStatus || "Pending"} variant={kycVariant(selected.kyc?.verificationStatus)} />
                  <SectionNote>Set by admin after document review</SectionNote>
                </div>
                <div>
                  <p className="text-base-content/50">Police Verification</p>
                  <Badge label={selected.verification?.policeVerificationStatus || "Pending"} variant={selected.verification?.policeVerificationStatus === "Completed" ? "success" : "warning"} />
                  <SectionNote>Background check completion status</SectionNote>
                </div>
                <div>
                  <p className="text-base-content/50">Aadhaar Verified</p>
                  <p className="font-semibold">{selected.kyc?.aadhaarVerified ? "Yes ✓" : "No"}</p>
                </div>
                <div>
                  <p className="text-base-content/50">Bank Verified</p>
                  <p className="font-semibold">{selected.bankDetails?.isBankVerified ? "Yes ✓" : "No"}</p>
                  <SectionNote>Required for payout processing</SectionNote>
                </div>
              </div>
            </div>

            {/* Certificates */}
            {selected.training?.certificates?.length > 0 && (
              <div className="p-4 bg-base-200 rounded-xl border border-base-300">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-primary" />
                  <h5 className="font-bold text-sm">Training Certificates</h5>
                </div>
                <SectionNote>Manually verify each uploaded certificate below.</SectionNote>
                <div className="space-y-2 mt-2">
                  {selected.training.certificates.map((cert) => (
                    <div key={cert._id} className="flex items-center justify-between p-2 bg-base-100 rounded-lg border border-base-300 text-xs">
                      <div>
                        <p className="font-semibold">{cert.name}</p>
                        <p className="text-base-content/50">{cert.issuedBy || "—"}</p>
                      </div>
                      {cert.isVerified ? (
                        <span className="badge-success badge badge-sm">Verified</span>
                      ) : (
                        <button onClick={() => handleVerifyCert(cert._id)}
                          disabled={loading.adminAction}
                          className="btn btn-success btn-xs gap-1">
                          <BadgeCheck className="w-3 h-3" /> Verify
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-base-300">
              <button onClick={() => openModal("kyc")} className="btn btn-sm btn-outline gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> KYC Action
              </button>
              <button onClick={() => openModal("police")} className="btn btn-sm btn-outline gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Police Verification
              </button>
              <button onClick={() => openModal("perf")} className="btn btn-sm btn-outline gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Update Performance
              </button>
              <button onClick={() => openModal("notes")} className="btn btn-sm btn-outline gap-1.5">
                <StickyNote className="w-3.5 h-3.5" /> Admin Notes
              </button>
              <button onClick={() => openModal("bank")} className="btn btn-sm btn-outline gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Verify Bank
              </button>
              {selected.isBlocked ? (
                <button onClick={() => openModal("unblock")} className="btn btn-sm btn-success gap-1.5">
                  <Unlock className="w-3.5 h-3.5" /> Unblock
                </button>
              ) : (
                <button onClick={() => openModal("block")} className="btn btn-sm btn-error gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Block
                </button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ── KYC ACTION ──────────────────────────────────────────── */}
      <Modal open={modal.kyc} onClose={() => closeModal("kyc")}
        title="KYC Decision"
        subtitle="Approve or reject submitted Aadhaar & PAN documents">
        <div className="space-y-4">
          <div>
            <FieldLabel label="Action *" note="Approve grants full platform access; Reject requires re-submission" />
            <div className="flex gap-3 mt-1">
              {["approve","reject"].map((a) => (
                <label key={a} className="label cursor-pointer gap-2 p-3 border rounded-xl flex-1
                  border-base-300 hover:border-primary/40 transition-colors">
                  <input type="radio" name="kycAction" value={a}
                    checked={kycForm.action === a}
                    onChange={() => setKycForm((f) => ({ ...f, action: a }))}
                    className="accent-primary" />
                  <span className={`label-text capitalize ${a === "approve" ? "text-success" : "text-error"}`}>
                    {a === "approve" ? "✓ Approve" : "✗ Reject"}
                  </span>
                </label>
              ))}
            </div>
          </div>
          {kycForm.action === "reject" && (
            <div>
              <FieldLabel label="Rejection Reason" note="Sent to care assistant via email — be specific about which document failed" />
              <textarea className="input-field h-24 resize-none"
                placeholder="e.g. Aadhaar photo is blurry. Please re-upload a clear scan."
                value={kycForm.rejectionReason}
                onChange={(e) => setKycForm((f) => ({ ...f, rejectionReason: e.target.value }))} />
            </div>
          )}
        </div>
        {errors.adminAction && <div className="alert alert-error mt-3 text-sm">{errors.adminAction}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => closeModal("kyc")} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handleKyc} disabled={loading.adminAction}
            className={`btn btn-sm gap-2 ${kycForm.action === "approve" ? "btn-success" : "btn-error"}`}>
            {loading.adminAction ? <Spinner sm /> : kycForm.action === "approve" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {kycForm.action === "approve" ? "Approve KYC" : "Reject KYC"}
          </button>
        </div>
      </Modal>

      {/* ── POLICE VERIFICATION ─────────────────────────────────── */}
      <Modal open={modal.police} onClose={() => closeModal("police")}
        title="Police / Background Verification"
        subtitle="Update the background check status for this care assistant">
        <div className="space-y-4">
          <div>
            <FieldLabel label="Verification Status *" note="Completed = background check passed and uploaded" />
            <select className="input-field" value={policeForm.status}
              onChange={(e) => setPoliceForm((f) => ({ ...f, status: e.target.value }))}>
              {["Pending","Completed","Rejected"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel label="Document URL" note="Public URL of the uploaded police verification certificate (optional)" />
            <input className="input-field" placeholder="https://…"
              value={policeForm.backgroundCheckUrl}
              onChange={(e) => setPoliceForm((f) => ({ ...f, backgroundCheckUrl: e.target.value }))} />
          </div>
          <div>
            <FieldLabel label="Check Date" note="Date the physical background check was conducted" />
            <input className="input-field" type="date"
              value={policeForm.backgroundCheckDate}
              onChange={(e) => setPoliceForm((f) => ({ ...f, backgroundCheckDate: e.target.value }))} />
          </div>
        </div>
        {errors.adminAction && <div className="alert alert-error mt-3 text-sm">{errors.adminAction}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => closeModal("police")} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handlePolice} disabled={loading.adminAction} className="btn btn-primary btn-sm gap-2">
            {loading.adminAction ? <Spinner sm /> : <Shield className="w-4 h-4" />}
            Update Status
          </button>
        </div>
      </Modal>

      {/* ── BLOCK ─────────────────────────────────────────────────── */}
      <Modal open={modal.block} onClose={() => closeModal("block")}
        title="Suspend Care Assistant"
        subtitle={`This will set ${selected?.fullName}'s status to Suspended and send an email notification.`}>
        <div className="space-y-4">
          <div>
            <FieldLabel label="Block Reason *" note="Visible to the care assistant in the suspension email" />
            <textarea className="input-field h-24 resize-none"
              placeholder="e.g. Multiple client complaints. Pending investigation."
              value={blockForm.blockReason}
              onChange={(e) => setBlockForm((f) => ({ ...f, blockReason: e.target.value }))} />
          </div>
          <div>
            <FieldLabel label="Auto-Unblock Date (optional)" note="Leave blank for indefinite suspension. CA auto-unblocked at this datetime." />
            <input className="input-field" type="datetime-local"
              value={blockForm.unblockAt}
              onChange={(e) => setBlockForm((f) => ({ ...f, unblockAt: e.target.value }))} />
          </div>
        </div>
        {errors.adminAction && <div className="alert alert-error mt-3 text-sm">{errors.adminAction}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => closeModal("block")} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handleBlock} disabled={loading.adminAction || !blockForm.blockReason}
            className="btn btn-error btn-sm gap-2">
            {loading.adminAction ? <Spinner sm /> : <Lock className="w-4 h-4" />}
            Suspend Account
          </button>
        </div>
      </Modal>

      {/* ── UNBLOCK ───────────────────────────────────────────────── */}
      <Modal open={modal.unblock} onClose={() => closeModal("unblock")}
        title="Unblock Care Assistant"
        subtitle={`Restore ${selected?.fullName}'s access. Status will be set to Offline.`}>
        <p className="text-sm text-base-content/70 mb-6">
          Are you sure you want to unblock <strong>{selected?.fullName}</strong>?
          Their account will be restored and they will be able to log in and go online again.
        </p>
        {errors.adminAction && <div className="alert alert-error mb-4 text-sm">{errors.adminAction}</div>}
        <div className="flex justify-end gap-3">
          <button onClick={() => closeModal("unblock")} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handleUnblock} disabled={loading.adminAction} className="btn btn-success btn-sm gap-2">
            {loading.adminAction ? <Spinner sm /> : <Unlock className="w-4 h-4" />}
            Unblock Account
          </button>
        </div>
      </Modal>

      {/* ── PERFORMANCE UPDATE ──────────────────────────────────── */}
      <Modal open={modal.perf} onClose={() => closeModal("perf")}
        title="Update Performance & Earnings"
        subtitle="Manually adjust metrics — normally auto-updated by booking service" wide>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { key: "averageRating",       label: "Average Rating",        note: "0–5 scale; reflects overall client satisfaction",     type: "number", step: "0.1", min: 0, max: 5   },
            { key: "totalTasksCompleted", label: "Tasks Completed",       note: "Cumulative count of successfully completed bookings",  type: "number" },
            { key: "totalEarnings",       label: "Total Earnings (₹)",    note: "Gross lifetime earnings before platform fee deduction",type: "number" },
            { key: "onTimeArrivalRate",   label: "On-Time Arrival (%)",   note: "Percentage of tasks where CA arrived on time",         type: "number", step: "1",   min: 0, max: 100 },
            { key: "repeatClientRate",    label: "Repeat Client Rate (%)", note: "Percentage of bookings from returning clients",        type: "number", step: "1",   min: 0, max: 100 },
            { key: "totalPaid",           label: "Total Paid Out (₹)",    note: "Cumulative amount already disbursed to CA bank account",type:"number" },
            { key: "pendingPayout",       label: "Pending Payout (₹)",    note: "Amount earned but not yet disbursed",                  type: "number" },
          ].map(({ key, label, note, ...rest }) => (
            <div key={key}>
              <FieldLabel label={label} note={note} />
              <input className="input-field" {...rest}
                value={perfForm[key]}
                onChange={(e) => setPerfForm((f) => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
        {errors.adminAction && <div className="alert alert-error mt-3 text-sm">{errors.adminAction}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => closeModal("perf")} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handlePerf} disabled={loading.adminAction} className="btn btn-primary btn-sm gap-2">
            {loading.adminAction ? <Spinner sm /> : <TrendingUp className="w-4 h-4" />}
            Save Performance
          </button>
        </div>
      </Modal>

      {/* ── ADMIN NOTES ─────────────────────────────────────────── */}
      <Modal open={modal.notes} onClose={() => closeModal("notes")}
        title="Admin Notes & Tags"
        subtitle="Internal notes — not visible to the care assistant">
        <div className="space-y-4">
          <div>
            <FieldLabel label="Admin Notes" note="Internal remarks, incident history, or review comments — confidential" />
            <textarea className="input-field h-32 resize-none"
              placeholder="e.g. Flagged for background check follow-up. Client complaint on 2025-01-10 resolved."
              value={notesForm.adminNotes}
              onChange={(e) => setNotesForm((f) => ({ ...f, adminNotes: e.target.value }))} />
          </div>
          <div>
            <FieldLabel label="Tags" note="Comma-separated internal labels — e.g. vip, flagged, new-hire, verified-fast" />
            <input className="input-field" placeholder="vip, flagged, night-shift"
              value={notesForm.tags}
              onChange={(e) => setNotesForm((f) => ({ ...f, tags: e.target.value }))} />
          </div>
        </div>
        {errors.adminAction && <div className="alert alert-error mt-3 text-sm">{errors.adminAction}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => closeModal("notes")} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handleNotes} disabled={loading.adminAction} className="btn btn-primary btn-sm gap-2">
            {loading.adminAction ? <Spinner sm /> : <StickyNote className="w-4 h-4" />}
            Save Notes
          </button>
        </div>
      </Modal>

      {/* ── BANK VERIFY ────────────────────────────────────────── */}
      <Modal open={modal.bank} onClose={() => closeModal("bank")}
        title="Verify Bank Account"
        subtitle="Confirm that bank details have been manually validated before enabling payouts">
        <div className="p-4 bg-base-200 rounded-xl border border-base-300 text-sm space-y-2 mb-4">
          <div className="flex justify-between">
            <span className="text-base-content/60">Account Holder</span>
            <span className="font-semibold">{selected?.bankDetails?.accountHolderName || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Account (last 4)</span>
            <span className="font-semibold font-mono">
              {selected?.bankDetails?.accountLast4 ? `XXXX XXXX ${selected.bankDetails.accountLast4}` : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">IFSC Code</span>
            <span className="font-semibold font-mono">{selected?.bankDetails?.ifscCode || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Bank Name</span>
            <span className="font-semibold">{selected?.bankDetails?.bankName || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">UPI ID</span>
            <span className="font-semibold">{selected?.bankDetails?.upiId || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base-content/60">Currently Verified?</span>
            <span className={`font-bold ${selected?.bankDetails?.isBankVerified ? "text-success" : "text-error"}`}>
              {selected?.bankDetails?.isBankVerified ? "Yes ✓" : "No"}
            </span>
          </div>
        </div>
        <p className="text-xs text-base-content/50 mb-4">
          Marking verified confirms account details match the care assistant's identity documents.
          Required before any payout can be processed.
        </p>
        {errors.adminAction && <div className="alert alert-error mb-3 text-sm">{errors.adminAction}</div>}
        <div className="flex justify-end gap-3">
          <button onClick={() => closeModal("bank")} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={handleBankVerify} disabled={loading.adminAction || selected?.bankDetails?.isBankVerified}
            className="btn btn-success btn-sm gap-2">
            {loading.adminAction ? <Spinner sm /> : <CreditCard className="w-4 h-4" />}
            Mark Bank Verified
          </button>
        </div>
      </Modal>

      {/* ── NEARBY RESULTS ──────────────────────────────────────── */}
      <Modal open={modal.nearby} onClose={() => closeModal("nearby")}
        title={`Nearby Care Assistants (${nearbyCount})`}
        subtitle={`Within ${nearbyForm.radiusKm} km of ${nearbyForm.lat}, ${nearbyForm.lng}`} wide>
        {loading.adminNearby ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : nearby.length === 0 ? (
          <div className="text-center py-10 text-base-content/40">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No available care assistants found in this area.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {nearby.map((ca) => (
              <div key={ca._id} className="flex items-center gap-3 p-3 bg-base-200 rounded-xl border border-base-300">
                <div className="avatar placeholder">
                  <div className="w-10 h-10 rounded-full">
                    {ca.photoUrl
                      ? <img src={ca.photoUrl} alt={ca.fullName} />
                      : <span>{ca.fullName?.[0]}</span>
                    }
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{ca.fullName}</p>
                  <p className="text-xs text-base-content/50">{ca.phone}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ca.specializations?.slice(0, 2).map((s) => (
                      <span key={s} className="badge badge-xs badge-primary">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-warning text-xs font-bold flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-warning" />
                    {ca.performance?.averageRating?.toFixed(1) ?? "—"}
                  </p>
                  <Badge label={ca.status} variant={statusVariant(ca.status)} />
                </div>
                <button onClick={() => { handleViewDetail(ca._id); closeModal("nearby"); }}
                  className="btn btn-ghost btn-xs btn-circle">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

    </div>
  );
}