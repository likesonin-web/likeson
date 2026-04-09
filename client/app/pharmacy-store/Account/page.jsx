"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchStore,
  updateStore,
  clearSuccess,
  clearError,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  Store, MapPin, Clock, Truck, Zap, Edit3, Save, X,
  CheckCircle2, Loader2, Sparkles, ToggleLeft, ToggleRight,
  AlarmClock, Navigation, Timer, Sun, Moon, Coffee,
} from "lucide-react";

/* ── Variants ─────────────────────────────────────────────── */
const fadeUp  = { hidden:{ opacity:0, y:20 }, show:{ opacity:1, y:0, transition:{ type:"spring", stiffness:260, damping:22 } } };
const stagger = { hidden:{}, show:{ transition:{ staggerChildren:0.07 } } };

/* ── Background ───────────────────────────────────────────── */
function StoreBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02]"
        style={{ backgroundImage:"repeating-linear-gradient(0deg, var(--primary) 0, var(--primary) 1px, transparent 0, transparent 40px), repeating-linear-gradient(90deg, var(--primary) 0, var(--primary) 1px, transparent 0, transparent 40px)" }} />
      <motion.div animate={{ opacity:[0.06,0.14,0.06], y:[0,-20,0] }} transition={{ duration:10, repeat:Infinity }}
        className="absolute -top-32 right-0 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{ background:"radial-gradient(circle, var(--secondary), transparent 65%)" }} />
      <motion.div animate={{ opacity:[0.04,0.1,0.04] }} transition={{ duration:8, repeat:Infinity, delay:5 }}
        className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full blur-3xl"
        style={{ background:"radial-gradient(circle, var(--accent), transparent 65%)" }} />
    </div>
  );
}

/* ── Toast ────────────────────────────────────────────────── */
function Toast({ msg, type="success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div initial={{ opacity:0, y:30, scale:.95 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:20, scale:.95 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-bold glass-card"
      style={{ border:`1.5px solid ${type==="success" ? "var(--success)":"var(--error)"}`, color: type==="success" ? "var(--success)":"var(--error)" }}>
      <CheckCircle2 size={15} /> {msg}
      <button onClick={onClose} className="ml-1 opacity-50 hover:opacity-100"><X size={12} /></button>
    </motion.div>
  );
}

/* ── Input field ──────────────────────────────────────────── */
function Field({ label, value, onChange, type="text", placeholder, icon:Icon, min, max, step }) {
  return (
    <div>
      <label className="block text-xs font-black uppercase tracking-widest text-base-content/45 mb-1.5">
        {Icon && <Icon size={10} className="inline mr-1" style={{ color:"var(--primary)" }} />}{label}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} min={min} max={max} step={step}
        className="input-field w-full text-sm" />
    </div>
  );
}

/* ── Select field ─────────────────────────────────────────── */
function SelectField({ label, value, onChange, options, icon:Icon }) {
  return (
    <div>
      <label className="block text-xs font-black uppercase tracking-widest text-base-content/45 mb-1.5">
        {Icon && <Icon size={10} className="inline mr-1" style={{ color:"var(--primary)" }} />}{label}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)} className="input-field w-full text-sm">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* ── Store status toggle ──────────────────────────────────── */
function StatusToggle({ value, onChange, disabled }) {
  const isOpen = value === "Open";
  return (
    <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}
      onClick={() => onChange(isOpen ? "Closed" : "Open")}
      disabled={disabled}
      className="flex items-center justify-between w-full bg-base-200 rounded-xl px-4 py-3.5 transition-all hover:bg-base-300 disabled:opacity-50">
      <div className="flex items-center gap-2.5">
        {isOpen ? <Sun size={15} style={{ color:"var(--success)" }} /> : <Moon size={15} style={{ color:"var(--base-content)", opacity:.4 }} />}
        <div className="text-left">
          <p className="text-sm font-bold text-base-content">Store Status</p>
          <p className="text-xs text-base-content/40">{isOpen ? "Accepting orders" : "Not accepting orders"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-black" style={{ color: isOpen ? "var(--success)" : "var(--error)" }}>{value || "—"}</span>
        {isOpen
          ? <ToggleRight size={26} style={{ color:"var(--success)" }} />
          : <ToggleLeft  size={26} style={{ color:"var(--base-content)", opacity:.35 }} />}
      </div>
    </motion.button>
  );
}

/* ── Info row ─────────────────────────────────────────────── */
function InfoRow({ label, value, icon:Icon, color="var(--primary)" }) {
  return (
    <div className="flex items-center justify-between bg-base-200/70 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg" style={{ background:`color-mix(in oklch,${color} 13%,var(--base-200))` }}>
          <Icon size={10} style={{ color }} />
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-base-content/40">{label}</p>
      </div>
      <p className="text-sm font-bold text-base-content">{value || "—"}</p>
    </div>
  );
}

/* ── Timings display ──────────────────────────────────────── */
function TimingsCard({ timings }) {
  if (!timings) return <p className="text-xs text-base-content/30 text-center py-4">No timings set</p>;
  const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  return (
    <div className="space-y-1.5">
      {days.map(day => {
        const t = timings[day] || {};
        const isClosed = t.isClosed || (!t.open && !t.close);
        return (
          <div key={day} className="flex items-center justify-between bg-base-200/60 rounded-lg px-3 py-2">
            <p className="text-xs font-black capitalize" style={{ color: isClosed ? "var(--base-content)" : "var(--primary)", opacity: isClosed ? .35 : 1 }}>{day.slice(0,3)}</p>
            <p className="text-xs font-semibold text-base-content/60">
              {isClosed ? <span className="text-error/70">Closed</span> : `${t.open||"—"} – ${t.close||"—"}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Timings editor ───────────────────────────────────────── */
function TimingsEditor({ timings, onChange }) {
  const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const update = (day, field, val) => {
    const next = { ...(timings || {}) };
    next[day] = { ...(next[day] || {}), [field]: val };
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {days.map(day => {
        const t = (timings || {})[day] || {};
        return (
          <div key={day} className="grid grid-cols-[80px_1fr_1fr_40px] gap-2 items-center">
            <span className="text-xs font-black capitalize text-base-content/60">{day.slice(0,3)}</span>
            <input type="time" value={t.open||""} onChange={e => update(day,"open",e.target.value)}
              disabled={t.isClosed} className="input-field text-xs py-1.5 px-2" />
            <input type="time" value={t.close||""} onChange={e => update(day,"close",e.target.value)}
              disabled={t.isClosed} className="input-field text-xs py-1.5 px-2" />
            <label className="flex items-center justify-center cursor-pointer">
              <input type="checkbox" checked={!!t.isClosed} onChange={e => update(day,"isClosed",e.target.checked)}
                className="w-4 h-4 accent-error rounded" />
            </label>
          </div>
        );
      })}
      <p className="text-xs text-base-content/30 mt-1">Check to mark a day as closed</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════ */
export default function MyStoreAccount() {
  const dispatch  = useDispatch();
  const reduxUser = useSelector((state) => state.user?.user) ?? null;
  const { store, loading, success, errors } = useSelector((s) => s.pharmacyStore);

  /* ── Edit state ── */
  const [editing, setEditing] = useState(false);

  /* ── Form fields ── */
  const [radius,   setRadius  ] = useState("");
  const [estTime,  setEstTime ] = useState("");
  const [status,   setStatus  ] = useState("Open");
  const [timings,  setTimings ] = useState(null);

  /* ── Toast ── */
  const [toast, setToast] = useState(null);

  useEffect(() => { dispatch(fetchStore()); }, [dispatch]);

  /* ── Populate form from store ── */
  useEffect(() => {
    if (store) {
      setRadius (String(store.deliveryRadiusKm    || ""));
      setEstTime(store.estimatedDeliveryTime       || "");
      setStatus (store.status                      || "Open");
      setTimings(store.timings                     || null);
    }
  }, [store]);

  /* ── Success toast ── */
  useEffect(() => {
    if (success.storeUpdate) {
      setToast({ msg:"Store updated successfully!", type:"success" });
      setEditing(false);
      dispatch(clearSuccess("storeUpdate"));
    }
  }, [success.storeUpdate, dispatch]);

  /* ── Save ── */
  const handleSave = () => {
    const payload = {};
    if (radius  !== "" && !isNaN(Number(radius)))  payload.deliveryRadiusKm     = Number(radius);
    if (estTime.trim())                             payload.estimatedDeliveryTime = estTime.trim();
    if (status)                                     payload.status               = status;
    if (timings)                                    payload.timings              = timings;
    if (!Object.keys(payload).length) return;
    dispatch(updateStore(payload));
  };

  const handleCancel = () => {
    if (store) {
      setRadius (String(store.deliveryRadiusKm    || ""));
      setEstTime(store.estimatedDeliveryTime       || "");
      setStatus (store.status                      || "Open");
      setTimings(store.timings                     || null);
    }
    setEditing(false);
  };

  return (
    <div className="min-h-screen" style={{ background:"var(--base-100)" }}>
      <StoreBg />

      <AnimatePresence>
        {toast && <Toast key="t" msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity:0, y:-18 }} animate={{ opacity:1, y:0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-secondary" />
            <span className="text-xs font-black uppercase tracking-widest text-secondary/70">Configuration</span>
          </div>
          <h1 className="section-heading text-3xl lg:text-4xl">
            My <span className="text-gradient-primary">Store</span>
          </h1>
          <p className="text-sm text-base-content/45 mt-1">Manage delivery settings, timings & status</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left: store snapshot ── */}
          <motion.div variants={stagger} initial="hidden" animate="show" className="lg:col-span-1 flex flex-col gap-5">

            {/* Store identity card */}
            <motion.div variants={fadeUp} className="glass-card p-6 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-16 opacity-20"
                style={{ background:"linear-gradient(135deg, var(--secondary), var(--primary))" }} />
              <div className="relative flex flex-col items-center text-center gap-3 mt-4">
                <div className="p-4 rounded-2xl shadow-lg"
                  style={{ background:"linear-gradient(135deg, var(--primary), var(--secondary))", color:"var(--primary-content)" }}>
                  <Store size={28} />
                </div>
                <div>
                  <p className="text-lg font-black font-montserrat text-base-content">{store?.storeName || "My Pharmacy"}</p>
                  {reduxUser?.email && <p className="text-xs text-base-content/40 mt-0.5">{reduxUser.email}</p>}
                </div>
                {/* Status pill */}
                <motion.div animate={{ scale:[1,1.03,1] }} transition={{ duration:2, repeat:Infinity }}
                  className="px-4 py-1.5 rounded-full text-xs font-black"
                  style={{
                    background: store?.status === "Open" ? "color-mix(in oklch,var(--success) 14%,var(--base-200))" : "color-mix(in oklch,var(--error) 14%,var(--base-200))",
                    color:      store?.status === "Open" ? "var(--success)" : "var(--error)",
                    border:     `1px solid ${store?.status === "Open" ? "color-mix(in oklch,var(--success) 30%,var(--base-300))" : "color-mix(in oklch,var(--error) 30%,var(--base-300))"}`,
                  }}>
                  {store?.status || "—"}
                </motion.div>

                {/* Quick stats */}
                <div className="w-full grid grid-cols-2 gap-2 mt-1">
                  {[
                    { label:"Radius",   value: store?.deliveryRadiusKm    ? `${store.deliveryRadiusKm} km` : "—", color:"var(--primary)"   },
                    { label:"Est. Time",value: store?.estimatedDeliveryTime || "—",                               color:"var(--secondary)" },
                  ].map(s => (
                    <div key={s.label} className="bg-base-200 rounded-xl p-2.5 text-center">
                      <p className="text-sm font-black" style={{ color:s.color }}>{s.value}</p>
                      <p className="text-xs text-base-content/35 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Read-only info */}
            <motion.div variants={fadeUp} className="glass-card p-5 space-y-2">
              <p className="font-bold text-xs uppercase tracking-widest text-base-content/35 mb-3 flex items-center gap-1.5">
                <Store size={10} style={{ color:"var(--secondary)" }} /> Store Details
              </p>
              <InfoRow label="Store Name"     value={store?.storeName}            icon={Store}        color="var(--primary)"   />
              <InfoRow label="Delivery Radius" value={store?.deliveryRadiusKm ? `${store.deliveryRadiusKm} km` : "—"} icon={Navigation} color="var(--secondary)" />
              <InfoRow label="Est. Delivery"  value={store?.estimatedDeliveryTime} icon={Timer}       color="var(--success)"   />
              <InfoRow label="Status"         value={store?.status}               icon={Zap}          color={store?.status==="Open" ? "var(--success)":"var(--error)"} />
            </motion.div>
          </motion.div>

          {/* ── Right: edit form ── */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Main settings card */}
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-base-300/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl" style={{ background:"color-mix(in oklch,var(--secondary) 13%,var(--base-200))" }}>
                    <Truck size={14} style={{ color:"var(--secondary)" }} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-base-content">Delivery Settings</p>
                    <p className="text-xs text-base-content/40">Radius · estimate · status</p>
                  </div>
                </div>
                {!editing ? (
                  <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                    onClick={() => setEditing(true)}
                    className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
                    <Edit3 size={11} /> Edit
                  </motion.button>
                ) : (
                  <div className="flex gap-2">
                    <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                      onClick={handleCancel}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-base-300 text-base-content/50 hover:bg-base-200 transition-all">
                      <X size={11} /> Cancel
                    </motion.button>
                    <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:.96 }}
                      onClick={handleSave} disabled={loading.store}
                      className="btn-primary-cta flex items-center gap-1.5 text-xs px-4 py-1.5 disabled:opacity-60">
                      {loading.store ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                      Save
                    </motion.button>
                  </div>
                )}
              </div>

              <div className="p-5">
                <AnimatePresence mode="wait">
                  {!editing ? (
                    <motion.div key="view" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                      className="grid sm:grid-cols-2 gap-3">
                      {[
                        { label:"Delivery Radius",  value: store?.deliveryRadiusKm    ? `${store.deliveryRadiusKm} km` : "—", icon:Navigation, color:"var(--primary)" },
                        { label:"Est. Delivery",    value: store?.estimatedDeliveryTime || "—",                               icon:AlarmClock, color:"var(--secondary)" },
                        { label:"Store Status",     value: store?.status               || "—",                                icon:Zap,        color: store?.status==="Open" ? "var(--success)":"var(--error)" },
                        { label:"Updated",          value: store?.updatedAt ? new Date(store.updatedAt).toLocaleDateString("en-IN") : "—", icon:Clock, color:"var(--info)" },
                      ].map(f => (
                        <div key={f.label} className="bg-base-200/60 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <f.icon size={10} style={{ color:f.color }} />
                            <p className="text-xs font-black uppercase tracking-widest text-base-content/35">{f.label}</p>
                          </div>
                          <p className="text-sm font-bold text-base-content">{f.value}</p>
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div key="edit" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                      className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Delivery Radius (km)"     value={radius}  onChange={setRadius}  type="number" placeholder="e.g. 10"      icon={Navigation} min="0" max="200" step="0.5" />
                        <Field label="Estimated Delivery Time"  value={estTime} onChange={setEstTime} placeholder="e.g. 30-45 mins"             icon={AlarmClock} />
                      </div>
                      <StatusToggle value={status} onChange={setStatus} disabled={loading.store} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Timings card */}
            <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay:.1 }} className="glass-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-base-300/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl" style={{ background:"color-mix(in oklch,var(--accent) 13%,var(--base-200))" }}>
                    <Clock size={14} style={{ color:"var(--accent)" }} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-base-content">Store Timings</p>
                    <p className="text-xs text-base-content/40">Opening & closing hours per day</p>
                  </div>
                </div>
                {editing && (
                  <span className="badge badge-warning text-xs">Editing</span>
                )}
              </div>
              <div className="p-5">
                {editing ? (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
                    <TimingsEditor timings={timings || store?.timings || {}} onChange={setTimings} />
                  </motion.div>
                ) : (
                  <TimingsCard timings={store?.timings} />
                )}
              </div>
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {errors.store && (
                <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                  className="alert alert-error text-sm">
                  {errors.store?.message}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}