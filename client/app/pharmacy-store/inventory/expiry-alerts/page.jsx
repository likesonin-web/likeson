'use client';

/**
 * ExpiryAlertsPage
 * ────────────────────────────────────────────────────────────
 * Enterprise-grade expiry-alert dashboard for pharmacy staff.
 * Architecture:
 *   • All API calls via Redux thunks (pharmacyStoreSlice)
 *   • Pure presentational sub-components memoised with React.memo
 *   • Heavy chart loaded via next/dynamic (code-split)
 *   • Skeleton loaders instead of full-page spinners
 *   • Accessible: semantic HTML + ARIA roles + focus management
 *   • CSS tokens from global.css / pharmacy theme — zero inline colour literals
 */

import dynamic from 'next/dynamic';
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  Suspense,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  AlertTriangle,
  Clock,
  Send,
  Loader2,
  RefreshCw,
  Package,
  Zap,
  CheckCircle2,
  XCircle,
  MailCheck,
  Activity,
  Info,
} from 'lucide-react';

import {
  fetchExpiryAlerts,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

/* ─── dynamic import: chart is heavy, split it out ──────────── */
const ExpiryChart = dynamic(() => import('./ExpiryChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

/* ═══════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
═══════════════════════════════════════════════════════════════ */
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055 } },
};
const fadeSlide = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
const scaleIn = {
  hidden:  { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1,   transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS  (stable references — no re-creation per render)
═══════════════════════════════════════════════════════════════ */
const DAY_OPTIONS = [7, 14, 30, 60, 90];

/**
 * Returns urgency tier metadata for a given daysLeft value.
 * Kept outside component so it is never re-created.
 */
function getUrgency(days) {
  if (days < 0)   return { label: 'Expired',  tier: 'expired',  colorVar: 'var(--error)',   bgClass: 'bg-error/10',   ringClass: 'border-error/25' };
  if (days <= 7)  return { label: 'Critical', tier: 'critical', colorVar: 'var(--error)',   bgClass: 'bg-error/10',   ringClass: 'border-error/25' };
  if (days <= 14) return { label: 'Urgent',   tier: 'urgent',   colorVar: 'var(--warning)', bgClass: 'bg-warning/10', ringClass: 'border-warning/25' };
  return              { label: 'Monitor',  tier: 'normal',   colorVar: 'var(--info)',    bgClass: 'bg-info/10',    ringClass: 'border-info/25' };
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON LOADERS
═══════════════════════════════════════════════════════════════ */
function CardSkeleton() {
  return (
    <div className="bg-base-100 border border-base-300 rounded-[var(--r-box)] p-4 flex gap-3 animate-pulse" aria-hidden="true">
      <div className="w-11 h-11 rounded-xl bg-base-300 shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3.5 bg-base-300 rounded w-2/3" />
        <div className="h-2.5 bg-base-300 rounded w-1/3" />
        <div className="h-2 bg-base-300 rounded w-full mt-3" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-base-100 border border-base-300 rounded-[var(--r-box)] p-5 h-[210px] animate-pulse" aria-hidden="true">
      <div className="h-4 bg-base-300 rounded w-40 mb-4" />
      <div className="h-[140px] bg-base-200 rounded-lg" />
    </div>
  );
}

function StatTileSkeleton() {
  return (
    <div className="bg-base-200 rounded-[var(--r-box)] p-4 space-y-3 animate-pulse" aria-hidden="true">
      <div className="w-5 h-5 bg-base-300 rounded" />
      <div className="h-7 bg-base-300 rounded w-12" />
      <div className="h-2.5 bg-base-300 rounded w-24" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UrgencyPill  — memoised pure component
═══════════════════════════════════════════════════════════════ */
const UrgencyPill = memo(function UrgencyPill({ days }) {
  const u = getUrgency(days);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${u.bgClass} ${u.ringClass}`}
      style={{ color: u.colorVar }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: u.colorVar }}
        aria-hidden="true"
      />
      {u.label}{days >= 0 ? ` · ${days}d` : ''}
    </span>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ExpiryCard  — memoised, avoids re-render unless item changes
═══════════════════════════════════════════════════════════════ */
const ExpiryCard = memo(function ExpiryCard({ item, index }) {
  const days = item.daysLeft ?? 0;
  const u    = getUrgency(days);
  const pct  = Math.min(100, Math.max(4, (days / 30) * 100));

  const expiryLabel = useMemo(() => {
    if (!item.expiryDate) return 'N/A';
    return new Date(item.expiryDate).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }, [item.expiryDate]);

  return (
    <motion.article
      variants={fadeSlide}
      whileHover={{ y: -2 }}
      style={{ borderLeft: `3px solid ${u.colorVar}` }}
      className="bg-base-100 border border-base-300 rounded-[var(--r-box)] p-4 flex gap-3.5 items-start hover:shadow-md transition-shadow"
      aria-label={`${item.brandName || item.name}, ${u.label}, ${days >= 0 ? `${days} days remaining` : 'expired'}`}
    >
      {/* icon */}
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${u.bgClass}`}
        aria-hidden="true"
      >
        <Calendar size={17} style={{ color: u.colorVar }} />
      </div>

      {/* body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="font-bold text-sm text-base-content leading-tight">
              {item.brandName || item.name}
            </p>
            <p className="text-[11px] text-base-content/50 font-medium mt-0.5">
              {item.category}
              {item.batchNumber && (
                <> · <span className="font-mono">{item.batchNumber}</span></>
              )}
            </p>
          </div>
          <UrgencyPill days={days} />
        </div>

        {/* meta */}
        <div className="flex gap-4 mt-2.5 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] text-base-content/50">
            <Package size={10} aria-hidden="true" />
            {item.stockQuantity} units
          </span>
          <span className="flex items-center gap-1 text-[11px] text-base-content/50">
            <Calendar size={10} aria-hidden="true" />
            Expires {expiryLabel}
          </span>
        </div>

        {/* progress bar */}
        <div className="mt-3" aria-label={`${days <= 0 ? 'Expired' : `${days} days remaining`}`}>
          <div className="h-1 bg-base-300 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: index * 0.025 + 0.2, duration: 0.65, ease: 'easeOut' }}
              style={{ height: '100%', background: u.colorVar, borderRadius: 99 }}
            />
          </div>
          <p className="text-[10px] text-base-content/35 font-medium mt-1">
            {days <= 0 ? 'Already expired' : `${days} day${days !== 1 ? 's' : ''} remaining`}
          </p>
        </div>
      </div>
    </motion.article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   StatTile  — memoised filter button
═══════════════════════════════════════════════════════════════ */
const StatTile = memo(function StatTile({ label, value, colorVar, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[var(--r-box)] p-4 text-left cursor-pointer transition-all duration-200 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
        ${active ? 'border-[1.5px]' : 'bg-base-200 border-[1.5px] border-transparent'}`}
      style={active ? {
        background: `color-mix(in srgb, ${colorVar} 10%, var(--base-100))`,
        borderColor: colorVar,
      } : {}}
    >
      <Icon size={16} style={{ color: colorVar, marginBottom: 10 }} aria-hidden="true" />
      <div
        className="text-2xl font-black leading-none font-montserrat"
        style={{ color: colorVar }}
        aria-live="polite"
      >
        {value}
      </div>
      <div className="text-[10px] font-semibold text-base-content/50 mt-1.5 uppercase tracking-wider">
        {label}
      </div>
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   DayPill  — memoised
═══════════════════════════════════════════════════════════════ */
const DayPill = memo(function DayPill({ d, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning
        ${selected
          ? 'bg-warning text-warning-content shadow-sm'
          : 'bg-transparent text-base-content/50 hover:text-base-content/80'}`}
    >
      {d}d
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   EmptyState
═══════════════════════════════════════════════════════════════ */
const EmptyState = memo(function EmptyState({ filterGroup, days, onReset }) {
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      role="status"
      className="bg-base-100 border border-base-300 rounded-[var(--r-box)] py-14 px-6 text-center"
    >
      <div className="w-14 h-14 rounded-full bg-success/12 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={26} className="text-success" aria-hidden="true" />
      </div>
      <h3 className="font-black text-lg text-base-content mb-1.5 font-montserrat">All Clear</h3>
      <p className="text-sm text-base-content/50 leading-relaxed">
        {filterGroup !== 'all'
          ? 'No medicines in this urgency group.'
          : `No medicines expiring within ${days} days.`}
      </p>
      {filterGroup !== 'all' && (
        <button
          type="button"
          onClick={onReset}
          className="mt-3 text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          View all alerts
        </button>
      )}
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   CriticalBanner
═══════════════════════════════════════════════════════════════ */
const CriticalBanner = memo(function CriticalBanner({ count }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      role="alert"
      aria-live="assertive"
      className="bg-error/8 border border-error/28 border-l-[3px] border-l-error rounded-[var(--r-box)] p-3.5 flex items-center gap-3 mb-5"
    >
      <div className="w-8 h-8 rounded-lg bg-error/15 flex items-center justify-center shrink-0">
        <Zap size={14} className="text-error" aria-hidden="true" />
      </div>
      <div>
        <p className="font-bold text-[13px] text-base-content">
          {count} medicine{count !== 1 ? 's' : ''} expiring within 7 days
        </p>
        <p className="text-[11px] text-base-content/55 mt-0.5">
          Immediate action required — consider returning to supplier or disposing safely
        </p>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ListHeader
═══════════════════════════════════════════════════════════════ */
const ListHeader = memo(function ListHeader({ filterGroup, filteredCount, onClear }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] font-semibold text-base-content/45 uppercase tracking-wider">
        {filterGroup !== 'all'
          ? `Showing ${filteredCount} ${filterGroup} item${filteredCount !== 1 ? 's' : ''}`
          : `${filteredCount} total alert${filteredCount !== 1 ? 's' : ''}`}
      </p>
      {filterGroup !== 'all' && (
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-semibold text-primary underline underline-offset-2 opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          Clear filter
        </button>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   BottomSummary
═══════════════════════════════════════════════════════════════ */
const BottomSummary = memo(function BottomSummary({ critical, urgent, normal }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.35 }}
      className="mt-6 px-4 py-3.5 bg-base-100 border border-base-300 rounded-[var(--r-box)] flex items-center justify-between flex-wrap gap-2"
      aria-label="Alert summary"
    >
      <span className="text-[11px] text-base-content/45 font-medium">
        Last refreshed just now · Next auto-scan in 2 min
      </span>
      <div className="flex items-center gap-3" aria-live="polite">
        {critical > 0 && <span className="text-[12px] font-bold text-error">{critical} critical</span>}
        {urgent   > 0 && <span className="text-[12px] font-bold text-warning">{urgent} urgent</span>}
        {normal   > 0 && <span className="text-[12px] font-bold text-info">{normal} monitor</span>}
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PAGE COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ExpiryAlertsPage() {
  const dispatch = useDispatch();

  /* ── Redux state (granular selector — prevents over-subscription) */
  const expiryAlerts     = useSelector(s => s.pharmacyStore.expiryAlerts);
  const expiryAlertsMeta = useSelector(s => s.pharmacyStore.expiryAlertsMeta);
  const isLoading        = useSelector(s => s.pharmacyStore.loading.expiryAlerts);

  /* ── Local UI state */
  const [days,        setDays]        = useState(30);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent,    setEmailSent]    = useState(false);
  const [filterGroup,  setFilterGroup]  = useState('all');

  /* ── Fetch on mount + when days changes */
  useEffect(() => {
    dispatch(fetchExpiryAlerts({ days }));
  }, [days, dispatch]);

  /* ── Derived counts — memoised */
  const critical = useMemo(() => expiryAlerts.filter(i => (i.daysLeft ?? 0) <= 7).length,  [expiryAlerts]);
  const urgent   = useMemo(() => expiryAlerts.filter(i => { const d = i.daysLeft ?? 0; return d > 7 && d <= 14; }).length, [expiryAlerts]);
  const normal   = useMemo(() => expiryAlerts.filter(i => (i.daysLeft ?? 0) > 14).length,  [expiryAlerts]);

  const filtered = useMemo(() => {
    if (filterGroup === 'critical') return expiryAlerts.filter(i => (i.daysLeft ?? 0) <= 7);
    if (filterGroup === 'urgent')   return expiryAlerts.filter(i => { const d = i.daysLeft ?? 0; return d > 7 && d <= 14; });
    if (filterGroup === 'normal')   return expiryAlerts.filter(i => (i.daysLeft ?? 0) > 14);
    return expiryAlerts;
  }, [expiryAlerts, filterGroup]);

  /* ── Timeline data for chart (memoised) */
  const timelineData = useMemo(() => {
    const buckets = { 'Week 1': 0, 'Week 2': 0, 'Week 3': 0, 'Week 4+': 0 };
    expiryAlerts.forEach(item => {
      const d = item.daysLeft ?? 0;
      const k = d <= 7 ? 'Week 1' : d <= 14 ? 'Week 2' : d <= 21 ? 'Week 3' : 'Week 4+';
      buckets[k]++;
    });
    return Object.entries(buckets).map(([name, items]) => ({ name, items }));
  }, [expiryAlerts]);

  /* ── Callbacks — stable references */
  const handleRefresh = useCallback(() => {
    dispatch(fetchExpiryAlerts({ days }));
  }, [days, dispatch]);

  const handleSendEmail = useCallback(async () => {
    if (sendingEmail || expiryAlerts.length === 0) return;
    setSendingEmail(true);
    await dispatch(fetchExpiryAlerts({ days, sendEmail: true }));
    setSendingEmail(false);
    setEmailSent(true);
    const t = setTimeout(() => setEmailSent(false), 4000);
    return () => clearTimeout(t);
  }, [days, dispatch, expiryAlerts.length, sendingEmail]);

  const handleDayChange   = useCallback(d => setDays(d), []);
  const handleFilterClear = useCallback(() => setFilterGroup('all'), []);
  const handleToggleFilter = useCallback(group => {
    setFilterGroup(prev => prev === group ? 'all' : group);
  }, []);

  /* ── Tile handlers — stable closures */
  const onCriticalClick = useCallback(() => handleToggleFilter('critical'), [handleToggleFilter]);
  const onUrgentClick   = useCallback(() => handleToggleFilter('urgent'),   [handleToggleFilter]);
  const onNormalClick   = useCallback(() => handleToggleFilter('normal'),   [handleToggleFilter]);

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div
      data-theme="pharmacy"
      className="min-h-screen bg-base-200 px-4 pt-6 pb-12 md:px-6"
    >
      <div className="max-w-[960px] mx-auto">

        {/* ── HEADER ─────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}
          className="mb-7"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* title block */}
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-9 h-9 rounded-[10px] bg-warning/15 flex items-center justify-center">
                  <Clock size={17} className="text-warning" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-base-content font-montserrat">
                  Expiry <span className="text-warning">Alerts</span>
                </h1>
              </div>
              <p className="text-[13px] text-base-content/50 ml-[46px]" aria-live="polite">
                {expiryAlertsMeta.count} medicine{expiryAlertsMeta.count !== 1 ? 's' : ''} expiring within {expiryAlertsMeta.alertDays} days
              </p>
            </div>

            {/* controls */}
            <div className="flex items-center gap-2.5 flex-wrap" role="group" aria-label="Alert controls">
              {/* day selector */}
              <div
                className="flex items-center gap-0.5 bg-base-100 border border-base-300 rounded-[10px] p-1"
                role="group"
                aria-label="Alert window"
              >
                {DAY_OPTIONS.map(d => (
                  <DayPill key={d} d={d} selected={days === d} onClick={() => handleDayChange(d)} />
                ))}
              </div>

              {/* email button */}
              <AnimatePresence mode="wait">
                {emailSent ? (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-success/12 border border-success/30 text-success text-xs font-bold"
                  >
                    <MailCheck size={13} aria-hidden="true" /> Sent!
                  </motion.div>
                ) : (
                  <motion.button
                    key="send"
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleSendEmail}
                    disabled={sendingEmail || expiryAlerts.length === 0}
                    aria-label="Email expiry report"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-primary text-primary-content text-xs font-bold
                               disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {sendingEmail
                      ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                      : <Send size={12} aria-hidden="true" />}
                    Email Report
                  </motion.button>
                )}
              </AnimatePresence>

              {/* refresh */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isLoading}
                aria-label="Refresh alerts"
                className="w-9 h-9 rounded-lg border border-base-300 bg-base-100 flex items-center justify-center text-base-content/60 hover:text-primary hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.header>

        {/* ── CRITICAL BANNER ─────────────────────────────────── */}
        <AnimatePresence>
          {!isLoading && critical > 0 && <CriticalBanner count={critical} />}
        </AnimatePresence>

        {/* ── STAT TILES ──────────────────────────────────────── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-3 gap-3 mb-5"
          role="group"
          aria-label="Filter by urgency"
        >
          {isLoading
            ? DAY_OPTIONS.slice(0, 3).map(k => <StatTileSkeleton key={k} />)
            : <>
                <motion.div variants={fadeSlide}>
                  <StatTile label="Critical ≤7d"   value={critical} colorVar="var(--error)"   icon={XCircle}       active={filterGroup === 'critical'} onClick={onCriticalClick} />
                </motion.div>
                <motion.div variants={fadeSlide}>
                  <StatTile label="Urgent 8–14d"   value={urgent}   colorVar="var(--warning)" icon={AlertTriangle} active={filterGroup === 'urgent'}   onClick={onUrgentClick} />
                </motion.div>
                <motion.div variants={fadeSlide}>
                  <StatTile label="Monitor 15–30d" value={normal}   colorVar="var(--info)"    icon={Info}          active={filterGroup === 'normal'}   onClick={onNormalClick} />
                </motion.div>
              </>
          }
        </motion.div>

        {/* ── CHART (code-split, lazy) ─────────────────────────── */}
        <AnimatePresence>
          {!isLoading && expiryAlerts.length > 0 && (
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              className="mb-5"
            >
              <Suspense fallback={<ChartSkeleton />}>
                <ExpiryChart data={timelineData} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LIST HEADER ─────────────────────────────────────── */}
        {!isLoading && expiryAlerts.length > 0 && (
          <ListHeader
            filterGroup={filterGroup}
            filteredCount={filtered.length}
            onClear={handleFilterClear}
          />
        )}

        {/* ── MAIN CONTENT ────────────────────────────────────── */}
        {isLoading ? (
          <div
            className="space-y-2.5"
            role="status"
            aria-label="Loading expiry alerts"
          >
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>

        ) : filtered.length === 0 ? (
          <EmptyState
            filterGroup={filterGroup}
            days={days}
            onReset={handleFilterClear}
          />

        ) : (
          <motion.ol
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="space-y-2.5 list-none"
            aria-label="Expiry alert items"
          >
            {filtered.map((item, i) => (
              <li key={`${item.medicineId}-${item.batchNumber}-${i}`}>
                <ExpiryCard item={item} index={i} />
              </li>
            ))}
          </motion.ol>
        )}

        {/* ── BOTTOM SUMMARY ──────────────────────────────────── */}
        {!isLoading && filtered.length > 0 && (
          <BottomSummary critical={critical} urgent={urgent} normal={normal} />
        )}

      </div>
    </div>
  );
}