'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Megaphone, Plus, Search, ToggleLeft, ToggleRight,
  Trash2, Archive, ArchiveRestore, Edit3, Eye, X,
  RefreshCw, BarChart3, MousePointerClick,
  AlertCircle, CheckCircle2, Info, AlertTriangle, Tag,
  Clock, Shield, Zap, Globe, Lock, ChevronLeft,
  ChevronRight, ExternalLink, Loader2,
  RotateCcw, Activity, BellOff, SlidersHorizontal,
  EyeOff, Layers, Users, UserCheck, UserX, ChevronDown,
  Check, Search as SearchIcon,
} from 'lucide-react';

import {
  fetchAdminMarquees,
  fetchAdminMarqueeById,
  createMarquee,
  updateMarquee,
  toggleMarquee,
  archiveMarquee,
  deleteMarquee,
  clearDismissals,
  fetchMarqueeAnalytics,
  clearSelectedMarquee,
  selectAdminMarquees,
  selectAdminPagination,
  selectAdminLoading,
  selectSelectedMarquee,
  selectSelectedLoading,
  selectActionLoading,
  selectAnalytics,
  selectAnalyticsLoading,
} from '@/store/slices/marqueeSlice';

import {
  adminGetAllUsers,
} from '@/store/slices/userSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  'superadmin', 'admin', 'doctor', 'transportpartner',
  'driver', 'lab partner', 'finance', 'pharmacy', 'care assistant', 'customer',
];

const TYPE_CONFIG = {
  info:    { color: 'text-info',    bg: 'bg-info/10',    border: 'border-info/30',    icon: Info,          label: 'Info' },
  warning: { color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', icon: AlertTriangle, label: 'Warning' },
  success: { color: 'text-success', bg: 'bg-success/10', border: 'border-success/30', icon: CheckCircle2,  label: 'Success' },
  error:   { color: 'text-error',   bg: 'bg-error/10',   border: 'border-error/30',   icon: AlertCircle,   label: 'Error' },
  promo:   { color: 'text-accent',  bg: 'bg-accent/10',  border: 'border-accent/30',  icon: Tag,           label: 'Promo' },
};

const SPEED_CONFIG = {
  slow:   { label: 'Slow',   duration: 40 },
  normal: { label: 'Normal', duration: 25 },
  fast:   { label: 'Fast',   duration: 15 },
};

const BLANK_FORM = {
  message: '', subText: '', icon: '', type: 'info', speed: 'normal',
  priority: 0, isDismissible: true,
  cta: { label: '', url: '', target: '_self' },
  targetRoles: [], targetUsers: [], targetPages: [],
  startsAt: '', endsAt: '', isActive: true,
};

// Target audience modes
const TARGET_MODE = {
  ALL:   'all',    // empty targetRoles + empty targetUsers => all users
  ROLES: 'roles',  // targetRoles has values
  USERS: 'users',  // targetUsers has specific user IDs
  BOTH:  'both',   // targetRoles + targetUsers combined
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const toInputDate = (d) => {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 16);
};

const isLive = (m) => {
  if (!m.isActive || m.isArchived) return false;
  const now = new Date();
  if (m.startsAt && new Date(m.startsAt) > now) return false;
  if (m.endsAt   && new Date(m.endsAt)   < now) return false;
  return true;
};

const getTargetMode = (form) => {
  const hasRoles = form.targetRoles?.length > 0;
  const hasUsers = form.targetUsers?.length > 0;
  if (hasRoles && hasUsers) return TARGET_MODE.BOTH;
  if (hasRoles) return TARGET_MODE.ROLES;
  if (hasUsers) return TARGET_MODE.USERS;
  return TARGET_MODE.ALL;
};

// ─── Animated Marquee Preview ─────────────────────────────────────────────────

function MarqueePreview({ message, type = 'info', speed = 'normal', icon, cta }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;
  const dur = SPEED_CONFIG[speed]?.duration || 25;
  const txt = message || 'Your marquee message will appear here...';

  return (
    <div className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl border overflow-hidden ${cfg.bg} ${cfg.border}`}>
      <div className={`flex-shrink-0 flex items-center gap-1.5 ${cfg.color} font-semibold text-xs`}>
        <Icon className="w-3.5 h-3.5" />
        {icon && <span>{icon}</span>}
      </div>
      <div className="flex-1 overflow-hidden">
        <motion.div
          animate={{ x: ['100%', '-100%'] }}
          transition={{ duration: dur, repeat: Infinity, ease: 'linear' }}
          className={`whitespace-nowrap text-sm font-medium ${cfg.color}`}
        >
          {txt}
          {cta?.label && (
            <span className="ml-4 inline-flex items-center gap-1 underline font-bold">
              {cta.label} <ExternalLink className="w-3 h-3" />
            </span>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── User Multi-Select Dropdown ───────────────────────────────────────────────

function UserMultiSelect({ selectedUserIds = [], onChange, allUsers = [], filterByRoles = [] }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const ref                 = useRef(null);

  // Filter allUsers by selected roles (if any) and by search query
  const filtered = allUsers.filter((u) => {
    const roleMatch = filterByRoles.length === 0 || filterByRoles.includes(u.role);
    const q         = search.toLowerCase();
    const nameMatch = u.name?.toLowerCase().includes(q);
    const emailMatch = u.email?.toLowerCase().includes(q);
    const roleSearch = u.role?.toLowerCase().includes(q);
    return roleMatch && (q === '' || nameMatch || emailMatch || roleSearch);
  });

  const selectedUsers = allUsers.filter(u => selectedUserIds.includes(String(u._id)));

  const toggleUser = (userId) => {
    const id = String(userId);
    if (selectedUserIds.includes(id)) {
      onChange(selectedUserIds.filter(i => i !== id));
    } else {
      onChange([...selectedUserIds, id]);
    }
  };

  const removeUser = (userId) => {
    onChange(selectedUserIds.filter(i => i !== String(userId)));
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Selected chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedUsers.map(u => (
            <span key={String(u._id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold">
              <img src={u.avatar} alt="" className="w-4 h-4 rounded-full object-cover" onError={e => { e.target.style.display='none'; }} />
              {u.name}
              <button type="button" onClick={() => removeUser(u._id)}
                className="hover:text-error transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onChange([])}
            className="text-xs text-error/70 hover:text-error font-semibold px-1.5">
            Clear all
          </button>
        </div>
      )}

      {/* Trigger */}
      <button type="button" onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-base-200 rounded-xl border text-sm transition-all
          ${open ? 'border-primary' : 'border-transparent hover:border-base-300'}`}>
        <span className="flex items-center gap-2 text-base-content/50">
          <Users className="w-4 h-4" />
          {selectedUsers.length > 0
            ? <span className="text-base-content">{selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected</span>
            : <span>Select specific users…</span>}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 top-full left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Search */}
            <div className="p-2 border-b border-base-300">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/30" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, email or role…"
                  className="w-full pl-8 pr-3 py-1.5 bg-base-200 rounded-lg text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Count header */}
            <div className="px-3 py-1.5 border-b border-base-300 flex items-center justify-between">
              <span className="text-xs text-base-content/40">
                {filtered.length} user{filtered.length !== 1 ? 's' : ''}
                {filterByRoles.length > 0 && ` in selected role${filterByRoles.length > 1 ? 's' : ''}`}
              </span>
              {filtered.length > 0 && (
                <button type="button"
                  onClick={() => {
                    const allIds = filtered.map(u => String(u._id));
                    const allSelected = allIds.every(id => selectedUserIds.includes(id));
                    if (allSelected) {
                      onChange(selectedUserIds.filter(id => !allIds.includes(id)));
                    } else {
                      const merged = [...new Set([...selectedUserIds, ...allIds])];
                      onChange(merged);
                    }
                  }}
                  className="text-xs font-bold text-primary hover:underline">
                  {filtered.every(u => selectedUserIds.includes(String(u._id))) ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-xs text-base-content/40">No users found</div>
              ) : (
                filtered.map(u => {
                  const isSelected = selectedUserIds.includes(String(u._id));
                  return (
                    <button key={String(u._id)} type="button"
                      onClick={() => toggleUser(u._id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-base-200
                        ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      <div className="relative flex-shrink-0">
                        <img src={u.avatar} alt=""
                          className="w-7 h-7 rounded-full object-cover bg-base-300"
                          onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&size=28&background=random`; }}
                        />
                        {isSelected && (
                          <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-base-content truncate">{u.name}</p>
                        <p className="text-xs text-base-content/40 truncate">{u.email}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0
                        ${u.role === 'superadmin' ? 'bg-error/10 text-error' :
                          u.role === 'admin'      ? 'bg-primary/10 text-primary' :
                          u.role === 'doctor'     ? 'bg-success/10 text-success' :
                                                   'bg-base-300 text-base-content/50'}`}>
                        {u.role}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Recharts Analytics Panel ─────────────────────────────────────────────────

function AnalyticsPanel({ analytics, loading, marquees }) {
  const s = analytics?.summary;

  const stats = [
    { label: 'Total',       value: s?.totalMarquees ?? 0, icon: Layers,           color: 'text-primary',  bg: 'bg-primary/10' },
    { label: 'Active',      value: s?.activeCount   ?? 0, icon: Activity,         color: 'text-success',  bg: 'bg-success/10' },
    { label: 'Impressions', value: s?.impressions   ?? 0, icon: Eye,              color: 'text-info',     bg: 'bg-info/10' },
    { label: 'Clicks',      value: s?.clicks        ?? 0, icon: MousePointerClick,color: 'text-accent',   bg: 'bg-accent/10' },
    { label: 'Dismissals',  value: s?.dismissals    ?? 0, icon: BellOff,          color: 'text-warning',  bg: 'bg-warning/10' },
  ];

  const chartData = (marquees || []).slice(0, 8).map((m) => ({
    name: m.message?.slice(0, 14) + (m.message?.length > 14 ? '…' : ''),
    Impressions: m.analytics?.impressions || 0,
    Clicks:      m.analytics?.clicks      || 0,
    Dismissals:  m.analytics?.dismissals  || 0,
  }));

  const typeData = Object.entries(TYPE_CONFIG).map(([key, c]) => ({
    type: c.label,
    count: (marquees || []).filter(m => m.type === key).length,
  }));

  return (
    <div className="mb-5 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat, i) => (
          <motion.div key={stat.label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-base-100 border border-base-300 rounded-2xl p-3.5 flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.bg}`}>
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin text-base-content/30" />
                : <stat.icon className={`w-4 h-4 ${stat.color}`} />}
            </div>
            <div className="min-w-0">
              <p className={`font-black text-base leading-tight ${stat.color}`}>
                {loading
                  ? <span className="skeleton h-4 w-10 rounded block" />
                  : stat.value.toLocaleString()}
              </p>
              <p className="text-xs text-base-content/40 truncate">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-base-100 border border-base-300 rounded-2xl p-4">
            <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3">
              Engagement per Marquee
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradImp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gradClk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gradDis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#fb923c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fb923c" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,.08)', fontSize: 12 }}
                  cursor={{ stroke: 'rgba(0,0,0,.05)', strokeWidth: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Impressions" stroke="#38bdf8" fill="url(#gradImp)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Clicks"      stroke="#a78bfa" fill="url(#gradClk)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Dismissals"  stroke="#fb923c" fill="url(#gradDis)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-base-100 border border-base-300 rounded-2xl p-4">
            <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3">
              Marquees by Type
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={typeData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                <XAxis dataKey="type" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,.08)', fontSize: 12 }}
                  cursor={{ fill: 'rgba(0,0,0,.04)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {typeData.map((entry, index) => {
                    const colors = ['#38bdf8', '#fb923c', '#4ade80', '#f87171', '#a78bfa'];
                    return <rect key={index} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Target Audience Summary Badge ───────────────────────────────────────────

function TargetAudienceBadge({ marquee, allUsers = [] }) {
  const hasRoles = marquee.targetRoles?.length > 0;
  const hasUsers = marquee.targetUsers?.length > 0;

  if (!hasRoles && !hasUsers) {
    return (
      <span className="flex items-center gap-1 text-xs text-base-content/40">
        <Globe className="w-3 h-3" /> All users
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs">
      {hasRoles && (
        <span className="flex items-center gap-1 text-primary/70">
          <Shield className="w-3 h-3" />
          {marquee.targetRoles.slice(0, 2).join(', ')}
          {marquee.targetRoles.length > 2 && ` +${marquee.targetRoles.length - 2}`}
        </span>
      )}
      {hasRoles && hasUsers && <span className="text-base-content/30">·</span>}
      {hasUsers && (
        <span className="flex items-center gap-1 text-accent/70">
          <Users className="w-3 h-3" />
          {marquee.targetUsers.length} user{marquee.targetUsers.length !== 1 ? 's' : ''}
        </span>
      )}
    </span>
  );
}

// ─── Marquee Card ─────────────────────────────────────────────────────────────

function MarqueeCard({ marquee, index, onEdit, onView, onToggle, onArchive, onDelete, onClearDismissals, isSuperAdmin, actionLoading, allUsers }) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const cfg     = TYPE_CONFIG[marquee.type] || TYPE_CONFIG.info;
  const TypeIcon = cfg.icon;
  const live    = isLive(marquee);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', damping: 18 }}
      className={`group relative bg-base-100 rounded-2xl border transition-all duration-300 overflow-hidden
        ${marquee.isArchived ? 'opacity-55 border-base-300' : 'border-base-300 hover:border-primary/40 hover:shadow-lg'}`}
    >
      <div className={`h-1 w-full ${
        marquee.type === 'error'   ? 'bg-error' :
        marquee.type === 'warning' ? 'bg-warning' :
        marquee.type === 'success' ? 'bg-success' :
        marquee.type === 'promo'   ? 'bg-accent' : 'bg-info'}`}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
              <TypeIcon className={`w-4 h-4 ${cfg.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-base-content line-clamp-1 leading-tight">{marquee.message}</p>
              {marquee.subText && (
                <p className="text-xs text-base-content/40 line-clamp-1 mt-0.5">{marquee.subText}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
            {live ? (
              <span className="flex items-center gap-1 text-xs font-bold text-success bg-success/10 border border-success/25 px-2 py-0.5 rounded-full">
                <motion.span className="w-1.5 h-1.5 rounded-full bg-success"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }} />
                Live
              </span>
            ) : marquee.isArchived ? (
              <span className="flex items-center gap-1 text-xs font-bold text-base-content/40 bg-base-300 px-2 py-0.5 rounded-full">
                <Archive className="w-3 h-3" /> Archived
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-base-content/40 bg-base-200 border border-base-300 px-2 py-0.5 rounded-full">
                <EyeOff className="w-3 h-3" /> Inactive
              </span>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/40 mb-3">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Priority {marquee.priority}</span>
          <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {SPEED_CONFIG[marquee.speed]?.label || 'Normal'}</span>
          {/* ── Audience summary ── */}
          <TargetAudienceBadge marquee={marquee} allUsers={allUsers} />
          {marquee.endsAt && (
            <span className="flex items-center gap-1 text-warning/70">
              <Clock className="w-3 h-3" /> Ends {fmtDate(marquee.endsAt)}
            </span>
          )}
          {marquee.isDismissible === false && (
            <span className="flex items-center gap-1 text-error/60"><Lock className="w-3 h-3" /> Non-dismissible</span>
          )}
        </div>

        {/* Mini analytics */}
        <div className="flex items-center gap-3 py-2 px-3 bg-base-200 rounded-xl mb-3 text-xs">
          <span className="flex items-center gap-1 text-info font-semibold">
            <Eye className="w-3 h-3" /> {(marquee.analytics?.impressions || 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-accent font-semibold">
            <MousePointerClick className="w-3 h-3" /> {(marquee.analytics?.clicks || 0).toLocaleString()}
          </span>
          <span className="flex items-center gap-1 text-base-content/40 font-semibold">
            <BellOff className="w-3 h-3" /> {(marquee.analytics?.dismissals || 0).toLocaleString()}
          </span>
          <span className="ml-auto text-base-content/30">{fmtDate(marquee.createdAt)}</span>
        </div>

        {/* CTA preview */}
        {marquee.cta?.url && (
          <div className="mb-3 flex items-center gap-2 px-2.5 py-1.5 bg-primary/5 border border-primary/15 rounded-lg text-xs">
            <ExternalLink className="w-3 h-3 text-primary" />
            <span className="text-primary font-semibold">{marquee.cta.label || 'CTA'}</span>
            <span className="text-base-content/30 truncate">{marquee.cta.url}</span>
          </div>
        )}

        {/* ── Target users preview chips ── */}
        {marquee.targetUsers?.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(allUsers || [])
              .filter(u => (marquee.targetUsers || []).map(String).includes(String(u._id)))
              .slice(0, 4)
              .map(u => (
                <span key={String(u._id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/8 border border-accent/15 rounded-full text-xs text-accent/80 font-semibold">
                  <img src={u.avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover"
                    onError={e => { e.target.style.display = 'none'; }} />
                  {u.name?.split(' ')[0]}
                </span>
              ))}
            {marquee.targetUsers.length > 4 && (
              <span className="px-2 py-0.5 bg-base-300 rounded-full text-xs text-base-content/40 font-semibold">
                +{marquee.targetUsers.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => onToggle(marquee._id)}
            disabled={actionLoading || marquee.isArchived}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40
              ${marquee.isActive
                ? 'bg-success/10 text-success border border-success/25 hover:bg-success hover:text-white'
                : 'bg-base-200 text-base-content/50 border border-base-300 hover:border-success hover:text-success'}`}
          >
            {marquee.isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            {marquee.isActive ? 'Active' : 'Inactive'}
          </button>

          <button type="button" onClick={() => onEdit(marquee)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all">
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>

          <button type="button" onClick={() => onView(marquee._id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-base-200 text-base-content/60 border border-base-300 hover:border-primary hover:text-primary transition-all">
            <Eye className="w-3.5 h-3.5" /> Detail
          </button>

          {(marquee.analytics?.dismissals || 0) > 0 && (
            <button type="button" onClick={() => onClearDismissals(marquee._id)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-warning/10 text-warning border border-warning/20 hover:bg-warning hover:text-white transition-all disabled:opacity-40">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}

          <button type="button"
            onClick={() => onArchive(marquee._id, !marquee.isArchived)}
            disabled={actionLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-40
              ${marquee.isArchived
                ? 'bg-info/10 text-info border-info/20 hover:bg-info hover:text-white'
                : 'bg-base-200 text-base-content/50 border-base-300 hover:border-warning hover:text-warning'}`}
          >
            {marquee.isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {marquee.isArchived ? 'Unarchive' : 'Archive'}
          </button>

          {isSuperAdmin && (
            <>
              {showConfirmDelete ? (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-xs text-error font-semibold">Confirm?</span>
                  <button type="button"
                    onClick={() => { onDelete(marquee._id); setShowConfirmDelete(false); }}
                    className="px-2.5 py-1.5 bg-error text-white rounded-xl text-xs font-bold hover:brightness-110 transition-all">
                    Yes, Delete
                  </button>
                  <button type="button" onClick={() => setShowConfirmDelete(false)}
                    className="px-2.5 py-1.5 bg-base-200 text-base-content/60 rounded-xl text-xs font-bold hover:bg-base-300 transition-all">
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowConfirmDelete(true)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-error/10 text-error border border-error/20 hover:bg-error hover:text-white transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

function MarqueeFormModal({ initial, onClose, onSubmit, loading, currentUserId, allUsers }) {
  const [form, setForm] = useState(() => ({
    ...BLANK_FORM,
    ...initial,
    startsAt: toInputDate(initial?.startsAt),
    endsAt:   toInputDate(initial?.endsAt),
    cta: { label: '', url: '', target: '_self', ...(initial?.cta || {}) },
    targetRoles: initial?.targetRoles || [],
    targetUsers: (initial?.targetUsers || []).map(String),
  }));

  const isEdit   = !!initial?._id;
  const set      = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setCta   = (key, val) => setForm(f => ({ ...f, cta: { ...f.cta, [key]: val } }));

  // Derived audience mode
  const audienceMode = getTargetMode(form);

  const toggleRole = (role) => {
    setForm(f => ({
      ...f,
      targetRoles: f.targetRoles.includes(role)
        ? f.targetRoles.filter(r => r !== role)
        : [...f.targetRoles, role],
    }));
  };

  // When roles change, also filter down targetUsers to only users with those roles
  // (optional — keeps consistency. Comment out if you want independent targeting)
  const handleRoleToggle = (role) => {
    setForm(f => {
      const newRoles = f.targetRoles.includes(role)
        ? f.targetRoles.filter(r => r !== role)
        : [...f.targetRoles, role];
      return { ...f, targetRoles: newRoles };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      priority: Number(form.priority) || 0,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      endsAt:   form.endsAt   ? new Date(form.endsAt).toISOString()   : null,
      targetUsers: form.targetUsers, // array of user ID strings
      ...(isEdit
        ? { id: initial._id, updatedBy: currentUserId }
        : { createdBy: currentUserId }),
    };
    onSubmit(payload);
  };

  const cfg = TYPE_CONFIG[form.type] || TYPE_CONFIG.info;

  // Audience mode label
  const AUDIENCE_LABELS = {
    [TARGET_MODE.ALL]:   { icon: Globe,     text: 'All Users',          color: 'text-base-content/60' },
    [TARGET_MODE.ROLES]: { icon: Shield,    text: 'By Role',            color: 'text-primary' },
    [TARGET_MODE.USERS]: { icon: UserCheck, text: 'Specific Users',     color: 'text-accent' },
    [TARGET_MODE.BOTH]:  { icon: Users,     text: 'Roles + Users',      color: 'text-success' },
  };
  const audLabel = AUDIENCE_LABELS[audienceMode];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 24, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="bg-base-100 rounded-3xl border border-base-300 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              {isEdit ? <Edit3 className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
            </div>
            <div>
              <h2 className="font-black text-base text-base-content leading-tight">
                {isEdit ? 'Edit Marquee' : 'Create Marquee'}
              </h2>
              <p className="text-xs text-base-content/40">
                {isEdit ? `Editing: ${initial.message?.slice(0, 40)}…` : 'Set up a new scrolling announcement'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-xl bg-base-200 flex items-center justify-center hover:bg-error/10 hover:text-error transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="px-5 pt-4 flex-shrink-0">
          <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wider mb-1.5">Live Preview</p>
          <MarqueePreview message={form.message} type={form.type} speed={form.speed} icon={form.icon} cta={form.cta} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 pb-5 pt-4 space-y-4">

          {/* Message */}
          <div>
            <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">
              Message <span className="text-error">*</span>
            </label>
            <textarea value={form.message} onChange={e => set('message', e.target.value)}
              required rows={2} maxLength={500}
              placeholder="Enter the scrolling announcement text…"
              className="input-field w-full resize-none" />
            <p className="text-xs text-base-content/30 text-right mt-1">{form.message.length}/500</p>
          </div>

          {/* Sub Text */}
          <div>
            <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Sub Text</label>
            <input type="text" value={form.subText} onChange={e => set('subText', e.target.value)}
              placeholder="Optional tooltip/expanded detail…" className="input-field w-full" />
          </div>

          {/* Type / Speed / Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TYPE_CONFIG).map(([key, c]) => (
                  <button key={key} type="button" onClick={() => set('type', key)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all
                      ${form.type === key ? `${c.bg} ${c.color} ${c.border}` : 'bg-base-200 text-base-content/40 border-base-300 hover:border-base-content/20'}`}>
                    <c.icon className="w-3 h-3" />{c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Speed</label>
              <div className="flex flex-col gap-1.5">
                {Object.entries(SPEED_CONFIG).map(([key, c]) => (
                  <button key={key} type="button" onClick={() => set('speed', key)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all text-left
                      ${form.speed === key ? 'bg-primary/10 text-primary border-primary/30' : 'bg-base-200 text-base-content/40 border-base-300 hover:border-primary/30'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Priority (0–100)</label>
              <input type="number" value={form.priority} onChange={e => set('priority', e.target.value)}
                min={0} max={100} className="input-field w-full" />
              <p className="text-xs text-base-content/30 mt-1">Higher = shown first</p>
              <div className="mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isDismissible} onChange={e => set('isDismissible', e.target.checked)}
                    className="w-4 h-4 rounded border-base-300 accent-primary" />
                  <span className="text-xs text-base-content/60 font-semibold">Dismissible by users</span>
                </label>
              </div>
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">
              Icon <span className="text-base-content/30">(lucide icon name, e.g. "Stethoscope")</span>
            </label>
            <input type="text" value={form.icon} onChange={e => set('icon', e.target.value)}
              placeholder="e.g. AlertTriangle" className="input-field w-full" />
          </div>

          {/* CTA */}
          <div>
            <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">
              Call-to-Action Button <span className="text-base-content/30">(optional)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={form.cta.label} onChange={e => setCta('label', e.target.value)}
                placeholder="Button label" className="input-field" />
              <input  value={form.cta.url} onChange={e => setCta('url', e.target.value)}
                placeholder="https://..." className="input-field" />
            </div>
            <div className="flex gap-2 mt-2">
              {['_self', '_blank'].map(t => (
                <button key={t} type="button" onClick={() => setCta('target', t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                    ${form.cta.target === t ? 'bg-primary/10 text-primary border-primary/30' : 'bg-base-200 text-base-content/40 border-base-300'}`}>
                  {t === '_self' ? 'Same Tab' : 'New Tab'}
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              AUDIENCE TARGETING  —  Key section
              Shows current audience mode + role toggles + user multi-select
          ════════════════════════════════════════════════════════════════════ */}
          <div className="bg-base-200 rounded-2xl p-4 space-y-4 border border-base-300">
            {/* Header with live audience badge */}
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Audience Targeting
              </label>
              <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-base-100 border border-base-300 ${audLabel.color}`}>
                <audLabel.icon className="w-3 h-3" />
                {audLabel.text}
              </span>
            </div>

            {/* Quick mode buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { mode: TARGET_MODE.ALL,   icon: Globe,     label: 'All Users',      desc: 'No filter',           action: () => { set('targetRoles', []); set('targetUsers', []); } },
                { mode: TARGET_MODE.ROLES, icon: Shield,    label: 'By Roles',       desc: 'Select roles below',  action: () => { set('targetUsers', []); } },
                { mode: TARGET_MODE.USERS, icon: UserCheck, label: 'Specific Users', desc: 'Pick users below',    action: () => { set('targetRoles', []); } },
                { mode: TARGET_MODE.BOTH,  icon: Users,     label: 'Roles + Users',  desc: 'Combined targeting',  action: () => {} },
              ].map(({ mode, icon: Ic, label, desc, action }) => (
                <button key={mode} type="button"
                  onClick={action}
                  className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-center transition-all
                    ${audienceMode === mode
                      ? 'bg-primary/10 text-primary border-primary/30 shadow-sm'
                      : 'bg-base-100 text-base-content/40 border-base-300 hover:border-primary/20 hover:text-base-content/60'}`}
                >
                  <Ic className="w-4 h-4" />
                  <span className="text-xs font-bold leading-tight">{label}</span>
                  <span className="text-xs opacity-60 leading-tight">{desc}</span>
                </button>
              ))}
            </div>

            {/* Role chips — shown for ROLES or BOTH modes */}
            <div>
              <p className="text-xs font-bold text-base-content/50 mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Target Roles
                <span className="text-base-content/30 font-normal">(empty = all roles)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map(role => (
                  <button key={role} type="button" onClick={() => handleRoleToggle(role)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all capitalize
                      ${form.targetRoles.includes(role)
                        ? 'bg-primary/15 text-primary border-primary/35 shadow-sm'
                        : 'bg-base-100 text-base-content/40 border-base-300 hover:border-primary/30'}`}>
                    {form.targetRoles.includes(role) && <Check className="w-2.5 h-2.5 inline mr-1" />}
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* User multi-select */}
            <div>
              <p className="text-xs font-bold text-base-content/50 mb-2 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Specific Users
                <span className="text-base-content/30 font-normal">
                  {form.targetRoles.length > 0 ? `(filtered to: ${form.targetRoles.join(', ')})` : '(all users shown)'}
                </span>
              </p>
              <UserMultiSelect
                selectedUserIds={form.targetUsers}
                onChange={(ids) => set('targetUsers', ids)}
                allUsers={allUsers}
                filterByRoles={form.targetRoles}
              />
            </div>

            {/* Summary */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold
              ${audienceMode === TARGET_MODE.ALL
                ? 'bg-base-100 border-base-300 text-base-content/50'
                : 'bg-primary/5 border-primary/15 text-primary'}`}>
              <audLabel.icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {audienceMode === TARGET_MODE.ALL && 'This marquee will be shown to ALL users regardless of role.'}
                {audienceMode === TARGET_MODE.ROLES && `Targeting ${form.targetRoles.length} role${form.targetRoles.length > 1 ? 's' : ''}: ${form.targetRoles.join(', ')}`}
                {audienceMode === TARGET_MODE.USERS && `Targeting ${form.targetUsers.length} specific user${form.targetUsers.length !== 1 ? 's' : ''}`}
                {audienceMode === TARGET_MODE.BOTH && `Targeting ${form.targetRoles.length} role${form.targetRoles.length > 1 ? 's' : ''} + ${form.targetUsers.length} specific user${form.targetUsers.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          {/* Target Pages */}
          <div>
            <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">
              Target Pages <span className="text-base-content/30">(comma-separated paths, empty = all pages)</span>
            </label>
            <input type="text"
              value={form.targetPages.join(', ')}
              onChange={e => set('targetPages', e.target.value.split(',').map(p => p.trim()).filter(Boolean))}
              placeholder="/pharmacy, /dashboard, /orders…" className="input-field w-full" />
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">Starts At</label>
              <input type="datetime-local" value={form.startsAt} onChange={e => set('startsAt', e.target.value)}
                className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold text-base-content/60 mb-1.5 uppercase tracking-wider">
                Ends At <span className="text-base-content/30">(empty = never)</span>
              </label>
              <input type="datetime-local" value={form.endsAt} onChange={e => set('endsAt', e.target.value)}
                className="input-field w-full" />
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 p-3 bg-base-200 rounded-xl cursor-pointer border border-base-300 hover:border-primary/30 transition-colors">
            <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)}
              className="w-4 h-4 rounded accent-primary" />
            <div>
              <p className="text-sm font-bold text-base-content">Activate Immediately</p>
              <p className="text-xs text-base-content/40">Make this marquee visible right away (respects schedule)</p>
            </div>
            <div className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${form.isActive ? 'bg-success' : 'bg-base-300'}`} />
          </label>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-base-300 text-sm font-bold text-base-content/60 hover:bg-base-200 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading || !form.message.trim()}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/85 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Marquee'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ marquee, loading, onClose, allUsers }) {
  if (loading || !marquee) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-base-100 rounded-3xl p-8 flex items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="font-semibold text-base-content/60">Loading detail…</span>
      </div>
    </motion.div>
  );

  const cfg      = TYPE_CONFIG[marquee.type] || TYPE_CONFIG.info;
  const TypeIcon = cfg.icon;
  const live     = isLive(marquee);

  const engData = [
    { name: 'Impressions', value: marquee.analytics?.impressions || 0, fill: '#38bdf8' },
    { name: 'Clicks',      value: marquee.analytics?.clicks      || 0, fill: '#a78bfa' },
    { name: 'Dismissals',  value: marquee.analytics?.dismissals  || 0, fill: '#fb923c' },
  ];

  // Resolve targetUsers to full user objects
  const targetedUsers = (allUsers || []).filter(u =>
    (marquee.targetUsers || []).map(String).includes(String(u._id))
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.92, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 20, opacity: 0 }} transition={{ type: 'spring', damping: 20 }}
        className="bg-base-100 rounded-3xl border border-base-300 shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto">

        <div className={`h-1.5 w-full rounded-t-3xl ${
          marquee.type === 'error' ? 'bg-error' : marquee.type === 'warning' ? 'bg-warning' :
          marquee.type === 'success' ? 'bg-success' : marquee.type === 'promo' ? 'bg-accent' : 'bg-info'}`} />

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                <TypeIcon className={`w-5 h-5 ${cfg.color}`} />
              </div>
              <div>
                <h3 className="font-black text-base text-base-content">Marquee Detail</h3>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                  {cfg.label}
                </span>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="w-8 h-8 rounded-xl bg-base-200 flex items-center justify-center hover:bg-error/10 hover:text-error transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Preview */}
          <div className="mb-4">
            <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wider mb-1.5">Preview</p>
            <MarqueePreview message={marquee.message} type={marquee.type} speed={marquee.speed} icon={marquee.icon} cta={marquee.cta} />
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Status',      value: live ? '🟢 Live' : marquee.isArchived ? '📦 Archived' : '⚫ Inactive' },
              { label: 'Speed',       value: SPEED_CONFIG[marquee.speed]?.label || marquee.speed },
              { label: 'Priority',    value: marquee.priority },
              { label: 'Dismissible', value: marquee.isDismissible ? 'Yes' : 'No' },
              { label: 'Starts At',   value: fmtDate(marquee.startsAt) },
              { label: 'Ends At',     value: marquee.endsAt ? fmtDate(marquee.endsAt) : 'Never' },
              { label: 'Created',     value: fmtDate(marquee.createdAt) },
              { label: 'Updated',     value: fmtDate(marquee.updatedAt) },
            ].map(r => (
              <div key={r.label} className="bg-base-200 rounded-xl px-3 py-2">
                <p className="text-xs text-base-content/40 font-semibold">{r.label}</p>
                <p className="text-sm font-bold text-base-content">{String(r.value ?? '—')}</p>
              </div>
            ))}
          </div>

          {/* ── Audience section ── */}
          <div className="mb-4 bg-base-200 rounded-2xl p-3 border border-base-300">
            <p className="text-xs text-base-content/40 font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Audience
            </p>

            {/* Target Roles */}
            {marquee.targetRoles?.length > 0 ? (
              <div className="mb-2.5">
                <p className="text-xs text-base-content/40 font-semibold mb-1.5 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Target Roles ({marquee.targetRoles.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {marquee.targetRoles.map(r => (
                    <span key={r} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 font-semibold capitalize">{r}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-base-content/40 flex items-center gap-1.5 mb-2.5">
                <Globe className="w-3.5 h-3.5" /> No role restriction — visible to all roles
              </p>
            )}

            {/* Target Users */}
            {targetedUsers.length > 0 ? (
              <div>
                <p className="text-xs text-base-content/40 font-semibold mb-1.5 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Specific Users ({targetedUsers.length})
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {targetedUsers.map(u => (
                    <span key={String(u._id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/8 border border-accent/15 rounded-full text-xs text-accent/80 font-semibold">
                      <img src={u.avatar} alt="" className="w-4 h-4 rounded-full object-cover"
                        onError={e => { e.target.style.display='none'; }} />
                      {u.name}
                      <span className="text-accent/40 text-xs capitalize">· {u.role}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-base-content/40 flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5" /> No specific users targeted
              </p>
            )}
          </div>

          {/* Analytics chart */}
          <div className="mb-4">
            <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wider mb-2">Analytics</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={engData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '10px', fontSize: 12 }} cursor={{ fill: 'rgba(0,0,0,.04)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {engData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Dismissed by */}
          {marquee.dismissedBy?.length > 0 && (
            <div>
              <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wider mb-2">
                Dismissed By ({marquee.dismissedBy.length})
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {marquee.dismissedBy.map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-base-200 rounded-xl text-xs">
                    <span className="font-semibold text-base-content">
                      {d.user?.name || String(d.user?._id || d.user || '—')}
                    </span>
                    <span className="text-base-content/40">{fmtDate(d.dismissedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MarqueeManagement() {
  const dispatch = useDispatch();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user         = useSelector((state) => state.user?.user) ?? null;
  const isSuperAdmin = user?.role === 'superadmin';

  // ── All users (from userSlice) ────────────────────────────────────────────
  const allUsersState  = useSelector((state) => state.user?.allUsers);
  const allUsers       = allUsersState?.data || [];
  const usersLoading   = useSelector((state) => state.user?.loading) ?? false;

  // ── Marquee slice ─────────────────────────────────────────────────────────
  const marquees      = useSelector(selectAdminMarquees);
  const pagination    = useSelector(selectAdminPagination);
  const loading       = useSelector(selectAdminLoading);
  const actionLoading = useSelector(selectActionLoading);
  const selected      = useSelector(selectSelectedMarquee);
  const selLoading    = useSelector(selectSelectedLoading);
  const analytics     = useSelector(selectAnalytics);
  const analyticsLoad = useSelector(selectAnalyticsLoading);

  // ── Local State ───────────────────────────────────────────────────────────
  const [page,           setPage]           = useState(1);
  const [search,         setSearch]         = useState('');
  const [filterType,     setFilterType]     = useState('');
  const [filterActive,   setFilterActive]   = useState('');
  const [filterArchived, setFilterArchived] = useState('false');
  const [filterRole,     setFilterRole]     = useState('');
  const [showFilters,    setShowFilters]    = useState(false);
  const [showForm,       setShowForm]       = useState(false);
  const [editData,       setEditData]       = useState(null);
  const [showDetail,     setShowDetail]     = useState(false);
  const [showAnalytics,  setShowAnalytics]  = useState(true);

  // ── Fetch marquees ────────────────────────────────────────────────────────
  const load = useCallback(() => {
    const params = { page, limit: 12 };
    if (search)         params.search     = search;
    if (filterType)     params.type       = filterType;
    if (filterActive)   params.isActive   = filterActive;
    if (filterArchived) params.isArchived = filterArchived;
    if (filterRole)     params.role       = filterRole;
    dispatch(fetchAdminMarquees(params));
  }, [dispatch, page, search, filterType, filterActive, filterArchived, filterRole]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { dispatch(fetchMarqueeAnalytics()); }, [dispatch]);

  // ── Fetch all users for targeting (paginate large sets if needed) ─────────
  useEffect(() => {
    // Fetch enough users to cover targeting needs — adjust limit as required
    dispatch(adminGetAllUsers({ page: 1, limit: 500 }));
  }, [dispatch]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate  = () => { setEditData(null); setShowForm(true); };
  const openEdit    = (m)  => { setEditData(m);   setShowForm(true); };
  const openDetail  = (id) => { dispatch(fetchAdminMarqueeById(id)); setShowDetail(true); };
  const closeForm   = ()   => { setShowForm(false); setEditData(null); };
  const closeDetail = ()   => { setShowDetail(false); dispatch(clearSelectedMarquee()); };

  const handleSubmit = async (payload) => {
    if (payload.id) {
      await dispatch(updateMarquee(payload));
    } else {
      await dispatch(createMarquee(payload));
    }
    closeForm();
    load();
    dispatch(fetchMarqueeAnalytics());
  };

  const handleToggle          = (id)          => dispatch(toggleMarquee(id));
  const handleArchive         = (id, archive) => dispatch(archiveMarquee({ id, archive }));
  const handleClearDismissals = (id)          => dispatch(clearDismissals(id));
  const handleDelete          = (id)          => {
    dispatch(deleteMarquee(id)).then(() => { load(); dispatch(fetchMarqueeAnalytics()); });
  };

  const clearFilters = () => {
    setSearch(''); setFilterType(''); setFilterActive('');
    setFilterArchived('false'); setFilterRole('');
  };

  const hasFilters = search || filterType || filterActive || filterRole || filterArchived !== 'false';
  const liveCount  = marquees.filter(isLive).length;

  return (
    <div className="min-h-screen bg-base-200 py-5 px-4">
      <div className="max-w-6xl mx-auto">

        {/* ── Page Header ── */}
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center shadow-sm">
              <Megaphone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-black text-xl text-base-content leading-tight">Marquee Management</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-base-content/40">{pagination.total} total</p>
                {liveCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
                    <motion.span className="w-1.5 h-1.5 rounded-full bg-success"
                      animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                    {liveCount} Live
                  </span>
                )}
                {/* Users loaded indicator */}
                {allUsers.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-base-content/30 bg-base-100 px-2 py-0.5 rounded-full border border-base-300">
                    <Users className="w-3 h-3" />
                    {allUsers.length} users loaded
                  </span>
                )}
                {user?.role && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border capitalize
                    ${isSuperAdmin ? 'bg-error/10 text-error border-error/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                    {user.role}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowAnalytics(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-base-100 border border-base-300 rounded-xl text-xs font-semibold text-base-content/50 hover:border-primary hover:text-primary transition-all">
              <BarChart3 className="w-3.5 h-3.5" />
              {showAnalytics ? 'Hide' : 'Show'} Analytics
            </button>
            <button type="button" onClick={load} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-base-100 border border-base-300 rounded-xl text-xs font-semibold text-base-content/50 hover:border-primary hover:text-primary transition-all disabled:opacity-40">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button type="button" onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/85 transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95">
              <Plus className="w-4 h-4" /> New Marquee
            </button>
          </div>
        </motion.div>

        {/* ── Analytics ── */}
        <AnimatePresence>
          {showAnalytics && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <AnalyticsPanel analytics={analytics} loading={analyticsLoad} marquees={marquees} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filter / Search Bar ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-base-100 rounded-2xl border border-base-300 p-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search marquee messages…"
                className="w-full pl-9 pr-3 py-2.5 bg-base-200 rounded-xl text-sm text-base-content placeholder:text-base-content/30 border border-transparent focus:border-primary focus:outline-none transition-colors" />
              {search && (
                <button type="button" onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-error">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button type="button" onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all
                ${showFilters || hasFilters ? 'bg-primary text-white border-primary' : 'bg-base-200 text-base-content/60 border-transparent hover:border-primary'}`}>
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasFilters && <span className="w-4 h-4 rounded-full bg-white/30 text-xs flex items-center justify-center">!</span>}
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-3 mt-3 border-t border-base-300 space-y-2.5">
                  {/* Type filter */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-base-content/40 font-bold w-14 flex-shrink-0">Type:</span>
                    {Object.entries(TYPE_CONFIG).map(([key, c]) => (
                      <button key={key} type="button" onClick={() => setFilterType(filterType === key ? '' : key)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all
                          ${filterType === key ? `${c.bg} ${c.color} ${c.border}` : 'bg-base-200 text-base-content/40 border-transparent hover:border-base-300'}`}>
                        <c.icon className="w-3 h-3" />{c.label}
                      </button>
                    ))}
                  </div>
                  {/* Status filter */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-base-content/40 font-bold w-14 flex-shrink-0">Status:</span>
                    {[
                      { label: 'Active',   val: 'true',  color: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
                      { label: 'Inactive', val: 'false', color: 'text-error',   bg: 'bg-error/10',   border: 'border-error/30' },
                    ].map(s => (
                      <button key={s.val} type="button" onClick={() => setFilterActive(filterActive === s.val ? '' : s.val)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all
                          ${filterActive === s.val ? `${s.bg} ${s.color} ${s.border}` : 'bg-base-200 text-base-content/40 border-transparent hover:border-base-300'}`}>
                        {s.label}
                      </button>
                    ))}
                    <span className="text-xs text-base-content/40 font-bold ml-2">Archived:</span>
                    {[{ label: 'Yes', val: 'true' }, { label: 'No', val: 'false' }].map(s => (
                      <button key={s.val} type="button" onClick={() => setFilterArchived(s.val)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all
                          ${filterArchived === s.val ? 'bg-primary/10 text-primary border-primary/30' : 'bg-base-200 text-base-content/40 border-transparent hover:border-base-300'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {/* Role filter */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-base-content/40 font-bold w-14 flex-shrink-0">Role:</span>
                    {ROLES.map(r => (
                      <button key={r} type="button" onClick={() => setFilterRole(filterRole === r ? '' : r)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all capitalize
                          ${filterRole === r ? 'bg-primary/10 text-primary border-primary/30' : 'bg-base-200 text-base-content/40 border-transparent hover:border-base-300'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                  {hasFilters && (
                    <button type="button" onClick={clearFilters}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-error bg-error/10 border border-error/20 hover:bg-error hover:text-white transition-all">
                      <X className="w-3 h-3" /> Clear All Filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Content ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-base-100 rounded-2xl border border-base-300 p-4 space-y-3">
                <div className="skeleton h-1 w-full rounded" />
                <div className="flex gap-2">
                  <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-4 w-3/4 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                </div>
                <div className="skeleton h-8 w-full rounded-xl" />
                <div className="flex gap-2">
                  {[1, 2, 3].map(j => <div key={j} className="skeleton h-7 w-16 rounded-xl" />)}
                </div>
              </div>
            ))}
          </div>
        ) : marquees.length === 0 ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <Megaphone className="w-10 h-10 text-primary/40" />
            </div>
            <h3 className="font-black text-lg text-base-content mb-1">No marquees found</h3>
            <p className="text-sm text-base-content/40 mb-5 max-w-xs">
              {hasFilters ? 'Try adjusting your filters.' : 'Create your first scrolling announcement.'}
            </p>
            {hasFilters ? (
              <button type="button" onClick={clearFilters}
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/85 transition-all">
                Clear Filters
              </button>
            ) : (
              <button type="button" onClick={openCreate}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/85 transition-all">
                <Plus className="w-4 h-4" /> Create First Marquee
              </button>
            )}
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {marquees.map((m, i) => (
                <MarqueeCard
                  key={String(m._id)}
                  marquee={m}
                  index={i}
                  onEdit={openEdit}
                  onView={openDetail}
                  onToggle={handleToggle}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onClearDismissals={handleClearDismissals}
                  isSuperAdmin={isSuperAdmin}
                  actionLoading={actionLoading}
                  allUsers={allUsers}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-2 mt-6">
                <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-base-300 text-sm font-semibold text-base-content/60 hover:border-primary hover:text-primary disabled:opacity-30 transition-all">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(pagination.pages, 7))].map((_, i) => {
                    const n = i + 1;
                    return (
                      <button key={n} type="button" onClick={() => setPage(n)}
                        className={`w-9 h-9 rounded-xl text-sm font-bold transition-all
                          ${page === n ? 'bg-primary text-white shadow-md' : 'bg-base-200 text-base-content/50 hover:bg-base-300'}`}>
                        {n}
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-base-300 text-sm font-semibold text-base-content/60 hover:border-primary hover:text-primary disabled:opacity-30 transition-all">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showForm && (
          <MarqueeFormModal
            initial={editData}
            onClose={closeForm}
            onSubmit={handleSubmit}
            loading={actionLoading}
            currentUserId={user?._id}
            allUsers={allUsers}
          />
        )}
        {showDetail && (
          <DetailModal
            marquee={selected}
            loading={selLoading}
            onClose={closeDetail}
            allUsers={allUsers}
          />
        )}
      </AnimatePresence>
    </div>
  );
}