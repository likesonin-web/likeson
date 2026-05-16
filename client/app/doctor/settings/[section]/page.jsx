"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings2, ToggleRight, Bell, ClipboardList, KeyRound,
  ChevronRight, Save, Loader2, CheckCircle2, XCircle,
  Wifi, WifiOff, Moon, Sun, Smartphone, Mail, MessageSquare,
  User, Lock, Eye, EyeOff, Shield, AlertTriangle,
  BookOpen, Star, Clock, Activity, Stethoscope
} from "lucide-react";

import {
  fetchMyDoctorProfile,
  updateDoctorSettings,
  selectMyDoctorProfile,
  selectHospitalLoading,
} from "@/store/slices/hospitalSlice";

// ── Selectors ─────────────────────────────────────────────────────────────────
const selectUploadState = (s) => s.upload;

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR NAV
// ═══════════════════════════════════════════════════════════════════════════════
const links = [
  { name: "Account Settings",     section: "",             icon: Settings2,     color: "from-primary/20 to-primary/5" },
  { name: "Online Status",        section: "online",       icon: ToggleRight,   color: "from-success/20 to-success/5" },
  { name: "Notifications",        section: "notifications",icon: Bell,          color: "from-info/20 to-info/5" },
  { name: "Onboarding Checklist", section: "onboarding",   icon: ClipboardList, color: "from-accent/20 to-accent/5" },
  { name: "Security",             section: "security",     icon: KeyRound,      color: "from-warning/20 to-warning/5" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SectionCard({ title, subtitle, icon: Icon, children, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`card p-4 sm:p-6 ${className}`}
    >
      {(title || subtitle) && (
        <div className="flex items-start gap-3 mb-6">
          {Icon && (
            <div className="p-2 rounded-xl bg-primary/10 shrink-0">
              <Icon size={20} className="text-primary" />
            </div>
          )}
          <div>
            {title && <h3 className="font-semibold text-base-content text-base sm:text-lg leading-tight">{title}</h3>}
            {subtitle && <p className="text-xs sm:text-sm text-base-content/60 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </motion.div>
  );
}

function ToggleSwitch({ checked, onChange, label, description, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-xs sm:text-sm text-base-content">{label}</p>
        {description && <p className="text-[11px] sm:text-xs text-base-content/50 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
          checked ? "bg-primary" : "bg-base-300"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SaveButton({ loading, onClick, label = "Save Changes" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="btn-primary-cta flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto px-4 py-2.5 sm:py-2"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
      <span className="text-xs sm:text-sm font-semibold">{loading ? "Saving…" : label}</span>
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    verified:     { label: "Verified",    cls: "badge badge-success text-xs" },
    pending:      { label: "Pending",     cls: "badge badge-warning text-xs" },
    rejected:     { label: "Rejected",    cls: "badge badge-error text-xs" },
    "not-submitted": { label: "Not Submitted", cls: "badge badge-info text-xs" },
    "under-review":  { label: "Under Review",  cls: "badge badge-warning text-xs" },
  };
  const cfg = map[status] || { label: status, cls: "badge text-xs" };
  return <span className={`${cfg.cls} text-xs px-2 py-1`}>{cfg.label}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: ACCOUNT SETTINGS (default / index)
// ═══════════════════════════════════════════════════════════════════════════════
function AccountSettings({ profile }) {
  const stats = profile?.stats || {};
  const meta = [
    { label: "Specialization",    value: profile?.specialization || "—",   icon: Stethoscope },
    { label: "Partnership Status",value: profile?.partnershipStatus || "—", icon: Star },
    { label: "KYC Status",        value: <StatusBadge status={profile?.kycStatus || "not-submitted"} />, icon: Shield },
    { label: "Settlement Cycle",  value: profile?.settlementCycle || "monthly", icon: Clock },
    { label: "Profile Complete",  value: `${profile?.profileCompletionPercent || 0}%`, icon: Activity },
    { label: "Total Consultations",value: stats.totalConsultations || 0, icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Profile completion */}
      <SectionCard title="Profile Overview" subtitle="Your account at a glance" icon={User}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {meta.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-base-200/60">
              <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                <Icon size={14} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-base-content/50 uppercase tracking-wide font-bold">{label}</p>
                <div className="font-semibold text-xs sm:text-sm text-base-content truncate mt-0.5">{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Completion bar */}
        <div className="mt-5">
          <div className="flex justify-between text-xs text-base-content/60 mb-1.5">
            <span className="text-xs">Profile Completion</span>
            <span className="font-bold text-primary text-xs">{profile?.profileCompletionPercent || 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-base-300 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${profile?.profileCompletionPercent || 0}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </SectionCard>

      {/* Doctor stats */}
      <SectionCard title="Performance Metrics" subtitle="Lifetime statistics" icon={Activity}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Consultations",   value: stats.totalConsultations || 0,      color: "text-primary" },
            { label: "Home Visits",     value: stats.totalHomeVisits || 0,          color: "text-success" },
            { label: "Video Sessions",  value: stats.totalVideoConsultations || 0,  color: "text-info" },
            { label: "Total Earnings",  value: `\u20B9${(stats.totalEarnings || 0).toLocaleString()}`, color: "text-accent" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-3 sm:p-4 rounded-xl bg-base-200/50 min-w-0">
              <p className={`text-lg sm:text-2xl font-extrabold ${color} font-montserrat truncate`}>{value}</p>
              <p className="text-[11px] sm:text-xs text-base-content/50 mt-1 font-medium truncate">{label}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: ONLINE STATUS
// ═══════════════════════════════════════════════════════════════════════════════
function OnlineStatus({ profile, doctorId, dispatch }) {
  const loading = useSelector(selectHospitalLoading);
  const [isOnline, setIsOnline] = useState(profile?.isOnline ?? false);

  useEffect(() => { setIsOnline(profile?.isOnline ?? false); }, [profile]);

  const handleSave = async () => {
    await dispatch(updateDoctorSettings({ id: doctorId, isOnline }));
    dispatch(fetchMyDoctorProfile());
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Online Status" subtitle="Control your availability to patients" icon={Wifi}>
        {/* Big visual toggle */}
        <div className="flex flex-col items-center gap-6 py-4 sm:py-6">
          <motion.div
            animate={{ scale: isOnline ? [1, 1.05, 1] : 1 }}
            transition={{ repeat: isOnline ? Infinity : 0, duration: 2 }}
            className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center shadow-lg shrink-0 ${
              isOnline
                ? "bg-success/10 shadow-success/30 border-2 border-success"
                : "bg-base-300 border-2 border-base-300"
            }`}
          >
            {isOnline
              ? <Wifi size={40} className="text-success" />
              : <WifiOff size={40} className="text-base-content/30" />
            }
          </motion.div>

          <div className="text-center">
            <p className={`text-xl sm:text-2xl font-extrabold font-montserrat ${isOnline ? "text-success" : "text-base-content/40"}`}>
              {isOnline ? "ONLINE" : "OFFLINE"}
            </p>
            <p className="text-xs sm:text-sm text-base-content/50 mt-1 px-2">
              {isOnline ? "Patients can see and book you" : "You are hidden from patients"}
            </p>
          </div>

          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`relative w-20 h-10 rounded-full transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              isOnline ? "bg-success" : "bg-base-300"
            }`}
          >
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`absolute top-1 w-8 h-8 rounded-full bg-white shadow-md ${
                isOnline ? "left-11" : "left-1"
              }`}
            />
          </button>
        </div>

        <div className="border-t border-base-300 pt-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-info/5 border border-info/20">
            <AlertTriangle size={16} className="text-info shrink-0 mt-0.5" />
            <p className="text-xs text-base-content/70 leading-relaxed">
              Setting yourself offline will hide your profile from new patient bookings.
              Existing appointments will not be affected.
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <SaveButton loading={loading.updateDoctorSettings} onClick={handleSave} />
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
function Notifications({ profile, doctorId, dispatch }) {
  const loading = useSelector(selectHospitalLoading);
  const [prefs, setPrefs] = useState({
    sms:      profile?.notifPrefs?.sms      ?? true,
    email:    profile?.notifPrefs?.email    ?? true,
    push:     profile?.notifPrefs?.push     ?? true,
    whatsapp: profile?.notifPrefs?.whatsapp ?? true,
  });

  useEffect(() => {
    if (profile?.notifPrefs) setPrefs(profile.notifPrefs);
  }, [profile]);

  const toggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    await dispatch(updateDoctorSettings({ id: doctorId, notifPrefs: prefs }));
    dispatch(fetchMyDoctorProfile());
  };

  const channels = [
    { key: "sms",      label: "SMS Notifications",      description: "Appointment reminders via text message",  icon: Smartphone },
    { key: "email",    label: "Email Notifications",     description: "Booking confirmations and updates",       icon: Mail },
    { key: "push",     label: "Push Notifications",      description: "Real-time alerts on your device",         icon: Bell },
    { key: "whatsapp", label: "WhatsApp Notifications",  description: "Messages via WhatsApp",                  icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      <SectionCard title="Notification Channels" subtitle="Choose how you receive alerts" icon={Bell}>
        <div className="divide-y divide-base-300">
          {channels.map(({ key, label, description, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 ${prefs[key] ? "bg-primary/10" : "bg-base-200"}`}>
                  <Icon size={16} className={prefs[key] ? "text-primary" : "text-base-content/30"} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm text-base-content truncate">{label}</p>
                  <p className="text-[11px] sm:text-xs text-base-content/50 mt-0.5 truncate sm:whitespace-normal">{description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggle(key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  prefs[key] ? "bg-primary" : "bg-base-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                    prefs[key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-base-300">
          <div className="flex gap-4 justify-center sm:justify-start">
            <button
              onClick={() => setPrefs({ sms: true, email: true, push: true, whatsapp: true })}
              className="text-xs text-primary font-bold hover:underline"
            >
              <span className="text-xs">Enable All</span>
            </button>
            <button
              onClick={() => setPrefs({ sms: false, email: false, push: false, whatsapp: false })}
              className="text-xs text-base-content/50 font-bold hover:underline"
            >
              <span className="text-xs">Disable All</span>
            </button>
          </div>
          <div className="w-full sm:w-auto">
            <SaveButton loading={loading.updateDoctorSettings} onClick={handleSave} />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════════
function Onboarding({ profile, doctorId, dispatch }) {
  const loading = useSelector(selectHospitalLoading);
  const [onboarding, setOnboarding] = useState({
    step:        profile?.onboarding?.step        ?? 1,
    isComplete:  profile?.onboarding?.isComplete  ?? false,
    completedAt: profile?.onboarding?.completedAt ?? null,
    agreedToTermsAt: profile?.onboarding?.agreedToTermsAt ?? null,
  });

  useEffect(() => {
    if (profile?.onboarding) setOnboarding(profile.onboarding);
  }, [profile]);

  const steps = [
    { step: 1, label: "Account Created",       description: "Basic account and credentials set up" },
    { step: 2, label: "Profile Information",   description: "Specialization, qualifications, and bio added" },
    { step: 3, label: "Hospital Affiliation",  description: "Linked to primary hospital" },
    { step: 4, label: "KYC Submitted",         description: "Aadhaar and PAN documents uploaded" },
    { step: 5, label: "Bank Details",          description: "Settlement bank account added" },
    { step: 6, label: "Availability Set",      description: "Consultation schedule configured" },
    { step: 7, label: "Partnership Active",    description: "Account approved and activated" },
  ];

  const markComplete = async () => {
    const updated = { ...onboarding, isComplete: true, completedAt: new Date().toISOString() };
    setOnboarding(updated);
    await dispatch(updateDoctorSettings({ id: doctorId, onboarding: updated }));
    dispatch(fetchMyDoctorProfile());
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Onboarding Progress" subtitle="Complete all steps to activate your account" icon={ClipboardList}>
        {/* Progress header */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-base-200/50 mb-6">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="var(--base-300)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="14" fill="none"
                stroke="var(--primary)" strokeWidth="3"
                strokeDasharray={`${(onboarding.step / 7) * 87.96} 87.96`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-primary font-montserrat">
              {onboarding.step}/7
            </span>
          </div>
          <div>
            <p className="font-bold text-sm sm:text-base text-base-content">Step {onboarding.step} of 7</p>
            <p className="text-xs sm:text-sm text-base-content/60 mt-0.5">
              {onboarding.isComplete ? "Onboarding complete \uD83C\uDF89" : "Keep going \u2014 you're almost there!"}
            </p>
            {onboarding.completedAt && (
              <p className="text-[11px] sm:text-xs text-success mt-1 font-medium">
                Completed {new Date(onboarding.completedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Steps timeline */}
        <div className="space-y-2">
          {steps.map(({ step, label, description }) => {
            const done = step < onboarding.step || onboarding.isComplete;
            const active = step === onboarding.step && !onboarding.isComplete;
            return (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: step * 0.05 }}
                className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                  active ? "bg-primary/5 border border-primary/20" : "hover:bg-base-200/40"
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                  done    ? "bg-success text-success-content" :
                  active  ? "bg-primary text-primary-content" :
                            "bg-base-300 text-base-content/40"
                }`}>
                  {done ? <CheckCircle2 size={14} /> : <span className="text-xs font-bold">{step}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold text-xs sm:text-sm ${done ? "text-success" : active ? "text-primary" : "text-base-content/50"}`}>
                    {label}
                  </p>
                  <p className="text-[11px] sm:text-xs text-base-content/40 mt-0.5 leading-relaxed">{description}</p>
                </div>
                {active && (
                  <span className="ml-2 badge badge-primary text-[10px] sm:text-xs px-2 py-0.5 shrink-0">Current</span>
                )}
              </motion.div>
            );
          })}
        </div>

        {!onboarding.isComplete && (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mt-6 pt-4 border-t border-base-300">
            <button
              onClick={() => setOnboarding((p) => ({ ...p, step: Math.max(1, p.step - 1) }))}
              disabled={onboarding.step <= 1}
              className="btn-secondary text-xs font-semibold px-4 py-2.5 sm:py-2 disabled:opacity-30 w-full sm:w-auto text-center"
            >
              <span className="text-xs">Previous Step</span>
            </button>
            <div className="w-full sm:w-auto">
              {onboarding.step < 7 ? (
                <button
                  onClick={async () => {
                    const updated = { ...onboarding, step: onboarding.step + 1 };
                    setOnboarding(updated);
                    await dispatch(updateDoctorSettings({ id: doctorId, onboarding: updated }));
                  }}
                  className="btn-primary-cta text-xs font-semibold px-4 py-2.5 sm:py-2 w-full text-center"
                >
                  <span className="text-xs">Mark Step Done</span>
                </button>
              ) : (
                <button
                  onClick={markComplete}
                  disabled={loading.updateDoctorSettings}
                  className="btn-success text-xs font-semibold px-4 py-2.5 sm:py-2 flex items-center justify-center gap-2 w-full"
                >
                  {loading.updateDoctorSettings ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span className="text-xs">Complete Onboarding</span>
                </button>
              )}
            </div>
          </div>
        )}

        {onboarding.isComplete && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-success/10 border border-success/20">
            <CheckCircle2 size={18} className="text-success shrink-0" />
            <p className="text-xs sm:text-sm text-success font-semibold">
              Onboarding complete! Your account is fully active.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: SECURITY
// ═══════════════════════════════════════════════════════════════════════════════
function Security({ profile }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [strength, setStrength] = useState(0);

  const checkStrength = (pwd) => {
    let s = 0;
    if (pwd.length >= 8)             s++;
    if (/[A-Z]/.test(pwd))          s++;
    if (/[0-9]/.test(pwd))          s++;
    if (/[^A-Za-z0-9]/.test(pwd))   s++;
    setStrength(s);
  };

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColor = ["", "bg-error", "bg-warning", "bg-info", "bg-success"];

  const securityItems = [
    { label: "KYC Status",        value: profile?.kycStatus || "not-submitted",  type: "badge" },
    { label: "Registration No.",  value: profile?.registrationNumber || "Not set" },
    { label: "Partnership",       value: profile?.partnershipStatus || "Pending" },
    { label: "Bank Verified",     value: profile?.bankDetails?.isBankVerified ? "Yes" : "No" },
  ];

  return (
    <div className="space-y-6">
      {/* Security overview */}
      <SectionCard title="Security Overview" subtitle="Your account security snapshot" icon={Shield}>
        <div className="grid grid-cols-2 gap-3">
          {securityItems.map(({ label, value, type }) => (
            <div key={label} className="p-3 rounded-xl bg-base-200/50 min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-base-content/50 uppercase tracking-wide mb-1 truncate">{label}</p>
              {type === "badge" ? (
                <div className="mt-0.5">
                  <StatusBadge status={value} />
                </div>
              ) : (
                <p className="font-semibold text-xs sm:text-sm text-base-content truncate mt-0.5">{value}</p>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Change password */}
      <SectionCard title="Change Password" subtitle="Update your login credentials" icon={Lock}>
        <div className="space-y-4">
          {/* Current */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold mb-1.5 text-base-content">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                placeholder="Enter current password"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                className="input-field w-full pr-10 text-xs sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content p-1"
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold mb-1.5 text-base-content">New Password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                placeholder="Enter new password"
                value={form.newPassword}
                onChange={(e) => { setForm({ ...form, newPassword: e.target.value }); checkStrength(e.target.value); }}
                className="input-field w-full pr-10 text-xs sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content p-1"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        i <= strength ? strengthColor[strength] : "bg-base-300"
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-[11px] sm:text-xs font-bold ${["", "text-error", "text-warning", "text-info", "text-success"][strength]}`}>
                  {strengthLabel[strength]} password
                </p>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold mb-1.5 text-base-content">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter new password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="input-field w-full pr-10 text-xs sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content p-1"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.confirmPassword && form.newPassword !== form.confirmPassword && (
              <p className="text-xs text-error mt-1.5 flex items-center gap-1 font-medium">
                <XCircle size={12} /> <span className="text-xs">Passwords do not match</span>
              </p>
            )}
            {form.confirmPassword && form.newPassword === form.confirmPassword && (
              <p className="text-xs text-success mt-1.5 flex items-center gap-1 font-medium">
                <CheckCircle2 size={12} /> <span className="text-xs">Passwords match</span>
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              disabled={!form.currentPassword || !form.newPassword || form.newPassword !== form.confirmPassword}
              className="btn-primary-cta flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto px-4 py-2.5 sm:py-2 font-semibold"
            >
              <Lock size={16} /> <span>Update Password</span>
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function SettingsManagement() {
  const params    = useParams();
  const router    = useRouter();
  const pathname  = usePathname();
  const dispatch  = useDispatch();

  const profile   = useSelector(selectMyDoctorProfile);
  const loading   = useSelector(selectHospitalLoading);

  const section   = params?.section || "";

  useEffect(() => {
    dispatch(fetchMyDoctorProfile());
  }, [dispatch]);

  const activeLink = links.find((l) => l.section === section) || links[0];
  const doctorId   = profile?._id;

  const sectionMap = {
    "":             <AccountSettings profile={profile} />,
    online:         <OnlineStatus    profile={profile} doctorId={doctorId} dispatch={dispatch} />,
    notifications:  <Notifications   profile={profile} doctorId={doctorId} dispatch={dispatch} />,
    onboarding:     <Onboarding      profile={profile} doctorId={doctorId} dispatch={dispatch} />,
    security:       <Security        profile={profile} />,
  };

  return (
    <div className="min-h-screen bg-base-100">
      {/* Page header */}
      <div className="border-b border-base-300 bg-base-100 sticky top-0 z-30">
        <div className="container-custom py-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 shrink-0">
              <Settings2 size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold font-montserrat text-base-content tracking-tight truncate">
                Settings
              </h1>
              <p className="text-[11px] sm:text-xs text-base-content/50 truncate">
                Manage your doctor account preferences
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-custom w-full py-4 sm:py-6 px-4 sm:px-6">
        <div className="flex flex-col md:flex-row w-full gap-4 md:gap-6">
          
          {/* Sidebar - Desktop Only Layout */}
          <aside className="hidden md:flex flex-col gap-1 w-56 shrink-0">
            {links.map(({ name, section: sec, icon: Icon }) => {
              const isActive = sec === section;
              return (
                <button
                  key={sec}
                  onClick={() => router.push(`/doctor/settings${sec ? `/${sec}` : ""}`)}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left ${
                    isActive
                      ? "bg-primary text-primary-content shadow-md shadow-primary/20"
                      : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate text-sm">{name}</span>
                  {isActive && (
                    <ChevronRight size={14} className="ml-auto shrink-0" />
                  )}
                </button>
              );
            })}
          </aside>

          {/* Mobile Horizontal Navigation Tab Bar - Mobile Only Layout */}
          <div className="block md:hidden w-full mb-2">
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none snap-x">
              {links.map(({ name, section: sec, icon: Icon }) => {
                const isActive = sec === section;
                return (
                  <button
                    key={sec}
                    onClick={() => router.push(`/doctor/settings${sec ? `/${sec}` : ""}`)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all snap-start ${
                      isActive
                        ? "bg-primary text-primary-content shadow-sm"
                        : "bg-base-200 text-base-content/70"
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="text-xs">{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content Viewports Pane */}
          <main className="flex-1 min-w-0 w-full">
            {loading.fetchMyDoctorProfile && !profile ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="spinner w-8 h-8" />
                  <p className="text-xs sm:text-sm text-base-content/50">Loading your profile…</p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={section}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                  className="w-full"
                >
                  {sectionMap[section] ?? (
                    <div className="card p-8 text-center">
                      <p className="text-xs sm:text-sm text-base-content/50">Section not found.</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}