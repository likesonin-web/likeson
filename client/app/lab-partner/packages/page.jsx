"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Search, Filter, Edit3, Trash2,
  ChevronDown, ChevronUp, X, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle2, DollarSign, Activity,
  RefreshCw, Loader2, Tag, Calendar, TestTube,
  Layers, TrendingUp, Star, Sparkles, BadgeCheck,
  Package2, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

import {
  fetchPartnerPackages,
  addPartnerPackage,
  updatePartnerPackage,
  deletePartnerPackage,
  fetchPartnerTests,
  selectPartnerPackages,
  selectPartnerTests,
  selectLabLoading,
  selectLabActionLoading,
  selectLabError,
  clearLabError,
} from "@/store/slices/labSlice";

// ─── variants ─────────────────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 24 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }) };
const fadeIn  = { hidden: { opacity: 0 },         visible: { opacity: 1, transition: { duration: 0.3 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } };

const CHART_COLORS = ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)"];

const emptyForm = {
  packageCode: "", packageName: "", description: "",
  tests: [], mrpPrice: "", partnerPrice: "", discountedPrice: "", validUntil: "", isActive: true,
};

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, bg, delay }) {
  return (
    <motion.div variants={fadeUp} custom={delay} initial="hidden" animate="visible"
      className="relative overflow-hidden rounded-2xl p-5 border border-base-300 bg-base-100 group hover:border-primary/40 transition-all duration-300"
      style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--base-content)", opacity: 0.5 }}>{label}</p>
          <p className="text-3xl font-black" style={{ color }}>{value}</p>
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: bg }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-full" style={{ background: color }} />
    </motion.div>
  );
}

// ─── Package Card ──────────────────────────────────────────────────────────
function PackageCard({ pkg, index, tests, onEdit, onToggle, onDelete, actionLoading }) {
  const [expanded, setExpanded] = useState(false);

  const resolvedTests = (pkg.tests ?? [])
    .map(id => tests.find(t => t._id === id || t._id === id?.toString()))
    .filter(Boolean);

 // REPLACE these two lines near top of PackageCard:
const savings = pkg.discountedPrice
  ? Number(pkg.mrpPrice) - Number(pkg.discountedPrice)
  : 0;
const savingsPct = pkg.discountedPrice
  ? Math.round((savings / pkg.mrpPrice) * 100)
  : 0;

  const isExpired = pkg.validUntil && new Date(pkg.validUntil) < new Date();

  return (
    <motion.div variants={fadeUp} custom={index} initial="hidden" animate="visible"
      className={`rounded-2xl border overflow-hidden group transition-all duration-300 ${
        !pkg.isActive || isExpired
          ? "border-base-300/50 bg-base-200/60 opacity-65"
          : "border-base-300 bg-base-100 hover:border-primary/50"
      }`}
      style={{ boxShadow: pkg.isActive && !isExpired ? "0 2px 20px rgba(0,0,0,0.04)" : "none" }}
    >
      {/* Card Top Accent */}
      <div className="h-1 w-full" style={{
        background: pkg.isActive && !isExpired
          ? "linear-gradient(90deg, var(--primary), var(--secondary))"
          : "var(--base-300)"
      }} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl shrink-0 ${pkg.isActive && !isExpired ? "bg-primary/10" : "bg-base-300"}`}>
            <Package2 size={20} className={pkg.isActive && !isExpired ? "text-primary" : "text-base-content/40"} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base-content text-sm">{pkg.packageName}</h3>
                  {pkg.packageCode && (
                    <span className="text-[10px] font-mono bg-base-200 text-base-content/50 px-2 py-0.5 rounded-full border border-base-300">{pkg.packageCode}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    !pkg.isActive      ? "bg-error/15 text-error"
                    : isExpired        ? "bg-warning/15 text-warning"
                    :                    "bg-success/15 text-success"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      !pkg.isActive ? "bg-error" : isExpired ? "bg-warning" : "bg-success"
                    }`} />
                    {!pkg.isActive ? "Inactive" : isExpired ? "Expired" : "Active"}
                  </span>

                  {resolvedTests.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-info/10 text-info px-2 py-0.5 rounded-full">
                      <TestTube size={9} />{resolvedTests.length} tests
                    </span>
                  )}

                  {savingsPct > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                      <Sparkles size={9} />{savingsPct}% off
                    </span>
                  )}
                </div>
              </div>

              {/* Price block */}
           
<div className="text-right shrink-0">
  <p className="text-lg font-black text-primary">
    ₹{Number(pkg.discountedPrice || pkg.mrpPrice).toLocaleString("en-IN")}
  </p>
  {pkg.discountedPrice && Number(pkg.discountedPrice) < Number(pkg.mrpPrice) && (
    <p className="text-xs text-base-content/40 line-through">₹{Number(pkg.mrpPrice).toLocaleString("en-IN")}</p>
  )}
  {pkg.partnerPrice && (
    <p className="text-[10px] text-accent font-semibold">
      Margin: ₹{((pkg.discountedPrice ?? pkg.mrpPrice) - pkg.partnerPrice).toLocaleString("en-IN")}
    </p>
  )}
</div>
            </div>

            {pkg.description && (
              <p className="text-xs text-base-content/50 mt-2 leading-relaxed line-clamp-2">{pkg.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }}>
            <div className="px-5 pb-5 border-t border-base-300/50 pt-4 space-y-4">
              {/* Meta row */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {pkg.validUntil && (
                  <div className="p-3 rounded-xl bg-base-200">
                    <Calendar size={12} className="text-warning mb-1" />
                    <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wide">Valid Until</p>
                    <p className={`text-xs font-bold ${isExpired ? "text-error" : ""}`}>
                      {new Date(pkg.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                )}
                {pkg.partnerPrice && (
                  <div className="p-3 rounded-xl bg-base-200">
                    <DollarSign size={12} className="text-success mb-1" />
                    <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wide">You Save</p>
                    <p className="text-xs font-bold text-success">₹{savings.toLocaleString("en-IN")} ({savingsPct}%)</p>
                  </div>
                )}
                <div className="p-3 rounded-xl bg-base-200">
                  <Layers size={12} className="text-primary mb-1" />
                  <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wide">Tests Included</p>
                  <p className="text-xs font-bold">{resolvedTests.length}</p>
                </div>
              </div>

              {/* Included tests list */}
              {resolvedTests.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-2">Included Tests</p>
                  <div className="flex flex-wrap gap-1.5">
                    {resolvedTests.map(t => (
                      <span key={t._id} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/8 text-primary border border-primary/20">
                        <TestTube size={8} />{t.testName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-base-300/50 bg-base-50">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-xs text-base-content/50 hover:text-primary transition-colors font-semibold">
          {expanded ? <><ChevronUp size={14} />Less</> : <><ChevronDown size={14} />Details</>}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => onToggle(pkg)} disabled={actionLoading}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              pkg.isActive ? "bg-warning/10 text-warning hover:bg-warning/20" : "bg-success/10 text-success hover:bg-success/20"
            }`}>
            {pkg.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            {pkg.isActive ? "Deactivate" : "Activate"}
          </button>
          <button onClick={() => onEdit(pkg)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
            <Edit3 size={13} />Edit
          </button>
          <button onClick={() => onDelete(pkg._id)} disabled={actionLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Package Form Modal ────────────────────────────────────────────────────
function PackageFormModal({ open, onClose, editPkg, onSubmit, actionLoading, tests }) {
  const [form,   setForm]   = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [testSearch, setTestSearch] = useState("");

  useEffect(() => {
    if (editPkg) {
      setForm({
        ...emptyForm, ...editPkg,
        tests:        editPkg.tests ?? [],
        validUntil:   editPkg.validUntil ? editPkg.validUntil.slice(0, 10) : "",
        partnerPrice: editPkg.partnerPrice ?? "",
      });
    } else setForm(emptyForm);
    setErrors({});
    setTestSearch("");
  }, [editPkg, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleTest = (id) => {
    setForm(f => ({
      ...f,
      tests: f.tests.includes(id) ? f.tests.filter(t => t !== id) : [...f.tests, id],
    }));
  };

  const validate = () => {
    const e = {};
    if (!form.packageName.trim()) e.packageName = "Package name is required.";
    if (!form.mrpPrice || isNaN(form.mrpPrice) || Number(form.mrpPrice) < 0) e.mrpPrice = "Valid MRP is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = { ...form };
    if (editPkg) payload.pkgId = editPkg._id;
    onSubmit(payload);
  };

  const filteredTests = tests.filter(t =>
    t.isActive && (!testSearch || t.testName?.toLowerCase().includes(testSearch.toLowerCase()))
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="hidden"
          className="w-full max-w-2xl max-h-[600px] mt-auto overflow-y-auto rounded-3xl border border-base-300 bg-base-100"
          style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.28)" }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-6 border-b border-base-300 bg-base-100 rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Package2 size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-black text-base-content">{editPkg ? "Edit Package" : "Create Package"}</h2>
                <p className="text-xs text-base-content/50">{editPkg ? "Update package details" : "Bundle tests into a package"}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors">
              <X size={18} className="text-base-content/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Name + Code */}
          
<div className="grid grid-cols-1 md:grid-cols-4 gap-5">
  <div>
    <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">MRP (₹) *</label>
    <input type="number" min="0" value={form.mrpPrice} onChange={e => set("mrpPrice", e.target.value)}
      placeholder="2000" className={`input-field w-full ${errors.mrpPrice ? "border-error" : ""}`} />
    {errors.mrpPrice && <p className="text-xs text-error mt-1.5 flex items-center gap-1"><AlertCircle size={11}/>{errors.mrpPrice}</p>}
  </div>
  <div>
    <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Discounted (₹)</label>
    <input type="number" min="0" value={form.discountedPrice} onChange={e => set("discountedPrice", e.target.value)}
      placeholder="1700" className="input-field w-full" />
    {form.mrpPrice && form.discountedPrice && (
      <p className="text-[10px] text-success mt-1 font-semibold">
        {Math.round(((form.mrpPrice - form.discountedPrice) / form.mrpPrice) * 100)}% off
      </p>
    )}
  </div>
  <div>
    <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Partner Cost (₹)</label>
    <input type="number" min="0" value={form.partnerPrice} onChange={e => set("partnerPrice", e.target.value)}
      placeholder="1400" className="input-field w-full" />
    {form.partnerPrice && (form.discountedPrice || form.mrpPrice) && (
      <p className="text-[10px] text-accent mt-1 font-semibold">
        Margin: ₹{((form.discountedPrice || form.mrpPrice) - form.partnerPrice)}
      </p>
    )}
  </div>
  <div>
    <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Valid Until</label>
    <input type="date" value={form.validUntil} onChange={e => set("validUntil", e.target.value)}
      min={new Date().toISOString().slice(0,10)} className="input-field w-full" />
  </div>
</div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Description</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)}
                rows={3} placeholder="Brief description of this package…"
                className="input-field w-full resize-none" />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">MRP Price (₹) *</label>
                <input type="number" min="0" value={form.mrpPrice} onChange={e => set("mrpPrice", e.target.value)}
                  placeholder="2000"
                  className={`input-field w-full ${errors.mrpPrice ? "border-error" : ""}`} />
                {errors.mrpPrice && <p className="text-xs text-error mt-1.5 flex items-center gap-1"><AlertCircle size={11} />{errors.mrpPrice}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Partner Price (₹)</label>
                <input type="number" min="0" value={form.partnerPrice} onChange={e => set("partnerPrice", e.target.value)}
                  placeholder="1600"
                  className="input-field w-full" />
                {form.mrpPrice && form.partnerPrice && Number(form.partnerPrice) < Number(form.mrpPrice) && (
                  <p className="text-[10px] text-success mt-1 font-semibold">
                    Save ₹{(Number(form.mrpPrice) - Number(form.partnerPrice)).toLocaleString("en-IN")}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Valid Until</label>
                <input type="date" value={form.validUntil} onChange={e => set("validUntil", e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="input-field w-full" />
              </div>
            </div>

            {/* Active toggle */}
            <button type="button" onClick={() => set("isActive", !form.isActive)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                form.isActive ? "border-primary bg-primary/5" : "border-base-300 bg-base-200/50"
              }`}>
              <div className={`p-2 rounded-xl ${form.isActive ? "bg-primary/15" : "bg-base-300"}`}>
                <Activity size={15} className={form.isActive ? "text-primary" : "text-base-content/40"} />
              </div>
              <div>
                <p className="text-xs font-bold">Package Status</p>
                <p className={`text-[10px] font-semibold ${form.isActive ? "text-primary" : "text-base-content/40"}`}>
                  {form.isActive ? "Active — visible to customers" : "Inactive — hidden from customers"}
                </p>
              </div>
              <div className="ml-auto">
                {form.isActive ? <ToggleRight size={22} className="text-primary" /> : <ToggleLeft size={22} className="text-base-content/30" />}
              </div>
            </button>

            {/* Tests selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-3">
                Include Tests ({form.tests.length} selected)
              </label>

              {/* Selected pills */}
              {form.tests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {form.tests.map(id => {
                    const t = tests.find(x => x._id === id);
                    return t ? (
                      <span key={id} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                        <TestTube size={10} />{t.testName}
                        <button type="button" onClick={() => toggleTest(id)} className="ml-0.5 hover:text-error transition-colors"><X size={10} /></button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              <div className="relative mb-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input value={testSearch} onChange={e => setTestSearch(e.target.value)}
                  placeholder="Search active tests…"
                  className="input-field w-full pl-8 py-2 text-xs" />
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-base-300 divide-y divide-base-300/50">
                {filteredTests.length === 0 ? (
                  <div className="p-4 text-xs text-center text-base-content/40">No tests found</div>
                ) : filteredTests.map(t => (
                  <label key={t._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-base-200/60 cursor-pointer transition-colors">
                    <input type="checkbox" checked={form.tests.includes(t._id)} onChange={() => toggleTest(t._id)}
                      className="w-4 h-4 rounded accent-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{t.testName}</p>
                      {t.category && <p className="text-[10px] text-base-content/40">{t.category}</p>}
                    </div>
                    <span className="text-xs font-bold text-primary shrink-0">₹{Number(t.mrpPrice).toLocaleString("en-IN")}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-2xl border-2 border-base-300 font-bold text-sm text-base-content/60 hover:bg-base-200 transition-all">
                Cancel
              </button>
              <button type="submit" disabled={actionLoading}
                className="flex-1 py-3 rounded-2xl font-bold text-sm text-primary-content flex items-center justify-center gap-2 transition-all"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {actionLoading ? "Saving…" : editPkg ? "Save Changes" : "Create Package"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Delete Confirm ────────────────────────────────────────────────────────
function DeleteConfirm({ open, onClose, onConfirm, loading }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="hidden"
          className="w-full max-w-sm rounded-3xl border border-error/30 bg-base-100 p-8 text-center"
          style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.25)" }}
        >
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-error" />
          </div>
          <h3 className="text-lg font-black mb-2">Deactivate Package?</h3>
          <p className="text-sm text-base-content/60 mb-6">This will mark the package as inactive. Customers won't see it anymore.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-2xl border-2 border-base-300 font-bold text-sm hover:bg-base-200 transition-all">Cancel</button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 py-3 rounded-2xl bg-error font-bold text-sm text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Deactivate
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Mini Chart ────────────────────────────────────────────────────────────
function PackagePriceChart({ packages }) {
  const data = packages
    .filter(p => p.isActive)
    .slice(0, 6)
    .map(p => ({
  name: p.packageName.slice(0, 12),
  mrp: Number(p.mrpPrice),
  discounted: p.discountedPrice ? Number(p.discountedPrice) : Number(p.mrpPrice),
  cost: p.partnerPrice ? Number(p.partnerPrice) : 0
}));

  if (data.length < 2) return null;

  return (
    <motion.div variants={fadeUp} custom={4} initial="hidden" animate="visible"
      className="rounded-2xl border border-base-300 bg-base-100 p-5"
      style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/50">Price Overview</p>
          <p className="text-sm font-black text-base-content">Active Packages</p>
        </div>
        <div className="p-2 rounded-xl bg-primary/10">
          <TrendingUp size={16} className="text-primary" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barCategoryGap="30%">
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.5 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: "var(--base-100)", border: "1px solid var(--base-300)", borderRadius: 12, fontSize: 11, fontWeight: 700 }}
            formatter={(v, n) => [`₹${Number(v).toLocaleString("en-IN")}`, n === "mrp" ? "MRP" : "Partner"]}
          />
          // REPLACE Bar elements:
<Bar dataKey="mrp"        radius={[6,6,0,0]} fill="var(--base-300)"  opacity={0.6} />
<Bar dataKey="discounted" radius={[6,6,0,0]} fill="var(--primary)"   opacity={0.9} />
<Bar dataKey="cost"       radius={[6,6,0,0]} fill="var(--success)"   opacity={0.8} />
          <Bar dataKey="partner" radius={[6,6,0,0]} fill="var(--success)" opacity={0.8} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function PackagesPage() {
  const dispatch      = useDispatch();
  const packages      = useSelector(selectPartnerPackages);
  const tests         = useSelector(selectPartnerTests);
  const loading       = useSelector(selectLabLoading);
  const actionLoading = useSelector(selectLabActionLoading);
  const error         = useSelector(selectLabError);

  const [search,       setSearch]       = useState("");
  const [filterActive, setFilterActive] = useState("all");
  const [showFilters,  setShowFilters]  = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editPkg,      setEditPkg]      = useState(null);
  const [deleteId,     setDeleteId]     = useState(null);

  useEffect(() => {
    dispatch(fetchPartnerPackages());
    dispatch(fetchPartnerTests());
  }, [dispatch]);

  const handleAdd    = () => { setEditPkg(null); setModalOpen(true); };
  const handleEdit   = (p) => { setEditPkg(p);   setModalOpen(true); };
  const handleDelete = (id) => setDeleteId(id);
  const handleClose  = () => { setModalOpen(false); setEditPkg(null); };

  const handleToggle = async (pkg) => {
    await dispatch(updatePartnerPackage({ pkgId: pkg._id, isActive: !pkg.isActive }));
    dispatch(fetchPartnerPackages());
  };

  const handleSubmit = async (payload) => {
    if (editPkg) await dispatch(updatePartnerPackage(payload));
    else         await dispatch(addPartnerPackage(payload));
    setModalOpen(false);
    dispatch(fetchPartnerPackages());
  };

  const confirmDelete = async () => {
    await dispatch(deletePartnerPackage(deleteId));
    setDeleteId(null);
    dispatch(fetchPartnerPackages());
  };

  // ── Derived ──
  const filtered = packages.filter(p => {
    const matchSearch = !search || p.packageName?.toLowerCase().includes(search.toLowerCase()) || p.packageCode?.toLowerCase().includes(search.toLowerCase());
    const isExpired   = p.validUntil && new Date(p.validUntil) < new Date();
    const matchStatus =
      filterActive === "all"      ? true :
      filterActive === "active"   ? p.isActive && !isExpired :
      filterActive === "inactive" ? !p.isActive :
      filterActive === "expired"  ? isExpired : true;
    return matchSearch && matchStatus;
  });

  const stats = {
    total:   packages.length,
    active:  packages.filter(p => p.isActive && !(p.validUntil && new Date(p.validUntil) < new Date())).length,
    expired: packages.filter(p => p.validUntil && new Date(p.validUntil) < new Date()).length,
    avgMrp:  packages.length ? Math.round(packages.reduce((s, p) => s + Number(p.mrpPrice), 0) / packages.length) : 0,
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      {/* ── Topbar ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Package2 size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-base-content">Packages</h1>
              <p className="text-xs text-base-content/50 font-medium">{stats.total} packages total · {stats.active} active</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => { dispatch(fetchPartnerPackages()); dispatch(fetchPartnerTests()); }} disabled={loading}
              className="p-2.5 rounded-xl border border-base-300 hover:border-primary/50 hover:bg-primary/5 transition-all">
              <RefreshCw size={16} className={`text-base-content/60 ${loading ? "animate-spin" : ""}`} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleAdd}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-primary-content transition-all"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
              <Plus size={16} />New Package
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div variants={fadeIn} initial="hidden" animate="visible" exit="hidden"
              className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-error/10 border border-error/30 text-error text-sm font-semibold">
              <AlertCircle size={16} className="shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => dispatch(clearLabError())}><X size={16} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Package}    label="Total"   value={stats.total}   color="var(--primary)"  bg="color-mix(in srgb, var(--primary) 12%, transparent)"  delay={0} />
          <StatCard icon={BadgeCheck} label="Active"  value={stats.active}  color="var(--success)"  bg="color-mix(in srgb, var(--success) 12%, transparent)"  delay={1} />
          <StatCard icon={Calendar}   label="Expired" value={stats.expired} color="var(--warning)"  bg="color-mix(in srgb, var(--warning) 12%, transparent)"  delay={2} />
          <StatCard icon={TrendingUp} label="Avg MRP" value={`₹${stats.avgMrp}`} color="var(--accent)" bg="color-mix(in srgb, var(--accent) 12%, transparent)" delay={3} />
        </div>

        {/* ── Chart ── */}
        {packages.length >= 2 && <PackagePriceChart packages={packages} />}

        {/* ── Search & Filter ── */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search packages by name or code…"
              className="input-field w-full pl-10" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
              showFilters || filterActive !== "all" ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content/60 hover:border-primary/50"
            }`}>
            <Filter size={15} />Filters
            {filterActive !== "all" && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-content text-[10px] font-black flex items-center justify-center">!</span>
            )}
          </button>
        </motion.div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="p-5 rounded-2xl border border-base-300 bg-base-200/50">
                <label className="text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2 block">Status</label>
                <div className="flex flex-wrap gap-2">
                  {["all", "active", "inactive", "expired"].map(v => (
                    <button key={v} onClick={() => setFilterActive(v)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border-2 capitalize transition-all ${
                        filterActive === v ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content/50 hover:border-primary/40"
                      }`}>
                      {v}
                    </button>
                  ))}
                  <button onClick={() => setFilterActive("all")}
                    className="px-4 py-2 rounded-xl border border-base-300 text-xs font-bold text-base-content/50 hover:bg-base-300 transition-all ml-auto">
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Package Grid ── */}
        {loading && packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm text-base-content/50 font-semibold">Loading packages…</p>
          </div>
        ) : filtered.length === 0 ? (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}
            className="flex flex-col items-center justify-center py-24 gap-4 rounded-3xl border-2 border-dashed border-base-300"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Package2 size={28} className="text-primary/60" />
            </div>
            <div className="text-center">
              <p className="font-bold text-base-content/70">{search || filterActive !== "all" ? "No matching packages" : "No packages yet"}</p>
              <p className="text-sm text-base-content/40 mt-1">{search ? "Try a different search term" : "Bundle your tests into a package to attract more customers"}</p>
            </div>
            {!search && filterActive === "all" && (
              <button onClick={handleAdd}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-primary-content mt-2 transition-all"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
                <Plus size={15} />Create First Package
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((pkg, i) => (
              <PackageCard key={pkg._id} pkg={pkg} index={i} tests={tests}
                onEdit={handleEdit} onToggle={handleToggle}
                onDelete={handleDelete} actionLoading={actionLoading} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <PackageFormModal
        open={modalOpen} onClose={handleClose}
        editPkg={editPkg} onSubmit={handleSubmit}
        actionLoading={actionLoading} tests={tests}
      />
      <DeleteConfirm
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete} loading={actionLoading}
      />
    </div>
  );
}