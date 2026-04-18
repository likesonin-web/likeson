"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserRound,
  Smartphone,
  KeyRound,
  ChevronRight,
  Camera,
  Save,
  LogOut,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Monitor,
  Tablet,
  Globe,
  Clock,
  Bell,
  Mail,
  MessageSquare,
  Phone,
  Lock,
  RefreshCw,
  X,
} from "lucide-react";

import {
  fetchAccountSettings,
  updateAccountSettings,
  uploadAvatar,
  fetchSessions,
  revokeSession,
  revokeAllOtherSessions,
  changePassword,
  updateNotificationPreferences,
  isLoading,
  getError,
  selectAccount,
  selectSessions,
  selectNotifPrefs,
} from "@/store/slices/hospitalManagerSlice";

// ─── Nav Links ────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  {
    name: "Account Details",
    href: "/hospital-manager/settings/account",
    section: "account",
    icon: UserRound,
  },
  {
    name: "Active Sessions",
    href: "/hospital-manager/security/sessions",
    section: "sessions",
    icon: Smartphone,
  },
  {
    name: "Security & Password",
    href: "/hospital-manager/security/password",
    section: "password",
    icon: KeyRound,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getActiveSection = (pathname) => {
  if (pathname?.includes("/security/sessions")) return "sessions";
  if (pathname?.includes("/security/password")) return "password";
  return "account";
};

const getPlatformIcon = (platform) => {
  const p = platform?.toLowerCase();
  if (p === "android" || p === "ios") return Smartphone;
  if (p === "desktop") return Monitor;
  return Globe;
};

const formatDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function AccountSection({ dispatch }) {
  const account = useSelector(selectAccount);
  const loading = useSelector(isLoading({ typePrefix: "hospitalManager/fetchAccountSettings" }));
  const saving = useSelector(isLoading({ typePrefix: "hospitalManager/updateAccountSettings" }));
  const avatarLoading = useSelector(isLoading({ typePrefix: "hospitalManager/uploadAvatar" }));

  const [form, setForm] = useState({ name: "", phone: "" });
  const [avatarPreview, setAvatarPreview] = useState(null);

  useEffect(() => {
    dispatch(fetchAccountSettings());
  }, [dispatch]);

  useEffect(() => {
    if (account) {
      setForm({ name: account.name || "", phone: account.phone || "" });
    }
  }, [account]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append("avatar", file);
    dispatch(uploadAvatar(fd));
  };

  const handleSave = () => {
    dispatch(updateAccountSettings({ name: form.name, phone: form.phone }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[color:var(--primary)]" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-8"
    >
      {/* Avatar */}
      <div className="flex items-center gap-6">
        <div className="relative group">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[color:var(--base-300)] shadow-lg">
            <img
              src={avatarPreview || account?.avatar || "https://ui-avatars.com/api/?name=HM&background=random"}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <label
            htmlFor="avatar-upload"
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity duration-200"
          >
            {avatarLoading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-[color:var(--base-content)]">
            {account?.name || "Hospital Manager"}
          </p>
          <p className="text-xs text-[color:var(--base-content)] opacity-50 mt-0.5">
            {account?.email}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {account?.isEmailVerified && (
              <span className="badge badge-success text-[10px]">
                <CheckCircle2 size={10} /> Email Verified
              </span>
            )}
            {account?.isPhoneVerified && (
              <span className="badge badge-success text-[10px]">
                <CheckCircle2 size={10} /> Phone Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { label: "Full Name", key: "name", type: "text", placeholder: "Dr. Aarav Sharma" },
          { label: "Phone Number", key: "phone", type: "tel", placeholder: "+91 98765 43210" },
        ].map(({ label, key, type, placeholder }) => (
          <div key={key} className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-[color:var(--base-content)] opacity-60">
              {label}
            </label>
            <input
              type={type}
              value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder}
              className="input-field w-full"
            />
          </div>
        ))}

        {/* Read-only email */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-[color:var(--base-content)] opacity-60">
            Email Address
          </label>
          <div className="input-field flex items-center gap-2 opacity-60 cursor-not-allowed">
            <Mail size={14} className="text-[color:var(--primary)] shrink-0" />
            <span className="text-sm truncate">{account?.email || "—"}</span>
            <Lock size={12} className="ml-auto shrink-0" />
          </div>
          <p className="text-[10px] text-[color:var(--base-content)] opacity-40">
            Email changes require OTP verification via support.
          </p>
        </div>

        {/* Role chip */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-[color:var(--base-content)] opacity-60">
            Role
          </label>
          <div className="input-field flex items-center gap-2 opacity-60 cursor-not-allowed">
            <Shield size={14} className="text-[color:var(--primary)] shrink-0" />
            <span className="text-sm capitalize">{account?.role || "hospital"}</span>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary-cta flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Sessions Section ─────────────────────────────────────────────────────────

function SessionsSection({ dispatch }) {
  const sessions = useSelector(selectSessions);
  const loading = useSelector(isLoading({ typePrefix: "hospitalManager/fetchSessions" }));
  const [revoking, setRevoking] = useState(null);

  useEffect(() => {
    dispatch(fetchSessions());
  }, [dispatch]);

  const handleRevoke = async (id) => {
    setRevoking(id);
    await dispatch(revokeSession(id));
    setRevoking(null);
  };

  const handleRevokeAll = () => dispatch(revokeAllOtherSessions());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[color:var(--primary)]" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[color:var(--base-content)] opacity-60">
            {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
        {sessions.filter((s) => !s.isCurrent).length > 0 && (
          <button
            onClick={handleRevokeAll}
            className="btn-secondary flex items-center gap-2 text-xs py-2 px-4"
          >
            <LogOut size={14} />
            Revoke All Others
          </button>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {sessions.map((session, i) => {
            const PlatformIcon = getPlatformIcon(session.platform);
            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12, height: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`card p-4 flex items-center gap-4 ${
                  session.isCurrent
                    ? "border-[color:var(--primary)] bg-[color:var(--base-200)]"
                    : ""
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    session.isCurrent
                      ? "bg-[color:var(--primary)] text-[color:var(--primary-content)]"
                      : "bg-[color:var(--base-300)] text-[color:var(--base-content)]"
                  }`}
                >
                  <PlatformIcon size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--base-content)] truncate">
                      {session.deviceName || "Unknown Device"}
                    </p>
                    {session.isCurrent && (
                      <span className="badge badge-success text-[10px] shrink-0">Current</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[11px] text-[color:var(--base-content)] opacity-50 flex items-center gap-1">
                      <Globe size={10} />
                      {session.ipAddress || "—"}
                    </span>
                    <span className="text-[11px] text-[color:var(--base-content)] opacity-50 flex items-center gap-1">
                      <Clock size={10} />
                      {formatDate(session.lastActiveAt)}
                    </span>
                    <span className="text-[11px] text-[color:var(--base-content)] opacity-50 capitalize">
                      {session.platform}
                    </span>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevoke(session.id)}
                    disabled={revoking === session.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[color:var(--error)] hover:bg-[color:var(--error)] hover:text-[color:var(--error-content)] transition-colors shrink-0"
                  >
                    {revoking === session.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <X size={14} />
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {sessions.length === 0 && (
          <div className="text-center py-12 text-[color:var(--base-content)] opacity-40">
            <Smartphone size={32} className="mx-auto mb-3" />
            <p className="text-sm">No active sessions found.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Password Section ─────────────────────────────────────────────────────────

function PasswordSection({ dispatch }) {
  const saving = useSelector(isLoading({ typePrefix: "hospitalManager/changePassword" }));
  const notifPrefs = useSelector(selectNotifPrefs);

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [prefs, setPrefs] = useState({
    sms: true,
    email: true,
    push: true,
    whatsapp: true,
  });

  useEffect(() => {
    if (notifPrefs) setPrefs(notifPrefs);
  }, [notifPrefs]);

  const passwordStrength = useCallback((pw) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }, []);

  const strength = passwordStrength(form.newPassword);
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][strength];
  const strengthColor = ["", "var(--error)", "var(--warning)", "var(--warning)", "var(--success)", "var(--success)"][strength];

  const handlePasswordChange = () => {
    if (form.newPassword !== form.confirmPassword) return;
    dispatch(changePassword(form)).then((res) => {
      if (!res.error) setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    });
  };

  const togglePref = (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    dispatch(updateNotificationPreferences(updated));
  };

  const NOTIF_CHANNELS = [
    { key: "email", label: "Email Notifications", icon: Mail, desc: "Booking confirmations, updates" },
    { key: "sms", label: "SMS Notifications", icon: Phone, desc: "OTPs and urgent alerts" },
    { key: "push", label: "Push Notifications", icon: Bell, desc: "App alerts and reminders" },
    { key: "whatsapp", label: "WhatsApp Messages", icon: MessageSquare, desc: "Rich notifications via WhatsApp" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-8"
    >
      {/* Change Password */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-[color:var(--base-content)] opacity-60 mb-5">
          Change Password
        </h3>
        <div className="space-y-4">
          {[
            { key: "currentPassword", label: "Current Password", showKey: "current" },
            { key: "newPassword", label: "New Password", showKey: "new" },
            { key: "confirmPassword", label: "Confirm New Password", showKey: "confirm" },
          ].map(({ key, label, showKey }) => (
            <div key={key} className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-[color:var(--base-content)] opacity-60">
                {label}
              </label>
              <div className="relative">
                <input
                  type={show[showKey] ? "text" : "password"}
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder="••••••••"
                  className="input-field w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((p) => ({ ...p, [showKey]: !p[showKey] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--base-content)] opacity-40 hover:opacity-80 transition-opacity"
                >
                  {show[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength bar for new password */}
              {key === "newPassword" && form.newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div
                        key={s}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: s <= strength ? strengthColor : "var(--base-300)",
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] font-semibold" style={{ color: strengthColor }}>
                    {strengthLabel}
                  </p>
                </div>
              )}

              {/* Match indicator */}
              {key === "confirmPassword" && form.confirmPassword && (
                <p
                  className="text-[11px] font-semibold flex items-center gap-1"
                  style={{
                    color:
                      form.newPassword === form.confirmPassword
                        ? "var(--success)"
                        : "var(--error)",
                  }}
                >
                  {form.newPassword === form.confirmPassword ? (
                    <><CheckCircle2 size={11} /> Passwords match</>
                  ) : (
                    <><AlertCircle size={11} /> Passwords don&apos;t match</>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 p-3 rounded-xl bg-[color:var(--base-200)] border border-[color:var(--base-300)]">
          <p className="text-[11px] text-[color:var(--base-content)] opacity-60 flex items-start gap-2">
            <AlertCircle size={12} className="shrink-0 mt-0.5 text-[color:var(--warning)]" />
            Changing your password will log out all other active sessions for security.
          </p>
        </div>

        <div className="flex justify-end mt-5">
          <button
            onClick={handlePasswordChange}
            disabled={
              saving ||
              !form.currentPassword ||
              !form.newPassword ||
              form.newPassword !== form.confirmPassword
            }
            className="btn-primary-cta flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            {saving ? "Updating…" : "Update Password"}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="divider" />

      {/* Notification Preferences */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-[color:var(--base-content)] opacity-60 mb-5">
          Notification Preferences
        </h3>
        <div className="space-y-3">
          {NOTIF_CHANNELS.map(({ key, label, icon: Icon, desc }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card p-4 flex items-center gap-4 cursor-pointer hover:border-[color:var(--primary)] transition-colors"
              onClick={() => togglePref(key)}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  prefs[key]
                    ? "bg-[color:var(--primary)] text-[color:var(--primary-content)]"
                    : "bg-[color:var(--base-300)] text-[color:var(--base-content)] opacity-40"
                }`}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[color:var(--base-content)]">{label}</p>
                <p className="text-[11px] text-[color:var(--base-content)] opacity-50">{desc}</p>
              </div>
              {/* Toggle */}
              <div
                className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${
                  prefs[key] ? "bg-[color:var(--primary)]" : "bg-[color:var(--base-300)]"
                }`}
              >
                <motion.div
                  animate={{ x: prefs[key] ? 16 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsSecurityPage() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();

  const activeSection = getActiveSection(pathname);

  const sectionMap = {
    account: <AccountSection dispatch={dispatch} />,
    sessions: <SessionsSection dispatch={dispatch} />,
    password: <PasswordSection dispatch={dispatch} />,
  };

  const activeLinkData = NAV_LINKS.find((l) => l.section === activeSection);

  return (
    <div
      data-theme="hospital"
      className="min-h-screen bg-[color:var(--base-100)] text-[color:var(--base-content)]"
    >
      {/* Page header */}
      <div className="border-b border-[color:var(--base-300)] bg-[color:var(--base-100)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[color:var(--primary)] text-[color:var(--primary-content)] flex items-center justify-center">
              <Shield size={18} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[color:var(--base-content)]">
                Settings & Security
              </h1>
              <p className="text-xs text-[color:var(--base-content)] opacity-50 mt-0.5">
                Manage your account, sessions, and security preferences
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Sidebar Nav ────────────────────────────────────────── */}
          <aside className="lg:w-60 shrink-0">
            <nav className="space-y-1">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const isActive = link.section === activeSection;
                return (
                  <motion.button
                    key={link.section}
                    onClick={() => router.push(link.href)}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-[color:var(--primary)] text-[color:var(--primary-content)] shadow-md"
                        : "text-[color:var(--base-content)] hover:bg-[color:var(--base-200)]"
                    }`}
                  >
                    <Icon
                      size={17}
                      className={isActive ? "text-[color:var(--primary-content)]" : "opacity-60"}
                    />
                    <span className="flex-1 text-left">{link.name}</span>
                    {isActive && <ChevronRight size={14} className="opacity-70" />}
                  </motion.button>
                );
              })}
            </nav>

            {/* Mobile breadcrumb hint */}
            <div className="lg:hidden mt-4 px-1">
              <p className="text-[11px] text-[color:var(--base-content)] opacity-40 uppercase tracking-widest">
                Viewing
              </p>
              <p className="text-sm font-bold text-[color:var(--primary)] mt-0.5">
                {activeLinkData?.name}
              </p>
            </div>
          </aside>

          {/* ── Content Panel ───────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            <div className="card p-6 md:p-8">
              {/* Panel header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-[color:var(--base-200)] flex items-center justify-center">
                  {activeLinkData && (
                    <activeLinkData.icon size={16} className="text-[color:var(--primary)]" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-[color:var(--base-content)]">
                    {activeLinkData?.name}
                  </h2>
                  <div className="h-0.5 w-8 rounded-full bg-[color:var(--primary)] mt-1" />
                </div>
              </div>

              {/* Animated section content */}
              <AnimatePresence mode="wait">
                <div key={activeSection}>{sectionMap[activeSection]}</div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}