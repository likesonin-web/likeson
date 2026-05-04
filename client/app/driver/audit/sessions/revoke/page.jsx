'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  LogOut,
  ShieldCheck,
  MonitorSmartphone,
  Laptop,
  Trash2,
  Shield,
  Globe,
  Smartphone,
  Monitor,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Wifi,
  MapPin,
  Calendar,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  fetchTPSessions,
  revokeTPSession,
  revokeAllTPSessions,
  removeTPDeviceToken,
} from '@/store/slices/transportPartnerSlice';

// ─── helpers ──────────────────────────────────────────────────────────────────

const relTime = (date) => {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

const platformIcon = (p) => {
  if (!p) return Monitor;
  if (p === 'android' || p === 'ios') return Smartphone;
  if (p === 'desktop') return Laptop;
  return Globe;
};

// ─── sub-components ───────────────────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, title, subtitle, count, accent }) => (
  <div className="flex items-center gap-3 mb-5">
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        background: `color-mix(in srgb, ${accent || 'var(--primary)'}, transparent 88%)`,
        color: accent || 'var(--primary)',
      }}
    >
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h2 className="font-montserrat text-base font-bold" style={{ color: 'var(--base-content)' }}>
          {title}
        </h2>
        {count !== undefined && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: `color-mix(in srgb, ${accent || 'var(--primary)'}, transparent 88%)`, color: accent || 'var(--primary)' }}
          >
            {count}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 48%, transparent)' }}>
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

const EmptySlate = ({ text }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
      style={{ background: 'var(--base-200)' }}
    >
      <Shield size={20} style={{ color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }} />
    </div>
    <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>{text}</p>
  </div>
);

const ConfirmModal = ({ message, onConfirm, onCancel, loading }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
  >
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="card w-full max-w-sm p-6"
    >
      <div className="flex items-start gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--error), transparent 88%)', color: 'var(--error)' }}
        >
          <AlertTriangle size={18} />
        </div>
        <div>
          <p className="font-montserrat text-base font-bold mb-1" style={{ color: 'var(--base-content)' }}>
            Confirm Action
          </p>
          <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
            {message}
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn btn-ghost btn-sm flex-1">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="btn btn-error btn-sm flex-1"
        >
          {loading ? <span className="loading loading-spinner loading-xs" /> : 'Confirm'}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// ─── NAV TABS ─────────────────────────────────────────────────────────────────

const NAV = [
  { id: 'active-sessions', name: 'Active Sessions',   icon: Clock,            section: 'sessions' },
  { id: 'revoke-session',  name: 'Revoke Session',    icon: LogOut,           section: 'sessions' },
  { id: 'revoke-all',      name: 'Revoke All',        icon: ShieldCheck,      section: 'sessions' },
  { id: 'all-devices',     name: 'All Devices',       icon: MonitorSmartphone,section: 'devices'  },
  { id: 'remove-device',   name: 'Remove Device',     icon: Laptop,           section: 'devices'  },
  { id: 'remove-all',      name: 'Remove All',        icon: Trash2,           section: 'devices'  },
];

// ─── SessionCard ─────────────────────────────────────────────────────────────

const SessionCard = ({ session, onRevoke, revoking }) => {
  const PlatIcon = platformIcon(session.platform);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-start gap-3 rounded-xl px-4 py-3 mb-3"
      style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'color-mix(in srgb, var(--primary), transparent 88%)', color: 'var(--primary)' }}
      >
        <PlatIcon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--base-content)' }}>
          {session.deviceName || 'Unknown Device'}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          <span className="text-xs flex items-center gap-1" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            <Globe size={10} /> {session.ipAddress || '—'}
          </span>
          <span className="text-xs flex items-center gap-1" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            <Clock size={10} /> {relTime(session.lastActiveAt || session.createdAt)}
          </span>
          {session.platform && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-semibold capitalize"
              style={{ background: 'color-mix(in srgb, var(--accent), transparent 88%)', color: 'var(--accent)' }}
            >
              {session.platform}
            </span>
          )}
        </div>
        <p className="text-xs mt-1 font-mono" style={{ color: 'color-mix(in oklch, var(--base-content) 32%, transparent)' }}>
          Started {fmtDate(session.createdAt)}
        </p>
      </div>
      {onRevoke && (
        <button
          onClick={() => onRevoke(session._id)}
          disabled={revoking === session._id}
          className="btn btn-ghost btn-xs btn-circle flex-shrink-0"
          aria-label="Revoke session"
        >
          {revoking === session._id
            ? <span className="loading loading-spinner loading-xs" />
            : <X size={13} style={{ color: 'var(--error)' }} />}
        </button>
      )}
    </motion.div>
  );
};

// ─── DeviceCard ──────────────────────────────────────────────────────────────

const DeviceCard = ({ token, onRemove, removing }) => {
  const PlatIcon = platformIcon(token.platform);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-start gap-3 rounded-xl px-4 py-3 mb-3"
      style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'color-mix(in srgb, var(--secondary), transparent 88%)', color: 'var(--secondary)' }}
      >
        <PlatIcon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--base-content)' }}>
          {token.deviceName || 'Unknown Device'}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          <span className="text-xs flex items-center gap-1 capitalize" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            <MonitorSmartphone size={10} /> {token.platform || '—'}
          </span>
          <span className="text-xs flex items-center gap-1" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            <Wifi size={10} /> {token.ipAddress || '—'}
          </span>
          <span className="text-xs flex items-center gap-1" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            <Clock size={10} /> Last used {relTime(token.lastUsedAt)}
          </span>
        </div>
        <p className="text-xs mt-1 font-mono truncate" style={{ color: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }}>
          Token: {token.token ? token.token.slice(0, 24) + '…' : '—'}
        </p>
      </div>
      {onRemove && (
        <button
          onClick={() => onRemove(token._id)}
          disabled={removing === token._id}
          className="btn btn-ghost btn-xs btn-circle flex-shrink-0"
          aria-label="Remove device"
        >
          {removing === token._id
            ? <span className="loading loading-spinner loading-xs" />
            : <X size={13} style={{ color: 'var(--error)' }} />}
        </button>
      )}
    </motion.div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function SessionsDevicesPage() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { sessions, loading } = useSelector((s) => s.transportPartner);

  const [activeTab,      setActiveTab]      = useState('active-sessions');
  const [revoking,       setRevoking]       = useState(null);   // sessionId
  const [removing,       setRemoving]       = useState(null);   // tokenId
  const [confirm,        setConfirm]        = useState(null);   // { type: 'revoke-all' | 'remove-all' }
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [successMsg,     setSuccessMsg]     = useState('');

  // load sessions on mount
  useEffect(() => { dispatch(fetchTPSessions()); }, [dispatch]);

  const auditSessions = sessions?.auditSessions || [];
  const deviceTokens  = sessions?.deviceTokens  || [];

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // ── handlers ─────────────────────────────────────────────────────────────

  const handleRevokeOne = async (sessionId) => {
    setRevoking(sessionId);
    await dispatch(revokeTPSession(sessionId));
    setRevoking(null);
    flash('Session revoked successfully.');
  };

  const handleRevokeAll = async () => {
    setConfirmLoading(true);
    await dispatch(revokeAllTPSessions());
    setConfirmLoading(false);
    setConfirm(null);
    flash('All sessions revoked.');
  };

  const handleRemoveDevice = async (tokenId) => {
    setRemoving(tokenId);
    await dispatch(removeTPDeviceToken(tokenId));
    setRemoving(null);
    flash('Device removed successfully.');
  };

  const handleRemoveAll = async () => {
    setConfirmLoading(true);
    // remove all tokens one-by-one (no bulk endpoint on slice)
    for (const t of deviceTokens) {
      await dispatch(removeTPDeviceToken(t._id));
    }
    setConfirmLoading(false);
    setConfirm(null);
    flash('All devices removed.');
  };

  // ── section content renderer ──────────────────────────────────────────────

  const renderSection = () => {
    switch (activeTab) {

      // §1 Active Sessions ─────────────────────────────────────────────────
      case 'active-sessions':
        return (
          <motion.div key="active-sessions" {...sectionAnim}>
            <SectionHeader
              icon={Clock}
              title="Active Sessions"
              subtitle="Devices currently logged in to your account"
              count={auditSessions.length}
              accent="var(--primary)"
            />
            {loading && auditSessions.length === 0 ? (
              <Skeleton rows={3} />
            ) : auditSessions.length === 0 ? (
              <EmptySlate text="No active sessions found." />
            ) : (
              <AnimatePresence>
                {auditSessions.map((s) => (
                  <SessionCard key={s._id} session={s} />
                ))}
              </AnimatePresence>
            )}
            <InfoNote>
              Each entry represents a unique login session. Sessions expire automatically when you log out or the token expires.
            </InfoNote>
          </motion.div>
        );

      // §2 Revoke Session ──────────────────────────────────────────────────
      case 'revoke-session':
        return (
          <motion.div key="revoke-session" {...sectionAnim}>
            <SectionHeader
              icon={LogOut}
              title="Revoke Session"
              subtitle="Tap ✕ on a session to log it out remotely"
              count={auditSessions.length}
              accent="var(--warning)"
            />
            {loading && auditSessions.length === 0 ? (
              <Skeleton rows={3} />
            ) : auditSessions.length === 0 ? (
              <EmptySlate text="No sessions to revoke." />
            ) : (
              <AnimatePresence>
                {auditSessions.map((s) => (
                  <SessionCard
                    key={s._id}
                    session={s}
                    onRevoke={handleRevokeOne}
                    revoking={revoking}
                  />
                ))}
              </AnimatePresence>
            )}
            <InfoNote>
              Revoking a session immediately invalidates that login token. The user will be forced to log in again on that device.
            </InfoNote>
          </motion.div>
        );

      // §3 Revoke All ──────────────────────────────────────────────────────
      case 'revoke-all':
        return (
          <motion.div key="revoke-all" {...sectionAnim}>
            <SectionHeader
              icon={ShieldCheck}
              title="Revoke All Sessions"
              subtitle="Instantly log out from every device"
              accent="var(--error)"
            />

            {/* summary card */}
            <div
              className="rounded-2xl p-5 mb-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--error), transparent 88%) 0%, color-mix(in srgb, var(--warning), transparent 90%) 100%)',
                border: '1px solid color-mix(in srgb, var(--error), transparent 70%)',
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--error), transparent 80%)', color: 'var(--error)' }}
                >
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <p className="font-montserrat text-2xl font-black" style={{ color: 'var(--error)' }}>
                    {auditSessions.length}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>
                    Active {auditSessions.length === 1 ? 'session' : 'sessions'} will be revoked
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                    This cannot be undone. You will remain logged in on this device.
                  </p>
                </div>
              </div>
            </div>

            <button
              disabled={auditSessions.length === 0 || loading}
              onClick={() => setConfirm({ type: 'revoke-all' })}
              className="btn btn-error w-full btn-lg mb-4"
            >
              <ShieldCheck size={17} /> Revoke All Sessions
            </button>

            {auditSessions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                  Sessions to be revoked
                </p>
                {auditSessions.map((s) => (
                  <SessionCard key={s._id} session={s} />
                ))}
              </div>
            )}

            <InfoNote accent="var(--error)">
              Use this if you suspect unauthorized access. All other sessions will be immediately terminated.
            </InfoNote>
          </motion.div>
        );

      // §4 All Devices ─────────────────────────────────────────────────────
      case 'all-devices':
        return (
          <motion.div key="all-devices" {...sectionAnim}>
            <SectionHeader
              icon={MonitorSmartphone}
              title="All Devices"
              subtitle="Push-notification tokens registered to your account"
              count={deviceTokens.length}
              accent="var(--secondary)"
            />
            {loading && deviceTokens.length === 0 ? (
              <Skeleton rows={3} />
            ) : deviceTokens.length === 0 ? (
              <EmptySlate text="No devices registered." />
            ) : (
              <AnimatePresence>
                {deviceTokens.map((t) => (
                  <DeviceCard key={t._id} token={t} />
                ))}
              </AnimatePresence>
            )}
            <InfoNote>
              Each device shown has a push-notification token registered. Removing a device stops push notifications on that device.
            </InfoNote>
          </motion.div>
        );

      // §5 Remove Device ───────────────────────────────────────────────────
      case 'remove-device':
        return (
          <motion.div key="remove-device" {...sectionAnim}>
            <SectionHeader
              icon={Laptop}
              title="Remove Device"
              subtitle="Tap ✕ to remove a device's push token"
              count={deviceTokens.length}
              accent="var(--warning)"
            />
            {loading && deviceTokens.length === 0 ? (
              <Skeleton rows={3} />
            ) : deviceTokens.length === 0 ? (
              <EmptySlate text="No devices to remove." />
            ) : (
              <AnimatePresence>
                {deviceTokens.map((t) => (
                  <DeviceCard
                    key={t._id}
                    token={t}
                    onRemove={handleRemoveDevice}
                    removing={removing}
                  />
                ))}
              </AnimatePresence>
            )}
            <InfoNote>
              Removing a device only revokes its push-notification token. Your login session on that device remains active.
            </InfoNote>
          </motion.div>
        );

      // §6 Remove All Devices ──────────────────────────────────────────────
      case 'remove-all':
        return (
          <motion.div key="remove-all" {...sectionAnim}>
            <SectionHeader
              icon={Trash2}
              title="Remove All Devices"
              subtitle="Unregister all push-notification tokens"
              accent="var(--error)"
            />

            <div
              className="rounded-2xl p-5 mb-5"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--error), transparent 90%) 0%, color-mix(in srgb, var(--warning), transparent 92%) 100%)',
                border: '1px solid color-mix(in srgb, var(--error), transparent 72%)',
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--error), transparent 80%)', color: 'var(--error)' }}
                >
                  <Trash2 size={26} />
                </div>
                <div>
                  <p className="font-montserrat text-2xl font-black" style={{ color: 'var(--error)' }}>
                    {deviceTokens.length}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>
                    {deviceTokens.length === 1 ? 'Device' : 'Devices'} will lose push notifications
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                    You can re-enable notifications by logging in again on each device.
                  </p>
                </div>
              </div>
            </div>

            <button
              disabled={deviceTokens.length === 0 || loading}
              onClick={() => setConfirm({ type: 'remove-all' })}
              className="btn btn-error w-full btn-lg mb-4"
            >
              <Trash2 size={17} /> Remove All Devices
            </button>

            {deviceTokens.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                  Devices to be removed
                </p>
                {deviceTokens.map((t) => (
                  <DeviceCard key={t._id} token={t} />
                ))}
              </div>
            )}

            <InfoNote accent="var(--error)">
              This removes all push-notification tokens. You will stop receiving ride requests and alerts until you log in again on each device.
            </InfoNote>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-30"
        style={{
          background: 'color-mix(in srgb, var(--base-100) 85%, transparent)',
          backdropFilter: 'blur(18px) saturate(160%)',
          borderBottom: '1px solid color-mix(in srgb, var(--base-300), transparent 30%)',
        }}
      >
        <div className="container-custom max-w-3xl mx-auto flex items-center gap-3 py-4">
          <button
            onClick={() => router.back()}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-montserrat text-lg font-black" style={{ color: 'var(--base-content)' }}>
              Sessions &amp; Devices
            </h1>
            <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
              {auditSessions.length} sessions · {deviceTokens.length} devices
            </p>
          </div>

          <button
            onClick={() => dispatch(fetchTPSessions())}
            disabled={loading}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* ── Tab rail ─────────────────────────────────────────────────── */}
        <div className="container-custom max-w-3xl mx-auto pb-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-0.5">
            {NAV.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0"
                  style={{
                    background: active ? 'var(--primary)' : 'var(--base-200)',
                    color: active ? 'var(--primary-content)' : 'color-mix(in oklch, var(--base-content) 60%, transparent)',
                    border: `1px solid ${active ? 'var(--primary)' : 'var(--base-300)'}`,
                    boxShadow: active ? '0 4px 12px color-mix(in srgb, var(--primary), transparent 65%)' : 'none',
                  }}
                >
                  <Icon size={13} />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="container-custom max-w-3xl mx-auto px-4 py-5">

        {/* success flash */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--success), transparent 88%)',
                border: '1px solid color-mix(in srgb, var(--success), transparent 65%)',
                color: 'var(--success)',
              }}
            >
              <CheckCircle2 size={15} /> {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* section panel */}
        <AnimatePresence mode="wait">
          {renderSection()}
        </AnimatePresence>

        {/* last login meta */}
        {sessions?.lastLoginAt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 rounded-xl px-4 py-3 mt-2 text-xs"
            style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
          >
            <Calendar size={12} style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
              Last login: <strong>{fmtDate(sessions.lastLoginAt)}</strong>
            </span>
            {sessions.lastLoginIp && (
              <>
                <span style={{ color: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }}>·</span>
                <MapPin size={10} style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
                <span className="font-mono" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                  {sessions.lastLoginIp}
                </span>
              </>
            )}
            {sessions.loginCount != null && (
              <>
                <span style={{ color: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }}>·</span>
                <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                  {sessions.loginCount} total logins
                </span>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Confirm modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            message={
              confirm.type === 'revoke-all'
                ? `This will revoke all ${auditSessions.length} active sessions immediately. You will remain logged in here.`
                : `This will remove all ${deviceTokens.length} device tokens. Push notifications will stop on all devices.`
            }
            onConfirm={confirm.type === 'revoke-all' ? handleRevokeAll : handleRemoveAll}
            onCancel={() => setConfirm(null)}
            loading={confirmLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── tiny local helpers ───────────────────────────────────────────────────────

const sectionAnim = {
  initial:    { opacity: 0, y: 14 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -10 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
};

const InfoNote = ({ children, accent }) => (
  <div
    className="flex items-start gap-2 rounded-xl px-4 py-3 mt-4 text-xs"
    style={{
      background: `color-mix(in srgb, ${accent || 'var(--info)'}, transparent 92%)`,
      border: `1px solid color-mix(in srgb, ${accent || 'var(--info)'}, transparent 72%)`,
    }}
  >
    <AlertCircle size={12} className="flex-shrink-0 mt-0.5" style={{ color: accent || 'var(--info)' }} />
    <span style={{ color: 'color-mix(in oklch, var(--base-content) 65%, transparent)' }}>{children}</span>
  </div>
);

const Skeleton = ({ rows = 3 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--base-200)' }}>
        <div className="skeleton w-9 h-9 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-3 w-1/3 rounded" />
          <div className="skeleton h-3 w-2/3 rounded" />
          <div className="skeleton h-3 w-1/4 rounded" />
        </div>
      </div>
    ))}
  </div>
);