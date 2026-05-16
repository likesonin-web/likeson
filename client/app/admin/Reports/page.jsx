'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, Calendar, Users, Stethoscope,
  TrendingUp, BarChart2, RefreshCw, Filter, Search,
  AlertCircle, ChevronLeft, ChevronRight, ArrowUpRight,
  ArrowDownRight, DollarSign, Activity, CheckCircle2,
  XCircle, Clock, Building2, MapPin, Phone, Mail,
  ShieldCheck, Star, Eye, Table2, AreaChart as AreaChartIcon,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, LineChart, Line,
} from 'recharts';

import {
  fetchReportBookings,
  fetchReportRevenue,
  fetchReportUsers,
  fetchReportDoctors,
  resetReportBookings,
  resetReportRevenue,
  resetReportUsers,
  resetReportDoctors,

  selectReportBookingsLoading, selectReportBookingsError, selectReportBookingsFlat,
  selectReportRevenueLoading,  selectReportRevenueError,  selectReportRevenueData,
  selectDailyRevenue,          selectRevenueByType,
  selectReportUsersLoading,    selectReportUsersError,    selectReportUsersList, selectReportUsersByRole,
  selectReportDoctorsLoading,  selectReportDoctorsError,  selectReportDoctorsFlat,
} from '@/store/slices/adminAnalyticsSlice';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt  = (n, d = 0)  => n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d });
const fmtC = (n)         => n == null ? '—' : `₹${fmt(n, 2)}`;
const fmtDate = (d)      => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const pct  = (a, b)      => b ? +((a / b) * 100).toFixed(1) : 0;

const CHART_COLORS = [
  'var(--primary)', 'var(--secondary)', 'var(--accent)',
  'var(--success)', 'var(--warning)', 'var(--info)',
  'oklch(55% 0.24 285)', 'oklch(48% 0.24 18)',
];

const REPORT_TABS = [
  { id: 'bookings', label: 'Bookings',  Icon: Calendar,    color: 'primary'   },
  { id: 'revenue',  label: 'Revenue',   Icon: TrendingUp,  color: 'success'   },
  { id: 'users',    label: 'Users',     Icon: Users,       color: 'secondary' },
  { id: 'doctors',  label: 'Doctors',   Icon: Stethoscope, color: 'info'      },
];

const STATUS_COLOR = {
  completed:   'success',
  pending:     'warning',
  confirmed:   'info',
  cancelled:   'error',
  no_show:     'error',
  in_progress: 'primary',
  paid:        'success',
  unpaid:      'error',
};

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs shadow-xl border border-primary/20 min-w-36">
      <p className="font-bold mb-1.5 text-base-content">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.fill ?? p.stroke ?? p.color }} />
            <span className="text-base-content/60">{p.name}</span>
          </div>
          <span className="font-bold">
            {p.name?.toLowerCase().includes('revenue') || p.name?.toLowerCase().includes('₹')
              ? fmtC(p.value) : fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── CSV export ───────────────────────────────────────────────────────────────

const exportCSV = (data, filename) => {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(','), ...data.map(r =>
    keys.map(k => JSON.stringify(r[k] ?? '')).join(',')
  )];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${filename}_${Date.now()}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

// ─── Shared components ────────────────────────────────────────────────────────

const Badge = ({ status, label }) => {
  const color = STATUS_COLOR[status] ?? 'neutral';
  return (
    <span className={`badge badge-${color} badge-xs capitalize`}>{label ?? status ?? '—'}</span>
  );
};

const EmptyState = ({ icon: Icon, label }) => (
  <div className="flex flex-col items-center justify-center py-16 text-base-content/30">
    <Icon size={36} className="mb-2 opacity-30" />
    <p className="text-xs">{label}</p>
  </div>
);

const Loader = () => (
  <div className="flex items-center justify-center py-16">
    <div className="loading loading-lg" />
  </div>
);

// ─── BOOKINGS REPORT ─────────────────────────────────────────────────────────

const BookingsReport = ({ from, to, limit }) => {
  const dispatch = useDispatch();
  const loading  = useSelector(selectReportBookingsLoading);
  const error    = useSelector(selectReportBookingsError);
  const flat     = useSelector(selectReportBookingsFlat);

  const [search, setSearch] = useState('');
  const [pg, setPg]         = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    const p = { limit };
    if (from) p.from = from;
    if (to)   p.to   = to;
    dispatch(fetchReportBookings(p));
    return () => dispatch(resetReportBookings());
  }, [from, to, limit, dispatch]);

  //  FIX
const flatArray = Array.isArray(flat) ? flat : (flat?.bookings || flat?.data || []);

const rows = flatArray.filter(r =>
  !search ||
  r.bookingCode?.toLowerCase().includes(search.toLowerCase()) ||
  r.customerName?.toLowerCase().includes(search.toLowerCase()) ||
  r.doctorName?.toLowerCase().includes(search.toLowerCase()) ||
  r.hospitalName?.toLowerCase().includes(search.toLowerCase())
);

  const totalPages = Math.ceil(rows.length / PER_PAGE);
  const pageRows   = rows.slice((pg - 1) * PER_PAGE, pg * PER_PAGE);

  // Summary from data
  const totalRevenue = (flat ?? []).reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const paid         = (flat ?? []).filter(r => r.paymentStatus === 'paid').length;
  const completed    = (flat ?? []).filter(r => r.status === 'completed').length;

  return (
    <div className="space-y-4">
      {error && <div className="alert alert-error"><AlertCircle size={16} /><p className="text-xs">{error}</p></div>}

      {/* Mini stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Records', value: fmt(flat?.length),   color: 'primary' },
          { label: 'Revenue',       value: fmtC(totalRevenue),  color: 'success' },
          { label: 'Paid',          value: fmt(paid),            color: 'info' },
          { label: 'Completed',     value: fmt(completed),       color: 'accent' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl p-4 border border-base-300"
            style={{ background: `color-mix(in srgb, var(--${s.color}), transparent 93%)` }}>
            <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider">{s.label}</p>
            <p className="text-lg font-extrabold mt-0.5" style={{ color: `var(--${s.color})`, fontFamily: 'var(--font-family-montserrat)' }}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 gap-3 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input className="input-field pl-8 text-xs py-1.5 w-52"
              placeholder="Code, patient, doctor…"
              value={search} onChange={e => { setSearch(e.target.value); setPg(1); }} />
          </div>
          <button className="btn btn-sm btn-outline gap-1.5"
            onClick={() => exportCSV(flat ?? [], 'bookings_report')}>
            <Download size={13} />Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? <Loader /> : rows.length === 0 ? (
            <EmptyState icon={Calendar} label="No bookings data" />
          ) : (
            <table className="table text-xs">
              <thead>
                <tr>
                  <th>Booking Code</th><th>Type</th><th>Customer</th>
                  <th>Patient</th><th>Doctor</th><th>Hospital</th>
                  <th>Scheduled</th><th>Amount</th><th>Payment</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}>
                    <td><span className="font-mono font-bold text-xs" style={{ color: 'var(--primary)' }}>{r.bookingCode}</span></td>
                    <td><span className="badge badge-secondary badge-xs capitalize">{r.bookingType?.replace(/_/g,' ')}</span></td>
                    <td>
                      <div>
                        <p className="font-semibold">{r.customerName ?? '—'}</p>
                        <p className="text-base-content/40">{r.customerPhone}</p>
                      </div>
                    </td>
                    <td>{r.patientName ?? '—'} {r.patientAge ? `(${r.patientAge})` : ''}</td>
                    <td>
                      <div>
                        <p className="font-semibold">{r.doctorName ?? '—'}</p>
                        <p className="text-base-content/40">{r.specialization}</p>
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="font-semibold">{r.hospitalName ?? '—'}</p>
                        <p className="text-base-content/40">{r.hospitalCity}</p>
                      </div>
                    </td>
                    <td>{fmtDate(r.scheduledAt)}</td>
                    <td><span className="font-bold" style={{ color: 'var(--success)' }}>{fmtC(r.totalAmount)}</span></td>
                    <td><Badge status={r.paymentStatus} /></td>
                    <td><Badge status={r.status} /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-base-300">
            <p className="text-xs text-base-content/50">Page {pg} of {totalPages} · {fmt(rows.length)} records</p>
            <div className="flex items-center gap-1">
              <button className="btn btn-ghost btn-xs btn-circle" disabled={pg <= 1} onClick={() => setPg(p => p - 1)}><ChevronLeft size={13} /></button>
              <span className="text-xs font-bold px-2">{pg}</span>
              <button className="btn btn-ghost btn-xs btn-circle" disabled={pg >= totalPages} onClick={() => setPg(p => p + 1)}><ChevronRight size={13} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── REVENUE REPORT ───────────────────────────────────────────────────────────

const RevenueReport = ({ from, to }) => {
  const dispatch = useDispatch();
  const loading  = useSelector(selectReportRevenueLoading);
  const error    = useSelector(selectReportRevenueError);
  const data     = useSelector(selectReportRevenueData);
  const daily    = useSelector(selectDailyRevenue);
  const byType   = useSelector(selectRevenueByType);

  const [view, setView] = useState('chart'); // chart | table

  useEffect(() => {
    const p = {};
    if (from) p.from = from;
    if (to)   p.to   = to;
    dispatch(fetchReportRevenue(p));
    return () => dispatch(resetReportRevenue());
  }, [from, to, dispatch]);

  const bookingTotal  = data?.totals?.bookings  ?? 0;
  const pharmacyTotal = data?.totals?.pharmacy  ?? 0;
  const grandTotal    = bookingTotal + pharmacyTotal;

  const pieData = [
    { name: 'Bookings',  value: bookingTotal  },
    { name: 'Pharmacy',  value: pharmacyTotal },
  ];

  const bookingTypeData = (data?.bookingRevenue?.byType ?? []).map(b => ({
    name:    (b._id ?? 'Other').replace(/_/g, ' '),
    revenue: b.revenue ?? 0,
    count:   b.count   ?? 0,
  }));

  return (
    <div className="space-y-4">
      {error && <div className="alert alert-error"><AlertCircle size={16} /><p className="text-xs">{error}</p></div>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Grand Total',       value: fmtC(grandTotal),    color: 'success' },
          { label: 'Booking Revenue',   value: fmtC(bookingTotal),  color: 'primary' },
          { label: 'Pharmacy Revenue',  value: fmtC(pharmacyTotal), color: 'accent' },
          { label: 'Platform Fees',     value: fmtC((data?.bookingRevenue?.byType ?? []).reduce((s, b) => s + (b.platform ?? 0), 0)), color: 'info' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl p-4 border border-base-300"
            style={{ background: `color-mix(in srgb, var(--${s.color}), transparent 93%)` }}>
            <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider">{s.label}</p>
            <p className="text-lg font-extrabold mt-0.5" style={{ color: `var(--${s.color})`, fontFamily: 'var(--font-family-montserrat)' }}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <div className="card"><Loader /></div>
      ) : (
        <>
          {/* Daily revenue area chart */}
          {(daily ?? []).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold flex items-center gap-2">
                  <AreaChartIcon size={14} style={{ color: 'var(--success)' }} />
                  Daily Revenue Trend
                </h3>
                <div className="flex rounded-lg border border-base-300 overflow-hidden">
                  {['chart','table'].map(v => (
                    <button key={v} onClick={() => setView(v)}
                      className={`px-3 py-1 text-xs font-bold capitalize transition-all ${view === v ? 'text-primary-content' : 'text-base-content/50'}`}
                      style={view === v ? { background: 'var(--primary)' } : {}}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {view === 'chart' ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={daily} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                    <XAxis dataKey="_id" tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}
                      tickFormatter={v => v?.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}
                      tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="var(--success)"
                      strokeWidth={2.5} fill="url(#revGrad)" dot={false} />
                    <Area type="monotone" dataKey="count" name="Bookings" stroke="var(--primary)"
                      strokeWidth={2} fill="none" strokeDasharray="4 2" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="overflow-x-auto max-h-60">
                  <table className="table text-xs">
                    <thead><tr><th>Date</th><th>Revenue</th><th>Bookings</th></tr></thead>
                    <tbody>
                      {daily.map((d, i) => (
                        <tr key={i}>
                          <td>{d._id}</td>
                          <td className="font-bold" style={{ color: 'var(--success)' }}>{fmtC(d.revenue)}</td>
                          <td>{fmt(d.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Revenue split row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Revenue pie */}
            <div className="card p-5">
              <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
                <DollarSign size={14} style={{ color: 'var(--accent)' }} />
                Revenue Split
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%"
                    innerRadius={55} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={4}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => fmtC(v)} content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Booking type revenue */}
            {bookingTypeData.length > 0 && (
              <div className="card p-5">
                <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
                  <BarChart2 size={14} style={{ color: 'var(--primary)' }} />
                  Revenue by Booking Type
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={bookingTypeData} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" name="Revenue (₹)" radius={[0, 4, 4, 0]}>
                      {bookingTypeData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── USERS REPORT ─────────────────────────────────────────────────────────────

const UsersReport = ({ from, to }) => {
  const dispatch = useDispatch();
  const loading  = useSelector(selectReportUsersLoading);
  const error    = useSelector(selectReportUsersError);
  const list     = useSelector(selectReportUsersList);
  const byRole   = useSelector(selectReportUsersByRole);

  const [search, setSearch] = useState('');
  const [pg, setPg]         = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    const p = {};
    if (from) p.from = from;
    if (to)   p.to   = to;
    dispatch(fetchReportUsers(p));
    return () => dispatch(resetReportUsers());
  }, [from, to, dispatch]);

  //  FIXES THE CRASH safely
const usersArray = Array.isArray(list) ? list : (list?.users || list?.data || []);

const rows = usersArray.filter(u =>
  !search ||
  u.name?.toLowerCase().includes(search.toLowerCase()) ||
  u.email?.toLowerCase().includes(search.toLowerCase()) ||
  u.phone?.includes(search) ||
  u.role?.toLowerCase().includes(search.toLowerCase())
);

  const totalPages = Math.ceil(rows.length / PER_PAGE);
  const pageRows   = rows.slice((pg - 1) * PER_PAGE, pg * PER_PAGE);

  const roleChartData = (byRole ?? []).map(r => ({
    role:     r._id ?? 'Unknown',
    count:    r.count,
    blocked:  r.blocked,
    verified: r.emailVerified,
  }));

  return (
    <div className="space-y-4">
      {error && <div className="alert alert-error"><AlertCircle size={16} /><p className="text-xs">{error}</p></div>}

      {/* Role chart */}
      {!loading && roleChartData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
            <Users size={14} style={{ color: 'var(--secondary)' }} />
            Users by Role
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={roleChartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis dataKey="role" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count"    name="Total"   radius={[4, 4, 0, 0]} fill="var(--secondary)" />
              <Bar dataKey="verified" name="Verified" radius={[4, 4, 0, 0]} fill="var(--success)" />
              <Bar dataKey="blocked"  name="Blocked"  radius={[4, 4, 0, 0]} fill="var(--error)" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 gap-3 flex-wrap">
          <h3 className="text-xs font-bold flex items-center gap-2">
            <Users size={14} style={{ color: 'var(--secondary)' }} />
            User Records
            <span className="badge badge-secondary badge-xs">{fmt(rows.length)}</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input className="input-field pl-8 text-xs py-1.5 w-48"
                placeholder="Name, email, role…"
                value={search} onChange={e => { setSearch(e.target.value); setPg(1); }} />
            </div>
            <button className="btn btn-sm btn-outline gap-1.5" onClick={() => exportCSV(list ?? [], 'users_report')}>
              <Download size={13} />CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? <Loader /> : rows.length === 0 ? (
            <EmptyState icon={Users} label="No users data" />
          ) : (
            <table className="table text-xs">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Phone</th><th>Role</th>
                  <th>Verified</th><th>Status</th><th>Coins</th><th>Joined</th><th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((u, i) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{ background: 'color-mix(in srgb, var(--secondary), transparent 85%)', color: 'var(--secondary)' }}>
                          {(u.name ?? '?')[0].toUpperCase()}
                        </div>
                        <span className="font-semibold">{u.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="text-base-content/60">{u.email ?? '—'}</td>
                    <td className="text-base-content/60">{u.phone ?? '—'}</td>
                    <td><span className="badge badge-secondary badge-xs capitalize">{u.role}</span></td>
                    <td>
                      {u.isEmailVerified
                        ? <CheckCircle2 size={13} className="text-success" />
                        : <XCircle size={13} className="text-error" />}
                    </td>
                    <td>
                      {u.isBlocked
                        ? <span className="badge badge-error badge-xs">Blocked</span>
                        : <span className="badge badge-success badge-xs">Active</span>}
                    </td>
                    <td><span className="font-bold" style={{ color: 'var(--accent)' }}>{fmt(u.coins)}</span></td>
                    <td>{fmtDate(u.createdAt)}</td>
                    <td>{fmtDate(u.lastLoginAt)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-base-300">
            <p className="text-xs text-base-content/50">Page {pg} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button className="btn btn-ghost btn-xs btn-circle" disabled={pg <= 1} onClick={() => setPg(p => p - 1)}><ChevronLeft size={13} /></button>
              <span className="text-xs font-bold px-2">{pg}</span>
              <button className="btn btn-ghost btn-xs btn-circle" disabled={pg >= totalPages} onClick={() => setPg(p => p + 1)}><ChevronRight size={13} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── DOCTORS REPORT ───────────────────────────────────────────────────────────

const DoctorsReport = () => {
  const dispatch = useDispatch();
  const loading  = useSelector(selectReportDoctorsLoading);
  const error    = useSelector(selectReportDoctorsError);
  const flat     = useSelector(selectReportDoctorsFlat);

  const [search, setSearch] = useState('');
  const [pg, setPg]         = useState(1);
  const [sortKey, setSortKey] = useState('totalConsultations');
  const PER_PAGE = 20;

  useEffect(() => {
    dispatch(fetchReportDoctors());
    return () => dispatch(resetReportDoctors());
  }, [dispatch]);

  const sorted = [...(flat ?? [])].sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  const rows   = sorted.filter(d =>
    !search ||
    d.doctorName?.toLowerCase().includes(search.toLowerCase()) ||
    d.specialization?.toLowerCase().includes(search.toLowerCase()) ||
    d.primaryHospital?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(rows.length / PER_PAGE);
  const pageRows   = rows.slice((pg - 1) * PER_PAGE, pg * PER_PAGE);

  // Specialty chart
  const specData = (flat ?? []).reduce((acc, d) => {
    const s = d.specialization ?? 'Other';
    const ex = acc.find(a => a.name === s);
    if (ex) { ex.count++; ex.earnings += d.totalEarnings ?? 0; }
    else acc.push({ name: s, count: 1, earnings: d.totalEarnings ?? 0 });
    return acc;
  }, []).sort((a, b) => b.count - a.count).slice(0, 8);

  return (
    <div className="space-y-4">
      {error && <div className="alert alert-error"><AlertCircle size={16} /><p className="text-xs">{error}</p></div>}

      {/* Specialty chart */}
      {!loading && specData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-xs font-bold mb-4 flex items-center gap-2">
            <Stethoscope size={14} style={{ color: 'var(--info)' }} />
            Top Specializations — Doctor Count
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={specData} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }}
                tickFormatter={v => v?.slice(0, 14) ?? v} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Doctors" radius={[0, 4, 4, 0]}>
                {specData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-xs font-bold flex items-center gap-2">
              <Stethoscope size={14} style={{ color: 'var(--info)' }} />
              Doctor Records
              <span className="badge badge-info badge-xs">{fmt(rows.length)}</span>
            </h3>
            <select className="input-field text-xs py-1 w-44"
              value={sortKey} onChange={e => setSortKey(e.target.value)}>
              <option value="totalConsultations">↓ Consultations</option>
              <option value="totalEarnings">↓ Earnings</option>
              <option value="avgRating">↓ Rating</option>
              <option value="profileCompletion">↓ Profile %</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input className="input-field pl-8 text-xs py-1.5 w-48"
                placeholder="Name, specialty…"
                value={search} onChange={e => { setSearch(e.target.value); setPg(1); }} />
            </div>
            <button className="btn btn-sm btn-outline gap-1.5" onClick={() => exportCSV(flat ?? [], 'doctors_report')}>
              <Download size={13} />CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? <Loader /> : rows.length === 0 ? (
            <EmptyState icon={Stethoscope} label="No doctor data" />
          ) : (
            <table className="table text-xs">
              <thead>
                <tr>
                  <th>Doctor</th><th>Specialty</th><th>Hospital</th>
                  <th>KYC</th><th>Rating</th><th>Consultations</th>
                  <th>Earnings</th><th>Pending</th><th>Profile</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((d, i) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{ background: 'color-mix(in srgb, var(--info), transparent 85%)', color: 'var(--info)' }}>
                          {(d.doctorName ?? 'D')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{d.doctorName ?? '—'}</p>
                          <p className="text-base-content/40 text-xs">{d.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>{d.specialization ?? '—'}</td>
                    <td>
                      <div>
                        <p className="font-medium text-xs">{d.primaryHospital ?? '—'}</p>
                        <p className="text-base-content/40 text-xs">{d.hospitalCity}</p>
                      </div>
                    </td>
                    <td><Badge status={d.kycStatus} /></td>
                    <td>
                      {d.avgRating != null ? (
                        <div className="flex items-center gap-1">
                          <Star size={11} fill="var(--warning)" stroke="var(--warning)" />
                          <span className="font-bold">{d.avgRating.toFixed(1)}</span>
                          <span className="text-base-content/40">({d.totalRatings})</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td><span className="font-bold" style={{ color: 'var(--primary)' }}>{fmt(d.totalConsultations)}</span></td>
                    <td><span className="font-bold" style={{ color: 'var(--success)' }}>{fmtC(d.totalEarnings)}</span></td>
                    <td><span className="font-bold" style={{ color: 'var(--warning)' }}>{fmtC(d.pendingSettlement)}</span></td>
                    <td>
                      {d.profileCompletion != null ? (
                        <div className="w-14">
                          <p className="text-xs font-bold mb-0.5">{d.profileCompletion}%</p>
                          <div className="progress-bar" style={{ height: '4px' }}>
                            <div className="progress-bar-fill" style={{ width: `${d.profileCompletion}%` }} />
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        {d.isVerified && <span className="badge badge-success badge-xs gap-1"><ShieldCheck size={8} />Verified</span>}
                        {d.isActive  && <span className="badge badge-info badge-xs">Active</span>}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-base-300">
            <p className="text-xs text-base-content/50">Page {pg} of {totalPages} · {fmt(rows.length)} doctors</p>
            <div className="flex items-center gap-1">
              <button className="btn btn-ghost btn-xs btn-circle" disabled={pg <= 1} onClick={() => setPg(p => p - 1)}><ChevronLeft size={13} /></button>
              <span className="text-xs font-bold px-2">{pg}</span>
              <button className="btn btn-ghost btn-xs btn-circle" disabled={pg >= totalPages} onClick={() => setPg(p => p + 1)}><ChevronRight size={13} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('bookings');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [limit, setLimit]         = useState(1000);
  const [showFilters, setShowFilters] = useState(false);

  const activeReport = REPORT_TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-200)' }}>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="section-heading !mb-1">Reports</h1>
            <p className="section-subheading !mb-0">Exportable analytics — bookings, revenue, users & doctors</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(s => !s)}
              className={`btn btn-sm gap-1 ${showFilters ? 'btn-primary' : 'btn-outline'}`}>
              <Filter size={13} />Date Range
            </button>
          </div>
        </motion.div>

        {/* ── Date filters ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="card p-4 flex flex-wrap gap-3 items-end">
                <div>
                  <label className="label-text text-xs mb-1 block">From</label>
                  <input type="date" className="input-field text-xs py-1.5"
                    value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div>
                  <label className="label-text text-xs mb-1 block">To</label>
                  <input type="date" className="input-field text-xs py-1.5"
                    value={to} onChange={e => setTo(e.target.value)} />
                </div>
                {activeTab === 'bookings' && (
                  <div>
                    <label className="label-text text-xs mb-1 block">Row limit</label>
                    <select className="input-field text-xs py-1.5 w-28"
                      value={limit} onChange={e => setLimit(Number(e.target.value))}>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                      <option value={1000}>1,000</option>
                      <option value={5000}>5,000</option>
                    </select>
                  </div>
                )}
                <button className="btn btn-sm btn-ghost text-xs text-base-content/50"
                  onClick={() => { setFrom(''); setTo(''); }}>
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tab bar ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex gap-2 flex-wrap">
          {REPORT_TABS.map(tab => {
            const Icon = tab.Icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={active ? {
                  background: `var(--${tab.color})`,
                  color: 'var(--primary-content)',
                  boxShadow: `0 4px 14px color-mix(in srgb, var(--${tab.color}), transparent 60%)`,
                } : {
                  background: 'var(--base-100)',
                  color: 'color-mix(in oklch, var(--base-content) 55%, transparent)',
                  border: '1px solid var(--base-300)',
                }}>
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </motion.div>

        {/* ── Active report section ── */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}>

            {activeTab === 'bookings' && <BookingsReport from={from} to={to} limit={limit} />}
            {activeTab === 'revenue'  && <RevenueReport  from={from} to={to} />}
            {activeTab === 'users'  && <UsersReport    from={from} to={to} />}
            {activeTab === 'doctors'&& <DoctorsReport />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}