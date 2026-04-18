'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertCircle, AlertTriangle, ArrowLeft, BarChart3,
  Bug, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Clock, Code2, CreditCard, Filter, Globe, Info, Layers,
  Loader2, RefreshCw, Search, Server, Shield, ShieldAlert,
  Terminal, User, Users, X, Zap, Calendar, TrendingUp,
  Eye, Hash, Cpu, Database, Bell, FileText, Lock,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_META = {
  info:    { label: 'Info',    icon: Info,         color: 'var(--color-info)',    bg: 'color-mix(in oklch, var(--color-info) 12%, transparent)',    border: 'color-mix(in oklch, var(--color-info) 30%, transparent)' },
  success: { label: 'Success', icon: CheckCircle2, color: 'var(--color-success)', bg: 'color-mix(in oklch, var(--color-success) 12%, transparent)', border: 'color-mix(in oklch, var(--color-success) 30%, transparent)' },
  warning: { label: 'Warning', icon: AlertTriangle, color: 'var(--color-warning)', bg: 'color-mix(in oklch, var(--color-warning) 12%, transparent)', border: 'color-mix(in oklch, var(--color-warning) 30%, transparent)' },
  error:   { label: 'Error',   icon: AlertCircle,  color: 'var(--color-error)',   bg: 'color-mix(in oklch, var(--color-error) 12%, transparent)',   border: 'color-mix(in oklch, var(--color-error) 30%, transparent)' },
  debug:   { label: 'Debug',   icon: Bug,          color: 'var(--color-chart-5)', bg: 'color-mix(in oklch, var(--color-chart-5) 12%, transparent)', border: 'color-mix(in oklch, var(--color-chart-5) 30%, transparent)' },
};

const CATEGORY_META = {
  auth:         { label: 'Auth',         icon: Lock,       color: 'var(--color-chart-5)' },
  user:         { label: 'User',         icon: User,       color: 'var(--color-chart-1)' },
  security:     { label: 'Security',     icon: ShieldAlert, color: 'var(--color-error)' },
  payment:      { label: 'Payment',      icon: CreditCard,  color: 'var(--color-success)' },
  notification: { label: 'Notification', icon: Bell,        color: 'var(--color-accent)' },
  kyc:          { label: 'KYC',          icon: FileText,    color: 'var(--color-warning)' },
  system:       { label: 'System',       icon: Cpu,         color: 'var(--color-chart-2)' },
  api:          { label: 'API',          icon: Globe,       color: 'var(--color-info)' },
};

const METHOD_COLOR = {
  GET:    { bg: 'color-mix(in oklch, var(--color-success) 15%, transparent)', text: 'var(--color-success)' },
  POST:   { bg: 'color-mix(in oklch, var(--color-info) 15%, transparent)',    text: 'var(--color-info)' },
  PUT:    { bg: 'color-mix(in oklch, var(--color-accent) 15%, transparent)',  text: 'var(--color-accent)' },
  PATCH:  { bg: 'color-mix(in oklch, var(--color-warning) 15%, transparent)', text: 'var(--color-warning)' },
  DELETE: { bg: 'color-mix(in oklch, var(--color-error) 15%, transparent)',   text: 'var(--color-error)' },
};

const STATUS_COLOR = (code) => {
  if (!code) return { bg: 'var(--color-base-300)', text: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)' };
  if (code < 300) return { bg: 'color-mix(in oklch, var(--color-success) 15%, transparent)', text: 'var(--color-success)' };
  if (code < 400) return { bg: 'color-mix(in oklch, var(--color-info) 15%, transparent)',    text: 'var(--color-info)' };
  if (code < 500) return { bg: 'color-mix(in oklch, var(--color-warning) 15%, transparent)', text: 'var(--color-warning)' };
  return { bg: 'color-mix(in oklch, var(--color-error) 15%, transparent)', text: 'var(--color-error)' };
};

const CHART_COLORS = [
  'var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)',
  'var(--color-chart-4)', 'var(--color-chart-5)', 'var(--color-chart-6)',
];

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const slideIn = {
  hidden:  { opacity: 0, x: 48 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 48, transition: { duration: 0.22 } },
};

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, scale: 0.94, transition: { duration: 0.18 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  });
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const truncate = (str = '', n = 80) => str.length > n ? str.slice(0, n) + '…' : str;

// ─── Mock Data Generator (replace with API calls) ────────────────────────────

const generateMockLogs = (count = 60) => {
  const levels     = ['info', 'success', 'warning', 'error', 'debug'];
  const categories = ['auth', 'user', 'security', 'payment', 'notification', 'kyc', 'system', 'api'];
  const methods    = ['GET', 'POST', 'PATCH', 'DELETE'];
  const paths      = [
    '/hospital-manager/profile/basic', '/hospital-manager/doctors/create-and-link',
    '/hospital-manager/doctors/search', '/hospital-manager/doctors/stats',
    '/hospital-manager/pricing', '/hospital-manager/upload/logo',
    '/hospital-manager/security/change-password', '/hospital-manager/notifications/mark-read',
    '/hospital-manager/doctors/:id/unlink', '/hospital-manager/operating-hours',
  ];
  const messages = [
    'Hospital profile updated by manager',
    'New doctor created and linked to Apollo Hospitals',
    'Doctor unlinked from hospital',
    'Consultation pricing updated',
    'License document uploaded',
    'Hospital manager changed password',
    'Session revoked by manager',
    'Notification preferences saved',
    'Doctor availability fetched',
    'Operating hours updated',
    'Logo uploaded successfully',
    'Failed to validate doctorProfileId',
    'Unauthorized access attempt blocked',
    'KYC document reviewed',
    'Payment gateway timeout',
  ];
  const roles    = ['hospital', 'doctor', 'system'];
  const names    = ['Dr. Ravi Kumar', 'Priya Sharma', 'Admin System', 'Manager Reddy', 'system'];
  const statuses = [200, 201, 204, 400, 401, 403, 404, 409, 500];

  return Array.from({ length: count }, (_, i) => {
    const level    = levels[Math.floor(Math.random() * levels.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const method   = methods[Math.floor(Math.random() * methods.length)];
    const path     = paths[Math.floor(Math.random() * paths.length)];
    const msg      = messages[Math.floor(Math.random() * messages.length)];
    const role     = roles[Math.floor(Math.random() * roles.length)];
    const name     = names[Math.floor(Math.random() * names.length)];
    const status   = statuses[Math.floor(Math.random() * statuses.length)];
    const date     = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

    return {
      _id:        `log_${i}_${Math.random().toString(36).slice(-6)}`,
      logCode:    `LOG-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(-5).toUpperCase()}`,
      level,
      category,
      message: msg,
      details: level === 'error' ? `Error stack trace: TypeError at line ${Math.floor(Math.random() * 200)}. Hospital validation failed for managed model.` : null,
      actor: {
        userId:    `user_${Math.random().toString(36).slice(-6)}`,
        name,
        role,
        ip:        `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        platform:  ['web', 'android', 'ios', 'desktop'][Math.floor(Math.random() * 4)],
      },
      relatedEntity: {
        model:    ['Hospital', 'DoctorProfile', 'User', null][Math.floor(Math.random() * 4)],
        entityId: `ent_${Math.random().toString(36).slice(-8)}`,
        label:    ['Apollo Hospitals', 'Dr. Ravi Kumar', 'Manager Account', null][Math.floor(Math.random() * 4)],
      },
      request: { method, path, statusCode: status, durationMs: Math.floor(Math.random() * 800 + 20) },
      metadata: level === 'error' ? { doctorProfileId: 'search', reason: 'Invalid ObjectId' } : null,
      environment: 'production',
      serverId:    'primary',
      createdAt:   date.toISOString(),
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// ─── Build chart data from logs ───────────────────────────────────────────────

const buildChartData = (logs) => {
  // Timeline: last 7 days grouped by day
  const dayMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    dayMap[key] = { day: key, info: 0, success: 0, warning: 0, error: 0, debug: 0 };
  }
  logs.forEach(l => {
    const key = new Date(l.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    if (dayMap[key]) dayMap[key][l.level] = (dayMap[key][l.level] || 0) + 1;
  });

  // Category breakdown
  const catMap = {};
  logs.forEach(l => { catMap[l.category] = (catMap[l.category] || 0) + 1; });

  // Level breakdown
  const lvlMap = {};
  logs.forEach(l => { lvlMap[l.level] = (lvlMap[l.level] || 0) + 1; });

  return {
    timeline: Object.values(dayMap),
    byCategory: Object.entries(catMap).map(([name, value]) => ({ name, value })),
    byLevel: Object.entries(lvlMap).map(([name, value]) => ({ name: LEVEL_META[name]?.label || name, value })),
  };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const LevelBadge = ({ level, size = 'sm' }) => {
  const m = LEVEL_META[level] || LEVEL_META.info;
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <Icon size={size === 'sm' ? 11 : 13} />
      {m.label}
    </span>
  );
};

const CategoryBadge = ({ category }) => {
  const m = CATEGORY_META[category] || { label: category, icon: Layers, color: 'var(--color-base-content)' };
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
      style={{
        background: 'var(--color-base-200)',
        color: m.color,
        border: '1px solid var(--color-base-300)',
      }}>
      <Icon size={11} />
      {m.label}
    </span>
  );
};

const MethodPill = ({ method }) => {
  if (!method) return <span className="text-xs text-base-content/40">—</span>;
  const c = METHOD_COLOR[method] || { bg: 'var(--color-base-200)', text: 'var(--color-base-content)' };
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-black tracking-wider"
      style={{ background: c.bg, color: c.text }}>
      {method}
    </span>
  );
};

const StatusPill = ({ code }) => {
  if (!code) return <span className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }}>—</span>;
  const c = STATUS_COLOR(code);
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold"
      style={{ background: c.bg, color: c.text }}>
      {code}
    </span>
  );
};

// ─── Log Row ──────────────────────────────────────────────────────────────────

const LogRow = ({ log, index, onSelect, isSelected }) => {
  const level = LEVEL_META[log.level] || LEVEL_META.info;
  const Icon  = level.icon;

  return (
    <motion.tr
      variants={fadeUp}
      custom={index % 20}
      initial="hidden"
      animate="visible"
      onClick={() => onSelect(log)}
      className="cursor-pointer transition-all duration-150 group"
      style={{
        background: isSelected
          ? 'color-mix(in oklch, var(--color-primary) 8%, transparent)'
          : 'transparent',
        borderBottom: '1px solid var(--color-base-300)',
      }}
    >
      {/* Level indicator bar */}
      <td className="pl-0 pr-2 py-3 w-1">
        <div className="w-1 h-10 rounded-full" style={{ background: level.color }} />
      </td>

      {/* Level */}
      <td className="px-3 py-3">
        <LevelBadge level={log.level} />
      </td>

      {/* Category */}
      <td className="px-3 py-3 hidden md:table-cell">
        <CategoryBadge category={log.category} />
      </td>

      {/* Message */}
      <td className="px-3 py-3 max-w-xs">
        <p className="text-xs font-semibold leading-snug truncate"
          style={{ color: 'var(--color-base-content)' }}>
          {truncate(log.message, 65)}
        </p>
        <p className="text-xs mt-0.5 hidden sm:block"
          style={{ color: 'color-mix(in oklch, var(--color-base-content) 45%, transparent)' }}>
          {log.logCode}
        </p>
      </td>

      {/* Actor */}
      <td className="px-3 py-3 hidden lg:table-cell">
        <p className="text-xs font-semibold truncate max-w-[120px]">{log.actor?.name || '—'}</p>
        <p className="text-xs truncate max-w-[120px]"
          style={{ color: 'color-mix(in oklch, var(--color-base-content) 45%, transparent)' }}>
          {log.actor?.ip}
        </p>
      </td>

      {/* Method + Status */}
      <td className="px-3 py-3 hidden xl:table-cell">
        <div className="flex items-center gap-2">
          <MethodPill method={log.request?.method} />
          <StatusPill code={log.request?.statusCode} />
        </div>
      </td>

      {/* Duration */}
      <td className="px-3 py-3 hidden xl:table-cell">
        {log.request?.durationMs
          ? <span className="text-xs font-mono"
              style={{ color: log.request.durationMs > 500 ? 'var(--color-warning)' : 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
              {log.request.durationMs}ms
            </span>
          : <span className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 30%, transparent)' }}>—</span>
        }
      </td>

      {/* Time */}
      <td className="px-3 py-3 text-right">
        <p className="text-xs font-medium" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
          {timeAgo(log.createdAt)}
        </p>
      </td>
    </motion.tr>
  );
};

// ─── Log Detail Panel ─────────────────────────────────────────────────────────

const LogDetailPanel = ({ log, onClose }) => {
  if (!log) return null;
  const level = LEVEL_META[log.level] || LEVEL_META.info;

  const Section = ({ title, children }) => (
    <div className="card p-4 space-y-3">
      <h4 className="text-xs font-black uppercase tracking-widest"
        style={{ color: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)', fontFamily: 'var(--font-display)' }}>
        {title}
      </h4>
      {children}
    </div>
  );

  const KV = ({ k, v, mono = false }) => (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-semibold flex-shrink-0"
        style={{ color: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)' }}>
        {k}
      </span>
      <span className={`text-xs font-bold text-right break-all ${mono ? 'font-mono' : ''}`}>
        {v || '—'}
      </span>
    </div>
  );

  return (
    <motion.div
      variants={slideIn} initial="hidden" animate="visible" exit="exit"
      className="flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b mb-4"
        style={{ borderColor: 'var(--color-base-300)' }}>
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
            style={{ background: level.bg, border: `1px solid ${level.border}` }}>
            <level.icon size={17} style={{ color: level.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black leading-snug" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-base-content)' }}>
              {log.message}
            </p>
            <p className="text-xs mt-1 font-mono" style={{ color: 'color-mix(in oklch, var(--color-base-content) 45%, transparent)' }}>
              {log.logCode}
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center"
          style={{ background: 'var(--color-base-200)' }}>
          <X size={13} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-3">

        {/* Classification */}
        <Section title="Classification">
          <div className="flex gap-2 flex-wrap">
            <LevelBadge level={log.level} size="lg" />
            <CategoryBadge category={log.category} />
          </div>
          <KV k="Environment" v={log.environment} />
          <KV k="Server ID"   v={log.serverId} />
          <KV k="Timestamp"   v={formatTime(log.createdAt)} />
        </Section>

        {/* Actor */}
        <Section title="Actor">
          <KV k="Name"     v={log.actor?.name} />
          <KV k="Role"     v={log.actor?.role} />
          <KV k="IP"       v={log.actor?.ip} mono />
          <KV k="Platform" v={log.actor?.platform} />
          <KV k="User ID"  v={log.actor?.userId} mono />
        </Section>

        {/* Request */}
        <Section title="HTTP Request">
          <div className="flex items-center gap-2 flex-wrap">
            <MethodPill method={log.request?.method} />
            <StatusPill code={log.request?.statusCode} />
            {log.request?.durationMs && (
              <span className="text-xs font-mono px-2 py-0.5 rounded"
                style={{
                  background: 'var(--color-base-200)',
                  color: log.request.durationMs > 500 ? 'var(--color-warning)' : 'var(--color-base-content)',
                }}>
                {log.request.durationMs}ms
              </span>
            )}
          </div>
          <KV k="Path" v={log.request?.path} mono />
        </Section>

        {/* Related Entity */}
        {log.relatedEntity?.model && (
          <Section title="Related Entity">
            <KV k="Model"    v={log.relatedEntity.model} />
            <KV k="Label"    v={log.relatedEntity.label} />
            <KV k="Entity ID" v={log.relatedEntity.entityId} mono />
          </Section>
        )}

        {/* Details */}
        {log.details && (
          <Section title="Details / Stack Trace">
            <pre className="text-xs font-mono p-3 rounded-xl overflow-x-auto leading-relaxed"
              style={{
                background: 'color-mix(in oklch, var(--color-error) 8%, transparent)',
                color: 'var(--color-error)',
                border: '1px solid color-mix(in oklch, var(--color-error) 20%, transparent)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
              {log.details}
            </pre>
          </Section>
        )}

        {/* Metadata */}
        {log.metadata && (
          <Section title="Metadata">
            <pre className="text-xs font-mono p-3 rounded-xl overflow-x-auto"
              style={{
                background: 'var(--color-base-200)',
                color: 'var(--color-base-content)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </Section>
        )}

      </div>
    </motion.div>
  );
};

// ─── Stats Strip ──────────────────────────────────────────────────────────────

const StatStrip = ({ logs }) => {
  const counts = logs.reduce((acc, l) => { acc[l.level] = (acc[l.level] || 0) + 1; return acc; }, {});
  const tiles = [
    { key: 'total',   label: 'Total Logs',  value: logs.length,         icon: Layers,       color: 'var(--color-primary)' },
    { key: 'error',   label: 'Errors',      value: counts.error   || 0, icon: AlertCircle,  color: 'var(--color-error)' },
    { key: 'warning', label: 'Warnings',    value: counts.warning || 0, icon: AlertTriangle, color: 'var(--color-warning)' },
    { key: 'success', label: 'Success',     value: counts.success || 0, icon: CheckCircle2, color: 'var(--color-success)' },
    { key: 'info',    label: 'Info',        value: counts.info    || 0, icon: Info,          color: 'var(--color-info)' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {tiles.map((t, i) => (
        <motion.div
          key={t.key}
          variants={fadeUp}
          custom={i}
          initial="hidden"
          animate="visible"
          className="stat-card flex items-center gap-3"
          style={{ borderLeft: `4px solid ${t.color}` }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in oklch, ${t.color} 15%, transparent)` }}>
            <t.icon size={20} style={{ color: t.color }} />
          </div>
          <div>
            <p className="stat-card-value" style={{ color: t.color, fontSize: '1.4rem' }}>{t.value}</p>
            <p className="stat-card-label">{t.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ─── Analytics Panel ──────────────────────────────────────────────────────────

const AnalyticsPanel = ({ logs }) => {
  const { timeline, byCategory, byLevel } = buildChartData(logs);

  const tooltipStyle = {
    contentStyle: {
      background: 'var(--color-base-100)',
      border: '1px solid var(--color-base-300)',
      borderRadius: '10px',
      fontSize: 11,
      fontFamily: 'var(--font-sans)',
    },
    cursor: { fill: 'color-mix(in oklch, var(--color-primary) 8%, transparent)' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: 'hidden' }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Timeline */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-black mb-4 flex items-center gap-2"
            style={{ fontFamily: 'var(--font-display)' }}>
            <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
            Log Activity (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={timeline}>
              <defs>
                {['error', 'warning', 'success', 'info'].map((l, i) => (
                  <linearGradient key={l} id={`grad_${l}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor={LEVEL_META[l].color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={LEVEL_META[l].color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--color-base-content)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-base-content)' }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              {['error', 'warning', 'success', 'info'].map(l => (
                <Area key={l} type="monotone" dataKey={l} stackId="1"
                  stroke={LEVEL_META[l].color} fill={`url(#grad_${l})`} strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div className="card p-5">
          <h3 className="text-sm font-black mb-4 flex items-center gap-2"
            style={{ fontFamily: 'var(--font-display)' }}>
            <Activity size={16} style={{ color: 'var(--color-secondary)' }} />
            By Category
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={60} innerRadius={30} paddingAngle={3}>
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'var(--font-sans)' }} iconSize={7} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const FilterBar = ({ filters, setFilters, onReset }) => {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-5 p-4 rounded-2xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      style={{
        background: 'var(--color-base-200)',
        borderColor: 'var(--color-base-300)',
        overflow: 'hidden',
      }}
    >
      {/* Level */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
          Level
        </label>
        <select className="input-field text-sm py-2"
          value={filters.level}
          onChange={e => setFilters(p => ({ ...p, level: e.target.value }))}>
          <option value="">All Levels</option>
          {Object.entries(LEVEL_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
          Category
        </label>
        <select className="input-field text-sm py-2"
          value={filters.category}
          onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}>
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Date From */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
          From Date
        </label>
        <input type="date" className="input-field text-sm py-2"
          value={filters.from}
          onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} />
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold" style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
          To Date
        </label>
        <input type="date" className="input-field text-sm py-2"
          value={filters.to}
          onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} />
      </div>

      {/* Reset */}
      <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
        <button onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
          style={{ background: 'var(--color-base-300)', color: 'var(--color-base-content)' }}>
          <X size={12} /> Reset Filters
        </button>
      </div>
    </motion.div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function SystemLogs() {
  const [allLogs, setAllLogs]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [selectedLog, setSelectedLog]   = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showFilters, setShowFilters]   = useState(false);
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const LIMIT = 20;

  const [filters, setFilters] = useState({ level: '', category: '', from: '', to: '' });

  // ── Load mock data (replace with API.get('/hospital-manager/logs?...')) ──────
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setAllLogs(generateMockLogs(80));
      setLoading(false);
    }, 900);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setAllLogs(generateMockLogs(80));
      setRefreshing(false);
    }, 700);
  };

  const resetFilters = () => {
    setFilters({ level: '', category: '', from: '', to: '' });
    setSearch('');
    setPage(1);
  };

  // ── Filter & search ────────────────────────────────────────────────────────
  const filtered = allLogs.filter(l => {
    const q = search.toLowerCase();
    if (q && !l.message.toLowerCase().includes(q) &&
        !l.logCode.toLowerCase().includes(q) &&
        !(l.actor?.name || '').toLowerCase().includes(q) &&
        !(l.request?.path || '').toLowerCase().includes(q)) return false;
    if (filters.level    && l.level    !== filters.level)    return false;
    if (filters.category && l.category !== filters.category) return false;
    if (filters.from && new Date(l.createdAt) < new Date(filters.from)) return false;
    if (filters.to   && new Date(l.createdAt) > new Date(filters.to + 'T23:59:59')) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const pageLogs   = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  const activeFilterCount = Object.values(filters).filter(Boolean).length + (search ? 1 : 0);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-base-100)' }}>

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b"
        style={{
          background: 'var(--color-base-100)',
          borderColor: 'var(--color-base-300)',
          backdropFilter: 'blur(12px)',
        }}>
        <div className="container-custom py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-primary)', color: 'var(--color-primary-content)' }}>
              <Terminal size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black leading-tight"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-base-content)' }}>
                System Logs
              </h1>
              <p className="text-xs"
                style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                Audit trail & event history for your hospital
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleRefresh} disabled={refreshing}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'var(--color-base-200)' }}>
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => setShowAnalytics(p => !p)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: showAnalytics ? 'var(--color-secondary)' : 'var(--color-base-200)',
                color: showAnalytics ? 'var(--color-secondary-content)' : 'var(--color-base-content)',
              }}>
              <BarChart3 size={14} />
              Analytics
            </button>

            <button
              onClick={() => { setShowFilters(p => !p); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border relative"
              style={{
                background: showFilters ? 'color-mix(in oklch, var(--color-primary) 10%, transparent)' : 'var(--color-base-200)',
                borderColor: showFilters ? 'var(--color-primary)' : 'var(--color-base-300)',
                color: showFilters ? 'var(--color-primary)' : 'var(--color-base-content)',
              }}>
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-xs flex items-center justify-center font-black"
                  style={{ background: 'var(--color-error)', color: 'var(--color-error-content)' }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="container-custom py-6">
        <div className="flex gap-6">

          {/* ── Left main content ────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Stats */}
            {!loading && <StatStrip logs={allLogs} />}

            {/* Analytics */}
            <AnimatePresence>
              {showAnalytics && !loading && <AnalyticsPanel logs={allLogs} />}
            </AnimatePresence>

            {/* Search */}
            <motion.div variants={fadeUp} custom={1} initial="hidden" animate="visible"
              className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }} />
                <input
                  className="input-field w-full pl-9"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by message, logCode, actor, path…"
                />
              </div>
            </motion.div>

            {/* Filters */}
            <AnimatePresence>
              {showFilters && (
                <FilterBar
                  filters={filters}
                  setFilters={(v) => { setFilters(v); setPage(1); }}
                  onReset={resetFilters}
                />
              )}
            </AnimatePresence>

            {/* Result count */}
            {!loading && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold"
                  style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                  {filtered.length} log{filtered.length !== 1 ? 's' : ''} found
                  {activeFilterCount > 0 && <span className="ml-1 text-primary"> (filtered)</span>}
                </p>
                <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }}>
                  Page {page} of {totalPages}
                </p>
              </div>
            )}

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-3"
                style={{ color: 'var(--color-primary)' }}>
                <Loader2 size={24} className="animate-spin" />
                <span className="text-sm font-medium">Loading system logs…</span>
              </div>
            ) : filtered.length === 0 ? (
              <motion.div variants={fadeUp} initial="hidden" animate="visible"
                className="flex flex-col items-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--color-base-200)' }}>
                  <FileText size={28} style={{ color: 'color-mix(in oklch, var(--color-base-content) 35%, transparent)' }} />
                </div>
                <h3 className="text-base font-black mb-1" style={{ fontFamily: 'var(--font-display)' }}>No Logs Found</h3>
                <p className="text-sm max-w-xs mb-4"
                  style={{ color: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)' }}>
                  No logs match the current filters. Try adjusting your search.
                </p>
                <button onClick={resetFilters} className="btn-secondary px-5 py-2 text-sm flex items-center gap-2">
                  <X size={13} /> Clear Filters
                </button>
              </motion.div>
            ) : (
              <>
                {/* Log table */}
                <div className="card overflow-hidden mb-5">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: 'var(--color-base-200)', borderBottom: '2px solid var(--color-base-300)' }}>
                          <th className="w-1 pl-0" />
                          <th className="px-3 py-3 text-left">
                            <span className="text-xs font-black uppercase tracking-wider"
                              style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                              Level
                            </span>
                          </th>
                          <th className="px-3 py-3 text-left hidden md:table-cell">
                            <span className="text-xs font-black uppercase tracking-wider"
                              style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                              Category
                            </span>
                          </th>
                          <th className="px-3 py-3 text-left">
                            <span className="text-xs font-black uppercase tracking-wider"
                              style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                              Message
                            </span>
                          </th>
                          <th className="px-3 py-3 text-left hidden lg:table-cell">
                            <span className="text-xs font-black uppercase tracking-wider"
                              style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                              Actor
                            </span>
                          </th>
                          <th className="px-3 py-3 text-left hidden xl:table-cell">
                            <span className="text-xs font-black uppercase tracking-wider"
                              style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                              Request
                            </span>
                          </th>
                          <th className="px-3 py-3 text-left hidden xl:table-cell">
                            <span className="text-xs font-black uppercase tracking-wider"
                              style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                              Dur.
                            </span>
                          </th>
                          <th className="px-3 py-3 text-right">
                            <span className="text-xs font-black uppercase tracking-wider"
                              style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                              Time
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageLogs.map((log, i) => (
                          <LogRow
                            key={log._id}
                            log={log}
                            index={i}
                            onSelect={setSelectedLog}
                            isSelected={selectedLog?._id === log._id}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                      style={{ background: 'var(--color-base-200)' }}>
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                        return (
                          <button key={p} onClick={() => setPage(p)}
                            className="w-8 h-8 rounded-lg text-sm font-bold transition-all"
                            style={{
                              background: page === p ? 'var(--color-primary)' : 'var(--color-base-200)',
                              color: page === p ? 'var(--color-primary-content)' : 'var(--color-base-content)',
                            }}>
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                      style={{ background: 'var(--color-base-200)' }}>
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Right: detail panel (desktop) ──────────────────────────── */}
          <AnimatePresence>
            {selectedLog && (
              <motion.aside
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 360 }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="flex-shrink-0 hidden lg:flex flex-col border-l pl-6 overflow-hidden"
                style={{
                  borderColor: 'var(--color-base-300)',
                  maxHeight: 'calc(100vh - 90px)',
                  position: 'sticky',
                  top: 90,
                }}
              >
                <LogDetailPanel log={selectedLog} onClose={() => setSelectedLog(null)} />
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile detail overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 flex flex-col lg:hidden"
            style={{ background: 'var(--color-base-100)' }}
          >
            <div className="container-custom py-5 flex-1 overflow-y-auto">
              <LogDetailPanel log={selectedLog} onClose={() => setSelectedLog(null)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}