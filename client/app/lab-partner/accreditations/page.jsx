"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Award, Plus, X, Upload, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, ArrowLeft, ShieldCheck, Calendar,
  BadgeCheck, Clock, FileText, Eye, Hash, Building2,
  Info, Sparkles, ChevronRight, ExternalLink, Shield,
} from "lucide-react";

import {
  fetchPartnerAccreditations,
  addPartnerAccreditation,
  selectPartnerAccreditations,
  selectLabLoading,
  selectLabActionLoading,
  selectLabError,
  clearLabError,
} from "@/store/slices/labSlice";

// ─── constants ────────────────────────────────────────────────────────────
const ACCREDITATION_BODIES = ["NABL","CAP","ISO","NABH","JCI","Other"];

const BODY_META = {
  NABL:  { color: "#6366f1", bg: "#6366f115", label: "National Accreditation Board for Testing & Calibration Laboratories", icon: "🏛️" },
  CAP:   { color: "#0ea5e9", bg: "#0ea5e915", label: "College of American Pathologists", icon: "🔬" },
  ISO:   { color: "#10b981", bg: "#10b98115", label: "International Organization for Standardization", icon: "🌐" },
  NABH:  { color: "#f59e0b", bg: "#f59e0b15", label: "National Accreditation Board for Hospitals", icon: "🏥" },
  JCI:   { color: "#ec4899", bg: "#ec489915", label: "Joint Commission International", icon: "⭐" },
  Other: { color: "#8b5cf6", bg: "#8b5cf615", label: "Other Accreditation Body", icon: "📋" },
};

const NOTES = [
  { icon: "💡", text: "Upload the original accreditation certificate — scanned PDF or high-resolution image." },
  { icon: "🔐", text: "Documents are stored securely and only reviewed by verified Likeson admins." },
  { icon: "⏱️", text: "Admin verification typically takes 1–3 business days after submission." },
  { icon: "✅", text: "A verified badge appears on your public lab profile once approved." },
];

// ─── animation variants ───────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 20 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }) };
const scaleIn = { hidden: { opacity: 0, scale: 0.93 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } };
const fadeIn  = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.3 } } };

const emptyForm = { body: "", certificateNo: "", issuedOn: "", validUntil: "" };

// ─── Status Badge ─────────────────────────────────────────────────────────
function StatusBadge({ isVerified }) {
  return isVerified ? (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-success/15 text-success border border-success/25">
      <BadgeCheck size={10} />Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-warning/15 text-warning border border-warning/25">
      <Clock size={10} />Pending
    </span>
  );
}

// ─── Accreditation Card ───────────────────────────────────────────────────
function AccreditationCard({ acc, index }) {
  const meta      = BODY_META[acc.body] || BODY_META.Other;
  const isExpired = acc.validUntil && new Date(acc.validUntil) < new Date();
  const daysLeft  = acc.validUntil
    ? Math.ceil((new Date(acc.validUntil) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <motion.div variants={fadeUp} custom={index} initial="hidden" animate="visible"
      className="rounded-2xl border border-base-300 bg-base-100 overflow-hidden group hover:border-primary/40 transition-all duration-300"
      style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.05)" }}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: isExpired ? "var(--error)" : meta.color }} />

      <div className="p-5 flex gap-4">
        {/* Body icon */}
        <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold border border-base-300"
          style={{ background: meta.bg }}>
          {meta.icon}
        </div>

        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm text-base-content">{acc.body}</h3>
                <StatusBadge isVerified={acc.isVerified} />
                {isExpired && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error/15 text-error border border-error/25">Expired</span>
                )}
              </div>
              <p className="text-[10px] text-base-content/40 mt-0.5">{meta.label}</p>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {acc.certificateNo && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-base-200">
                <Hash size={11} className="text-base-content/40 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Cert No.</p>
                  <p className="text-xs font-bold truncate">{acc.certificateNo}</p>
                </div>
              </div>
            )}
            {acc.issuedOn && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-base-200">
                <Calendar size={11} className="text-info shrink-0" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Issued</p>
                  <p className="text-xs font-bold">{new Date(acc.issuedOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              </div>
            )}
            {acc.validUntil && (
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${isExpired ? "bg-error/10" : daysLeft && daysLeft < 90 ? "bg-warning/10" : "bg-base-200"}`}>
                <Clock size={11} className={isExpired ? "text-error shrink-0" : daysLeft && daysLeft < 90 ? "text-warning shrink-0" : "text-success shrink-0"} />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Valid Until</p>
                  <p className={`text-xs font-bold ${isExpired ? "text-error" : daysLeft && daysLeft < 90 ? "text-warning" : ""}`}>
                    {new Date(acc.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Expiry warning */}
          {!isExpired && daysLeft !== null && daysLeft < 90 && daysLeft > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-semibold text-warning bg-warning/10 px-3 py-2 rounded-xl">
              <AlertCircle size={11} />Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""} — consider renewing soon.
            </div>
          )}
          {isExpired && (
            <div className="flex items-center gap-2 text-[10px] font-semibold text-error bg-error/10 px-3 py-2 rounded-xl">
              <AlertCircle size={11} />This accreditation has expired. Upload a renewed certificate.
            </div>
          )}

          {/* Document link */}
          {acc.documentUrl && (
            <a href={acc.documentUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary hover:underline">
              <ExternalLink size={10} />View Certificate
            </a>
          )}
        </div>
      </div>

      {/* Verified info footer */}
      {acc.isVerified && acc.verifiedAt && (
        <div className="px-5 py-2.5 border-t border-base-300/50 bg-success/5 flex items-center gap-2">
          <ShieldCheck size={11} className="text-success" />
          <p className="text-[10px] text-success font-semibold">
            Verified on {new Date(acc.verifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────
function AddModal({ open, onClose, onSubmit, actionLoading }) {
  const [form,   setForm]   = useState(emptyForm);
  const [file,   setFile]   = useState(null);
  const [errors, setErrors] = useState({});
  const [drag,   setDrag]   = useState(false);

  useEffect(() => { if (open) { setForm(emptyForm); setFile(null); setErrors({}); } }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.body) e.body = "Accreditation body is required.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ ...form, ...(file ? { certificate: file } : {}) });
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const selectedMeta = form.body ? BODY_META[form.body] || BODY_META.Other : null;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="hidden"
          className="w-full max-w-lg max-h-[600px] mt-auto overflow-y-auto rounded-3xl border border-base-300 bg-base-100"
          style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.28)" }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-7 py-5 border-b border-base-300 bg-base-100 rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Award size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-black">Add Accreditation</h2>
                <p className="text-[10px] text-base-content/50">Submit for admin verification</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors">
              <X size={16} className="text-base-content/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-7 space-y-5">

            {/* Body selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2.5">
                Accreditation Body *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ACCREDITATION_BODIES.map(b => {
                  const m = BODY_META[b];
                  return (
                    <button key={b} type="button" onClick={() => set("body", b)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all duration-200 ${
                        form.body === b ? "border-primary" : "border-base-300 hover:border-base-content/20"
                      }`}
                      style={form.body === b ? { background: `${m.color}12`, borderColor: m.color } : {}}>
                      <span className="text-lg">{m.icon}</span>
                      <span className="text-[10px] font-black" style={form.body === b ? { color: m.color } : {}}>{b}</span>
                    </button>
                  );
                })}
              </div>
              {errors.body && <p className="text-xs text-error mt-1.5 flex items-center gap-1"><AlertCircle size={11} />{errors.body}</p>}
              {selectedMeta && (
                <p className="text-[10px] text-base-content/40 mt-2 pl-1">{selectedMeta.label}</p>
              )}
            </div>

            {/* Cert No */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2">Certificate Number</label>
              <input value={form.certificateNo} onChange={e => set("certificateNo", e.target.value)}
                placeholder="e.g. NABL/2024/XXXXXX"
                className="input-field w-full" />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2">Issue Date</label>
                <input type="date" value={form.issuedOn} onChange={e => set("issuedOn", e.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2">Valid Until</label>
                <input type="date" value={form.validUntil} onChange={e => set("validUntil", e.target.value)} className="input-field w-full" />
              </div>
            </div>

            {/* File upload */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2">Certificate Document</label>
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                  drag ? "border-primary bg-primary/8 scale-[1.01]" : file ? "border-success bg-success/8" : "border-base-300 hover:border-primary/50 hover:bg-primary/5"
                }`}>
                {file ? (
                  <>
                    <CheckCircle2 size={22} className="text-success" />
                    <span className="text-xs font-bold text-success">{file.name}</span>
                    <span className="text-[10px] text-base-content/40">{(file.size / 1024).toFixed(0)} KB · click to replace</span>
                  </>
                ) : (
                  <>
                    <Upload size={22} className="text-primary/50" />
                    <span className="text-xs font-semibold text-base-content/50">Drop certificate here or click to upload</span>
                    <span className="text-[10px] text-base-content/30">PDF, JPG, PNG · max 10 MB</span>
                  </>
                )}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setFile(e.target.files[0])} />
              </label>
            </div>

            {/* Note */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-info/8 border border-info/20">
              <Info size={14} className="text-info shrink-0 mt-0.5" />
              <p className="text-[11px] text-info/80 leading-relaxed">
                After submission, our team will verify your document within <strong>1–3 business days</strong>.
                You'll be notified via email once verified.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-2xl border-2 border-base-300 font-bold text-sm text-base-content/60 hover:bg-base-200 transition-all">
                Cancel
              </button>
              <button type="submit" disabled={actionLoading}
                className="flex-1 py-3 rounded-2xl font-bold text-sm text-primary-content flex items-center justify-center gap-2 transition-all"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
                {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Award size={15} />}
                {actionLoading ? "Submitting…" : "Submit"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function AccreditationsPage() {
  const router        = useRouter();
  const dispatch      = useDispatch();
  const accreditations  = useSelector(selectPartnerAccreditations);
  const loading         = useSelector(selectLabLoading);
  const actionLoading   = useSelector(selectLabActionLoading);
  const error           = useSelector(selectLabError);

  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { dispatch(fetchPartnerAccreditations()); }, [dispatch]);

  const handleSubmit = async (payload) => {
    await dispatch(addPartnerAccreditation(payload));
    setModalOpen(false);
    dispatch(fetchPartnerAccreditations());
  };

  const stats = {
    total:    accreditations.length,
    verified: accreditations.filter(a => a.isVerified).length,
    pending:  accreditations.filter(a => !a.isVerified).length,
    expired:  accreditations.filter(a => a.validUntil && new Date(a.validUntil) < new Date()).length,
  };

  return (
    <div data-theme="lab" className="min-h-screen" style={{ background: "var(--base-100)" }}>

      {/* ── Sticky Header ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur-xl"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <motion.button whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }}
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs font-bold text-base-content/50 hover:text-primary transition-colors px-3 py-2 rounded-xl hover:bg-primary/8">
              <ArrowLeft size={15} />Back
            </motion.button>

            <div className="w-px h-5 bg-base-300" />

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10">
                <Award size={18} className="text-primary" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-base-content">Accreditations</h1>
                <p className="text-[10px] text-base-content/50 font-medium">{stats.total} total · {stats.verified} verified</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <motion.button whileHover={{ rotate: 180 }} whileTap={{ scale: 0.95 }} transition={{ duration: 0.4 }}
              onClick={() => dispatch(fetchPartnerAccreditations())} disabled={loading}
              className="p-2.5 rounded-xl border border-base-300 hover:border-primary/40 hover:bg-primary/5 transition-all">
              <RefreshCw size={15} className={`text-base-content/60 ${loading ? "animate-spin" : ""}`} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm text-primary-content"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
              <Plus size={15} />Add
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div variants={fadeIn} initial="hidden" animate="visible" exit="hidden"
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-error/10 border border-error/25 text-error text-sm font-semibold">
              <AlertCircle size={15} className="shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => dispatch(clearLabError())}><X size={15} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stat Chips ── */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible"
          className="flex flex-wrap gap-3"
        >
          {[
            { label: "Total",    value: stats.total,    color: "var(--primary)", bg: "var(--primary)", icon: Award },
            { label: "Verified", value: stats.verified, color: "var(--success)", bg: "var(--success)", icon: BadgeCheck },
            { label: "Pending",  value: stats.pending,  color: "var(--warning)", bg: "var(--warning)", icon: Clock },
            { label: "Expired",  value: stats.expired,  color: "var(--error)",   bg: "var(--error)",   icon: AlertCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-base-300 bg-base-100"
              style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
              <div className="p-1.5 rounded-lg" style={{ background: `${color}18` }}>
                <Icon size={12} style={{ color }} />
              </div>
              <span className="text-xs font-black" style={{ color }}>{value}</span>
              <span className="text-[10px] font-semibold text-base-content/50">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Info Notes ── */}
        <motion.div variants={fadeUp} custom={1} initial="hidden" animate="visible"
          className="rounded-2xl border border-primary/20 bg-primary/5 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-primary" />
            <p className="text-xs font-black text-primary uppercase tracking-widest">Important Notes</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {NOTES.map((n, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-sm mt-0.5">{n.icon}</span>
                <p className="text-[11px] text-base-content/60 leading-relaxed">{n.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Accreditation Cards ── */}
        {loading && accreditations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
            <p className="text-sm text-base-content/40 font-semibold">Loading accreditations…</p>
          </div>
        ) : accreditations.length === 0 ? (
          <motion.div variants={fadeUp} custom={2} initial="hidden" animate="visible"
            className="flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border-2 border-dashed border-base-300">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Award size={28} className="text-primary/50" />
            </div>
            <div className="text-center">
              <p className="font-bold text-base-content/60">No accreditations yet</p>
              <p className="text-sm text-base-content/35 mt-1">Add your first accreditation to build trust with customers</p>
            </div>
            <button onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-primary-content mt-1"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
              <Plus size={14} />Add Accreditation
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accreditations.map((acc, i) => (
              <AccreditationCard key={acc._id} acc={acc} index={i} />
            ))}
          </div>
        )}
      </div>

      <AddModal
        open={modalOpen} onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit} actionLoading={actionLoading}
      />
    </div>
  );
}