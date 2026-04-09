'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, Info, XCircle, Bug,
  ShieldAlert, User, CreditCard, Bell, FileKey,
  Settings, Globe, Clock, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { fetchTPLogs } from '@/store/slices/transportPartnerSlice';

// ── Mock logs (replace with Redux) ────────────────────────────────────────
const MOCK_LOGS = Array.from({ length: 28 }, (_, i) => ({
  _id: `log_${i}`,
  logCode: `LOG-20250327-${String(i + 1).padStart(4, '0')}`,
  level: ['info', 'success', 'warning', 'error', 'debug'][i % 5],
  category: ['user', 'kyc', 'security', 'payment', 'system', 'auth', 'api', 'notification'][i % 8],
  message: [
    'Transport partner profile updated successfully',
    'KYC documents submitted for owner verification',
    'Session revoked by user from unknown device',
    'Vehicle GJ05AB1234 added to fleet',
    'Driver Ravi Kumar registered under agency',
    'Bank account added and set as primary',
    'Settlement of ₹18,500 processed by admin',
    'Platform fee override applied: 12% percentage',
    'Service zone added: Vijayawada, Andhra Pradesh',
    'Pricing configuration updated by partner',
    'Driver status changed to On-Trip',
    'Vehicle verification approved: MH12CD5678',
    'Driver KYC rejected: invalid Aadhaar document',
    'Admin notes saved for partner account',
    'Password changed successfully',
  ][i % 15],
  actor: {
    name: ['Sanjay Reddy', 'System', 'Admin Kumar', 'Ravi Singh'][i % 4],
    role: ['transportpartner', 'system', 'admin', 'driver'][i % 4],
    ip: `192.168.${Math.floor(i / 8)}.${(i * 7) % 255}`,
  },
  request: {
    method: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'][i % 5],
    path: ['/api/transport/profile', '/api/transport/kyc', '/api/transport/vehicles', '/api/transport/drivers', '/api/transport/bank'][i % 5],
    statusCode: [200, 201, 400, 404, 500][i % 5],
  },
  metadata: i % 3 === 0 ? { updatedFields: ['businessName', 'ownerPhone'] } : null,
  ageHuman: [`${i + 1}m ago`, `${i + 2}h ago`, `${i + 1}d ago`][i % 3],
  createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
}));

// ── Constants ─────────────────────────────────────────────────────────────
const LEVELS = ['info', 'success', 'warning', 'error', 'debug'];
const CATEGORIES = ['auth', 'user', 'security', 'payment', 'notification', 'kyc', 'system', 'api'];
const PAGE_SIZE = 10;

// ── Level config ──────────────────────────────────────────────────────────
const levelConfig = {
  info:    { icon: Info,          color: 'var(--info)',    bg: 'color-mix(in srgb, var(--info), transparent 85%)',    label: 'Info' },
  success: { icon: CheckCircle2,  color: 'var(--success)', bg: 'color-mix(in srgb, var(--success), transparent 85%)', label: 'Success' },
  warning: { icon: AlertTriangle, color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning), transparent 85%)', label: 'Warning' },
  error:   { icon: XCircle,       color: 'var(--error)',   bg: 'color-mix(in srgb, var(--error), transparent 85%)',   label: 'Error' },
  debug:   { icon: Bug,           color: 'var(--neutral)', bg: 'color-mix(in srgb, var(--neutral), transparent 85%)', label: 'Debug' },
};

// ── Category config ───────────────────────────────────────────────────────
const categoryConfig = {
  auth:         { icon: ShieldAlert, label: 'Auth' },
  user:         { icon: User,        label: 'User' },
  security:     { icon: ShieldAlert, label: 'Security' },
  payment:      { icon: CreditCard,  label: 'Payment' },
  notification: { icon: Bell,        label: 'Notification' },
  kyc:          { icon: FileKey,     label: 'KYC' },
  system:       { icon: Settings,    label: 'System' },
  api:          { icon: Globe,       label: 'API' },
};

// ── Method Badge ──────────────────────────────────────────────────────────
const methodColors = {
  GET:    { bg: 'color-mix(in srgb, var(--info), transparent 82%)',    text: 'var(--info)' },
  POST:   { bg: 'color-mix(in srgb, var(--success), transparent 82%)', text: 'var(--success)' },
  PATCH:  { bg: 'color-mix(in srgb, var(--warning), transparent 82%)', text: 'var(--warning)' },
  PUT:    { bg: 'color-mix(in srgb, var(--primary), transparent 82%)', text: 'var(--primary)' },
  DELETE: { bg: 'color-mix(in srgb, var(--error), transparent 82%)',   text: 'var(--error)' },
};

function MethodBadge({ method }) {
  const c = methodColors[method] || methodColors.GET;
  return (
    <span
      className="text-xs font-black tracking-wider px-2 py-0.5 rounded-md font-montserrat"
      style={{ background: c.bg, color: c.text }}
    >
      {method}
    </span>
  );
}

// ── Status Code Badge ─────────────────────────────────────────────────────
function StatusBadge({ code }) {
  const color = code >= 500 ? 'var(--error)'
    : code >= 400 ? 'var(--warning)'
    : code >= 300 ? 'var(--info)'
    : 'var(--success)';
  return (
    <span className="text-xs font-bold tabular-nums" style={{ color }}>
      {code}
    </span>
  );
}

// ── Log Row ───────────────────────────────────────────────────────────────
function LogRow({ log, index }) {
  const [expanded, setExpanded] = useState(false);
  const lc = levelConfig[log.level] || levelConfig.info;
  const cc = categoryConfig[log.category] || categoryConfig.system;
  const LevelIcon = lc.icon;
  const CatIcon = cc.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card overflow-hidden"
      style={{ borderLeft: `3px solid ${lc.color}` }}
    >
      {/* Main Row */}
      <button
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-base-200/40 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Level Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: lc.bg }}
        >
          <LevelIcon size={15} style={{ color: lc.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
              {log.logCode}
            </span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: lc.bg, color: lc.color }}
            >
              {lc.label}
            </span>
            <div className="flex items-center gap-1">
              <CatIcon size={11} style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }} />
              <span className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{cc.label}</span>
            </div>
          </div>
          <p className="text-sm font-semibold leading-snug mb-1.5" style={{ color: 'var(--base-content)' }}>
            {log.message}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            <div className="flex items-center gap-1">
              <User size={10} />
              <span>{log.actor?.name}</span>
              <span className="opacity-60">({log.actor?.role})</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={10} />
              <span>{log.ageHuman}</span>
            </div>
            {log.request?.method && <MethodBadge method={log.request.method} />}
            {log.request?.statusCode && <StatusBadge code={log.request.statusCode} />}
          </div>
        </div>

        {/* Expand Toggle */}
        <div className="flex-shrink-0 ml-auto">
          {expanded
            ? <ChevronUp size={16} style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
            : <ChevronDown size={16} style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
          }
        </div>
      </button>

      {/* Expanded Detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3"
              style={{ borderTop: '1px solid color-mix(in srgb, var(--base-300), transparent 40%)' }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2 mt-3" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>Request</p>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Path:</span>
                    <code className="font-mono" style={{ color: 'var(--primary)' }}>{log.request?.path}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Status:</span>
                    <StatusBadge code={log.request?.statusCode} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>IP:</span>
                    <span className="font-mono" style={{ color: 'var(--base-content)' }}>{log.actor?.ip}</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2 mt-3" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>Context</p>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Timestamp:</span>
                    <span className="font-mono" style={{ color: 'var(--base-content)' }}>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  {log.metadata && (
                    <div>
                      <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Metadata:</span>
                      <pre
                        className="mt-1 p-2 rounded-lg text-xs font-mono overflow-x-auto"
                        style={{ background: 'color-mix(in srgb, var(--base-200), transparent 40%)', color: 'var(--base-content)' }}
                      >
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Filter Pill ───────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border"
      style={active
        ? { background: color || 'var(--primary)', color: 'var(--primary-content)', borderColor: color || 'var(--primary)' }
        : { background: 'transparent', color: 'color-mix(in oklch, var(--base-content) 60%, transparent)', borderColor: 'color-mix(in srgb, var(--base-300), transparent 20%)' }
      }
    >
      {label}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function TransportPartnerLogs() {
  const dispatch = useDispatch();
  const { tpLogs, loading } = useSelector((s) => s.transportPartner);

  const [search, setSearch]     = useState('');
  const [level, setLevel]       = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage]         = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(() => {
    dispatch(fetchTPLogs({ page, limit: PAGE_SIZE, level: level || undefined, category: category || undefined }));
  }, [dispatch, page, level, category]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Use real logs or mocks
  const allLogs = (tpLogs?.length ? tpLogs : MOCK_LOGS);

  const filtered = allLogs.filter((l) => {
    const matchSearch = !search || l.message?.toLowerCase().includes(search.toLowerCase()) || l.logCode?.includes(search.toUpperCase());
    const matchLevel  = !level    || l.level    === level;
    const matchCat    = !category || l.category === category;
    return matchSearch && matchLevel && matchCat;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const levelCounts = LEVELS.reduce((acc, lv) => {
    acc[lv] = allLogs.filter((l) => l.level === lv).length;
    return acc;
  }, {});

  const clearFilters = () => { setSearch(''); setLevel(''); setCategory(''); setPage(1); };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8" style={{ background: 'var(--base-100)' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <h1 className="font-montserrat font-black text-3xl md:text-4xl mb-1" style={{ color: 'var(--base-content)' }}>
          Activity Logs
        </h1>
        <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
          Audit trail for all actions on your transport partner account
        </p>
      </motion.div>

      {/* Summary Chips */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap gap-3 mb-6"
      >
        {LEVELS.map((lv) => {
          const lc = levelConfig[lv];
          const LevelIcon = lc.icon;
          return (
            <div
              key={lv}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: lc.bg, color: lc.color, border: `1px solid color-mix(in srgb, ${lc.color}, transparent 65%)` }}
            >
              <LevelIcon size={13} />
              <span>{lc.label}</span>
              <span className="font-black">{levelCounts[lv]}</span>
            </div>
          );
        })}
        <div className="ml-auto flex items-center">
          <span className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            {filtered.length} total logs
          </span>
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="glass-card p-4 mb-5"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
            <input
              type="text"
              placeholder="Search by message or log code…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field w-full pl-9"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters((p) => !p)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border"
            style={{
              background: showFilters ? 'color-mix(in srgb, var(--primary), transparent 88%)' : 'transparent',
              color: showFilters ? 'var(--primary)' : 'color-mix(in oklch, var(--base-content) 60%, transparent)',
              borderColor: showFilters ? 'color-mix(in srgb, var(--primary), transparent 65%)' : 'color-mix(in srgb, var(--base-300), transparent 20%)',
            }}
          >
            <Filter size={14} />
            Filters
            {(level || category) && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--primary)' }} />
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border"
            style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)', borderColor: 'color-mix(in srgb, var(--base-300), transparent 20%)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Clear */}
          {(search || level || category) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'color-mix(in srgb, var(--error), transparent 88%)', color: 'var(--error)' }}
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--base-300), transparent 40%)' }}>
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Level</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterPill label="All" active={!level} onClick={() => { setLevel(''); setPage(1); }} />
                    {LEVELS.map((lv) => (
                      <FilterPill
                        key={lv}
                        label={levelConfig[lv].label}
                        active={level === lv}
                        color={levelConfig[lv].color}
                        onClick={() => { setLevel(lv === level ? '' : lv); setPage(1); }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Category</p>
                  <div className="flex flex-wrap gap-2">
                    <FilterPill label="All" active={!category} onClick={() => { setCategory(''); setPage(1); }} />
                    {CATEGORIES.map((c) => (
                      <FilterPill
                        key={c}
                        label={categoryConfig[c]?.label || c}
                        active={category === c}
                        onClick={() => { setCategory(c === category ? '' : c); setPage(1); }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Log List */}
      <div className="flex flex-col gap-3 mb-6">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass-card p-4 h-20 skeleton" />
              ))}
            </motion.div>
          ) : paginated.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card p-12 text-center"
            >
              <Info size={36} className="mx-auto mb-3" style={{ color: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }} />
              <p className="font-montserrat font-black text-lg mb-1" style={{ color: 'var(--base-content)' }}>No logs found</p>
              <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Try adjusting your filters or search query</p>
            </motion.div>
          ) : (
            <motion.div key={`${page}-${level}-${category}-${search}`} className="flex flex-col gap-3">
              {paginated.map((log, i) => (
                <LogRow key={log._id || log.logCode} log={log} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between"
        >
          <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            Page {page} of {totalPages} · {filtered.length} results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 border"
              style={{ borderColor: 'color-mix(in srgb, var(--base-300), transparent 20%)', color: 'var(--base-content)' }}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = i + 1;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all"
                  style={pg === page
                    ? { background: 'var(--primary)', color: 'var(--primary-content)' }
                    : { color: 'color-mix(in oklch, var(--base-content) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--base-300), transparent 20%)' }
                  }
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 border"
              style={{ borderColor: 'color-mix(in srgb, var(--base-300), transparent 20%)', color: 'var(--base-content)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}