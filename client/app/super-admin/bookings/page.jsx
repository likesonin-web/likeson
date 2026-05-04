'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Search, RefreshCw, Download, ChevronLeft, ChevronRight,
  MapPin, User, Calendar, Clock, TrendingUp, DollarSign, Activity,
  CheckCircle, XCircle, AlertCircle, Truck, Heart,
  UserCheck, RotateCcw, CreditCard, FileText, Eye,
  X, Phone, Navigation, Zap, Package,
  Star, ArrowUpRight, Layers, Grid3X3, List, Loader2,
  BadgeCheck, Ban, PlusCircle, Users, Car, ClipboardList,
  AlertTriangle, Info, ArrowLeft, Send, Hospital,
  BarChart2,
} from 'lucide-react';

import {
  fetchAdminBookings,
  fetchAdminBookingStats,
  exportAdminBookings,
  fetchAdminBookingById,
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
  fetchAdminOps,
  updateAdminOpStatus,
  resetAdminAssignment,
  resetAdminRefund,
  resetAdminStatusUpdate,
  resetAdminOpStatusUpdate,
  clearAdminBookingDetail,
  clearNearbyResults,
  patchAdminBookingStatus,
  selectAdminBookings,
  selectAdminBookingsMeta,
  selectAdminBookingsLoading,
  selectAdminBookingDetail,
  selectAdminOpRecord,
  selectAdminBookingFollowUps,
  selectAdminBookingDetailLoading,
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
  selectAdminOps,
  selectAdminOpsMeta,
  selectAdminOpsLoading,
  selectAdminOpStatusUpdate,
} from '@/store/slices/operationsSlice';

export const selectUser = (s) => s.user.user;

// ── Constants ─────────────────────────────────────────────────────────────────

const BOOKING_TYPE_LABELS = {
  full_care_ride:      'Full Care Ride',
  doctor_consultation: 'Doctor Consult',
  doctor_online:       'Online Consult',
  physiotherapist:     'Physiotherapist',
  care_assistant:      'Care Assistant',
  diagnostic_center:   'Diagnostic Center',
  diagnostic_home:     'Diagnostic Home',
  patient_transport:   'Patient Transport',
  follow_up:           'Follow-Up',
};

const STATUS_CONFIG = {
  pending:        { color: 'warning',  icon: Clock,        label: 'Pending' },
  confirmed:      { color: 'info',     icon: CheckCircle,  label: 'Confirmed' },
  in_progress:    { color: 'primary',  icon: Activity,     label: 'In Progress' },
  completed:      { color: 'success',  icon: BadgeCheck,   label: 'Completed' },
  cancelled:      { color: 'error',    icon: XCircle,      label: 'Cancelled' },
  no_show:        { color: 'error',    icon: Ban,          label: 'No Show' },
  refund_pending: { color: 'warning',  icon: CreditCard,   label: 'Refund Pending' },
  refunded:       { color: 'success',  icon: RotateCcw,    label: 'Refunded' },
  draft:          { color: 'neutral',  icon: FileText,     label: 'Draft' },
};

const OP_STATUS_CONFIG = {
  scheduled:   { color: 'info',    label: 'Scheduled' },
  in_progress: { color: 'primary', label: 'In Progress' },
  completed:   { color: 'success', label: 'Completed' },
  cancelled:   { color: 'error',   label: 'Cancelled' },
  no_show:     { color: 'error',   label: 'No Show' },
};

const BOOKING_TYPE_COLORS = {
  full_care_ride:      '#6366f1',
  doctor_consultation: '#0ea5e9',
  doctor_online:       '#8b5cf6',
  physiotherapist:     '#06b6d4',
  care_assistant:      '#ec4899',
  diagnostic_center:   '#f59e0b',
  diagnostic_home:     '#10b981',
  patient_transport:   '#f97316',
  follow_up:           '#14b8a6',
};

const CHART_COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6'];

const HAS_OP_TYPES   = ['full_care_ride','doctor_consultation','doctor_online','physiotherapist','follow_up'];
const HAS_RIDE_TYPES = ['full_care_ride','patient_transport','diagnostic_home'];
const HAS_CARE_TYPES = ['full_care_ride','care_assistant'];

// ── Variants ──────────────────────────────────────────────────────────────────

const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
const fadeIn  = { hidden: { opacity: 0 },          show: { opacity: 1, transition: { duration: 0.25 } } };
const slideIn = { hidden: { opacity: 0, x: 40 },  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } } };

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtCurrency = (n) => `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: 'neutral', icon: Info, label: status };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border border-${cfg.color}/30 bg-${cfg.color}/10 text-${cfg.color}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function Spinner({ size = 'md' }) {
  const sz = { xs: 'w-3 h-3', sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size];
  return <div className={`loading loading-spinner ${sz}`} />;
}

function SectionTitle({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="p-1.5 rounded-lg bg-primary/10 text-primary"><Icon size={14} /></span>
      <span className="text-sm font-bold text-base-content">{label}</span>
      {count != null && <span className="ml-auto text-xs text-base-content/50 font-semibold bg-base-300/60 px-2 py-0.5 rounded-full">{count}</span>}
    </div>
  );
}

function EmptyState({ icon: Icon = Package, text = 'No results' }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-base-content/30">
      <Icon size={32} strokeWidth={1} />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

function InfoRow({ label, value, bold = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">{label}</span>
      <span className={`text-xs ${bold ? 'font-bold text-primary' : 'text-base-content'} truncate`}>{value || '—'}</span>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color = 'primary', loading }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className={`p-2 rounded-xl bg-${color}/10 text-${color}`}><Icon size={18} /></span>
      </div>
      <div>
        {loading ? <div className="skeleton h-7 w-20 rounded" /> : (
          <p className="text-2xl font-black text-base-content">{value}</p>
        )}
        <p className="text-xs text-base-content/50 mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

// ── Booking Card (replaces BookingRow table row) ───────────────────────────────

function BookingCard({ booking, selected, onSelect }) {
  const cfg = STATUS_CONFIG[booking.status] || { color: 'neutral', icon: Info, label: booking.status };
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      onClick={() => onSelect(booking._id)}
      className={`cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
          : 'border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-200/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-black text-primary tracking-wide">{booking.bookingCode}</span>
          <p className="text-[11px] text-base-content/50 mt-0.5 truncate">
            {BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-${cfg.color}/30 bg-${cfg.color}/10 text-${cfg.color} flex-shrink-0`}>
          <Icon size={9} />
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center flex-shrink-0">
            <User size={11} className="text-base-content/50" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-base-content truncate">
              {booking.patientInfo?.name || booking.customer?.name || '—'}
            </p>
            <p className="text-[10px] text-base-content/40">{booking.customer?.phone || ''}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-bold text-base-content">{fmtCurrency(booking.fareBreakdown?.totalAmount)}</p>
          <p className="text-[10px] text-base-content/40">{fmtDate(booking.scheduledAt)}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Nearby Card ───────────────────────────────────────────────────────────────

function NearbyCard({ item, type, onAssign, loading }) {
  const [confirm, setConfirm] = useState(false);

  const id = type === 'solo'
    ? item.soloPartnerId
    : type === 'tp'
    ? item.tpId
    : type === 'care'
    ? item.careAssistantId
    : item.hospitalId;

  const label = type === 'tp' ? item.businessName : item.name;
  const sub = type === 'solo'
    ? `${item.distanceKm} km · ${item.vehicle?.registrationNumber || 'No plate'}`
    : type === 'tp'
    ? `${item.availableDriversNearby} drivers · ★${item.averageRating?.toFixed(1) || '—'}`
    : type === 'care'
    ? `${item.distanceKm} km · ${item.specializations?.join(', ') || '—'}`
    : `${item.distanceKm} km · ${item.hospitalType || '—'}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-base-300 bg-base-200/40 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        {type === 'solo' ? <Car size={14} className="text-primary" />
          : type === 'tp' ? <Truck size={14} className="text-primary" />
          : type === 'care' ? <Heart size={14} className="text-primary" />
          : <Hospital size={14} className="text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-base-content truncate">{label || '—'}</p>
        <p className="text-xs text-base-content/50 truncate">{sub}</p>
      </div>
      {confirm ? (
        <div className="flex gap-1">
          <button onClick={() => { onAssign(id); setConfirm(false); }} disabled={loading} className="btn btn-xs btn-success">
            {loading ? <Spinner size="xs" /> : <CheckCircle size={11} />}
          </button>
          <button onClick={() => setConfirm(false)} className="btn btn-xs btn-ghost"><X size={11} /></button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="btn btn-xs btn-outline flex-shrink-0">Assign</button>
      )}
    </motion.div>
  );
}

// ── Refund Modal ──────────────────────────────────────────────────────────────

function RefundModal({ booking, onSubmit, onClose, loading }) {
  const [amount, setAmount] = useState(booking?.fareBreakdown?.amountPaid || 0);
  const [reason, setReason] = useState('');
  const maxRefund = booking?.fareBreakdown?.amountPaid || 0;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div variants={slideIn} className="glass-card p-6 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="btn btn-xs btn-ghost btn-circle absolute top-3 right-3"><X size={14} /></button>
        <div className="flex items-center gap-2 mb-4">
          <span className="p-2 rounded-xl bg-warning/10 text-warning"><CreditCard size={18} /></span>
          <div>
            <p className="font-bold text-sm text-base-content">Process Refund</p>
            <p className="text-xs text-base-content/50">{booking?.bookingCode}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label"><span className="label-text">Refund Amount (₹)</span></label>
            <input type="number" value={amount} onChange={e => setAmount(Math.min(+e.target.value, maxRefund))} max={maxRefund} min={0} className="input-field w-full" />
            <p className="text-xs text-base-content/40 mt-1">Max: {fmtCurrency(maxRefund)}</p>
          </div>
          <div>
            <label className="label"><span className="label-text">Reason</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="input-field w-full resize-none" placeholder="Reason for refund..." />
          </div>
          <button onClick={() => onSubmit({ refundAmount: amount, reason })} disabled={loading || !reason.trim() || amount <= 0} className="btn btn-warning w-full">
            {loading ? <Spinner size="sm" /> : <><CreditCard size={14} /> Initiate Refund</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Status Update Modal ───────────────────────────────────────────────────────

function StatusModal({ booking, onSubmit, onClose, loading }) {
  const [status, setStatus] = useState(booking?.status || 'pending');
  const [note, setNote] = useState('');

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div variants={slideIn} className="glass-card p-6 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="btn btn-xs btn-ghost btn-circle absolute top-3 right-3"><X size={14} /></button>
        <div className="flex items-center gap-2 mb-4">
          <span className="p-2 rounded-xl bg-info/10 text-info"><Activity size={18} /></span>
          <div>
            <p className="font-bold text-sm text-base-content">Update Status</p>
            <p className="text-xs text-base-content/50">{booking?.bookingCode}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label"><span className="label-text">New Status</span></label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="input-field w-full">
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label"><span className="label-text">Note (optional)</span></label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="input-field w-full resize-none" placeholder="Reason for change..." />
          </div>
          <button onClick={() => onSubmit({ status, note })} disabled={loading || status === booking?.status} className="btn btn-primary w-full">
            {loading ? <Spinner size="sm" /> : <><Send size={14} /> Update Status</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── OP Status Modal ───────────────────────────────────────────────────────────

function OpStatusModal({ op, onSubmit, onClose, loading }) {
  const [status, setStatus] = useState(op?.status || 'scheduled');
  const [notes, setNotes] = useState(op?.doctorNotes || '');

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div variants={slideIn} className="glass-card p-6 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="btn btn-xs btn-ghost btn-circle absolute top-3 right-3"><X size={14} /></button>
        <div className="flex items-center gap-2 mb-4">
          <span className="p-2 rounded-xl bg-accent/10 text-accent"><ClipboardList size={18} /></span>
          <div>
            <p className="font-bold text-sm text-base-content">Update OP Status</p>
            <p className="text-xs text-base-content/50">{op?.opNumber}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label"><span className="label-text">Status</span></label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="input-field w-full">
              {Object.entries(OP_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label"><span className="label-text">Doctor Notes</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-field w-full resize-none" placeholder="Clinical notes..." />
          </div>
          <button onClick={() => onSubmit({ status, doctorNotes: notes })} disabled={loading} className="btn btn-accent w-full">
            {loading ? <Spinner size="sm" /> : <><Send size={14} /> Update OP</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Reassign Modal ────────────────────────────────────────────────────────────

function ReassignModal({ type, onSubmit, onClose, loading }) {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const isDriver = type === 'driver';

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div variants={slideIn} className="glass-card p-6 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="btn btn-xs btn-ghost btn-circle absolute top-3 right-3"><X size={14} /></button>
        <div className="flex items-center gap-2 mb-4">
          <span className="p-2 rounded-xl bg-secondary/10 text-secondary"><RotateCcw size={18} /></span>
          <p className="font-bold text-sm text-base-content">Reassign {isDriver ? 'Driver' : 'Care Assistant'}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">
              <span className="label-text">{isDriver ? 'New Driver User ID' : 'New Care Assistant Profile ID'}</span>
            </label>
            <input type="text" value={userId} onChange={e => setUserId(e.target.value)} className="input-field w-full" placeholder={isDriver ? 'Driver user ID…' : 'Care assistant profile ID…'} />
          </div>
          {isDriver && (
            <div>
              <label className="label"><span className="label-text">Reason</span></label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="input-field w-full" placeholder="Reason for reassignment..." />
            </div>
          )}
          <button onClick={() => onSubmit(isDriver ? { newDriverUserId: userId, reason } : { newCareAssistantId: userId })} disabled={loading || !userId.trim()} className="btn btn-secondary w-full">
            {loading ? <Spinner size="sm" /> : <><RotateCcw size={14} /> Reassign</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS PANEL — standalone, used in right panel analytics tab
// ═════════════════════════════════════════════════════════════════════════════

function AnalyticsPanel({ stats, statsLoading, statusChartData, typeChartData }) {
  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!stats) {
    return <EmptyState icon={BarChart2} text="No analytics data" />;
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="p-4 space-y-4">
      {/* Revenue Summary */}
      {stats.revenue && (
        <div className="glass-card p-4">
          <p className="text-xs font-bold text-base-content/60 mb-3 uppercase tracking-wider">Revenue Summary</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-black text-success">{fmtCurrency(stats.revenue.totalRevenue)}</p>
              <p className="text-xs text-base-content/40 mt-0.5">Total Revenue</p>
            </div>
            <div>
              <p className="text-2xl font-black text-primary">{stats.revenue.count}</p>
              <p className="text-xs text-base-content/40 mt-0.5">Completed Bookings</p>
            </div>
            <div>
              <p className="text-2xl font-black text-info">
                {fmtCurrency(stats.revenue.count ? stats.revenue.totalRevenue / stats.revenue.count : 0)}
              </p>
              <p className="text-xs text-base-content/40 mt-0.5">Avg. Per Booking</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs font-bold text-base-content/60 mb-3 uppercase tracking-wider">Status Overview</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={statusChartData} margin={{ left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ fontSize: 11, background: 'var(--base-200)', border: 'none', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs font-bold text-base-content/60 mb-3 uppercase tracking-wider">Booking Types</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={typeChartData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3}>
                {typeChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 10, background: 'var(--base-200)', border: 'none', borderRadius: 8 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By Status breakdown */}
      {stats.byStatus && (
        <div className="glass-card p-4">
          <p className="text-xs font-bold text-base-content/60 mb-3 uppercase tracking-wider">Status Breakdown</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(stats.byStatus).map(([k, v]) => {
              const cfg = STATUS_CONFIG[k] || { color: 'neutral', label: k, icon: Info };
              const Icon = cfg.icon;
              return (
                <div key={k} className={`flex items-center gap-2 p-2 rounded-lg bg-${cfg.color}/5 border border-${cfg.color}/20`}>
                  <Icon size={12} className={`text-${cfg.color} flex-shrink-0`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-black text-${cfg.color}`}>{v}</p>
                    <p className="text-[10px] text-base-content/50 truncate">{cfg.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// OPs PANEL — standalone, used in right panel OPs tab
// ═════════════════════════════════════════════════════════════════════════════

function OpsPanel({
  adminOps, adminOpsMeta, opsLoading,
  opsFilters, setOpsFilters,
  onSelectOp,
  dispatch, fetchAdminOps,
}) {
  const totalOpPages = adminOpsMeta?.pages || 1;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* OP filters */}
      <div className="p-3 border-b border-base-300 flex gap-2 flex-shrink-0">
        <select
          value={opsFilters.status}
          onChange={e => setOpsFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
          className="input-field flex-1 text-xs h-8"
        >
          <option value="">All OP Statuses</option>
          {Object.entries(OP_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => dispatch(fetchAdminOps({ ...opsFilters }))} className="btn btn-xs btn-ghost btn-circle">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {opsLoading && <div className="flex items-center justify-center py-12"><Spinner /></div>}
        {!opsLoading && !adminOps?.length && <EmptyState icon={ClipboardList} text="No OP records" />}

        {!opsLoading && !!adminOps?.length && (
          <div className="p-3 space-y-2">
            <AnimatePresence mode="popLayout">
              {adminOps.map(op => (
                <motion.div
                  key={op._id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-card p-3 cursor-pointer hover:border-primary/40 transition-all duration-200"
                  onClick={() => onSelectOp(op)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-black text-primary">{op.opNumber}</span>
                      <span className={`badge badge-xs bg-${OP_STATUS_CONFIG[op.status]?.color || 'neutral'}/10 text-${OP_STATUS_CONFIG[op.status]?.color || 'neutral'} border-0`}>
                        {OP_STATUS_CONFIG[op.status]?.label || op.status}
                      </span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); onSelectOp(op); }}
                      className="btn btn-xs btn-outline flex-shrink-0"
                    >
                      Update
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-base-content truncate">
                    {op.patient?.name || op.patientName || '—'} · {op.doctor?.user?.name || '—'}
                  </p>
                  <p className="text-xs text-base-content/40 mt-0.5">{fmtDate(op.scheduledAt)} · {op.consultationType || '—'}</p>
                  {op.doctorNotes && (
                    <p className="text-xs text-base-content/50 mt-2 line-clamp-2 italic">"{op.doctorNotes}"</p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* OP Pagination */}
        {!opsLoading && totalOpPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-base-300 bg-base-100 sticky bottom-0">
            <span className="text-xs text-base-content/50">Page {opsFilters.page} of {totalOpPages}</span>
            <div className="flex gap-1">
              <button disabled={opsFilters.page <= 1} onClick={() => setOpsFilters(f => ({ ...f, page: f.page - 1 }))} className="btn btn-xs btn-ghost btn-circle"><ChevronLeft size={12} /></button>
              <button disabled={opsFilters.page >= totalOpPages} onClick={() => setOpsFilters(f => ({ ...f, page: f.page + 1 }))} className="btn btn-xs btn-ghost btn-circle"><ChevronRight size={12} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function BookingsManagement() {
  const dispatch = useDispatch();

  const user = useSelector(selectUser);

  const bookings        = useSelector(selectAdminBookings);
  const bookingsMeta    = useSelector(selectAdminBookingsMeta);
  const bookingsLoading = useSelector(selectAdminBookingsLoading);

  const bookingDetail     = useSelector(selectAdminBookingDetail);
  const opRecord          = useSelector(selectAdminOpRecord);
  const followUps         = useSelector(selectAdminBookingFollowUps);
  const detailLoading     = useSelector(selectAdminBookingDetailLoading);

  const stats        = useSelector(selectAdminStats);
  const statsLoading = useSelector(selectAdminStatsLoading);
  const exportLoading = useSelector(selectAdminExportLoading);

  const statusUpdate = useSelector(selectAdminStatusUpdate);

  const nearbySolo    = useSelector(selectNearbySoloDrivers);
  const nearbyTPs     = useSelector(selectNearbyTPs);
  const nearbyCare    = useSelector(selectNearbyCareAssistants);
  const nearbyHosps   = useSelector(selectNearbyHospitals);
  const nearbyLoading = useSelector(selectNearbyLoading);

  const assignment    = useSelector(selectAdminAssignment);
  const assignLoading = useSelector(selectAdminAssignLoading);

  const refund        = useSelector(selectAdminRefund);
  const refundLoading = useSelector(selectAdminRefundLoading);

  const adminOps          = useSelector(selectAdminOps);
  const adminOpsMeta      = useSelector(selectAdminOpsMeta);
  const opsLoading        = useSelector(selectAdminOpsLoading);
  const opStatusUpdate    = useSelector(selectAdminOpStatusUpdate);

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  // Right panel tabs: 'bookings' | 'ops' | 'analytics'
  const [rightTab, setRightTab] = useState('bookings');

  // Within bookings detail: 'detail' | 'nearby'
  const [rightPanel, setRightPanel] = useState('detail');
  const [nearbyTab, setNearbyTab] = useState('solo');
  const [detailTab, setDetailTab] = useState('info');

  const [filters, setFilters] = useState({
    status: '', bookingType: '', search: '', from: '', to: '', page: 1, limit: 15,
  });
  const [opsFilters, setOpsFilters] = useState({
    status: '', doctorId: '', hospitalId: '', page: 1, limit: 15,
  });

  const [modal, setModal] = useState(null);
  const [selectedOp, setSelectedOp] = useState(null);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const params = {};
    if (filters.status)      params.status      = filters.status;
    if (filters.bookingType) params.bookingType = filters.bookingType;
    if (filters.search)      params.search      = filters.search;
    if (filters.from)        params.from        = filters.from;
    if (filters.to)          params.to          = filters.to;
    params.page  = filters.page;
    params.limit = filters.limit;
    dispatch(fetchAdminBookings(params));
  }, [dispatch, filters.status, filters.bookingType, filters.search, filters.from, filters.to, filters.page, filters.limit]);

  useEffect(() => {
    dispatch(fetchAdminBookingStats());
  }, [dispatch]);

  useEffect(() => {
    if (rightTab === 'ops') {
      dispatch(fetchAdminOps({ ...opsFilters }));
    }
  }, [dispatch, rightTab, opsFilters]);

  useEffect(() => {
    if (selectedBookingId) {
      dispatch(fetchAdminBookingById(selectedBookingId));
    } else {
      dispatch(clearAdminBookingDetail());
    }
  }, [dispatch, selectedBookingId]);

  useEffect(() => {
    if (rightPanel === 'nearby' && selectedBookingId) {
      dispatch(clearNearbyResults());
      dispatch(fetchNearbySoloDrivers(selectedBookingId));
      dispatch(fetchNearbyTPs(selectedBookingId));
      dispatch(fetchNearbyCareAssistants(selectedBookingId));
      dispatch(fetchNearbyHospitals(selectedBookingId));
    }
  }, [dispatch, rightPanel, selectedBookingId]);

  useEffect(() => {
    if (assignment.status === 'success') {
      const t = setTimeout(() => dispatch(resetAdminAssignment()), 2500);
      return () => clearTimeout(t);
    }
  }, [dispatch, assignment.status]);

  useEffect(() => {
    if (refund.status === 'success') {
      setModal(null);
      const t = setTimeout(() => dispatch(resetAdminRefund()), 2000);
      return () => clearTimeout(t);
    }
  }, [dispatch, refund.status]);

  useEffect(() => {
    if (statusUpdate.status === 'success') {
      setModal(null);
      if (selectedBookingId) dispatch(fetchAdminBookingById(selectedBookingId));
      const t = setTimeout(() => dispatch(resetAdminStatusUpdate()), 2000);
      return () => clearTimeout(t);
    }
  }, [dispatch, statusUpdate.status]);

  useEffect(() => {
    if (opStatusUpdate.status === 'success') {
      setModal(null);
      const t = setTimeout(() => dispatch(resetAdminOpStatusUpdate()), 2000);
      return () => clearTimeout(t);
    }
  }, [dispatch, opStatusUpdate.status]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelectBooking = useCallback((id) => {
    setSelectedBookingId(prev => {
      if (prev === id) {
        dispatch(clearAdminBookingDetail());
        return null;
      }
      return id;
    });
    setRightPanel('detail');
    setDetailTab('info');
    // Switch right panel to booking detail view
    setRightTab('bookings');
  }, [dispatch]);

  const handleExport = () => dispatch(exportAdminBookings({ ...filters }));

  const handleAssign = (type, id) => {
    if (!selectedBookingId) return;
    const bid = selectedBookingId;
    if (type === 'solo')     dispatch(adminAssignSoloDriver({ bookingId: bid, soloDriverPartnerId: id }));
    if (type === 'tp')       dispatch(adminAssignTP({ bookingId: bid, transportPartnerId: id }));
    if (type === 'care')     dispatch(adminAssignCareAssistant({ bookingId: bid, careAssistantId: id }));
    if (type === 'hospital') dispatch(adminAssignHospital({ bookingId: bid, hospitalId: id }));
  };

  const handleStatusUpdate = ({ status, note }) => {
    dispatch(updateAdminBookingStatus({ bookingId: selectedBookingId, status, note }));
  };

  const handleRefund = ({ refundAmount, reason }) => {
    dispatch(adminProcessRefund({ bookingId: selectedBookingId, refundAmount, reason }));
  };

  const handleReassignDriver = ({ newDriverUserId, reason }) => {
    dispatch(adminReassignDriver({ bookingId: selectedBookingId, newDriverUserId, reason }));
    setModal(null);
  };

  const handleReassignCare = ({ newCareAssistantId }) => {
    dispatch(adminReassignCare({ bookingId: selectedBookingId, newCareAssistantId }));
    setModal(null);
  };

  const handleOpStatusUpdate = ({ status, doctorNotes }) => {
    dispatch(updateAdminOpStatus({ opId: selectedOp._id, status, doctorNotes }));
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const statusChartData = stats?.byStatus
    ? Object.entries(stats.byStatus).map(([k, v]) => ({ name: STATUS_CONFIG[k]?.label || k, value: v }))
    : [];

  const typeChartData = stats?.byBookingType
    ? Object.entries(stats.byBookingType).map(([k, v]) => ({
        name: BOOKING_TYPE_LABELS[k] || k,
        value: v,
        fill: BOOKING_TYPE_COLORS[k] || '#6366f1',
      }))
    : [];

  const totalPages   = bookingsMeta?.pages || 1;
  const currentPage  = filters.page;

  const bookingType       = bookingDetail?.bookingType;
  const hasOp             = bookingType && HAS_OP_TYPES.includes(bookingType);
  const hasRide           = bookingType && HAS_RIDE_TYPES.includes(bookingType);
  const hasCare           = bookingType && HAS_CARE_TYPES.includes(bookingType);

  const refundEligible = bookingDetail &&
    ['completed', 'cancelled'].includes(bookingDetail.status) &&
    !['refunded', 'refund_pending'].includes(bookingDetail.status) &&
    (bookingDetail.fareBreakdown?.amountPaid > 0);

  const nearbyTabs = [
    { key: 'solo',     label: 'Solo Drivers', data: nearbySolo,  icon: Car },
    { key: 'tp',       label: 'Transport',    data: nearbyTPs,   icon: Truck },
    { key: 'care',     label: 'Care',         data: nearbyCare,  icon: Heart },
    { key: 'hospital', label: 'Hospitals',    data: nearbyHosps, icon: Hospital },
  ];

  const selectedNearbyData = nearbyTabs.find(t => t.key === nearbyTab)?.data || [];

  // ── RIGHT PANEL TABS config ────────────────────────────────────────────────

  const RIGHT_TABS = [
    { key: 'bookings',  icon: Grid3X3,    label: 'Booking Detail' },
    { key: 'ops',       icon: ClipboardList, label: 'OPs' },
    { key: 'analytics', icon: BarChart2,  label: 'Analytics' },
  ];

  return (
    <div className="min-h-screen bg-base-100" data-theme="admin">

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal === 'refund' && bookingDetail && (
          <RefundModal booking={bookingDetail} onSubmit={handleRefund} onClose={() => setModal(null)} loading={refundLoading} />
        )}
        {modal === 'status' && bookingDetail && (
          <StatusModal booking={bookingDetail} onSubmit={handleStatusUpdate} onClose={() => setModal(null)} loading={statusUpdate.status === 'loading'} />
        )}
        {modal === 'reassignDriver' && (
          <ReassignModal type="driver" onSubmit={handleReassignDriver} onClose={() => setModal(null)} loading={assignLoading} />
        )}
        {modal === 'reassignCare' && (
          <ReassignModal type="care" onSubmit={handleReassignCare} onClose={() => setModal(null)} loading={assignLoading} />
        )}
        {modal === 'opStatus' && selectedOp && (
          <OpStatusModal op={selectedOp} onSubmit={handleOpStatusUpdate} onClose={() => setModal(null)} loading={opStatusUpdate.status === 'loading'} />
        )}
      </AnimatePresence>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/90 backdrop-blur-strong px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Layers size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black text-base-content tracking-tight leading-none">Bookings Management</h1>
              <p className="text-xs text-base-content/50 mt-0.5">
                {user?.name} · {user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleExport} disabled={exportLoading} className="btn btn-sm btn-outline">
              {exportLoading ? <Spinner size="xs" /> : <Download size={13} />}
              <span className="hidden sm:inline ml-1">Export</span>
            </button>
            <button onClick={() => dispatch(fetchAdminBookingStats())} className="btn btn-sm btn-ghost btn-circle">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">

        {/* ══════════════════════════════════════════════════════════════════════
            LEFT PANEL — Stats strip + Filters + Card List
        ══════════════════════════════════════════════════════════════════════ */}
        <aside className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0 border-r border-base-300 flex flex-col overflow-hidden">

          {/* Stats Strip */}
          <div className="border-b border-base-300 p-3">
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.07 } } }}
              className="grid grid-cols-4 gap-2"
            >
              <StatCard label="Total"     value={bookingsMeta?.total ?? '—'}                                                                  icon={Package}      color="primary" loading={statsLoading} />
              <StatCard label="Revenue"   value={stats?.revenue ? `₹${((stats.revenue.totalRevenue || 0) / 1000).toFixed(0)}K` : '—'}         icon={DollarSign}   color="success" loading={statsLoading} />
              <StatCard label="Completed" value={stats?.byStatus?.completed ?? '—'}                                                           icon={CheckCircle}  color="success" loading={statsLoading} />
              <StatCard label="Pending"   value={stats?.byStatus?.pending ?? '—'}                                                             icon={Clock}        color="warning" loading={statsLoading} />
            </motion.div>
          </div>

          {/* Mini Charts */}
          {stats && (
            <div className="border-b border-base-300 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="glass-card p-2">
                  <p className="text-xs font-bold text-base-content/60 mb-1">By Status</p>
                  <ResponsiveContainer width="100%" height={80}>
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" cx="50%" cy="50%" outerRadius={32} paddingAngle={3}>
                        {statusChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 10, background: 'var(--base-200)', border: 'none', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="glass-card p-2">
                  <p className="text-xs font-bold text-base-content/60 mb-1">By Type</p>
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={typeChartData} margin={{ left: -20, right: 2, top: 2, bottom: 2 }}>
                      <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [v, 'Bookings']} contentStyle={{ fontSize: 10, background: 'var(--base-200)', border: 'none', borderRadius: 8 }} />
                      <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                        {typeChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="border-b border-base-300 p-3 space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="text"
                placeholder="Search by code, patient name…"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                className="input-field w-full pl-8 text-xs h-8"
              />
              {filters.search && (
                <button onClick={() => setFilters(f => ({ ...f, search: '', page: 1 }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))} className="input-field flex-1 text-xs h-8">
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filters.bookingType} onChange={e => setFilters(f => ({ ...f, bookingType: e.target.value, page: 1 }))} className="input-field flex-1 text-xs h-8">
                <option value="">All Types</option>
                {Object.entries(BOOKING_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value, page: 1 }))} className="input-field flex-1 text-xs h-8" />
              <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value, page: 1 }))} className="input-field flex-1 text-xs h-8" />
              {(filters.from || filters.to || filters.status || filters.bookingType || filters.search) && (
                <button onClick={() => setFilters({ status: '', bookingType: '', search: '', from: '', to: '', page: 1, limit: 15 })} className="btn btn-xs btn-ghost">
                  <X size={11} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* ── BOOKING CARDS LIST ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            {bookingsLoading && (
              <div className="flex items-center justify-center py-12"><Spinner /></div>
            )}
            {!bookingsLoading && !bookings?.length && (
              <EmptyState icon={Package} text="No bookings found" />
            )}
            {!bookingsLoading && !!bookings?.length && (
              <div className="p-3 space-y-2">
                <AnimatePresence mode="popLayout">
                  {bookings.map(b => (
                    <BookingCard
                      key={b._id}
                      booking={b}
                      selected={selectedBookingId === b._id}
                      onSelect={handleSelectBooking}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Pagination */}
            {!bookingsLoading && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-base-300 bg-base-100 sticky bottom-0">
                <span className="text-xs text-base-content/50">
                  Page {currentPage} of {totalPages} · {bookingsMeta?.total} total
                </span>
                <div className="flex gap-1">
                  <button disabled={currentPage <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))} className="btn btn-xs btn-ghost btn-circle">
                    <ChevronLeft size={12} />
                  </button>
                  <button disabled={currentPage >= totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} className="btn btn-xs btn-ghost btn-circle">
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════════════════════
            RIGHT PANEL — Tab switcher: Booking Detail | OPs | Analytics
        ══════════════════════════════════════════════════════════════════════ */}
        <main className="hidden md:flex flex-1 flex-col overflow-hidden bg-base-200/30">

          {/* ── Right Panel Tab Bar ──────────────────────────────────────────── */}
          <div className="flex-shrink-0 border-b border-base-300 bg-base-100/80 backdrop-blur-sm px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1 p-0.5 rounded-xl bg-base-200 border border-base-300">
                {RIGHT_TABS.map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setRightTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${rightTab === key ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'}`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>

              {/* Detail / Nearby toggle — only visible when booking selected + bookings tab */}
              {rightTab === 'bookings' && selectedBookingId && (
                <div className="flex gap-1 p-0.5 rounded-lg bg-base-200 border border-base-300">
                  {[
                    { key: 'detail', icon: Eye,        label: 'Detail' },
                    { key: 'nearby', icon: Navigation, label: 'Nearby' },
                  ].map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      onClick={() => setRightPanel(key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-200 ${rightPanel === key ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'}`}
                    >
                      <Icon size={11} /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── BOOKINGS TAB ────────────────────────────────────────────────── */}
          {rightTab === 'bookings' && (
            <AnimatePresence mode="wait">
              {/* No booking selected */}
              {!selectedBookingId && (
                <motion.div key="empty" variants={fadeIn} initial="hidden" animate="show"
                  className="flex-1 flex flex-col items-center justify-center gap-4 p-8"
                >
                  <div className="text-center">
                    <div className="p-4 rounded-2xl bg-primary/10 inline-flex mb-4">
                      <Grid3X3 size={32} className="text-primary" strokeWidth={1.5} />
                    </div>
                    <p className="text-base font-bold text-base-content/60">Select a booking to view details</p>
                    <p className="text-sm text-base-content/30 mt-1">Click any booking card on the left</p>
                  </div>
                </motion.div>
              )}

              {/* Booking selected */}
              {selectedBookingId && (
                <motion.div key={selectedBookingId} variants={slideIn} initial="hidden" animate="show" exit="hidden" className="flex-1 flex flex-col overflow-hidden">

                  {/* Booking code header */}
                  <div className="flex-shrink-0 border-b border-base-300 px-4 py-2 bg-base-100/50 flex items-center gap-2">
                    <button onClick={() => { setSelectedBookingId(null); dispatch(clearAdminBookingDetail()); }} className="btn btn-xs btn-ghost btn-circle">
                      <ArrowLeft size={13} />
                    </button>
                    {detailLoading ? (
                      <div className="skeleton h-4 w-32 rounded" />
                    ) : (
                      <>
                        <span className="text-sm font-bold text-primary">{bookingDetail?.bookingCode}</span>
                        <span className="text-xs text-base-content/50">{BOOKING_TYPE_LABELS[bookingDetail?.bookingType] || bookingDetail?.bookingType}</span>
                        {bookingDetail && <StatusBadge status={bookingDetail.status} />}
                      </>
                    )}
                  </div>

                  {/* ── DETAIL PANEL ────────────────────────────────────────── */}
                  {rightPanel === 'detail' && (
                    <div className="flex-1 overflow-y-auto">
                      {detailLoading && <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>}

                      {!detailLoading && bookingDetail && (
                        <div className="p-4 space-y-4">

                          {/* Detail Sub-Tabs */}
                          <div className="flex gap-1 p-0.5 rounded-xl bg-base-200 border border-base-300 w-fit">
                            {[
                              { k: 'info',    l: 'Info' },
                              { k: 'fare',    l: 'Fare' },
                              ...(hasOp ? [{ k: 'op', l: 'OP / Follow-ups' }] : []),
                              { k: 'actions', l: 'Actions' },
                            ].map(({ k, l }) => (
                              <button
                                key={k}
                                onClick={() => setDetailTab(k)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 ${detailTab === k ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/50 hover:text-base-content'}`}
                              >
                                {l}
                              </button>
                            ))}
                          </div>

                          {/* ── INFO TAB ─────────────────────────────────────── */}
                          {detailTab === 'info' && (
                            <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
                              <div className="glass-card p-4">
                                <SectionTitle icon={User} label="Patient & Customer" />
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                  <InfoRow label="Patient" value={bookingDetail.patientInfo?.name} />
                                  <InfoRow label="Age / Gender" value={`${bookingDetail.patientInfo?.age || '—'} / ${bookingDetail.patientInfo?.gender || '—'}`} />
                                  <InfoRow label="Phone" value={bookingDetail.patientInfo?.phone || bookingDetail.customer?.phone} />
                                  <InfoRow label="Blood Group" value={bookingDetail.patientInfo?.bloodGroup} />
                                  <InfoRow label="Customer" value={bookingDetail.customer?.name} />
                                  <InfoRow label="Customer Email" value={bookingDetail.customer?.email} />
                                </div>
                              </div>

                              <div className="glass-card p-4">
                                <SectionTitle icon={Calendar} label="Booking Details" />
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                  <InfoRow label="Code" value={bookingDetail.bookingCode} bold />
                                  <InfoRow label="Type" value={BOOKING_TYPE_LABELS[bookingDetail.bookingType]} />
                                  <InfoRow label="Scheduled" value={fmt(bookingDetail.scheduledAt)} />
                                  <InfoRow label="Consultation" value={bookingDetail.consultationType} />
                                  <InfoRow label="Created" value={fmt(bookingDetail.createdAt)} />
                                  <InfoRow label="Payment" value={bookingDetail.paymentStatus} />
                                </div>
                              </div>

                              {(bookingDetail.patientLocation || bookingDetail.destinationLocation) && (
                                <div className="glass-card p-4">
                                  <SectionTitle icon={MapPin} label="Locations" />
                                  <div className="space-y-2 text-xs">
                                    {bookingDetail.patientLocation && (
                                      <div>
                                        <span className="text-base-content/50 font-semibold">Pickup: </span>
                                        <span className="text-base-content">
                                          {bookingDetail.patientLocation.address ||
                                            `${bookingDetail.patientLocation.coordinates?.[1]?.toFixed(4)}, ${bookingDetail.patientLocation.coordinates?.[0]?.toFixed(4)}`}
                                        </span>
                                      </div>
                                    )}
                                    {bookingDetail.destinationLocation && (
                                      <div>
                                        <span className="text-base-content/50 font-semibold">Destination: </span>
                                        <span className="text-base-content">
                                          {bookingDetail.destinationLocation.address ||
                                            `${bookingDetail.destinationLocation.coordinates?.[1]?.toFixed(4)}, ${bookingDetail.destinationLocation.coordinates?.[0]?.toFixed(4)}`}
                                        </span>
                                      </div>
                                    )}
                                    {bookingDetail.patientLocation?.coordinates && (
                                      <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${bookingDetail.patientLocation.coordinates[1]},${bookingDetail.patientLocation.coordinates[0]}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-primary text-xs font-semibold hover:underline mt-1"
                                      >
                                        <Navigation size={11} /> Open in Maps
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}

                              {(bookingDetail.doctorSnapshot?.name || bookingDetail.careAssistantSnapshot?.name || bookingDetail.hospital) && (
                                <div className="glass-card p-4">
                                  <SectionTitle icon={Users} label="Assigned Staff" />
                                  <div className="space-y-2 text-xs">
                                    {bookingDetail.doctorSnapshot?.name && (
                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-info/5 border border-info/20">
                                        <span className="p-1 rounded bg-info/10 text-info"><UserCheck size={12} /></span>
                                        <div>
                                          <p className="font-bold text-base-content">{bookingDetail.doctorSnapshot.name}</p>
                                          <p className="text-base-content/50">{bookingDetail.doctorSnapshot.specialization}</p>
                                        </div>
                                      </div>
                                    )}
                                    {bookingDetail.careAssistantSnapshot?.name && (
                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-success/5 border border-success/20">
                                        <span className="p-1 rounded bg-success/10 text-success"><Heart size={12} /></span>
                                        <div>
                                          <p className="font-bold text-base-content">{bookingDetail.careAssistantSnapshot.name}</p>
                                          <p className="text-base-content/50">{bookingDetail.careAssistantSnapshot.phone}</p>
                                        </div>
                                      </div>
                                    )}
                                    {bookingDetail.hospital && (
                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                                        <span className="p-1 rounded bg-primary/10 text-primary"><Hospital size={12} /></span>
                                        <p className="font-bold text-base-content">{bookingDetail.hospital?.name || 'Hospital assigned'}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {hasRide && bookingDetail.primaryRide && (
                                <div className="glass-card p-4">
                                  <SectionTitle icon={Car} label="Ride" />
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                    <InfoRow label="Ride Status" value={bookingDetail.primaryRide?.status} />
                                    <InfoRow label="Driver" value={bookingDetail.primaryRide?.driverSnapshot?.name} />
                                    <InfoRow label="Vehicle" value={bookingDetail.primaryRide?.vehicleSnapshot?.registrationNumber} />
                                    <InfoRow label="Scheduled Pickup" value={fmt(bookingDetail.primaryRide?.scheduledPickupAt)} />
                                  </div>
                                </div>
                              )}

                              {bookingDetail.statusLog?.length > 0 && (
                                <div className="glass-card p-4">
                                  <SectionTitle icon={Activity} label="Status History" count={bookingDetail.statusLog.length} />
                                  <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {[...bookingDetail.statusLog].reverse().map((log, i) => (
                                      <div key={i} className="flex items-start gap-2 text-xs">
                                        <span className="text-base-content/30 mt-0.5">•</span>
                                        <div>
                                          <span className="font-semibold text-base-content">
                                            {log.fromStatus ? `${log.fromStatus} → ` : ''}{log.toStatus}
                                          </span>
                                          <span className="text-base-content/40 ml-2">{fmtDate(log.changedAt)}</span>
                                          {log.reason && <p className="text-base-content/50 italic mt-0.5">{log.reason}</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {/* ── FARE TAB ─────────────────────────────────────── */}
                          {detailTab === 'fare' && (
                            <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
                              <div className="glass-card p-4">
                                <SectionTitle icon={DollarSign} label="Fare Breakdown" />
                                <div className="space-y-1.5">
                                  {[
                                    { l: 'Consultation Fee',    v: bookingDetail.fareBreakdown?.consultationFee },
                                    { l: 'Care Assistant Fee',  v: bookingDetail.fareBreakdown?.careAssistantFee },
                                    { l: 'Transport Fee',       v: bookingDetail.fareBreakdown?.transportFee },
                                    { l: 'Diagnostic Fee',      v: bookingDetail.fareBreakdown?.diagnosticFee },
                                    { l: 'Home Collection Fee', v: bookingDetail.fareBreakdown?.homeCollectionFee },
                                    { l: 'Platform Fee',        v: bookingDetail.fareBreakdown?.platformFee },
                                    { l: 'Taxes',               v: bookingDetail.fareBreakdown?.taxes },
                                    { l: 'Discount',            v: bookingDetail.fareBreakdown?.discount,       neg: true },
                                    { l: 'Coupon Discount',     v: bookingDetail.fareBreakdown?.couponDiscount, neg: true },
                                    { l: 'Wallet Applied',      v: bookingDetail.fareBreakdown?.walletApplied,  neg: true },
                                  ].filter(i => i.v > 0).map(({ l, v, neg }) => (
                                    <div key={l} className="flex justify-between items-center text-xs py-1 border-b border-base-300/50 last:border-0">
                                      <span className="text-base-content/60">{l}</span>
                                      <span className={`font-semibold ${neg ? 'text-success' : 'text-base-content'}`}>{neg ? '-' : ''}{fmtCurrency(v)}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between items-center text-sm pt-2 font-black">
                                    <span className="text-base-content">Total</span>
                                    <span className="text-primary">{fmtCurrency(bookingDetail.fareBreakdown?.totalAmount)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-base-content/60">Amount Paid</span>
                                    <span className="font-bold text-success">{fmtCurrency(bookingDetail.fareBreakdown?.amountPaid)}</span>
                                  </div>
                                  {bookingDetail.fareBreakdown?.refundAmount > 0 && (
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-base-content/60">Refunded</span>
                                      <span className="font-bold text-warning">{fmtCurrency(bookingDetail.fareBreakdown?.refundAmount)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {bookingDetail.payments?.length > 0 && (
                                <div className="glass-card p-4">
                                  <SectionTitle icon={CreditCard} label="Payments" count={bookingDetail.payments.length} />
                                  <div className="space-y-2">
                                    {bookingDetail.payments.map((p, i) => (
                                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-base-200/50">
                                        <div>
                                          <p className="font-semibold text-base-content">{p.gateway} · {p.paymentMode}</p>
                                          <p className="text-base-content/40 text-[10px]">{p.transactionId}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-bold text-base-content">{fmtCurrency(p.amount)}</p>
                                          <span className={`badge badge-xs bg-${p.status === 'success' ? 'success' : p.status === 'refunded' ? 'warning' : 'error'}/10 text-${p.status === 'success' ? 'success' : p.status === 'refunded' ? 'warning' : 'error'} border-0`}>
                                            {p.status}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {/* ── OP TAB ────────────────────────────────────────── */}
                          {detailTab === 'op' && hasOp && (
                            <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
                              {opRecord ? (
                                <div className="glass-card p-4">
                                  <SectionTitle icon={ClipboardList} label="OP Record" />
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
                                    <InfoRow label="OP Number" value={opRecord.opNumber} bold />
                                    <InfoRow label="Status" value={OP_STATUS_CONFIG[opRecord.status]?.label || opRecord.status} />
                                    <InfoRow label="Type" value={opRecord.consultationType} />
                                    <InfoRow label="Scheduled" value={fmtDate(opRecord.scheduledAt)} />
                                    <InfoRow label="Follow-up Expiry" value={fmtDate(opRecord.followUpExpiry)} />
                                    <InfoRow label="Is Follow-up" value={opRecord.isFollowUp ? 'Yes' : 'No'} />
                                  </div>
                                  {opRecord.reasonForVisit && (
                                    <div className="p-3 rounded-xl bg-base-200/60 border border-base-300 mb-2">
                                      <p className="text-xs font-bold text-base-content/60 mb-1">Reason for Visit</p>
                                      <p className="text-xs text-base-content/70">{opRecord.reasonForVisit}</p>
                                    </div>
                                  )}
                                  {opRecord.doctorNotes && (
                                    <div className="p-3 rounded-xl bg-info/5 border border-info/20 mb-2">
                                      <p className="text-xs font-bold text-info mb-1">Doctor Notes</p>
                                      <p className="text-xs text-base-content/70">{opRecord.doctorNotes}</p>
                                    </div>
                                  )}
                                  {opRecord.diagnosisCode && (
                                    <p className="text-xs text-base-content/50 mb-2">ICD-10: <span className="font-semibold text-base-content">{opRecord.diagnosisCode}</span></p>
                                  )}
                                  {opRecord.prescriptionUrl && (
                                    <a href={opRecord.prescriptionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-3">
                                      <FileText size={11} /> View Prescription
                                    </a>
                                  )}
                                  <div className="pt-3 border-t border-base-300">
                                    <button onClick={() => { setSelectedOp(opRecord); setModal('opStatus'); }} className="btn btn-xs btn-accent">
                                      <ClipboardList size={11} /> Update OP Status
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <EmptyState icon={ClipboardList} text="No OP record for this booking" />
                              )}

                              {followUps?.length > 0 && (
                                <div className="glass-card p-4">
                                  <SectionTitle icon={ArrowUpRight} label="Follow-Up OPs" count={followUps.length} />
                                  <div className="space-y-2">
                                    {followUps.map(fu => (
                                      <div key={fu._id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-base-200/50">
                                        <div>
                                          <p className="font-bold text-primary">{fu.opNumber}</p>
                                          <p className="text-base-content/50">{fmtDate(fu.scheduledAt)}</p>
                                        </div>
                                        <span className={`badge badge-xs bg-${OP_STATUS_CONFIG[fu.status]?.color || 'neutral'}/10 text-${OP_STATUS_CONFIG[fu.status]?.color || 'neutral'} border-0`}>
                                          {OP_STATUS_CONFIG[fu.status]?.label || fu.status}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {/* ── ACTIONS TAB ──────────────────────────────────── */}
                          {detailTab === 'actions' && (
                            <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
                              <div className="glass-card p-4">
                                <SectionTitle icon={Zap} label="Quick Actions" />
                                <div className="grid grid-cols-2 gap-2">
                                  <button onClick={() => setModal('status')} className="btn btn-sm btn-primary w-full">
                                    <Activity size={13} /> Update Status
                                  </button>
                                  <button onClick={() => setModal('refund')} disabled={!refundEligible} className="btn btn-sm btn-warning w-full" title={!refundEligible ? 'Only available for completed/cancelled bookings with payment' : ''}>
                                    <CreditCard size={13} /> Refund
                                  </button>
                                  {hasRide && (
                                    <button onClick={() => setModal('reassignDriver')} className="btn btn-sm btn-outline w-full">
                                      <Car size={13} /> Reassign Driver
                                    </button>
                                  )}
                                  {hasCare && (
                                    <button onClick={() => setModal('reassignCare')} className="btn btn-sm btn-outline w-full">
                                      <Heart size={13} /> Reassign Care
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="glass-card p-4">
                                <SectionTitle icon={Navigation} label="Assign Nearby Partners" />
                                <p className="text-xs text-base-content/50 mb-3">Find and assign nearby drivers, TPs, care assistants, or hospitals.</p>
                                <button onClick={() => setRightPanel('nearby')} className="btn btn-sm btn-secondary w-full">
                                  <Navigation size={13} /> Open Nearby Panel
                                </button>
                              </div>

                              <div className="glass-card p-4">
                                <SectionTitle icon={Info} label="Booking Info" />
                                <div className="space-y-1 text-xs">
                                  {[
                                    { l: 'Type',           v: BOOKING_TYPE_LABELS[bookingDetail?.bookingType] },
                                    { l: 'Has Transport',  v: hasRide ? 'Yes' : 'No',  color: hasRide ? 'text-success' : 'text-base-content/30' },
                                    { l: 'Has Care',       v: hasCare ? 'Yes' : 'No',  color: hasCare ? 'text-success' : 'text-base-content/30' },
                                    { l: 'Has Doctor/OP',  v: hasOp   ? 'Yes' : 'No',  color: hasOp   ? 'text-success' : 'text-base-content/30' },
                                    { l: 'Payment Status', v: bookingDetail?.paymentStatus },
                                  ].map(({ l, v, color }) => (
                                    <div key={l} className="flex justify-between">
                                      <span className="text-base-content/50">{l}</span>
                                      <span className={`font-semibold ${color || ''}`}>{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <AnimatePresence>
                                {assignment.status === 'success' && (
                                  <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden" className="alert alert-success text-xs">
                                    <CheckCircle size={14} /> Assignment successful!
                                  </motion.div>
                                )}
                                {assignment.status === 'failed' && (
                                  <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden" className="alert alert-error text-xs">
                                    <AlertTriangle size={14} /> {assignment.error}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── NEARBY PANEL ──────────────────────────────────────────── */}
                  {rightPanel === 'nearby' && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-base-content">Nearby Partners</h3>
                        {nearbyLoading && <Spinner size="sm" />}
                      </div>

                      <div className="flex gap-1 p-0.5 rounded-xl bg-base-200 border border-base-300">
                        {nearbyTabs.map(({ key, label, data, icon: Icon }) => (
                          <button
                            key={key}
                            onClick={() => setNearbyTab(key)}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${nearbyTab === key ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'}`}
                          >
                            <Icon size={11} />
                            <span className="hidden sm:inline">{label}</span>
                            {data.length > 0 && (
                              <span className={`text-[10px] px-1 rounded-full ${nearbyTab === key ? 'bg-white/20' : 'bg-base-300'}`}>{data.length}</span>
                            )}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <AnimatePresence mode="popLayout">
                          {selectedNearbyData.length === 0 && !nearbyLoading && (
                            <EmptyState
                              icon={nearbyTab === 'solo' ? Car : nearbyTab === 'tp' ? Truck : nearbyTab === 'care' ? Heart : Hospital}
                              text={`No nearby ${nearbyTab === 'solo' ? 'solo drivers' : nearbyTab === 'tp' ? 'transport partners' : nearbyTab === 'care' ? 'care assistants' : 'hospitals'}`}
                            />
                          )}
                          {selectedNearbyData.map((item, i) => (
                            <NearbyCard
                              key={
                                nearbyTab === 'solo'   ? (item.soloPartnerId   || i)
                                : nearbyTab === 'tp'   ? (item.tpId            || i)
                                : nearbyTab === 'care' ? (item.careAssistantId || i)
                                : (item.hospitalId || i)
                              }
                              item={item}
                              type={nearbyTab}
                              onAssign={(id) => handleAssign(nearbyTab, id)}
                              loading={assignLoading}
                            />
                          ))}
                        </AnimatePresence>
                      </div>

                      <button
                        onClick={() => {
                          dispatch(clearNearbyResults());
                          dispatch(fetchNearbySoloDrivers(selectedBookingId));
                          dispatch(fetchNearbyTPs(selectedBookingId));
                          dispatch(fetchNearbyCareAssistants(selectedBookingId));
                          dispatch(fetchNearbyHospitals(selectedBookingId));
                        }}
                        className="btn btn-sm btn-ghost w-full"
                      >
                        <RefreshCw size={12} /> Refresh Nearby
                      </button>

                      <AnimatePresence>
                        {assignment.status === 'success' && (
                          <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden" className="alert alert-success text-xs">
                            <CheckCircle size={14} className="flex-shrink-0" /> Assignment successful!
                          </motion.div>
                        )}
                        {assignment.status === 'failed' && (
                          <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden" className="alert alert-error text-xs">
                            <AlertTriangle size={14} className="flex-shrink-0" /> {assignment.error}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* ── OPs TAB ─────────────────────────────────────────────────────── */}
          {rightTab === 'ops' && (
            <OpsPanel
              adminOps={adminOps}
              adminOpsMeta={adminOpsMeta}
              opsLoading={opsLoading}
              opsFilters={opsFilters}
              setOpsFilters={setOpsFilters}
              onSelectOp={(op) => { setSelectedOp(op); setModal('opStatus'); }}
              dispatch={dispatch}
              fetchAdminOps={fetchAdminOps}
            />
          )}

          {/* ── ANALYTICS TAB ───────────────────────────────────────────────── */}
          {rightTab === 'analytics' && (
            <div className="flex-1 overflow-y-auto">
              <AnalyticsPanel
                stats={stats}
                statsLoading={statsLoading}
                statusChartData={statusChartData}
                typeChartData={typeChartData}
              />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}