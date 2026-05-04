'use client';

/**
 * AdminBookingsPage.jsx — Likeson.in
 * Admin/Superadmin booking management dashboard.
 * Uses: operationsSlice thunks + selectors, CSS vars from global.css,
 *       Next.js, Tailwind, Lucide, Framer Motion, Recharts.
 */

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  LayoutDashboard, Search, Filter, RefreshCw, Download,
  ChevronLeft, ChevronRight, Eye, UserCheck, Truck, Building2,
  HeartHandshake, RotateCcw, X, AlertCircle, CheckCircle2,
  Clock, TrendingUp, IndianRupee, Users, CalendarDays,
  MapPin, Stethoscope, FlaskConical, ChevronDown,
  ShieldAlert, SlidersHorizontal, ArrowUpRight,
} from 'lucide-react';

import {
  fetchAdminBookings,
  fetchAdminBookingStats,
  fetchAdminBookingById,
  exportAdminBookings,
  updateAdminBookingStatus,
  fetchNearbySoloDrivers,
  fetchNearbyTPs,
  fetchNearbyCareAssistants,
  fetchNearbyHospitals,
  adminAssignSoloDriver,
  adminAssignTP,
  adminAssignCareAssistant,
  adminAssignHospital,
  adminReassignDriver,
  adminReassignCare,
  adminProcessRefund,
  clearAdminBookingDetail,
  clearNearbyResults,
  resetAdminAssignment,
  resetAdminRefund,
  resetAdminStatusUpdate,
  selectAdminBookings,
  selectAdminBookingsMeta,
  selectAdminBookingsLoading,
  selectAdminBookingDetail,
  selectAdminBookingDetailLoading,
  selectAdminOpRecord,
  selectAdminStats,
  selectAdminStatsLoading,
  selectAdminExportLoading,
  selectAdminStatusUpdate,
  selectNearbySoloDrivers,
  selectNearbyTPs,
  selectNearbyCareAssistants,
  selectNearbyHospitals,
  selectNearbyLoading,
  selectAdminAssignment,
  selectAdminAssignLoading,
  selectAdminRefund,
  selectAdminRefundLoading,
} from '@/store/slices/operationsSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOKING_TYPES = [
  'full_care_ride','doctor_consultation','doctor_online',
  'physiotherapist','care_assistant','diagnostic_center',
  'diagnostic_home','patient_transport','follow_up',
];

const BOOKING_STATUSES = [
  'draft','pending','confirmed','in_progress',
  'completed','cancelled','no_show','refund_pending','refunded',
];

const STATUS_META = {
  draft:         { color: 'var(--neutral)',   bg: 'bg-base-300',   label: 'Draft' },
  pending:       { color: 'var(--warning)',   bg: 'bg-warning/10', label: 'Pending' },
  confirmed:     { color: 'var(--info)',      bg: 'bg-info/10',    label: 'Confirmed' },
  in_progress:   { color: 'var(--primary)',   bg: 'bg-primary/10', label: 'In Progress' },
  completed:     { color: 'var(--success)',   bg: 'bg-success/10', label: 'Completed' },
  cancelled:     { color: 'var(--error)',     bg: 'bg-error/10',   label: 'Cancelled' },
  no_show:       { color: 'var(--error)',     bg: 'bg-error/10',   label: 'No Show' },
  refund_pending:{ color: 'var(--warning)',   bg: 'bg-warning/10', label: 'Refund Pending' },
  refunded:      { color: 'var(--accent)',    bg: 'bg-accent/5',   label: 'Refunded' },
};

const CHART_COLORS = [
  'var(--chart-1)','var(--chart-2)','var(--chart-3)',
  'var(--chart-4)','var(--chart-5)','var(--chart-6)',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { color: 'var(--base-content)', bg: 'bg-base-300', label: status };
  return (
    <span
      className={`badge badge-sm ${meta.bg} font-semibold capitalize`}
      style={{ color: meta.color, borderColor: meta.color + '40' }}
    >
      {meta.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color = 'var(--primary)', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    className="glass-card p-5 flex items-start gap-4"
  >
    <div
      className="rounded-xl p-3 flex-shrink-0"
      style={{ background: `color-mix(in srgb, ${color}, transparent 85%)` }}
    >
      <Icon size={22} style={{ color }} />
    </div>
    <div className="min-w-0">
      <p className="text-base-content/60 text-xs font-semibold uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-base-content font-montserrat leading-none">{value ?? '—'}</p>
      {sub && <p className="text-xs text-base-content/50 mt-1">{sub}</p>}
    </div>
  </motion.div>
);

const NearbyList = ({ items = [], type, onAssign, assignLoading, bookingId }) => {
  if (!items.length) return (
    <p className="text-base-content/40 text-sm text-center py-6">No nearby {type} found.</p>
  );

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
      {items.map((item, i) => {
        const name = item.businessName || item.name || item.legalName || '—';
        const dist = item.distanceKm != null ? `${item.distanceKm} km away` : '';
        const id   = item.soloPartnerId || item.tpId || item.careAssistantId || item.hospitalId || item._id;
        return (
          <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-base-200 border border-base-300">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-base-content truncate">{name}</p>
              <p className="text-xs text-base-content/50">{dist}</p>
            </div>
            <button
              className="btn btn-xs btn-primary flex-shrink-0"
              disabled={assignLoading}
              onClick={() => onAssign({ bookingId, id, type })}
            >
              Assign
            </button>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminBookingsPage() {
  const dispatch = useDispatch();

  // ── Selectors
  const bookings        = useSelector(selectAdminBookings);
  const bookingsMeta    = useSelector(selectAdminBookingsMeta);
  const bookingsLoading = useSelector(selectAdminBookingsLoading);
  const detailData      = useSelector(selectAdminBookingDetail);
  const detailLoading   = useSelector(selectAdminBookingDetailLoading);
  const opRecord        = useSelector(selectAdminOpRecord);
  const stats           = useSelector(selectAdminStats);
  const statsLoading    = useSelector(selectAdminStatsLoading);
  const exportLoading   = useSelector(selectAdminExportLoading);
  const statusUpdate    = useSelector(selectAdminStatusUpdate);
  const nearbySolo      = useSelector(selectNearbySoloDrivers);
  const nearbyTPs       = useSelector(selectNearbyTPs);
  const nearbyCare      = useSelector(selectNearbyCareAssistants);
  const nearbyHosp      = useSelector(selectNearbyHospitals);
  const nearbyLoading   = useSelector(selectNearbyLoading);
  const assignment      = useSelector(selectAdminAssignment);
  const assignLoading   = useSelector(selectAdminAssignLoading);
  const refund          = useSelector(selectAdminRefund);
  const refundLoading   = useSelector(selectAdminRefundLoading);

  // ── Local state
  const [filters, setFilters] = useState({
    status: '', bookingType: '', city: '', search: '', from: '', to: '',
  });
  const [page, setPage]             = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId]   = useState(null);
  const [drawer, setDrawer]           = useState(false);
  const [nearbyTab, setNearbyTab]     = useState('solo');
  const [refundModal, setRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [statusModal, setStatusModal]   = useState(false);
  const [newStatus, setNewStatus]       = useState('');
  const [statusNote, setStatusNote]     = useState('');

  // ── Load
  const loadBookings = useCallback(() => {
    const clean = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '')
    );
    dispatch(fetchAdminBookings({ ...clean, page, limit: 20 }));
  }, [dispatch, filters, page]);

  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => { dispatch(fetchAdminBookingStats({})); }, [dispatch]);

  // ── Open detail drawer
  const openDetail = (id) => {
    setSelectedId(id);
    setDrawer(true);
    dispatch(fetchAdminBookingById(id));
    dispatch(clearNearbyResults());
    setNearbyTab('solo');
  };

  const closeDrawer = () => {
    setDrawer(false);
    setSelectedId(null);
    dispatch(clearAdminBookingDetail());
    dispatch(clearNearbyResults());
  };

  // ── Nearby fetch
  const loadNearby = (tab) => {
    if (!selectedId) return;
    setNearbyTab(tab);
    if (tab === 'solo')    dispatch(fetchNearbySoloDrivers(selectedId));
    if (tab === 'tp')      dispatch(fetchNearbyTPs(selectedId));
    if (tab === 'care')    dispatch(fetchNearbyCareAssistants(selectedId));
    if (tab === 'hospital')dispatch(fetchNearbyHospitals(selectedId));
  };

  // ── Assign handler
  const handleAssign = ({ bookingId, id, type }) => {
    if (type === 'solo')     dispatch(adminAssignSoloDriver({ bookingId, soloDriverPartnerId: id }));
    if (type === 'tp')       dispatch(adminAssignTP({ bookingId, transportPartnerId: id }));
    if (type === 'care')     dispatch(adminAssignCareAssistant({ bookingId, careAssistantId: id }));
    if (type === 'hospital') dispatch(adminAssignHospital({ bookingId, hospitalId: id }));
  };

  // ── Status update
  const handleStatusUpdate = () => {
    if (!selectedId || !newStatus) return;
    dispatch(updateAdminBookingStatus({ bookingId: selectedId, status: newStatus, note: statusNote }));
    setStatusModal(false);
    setNewStatus(''); setStatusNote('');
  };

  // ── Refund
  const handleRefund = () => {
    if (!selectedId) return;
    dispatch(adminProcessRefund({
      bookingId: selectedId,
      refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
      reason: refundReason,
    }));
    setRefundModal(false);
    setRefundAmount(''); setRefundReason('');
  };

  // ── Charts data
  const statusChartData = stats?.byStatus
    ? Object.entries(stats.byStatus).map(([k, v]) => ({ name: k, value: v }))
    : [];
  const typeChartData = stats?.byBookingType
    ? Object.entries(stats.byBookingType).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v }))
    : [];

  const fmt = (n) => n?.toLocaleString('en-IN') ?? '—';
  const fmtCur = (n) => n != null ? `₹${n.toLocaleString('en-IN')}` : '—';

  return (
    <div
      data-theme="admin"
      className="min-h-screen bg-base-100 font-poppins"
    >
      {/* ── Top Header ── */}
      <div className="sticky top-0 z-30 bg-base-100 border-b border-base-300 shadow-sm">
        <div className="container-custom py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2.5 bg-primary/10">
              <LayoutDashboard size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black font-montserrat text-base-content leading-none">
                Booking Management
              </h1>
              <p className="text-xs text-base-content/50 mt-0.5">
                {bookingsMeta.total ?? 0} total bookings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="btn btn-sm btn-ghost gap-1.5"
              onClick={loadBookings}
              disabled={bookingsLoading}
            >
              <RefreshCw size={14} className={bookingsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              className="btn btn-sm btn-outline gap-1.5"
              onClick={() => dispatch(exportAdminBookings(filters))}
              disabled={exportLoading}
            >
              <Download size={14} />
              {exportLoading ? 'Exporting…' : 'Export CSV'}
            </button>
            <button
              className="btn btn-sm btn-primary gap-1.5"
              onClick={() => setShowFilters(v => !v)}
            >
              <SlidersHorizontal size={14} />
              Filters
              <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="container-custom py-6 space-y-6">

        {/* ── Stats Row ── */}
        {!statsLoading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={TrendingUp} label="Total Revenue"
              value={fmtCur(stats.revenue?.totalRevenue)}
              sub={`${fmt(stats.revenue?.count)} completed`}
              color="var(--success)" delay={0}
            />
            <StatCard
              icon={Clock} label="Pending"
              value={fmt(stats.byStatus?.pending ?? 0)}
              sub="Awaiting assignment"
              color="var(--warning)" delay={0.05}
            />
            <StatCard
              icon={CheckCircle2} label="Completed"
              value={fmt(stats.byStatus?.completed ?? 0)}
              color="var(--primary)" delay={0.1}
            />
            <StatCard
              icon={AlertCircle} label="Cancelled"
              value={fmt((stats.byStatus?.cancelled ?? 0) + (stats.byStatus?.no_show ?? 0))}
              color="var(--error)" delay={0.15}
            />
          </div>
        )}

        {/* ── Charts Row ── */}
        {!statsLoading && stats && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {/* Status bar */}
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-4">
                Bookings by Status
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={statusChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--base-200)',
                      border: '1px solid var(--base-300)',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statusChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Type pie */}
            <div className="card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-4">
                Bookings by Type
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={typeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={42}
                    paddingAngle={2}
                  >
                    {typeChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--base-200)',
                      border: '1px solid var(--base-300)',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                    }}
                  />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: '0.7rem', paddingLeft: '1rem' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* ── Filters Panel ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              key="filters"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="card p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Search */}
                  <div className="relative col-span-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                    <input
                      type="text"
                      placeholder="Search booking code or patient…"
                      className="input-field w-full pl-9 text-sm py-2"
                      value={filters.search}
                      onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                    />
                  </div>

                  {/* Status */}
                  <select
                    className="input-field text-sm py-2"
                    value={filters.status}
                    onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                  >
                    <option value="">All Statuses</option>
                    {BOOKING_STATUSES.map(s => (
                      <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                    ))}
                  </select>

                  {/* Type */}
                  <select
                    className="input-field text-sm py-2"
                    value={filters.bookingType}
                    onChange={e => setFilters(f => ({ ...f, bookingType: e.target.value }))}
                  >
                    <option value="">All Types</option>
                    {BOOKING_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>

                  {/* From */}
                  <input
                    type="date"
                    className="input-field text-sm py-2"
                    value={filters.from}
                    onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                  />

                  {/* To */}
                  <input
                    type="date"
                    className="input-field text-sm py-2"
                    value={filters.to}
                    onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => { setPage(1); loadBookings(); }}
                  >
                    <Filter size={13} /> Apply
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setFilters({ status:'',bookingType:'',city:'',search:'',from:'',to:'' });
                      setPage(1);
                    }}
                  >
                    <X size={13} /> Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bookings Table ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  {['Code','Type','Patient','Status','Scheduled','Amount','Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookingsLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j}><div className="skeleton h-4 w-full rounded" /></td>
                        ))}
                      </tr>
                    ))
                  : bookings.length === 0
                  ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-base-content/40">
                          <CalendarDays size={32} className="mx-auto mb-3 opacity-30" />
                          No bookings found.
                        </td>
                      </tr>
                    )
                  : bookings.map((b, idx) => (
                      <motion.tr
                        key={b._id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="cursor-pointer"
                        onClick={() => openDetail(b._id)}
                      >
                        <td>
                          <span className="font-mono text-xs font-bold text-primary">
                            {b.bookingCode}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs capitalize text-base-content/70">
                            {b.bookingType?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <div>
                            <p className="text-sm font-semibold">{b.patientInfo?.name ?? '—'}</p>
                            <p className="text-xs text-base-content/50">{b.customer?.phone}</p>
                          </div>
                        </td>
                        <td><StatusBadge status={b.status} /></td>
                        <td>
                          <span className="text-xs text-base-content/70">
                            {b.scheduledAt
                              ? new Date(b.scheduledAt).toLocaleString('en-IN', {
                                  dateStyle: 'medium', timeStyle: 'short',
                                })
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm font-semibold text-success">
                            {fmtCur(b.fareBreakdown?.totalAmount)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-xs btn-ghost gap-1"
                            onClick={e => { e.stopPropagation(); openDetail(b._id); }}
                          >
                            <Eye size={12} /> View
                          </button>
                        </td>
                      </motion.tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {bookingsMeta.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-base-300">
              <p className="text-xs text-base-content/50">
                Page {bookingsMeta.page} of {bookingsMeta.pages} · {bookingsMeta.total} total
              </p>
              <div className="flex gap-2">
                <button
                  className="btn btn-xs btn-ghost"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  className="btn btn-xs btn-ghost"
                  disabled={page >= bookingsMeta.pages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ════════════════════════════════════════════════════
          DETAIL DRAWER
      ════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {drawer && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={closeDrawer}
            />

            {/* Drawer panel */}
            <motion.aside
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-base-100 border-l border-base-300 shadow-2xl overflow-y-auto scrollbar-thin"
            >
              {/* Drawer header */}
              <div className="sticky top-0 z-10 bg-base-100 border-b border-base-300 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black font-montserrat text-base-content">
                    Booking Detail
                  </h2>
                  {detailData && (
                    <p className="text-xs font-mono text-primary mt-0.5">{detailData.bookingCode}</p>
                  )}
                </div>
                <button className="btn btn-sm btn-ghost btn-circle" onClick={closeDrawer}>
                  <X size={16} />
                </button>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="loading loading-spinner loading-lg" />
                </div>
              ) : detailData ? (
                <div className="p-6 space-y-6">

                  {/* ── Overview ── */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Status',    value: <StatusBadge status={detailData.status} /> },
                      { label: 'Type',      value: detailData.bookingType?.replace(/_/g, ' ') },
                      { label: 'Patient',   value: detailData.patientInfo?.name },
                      { label: 'Scheduled', value: detailData.scheduledAt
                          ? new Date(detailData.scheduledAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})
                          : '—' },
                      { label: 'Total',     value: fmtCur(detailData.fareBreakdown?.totalAmount) },
                      { label: 'Paid',      value: fmtCur(detailData.fareBreakdown?.amountPaid) },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-base-200 rounded-xl p-3">
                        <p className="text-xs font-semibold text-base-content/50 uppercase tracking-widest mb-1">{label}</p>
                        <div className="text-sm font-semibold text-base-content">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── OP Record ── */}
                  {opRecord && (
                    <div className="card p-4 border-l-4" style={{ borderLeftColor: 'var(--info)' }}>
                      <p className="text-xs font-bold uppercase tracking-widest text-info mb-2">OP Record</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-base-content/50">OP #:</span> <span className="font-mono font-bold">{opRecord.opNumber}</span></div>
                        <div><span className="text-base-content/50">Status:</span> <StatusBadge status={opRecord.status} /></div>
                        {opRecord.doctorNotes && (
                          <div className="col-span-2">
                            <span className="text-base-content/50">Notes:</span>
                            <p className="mt-1 text-base-content/80">{opRecord.doctorNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Actions Row ── */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-sm btn-outline gap-1.5"
                      onClick={() => setStatusModal(true)}
                    >
                      <ShieldAlert size={13} /> Update Status
                    </button>
                    <button
                      className="btn btn-sm btn-error gap-1.5"
                      onClick={() => setRefundModal(true)}
                      disabled={detailData.paymentStatus === 'refunded'}
                    >
                      <RotateCcw size={13} /> Refund
                    </button>
                  </div>

                  {/* ── Nearby / Assign ── */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-3">
                      Nearby &amp; Assign
                    </p>

                    {/* Tab bar */}
                    <div className="flex gap-1 bg-base-200 rounded-xl p-1 mb-4">
                      {[
                        { key: 'solo',     label: 'Solo Driver',  icon: Truck },
                        { key: 'tp',       label: 'Fleet',        icon: Users },
                        { key: 'care',     label: 'Care',         icon: HeartHandshake },
                        { key: 'hospital', label: 'Hospital',     icon: Building2 },
                      ].map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => loadNearby(key)}
                          className={`flex-1 btn btn-xs gap-1 ${nearbyTab === key ? 'btn-primary' : 'btn-ghost'}`}
                        >
                          <Icon size={11} />
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      ))}
                    </div>

                    {nearbyLoading
                      ? <div className="flex justify-center py-8"><div className="loading loading-spinner loading-md" /></div>
                      : nearbyTab === 'solo'
                      ? <NearbyList items={nearbySolo}      type="solo"     bookingId={selectedId} onAssign={handleAssign} assignLoading={assignLoading} />
                      : nearbyTab === 'tp'
                      ? <NearbyList items={nearbyTPs}       type="tp"       bookingId={selectedId} onAssign={handleAssign} assignLoading={assignLoading} />
                      : nearbyTab === 'care'
                      ? <NearbyList items={nearbyCare}      type="care"     bookingId={selectedId} onAssign={handleAssign} assignLoading={assignLoading} />
                      : <NearbyList items={nearbyHosp}      type="hospital" bookingId={selectedId} onAssign={handleAssign} assignLoading={assignLoading} />
                    }

                    {assignment.status === 'success' && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="alert alert-success mt-3 text-sm"
                      >
                        <CheckCircle2 size={16} /> Assignment successful.
                      </motion.div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-24 text-base-content/30">
                  Select a booking to view details.
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Status Modal ── */}
      <AnimatePresence>
        {statusModal && (
          <motion.div
            key="statusModal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="card w-full max-w-sm p-6 space-y-4"
            >
              <h3 className="font-black font-montserrat text-base-content">Update Status</h3>

              <select
                className="input-field w-full text-sm"
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
              >
                <option value="">Select status…</option>
                {BOOKING_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                ))}
              </select>

              <textarea
                className="input-field w-full text-sm resize-none"
                rows={2}
                placeholder="Note (optional)"
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
              />

              <div className="flex gap-2 justify-end">
                <button className="btn btn-sm btn-ghost" onClick={() => setStatusModal(false)}>Cancel</button>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={!newStatus || statusUpdate.status === 'loading'}
                  onClick={handleStatusUpdate}
                >
                  {statusUpdate.status === 'loading' ? 'Saving…' : 'Update'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Refund Modal ── */}
      <AnimatePresence>
        {refundModal && (
          <motion.div
            key="refundModal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="card w-full max-w-sm p-6 space-y-4"
            >
              <h3 className="font-black font-montserrat text-error">Process Refund</h3>

              <div>
                <label className="label-text block mb-1.5">Refund Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="input-field w-full text-sm"
                  placeholder="Leave blank for full amount"
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="label-text block mb-1.5">Reason</label>
                <textarea
                  className="input-field w-full text-sm resize-none"
                  rows={2}
                  placeholder="Reason for refund"
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button className="btn btn-sm btn-ghost" onClick={() => setRefundModal(false)}>Cancel</button>
                <button
                  className="btn btn-sm btn-error"
                  disabled={refundLoading}
                  onClick={handleRefund}
                >
                  {refundLoading ? 'Processing…' : 'Confirm Refund'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}