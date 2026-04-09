"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  changePassword,
  fetchSessions,
  revokeSession,
  logoutAllDevices,
  fetchDevices,
  removeDevice,
  removeAllDevices,
  clearSuccess,
  clearError,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  Shield, Key, Smartphone, Monitor, Laptop, LogOut,
  Trash2, Trash, Eye, EyeOff, Lock, CheckCircle2, X,
  Loader2, Sparkles, AlertTriangle, Clock, MapPin, Globe,
  RefreshCw, ShieldCheck, ShieldAlert, Wifi, Power,
} from "lucide-react";

/* ── Variants ─────────────────────────────────────────────── */
const fadeUp  = { hidden:{ opacity:0, y:20 }, show:{ opacity:1, y:0, transition:{ type:"spring", stiffness:260, damping:22 } } };
const stagger = { hidden:{}, show:{ transition:{ staggerChildren:0.07 } } };
const rowAnim = { hidden:{ opacity:0, x:-10 }, show:{ opacity:1, x:0, transition:{ type:"spring", stiffness:220, damping:20 } } };

/* ── Background ───────────────────────────────────────────── */
function SecBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage:"repeating-linear-gradient(45deg, var(--error) 0, var(--error) 1px, transparent 0, transparent 36px)" }} />
      <motion.div animate={{ opacity:[0.06,0.14,0.06], scale:[1,1.08,1] }} transition={{ duration:11, repeat:Infinity }}
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{ background:"radial-gradient(circle, var(--primary), transparent 65%)" }} />
      <motion.div animate={{ opacity:[0.04,0.1,0.04] }} transition={{ duration:9, repeat:Infinity, delay:5 }}
        className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl"
        style={{ background:"radial-gradient(circle, var(--error), transparent 65%)" }} />
    </div>
  );
}

/* ── Toast ────────────────────────────────────────────────── */
function Toast({ msg, type="success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div initial={{ opacity:0, y:30, scale:.95 }} animate={{ opacity:1, y:0, scale:1 }}
      exit={{ opacity:0, y:20, scale:.95 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-bold glass-card"
      style={{ border:`1.5px solid ${type==="success" ? "var(--success)":"var(--error)"}`, color: type==="success" ? "var(--success)":"var(--error)" }}>
      <CheckCircle2 size={15} /> {msg}
      <button onClick={onClose} className="ml-1 opacity-50 hover:opacity-100"><X size={12} /></button>
    </motion.div>
  );
}

/* ── Password input ───────────────────────────────────────── */
function PwdField({ label, value, onChange, placeholder, show, onToggle, error }) {
  return (
    <div>
      <label className="block text-xs font-black uppercase tracking-widest text-base-content/45 mb-1.5">
        <Lock size={10} className="inline mr-1" style={{ color:"var(--primary)" }} />{label}
      </label>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={`input-field w-full pr-10 text-sm ${error ? "border-error ring-error/30 ring-2" : ""}`} />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 transition-opacity">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {error && <p className="text-xs text-error mt-1 pl-1">{error}</p>}
    </div>
  );
}

/* ── Device icon ──────────────────────────────────────────── */
function DeviceIcon({ type }) {
  const t = (type||"").toLowerCase();
  if (t.includes("mobile") || t.includes("phone")) return <Smartphone size={16} style={{ color:"var(--primary)" }} />;
  if (t.includes("tablet"))                         return <Laptop     size={16} style={{ color:"var(--secondary)" }} />;
  return                                                   <Monitor    size={16} style={{ color:"var(--accent)" }} />;
}

/* ── Confirm modal ────────────────────────────────────────── */
function ConfirmModal({ title, msg, onConfirm, onCancel, loading, danger }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <motion.div initial={{ scale:.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
        exit={{ scale:.9, opacity:0 }}
        className="relative glass-card p-6 max-w-sm w-full z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl" style={{ background:`color-mix(in oklch,${danger ? "var(--error)":"var(--warning)"} 14%,var(--base-200))` }}>
            <AlertTriangle size={16} style={{ color: danger ? "var(--error)":"var(--warning)" }} />
          </div>
          <p className="font-black text-base text-base-content">{title}</p>
        </div>
        <p className="text-sm text-base-content/55 mb-5">{msg}</p>
        <div className="flex gap-3">
          <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-base-300 text-sm font-bold text-base-content/60 hover:bg-base-200 transition-all">
            Cancel
          </motion.button>
          <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}
            onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            style={{ background: danger ? "var(--error)":"var(--warning)", color: danger ? "var(--error-content)":"var(--warning-content)" }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            Confirm
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════ */
export default function Security() {
  const dispatch  = useDispatch();
  const reduxUser = useSelector((state) => state.user?.user) ?? null;
  const { sessions, devices, loading, success, errors } = useSelector((s) => s.pharmacyStore);

  /* ── Password form ── */
  const [curPwd,  setCurPwd ] = useState("");
  const [newPwd,  setNewPwd ] = useState("");
  const [confPwd, setConfPwd] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);
  const [pwdErrs, setPwdErrs] = useState({});

  /* ── Confirm modals ── */
  const [confirmLogoutAll,   setConfirmLogoutAll  ] = useState(false);
  const [confirmRemoveAll,   setConfirmRemoveAll  ] = useState(false);
  const [revokeTarget,       setRevokeTarget      ] = useState(null); // sessionId
  const [removeTarget,       setRemoveTarget      ] = useState(null); // deviceId

  /* ── Toast ── */
  const [toast, setToast] = useState(null);

  /* ── Active tab ── */
  const [tab, setTab] = useState("password");

  /* ── Fetch ── */
  useEffect(() => { dispatch(fetchSessions()); dispatch(fetchDevices()); }, [dispatch]);

  /* ── Success toasts ── */
  useEffect(() => {
    if (success.passwordChange) {
      setToast({ msg:"Password changed successfully!" }); setCurPwd(""); setNewPwd(""); setConfPwd("");
      dispatch(clearSuccess("passwordChange"));
    }
  }, [success.passwordChange, dispatch]);

  useEffect(() => {
    if (success.sessionRevoke)    { setToast({ msg:"Session revoked."          }); dispatch(clearSuccess("sessionRevoke"   )); setRevokeTarget(null);    }
    if (success.logoutAll)        { setToast({ msg:"Logged out from all devices." }); dispatch(clearSuccess("logoutAll"     )); setConfirmLogoutAll(false); }
    if (success.deviceRemove)     { setToast({ msg:"Device removed."            }); dispatch(clearSuccess("deviceRemove"   )); setRemoveTarget(null);    }
    if (success.allDevicesRemoved){ setToast({ msg:"All devices removed."       }); dispatch(clearSuccess("allDevicesRemoved")); setConfirmRemoveAll(false); }
  }, [success.sessionRevoke, success.logoutAll, success.deviceRemove, success.allDevicesRemoved, dispatch]);

  /* ── Password validation ── */
  const validatePwd = () => {
    const e = {};
    if (!curPwd.trim())        e.cur  = "Current password is required";
    if (newPwd.length < 8)     e.new  = "Minimum 8 characters";
    if (newPwd !== confPwd)    e.conf = "Passwords do not match";
    setPwdErrs(e);
    return !Object.keys(e).length;
  };

  const handlePwdSubmit = () => {
    if (!validatePwd()) return;
    dispatch(changePassword({ currentPassword:curPwd, newPassword:newPwd, confirmPassword:confPwd }));
  };

  /* ── Password strength ── */
  const strength = (() => {
    if (!newPwd) return 0;
    let s = 0;
    if (newPwd.length >= 8)                      s++;
    if (/[A-Z]/.test(newPwd))                    s++;
    if (/[0-9]/.test(newPwd))                    s++;
    if (/[^A-Za-z0-9]/.test(newPwd))             s++;
    return s;
  })();
  const strengthLabel = ["","Weak","Fair","Good","Strong"][strength];
  const strengthColor = ["","var(--error)","var(--warning)","var(--info)","var(--success)"][strength];

  const TABS = [
    { key:"password", label:"Password",  icon:Key       },
    { key:"sessions", label:"Sessions",  icon:Globe     },
    { key:"devices",  label:"Devices",   icon:Smartphone},
  ];

  return (
    <div className="min-h-screen" style={{ background:"var(--base-100)" }}>
      <SecBg />

      <AnimatePresence>
        {toast && <Toast key="toast" msg={toast.msg} type={toast.type||"success"} onClose={() => setToast(null)} />}
        {revokeTarget     && <ConfirmModal key="rev"  title="Revoke Session"     msg="This will log out the session immediately."        onConfirm={() => dispatch(revokeSession(revokeTarget))}      onCancel={() => setRevokeTarget(null)}       loading={loading.sessions} danger />}
        {removeTarget     && <ConfirmModal key="rem"  title="Remove Device"      msg="This device will no longer be trusted."            onConfirm={() => dispatch(removeDevice(removeTarget))}       onCancel={() => setRemoveTarget(null)}       loading={loading.devices}  danger />}
        {confirmLogoutAll && <ConfirmModal key="loa"  title="Logout All Devices" msg="You'll be logged out from every active session."   onConfirm={() => dispatch(logoutAllDevices())}               onCancel={() => setConfirmLogoutAll(false)}  loading={loading.sessions} danger />}
        {confirmRemoveAll && <ConfirmModal key="rma"  title="Remove All Devices" msg="All trusted devices will be removed."              onConfirm={() => dispatch(removeAllDevices())}               onCancel={() => setConfirmRemoveAll(false)}  loading={loading.devices}  danger />}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity:0, y:-18 }} animate={{ opacity:1, y:0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-error/80" />
            <span className="text-xs font-black uppercase tracking-widest text-error/60">Security Centre</span>
          </div>
          <h1 className="section-heading text-3xl lg:text-4xl">
            Security &amp; <span className="text-gradient-primary">Access</span>
          </h1>
          <p className="text-sm text-base-content/45 mt-1">Manage password, sessions &amp; trusted devices</p>
        </motion.div>

        {/* ── Security score strip ── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label:"Password",  value: curPwd ? "Changed" : "Secure",      color:"var(--success)", icon:ShieldCheck  },
            { label:"Sessions",  value: `${sessions.length} Active`,         color:"var(--primary)", icon:Globe        },
            { label:"Devices",   value: `${devices.length} Trusted`,         color:"var(--info)",    icon:Smartphone   },
          ].map(s => (
            <motion.div key={s.label} variants={fadeUp} className="glass-card px-4 py-3.5 flex items-center gap-3">
              <div className="p-2 rounded-xl shrink-0" style={{ background:`color-mix(in oklch,${s.color} 13%,var(--base-200))` }}>
                <s.icon size={14} style={{ color:s.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black truncate" style={{ color:s.color }}>{s.value}</p>
                <p className="text-xs text-base-content/40">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 p-1 bg-base-200 rounded-xl mb-6 w-fit">
          {TABS.map(t => (
            <motion.button key={t.key} whileTap={{ scale:.94 }} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab===t.key ? "bg-primary text-primary-content shadow-sm" : "text-base-content/50 hover:bg-base-300"}`}>
              <t.icon size={11} />{t.label}
            </motion.button>
          ))}
        </div>

        {/* ══════ PASSWORD TAB ══════ */}
        <AnimatePresence mode="wait">
          {tab === "password" && (
            <motion.div key="pwd" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              <div className="glass-card overflow-hidden max-w-lg">
                <div className="px-5 py-4 border-b border-base-300/50 flex items-center gap-2.5">
                  <div className="p-2 rounded-xl" style={{ background:"color-mix(in oklch,var(--primary) 13%,var(--base-200))" }}>
                    <Key size={14} style={{ color:"var(--primary)" }} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Change Password</p>
                    <p className="text-xs text-base-content/40">Minimum 8 characters recommended</p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <PwdField label="Current Password"  value={curPwd}  onChange={setCurPwd}  placeholder="Enter current password" show={showCur} onToggle={() => setShowCur(v=>!v)} error={pwdErrs.cur} />
                  <PwdField label="New Password"       value={newPwd}  onChange={setNewPwd}  placeholder="Minimum 8 characters"   show={showNew} onToggle={() => setShowNew(v=>!v)} error={pwdErrs.new} />

                  {/* Strength meter */}
                  {newPwd && (
                    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}>
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-500"
                            style={{ background: i <= strength ? strengthColor : "var(--base-300)" }} />
                        ))}
                      </div>
                      <p className="text-xs font-bold" style={{ color:strengthColor }}>{strengthLabel}</p>
                    </motion.div>
                  )}

                  <PwdField label="Confirm New Password" value={confPwd} onChange={setConfPwd} placeholder="Repeat new password" show={showCon} onToggle={() => setShowCon(v=>!v)} error={pwdErrs.conf} />

                  {errors.profile && (
                    <div className="alert alert-error text-xs">{errors.profile?.message}</div>
                  )}

                  <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:.98 }}
                    onClick={handlePwdSubmit} disabled={loading.profile}
                    className="btn-primary-cta w-full flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading.profile ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                    Update Password
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════ SESSIONS TAB ══════ */}
          {tab === "sessions" && (
            <motion.div key="ses" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-base-300/50">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl" style={{ background:"color-mix(in oklch,var(--info) 13%,var(--base-200))" }}>
                      <Globe size={14} style={{ color:"var(--info)" }} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Active Sessions</p>
                      <p className="text-xs text-base-content/40">{sessions.length} session{sessions.length !== 1 ? "s" : ""} found</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                      onClick={() => dispatch(fetchSessions())}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-base-300 hover:bg-base-200 transition-all text-base-content/60">
                      <RefreshCw size={10} className={loading.sessions ? "animate-spin":""}  /> Refresh
                    </motion.button>
                    {sessions.length > 0 && (
                      <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                        onClick={() => setConfirmLogoutAll(true)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-error border hover:bg-error/10 transition-all"
                        style={{ borderColor:"color-mix(in oklch,var(--error) 30%,var(--base-300))" }}>
                        <LogOut size={10} /> Logout All
                      </motion.button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-base-300/40">
                  {loading.sessions && sessions.length === 0 ? (
                    Array.from({ length:3 }).map((_,i) => (
                      <div key={i} className="px-5 py-4 flex items-center gap-3">
                        <div className="skeleton w-9 h-9 rounded-xl" />
                        <div className="flex-1 space-y-1.5"><div className="skeleton h-3.5 w-40 rounded-lg" /><div className="skeleton h-3 w-28 rounded-lg" /></div>
                      </div>
                    ))
                  ) : sessions.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-base-content/30">No active sessions</div>
                  ) : (
                    sessions.map((s, i) => (
                      <motion.div key={s._id || i} variants={rowAnim} initial="hidden" animate="show"
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-base-200/50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl" style={{ background:"color-mix(in oklch,var(--info) 10%,var(--base-200))" }}>
                            <Wifi size={13} style={{ color:"var(--info)" }} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-base-content">{s.userAgent?.slice(0,32) || "Session"}</p>
                              {s.isCurrent && <span className="badge badge-success text-xs">Current</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              {s.ipAddress && <span className="text-xs text-base-content/40 flex items-center gap-1"><MapPin size={9} />{s.ipAddress}</span>}
                              {s.createdAt && <span className="text-xs text-base-content/40 flex items-center gap-1"><Clock size={9} />{new Date(s.createdAt).toLocaleDateString("en-IN")}</span>}
                            </div>
                          </div>
                        </div>
                        {!s.isCurrent && (
                          <motion.button whileHover={{ scale:1.08 }} whileTap={{ scale:.92 }}
                            onClick={() => setRevokeTarget(s._id)}
                            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-error/10 focus-visible:opacity-100"
                            style={{ color:"var(--error)" }} title="Revoke session">
                            <Power size={14} />
                          </motion.button>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════ DEVICES TAB ══════ */}
          {tab === "devices" && (
            <motion.div key="dev" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-base-300/50">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl" style={{ background:"color-mix(in oklch,var(--secondary) 13%,var(--base-200))" }}>
                      <Smartphone size={14} style={{ color:"var(--secondary)" }} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Trusted Devices</p>
                      <p className="text-xs text-base-content/40">{devices.length} device{devices.length !== 1 ? "s" : ""} registered</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                      onClick={() => dispatch(fetchDevices())}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-base-300 hover:bg-base-200 transition-all text-base-content/60">
                      <RefreshCw size={10} className={loading.devices ? "animate-spin":""} /> Refresh
                    </motion.button>
                    {devices.length > 0 && (
                      <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                        onClick={() => setConfirmRemoveAll(true)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-error border hover:bg-error/10 transition-all"
                        style={{ borderColor:"color-mix(in oklch,var(--error) 30%,var(--base-300))" }}>
                        <Trash size={10} /> Remove All
                      </motion.button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-base-300/40">
                  {loading.devices && devices.length === 0 ? (
                    Array.from({ length:3 }).map((_,i) => (
                      <div key={i} className="px-5 py-4 flex items-center gap-3">
                        <div className="skeleton w-9 h-9 rounded-xl" />
                        <div className="flex-1 space-y-1.5"><div className="skeleton h-3.5 w-36 rounded-lg" /><div className="skeleton h-3 w-24 rounded-lg" /></div>
                      </div>
                    ))
                  ) : devices.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-base-content/30">No devices registered</div>
                  ) : (
                    devices.map((d, i) => (
                      <motion.div key={d._id || i} variants={rowAnim} initial="hidden" animate="show"
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-base-200/50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl" style={{ background:"color-mix(in oklch,var(--secondary) 10%,var(--base-200))" }}>
                            <DeviceIcon type={d.deviceType || d.type} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-base-content">{d.deviceName || d.name || "Unknown Device"}</p>
                              {d.isCurrent && <span className="badge badge-success text-xs">Current</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              {d.deviceType && <span className="text-xs text-base-content/40 capitalize">{d.deviceType}</span>}
                              {d.lastSeen   && <span className="text-xs text-base-content/40 flex items-center gap-1"><Clock size={9} />Last seen {new Date(d.lastSeen).toLocaleDateString("en-IN")}</span>}
                              {d.os         && <span className="text-xs text-base-content/40">{d.os}</span>}
                            </div>
                          </div>
                        </div>
                        <motion.button whileHover={{ scale:1.08 }} whileTap={{ scale:.92 }}
                          onClick={() => setRemoveTarget(d._id)}
                          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-error/10 focus-visible:opacity-100"
                          style={{ color:"var(--error)" }} title="Remove device">
                          <Trash2 size={14} />
                        </motion.button>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}