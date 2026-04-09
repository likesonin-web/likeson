'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchComplianceDashboard,
  selectCompliance,
  selectLoading,
  selectError,
} from '@/store/slices/soloDriverSlice';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  FileText,
  Car,
  Stethoscope,
  CreditCard,
  IdCard,
  Leaf,
  Wrench,
  Ticket,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileMinus,
  ChevronRight,
  CircleGauge,
} from 'lucide-react';

/* ─── animation variants ──────────────────────────────────────────────────── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show:  { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
};

/* ─── doc → icon map ──────────────────────────────────────────────────────── */
const DOC_ICON = {
  'Driving Licence':       IdCard,
  'PSV Badge':             CreditCard,
  'Medical Fitness':       Stethoscope,
  'Vehicle Insurance':     Car,
  'Pollution Certificate': Leaf,
  'Fitness Certificate':   Wrench,
  'Vehicle Permit':        Ticket,
};

/* ─── status config ───────────────────────────────────────────────────────── */
const STATUS_CFG = {
  valid: {
    label:   'Valid',
    Icon:    CheckCircle2,
    color:   'var(--success)',
    bg:      'color-mix(in srgb, var(--success), transparent 88%)',
    border:  'color-mix(in srgb, var(--success), transparent 65%)',
    ring:    'color-mix(in srgb, var(--success), transparent 82%)',
    barColor:'var(--success)',
  },
  expiring: {
    label:   'Expiring Soon',
    Icon:    AlertTriangle,
    color:   'var(--warning)',
    bg:      'color-mix(in srgb, var(--warning), transparent 88%)',
    border:  'color-mix(in srgb, var(--warning), transparent 60%)',
    ring:    'color-mix(in srgb, var(--warning), transparent 80%)',
    barColor:'var(--warning)',
  },
  expired: {
    label:   'Expired',
    Icon:    ShieldX,
    color:   'var(--error)',
    bg:      'color-mix(in srgb, var(--error), transparent 88%)',
    border:  'color-mix(in srgb, var(--error), transparent 60%)',
    ring:    'color-mix(in srgb, var(--error), transparent 80%)',
    barColor:'var(--error)',
  },
  missing: {
    label:   'Not Submitted',
    Icon:    FileMinus,
    color:   'var(--neutral)',
    bg:      'color-mix(in srgb, var(--neutral), transparent 88%)',
    border:  'color-mix(in srgb, var(--neutral), transparent 65%)',
    ring:    'color-mix(in srgb, var(--neutral), transparent 82%)',
    barColor:'var(--neutral)',
  },
};

/* ─── overall status banner config ───────────────────────────────────────── */
const OVERALL_CFG = {
  good: {
    headline: 'All Documents Valid',
    sub:      'No action required right now.',
    Icon:     ShieldCheck,
    gradient: 'linear-gradient(135deg, var(--success) 0%, var(--secondary) 100%)',
    shadow:   'color-mix(in srgb, var(--success), transparent 55%)',
  },
  warning: {
    headline: 'Documents Expiring Soon',
    sub:      'Renew highlighted documents before they expire.',
    Icon:     ShieldAlert,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    shadow:   'rgba(245,158,11,0.35)',
  },
  critical: {
    headline: 'Critical — Action Required',
    sub:      'One or more documents are expired. Rides may be suspended.',
    Icon:     ShieldX,
    gradient: 'linear-gradient(135deg, var(--error) 0%, #b91c1c 100%)',
    shadow:   'color-mix(in srgb, var(--error), transparent 50%)',
  },
};

/* ─── progress bar for days-left ─────────────────────────────────────────── */
function DaysBar({ daysLeft, status }) {
  const cfg      = STATUS_CFG[status] || STATUS_CFG.valid;
  const maxDays  = 365;
  const pct      = status === 'missing'  ? 0
                 : status === 'expired'  ? 0
                 : Math.min(100, ((daysLeft ?? 0) / maxDays) * 100);

  return (
    <div className="h-1 rounded-full overflow-hidden mt-3"
      style={{ background: 'var(--base-300)' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="h-full rounded-full"
        style={{ background: cfg.barColor }}
      />
    </div>
  );
}

/* ─── single document card ────────────────────────────────────────────────── */
function DocCard({ doc }) {
  const cfg    = STATUS_CFG[doc.status] || STATUS_CFG.missing;
  const DocIcon = DOC_ICON[doc.label] || FileText;
  const StatusIcon = cfg.Icon;

  const expiryStr = doc.expiry
    ? new Date(doc.expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const daysLabel = doc.status === 'missing'  ? 'Not submitted'
                  : doc.status === 'expired'  ? `Expired ${Math.abs(doc.daysLeft ?? 0)} days ago`
                  : doc.status === 'expiring' ? `${doc.daysLeft} days left`
                  : doc.daysLeft != null       ? `${doc.daysLeft} days left`
                  : 'Valid';

  return (
    <motion.div
      variants={item}
      whileHover={{ y: -3, boxShadow: `0 12px 32px ${cfg.ring}` }}
      className="relative p-5 rounded-2xl overflow-hidden cursor-default transition-shadow"
      style={{
        background:   cfg.bg,
        border:      `1.5px solid ${cfg.border}`,
      }}
    >
      {/* accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ background: cfg.color }} />

      <div className="flex items-start gap-4 pl-3">
        {/* icon */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${cfg.color}, transparent 78%)` }}>
          <DocIcon size={20} style={{ color: cfg.color }} />
        </div>

        {/* body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-bold text-sm" style={{ color: 'var(--base-content)' }}>
              {doc.label}
            </p>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: `color-mix(in srgb, ${cfg.color}, transparent 82%)`, color: cfg.color, border: `1px solid ${cfg.border}` }}>
              <StatusIcon size={11} />
              {cfg.label}
            </span>
          </div>

          {expiryStr && (
            <p className="text-xs mt-1 flex items-center gap-1"
              style={{ color: 'color-mix(in oklch, var(--base-content) 52%, transparent)' }}>
              <CalendarClock size={11} />
              {doc.status === 'expired' ? 'Expired on' : 'Expires'} {expiryStr}
            </p>
          )}

          <div className="flex items-center justify-between mt-1">
            <p className="text-xs font-semibold" style={{ color: cfg.color }}>
              {daysLabel}
            </p>
            {doc.status !== 'valid' && doc.status !== 'missing' && (
              <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
                {doc.status === 'expiring' ? 'Renew now' : 'Upload renewed doc'}
              </p>
            )}
          </div>

          <DaysBar daysLeft={doc.daysLeft} status={doc.status} />
        </div>
      </div>
    </motion.div>
  );
}

/* ─── summary counts ──────────────────────────────────────────────────────── */
function SummaryPill({ status, count }) {
  const cfg = STATUS_CFG[status];
  if (!count) return null;
  const Icon = cfg.Icon;
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <Icon size={14} style={{ color: cfg.color }} />
      <span className="text-sm font-bold" style={{ color: cfg.color }}>{count}</span>
      <span className="text-xs font-medium" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
        {cfg.label}
      </span>
    </div>
  );
}

/* ─── skeleton ────────────────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton h-24 rounded-2xl" />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PAGE                                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function DocumentExpiry() {
  const dispatch   = useDispatch();
  const compliance = useSelector(selectCompliance);   // real data from fetchComplianceDashboard
  const loading    = useSelector(selectLoading('compliance'));
  const error      = useSelector(selectError('compliance'));

  useEffect(() => { dispatch(fetchComplianceDashboard()); }, [dispatch]);

  /* ── derived from real API response ────────────────────────────────────── */
  const docs           = compliance?.documents ?? [];
  const overallStatus  = compliance?.overallStatus ?? 'good';
  const overall        = OVERALL_CFG[overallStatus] || OVERALL_CFG.good;
  const OverallIcon    = overall.Icon;

  const expiredCount   = docs.filter(d => d.status === 'expired').length;
  const expiringCount  = docs.filter(d => d.status === 'expiring').length;
  const validCount     = docs.filter(d => d.status === 'valid').length;
  const missingCount   = docs.filter(d => d.status === 'missing').length;

  /* ── sort: critical first ───────────────────────────────────────────────── */
  const ORDER = { expired: 0, missing: 1, expiring: 2, valid: 3 };
  const sorted = [...docs].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  /* ── gauge pct ──────────────────────────────────────────────────────────── */
  const healthPct = docs.length
    ? Math.round((validCount / docs.length) * 100)
    : 100;

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)' }}>
              <FileText size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-black"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                Document Expiry
              </h1>
              <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                Your compliance & licence tracker
              </p>
            </div>
          </div>

          <button
            onClick={() => dispatch(fetchComplianceDashboard())}
            aria-label="Refresh compliance data"
            className="p-2.5 rounded-xl transition-all hover:bg-base-200"
            style={{ border: '1px solid var(--base-300)' }}
          >
            <RefreshCw size={16}
              className={loading ? 'animate-spin' : ''}
              style={{ color: 'var(--base-content)' }}
            />
          </button>
        </motion.div>

        {/* ── Error state ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="alert alert-error mb-6"
            >
              <ShieldX size={15} />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && !compliance && <Skeleton />}

        {/* ── Real content ─────────────────────────────────────────────────── */}
        {!loading && compliance && (
          <>
            {/* Overall status hero */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-2xl p-6 mb-6"
              style={{
                background: overall.gradient,
                boxShadow: `0 18px 52px ${overall.shadow}`,
              }}
            >
              {/* decorative blobs */}
              <div className="absolute -top-8 -right-8 w-44 h-44 rounded-full opacity-15"
                style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
              <div className="absolute -bottom-10 -left-12 w-52 h-52 rounded-full opacity-10"
                style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />

              <div className="relative z-10 flex items-center gap-5">
                {/* circular health gauge */}
                <div className="relative shrink-0 w-20 h-20">
                  <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none"
                      stroke="rgba(255,255,255,0.2)" strokeWidth="7" />
                    <motion.circle
                      cx="40" cy="40" r="34" fill="none"
                      stroke="white" strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - healthPct / 100) }}
                      transition={{ duration: 1.1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-black text-base">{healthPct}%</span>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-0.5">
                    Overall Status
                  </p>
                  <h2 className="text-white font-black text-xl leading-tight"
                    style={{ fontFamily: 'var(--font-display)' }}>
                    {overall.headline}
                  </h2>
                  <p className="text-white/70 text-xs mt-1 leading-snug">
                    {overall.sub}
                  </p>
                </div>

                <OverallIcon size={36} className="text-white/30 shrink-0 hidden sm:block" />
              </div>
            </motion.div>

            {/* Summary pills */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="flex flex-wrap gap-3 mb-6"
            >
              <SummaryPill status="expired"  count={expiredCount} />
              <SummaryPill status="expiring" count={expiringCount} />
              <SummaryPill status="valid"    count={validCount} />
              <SummaryPill status="missing"  count={missingCount} />
            </motion.div>

            {/* Document cards */}
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {sorted.map(doc => (
                <DocCard key={doc.label} doc={doc} />
              ))}
            </motion.div>

            {/* Bottom hint */}
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center text-xs mt-8 leading-relaxed"
              style={{ color: 'color-mix(in oklch, var(--base-content) 38%, transparent)' }}
            >
              Documents with &lt;30 days remaining trigger automatic alerts.
              <br />
              Ride dispatch may be suspended for expired compliance documents.
            </motion.p>
          </>
        )}

        {/* Empty state */}
        {!loading && !compliance && !error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <CircleGauge size={48} style={{ color: 'color-mix(in oklch, var(--base-content) 25%, transparent)' }} />
            <p className="text-sm font-semibold"
              style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
              No compliance data yet
            </p>
            <button onClick={() => dispatch(fetchComplianceDashboard())}
              className="btn-secondary px-6 py-2 text-sm">
              Load Documents
            </button>
          </div>
        )}

      </div>
    </div>
  );
}