'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  User as UserIcon, Mail, Phone, Shield, ShieldOff, Coins, Gift, Clock,
  LogIn, Smartphone, Monitor, Globe, KeyRound, Pencil, Save, X, Copy,
  Check, LogOut, Power, AlertTriangle, Activity, Settings as SettingsIcon,
  RefreshCw, Eye, EyeOff, BadgeCheck, Link2, Link2Off, FileText, Loader2,
  Calendar, MapPin, ShieldCheck,
} from 'lucide-react';

import {
  getProfile, updateProfile, changePassword,
  getActiveSessions, revokeSession, revokeAllSessions,
  getDeviceTokens, removeDeviceToken,
  getSettings, getAccountActivity,
  verifyPhone, confirmPhoneVerification,
  requestEmailChange, confirmEmailChange,
  unlinkGoogle, acceptLegal, deactivateAccount,
  getReferralCode,
  selectUser, selectActiveSessions, selectDeviceTokens,
  selectSettings, selectActivity, selectReferral, selectLoaders,
  selectCoinsRupees,
} from '@/store/slices/userSlice'; // adjust path to match your project structure

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const ALLOWED_ROLES = ['admin', 'superadmin'];

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

const timeAgo = (date) => {
  if (!date) return '—';
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
};

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

const PlatformIcon = ({ platform, size = 16, className = '' }) => {
  if (platform === 'android' || platform === 'ios') return <Smartphone size={size} className={className} />;
  if (platform === 'desktop') return <Monitor size={size} className={className} />;
  if (platform === 'web') return <Globe size={size} className={className} />;
  return <Globe size={size} className={className} />;
};

const roleLabel = (role) => (role === 'superadmin' ? 'Super Admin' : 'Admin');

// ═══════════════════════════════════════════════════════════════════════════
// SMALL UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="stat-card"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="stat-card-label">{label}</span>
        <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Icon size={16} />
        </span>
      </div>
      <p className="stat-card-value truncate">{value}</p>
    </motion.div>
  );
}

function SectionCard({ title, icon: Icon, action, children, className = '' }) {
  return (
    <div className={`card p-5 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Icon size={17} />
            </span>
          )}
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="card w-full max-w-md p-6"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{title}</h3>
              <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, placeholder }) {
  return (
    <div>
      <label className="label-text mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="input-field pr-11"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-primary transition-colors"
          aria-label="Toggle visibility"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="container-custom py-8 max-w-5xl">
      <div className="skeleton h-36 w-full mb-6" />
      <div className="grid-responsive mb-6">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24 w-full" />)}
      </div>
      <div className="skeleton h-12 w-full mb-6" />
      <div className="skeleton h-72 w-full" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TABS CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminProfilePage() {
  const dispatch = useDispatch();
  const router = useRouter();

  const user            = useSelector(selectUser);
  const activeSessions  = useSelector(selectActiveSessions);
  const deviceTokens    = useSelector(selectDeviceTokens);
  const settings        = useSelector(selectSettings);
  const activity        = useSelector(selectActivity);
  const referral        = useSelector(selectReferral);
  const loaders         = useSelector(selectLoaders);
  const coinsRupees     = useSelector(selectCoinsRupees);

  const [activeTab, setActiveTab] = useState('profile');
  const [editMode, setEditMode]   = useState(false);
  const [form, setForm]           = useState({ name: '', phone: '', avatar: '' });

  const [pwForm, setPwForm]   = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [showPw, setShowPw]   = useState({ old: false, next: false, confirm: false });

  const [emailModal, setEmailModal]       = useState(false);
  const [emailOtpModal, setEmailOtpModal] = useState(false);
  const [newEmail, setNewEmail]           = useState('');
  const [emailOtp, setEmailOtp]           = useState('');

  const [phoneOtpModal, setPhoneOtpModal] = useState(false);
  const [phoneOtp, setPhoneOtp]           = useState('');

  const [deactivateModal, setDeactivateModal] = useState(false);
  const [deactivatePw, setDeactivatePw]       = useState('');

  const [copied, setCopied] = useState(false);

  // ── Initial data load ───────────────────────────────────────────────────
  useEffect(() => {
    dispatch(getProfile());
    dispatch(getActiveSessions());
    dispatch(getDeviceTokens());
    dispatch(getSettings());
    dispatch(getAccountActivity());
    dispatch(getReferralCode());
  }, [dispatch]);

  useEffect(() => {
    if (user) setForm({ name: user.name || '', phone: user.phone || '', avatar: user.avatar || '' });
  }, [user]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveProfile = useCallback(async () => {
    const res = await dispatch(updateProfile({ name: form.name, phone: form.phone, avatar: form.avatar }));
    if (updateProfile.fulfilled.match(res)) setEditMode(false);
  }, [dispatch, form]);

  const handleCancelEdit = () => {
    setForm({ name: user?.name || '', phone: user?.phone || '', avatar: user?.avatar || '' });
    setEditMode(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword.length < 8) return toast.error('New password must be at least 8 characters.');
    if (pwForm.newPassword !== pwForm.confirm) return toast.error('Passwords do not match.');
    const res = await dispatch(changePassword({ oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword }));
    if (changePassword.fulfilled.match(res)) setPwForm({ oldPassword: '', newPassword: '', confirm: '' });
  };

  const handleRevokeSession  = (id)    => dispatch(revokeSession(id));
  const handleRemoveDevice   = (token) => dispatch(removeDeviceToken(token));

  const handleRevokeAll = async () => {
    const res = await dispatch(revokeAllSessions());
    if (revokeAllSessions.fulfilled.match(res)) router.push('/login');
  };

  const handleSendPhoneOtp = async () => {
    const res = await dispatch(verifyPhone());
    if (verifyPhone.fulfilled.match(res)) setPhoneOtpModal(true);
  };

  const handleConfirmPhoneOtp = async () => {
    const res = await dispatch(confirmPhoneVerification(phoneOtp));
    if (confirmPhoneVerification.fulfilled.match(res)) { setPhoneOtpModal(false); setPhoneOtp(''); }
  };

  const handleRequestEmailChange = async () => {
    if (!newEmail.includes('@')) return toast.error('Enter a valid email address.');
    const res = await dispatch(requestEmailChange(newEmail));
    if (requestEmailChange.fulfilled.match(res)) { setEmailModal(false); setEmailOtpModal(true); }
  };

  const handleConfirmEmailChange = async () => {
    const res = await dispatch(confirmEmailChange(emailOtp));
    if (confirmEmailChange.fulfilled.match(res)) { setEmailOtpModal(false); setEmailOtp(''); setNewEmail(''); }
  };

  const handleUnlinkGoogle = () => dispatch(unlinkGoogle());
  const handleAcceptTerms   = () => dispatch(acceptLegal({ acceptTerms: true }));
  const handleAcceptPrivacy = () => dispatch(acceptLegal({ acceptPrivacy: true }));

  const handleDeactivate = async () => {
    if (!deactivatePw) return toast.error('Password is required.');
    const res = await dispatch(deactivateAccount(deactivatePw));
    if (deactivateAccount.fulfilled.match(res)) { setDeactivateModal(false); router.push('/login'); }
  };

  const handleCopyReferral = () => {
    if (!referral?.referralCode) return;
    navigator.clipboard.writeText(referral.referralCode);
    setCopied(true);
    toast.success('Referral code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Guards ───────────────────────────────────────────────────────────────
  if (!user) return <PageSkeleton />;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center container-custom">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 text-center max-w-md"
        >
          <ShieldOff className="mx-auto mb-4 text-error" size={44} />
          <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-base-content/60 text-sm">
            This page is only available to admin and superadmin accounts.
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div data-theme={user.role} className="min-h-screen bg-base-100">
      <div className="container-custom py-6 sm:py-10  ">

        {/* Blocked banner */}
        {user.isBlocked && (
          <div className="alert alert-error mb-6">
            <AlertTriangle size={20} className="text-error shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Account suspended</p>
              <p className="text-sm opacity-80">{user.blockReason || 'Contact support for details.'}</p>
            </div>
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="card overflow-hidden mb-6"
        >
          <div className="h-28 sm:h-36 w-full bg-[image:var(--bg-gradient-primary)]" />
          <div className="px-5 sm:px-8 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 sm:-mt-14">
              <div className="flex items-end gap-4">
                <div className="avatar placeholder shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 ring-4 ring-base-100 bg-base-200">
                    {user.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar} alt={user.name} />
                    ) : (
                      <span className="text-2xl">{initials(user.name)}</span>
                    )}
                  </div>
                  <span
                    className={`absolute bottom-1 right-1 w-5 h-5 rounded-full ring-2 ring-base-100 ${
                      user.isOnline ? 'bg-success' : 'bg-base-300'
                    }`}
                  />
                </div>
                <div className="pb-1">
                  <h1 className="text-xl sm:text-2xl font-black leading-tight">{user.name}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="role-badge">
                      <Shield size={12} /> {roleLabel(user.role)}
                    </span>
                    {user.isEmailVerified && (
                      <span className="badge badge-success badge-sm">
                        <BadgeCheck size={12} /> Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 sm:pb-1">
                {activeTab === 'profile' && (
                  editMode ? (
                    <>
                      <button onClick={handleCancelEdit} className="btn btn-ghost btn-sm">
                        <X size={15} /> Cancel
                      </button>
                      <button onClick={handleSaveProfile} disabled={loaders.updateProfile} className="btn btn-primary btn-sm">
                        {loaders.updateProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setEditMode(true)} className="btn btn-outline btn-sm">
                      <Pencil size={15} /> Edit Profile
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid-responsive mb-6">
          <StatCard icon={Coins}   label="Coin Balance"    value={`₹${coinsRupees.toFixed(2)}`}        delay={0.05} />
          <StatCard icon={LogIn}   label="Total Logins"    value={user.loginCount ?? 0}                  delay={0.1} />
          <StatCard icon={Calendar} label="Member Since"   value={formatDate(user.createdAt)}            delay={0.15} />
          <StatCard icon={Activity} label="Active Sessions" value={activeSessions.length}                delay={0.2} />
        </div>

        {/* ── Tab nav ────────────────────────────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1 mb-6 border-b border-base-300">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                  active ? 'text-primary' : 'text-base-content/50 hover:text-base-content'
                }`}
              >
                <Icon size={15} />
                {tab.label}
                {active && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >

            {/* ════════════════ PROFILE TAB ════════════════ */}
            {activeTab === 'profile' && (
              <>
                <SectionCard title="Personal Information" icon={UserIcon}>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="label-text mb-1.5 block">Full Name</label>
                      {editMode ? (
                        <input
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="input-field"
                        />
                      ) : (
                        <p className="text-sm font-medium py-2">{user.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="label-text mb-1.5 block">Email Address</label>
                      <div className="flex items-center gap-2 py-2">
                        <Mail size={14} className="text-base-content/40 shrink-0" />
                        <p className="text-sm font-medium truncate">{user.email}</p>
                        {user.isEmailVerified ? (
                          <span className="badge badge-success badge-xs shrink-0">Verified</span>
                        ) : (
                          <span className="badge badge-warning badge-xs shrink-0">Unverified</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="label-text mb-1.5 block">Phone Number</label>
                      {editMode ? (
                        <input
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="9876543210"
                          className="input-field"
                        />
                      ) : (
                        <div className="flex items-center gap-2 py-2">
                          <Phone size={14} className="text-base-content/40 shrink-0" />
                          <p className="text-sm font-medium">{user.phone || 'Not added'}</p>
                          {user.phone && (
                            user.isPhoneVerified ? (
                              <span className="badge badge-success badge-xs">Verified</span>
                            ) : (
                              <span className="badge badge-warning badge-xs">Unverified</span>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="label-text mb-1.5 block">Avatar URL</label>
                      {editMode ? (
                        <input
                          value={form.avatar}
                          onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                          placeholder="https://..."
                          className="input-field"
                        />
                      ) : (
                        <p className="text-sm font-medium py-2 truncate text-base-content/60">
                          {user.avatar || 'Default avatar'}
                        </p>
                      )}
                    </div>

                    {user.lastKnownAddress && (
                      <div className="sm:col-span-2">
                        <label className="label-text mb-1.5 block">Last Known Location</label>
                        <div className="flex items-center gap-2 py-2">
                          <MapPin size={14} className="text-base-content/40 shrink-0" />
                          <p className="text-sm font-medium">{user.lastKnownAddress}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard title="Referral Program" icon={Gift}>
                  <div className="grid sm:grid-cols-3 gap-5">
                    <div className="sm:col-span-1">
                      <label className="label-text mb-1.5 block">Your Referral Code</label>
                      <div className="flex items-center gap-2">
                        <code className="input-field font-mono font-bold tracking-widest text-center text-primary">
                          {referral?.referralCode ?? '—'}
                        </code>
                        <button onClick={handleCopyReferral} className="btn btn-outline btn-circle shrink-0" aria-label="Copy code">
                          {copied ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex sm:col-span-2 gap-6">
                      <div>
                        <p className="stat-card-label">Total Referrals</p>
                        <p className="text-xl font-extrabold text-primary mt-1">{referral?.totalReferrals ?? 0}</p>
                      </div>
                      <div>
                        <p className="stat-card-label">Coins Earned</p>
                        <p className="text-xl font-extrabold text-primary mt-1">{referral?.coinsEarned ?? 0}</p>
                      </div>
                      <div>
                        <p className="stat-card-label">Coins Redeemed</p>
                        <p className="text-xl font-extrabold text-primary mt-1">{referral?.coinsRedeemed ?? 0}</p>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ════════════════ SECURITY TAB ════════════════ */}
            {activeTab === 'security' && (
              <>
                <SectionCard title="Change Password" icon={KeyRound}>
                  <form onSubmit={handleChangePassword} className="grid sm:grid-cols-3 gap-5">
                    <PasswordField
                      label="Current Password"
                      value={pwForm.oldPassword}
                      onChange={(e) => setPwForm({ ...pwForm, oldPassword: e.target.value })}
                      show={showPw.old}
                      onToggle={() => setShowPw({ ...showPw, old: !showPw.old })}
                      placeholder="••••••••"
                    />
                    <PasswordField
                      label="New Password"
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      show={showPw.next}
                      onToggle={() => setShowPw({ ...showPw, next: !showPw.next })}
                      placeholder="Min. 8 characters"
                    />
                    <PasswordField
                      label="Confirm New Password"
                      value={pwForm.confirm}
                      onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                      show={showPw.confirm}
                      onToggle={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}
                      placeholder="Repeat new password"
                    />
                    <div className="sm:col-span-3">
                      <button type="submit" disabled={loaders.changePassword} className="btn btn-primary">
                        {loaders.changePassword ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                        Update Password
                      </button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard
                  title="Active Sessions"
                  icon={Monitor}
                  action={
                    <button onClick={handleRevokeAll} disabled={loaders.revokeAllSessions} className="btn btn-error btn-sm">
                      {loaders.revokeAllSessions ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                      Sign Out All
                    </button>
                  }
                >
                  {activeSessions.length === 0 ? (
                    <p className="text-sm text-base-content/50 py-4 text-center">No active sessions found.</p>
                  ) : (
                    <div className="space-y-2">
                      {activeSessions.map((s) => (
                        <div key={s._id} className="flex items-center justify-between gap-3 p-3 rounded-field bg-base-200">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <PlatformIcon platform={s.platform} size={16} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{s.deviceName || 'Unknown Device'}</p>
                              <p className="text-xs text-base-content/50 truncate">
                                {s.ipAddress} · Active {timeAgo(s.lastActiveAt)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevokeSession(s._id)}
                            disabled={loaders.revokeSession}
                            className="btn btn-ghost btn-circle btn-sm text-error shrink-0"
                            aria-label="Revoke session"
                          >
                            <LogOut size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Registered Devices" icon={Smartphone}>
                  {deviceTokens.length === 0 ? (
                    <p className="text-sm text-base-content/50 py-4 text-center">No push-notification devices registered.</p>
                  ) : (
                    <div className="space-y-2">
                      {deviceTokens.map((d) => (
                        <div key={d._id} className="flex items-center justify-between gap-3 p-3 rounded-field bg-base-200">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                              <PlatformIcon platform={d.platform} size={16} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{d.deviceName || 'Unknown'}</p>
                              <p className="text-xs text-base-content/50 truncate">
                                Last used {timeAgo(d.lastUsedAt)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveDevice(d.token)}
                            disabled={loaders.removeDeviceToken}
                            className="btn btn-ghost btn-circle btn-sm text-error shrink-0"
                            aria-label="Remove device"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            )}

            {/* ════════════════ ACTIVITY TAB ════════════════ */}
            {activeTab === 'activity' && (
              <SectionCard title="Account Activity" icon={Activity}>
                <div className="grid sm:grid-cols-2 gap-5 mb-6">
                  <div className="flex items-center gap-3 p-4 rounded-field bg-base-200">
                    <Clock size={18} className="text-primary shrink-0" />
                    <div>
                      <p className="stat-card-label">Last Login</p>
                      <p className="text-sm font-semibold mt-0.5">{timeAgo(activity?.lastLoginAt ?? user.lastLoginAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-field bg-base-200">
                    <Globe size={18} className="text-primary shrink-0" />
                    <div>
                      <p className="stat-card-label">Last Login IP</p>
                      <p className="text-sm font-semibold mt-0.5">{activity?.lastLoginIp ?? user.lastLoginIp ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-field bg-base-200">
                    <KeyRound size={18} className="text-primary shrink-0" />
                    <div>
                      <p className="stat-card-label">Password Last Changed</p>
                      <p className="text-sm font-semibold mt-0.5">{formatDate(activity?.passwordChangedAt ?? user.passwordChangedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-field bg-base-200">
                    <span className={`status-dot ${user.isOnline ? 'status-dot-success' : 'status-dot-error'}`} />
                    <div>
                      <p className="stat-card-label">Current Status</p>
                      <p className="text-sm font-semibold mt-0.5">{user.isOnline ? 'Online now' : `Offline · ${timeAgo(user.lastseen)}`}</p>
                    </div>
                  </div>
                </div>

                <p className="label-text mb-3">Recent Sessions</p>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Device</th>
                        <th>IP Address</th>
                        <th>Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activity?.activeSessions ?? activeSessions).slice(0, 10).map((s) => (
                        <tr key={s._id}>
                          <td className="flex items-center gap-2">
                            <PlatformIcon platform={s.platform} size={14} className="text-base-content/40" />
                            {s.deviceName || 'Unknown'}
                          </td>
                          <td className="text-base-content/60">{s.ipAddress}</td>
                          <td className="text-base-content/60">{timeAgo(s.lastActiveAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* ════════════════ SETTINGS TAB ════════════════ */}
            {activeTab === 'settings' && (
              <>
                <SectionCard title="Email & Phone" icon={Mail}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-field bg-base-200 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Mail size={16} className="text-base-content/40 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{user.email}</p>
                          <p className="text-xs text-base-content/50">Primary email address</p>
                        </div>
                      </div>
                      <button onClick={() => setEmailModal(true)} className="btn btn-outline btn-sm shrink-0">Change</button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-field bg-base-200 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Phone size={16} className="text-base-content/40 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{user.phone || 'No phone number'}</p>
                          <p className="text-xs text-base-content/50">
                            {user.isPhoneVerified ? 'Verified' : 'Not verified'}
                          </p>
                        </div>
                      </div>
                      {user.phone && !user.isPhoneVerified && (
                        <button
                          onClick={handleSendPhoneOtp}
                          disabled={loaders.verifyPhone}
                          className="btn btn-outline btn-sm shrink-0"
                        >
                          {loaders.verifyPhone ? <Loader2 size={14} className="animate-spin" /> : 'Verify'}
                        </button>
                      )}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Connected Accounts" icon={Link2}>
                  <div className="flex items-center justify-between p-3 rounded-field bg-base-200 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {user.googleAuth?.googleId ? (
                        <Link2 size={16} className="text-success shrink-0" />
                      ) : (
                        <Link2Off size={16} className="text-base-content/40 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Google Account</p>
                        <p className="text-xs text-base-content/50">
                          {user.googleAuth?.googleId ? 'Linked' : 'Not linked'}
                        </p>
                      </div>
                    </div>
                    {user.googleAuth?.googleId && (
                      <button
                        onClick={handleUnlinkGoogle}
                        disabled={loaders.googleUnlink}
                        className="btn btn-ghost btn-sm text-error shrink-0"
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                </SectionCard>

                <SectionCard title="Legal Agreements" icon={FileText}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-field bg-base-200 gap-3">
                      <p className="text-sm font-medium">Terms of Service</p>
                      {user.termsAcceptedAt ? (
                        <span className="badge badge-success badge-sm">
                          <Check size={11} /> {formatDate(user.termsAcceptedAt)}
                        </span>
                      ) : (
                        <button onClick={handleAcceptTerms} className="btn btn-outline btn-sm">Accept</button>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-field bg-base-200 gap-3">
                      <p className="text-sm font-medium">Privacy Policy</p>
                      {user.privacyPolicyAcceptedAt ? (
                        <span className="badge badge-success badge-sm">
                          <Check size={11} /> {formatDate(user.privacyPolicyAcceptedAt)}
                        </span>
                      ) : (
                        <button onClick={handleAcceptPrivacy} className="btn btn-outline btn-sm">Accept</button>
                      )}
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ════════════════ DANGER ZONE TAB ════════════════ */}
            {activeTab === 'danger' && (
              <SectionCard title="Danger Zone" icon={AlertTriangle} className="border border-error/30">
                <div className="alert alert-warning mb-5">
                  <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-sm">Actions in this section are sensitive and may sign you out of every device.</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-field bg-error/5 border border-error/20">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Power size={15} className="text-error" /> Deactivate Account
                    </p>
                    <p className="text-xs text-base-content/50 mt-1">
                      Temporarily disable your account. Contact support to reactivate.
                    </p>
                  </div>
                  <button onClick={() => setDeactivateModal(true)} className="btn btn-error btn-sm shrink-0">
                    Deactivate
                  </button>
                </div>
              </SectionCard>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ════════════════ MODALS ════════════════ */}

      <Modal open={emailModal} onClose={() => setEmailModal(false)} title="Change Email Address">
        <div className="space-y-4">
          <div>
            <label className="label-text mb-1.5 block">New Email Address</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field"
            />
          </div>
          <button
            onClick={handleRequestEmailChange}
            disabled={loaders.requestEmailChange}
            className="btn btn-primary w-full"
          >
            {loaders.requestEmailChange ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Send Verification Code
          </button>
        </div>
      </Modal>

      <Modal open={emailOtpModal} onClose={() => setEmailOtpModal(false)} title="Confirm Email Change">
        <div className="space-y-4">
          <p className="text-sm text-base-content/60">Enter the 6-digit code sent to your current email.</p>
          <input
            value={emailOtp}
            onChange={(e) => setEmailOtp(e.target.value)}
            maxLength={6}
            placeholder="000000"
            className="input-field text-center tracking-[0.5em] font-mono text-lg"
          />
          <button
            onClick={handleConfirmEmailChange}
            disabled={loaders.confirmEmailChange}
            className="btn btn-primary w-full"
          >
            {loaders.confirmEmailChange ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            Confirm Change
          </button>
        </div>
      </Modal>

      <Modal open={phoneOtpModal} onClose={() => setPhoneOtpModal(false)} title="Verify Phone Number">
        <div className="space-y-4">
          <p className="text-sm text-base-content/60">Enter the 6-digit code sent via SMS.</p>
          <input
            value={phoneOtp}
            onChange={(e) => setPhoneOtp(e.target.value)}
            maxLength={6}
            placeholder="000000"
            className="input-field text-center tracking-[0.5em] font-mono text-lg"
          />
          <button
            onClick={handleConfirmPhoneOtp}
            disabled={loaders.verifyPhoneConfirm}
            className="btn btn-primary w-full"
          >
            {loaders.verifyPhoneConfirm ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            Verify Phone
          </button>
        </div>
      </Modal>

      <Modal open={deactivateModal} onClose={() => setDeactivateModal(false)} title="Deactivate Account">
        <div className="space-y-4">
          <p className="text-sm text-base-content/60">
            Confirm your password to deactivate your account. You can contact support to reactivate it later.
          </p>
          <input
            type="password"
            value={deactivatePw}
            onChange={(e) => setDeactivatePw(e.target.value)}
            placeholder="Current password"
            className="input-field"
          />
          <button
            onClick={handleDeactivate}
            disabled={loaders.deactivate}
            className="btn btn-error w-full"
          >
            {loaders.deactivate ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
            Confirm Deactivation
          </button>
        </div>
      </Modal>
    </div>
  );
}