"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, ChevronDown, Save, RefreshCw,
  AlertTriangle, X, Plus, Trash2, History,
  RotateCcw, Eye, Shield, Truck, UserCheck, Stethoscope,
  Building2, FlaskConical, Pill, Layers, Megaphone, Receipt,
  RotateCw, Lock, Info, BadgeCheck, AlertCircle,
  Database, Search
} from "lucide-react";

import {
  fetchAdminPricingConfig,
  fetchPricingHistory,
  fetchPricingHistoryByIndex,
  restorePricingConfig,
  updateCaps,
  updateTransport,
  updateCareAssistant,
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

// ─────────────────────────────────────────────────────────────────────────────
//  DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const SECTION_META = {
  caps: {
    label: "Discount Caps",
    icon: Shield,
    color: "#3b82f6",
    desc: "Global maximum discount limits and monthly usage caps",
    superadminOnly: false,
  },
  transport: {
    label: "Transport Pricing",
    icon: Truck,
    color: "#f59e0b",
    desc: "Per-km rates, platform fee, night surcharge, waiting charges",
    superadminOnly: false,
  },
  careAssistant: {
    label: "Care Assistant",
    icon: UserCheck,
    color: "#10b981",
    desc: "Payout, user charge, platform fee, punctuality bonus",
    superadminOnly: false,
  },
  doctor: {
    label: "Doctor Pricing",
    icon: Stethoscope,
    color: "#8b5cf6",
    desc: "Honorarium, platform fee, tele & home visit rates, follow-up",
    superadminOnly: false,
  },
  hospital: {
    label: "Hospital Commission",
    icon: Building2,
    color: "#06b6d4",
    desc: "Platform fee (fixed/%), per-hospital overrides, settlement",
    superadminOnly: false,
  },
  diagnostics: {
    label: "Diagnostics",
    icon: FlaskConical,
    color: "#ec4899",
    desc: "Lab platform fee, home sample platform fee, physical report fee",
    superadminOnly: false,
  },
  pharmacy: {
    label: "Pharmacy",
    icon: Pill,
    color: "#f97316",
    desc: "Partner platform fee, own-store margin, delivery charges",
    superadminOnly: false,
  },
  customPlanOptions: {
    label: "Custom Plan Prices",
    icon: Layers,
    color: "#6366f1",
    desc: "Slab-based pricing for consultation, transport, discounts, care",
    superadminOnly: false,
  },
  ads: {
    label: "Advertisements",
    icon: Megaphone,
    color: "#84cc16",
    desc: "Sponsored listing and homepage banner monthly fees",
    superadminOnly: false,
  },
  tax: {
    label: "GST / Tax",
    icon: Receipt,
    color: "#ef4444",
    desc: "GST rates per service type — regulatory, superadmin only",
    superadminOnly: true,
  },
  refundPolicy: {
    label: "Refund Policy",
    icon: RotateCw,
    color: "#14b8a6",
    desc: "Ride refund thresholds and processing day windows",
    superadminOnly: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  ANIMATION
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 16, scale: 0.98 },
  visible: (i = 0) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.05, duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
//  ATOMIC PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({ children, superadminOnly }) {
  return (
    <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-1.5"
      style={{ color: "color-mix(in srgb,var(--base-content),transparent 45%)" }}>
      {children}
      {superadminOnly && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black"
          style={{ background: "rgba(239,68,68,.12)", color: "#ef4444" }}>
          <Lock size={7} /> SA
        </span>
      )}
    </label>
  );
}

function NumericField({ label, value, onChange, min = 0, max, step = 1, suffix, prefix = "₹", superadminOnly, disabled }) {
  return (
    <div>
      <FieldLabel superadminOnly={superadminOnly}>{label}</FieldLabel>
      <div className="flex items-center rounded-xl overflow-hidden border"
        style={{ borderColor: "var(--base-300)", opacity: disabled ? 0.5 : 1 }}>
        {prefix && (
          <span className="px-2.5 text-xs font-black flex-shrink-0"
            style={{ background: "var(--base-200)", borderRight: "1px solid var(--base-300)", color: "var(--base-content)", opacity: 0.55, height: 38, display: "flex", alignItems: "center" }}>
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value ?? ""}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="flex-1 px-3 py-2 text-sm font-black outline-none"
          style={{ background: "var(--base-100)", border: "none", color: "var(--base-content)", minWidth: 0 }}
        />
        {suffix && (
          <span className="px-2.5 text-[10px] font-black flex-shrink-0"
            style={{ background: "var(--base-200)", borderLeft: "1px solid var(--base-300)", color: "var(--base-content)", opacity: 0.55, height: 38, display: "flex", alignItems: "center" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, superadminOnly }) {
  return (
    <div>
      <FieldLabel superadminOnly={superadminOnly}>{label}</FieldLabel>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="input-field w-full text-sm font-bold"
        style={{ cursor: "pointer" }}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * PlatformFeeField — renders the { type, value } platformFee sub-document.
 * type: 'fixed' → value is an absolute rupee amount
 * type: 'percentage' → value is a percent
 */
function PlatformFeeField({ label, value = {}, onChange, superadminOnly }) {
  const type = value?.type ?? "percentage";
  const val  = value?.value ?? 0;

  return (
    <div className="col-span-full md:col-span-1">
      <FieldLabel superadminOnly={superadminOnly}>{label}</FieldLabel>
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => onChange({ type: e.target.value, value: val })}
          className="input-field text-xs font-black w-32 flex-shrink-0"
          style={{ cursor: "pointer" }}>
          <option value="percentage">%</option>
          <option value="fixed">₹ Fixed</option>
        </select>
        <div className="flex flex-1 items-center rounded-xl overflow-hidden border"
          style={{ borderColor: "var(--base-300)" }}>
          <input
            type="number"
            min={0}
            max={type === "percentage" ? 100 : undefined}
            step={type === "percentage" ? 0.5 : 1}
            value={val}
            onChange={(e) => onChange({ type, value: Number(e.target.value) })}
            className="flex-1 px-3 py-2 text-sm font-black outline-none"
            style={{ background: "var(--base-100)", border: "none", color: "var(--base-content)", minWidth: 0 }}
          />
          <span className="px-2.5 text-[10px] font-black flex-shrink-0"
            style={{ background: "var(--base-200)", borderLeft: "1px solid var(--base-300)", color: "var(--base-content)", opacity: 0.55, height: 38, display: "flex", alignItems: "center" }}>
            {type === "percentage" ? "%" : "₹"}
          </span>
        </div>
      </div>
    </div>
  );
}

function NoteField({ value, onChange }) {
  return (
    <div className="col-span-full">
      <FieldLabel>Change Note (audit log)</FieldLabel>
      <input
        type="text"
        placeholder="Describe what changed and why…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field w-full text-sm"
      />
    </div>
  );
}

function SectionError({ error, statusKey, dispatch }) {
  if (!error) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 p-3 rounded-xl text-xs font-semibold"
      style={{ background: "rgba(239,68,68,.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,.2)" }}>
      <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1">{error}</span>
      <button onClick={() => dispatch(clearPricingError(statusKey))}><X size={12} /></button>
    </motion.div>
  );
}

function SaveButton({ onClick, loading, disabled, color }) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={loading || disabled}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white transition-all"
      style={{ background: color || "var(--primary)", opacity: loading || disabled ? 0.65 : 1, boxShadow: `0 4px 16px ${color || "var(--primary)"}40` }}>
      {loading ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
      {loading ? "Saving…" : "Save Changes"}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION CARD  (collapsible)
// ─────────────────────────────────────────────────────────────────────────────
function SectionCard({ sectionKey, isSuperadmin, children, loading, error, statusKey, dispatch }) {
  const [open, setOpen] = useState(false);
  const meta   = SECTION_META[sectionKey];
  const Icon   = meta.icon;
  const blocked = meta.superadminOnly && !isSuperadmin;

  return (
    <motion.div
      custom={Object.keys(SECTION_META).indexOf(sectionKey)}
      variants={fadeUp} initial="hidden" animate="visible"
      className="overflow-hidden rounded-2xl"
      style={{
        background: "var(--base-100)",
        border: open ? `1.5px solid ${meta.color}` : "1.5px solid var(--base-300)",
        boxShadow: open ? `0 8px 32px ${meta.color}18` : "0 2px 8px rgba(0,0,0,0.04)",
        transition: "border-color 0.25s ease, box-shadow 0.25s ease",
      }}>
      <button
        onClick={() => !blocked && setOpen((v) => !v)}
        disabled={blocked}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
        style={{ cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.5 : 1 }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${meta.color}18` }}>
          <Icon size={17} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-black text-base-content">{meta.label}</p>
            {meta.superadminOnly && (
              <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(239,68,68,.12)", color: "#ef4444" }}>
                <Lock size={8} /> Superadmin Only
              </span>
            )}
            {loading && <RefreshCw size={11} className="animate-spin" style={{ color: meta.color }} />}
            {error  && <AlertCircle size={11} style={{ color: "#ef4444" }} />}
          </div>
          <p className="text-[10px] font-semibold mt-0.5" style={{ opacity: 0.45 }}>{meta.desc}</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown size={16} style={{ opacity: 0.5 }} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && !blocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden">
            <div className="px-5 pb-5 pt-1" style={{ borderTop: `1px solid ${meta.color}20` }}>
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
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");

  useEffect(() => { if (data) setForm({ ...data }); }, [data]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SectionCard sectionKey="caps" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="capsStatus" dispatch={dispatch}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        <NumericField label="Pharmacy Discount Max" value={form.pharmacyDiscountMax} onChange={(v) => set("pharmacyDiscountMax", v)} min={0} max={100} prefix="" suffix="%" />
        <NumericField label="Diagnostics Discount Max" value={form.diagnosticsDiscountMax} onChange={(v) => set("diagnosticsDiscountMax", v)} min={0} max={100} prefix="" suffix="%" />
        <NumericField label="Care Assist Max Visits" value={form.careAssistantMaxVisitsPerMonth} onChange={(v) => set("careAssistantMaxVisitsPerMonth", v)} min={0} prefix="" suffix="/mo" />
        <NumericField label="Max Consultations" value={form.consultationsMaxPerMonth} onChange={(v) => set("consultationsMaxPerMonth", v)} min={0} prefix="" suffix="/mo" />
        <NumericField label="Max Transport Rides" value={form.transportMaxRidesPerMonth} onChange={(v) => set("transportMaxRidesPerMonth", v)} min={0} prefix="" suffix="/mo" />
        <NoteField value={note} onChange={setNote} />
      </div>
      <div className="flex justify-end mt-4">
        <SaveButton onClick={() => { const { __v, _id, ...p } = form; dispatch(updateCaps({ ...p, note })); setNote(""); }} loading={loading} color={SECTION_META.caps.color} />
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 2  TRANSPORT
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_SLUGS = ["basic-care", "standard-care", "premium-care", "family-care", "pregnant-women-care", "nris-care"];

function TransportSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectTransport);
  const loading  = useSelector(selectTransportLoading);
  const error    = useSelector(selectTransportError);
  const [form,      setForm]      = useState({});
  const [overrides, setOverrides] = useState({});
  const [fee,       setFee]       = useState({ type: "percentage", value: 0 });
  const [note,      setNote]      = useState("");

  useEffect(() => {
    if (data) {
      const { planRateOverrides, platformFee, ...rest } = data;
      setForm({ ...rest });
      setOverrides(planRateOverrides ? { ...planRateOverrides } : {});
      if (platformFee) setFee({ ...platformFee });
    }
  }, [data]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    dispatch(updateTransport({ ...form, platformFee: fee, planRateOverrides: overrides, note }));
    setNote("");
  };

  return (
    <SectionCard sectionKey="transport" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="transportStatus" dispatch={dispatch}>
      <div className="space-y-5 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <NumericField label="Base Fare" value={form.baseFare} onChange={(v) => set("baseFare", v)} />
          <NumericField label="Default Rate/km" value={form.defaultRatePerKm} onChange={(v) => set("defaultRatePerKm", v)} />
          <PlatformFeeField label="Platform Fee" value={fee} onChange={setFee} />
          <NumericField label="Night Surcharge" value={form.nightSurchargeMultiplier} onChange={(v) => set("nightSurchargeMultiplier", v)} min={1} step={0.05} prefix="×" />
          <NumericField label="Night Start Hour" value={form.nightStartHour} onChange={(v) => set("nightStartHour", v)} min={0} max={23} prefix="" suffix="h" />
          <NumericField label="Night End Hour" value={form.nightEndHour} onChange={(v) => set("nightEndHour", v)} min={0} max={23} prefix="" suffix="h" />
          <NumericField label="Free Waiting" value={form.waitingFreeMinutes} onChange={(v) => set("waitingFreeMinutes", v)} min={0} prefix="" suffix="min" />
          <NumericField label="Waiting Charge" value={form.waitingChargePerMinute} onChange={(v) => set("waitingChargePerMinute", v)} min={0} suffix="/min" />
          <NumericField label="Cancellation Fee" value={form.cancellationFeePercent} onChange={(v) => set("cancellationFeePercent", v)} min={0} max={100} prefix="" suffix="%" />
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ opacity: 0.4 }}>
            Per-Plan Rate Overrides (₹/km) — leave blank for default, set to 0 for N/A
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PLAN_SLUGS.map((slug) => (
              <div key={slug}>
                <FieldLabel>{slug}</FieldLabel>
                <input
                  type="number"
                  value={overrides[slug] ?? ""}
                  placeholder="null = N/A"
                  onChange={(e) => setOverrides((o) => ({ ...o, [slug]: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="input-field w-full text-sm font-bold"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1"><NoteField value={note} onChange={setNote} /></div>
        <div className="flex justify-end"><SaveButton onClick={handleSave} loading={loading} color={SECTION_META.transport.color} /></div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 3  CARE ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────
function CareAssistantSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectCareAssistant);
  const loading  = useSelector(selectCareAssistantLoading);
  const error    = useSelector(selectCareAssistantError);
  const [form, setForm] = useState({});
  const [fee,  setFee]  = useState({ type: "percentage", value: 0 });
  const [note, setNote] = useState("");

  useEffect(() => {
    if (data) {
      const { platformFee, ...rest } = data;
      setForm({ ...rest });
      if (platformFee) setFee({ ...platformFee });
    }
  }, [data]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SectionCard sectionKey="careAssistant" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="careAssistantStatus" dispatch={dispatch}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        <NumericField label="Payout Per Visit" value={form.payoutPerVisit} onChange={(v) => set("payoutPerVisit", v)} />
        <NumericField label="Charge To User" value={form.chargeToUser} onChange={(v) => set("chargeToUser", v)} />
        <PlatformFeeField label="Platform Fee" value={fee} onChange={setFee} />
        <NumericField label="Dedicated Monthly Payout" value={form.dedicatedMonthlyPayout} onChange={(v) => set("dedicatedMonthlyPayout", v)} />
        <NumericField label="Punctuality Bonus" value={form.punctualityBonusPerVisit} onChange={(v) => set("punctualityBonusPerVisit", v)} />
        <NumericField label="No-Show Penalty" value={form.noShowPenalty} onChange={(v) => set("noShowPenalty", v)} />
        <NoteField value={note} onChange={setNote} />
      </div>
      <div className="flex justify-end mt-4">
        <SaveButton onClick={() => { dispatch(updateCareAssistant({ ...form, platformFee: fee, note })); setNote(""); }} loading={loading} color={SECTION_META.careAssistant.color} />
      </div>
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
  const [form, setForm] = useState({});
  const [fee,  setFee]  = useState({ type: "percentage", value: 0 });
  const [note, setNote] = useState("");

  useEffect(() => {
    if (data) {
      const { platformFee, ...rest } = data;
      setForm({ ...rest });
      if (platformFee) setFee({ ...platformFee });
    }
  }, [data]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SectionCard sectionKey="doctor" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="doctorStatus" dispatch={dispatch}>
      <div className="space-y-5 mt-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ opacity: 0.4 }}>In-Person Consultation</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <NumericField label="Honorarium/Consult" value={form.honorariumPerConsultation} onChange={(v) => set("honorariumPerConsultation", v)} />
            <NumericField label="Charge To User" value={form.chargeToUser} onChange={(v) => set("chargeToUser", v)} />
            <PlatformFeeField label="Platform Fee" value={fee} onChange={setFee} />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ opacity: 0.4 }}>Tele-Consultation</p>
          <div className="grid grid-cols-2 gap-4">
            <NumericField label="Tele Charge (User)" value={form.teleConsultationChargeToUser} onChange={(v) => set("teleConsultationChargeToUser", v)} />
            <NumericField label="Tele Honorarium" value={form.teleConsultationHonorarium} onChange={(v) => set("teleConsultationHonorarium", v)} />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ opacity: 0.4 }}>Home Visit</p>
          <div className="grid grid-cols-2 gap-4">
            <NumericField label="Home Visit Charge" value={form.homeVisitChargeToUser} onChange={(v) => set("homeVisitChargeToUser", v)} />
            <NumericField label="Home Visit Honorarium" value={form.homeVisitHonorarium} onChange={(v) => set("homeVisitHonorarium", v)} />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ opacity: 0.4 }}>Follow-Up Policy</p>
          <div className="grid grid-cols-2 gap-4">
            <NumericField label="Follow-Up Discount" value={form.followUpDiscountPercent} onChange={(v) => set("followUpDiscountPercent", v)} min={0} max={100} prefix="" suffix="%" />
            <NumericField label="Follow-Up Valid Days" value={form.followUpValidDays} onChange={(v) => set("followUpValidDays", v)} min={1} prefix="" suffix="days" />
          </div>
        </div>
        <div className="grid grid-cols-1"><NoteField value={note} onChange={setNote} /></div>
        <div className="flex justify-end">
          <SaveButton onClick={() => { dispatch(updateDoctor({ ...form, platformFee: fee, note })); setNote(""); }} loading={loading} color={SECTION_META.doctor.color} />
        </div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 5  HOSPITAL
//  hospitalOverrides: Map<hospitalId, { type, value }>
// ─────────────────────────────────────────────────────────────────────────────
function HospitalSection({ isSuperadmin }) {
  const dispatch      = useDispatch();
  const data          = useSelector(selectHospital);
  const loading       = useSelector(selectHospitalLoading);
  const error         = useSelector(selectHospitalError);
  const deleteLoading = useSelector(selectHospitalOverrideDeleteLoading);

  const [form,      setForm]      = useState({});
  const [fee,       setFee]       = useState({ type: "percentage", value: 0 });
  const [overrides, setOverrides] = useState({});
  const [newId,     setNewId]     = useState("");
  const [newFee,    setNewFee]    = useState({ type: "percentage", value: 0 });
  const [note,      setNote]      = useState("");

  useEffect(() => {
    if (data) {
      const { platformFee, hospitalOverrides, ...rest } = data;
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

  const handleSave = () => {
    dispatch(updateHospital({ ...form, platformFee: fee, hospitalOverrides: overrides, note }));
    setNote("");
  };

  return (
    <SectionCard sectionKey="hospital" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="hospitalStatus" dispatch={dispatch}>
      <div className="space-y-5 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <PlatformFeeField label="Default Platform Fee" value={fee} onChange={setFee} />
          <SelectField label="Settlement Cycle" value={form.settlementCycle}
            onChange={(v) => setForm((f) => ({ ...f, settlementCycle: v }))}
            options={[{ value: "weekly", label: "Weekly" }, { value: "biweekly", label: "Bi-weekly" }, { value: "monthly", label: "Monthly" }]} />
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ opacity: 0.4 }}>
            Per-Hospital Platform Fee Overrides
          </p>
          {Object.entries(overrides).map(([id, f]) => (
            <div key={id} className="flex items-center gap-2 mb-2">
              <span className="flex-1 text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg"
                style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>{id}</span>
              <span className="text-xs font-black px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(6,182,212,.1)", color: "#06b6d4" }}>
                {f?.type === "fixed" ? `₹${f?.value}` : `${f?.value}%`}
              </span>
              <button onClick={() => dispatch(deleteHospitalOverride(id))} disabled={deleteLoading}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(239,68,68,.1)", color: "#ef4444" }}>
                {deleteLoading ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={11} />}
              </button>
            </div>
          ))}

          <div className="flex gap-2 mt-3 flex-wrap">
            <input type="text" placeholder="Hospital ID" value={newId} onChange={(e) => setNewId(e.target.value)}
              className="input-field flex-1 text-xs font-mono min-w-32" />
            <select value={newFee.type} onChange={(e) => setNewFee((f) => ({ ...f, type: e.target.value }))}
              className="input-field text-xs font-black w-28" style={{ cursor: "pointer" }}>
              <option value="percentage">%</option>
              <option value="fixed">₹ Fixed</option>
            </select>
            <input type="number" placeholder={newFee.type === "percentage" ? "%" : "₹"} value={newFee.value}
              onChange={(e) => setNewFee((f) => ({ ...f, value: Number(e.target.value) }))}
              className="input-field w-20 text-sm font-black" min={0} max={newFee.type === "percentage" ? 100 : undefined} />
            <button onClick={addOverride}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black"
              style={{ background: "rgba(6,182,212,.15)", color: "#06b6d4" }}>
              <Plus size={11} /> Add
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1"><NoteField value={note} onChange={setNote} /></div>
        <div className="flex justify-end"><SaveButton onClick={handleSave} loading={loading} color={SECTION_META.hospital.color} /></div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 6  DIAGNOSTICS
//  platformFee: default lab fee
//  homeSamplePlatformFee: fee on home sample collection
//  No labOverrides in the model — removed.
// ─────────────────────────────────────────────────────────────────────────────
function DiagnosticsSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectDiagnostics);
  const loading  = useSelector(selectDiagnosticsLoading);
  const error    = useSelector(selectDiagnosticsError);

  const [form,           setForm]           = useState({});
  const [fee,            setFee]            = useState({ type: "percentage", value: 0 });
  const [homeSampleFee,  setHomeSampleFee]  = useState({ type: "fixed", value: 0 });
  const [note,           setNote]           = useState("");

  useEffect(() => {
    if (data) {
      const { platformFee, homeSamplePlatformFee, ...rest } = data;
      setForm({ ...rest });
      if (platformFee)      setFee({ ...platformFee });
      if (homeSamplePlatformFee) setHomeSampleFee({ ...homeSamplePlatformFee });
    }
  }, [data]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SectionCard sectionKey="diagnostics" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="diagnosticsStatus" dispatch={dispatch}>
      <div className="space-y-5 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <PlatformFeeField label="Default Platform Fee (Labs)" value={fee} onChange={setFee} />
          <NumericField label="Home Sample Charge" value={form.homeSampleCollectionCharge} onChange={(v) => set("homeSampleCollectionCharge", v)} />
          <PlatformFeeField label="Home Sample Platform Fee" value={homeSampleFee} onChange={setHomeSampleFee} />
          <NumericField label="Physical Report Fee" value={form.physicalReportFee} onChange={(v) => set("physicalReportFee", v)} />
          <SelectField label="Settlement Cycle" value={form.settlementCycle}
            onChange={(v) => set("settlementCycle", v)}
            options={[{ value: "weekly", label: "Weekly" }, { value: "biweekly", label: "Bi-weekly" }, { value: "monthly", label: "Monthly" }]} />
        </div>
        <div className="grid grid-cols-1"><NoteField value={note} onChange={setNote} /></div>
        <div className="flex justify-end">
          <SaveButton
            onClick={() => { dispatch(updateDiagnostics({ ...form, platformFee: fee, homeSamplePlatformFee: homeSampleFee, note })); setNote(""); }}
            loading={loading} color={SECTION_META.diagnostics.color} />
        </div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 7  PHARMACY
//  platformFee: partner pharmacy commission (fixed or %)
//  ownStoreMarginPercent: own-store margin (always %)
// ─────────────────────────────────────────────────────────────────────────────
function PharmacySection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectPharmacy);
  const loading  = useSelector(selectPharmacyLoading);
  const error    = useSelector(selectPharmacyError);
  const [form, setForm] = useState({});
  const [fee,  setFee]  = useState({ type: "percentage", value: 0 });
  const [note, setNote] = useState("");

  useEffect(() => {
    if (data) {
      const { platformFee, ...rest } = data;
      setForm({ ...rest });
      if (platformFee) setFee({ ...platformFee });
    }
  }, [data]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SectionCard sectionKey="pharmacy" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="pharmacyStatus" dispatch={dispatch}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        <PlatformFeeField label="Partner Platform Fee" value={fee} onChange={setFee} />
        <NumericField label="Own Store Margin" value={form.ownStoreMarginPercent} onChange={(v) => set("ownStoreMarginPercent", v)} min={0} max={100} prefix="" suffix="%" />
        <NumericField label="Express Delivery Charge" value={form.expressDeliveryCharge} onChange={(v) => set("expressDeliveryCharge", v)} />
        <NumericField label="Delivery Agent Payout" value={form.deliveryAgentPayout} onChange={(v) => set("deliveryAgentPayout", v)} />
        <NumericField label="Free Delivery Min Order" value={form.freeDeliveryMinOrderValue} onChange={(v) => set("freeDeliveryMinOrderValue", v)} />
        <SelectField label="Settlement Cycle" value={form.settlementCycle}
          onChange={(v) => set("settlementCycle", v)}
          options={[{ value: "weekly", label: "Weekly" }, { value: "biweekly", label: "Bi-weekly" }, { value: "monthly", label: "Monthly" }]} />
        <NoteField value={note} onChange={setNote} />
      </div>
      <div className="flex justify-end mt-4">
        <SaveButton onClick={() => { dispatch(updatePharmacy({ ...form, platformFee: fee, note })); setNote(""); }} loading={loading} color={SECTION_META.pharmacy.color} />
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 8  CUSTOM PLAN OPTIONS
//  Slab-based structure from the model:
//    consultation: { pricePerConsultation, maxDoctorsAllowed, doctorPricingTiers[] }
//    transport: { kmSlabs[] }
//    diagnosticsDiscount: { slabs[] }
//    pharmacyDiscount: { slabs[] }
//    careAssistant: { pricePerVisit }
//    addOns: { homeSampleCollection, prioritySupport }
// ─────────────────────────────────────────────────────────────────────────────
function SlabEditor({ label, slabs = [], onChange, keyA, keyB, labelA, labelB, suffixA, suffixB }) {
  const update = (i, k, v) => {
    const next = slabs.map((s, idx) => idx === i ? { ...s, [k]: Number(v) } : s);
    onChange(next);
  };
  const add    = () => onChange([...slabs, { [keyA]: 0, [keyB]: 0 }]);
  const remove = (i) => onChange(slabs.filter((_, idx) => idx !== i));

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ opacity: 0.4 }}>{label}</p>
      {slabs.map((slab, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <div className="flex-1 flex items-center rounded-xl overflow-hidden border" style={{ borderColor: "var(--base-300)" }}>
            <input type="number" value={slab[keyA] ?? ""} min={0}
              onChange={(e) => update(i, keyA, e.target.value)}
              className="flex-1 px-3 py-2 text-sm font-black outline-none"
              style={{ background: "var(--base-100)", border: "none", color: "var(--base-content)", minWidth: 0 }} />
            <span className="px-2 text-[10px] font-black" style={{ background: "var(--base-200)", borderLeft: "1px solid var(--base-300)", color: "var(--base-content)", opacity: 0.55, height: 38, display: "flex", alignItems: "center" }}>{suffixA}</span>
          </div>
          <div className="flex-1 flex items-center rounded-xl overflow-hidden border" style={{ borderColor: "var(--base-300)" }}>
            <span className="px-2 text-[10px] font-black" style={{ background: "var(--base-200)", borderRight: "1px solid var(--base-300)", color: "var(--base-content)", opacity: 0.55, height: 38, display: "flex", alignItems: "center" }}>₹</span>
            <input type="number" value={slab[keyB] ?? ""} min={0}
              onChange={(e) => update(i, keyB, e.target.value)}
              className="flex-1 px-3 py-2 text-sm font-black outline-none"
              style={{ background: "var(--base-100)", border: "none", color: "var(--base-content)", minWidth: 0 }} />
            <span className="px-2 text-[10px] font-black" style={{ background: "var(--base-200)", borderLeft: "1px solid var(--base-300)", color: "var(--base-content)", opacity: 0.55, height: 38, display: "flex", alignItems: "center" }}>{suffixB}</span>
          </div>
          <button onClick={() => remove(i)} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,.1)", color: "#ef4444" }}>
            <X size={11} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg mt-1"
        style={{ background: "color-mix(in srgb,var(--primary),transparent 88%)", color: "var(--primary)" }}>
        <Plus size={11} /> Add Slab
      </button>
    </div>
  );
}

function CustomPlanOptionsSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectCustomPlanOptions);
  const loading  = useSelector(selectCustomPlanOptionsLoading);
  const error    = useSelector(selectCustomPlanOptionsError);

  const [consultation,       setConsultation]       = useState({ pricePerConsultation: 0, maxDoctorsAllowed: 5, doctorPricingTiers: [] });
  const [transport,          setTransport]          = useState({ kmSlabs: [] });
  const [diagDiscount,       setDiagDiscount]       = useState({ slabs: [] });
  const [pharmDiscount,      setPharmDiscount]      = useState({ slabs: [] });
  const [careAssistant,      setCareAssistant]      = useState({ pricePerVisit: 0 });
  const [addOns,             setAddOns]             = useState({ homeSampleCollection: 199, prioritySupport: 99 });
  const [note,               setNote]               = useState("");

  useEffect(() => {
    if (data) {
      if (data.consultation)       setConsultation({ ...data.consultation });
      if (data.transport)          setTransport({ ...data.transport });
      if (data.diagnosticsDiscount) setDiagDiscount({ ...data.diagnosticsDiscount });
      if (data.pharmacyDiscount)   setPharmDiscount({ ...data.pharmacyDiscount });
      if (data.careAssistant)      setCareAssistant({ ...data.careAssistant });
      if (data.addOns)             setAddOns({ ...data.addOns });
    }
  }, [data]);

  const handleSave = () => {
    dispatch(updateCustomPlanOptions({
      consultation,
      transport,
      diagnosticsDiscount: diagDiscount,
      pharmacyDiscount:    pharmDiscount,
      careAssistant,
      addOns,
      note,
    }));
    setNote("");
  };

  return (
    <SectionCard sectionKey="customPlanOptions" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="customPlanOptionsStatus" dispatch={dispatch}>
      <div className="p-3 rounded-xl mb-4 flex items-start gap-2"
        style={{ background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)" }}>
        <Info size={13} style={{ color: "#6366f1", flexShrink: 0, marginTop: 1 }} />
        <p className="text-[11px] font-semibold" style={{ color: "#6366f1" }}>
          Changes only affect new custom plans. Existing plans snapshot prices at creation time.
        </p>
      </div>

      <div className="space-y-6 mt-2">
        {/* Consultation */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ opacity: 0.4 }}>Consultation Block</p>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <NumericField label="Price Per Consultation" value={consultation.pricePerConsultation}
              onChange={(v) => setConsultation((c) => ({ ...c, pricePerConsultation: v }))} />
            <NumericField label="Max Doctors Allowed" value={consultation.maxDoctorsAllowed} min={1} prefix=""
              onChange={(v) => setConsultation((c) => ({ ...c, maxDoctorsAllowed: v }))} />
          </div>
          <p className="text-[10px] font-semibold mb-2" style={{ opacity: 0.4 }}>Doctor Count → Additional Price Tiers</p>
          {(consultation.doctorPricingTiers ?? []).map((tier, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input type="number" placeholder="Doctor count" value={tier.doctorCount ?? ""}
                onChange={(e) => { const t = [...(consultation.doctorPricingTiers ?? [])]; t[i] = { ...t[i], doctorCount: Number(e.target.value) }; setConsultation((c) => ({ ...c, doctorPricingTiers: t })); }}
                className="input-field flex-1 text-sm font-bold" />
              <input type="number" placeholder="Add. price ₹" value={tier.additionalPrice ?? ""}
                onChange={(e) => { const t = [...(consultation.doctorPricingTiers ?? [])]; t[i] = { ...t[i], additionalPrice: Number(e.target.value) }; setConsultation((c) => ({ ...c, doctorPricingTiers: t })); }}
                className="input-field flex-1 text-sm font-bold" />
              <button onClick={() => setConsultation((c) => ({ ...c, doctorPricingTiers: (c.doctorPricingTiers ?? []).filter((_, idx) => idx !== i) }))}
                className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(239,68,68,.1)", color: "#ef4444" }}>
                <X size={11} />
              </button>
            </div>
          ))}
          <button onClick={() => setConsultation((c) => ({ ...c, doctorPricingTiers: [...(c.doctorPricingTiers ?? []), { doctorCount: 1, additionalPrice: 0 }] }))}
            className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg mt-1"
            style={{ background: "color-mix(in srgb,var(--primary),transparent 88%)", color: "var(--primary)" }}>
            <Plus size={11} /> Add Tier
          </button>
        </div>

        {/* Transport km slabs */}
        <SlabEditor
          label="Transport — KM Slabs (km → price)"
          slabs={transport.kmSlabs ?? []}
          onChange={(s) => setTransport({ kmSlabs: s })}
          keyA="km" keyB="price" suffixA="km" suffixB="price" />

        {/* Diagnostics discount slabs */}
        <SlabEditor
          label="Diagnostics Discount Slabs (% → price)"
          slabs={diagDiscount.slabs ?? []}
          onChange={(s) => setDiagDiscount({ slabs: s })}
          keyA="percent" keyB="price" suffixA="%" suffixB="price" />

        {/* Pharmacy discount slabs */}
        <SlabEditor
          label="Pharmacy Discount Slabs (% → price)"
          slabs={pharmDiscount.slabs ?? []}
          onChange={(s) => setPharmDiscount({ slabs: s })}
          keyA="percent" keyB="price" suffixA="%" suffixB="price" />

        {/* Care assistant */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ opacity: 0.4 }}>Care Assistant Block</p>
          <NumericField label="Price Per Visit" value={careAssistant.pricePerVisit}
            onChange={(v) => setCareAssistant({ pricePerVisit: v })} />
        </div>

        {/* Add-ons */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ opacity: 0.4 }}>Add-Ons</p>
          <div className="grid grid-cols-2 gap-4">
            <NumericField label="Home Sample Collection" value={addOns.homeSampleCollection}
              onChange={(v) => setAddOns((a) => ({ ...a, homeSampleCollection: v }))} />
            <NumericField label="Priority Support" value={addOns.prioritySupport}
              onChange={(v) => setAddOns((a) => ({ ...a, prioritySupport: v }))} />
          </div>
        </div>

        <div className="grid grid-cols-1"><NoteField value={note} onChange={setNote} /></div>
        <div className="flex justify-end"><SaveButton onClick={handleSave} loading={loading} color={SECTION_META.customPlanOptions.color} /></div>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 9  ADS  (only 2 fields in the model)
// ─────────────────────────────────────────────────────────────────────────────
function AdsSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectAds);
  const loading  = useSelector(selectAdsLoading);
  const error    = useSelector(selectAdsError);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");

  useEffect(() => { if (data) setForm({ ...data }); }, [data]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SectionCard sectionKey="ads" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="adsStatus" dispatch={dispatch}>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <NumericField label="Sponsored Listing/mo" value={form.sponsoredListingMonthly} onChange={(v) => set("sponsoredListingMonthly", v)} />
        <NumericField label="Homepage Banner/mo" value={form.homePageBannerMonthly} onChange={(v) => set("homePageBannerMonthly", v)} />
        <NoteField value={note} onChange={setNote} />
      </div>
      <div className="flex justify-end mt-4">
        <SaveButton onClick={() => { dispatch(updateAds({ ...form, note })); setNote(""); }} loading={loading} color={SECTION_META.ads.color} />
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  § 10  TAX  (superadmin only)
// ─────────────────────────────────────────────────────────────────────────────
function TaxSection({ isSuperadmin }) {
  const dispatch = useDispatch();
  const data     = useSelector(selectTax);
  const loading  = useSelector(selectTaxLoading);
  const error    = useSelector(selectTaxError);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");

  useEffect(() => { if (data) setForm({ ...data }); }, [data]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SectionCard sectionKey="tax" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="taxStatus" dispatch={dispatch}>
      <div className="p-3 rounded-xl mb-4 flex items-start gap-2"
        style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)" }}>
        <Lock size={13} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
        <p className="text-[11px] font-semibold" style={{ color: "#ef4444" }}>
          Regulatory rates. Consultation GST is locked at 0% (medical exemption by law). Only superadmins may edit.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <NumericField label="Default GST" value={form.defaultGstPercent} onChange={(v) => set("defaultGstPercent", v)} min={0} max={100} prefix="" suffix="%" superadminOnly />
        <NumericField label="Pharmacy GST" value={form.pharmacyGstPercent} onChange={(v) => set("pharmacyGstPercent", v)} min={0} max={100} prefix="" suffix="%" superadminOnly />
        <NumericField label="Transport GST" value={form.transportGstPercent} onChange={(v) => set("transportGstPercent", v)} min={0} max={100} prefix="" suffix="%" superadminOnly />
        <div>
          <FieldLabel superadminOnly>Consultation GST</FieldLabel>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
            <Lock size={11} style={{ color: "#ef4444" }} />
            <span className="text-sm font-black">0% — GST Exempt (Medical)</span>
          </div>
        </div>
        <NumericField label="Diagnostics GST" value={form.diagnosticsGstPercent} onChange={(v) => set("diagnosticsGstPercent", v)} min={0} max={100} prefix="" suffix="%" superadminOnly />
        <NumericField label="Care Assistant GST" value={form.careAssistantGstPercent} onChange={(v) => set("careAssistantGstPercent", v)} min={0} max={100} prefix="" suffix="%" superadminOnly />
        <NoteField value={note} onChange={setNote} />
      </div>
      {isSuperadmin && (
        <div className="flex justify-end mt-4">
          <SaveButton onClick={() => { dispatch(updateTax({ ...form, note })); setNote(""); }} loading={loading} color={SECTION_META.tax.color} />
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
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");

  useEffect(() => { if (data) setForm({ ...data }); }, [data]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SectionCard sectionKey="refundPolicy" isSuperadmin={isSuperadmin} loading={loading} error={error} statusKey="refundPolicyStatus" dispatch={dispatch}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <NumericField label="Full Refund Threshold" value={form.rideFullRefundHoursThreshold} onChange={(v) => set("rideFullRefundHoursThreshold", v)} min={0} prefix="" suffix="hrs" />
        <NumericField label="Partial Refund %" value={form.ridePartialRefundPercent} onChange={(v) => set("ridePartialRefundPercent", v)} min={0} max={100} prefix="" suffix="%" />
        <NumericField label="Processing Min" value={form.refundProcessingDaysMin} onChange={(v) => set("refundProcessingDaysMin", v)} min={0} prefix="" suffix="days" />
        <NumericField label="Processing Max" value={form.refundProcessingDaysMax} onChange={(v) => set("refundProcessingDaysMax", v)} min={0} prefix="" suffix="days" />
        <NoteField value={note} onChange={setNote} />
      </div>
      <div className="flex justify-end mt-4">
        <SaveButton onClick={() => { dispatch(updateRefundPolicy({ ...form, note })); setNote(""); }} loading={loading} color={SECTION_META.refundPolicy.color} />
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  VERSION HISTORY PANEL
// ─────────────────────────────────────────────────────────────────────────────
function VersionHistoryPanel({ isSuperadmin, onClose }) {
  const dispatch         = useDispatch();
  const history          = useSelector(selectPricingHistory);
  const pagination       = useSelector(selectPricingHistoryPagination);
  const historyLoading   = useSelector(selectPricingHistoryLoading);
  const selectedSnapshot = useSelector(selectSelectedSnapshot);
  const snapshotLoading  = useSelector(selectSelectedSnapshotLoading);
  const restoreLoading   = useSelector(selectRestoreLoading);
  const restoreError     = useSelector(selectRestoreError);

  const [page,        setPage]        = useState(1);
  const [restoreNote, setRestoreNote] = useState("");
  const [confirmIdx,  setConfirmIdx]  = useState(null);

  useEffect(() => { dispatch(fetchPricingHistory({ page, limit: 10 })); }, [dispatch, page]);

  const handleRestore = () => {
    if (confirmIdx === null) return;
    dispatch(restorePricingConfig({ index: confirmIdx, note: restoreNote }));
    setConfirmIdx(null); setRestoreNote("");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)" }}
        onClick={onClose} />

      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 24 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-3xl overflow-hidden flex flex-col"
        style={{
          background: "var(--base-100)",
          border: "1.5px solid var(--base-300)",
          borderRadius: "calc(var(--r-box) * 1.5)",
          boxShadow: "0 48px 96px rgba(0,0,0,0.4)",
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--base-300)", background: "var(--base-200)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb,var(--primary),transparent 88%)" }}>
              <History size={15} style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ opacity: 0.4 }}>Audit Log</p>
              <p className="text-sm font-black">Version History</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "var(--base-300)" }}>
            <X size={14} />
          </button>
        </div>

        {restoreError && (
          <div className="mx-6 mt-4 flex items-center gap-2 p-3 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(239,68,68,.08)", color: "#ef4444" }}>
            <AlertCircle size={13} /> {restoreError}
            <button onClick={() => dispatch(clearRestoreStatus())} className="ml-auto"><X size={11} /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {historyLoading && history.length === 0 ? (
            <div className="flex justify-center py-12">
              <RefreshCw size={20} className="animate-spin" style={{ opacity: 0.4 }} />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12" style={{ opacity: 0.4 }}>
              <Database size={32} style={{ margin: "0 auto 8px" }} />
              <p className="text-sm font-bold">No version history yet</p>
            </div>
          ) : (
            history.map((entry, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }} className="rounded-xl p-4"
                style={{ background: "var(--base-200)", border: "1px solid var(--base-300)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: entry.changedByRole === "superadmin" ? "rgba(239,68,68,.12)" : "rgba(59,130,246,.12)", color: entry.changedByRole === "superadmin" ? "#ef4444" : "#3b82f6" }}>
                        {entry.changedByRole}
                      </span>
                      <span className="text-[10px] font-bold" style={{ opacity: 0.45 }}>
                        {entry.changedAt ? new Date(entry.changedAt).toLocaleString("en-IN") : "—"}
                      </span>
                    </div>
                    {entry.changeNote && <p className="text-xs font-semibold" style={{ opacity: 0.65 }}>{entry.changeNote}</p>}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => dispatch(fetchPricingHistoryByIndex(i))} disabled={snapshotLoading}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black"
                      style={{ background: "color-mix(in srgb,var(--primary),transparent 88%)", color: "var(--primary)" }}>
                      <Eye size={10} /> View
                    </button>
                    {isSuperadmin && (
                      <button onClick={() => setConfirmIdx(i)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black"
                        style={{ background: "rgba(245,158,11,.12)", color: "#f59e0b" }}>
                        <RotateCcw size={10} /> Restore
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}

          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-black"
                style={{ background: "var(--base-200)", opacity: page === 1 ? 0.4 : 1 }}>‹ Prev</button>
              <span className="px-3 py-1.5 text-xs font-black" style={{ opacity: 0.5 }}>{page} / {pagination.pages}</span>
              <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                className="px-3 py-1.5 rounded-lg text-xs font-black"
                style={{ background: "var(--base-200)", opacity: page === pagination.pages ? 0.4 : 1 }}>Next ›</button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedSnapshot && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-6 pb-5 flex-shrink-0" style={{ borderTop: "1px solid var(--base-300)" }}>
                <div className="flex items-center justify-between py-3">
                  <p className="text-xs font-black">Snapshot Preview</p>
                  <button onClick={() => dispatch(clearSelectedSnapshot())} className="text-[10px] font-bold" style={{ opacity: 0.5 }}>Close Preview</button>
                </div>
                <pre className="text-[10px] font-mono overflow-auto max-h-48 p-3 rounded-xl"
                  style={{ background: "var(--base-300)", color: "var(--base-content)" }}>
                  {JSON.stringify(selectedSnapshot, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {confirmIdx !== null && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="absolute z-[300] w-full max-w-sm overflow-hidden rounded-2xl p-6 space-y-4"
            style={{ background: "var(--base-100)", border: "2px solid #f59e0b", boxShadow: "0 32px 64px rgba(245,158,11,0.4)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,.15)" }}>
                <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
              </div>
              <div>
                <p className="text-sm font-black">Restore Configuration?</p>
                <p className="text-[10px] font-semibold" style={{ opacity: 0.5 }}>This overwrites ALL current config sections.</p>
              </div>
            </div>
            <input type="text" placeholder="Reason for restore (optional)" value={restoreNote}
              onChange={(e) => setRestoreNote(e.target.value)} className="input-field w-full text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setConfirmIdx(null)} className="flex-1 py-2.5 rounded-xl text-xs font-black" style={{ background: "var(--base-300)" }}>Cancel</button>
              <button onClick={handleRestore} disabled={restoreLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black text-white"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                {restoreLoading ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
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
      <div className="skeleton h-28 rounded-2xl" />
      {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function PlatformPricingManagement() {
  const dispatch      = useDispatch();
  const adminConfig   = useSelector(selectAdminConfig);
  const configLoading = useSelector(selectAdminConfigLoading);
  const configError   = useSelector(selectAdminConfigError);
  const anySaving     = useSelector(selectAnySectionSaving);

  // ── Auth from Redux store — no prop drilling ───────────────────────────────
  const user         = useSelector((s) => s.user?.user) ?? null;
  const isSuperadmin = user?.role === "superadmin";

  const [showHistory, setShowHistory] = useState(false);
  const [search,      setSearch]      = useState("");

  useEffect(() => { dispatch(fetchAdminPricingConfig()); }, [dispatch]);

  const sections = useMemo(() => {
    const q = search.toLowerCase().trim();
    return Object.keys(SECTION_META).filter((key) => {
      const m = SECTION_META[key];
      return m.label.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q);
    });
  }, [search]);

  if (configLoading && !adminConfig) return <PageSkeleton />;

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        {/* PAGE HEADER */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="relative overflow-hidden rounded-2xl p-6"
            style={{ background: "linear-gradient(135deg, var(--base-200) 0%, var(--base-100) 100%)", border: "1.5px solid var(--base-300)" }}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.04]">
              <svg width="100%" height="100%"><defs><pattern id="pg" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0 0V24" fill="none" stroke="var(--base-content)" strokeWidth="0.8" /></pattern></defs><rect width="100%" height="100%" fill="url(#pg)" /></svg>
            </div>

            <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,var(--primary),var(--secondary))" }}>
                    <Settings size={15} className="text-white" />
                  </motion.div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ opacity: 0.4 }}>Platform Configuration</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black leading-tight">
                  Pricing <span className="text-gradient-primary">Control Centre</span>
                </h1>
                <p className="text-sm mt-1" style={{ opacity: 0.45 }}>
                  {isSuperadmin
                    ? "Superadmin — full access including GST / tax section"
                    : "Admin — 10 sections (GST/tax requires superadmin)"}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {anySaving && (
                  <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black"
                    style={{ background: "rgba(59,130,246,.1)", color: "#3b82f6" }}>
                    <RefreshCw size={11} className="animate-spin" /> Saving…
                  </motion.div>
                )}
                <button onClick={() => setShowHistory(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{ background: "var(--base-200)", border: "1.5px solid var(--base-300)" }}>
                  <History size={13} /> Version History
                </button>
                <button onClick={() => dispatch(fetchAdminPricingConfig())} disabled={configLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{ background: "var(--base-200)", border: "1.5px solid var(--base-300)", opacity: configLoading ? 0.6 : 1 }}>
                  <RefreshCw size={13} className={configLoading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>

            {adminConfig && (
              <div className="relative z-10 flex items-center gap-4 mt-5 flex-wrap">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(16,185,129,.12)", color: "#10b981" }}>
                  <BadgeCheck size={9} className="inline mr-1" /> Config Active
                </span>
                <span className="text-[10px] font-semibold" style={{ opacity: 0.4 }}>
                  Last updated: {adminConfig.updatedAt ? new Date(adminConfig.updatedAt).toLocaleString("en-IN") : "—"}
                </span>
                {adminConfig.lastUpdatedByRole && (
                  <span className="text-[10px] font-semibold" style={{ opacity: 0.4 }}>
                    By: {adminConfig.lastUpdatedByRole}
                  </span>
                )}
                {user && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: isSuperadmin ? "rgba(239,68,68,.1)" : "rgba(59,130,246,.1)", color: isSuperadmin ? "#ef4444" : "#3b82f6" }}>
                    {isSuperadmin ? "Superadmin" : "Admin"}
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {configError && (
          <div className="flex items-center gap-2 p-4 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(239,68,68,.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,.2)" }}>
            <AlertCircle size={16} /> {configError}
          </div>
        )}

        {/* SEARCH */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ opacity: 0.4 }} />
          <input type="text" placeholder="Search sections…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field w-full pl-10 text-sm" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ opacity: 0.45 }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* SECTIONS */}
        <div className="space-y-3">
          {sections.map((key) => {
            const props = { isSuperadmin };
            switch (key) {
              case "caps":              return <CapsSection             key={key} {...props} />;
              case "transport":         return <TransportSection        key={key} {...props} />;
              case "careAssistant":     return <CareAssistantSection    key={key} {...props} />;
              case "doctor":            return <DoctorSection           key={key} {...props} />;
              case "hospital":          return <HospitalSection         key={key} {...props} />;
              case "diagnostics":       return <DiagnosticsSection      key={key} {...props} />;
              case "pharmacy":          return <PharmacySection         key={key} {...props} />;
              case "customPlanOptions": return <CustomPlanOptionsSection key={key} {...props} />;
              case "ads":               return <AdsSection              key={key} {...props} />;
              case "tax":               return <TaxSection              key={key} {...props} />;
              case "refundPolicy":      return <RefundPolicySection     key={key} {...props} />;
              default:                  return null;
            }
          })}
        </div>

        {sections.length === 0 && search && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-16" style={{ opacity: 0.4 }}>
            <Search size={32} style={{ margin: "0 auto 8px" }} />
            <p className="text-sm font-bold">No sections match "{search}"</p>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showHistory && (
          <VersionHistoryPanel isSuperadmin={isSuperadmin} onClose={() => setShowHistory(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}