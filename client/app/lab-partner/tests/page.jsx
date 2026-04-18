"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Plus, Search, Filter, Edit3, Trash2,
  ChevronDown, ChevronUp, X, Upload, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle2, Clock, Home, Tag, DollarSign,
  Activity, RefreshCw, Eye, EyeOff, FileText, Loader2,
  Microscope, TestTube, Beaker, TrendingUp, Package,
} from "lucide-react";

import {
  fetchPartnerTests,
  addPartnerTest,
  updatePartnerTest,
  deletePartnerTest,
  selectPartnerTests,
  selectLabLoading,
  selectLabActionLoading,
  selectLabError,
  clearLabError,
} from "@/store/slices/labSlice";

// ─── animation variants ────────────────────────────────────────────────────
const fadeUp   = { hidden: { opacity: 0, y: 24 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }) };
const fadeIn   = { hidden: { opacity: 0 },         visible: { opacity: 1, transition: { duration: 0.3 } } };
const slideIn  = { hidden: { opacity: 0, x: 40 },  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };
const scaleIn  = { hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } };

// ─── constants ─────────────────────────────────────────────────────────────
const CATEGORIES = ["Haematology","Biochemistry","Microbiology","Immunology","Radiology","Pathology","Genetic","Molecular","Urine","Serology","Hormones","Other"];
const SAMPLE_TYPES = ["Blood","Urine","Stool","Swab","Saliva","Tissue","CSF","Sputum","Other"];

const emptyForm = {
  testCode: "", testName: "", category: "", sampleType: "",
  turnaroundHours: "", mrpPrice: "", partnerPrice: "",
  homeCollectionAvailable: false, isActive: true,
};

// ─── sub-components ────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, delay }) {
  return (
    <motion.div variants={fadeUp} custom={delay} initial="hidden" animate="visible"
      className="relative overflow-hidden rounded-2xl p-5 border border-base-300 bg-base-100 group hover:border-primary/40 transition-all duration-300"
      style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-1">{label}</p>
          <p className="text-3xl font-extrabold" style={{ color }}>{value}</p>
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-full" style={{ background: color }} />
    </motion.div>
  );
}

function TestCard({ test, index, onEdit, onToggle, onDelete, actionLoading }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div variants={fadeUp} custom={index} initial="hidden" animate="visible"
      className={`rounded-2xl border transition-all duration-300 overflow-hidden group ${
        test.isActive ? "border-base-300 bg-base-100 hover:border-primary/50" : "border-base-300/50 bg-base-200/60 opacity-70"
      }`}
      style={{ boxShadow: test.isActive ? "0 2px 20px rgba(0,0,0,0.04)" : "none" }}
    >
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        <div className={`p-3 rounded-xl shrink-0 ${test.isActive ? "bg-primary/10" : "bg-base-300"}`}>
          <TestTube size={20} className={test.isActive ? "text-primary" : "text-base-content/40"} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base-content text-sm truncate">{test.testName}</h3>
                {test.testCode && (
                  <span className="text-[10px] font-mono bg-base-200 text-base-content/50 px-2 py-0.5 rounded-full border border-base-300">{test.testCode}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {test.category && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">
                    <Tag size={9} />{test.category}
                  </span>
                )}
                {test.sampleType && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                    <Beaker size={9} />{test.sampleType}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  test.isActive ? "bg-success/15 text-success" : "bg-error/15 text-error"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${test.isActive ? "bg-success" : "bg-error"}`} />
                  {test.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="text-right shrink-0">
              <p className="text-lg font-extrabold text-primary">₹{Number(test.mrpPrice).toLocaleString("en-IN")}</p>
              {test.partnerPrice && (
                <p className="text-xs text-base-content/40 line-through">₹{Number(test.partnerPrice).toLocaleString("en-IN")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }}>
            <div className="px-5 pb-4 pt-1 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-base-300/50">
              {test.turnaroundHours && (
                <div className="p-3 rounded-xl bg-base-200">
                  <Clock size={13} className="text-info mb-1" />
                  <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wide">TAT</p>
                  <p className="text-sm font-bold">{test.turnaroundHours}h</p>
                </div>
              )}
              <div className="p-3 rounded-xl bg-base-200">
                <Home size={13} className="text-success mb-1" />
                <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wide">Home Collection</p>
                <p className="text-sm font-bold">{test.homeCollectionAvailable ? "Yes" : "No"}</p>
              </div>
              {test.partnerPrice && (
                <div className="p-3 rounded-xl bg-base-200">
                  <DollarSign size={13} className="text-accent mb-1" />
                  <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wide">Partner Price</p>
                  <p className="text-sm font-bold">₹{Number(test.partnerPrice).toLocaleString("en-IN")}</p>
                </div>
              )}
              {test.reportTemplateUrl && (
                <div className="p-3 rounded-xl bg-base-200">
                  <FileText size={13} className="text-warning mb-1" />
                  <p className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wide">Template</p>
                  <a href={test.reportTemplateUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary underline">View</a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-base-300/50 bg-base-50">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-xs text-base-content/50 hover:text-primary transition-colors font-semibold">
          {expanded ? <><ChevronUp size={14} />Less</> : <><ChevronDown size={14} />Details</>}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => onToggle(test)} disabled={actionLoading}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              test.isActive ? "bg-warning/10 text-warning hover:bg-warning/20" : "bg-success/10 text-success hover:bg-success/20"
            }`}>
            {test.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
            {test.isActive ? "Deactivate" : "Activate"}
          </button>
          <button onClick={() => onEdit(test)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
            <Edit3 size={13} />Edit
          </button>
          <button onClick={() => onDelete(test._id)} disabled={actionLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function TestFormModal({ open, onClose, editTest, onSubmit, actionLoading }) {
  const [form, setForm] = useState(emptyForm);
  const [file, setFile]   = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editTest) setForm({ ...emptyForm, ...editTest, turnaroundHours: editTest.turnaroundHours ?? "", partnerPrice: editTest.partnerPrice ?? "" });
    else          setForm(emptyForm);
    setFile(null);
    setErrors({});
  }, [editTest, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.testName.trim()) e.testName = "Test name is required.";
    if (!form.mrpPrice || isNaN(form.mrpPrice) || Number(form.mrpPrice) < 0) e.mrpPrice = "Valid MRP price is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = { ...form };
    if (file) payload.reportTemplate = file;
    if (editTest) payload.testId = editTest._id;
    onSubmit(payload);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="hidden"
          className="w-full max-w-2xl max-h-[600px] mt-auto overflow-y-auto rounded-3xl border border-base-300 bg-base-100"
          style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.25)" }}
        >
          {/* Modal Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-6 border-b border-base-300 bg-base-100 rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <FlaskConical size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-base-content">{editTest ? "Edit Test" : "Add New Test"}</h2>
                <p className="text-xs text-base-content/50">{editTest ? "Update test details" : "Fill in the test information"}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors">
              <X size={18} className="text-base-content/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Test Name *</label>
                <input value={form.testName} onChange={e => set("testName", e.target.value)}
                  placeholder="e.g. Complete Blood Count"
                  className={`input-field w-full ${errors.testName ? "border-error focus:ring-error/50" : ""}`} />
                {errors.testName && <p className="text-xs text-error mt-1.5 flex items-center gap-1"><AlertCircle size={11} />{errors.testName}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Test Code</label>
                <input value={form.testCode} onChange={e => set("testCode", e.target.value)}
                  placeholder="e.g. CBC-001"
                  className="input-field w-full" />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Category</label>
                <select value={form.category} onChange={e => set("category", e.target.value)} className="input-field w-full">
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Sample Type</label>
                <select value={form.sampleType} onChange={e => set("sampleType", e.target.value)} className="input-field w-full">
                  <option value="">Select sample type</option>
                  {SAMPLE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3 — Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">MRP Price (₹) *</label>
                <input type="number" min="0" value={form.mrpPrice} onChange={e => set("mrpPrice", e.target.value)}
                  placeholder="500"
                  className={`input-field w-full ${errors.mrpPrice ? "border-error focus:ring-error/50" : ""}`} />
                {errors.mrpPrice && <p className="text-xs text-error mt-1.5 flex items-center gap-1"><AlertCircle size={11} />{errors.mrpPrice}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Partner Price (₹)</label>
                <input type="number" min="0" value={form.partnerPrice} onChange={e => set("partnerPrice", e.target.value)}
                  placeholder="400"
                  className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">TAT (Hours)</label>
                <input type="number" min="0" value={form.turnaroundHours} onChange={e => set("turnaroundHours", e.target.value)}
                  placeholder="24"
                  className="input-field w-full" />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-5">
              {[
                { key: "homeCollectionAvailable", label: "Home Collection Available", icon: Home },
                { key: "isActive", label: "Mark as Active", icon: Activity },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => set(key, !form[key])}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                    form[key] ? "border-primary bg-primary/5" : "border-base-300 bg-base-200/50"
                  }`}>
                  <div className={`p-2 rounded-xl ${form[key] ? "bg-primary/15" : "bg-base-300"}`}>
                    <Icon size={15} className={form[key] ? "text-primary" : "text-base-content/40"} />
                  </div>
                  <div>
                    <p className="text-xs font-bold">{label}</p>
                    <p className={`text-[10px] font-semibold ${form[key] ? "text-primary" : "text-base-content/40"}`}>{form[key] ? "Enabled" : "Disabled"}</p>
                  </div>
                  <div className="ml-auto">
                    {form[key] ? <ToggleRight size={22} className="text-primary" /> : <ToggleLeft size={22} className="text-base-content/30" />}
                  </div>
                </button>
              ))}
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-base-content/60 mb-2">Report Template (PDF / Image)</label>
              <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-base-300 hover:border-primary/50 cursor-pointer transition-all bg-base-200/40 hover:bg-primary/5">
                <Upload size={20} className="text-primary/60" />
                <span className="text-xs text-base-content/50">{file ? file.name : "Click to upload or drag & drop"}</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setFile(e.target.files[0])} />
              </label>
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
                {actionLoading ? "Saving..." : editTest ? "Save Changes" : "Add Test"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Delete confirm ────────────────────────────────────────────────────────
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
            <Trash2 size={28} className="text-error" />
          </div>
          <h3 className="text-lg font-extrabold mb-2">Deactivate Test?</h3>
          <p className="text-sm text-base-content/60 mb-6">This will mark the test as inactive. It won't appear in public listings.</p>
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

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function TestsPage() {
  const dispatch      = useDispatch();
  const tests         = useSelector(selectPartnerTests);
  const loading       = useSelector(selectLabLoading);
  const actionLoading = useSelector(selectLabActionLoading);
  const error         = useSelector(selectLabError);

  const [search,    setSearch]    = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterActive, setFilterActive] = useState("all");
  const [showFilters,  setShowFilters]  = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTest,     setEditTest]     = useState(null);
  const [deleteId,     setDeleteId]     = useState(null);

  useEffect(() => { dispatch(fetchPartnerTests()); }, [dispatch]);

  const handleAdd    = () => { setEditTest(null); setModalOpen(true); };
  const handleEdit   = (t) => { setEditTest(t);   setModalOpen(true); };
  const handleDelete = (id) => setDeleteId(id);
  const handleClose  = () => { setModalOpen(false); setEditTest(null); };

  const handleToggle = async (test) => {
    await dispatch(updatePartnerTest({ testId: test._id, isActive: !test.isActive }));
    dispatch(fetchPartnerTests());
  };

  const handleSubmit = async (payload) => {
    if (editTest) await dispatch(updatePartnerTest(payload));
    else          await dispatch(addPartnerTest(payload));
    setModalOpen(false);
    dispatch(fetchPartnerTests());
  };

  const confirmDelete = async () => {
    await dispatch(deletePartnerTest(deleteId));
    setDeleteId(null);
    dispatch(fetchPartnerTests());
  };

  // ── derived ──
  const filtered = tests.filter(t => {
    const matchSearch = !search || t.testName?.toLowerCase().includes(search.toLowerCase()) || t.testCode?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = !filterCat || t.category === filterCat;
    const matchActive = filterActive === "all" || (filterActive === "active" ? t.isActive : !t.isActive);
    return matchSearch && matchCat && matchActive;
  });

  const stats = {
    total:   tests.length,
    active:  tests.filter(t => t.isActive).length,
    home:    tests.filter(t => t.homeCollectionAvailable && t.isActive).length,
    avgPrice: tests.length ? Math.round(tests.reduce((s, t) => s + Number(t.mrpPrice), 0) / tests.length) : 0,
  };

  return (
    <div data-theme="lab"  className="min-h-screen" style={{ background: "var(--base-100)" }}>
      {/* ── Topbar ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Microscope size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-base-content">Tests Catalogue</h1>
              <p className="text-xs text-base-content/50 font-medium">{stats.total} tests total</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => dispatch(fetchPartnerTests())} disabled={loading}
              className="p-2.5 rounded-xl border border-base-300 hover:border-primary/50 hover:bg-primary/5 transition-all">
              <RefreshCw size={16} className={`text-base-content/60 ${loading ? "animate-spin" : ""}`} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleAdd}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-primary-content transition-all"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
              <Plus size={16} />Add Test
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Error Banner ── */}
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

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FlaskConical} label="Total Tests"    value={stats.total}   color="var(--primary)"  delay={0} />
          <StatCard icon={Activity}     label="Active"         value={stats.active}  color="var(--success)"  delay={1} />
          <StatCard icon={Home}         label="Home Collection" value={stats.home}   color="var(--info)"     delay={2} />
          <StatCard icon={TrendingUp}   label="Avg. MRP"       value={`₹${stats.avgPrice}`} color="var(--accent)" delay={3} />
        </div>

        {/* ── Search & Filter ── */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search tests by name or code…"
              className="input-field w-full pl-10" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
              showFilters || filterCat || filterActive !== "all" ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content/60 hover:border-primary/50"
            }`}>
            <Filter size={15} />Filters
            {(filterCat || filterActive !== "all") && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-content text-[10px] font-extrabold flex items-center justify-center">!</span>
            )}
          </button>
        </motion.div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="p-5 rounded-2xl border border-base-300 bg-base-200/50 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2 block">Category</label>
                  <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input-field w-full">
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2 block">Status</label>
                  <div className="flex gap-2">
                    {["all", "active", "inactive"].map(v => (
                      <button key={v} onClick={() => setFilterActive(v)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 capitalize transition-all ${
                          filterActive === v ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content/50 hover:border-primary/40"
                        }`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end">
                  <button onClick={() => { setFilterCat(""); setFilterActive("all"); }}
                    className="px-4 py-2 rounded-xl border border-base-300 text-xs font-bold text-base-content/50 hover:bg-base-300 transition-all">
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Test List ── */}
        {loading && tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm text-base-content/50 font-semibold">Loading tests…</p>
          </div>
        ) : filtered.length === 0 ? (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}
            className="flex flex-col items-center justify-center py-24 gap-4 rounded-3xl border-2 border-dashed border-base-300"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FlaskConical size={28} className="text-primary/60" />
            </div>
            <div className="text-center">
              <p className="font-bold text-base-content/70">{search || filterCat || filterActive !== "all" ? "No matching tests" : "No tests yet"}</p>
              <p className="text-sm text-base-content/40 mt-1">{search ? "Try a different search term" : "Add your first test to get started"}</p>
            </div>
            {!search && !filterCat && filterActive === "all" && (
              <button onClick={handleAdd}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-primary-content mt-2 transition-all"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
                <Plus size={15} />Add First Test
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((test, i) => (
              <TestCard key={test._id} test={test} index={i}
                onEdit={handleEdit} onToggle={handleToggle}
                onDelete={handleDelete} actionLoading={actionLoading} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <TestFormModal
        open={modalOpen} onClose={handleClose}
        editTest={editTest} onSubmit={handleSubmit}
        actionLoading={actionLoading}
      />
      <DeleteConfirm
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete} loading={actionLoading}
      />
    </div>
  );
}