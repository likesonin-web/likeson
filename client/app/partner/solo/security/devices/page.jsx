"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, History, MonitorSmartphone, KeyRound,
  Smartphone, Laptop, Globe, Trash2, Loader2,
  Shield, AlertTriangle, CheckCircle2, Eye, EyeOff,
  RefreshCw, LogOut, Clock, MapPin, Wifi, Monitor,
  TabletSmartphone, Chrome, Apple, X, ShieldCheck,
  ShieldAlert, AlertCircle, Info
} from "lucide-react";
import {
  fetchSessions,
  revokeSession,
  fetchDevices,
  removeDevice,
  changePassword,
  selectSessions,
  selectDevices,
  selectLoading,
  selectError,
} from "@/store/slices/soloDriverSlice";
import BackButton from "../../../../../components/BackButton";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  }),
};

const SectionCard = ({ title, icon: Icon, description, children, index = 0, action }) => (
  <motion.div
    variants={fadeUp} initial="hidden" animate="visible" custom={index}
    className="card p-6 space-y-5"
  >
    <div className="flex items-center justify-between border-b border-base-300 pb-4">
      <div className="flex items-center gap-3">
        <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-base-content/80">{title}</h2>
          {description && <p className="text-[10px] text-base-content/40 mt-0.5">{description}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </motion.div>
);

// ── Platform Icon ─────────────────────────────────────────────────────────────
const PlatformIcon = ({ platform }) => {
  const icons = {
    android: <Smartphone size={16} className="text-success" />,
    ios:     <Apple size={16} className="text-base-content/60" />,
    web:     <Globe size={16} className="text-info" />,
    desktop: <Monitor size={16} className="text-secondary" />,
  };
  return icons[platform] || <MonitorSmartphone size={16} className="text-base-content/40" />;
};

// ── Time ago ──────────────────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

// ── Password Strength ─────────────────────────────────────────────────────────
const getStrength = (pw) => {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: "Too short",  color: "bg-error"   },
    { label: "Weak",       color: "bg-error"   },
    { label: "Fair",       color: "bg-warning"  },
    { label: "Good",       color: "bg-info"    },
    { label: "Strong",     color: "bg-success"  },
    { label: "Very strong",color: "bg-success"  },
  ];
  return { score, ...map[Math.min(score, map.length - 1)] };
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SecurityPage() {
  const dispatch  = useDispatch();
  const sessions  = useSelector(selectSessions);
  const devices   = useSelector(selectDevices);

  const loadingSessions   = useSelector(selectLoading("sessions"));
  const loadingDevices    = useSelector(selectLoading("devices"));
  const loadingRevoke     = useSelector(selectLoading("revokeSession"));
  const loadingDevice     = useSelector(selectLoading("removeDevice"));
  const loadingPassword   = useSelector(selectLoading("changePassword"));

  // Password form
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError]     = useState("");
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [deviceTarget, setDeviceTarget] = useState(null);

  const strength = getStrength(pwForm.newPassword);

  useEffect(() => {
    dispatch(fetchSessions());
    dispatch(fetchDevices());
  }, [dispatch]);

  // ── Password Change ───────────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    setPwError("");
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("New passwords don't match.");
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (pwForm.currentPassword === pwForm.newPassword) {
      setPwError("New password must differ from current.");
      return;
    }
    try {
      await dispatch(changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword:     pwForm.newPassword,
      })).unwrap();
      setPwSuccess(true);
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (err) {
      setPwError(err || "Password change failed.");
    }
  };

  const handleRevokeSession = (id) => {
    dispatch(revokeSession(id));
    setRevokeTarget(null);
  };

  const handleRemoveDevice = (id) => {
    dispatch(removeDevice(id));
    setDeviceTarget(null);
  };

  const PasswordInput = ({ field, label, placeholder }) => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{label}</label>
      <div className="relative">
        <input
          type={showPw[field] ? "text" : "password"}
          value={pwForm[field]}
          onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))}
          placeholder={placeholder}
          className="input-field w-full pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-primary transition-colors"
        >
          {showPw[field] ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
            <BackButton className=' my-2 rounded-md px-3' />
      
      {/* ── Page Header ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10">
            <Shield size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-base-content">Security Center</h1>
            <p className="text-sm text-base-content/40 mt-0.5">Manage sessions, devices, and password.</p>
          </div>
        </div>
      </motion.div>

      {/* ── Security Score ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={0.5}
        className="rounded-3xl border border-base-300 bg-gradient-to-br from-primary/5 via-base-200 to-secondary/5 p-6"
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            {[
              { icon: ShieldCheck,  label: "Password Set",     ok: true  },
              { icon: Smartphone,   label: "Device Linked",    ok: devices.length > 0 },
              { icon: History,      label: "Session Active",   ok: sessions.length > 0 },
            ].map(({ icon: Icon, label, ok }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon size={16} className={ok ? "text-success" : "text-base-content/30"} />
                <span className={`text-xs font-bold ${ok ? "text-base-content" : "text-base-content/30"}`}>{label}</span>
              </div>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/30 rounded-xl">
            <ShieldCheck size={15} className="text-success" />
            <span className="text-xs font-black text-success uppercase tracking-wide">Account Protected</span>
          </div>
        </div>
      </motion.div>

      {/* ── Change Password ── */}
      <SectionCard
        title="Change Password"
        icon={KeyRound}
        description="Use a strong password with uppercase, numbers, and symbols."
        index={1}
      >
        <div className="grid grid-cols-1 gap-4 max-w-lg">
          <PasswordInput field="current"  label="Current Password *"  placeholder="••••••••" />
          <PasswordInput field="new"      label="New Password *"       placeholder="Min. 8 characters" />

          {/* Strength meter */}
          {pwForm.newPassword && (
            <div className="space-y-1.5">
              <div className="flex gap-1 h-1.5">
                {[1,2,3,4,5].map(i => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all duration-300 ${
                      i <= strength.score ? strength.color : "bg-base-300"
                    }`}
                  />
                ))}
              </div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${
                strength.score >= 4 ? "text-success" : strength.score >= 3 ? "text-warning" : "text-error"
              }`}>
                {strength.label}
              </p>
            </div>
          )}

          <PasswordInput field="confirm" label="Confirm New Password *" placeholder="Repeat new password" />

          {/* Requirements */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { check: pwForm.newPassword.length >= 8,   label: "8+ characters" },
              { check: /[A-Z]/.test(pwForm.newPassword), label: "Uppercase letter" },
              { check: /[0-9]/.test(pwForm.newPassword), label: "Number" },
              { check: /[^A-Za-z0-9]/.test(pwForm.newPassword), label: "Special char" },
            ].map(({ check, label }) => (
              <div key={label} className={`flex items-center gap-1.5 text-[10px] font-bold uppercase ${check ? "text-success" : "text-base-content/30"}`}>
                <CheckCircle2 size={10} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Error / Success */}
        <AnimatePresence>
          {pwError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-bold"
            >
              <AlertCircle size={13} /> {pwError}
            </motion.div>
          )}
          {pwSuccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30 text-success text-xs font-bold"
            >
              <CheckCircle2 size={13} /> Password changed successfully!
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end">
          <button
            onClick={handlePasswordChange}
            disabled={loadingPassword || !pwForm.currentPassword || !pwForm.newPassword}
            className="btn-primary-cta flex items-center gap-2 px-6 py-2.5 text-xs disabled:opacity-60"
          >
            {loadingPassword ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {loadingPassword ? "Updating…" : "Update Password"}
          </button>
        </div>
      </SectionCard>

      {/* ── Active Sessions ── */}
      <SectionCard
        title="Active Sessions"
        icon={History}
        description="Devices currently logged in to your account."
        index={2}
        action={
          <button
            onClick={() => dispatch(fetchSessions())}
            disabled={loadingSessions}
            className="p-2 rounded-xl hover:bg-base-300 text-base-content/40 hover:text-primary transition-all"
          >
            <RefreshCw size={14} className={loadingSessions ? "animate-spin" : ""} />
          </button>
        }
      >
        {loadingSessions && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="spinner" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-center text-base-content/40 py-6">No active sessions found.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session, idx) => (
              <motion.div
                key={session._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-4 rounded-2xl bg-base-200/60 border border-base-300 group hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-base-300">
                    <PlatformIcon platform={session.platform} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-base-content">
                      {session.deviceName || "Unknown Device"}
                      <span className="ml-2 text-[9px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {session.platform}
                      </span>
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[10px] text-base-content/40">
                        <Wifi size={9} /> {session.ipAddress || "—"}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-base-content/40">
                        <Clock size={9} /> {timeAgo(session.lastActiveAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setRevokeTarget(session._id)}
                  disabled={loadingRevoke}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-error text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 hover:bg-error/10 transition-all border border-error/30"
                >
                  <LogOut size={11} /> Revoke
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Registered Devices ── */}
      <SectionCard
        title="Registered Devices"
        icon={MonitorSmartphone}
        description="Devices authorized to receive push notifications."
        index={3}
        action={
          <button
            onClick={() => dispatch(fetchDevices())}
            disabled={loadingDevices}
            className="p-2 rounded-xl hover:bg-base-300 text-base-content/40 hover:text-primary transition-all"
          >
            <RefreshCw size={14} className={loadingDevices ? "animate-spin" : ""} />
          </button>
        }
      >
        {loadingDevices && devices.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="spinner" />
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <MonitorSmartphone size={32} className="mx-auto text-base-content/20" />
            <p className="text-sm text-base-content/40">No devices registered.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device, idx) => (
              <motion.div
                key={device._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-4 rounded-2xl bg-base-200/60 border border-base-300 group hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-base-300">
                    <PlatformIcon platform={device.platform} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-base-content">
                      {device.deviceName || "Unnamed Device"}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[9px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded bg-base-300 text-base-content/50">
                        {device.platform}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-base-content/40">
                        <Clock size={9} /> Last used: {timeAgo(device.lastUsedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDeviceTarget(device._id)}
                  disabled={loadingDevice}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-error text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 hover:bg-error/10 transition-all border border-error/30"
                >
                  <Trash2 size={11} /> Remove
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Tip Box ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={4}
        className="flex items-start gap-3 p-4 rounded-2xl bg-info/10 border border-info/20"
      >
        <Info size={16} className="text-info shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-black text-info uppercase tracking-wide">Security Tip</p>
          <p className="text-xs text-base-content/60">
            If you see a session or device you don't recognise, revoke it immediately and change your password. 
            Always use a unique, strong password — never reuse passwords from other services.
          </p>
        </div>
      </motion.div>

      {/* ── Revoke Session Confirmation ── */}
      <AnimatePresence>
        {revokeTarget && (
          <ConfirmModal
            title="Revoke Session?"
            description="This will immediately sign out the selected device."
            icon={LogOut}
            confirmLabel="Revoke Session"
            confirmClass="bg-error text-white hover:brightness-110"
            onConfirm={() => handleRevokeSession(revokeTarget)}
            onCancel={() => setRevokeTarget(null)}
            loading={loadingRevoke}
          />
        )}
      </AnimatePresence>

      {/* ── Remove Device Confirmation ── */}
      <AnimatePresence>
        {deviceTarget && (
          <ConfirmModal
            title="Remove Device?"
            description="This device will no longer receive push notifications."
            icon={Trash2}
            confirmLabel="Remove Device"
            confirmClass="bg-error text-white hover:brightness-110"
            onConfirm={() => handleRemoveDevice(deviceTarget)}
            onCancel={() => setDeviceTarget(null)}
            loading={loadingDevice}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ title, description, icon: Icon, confirmLabel, confirmClass, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        className="relative w-full max-w-sm bg-base-200 border border-base-300 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="p-2.5 rounded-2xl bg-error/10 text-error">
            <Icon size={18} />
          </span>
          <div>
            <h3 className="font-black text-base-content">{title}</h3>
            <p className="text-xs text-base-content/40">{description}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wide disabled:opacity-50 transition-all ${confirmClass}`}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
            {loading ? "Processing…" : confirmLabel}
          </button>
          <button onClick={onCancel} className="flex-1 btn-secondary text-xs py-2.5">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}