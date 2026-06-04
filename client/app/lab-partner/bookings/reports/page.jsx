'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Search,
  Download,
  Send,
  Eye,
  FileText,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  ChevronDown,
  X,
  CheckCircle2,
  Mail,
  MessageSquare,
  Smartphone,
  Package,
  User,
  Phone,
  CalendarDays,
  IndianRupee,
  FileDown,
  RotateCcw,
} from 'lucide-react';

import {
  fetchReportsArchive,
  downloadReport,
  resendReport,
  selectReportsArchive,
  selectReportsPagination,
  selectIsLoadingReports,
  selectIsActionLoading,
  selectLabError,
} from '@/store/slices/labPartnerBookingSlice';
import BackButton from '../../../../components/BackButton';
import Container from '../../../../components/ui/Container';

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { value: '',      label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

const CHANNEL_OPTIONS = [
  { value: 'Email',    label: 'Email',    icon: Mail },
  { value: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'SMS',      label: 'SMS',      icon: Smartphone },
];

const CHART_COLORS = [
  'var(--primary)', 'var(--secondary)', 'var(--accent)',
  'var(--success)', 'var(--info)', 'var(--warning)',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Resend modal ─────────────────────────────────────────────────────────────

function ResendModal({ report, onClose, isActionLoading, dispatch }) {
  const [selected, setSelected] = useState([]);

  const toggle = (ch) =>
    setSelected(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);

  const handleResend = () => {
    dispatch(resendReport({ bookingId: report._id, channels: selected.length ? selected : undefined }));
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-neutral/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative z-10 bg-base-100 rounded-2xl border border-base-300 shadow-depth-lg p-6 w-full max-w-sm mx-4"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-extrabold text-base-content">Resend Report</h3>
          <button onClick={onClose} className="btn btn-ghost btn-circle btn-xs"><X size={14} /></button>
        </div>

        <p className="text-xs text-base-content/60 mb-4">
          Resend <span className="font-bold text-primary">{report.bookingCode}</span> via selected channels.
          Leave empty to use booking's default delivery mode.
        </p>

        <div className="space-y-2 mb-5">
          {CHANNEL_OPTIONS.map(({ value, label, icon: Icon }) => (
            <label key={value} className="flex items-center gap-3 p-3 rounded-xl border border-base-300 cursor-pointer hover:border-primary/40 transition-colors">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={selected.includes(value)}
                onChange={() => toggle(value)}
              />
              <Icon size={15} className="text-base-content/50" />
              <span className="text-xs font-medium">{label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-ghost btn-sm flex-1">Cancel</button>
          <button
            onClick={handleResend}
            disabled={isActionLoading}
            className="btn btn-primary btn-sm flex-1 gap-1.5"
          >
            {isActionLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Resend
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Report row ───────────────────────────────────────────────────────────────

function ReportRow({ report, onDownload, onResend }) {
  const tests = [
    ...(report.diagnosticDetails?.testNames    || []),
    ...(report.diagnosticDetails?.packageNames || []),
  ].slice(0, 2);

  const extra = [
    ...(report.diagnosticDetails?.testNames    || []),
    ...(report.diagnosticDetails?.packageNames || []),
  ].length - 2;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <td>
        <p className="font-bold text-primary text-xs">{report.bookingCode}</p>
        <p className="text-[10px] text-base-content/40 capitalize">{report.status}</p>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User size={13} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold">{report.patientInfo?.name}</p>
            <p className="text-[10px] text-base-content/40 flex items-center gap-1">
              <Phone size={9} />{report.customer?.phone || report.patientInfo?.phone || '—'}
            </p>
          </div>
        </div>
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {tests.map((t, i) => <span key={i} className="badge badge-xs badge-primary">{t}</span>)}
          {extra > 0 && <span className="badge badge-xs bg-base-300 text-base-content/60">+{extra}</span>}
          {tests.length === 0 && <span className="text-[10px] text-base-content/30">—</span>}
        </div>
      </td>
      <td>
        <p className="text-xs">{fmt(report.diagnosticDetails?.reportReadyAt || report.completedAt)}</p>
        <p className="text-[10px] text-base-content/40">{fmtTime(report.diagnosticDetails?.reportReadyAt || report.completedAt)}</p>
      </td>
      <td>
        <span className="badge badge-xs badge-success capitalize">
          {report.diagnosticDetails?.reportDeliveryMode || 'Digital'}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-1 text-xs font-semibold">
          <IndianRupee size={12} className="text-base-content/40" />
          {report.fareBreakdown?.totalAmount?.toLocaleString('en-IN') || '0'}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDownload(report._id)}
            className="btn btn-ghost btn-xs gap-1 text-primary"
            title="Download report"
          >
            <FileDown size={13} />
          </button>
          <button
            onClick={() => onResend(report)}
            className="btn btn-ghost btn-xs gap-1 text-accent"
            title="Resend report"
          >
            <RotateCcw size={13} />
          </button>
          {report.diagnosticDetails?.reportUrl && (
            <a
              href={report.diagnosticDetails.reportUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-xs gap-1 text-secondary"
              title="View report"
            >
              <Eye size={13} />
            </a>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Charts section ───────────────────────────────────────────────────────────

function ReportsCharts({ reports }) {
  // Delivery mode breakdown for pie
  const modeMap = reports.reduce((acc, r) => {
    const mode = r.diagnosticDetails?.reportDeliveryMode || 'Unknown';
    acc[mode] = (acc[mode] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(modeMap).map(([name, value]) => ({ name, value }));

  // Reports per day (last 7 entries by completedAt)
  const dayMap = reports.reduce((acc, r) => {
    const day = r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Unknown';
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  const barData = Object.entries(dayMap)
    .map(([date, count]) => ({ date, count }))
    .slice(-7);

  if (reports.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      {/* Bar chart */}
      <div className="card p-4">
        <p className="rx-section-title mb-3">Reports per Day</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.5 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--base-100)',
                border: '1px solid var(--base-300)',
                borderRadius: '0.5rem',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart */}
      <div className="card p-4">
        <p className="rx-section-title mb-3">Delivery Mode Breakdown</p>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={3}
              dataKey="value"
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--base-100)',
                border: '1px solid var(--base-300)',
                borderRadius: '0.5rem',
                fontSize: '12px',
              }}
            />
            <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportsArchive() {
  const dispatch   = useDispatch();
  const reports    = useSelector(selectReportsArchive);
  const pagination = useSelector(selectReportsPagination);
  const isLoading  = useSelector(selectIsLoadingReports);
  const isActionLoading = useSelector(selectIsActionLoading);
  const error      = useSelector(selectLabError);

  const [filters, setFilters]       = useState({ date: '', search: '', page: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [resendTarget, setResendTarget] = useState(null);

  useEffect(() => {
    const params = { page: filters.page };
    if (filters.date)   params.date   = filters.date;
    if (filters.search) params.search = filters.search;
    dispatch(fetchReportsArchive(params));
  }, [dispatch, filters]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setFilters(prev => ({ ...prev, search: searchInput, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleDownload = useCallback((bookingId) => {
    dispatch(downloadReport(bookingId));
  }, [dispatch]);

  const handleResend = useCallback((report) => {
    setResendTarget(report);
  }, []);

  const setFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val, page: 1 }));
  const goPage    = (p) => setFilters(prev => ({ ...prev, page: p }));
  const refresh   = () => dispatch(fetchReportsArchive({ ...filters }));

  const totalPages = pagination?.pages || 1;

  return (
    <div className="space-y-4">
      <Container>
          <BackButton className='m-3'  />
          {/* ── Header ── */}
      {/* ── Charts ── */}
      <ReportsCharts reports={reports} />


      {/* ── Filter bar ── */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-base-content/40">
            <Filter size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Filters</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-40 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              type="text"
              placeholder="Search patient name…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="input-field text-xs py-1.5 pl-8"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Date */}
          <div className="relative">
            <select
              value={filters.date}
              onChange={e => setFilter('date', e.target.value)}
              className="input-field text-xs py-1.5 pr-8 appearance-none w-36"
            >
              {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
          </div>

          {/* Clear */}
          {(filters.date || filters.search) && (
            <button
              onClick={() => { setFilters({ date: '', search: '', page: 1 }); setSearchInput(''); }}
              className="btn btn-ghost btn-xs gap-1 text-error"
            >
              <X size={12} /> Clear
            </button>
          )}

          <div className="flex-1" />

          <button onClick={refresh} disabled={isLoading} className="btn btn-ghost btn-sm gap-1.5">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="alert alert-error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AlertTriangle size={16} />
            <span className="text-xs">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Table ── */}
      <div className="card mt-3 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-200/50">
          <p className="text-[10px] text-base-content/50 font-semibold">
            {pagination?.total ?? 0} reports total
          </p>
          {isLoading && <Loader2 size={14} className="animate-spin text-primary" />}
        </div>

        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Patient</th>
                <th>Tests / Packages</th>
                <th>Report Ready</th>
                <th>Delivery Mode</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && reports.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14">
                    <FileText size={32} className="text-base-content/20 mx-auto mb-2" />
                    <p className="text-xs text-base-content/40 font-medium">No reports found</p>
                    <p className="text-[10px] text-base-content/30 mt-1">Reports appear here once uploaded</p>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {reports.map(r => (
                    <ReportRow
                      key={r._id}
                      report={r}
                      onDownload={handleDownload}
                      onResend={handleResend}
                    />
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-base-300">
            <p className="text-[10px] text-base-content/40">
              Page {pagination?.page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goPage(filters.page - 1)}
                disabled={filters.page <= 1 || isLoading}
                className="btn btn-ghost btn-xs"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = filters.page <= 3 ? i + 1 : filters.page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => goPage(p)}
                    className={`btn btn-xs ${p === filters.page ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => goPage(filters.page + 1)}
                disabled={filters.page >= totalPages || isLoading}
                className="btn btn-ghost btn-xs"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Resend modal ── */}
      <AnimatePresence>
        {resendTarget && (
          <ResendModal
            report={resendTarget}
            onClose={() => setResendTarget(null)}
            isActionLoading={isActionLoading}
            dispatch={dispatch}
          />
        )}
      </AnimatePresence>
</Container>
    </div>
  );
}