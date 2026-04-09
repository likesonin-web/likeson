"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, LogOut, ShieldCheck, MonitorSmartphone, Laptop,
  Trash2, ChevronRight, Building2, AlertTriangle, Check,
  Shield, Loader2, X, Smartphone, Globe, Monitor,
  MapPin, RefreshCw, ChromeIcon, Apple
} from "lucide-react";
import {
  fetchSessions, revokeSession, logoutAllDevices,
  fetchDevices, removeDevice, removeAllDevices,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";

/* ─── Nav config ──────────────────────────────────────────────────────────── */
const NAV_LINKS = [
  { name: "Active Sessions", href: "/pharmacy-store/audit/sessions",        icon: Clock             },
  { name: "Revoke Session",  href: "/pharmacy-store/audit/sessions/revoke", icon: LogOut            },
  { name: "Revoke All",      href: "/pharmacy-store/audit/all-sessions",    icon: ShieldCheck       },
  { name: "All Devices",     href: "/pharmacy-store/audit/devices",         icon: MonitorSmartphone },
  { name: "Remove Device",   href: "/pharmacy-store/audit/devices/remove",  icon: Laptop            },
  { name: "Remove All",      href: "/pharmacy-store/audit/devices/all",     icon: Trash2            },
];

/* ─── Motion presets ──────────────────────────────────────────────────────── */
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function timeAgo(date) {
  if (!date) return "Unknown";
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "Just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function platformIcon(platform) {
  switch (platform) {
    case "android": return <Smartphone size={16} />;
    case "ios":     return <Apple size={16} />;
    case "web":     return <Globe size={16} />;
    case "desktop": return <Monitor size={16} />;
    default:        return <Monitor size={16} />;
  }
}

function platformColor(platform) {
  switch (platform) {
    case "android": return "success";
    case "ios":     return "info";
    case "web":     return "primary";
    case "desktop": return "secondary";
    default:        return "neutral";
  }
}

function EmptyState({ icon: Icon, title, subtitle, color = "primary" }) {
  return (
    <div className="p-12 text-center">
      <div className={`p-4 rounded-2xl bg-${color}/10 text-${color} w-fit mx-auto mb-4`}>
        <Icon size={28} />
      </div>
      <h4 className="font-bold text-base-content mb-1">{title}</h4>
      <p className="text-sm text-base-content/50">{subtitle}</p>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, confirmColor = "error",
    onConfirm, onCancel, loading }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-base-100 border border-base-300 shadow-2xl overflow-hidden">
        <div className={`p-6 border-b border-${confirmColor}/20 bg-${confirmColor}/5`}>
          <div className={`p-3 rounded-xl bg-${confirmColor}/15 text-${confirmColor} w-fit mb-3`}>
            <AlertTriangle size={22} />
          </div>
          <h3 className="font-black text-lg text-base-content font-montserrat">{title}</h3>
          <p className="text-sm text-base-content/60 mt-1">{message}</p>
        </div>
        <div className="p-4 flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-base-300 text-sm font-bold
              text-base-content/70 hover:bg-base-200 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all
              bg-${confirmColor} text-${confirmColor === "warning" ? "warning-content" : `${confirmColor}-content`}
              hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2`}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Section: Active Sessions ─────────────────────────────────────────────── */
function ActiveSessions({ dispatch }) {
  const { sessions, loading, success } = useSelector(s => s.pharmacyStore);

  useEffect(() => {
    dispatch(fetchSessions());
  }, []);

  const refresh = () => dispatch(fetchSessions());

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      {/* Header card */}
      <motion.div variants={fadeUp}
        className="rounded-2xl bg-gradient-to-br from-primary/8 to-base-100 border border-primary/20 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Clock size={20} /></div>
          <div>
            <h3 className="font-black text-base text-base-content font-montserrat">Active Sessions</h3>
            <p className="text-xs text-base-content/50">{sessions.length} active session{sessions.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button onClick={refresh} disabled={loading.sessions}
          className="p-2 rounded-xl hover:bg-base-200 text-base-content/50 hover:text-primary
            transition-colors disabled:opacity-40">
          <RefreshCw size={16} className={loading.sessions ? "animate-spin" : ""} />
        </button>
      </motion.div>

      {loading.sessions && sessions.length === 0 ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />)}
        </div>
      ) : sessions.length === 0 ? (
        <motion.div variants={fadeUp} className="rounded-2xl border border-base-300/60 bg-base-100 shadow-sm">
          <EmptyState icon={Shield} title="No Active Sessions"
            subtitle="You don't have any active sessions" color="success" />
        </motion.div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => {
            const color = platformColor(s.platform);
            return (
              <motion.div key={s._id} variants={fadeUp}
                className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm
                  hover:border-primary/30 transition-all group">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl bg-${color}/10 text-${color} shrink-0 mt-0.5
                    group-hover:scale-110 transition-transform`}>
                    {platformIcon(s.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-base-content">{s.deviceName}</span>
                      {i === 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-success/15 text-success
                          border border-success/30">Current</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-base-content/50">
                      <span className={`inline-flex items-center gap-1 capitalize px-2 py-0.5 rounded-full
                        bg-${color}/10 text-${color} font-semibold`}>
                        {platformIcon(s.platform)} {s.platform}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {s.ipAddress}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> Last active {timeAgo(s.lastActiveAt)}
                      </span>
                    </div>
                    <p className="text-xs text-base-content/40 mt-2 truncate">{s.userAgent}</p>
                  </div>
                  <div className="text-xs text-base-content/40 shrink-0">
                    {timeAgo(s.createdAt)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Section: Revoke Session ─────────────────────────────────────────────── */
function RevokeSession({ dispatch }) {
  const { sessions, loading, success } = useSelector(s => s.pharmacyStore);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (!sessions.length) dispatch(fetchSessions());
  }, []);

  const handleRevoke = async (sessionId) => {
    await dispatch(revokeSession(sessionId));
    setConfirm(null);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            title="Revoke Session?"
            message={`This will sign out the session on "${confirm.deviceName}". The device will need to sign in again.`}
            confirmLabel="Revoke Session"
            confirmColor="error"
            loading={loading.sessions}
            onConfirm={() => handleRevoke(confirm._id)}
            onCancel={() => setConfirm(null)} />
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp}
        className="rounded-2xl bg-gradient-to-br from-error/8 to-base-100 border border-error/20 p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-error/10 text-error"><LogOut size={20} /></div>
          <div>
            <h3 className="font-black text-base text-base-content font-montserrat">Revoke Session</h3>
            <p className="text-xs text-base-content/50">Sign out from specific devices</p>
          </div>
        </div>
      </motion.div>

      {sessions.length === 0 ? (
        <motion.div variants={fadeUp} className="rounded-2xl border border-base-300/60 bg-base-100 shadow-sm">
          <EmptyState icon={ShieldCheck} title="No Sessions to Revoke"
            subtitle="You don't have any active sessions" color="success" />
        </motion.div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => {
            const color = platformColor(s.platform);
            return (
              <motion.div key={s._id} variants={fadeUp}
                className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm
                  hover:border-error/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-${color}/10 text-${color} shrink-0
                    group-hover:scale-110 transition-transform`}>
                    {platformIcon(s.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-base-content">{s.deviceName}</span>
                      {i === 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-success/15 text-success
                          border border-success/30">Current</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-base-content/50">
                      <span className="capitalize">{s.platform}</span>
                      <span>{s.ipAddress}</span>
                      <span>{timeAgo(s.lastActiveAt)}</span>
                    </div>
                  </div>
                  <button onClick={() => setConfirm(s)}
                    disabled={i === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold
                      bg-error/10 text-error border border-error/20 hover:bg-error hover:text-error-content
                      transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    <LogOut size={13} /> Revoke
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Section: Revoke All ─────────────────────────────────────────────────── */
function RevokeAll({ dispatch }) {
  const { sessions, loading, success } = useSelector(s => s.pharmacyStore);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!sessions.length) dispatch(fetchSessions());
  }, []);

  const handleRevokeAll = async () => {
    await dispatch(logoutAllDevices());
    setShowConfirm(false);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <AnimatePresence>
        {showConfirm && (
          <ConfirmDialog
            title="Revoke All Sessions?"
            message="This will sign you out from all devices and sessions. You'll need to log in again everywhere."
            confirmLabel="Revoke Everything"
            confirmColor="error"
            loading={loading.sessions}
            onConfirm={handleRevokeAll}
            onCancel={() => setShowConfirm(false)} />
        )}
      </AnimatePresence>

      {/* Warning card */}
      <motion.div variants={fadeUp}
        className="rounded-2xl border border-error/30 bg-gradient-to-br from-error/8 to-base-100 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-error/15 text-error shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-lg text-base-content font-montserrat mb-1">
              Revoke All Sessions
            </h3>
            <p className="text-sm text-base-content/60 leading-relaxed">
              This action will immediately sign you out from every device and browser. 
              Use this if you suspect unauthorized access to your account.
            </p>
            <div className="grid grid-cols-3 gap-3 mt-5 mb-5">
              {[
                { label: "Sessions",   value: sessions.length,                                   icon: Clock  },
                { label: "Platforms",  value: [...new Set(sessions.map(s => s.platform))].length, icon: Globe  },
                { label: "Devices",    value: [...new Set(sessions.map(s => s.deviceName))].length,icon: Monitor },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="p-3 rounded-xl bg-base-200/70 text-center border border-base-300/50">
                  <Icon size={16} className="mx-auto mb-1 text-error/70" />
                  <div className="text-xl font-black text-base-content font-montserrat">{value}</div>
                  <div className="text-xs text-base-content/50">{label}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowConfirm(true)} disabled={sessions.length === 0}
              className="w-full py-3 rounded-xl font-bold text-sm bg-error text-error-content
                hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2">
              <ShieldCheck size={16} /> Revoke All Sessions
            </button>
          </div>
        </div>
      </motion.div>

      {/* Session list preview */}
      {sessions.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 px-1">
            Sessions that will be revoked
          </p>
          {sessions.slice(0, 5).map((s, i) => {
            const color = platformColor(s.platform);
            return (
              <div key={s._id}
                className="flex items-center gap-3 p-4 rounded-xl border border-base-300/50 bg-base-200/40">
                <div className={`p-2 rounded-lg bg-${color}/10 text-${color}`}>
                  {platformIcon(s.platform)}
                </div>
                <div className="flex-1 text-sm">
                  <span className="font-semibold text-base-content">{s.deviceName}</span>
                  <span className="text-base-content/40 ml-2">{timeAgo(s.lastActiveAt)}</span>
                </div>
                {i === 0 && <span className="text-xs font-bold text-success">(Current)</span>}
              </div>
            );
          })}
          {sessions.length > 5 && (
            <p className="text-xs text-base-content/40 text-center py-1">
              +{sessions.length - 5} more session{sessions.length - 5 !== 1 ? "s" : ""}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Section: All Devices ────────────────────────────────────────────────── */
function AllDevices({ dispatch }) {
  const { devices, loading } = useSelector(s => s.pharmacyStore);

  useEffect(() => {
    dispatch(fetchDevices());
  }, []);

  const refresh = () => dispatch(fetchDevices());

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}
        className="rounded-2xl bg-gradient-to-br from-secondary/8 to-base-100 border border-secondary/20 p-5
          flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-secondary/10 text-secondary"><MonitorSmartphone size={20} /></div>
          <div>
            <h3 className="font-black text-base text-base-content font-montserrat">Registered Devices</h3>
            <p className="text-xs text-base-content/50">{devices.length} device{devices.length !== 1 ? "s" : ""} with push access</p>
          </div>
        </div>
        <button onClick={refresh} disabled={loading.devices}
          className="p-2 rounded-xl hover:bg-base-200 text-base-content/50 hover:text-primary
            transition-colors disabled:opacity-40">
          <RefreshCw size={16} className={loading.devices ? "animate-spin" : ""} />
        </button>
      </motion.div>

      {loading.devices && devices.length === 0 ? (
        <div className="grid gap-3">
          {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />)}
        </div>
      ) : devices.length === 0 ? (
        <motion.div variants={fadeUp} className="rounded-2xl border border-base-300/60 bg-base-100 shadow-sm">
          <EmptyState icon={MonitorSmartphone} title="No Devices Registered"
            subtitle="No devices have push notification access" color="secondary" />
        </motion.div>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const color = platformColor(d.platform);
            return (
              <motion.div key={d._id} variants={fadeUp}
                className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm
                  hover:border-secondary/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-${color}/10 text-${color} shrink-0
                    group-hover:scale-110 transition-transform`}>
                    {platformIcon(d.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-base-content mb-1">{d.deviceName}</div>
                    <div className="flex flex-wrap gap-2 text-xs text-base-content/50">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                        bg-${color}/10 text-${color} font-semibold capitalize`}>
                        {d.platform}
                      </span>
                      {d.ipAddress && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={10} /> {d.ipAddress}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} /> Used {timeAgo(d.lastUsedAt)}
                      </span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold
                    bg-${color}/15 text-${color} border border-${color}/30 capitalize`}>
                    {d.platform}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Section: Remove Device ──────────────────────────────────────────────── */
function RemoveDevice({ dispatch }) {
  const { devices, loading, success } = useSelector(s => s.pharmacyStore);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (!devices.length) dispatch(fetchDevices());
  }, []);

  const handleRemove = async (deviceId) => {
    await dispatch(removeDevice(deviceId));
    setConfirm(null);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            title="Remove Device?"
            message={`"${confirm.deviceName}" will lose push notification access.`}
            confirmLabel="Remove Device"
            confirmColor="warning"
            loading={loading.devices}
            onConfirm={() => handleRemove(confirm._id)}
            onCancel={() => setConfirm(null)} />
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp}
        className="rounded-2xl bg-gradient-to-br from-warning/8 to-base-100 border border-warning/20 p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-warning/10 text-warning"><Laptop size={20} /></div>
          <div>
            <h3 className="font-black text-base text-base-content font-montserrat">Remove Device</h3>
            <p className="text-xs text-base-content/50">Revoke push notification access per device</p>
          </div>
        </div>
      </motion.div>

      {devices.length === 0 ? (
        <motion.div variants={fadeUp} className="rounded-2xl border border-base-300/60 bg-base-100 shadow-sm">
          <EmptyState icon={ShieldCheck} title="No Devices to Remove"
            subtitle="No registered devices found" color="success" />
        </motion.div>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const color = platformColor(d.platform);
            return (
              <motion.div key={d._id} variants={fadeUp}
                className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm
                  hover:border-warning/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-${color}/10 text-${color} shrink-0
                    group-hover:scale-110 transition-transform`}>
                    {platformIcon(d.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-base-content">{d.deviceName}</div>
                    <div className="flex gap-3 mt-1 text-xs text-base-content/50">
                      <span className="capitalize">{d.platform}</span>
                      {d.ipAddress && <span>{d.ipAddress}</span>}
                      <span>{timeAgo(d.lastUsedAt)}</span>
                    </div>
                  </div>
                  <button onClick={() => setConfirm(d)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold
                      bg-warning/10 text-warning border border-warning/20 hover:bg-warning hover:text-warning-content
                      transition-all">
                    <X size={13} /> Remove
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Section: Remove All Devices ─────────────────────────────────────────── */
function RemoveAllDevices({ dispatch }) {
  const { devices, loading, success } = useSelector(s => s.pharmacyStore);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!devices.length) dispatch(fetchDevices());
  }, []);

  const handleRemoveAll = async () => {
    await dispatch(removeAllDevices());
    setShowConfirm(false);
  };

  const platforms = [...new Set(devices.map(d => d.platform))];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <AnimatePresence>
        {showConfirm && (
          <ConfirmDialog
            title="Remove All Devices?"
            message="All registered devices will lose push notification access. This cannot be undone."
            confirmLabel="Remove All"
            confirmColor="error"
            loading={loading.devices}
            onConfirm={handleRemoveAll}
            onCancel={() => setShowConfirm(false)} />
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp}
        className="rounded-2xl border border-error/30 bg-gradient-to-br from-error/8 to-base-100 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-error/15 text-error shrink-0">
            <Trash2 size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-lg text-base-content font-montserrat mb-1">
              Remove All Devices
            </h3>
            <p className="text-sm text-base-content/60 leading-relaxed">
              Remove all registered devices from push notification access. 
              Devices will no longer receive real-time alerts from your pharmacy store.
            </p>

            {/* Platform breakdown */}
            {devices.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
                {[
                  { label: "Total Devices",  value: devices.length,          icon: MonitorSmartphone },
                  { label: "Android",        value: devices.filter(d => d.platform === "android").length, icon: Smartphone },
                  { label: "iOS",            value: devices.filter(d => d.platform === "ios").length,     icon: Smartphone },
                  { label: "Web / Desktop",  value: devices.filter(d => ["web","desktop"].includes(d.platform)).length, icon: Globe },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="p-3 rounded-xl bg-base-200/70 text-center border border-base-300/50">
                    <Icon size={15} className="mx-auto mb-1 text-error/60" />
                    <div className="text-xl font-black text-base-content font-montserrat">{value}</div>
                    <div className="text-xs text-base-content/50">{label}</div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setShowConfirm(true)} disabled={devices.length === 0}
              className="w-full py-3 rounded-xl font-bold text-sm bg-error text-error-content
                hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2">
              <Trash2 size={16} /> Remove All {devices.length} Devices
            </button>
          </div>
        </div>
      </motion.div>

      {/* Device preview */}
      {devices.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 px-1">
            Devices that will be removed
          </p>
          {devices.slice(0, 5).map((d) => {
            const color = platformColor(d.platform);
            return (
              <div key={d._id}
                className="flex items-center gap-3 p-4 rounded-xl border border-base-300/50 bg-base-200/40">
                <div className={`p-2 rounded-lg bg-${color}/10 text-${color}`}>
                  {platformIcon(d.platform)}
                </div>
                <div className="flex-1 text-sm">
                  <span className="font-semibold text-base-content">{d.deviceName}</span>
                  <span className="text-base-content/40 ml-2 capitalize">{d.platform}</span>
                </div>
                <span className="text-xs text-base-content/40">{timeAgo(d.lastUsedAt)}</span>
              </div>
            );
          })}
          {devices.length > 5 && (
            <p className="text-xs text-base-content/40 text-center py-1">
              +{devices.length - 5} more device{devices.length - 5 !== 1 ? "s" : ""}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
const SECTION_MAP = {
  "sessions":              "Active Sessions",
  "sessions/revoke":       "Revoke Session",
  "all-sessions":          "Revoke All",
  "devices":               "All Devices",
  "devices/remove":        "Remove Device",
  "devices/all":           "Remove All",
};

function Sidebar({ activeSection, onNavigate }) {
  const groups = [
    { title: "Sessions", links: NAV_LINKS.slice(0, 3) },
    { title: "Devices",  links: NAV_LINKS.slice(3, 6) },
  ];

  return (
    <nav className="space-y-4">
      {groups.map(({ title, links }) => (
        <div key={title}>
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/30 px-2 mb-1.5">{title}</p>
          <div className="space-y-1">
            {links.map(({ name, href, icon: Icon }) => {
              const section = href.split("/pharmacy-store/audit/")[1];
              const isActive = activeSection === section;
              const isDanger = ["all-sessions", "devices/remove", "devices/all"].includes(section);
              return (
                <button key={href} onClick={() => onNavigate(section)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
                    transition-all duration-200 group text-left
                    ${isActive
                      ? isDanger
                        ? "bg-error text-error-content shadow-sm"
                        : "bg-primary text-primary-content shadow-sm"
                      : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
                    }`}>
                  <Icon size={17} className={isActive ? "opacity-90"
                    : isDanger ? "text-error/60 group-hover:text-error"
                    : "text-base-content/50 group-hover:text-primary"} />
                  <span className="flex-1">{name}</span>
                  <ChevronRight size={14} className={`transition-transform
                    ${isActive ? "opacity-60" : "text-base-content/30"}`} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function SessionsDevicesPage({ params }) {
  const dispatch = useDispatch();
  const rawSection = params?.section?.join("/") ?? "sessions";
  const [activeSection, setActiveSection] = useState(rawSection);

  const renderContent = () => {
    switch (activeSection) {
      case "sessions":        return <ActiveSessions dispatch={dispatch} />;
      case "sessions/revoke": return <RevokeSession  dispatch={dispatch} />;
      case "all-sessions":    return <RevokeAll      dispatch={dispatch} />;
      case "devices":         return <AllDevices     dispatch={dispatch} />;
      case "devices/remove":  return <RemoveDevice   dispatch={dispatch} />;
      case "devices/all":     return <RemoveAllDevices dispatch={dispatch} />;
      default:                return <ActiveSessions dispatch={dispatch} />;
    }
  };

  const currentLink = NAV_LINKS.find(l => {
    const s = l.href.split("/pharmacy-store/audit/")[1];
    return s === activeSection;
  });

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-2 text-xs text-base-content/40 font-semibold uppercase tracking-widest mb-3">
            <Building2 size={13} />
            <span>Pharmacy Store</span>
            <ChevronRight size={12} />
            <span className="text-primary">Security</span>
          </div>
          <h1 className="text-3xl font-black text-base-content font-montserrat tracking-tight">
            Sessions &amp; Devices
          </h1>
          <p className="text-base-content/50 text-sm mt-1">
            Monitor and manage all active sessions and registered devices
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }} className="lg:sticky lg:top-6 h-fit">
            <div className="rounded-2xl border border-base-300/60 bg-base-100 p-4 mb-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Shield size={18} /></div>
                <div>
                  <p className="font-bold text-sm text-base-content">Security Center</p>
                  <p className="text-xs text-base-content/50">Account access control</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-base-300/60 bg-base-100 p-3 shadow-sm">
              <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />
            </div>
          </motion.div>

          {/* Content */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}>
            <AnimatePresence mode="wait">
              <motion.div key={activeSection}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center gap-2 mb-5">
                  {currentLink && (
                    <>
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <currentLink.icon size={16} />
                      </div>
                      <h2 className="font-black text-xl text-base-content font-montserrat">
                        {currentLink.name}
                      </h2>
                    </>
                  )}
                </div>
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}