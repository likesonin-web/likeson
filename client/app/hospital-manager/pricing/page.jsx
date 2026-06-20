'use client';
 
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  IndianRupee, Stethoscope, RefreshCw, Save,
  AlertTriangle, CheckCircle2, Info, Edit3,
  TrendingUp, Percent, Clock, ChevronDown,
  Loader2, ShieldCheck, Users, SearchX,
  UserCheck, Activity, Wifi, BadgeCheck,
  MonitorSmartphone, Home, Building2, Video,
  ChevronRight, CircleDot,
} from 'lucide-react';

import {
  fetchLinkedDoctors,
  fetchDoctorPricing,
  updateDoctorPricing,
  selectLinkedDoctors,
  selectDoctorPricing,
  isLoading,
  getError,
} from '@/store/slices/hospitalManagerSlice';

// ─── animation presets ────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const slideIn = {
  hidden:  { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n ?? 0);

const clamp = (val, min, max) => Math.min(Math.max(Number(val) || 0, min), max);

const marginPct = (fee, hon) =>
  fee > 0 ? ((1 - hon / fee) * 100).toFixed(1) : '0.0';

const avatarInitials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

// ─── sub-components ───────────────────────────────────────────────────────────

/**
 * KpiCard — stat-card pattern from global.css
 */
function KpiCard({ icon: Icon, label, value, sub, accentVar, index = 0 }) {
  return (
    <motion.div variants={fadeUp} custom={index} className="card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-[var(--r-field)]"
          style={{
            background: `color-mix(in srgb, ${accentVar}, transparent 85%)`,
          }}
        >
          <Icon size={17} style={{ color: accentVar }} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">
          {label}
        </span>
      </div>
      <div>
        <p className="font-montserrat text-[1.6rem] font-black text-base-content leading-none">
          {value}
        </p>
        {sub && (
          <p className="mt-1 text-[10px] text-base-content/50">{sub}</p>
        )}
      </div>
    </motion.div>
  );
}

/**
 * SectionTitle — icon + heading + optional description
 */
function SectionTitle({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-field)] bg-primary/10">
        <Icon size={15} className="text-primary" />
      </span>
      <div>
        <h3 className="font-montserrat text-sm font-bold text-base-content leading-snug">
          {title}
        </h3>
        {desc && (
          <p className="text-[10px] text-base-content/50 mt-0.5 leading-relaxed">{desc}</p>
        )}
      </div>
    </div>
  );
}

/**
 * RupeeInput — styled number input with ₹ prefix
 */
function RupeeInput({ label, value, onChange, min = 0, max = 99999, disabled = false, helper, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">
        {label}
      </label>
      <div
        className={[
          'flex items-center rounded-[var(--r-field)] border overflow-hidden transition-colors duration-200',
          disabled
            ? 'bg-base-300/50 border-base-300 opacity-55 cursor-not-allowed'
            : error
              ? 'bg-base-200 border-error focus-within:ring-2 focus-within:ring-error/20'
              : 'bg-base-200 border-base-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        ].join(' ')}
      >
        <span className="flex items-center justify-center h-10 w-10 border-r border-base-300 bg-base-300/40 shrink-0">
          <IndianRupee size={13} className="text-base-content/45" />
        </span>
        <input
          type="number"
          min={min}
          max={max}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(clamp(e.target.value, min, max))}
          className="flex-1 h-10 bg-transparent px-3 text-xs font-semibold text-base-content outline-none
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
                     [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      {error  && <p className="text-[10px] text-error font-medium">{error}</p>}
      {!error && helper && <p className="text-[10px] text-base-content/40">{helper}</p>}
    </div>
  );
}

/**
 * PercentInput — % field
 */
function PercentInput({ label, value, onChange, min = 0, max = 100, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">
        {label}
      </label>
      <div
        className={[
          'flex items-center rounded-[var(--r-field)] border overflow-hidden transition-colors duration-200',
          error
            ? 'bg-base-200 border-error focus-within:ring-2 focus-within:ring-error/20'
            : 'bg-base-200 border-base-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        ].join(' ')}
      >
        <span className="flex items-center justify-center h-10 w-10 border-r border-base-300 bg-base-300/40 shrink-0">
          <Percent size={13} className="text-base-content/45" />
        </span>
        <input
          type="number"
          min={min}
          max={max}
          value={value ?? ''}
          onChange={(e) => onChange(clamp(e.target.value, min, max))}
          className="flex-1 h-10 bg-transparent px-3 text-xs font-semibold text-base-content outline-none
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="pr-3 text-[11px] text-base-content/45 font-medium">%</span>
      </div>
      {error && <p className="text-[10px] text-error font-medium">{error}</p>}
    </div>
  );
}

/**
 * DaysInput — number field for days
 */
function DaysInput({ label, value, onChange, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">
        {label}
      </label>
      <div
        className={[
          'flex items-center rounded-[var(--r-field)] border overflow-hidden transition-colors duration-200',
          error
            ? 'bg-base-200 border-error focus-within:ring-2 focus-within:ring-error/20'
            : 'bg-base-200 border-base-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        ].join(' ')}
      >
        <span className="flex items-center justify-center h-10 w-10 border-r border-base-300 bg-base-300/40 shrink-0">
          <Clock size={13} className="text-base-content/45" />
        </span>
        <input
          type="number"
          min={1}
          max={90}
          value={value ?? ''}
          onChange={(e) => onChange(clamp(e.target.value, 1, 90))}
          className="flex-1 h-10 bg-transparent px-3 text-xs font-semibold text-base-content outline-none
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="pr-3 text-[10px] text-base-content/45 font-medium">days</span>
      </div>
      {error && <p className="text-[10px] text-error font-medium">{error}</p>}
    </div>
  );
}

/**
 * ChartTooltip
 */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-[10px] shadow-depth min-w-[10rem]">
      <p className="font-bold text-base-content mb-2 text-xs">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5 text-base-content/65">
            <span className="h-2 w-2 rounded-full inline-block" style={{ background: p.fill }} />
            {p.name}
          </span>
          <span className="font-bold" style={{ color: p.fill }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * DoctorCard — sidebar list item
 */
function DoctorCard({ doctor, isSelected, onClick }) {
  const name        = doctor.user?.name ?? 'Doctor';
  const spec        = doctor.specialization ?? '—';
  const isVerified  = doctor.isVerified;
  const isActive    = doctor.isActive;
  const isOnline    = doctor.isOnline;

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left flex items-center gap-3 px-4 py-3 border-b border-base-300/50',
        'transition-colors duration-150 focus-visible:outline-none',
        isSelected
          ? 'bg-primary/10 border-r-[3px] border-r-primary'
          : 'hover:bg-primary/5',
      ].join(' ')}
    >
      {/* avatar */}
      <div className="relative shrink-0">
        {doctor.profilePhotoUrl ? (
          <img
            src={doctor.profilePhotoUrl}
            alt={name}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full flex items-center justify-center
                          font-bold text-sm text-primary-content"
               style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
            {avatarInitials(name)}
          </div>
        )}
        {isOnline && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success
                           border-2 border-base-100" />
        )}
      </div>

      {/* info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-semibold text-base-content truncate">
            Dr. {name}
          </span>
          {isVerified && (
            <BadgeCheck size={12} className="text-success shrink-0" />
          )}
        </div>
        <p className="text-[11px] text-base-content/50 truncate">{spec}</p>
      </div>

      {/* active dot */}
      <span
        className={[
          'h-2 w-2 rounded-full shrink-0',
          isActive ? 'bg-success' : 'bg-base-300',
        ].join(' ')}
      />
    </button>
  );
}

// ─── per-type fee row ─────────────────────────────────────────────────────────

const CONSULTATION_TYPES = [
  { key: 'inPerson',  label: 'In-Person',   Icon: Building2 },
  { key: 'video',     label: 'Video',        Icon: Video },
  { key: 'homeVisit', label: 'Home Visit',   Icon: Home },
];

function PerTypeRow({ typeKey, label, Icon, form, set, errors }) {
  const feeKey = `${typeKey}Fee`;
  const honKey = `${typeKey}Honorarium`;

  const fee = form[feeKey];
  const hon = form[honKey];

  const margin = fee != null && hon != null ? Math.max(0, fee - hon) : null;

  return (
    <div className="rounded-[var(--r-field)] border border-base-300 bg-base-200/40 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--r-field)] bg-secondary/10">
          <Icon size={13} className="text-secondary" />
        </span>
        <span className="text-xs font-bold text-base-content">{label}</span>
        <span className="text-[10px] text-base-content/40 ml-auto">
          Optional — defaults to Standard Pricing
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <RupeeInput
          label="Total Patient Fee"
          value={fee ?? ''}
          onChange={(v) => set(feeKey, v === '' ? null : v)}
          min={0}
          helper="Leave empty to use Standard Pricing"
          error={errors[feeKey]}
        />
        <RupeeInput
          label="Doctor's Payout"
          value={hon ?? ''}
          onChange={(v) => set(honKey, v === '' ? null : v)}
          min={0}
          helper="Cannot be more than the Patient Fee"
          error={errors[honKey]}
        />
      </div>

      {margin !== null && fee > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <TrendingUp size={12} className="text-success" />
          <p className="text-[10px] text-base-content/60">
            Hospital Profit:{' '}
            <strong className="text-base-content">{fmt(margin)}</strong>
            <span className="text-base-content/45 ml-1">({marginPct(fee, hon)}%)</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── empty pane ───────────────────────────────────────────────────────────────

function EmptyPane() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/8">
        <Stethoscope size={28} className="text-primary/60" />
      </div>
      <div className="text-center">
        <h3 className="font-montserrat font-bold text-base text-base-content mb-1">
          Select a Doctor
        </h3>
        <p className="text-xs text-base-content/50 max-w-xs leading-relaxed">
          Choose a doctor from the list on the left to set up their consultation fees and payout rules.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function Pricing() {
  const dispatch = useDispatch();

  // ── redux ──────────────────────────────────────────────────────────────────
  const doctors        = useSelector(selectLinkedDoctors);
  const pricingData    = useSelector(selectDoctorPricing);
  const loadingDocs    = useSelector(isLoading(fetchLinkedDoctors));
  const loadingPricing = useSelector(isLoading(fetchDoctorPricing));
  const saving         = useSelector(isLoading(updateDoctorPricing));
  const error          = useSelector(getError(fetchDoctorPricing));

  // ── local state ────────────────────────────────────────────────────────────
  const [selectedId,      setSelectedId]      = useState('');
  const [search,          setSearch]          = useState('');
  const [dirty,           setDirty]           = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [validationErrs,  setValidationErrs]  = useState({});
  const [showChart,       setShowChart]       = useState(true);

  const EMPTY_FORM = {
    consultationFee:         600,
    consultationHonorarium:  400,
    inPersonFee:             null,
    inPersonHonorarium:      null,
    videoFee:                null,
    videoHonorarium:         null,
    homeVisitFee:            null,
    homeVisitHonorarium:     null,
    followUpFee:             0,
    followUpDiscountPercent: 20,
    followUpValidDays:       7,
  };

  const [form, setForm] = useState(EMPTY_FORM);

  const selectedDoctor = useMemo(
    () => doctors?.find(d => d._id === selectedId) ?? null,
    [doctors, selectedId]
  );

  const filteredDoctors = useMemo(() => {
    if (!search.trim()) return doctors ?? [];
    const q = search.toLowerCase();
    return (doctors ?? []).filter(
      d =>
        d.user?.name?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q)
    );
  }, [doctors, search]);

  // ── effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    dispatch(fetchLinkedDoctors({ limit: 200 }));
  }, [dispatch]);

  useEffect(() => {
    if (doctors?.length && !selectedId) {
      setSelectedId(doctors[0]._id);
    }
  }, [doctors, selectedId]);

  useEffect(() => {
    if (selectedId) {
      dispatch(fetchDoctorPricing(selectedId));
      setDirty(false);
      setSaved(false);
      setValidationErrs({});
    }
  }, [dispatch, selectedId]);

  useEffect(() => {
    if (pricingData && selectedId) {
      setForm({
        consultationFee:         pricingData.consultationFee         ?? 600,
        consultationHonorarium:  pricingData.consultationHonorarium  ?? 400,
        inPersonFee:             pricingData.inPersonFee             ?? null,
        inPersonHonorarium:      pricingData.inPersonHonorarium      ?? null,
        videoFee:                pricingData.videoFee                ?? null,
        videoHonorarium:         pricingData.videoHonorarium         ?? null,
        homeVisitFee:            pricingData.homeVisitFee            ?? null,
        homeVisitHonorarium:     pricingData.homeVisitHonorarium     ?? null,
        followUpFee:             pricingData.followUpFee             ?? 0,
        followUpDiscountPercent: pricingData.followUpDiscountPercent ?? 20,
        followUpValidDays:       pricingData.followUpValidDays       ?? 7,
      });
      setDirty(false);
    }
  }, [pricingData, selectedId]);

  // ── field helpers ──────────────────────────────────────────────────────────

  const set = useCallback((key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setSaved(false);
    setValidationErrs(e => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  // ── validation ─────────────────────────────────────────────────────────────

  const validate = () => {
    const errs = {};

    if (form.consultationHonorarium > form.consultationFee) {
      errs.consultationHonorarium = 'Cannot exceed the patient fee';
    }
    if (form.followUpValidDays < 1 || form.followUpValidDays > 90) {
      errs.followUpValidDays = 'Must be between 1 and 90 days';
    }
    if (form.followUpDiscountPercent < 0 || form.followUpDiscountPercent > 100) {
      errs.followUpDiscountPercent = 'Must be between 0% and 100%';
    }

    CONSULTATION_TYPES.forEach(({ key }) => {
      const fee = form[`${key}Fee`];
      const hon = form[`${key}Honorarium`];
      if (fee != null && hon != null && hon > fee) {
        errs[`${key}Honorarium`] = `Cannot exceed ${key} patient fee`;
      }
    });

    return errs;
  };

  // ── save / reset ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setValidationErrs(errs); return; }

    const result = await dispatch(updateDoctorPricing({
      doctorProfileId: selectedId,
      payload: form,
    }));

    if (!result.error) {
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleReset = () => {
    if (pricingData) {
      setForm({
        consultationFee:         pricingData.consultationFee         ?? 600,
        consultationHonorarium:  pricingData.consultationHonorarium  ?? 400,
        inPersonFee:             pricingData.inPersonFee             ?? null,
        inPersonHonorarium:      pricingData.inPersonHonorarium      ?? null,
        videoFee:                pricingData.videoFee                ?? null,
        videoHonorarium:         pricingData.videoHonorarium         ?? null,
        homeVisitFee:            pricingData.homeVisitFee            ?? null,
        homeVisitHonorarium:     pricingData.homeVisitHonorarium     ?? null,
        followUpFee:             pricingData.followUpFee             ?? 0,
        followUpDiscountPercent: pricingData.followUpDiscountPercent ?? 20,
        followUpValidDays:       pricingData.followUpValidDays       ?? 7,
      });
      setDirty(false);
      setValidationErrs({});
    }
  };

  // ── chart data ─────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const margin = Math.max(0, form.consultationFee - form.consultationHonorarium);
    const rows = [
      { name: 'Standard Pricing', 'Patient Fee': form.consultationFee, "Doctor's Payout": form.consultationHonorarium, "Hospital Profit": margin },
    ];
    CONSULTATION_TYPES.forEach(({ key, label }) => {
      const fee = form[`${key}Fee`];
      const hon = form[`${key}Honorarium`];
      if (fee > 0) {
        rows.push({
          name: label,
          'Patient Fee': fee,
          "Doctor's Payout": hon ?? 0,
          "Hospital Profit": Math.max(0, fee - (hon ?? 0)),
        });
      }
    });
    return rows;
  }, [form]);

  // ── doctor stats bar ───────────────────────────────────────────────────────

  const docStats = selectedDoctor
    ? [
        { id: 'activity',    icon: Activity,    val: selectedDoctor.isActive   ? 'Active'   : 'Inactive', ok: selectedDoctor.isActive },
        { id: 'connection',  icon: Wifi,        val: selectedDoctor.isOnline   ? 'Online'   : 'Offline',  ok: selectedDoctor.isOnline },
        { id: 'verification',icon: ShieldCheck, val: selectedDoctor.isVerified ? 'Verified' : 'Pending',  ok: selectedDoctor.isVerified },
        { id: 'partnership', icon: UserCheck,   val: selectedDoctor.partnershipStatus ?? '—',             ok: selectedDoctor.partnershipStatus === 'Active' },
      ]
    : [];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER STATES
  // ─────────────────────────────────────────────────────────────────────────

  if (loadingDocs) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={30} className="text-primary animate-spin" />
        <p className="text-xs text-base-content/50 font-medium">Loading doctors…</p>
      </div>
    );
  }

  if (!doctors?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <SearchX size={44} className="text-base-300" />
        <h3 className="font-montserrat font-bold text-lg text-base-content">No Doctors Linked</h3>
        <p className="text-xs text-base-content/55 text-center max-w-xs leading-relaxed">
          Link doctors to your hospital first before configuring consultation pricing.
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="flex h-[calc(100vh-4rem)] overflow-hidden bg-base-200"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >

      {/* ══════════════════════════════════════════════════════════════════════
          SIDEBAR — doctor list
      ═════════════════════════════════════════════════════════════════════ */}
      <motion.aside
        variants={fadeUp}
        className="w-72 shrink-0 flex flex-col bg-base-100 border-r border-base-300
                   overflow-hidden xl:w-80"
      >
        {/* header */}
        <div className="px-4 pt-4 pb-3 border-b border-base-300 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-primary" />
            <span className="font-montserrat font-black text-sm text-base-content">
              Linked Doctors
            </span>
            <span className="badge badge-primary badge-xs ml-auto">
              {doctors.length}
            </span>
          </div>
          {/* search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or specialty…"
              className="input-field text-xs py-2 pr-3 pl-8 h-9"
            />
            <Users size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/35 pointer-events-none" />
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredDoctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <SearchX size={28} className="text-base-300" />
              <p className="text-xs text-base-content/45">No doctors match</p>
            </div>
          ) : (
            filteredDoctors.map(doctor => (
              <DoctorCard
                key={doctor._id}
                doctor={doctor}
                isSelected={selectedId === doctor._id}
                onClick={() => setSelectedId(doctor._id)}
              />
            ))
          )}
        </div>
      </motion.aside>

      {/* ══════════════════════════════════════════════════════════════════════
          DETAIL PANE
      ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {!selectedId ? (
          <EmptyPane />
        ) : (
          <>
            {/* ── top bar ────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 px-6 py-3.5 bg-base-100
                            border-b border-base-300 shrink-0">
              {/* doctor identity */}
              <div className="flex items-center gap-3 min-w-0">
                {selectedDoctor?.profilePhotoUrl ? (
                  <img
                    src={selectedDoctor.profilePhotoUrl}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0
                                  font-bold text-xs text-primary-content"
                       style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                    {avatarInitials(selectedDoctor?.user?.name ?? '')}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-montserrat font-black text-sm text-base-content truncate">
                    Dr. {selectedDoctor?.user?.name ?? '—'}
                  </p>
                  <p className="text-[10px] text-base-content/50 truncate">
                    {selectedDoctor?.specialization ?? '—'} ·{' '}
                    {selectedDoctor?.experienceYears ?? 0} yrs exp
                  </p>
                </div>

                {/* status chips */}
                <div className="hidden md:flex items-center gap-2 ml-2">
                  {docStats.map(({ id, icon: Icon, val, ok }) => (
                    <span
                      key={id}
                      className={ok ? 'badge badge-success badge-xs' : 'badge badge-xs'}
                      style={!ok ? { background: 'var(--base-300)', color: 'var(--base-content)', borderColor: 'var(--base-300)' } : {}}
                    >
                      <Icon size={9} />
                      {val}
                    </span>
                  ))}
                </div>
              </div>

              {/* action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <AnimatePresence>
                  {saved && !dirty && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-field)]
                                 bg-success/10 border border-success/30"
                    >
                      <CheckCircle2 size={12} className="text-success" />
                      <span className="text-[10px] font-semibold text-success">Saved</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {dirty && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <button
                        onClick={handleReset}
                        className="btn btn-sm btn-ghost text-xs"
                      >
                        <RefreshCw size={12} />
                        Reset
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn btn-sm btn-primary text-xs"
                      >
                        {saving
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Save size={12} />}
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── dirty warning stripe ────────────────────────────────────── */}
            <AnimatePresence>
              {dirty && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-warning/10 border-b border-warning/30 overflow-hidden shrink-0"
                >
                  <div className="flex items-center gap-2 px-6 py-2">
                    <AlertTriangle size={12} className="text-warning" />
                    <span className="text-[10px] font-semibold text-warning">
                      You have unsaved changes
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── scrollable content ─────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loadingPricing ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 size={22} className="text-primary animate-spin" />
                  <p className="text-xs text-base-content/45">Loading fee structure…</p>
                </div>
              ) : error ? (
                <div className="m-6 flex flex-col items-center gap-3 rounded-[var(--r-box)]
                                border border-error/20 bg-error/5 py-12">
                  <AlertTriangle size={22} className="text-error" />
                  <p className="text-xs text-error font-medium text-center">{error}</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedId}
                    initial="hidden"
                    animate="visible"
                    variants={stagger}
                    className="p-6 space-y-6 pb-24"
                  >

                    {/* ── info notice ─────────────────────────────────── */}
                    <motion.div variants={fadeUp} className="alert alert-info rounded-[var(--r-box)] border-none">
                      <Info size={16} className="text-info shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-base-content">How Pricing Works</p>
                        <p className="text-xs text-base-content/70 mt-1 leading-relaxed">
                          The <strong>Standard Pricing</strong> acts as your baseline rate. You can set custom rates for specific visit types like Video or Home Visits below. If you leave a custom visit type blank, the system will automatically charge the standard pricing.
                        </p>
                      </div>
                    </motion.div>

                    {/* ── KPI bar ─────────────────────────────────────── */}
                    <motion.div
                      variants={stagger}
                      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
                    >
                      <KpiCard
                        icon={IndianRupee}
                        label="Patient Pays"
                        value={fmt(form.consultationFee)}
                        sub="Standard total fee charged"
                        accentVar="var(--primary)"
                        index={0}
                      />
                      <KpiCard
                        icon={Stethoscope}
                        label="Doctor Earns"
                        value={fmt(form.consultationHonorarium)}
                        sub="Standard payout to doctor"
                        accentVar="var(--secondary)"
                        index={1}
                      />
                      <KpiCard
                        icon={TrendingUp}
                        label="Hospital Margin"
                        value={fmt(Math.max(0, form.consultationFee - form.consultationHonorarium))}
                        sub={`${marginPct(form.consultationFee, form.consultationHonorarium)}% standard profit`}
                        accentVar="var(--success)"
                        index={2}
                      />
                      <KpiCard
                        icon={RefreshCw}
                        label="Follow-Up"
                        value={form.followUpFee === 0 ? 'Free' : fmt(form.followUpFee)}
                        sub={`Valid for ${form.followUpValidDays} days`}
                        accentVar="var(--accent)"
                        index={3}
                      />
                    </motion.div>

                    {/* ── two-column grid ──────────────────────────────── */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                      {/* LEFT column */}
                      <div className="space-y-6">

                        {/* unified fee editor */}
                        <motion.div variants={fadeUp} className="card p-6 border border-base-300">
                          <SectionTitle
                            icon={Edit3}
                            title="Standard Pricing"
                            desc="The default base cost charged to patients and the standard payout to the doctor."
                          />

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <RupeeInput
                              label="Total Patient Fee"
                              value={form.consultationFee}
                              onChange={v => set('consultationFee', v)}
                            />
                            <RupeeInput
                              label="Doctor's Payout"
                              value={form.consultationHonorarium}
                              onChange={v => set('consultationHonorarium', v)}
                              helper="Cannot be more than the Patient Fee"
                              error={validationErrs.consultationHonorarium}
                            />
                          </div>

                          {/* margin summary */}
                          <div className="flex items-center gap-2 rounded-[var(--r-field)]
                                          bg-success/10 border border-success/30 p-3">
                            <TrendingUp size={14} className="text-success shrink-0" />
                            <p className="text-xs text-base-content/80">
                              Hospital Profit per standard visit:{' '}
                              <strong className="text-base-content text-sm ml-1">
                                {fmt(Math.max(0, form.consultationFee - form.consultationHonorarium))}
                              </strong>
                              <span className="text-base-content/60 font-medium ml-1">
                                ({marginPct(form.consultationFee, form.consultationHonorarium)}%)
                              </span>
                            </p>
                          </div>
                        </motion.div>

                        {/* per-type overrides */}
                        <motion.div variants={fadeUp} className="card p-6 border border-base-300">
                          <SectionTitle
                            icon={MonitorSmartphone}
                            title="Custom Pricing by Visit Type"
                            desc="Set different rates for specific visit types. If you leave these blank, they will automatically use the Standard Pricing above."
                          />
                          <div className="space-y-4 mt-2">
                            {CONSULTATION_TYPES.map(ct => (
                              <PerTypeRow
                                key={ct.key}
                                typeKey={ct.key}
                                label={ct.label}
                                Icon={ct.Icon}
                                form={form}
                                set={set}
                                errors={validationErrs}
                              />
                            ))}
                          </div>
                        </motion.div>

                      </div>

                      {/* RIGHT column */}
                      <div className="space-y-6">

                        {/* follow-up policy */}
                        <motion.div variants={fadeUp} className="card p-6 border border-base-300">
                          <SectionTitle
                            icon={RefreshCw}
                            title="Follow-Up Visit Rules"
                            desc="Define how much patients pay when returning to see this doctor, and how long the offer lasts."
                          />

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <RupeeInput
                              label="Follow-Up Cost"
                              value={form.followUpFee}
                              onChange={v => set('followUpFee', v)}
                              helper="Enter 0 to make follow-ups free"
                            />
                            <PercentInput
                              label="Discount (%)"
                              value={form.followUpDiscountPercent}
                              onChange={v => set('followUpDiscountPercent', v)}
                              error={validationErrs.followUpDiscountPercent}
                            />
                          </div>

                          <DaysInput
                            label="Offer valid for (days after 1st visit)"
                            value={form.followUpValidDays}
                            onChange={v => set('followUpValidDays', v)}
                            error={validationErrs.followUpValidDays}
                          />
                          <p className="text-[10px] text-base-content/50 mt-1.5 font-medium">Choose between 1 and 90 days.</p>

                          {/* summary pill */}
                          <div className="mt-5 rounded-[var(--r-field)] bg-base-200 border border-base-300 p-4">
                            <p className="text-xs font-bold text-base-content flex items-center gap-2 mb-2">
                              <CheckCircle2 size={14} className="text-primary" /> Follow-Up Summary
                            </p>
                            <p className="text-xs text-base-content/70 leading-relaxed">
                              If a patient returns within{' '}
                              <strong className="text-base-content">{form.followUpValidDays} days</strong>{' '}
                              they will be charged{' '}
                              {form.followUpFee === 0
                                ? <strong className="text-success uppercase tracking-wide">Free</strong>
                                : (
                                  <>
                                    <strong className="text-base-content">{fmt(form.followUpFee)}</strong>
                                    {form.followUpDiscountPercent > 0 && (
                                      <> — or get a{' '}
                                        <strong className="text-success">
                                          {form.followUpDiscountPercent}% discount
                                        </strong>
                                      </>
                                    )}
                                  </>
                                )
                              }
                              {' '}for their visit.
                            </p>
                          </div>
                        </motion.div>

                        {/* revenue chart */}
                        <motion.div variants={fadeUp} className="card p-6 border border-base-300">
                          <div className="flex items-center justify-between mb-1">
                            <SectionTitle
                              icon={TrendingUp}
                              title="Profit & Revenue Breakdown"
                              desc="A visual summary of the hospital's profit margin compared to the patient fee and doctor's payout."
                            />
                            <button
                              onClick={() => setShowChart(s => !s)}
                              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-base-content/50
                                         hover:text-primary transition-colors shrink-0 -mt-5"
                            >
                              {showChart
                                ? <><ChevronDown size={13} /> Hide Chart</>
                                : <><ChevronRight size={13} /> Show Chart</>
                              }
                            </button>
                          </div>

                          <AnimatePresence>
                            {showChart && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden mt-4"
                              >
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart
                                    data={chartData}
                                    margin={{ top: 6, right: 4, left: 0, bottom: 0 }}
                                    barCategoryGap="35%"
                                  >
                                    <CartesianGrid
                                      strokeDasharray="3 3"
                                      stroke="var(--base-300)"
                                      vertical={false}
                                    />
                                    <XAxis
                                      dataKey="name"
                                      tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.7, fontWeight: 500 }}
                                      axisLine={false}
                                      tickLine={false}
                                    />
                                    <YAxis
                                      tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                                      axisLine={false}
                                      tickLine={false}
                                      tickFormatter={v =>
                                        `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`
                                      }
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--base-300)', opacity: 0.15 }} />
                                    <Legend
                                      iconType="circle"
                                      iconSize={8}
                                      wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: 500 }}
                                    />
                                    <Bar dataKey="Patient Fee"  fill="var(--primary)"   radius={[3,3,0,0]} />
                                    <Bar dataKey="Doctor's Payout"   fill="var(--secondary)" radius={[3,3,0,0]} />
                                    <Bar dataKey="Hospital Profit"       fill="var(--success)"   radius={[3,3,0,0]} opacity={0.85} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>

                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

          </>
        )}
      </div>

      {/* ── mobile sticky save bar ───────────────────────────────────────────── */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 xl:hidden
                       flex items-center justify-between gap-3
                       rounded-full border border-base-300 bg-base-100/90 backdrop-blur-md
                       shadow-[var(--shadow-depth-lg)] px-5 py-3 w-[92%] max-w-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-warning" />
              <span className="text-[10px] font-semibold text-base-content/65">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="text-[10px] font-bold text-base-content/45 hover:text-base-content transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-sm btn-primary text-[10px] px-4 rounded-full"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}