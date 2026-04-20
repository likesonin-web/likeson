"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, ChevronDown, Save, RefreshCw, AlertTriangle, X,
  Plus, Trash2, History, RotateCcw, Eye, Shield, Truck,
  UserCheck, Stethoscope, Building2, FlaskConical, Pill,
  Layers, Megaphone, Receipt, RotateCw, Lock, Info,
  BadgeCheck, AlertCircle, Database, Paperclip, ExternalLink,
  FileText, File, Upload, ChevronRight, Zap, TrendingUp,
} from "lucide-react";

// ─── Redux ────────────────────────────────────────────────────────────────────
import {
  fetchAdminPricingConfig,
  fetchPricingHistory,
  fetchPricingHistoryByIndex,
  restorePricingConfig,
  updateCaps,
  updateTransport,
  updateCareAssistant,
  updateCareAssistantTiers,
  updateDoctor,
  updateHospital,
  updateDiagnostics,
  updatePharmacy,
  updateCustomPlanOptions,
  updateAds,
  updateTax,
  updateRefundPolicy,
  deleteHospitalOverride,
  clearPricingError,
  clearSelectedSnapshot,
  clearRestoreStatus,
  selectAdminConfig,
  selectAdminConfigLoading,
  selectAdminConfigError,
  selectCaps,
  selectTransport,
  selectCareAssistant,
  selectDoctor,
  selectHospital,
  selectDiagnostics,
  selectPharmacy,
  selectCustomPlanOptions,
  selectAds,
  selectTax,
  selectRefundPolicy,
  selectCapsLoading,
  selectTransportLoading,
  selectCareAssistantLoading,
  selectCareAssistantTiersLoading,
  selectDoctorLoading,
  selectHospitalLoading,
  selectDiagnosticsLoading,
  selectPharmacyLoading,
  selectCustomPlanOptionsLoading,
  selectAdsLoading,
  selectTaxLoading,
  selectRefundPolicyLoading,
  selectCapsError,
  selectTransportError,
  selectCareAssistantError,
  selectCareAssistantTiersError,
  selectDoctorError,
  selectHospitalError,
  selectDiagnosticsError,
  selectPharmacyError,
  selectCustomPlanOptionsError,
  selectAdsError,
  selectTaxError,
  selectRefundPolicyError,
  selectAnySectionSaving,
  selectHospitalOverrideDeleteLoading,
  selectPricingHistory,
  selectPricingHistoryPagination,
  selectPricingHistoryLoading,
  selectSelectedSnapshot,
  selectSelectedSnapshotLoading,
  selectRestoreLoading,
  selectRestoreError,
} from "@/store/slices/platformPricingSlice";

import { uploadSingleFile } from "@/store/slices/uploadSlice";

// ─── User selector ─────────────────────────────────────────────────────────────
const selectUser = (s) => s.user.user;

// ─── Section metadata ─────────────────────────────────────────────────────────
const SECTION_META = {
  caps:              { label: "Discount Caps",        icon: Shield,      color: "#3b82f6", superadminOnly: true,  desc: "Monthly usage limits and maximum discount percentages" },
  transport:         { label: "Transport",            icon: Truck,       color: "#f59e0b", superadminOnly: false, desc: "Base fare, per-km rates, surcharges and platform fee" },
  careAssistant:     { label: "Care Assistant",       icon: UserCheck,   color: "#10b981", superadminOnly: true,  desc: "Dedicated payout, tiers, platform fee and incentives" },
  doctor:            { label: "Doctor Pricing",       icon: Stethoscope, color: "#8b5cf6", superadminOnly: false, desc: "Honorarium, tele & home visit charges, follow-up policy" },
  hospital:          { label: "Hospital Commission",  icon: Building2,   color: "#06b6d4", superadminOnly: true,  desc: "Platform fee, per-hospital overrides, settlement cycle" },
  diagnostics:       { label: "Diagnostics",          icon: FlaskConical,color: "#ec4899", superadminOnly: false, desc: "Lab platform fee, home sample fee, physical report fee" },
  pharmacy:          { label: "Pharmacy",             icon: Pill,        color: "#f97316", superadminOnly: false, desc: "Partner fee, own-store margin, delivery charges" },
  customPlanOptions: { label: "Custom Plan Prices",   icon: Layers,      color: "#6366f1", superadminOnly: true,  desc: "Slab-based pricing for consultation, transport, discounts" },
  ads:               { label: "Advertisements",       icon: Megaphone,   color: "#84cc16", superadminOnly: true,  desc: "Sponsored listing and homepage banner monthly fees" },
  tax:               { label: "GST / Tax",            icon: Receipt,     color: "#ef4444", superadminOnly: true,  desc: "GST rates by service type — regulatory, superadmin only" },
  refundPolicy:      { label: "Refund Policy",        icon: RotateCw,    color: "#14b8a6", superadminOnly: true,  desc: "Ride refund thresholds and processing day windows" },
};

const PLAN_SLUGS = [
  "basic-care","standard-care","premium-care",
  "family-care","pregnant-women-care","nris-care",
];

// ─── Animations ───────────────────────────────────────────────────────────────
const slide = {
  hidden:  { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
//  ATOMIC PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function FieldNote({ children }) {
  return (
    <p className="mt-1 text-[10px] font-medium leading-relaxed"
       style={{ color: "color-mix(in srgb,var(--base-content),transparent 50%)" }}>
      {children}
    </p>
  );
}

function FieldLabel({ children, superadminOnly, required }) {
  return (
    <label className="flex items-center gap-1.5 mb-1.5 text-[11px] font-bold uppercase tracking-widest"
           style={{ color: "color-mix(in srgb,var(--base-content),transparent 35%)" }}>
      {children}
      {required && <span style={{ color: "#ef4444" }}>*</span>}
      {superadminOnly && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black"
              style={{ background: "rgba(239,68,68,.12)", color: "#ef4444" }}>
          <Lock size={7} /> SA
        </span>
      )}
    </label>
  );
}

function NumericField({
  label, note, placeholder, value, onChange,
  min = 0, max, step = 1, suffix, prefix = "₹",
  superadminOnly, disabled, required,
}) {
  return (
    <div>
      <FieldLabel superadminOnly={superadminOnly} required={required}>{label}</FieldLabel>
      <div className="flex items-center rounded-xl overflow-hidden transition-all"
           style={{
             border: "1.5px solid var(--base-300)",
             background: "var(--base-200)",
             opacity: disabled ? 0.5 : 1,
           }}>
        {prefix && (
          <span className="px-3 text-xs font-black flex-shrink-0 h-10 flex items-center"
                style={{ background: "var(--base-300)", borderRight: "1px solid var(--base-300)", color: "var(--base-content)", opacity: 0.6 }}>
            {prefix}
          </span>
        )}
        <input
          type="number" value={value ?? ""} min={min} max={max} step={step}
          disabled={disabled}
          placeholder={placeholder ?? (prefix === "₹" ? "0.00" : "0")}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="flex-1 px-3 py-2.5 text-sm font-bold outline-none bg-transparent"
          style={{ color: "var(--base-content)", minWidth: 0 }}
        />
        {suffix && (
          <span className="px-3 text-[10px] font-black flex-shrink-0 h-10 flex items-center"
                style={{ background: "var(--base-300)", borderLeft: "1px solid var(--base-300)", color: "var(--base-content)", opacity: 0.6 }}>
            {suffix}
          </span>
        )}
      </div>
      {note && <FieldNote>{note}</FieldNote>}
    </div>
  );
}

function SelectField({ label, note, value, onChange, options, superadminOnly }) {
  return (
    <div>
      <FieldLabel superadminOnly={superadminOnly}>{label}</FieldLabel>
      <select
        value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="input-field w-full text-sm font-bold"
        style={{ cursor: "pointer" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {note && <FieldNote>{note}</FieldNote>}
    </div>
  );
}

function PlatformFeeField({ label, note, value = {}, onChange, superadminOnly }) {
  const type = value?.type ?? "percentage";
  const val  = value?.value ?? 0;
  return (
    <div className="col-span-full md:col-span-1">
      <FieldLabel superadminOnly={superadminOnly}>{label}</FieldLabel>
      <div className="flex gap-2">
        <select value={type} onChange={(e) => onChange({ type: e.target.value, value: val })}
          className="input-field text-xs font-black w-28 flex-shrink-0" style={{ cursor: "pointer" }}>
          <option value="percentage">% Rate</option>
          <option value="fixed">₹ Fixed</option>
        </select>
        <div className="flex flex-1 items-center rounded-xl overflow-hidden"
             style={{ border: "1.5px solid var(--base-300)", background: "var(--base-200)" }}>
          <input type="number" min={0} max={type === "percentage" ? 100 : undefined}
            step={type === "percentage" ? 0.5 : 1} value={val}
            placeholder={type === "percentage" ? "e.g. 10" : "e.g. 50"}
            onChange={(e) => onChange({ type, value: Number(e.target.value) })}
            className="flex-1 px-3 py-2.5 text-sm font-bold outline-none bg-transparent"
            style={{ color: "var(--base-content)", minWidth: 0 }} />
          <span className="px-3 text-[10px] font-black flex-shrink-0 h-10 flex items-center"
                style={{ background: "var(--base-300)", borderLeft: "1px solid var(--base-300)", opacity: 0.6 }}>
            {type === "percentage" ? "%" : "₹"}
          </span>
        </div>
      </div>
      {note && <FieldNote>{note}</FieldNote>}
    </div>
  );
}

function NoteField({ value, onChange }) {
  return (
    <div className="col-span-full">
      <FieldLabel>Change Note</FieldLabel>
      <input type="text"
        placeholder="Brief reason for this change — appears in audit log (e.g. 'Quarterly rate revision Q2 2025')"
        value={value} onChange={(e) => onChange(e.target.value)}
        className="input-field w-full text-sm" />
      <FieldNote>This note is saved in version history. Be specific — it helps with compliance audits.</FieldNote>
    </div>
  );
}

function SectionError({ error, statusKey, dispatch }) {
  if (!error) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 p-3 rounded-xl text-xs font-semibold mb-4"
      style={{ background: "rgba(239,68,68,.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,.18)" }}>
      <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1">{error}</span>
      <button onClick={() => dispatch(clearPricingError(statusKey))}><X size={11} /></button>
    </motion.div>
  );
}

function SaveButton({ onClick, loading, disabled, color, label = "Save Changes" }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
      onClick={onClick} disabled={loading || disabled}
      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white"
      style={{
        background: `linear-gradient(135deg, ${color}, color-mix(in srgb,${color},#000 20%))`,
        opacity: loading || disabled ? 0.6 : 1,
        boxShadow: `0 4px 20px ${color}50`,
        transition: "opacity .2s",
      }}>
      {loading ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
      {loading ? "Saving…" : label}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SOP UPLOADER
// ─────────────────────────────────────────────────────────────────────────────
function SopUploader({ sectionKey, existingDocs = [], color }) {
  const dispatch    = useDispatch();
  const isUploading = useSelector((s) => s.upload?.isUploading);
  const fileRef     = useRef(null);
  const [sessionDocs, setSessionDocs] = useState([]);
  const [drag, setDrag]               = useState(false);

  const allDocs = useMemo(() => [
    ...(existingDocs || []).map((d) => ({ ...d, src: "saved" })),
    ...sessionDocs,
  ], [existingDocs, sessionDocs]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const allowed = ["application/pdf","application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg","image/png","image/webp"];
    if (!allowed.includes(file.type)) return alert("Only PDF, DOC, DOCX, JPG, PNG, WEBP");
    if (file.size > 10 * 1024 * 1024) return alert("Max 10MB");
    const res = await dispatch(uploadSingleFile({ file, folder: `sop/${sectionKey}` }));
    if (uploadSingleFile.fulfilled.match(res)) {
      setSessionDocs((p) => [...p, {
        fileName: file.name, mimeType: file.type, sizeBytes: file.size,
        url: res.payload?.url, uploadedAt: new Date().toISOString(), src: "session",
      }]);
    }
  }, [dispatch, sectionKey]);

  const fmtSize = (b) => !b ? "" : b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`;

  return (
    <div className="mt-5 pt-5" style={{ borderTop: "1px dashed var(--base-300)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Paperclip size={11} style={{ color, opacity: 0.7 }} />
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ opacity: 0.45 }}>SOP Documents</span>
        {allDocs.length > 0 && (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
            {allDocs.length}
          </span>
        )}
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl cursor-pointer transition-all"
        style={{
          border: `1.5px dashed ${drag ? color : "var(--base-300)"}`,
          background: drag ? `${color}08` : "transparent",
          minHeight: 64,
        }}>
        <input ref={fileRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
          onChange={(e) => handleFile(e.target.files[0])} />
        {isUploading
          ? <RefreshCw size={14} className="animate-spin" style={{ color }} />
          : <>
              <Upload size={14} style={{ color, opacity: 0.6 }} />
              <p className="text-[10px] font-bold text-center" style={{ opacity: 0.45 }}>
                Drop file or <span style={{ color }}>browse</span> · PDF, DOC, DOCX, JPG · Max 10MB
              </p>
            </>
        }
      </div>
      {allDocs.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {allDocs.map((doc, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                 style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ background: `${color}15` }}>
                {doc.mimeType?.includes("pdf")
                  ? <FileText size={11} style={{ color: "#ef4444" }} />
                  : <File size={11} style={{ color }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate">{doc.fileName}</p>
                <p className="text-[9px] font-semibold" style={{ opacity: 0.4 }}>
                  {fmtSize(doc.sizeBytes)}{doc.uploadedAt ? ` · ${new Date(doc.uploadedAt).toLocaleDateString("en-IN")}` : ""}
                  {doc.src === "session" && <span className="ml-1 text-emerald-500 font-black">New</span>}
                </p>
              </div>
              {doc.url && (
                <a href={doc.url} target="_blank" rel="noreferrer"
                   onClick={(e) => e.stopPropagation()}
                   className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ background: `${color}15`, color }}>
                  <ExternalLink size={9} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION CARD
// ─────────────────────────────────────────────────────────────────────────────
function SectionCard({ sectionKey, isSuperadmin, children, loading, error, statusKey, dispatch }) {
  const [open, setOpen] = useState(false);
  const meta    = SECTION_META[sectionKey];
  const Icon    = meta.icon;
  const blocked = meta.superadminOnly && !isSuperadmin;

  return (
    <motion.div
      custom={Object.keys(SECTION_META).indexOf(sectionKey)}
      variants={slide} initial="hidden" animate="visible"
      className="rounded-2xl overflow-hidden"
      style={{
        background: open
          ? `linear-gradient(135deg,color-mix(in srgb,${meta.color},transparent 97%),var(--base-100))`
          : "var(--base-100)",
        border: open
          ? `1.5px solid color-mix(in srgb,${meta.color},transparent 55%)`
          : "1.5px solid var(--base-300)",
        boxShadow: open ? `0 8px 40px ${meta.color}14` : "0 2px 8px rgba(0,0,0,.04)",
        transition: "all .3s ease",
      }}>
      <button
        onClick={() => !blocked && setOpen((v) => !v)}
        disabled={blocked}
        className="w-full flex items-center gap-4 px-6 py-4 text-left group"
        style={{ cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.45 : 1 }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
             style={{ background: `${meta.color}15` }}>
          <Icon size={18} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-black">{meta.label}</p>
            {meta.superadminOnly && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(239,68,68,.1)", color: "#ef4444" }}>
                <Lock size={7} /> Superadmin
              </span>
            )}
            {loading && <RefreshCw size={10} className="animate-spin" style={{ color: meta.color }} />}
            {error  && <AlertCircle size={10} style={{ color: "#ef4444" }} />}
          </div>
          <p className="text-[10px] font-medium mt-0.5" style={{ opacity: 0.4 }}>{meta.desc}</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: .22 }}>
          <ChevronDown size={15} style={{ opacity: 0.4 }} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && !blocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: .35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden">
            <div className="px-6 pb-6 pt-2"
                 style={{ borderTop: `1px solid color-mix(in srgb,${meta.color},transparent 75%)` }}>
              <SectionError error={error} statusKey={statusKey} dispatch={dispatch} />
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 1  CAPS
// ─────────────────────────────────────────────────────────────────────────────
function CapsSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectCaps);
  const loading  = useSelector(selectCapsLoading);
  const error    = useSelector(selectCapsError);
  const admin    = useSelector(selectAdminConfig);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { if (data) setForm({ ...data }); }, [data]);

  return (
    <SectionCard sectionKey="caps" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="capsStatus" dispatch={dispatch}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-5">
        <NumericField label="Pharmacy Discount Max" value={form.pharmacyDiscountMax}
          onChange={(v) => set("pharmacyDiscountMax", v)} min={0} max={100} prefix="" suffix="%"
          placeholder="e.g. 25" superadminOnly
          note="Maximum % discount a user can receive on pharmacy orders. Default 25%." />
        <NumericField label="Diagnostics Discount Max" value={form.diagnosticsDiscountMax}
          onChange={(v) => set("diagnosticsDiscountMax", v)} min={0} max={100} prefix="" suffix="%"
          placeholder="e.g. 25" superadminOnly
          note="Maximum % discount on lab/diagnostic bookings. Default 25%." />
        <NumericField label="Care Assist Max Visits" value={form.careAssistantMaxVisitsPerMonth}
          onChange={(v) => set("careAssistantMaxVisitsPerMonth", v)} min={0} prefix="" suffix="/mo"
          placeholder="e.g. 30" superadminOnly
          note="Cap on care assistant bookings per user per calendar month." />
        <NumericField label="Max Consultations" value={form.consultationsMaxPerMonth}
          onChange={(v) => set("consultationsMaxPerMonth", v)} min={0} prefix="" suffix="/mo"
          placeholder="e.g. 30" superadminOnly
          note="Monthly doctor consultation limit per user." />
        <NumericField label="Max Transport Rides" value={form.transportMaxRidesPerMonth}
          onChange={(v) => set("transportMaxRidesPerMonth", v)} min={0} prefix="" suffix="/mo"
          placeholder="e.g. 20" superadminOnly
          note="Monthly ambulance/transport ride limit per user." />
        <NoteField value={note} onChange={setNote} />
      </div>
      <SopUploader sectionKey="caps" existingDocs={admin?.caps?.sopDocuments} color={SECTION_META.caps.color} />
      <div className="flex justify-end mt-5">
        <SaveButton onClick={() => { const { __v,_id,sopDocuments,...p } = form; dispatch(updateCaps({ ...p, note })); setNote(""); }}
          loading={loading} color={SECTION_META.caps.color} />
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 2  TRANSPORT
// ─────────────────────────────────────────────────────────────────────────────
function TransportSection({ isSuperadmin }) {
  const dispatch  = useDispatch();
  const data      = useSelector(selectTransport);
  const loading   = useSelector(selectTransportLoading);
  const error     = useSelector(selectTransportError);
  const admin     = useSelector(selectAdminConfig);
  const [form, setForm]           = useState({});
  const [overrides, setOverrides] = useState({});
  const [fee, setFee]             = useState({ type: "percentage", value: 0 });
  const [note, setNote]           = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (data) {
      const { planRateOverrides, platformFee, sopDocuments, ...rest } = data;
      setForm({ ...rest });
      setOverrides(planRateOverrides ? { ...planRateOverrides } : {});
      if (platformFee) setFee({ ...platformFee });
    }
  }, [data]);

  return (
    <SectionCard sectionKey="transport" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="transportStatus" dispatch={dispatch}>
      <div className="space-y-6 mt-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <NumericField label="Base Fare" value={form.baseFare} onChange={(v) => set("baseFare", v)}
            placeholder="e.g. 50" note="Flat charge applied to every ride before per-km calculation. Default ₹50." />
          <NumericField label="Default Rate/km" value={form.defaultRatePerKm} onChange={(v) => set("defaultRatePerKm", v)}
            placeholder="e.g. 21" note="Fallback per-km rate for plans without a specific override. Default ₹21." />
          <PlatformFeeField label="Platform Fee" value={fee} onChange={setFee}
            note="Fee Swasthya retains from each transport booking. Can be % or fixed ₹." />
          <NumericField label="Night Surcharge" value={form.nightSurchargeMultiplier} onChange={(v) => set("nightSurchargeMultiplier", v)}
            min={1} step={0.05} prefix="×" placeholder="e.g. 1.2"
            note="Multiplier applied to rides between night start and end hour. Min 1× (no surcharge)." />
          <NumericField label="Night Start" value={form.nightStartHour} onChange={(v) => set("nightStartHour", v)}
            min={0} max={23} prefix="" suffix="hr" placeholder="e.g. 22"
            note="Hour (24h) from which night surcharge begins. Default 22:00." />
          <NumericField label="Night End" value={form.nightEndHour} onChange={(v) => set("nightEndHour", v)}
            min={0} max={23} prefix="" suffix="hr" placeholder="e.g. 6"
            note="Hour (24h) at which night surcharge ends. Default 06:00." />
          <NumericField label="Free Waiting" value={form.waitingFreeMinutes} onChange={(v) => set("waitingFreeMinutes", v)}
            min={0} prefix="" suffix="min" placeholder="e.g. 5"
            note="Minutes the driver waits at pickup for free before waiting charges begin." />
          <NumericField label="Waiting Charge" value={form.waitingChargePerMinute} onChange={(v) => set("waitingChargePerMinute", v)}
            min={0} suffix="/min" placeholder="e.g. 2"
            note="Per-minute charge billed to the user after the free waiting window." />
          <NumericField label="Cancellation Fee" value={form.cancellationFeePercent} onChange={(v) => set("cancellationFeePercent", v)}
            min={0} max={100} prefix="" suffix="%" placeholder="e.g. 50"
            note="Percentage of ride fare charged if user cancels after driver is assigned." />
        </div>

        {/* Per-plan overrides */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ opacity: 0.38 }}>
            Per-Plan Rate Overrides (₹/km)
          </p>
          <p className="text-[10px] font-medium mb-4" style={{ opacity: 0.45 }}>
            Set a custom per-km rate for each subscription plan. Leave blank to use the default rate. Set null (empty) for NRI plan (not applicable).
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PLAN_SLUGS.map((slug) => (
              <div key={slug}>
                <FieldLabel>{slug}</FieldLabel>
                <input type="number" value={overrides[slug] ?? ""} placeholder="null = N/A"
                  onChange={(e) => setOverrides((o) => ({ ...o, [slug]: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="input-field w-full text-sm font-bold" />
                <FieldNote>Custom ₹/km for {slug}. Blank = use default rate.</FieldNote>
              </div>
            ))}
          </div>
        </div>

        <SopUploader sectionKey="transport" existingDocs={admin?.transport?.sopDocuments} color={SECTION_META.transport.color} />
        <div className="grid grid-cols-1"><NoteField value={note} onChange={setNote} /></div>
        <div className="flex justify-end">
          <SaveButton onClick={() => { dispatch(updateTransport({ ...form, platformFee: fee, planRateOverrides: overrides, note })); setNote(""); }}
            loading={loading} color={SECTION_META.transport.color} />
        </div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 3  CARE ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────
function CareAssistantFullSection({ isSuperadmin }) {
  const dispatch    = useDispatch();
  const data        = useSelector(selectCareAssistant);
  const loading     = useSelector(selectCareAssistantLoading);
  const tiersLoad   = useSelector(selectCareAssistantTiersLoading);
  const tiersError  = useSelector(selectCareAssistantTiersError);
  const error       = useSelector(selectCareAssistantError);
  const admin       = useSelector(selectAdminConfig);

  const [form, setForm]           = useState({});
  const [fee, setFee]             = useState({ type: "percentage", value: 0 });
  const [note, setNote]           = useState("");
  const [tiers, setTiers]         = useState([]);
  const [tiersNote, setTiersNote] = useState("");
  const [tiersOpen, setTiersOpen] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (data) {
      const { platformFee, pricingTiers, sopDocuments, ...rest } = data;
      setForm({ ...rest });
      if (platformFee) setFee({ ...platformFee });
      if (pricingTiers) setTiers(pricingTiers.map((t) => ({ ...t })));
    }
  }, [data]);

  const updateTier = (i, k, v) => setTiers((ts) => ts.map((t, idx) => idx === i ? { ...t, [k]: v } : t));
  const addTier    = () => setTiers((ts) => [...ts, { label: `Tier ${ts.length + 1}`, minHours: 0, maxHours: null, chargeToUser: 0, payoutToAssistant: 0, isActive: true }]);
  const removeTier = (i) => setTiers((ts) => ts.filter((_, idx) => idx !== i));

  return (
    <SectionCard sectionKey="careAssistant" isSuperadmin={isSuperadmin} loading={loading || tiersLoad}
      error={error || tiersError} statusKey="careAssistantStatus" dispatch={dispatch}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-5">
        <NumericField label="Dedicated Monthly Payout" value={form.dedicatedMonthlyPayout}
          onChange={(v) => set("dedicatedMonthlyPayout", v)} placeholder="e.g. 8000"
          note="Monthly salary paid to a full-time/dedicated care assistant. Default ₹8000." />
        <NumericField label="Dedicated Monthly Charge" value={form.dedicatedMonthlyCharge}
          onChange={(v) => set("dedicatedMonthlyCharge", v)} placeholder="e.g. 10000"
          note="Monthly amount billed to the family for a dedicated assistant. Default ₹10000." />
        <PlatformFeeField label="Platform Fee" value={fee} onChange={setFee}
          note="Platform's commission on each visit booking, applied on top of tier pricing." />
        <NumericField label="Punctuality Bonus/Visit" value={form.punctualityBonusPerVisit}
          onChange={(v) => set("punctualityBonusPerVisit", v)} placeholder="e.g. 25"
          note="Bonus paid to assistant for arriving on time to a booking. Default ₹25." />
        <NumericField label="No-Show Penalty" value={form.noShowPenalty}
          onChange={(v) => set("noShowPenalty", v)} placeholder="e.g. 100"
          note="Amount deducted from assistant payout for a confirmed no-show. Default ₹100." />
        <NumericField label="Overtime Rate/Hour" value={form.overtimeRatePerHour}
          onChange={(v) => set("overtimeRatePerHour", v)} placeholder="e.g. 120"
          note="Per-hour charge for time beyond the last tier's maxHours limit. Default ₹120." />
        <NoteField value={note} onChange={setNote} />
      </div>
      <div className="flex justify-end mt-4">
        <SaveButton onClick={() => { dispatch(updateCareAssistant({ ...form, platformFee: fee, note })); setNote(""); }}
          loading={loading} color={SECTION_META.careAssistant.color} />
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl mt-5"
           style={{ background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.18)" }}>
        <Info size={12} style={{ color: "#10b981", flexShrink: 0, marginTop: 1 }} />
        <p className="text-[11px] font-semibold" style={{ color: "#10b981" }}>
          Per-visit chargeToUser / payoutToAssistant are set per duration tier below.
        </p>
      </div>

      <div className="mt-4">
        <button onClick={() => setTiersOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black"
          style={{ background: tiersOpen ? "rgba(16,185,129,.1)" : "rgba(16,185,129,.05)", border: "1px solid rgba(16,185,129,.18)", color: "#10b981" }}>
          <span className="flex items-center gap-2"><Layers size={11} /> Pricing Tiers (duration-based)</span>
          <motion.span animate={{ rotate: tiersOpen ? 180 : 0 }} transition={{ duration: .2 }}>
            <ChevronDown size={12} />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {tiersOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: .3, ease: [0.22,1,0.36,1] }}
              className="overflow-hidden">
              <div className="pt-4 space-y-2">
                <p className="text-[10px] font-medium mb-3" style={{ opacity: 0.45 }}>
                  Each tier defines a booking-duration window. The system picks the first tier where minHours ≤ bookingHours &lt; maxHours. Tiers must be contiguous — no gaps or overlaps. Last tier must have maxHours = null (open-ended).
                </p>
                <div className="grid grid-cols-12 gap-1 text-[9px] font-black uppercase tracking-widest px-1"
                     style={{ opacity: 0.35 }}>
                  <span className="col-span-3">Label</span>
                  <span className="col-span-2 text-center">Min hrs</span>
                  <span className="col-span-2 text-center">Max hrs</span>
                  <span className="col-span-2 text-center">Charge ₹</span>
                  <span className="col-span-2 text-center">Payout ₹</span>
                  <span className="col-span-1 text-center">On</span>
                </div>
                {tiers.map((tier, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1 items-center p-2 rounded-xl"
                       style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
                    {[
                      { t:"text",  v:tier.label,            k:"label",            cls:"col-span-3", placeholder:"e.g. 0–4 Hours" },
                      { t:"number",v:tier.minHours,         k:"minHours",         cls:"col-span-2 text-center", min:0, parse:Number, placeholder:"0" },
                      { t:"number",v:tier.maxHours,         k:"maxHours",         cls:"col-span-2 text-center", min:0, nullable:true, placeholder:"∞" },
                      { t:"number",v:tier.chargeToUser,     k:"chargeToUser",     cls:"col-span-2 text-center", min:0, parse:Number, placeholder:"400" },
                      { t:"number",v:tier.payoutToAssistant,k:"payoutToAssistant",cls:"col-span-2 text-center", min:0, parse:Number, placeholder:"300" },
                    ].map(({ t, v, k, cls, min, nullable, parse, placeholder }) => (
                      <input key={k} type={t}
                        value={nullable ? (v ?? "") : (v ?? (t === "number" ? 0 : ""))}
                        placeholder={placeholder} min={min}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (nullable) val = val === "" ? null : Number(val);
                          else if (parse) val = parse(val);
                          updateTier(i, k, val);
                        }}
                        className={`${cls} px-2 py-1.5 rounded-lg text-xs font-bold outline-none`}
                        style={{ background:"var(--base-100)", border:"1px solid var(--base-300)", color:"var(--base-content)" }}
                      />
                    ))}
                    <div className="col-span-1 flex items-center justify-center gap-0.5">
                      <button onClick={() => updateTier(i, "isActive", !tier.isActive)}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black"
                        style={{ background: tier.isActive ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.1)", color: tier.isActive ? "#10b981" : "#ef4444" }}>
                        {tier.isActive ? "✓" : "✗"}
                      </button>
                      <button onClick={() => removeTier(i)}
                        className="w-5 h-5 rounded-md flex items-center justify-center"
                        style={{ background:"rgba(239,68,68,.08)", color:"#ef4444" }}>
                        <X size={8} />
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={addTier}
                  className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg mt-1"
                  style={{ background:"rgba(16,185,129,.1)", color:"#10b981" }}>
                  <Plus size={10} /> Add Tier
                </button>
                <div className="mt-3"><NoteField value={tiersNote} onChange={setTiersNote} /></div>
                <div className="flex justify-end mt-2">
                  <SaveButton
                    onClick={() => { dispatch(updateCareAssistantTiers({ pricingTiers: tiers.map(({_id,__v,...t}) => t), note: tiersNote })); setTiersNote(""); }}
                    loading={tiersLoad} color={SECTION_META.careAssistant.color} label="Save Tiers" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SopUploader sectionKey="careAssistant" existingDocs={admin?.careAssistant?.sopDocuments} color={SECTION_META.careAssistant.color} />
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 4  DOCTOR
// ─────────────────────────────────────────────────────────────────────────────
function DoctorSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectDoctor);
  const loading  = useSelector(selectDoctorLoading);
  const error    = useSelector(selectDoctorError);
  const admin    = useSelector(selectAdminConfig);
  const [form, setForm] = useState({});
  const [fee, setFee]   = useState({ type: "percentage", value: 0 });
  const [note, setNote] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (data) { const { platformFee, sopDocuments, ...rest } = data; setForm({ ...rest }); if (platformFee) setFee({ ...platformFee }); }
  }, [data]);

  return (
    <SectionCard sectionKey="doctor" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="doctorStatus" dispatch={dispatch}>
      <div className="space-y-6 mt-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ opacity: 0.35 }}>In-Person Consultation</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <NumericField label="Honorarium/Consult" value={form.honorariumPerConsultation}
              onChange={(v) => set("honorariumPerConsultation", v)} placeholder="e.g. 400"
              note="Amount paid to the doctor per in-person consultation. Default ₹400." />
            <NumericField label="Charge To User" value={form.chargeToUser}
              onChange={(v) => set("chargeToUser", v)} placeholder="e.g. 600"
              note="Fee billed to the patient for an in-person consultation. Default ₹600." />
            <PlatformFeeField label="Platform Fee" value={fee} onChange={setFee}
              note="Swasthya's cut from each consultation booking." />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ opacity: 0.35 }}>Tele-Consultation</p>
          <div className="grid grid-cols-2 gap-5">
            <NumericField label="Tele Charge (User)" value={form.teleConsultationChargeToUser}
              onChange={(v) => set("teleConsultationChargeToUser", v)} placeholder="e.g. 500"
              note="Amount billed to patient for an online/video consultation. Default ₹500." />
            <NumericField label="Tele Honorarium" value={form.teleConsultationHonorarium}
              onChange={(v) => set("teleConsultationHonorarium", v)} placeholder="e.g. 350"
              note="Doctor's earnings per tele-consultation. Default ₹350." />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ opacity: 0.35 }}>Home Visit</p>
          <div className="grid grid-cols-2 gap-5">
            <NumericField label="Home Visit Charge" value={form.homeVisitChargeToUser}
              onChange={(v) => set("homeVisitChargeToUser", v)} placeholder="e.g. 1000"
              note="Amount charged to patient for a doctor home visit. Default ₹1000." />
            <NumericField label="Home Visit Honorarium" value={form.homeVisitHonorarium}
              onChange={(v) => set("homeVisitHonorarium", v)} placeholder="e.g. 700"
              note="Doctor's payout per home visit. Default ₹700." />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ opacity: 0.35 }}>Follow-Up Policy</p>
          <div className="grid grid-cols-2 gap-5">
            <NumericField label="Follow-Up Discount" value={form.followUpDiscountPercent}
              onChange={(v) => set("followUpDiscountPercent", v)} min={0} max={100} prefix="" suffix="%"
              placeholder="e.g. 20"
              note="% discount applied to a consultation if patient returns within valid days. Default 20%." />
            <NumericField label="Follow-Up Valid Days" value={form.followUpValidDays}
              onChange={(v) => set("followUpValidDays", v)} min={1} prefix="" suffix="days"
              placeholder="e.g. 7"
              note="Number of days after a consultation during which follow-up discount applies. Default 7." />
          </div>
        </div>
        <SopUploader sectionKey="doctor" existingDocs={admin?.doctor?.sopDocuments} color={SECTION_META.doctor.color} />
        <div className="grid grid-cols-1"><NoteField value={note} onChange={setNote} /></div>
        <div className="flex justify-end">
          <SaveButton onClick={() => { dispatch(updateDoctor({ ...form, platformFee: fee, note })); setNote(""); }}
            loading={loading} color={SECTION_META.doctor.color} />
        </div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 5  HOSPITAL
// ─────────────────────────────────────────────────────────────────────────────
function HospitalSection({ isSuperadmin }) {
  const dispatch     = useDispatch();
  const data         = useSelector(selectHospital);
  const loading      = useSelector(selectHospitalLoading);
  const error        = useSelector(selectHospitalError);
  const deleteLoad   = useSelector(selectHospitalOverrideDeleteLoading);
  const admin        = useSelector(selectAdminConfig);
  const [form, setForm]           = useState({});
  const [fee, setFee]             = useState({ type: "percentage", value: 0 });
  const [overrides, setOverrides] = useState({});
  const [newId, setNewId]         = useState("");
  const [newFee, setNewFee]       = useState({ type: "percentage", value: 0 });
  const [note, setNote]           = useState("");

  useEffect(() => {
    if (data) {
      const { platformFee, hospitalOverrides, sopDocuments, ...rest } = data;
      setForm({ ...rest });
      if (platformFee) setFee({ ...platformFee });
      setOverrides(hospitalOverrides ? { ...hospitalOverrides } : {});
    }
  }, [data]);

  const addOverride = () => {
    if (!newId.trim()) return;
    setOverrides((o) => ({ ...o, [newId.trim()]: { ...newFee } }));
    setNewId(""); setNewFee({ type: "percentage", value: 0 });
  };

  return (
    <SectionCard sectionKey="hospital" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="hospitalStatus" dispatch={dispatch}>
      <div className="space-y-6 mt-5">
        <div className="grid grid-cols-2 gap-5">
          <PlatformFeeField label="Default Platform Fee" value={fee} onChange={setFee}
            note="Commission applied to all hospital bookings unless a per-hospital override exists." />
          <SelectField label="Settlement Cycle" value={form.settlementCycle}
            onChange={(v) => setForm((f) => ({ ...f, settlementCycle: v }))}
            options={[{ value:"weekly",label:"Weekly" },{ value:"biweekly",label:"Bi-weekly" },{ value:"monthly",label:"Monthly" }]}
            note="How often the platform settles payments with hospital partners." />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ opacity: 0.35 }}>Per-Hospital Fee Overrides</p>
          <p className="text-[10px] font-medium mb-4" style={{ opacity: 0.45 }}>
            Override the default platform fee for a specific hospital by its MongoDB ObjectId. Use DELETE to remove an override.
          </p>
          {Object.keys(overrides).length === 0 && (
            <p className="text-xs font-medium py-2" style={{ opacity: 0.4 }}>No overrides — all hospitals use the default fee above.</p>
          )}
          {Object.entries(overrides).map(([id, f]) => (
            <div key={id} className="flex items-center gap-2 mb-2">
              <span className="flex-1 text-xs font-mono font-bold px-2.5 py-2 rounded-xl"
                    style={{ background:"var(--base-200)", border:"1px solid var(--base-300)" }}>{id}</span>
              <span className="text-xs font-black px-3 py-2 rounded-xl"
                    style={{ background:"rgba(6,182,212,.1)", color:"#06b6d4" }}>
                {f?.type === "fixed" ? `₹${f?.value}` : `${f?.value}%`}
              </span>
              <button onClick={() => dispatch(deleteHospitalOverride(id))} disabled={deleteLoad}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:"rgba(239,68,68,.1)", color:"#ef4444" }}>
                {deleteLoad ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={11} />}
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-4 flex-wrap">
            <input type="text" placeholder="Hospital ObjectId (24-char hex)" value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="input-field flex-1 text-xs font-mono min-w-36" />
            <select value={newFee.type} onChange={(e) => setNewFee((f) => ({ ...f, type: e.target.value }))}
              className="input-field text-xs font-black w-28" style={{ cursor:"pointer" }}>
              <option value="percentage">% Rate</option>
              <option value="fixed">₹ Fixed</option>
            </select>
            <input type="number" value={newFee.value} min={0}
              max={newFee.type === "percentage" ? 100 : undefined}
              onChange={(e) => setNewFee((f) => ({ ...f, value: Number(e.target.value) }))}
              placeholder="Value" className="input-field w-24 text-sm font-black" />
            <button onClick={addOverride}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black"
              style={{ background:"rgba(6,182,212,.15)", color:"#06b6d4" }}>
              <Plus size={11} /> Add
            </button>
          </div>
          <FieldNote>Overrides are applied immediately on save. Remove with the trash icon (calls DELETE /hospital/override/:id).</FieldNote>
        </div>
        <SopUploader sectionKey="hospital" existingDocs={admin?.hospital?.sopDocuments} color={SECTION_META.hospital.color} />
        <div className="grid grid-cols-1"><NoteField value={note} onChange={setNote} /></div>
        <div className="flex justify-end">
          <SaveButton onClick={() => { dispatch(updateHospital({ ...form, platformFee: fee, hospitalOverrides: overrides, note })); setNote(""); }}
            loading={loading} color={SECTION_META.hospital.color} />
        </div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 6  DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────
function DiagnosticsSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectDiagnostics);
  const loading  = useSelector(selectDiagnosticsLoading);
  const error    = useSelector(selectDiagnosticsError);
  const admin    = useSelector(selectAdminConfig);
  const [form, setForm]                  = useState({});
  const [fee, setFee]                    = useState({ type:"percentage", value:0 });
  const [homeSampleFee, setHomeSampleFee] = useState({ type:"fixed", value:0 });
  const [note, setNote]                  = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (data) {
      const { platformFee, homeSamplePlatformFee, labOverrides, sopDocuments, ...rest } = data;
      setForm({ ...rest });
      if (platformFee) setFee({ ...platformFee });
      if (homeSamplePlatformFee) setHomeSampleFee({ ...homeSamplePlatformFee });
    }
  }, [data]);

  return (
    <SectionCard sectionKey="diagnostics" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="diagnosticsStatus" dispatch={dispatch}>
      <div className="space-y-6 mt-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          <PlatformFeeField label="Default Platform Fee (Labs)" value={fee} onChange={setFee}
            note="Commission Swasthya earns on lab test bookings. Overridable per lab in LabPartnerProfile." />
          <NumericField label="Home Sample Charge" value={form.homeSampleCollectionCharge}
            onChange={(v) => set("homeSampleCollectionCharge", v)} placeholder="e.g. 75"
            note="Flat charge billed to user for home blood/sample collection. Default ₹75." />
          <PlatformFeeField label="Home Sample Platform Fee" value={homeSampleFee} onChange={setHomeSampleFee}
            note="Platform's fee on top of the home sample collection charge." />
          <NumericField label="Physical Report Fee" value={form.physicalReportFee}
            onChange={(v) => set("physicalReportFee", v)} placeholder="e.g. 50"
            note="Charge for printing and couriering a physical lab report. Default ₹50." />
          <SelectField label="Settlement Cycle" value={form.settlementCycle} onChange={(v) => set("settlementCycle", v)}
            options={[{value:"weekly",label:"Weekly"},{value:"biweekly",label:"Bi-weekly"},{value:"monthly",label:"Monthly"}]}
            note="How often Swasthya settles with lab partners." />
        </div>
        <SopUploader sectionKey="diagnostics" existingDocs={admin?.diagnostics?.sopDocuments} color={SECTION_META.diagnostics.color} />
        <div className="grid grid-cols-1"><NoteField value={note} onChange={setNote} /></div>
        <div className="flex justify-end">
          <SaveButton onClick={() => { dispatch(updateDiagnostics({ ...form, platformFee:fee, homeSamplePlatformFee:homeSampleFee, note })); setNote(""); }}
            loading={loading} color={SECTION_META.diagnostics.color} />
        </div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 7  PHARMACY
// ─────────────────────────────────────────────────────────────────────────────
function PharmacySection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectPharmacy);
  const loading  = useSelector(selectPharmacyLoading);
  const error    = useSelector(selectPharmacyError);
  const admin    = useSelector(selectAdminConfig);
  const [form, setForm] = useState({});
  const [fee, setFee]   = useState({ type:"percentage", value:0 });
  const [note, setNote] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (data) { const { platformFee, sopDocuments, ...rest } = data; setForm({ ...rest }); if (platformFee) setFee({ ...platformFee }); }
  }, [data]);

  return (
    <SectionCard sectionKey="pharmacy" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="pharmacyStatus" dispatch={dispatch}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-5">
        <PlatformFeeField label="Partner Platform Fee" value={fee} onChange={setFee}
          note="Commission on orders fulfilled by partner pharmacies (not Swasthya's own store)." />
        <NumericField label="Own Store Margin" value={form.ownStoreMarginPercent}
          onChange={(v) => set("ownStoreMarginPercent", v)} min={0} max={100} prefix="" suffix="%"
          placeholder="e.g. 30" note="Profit margin kept by Swasthya's own pharmacy inventory. Default 30%." />
        <NumericField label="Express Delivery Charge" value={form.expressDeliveryCharge}
          onChange={(v) => set("expressDeliveryCharge", v)} placeholder="e.g. 49"
          note="Fee charged to user for same-day/express medicine delivery. Default ₹49." />
        <NumericField label="Delivery Agent Payout" value={form.deliveryAgentPayout}
          onChange={(v) => set("deliveryAgentPayout", v)} placeholder="e.g. 30"
          note="Amount paid to delivery agent per completed delivery. Default ₹30." />
        <NumericField label="Free Delivery Min Order" value={form.freeDeliveryMinOrderValue}
          onChange={(v) => set("freeDeliveryMinOrderValue", v)} placeholder="e.g. 200"
          note="Minimum cart value above which standard delivery is free. Default ₹200." />
        <SelectField label="Settlement Cycle" value={form.settlementCycle} onChange={(v) => set("settlementCycle", v)}
          options={[{value:"weekly",label:"Weekly"},{value:"biweekly",label:"Bi-weekly"},{value:"monthly",label:"Monthly"}]}
          note="Frequency of payouts to partner pharmacies." />
        <NoteField value={note} onChange={setNote} />
      </div>
      <SopUploader sectionKey="pharmacy" existingDocs={admin?.pharmacy?.sopDocuments} color={SECTION_META.pharmacy.color} />
      <div className="flex justify-end mt-5">
        <SaveButton onClick={() => { dispatch(updatePharmacy({ ...form, platformFee:fee, note })); setNote(""); }}
          loading={loading} color={SECTION_META.pharmacy.color} />
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 8  CUSTOM PLAN OPTIONS
//
//  CHANGE: SlabEditor for transport kmSlabs updated.
//          keyA="pricePerKm" labelA="₹/km Rate" suffixA="₹/km"
//          keyB="packagePrice" labelB="Package Price" suffixB="₹"
//          Matches new schema: { pricePerKm, packagePrice } — no `km` field.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic slab editor.
 * keyA / keyB = object keys to read/write on each slab.
 * suffixA / suffixB = unit labels shown in the input suffix box.
 * isPriceA / isPriceB = show ₹ prefix on left side of that input.
 */
function SlabEditor({ label, note, slabs = [], onChange, keyA, keyB, suffixA, suffixB, isPriceA = false, isPriceB = true }) {
  const update = (i, k, v) => onChange(slabs.map((s, idx) => idx === i ? { ...s, [k]: Number(v) } : s));
  const add    = () => onChange([...slabs, { [keyA]: 0, [keyB]: 0 }]);
  const remove = (i) => onChange(slabs.filter((_, idx) => idx !== i));

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ opacity: 0.35 }}>{label}</p>
      {note && <p className="text-[10px] font-medium mb-3" style={{ opacity: 0.45 }}>{note}</p>}
      {slabs.map((slab, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          {[
            { k: keyA, suffix: suffixA, isPrice: isPriceA },
            { k: keyB, suffix: suffixB, isPrice: isPriceB },
          ].map(({ k, suffix, isPrice }) => (
            <div key={k} className="flex-1 flex items-center rounded-xl overflow-hidden"
                 style={{ border:"1.5px solid var(--base-300)", background:"var(--base-200)" }}>
              {isPrice && (
                <span className="px-2 text-[10px] font-black h-10 flex items-center flex-shrink-0"
                      style={{ background:"var(--base-300)", borderRight:"1px solid var(--base-300)", opacity:0.6 }}>₹</span>
              )}
              <input type="number" value={slab[k] ?? ""} min={0} placeholder="0"
                onChange={(e) => update(i, k, e.target.value)}
                className="flex-1 px-3 py-2.5 text-sm font-bold outline-none bg-transparent"
                style={{ color:"var(--base-content)", minWidth:0 }} />
              <span className="px-2 text-[10px] font-black h-10 flex items-center flex-shrink-0"
                    style={{ background:"var(--base-300)", borderLeft:"1px solid var(--base-300)", opacity:0.6 }}>{suffix}</span>
            </div>
          ))}
          <button onClick={() => remove(i)}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:"rgba(239,68,68,.08)", color:"#ef4444" }}>
            <X size={10} />
          </button>
        </div>
      ))}
      <button onClick={add}
        className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg mt-1"
        style={{ background:"color-mix(in srgb,var(--primary),transparent 88%)", color:"var(--primary)" }}>
        <Plus size={10} /> Add Slab
      </button>
    </div>
  );
}

function CustomPlanOptionsSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectCustomPlanOptions);
  const loading  = useSelector(selectCustomPlanOptionsLoading);
  const error    = useSelector(selectCustomPlanOptionsError);
  const admin    = useSelector(selectAdminConfig);

  const [consultation, setConsultation] = useState({ pricePerConsultation:0, maxDoctorsAllowed:5, doctorPricingTiers:[] });
  const [transport, setTransport]       = useState({ kmSlabs:[] });
  const [diagDiscount, setDiagDiscount] = useState({ slabs:[] });
  const [pharmDiscount, setPharmDiscount] = useState({ slabs:[] });
  const [caTiers, setCaTiers]           = useState([]);
  const [addOns, setAddOns]             = useState({ homeSampleCollection:199, prioritySupport:99 });
  const [note, setNote]                 = useState("");

  useEffect(() => {
    if (data) {
      if (data.consultation) setConsultation({ ...data.consultation });
      if (data.transport) setTransport({ ...data.transport });
      if (data.diagnosticsDiscount) setDiagDiscount({ ...data.diagnosticsDiscount });
      if (data.pharmacyDiscount) setPharmDiscount({ ...data.pharmacyDiscount });
      if (data.careAssistant?.pricingTiers) setCaTiers([...data.careAssistant.pricingTiers]);
      if (data.addOns) setAddOns({ ...data.addOns });
    }
  }, [data]);

  return (
    <SectionCard sectionKey="customPlanOptions" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="customPlanOptionsStatus" dispatch={dispatch}>
      <div className="flex items-start gap-2 p-3 rounded-xl my-5"
           style={{ background:"rgba(99,102,241,.06)", border:"1px solid rgba(99,102,241,.18)" }}>
        <Info size={12} style={{ color:"#6366f1", flexShrink:0, marginTop:1 }} />
        <p className="text-[11px] font-semibold" style={{ color:"#6366f1" }}>
          Changes here only affect NEW custom plans created after this save. Existing plans snapshot prices at creation time and are not retroactively changed.
        </p>
      </div>

      <div className="space-y-7">
        {/* Consultation */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ opacity: 0.35 }}>Consultation Block</p>
          <div className="grid grid-cols-2 gap-5 mb-4">
            <NumericField label="Price Per Consultation" value={consultation.pricePerConsultation}
              onChange={(v) => setConsultation((c) => ({ ...c, pricePerConsultation: v }))}
              placeholder="e.g. 299"
              note="Base price added to a custom plan for each consultation slot." />
            <NumericField label="Max Doctors Allowed" value={consultation.maxDoctorsAllowed}
              min={1} prefix=""
              onChange={(v) => setConsultation((c) => ({ ...c, maxDoctorsAllowed: v }))}
              placeholder="e.g. 5"
              note="Maximum number of specialist doctors a single custom plan can include." />
          </div>
          <p className="text-[10px] font-semibold mb-2" style={{ opacity: 0.4 }}>Doctor count → additional price tiers</p>
          <p className="text-[10px] font-medium mb-3" style={{ opacity: 0.4 }}>
            As the plan includes more doctors, the additional price per extra doctor is looked up from these tiers.
          </p>
          {(consultation.doctorPricingTiers ?? []).map((tier, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input type="number" placeholder="Doctor count" value={tier.doctorCount ?? ""}
                onChange={(e) => { const t = [...(consultation.doctorPricingTiers ?? [])]; t[i] = { ...t[i], doctorCount: Number(e.target.value) }; setConsultation((c) => ({ ...c, doctorPricingTiers: t })); }}
                className="input-field flex-1 text-sm font-bold" />
              <input type="number" placeholder="Additional price ₹" value={tier.additionalPrice ?? ""}
                onChange={(e) => { const t = [...(consultation.doctorPricingTiers ?? [])]; t[i] = { ...t[i], additionalPrice: Number(e.target.value) }; setConsultation((c) => ({ ...c, doctorPricingTiers: t })); }}
                className="input-field flex-1 text-sm font-bold" />
              <button onClick={() => setConsultation((c) => ({ ...c, doctorPricingTiers: (c.doctorPricingTiers ?? []).filter((_,idx) => idx !== i) }))}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background:"rgba(239,68,68,.08)", color:"#ef4444" }}>
                <X size={10} />
              </button>
            </div>
          ))}
          <button onClick={() => setConsultation((c) => ({ ...c, doctorPricingTiers: [...(c.doctorPricingTiers ?? []), { doctorCount:1, additionalPrice:0 }] }))}
            className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg mt-1"
            style={{ background:"color-mix(in srgb,var(--primary),transparent 88%)", color:"var(--primary)" }}>
            <Plus size={10} /> Add Tier
          </button>
        </div>

        {/*
          CHANGE: Transport kmSlabs now uses pricePerKm + packagePrice.
          keyA="pricePerKm"   suffixA="₹/km"  isPriceA=false (no ₹ prefix — suffix already says ₹/km)
          keyB="packagePrice" suffixB="₹"      isPriceB=true
          Old fields `km` and `price` are gone from schema.
        */}
        <SlabEditor
          label="Transport — KM Slabs"
          note="Each slab sets a per-km rate and a flat package price. User selects a slab; service layer computes cost as actualKm × pricePerKm."
          slabs={transport.kmSlabs ?? []}
          onChange={(s) => setTransport({ kmSlabs: s })}
          keyA="pricePerKm"
          keyB="packagePrice"
          suffixA="₹/km"
          suffixB="₹"
          isPriceA={false}
          isPriceB={true}
        />

        <SlabEditor label="Diagnostics Discount Slabs"
          note="Maps a discount percentage to the additional plan price required to unlock it."
          slabs={diagDiscount.slabs ?? []} onChange={(s) => setDiagDiscount({ slabs: s })}
          keyA="percent" keyB="price" suffixA="%" suffixB="₹"
          isPriceA={false} isPriceB={true} />

        <SlabEditor label="Pharmacy Discount Slabs"
          note="Maps a pharmacy discount percentage to its unlock price in the custom plan builder."
          slabs={pharmDiscount.slabs ?? []} onChange={(s) => setPharmDiscount({ slabs: s })}
          keyA="percent" keyB="price" suffixA="%" suffixB="₹"
          isPriceA={false} isPriceB={true} />

        {/* Care assistant plan tiers */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ opacity: 0.35 }}>Care Assistant — Plan-Specific Tiers</p>
          <p className="text-[10px] font-medium mb-3" style={{ opacity: 0.45 }}>
            Override global care assistant tiers for custom plans. Leave empty to inherit global tiers.
          </p>
          {caTiers.length === 0 && (
            <p className="text-xs font-medium py-2" style={{ opacity: 0.4 }}>Using global care assistant pricing tiers.</p>
          )}
          {caTiers.map((tier, i) => (
            <div key={i} className="grid grid-cols-12 gap-1 items-center p-2 rounded-xl mb-2"
                 style={{ background:"var(--base-200)", border:"1px solid var(--base-300)" }}>
              {[
                { t:"text",  v:tier.label,            k:"label",            cls:"col-span-3", placeholder:"Label" },
                { t:"number",v:tier.minHours,         k:"minHours",         cls:"col-span-2", min:0, parse:Number, placeholder:"0" },
                { t:"number",v:tier.maxHours,         k:"maxHours",         cls:"col-span-2", min:0, nullable:true, placeholder:"∞" },
                { t:"number",v:tier.chargeToUser,     k:"chargeToUser",     cls:"col-span-2", min:0, parse:Number, placeholder:"400" },
                { t:"number",v:tier.payoutToAssistant,k:"payoutToAssistant",cls:"col-span-2", min:0, parse:Number, placeholder:"300" },
              ].map(({ t, v, k, cls, min, nullable, parse, placeholder }) => (
                <input key={k} type={t}
                  value={nullable ? (v ?? "") : (v ?? (t === "number" ? 0 : ""))}
                  placeholder={placeholder} min={min}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (nullable) val = val === "" ? null : Number(val);
                    else if (parse) val = parse(val);
                    setCaTiers((ts) => ts.map((ti, idx) => idx === i ? { ...ti, [k]: val } : ti));
                  }}
                  className={`${cls} px-2 py-1.5 rounded-lg text-xs font-bold outline-none`}
                  style={{ background:"var(--base-100)", border:"1px solid var(--base-300)", color:"var(--base-content)" }}
                />
              ))}
              <button onClick={() => setCaTiers((ts) => ts.filter((_,idx) => idx !== i))}
                className="col-span-1 w-6 h-6 rounded-lg flex items-center justify-center mx-auto"
                style={{ background:"rgba(239,68,68,.08)", color:"#ef4444" }}>
                <X size={9} />
              </button>
            </div>
          ))}
          <button onClick={() => setCaTiers((ts) => [...ts, { label:`Tier ${ts.length+1}`, minHours:0, maxHours:null, chargeToUser:0, payoutToAssistant:0, isActive:true }])}
            className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg mt-1"
            style={{ background:"rgba(16,185,129,.1)", color:"#10b981" }}>
            <Plus size={10} /> Add Plan Tier
          </button>
        </div>

        {/* Add-ons */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ opacity: 0.35 }}>Add-Ons</p>
          <div className="grid grid-cols-2 gap-5">
            <NumericField label="Home Sample Collection" value={addOns.homeSampleCollection}
              onChange={(v) => setAddOns((a) => ({ ...a, homeSampleCollection: v }))}
              placeholder="e.g. 199" note="Price of the home sample collection add-on in the custom plan builder." />
            <NumericField label="Priority Support" value={addOns.prioritySupport}
              onChange={(v) => setAddOns((a) => ({ ...a, prioritySupport: v }))}
              placeholder="e.g. 99" note="Monthly price for priority customer support in a custom plan." />
          </div>
        </div>

        <SopUploader sectionKey="customPlanOptions" existingDocs={admin?.customPlanOptions?.sopDocuments} color={SECTION_META.customPlanOptions.color} />
        <div className="grid grid-cols-1"><NoteField value={note} onChange={setNote} /></div>
        <div className="flex justify-end">
          <SaveButton
            onClick={() => {
              dispatch(updateCustomPlanOptions({
                consultation,
                transport,
                diagnosticsDiscount: diagDiscount,
                pharmacyDiscount:    pharmDiscount,
                careAssistant: { pricingTiers: caTiers.map(({_id,__v,...t}) => t) },
                addOns,
                note,
              }));
              setNote("");
            }}
            loading={loading} color={SECTION_META.customPlanOptions.color} />
        </div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 9  ADS
// ─────────────────────────────────────────────────────────────────────────────
function AdsSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectAds);
  const loading  = useSelector(selectAdsLoading);
  const error    = useSelector(selectAdsError);
  const admin    = useSelector(selectAdminConfig);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { if (data) { const { sopDocuments, ...rest } = data; setForm({ ...rest }); } }, [data]);

  return (
    <SectionCard sectionKey="ads" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="adsStatus" dispatch={dispatch}>
      <div className="grid grid-cols-2 gap-5 mt-5">
        <NumericField label="Sponsored Listing/mo" value={form.sponsoredListingMonthly}
          onChange={(v) => set("sponsoredListingMonthly", v)} placeholder="e.g. 5000"
          note="Monthly fee for a partner pharmacy/lab/hospital to appear as 'sponsored' in listings." />
        <NumericField label="Homepage Banner/mo" value={form.homePageBannerMonthly}
          onChange={(v) => set("homePageBannerMonthly", v)} placeholder="e.g. 15000"
          note="Monthly rate for a premium banner advertisement slot on the customer homepage." />
        <NoteField value={note} onChange={setNote} />
      </div>
      <SopUploader sectionKey="ads" existingDocs={admin?.ads?.sopDocuments} color={SECTION_META.ads.color} />
      <div className="flex justify-end mt-5">
        <SaveButton onClick={() => { dispatch(updateAds({ ...form, note })); setNote(""); }}
          loading={loading} color={SECTION_META.ads.color} />
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 10  TAX
// ─────────────────────────────────────────────────────────────────────────────
function TaxSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectTax);
  const loading  = useSelector(selectTaxLoading);
  const error    = useSelector(selectTaxError);
  const admin    = useSelector(selectAdminConfig);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { if (data) { const { sopDocuments, ...rest } = data; setForm({ ...rest }); } }, [data]);

  return (
    <SectionCard sectionKey="tax" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="taxStatus" dispatch={dispatch}>
      <div className="flex items-start gap-2 p-3 rounded-xl my-5"
           style={{ background:"rgba(239,68,68,.06)", border:"1px solid rgba(239,68,68,.18)" }}>
        <Lock size={12} style={{ color:"#ef4444", flexShrink:0, marginTop:1 }} />
        <p className="text-[11px] font-semibold" style={{ color:"#ef4444" }}>
          Regulatory GST rates. Consultation is locked at 0% (medical exemption by Indian law — CGST Act 2017). Only superadmins may edit these rates.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <NumericField label="Default GST" value={form.defaultGstPercent}
          onChange={(v) => set("defaultGstPercent", v)} min={0} max={100} prefix="" suffix="%" superadminOnly
          placeholder="e.g. 18" note="Fallback GST rate used for any service not listed below. Default 18%." />
        <NumericField label="Pharmacy GST" value={form.pharmacyGstPercent}
          onChange={(v) => set("pharmacyGstPercent", v)} min={0} max={100} prefix="" suffix="%" superadminOnly
          placeholder="e.g. 12" note="GST on medicine/pharmacy orders per applicable HSN codes. Default 12%." />
        <NumericField label="Transport GST" value={form.transportGstPercent}
          onChange={(v) => set("transportGstPercent", v)} min={0} max={100} prefix="" suffix="%" superadminOnly
          placeholder="e.g. 5" note="GST on ambulance/transport services. Default 5%." />
        <div>
          <FieldLabel superadminOnly>Consultation GST</FieldLabel>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
               style={{ background:"var(--base-200)", border:"1.5px solid var(--base-300)" }}>
            <Lock size={10} style={{ color:"#ef4444" }} />
            <span className="text-sm font-black">0% — GST Exempt (Medical)</span>
          </div>
          <FieldNote>Locked per CGST Act 2017. Cannot be modified.</FieldNote>
        </div>
        <NumericField label="Diagnostics GST" value={form.diagnosticsGstPercent}
          onChange={(v) => set("diagnosticsGstPercent", v)} min={0} max={100} prefix="" suffix="%" superadminOnly
          placeholder="e.g. 5" note="GST on lab/diagnostic test bookings. Default 5%." />
        <NumericField label="Care Assistant GST" value={form.careAssistantGstPercent}
          onChange={(v) => set("careAssistantGstPercent", v)} min={0} max={100} prefix="" suffix="%" superadminOnly
          placeholder="e.g. 18" note="GST on care assistant bookings (classified as manpower service). Default 18%." />
        <NoteField value={note} onChange={setNote} />
      </div>
      <SopUploader sectionKey="tax" existingDocs={admin?.tax?.sopDocuments} color={SECTION_META.tax.color} />
      {isSuperadmin && (
        <div className="flex justify-end mt-5">
          <SaveButton onClick={() => { dispatch(updateTax({ ...form, note })); setNote(""); }}
            loading={loading} color={SECTION_META.tax.color} />
        </div>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 11  REFUND POLICY
// ─────────────────────────────────────────────────────────────────────────────
function RefundPolicySection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectRefundPolicy);
  const loading  = useSelector(selectRefundPolicyLoading);
  const error    = useSelector(selectRefundPolicyError);
  const admin    = useSelector(selectAdminConfig);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { if (data) { const { sopDocuments, ...rest } = data; setForm({ ...rest }); } }, [data]);

  return (
    <SectionCard sectionKey="refundPolicy" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="refundPolicyStatus" dispatch={dispatch}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-5">
        <NumericField label="Full Refund Threshold" value={form.rideFullRefundHoursThreshold}
          onChange={(v) => set("rideFullRefundHoursThreshold", v)} min={0} prefix="" suffix="hrs"
          placeholder="e.g. 24"
          note="Hours before ride start within which cancellation gives a 100% refund. Default 24h." />
        <NumericField label="Partial Refund %" value={form.ridePartialRefundPercent}
          onChange={(v) => set("ridePartialRefundPercent", v)} min={0} max={100} prefix="" suffix="%"
          placeholder="e.g. 50"
          note="Refund % for cancellations inside the full-refund window. Default 50%." />
        <NumericField label="Processing Min" value={form.refundProcessingDaysMin}
          onChange={(v) => set("refundProcessingDaysMin", v)} min={0} prefix="" suffix="days"
          placeholder="e.g. 5"
          note="Minimum business days for a refund to appear in user's account. Default 5." />
        <NumericField label="Processing Max" value={form.refundProcessingDaysMax}
          onChange={(v) => set("refundProcessingDaysMax", v)} min={0} prefix="" suffix="days"
          placeholder="e.g. 12"
          note="Maximum business days for refund processing. Must be ≥ Processing Min. Default 12." />
        <NoteField value={note} onChange={setNote} />
      </div>
      <SopUploader sectionKey="refundPolicy" existingDocs={admin?.refundPolicy?.sopDocuments} color={SECTION_META.refundPolicy.color} />
      <div className="flex justify-end mt-5">
        <SaveButton onClick={() => { dispatch(updateRefundPolicy({ ...form, note })); setNote(""); }}
          loading={loading} color={SECTION_META.refundPolicy.color} />
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VERSION HISTORY PANEL
// ─────────────────────────────────────────────────────────────────────────────
function VersionHistoryPanel({ isSuperadmin, onClose }) {
  const dispatch          = useDispatch();
  const history           = useSelector(selectPricingHistory);
  const pagination        = useSelector(selectPricingHistoryPagination);
  const historyLoading    = useSelector(selectPricingHistoryLoading);
  const selectedSnapshot  = useSelector(selectSelectedSnapshot);
  const snapshotLoading   = useSelector(selectSelectedSnapshotLoading);
  const restoreLoading    = useSelector(selectRestoreLoading);
  const restoreError      = useSelector(selectRestoreError);

  const [page, setPage]               = useState(1);
  const [restoreNote, setRestoreNote] = useState("");
  const [confirmIdx, setConfirmIdx]   = useState(null);

  useEffect(() => { dispatch(fetchPricingHistory({ page, limit: 10 })); }, [dispatch, page]);

  const handleRestore = () => {
    if (confirmIdx === null) return;
    dispatch(restorePricingConfig({ index: confirmIdx, note: restoreNote }));
    setConfirmIdx(null); setRestoreNote("");
  };

  const roleChip = (role) => role === "superadmin"
    ? { bg:"rgba(239,68,68,.1)", color:"#ef4444" }
    : { bg:"rgba(59,130,246,.1)", color:"#3b82f6" };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="absolute inset-0" style={{ background:"rgba(0,0,0,.75)", backdropFilter:"blur(18px)" }}
        onClick={onClose} />

      <motion.div initial={{ scale:.93, opacity:0, y:20 }} animate={{ scale:1, opacity:1, y:0 }}
        exit={{ scale:.93, opacity:0, y:20 }} transition={{ duration:.38, ease:[0.22,1,0.36,1] }}
        className="relative w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ background:"var(--base-100)", border:"1.5px solid var(--base-300)", borderRadius:"1.5rem", boxShadow:"0 40px 80px rgba(0,0,0,.4)", maxHeight:"88vh" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
             style={{ borderBottom:"1px solid var(--base-300)", background:"var(--base-200)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                 style={{ background:"color-mix(in srgb,var(--primary),transparent 88%)" }}>
              <History size={14} style={{ color:"var(--primary)" }} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ opacity:.35 }}>Audit Log</p>
              <p className="text-sm font-black">Version History</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background:"var(--base-300)" }}>
            <X size={13} />
          </button>
        </div>

        {restoreError && (
          <div className="mx-6 mt-4 flex items-center gap-2 p-3 rounded-xl text-xs font-semibold"
               style={{ background:"rgba(239,68,68,.08)", color:"#ef4444" }}>
            <AlertCircle size={12} /> {restoreError}
            <button onClick={() => dispatch(clearRestoreStatus())} className="ml-auto"><X size={10} /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {historyLoading && history.length === 0 ? (
            <div className="flex justify-center py-16"><RefreshCw size={18} className="animate-spin" style={{ opacity:.35 }} /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-16" style={{ opacity:.35 }}>
              <Database size={28} style={{ margin:"0 auto 8px" }} />
              <p className="text-sm font-bold">No version history yet</p>
            </div>
          ) : history.map((entry, i) => {
            const rc = roleChip(entry.changedByRole);
            const sc = SECTION_META[entry.section]?.color || "#6366f1";
            return (
              <motion.div key={i} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.025 }}
                className="rounded-xl p-4" style={{ background:"var(--base-200)", border:"1px solid var(--base-300)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background:rc.bg, color:rc.color }}>
                        {entry.changedByRole}
                      </span>
                      {entry.section && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background:`${sc}18`, color:sc }}>
                          {entry.section}
                        </span>
                      )}
                      {entry.changeSource === "sop_upload" && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1"
                              style={{ background:"rgba(99,102,241,.1)", color:"#6366f1" }}>
                          <Paperclip size={7} /> SOP
                        </span>
                      )}
                      <span className="text-[9px] font-bold" style={{ opacity:.4 }}>
                        {entry.changedAt ? new Date(entry.changedAt).toLocaleString("en-IN") : "—"}
                      </span>
                    </div>
                    {entry.changeNote && (
                      <p className="text-xs font-semibold mt-0.5" style={{ opacity:.6 }}>{entry.changeNote}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => dispatch(fetchPricingHistoryByIndex(i))} disabled={snapshotLoading}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black"
                      style={{ background:"color-mix(in srgb,var(--primary),transparent 88%)", color:"var(--primary)" }}>
                      <Eye size={9} /> View
                    </button>
                    {isSuperadmin && (
                      <button onClick={() => setConfirmIdx(i)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black"
                        style={{ background:"rgba(245,158,11,.1)", color:"#f59e0b" }}>
                        <RotateCcw size={9} /> Restore
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {pagination?.pages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page===1}
                className="px-3 py-1.5 rounded-lg text-xs font-black" style={{ background:"var(--base-200)", opacity:page===1?.4:1 }}>
                ‹ Prev
              </button>
              <span className="px-3 py-1.5 text-xs font-black" style={{ opacity:.4 }}>{page}/{pagination.pages}</span>
              <button onClick={() => setPage((p) => Math.min(pagination.pages, p+1))} disabled={page===pagination.pages}
                className="px-3 py-1.5 rounded-lg text-xs font-black" style={{ background:"var(--base-200)", opacity:page===pagination.pages?.4:1 }}>
                Next ›
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedSnapshot && (
            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }} className="overflow-hidden">
              <div className="px-6 pb-5 flex-shrink-0" style={{ borderTop:"1px solid var(--base-300)" }}>
                <div className="flex items-center justify-between py-3">
                  <p className="text-xs font-black">Snapshot Preview</p>
                  <button onClick={() => dispatch(clearSelectedSnapshot())} className="text-[10px] font-bold" style={{ opacity:.45 }}>Close</button>
                </div>
                <pre className="text-[10px] font-mono overflow-auto max-h-48 p-3 rounded-xl"
                     style={{ background:"var(--base-300)", color:"var(--base-content)" }}>
                  {JSON.stringify(selectedSnapshot, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {confirmIdx !== null && (
          <motion.div initial={{ scale:.9, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:.9, opacity:0 }}
            className="absolute z-[300] w-full max-w-sm p-6 space-y-4 rounded-2xl"
            style={{ background:"var(--base-100)", border:"2px solid #f59e0b", boxShadow:"0 24px 60px rgba(245,158,11,.35)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:"rgba(245,158,11,.12)" }}>
                <AlertTriangle size={17} style={{ color:"#f59e0b" }} />
              </div>
              <div>
                <p className="text-sm font-black">Restore Configuration?</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ opacity:.5 }}>This overwrites ALL current config sections.</p>
              </div>
            </div>
            <input type="text" placeholder="Reason for restore (optional, saved in audit log)"
              value={restoreNote} onChange={(e) => setRestoreNote(e.target.value)} className="input-field w-full text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setConfirmIdx(null)} className="flex-1 py-2.5 rounded-xl text-xs font-black" style={{ background:"var(--base-300)" }}>Cancel</button>
              <button onClick={handleRestore} disabled={restoreLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black text-white"
                style={{ background:"linear-gradient(135deg,#f59e0b,#d97706)" }}>
                {restoreLoading ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                {restoreLoading ? "Restoring…" : "Confirm Restore"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SKELETON
// ─────────────────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
      <div className="skeleton h-36 rounded-2xl" />
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="skeleton h-14 rounded-2xl" />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAT PILL
// ─────────────────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
         style={{ background:`${color}0f`, border:`1px solid ${color}25` }}>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:color }} />
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color, opacity:.75 }}>{label}</p>
        <p className="text-xs font-black" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const sectionComponents = {
  caps:              CapsSection,
  transport:         TransportSection,
  careAssistant:     CareAssistantFullSection,
  doctor:            DoctorSection,
  hospital:          HospitalSection,
  diagnostics:       DiagnosticsSection,
  pharmacy:          PharmacySection,
  customPlanOptions: CustomPlanOptionsSection,
  ads:               AdsSection,
  tax:               TaxSection,
  refundPolicy:      RefundPolicySection,
};

export default function PlatformPricingManagement() {
  const dispatch     = useDispatch();
  const adminConfig  = useSelector(selectAdminConfig);
  const configLoad   = useSelector(selectAdminConfigLoading);
  const configError  = useSelector(selectAdminConfigError);
  const anySaving    = useSelector(selectAnySectionSaving);
  const user         = useSelector(selectUser);
  const isSuperadmin = user?.role === "superadmin";

  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch]           = useState("");

  useEffect(() => { dispatch(fetchAdminPricingConfig()); }, [dispatch]);

  const filteredSections = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return Object.keys(SECTION_META);
    return Object.keys(SECTION_META).filter((k) => {
      const m = SECTION_META[k];
      return m.label.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q);
    });
  }, [search]);

  if (configLoad && !adminConfig) return <PageSkeleton />;

  const activeSections     = Object.keys(SECTION_META).length;
  const accessibleSections = Object.values(SECTION_META).filter((m) => !m.superadminOnly || isSuperadmin).length;

  return (
    <div className="min-h-screen" style={{ background:"var(--base-100)" }}>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">

        {/* PAGE HEADER */}
        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} transition={{ duration:.45, ease:[0.22,1,0.36,1] }}>
          <div className="relative overflow-hidden rounded-2xl"
               style={{ background:"var(--base-200)", border:"1.5px solid var(--base-300)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ opacity:.045 }}>
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.2" fill="var(--base-content)" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
              </svg>
            </div>
            <div className="h-1 w-full" style={{ background:"linear-gradient(90deg,var(--primary),var(--secondary),var(--primary))", backgroundSize:"200% 100%", animation:"shimmer 3s linear infinite" }} />
            <div className="relative z-10 p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                         style={{ background:"linear-gradient(135deg,var(--primary),var(--secondary))" }}>
                      <Settings size={14} className="text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[.18em]" style={{ opacity:.38 }}>
                      Platform Configuration
                    </span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black leading-tight mb-1">
                    Pricing Control Centre
                  </h1>
                  <p className="text-xs font-medium" style={{ opacity:.45 }}>
                    {isSuperadmin
                      ? "Superadmin — full access to all 11 sections including GST, caps and refund policy"
                      : "Admin — access to transport, doctor, diagnostics, pharmacy"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {anySaving && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black"
                         style={{ background:"rgba(59,130,246,.08)", color:"#3b82f6" }}>
                      <RefreshCw size={10} className="animate-spin" /> Saving…
                    </div>
                  )}
                  <button onClick={() => setShowHistory(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                    style={{ background:"var(--base-100)", border:"1.5px solid var(--base-300)" }}>
                    <History size={12} /> History
                  </button>
                  <button onClick={() => dispatch(fetchAdminPricingConfig())} disabled={configLoad}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                    style={{ background:"var(--base-100)", border:"1.5px solid var(--base-300)", opacity:configLoad?.65:1 }}>
                    <RefreshCw size={12} className={configLoad ? "animate-spin" : ""} /> Refresh
                  </button>
                </div>
              </div>
              {adminConfig && (
                <div className="flex items-center gap-2 mt-5 flex-wrap">
                  <StatPill label="Status" value="Active" color="#10b981" />
                  <StatPill label="Sections" value={`${accessibleSections}/${activeSections}`} color="var(--primary)" />
                  <StatPill label="Role" value={isSuperadmin ? "Superadmin" : "Admin"} color={isSuperadmin ? "#ef4444" : "#3b82f6"} />
                  {adminConfig.updatedAt && (
                    <StatPill label="Last Update" value={new Date(adminConfig.updatedAt).toLocaleDateString("en-IN")} color="#f59e0b" />
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {configError && (
          <div className="flex items-center gap-2 p-4 rounded-xl text-sm font-semibold"
               style={{ background:"rgba(239,68,68,.08)", color:"#ef4444", border:"1px solid rgba(239,68,68,.18)" }}>
            <AlertCircle size={15} /> {configError}
          </div>
        )}

        {/* SEARCH */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity:.4 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search sections by name or description…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="input-field w-full pl-10 text-sm" />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ opacity:.4 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* SECTION GRID */}
        <div className="space-y-3">
          {filteredSections.map((key) => {
            const Comp = sectionComponents[key];
            return Comp ? <Comp key={key} isSuperadmin={isSuperadmin} /> : null;
          })}
        </div>

        {filteredSections.length === 0 && search && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="text-center py-16" style={{ opacity:.38 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin:"0 auto 8px" }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <p className="text-sm font-bold">No sections match &ldquo;{search}&rdquo;</p>
          </motion.div>
        )}

        <div className="h-8" />
      </div>

      <AnimatePresence>
        {showHistory && (
          <VersionHistoryPanel isSuperadmin={isSuperadmin} onClose={() => setShowHistory(false)} />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer { 0%{background-position:0% 0} 100%{background-position:200% 0} }
      `}</style>
    </div>
  );
}