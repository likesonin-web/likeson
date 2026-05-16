'use client';

/**
 * FollowUpValids.jsx — Likeson.in
 * Hospital-only page: Browse & manage valid follow-up eligible OP records.
 * Access: authorize('hospital')
 *
 * Thunks used:
 *   fetchHospitalValidOps   → GET /hospital/:hospitalId/valid-ops
 *
 * Selectors used:
 *   selectHospitalValidOps
 *   selectHospitalValidOpsMeta
 *   selectLoading('fetchHospitalValidOps')
 *
 * Design: clinical-navy meets soft-glass. Montserrat + Poppins.
 * Hospital data-theme tokens respected via CSS vars.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  CalendarCheck2, Clock, UserRound, Stethoscope, Hospital,
  ChevronRight, Search, SlidersHorizontal, RefreshCw,
  TrendingUp, AlertCircle, CheckCircle2, TimerOff,
  ChevronLeft, ChevronDown, Filter, X, Activity,
  FileText, Phone, BadgeCheck, Hourglass,
} from 'lucide-react';

import {
  fetchHospitalValidOps,
  selectHospitalValidOps,
  selectHospitalValidOpsMeta,
  selectLoading,
} from '@/store/slices/operationsSlice';       // adjust to your actual import path
import {selectHospital} from '@/store/slices/hospitalManagerSlice';         // for fetching hospital details if needed
// ─────────────────────────────────────────────────────────────────────────────
// MOCK HOSPITAL ID  (in real app: derive from auth/user profile)
// ─────────────────────────────────────────────────────────────────────────────
 

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS (hospital theme — mirror CSS vars so works without provider)
// ─────────────────────────────────────────────────────────────────────────────
const TOKEN = {
  primary:   'var(--primary,   #1e3a8a)',
  secondary: 'var(--secondary, #3b82f6)',
  accent:    'var(--accent,    #f59e0b)',
  success:   'var(--success,   #10b981)',
  warning:   'var(--warning,   #f59e0b)',
  error:     'var(--error,     #ef4444)',
  info:      'var(--info,      #3b82f6)',
  base100:   'var(--base-100,  #ffffff)',
  base200:   'var(--base-200,  #f1f5f9)',
  base300:   'var(--base-300,  #e2e8f0)',
  content:   'var(--base-content, #1e293b)',
};

// ─────────────────────────────────────────────────────────────────────────────
// FRAMER VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp   = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } } };
const stagger  = { show: { transition: { staggerChildren: 0.07 } } };
const slideIn  = { hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } } };
const scaleIn  = { hidden: { opacity: 0, scale: 0.93 }, show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } } };

// ─────────────────────────────────────────────────────────────────────────────
// URGENCY HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const urgencyConfig = (days) => {
  if (days <= 3)  return { label: 'Critical',  color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)',  icon: TimerOff };
  if (days <= 7)  return { label: 'Urgent',    color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', icon: AlertCircle };
  if (days <= 14) return { label: 'Soon',      color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.30)', icon: Clock };
  return           { label: 'Eligible',  color: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.30)', icon: CheckCircle2 };
};

const daysBarColor = (days) => {
  if (days <= 3)  return '#ef4444';
  if (days <= 7)  return '#f59e0b';
  if (days <= 14) return '#3b82f6';
  return '#10b981';
};

// ─────────────────────────────────────────────────────────────────────────────
// STAT SUMMARY CARD
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      style={{
        background:   TOKEN.base100,
        border:       `1px solid ${TOKEN.base300}`,
        borderRadius: 16,
        padding:      '20px 24px',
        display:      'flex',
        alignItems:   'center',
        gap:          16,
        boxShadow:    '0 2px 12px rgba(30,58,138,0.06)',
        position:     'relative',
        overflow:     'hidden',
      }}
    >
      {/* decorative blob */}
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: color, opacity: 0.08, pointerEvents: 'none' }} />
      <div style={{ width: 48, height: 48, borderRadius: 14, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'Montserrat, sans-serif', color: TOKEN.content, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// URGENCY MINI CHART
// ─────────────────────────────────────────────────────────────────────────────
function UrgencyChart({ ops }) {
  const buckets = [
    { label: '≤3d',  count: ops.filter(o => o.daysRemaining <= 3).length,  color: '#ef4444' },
    { label: '4–7d', count: ops.filter(o => o.daysRemaining > 3  && o.daysRemaining <= 7).length,  color: '#f59e0b' },
    { label: '8–14d',count: ops.filter(o => o.daysRemaining > 7  && o.daysRemaining <= 14).length, color: '#3b82f6' },
    { label: '>14d', count: ops.filter(o => o.daysRemaining > 14).length, color: '#10b981' },
  ];
  return (
    <motion.div variants={scaleIn} initial="hidden" animate="show" style={{ background: TOKEN.base100, border: `1px solid ${TOKEN.base300}`, borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(30,58,138,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <TrendingUp size={16} style={{ color: TOKEN.primary }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Follow-up Urgency</span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={buckets} barSize={28}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Poppins, sans-serif' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: 'rgba(30,58,138,0.04)' }}
            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'Poppins, sans-serif', background: '#fff', padding: '6px 12px' }}
            formatter={(v) => [`${v} OPs`, 'Count']}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {buckets.map((b, i) => <Cell key={i} fill={b.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAYS REMAINING PILL
// ─────────────────────────────────────────────────────────────────────────────
function DaysPill({ days }) {
  const cfg = urgencyConfig(days);
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, fontSize: 12, fontWeight: 700 }}>
      <Icon size={12} />
      {days}d left
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OP RECORD ROW
// ─────────────────────────────────────────────────────────────────────────────
function OpRow({ op, onClick, isSelected }) {
  const days = op.daysRemaining ?? 0;
  const cfg  = urgencyConfig(days);
  const pct  = Math.min(100, Math.round((days / 30) * 100));

  return (
    <motion.div
      variants={slideIn}
      layout
      onClick={onClick}
      whileHover={{ x: 3 }}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          16,
        padding:      '14px 20px',
        borderRadius: 12,
        background:   isSelected ? 'rgba(30,58,138,0.05)' : 'transparent',
        border:       isSelected ? `1.5px solid rgba(30,58,138,0.18)` : '1.5px solid transparent',
        cursor:       'pointer',
        transition:   'background 0.18s, border-color 0.18s',
        position:     'relative',
      }}
    >
      {/* Urgency stripe */}
      <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, background: cfg.color }} />

      {/* Avatar */}
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${cfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <UserRound size={20} style={{ color: cfg.color }} />
      </div>

      {/* Info block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: TOKEN.content, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {op.patient?.name || op.patientName || '—'}
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>#{op.opNumber}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Stethoscope size={11} style={{ color: '#94a3b8' }} />
          <span style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {op.doctor?.user?.name || 'Unknown Dr.'} · {op.consultationType?.replace('_', ' ')}
          </span>
        </div>
        {/* mini progress bar */}
        <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: TOKEN.base300, overflow: 'hidden', width: '80%' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.15 }} style={{ height: '100%', borderRadius: 2, background: cfg.color }} />
        </div>
      </div>

      {/* Right: days pill + chevron */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <DaysPill days={days} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {op.scheduledAt ? new Date(op.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
        </span>
      </div>

      <ChevronRight size={16} style={{ color: '#cbd5e1', flexShrink: 0 }} />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OP DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────
function OpDetailPanel({ op, onClose }) {
  const days = op.daysRemaining ?? 0;
  const cfg  = urgencyConfig(days);

  const rows = [
    { icon: FileText,    label: 'OP Number',         value: op.opNumber },
    { icon: UserRound,   label: 'Patient',            value: op.patient?.name || op.patientName || '—' },
    { icon: Phone,       label: 'Patient Phone',      value: op.patient?.phone || '—' },
    { icon: Stethoscope, label: 'Doctor',             value: op.doctor?.user?.name || '—' },
    { icon: BadgeCheck,  label: 'Specialization',     value: op.doctor?.specialization || '—' },
    { icon: Activity,    label: 'Consultation Type',  value: op.consultationType?.replace('_', ' ') || '—' },
    { icon: CalendarCheck2, label: 'Scheduled At',   value: op.scheduledAt ? new Date(op.scheduledAt).toLocaleString('en-IN') : '—' },
    { icon: Hourglass,   label: 'Follow-up Expires', value: op.followUpExpiry ? new Date(op.followUpExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
    { icon: Clock,       label: 'Days Remaining',     value: `${days} days`, highlight: true },
  ];

  return (
    <motion.div
      key={op._id}
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${TOKEN.base300}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Record Detail</div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, color: TOKEN.content }}>{op.patient?.name || op.patientName}</div>
        </div>
        <button onClick={onClose} style={{ background: TOKEN.base200, border: 'none', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={16} style={{ color: '#64748b' }} />
        </button>
      </div>

      {/* Urgency banner */}
      <div style={{ margin: '16px 24px 0', padding: '12px 16px', borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        {(() => { const I = cfg.icon; return <I size={18} style={{ color: cfg.color }} />; })()}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label} — {days} days remaining</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>Patient eligible for reduced-fee follow-up visit</div>
        </div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(({ icon: Icon, label, value, highlight }, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', borderRadius: 10, background: highlight ? cfg.bg : TOKEN.base200, border: `1px solid ${highlight ? cfg.border : TOKEN.base300}` }}>
            <Icon size={14} style={{ color: highlight ? cfg.color : '#64748b', marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? cfg.color : TOKEN.content, marginTop: 1 }}>{value}</div>
            </div>
          </motion.div>
        ))}

        {/* Follow-up fee */}
        {op.followUpFee !== undefined && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.22)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Follow-up Fee</div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 28, color: '#10b981', marginTop: 4 }}>
              {op.followUpFee === 0 ? 'FREE' : `₹${op.followUpFee}`}
            </div>
            {op.followUpFee === 0 && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Covered by initial consultation</div>}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────
function Pagination({ meta, page, onPage }) {
  const { total, pages } = meta;
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: `1px solid ${TOKEN.base300}` }}>
      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{total} records · Page {page} of {pages}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={{ background: TOKEN.base200, border: `1px solid ${TOKEN.base300}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>
          <ChevronLeft size={15} />
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = i + 1;
          return (
            <button key={p} onClick={() => onPage(p)} style={{ width: 32, height: 32, borderRadius: 8, border: p === page ? '1.5px solid rgba(30,58,138,0.35)' : `1px solid ${TOKEN.base300}`, background: p === page ? 'rgba(30,58,138,0.08)' : TOKEN.base200, color: p === page ? '#1e3a8a' : TOKEN.content, fontWeight: p === page ? 700 : 500, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {p}
            </button>
          );
        })}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} style={{ background: TOKEN.base200, border: `1px solid ${TOKEN.base300}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? 0.4 : 1 }}>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: TOKEN.base300, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: '55%', height: 13, borderRadius: 6, background: TOKEN.base300, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '40%', height: 10, borderRadius: 6, background: TOKEN.base300, animation: 'pulse 1.5s ease-in-out 0.2s infinite' }} />
      </div>
      <div style={{ width: 72, height: 26, borderRadius: 999, background: TOKEN.base300, animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(30,58,138,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CalendarCheck2 size={36} style={{ color: 'rgba(30,58,138,0.35)' }} />
      </div>
      <div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, color: TOKEN.content, marginBottom: 6 }}>No valid follow-ups found</div>
        <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 280, margin: '0 auto', lineHeight: 1.6 }}>Patients with active follow-up eligibility windows will appear here.</div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER DRAWER
// ─────────────────────────────────────────────────────────────────────────────
function FilterDrawer({ filters, onChange, onApply, onReset, isOpen }) {
  if (!isOpen) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
      style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, width: 300, background: TOKEN.base100, border: `1px solid ${TOKEN.base300}`, borderRadius: 14, boxShadow: '0 16px 40px rgba(0,0,0,0.12)', padding: 20, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: TOKEN.content }}>Filters</span>
        <button onClick={onReset} style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Reset all</button>
      </div>

      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Doctor ID</label>
      <input value={filters.doctorId} onChange={e => onChange('doctorId', e.target.value)}
        placeholder="Filter by doctor ID..." style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${TOKEN.base300}`, background: TOKEN.base200, fontSize: 13, marginBottom: 12, color: TOKEN.content, outline: 'none', fontFamily: 'Poppins, sans-serif' }} />

      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Patient ID</label>
      <input value={filters.patientId} onChange={e => onChange('patientId', e.target.value)}
        placeholder="Filter by patient ID..." style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${TOKEN.base300}`, background: TOKEN.base200, fontSize: 13, marginBottom: 16, color: TOKEN.content, outline: 'none', fontFamily: 'Poppins, sans-serif' }} />

      <button onClick={onApply} style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}>
        Apply Filters
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function FollowUpValids() {
  const dispatch    = useDispatch();
  const reduced     = useReducedMotion();
   const hospital = useSelector(selectHospital);   
  const ops         = useSelector(selectHospitalValidOps);
  const meta        = useSelector(selectHospitalValidOpsMeta);
  const isLoading   = useSelector(selectLoading('fetchHospitalValidOps'));

  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [selected,    setSelected]    = useState(null);
  const [filterOpen,  setFilterOpen]  = useState(false);
  const [filters,     setFilters]     = useState({ doctorId: '', patientId: '' });
  const [activeFilters, setActiveFilters] = useState({});

  const filterRef = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  // ── FollowUpValids.jsx — Update your load callback ──
const load = useCallback((pg = 1) => {
  // Resolve both standard id and MongoDB database _id fields
  const resolvedHospitalId = hospital?._id || hospital?.id;

  // Guard clause: Don't call the API if the ID hasn't loaded yet
  if (!resolvedHospitalId) {
    console.warn("[FollowUpValids] Postponing load: hospitalId missing.");
    return;
  }

  dispatch(fetchHospitalValidOps({
    hospitalId: resolvedHospitalId,
    doctorId:   activeFilters.doctorId  || undefined,
    patientId:  activeFilters.patientId || undefined,
    page:       pg,
    limit:      10,
  }));
}, [dispatch, hospital, activeFilters]);

  useEffect(() => { load(page); }, [page, activeFilters]);

  // ── Close filter on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? ops.filter(op => {
        const q = search.toLowerCase();
        return (op.patient?.name  || '').toLowerCase().includes(q) ||
               (op.opNumber       || '').toLowerCase().includes(q) ||
               (op.doctor?.user?.name || '').toLowerCase().includes(q);
      })
    : ops;

  const totalOps    = meta.total;
  const critical    = ops.filter(o => o.daysRemaining <= 3).length;
  const expireSoon  = ops.filter(o => o.daysRemaining > 3 && o.daysRemaining <= 7).length;
  const avgDays     = ops.length ? Math.round(ops.reduce((s, o) => s + (o.daysRemaining ?? 0), 0) / ops.length) : 0;

  const hasActiveFilters = Object.values(activeFilters).some(Boolean);

  const applyFilters = () => { setActiveFilters({ ...filters }); setPage(1); setFilterOpen(false); };
  const resetFilters = () => { setFilters({ doctorId: '', patientId: '' }); setActiveFilters({}); setPage(1); setFilterOpen(false); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div data-theme="hospital" style={{ minHeight: '100vh', background: TOKEN.base200, fontFamily: 'Poppins, sans-serif' }}>
      {/* Keyframe pulse */}
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Poppins:wght@400;500;600;700&display=swap');
      `}</style>

      {/* ── PAGE HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg, #0f2460 0%, #1e3a8a 55%, #1d4ed8 100%)', padding: '32px 32px 28px', position: 'relative', overflow: 'hidden' }}>
        {/* decorative rings */}
        {[220, 320, 420].map((s, i) => (
          <div key={i} style={{ position: 'absolute', right: -s / 4, top: -s / 4, width: s, height: s, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        ))}
        <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Hospital size={16} style={{ color: 'rgba(255,255,255,0.55)' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hospital Portal</span>
          </div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: 32, color: '#fff', margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            Valid Follow-up OPs
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.60)', margin: '8px 0 0', fontWeight: 400 }}>
            Patients with active follow-up eligibility windows · Sorted by expiry urgency
          </p>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── STATS ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <StatCard icon={CalendarCheck2} label="Valid Follow-ups"   value={totalOps}   sub="Active eligibility" color="#1e3a8a" delay={0}    />
          <StatCard icon={TimerOff}       label="Expiring ≤ 3 days" value={critical}   sub="Needs attention"    color="#ef4444" delay={0.06} />
          <StatCard icon={AlertCircle}    label="Expiring 4–7 days" value={expireSoon} sub="Urgent reminder"    color="#f59e0b" delay={0.12} />
          <StatCard icon={Hourglass}      label="Avg Days Remaining" value={avgDays}   sub="Across all records" color="#10b981" delay={0.18} />
        </div>

        {/* ── CHART ROW ── */}
        {ops.length > 0 && <UrgencyChart ops={ops} />}

        {/* ── SEARCH + FILTER BAR ── */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient, OP number, doctor…"
              style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 10, border: `1px solid ${TOKEN.base300}`, background: TOKEN.base100, fontSize: 13, color: TOKEN.content, outline: 'none', fontFamily: 'Poppins, sans-serif', boxSizing: 'border-box' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={14} style={{ color: '#94a3b8' }} />
              </button>
            )}
          </div>

          {/* Filter button */}
          <div style={{ position: 'relative' }} ref={filterRef}>
            <button onClick={() => setFilterOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10, border: `1.5px solid ${hasActiveFilters ? '#3b82f6' : TOKEN.base300}`, background: hasActiveFilters ? 'rgba(59,130,246,0.07)' : TOKEN.base100, color: hasActiveFilters ? '#3b82f6' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}>
              <SlidersHorizontal size={14} />
              Filters
              {hasActiveFilters && <span style={{ background: '#3b82f6', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>ON</span>}
              <ChevronDown size={13} style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            <AnimatePresence>
              {filterOpen && <FilterDrawer filters={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onApply={applyFilters} onReset={resetFilters} isOpen />}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button onClick={() => load(page)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px', borderRadius: 10, border: `1px solid ${TOKEN.base300}`, background: TOKEN.base100, color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}>
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* ── ACTIVE FILTER CHIPS ── */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(activeFilters).filter(([, v]) => v).map(([k, v]) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', fontSize: 12, fontWeight: 600, color: '#3b82f6' }}>
                  <Filter size={10} />{k}: {v}
                  <button onClick={() => { setActiveFilters(p => ({ ...p, [k]: '' })); setFilters(p => ({ ...p, [k]: '' })); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={10} /></button>
                </span>
              ))}
              <button onClick={resetFilters} style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MAIN SPLIT PANEL ── */}
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20, alignItems: 'start', transition: 'grid-template-columns 0.35s ease' }}>

          {/* List panel */}
          <div style={{ background: TOKEN.base100, border: `1px solid ${TOKEN.base300}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(30,58,138,0.06)' }}>
            {/* panel header */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${TOKEN.base300}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarCheck2 size={16} style={{ color: '#1e3a8a' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: TOKEN.content }}>Follow-up Eligible Patients</span>
                {!isLoading && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>({filtered.length}{search ? ` of ${meta.total}` : ''})</span>}
              </div>
              {isLoading && <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(30,58,138,0.2)', borderTopColor: '#1e3a8a', animation: 'spin 0.65s linear infinite' }} />}
            </div>

            {/* List body */}
            <motion.div variants={stagger} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', minHeight: 200 }}>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.length === 0
                  ? <EmptyState />
                  : filtered.map(op => (
                      <OpRow key={op._id} op={op} isSelected={selected?._id === op._id} onClick={() => setSelected(selected?._id === op._id ? null : op)} />
                    ))
              }
            </motion.div>

            {/* Pagination */}
            {!isLoading && filtered.length > 0 && <Pagination meta={meta} page={page} onPage={setPage} />}
          </div>

          {/* Detail panel */}
          <AnimatePresence>
            {selected && (
              <motion.div key={selected._id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.3 }}
                style={{ background: TOKEN.base100, border: `1px solid ${TOKEN.base300}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(30,58,138,0.08)', maxHeight: 680, display: 'flex', flexDirection: 'column' }}>
                <OpDetailPanel op={selected} onClose={() => setSelected(null)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── FOOTER NOTE ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, background: 'rgba(30,58,138,0.04)', border: '1px solid rgba(30,58,138,0.10)' }}>
          <BadgeCheck size={14} style={{ color: '#1e3a8a', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            Records shown are <strong style={{ color: TOKEN.content }}>non-follow-up OPs</strong> with an active follow-up eligibility window (<code style={{ background: TOKEN.base300, padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>followUpExpiry &gt; now</code>). Patients may book a reduced-fee or free follow-up until expiry.
          </span>
        </div>
      </div>

      {/* Global spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}