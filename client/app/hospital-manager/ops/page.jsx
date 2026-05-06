'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  FileText, Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight,
  User, Stethoscope, Building2, Calendar, Clock, CheckCircle2,
  AlertCircle, Activity, Eye, TrendingUp, Loader2, X,
} from 'lucide-react';

import {
  fetchHospitalOps,
  selectHospitalOps,
  selectHospitalOpsMeta,
} from '@/store/slices/operationsSlice';
import { selectHospital } from '@/store/slices/hospitalManagerSlice';

// ─── constants ───────────────────────────────────────────────────────────────

const STATUS_CONF = {
  scheduled:   { label: 'Scheduled',   color: 'var(--info)',    icon: Clock },
  in_progress: { label: 'In Progress', color: 'var(--warning)', icon: Activity },
  completed:   { label: 'Completed',   color: 'var(--success)', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   color: 'var(--error)',   icon: X },
  no_show:     { label: 'No Show',     color: 'var(--error)',   icon: AlertCircle },
};

const PIE_COLORS = [
  'var(--info)', 'var(--warning)', 'var(--success)', 'var(--error)', '#8b5cf6',
];

const SPECIALIZATIONS = [
  'General Physician', 'Cardiologist', 'Neurologist', 'Pediatrician',
  'Orthopedic Surgeon', 'Gastroenterologist', 'Gynecologist', 'Dermatologist',
];

const fmt = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const conf = STATUS_CONF[status] || { label: status, color: 'var(--neutral)', icon: FileText };
  const Icon = conf.icon;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 'var(--r-selector)',
        background: `color-mix(in srgb, ${conf.color}, transparent 85%)`,
        color: conf.color,
        border: `1px solid color-mix(in srgb, ${conf.color}, transparent 65%)`,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={10} />
      {conf.label}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: 'var(--base-100)',
        border: '1px solid var(--base-300)',
        borderRadius: 'var(--r-box)',
        padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        background: `color-mix(in srgb, ${color}, transparent 85%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--base-content)', fontFamily: 'var(--font-montserrat)', lineHeight: 1 }}>
          {value ?? '—'}
        </p>
        <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)', marginTop: 2, fontWeight: 600 }}>
          {label}
        </p>
      </div>
    </motion.div>
  );
}

// ─── detail drawer ────────────────────────────────────────────────────────────

function OPDrawer({ op, onClose }) {
  if (!op) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'flex-end',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 480,
            background: 'var(--base-100)',
            height: '100%', overflowY: 'auto',
            boxShadow: '-10px 0 40px rgba(0,0,0,0.15)',
          }}
        >
          {/* drawer header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            padding: '24px 24px 28px',
            position: 'relative',
          }}>
            <button onClick={onClose} style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}>
              <X size={16} />
            </button>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              OP Record
            </p>
            <p style={{ color: '#fff', fontFamily: 'var(--font-montserrat)', fontWeight: 900, fontSize: 22, marginTop: 2 }}>
              {op.opNumber}
            </p>
            <div style={{ marginTop: 10 }}>
              <StatusBadge status={op.status} />
            </div>
          </div>

          <div style={{ padding: 24 }}>
            {/* sections */}
            {[
              {
                title: 'Patient Info',
                rows: [
                  ['Name', op.patient?.name],
                  ['Phone', op.patient?.phone],
                  ['Email', op.patient?.email],
                ],
              },
              {
                title: 'Consultation',
                rows: [
                  ['Type', op.consultationType],
                  ['Scheduled', fmt(op.scheduledAt)],
                  ['Completed', op.completedAt ? fmt(op.completedAt) : '—'],
                  ['Is Follow-up', op.isFollowUp ? 'Yes' : 'No'],
                ],
              },
              {
                title: 'Doctor',
                rows: [
                  ['Name', op.doctor?.user?.name || '—'],
                  ['Specialization', op.doctor?.specialization],
                  ['Reg. No', op.doctor?.registrationNumber],
                ],
              },
              {
                title: 'Clinical Notes',
                rows: [
                  ['Doctor Notes', op.doctorNotes || '—'],
                  ['Diagnosis Code', op.diagnosisCode || '—'],
                  ['Reason for Visit', op.reasonForVisit || '—'],
                ],
              },
              {
                title: 'Booking',
                rows: [
                  ['Code', op.booking?.bookingCode],
                  ['Type', op.booking?.bookingType],
                  ['Total', op.booking?.fareBreakdown?.totalAmount != null ? `₹${op.booking.fareBreakdown.totalAmount}` : '—'],
                  ['Payment', op.booking?.paymentStatus],
                ],
              },
            ].map(section => (
              <div key={section.title} style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {section.title}
                </p>
                <div style={{
                  background: 'var(--base-200)',
                  border: '1px solid var(--base-300)',
                  borderRadius: 'var(--r-field)',
                  overflow: 'hidden',
                }}>
                  {section.rows.map(([k, v], i) => (
                    <div key={k} style={{
                      display: 'flex', gap: 12, padding: '9px 14px',
                      borderBottom: i < section.rows.length - 1 ? '1px solid var(--base-300)' : 'none',
                    }}>
                      <span style={{ width: 110, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{k}</span>
                      <span style={{ fontSize: 12, color: 'var(--base-content)', wordBreak: 'break-word' }}>{v || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* follow-up info */}
            {op.followUpExpiry && (
              <div style={{
                background: 'color-mix(in srgb, var(--info), transparent 88%)',
                border: '1px solid color-mix(in srgb, var(--info), transparent 65%)',
                borderRadius: 'var(--r-field)',
                padding: '12px 14px',
                fontSize: 12,
                color: 'var(--info)',
              }}>
                <strong>Follow-Up Expiry:</strong> {fmtDate(op.followUpExpiry)}
                {op.followUpFee != null && <span> · Fee: ₹{op.followUpFee}</span>}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── table row ────────────────────────────────────────────────────────────────

function OPRow({ op, index, onClick }) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'background 0.15s' }}
      className="hover:bg-base-200/60"
    >
      <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-montserrat)' }}>
        {op.opNumber}
      </td>
      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--base-content)', fontWeight: 600 }}>
        {op.patient?.name || '—'}
      </td>
      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--base-content)' }}>
        {op.doctor?.user?.name || '—'}
        {op.doctor?.specialization && (
          <div style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', marginTop: 1 }}>
            {op.doctor.specialization}
          </div>
        )}
      </td>
      <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--base-content)' }}>
        {fmt(op.scheduledAt)}
      </td>
      <td style={{ padding: '12px 14px' }}>
        <StatusBadge status={op.status} />
      </td>
      <td style={{ padding: '12px 14px', fontSize: 11 }}>
        {op.consultationType || '—'}
      </td>
      <td style={{ padding: '12px 14px', fontSize: 12 }}>
        {op.booking?.fareBreakdown?.totalAmount != null ? (
          <span style={{ fontWeight: 700, color: 'var(--success)' }}>₹{op.booking.fareBreakdown.totalAmount}</span>
        ) : '—'}
      </td>
      <td style={{ padding: '12px 14px' }}>
        <button
          style={{
            background: 'color-mix(in srgb, var(--primary), transparent 88%)',
            color: 'var(--primary)',
            border: 'none',
            borderRadius: 'var(--r-selector)',
            padding: '5px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Eye size={11} /> View
        </button>
      </td>
    </motion.tr>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function AllOPRecords() {
  const dispatch  = useDispatch();
  const hospital  = useSelector(selectHospital);
  const ops       = useSelector(selectHospitalOps);
  const meta      = useSelector(selectHospitalOpsMeta);

  const [selectedOp, setSelectedOp] = useState(null);
  const [filters, setFilters]       = useState({ status: '', doctorId: '', date: '', page: 1, limit: 15 });
  const [search, setSearch]         = useState('');

  const hospitalId = hospital?._id;

  const load = useCallback((overrides = {}) => {
    if (!hospitalId) return;
    const params = { ...filters, ...overrides };
    // strip empty
    Object.keys(params).forEach(k => { if (params[k] === '') delete params[k]; });
    dispatch(fetchHospitalOps({ hospitalId, ...params }));
  }, [dispatch, hospitalId, filters]);

  useEffect(() => { load(); }, [load]);

  const isLoading = meta.status === 'loading';

  // derive chart data from current ops (approximation — full dataset ideally from /stats)
  const statusCounts = (ops || []).reduce((acc, op) => {
    acc[op.status] = (acc[op.status] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: STATUS_CONF[name]?.label || name, value,
  }));

  const totalRevenue = (ops || []).reduce((sum, op) => sum + (op.booking?.fareBreakdown?.totalAmount || 0), 0);

  // client-side search filter
  const filtered = (ops || []).filter(op => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      op.opNumber?.toLowerCase().includes(q) ||
      op.patient?.name?.toLowerCase().includes(q) ||
      op.doctor?.user?.name?.toLowerCase().includes(q)
    );
  });

  const setFilter = (key, val) => {
    const next = { ...filters, [key]: val, page: 1 };
    setFilters(next);
  };

  const changePage = (p) => {
    const next = { ...filters, page: p };
    setFilters(next);
    load({ page: p });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--base-200)', fontFamily: 'var(--font-poppins)' }}>

      {/* header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
        padding: '32px 24px 56px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div className="max-w-7xl mx-auto relative">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              Hospital · {hospital?.name || 'OP Management'}
            </p>
            <h1 style={{ fontFamily: 'var(--font-montserrat)', fontWeight: 900, fontSize: 'clamp(22px,4vw,30px)', color: '#fff' }}>
              All OP Records
            </h1>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto  mt-2"  >

        {/* stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total OPs"    value={meta.total}                                              icon={FileText}    color="var(--primary)" delay={0}    />
          <StatCard label="Completed"    value={statusCounts['completed'] || 0}                          icon={CheckCircle2} color="var(--success)" delay={0.05} />
          <StatCard label="In Progress"  value={statusCounts['in_progress'] || 0}                        icon={Activity}    color="var(--warning)" delay={0.1}  />
          <StatCard label="Revenue"      value={totalRevenue ? `₹${totalRevenue.toLocaleString('en-IN')}` : '₹0'} icon={TrendingUp}  color="var(--accent)"   delay={0.15} />
        </div>

        {/* charts row */}
        {ops && ops.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: 'var(--base-100)',
              border: '1px solid var(--base-300)',
              borderRadius: 'var(--r-box)',
              padding: '20px',
              marginBottom: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <p style={{ fontFamily: 'var(--font-montserrat)', fontWeight: 800, fontSize: 14, color: 'var(--base-content)', marginBottom: 16 }}>
              Status Distribution (Current View)
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: '1 1 260px', height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                      {pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: '2 1 300px', height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pieData} barSize={32}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {/* filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            background: 'var(--base-100)',
            border: '1px solid var(--base-300)',
            borderRadius: 'var(--r-box)',
            padding: '14px 16px',
            marginBottom: 20,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
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

          {/* status filter */}
          <select
            value={filters.status}
            onChange={e => setFilter('status', e.target.value)}
            style={{ padding: '7px 10px', fontSize: 12, background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', color: 'var(--base-content)', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          {/* date filter */}
          <input
            type="date"
            value={filters.date}
            onChange={e => setFilter('date', e.target.value)}
            style={{ padding: '7px 10px', fontSize: 12, background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', color: 'var(--base-content)', outline: 'none', cursor: 'pointer' }}
          />

          {/* clear */}
          {(filters.status || filters.date || search) && (
            <button
              onClick={() => { setFilters({ status: '', doctorId: '', date: '', page: 1, limit: 15 }); setSearch(''); }}
              style={{ padding: '7px 12px', fontSize: 12, background: 'color-mix(in srgb, var(--error), transparent 88%)', color: 'var(--error)', border: 'none', borderRadius: 'var(--r-field)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <X size={12} /> Clear
            </button>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => load()}
              style={{ padding: '7px 10px', background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--base-content)' }}
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            </motion.button>
          </div>
        </motion.div>

        {/* table card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: 'var(--base-100)',
            border: '1px solid var(--base-300)',
            borderRadius: 'var(--r-box)',
            overflow: 'hidden',
            marginBottom: 32,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--primary)' }}>
              <Loader2 size={22} className="animate-spin" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Loading records…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
              <FileText size={36} style={{ color: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--base-content)' }}>No OP records found</p>
              <p style={{ fontSize: 12, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Try adjusting your filters</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--base-200)', borderBottom: '1px solid var(--base-300)' }}>
                    {['OP Number', 'Patient', 'Doctor', 'Scheduled', 'Status', 'Type', 'Amount', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'color-mix(in oklch, var(--base-content) 55%, transparent)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((op, i) => (
                    <OPRow key={op._id} op={op} index={i} onClick={() => setSelectedOp(op)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* pagination */}
          {meta.pages > 1 && (
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--base-300)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 8,
            }}>
              <p style={{ fontSize: 12, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                Page {meta.page} of {meta.pages} · {meta.total} records
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={meta.page <= 1}
                  onClick={() => changePage(meta.page - 1)}
                  style={{ padding: '6px 10px', background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', cursor: meta.page <= 1 ? 'not-allowed' : 'pointer', opacity: meta.page <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', color: 'var(--base-content)' }}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(meta.pages, 5) }, (_, i) => {
                  const p = Math.max(1, meta.page - 2) + i;
                  if (p > meta.pages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => changePage(p)}
                      style={{
                        width: 32, height: 32, borderRadius: 'var(--r-field)',
                        border: 'none',
                        background: p === meta.page ? 'var(--primary)' : 'var(--base-200)',
                        color: p === meta.page ? 'var(--primary-content)' : 'var(--base-content)',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  disabled={meta.page >= meta.pages}
                  onClick={() => changePage(meta.page + 1)}
                  style={{ padding: '6px 10px', background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', cursor: meta.page >= meta.pages ? 'not-allowed' : 'pointer', opacity: meta.page >= meta.pages ? 0.4 : 1, display: 'flex', alignItems: 'center', color: 'var(--base-content)' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* detail drawer */}
      <OPDrawer op={selectedOp} onClose={() => setSelectedOp(null)} />
    </div>
  );
}