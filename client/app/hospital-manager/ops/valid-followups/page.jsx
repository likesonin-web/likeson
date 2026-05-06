'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Repeat2, Clock, AlertTriangle, CheckCircle2, Search, RefreshCw,
  User, Stethoscope, Calendar, Timer, ChevronLeft, ChevronRight,
  Loader2, X, Filter, TrendingUp, Badge, Zap, Eye,
} from 'lucide-react';

import {
  fetchHospitalValidOps,
  selectHospitalValidOps,
  selectHospitalValidOpsMeta,
} from '@/store/slices/operationsSlice';
import { selectHospital } from '@/store/slices/hospitalManagerSlice';

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const urgencyConfig = (days) => {
  if (days <= 1) return { label: 'Critical',  color: 'var(--error)',   bg: 'var(--error)',   icon: Zap };
  if (days <= 3) return { label: 'Urgent',    color: 'var(--warning)', bg: 'var(--warning)', icon: AlertTriangle };
  if (days <= 7) return { label: 'This Week', color: 'var(--info)',    bg: 'var(--info)',    icon: Clock };
  return          { label: 'Active',    color: 'var(--success)', bg: 'var(--success)', icon: CheckCircle2 };
};

// ─── urgency badge ────────────────────────────────────────────────────────────

function UrgencyBadge({ days }) {
  const conf = urgencyConfig(days);
  const Icon = conf.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 'var(--r-selector)',
      background: `color-mix(in srgb, ${conf.bg}, transparent 85%)`,
      color: conf.color,
      border: `1px solid color-mix(in srgb, ${conf.bg}, transparent 60%)`,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      <Icon size={10} />
      {conf.label} · {days}d
    </span>
  );
}

// ─── countdown ring ───────────────────────────────────────────────────────────

function DaysRing({ days, total = 30 }) {
  const pct = Math.min(100, (days / total) * 100);
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  const conf = urgencyConfig(days);

  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--base-300)" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={conf.color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: conf.color, lineHeight: 1, fontFamily: 'var(--font-montserrat)' }}>{days}</span>
        <span style={{ fontSize: 8, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', fontWeight: 600, letterSpacing: '0.04em' }}>DAYS</span>
      </div>
    </div>
  );
}

// ─── OP detail modal ──────────────────────────────────────────────────────────

function DetailModal({ op, onClose }) {
  if (!op) return null;
  const conf = urgencyConfig(op.daysRemaining || 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--base-100)',
            borderRadius: 'var(--r-box)',
            width: '100%', maxWidth: 520,
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          }}
        >
          {/* modal header */}
          <div style={{
            background: `linear-gradient(135deg, ${conf.color}, color-mix(in srgb, ${conf.color}, var(--secondary) 40%))`,
            padding: '22px 24px',
            borderRadius: 'var(--r-box) var(--r-box) 0 0',
            position: 'relative',
          }}>
            <button onClick={onClose} style={{
              position: 'absolute', top: 14, right: 14,
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
              width: 30, height: 30, cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={14} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <DaysRing days={op.daysRemaining || 0} />
              <div>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Follow-Up Window
                </p>
                <p style={{ color: '#fff', fontFamily: 'var(--font-montserrat)', fontWeight: 900, fontSize: 20 }}>
                  {op.opNumber}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
                  Expires {fmtDate(op.followUpExpiry)}
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: 24 }}>
            {/* patient + doctor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Patient', value: op.patient?.name, sub: op.patient?.phone, icon: User },
                { label: 'Doctor', value: op.doctor?.user?.name || '—', sub: op.doctor?.specialization, icon: Stethoscope },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'var(--base-200)', border: '1px solid var(--base-300)',
                  borderRadius: 'var(--r-field)', padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <item.icon size={12} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {item.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--base-content)' }}>{item.value || '—'}</p>
                  {item.sub && <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)', marginTop: 2 }}>{item.sub}</p>}
                </div>
              ))}
            </div>

            {/* timeline details */}
            <div style={{
              background: 'var(--base-200)', border: '1px solid var(--base-300)',
              borderRadius: 'var(--r-field)', overflow: 'hidden', marginBottom: 16,
            }}>
              {[
                ['Consultation Type', op.consultationType || '—'],
                ['Original Scheduled', fmtDate(op.scheduledAt)],
                ['Follow-Up Expiry', fmtDate(op.followUpExpiry)],
                ['Days Remaining', `${op.daysRemaining} days`],
                ['Follow-Up Fee', op.followUpFee != null ? `₹${op.followUpFee}` : '—'],
                ['Status', op.status],
              ].map(([k, v], i, arr) => (
                <div key={k} style={{
                  display: 'flex', gap: 12, padding: '9px 14px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--base-300)' : 'none',
                }}>
                  <span style={{ width: 120, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{k}</span>
                  <span style={{ fontSize: 12, color: 'var(--base-content)', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* urgency alert */}
            {(op.daysRemaining <= 3) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: `color-mix(in srgb, ${conf.color}, transparent 88%)`,
                  border: `1px solid color-mix(in srgb, ${conf.color}, transparent 60%)`,
                  borderRadius: 'var(--r-field)',
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: conf.color, fontSize: 12, fontWeight: 600,
                }}
              >
                <AlertTriangle size={14} />
                Follow-up window closing soon — contact patient to schedule.
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── op card ──────────────────────────────────────────────────────────────────

function OPCard({ op, index, onClick }) {
  const days = op.daysRemaining || 0;
  const conf = urgencyConfig(days);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 280, damping: 22 }}
      whileHover={{ y: -4 }}
      style={{
        background: 'var(--base-100)',
        border: `1px solid color-mix(in srgb, ${conf.color}, transparent 70%)`,
        borderRadius: 'var(--r-box)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.3s',
      }}
      className="shadow-sm hover:shadow-md"
      onClick={onClick}
    >
      {/* urgency top bar */}
      <div style={{ height: 3, background: conf.color }} />

      <div style={{ padding: '16px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <DaysRing days={days} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-montserrat)', fontWeight: 900, fontSize: 13, color: 'var(--base-content)', marginBottom: 2 }}>
              {op.opNumber}
            </p>
            <UrgencyBadge days={days} />
          </div>
        </div>

        {/* info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <RowItem icon={User}       label={op.patient?.name || '—'} />
          <RowItem icon={Stethoscope} label={op.doctor?.user?.name || '—'} sub={op.doctor?.specialization} />
          <RowItem icon={Calendar}   label={`Expires ${fmtDate(op.followUpExpiry)}`} />
          {op.followUpFee != null && (
            <RowItem icon={TrendingUp} label={`Follow-up fee: ₹${op.followUpFee}`} />
          )}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px',
            background: `color-mix(in srgb, ${conf.color}, transparent 90%)`,
            borderRadius: 'var(--r-field)',
            border: `1px solid color-mix(in srgb, ${conf.color}, transparent 65%)`,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: conf.color }}>
              View Details
            </span>
            <Eye size={12} style={{ color: conf.color }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RowItem({ icon: Icon, label, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <Icon size={11} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
      <div>
        <span style={{ fontSize: 11, color: 'var(--base-content)', fontWeight: 600 }}>{label}</span>
        {sub && <div style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── expiry timeline chart ────────────────────────────────────────────────────

function ExpiryTimeline({ ops }) {
  if (!ops || ops.length === 0) return null;

  // group by days-remaining bucket
  const buckets = { '1d': 0, '3d': 0, '7d': 0, '14d': 0, '30d': 0 };
  ops.forEach(op => {
    const d = op.daysRemaining || 0;
    if (d <= 1)  buckets['1d']++;
    else if (d <= 3)  buckets['3d']++;
    else if (d <= 7)  buckets['7d']++;
    else if (d <= 14) buckets['14d']++;
    else buckets['30d']++;
  });

  const data = [
    { name: '≤1d',  count: buckets['1d'],  fill: 'var(--error)' },
    { name: '1-3d', count: buckets['3d'],  fill: 'var(--warning)' },
    { name: '3-7d', count: buckets['7d'],  fill: 'var(--info)' },
    { name: '7-14d',count: buckets['14d'], fill: 'var(--primary)' },
    { name: '>14d', count: buckets['30d'], fill: 'var(--success)' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      style={{
        background: 'var(--base-100)',
        border: '1px solid var(--base-300)',
        borderRadius: 'var(--r-box)',
        padding: '18px 20px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <p style={{ fontFamily: 'var(--font-montserrat)', fontWeight: 800, fontSize: 14, color: 'var(--base-content)', marginBottom: 14 }}>
        Expiry Distribution
      </p>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)' }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: 'var(--primary)', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* urgency legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.fill }} />
            <span style={{ fontSize: 10, color: 'var(--base-content)', fontWeight: 600 }}>{d.name}: {d.count}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function FollowUpTracker() {
  const dispatch  = useDispatch();
  const hospital  = useSelector(selectHospital);
  const ops       = useSelector(selectHospitalValidOps);
  const meta      = useSelector(selectHospitalValidOpsMeta);

  const [selectedOp, setSelectedOp]   = useState(null);
  const [search, setSearch]           = useState('');
  const [urgencyFilter, setUrgency]   = useState('all');
  const [page, setPage]               = useState(1);
  const LIMIT = 12;

  const hospitalId = hospital?._id;

  const load = useCallback((p = 1) => {
    if (!hospitalId) return;
    dispatch(fetchHospitalValidOps({ hospitalId, page: p, limit: LIMIT }));
  }, [dispatch, hospitalId]);

  useEffect(() => { load(page); }, [load, page]);

  const isLoading = meta.status === 'loading';

  // filter + search client-side
  const filtered = (ops || []).filter(op => {
    const days = op.daysRemaining || 0;
    const matchUrgency =
      urgencyFilter === 'all' ? true :
      urgencyFilter === 'critical' ? days <= 1 :
      urgencyFilter === 'urgent'   ? days <= 3 :
      urgencyFilter === 'week'     ? days <= 7 :
      true;

    const q = search.toLowerCase();
    const matchSearch = !q ||
      op.opNumber?.toLowerCase().includes(q) ||
      op.patient?.name?.toLowerCase().includes(q) ||
      op.doctor?.user?.name?.toLowerCase().includes(q);

    return matchUrgency && matchSearch;
  });

  // stat counts
  const critical = (ops || []).filter(o => o.daysRemaining <= 1).length;
  const urgent   = (ops || []).filter(o => o.daysRemaining <= 3 && o.daysRemaining > 1).length;
  const thisWeek = (ops || []).filter(o => o.daysRemaining <= 7 && o.daysRemaining > 3).length;
  const safe     = (ops || []).filter(o => o.daysRemaining > 7).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--base-200)', fontFamily: 'var(--font-poppins)' }}>

      {/* header */}
      <div style={{
        background: 'linear-gradient(135deg, #6d28d9 0%, var(--secondary) 50%, var(--primary) 100%)',
        padding: '32px 24px 56px',
        position: 'relative', overflow: 'hidden',
      }}>
        {[
          { size: 200, top: -60, right: -60, op: 0.07 },
          { size: 120, bottom: -30, left: 80, op: 0.05 },
        ].map((c, i) => (
          <div key={i} style={{
            position: 'absolute', width: c.size, height: c.size, borderRadius: '50%',
            background: `rgba(255,255,255,${c.op})`,
            top: c.top, right: c.right, bottom: c.bottom, left: c.left,
          }} />
        ))}
        <div className="max-w-7xl mx-auto relative">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Repeat2 size={18} style={{ color: 'rgba(255,255,255,0.8)' }} />
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Hospital · Follow-Up Tracker
              </p>
            </div>
            <h1 style={{ fontFamily: 'var(--font-montserrat)', fontWeight: 900, fontSize: 'clamp(22px,4vw,30px)', color: '#fff', marginBottom: 4 }}>
              Active Follow-Up Windows
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              {meta.total ?? 0} OPs with open follow-up eligibility
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-2"  >

        {/* urgency stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Critical (≤1d)', val: critical, color: 'var(--error)',   icon: Zap },
            { label: 'Urgent (≤3d)',   val: urgent,   color: 'var(--warning)', icon: AlertTriangle },
            { label: 'This Week',      val: thisWeek, color: 'var(--info)',    icon: Clock },
            { label: 'Safe (>7d)',      val: safe,     color: 'var(--success)', icon: CheckCircle2 },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setUrgency(
                s.label.startsWith('Critical') ? 'critical' :
                s.label.startsWith('Urgent') ? 'urgent' :
                s.label.startsWith('This Week') ? 'week' : 'all'
              )}
              style={{
                background: 'var(--base-100)',
                border: `1px solid color-mix(in srgb, ${s.color}, transparent 65%)`,
                borderRadius: 'var(--r-box)',
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'transform 0.2s',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: `color-mix(in srgb, ${s.color}, transparent 85%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <s.icon size={17} style={{ color: s.color }} />
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: 'var(--font-montserrat)', lineHeight: 1 }}>{s.val}</p>
                <p style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)', marginTop: 2, fontWeight: 600 }}>{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* expiry timeline chart */}
        <ExpiryTimeline ops={ops} />

        {/* filter bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: 'var(--base-100)',
            border: '1px solid var(--base-300)',
            borderRadius: 'var(--r-box)',
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          {/* search */}
          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search OP, patient, doctor…"
              style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 12, background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', color: 'var(--base-content)', outline: 'none' }}
            />
          </div>

          {/* urgency filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'all',      label: 'All' },
              { key: 'critical', label: '🔴 Critical' },
              { key: 'urgent',   label: '🟡 Urgent' },
              { key: 'week',     label: '🔵 This Week' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setUrgency(tab.key)}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--r-selector)',
                  border: urgencyFilter === tab.key ? 'none' : '1px solid var(--base-300)',
                  background: urgencyFilter === tab.key ? 'var(--primary)' : 'transparent',
                  color: urgencyFilter === tab.key ? 'var(--primary-content)' : 'var(--base-content)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* clear + refresh */}
          {(search || urgencyFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setUrgency('all'); }}
              style={{ padding: '6px 10px', background: 'color-mix(in srgb, var(--error), transparent 88%)', color: 'var(--error)', border: 'none', borderRadius: 'var(--r-field)', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <X size={11} /> Clear
            </button>
          )}

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => load(page)}
            style={{ padding: '7px 10px', background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--base-content)', marginLeft: 'auto' }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </motion.button>
        </motion.div>

        {/* loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: 'var(--base-100)', borderRadius: 'var(--r-box)', border: '1px solid var(--base-300)', height: 200 }}>
                <div style={{ height: 3, background: 'var(--base-300)' }} />
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 0.8, 0.6, 0.9].map((w, j) => (
                    <div key={j} style={{ height: 10, borderRadius: 6, background: 'var(--base-300)', width: `${w * 100}%` }} className="skeleton" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* cards grid */}
        {!isLoading && (
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12 }}
              >
                <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'color-mix(in srgb, var(--primary), transparent 88%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Repeat2 size={28} style={{ color: 'var(--primary)' }} />
                </div>
                <p style={{ fontFamily: 'var(--font-montserrat)', fontWeight: 900, fontSize: 16, color: 'var(--base-content)' }}>
                  No eligible follow-ups
                </p>
                <p style={{ fontSize: 12, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                  OPs with active follow-up windows appear here
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
                {filtered.map((op, i) => (
                  <OPCard key={op._id} op={op} index={i} onClick={() => setSelectedOp(op)} />
                ))}
              </div>
            )}
          </AnimatePresence>
        )}

        {/* pagination */}
        {meta.pages > 1 && !isLoading && (
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            gap: 8, paddingBottom: 32,
          }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ padding: '8px 12px', background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', color: 'var(--base-content)' }}
            >
              <ChevronLeft size={14} />
            </button>

            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)', padding: '0 8px' }}>
              {page} / {meta.pages}
            </span>

            <button
              disabled={page >= meta.pages}
              onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
              style={{ padding: '8px 12px', background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', cursor: page >= meta.pages ? 'not-allowed' : 'pointer', opacity: page >= meta.pages ? 0.4 : 1, display: 'flex', alignItems: 'center', color: 'var(--base-content)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* detail modal */}
      <AnimatePresence>
        {selectedOp && <DetailModal op={selectedOp} onClose={() => setSelectedOp(null)} />}
      </AnimatePresence>
    </div>
  );
}