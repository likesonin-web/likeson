'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  adminFetchComplianceAlerts,
  adminFetchPartnerDetail,
  selectAdminComplianceAlerts,
  selectAdminComplianceTotal,
  selectAdminSelectedPartner,
  selectLoading,
  selectError,
} from '@/store/slices/soloDriverSlice';
import {
  Bell,
  BellRing,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ShieldX,
  AlertTriangle,
  Phone,
  Mail,
  User,
  BadgeCheck,
  CalendarX2,
  Flame,
  X,
  Car,
  Stethoscope,
  IdCard,
  CreditCard,
  Leaf,
  Wrench,
  Ticket,
  ExternalLink,
  Filter,
} from 'lucide-react';

/* ─── animation ──────────────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

/* ─── doc icon map ────────────────────────────────────────────────────────── */
const DOC_ICON = {
  'DL Expiry':       IdCard,
  'PSV Badge':       CreditCard,
  'Medical Fitness': Stethoscope,
  'Insurance':       Car,
  'Pollution Cert':  Leaf,
  'Fitness Cert':    Wrench,
  'Permit':          Ticket,
};

/* ─── severity helpers ────────────────────────────────────────────────────── */
const getSeverityForPartner = (expiringDocs = []) => {
  if (expiringDocs.some(d => d.isExpired))          return 'critical';
  if (expiringDocs.some(d => (d.daysLeft ?? 99) <= 7))  return 'urgent';
  if (expiringDocs.some(d => (d.daysLeft ?? 99) <= 14)) return 'high';
  return 'medium';
};

const SEVERITY_CFG = {
  critical: {
    label: 'Critical',
    Icon:  ShieldX,
    color: 'var(--error)',
    bg:    'color-mix(in srgb, var(--error),   transparent 88%)',
    border:'color-mix(in srgb, var(--error),   transparent 62%)',
    dot:   'var(--error)',
  },
  urgent: {
    label: 'Urgent',
    Icon:  Flame,
    color: '#f97316',
    bg:    'color-mix(in srgb, #f97316, transparent 88%)',
    border:'color-mix(in srgb, #f97316, transparent 62%)',
    dot:   '#f97316',
  },
  high: {
    label: 'High',
    Icon:  AlertTriangle,
    color: 'var(--warning)',
    bg:    'color-mix(in srgb, var(--warning), transparent 88%)',
    border:'color-mix(in srgb, var(--warning), transparent 62%)',
    dot:   'var(--warning)',
  },
  medium: {
    label: 'Medium',
    Icon:  Bell,
    color: 'var(--info)',
    bg:    'color-mix(in srgb, var(--info),    transparent 88%)',
    border:'color-mix(in srgb, var(--info),    transparent 62%)',
    dot:   'var(--info)',
  },
};

const DOC_STATUS_CFG = {
  expired:  { color: 'var(--error)',   bg: 'color-mix(in srgb, var(--error),   transparent 88%)', label: 'Expired' },
  expiring: { color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning), transparent 88%)', label: 'Expiring' },
};

/* ─── filter options ──────────────────────────────────────────────────────── */
const DAY_FILTERS = [
  { label: '7 days',  value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
];

/* ─── tiny doc chip ───────────────────────────────────────────────────────── */
function DocChip({ doc }) {
  const Icon = DOC_ICON[doc.label] || IdCard;
  const cfg  = doc.isExpired ? DOC_STATUS_CFG.expired : DOC_STATUS_CFG.expiring;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
      title={`${doc.label}: ${doc.isExpired ? 'Expired' : `${doc.daysLeft}d left`}`}
    >
      <Icon size={11} />
      {doc.label}
      {!doc.isExpired && <span className="font-bold">·{doc.daysLeft}d</span>}
    </span>
  );
}

/* ─── Detail Drawer ───────────────────────────────────────────────────────── */
function DetailDrawer({ partner, onClose }) {
  if (!partner) return null;

  /* The selectedPartner from adminFetchPartnerDetail has the full shape */
  const docs = [
    { label: 'DL Expiry',       expiry: partner.kyc?.drivingLicenceExpiry },
    { label: 'PSV Badge',       expiry: partner.kyc?.psvBadgeExpiry },
    { label: 'Medical Fitness', expiry: partner.medicalFitness?.expiryDate },
    { label: 'Insurance',       expiry: partner.vehicle?.insuranceExpiry },
    { label: 'Pollution Cert',  expiry: partner.vehicle?.pollutionCertExpiry },
    { label: 'Fitness Cert',    expiry: partner.vehicle?.fitnessCertExpiry },
    { label: 'Permit',          expiry: partner.vehicle?.permitExpiry },
  ].map(d => {
    const now   = new Date();
    const exp   = d.expiry ? new Date(d.expiry) : null;
    const days  = exp ? Math.ceil((exp - now) / 86_400_000) : null;
    const status = !exp ? 'missing'
                 : days < 0  ? 'expired'
                 : days <= 30 ? 'expiring'
                 : 'valid';
    return { ...d, exp, days, status };
  });

  const statusColor = {
    expired:  'var(--error)',
    expiring: 'var(--warning)',
    valid:    'var(--success)',
    missing:  'var(--neutral)',
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex justify-end"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.aside
          key="drawer"
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-sm h-full overflow-y-auto flex flex-col"
          style={{ background: 'var(--base-100)', borderLeft: '1px solid var(--base-300)' }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b"
            style={{ background: 'var(--base-100)', borderColor: 'var(--base-300)' }}>
            <div>
              <h3 className="font-black text-base"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                {partner.legalName}
              </h3>
              <p className="text-xs font-mono" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                {partner.partnerCode}
              </p>
            </div>
            <button onClick={onClose}
              className="p-2 rounded-xl hover:bg-base-200 transition-colors">
              <X size={18} style={{ color: 'var(--base-content)' }} />
            </button>
          </div>

          {/* Contact */}
          <div className="p-5 space-y-3 border-b" style={{ borderColor: 'var(--base-300)' }}>
            {partner.phone && (
              <a href={`tel:${partner.phone}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 transition-colors no-underline">
                <Phone size={14} style={{ color: 'var(--primary)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>
                  {partner.phone}
                </span>
              </a>
            )}
            {partner.email && (
              <a href={`mailto:${partner.email}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 transition-colors no-underline">
                <Mail size={14} style={{ color: 'var(--primary)' }} />
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--base-content)' }}>
                  {partner.email}
                </span>
              </a>
            )}
          </div>

          {/* Document timeline */}
          <div className="p-5 flex-1">
            <h4 className="text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: 'color-mix(in oklch, var(--base-content) 48%, transparent)' }}>
              Document Status
            </h4>
            <div className="space-y-3">
              {docs.map(d => {
                const Icon = DOC_ICON[d.label] || IdCard;
                const col  = statusColor[d.status];
                return (
                  <div key={d.label}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `color-mix(in srgb, ${col}, transparent 82%)` }}>
                      <Icon size={14} style={{ color: col }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--base-content)' }}>{d.label}</p>
                      <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                        {d.status === 'missing' ? 'Not submitted'
                         : d.exp ? d.exp.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                         : '—'}
                      </p>
                    </div>
                    <span className="text-xs font-bold shrink-0" style={{ color: col }}>
                      {d.status === 'missing'  ? 'Missing'
                       : d.status === 'expired' ? `Exp.`
                       : d.days != null         ? `${d.days}d`
                       : 'Valid'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer CTA */}
          <div className="p-5 border-t" style={{ borderColor: 'var(--base-300)' }}>
            <a
              href={`/admin/solo-drivers/${partner._id}`}
              className="btn-primary-cta w-full flex items-center justify-center gap-2 text-sm"
            >
              <ExternalLink size={14} />
              Open Full Profile
            </a>
          </div>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Partner alert row card ──────────────────────────────────────────────── */
function PartnerAlertCard({ partner, index, onExpand, expanded, onViewDetail }) {
  /* partner shape from admin/compliance-alerts:
     { legalName, partnerCode, phone, email, user, expiringDocs: [{ label, date, daysLeft, isExpired }] }
  */
  const severity     = getSeverityForPartner(partner.expiringDocs);
  const cfg          = SEVERITY_CFG[severity];
  const SeverityIcon = cfg.Icon;

  const expiredDocs  = partner.expiringDocs.filter(d => d.isExpired);
  const soonDocs     = partner.expiringDocs.filter(d => !d.isExpired);

  return (
    <motion.div
      variants={fadeUp} custom={index}
      className="rounded-2xl overflow-hidden"
      style={{ border: `1.5px solid ${cfg.border}`, background: 'var(--base-100)' }}
    >
      {/* Card header row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-base-200 transition-colors"
        onClick={onExpand}
      >
        {/* severity dot + icon */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: cfg.bg }}>
            <SeverityIcon size={19} style={{ color: cfg.color }} />
          </div>
          {/* pulsing ring for critical */}
          {severity === 'critical' && (
            <span className="absolute inset-0 rounded-xl animate-ping opacity-30"
              style={{ background: cfg.color }} />
          )}
        </div>

        {/* identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm truncate" style={{ color: 'var(--base-content)' }}>
              {partner.legalName}
            </p>
            <span className="badge badge-primary text-xs">{partner.partnerCode}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {partner.phone && (
              <span className="flex items-center gap-1 text-xs"
                style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                <Phone size={10} /> {partner.phone}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* doc count */}
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-lg font-black" style={{ color: cfg.color, fontFamily: 'var(--font-display)' }}>
            {partner.expiringDocs.length}
          </p>
          <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
            doc{partner.expiringDocs.length !== 1 ? 's' : ''}
          </p>
        </div>

        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.22 }}>
          <ChevronRight size={16} style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
        </motion.div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--base-300)' }}>

              {/* Expired docs */}
              {expiredDocs.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--error)' }}>
                    ● Expired
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {expiredDocs.map(d => <DocChip key={d.label} doc={d} />)}
                  </div>
                </div>
              )}

              {/* Expiring docs */}
              {soonDocs.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--warning)' }}>
                    ◐ Expiring Soon
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {soonDocs.map(d => <DocChip key={d.label} doc={d} />)}
                  </div>
                </div>
              )}

              {/* Quickest expiry timeline */}
              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--base-300)' }}>
                {partner.expiringDocs
                  .slice()
                  .sort((a, b) => (a.isExpired ? -1 : b.isExpired ? 1 : (a.daysLeft ?? 0) - (b.daysLeft ?? 0)))
                  .map((d, i) => {
                    const Icon = DOC_ICON[d.label] || IdCard;
                    const dStatus = d.isExpired ? DOC_STATUS_CFG.expired : DOC_STATUS_CFG.expiring;
                    const dateStr = d.date
                      ? new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                      : '—';
                    return (
                      <div key={d.label}
                        className="flex items-center gap-3 py-2 border-b last:border-0"
                        style={{ borderColor: 'var(--base-300)' }}>
                        <Icon size={13} style={{ color: dStatus.color }} />
                        <span className="text-xs flex-1" style={{ color: 'var(--base-content)' }}>{d.label}</span>
                        <span className="text-xs font-mono" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                          {dateStr}
                        </span>
                        <span className="text-xs font-bold" style={{ color: dStatus.color }}>
                          {d.isExpired ? 'EXPIRED' : `${d.daysLeft}d`}
                        </span>
                      </div>
                    );
                  })
                }
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => onViewDetail(partner._id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: 'color-mix(in srgb, var(--primary), transparent 88%)',
                    color: 'var(--primary)',
                    border: '1px solid color-mix(in srgb, var(--primary), transparent 65%)',
                  }}
                >
                  <User size={13} /> View Profile
                </button>
                {partner.phone && (
                  <a
                    href={`tel:${partner.phone}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all no-underline"
                    style={{
                      background: 'color-mix(in srgb, var(--success), transparent 88%)',
                      color: 'var(--success)',
                      border: '1px solid color-mix(in srgb, var(--success), transparent 65%)',
                    }}
                  >
                    <Phone size={13} /> Call Partner
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── skeleton ────────────────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton h-20 rounded-2xl" />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PAGE                                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function ExpiryAlerts() {
  const dispatch = useDispatch();

  /* ── redux real data ────────────────────────────────────────────────────── */
  const alerts         = useSelector(selectAdminComplianceAlerts);   // real API data
  const total          = useSelector(selectAdminComplianceTotal);
  const selectedPartner = useSelector(selectAdminSelectedPartner);
  const loading        = useSelector(selectLoading('adminComplianceAlerts'));
  const detailLoading  = useSelector(selectLoading('adminDetail'));
  const error          = useSelector(selectError('adminComplianceAlerts'));

  /* ── local UI state ─────────────────────────────────────────────────────── */
  const [days,       setDays]       = useState(30);
  const [search,     setSearch]     = useState('');
  const [expanded,   setExpanded]   = useState(null);
  const [sevFilter,  setSevFilter]  = useState('all');
  const [showDrawer, setShowDrawer] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  /* ── fetch on mount / days change ──────────────────────────────────────── */
  const load = useCallback(() => {
    dispatch(adminFetchComplianceAlerts({ days }));
  }, [dispatch, days]);

  useEffect(() => { load(); }, [load]);

  /* ── derived lists ──────────────────────────────────────────────────────── */
  const withSeverity = alerts.map(p => ({
    ...p,
    _severity: getSeverityForPartner(p.expiringDocs),
  }));

  const filtered = withSeverity
    .filter(p => {
      if (sevFilter !== 'all' && p._severity !== sevFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.legalName?.toLowerCase().includes(q)   ||
        p.partnerCode?.toLowerCase().includes(q) ||
        p.phone?.includes(q)                      ||
        p.email?.toLowerCase().includes(q)
      );
    })
    /* sort: critical → urgent → high → medium */
    .sort((a, b) => {
      const order = { critical: 0, urgent: 1, high: 2, medium: 3 };
      return (order[a._severity] ?? 9) - (order[b._severity] ?? 9);
    });

  /* severity counts (from real data) */
  const severityCounts = withSeverity.reduce((acc, p) => {
    acc[p._severity] = (acc[p._severity] || 0) + 1;
    return acc;
  }, {});

  /* ── view detail handler ────────────────────────────────────────────────── */
  const handleViewDetail = (partnerId) => {
    dispatch(adminFetchPartnerDetail(partnerId));
    setShowDrawer(true);
  };

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--error), transparent 85%)' }}>
                <BellRing size={20} style={{ color: 'var(--error)' }} />
              </div>
              {total > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-black text-white"
                  style={{ background: 'var(--error)' }}>
                  {total > 99 ? '99+' : total}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                Expiry Alerts
              </h1>
              <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                {total} partner{total !== 1 ? 's' : ''} with documents expiring within {days} days
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={load} aria-label="Refresh"
              className="p-2.5 rounded-xl transition-all hover:bg-base-200"
              style={{ border: '1px solid var(--base-300)' }}>
              <RefreshCw size={15}
                className={loading ? 'animate-spin' : ''}
                style={{ color: 'var(--base-content)' }}
              />
            </button>
            <button onClick={() => setShowFilter(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: showFilter ? 'var(--primary)' : 'var(--base-200)',
                color: showFilter ? 'var(--primary-content)' : 'var(--base-content)',
                border: '1px solid var(--base-300)',
              }}>
              <SlidersHorizontal size={13} />
              Filter
              <ChevronDown size={12}
                style={{ transform: showFilter ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
          </div>
        </motion.div>

        {/* ── Filter panel ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
              className="overflow-hidden mb-4"
            >
              <div className="card p-4 space-y-4">
                {/* Days window */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                    Alert Window
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {DAY_FILTERS.map(f => (
                      <button key={f.value} onClick={() => setDays(f.value)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: days === f.value ? 'var(--primary)' : 'var(--base-200)',
                          color: days === f.value ? 'var(--primary-content)' : 'var(--base-content)',
                          border: `1px solid ${days === f.value ? 'var(--primary)' : 'var(--base-300)'}`,
                        }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Severity filter */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                    Severity
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {['all', 'critical', 'urgent', 'high', 'medium'].map(s => {
                      const cfg = s === 'all' ? null : SEVERITY_CFG[s];
                      return (
                        <button key={s} onClick={() => setSevFilter(s)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize"
                          style={{
                            background: sevFilter === s ? (cfg?.color ?? 'var(--primary)') : 'var(--base-200)',
                            color: sevFilter === s ? 'white' : 'var(--base-content)',
                            border: `1px solid ${sevFilter === s ? (cfg?.color ?? 'var(--primary)') : 'var(--base-300)'}`,
                          }}>
                          {s} {s !== 'all' && severityCounts[s] ? `(${severityCounts[s]})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Severity summary row ──────────────────────────────────────────── */}
        {!loading && alerts.length > 0 && (
          <motion.div
            variants={stagger} initial="hidden" animate="show"
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          >
            {(['critical', 'urgent', 'high', 'medium']).map(s => {
              const cfg  = SEVERITY_CFG[s];
              const Icon = cfg.Icon;
              const cnt  = severityCounts[s] || 0;
              return (
                <motion.button
                  key={s} variants={fadeUp}
                  onClick={() => setSevFilter(sevFilter === s ? 'all' : s)}
                  className="flex items-center gap-2.5 p-3 rounded-xl transition-all text-left"
                  style={{
                    background: sevFilter === s ? cfg.bg : 'var(--base-200)',
                    border: `1.5px solid ${sevFilter === s ? cfg.border : 'var(--base-300)'}`,
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon size={16} style={{ color: cfg.color }} />
                  <div>
                    <p className="text-lg font-black leading-none"
                      style={{ fontFamily: 'var(--font-display)', color: cfg.color }}>
                      {cnt}
                    </p>
                    <p className="text-xs capitalize font-medium"
                      style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                      {s}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}

        {/* ── Search ───────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="relative mb-6"
        >
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, partner code, phone…"
            className="input-field w-full pl-10 pr-4"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-base-300 transition-colors">
              <X size={13} style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
            </button>
          )}
        </motion.div>

        {/* ── Error ────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="alert alert-error mb-6">
              <ShieldX size={15} />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && <Skeleton />}

        {/* ── Results count ────────────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-xs mb-4 font-semibold"
            style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}
          >
            Showing {filtered.length} of {total} partner{total !== 1 ? 's' : ''}
            {sevFilter !== 'all' && ` · ${sevFilter} only`}
            {search && ` · matching "${search}"`}
          </motion.p>
        )}

        {/* ── Alert cards ──────────────────────────────────────────────────── */}
        {!loading && (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
            {filtered.map((partner, i) => (
              <PartnerAlertCard
                key={partner._id}
                partner={partner}
                index={i}
                expanded={expanded === partner._id}
                onExpand={() => setExpanded(prev => prev === partner._id ? null : partner._id)}
                onViewDetail={handleViewDetail}
              />
            ))}
          </motion.div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!loading && filtered.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--success), transparent 85%)' }}>
              <BadgeCheck size={32} style={{ color: 'var(--success)' }} />
            </div>
            <div className="text-center">
              <p className="font-black text-lg mb-1"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                {search || sevFilter !== 'all' ? 'No matches found' : 'All Clear!'}
              </p>
              <p className="text-sm"
                style={{ color: 'color-mix(in oklch, var(--base-content) 48%, transparent)' }}>
                {search || sevFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : `No partners have documents expiring within ${days} days.`}
              </p>
            </div>
            {(search || sevFilter !== 'all') && (
              <button onClick={() => { setSearch(''); setSevFilter('all'); }}
                className="btn-secondary px-6 py-2 text-sm">
                Clear Filters
              </button>
            )}
          </motion.div>
        )}

      </div>

      {/* ── Detail Drawer ────────────────────────────────────────────────────── */}
      {showDrawer && (
        <DetailDrawer
          partner={selectedPartner}
          onClose={() => setShowDrawer(false)}
        />
      )}
    </div>
  );
}