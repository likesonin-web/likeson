"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  User, Mail, Phone, MapPin, Globe, Building2, FlaskConical,
  BadgeCheck, ShieldCheck, Clock3, Star, Edit3, Save, X,
  Upload, Camera, Eye, EyeOff, AlertCircle, CheckCircle2,
  ChevronRight, Loader2, CreditCard, FileText, Lock,
  Bell, BellOff, Settings, Microscope, TestTube2, Package,
  Activity, TrendingUp, Award, Layers, RefreshCw, Trash2,
  LogOut, Shield, Smartphone, Monitor, Tablet, Info,
  ChevronDown, ChevronUp, ExternalLink, Copy, Check,
} from "lucide-react";

// ── Redux thunks & selectors ───────────────────────────────────────────────
import {
  fetchPartnerProfile,
  updatePartnerProfile,
  updatePartnerBankDetails,
  fetchPartnerAccreditations,
  addPartnerAccreditation,
  addPartnerComplianceDoc,
  fetchPartnerStatusLog,
  fetchPartnerSessions,
  revokePartnerSession,
  revokeAllPartnerSessions,
  fetchPartnerLoginHistory,
  changePartnerPassword,
  requestPartnerEmailChange,
  confirmPartnerEmailChange,
  sendPartnerVerificationOtp,
  verifyPartnerEmail,
  updatePartnerNotificationPreferences,
  updatePartnerContactPersons,
  updatePartnerImages,
  fetchPartnerSettings,
  fetchPartnerDashboard,
  selectPartnerProfile,
  selectPartnerAccreditations,
  selectPartnerComplianceDocs,
  selectPartnerStatusLog,
  selectPartnerSessions,
  selectPartnerLoginHistory,
  selectPartnerSettings,
  selectPartnerDashboard,
  selectLabLoading,
  selectLabActionLoading,
  selectLabError,
} from "@/store/slices/labSlice";

// ═══════════════════════════════════════════════════════════════════════════
//  ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1], delay: i * 0.07 },
  }),
};

const slideIn = {
  hidden: { opacity: 0, x: -16 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.94 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] } },
};

// ═══════════════════════════════════════════════════════════════════════════
//  SMALL REUSABLE ATOMS
// ═══════════════════════════════════════════════════════════════════════════

function SectionCard({ title, subtitle, icon: Icon, children, className = "", action }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className={`card p-0 overflow-hidden ${className}`}
    >
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--base-300)", background: "var(--base-200)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "color-mix(in oklch, var(--primary), transparent 84%)" }}
          >
            <Icon size={16} style={{ color: "var(--primary)" }} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="font-montserrat font-black text-sm tracking-tight"
              style={{ color: "var(--base-content)", lineHeight: 1.2 }}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  );
}

function Field({ label, value, icon: Icon, editable = false, type = "text", onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
        {label}
      </label>
      {editable ? (
        <div className="relative">
          {Icon && (
            <Icon size={14} strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}
            />
          )}
          <input
            type={type}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`input-field w-full text-sm ${Icon ? "pl-9" : ""}`}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
          style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
          {Icon && <Icon size={13} strokeWidth={2} style={{ color: "var(--primary)", flexShrink: 0 }} />}
          <span className="text-sm truncate"
            style={{ color: value ? "var(--base-content)" : "color-mix(in oklch, var(--base-content) 35%, transparent)" }}>
            {value || "—"}
          </span>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    approved:     { label: "Approved",     cls: "badge-success" },
    pending:      { label: "Pending",      cls: "badge-warning" },
    under_review: { label: "Under Review", cls: "badge-info"    },
    suspended:    { label: "Suspended",    cls: "badge-error"   },
    rejected:     { label: "Rejected",     cls: "badge-error"   },
    deactivated:  { label: "Deactivated",  cls: "badge-warning" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "badge-primary" };
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Spinner({ size = 16 }) {
  return (
    <Loader2 size={size} strokeWidth={2.2}
      className="animate-spin"
      style={{ color: "var(--primary)" }}
    />
  );
}

function CopyText({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-all"
      style={{
        background: copied
          ? "color-mix(in oklch, var(--success), transparent 85%)"
          : "color-mix(in oklch, var(--primary), transparent 90%)",
        color: copied ? "var(--success)" : "var(--primary)",
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  TAB DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: "overview",       label: "Overview",       icon: User        },
  { id: "profile",        label: "Lab Profile",    icon: FlaskConical },
  { id: "bank",           label: "Bank & Payout",  icon: CreditCard  },
  { id: "accreditations", label: "Documents",      icon: FileText    },
  { id: "notifications",  label: "Notifications",  icon: Bell        },
  { id: "security",       label: "Security",       icon: Shield      },
];

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function MyProfile() {
  const dispatch     = useDispatch();
  const user         = useSelector((s) => s.user?.user) ?? null;
  const profile      = useSelector(selectPartnerProfile);
  const accreditations = useSelector(selectPartnerAccreditations);
  const complianceDocs = useSelector(selectPartnerComplianceDocs);
  const statusLog    = useSelector(selectPartnerStatusLog);
  const sessions     = useSelector(selectPartnerSessions);
  const loginHistory = useSelector(selectPartnerLoginHistory);
  const settings     = useSelector(selectPartnerSettings);
  const dashboard    = useSelector(selectPartnerDashboard);
  const loading      = useSelector(selectLabLoading);
  const actionLoading = useSelector(selectLabActionLoading);
  const error        = useSelector(selectLabError);

  const [activeTab,  setActiveTab]  = useState("overview");
  const [editMode,   setEditMode]   = useState(false);
  const logoInputRef    = useRef(null);
  const coverInputRef   = useRef(null);

  // ── Edit form state ────────────────────────────────────────────────────
  const [form, setForm] = useState({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [emailChangeForm, setEmailChangeForm] = useState({ newEmail: "", otp: "" });
  const [emailChangeStep, setEmailChangeStep] = useState(0); // 0=idle 1=otp-sent 2=done
  const [verifyOtpInput, setVerifyOtpInput] = useState("");
  const [contactPersons, setContactPersons] = useState([]);
  const [notifPrefs, setNotifPrefs] = useState({});
  const [bankForm, setBankForm] = useState({});
  const [accForm, setAccForm]  = useState({ body: "", certificateNo: "", issuedOn: "", validUntil: "" });
  const [compForm, setCompForm] = useState({ docType: "", docNumber: "", issuedOn: "", validUntil: "", remarks: "" });
  const [accFile,  setAccFile]  = useState(null);
  const [compFile, setCompFile] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);

  // ── Initial data fetches ───────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchPartnerProfile());
    dispatch(fetchPartnerDashboard());
    dispatch(fetchPartnerSettings());
    dispatch(fetchPartnerAccreditations());
    dispatch(fetchPartnerStatusLog());
    dispatch(fetchPartnerSessions());
    dispatch(fetchPartnerLoginHistory());
  }, [dispatch]);

  // ── Sync form when profile loads ───────────────────────────────────────
  useEffect(() => {
    if (profile) {
      setForm({
        description:          profile.description ?? "",
        websiteUrl:           profile.websiteUrl  ?? "",
        avgTurnaroundHours:   profile.avgTurnaroundHours ?? "",
        homeCollectionRadius: profile.homeCollectionRadius ?? 0,
        homeCollectionFee:    profile.homeCollectionFee ?? 0,
        sampleCollectionMode: profile.sampleCollectionMode ?? "Both",
      });
      setContactPersons(profile.contactPersons ?? []);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.bankDetails) {
      setBankForm({
        accountHolderName: profile.bankDetails.accountHolderName ?? "",
        ifscCode:          profile.bankDetails.ifscCode ?? "",
        bankName:          profile.bankDetails.bankName ?? "",
        branchName:        profile.bankDetails.branchName ?? "",
        accountType:       profile.bankDetails.accountType ?? "Current",
        upiId:             profile.bankDetails.upiId ?? "",
      });
    }
  }, [profile?.bankDetails]);

  useEffect(() => {
    if (settings?.notifications) setNotifPrefs(settings.notifications);
  }, [settings]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSaveProfile = useCallback(() => {
    dispatch(updatePartnerProfile({ ...form })).then((r) => {
      if (!r.error) setEditMode(false);
    });
  }, [dispatch, form]);

  const handleSaveBank = useCallback(() => {
    dispatch(updatePartnerBankDetails(bankForm));
  }, [dispatch, bankForm]);

  const handleSaveContactPersons = useCallback(() => {
    dispatch(updatePartnerContactPersons(contactPersons));
  }, [dispatch, contactPersons]);

  const handleSaveNotifications = useCallback(() => {
    dispatch(updatePartnerNotificationPreferences(notifPrefs));
  }, [dispatch, notifPrefs]);

  const handleChangePassword = useCallback(() => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return;
    dispatch(changePartnerPassword({
      currentPassword: passwordForm.currentPassword,
      newPassword:     passwordForm.newPassword,
    })).then((r) => {
      if (!r.error) setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    });
  }, [dispatch, passwordForm]);

  const handleRequestEmailChange = useCallback(() => {
    dispatch(requestPartnerEmailChange(emailChangeForm.newEmail)).then((r) => {
      if (!r.error) setEmailChangeStep(1);
    });
  }, [dispatch, emailChangeForm.newEmail]);

  const handleConfirmEmailChange = useCallback(() => {
    dispatch(confirmPartnerEmailChange({ newEmail: emailChangeForm.newEmail, otp: emailChangeForm.otp })).then((r) => {
      if (!r.error) { setEmailChangeStep(2); dispatch(fetchPartnerProfile()); }
    });
  }, [dispatch, emailChangeForm]);

  const handleSendVerifyOtp = useCallback(() => {
    dispatch(sendPartnerVerificationOtp());
  }, [dispatch]);

  const handleVerifyEmail = useCallback(() => {
    dispatch(verifyPartnerEmail(verifyOtpInput)).then((r) => {
      if (!r.error) { dispatch(fetchPartnerProfile()); setVerifyOtpInput(""); }
    });
  }, [dispatch, verifyOtpInput]);

  const handleAddAccreditation = useCallback(() => {
    const fd = { ...accForm };
    if (accFile) fd.certificate = accFile;
    dispatch(addPartnerAccreditation(fd)).then((r) => {
      if (!r.error) { setAccForm({ body: "", certificateNo: "", issuedOn: "", validUntil: "" }); setAccFile(null); }
    });
  }, [dispatch, accForm, accFile]);

  const handleAddComplianceDoc = useCallback(() => {
    const fd = { ...compForm };
    if (compFile) fd.document = compFile;
    dispatch(addPartnerComplianceDoc(fd)).then((r) => {
      if (!r.error) { setCompForm({ docType: "", docNumber: "", issuedOn: "", validUntil: "", remarks: "" }); setCompFile(null); }
    });
  }, [dispatch, compForm, compFile]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) dispatch(updatePartnerImages({ logo: file }));
  };

  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) dispatch(updatePartnerImages({ coverImage: file }));
  };

  const handleRevokeSession = (sessionId) => dispatch(revokePartnerSession(sessionId));
  const handleRevokeAll     = ()           => dispatch(revokeAllPartnerSessions());

  const addContactPerson = () =>
    setContactPersons((prev) => [...prev, { name: "", designation: "", phone: "", email: "", isPrimary: false }]);

  const removeContactPerson = (i) =>
    setContactPersons((prev) => prev.filter((_, idx) => idx !== i));

  const updateContactPerson = (i, field, value) =>
    setContactPersons((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));

  // ═══════════════════════════════════════════════════════════════════════
  //  TAB PANELS
  // ═══════════════════════════════════════════════════════════════════════

  // ── OVERVIEW ────────────────────────────────────────────────────────────
  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Profile header card */}
      <motion.div variants={fadeUp} initial="hidden" animate="show"
        className="card p-0 overflow-hidden">
        {/* Cover */}
        <div className="relative h-36 sm:h-48 overflow-hidden group"
          style={{ background: "var(--bg-gradient-primary)" }}>
          {profile?.coverImageUrl && (
            <img src={profile.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "rgba(0,0,0,0.35)" }}>
            <button onClick={() => coverInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)" }}>
              <Camera size={13} /> Update Cover
            </button>
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        </div>

        {/* Avatar + info */}
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 sm:-mt-12 mb-4">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-4 shadow-lg"
                style={{
                  borderColor: "var(--base-100)",
                  background: "var(--bg-gradient-primary)",
                  boxShadow: "0 8px 24px color-mix(in oklch, var(--primary), transparent 55%)",
                }}>
                {profile?.logoUrl || user?.avatar ? (
                  <img src={profile?.logoUrl ?? user?.avatar} alt={profile?.labName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Microscope size={28} color="white" strokeWidth={1.5} />
                  </div>
                )}
              </div>
              <button onClick={() => logoInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow transition-transform hover:scale-110"
                style={{ background: "var(--primary)", color: "var(--primary-content)" }}>
                <Camera size={12} />
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0 pt-2 sm:pt-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="font-montserrat font-black text-xl truncate"
                  style={{ color: "var(--base-content)" }}>
                  {profile?.labName ?? user?.name ?? "Lab Partner"}
                </h2>
                {profile?.isVerified && (
                  <BadgeCheck size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {profile?.status && <StatusBadge status={profile.status} />}
                {profile?.labCode && (
                  <div className="flex items-center gap-1">
                    <span className="badge badge-primary">{profile.labCode}</span>
                    <CopyText text={profile.labCode} />
                  </div>
                )}
                {profile?.labType && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: "color-mix(in oklch, var(--secondary), transparent 85%)",
                      color: "var(--secondary)",
                    }}>
                    {profile.labType}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick info row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { icon: Mail,    val: user?.email,                          label: "Email"    },
              { icon: Phone,   val: user?.phone,                          label: "Phone"    },
              { icon: MapPin,  val: profile?.registeredAddress?.city
                             ? `${profile.registeredAddress.city}, ${profile.registeredAddress.state}`
                             : null,                                      label: "Location" },
            ].map(({ icon: Icon, val, label }) => (
              <div key={label} className="flex items-center gap-2 p-3 rounded-xl"
                style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
                <Icon size={13} strokeWidth={2} style={{ color: "var(--primary)", flexShrink: 0 }} />
                <span className="text-xs truncate"
                  style={{ color: val ? "var(--base-content)" : "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>
                  {val ?? `No ${label}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Dashboard stats */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Tests",    value: dashboard.tests?.active    ?? 0, icon: TestTube2,  },
            { label: "Packages",        value: dashboard.packages?.active ?? 0, icon: Package,    },
            { label: "Avg Rating",      value: dashboard.rating?.average  ?? "—", icon: Star,    },
            { label: "Total Reviews",   value: dashboard.rating?.total    ?? 0, icon: TrendingUp, },
          ].map(({ label, value, icon: Icon }, i) => (
            <motion.div key={label} variants={fadeUp} custom={i} initial="hidden" animate="show"
              className="stat-card flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="stat-card-label">{label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "color-mix(in oklch, var(--primary), transparent 86%)" }}>
                  <Icon size={14} style={{ color: "var(--primary)" }} strokeWidth={2} />
                </div>
              </div>
              <span className="stat-card-value">{value}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Email verification alert */}
      {user && !user.isEmailVerified && (
        <motion.div variants={scaleIn} initial="hidden" animate="show"
          className="alert alert-warning flex-col sm:flex-row items-start sm:items-center gap-3">
          <AlertCircle size={16} style={{ color: "var(--warning)", flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Email not verified</p>
            <p className="text-xs mt-0.5" style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>
              Verify your email to unlock full platform features.
            </p>
          </div>
          <button onClick={handleSendVerifyOtp}
            className="btn-primary-cta text-xs px-4 py-2 flex-shrink-0"
            disabled={actionLoading}>
            {actionLoading ? <Spinner size={13} /> : "Verify Now"}
          </button>
        </motion.div>
      )}

      {/* Status log */}
      {statusLog?.length > 0 && (
        <SectionCard title="Account Status History" icon={Activity}
          subtitle={`${statusLog.length} status change${statusLog.length !== 1 ? "s" : ""}`}>
          <div className="space-y-2">
            {statusLog.slice().reverse().slice(0, 5).map((log, i) => (
              <div key={log._id ?? i}
                className="flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer"
                style={{ background: i === 0 ? "color-mix(in oklch, var(--primary), transparent 92%)" : "var(--base-200)" }}
                onClick={() => setExpandedLog(expandedLog === i ? null : i)}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: i === 0 ? "var(--primary)" : "var(--base-300)" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold" style={{ color: "var(--base-content)" }}>
                      {log.fromStatus} → {log.toStatus}
                    </span>
                    {i === 0 && <span className="badge badge-primary text-[10px]">Latest</span>}
                  </div>
                  {expandedLog === i && log.reason && (
                    <p className="text-xs mt-1" style={{ color: "color-mix(in oklch, var(--base-content) 65%, transparent)" }}>
                      {log.reason}
                    </p>
                  )}
                </div>
                <span className="text-xs flex-shrink-0"
                  style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
                  {log.changedAt ? new Date(log.changedAt).toLocaleDateString("en-IN") : "—"}
                </span>
                {log.reason && (
                  expandedLog === i ? <ChevronUp size={12} style={{ color: "var(--primary)" }} /> : <ChevronDown size={12} style={{ color: "var(--primary)" }} />
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );

  // ── LAB PROFILE EDIT ────────────────────────────────────────────────────
  const ProfileTab = () => (
    <div className="space-y-6">
      <SectionCard title="Lab Information" icon={Building2}
        subtitle="Update your public-facing lab details"
        action={
          editMode ? (
            <div className="flex gap-2">
              <button onClick={() => setEditMode(false)}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                <X size={12} /> Cancel
              </button>
              <button onClick={handleSaveProfile}
                disabled={actionLoading}
                className="btn-primary-cta text-xs px-3 py-1.5 flex items-center gap-1.5">
                {actionLoading ? <Spinner size={12} /> : <Save size={12} />} Save
              </button>
            </div>
          ) : (
            <button onClick={() => setEditMode(true)}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
              <Edit3 size={12} /> Edit
            </button>
          )
        }>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
              style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
              Description
            </label>
            {editMode ? (
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className="input-field w-full text-sm resize-none"
                placeholder="Describe your laboratory..."
              />
            ) : (
              <p className="text-sm leading-relaxed px-3 py-2.5 rounded-lg"
                style={{ background: "var(--base-200)", border: "1px solid var(--base-300)", color: "var(--base-content)" }}>
                {form.description || "No description provided."}
              </p>
            )}
          </div>

          <Field label="Website URL" icon={Globe} value={form.websiteUrl}
            editable={editMode} onChange={(v) => setForm((p) => ({ ...p, websiteUrl: v }))}
            placeholder="https://yourlab.com" />

          <Field label="Avg. Turnaround (hrs)" icon={Clock3} value={form.avgTurnaroundHours}
            type="number" editable={editMode}
            onChange={(v) => setForm((p) => ({ ...p, avgTurnaroundHours: v }))}
            placeholder="24" />

          <Field label="Home Collection Radius (km)" icon={MapPin} value={form.homeCollectionRadius}
            type="number" editable={editMode}
            onChange={(v) => setForm((p) => ({ ...p, homeCollectionRadius: v }))}
            placeholder="10" />

          <Field label="Home Collection Fee (₹)" icon={CreditCard} value={form.homeCollectionFee}
            type="number" editable={editMode}
            onChange={(v) => setForm((p) => ({ ...p, homeCollectionFee: v }))}
            placeholder="0" />

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
              style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
              Sample Collection Mode
            </label>
            {editMode ? (
              <select className="input-field w-full text-sm"
                value={form.sampleCollectionMode}
                onChange={(e) => setForm((p) => ({ ...p, sampleCollectionMode: e.target.value }))}>
                {["Walk-in", "Home Collection", "Both"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
                <TestTube2 size={13} style={{ color: "var(--primary)" }} />
                <span className="text-sm">{form.sampleCollectionMode || "—"}</span>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Readonly lab identity */}
      <SectionCard title="Lab Identity" icon={FlaskConical} subtitle="Set by admin — contact support to update">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Lab Name",         val: profile?.labName,             icon: Building2    },
            { label: "Lab Code",         val: profile?.labCode,             icon: Layers       },
            { label: "Lab Type",         val: profile?.labType,             icon: FlaskConical },
            { label: "Ownership",        val: profile?.ownershipType,       icon: Award        },
            { label: "Reg. Number",      val: profile?.registrationNumber,  icon: FileText     },
            { label: "Established Year", val: profile?.establishedYear,     icon: Activity     },
          ].map(({ label, val, icon: Icon }) => (
            <Field key={label} label={label} value={val?.toString()} icon={Icon} editable={false} />
          ))}
        </div>
      </SectionCard>

      {/* Contact persons */}
      <SectionCard title="Contact Persons" icon={User}
        subtitle="Lab director, operations head, etc."
        action={
          <div className="flex gap-2">
            <button onClick={addContactPerson}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
              + Add
            </button>
            <button onClick={handleSaveContactPersons} disabled={actionLoading}
              className="btn-primary-cta text-xs px-3 py-1.5 flex items-center gap-1.5">
              {actionLoading ? <Spinner size={12} /> : <Save size={12} />} Save
            </button>
          </div>
        }>
        {contactPersons.length === 0 ? (
          <p className="text-sm text-center py-6"
            style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>
            No contact persons added yet.
          </p>
        ) : (
          <div className="space-y-4">
            {contactPersons.map((cp, i) => (
              <motion.div key={i} variants={slideIn} initial="hidden" animate="show"
                className="p-4 rounded-xl"
                style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "var(--primary)" }}>
                    Person {i + 1} {cp.isPrimary ? "• Primary" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer"
                      style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>
                      <input type="checkbox" checked={cp.isPrimary}
                        onChange={(e) => updateContactPerson(i, "isPrimary", e.target.checked)}
                        className="w-3 h-3 accent-[var(--primary)]" />
                      Primary
                    </label>
                    <button onClick={() => removeContactPerson(i)}
                      className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                      style={{ background: "color-mix(in oklch, var(--error), transparent 85%)", color: "var(--error)" }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {["name", "designation", "phone", "email"].map((field) => (
                    <input key={field} type={field === "email" ? "email" : "text"}
                      className="input-field text-sm"
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={cp[field] ?? ""}
                      onChange={(e) => updateContactPerson(i, field, e.target.value)}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );

  // ── BANK & PAYOUT ────────────────────────────────────────────────────────
  const BankTab = () => (
    <SectionCard title="Bank & Payout Details" icon={CreditCard}
      subtitle="All financial information is encrypted and secure"
      action={
        <button onClick={handleSaveBank} disabled={actionLoading}
          className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5">
          {actionLoading ? <Spinner size={12} /> : <Save size={12} />} Save
        </button>
      }>
      {profile?.bankDetails?.isVerified && (
        <div className="alert alert-success mb-5 text-sm">
          <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0 }} />
          Bank details verified by admin.
        </div>
      )}
      {!profile?.bankDetails?.isVerified && profile?.bankDetails?.accountHolderName && (
        <div className="alert alert-warning mb-5 text-sm">
          <AlertCircle size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />
          Bank details pending admin verification.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {[
          { field: "accountHolderName", label: "Account Holder Name",    icon: User,       placeholder: "John Doe"         },
          { field: "bankName",          label: "Bank Name",               icon: Building2,  placeholder: "State Bank"        },
          { field: "ifscCode",          label: "IFSC Code",               icon: FileText,   placeholder: "SBIN0001234"       },
          { field: "branchName",        label: "Branch Name",             icon: MapPin,     placeholder: "Main Branch"       },
          { field: "upiId",             label: "UPI ID",                  icon: CreditCard, placeholder: "name@upi"          },
        ].map(({ field, label, icon, placeholder }) => (
          <Field key={field} label={label} icon={icon}
            value={bankForm[field]} editable
            placeholder={placeholder}
            onChange={(v) => setBankForm((p) => ({ ...p, [field]: v }))}
          />
        ))}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
            style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
            Account Type
          </label>
          <select className="input-field w-full text-sm"
            value={bankForm.accountType ?? "Current"}
            onChange={(e) => setBankForm((p) => ({ ...p, accountType: e.target.value }))}>
            <option value="Savings">Savings</option>
            <option value="Current">Current</option>
          </select>
        </div>
      </div>
      <div className="mt-4 p-3 rounded-xl text-xs flex items-start gap-2"
        style={{ background: "color-mix(in oklch, var(--info), transparent 90%)", color: "var(--info)" }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        Account number can only be set through admin for security reasons. Contact support to update.
      </div>
    </SectionCard>
  );

  // ── DOCUMENTS ────────────────────────────────────────────────────────────
  const DocumentsTab = () => (
    <div className="space-y-6">
      {/* Accreditations list */}
      <SectionCard title="Accreditations" icon={Award}
        subtitle={`${accreditations?.length ?? 0} certificate${accreditations?.length !== 1 ? "s" : ""}`}>
        {accreditations?.length === 0 || !accreditations ? (
          <p className="text-sm text-center py-4"
            style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>
            No accreditations uploaded.
          </p>
        ) : (
          <div className="space-y-3">
            {accreditations.map((acc, i) => (
              <div key={acc._id ?? i}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: acc.isVerified
                      ? "color-mix(in oklch, var(--success), transparent 85%)"
                      : "color-mix(in oklch, var(--warning), transparent 85%)" }}>
                    {acc.isVerified
                      ? <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                      : <Clock3 size={14} style={{ color: "var(--warning)" }} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--base-content)" }}>
                      {acc.body}
                    </p>
                    <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                      {acc.certificateNo ? `No: ${acc.certificateNo}` : ""}
                      {acc.validUntil ? ` • Valid till ${new Date(acc.validUntil).toLocaleDateString("en-IN")}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {acc.isVerified ? (
                    <span className="badge badge-success">Verified</span>
                  ) : (
                    <span className="badge badge-warning">Pending</span>
                  )}
                  {acc.documentUrl && (
                    <a href={acc.documentUrl} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: "color-mix(in oklch, var(--primary), transparent 88%)", color: "var(--primary)" }}>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add accreditation form */}
        <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--base-300)" }}>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: "var(--primary)" }}>
            Add New Accreditation
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                Body *
              </label>
              <select className="input-field w-full text-sm"
                value={accForm.body}
                onChange={(e) => setAccForm((p) => ({ ...p, body: e.target.value }))}>
                <option value="">Select body</option>
                {["NABL", "CAP", "ISO", "NABH", "JCI", "Other"].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <input className="input-field text-sm" placeholder="Certificate No."
              value={accForm.certificateNo}
              onChange={(e) => setAccForm((p) => ({ ...p, certificateNo: e.target.value }))} />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                Issued On
              </label>
              <input type="date" className="input-field w-full text-sm"
                value={accForm.issuedOn}
                onChange={(e) => setAccForm((p) => ({ ...p, issuedOn: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                Valid Until
              </label>
              <input type="date" className="input-field w-full text-sm"
                value={accForm.validUntil}
                onChange={(e) => setAccForm((p) => ({ ...p, validUntil: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                Certificate File (PDF/Image)
              </label>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer border-2 border-dashed transition-colors hover:border-primary"
                style={{ borderColor: "color-mix(in oklch, var(--primary), transparent 65%)" }}>
                <Upload size={14} style={{ color: "var(--primary)" }} />
                <span className="text-sm" style={{ color: accFile ? "var(--base-content)" : "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
                  {accFile ? accFile.name : "Upload certificate"}
                </span>
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => setAccFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
          <button onClick={handleAddAccreditation} disabled={!accForm.body || actionLoading}
            className="btn-primary-cta mt-4 flex items-center gap-2 disabled:opacity-50">
            {actionLoading ? <Spinner size={13} /> : <Upload size={13} />}
            Submit Accreditation
          </button>
        </div>
      </SectionCard>

      {/* Compliance docs */}
      <SectionCard title="Compliance Documents" icon={FileText}
        subtitle={`${complianceDocs?.length ?? 0} document${complianceDocs?.length !== 1 ? "s" : ""}`}>
        {complianceDocs?.length === 0 || !complianceDocs ? (
          <p className="text-sm text-center py-4"
            style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>
            No compliance documents uploaded.
          </p>
        ) : (
          <div className="space-y-3">
            {complianceDocs.map((doc, i) => (
              <div key={doc._id ?? i}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--base-content)" }}>
                      {doc.docType?.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                      {doc.docNumber ?? ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {doc.isVerified
                    ? <span className="badge badge-success">Verified</span>
                    : <span className="badge badge-warning">Pending</span>}
                  {doc.documentUrl && (
                    <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: "color-mix(in oklch, var(--primary), transparent 88%)", color: "var(--primary)" }}>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add compliance doc form */}
        <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--base-300)" }}>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "var(--primary)" }}>
            Add Compliance Document
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                Document Type *
              </label>
              <select className="input-field w-full text-sm"
                value={compForm.docType}
                onChange={(e) => setCompForm((p) => ({ ...p, docType: e.target.value }))}>
                <option value="">Select type</option>
                {[
                  "Lab_Registration_Certificate","PCB_NOC","Bio_Medical_Waste_License",
                  "Drug_License","GSTIN_Certificate","PAN_Card","Trade_License","MSME_Certificate","Other",
                ].map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <input className="input-field text-sm" placeholder="Document Number"
              value={compForm.docNumber}
              onChange={(e) => setCompForm((p) => ({ ...p, docNumber: e.target.value }))} />
            <input className="input-field text-sm" placeholder="Remarks (optional)"
              value={compForm.remarks}
              onChange={(e) => setCompForm((p) => ({ ...p, remarks: e.target.value }))} />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                Issued On
              </label>
              <input type="date" className="input-field w-full text-sm"
                value={compForm.issuedOn}
                onChange={(e) => setCompForm((p) => ({ ...p, issuedOn: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                Valid Until
              </label>
              <input type="date" className="input-field w-full text-sm"
                value={compForm.validUntil}
                onChange={(e) => setCompForm((p) => ({ ...p, validUntil: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer border-2 border-dashed"
                style={{ borderColor: "color-mix(in oklch, var(--primary), transparent 65%)" }}>
                <Upload size={14} style={{ color: "var(--primary)" }} />
                <span className="text-sm" style={{ color: compFile ? "var(--base-content)" : "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
                  {compFile ? compFile.name : "Upload document (PDF/Image)"}
                </span>
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => setCompFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
          <button onClick={handleAddComplianceDoc} disabled={!compForm.docType || actionLoading}
            className="btn-primary-cta mt-4 flex items-center gap-2 disabled:opacity-50">
            {actionLoading ? <Spinner size={13} /> : <Upload size={13} />}
            Submit Document
          </button>
        </div>
      </SectionCard>
    </div>
  );

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  const NotificationsTab = () => {
    const prefs = [
      { key: "emailOnNewBooking",    label: "New Booking",     sub: "Get notified when a new booking is placed",        icon: Bell    },
      { key: "emailOnCancellation",  label: "Cancellation",    sub: "Alert when a booking is cancelled",                icon: BellOff },
      { key: "emailOnReview",        label: "New Review",      sub: "Notify when a customer leaves a review",           icon: Star    },
      { key: "emailOnStatusChange",  label: "Account Status",  sub: "Updates on your account approval or suspension",   icon: Activity},
      { key: "smsOnNewBooking",      label: "SMS for Bookings",sub: "Receive SMS alerts for new bookings",               icon: Smartphone},
    ];
    return (
      <SectionCard title="Notification Preferences" icon={Bell}
        subtitle="Control how and when you receive alerts"
        action={
          <button onClick={handleSaveNotifications} disabled={actionLoading}
            className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5">
            {actionLoading ? <Spinner size={12} /> : <Save size={12} />} Save
          </button>
        }>
        <div className="space-y-3">
          {prefs.map(({ key, label, sub, icon: Icon }) => (
            <div key={key}
              className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer"
              style={{
                background: notifPrefs[key]
                  ? "color-mix(in oklch, var(--primary), transparent 92%)"
                  : "var(--base-200)",
                border: `1px solid ${notifPrefs[key]
                  ? "color-mix(in oklch, var(--primary), transparent 72%)"
                  : "var(--base-300)"}`,
              }}
              onClick={() => setNotifPrefs((p) => ({ ...p, [key]: !p[key] }))}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: notifPrefs[key]
                      ? "color-mix(in oklch, var(--primary), transparent 80%)"
                      : "var(--base-300)",
                  }}>
                  <Icon size={14} style={{ color: notifPrefs[key] ? "var(--primary)" : "color-mix(in oklch, var(--base-content) 45%, transparent)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--base-content)" }}>{label}</p>
                  <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>{sub}</p>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0`}
                style={{ background: notifPrefs[key] ? "var(--primary)" : "var(--base-300)" }}>
                <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: notifPrefs[key] ? "calc(100% - 1.35rem)" : "0.125rem" }} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  };

  // ── SECURITY ─────────────────────────────────────────────────────────────
  const SecurityTab = () => (
    <div className="space-y-6">
      {/* Change password */}
      <SectionCard title="Change Password" icon={Lock} subtitle="Use a strong, unique password">
        <div className="space-y-4 max-w-md">
          {[
            { field: "currentPassword", label: "Current Password", key: "current" },
            { field: "newPassword",      label: "New Password",     key: "new"     },
            { field: "confirmPassword",  label: "Confirm Password", key: "confirm" },
          ].map(({ field, label, key }) => (
            <div key={field}>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5"
                style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                {label}
              </label>
              <div className="relative">
                <Lock size={13} strokeWidth={2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
                <input
                  type={showPasswords[key] ? "text" : "password"}
                  className="input-field w-full text-sm pl-9 pr-10"
                  value={passwordForm[field]}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, [field]: e.target.value }))}
                  placeholder="••••••••"
                />
                <button type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}
                  onClick={() => setShowPasswords((p) => ({ ...p, [key]: !p[key] }))}>
                  {showPasswords[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}
          {passwordForm.newPassword && passwordForm.confirmPassword &&
            passwordForm.newPassword !== passwordForm.confirmPassword && (
            <p className="text-xs" style={{ color: "var(--error)" }}>Passwords do not match.</p>
          )}
          <button
            onClick={handleChangePassword}
            disabled={actionLoading || !passwordForm.currentPassword || !passwordForm.newPassword ||
              passwordForm.newPassword !== passwordForm.confirmPassword}
            className="btn-primary-cta flex items-center gap-2 disabled:opacity-50">
            {actionLoading ? <Spinner size={13} /> : <Lock size={13} />}
            Update Password
          </button>
        </div>
      </SectionCard>

      {/* Email change */}
      <SectionCard title="Change Email" icon={Mail}
        subtitle={`Current: ${user?.email ?? "—"}`}>
        <div className="max-w-md space-y-4">
          {emailChangeStep === 0 && (
            <>
              <Field label="New Email Address" icon={Mail}
                value={emailChangeForm.newEmail} editable
                placeholder="newemail@lab.com"
                onChange={(v) => setEmailChangeForm((p) => ({ ...p, newEmail: v }))} />
              <button onClick={handleRequestEmailChange}
                disabled={!emailChangeForm.newEmail || actionLoading}
                className="btn-primary-cta flex items-center gap-2 disabled:opacity-50">
                {actionLoading ? <Spinner size={13} /> : <Mail size={13} />}
                Send OTP to Current Email
              </button>
            </>
          )}
          {emailChangeStep === 1 && (
            <>
              <div className="alert alert-info text-sm">
                <Info size={14} style={{ color: "var(--info)", flexShrink: 0 }} />
                OTP sent to your current email. Enter it below to confirm.
              </div>
              <Field label="Enter OTP" icon={ShieldCheck}
                value={emailChangeForm.otp} editable
                placeholder="6-digit OTP"
                onChange={(v) => setEmailChangeForm((p) => ({ ...p, otp: v }))} />
              <div className="flex gap-2">
                <button onClick={handleConfirmEmailChange}
                  disabled={!emailChangeForm.otp || actionLoading}
                  className="btn-primary-cta flex items-center gap-2 disabled:opacity-50">
                  {actionLoading ? <Spinner size={13} /> : <CheckCircle2 size={13} />}
                  Confirm Change
                </button>
                <button onClick={() => setEmailChangeStep(0)} className="btn-secondary">
                  Back
                </button>
              </div>
            </>
          )}
          {emailChangeStep === 2 && (
            <div className="alert alert-success text-sm">
              <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0 }} />
              Email changed successfully! Please verify your new email.
            </div>
          )}
        </div>
      </SectionCard>

      {/* Email verification */}
      {user && !user.isEmailVerified && (
        <SectionCard title="Verify Email" icon={BadgeCheck} subtitle="Confirm your email address">
          <div className="max-w-md space-y-4">
            <div className="alert alert-warning text-sm">
              <AlertCircle size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />
              Your email is not verified. Verification is required for full platform access.
            </div>
            <button onClick={handleSendVerifyOtp} disabled={actionLoading}
              className="btn-secondary flex items-center gap-2">
              {actionLoading ? <Spinner size={13} /> : <Mail size={13} />}
              Send Verification OTP
            </button>
            <div className="flex gap-3">
              <Field label="Enter OTP" icon={ShieldCheck}
                value={verifyOtpInput} editable
                placeholder="6-digit OTP"
                onChange={setVerifyOtpInput} />
              <button onClick={handleVerifyEmail} disabled={!verifyOtpInput || actionLoading}
                className="btn-primary-cta flex items-center gap-2 mt-5 disabled:opacity-50">
                {actionLoading ? <Spinner size={13} /> : <CheckCircle2 size={13} />}
                Verify
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Active sessions */}
      <SectionCard title="Active Sessions" icon={Smartphone}
        subtitle={`${sessions?.length ?? 0} active session${sessions?.length !== 1 ? "s" : ""}`}
        action={
          sessions?.length > 1 && (
            <button onClick={handleRevokeAll} disabled={actionLoading}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              style={{ color: "var(--error)", borderColor: "var(--error)" }}>
              <LogOut size={12} /> Revoke All Others
            </button>
          )
        }>
        {!sessions?.length ? (
          <p className="text-sm text-center py-4"
            style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>
            No active sessions found.
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s, i) => {
              const DeviceIcon = s.platform === "ios" || s.platform === "android"
                ? Smartphone
                : s.platform === "desktop" ? Monitor : Tablet;
              return (
                <div key={s._id ?? i}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "color-mix(in oklch, var(--primary), transparent 86%)" }}>
                      <DeviceIcon size={14} style={{ color: "var(--primary)" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--base-content)" }}>
                        {s.deviceName ?? "Unknown Device"}
                      </p>
                      <p className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                        {s.ipAddress ?? "—"} · {s.platform}
                        {s.lastActiveAt ? ` · ${new Date(s.lastActiveAt).toLocaleDateString("en-IN")}` : ""}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleRevokeSession(s._id)}
                    disabled={actionLoading}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors flex-shrink-0"
                    style={{
                      background: "color-mix(in oklch, var(--error), transparent 88%)",
                      color: "var(--error)",
                    }}>
                    Revoke
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Login history */}
      {loginHistory && (
        <SectionCard title="Login History" icon={Activity}
          subtitle={`Last ${loginHistory.recentSessions?.length ?? 0} sessions`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {[
              { label: "Total Logins", val: loginHistory.loginCount ?? 0 },
              { label: "Last Login",   val: loginHistory.lastLoginAt ? new Date(loginHistory.lastLoginAt).toLocaleDateString("en-IN") : "—" },
              { label: "Last IP",      val: loginHistory.lastLoginIp ?? "—" },
            ].map(({ label, val }) => (
              <div key={label} className="stat-card">
                <p className="stat-card-label">{label}</p>
                <p className="stat-card-value text-base">{val}</p>
              </div>
            ))}
          </div>
          {loginHistory.recentSessions?.length > 0 && (
            <div className="space-y-2">
              {loginHistory.recentSessions.slice(0, 8).map((s, i) => (
                <div key={s._id ?? i}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: "var(--base-200)" }}>
                  <span className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}>
                    {s.deviceName ?? "Unknown"} — {s.ipAddress ?? "—"}
                  </span>
                  <span className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
                    {s.createdAt ? new Date(s.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════

  const tabContent = {
    overview:       <OverviewTab />,
    profile:        <ProfileTab />,
    bank:           <BankTab />,
    accreditations: <DocumentsTab />,
    notifications:  <NotificationsTab />,
    security:       <SecurityTab />,
  };

  return (
    <div data-theme="lab" className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <div className="container-custom max-w-7xl py-8">

        {/* Page title */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-2 mb-1" style={{ color: "color-mix(in oklch, var(--base-content) 45%, transparent)" }}>
            <Link href="/lab/dashboard" className="text-xs hover:underline no-underline">Dashboard</Link>
            <ChevronRight size={12} />
            <span className="text-xs">My Profile</span>
          </div>
          <h1 className="font-montserrat font-black text-2xl md:text-3xl"
            style={{ color: "var(--base-content)" }}>
            My Profile
          </h1>
          <p className="text-sm mt-1" style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
            Manage your lab account, documents, and security settings.
          </p>
        </motion.div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div variants={scaleIn} initial="hidden" animate="show" exit="hidden"
              className="alert alert-error mb-6 text-sm">
              <AlertCircle size={14} style={{ color: "var(--error)", flexShrink: 0 }} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* Sidebar tabs — desktop */}
          <motion.nav variants={fadeUp} custom={1} initial="hidden" animate="show"
            className="hidden lg:flex flex-col gap-1 w-56 flex-shrink-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all font-medium text-sm"
                style={{
                  background: activeTab === id
                    ? "color-mix(in oklch, var(--primary), transparent 86%)"
                    : "transparent",
                  color: activeTab === id
                    ? "var(--primary)"
                    : "color-mix(in oklch, var(--base-content) 65%, transparent)",
                  borderLeft: activeTab === id ? "3px solid var(--primary)" : "3px solid transparent",
                }}>
                <Icon size={15} strokeWidth={activeTab === id ? 2.4 : 2} />
                {label}
              </button>
            ))}
          </motion.nav>

          {/* Mobile tabs — horizontal scroll */}
          <div className="lg:hidden overflow-x-auto pb-1">
            <div className="flex gap-2 w-max">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all"
                  style={{
                    background: activeTab === id
                      ? "var(--primary)"
                      : "color-mix(in oklch, var(--primary), transparent 90%)",
                    color: activeTab === id
                      ? "var(--primary-content)"
                      : "var(--primary)",
                  }}>
                  <Icon size={13} strokeWidth={2.2} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Main panel */}
          <div className="flex-1 min-w-0">
            {loading && !profile ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="spinner w-10 h-10 animate-spin" />
                <p className="text-sm" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
                  Loading your profile…
                </p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {tabContent[activeTab]}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}