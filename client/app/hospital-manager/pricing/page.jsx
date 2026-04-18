'use client';

/**
 * Pricing.jsx  —  Hospital Manager · Consultation Pricing
 *
 * Stack  : Next.js · Tailwind CSS (hospital theme) · Framer Motion · Recharts · Lucide
 * Redux  : fetchPricing / updatePricing  (hospitalManagerSlice)
 * Role   : hospital-manager hospitals ONLY (managementModel === 'hospital-manager')
 *
 * Sections
 *   1. Hero KPI bar   – quick read of all 3 consultation fees + follow-up
 *   2. Fee Editor     – in-place edit of fees, honorariums, follow-up policy
 *   3. Consultation types toggle
 *   4. Revenue chart  – stacked bar: fee vs honorarium margin per type
 *   5. Audit trail    – last updated by / role
 */

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import {
  IndianRupee, Stethoscope, Video, Home, RefreshCw,
  Save, AlertTriangle, CheckCircle2, Info, Lock,
  Edit3, TrendingUp, Percent, Clock, ChevronDown,
  ChevronUp, Loader2, ShieldCheck,
} from 'lucide-react';

import {
  fetchPricing,
  updatePricing,
  selectPricing,
  isLoading,
  getError,
} from '@/store/slices/hospitalManagerSlice';

// ─── animation presets ────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

const popIn = {
  hidden:  { scale: 0.92, opacity: 0 },
  visible: { scale: 1,    opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);

const clamp = (val, min, max) => Math.min(Math.max(Number(val) || 0, min), max);

// ─── sub-components ──────────────────────────────────────────────────────────

/** Animated KPI tile */
function KpiCard({ icon: Icon, label, value, sub, color = 'primary', index = 0 }) {
  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      className="relative overflow-hidden rounded-[var(--r-box)] border border-base-300
                 bg-base-100 p-5 shadow-sm group hover:-translate-y-1 transition-transform duration-300"
    >
      {/* glow blob */}
      <span
        className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-10 blur-2xl
                   group-hover:opacity-20 transition-opacity duration-500"
        style={{ background: `var(--${color})` }}
      />

      <div className="flex items-start justify-between mb-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-[var(--r-field)]"
          style={{ background: `color-mix(in srgb, var(--${color}), transparent 85%)` }}
        >
          <Icon size={18} style={{ color: `var(--${color})` }} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/50">{label}</span>
      </div>

      <p className="font-montserrat text-2xl font-extrabold text-base-content leading-none">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-base-content/55">{sub}</p>}
    </motion.div>
  );
}

/** Section header */
function SectionTitle({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-field)]
                       bg-[color-mix(in_srgb,var(--primary),transparent_88%)]">
        <Icon size={16} className="text-primary" />
      </span>
      <div>
        <h3 className="font-montserrat text-base font-bold text-base-content">{title}</h3>
        {desc && <p className="text-xs text-base-content/55 mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

/** Number input with rupee prefix */
function RupeeInput({ label, value, onChange, min = 0, max = 99999, disabled = false, helper }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-base-content/70 uppercase tracking-wide">{label}</label>
      <div className={`flex items-center rounded-[var(--r-field)] border overflow-hidden
                       transition-colors duration-200 ${disabled
                         ? 'bg-base-300/50 border-base-300 opacity-60 cursor-not-allowed'
                         : 'bg-base-200 border-base-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'}`}>
        <span className="flex items-center justify-center h-10 w-10 border-r border-base-300 bg-base-300/40">
          <IndianRupee size={14} className="text-base-content/50" />
        </span>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clamp(e.target.value, min, max))}
          className="flex-1 h-10 bg-transparent px-3 text-sm font-semibold text-base-content
                     outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
                     [&::-webkit-outer-spin-button]:appearance-none disabled:pointer-events-none"
        />
      </div>
      {helper && <p className="text-[11px] text-base-content/45">{helper}</p>}
    </div>
  );
}

/** Toggle pill */
function Toggle({ label, checked, onChange, disabled = false }) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer select-none
                        ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors duration-300
                    ${checked ? 'bg-primary' : 'bg-base-300'}`}
      >
        <motion.span
          animate={{ x: checked ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
        />
      </div>
      <span className="text-sm font-medium text-base-content">{label}</span>
    </label>
  );
}

/** Custom recharts tooltip */
function PricingTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--r-box)] border border-base-300 bg-base-100 p-3 shadow-lg text-xs">
      <p className="font-semibold text-base-content mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-base-content/70">{p.name}</span>
          </span>
          <span className="font-bold" style={{ color: p.fill }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Pricing() {
  const dispatch = useDispatch();
  const pricing  = useSelector(selectPricing);
  const loading  = useSelector(isLoading(fetchPricing));
  const saving   = useSelector(isLoading(updatePricing));
  const error    = useSelector(getError(fetchPricing));

  // local form state (mirrors pricing fields minus platformFee)
  const [form, setForm] = useState({
    inPersonFee:             600,
    videoFee:                500,
    homeVisitFee:            1000,
    inPersonHonorarium:      400,
    videoHonorarium:         350,
    homeVisitHonorarium:     700,
    followUpFee:             0,
    followUpDiscountPercent: 20,
    followUpValidDays:       7,
    consultationTypes: {
      inPerson:  true,
      video:     false,
      homeVisit: false,
    },
  });

  const [dirty,          setDirty]          = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [validationErrs, setValidationErrs] = useState({});
  const [showChart,      setShowChart]      = useState(true);

  // seed form from Redux state
  useEffect(() => {
    dispatch(fetchPricing());
  }, [dispatch]);

  useEffect(() => {
    if (pricing) {
      setForm({
        inPersonFee:             pricing.inPersonFee             ?? 600,
        videoFee:                pricing.videoFee                ?? 500,
        homeVisitFee:            pricing.homeVisitFee            ?? 1000,
        inPersonHonorarium:      pricing.inPersonHonorarium      ?? 400,
        videoHonorarium:         pricing.videoHonorarium         ?? 350,
        homeVisitHonorarium:     pricing.homeVisitHonorarium     ?? 700,
        followUpFee:             pricing.followUpFee             ?? 0,
        followUpDiscountPercent: pricing.followUpDiscountPercent ?? 20,
        followUpValidDays:       pricing.followUpValidDays       ?? 7,
        consultationTypes: {
          inPerson:  pricing.consultationTypes?.inPerson  ?? true,
          video:     pricing.consultationTypes?.video     ?? false,
          homeVisit: pricing.consultationTypes?.homeVisit ?? false,
        },
      });
      setDirty(false);
    }
  }, [pricing]);

  // field change
  const set = useCallback((key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
    setSaved(false);
    setValidationErrs((e) => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  const setType = useCallback((key, val) => {
    setForm((prev) => ({
      ...prev,
      consultationTypes: { ...prev.consultationTypes, [key]: val },
    }));
    setDirty(true);
    setSaved(false);
  }, []);

  // validate
  const validate = () => {
    const errs = {};
    if (form.inPersonHonorarium  > form.inPersonFee)    errs.inPersonHonorarium  = 'Cannot exceed patient fee';
    if (form.videoHonorarium     > form.videoFee)        errs.videoHonorarium     = 'Cannot exceed patient fee';
    if (form.homeVisitHonorarium > form.homeVisitFee)    errs.homeVisitHonorarium = 'Cannot exceed patient fee';
    if (form.followUpValidDays   < 1 || form.followUpValidDays > 90)
      errs.followUpValidDays = 'Must be 1–90 days';
    if (form.followUpDiscountPercent < 0 || form.followUpDiscountPercent > 100)
      errs.followUpDiscountPercent = 'Must be 0–100%';
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setValidationErrs(errs); return; }

    const result = await dispatch(updatePricing(form));
    if (!result.error) {
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleReset = () => {
    if (pricing) {
      setForm({
        inPersonFee:             pricing.inPersonFee             ?? 600,
        videoFee:                pricing.videoFee                ?? 500,
        homeVisitFee:            pricing.homeVisitFee            ?? 1000,
        inPersonHonorarium:      pricing.inPersonHonorarium      ?? 400,
        videoHonorarium:         pricing.videoHonorarium         ?? 350,
        homeVisitHonorarium:     pricing.homeVisitHonorarium     ?? 700,
        followUpFee:             pricing.followUpFee             ?? 0,
        followUpDiscountPercent: pricing.followUpDiscountPercent ?? 20,
        followUpValidDays:       pricing.followUpValidDays       ?? 7,
        consultationTypes: {
          inPerson:  pricing.consultationTypes?.inPerson  ?? true,
          video:     pricing.consultationTypes?.video     ?? false,
          homeVisit: pricing.consultationTypes?.homeVisit ?? false,
        },
      });
      setDirty(false);
      setValidationErrs({});
    }
  };

  // chart data
  const chartData = [
    {
      name: 'In-Person',
      'Patient Fee':  form.inPersonFee,
      Honorarium:     form.inPersonHonorarium,
      Margin:         Math.max(0, form.inPersonFee - form.inPersonHonorarium),
      enabled:        form.consultationTypes.inPerson,
    },
    {
      name: 'Video',
      'Patient Fee':  form.videoFee,
      Honorarium:     form.videoHonorarium,
      Margin:         Math.max(0, form.videoFee - form.videoHonorarium),
      enabled:        form.consultationTypes.video,
    },
    {
      name: 'Home Visit',
      'Patient Fee':  form.homeVisitFee,
      Honorarium:     form.homeVisitHonorarium,
      Margin:         Math.max(0, form.homeVisitFee - form.homeVisitHonorarium),
      enabled:        form.consultationTypes.homeVisit,
    },
  ];

  // ── render states ──────────────────────────────────────────────────────────

  if (loading && !pricing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Loader2 size={32} className="text-primary" />
        </motion.div>
        <p className="text-sm text-base-content/55 font-medium">Loading pricing configuration…</p>
      </div>
    );
  }

  if (error && !pricing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle size={32} className="text-error" />
        <p className="text-sm text-error font-medium">{error}</p>
        <button onClick={() => dispatch(fetchPricing())} className="btn-secondary text-xs px-4 py-2">
          Retry
        </button>
      </div>
    );
  }

  // ── main render ────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="min-h-screen pb-20"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >

      {/* ── page header ────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-primary">
                <ShieldCheck size={10} />
                Hospital Pricing
              </span>
              <span className="text-xs text-base-content/40">
                Platform fee is managed by Superadmin
              </span>
            </div>
            <h1 className="font-montserrat text-2xl md:text-3xl font-extrabold text-base-content tracking-tight">
              Consultation Pricing
            </h1>
            <p className="mt-1 text-sm text-base-content/55">
              Set fees charged to patients and honorariums paid to linked doctors.
            </p>
          </div>

          {/* save / reset bar */}
          <AnimatePresence>
            {dirty && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="flex items-center gap-2"
              >
                <button
                  onClick={handleReset}
                  className="btn-secondary text-xs px-4 py-2.5 flex items-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary-cta text-xs px-5 py-2.5 flex items-center gap-1.5"
                >
                  {saving
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Save size={13} />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* saved confirmation */}
          <AnimatePresence>
            {saved && !dirty && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 rounded-[var(--r-field)] bg-success/10
                           border border-success/30 px-4 py-2.5"
              >
                <CheckCircle2 size={14} className="text-success" />
                <span className="text-xs font-semibold text-success">Pricing saved successfully</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── platform fee notice ─────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="alert alert-info mb-6 rounded-[var(--r-box)]">
        <Lock size={16} className="text-info shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">Platform fee is superadmin-controlled</p>
          <p className="text-xs text-base-content/60 mt-0.5">
            You can configure patient fees and doctor honorariums below. The platform fee (applied on top)
            is set by Superadmin and is not visible here.
          </p>
        </div>
      </motion.div>

      {/* ── KPI bar ─────────────────────────────────────────────────────────── */}
      <motion.div
        variants={stagger}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <KpiCard
          icon={Stethoscope}
          label="In-Person"
          value={fmt(form.inPersonFee)}
          sub={`Honorarium: ${fmt(form.inPersonHonorarium)}`}
          color="primary"
          index={0}
        />
        <KpiCard
          icon={Video}
          label="Video"
          value={fmt(form.videoFee)}
          sub={`Honorarium: ${fmt(form.videoHonorarium)}`}
          color="secondary"
          index={1}
        />
        <KpiCard
          icon={Home}
          label="Home Visit"
          value={fmt(form.homeVisitFee)}
          sub={`Honorarium: ${fmt(form.homeVisitHonorarium)}`}
          color="accent"
          index={2}
        />
        <KpiCard
          icon={RefreshCw}
          label="Follow-Up"
          value={form.followUpFee === 0 ? 'Free' : fmt(form.followUpFee)}
          sub={`Valid ${form.followUpValidDays} days · ${form.followUpDiscountPercent}% off`}
          color="success"
          index={3}
        />
      </motion.div>

      {/* ── main grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* LEFT — fee editor ───────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="space-y-6">

          {/* Consultation Types Toggle */}
          <div className="card p-6">
            <SectionTitle
              icon={Edit3}
              title="Consultation Types Offered"
              desc="Enable or disable the types of consultations available at your hospital."
            />

            <div className="space-y-4">
              <Toggle
                label="In-Person Consultations"
                checked={form.consultationTypes.inPerson}
                onChange={(v) => setType('inPerson', v)}
              />
              <Toggle
                label="Video Consultations"
                checked={form.consultationTypes.video}
                onChange={(v) => setType('video', v)}
              />
              <Toggle
                label="Home Visit Consultations"
                checked={form.consultationTypes.homeVisit}
                onChange={(v) => setType('homeVisit', v)}
              />
            </div>
          </div>

          {/* In-Person Fees */}
          <div className="card p-6">
            <SectionTitle
              icon={Stethoscope}
              title="In-Person Consultation"
              desc="Fees applied when a patient visits the doctor at the hospital."
            />
            <div className="grid grid-cols-2 gap-4">
              <RupeeInput
                label="Patient Fee"
                value={form.inPersonFee}
                onChange={(v) => set('inPersonFee', v)}
                disabled={!form.consultationTypes.inPerson}
              />
              <div>
                <RupeeInput
                  label="Doctor Honorarium"
                  value={form.inPersonHonorarium}
                  onChange={(v) => set('inPersonHonorarium', v)}
                  disabled={!form.consultationTypes.inPerson}
                  helper="Must not exceed patient fee"
                />
                {validationErrs.inPersonHonorarium && (
                  <p className="text-xs text-error mt-1">{validationErrs.inPersonHonorarium}</p>
                )}
              </div>
            </div>
            {form.consultationTypes.inPerson && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-base-content/50">
                <TrendingUp size={12} className="text-success" />
                Hospital margin: {fmt(Math.max(0, form.inPersonFee - form.inPersonHonorarium))}
                &nbsp;({form.inPersonFee > 0
                  ? ((1 - form.inPersonHonorarium / form.inPersonFee) * 100).toFixed(1)
                  : 0}%)
              </div>
            )}
          </div>

          {/* Video Fees */}
          <div className="card p-6">
            <SectionTitle
              icon={Video}
              title="Video Consultation"
              desc="Fees for remote video-based consultations."
            />
            <div className="grid grid-cols-2 gap-4">
              <RupeeInput
                label="Patient Fee"
                value={form.videoFee}
                onChange={(v) => set('videoFee', v)}
                disabled={!form.consultationTypes.video}
              />
              <div>
                <RupeeInput
                  label="Doctor Honorarium"
                  value={form.videoHonorarium}
                  onChange={(v) => set('videoHonorarium', v)}
                  disabled={!form.consultationTypes.video}
                  helper="Must not exceed patient fee"
                />
                {validationErrs.videoHonorarium && (
                  <p className="text-xs text-error mt-1">{validationErrs.videoHonorarium}</p>
                )}
              </div>
            </div>
            {form.consultationTypes.video && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-base-content/50">
                <TrendingUp size={12} className="text-success" />
                Hospital margin: {fmt(Math.max(0, form.videoFee - form.videoHonorarium))}
                &nbsp;({form.videoFee > 0
                  ? ((1 - form.videoHonorarium / form.videoFee) * 100).toFixed(1)
                  : 0}%)
              </div>
            )}
          </div>

          {/* Home Visit Fees */}
          <div className="card p-6">
            <SectionTitle
              icon={Home}
              title="Home Visit"
              desc="Fees for doctor home visits arranged through the hospital."
            />
            <div className="grid grid-cols-2 gap-4">
              <RupeeInput
                label="Patient Fee"
                value={form.homeVisitFee}
                onChange={(v) => set('homeVisitFee', v)}
                disabled={!form.consultationTypes.homeVisit}
              />
              <div>
                <RupeeInput
                  label="Doctor Honorarium"
                  value={form.homeVisitHonorarium}
                  onChange={(v) => set('homeVisitHonorarium', v)}
                  disabled={!form.consultationTypes.homeVisit}
                  helper="Must not exceed patient fee"
                />
                {validationErrs.homeVisitHonorarium && (
                  <p className="text-xs text-error mt-1">{validationErrs.homeVisitHonorarium}</p>
                )}
              </div>
            </div>
            {form.consultationTypes.homeVisit && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-base-content/50">
                <TrendingUp size={12} className="text-success" />
                Hospital margin: {fmt(Math.max(0, form.homeVisitFee - form.homeVisitHonorarium))}
                &nbsp;({form.homeVisitFee > 0
                  ? ((1 - form.homeVisitHonorarium / form.homeVisitFee) * 100).toFixed(1)
                  : 0}%)
              </div>
            )}
          </div>

        </motion.div>

        {/* RIGHT — follow-up + chart + audit ──────────────────────────────── */}
        <motion.div variants={fadeUp} className="space-y-6">

          {/* Follow-Up Policy */}
          <div className="card p-6">
            <SectionTitle
              icon={RefreshCw}
              title="Follow-Up Policy"
              desc="Configure how return visits are priced after the first consultation."
            />

            <div className="grid grid-cols-2 gap-4 mb-4">
              <RupeeInput
                label="Follow-Up Fee"
                value={form.followUpFee}
                onChange={(v) => set('followUpFee', v)}
                helper="Set 0 for free follow-ups"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-base-content/70 uppercase tracking-wide">
                  Discount (%)
                </label>
                <div className="flex items-center rounded-[var(--r-field)] border border-base-300
                                bg-base-200 focus-within:border-primary focus-within:ring-2
                                focus-within:ring-primary/20 overflow-hidden">
                  <span className="flex items-center justify-center h-10 w-10 border-r border-base-300 bg-base-300/40">
                    <Percent size={14} className="text-base-content/50" />
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.followUpDiscountPercent}
                    onChange={(e) => set('followUpDiscountPercent', clamp(e.target.value, 0, 100))}
                    className="flex-1 h-10 bg-transparent px-3 text-sm font-semibold text-base-content
                               outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                {validationErrs.followUpDiscountPercent && (
                  <p className="text-xs text-error">{validationErrs.followUpDiscountPercent}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-base-content/70 uppercase tracking-wide">
                Valid For (days after first visit)
              </label>
              <div className="flex items-center rounded-[var(--r-field)] border border-base-300
                              bg-base-200 focus-within:border-primary focus-within:ring-2
                              focus-within:ring-primary/20 overflow-hidden">
                <span className="flex items-center justify-center h-10 w-10 border-r border-base-300 bg-base-300/40">
                  <Clock size={14} className="text-base-content/50" />
                </span>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={form.followUpValidDays}
                  onChange={(e) => set('followUpValidDays', clamp(e.target.value, 1, 90))}
                  className="flex-1 h-10 bg-transparent px-3 text-sm font-semibold text-base-content
                             outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="pr-3 text-xs text-base-content/50 font-medium">days</span>
              </div>
              {validationErrs.followUpValidDays && (
                <p className="text-xs text-error">{validationErrs.followUpValidDays}</p>
              )}
              <p className="text-[11px] text-base-content/45">Range: 1 – 90 days</p>
            </div>

            {/* follow-up summary pill */}
            <div className="mt-4 rounded-[var(--r-field)] bg-success/8 border border-success/20 p-3">
              <p className="text-xs font-semibold text-success flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                Follow-Up Summary
              </p>
              <p className="text-xs text-base-content/60 mt-1">
                Patients returning within{' '}
                <strong className="text-base-content">{form.followUpValidDays} days</strong> will be charged{' '}
                {form.followUpFee === 0
                  ? <strong className="text-success">Free</strong>
                  : <>
                      <strong className="text-base-content">{fmt(form.followUpFee)}</strong>
                      {form.followUpDiscountPercent > 0 && (
                        <> or receive a <strong className="text-success">{form.followUpDiscountPercent}% discount</strong></>
                      )}
                    </>
                }
                {' '}on their follow-up visit.
              </p>
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-1">
              <SectionTitle
                icon={TrendingUp}
                title="Fee vs Honorarium Breakdown"
                desc="Visual comparison of patient charges vs doctor payouts."
              />
              <button
                onClick={() => setShowChart((s) => !s)}
                className="flex items-center gap-1 text-xs text-base-content/50 hover:text-primary transition-colors"
              >
                {showChart ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            <AnimatePresence>
              {showChart && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      barCategoryGap="30%"
                      barGap={4}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.55 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.55 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                      />
                      <Tooltip content={<PricingTooltip />} cursor={{ fill: 'var(--base-300)', opacity: 0.4 }} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                      />
                      <Bar dataKey="Patient Fee" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.enabled ? 'var(--primary)' : 'var(--base-300)'}
                            opacity={entry.enabled ? 1 : 0.4}
                          />
                        ))}
                      </Bar>
                      <Bar dataKey="Honorarium" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.enabled ? 'var(--secondary)' : 'var(--base-300)'}
                            opacity={entry.enabled ? 1 : 0.4}
                          />
                        ))}
                      </Bar>
                      <Bar dataKey="Margin" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.enabled ? 'var(--success)' : 'var(--base-300)'}
                            opacity={entry.enabled ? 0.75 : 0.3}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {chartData.map((d) => (
                      <div
                        key={d.name}
                        className={`rounded-[var(--r-field)] p-2.5 border text-center transition-opacity duration-300
                                    ${d.enabled ? 'bg-base-200 border-base-300' : 'opacity-40 bg-base-200 border-base-300'}`}
                      >
                        <p className="text-[10px] text-base-content/50 font-semibold uppercase tracking-wide mb-1">
                          {d.name}
                        </p>
                        <p className="text-xs font-bold text-success">
                          {fmt(d.Margin)}
                        </p>
                        <p className="text-[10px] text-base-content/40">margin</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Audit Trail */}
          {pricing?.lastUpdatedByRole && (
            <motion.div variants={popIn} className="card p-5">
              <SectionTitle icon={Info} title="Last Updated" />
              <div className="flex flex-wrap gap-3 text-xs text-base-content/60">
                <span className="flex items-center gap-1.5">
                  <span className="status-dot status-dot-info" />
                  Updated by: <strong className="text-base-content ml-1 capitalize">
                    {pricing.lastUpdatedByRole}
                  </strong>
                </span>
              </div>
            </motion.div>
          )}

        </motion.div>
      </div>

      {/* ── sticky save bar (mobile) ─────────────────────────────────────────── */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 xl:hidden
                       flex items-center gap-3 rounded-full border border-base-300
                       bg-base-100/90 backdrop-blur-md shadow-[var(--shadow-depth)]
                       px-5 py-3"
          >
            <AlertTriangle size={14} className="text-warning shrink-0" />
            <span className="text-xs font-semibold text-base-content/70">Unsaved changes</span>
            <button
              onClick={handleReset}
              className="text-xs font-bold text-base-content/50 hover:text-base-content transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary-cta text-xs px-4 py-2 flex items-center gap-1.5 rounded-full"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}