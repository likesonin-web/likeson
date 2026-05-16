'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Smartphone, Monitor, Globe, Tablet,
  LogOut, LogIn, Trash2, RefreshCw, Loader2, X,
  WifiOff, MapPin, Clock, AlertTriangle, CheckCircle2,
  Lock, KeyRound, Eye, Fingerprint, Activity, ChevronDown,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  selectUser, selectActiveSessions, selectDeviceTokens,
  selectActivity, selectLoaders,
  getActiveSessions, revokeSession, revokeAllSessions,
  getDeviceTokens, removeDeviceToken,
  getAccountActivity, unlinkGoogle,
} from '@/store/slices/userSlice';

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

const listItem = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit:    { opacity: 0, x: 12,  transition: { duration: 0.2 } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const platformIcon = (platform, size = 18) => {
  const props = { size, style: { color: 'var(--primary)' } };
  if (platform === 'android' || platform === 'ios') return <Smartphone {...props} />;
  if (platform === 'desktop') return <Monitor {...props} />;
  if (platform === 'web')     return <Globe {...props} />;
  return <Tablet {...props} />;
};

const relativeTime = (date) => {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const maskIp = (ip) => {
  if (!ip || ip === 'Unknown') return '—';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  return ip.slice(0, 8) + '…';
};

// ── Section wrapper ───────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, icon: Icon, iconColor, children, action }) {
  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${iconColor ?? 'var(--primary)'}, transparent 85%)` }}>
            <Icon size={18} style={{ color: iconColor ?? 'var(--primary)' }} />
          </div>
          <div>
            <h3 className="font-black text-base font-montserrat" style={{ color: 'var(--base-content)' }}>{title}</h3>
            {subtitle && (
              <p className="text-[10px]" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ open, onClose, onConfirm, title, body, danger = false, loading }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'color-mix(in srgb, var(--neutral), transparent 40%)' }}
          onClick={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass-card p-6 w-full max-w-sm space-y-4">
            <h4 className="font-black text-lg font-montserrat">{title}</h4>
            <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 35%)' }}>{body}</p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="btn-secondary flex-1 py-2 text-[10px]">Cancel</button>
              <button onClick={onConfirm} disabled={loading}
                className="flex-1 py-2 text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
                style={{ background: danger ? 'var(--error)' : 'var(--primary)', color: danger ? 'var(--error-content)' : 'var(--primary-content)' }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────
function SessionRow({ session, onRevoke, loading, currentFp }) {
  const isCurrent = session.ipAddress && currentFp?.includes(session.ipAddress);
  return (
    <motion.div variants={listItem} initial="hidden" animate="visible" exit="exit" layout
      className="flex items-center gap-4 p-3 rounded-xl transition-colors"
      style={{ background: isCurrent ? 'color-mix(in srgb, var(--success), transparent 90%)' : 'var(--base-200)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--base-300)' }}>
        {platformIcon(session.platform)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--base-content)' }}>
            {session.deviceName ?? 'Unknown Device'}
          </p>
          {isCurrent && (
            <span className="badge badge-success text-[10px] py-0 px-2">Current</span>
          )}
          {session.hasPushToken && (
            <span className="badge badge-info text-[10px] py-0 px-2">Push enabled</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[10px] flex items-center gap-1"
            style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
            <MapPin size={10} /> {maskIp(session.ipAddress)}
          </span>
          <span className="text-[10px] flex items-center gap-1"
            style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
            <Clock size={10} /> {relativeTime(session.lastActiveAt)}
          </span>
          <span className="text-[10px] capitalize"
            style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
            {session.platform}
          </span>
        </div>
      </div>
      {!isCurrent && (
        <button onClick={() => onRevoke(session._id)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--error), transparent 88%)', color: 'var(--error)' }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
          Sign out
        </button>
      )}
    </motion.div>
  );
}

// ── Device token row ──────────────────────────────────────────────────────────
function DeviceRow({ device, onRemove, loading }) {
  return (
    <motion.div variants={listItem} initial="hidden" animate="visible" exit="exit" layout
      className="flex items-center gap-4 p-3 rounded-xl"
      style={{ background: 'var(--base-200)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--base-300)' }}>
        {platformIcon(device.platform)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--base-content)' }}>
          {device.deviceName ?? 'Unknown Device'}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] capitalize badge badge-primary">{device.platform}</span>
          <span className="text-[10px]" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 50%)' }}>
            {relativeTime(device.lastUsedAt)}
          </span>
        </div>
      </div>
      <button onClick={() => onRemove(device.token)} disabled={loading}
        className="p-2 rounded-lg transition-colors flex-shrink-0"
        style={{ background: 'color-mix(in srgb, var(--error), transparent 88%)', color: 'var(--error)' }}>
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </motion.div>
  );
}

// ── Custom recharts tooltip ────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-[10px] space-y-0.5">
      <p className="font-semibold" style={{ color: 'var(--base-content)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ── Build chart data from sessions ────────────────────────────────────────────
const buildActivityData = (sessions) => {
  if (!sessions?.length) return [];
  const map = {};
  sessions.forEach(s => {
    const day = new Date(s.lastActiveAt ?? s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    map[day] = (map[day] ?? 0) + 1;
  });
  return Object.entries(map).slice(-7).map(([day, sessions]) => ({ day, sessions }));
};

const buildPlatformData = (sessions) => {
  if (!sessions?.length) return [];
  const map = {};
  sessions.forEach(s => { map[s.platform ?? 'web'] = (map[s.platform ?? 'web'] ?? 0) + 1; });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
};

const PIE_COLORS = ['var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--success)'];

// ═══════════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════════
export default function Security() {
  const dispatch = useDispatch();
  const user     = useSelector(selectUser);
  const sessions = useSelector(selectActiveSessions);
  const tokens   = useSelector(selectDeviceTokens);
  const activity = useSelector(selectActivity);
  const loaders  = useSelector(selectLoaders);

  const [revokeTarget,    setRevokeTarget]    = useState(null);  // sessionId
  const [tokenTarget,     setTokenTarget]     = useState(null);  // token string
  const [showRevokeAll,   setShowRevokeAll]   = useState(false);
  const [showGoogleUnlink, setShowGoogleUnlink] = useState(false);
  const [showSessions,    setShowSessions]    = useState(true);
  const [showDevices,     setShowDevices]     = useState(true);

  useEffect(() => {
    dispatch(getActiveSessions());
    dispatch(getDeviceTokens());
    dispatch(getAccountActivity());
  }, [dispatch]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const confirmRevokeSession = async () => {
    if (!revokeTarget) return;
    await dispatch(revokeSession(revokeTarget));
    setRevokeTarget(null);
  };

  const confirmRemoveToken = async () => {
    if (!tokenTarget) return;
    await dispatch(removeDeviceToken(tokenTarget));
    setTokenTarget(null);
  };

  const confirmRevokeAll = async () => {
    await dispatch(revokeAllSessions());
    setShowRevokeAll(false);
  };

  const confirmUnlinkGoogle = async () => {
    await dispatch(unlinkGoogle());
    setShowGoogleUnlink(false);
  };

  // ── Chart data ───────────────────────────────────────────────────────────
  const activityData  = buildActivityData(activity?.activeSessions ?? sessions);
  const platformData  = buildPlatformData(activity?.activeSessions ?? sessions);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Active Sessions', value: sessions.length,           icon: Activity,     color: 'var(--primary)' },
    { label: 'Devices Linked',  value: tokens.length,             icon: Smartphone,   color: 'var(--secondary)' },
    { label: 'Total Logins',    value: user?.loginCount ?? 0,     icon: LogIn,        color: 'var(--success)' },
    { label: 'Last Login',      value: relativeTime(activity?.lastLoginAt ?? user?.lastLoginAt), icon: Clock, color: 'var(--warning)' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <h2 className="section-heading text-3xl md:text-4xl">Security Center</h2>
        <p className="section-subheading text-base">Monitor active sessions, manage trusted devices, and control access.</p>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }, i) => (
          <motion.div key={label} variants={fadeUp} initial="hidden" animate="visible" custom={i * 0.5 + 1}
            className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${color}, transparent 85%)` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className="text-[10px] font-semibold" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>{label}</p>
              <p className="text-lg font-black font-montserrat" style={{ color: 'var(--base-content)' }}>{value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activity chart + Platform pie */}
      {activityData.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Area chart */}
          <div className="glass-card p-5 lg:col-span-2">
            <p className="font-black text-xs font-montserrat mb-4" style={{ color: 'var(--base-content)' }}>
              Session Activity (Last 7 Days)
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={activityData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sessionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="sessions" name="Sessions"
                  stroke="var(--primary)" strokeWidth={2}
                  fill="url(#sessionGrad)" dot={{ fill: 'var(--primary)', r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          <div className="glass-card p-5">
            <p className="font-black text-xs font-montserrat mb-4" style={{ color: 'var(--base-content)' }}>
              Platform Split
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={platformData} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
                  dataKey="value" nameKey="name" paddingAngle={4}>
                  {platformData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {platformData.map(({ name, value }, i) => (
                <div key={name} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--base-content)' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="capitalize">{name}</span>
                  </span>
                  <span className="font-bold" style={{ color: 'var(--base-content)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Active Sessions ─────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
        <SectionCard
          title="Active Sessions"
          subtitle={`${sessions.length} device${sessions.length !== 1 ? 's' : ''} currently signed in`}
          icon={Shield}
          action={
            <div className="flex items-center gap-2">
              <button onClick={() => dispatch(getActiveSessions())}
                className="p-2 rounded-lg transition-colors" style={{ background: 'var(--base-200)' }}>
                <RefreshCw size={14} style={{ color: 'var(--base-content)' }}
                  className={loaders.sessions ? 'animate-spin' : ''} />
              </button>
              {sessions.length > 1 && (
                <button onClick={() => setShowRevokeAll(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                  style={{ background: 'color-mix(in srgb, var(--error), transparent 88%)', color: 'var(--error)' }}>
                  <LogOut size={12} /> Sign out all
                </button>
              )}
              <button onClick={() => setShowSessions(p => !p)}
                className="p-2 rounded-lg transition-all" style={{ background: 'var(--base-200)' }}>
                <ChevronDown size={14} className={`transition-transform ${showSessions ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--base-content)' }} />
              </button>
            </div>
          }
        >
          <AnimatePresence>
            {showSessions && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                className="space-y-2 overflow-hidden">
                {loaders.sessions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <WifiOff size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--base-content)' }} />
                    <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>
                      No active sessions
                    </p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {sessions.map((s) => (
                      <SessionRow
                        key={s._id} session={s}
                        onRevoke={(id) => setRevokeTarget(id)}
                        loading={loaders.revokeSession && revokeTarget === s._id}
                        currentFp={`${activity?.lastLoginIp}`}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </SectionCard>
      </motion.div>

      {/* ── Device Tokens ───────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
        <SectionCard
          title="Push Notification Devices"
          subtitle={`${tokens.length} device${tokens.length !== 1 ? 's' : ''} registered for push notifications`}
          icon={Smartphone} iconColor="var(--secondary)"
          action={
            <button onClick={() => setShowDevices(p => !p)}
              className="p-2 rounded-lg transition-all" style={{ background: 'var(--base-200)' }}>
              <ChevronDown size={14} className={`transition-transform ${showDevices ? 'rotate-180' : ''}`}
                style={{ color: 'var(--base-content)' }} />
            </button>
          }
        >
          <AnimatePresence>
            {showDevices && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                className="space-y-2 overflow-hidden">
                {loaders.deviceTokens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--secondary)' }} />
                  </div>
                ) : tokens.length === 0 ? (
                  <div className="text-center py-8">
                    <Smartphone size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--base-content)' }} />
                    <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>
                      No registered devices
                    </p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {tokens.map((t) => (
                      <DeviceRow
                        key={t._id ?? t.token} device={t}
                        onRemove={(tok) => setTokenTarget(tok)}
                        loading={loaders.removeDeviceToken && tokenTarget === t.token}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </SectionCard>
      </motion.div>

      {/* ── Security checks ──────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}
        className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Account health */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Fingerprint size={18} style={{ color: 'var(--success)' }} />
            <h3 className="font-black text-base font-montserrat">Account Health</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Email verified',    ok: user?.isEmailVerified,  icon: CheckCircle2 },
              { label: 'Phone verified',    ok: user?.isPhoneVerified,  icon: CheckCircle2 },
              { label: 'Password set',      ok: true,                   icon: Lock },
              { label: 'Google linked',     ok: !!user?.googleAuth?.googleId, icon: Globe },
            ].map(({ label, ok, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs flex items-center gap-2" style={{ color: 'var(--base-content)' }}>
                  <Icon size={14} style={{ color: ok ? 'var(--success)' : 'var(--base-300)' }} />
                  {label}
                </span>
                <span className={`badge text-[10px] ${ok ? 'badge-success' : 'badge-warning'}`}>
                  {ok ? 'Done' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Google link / unlink */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Globe size={18} style={{ color: 'var(--info)' }} />
            <h3 className="font-black text-base font-montserrat">Google Account</h3>
          </div>
          {user?.googleAuth?.googleId ? (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--base-200)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--success), transparent 85%)' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--base-content)' }}>Google Connected</p>
                  <p className="text-[10px]" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>
                    Sign in with Google is enabled
                  </p>
                </div>
              </div>
              <button onClick={() => setShowGoogleUnlink(true)}
                className="w-full py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2"
                style={{ background: 'color-mix(in srgb, var(--error), transparent 88%)', color: 'var(--error)' }}>
                <X size={13} /> Unlink Google Account
              </button>
            </>
          ) : (
            <div className="text-center py-4 space-y-2">
              <Globe size={32} className="mx-auto opacity-30" style={{ color: 'var(--base-content)' }} />
              <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>
                No Google account linked
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Last activity info ───────────────────────────────────────────── */}
      {activity && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} style={{ color: 'var(--warning)' }} />
            <h3 className="font-black text-base font-montserrat">Recent Activity</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Last Login',       value: relativeTime(activity.lastLoginAt) },
              { label: 'Last Login IP',    value: maskIp(activity.lastLoginIp) },
              { label: 'Last Active',      value: relativeTime(activity.lastActiveAt) },
              { label: 'Password Changed', value: activity.passwordChangedAt ? relativeTime(activity.passwordChangedAt) : 'Never' },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p className="text-[10px] font-semibold"
                  style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>{label}</p>
                <p className="text-xs font-bold" style={{ color: 'var(--base-content)' }}>{value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ══ CONFIRM DIALOGS ═══════════════════════════════════════════════ */}
      <ConfirmDialog
        open={!!revokeTarget} onClose={() => setRevokeTarget(null)}
        onConfirm={confirmRevokeSession} loading={loaders.revokeSession}
        title="Sign out device?" danger
        body="This session will be immediately terminated and its push notification token will be removed. The device will need to log in again." />

      <ConfirmDialog
        open={!!tokenTarget} onClose={() => setTokenTarget(null)}
        onConfirm={confirmRemoveToken} loading={loaders.removeDeviceToken}
        title="Remove device?" danger
        body="This device will stop receiving push notifications. It can re-register on next login." />

      <ConfirmDialog
        open={showRevokeAll} onClose={() => setShowRevokeAll(false)}
        onConfirm={confirmRevokeAll} loading={loaders.revokeAllSessions}
        title="Sign out everywhere?" danger
        body="All active sessions and device tokens will be cleared. You will be redirected to the login page." />

      <ConfirmDialog
        open={showGoogleUnlink} onClose={() => setShowGoogleUnlink(false)}
        onConfirm={confirmUnlinkGoogle} loading={loaders.googleUnlink}
        title="Unlink Google Account?"
        body="You'll need your email and password to log in after unlinking. Make sure your password is set before proceeding." />

    </div>
  );
}