"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  FileText, Plus, X, Upload, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, ArrowLeft, ShieldCheck, Calendar,
  BadgeCheck, Clock, Hash, Info, Sparkles, ExternalLink,
  FileBadge, FileSearch, Landmark, Leaf, Pill, Receipt,
  Store, Factory, HelpCircle, FileCheck,
} from "lucide-react";

import {
  fetchPartnerAccreditations,
  addPartnerComplianceDoc,
  selectPartnerComplianceDocs,
  selectLabLoading,
  selectLabActionLoading,
  selectLabError,
  clearLabError,
} from "@/store/slices/labSlice";

// ─── constants ────────────────────────────────────────────────────────────
const DOC_TYPES = [
  "Lab_Registration_Certificate",
  "PCB_NOC",
  "Bio_Medical_Waste_License",
  "Drug_License",
  "GSTIN_Certificate",
  "PAN_Card",
  "Trade_License",
  "MSME_Certificate",
  "Other",
];

const DOC_META = {
  Lab_Registration_Certificate: {
    label: "Lab Registration Certificate",
    desc:  "State authority registration for your diagnostic lab",
    icon:  FileCheck,
    color: "#6366f1",
    bg:    "#6366f112",
    required: true,
  },
  PCB_NOC:  {
    label: "Pollution Control Board NOC",
    desc:  "No-objection certificate from State PCB",
    icon:  Leaf,
    color: "#10b981",
    bg:    "#10b98112",
    required: false,
  },
  Bio_Medical_Waste_License: {
    label: "Bio-Medical Waste License",
    desc:  "Authorization for biomedical waste management",
    icon:  Factory,
    color: "#f59e0b",
    bg:    "#f59e0b12",
    required: true,
  },
  Drug_License: {
    label: "Drug License",
    desc:  "License to store / handle controlled substances",
    icon:  Pill,
    color: "#ec4899",
    bg:    "#ec489912",
    required: false,
  },
  GSTIN_Certificate: {
    label: "GSTIN Certificate",
    desc:  "Goods & Services Tax Identification Number",
    icon:  Receipt,
    color: "#0ea5e9",
    bg:    "#0ea5e912",
    required: true,
  },
  PAN_Card: {
    label: "PAN Card",
    desc:  "Permanent Account Number for tax purposes",
    icon:  Landmark,
    color: "#8b5cf6",
    bg:    "#8b5cf612",
    required: true,
  },
  Trade_License: {
    label: "Trade License",
    desc:  "Local body trade license for operations",
    icon:  Store,
    color: "#f97316",
    bg:    "#f9731612",
    required: false,
  },
  MSME_Certificate: {
    label: "MSME Certificate",
    desc:  "MSME Udyam registration certificate",
    icon:  FileBadge,
    color: "#14b8a6",
    bg:    "#14b8a612",
    required: false,
  },
  Other: {
    label: "Other Document",
    desc:  "Any other relevant compliance document",
    icon:  HelpCircle,
    color: "#94a3b8",
    bg:    "#94a3b812",
    required: false,
  },
};

const NOTES = [
  { icon: "📄", text: "Upload clear, legible copies — scanned PDF or high-resolution image (max 10 MB)." },
  { icon: "🔒", text: "All documents are encrypted and accessible only to authorized Likeson admins." },
  { icon: "📬", text: "You'll receive an email notification once a document is verified or flagged." },
  { icon: "⚠️", text: "Expired or missing mandatory documents may affect your approval status." },
];

// ─── animation variants ───────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 20 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }) };
const scaleIn = { hidden: { opacity: 0, scale: 0.93 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } } };
const fadeIn  = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.3 } } };

const emptyForm = { docType: "", docNumber: "", issuedOn: "", validUntil: "", remarks: "" };

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

// ─── Document Checklist Banner ─────────────────────────────────────────────
function ChecklistBanner({ docs }) {
  const mandatoryTypes  = DOC_TYPES.filter(d => DOC_META[d]?.required);
  const submittedTypes  = docs.map(d => d.docType);
  const missing         = mandatoryTypes.filter(t => !submittedTypes.includes(t));

  if (missing.length === 0) {
    return (
      <motion.div variants={fadeUp} custom={1} initial="hidden" animate="visible"
        className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-success/10 border border-success/25">
        <CheckCircle2 size={18} className="text-success shrink-0" />
        <div>
          <p className="text-sm font-black text-success">All mandatory documents submitted!</p>
          <p className="text-[11px] text-success/70">Your compliance checklist looks complete.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp} custom={1} initial="hidden" animate="visible"
      className="rounded-2xl border border-warning/25 bg-warning/8 p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle size={14} className="text-warning" />
        <p className="text-xs font-black text-warning uppercase tracking-widest">Missing Mandatory Documents</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {missing.map(t => {
          const m = DOC_META[t];
          const Icon = m.icon;
          return (
            <span key={t} className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border border-warning/30 bg-warning/10 text-warning">
              <Icon size={9} />{m.label}
            </span>
          );
        })}
      </div>
      <p className="text-[10px] text-base-content/40 mt-3">
        Submit these documents to avoid delays in your lab approval process.
      </p>
    </motion.div>
  );
}

// ─── Compliance Doc Card ──────────────────────────────────────────────────
function ComplianceCard({ doc, index }) {
  const meta      = DOC_META[doc.docType] || DOC_META.Other;
  const Icon      = meta.icon;
  const isExpired = doc.validUntil && new Date(doc.validUntil) < new Date();
  const daysLeft  = doc.validUntil
    ? Math.ceil((new Date(doc.validUntil) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <motion.div variants={fadeUp} custom={index} initial="hidden" animate="visible"
      className="rounded-2xl border border-base-300 bg-base-100 overflow-hidden group hover:border-primary/40 transition-all duration-300"
      style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.05)" }}
    >
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ background: isExpired ? "var(--error)" : meta.color }} />

      <div className="p-5 flex gap-4">
        {/* Icon box */}
        <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border border-base-300"
          style={{ background: meta.bg }}>
          <Icon size={20} style={{ color: meta.color }} />
        </div>

        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm text-base-content">{meta.label}</h3>
                <StatusBadge isVerified={doc.isVerified} />
                {meta.required && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20">MANDATORY</span>
                )}
                {isExpired && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-error/15 text-error border border-error/25">Expired</span>
                )}
              </div>
              <p className="text-[10px] text-base-content/40 mt-0.5">{meta.desc}</p>
            </div>
          </div>

          {/* Meta fields */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {doc.docNumber && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-base-200">
                <Hash size={10} className="text-base-content/40 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Doc No.</p>
                  <p className="text-xs font-bold truncate">{doc.docNumber}</p>
                </div>
              </div>
            )}
            {doc.issuedOn && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-base-200">
                <Calendar size={10} className="text-info shrink-0" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Issued</p>
                  <p className="text-xs font-bold">{new Date(doc.issuedOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              </div>
            )}
            {doc.validUntil && (
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                isExpired ? "bg-error/10" : daysLeft && daysLeft < 90 ? "bg-warning/10" : "bg-base-200"
              }`}>
                <Clock size={10} className={`shrink-0 ${isExpired ? "text-error" : daysLeft && daysLeft < 90 ? "text-warning" : "text-success"}`} />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Valid Until</p>
                  <p className={`text-xs font-bold ${isExpired ? "text-error" : daysLeft && daysLeft < 90 ? "text-warning" : ""}`}>
                    {new Date(doc.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Expiry warning */}
          {!isExpired && daysLeft !== null && daysLeft < 90 && daysLeft > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-semibold text-warning bg-warning/10 px-3 py-2 rounded-xl">
              <AlertCircle size={10} />Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}. Renew before expiry to avoid disruption.
            </div>
          )}
          {isExpired && (
            <div className="flex items-center gap-2 text-[10px] font-semibold text-error bg-error/10 px-3 py-2 rounded-xl">
              <AlertCircle size={10} />This document has expired. Upload a renewed copy immediately.
            </div>
          )}

          {/* Remarks */}
          {doc.remarks && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-base-200">
              <Info size={10} className="text-base-content/40 mt-0.5 shrink-0" />
              <p className="text-[10px] text-base-content/50 leading-relaxed italic">{doc.remarks}</p>
            </div>
          )}

          {/* Document link */}
          {doc.documentUrl && (
            <a href={doc.documentUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary hover:underline">
              <ExternalLink size={10} />View Document
            </a>
          )}
        </div>
      </div>

      {/* Verified footer */}
      {doc.isVerified && doc.verifiedAt && (
        <div className="px-5 py-2.5 border-t border-base-300/50 bg-success/5 flex items-center gap-2">
          <ShieldCheck size={10} className="text-success" />
          <p className="text-[10px] text-success font-semibold">
            Verified on {new Date(doc.verifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
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
    if (!form.docType) e.docType = "Please select a document type.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ ...form, ...(file ? { document: file } : {}) });
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const selectedMeta = form.docType ? DOC_META[form.docType] : null;
  const SelectedIcon = selectedMeta?.icon;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="hidden"
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-base-300 bg-base-100"
          style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.28)" }}
        >
          {/* Modal header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-7 py-5 border-b border-base-300 bg-base-100 rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <FileText size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-black">Upload Compliance Doc</h2>
                <p className="text-[10px] text-base-content/50">Submit for admin verification</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors">
              <X size={16} className="text-base-content/60" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-7 space-y-5">

            {/* Doc type selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2.5">Document Type *</label>
              <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
                {DOC_TYPES.map(t => {
                  const m    = DOC_META[t];
                  const Ic   = m.icon;
                  const sel  = form.docType === t;
                  return (
                    <button key={t} type="button" onClick={() => set("docType", t)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-200 ${
                        sel ? "border-primary" : "border-base-300 hover:border-base-content/20"
                      }`}
                      style={sel ? { background: `${m.color}10`, borderColor: m.color } : {}}>
                      <div className="p-1.5 rounded-lg shrink-0" style={{ background: m.bg }}>
                        <Ic size={14} style={{ color: m.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black truncate" style={sel ? { color: m.color } : {}}>{m.label}</p>
                        <p className="text-[9px] text-base-content/40 truncate">{m.desc}</p>
                      </div>
                      {m.required && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-error/10 text-error border border-error/20 shrink-0">REQ</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {errors.docType && <p className="text-xs text-error mt-2 flex items-center gap-1"><AlertCircle size={11} />{errors.docType}</p>}
            </div>

            {/* Selected preview */}
            {selectedMeta && SelectedIcon && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                style={{ background: `${selectedMeta.color}08`, borderColor: `${selectedMeta.color}30` }}>
                <SelectedIcon size={16} style={{ color: selectedMeta.color }} />
                <p className="text-[11px] text-base-content/60 leading-relaxed">{selectedMeta.desc}</p>
              </motion.div>
            )}

            {/* Doc number */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2">Document Number</label>
              <input value={form.docNumber} onChange={e => set("docNumber", e.target.value)}
                placeholder="e.g. GSTIN27XXXXXX1Z5"
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

            {/* Remarks */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2">Remarks (optional)</label>
              <textarea value={form.remarks} onChange={e => set("remarks", e.target.value)}
                rows={2} placeholder="Any notes for the admin reviewer…"
                className="input-field w-full resize-none text-xs" />
            </div>

            {/* File drop zone */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-base-content/50 mb-2">Document File</label>
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
                    <span className="text-xs font-semibold text-base-content/50">Drop document or click to upload</span>
                    <span className="text-[10px] text-base-content/30">PDF, JPG, PNG · max 10 MB</span>
                  </>
                )}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setFile(e.target.files[0])} />
              </label>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-info/8 border border-info/20">
              <Info size={14} className="text-info shrink-0 mt-0.5" />
              <p className="text-[11px] text-info/80 leading-relaxed">
                Our compliance team will review your document within <strong>1–3 business days</strong>.
                Ensure the document is clear, unexpired, and matches the type selected above.
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
                {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                {actionLoading ? "Uploading…" : "Submit Document"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function CompliancePage() {
  const router        = useRouter();
  const dispatch      = useDispatch();
  const complianceDocs  = useSelector(selectPartnerComplianceDocs);
  const loading         = useSelector(selectLabLoading);
  const actionLoading   = useSelector(selectLabActionLoading);
  const error           = useSelector(selectLabError);

  const [modalOpen,   setModalOpen]   = useState(false);
  const [filterType,  setFilterType]  = useState("all");

  useEffect(() => { dispatch(fetchPartnerAccreditations()); }, [dispatch]);

  const handleSubmit = async (payload) => {
    await dispatch(addPartnerComplianceDoc(payload));
    setModalOpen(false);
    dispatch(fetchPartnerAccreditations());
  };

  const filtered = filterType === "all" ? complianceDocs : complianceDocs.filter(d => d.docType === filterType);

  const stats = {
    total:    complianceDocs.length,
    verified: complianceDocs.filter(d => d.isVerified).length,
    pending:  complianceDocs.filter(d => !d.isVerified).length,
    expired:  complianceDocs.filter(d => d.validUntil && new Date(d.validUntil) < new Date()).length,
  };

  return (
    <div data-theme="lab" className="min-h-screen" style={{ background: "var(--base-100)" }}>

      {/* ── Sticky Header ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur-xl"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Back */}
            <motion.button whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }}
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs font-bold text-base-content/50 hover:text-primary transition-colors px-3 py-2 rounded-xl hover:bg-primary/8">
              <ArrowLeft size={15} />Back
            </motion.button>

            <div className="w-px h-5 bg-base-300" />

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10">
                <FileSearch size={18} className="text-primary" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-base-content">Compliance Documents</h1>
                <p className="text-[10px] text-base-content/50 font-medium">{stats.total} docs · {stats.verified} verified</p>
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
              <Plus size={15} />Upload Doc
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
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible" className="flex flex-wrap gap-3">
          {[
            { label: "Total",    value: stats.total,    color: "var(--primary)", icon: FileText },
            { label: "Verified", value: stats.verified, color: "var(--success)", icon: BadgeCheck },
            { label: "Pending",  value: stats.pending,  color: "var(--warning)", icon: Clock },
            { label: "Expired",  value: stats.expired,  color: "var(--error)",   icon: AlertCircle },
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

        {/* ── Checklist Banner ── */}
        <ChecklistBanner docs={complianceDocs} />

        {/* ── Notes panel ── */}
        <motion.div variants={fadeUp} custom={2} initial="hidden" animate="visible"
          className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-primary" />
            <p className="text-xs font-black text-primary uppercase tracking-widest">Submission Guidelines</p>
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

        {/* ── Filter bar ── */}
        {complianceDocs.length > 0 && (
          <motion.div variants={fadeUp} custom={3} initial="hidden" animate="visible" className="flex flex-wrap gap-2">
            <button onClick={() => setFilterType("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                filterType === "all" ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content/50 hover:border-primary/40"
              }`}>
              All ({complianceDocs.length})
            </button>
            {[...new Set(complianceDocs.map(d => d.docType))].map(t => {
              const m = DOC_META[t];
              const Ic = m?.icon || FileText;
              return (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                    filterType === t ? "border-primary bg-primary/10 text-primary" : "border-base-300 text-base-content/50 hover:border-primary/40"
                  }`}>
                  <Ic size={11} />{m?.label || t}
                </button>
              );
            })}
          </motion.div>
        )}

        {/* ── Document Cards ── */}
        {loading && complianceDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
            <p className="text-sm text-base-content/40 font-semibold">Loading documents…</p>
          </div>
        ) : complianceDocs.length === 0 ? (
          <motion.div variants={fadeUp} custom={4} initial="hidden" animate="visible"
            className="flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border-2 border-dashed border-base-300">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileText size={28} className="text-primary/50" />
            </div>
            <div className="text-center">
              <p className="font-bold text-base-content/60">No documents uploaded</p>
              <p className="text-sm text-base-content/35 mt-1">Upload mandatory compliance documents to get your lab approved</p>
            </div>
            <button onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-primary-content mt-1"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
              <Plus size={14} />Upload First Document
            </button>
          </motion.div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-base-content/40 text-sm font-semibold">No documents for this type.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((doc, i) => (
              <ComplianceCard key={doc._id} doc={doc} index={i} />
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