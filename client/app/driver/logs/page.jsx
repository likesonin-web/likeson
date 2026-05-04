'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Activity,
  Filter,
  Search,
  X,
  ChevronDown,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bug,
  Shield,
  CreditCard,
  Bell,
  User,
  Lock,
  Globe,
  Server,
  Clock,
  CalendarDays,
  Layers,
  FileText,
  Hash,
  Wifi,
  Monitor,
  Smartphone,
  Laptop,
  ChevronRight,
  SlidersHorizontal,
  LayoutList,
  TrendingUp,
} from 'lucide-react';
import { fetchDriverLogs } from '@/store/slices/transportPartnerSlice';

// ─── constants ────────────────────────────────────────────────────────────────

const LEVELS = ['info', 'success', 'warning', 'error', 'debug'];
const CATEGORIES = ['auth', 'user', 'security', 'payment', 'notification', 'kyc', 'system', 'api'];
const PAGE_LIMIT = 15;

// ─── maps ─────────────────────────────────────────────────────────────────────

const levelConfig = {
  info:    { icon: Info,          color: 'var(--info)',    bg: 'color-mix(in srgb, var(--info),    transparent 88%)', label: 'Info' },
  success: { icon: CheckCircle2,  color: 'var(--success)', bg: 'color-mix(in srgb, var(--success), transparent 88%)', label: 'Success' },
  warning: { icon: AlertTriangle, color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning), transparent 88%)', label: 'Warning' },
  error:   { icon: XCircle,       color: 'var(--error)',   bg: 'color-mix(in srgb, var(--error),   transparent 88%)', label: 'Error' },
  debug:   { icon: Bug,           color: 'var(--accent)',  bg: 'color-mix(in srgb, var(--accent),  transparent 88%)', label: 'Debug' },
};

const categoryConfig = {
  auth:         { icon: Lock,     label: 'Auth' },
  user:         { icon: User,     label: 'User' },
  security:     { icon: Shield,   label: 'Security' },
  payment:      { icon: CreditCard, label: 'Payment' },
  notification: { icon: Bell,     label: 'Notification' },
  kyc:          { icon: FileText, label: 'KYC' },
  system:       { icon: Server,   label: 'System' },
  api:          { icon: Globe,    label: 'API' },
};

const platformIcon = {
  android: Smartphone,
  ios:     Smartphone,
  web:     Globe,
  desktop: Laptop,
  server:  Server,
  unknown: Monitor,
};

const methodBadge = {
  GET:    { bg: 'color-mix(in srgb, var(--info),    transparent 85%)', color: 'var(--info)' },
  POST:   { bg: 'color-mix(in srgb, var(--success), transparent 85%)', color: 'var(--success)' },
  PUT:    { bg: 'color-mix(in srgb, var(--warning), transparent 85%)', color: 'var(--warning)' },
  PATCH:  { bg: 'color-mix(in srgb, var(--accent),  transparent 85%)', color: 'var(--accent)' },
  DELETE: { bg: 'color-mix(in srgb, var(--error),   transparent 85%)', color: 'var(--error)' },
};

// ─── tiny helpers ─────────────────────────────────────────────────────────────

const relTime = (date) => {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)    return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)    return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)    return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtDate = (date) =>
  date
    ? new Date(date).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

const statusColor = (code) => {
  if (!code) return 'var(--base-content)';
  if (code < 300) return 'var(--success)';
  if (code < 400) return 'var(--info)';
  if (code < 500) return 'var(--warning)';
  return 'var(--error)';
};

// ─── sub-components ───────────────────────────────────────────────────────────

const FilterChip = ({ label, active, onClick, icon: Icon }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap"
    style={{
      background: active ? 'var(--primary)' : 'var(--base-200)',
      color: active ? 'var(--primary-content)' : 'color-mix(in oklch, var(--base-content) 65%, transparent)',
      border: `1px solid ${active ? 'var(--primary)' : 'var(--base-300)'}`,
    }}
  >
    {Icon && <Icon size={11} />}
    {label}
  </button>
);

const StatBubble = ({ label, value, color }) => (
  <div
    className="flex flex-col items-center justify-center rounded-2xl p-3 flex-1 min-w-0"
    style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
  >
    <span className="font-montserrat text-xl font-black" style={{ color }}>{value}</span>
    <span className="text-xs mt-0.5 text-center leading-tight" style={{ color: 'color-mix(in oklch, var(--base-content) 48%, transparent)' }}>
      {label}
    </span>
  </div>
);

const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 text-center"
  >
    <div
      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
      style={{ background: 'color-mix(in srgb, var(--primary), transparent 90%)' }}
    >
      <LayoutList size={28} style={{ color: 'var(--primary)' }} />
    </div>
    <p className="font-montserrat text-base font-bold mb-1" style={{ color: 'var(--base-content)' }}>
      No logs found
    </p>
    <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
      Try adjusting your filters or check back later.
    </p>
  </motion.div>
);

// ─── LogCard ──────────────────────────────────────────────────────────────────

const LogCard = ({ log, index }) => {
  const [expanded, setExpanded] = useState(false);
  const lvl = levelConfig[log.level] || levelConfig.info;
  const cat = categoryConfig[log.category] || categoryConfig.system;
  const LevelIcon = lvl.icon;
  const CatIcon = cat.icon;
  const PlatIcon = platformIcon[log.actor?.platform] || Monitor;
  const method = log.request?.method;
  const mStyle = methodBadge[method] || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="card mb-3 overflow-hidden"
    >
      {/* left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ background: lvl.color }}
      />

      <button
        className="w-full text-left pl-4 pr-4 py-4"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3">
          {/* level icon */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: lvl.bg, color: lvl.color }}
          >
            <LevelIcon size={15} />
          </div>

          <div className="flex-1 min-w-0">
            {/* row 1: badges + time */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {/* category */}
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'var(--base-200)', color: 'color-mix(in oklch, var(--base-content) 60%, transparent)', border: '1px solid var(--base-300)' }}
              >
                <CatIcon size={10} /> {cat.label}
              </span>

              {/* level */}
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide"
                style={{ background: lvl.bg, color: lvl.color }}
              >
                {lvl.label}
              </span>

              {/* method */}
              {method && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold font-mono"
                  style={{ background: mStyle.bg, color: mStyle.color }}
                >
                  {method}
                </span>
              )}

              {/* status code */}
              {log.request?.statusCode && (
                <span className="text-xs font-mono font-bold" style={{ color: statusColor(log.request.statusCode) }}>
                  {log.request.statusCode}
                </span>
              )}

              <span className="ml-auto text-xs flex items-center gap-1 flex-shrink-0" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
                <Clock size={10} /> {relTime(log.createdAt)}
              </span>
            </div>

            {/* message */}
            <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--base-content)' }}>
              {log.message}
            </p>

            {/* log code */}
            <p className="text-xs mt-1 font-mono" style={{ color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>
              #{log.logCode}
            </p>
          </div>

          <ChevronDown
            size={15}
            className="flex-shrink-0 mt-1 transition-transform duration-200"
            style={{
              color: 'color-mix(in oklch, var(--base-content) 35%, transparent)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>

      {/* expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="px-4 pb-4 pt-1 space-y-3"
              style={{ borderTop: '1px solid var(--base-300)' }}
            >
              {/* grid of detail rows */}
              {[
                { label: 'Log Code',    icon: Hash,        value: log.logCode },
                { label: 'Timestamp',   icon: CalendarDays, value: fmtDate(log.createdAt) },
                { label: 'IP Address',  icon: Wifi,        value: log.actor?.ip },
                { label: 'Platform',    icon: PlatIcon,    value: log.actor?.platform },
                { label: 'Path',        icon: ChevronRight, value: log.request?.path },
                { label: 'Duration',    icon: TrendingUp,  value: log.request?.durationMs ? `${log.request.durationMs}ms` : null },
                { label: 'Environment', icon: Server,      value: log.environment },
              ]
                .filter((r) => r.value)
                .map((row) => {
                  const RowIcon = row.icon;
                  return (
                    <div key={row.label} className="flex items-start gap-2">
                      <RowIcon size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold uppercase tracking-wide block" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                          {row.label}
                        </span>
                        <span className="text-xs font-mono break-all" style={{ color: 'var(--base-content)' }}>
                          {row.value}
                        </span>
                      </div>
                    </div>
                  );
                })}

              {/* details / metadata */}
              {log.details && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                    Details
                  </p>
                  <p className="text-xs leading-relaxed break-words" style={{ color: 'var(--base-content)' }}>
                    {log.details}
                  </p>
                </div>
              )}

              {log.metadata && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                    Metadata
                  </p>
                  <pre
                    className="text-xs rounded-lg p-2 overflow-x-auto"
                    style={{ background: 'var(--base-200)', color: 'var(--base-content)', border: '1px solid var(--base-300)' }}
                  >
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* related entity */}
              {log.relatedEntity?.model && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{ background: 'color-mix(in srgb, var(--primary), transparent 92%)', border: '1px solid color-mix(in srgb, var(--primary), transparent 75%)' }}
                >
                  <Layers size={11} style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--primary)' }} className="font-semibold">{log.relatedEntity.model}</span>
                  {log.relatedEntity.label && (
                    <span style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                      — {log.relatedEntity.label}
                    </span>
                  )}
                </div>
              )}

              {/* expires */}
              {log.expiresAt && (
                <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>
                  Expires {fmtDate(log.expiresAt)}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonCard = ({ i }) => (
  <motion.div
    key={i}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: i * 0.05 }}
    className="card mb-3 p-4"
    style={{ overflow: 'hidden' }}
  >
    <div className="flex gap-3">
      <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-2/5 rounded" />
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton h-3 w-1/4 rounded" />
      </div>
    </div>
  </motion.div>
);

// ─── main page ────────────────────────────────────────────────────────────────

export default function MyLogsPage() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { driverOwnLogs, driverOwnLogsTotal, loading } = useSelector((s) => s.transportPartner);

  const [page,     setPage]     = useState(1);
  const [level,    setLevel]    = useState('');
  const [category, setCategory] = useState('');
  const [search,   setSearch]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const searchTimer = useRef(null);

  // debounce search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 420);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // fetch whenever filters / page change
  const load = useCallback(() => {
    const params = { page, limit: PAGE_LIMIT };
    if (level)           params.level    = level;
    if (category)        params.category = category;
    if (debouncedSearch) params.search   = debouncedSearch;
    dispatch(fetchDriverLogs(params));
  }, [dispatch, page, level, category, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  // reset page when filters change
  useEffect(() => { setPage(1); }, [level, category, debouncedSearch]);

  const totalPages = Math.ceil(driverOwnLogsTotal / PAGE_LIMIT);
  const hasFilters = level || category || search;

  // ── level stats from current page (rough) ────────────────────────────────
  const stats = LEVELS.reduce((acc, l) => {
    acc[l] = driverOwnLogs.filter((log) => log.level === l).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-30"
        style={{
          background: 'color-mix(in srgb, var(--base-100) 85%, transparent)',
          backdropFilter: 'blur(18px) saturate(160%)',
          borderBottom: '1px solid color-mix(in srgb, var(--base-300), transparent 30%)',
        }}
      >
        <div className="container-custom max-w-3xl mx-auto flex items-center gap-3 py-4">
          <button
            onClick={() => router.back()}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-montserrat text-lg font-black" style={{ color: 'var(--base-content)' }}>
              Activity Logs
            </h1>
            <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
              {driverOwnLogsTotal} total events
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowFilters((p) => !p)}
            className="btn btn-sm relative"
            style={{
              background: showFilters ? 'var(--primary)' : 'var(--base-200)',
              color: showFilters ? 'var(--primary-content)' : 'var(--base-content)',
              border: `1px solid ${showFilters ? 'var(--primary)' : 'var(--base-300)'}`,
            }}
          >
            <SlidersHorizontal size={14} />
            Filters
            {hasFilters && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ background: 'var(--error)', color: 'var(--error-content)' }}
              >
                {[level, category, search].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* search bar always visible */}
        <div className="container-custom max-w-3xl mx-auto pb-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
            <input
              type="text"
              className="input-field w-full pl-9 pr-9 text-sm"
              placeholder="Search message or log code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X size={13} style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
              </button>
            )}
          </div>
        </div>

        {/* filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden', borderTop: '1px solid var(--base-300)' }}
            >
              <div className="container-custom max-w-3xl mx-auto py-3 space-y-3">

                {/* level */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                    Level
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <FilterChip label="All" active={!level} onClick={() => setLevel('')} />
                    {LEVELS.map((l) => {
                      const c = levelConfig[l];
                      return (
                        <FilterChip
                          key={l}
                          label={c.label}
                          active={level === l}
                          onClick={() => setLevel(level === l ? '' : l)}
                          icon={c.icon}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* category */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                    Category
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <FilterChip label="All" active={!category} onClick={() => setCategory('')} />
                    {CATEGORIES.map((c) => {
                      const conf = categoryConfig[c];
                      return (
                        <FilterChip
                          key={c}
                          label={conf.label}
                          active={category === c}
                          onClick={() => setCategory(category === c ? '' : c)}
                          icon={conf.icon}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* clear all */}
                {hasFilters && (
                  <button
                    className="btn btn-ghost btn-xs flex items-center gap-1"
                    onClick={() => { setLevel(''); setCategory(''); setSearch(''); }}
                  >
                    <X size={11} /> Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="container-custom max-w-3xl mx-auto px-4 py-5">

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="flex gap-3 mb-5"
        >
          <StatBubble label="Total" value={driverOwnLogsTotal} color="var(--primary)" />
          <StatBubble label="Success" value={stats.success} color="var(--success)" />
          <StatBubble label="Warning" value={stats.warning} color="var(--warning)" />
          <StatBubble label="Error" value={stats.error} color="var(--error)" />
        </motion.div>

        {/* active filter pills summary */}
        {hasFilters && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 flex-wrap mb-4"
          >
            <Activity size={12} style={{ color: 'var(--primary)' }} />
            <span className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
              Filtering by:
            </span>
            {level && (
              <span className="badge badge-primary badge-xs">{level}</span>
            )}
            {category && (
              <span className="badge badge-info badge-xs">{category}</span>
            )}
            {debouncedSearch && (
              <span className="badge badge-xs" style={{ background: 'color-mix(in srgb, var(--accent), transparent 85%)', color: 'var(--accent)' }}>
                "{debouncedSearch}"
              </span>
            )}
          </motion.div>
        )}

        {/* ── Log list ───────────────────────────────────────────────────── */}
        {loading && driverOwnLogs.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} i={i} />)
        ) : driverOwnLogs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {driverOwnLogs.map((log, i) => (
              <LogCard key={log._id || log.logCode} log={log} index={i} />
            ))}

            {/* loading overlay when paginating */}
            {loading && driverOwnLogs.length > 0 && (
              <div className="flex justify-center py-4">
                <div className="loading loading-spinner loading-md" style={{ borderTopColor: 'var(--primary)' }} />
              </div>
            )}
          </>
        )}

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between mt-6 pt-4"
            style={{ borderTop: '1px solid var(--base-300)' }}
          >
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="btn btn-outline btn-sm"
            >
              ← Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                const active = p === page;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    disabled={loading}
                    className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: active ? 'var(--primary)' : 'var(--base-200)',
                      color: active ? 'var(--primary-content)' : 'var(--base-content)',
                      border: `1px solid ${active ? 'var(--primary)' : 'var(--base-300)'}`,
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 7 && (
                <span className="text-xs px-1" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
                  …{totalPages}
                </span>
              )}
            </div>

            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="btn btn-outline btn-sm"
            >
              Next →
            </button>
          </motion.div>
        )}

        {/* bottom info */}
        <p className="text-center text-xs mt-6" style={{ color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>
          Logs auto-expire after 90 days · Sensitive data never shown
        </p>
      </div>
    </div>
  );
}