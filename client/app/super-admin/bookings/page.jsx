'use client';
 

import { useState, useEffect, useCallback, useRef }        from 'react';
import { useDispatch, useSelector }                         from 'react-redux';
import { useRouter }                                        from 'next/navigation';
import { motion, AnimatePresence }                          from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts';
import {
  Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight,
  MapPin, User, Car, Building2, Stethoscope, Heart, Phone, Mail,
  Clock, AlertTriangle, CheckCircle, XCircle, RotateCcw,
  TrendingUp, TrendingDown, DollarSign, Activity, BarChart2,
  Calendar, Layers, Shield, Zap, Eye, MoreVertical, ArrowRight,
  Truck, UserCheck, Hospital, Navigation, Radio, FileText,
  ChevronDown, ChevronUp, Star, Package, Info, Send,
  Wallet, CreditCard, Ban, Edit2, Plus, Minus, X, Video,
} from 'lucide-react';

// ── operationsSlice — all booking/assignment/refund/tracking actions ─────────
import {
  fetchAdminBookings,
  fetchAdminBookingStats,
  exportAdminBookings,
  fetchAdminBookingById,
  updateAdminBookingStatus,
  clearAdminBookingDetail,
  clearNearbyResults,
  resetAdminStatusUpdate,
  resetAdminAssignment,
  resetAdminRefund,
  resetAdminOpStatusUpdate,
  fetchNearbyCareAssistants,
  fetchNearbySoloDrivers,
  fetchNearbyTransportPartners,
  fetchNearbyHospitals,
  adminAssignSoloDriver,
  adminAssignTransportPartner,
  adminAssignCareAssistant,
  adminAssignHospital,
  adminReassignDriver,
  adminReassignCareAssistant,
  adminProcessRefund,
  fetchAdminOps,
  updateAdminOpStatus,
  adminRequestCareRide,
  fetchAdminCareRideNearby,
  fetchCareTrackingSnapshot,
  selectAdminBookings,
  selectAdminBookingsMeta,
  selectAdminStats,
  selectAdminBookingDetail,
  selectAdminOpRecord,
  selectAdminBookingFollowUps,
  selectAdminOps,
  selectAdminOpsMeta,
  selectNearbyDrivers,
  selectNearbyCareAssistants,
  selectNearbyTPs,
  selectNearbyHospitals,
  selectCareRideNearby,
  selectCareTrackingSnapshot,
  selectCareAssistantLocation,
  selectAdminStatusUpdate,
  selectAdminAssignment,
  selectAdminRefund,
  selectAdminOpStatusUpdate,
  selectAdminBookingsLoading,
  selectAdminBookingDetailLoading,
  selectAdminStatsLoading,
  selectAdminExportLoading,
  selectAdminOpsLoading,
  selectAdminRefundLoading,
  selectNearbyLoading,
  selectAdminAssignLoading,
  selectLiveLocation,
  selectSocketConnected,
  selectLoading,
  selectError,
} from '@/store/slices/operationsSlice';

// ── consultationSlice — createConsultation + Agora token fetch ───────────────
import {
  createConsultation,
  fetchAgoraTokens,
  provisionAgoraTokens,
  selectAgora,
  selectLoading as selectConsultLoading,
} from '@/store/slices/consultationSlice';

// ── userSlice ─────────────────────────────────────────────────────────────────
import { selectCurrentUser } from '@/store/slices/userSlice';

import LiveTrackingPanel from './LiveTrackingPanel';

/* ─────────────────────────────────────────────────────────────────────────── */
/* CONSTANTS                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

const BOOKING_TYPES = [
  'full_care_ride', 'doctor_consultation', 'doctor_online',
  'physiotherapist', 'care_assistant', 'diagnostic_center',
  'diagnostic_home', 'patient_transport', 'follow_up',
];

const BOOKING_STATUSES = [
  'draft', 'pending', 'confirmed', 'in_progress',
  'completed', 'cancelled', 'no_show', 'refund_pending', 'refunded',
];

const OP_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];

const STATUS_NOTE_OPTIONS = {
  cancelled:   ['Patient cancelled — no charge', 'Patient no-show — cancellation fee applied', 'Doctor unavailable — rescheduled', 'Hospital at capacity', 'Transport unavailable in area', 'Weather/emergency cancellation', 'Admin initiated — operational issue'],
  confirmed:   ['Manual confirmation — payment verified', 'Admin override — special case', 'Re-confirmed after reschedule'],
  refunded:    ['Full refund — service not rendered', 'Partial refund — service partially delivered', 'Goodwill refund — service quality issue', 'Refund per dispute resolution', 'Technical error refund'],
  in_progress: ['Admin-initiated start — driver on site'],
  completed:   ['Admin-marked complete — verified by ops team', 'Manual completion — GPS off'],
  no_show:     ['Patient no-show confirmed', 'Unreachable after 3 attempts'],
  pending:     ['Reverted to pending — payment re-verification needed'],
  draft:       ['Reverted to draft — details incomplete'],
};

const OP_NOTE_OPTIONS = {
  completed:   ['Consultation completed normally', 'Teleconsultation completed', 'Admin-verified completion'],
  cancelled:   ['Doctor unavailable', 'Patient no-show', 'Hospital request', 'Emergency cancellation'],
  no_show:     ['Patient did not appear', 'Unreachable — marked no-show after 30 min'],
  in_progress: ['Consultation started — doctor confirmed'],
  scheduled:   ['Reverted to scheduled — error correction'],
};

const STATUS_COLORS = {
  draft:          '#94a3b8',
  pending:        '#f59e0b',
  confirmed:      '#3b82f6',
  in_progress:    '#8b5cf6',
  completed:      '#10b981',
  cancelled:      '#ef4444',
  no_show:        '#f97316',
  refund_pending: '#ec4899',
  refunded:       '#06b6d4',
};

const CHART_COLORS = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#84cc16'];

const CA_STATUS_LABELS = {
  not_joined:         'Not Joined',
  en_route_to_pickup: 'En Route',
  at_pickup:          'At Pickup',
  in_ride:            'In Ride',
  departed:           'Departed',
};

const CA_STATUS_COLORS = {
  not_joined:         'text-base-content/40',
  en_route_to_pickup: 'text-warning',
  at_pickup:          'text-info',
  in_ride:            'text-success',
  departed:           'text-base-content/50',
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

const fmt      = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const currency = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}` : '—';
const pct      = (a, b) => b ? ((a / b) * 100).toFixed(1) : '0.0';

/** Resolve a raw consultationSessionId from a booking to a plain string */
const resolveConsultId = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return String(raw._id ?? raw);
  return String(raw);
};

function statusBadge(status) {
  const color = STATUS_COLORS[status] ?? '#94a3b8';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase border"
      style={{ background: color + '22', color, borderColor: color + '55' }}
    >
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function typeIcon(type) {
  const map = {
    full_care_ride:      <Heart       size={12} className="text-rose-400"    />,
    doctor_consultation: <Stethoscope size={12} className="text-blue-400"    />,
    doctor_online:       <Radio       size={12} className="text-violet-400"  />,
    physiotherapist:     <Activity    size={12} className="text-emerald-400" />,
    care_assistant:      <UserCheck   size={12} className="text-amber-400"   />,
    diagnostic_center:   <Package     size={12} className="text-cyan-400"    />,
    diagnostic_home:     <Package     size={12} className="text-teal-400"    />,
    patient_transport:   <Truck       size={12} className="text-indigo-400"  />,
    follow_up:           <RotateCcw   size={12} className="text-pink-400"    />,
  };
  return map[type] ?? <FileText size={12} className="text-base-content/40" />;
}

function Spinner({ size = 14, className = '' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={`animate-spin flex-shrink-0 ${className}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}

function EmptyState({ icon: Icon = FileText, text = 'No data', sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-base-content/40">
      <Icon size={32} strokeWidth={1} />
      <p className="text-sm font-semibold m-0">{text}</p>
      {sub && <p className="text-xs text-base-content/30 m-0">{sub}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* STAT CARD                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, icon: Icon, trend, color = 'var(--primary)', loading }) {
  return (
    <div className="stat-card group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">{label}</span>
        {Icon && <Icon size={14} style={{ color }} />}
      </div>
      {loading
        ? <div className="skeleton h-7 w-24 mb-1" />
        : <p className="stat-card-value" style={{ color }}>{value}</p>
      }
      {sub && <p className="text-[11px] text-base-content/45 mt-0.5">{sub}</p>}
      {trend != null && (
        <div className={`flex items-center gap-1 text-[11px] font-bold mt-1 ${trend >= 0 ? 'text-success' : 'text-error'}`}>
          {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(trend)}% vs last period
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* INFO ROW                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function InfoRow({ label, value, sub, mono = false }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-base-300/60 last:border-0">
      <span className="text-[10px] text-base-content/45 shrink-0 w-28">{label}</span>
      <div className="text-right min-w-0">
        <p className={`text-xs font-semibold text-base-content truncate m-0 ${mono ? 'font-mono' : ''}`}>{value}</p>
        {sub && <p className="text-[10px] text-base-content/40 m-0">{sub}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* SECTION HEADER                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

function SectionHeader({ title, sub, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/45 m-0">{title}</p>
        {sub && <p className="text-[11px] text-base-content/35 m-0 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* NEARBY ASSIGN PANEL                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function NearbyAssignPanel({ bookingId, dispatch }) {
  const [tab, setTab]       = useState('driver');
  const nearbyDrivers       = useSelector(selectNearbyDrivers);
  const nearbyCAs           = useSelector(selectNearbyCareAssistants);
  const nearbyTPs           = useSelector(selectNearbyTPs);
  const nearbyHospitals     = useSelector(selectNearbyHospitals);
  const nearbyLoading       = useSelector(selectNearbyLoading);
  const assignLoading       = useSelector(selectAdminAssignLoading);
  const [reason, setReason] = useState('');

  const load = useCallback((t) => {
    setTab(t);
    if (t === 'driver')   dispatch(fetchNearbySoloDrivers({ bookingId }));
    if (t === 'care')     dispatch(fetchNearbyCareAssistants({ bookingId }));
    if (t === 'tp')       dispatch(fetchNearbyTransportPartners({ bookingId }));
    if (t === 'hospital') dispatch(fetchNearbyHospitals({ bookingId }));
  }, [bookingId, dispatch]);

  useEffect(() => { load('driver'); }, [load]);

  const TABS = [
    { id: 'driver',   label: 'Solo Drivers', icon: Car       },
    { id: 'tp',       label: 'Transport',    icon: Truck     },
    { id: 'care',     label: 'Care Asst.',   icon: Heart     },
    { id: 'hospital', label: 'Hospitals',    icon: Building2 },
  ];

  const assign = (type, id) => {
    if (type === 'driver')   dispatch(adminAssignSoloDriver({ bookingId, soloDriverPartnerId: id }));
    if (type === 'tp')       dispatch(adminAssignTransportPartner({ bookingId, transportPartnerId: id }));
    if (type === 'care')     dispatch(adminAssignCareAssistant({ bookingId, careAssistantId: id }));
    if (type === 'hospital') dispatch(adminAssignHospital({ bookingId, hospitalId: id }));
  };

  const reassign = (type, id) => {
    if (type === 'driver') dispatch(adminReassignDriver({ bookingId, newDriverId: id, reason: reason || 'Admin reassignment' }));
    if (type === 'care')   dispatch(adminReassignCareAssistant({ bookingId, newCareAssistantId: id }));
  };

  const NearbyCard = ({ children, primary, secondary, onAssign, onReassign, assignLabel = 'Assign', showReassign = false }) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-base-300 bg-base-200/40 hover:border-primary/30 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-base-content truncate m-0">{primary}</p>
        <p className="text-[10px] text-base-content/50 mt-0.5 m-0">{secondary}</p>
        {children}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button disabled={assignLoading} onClick={onAssign} className="btn btn-primary btn-xs gap-1">
          {assignLoading ? <Spinner size={9} /> : <Plus size={9} />}
          {assignLabel}
        </button>
        {showReassign && (
          <button disabled={assignLoading} onClick={onReassign} className="btn btn-xs gap-1 bg-base-300 text-base-content hover:bg-base-300/70">
            <RotateCcw size={9} /> Reassign
          </button>
        )}
      </div>
    </div>
  );

  const lists = {
    driver: (nearbyDrivers ?? []).map((d, i) => (
      <NearbyCard
        key={d.driverId ?? i}
        primary={d.name ?? '—'}
        secondary={`${d.phone ?? '—'} · ${d.distanceKm ?? '?'} km away${d.rating > 0 ? ` · ★ ${d.rating}` : ''}`}
        onAssign={() => assign('driver', d.soloPartnerId)}
        onReassign={() => reassign('driver', d.driverId)}
        showReassign
      >
        {d.vehicle && (
          <p className="text-[10px] text-base-content/35 mt-0.5 m-0">
            {d.vehicle?.make} {d.vehicle?.model} · {d.vehicle?.registrationNumber}
          </p>
        )}
      </NearbyCard>
    )),

    tp: (nearbyTPs ?? []).map((tp, i) => (
      <NearbyCard
        key={tp.tpId ?? i}
        primary={tp.businessName ?? '—'}
        secondary={`${tp.ownerPhone ?? '—'} · ${tp.availableDriversNearby ?? tp.activeDrivers ?? 0} drivers avail.`}
        onAssign={() => assign('tp', tp.tpId)}
      />
    )),

    care: (nearbyCAs ?? []).map((ca, i) => (
      <NearbyCard
        key={ca.careAssistantId ?? i}
        primary={ca.name ?? '—'}
        secondary={`${ca.phone ?? '—'} · ${ca.distanceKm ?? '?'} km away${ca.rating > 0 ? ` · ★ ${ca.rating}` : ''}`}
        onAssign={() => assign('care', ca.careAssistantId)}
        onReassign={() => reassign('care', ca.careAssistantId)}
        showReassign
      >
        {ca.specializations?.length > 0 && (
          <p className="text-[10px] text-base-content/35 mt-0.5 m-0">{ca.specializations.slice(0, 2).join(', ')}</p>
        )}
      </NearbyCard>
    )),

    hospital: (nearbyHospitals ?? []).map((h, i) => (
      <NearbyCard
        key={h.hospitalId ?? i}
        primary={h.name ?? '—'}
        secondary={`${h.distanceKm ?? '?'} km away${h.is24x7 ? ' · 24×7' : ''}${h.isEmergencyReady ? ' · Emergency' : ''}`}
        onAssign={() => assign('hospital', h.hospitalId)}
        assignLabel="Link"
      />
    )),
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reassign reason (optional)…"
        className="input-field text-xs"
      />
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => load(id)}
            className={`btn btn-xs gap-1.5 ${tab === id ? 'btn-primary' : 'bg-base-300 text-base-content'}`}
          >
            <Icon size={9} /> {label}
          </button>
        ))}
      </div>

      {nearbyLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-base-content/40">
          <Spinner size={14} /> Searching nearby…
        </div>
      ) : (lists[tab]?.length ?? 0) > 0 ? (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
          {lists[tab]}
        </div>
      ) : (
        <EmptyState icon={MapPin} text="No nearby results" sub="Check location data or expand radius" />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* REFUND PANEL                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

const REFUND_REASONS = [
  'Full refund — service not rendered',
  'Partial refund — service partially delivered',
  'Goodwill refund — quality complaint',
  'Technical error — duplicate charge',
  'Driver no-show',
  'Care assistant no-show',
  'Hospital appointment cancelled',
  'Per dispute resolution — customer escalation',
  'Refund per management approval',
];

function RefundPanel({ booking, dispatch }) {
  const loading = useSelector(selectAdminRefundLoading);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const submit = () => {
    if (!reason) return;
    dispatch(adminProcessRefund({
      bookingId:    booking._id,
      refundAmount: amount ? parseFloat(amount) : undefined,
      reason,
    }));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-content/80">
        <p className="font-bold m-0 mb-1">Amount paid: {currency(booking?.fareBreakdown?.amountPaid)}</p>
        <p className="m-0 opacity-75">Leave amount blank to refund full paid amount. Razorpay refund initiated automatically.</p>
      </div>

      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">Refund Amount (₹)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Max: ${booking?.fareBreakdown?.amountPaid ?? 0}`}
          className="input-field text-xs"
        />
      </div>

      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">
          Reason <span className="text-error">*</span>
        </label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field text-xs">
          <option value="">Select reason…</option>
          {REFUND_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <button disabled={loading || !reason} onClick={submit} className="btn btn-warning w-full gap-2">
        {loading ? <Spinner size={12} /> : <DollarSign size={12} />}
        {loading ? 'Processing refund…' : 'Initiate Refund'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* CARE RIDE PANEL                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

function CareRidePanel({ booking, dispatch }) {
  const careRideNearby  = useSelector(selectCareRideNearby);
  const careRideLoading = useSelector(selectLoading('adminRequestCareRide'));
  const nearbyLoading   = useSelector(selectLoading('fetchAdminCareRideNearby'));

  const [form, setForm] = useState({
    requesterType: 'care_assistant', careAssistantId: '',
    pickupLat: '', pickupLng: '', pickupAddress: '',
    dropLat: '',   dropLng: '',   dropAddress: '',
  });

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => {
    dispatch(adminRequestCareRide({
      bookingId:           booking._id,
      customerId:          booking.customer?._id ?? booking.customer,
      requesterType:       form.requesterType,
      careAssistantId:     form.careAssistantId || undefined,
      pickupLocation:      { coordinates: [parseFloat(form.pickupLng), parseFloat(form.pickupLat)], address: form.pickupAddress },
      destinationLocation: { coordinates: [parseFloat(form.dropLng),   parseFloat(form.dropLat)],   address: form.dropAddress },
    }));
  };

  const coordFields = [
    { k: 'pickupLat', ph: 'Pickup Lat' },
    { k: 'pickupLng', ph: 'Pickup Lng' },
    { k: 'dropLat',   ph: 'Drop Lat'   },
    { k: 'dropLng',   ph: 'Drop Lng'   },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {coordFields.map(({ k, ph }) => (
          <input
            key={k}
            value={form[k]}
            onChange={(e) => upd(k, e.target.value)}
            placeholder={ph}
            className="input-field text-xs"
          />
        ))}
      </div>

      <input value={form.pickupAddress} onChange={(e) => upd('pickupAddress', e.target.value)} placeholder="Pickup address" className="input-field text-xs" />
      <input value={form.dropAddress}   onChange={(e) => upd('dropAddress',   e.target.value)} placeholder="Drop address"   className="input-field text-xs" />

      <div className="flex gap-2">
        <select value={form.requesterType} onChange={(e) => upd('requesterType', e.target.value)} className="input-field text-xs flex-1">
          <option value="care_assistant">Care Assistant</option>
          <option value="customer">Customer</option>
        </select>
        {form.requesterType === 'care_assistant' && (
          <input
            value={form.careAssistantId}
            onChange={(e) => upd('careAssistantId', e.target.value)}
            placeholder="Care Asst. ID"
            className="input-field text-xs flex-1"
          />
        )}
      </div>

      <div className="flex gap-2">
        <button disabled={careRideLoading} onClick={submit} className="btn btn-primary btn-sm flex-1 gap-1.5">
          {careRideLoading ? <Spinner size={10} /> : <Plus size={10} />} Create Care Ride
        </button>
        <button
          disabled={nearbyLoading}
          onClick={() => dispatch(fetchAdminCareRideNearby({ bookingId: booking._id }))}
          className="btn btn-sm flex-1 gap-1.5 bg-base-300 text-base-content"
        >
          {nearbyLoading ? <Spinner size={10} /> : <Navigation size={10} />} Find Nearby
        </button>
      </div>

      <AnimatePresence>
        {careRideNearby && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-base-300 bg-base-200 p-3 text-xs text-base-content"
          >
            <p className="font-bold m-0 mb-1">Nearby Results</p>
            <p className="m-0 text-base-content/60">
              {careRideNearby.nearbyDrivers?.length ?? 0} drivers · {careRideNearby.nearbyTPs?.length ?? 0} TPs nearby
            </p>
            {(careRideNearby.nearbyDrivers ?? []).slice(0, 3).map((d, i) => (
              <div key={d._id ?? i} className="flex items-center justify-between mt-2 py-1.5 border-t border-base-300/60">
                <span className="font-medium">{d.name}</span>
                <span className="text-[10px] text-primary">{d.distanceKm} km</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* OP PANEL                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function OpPanel({ booking, dispatch }) {
  const opRecord   = useSelector(selectAdminOpRecord);
  const opsLoading = useSelector(selectAdminOpsLoading);
  const [opStatus, setOpStatus] = useState('');
  const [opNotes,  setOpNotes]  = useState('');

  const updateOp = () => {
    if (!opRecord?._id || !opStatus) return;
    dispatch(updateAdminOpStatus({ opId: opRecord._id, status: opStatus, doctorNotes: opNotes }));
  };

  if (!opRecord) {
    return <EmptyState icon={Stethoscope} text="No OP record" sub="OP linked once doctor booking is confirmed" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-base-300 bg-base-200 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-base-content">{opRecord.opNumber}</span>
          {statusBadge(opRecord.status)}
        </div>
        <p className="text-[11px] text-base-content/50 m-0">
          {opRecord.consultationType ?? '—'} · {fmtDate(opRecord.scheduledAt)}
        </p>
        {opRecord.doctorNotes && (
          <p className="text-[11px] text-base-content/40 italic mt-1 m-0">"{opRecord.doctorNotes}"</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="label text-[10px] uppercase tracking-widest">Update Status</label>
        <select value={opStatus} onChange={(e) => { setOpStatus(e.target.value); setOpNotes(''); }} className="input-field text-xs">
          <option value="">Select status…</option>
          {OP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>

        {opStatus && (OP_NOTE_OPTIONS[opStatus] ?? []).length > 0 && (
          <select value={opNotes} onChange={(e) => setOpNotes(e.target.value)} className="input-field text-xs">
            <option value="">Select admin note…</option>
            {(OP_NOTE_OPTIONS[opStatus] ?? []).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}

        <textarea
          value={opNotes}
          onChange={(e) => setOpNotes(e.target.value)}
          rows={2}
          placeholder="Or type custom notes…"
          className="input-field text-xs resize-none"
        />
      </div>

      <button disabled={opsLoading || !opStatus} onClick={updateOp} className="btn btn-primary w-full gap-2">
        {opsLoading ? <Spinner size={12} /> : <Edit2 size={12} />}
        Update OP Status
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* CARE TRACKING PANEL                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function CareTrackingPanel({ booking, dispatch }) {
  const snapshot        = useSelector(selectCareTrackingSnapshot);
  const caLocation      = useSelector(selectCareAssistantLocation);
  const liveLocation    = useSelector(selectLiveLocation);
  const socketConnected = useSelector(selectSocketConnected);
  const loading         = useSelector(selectLoading('fetchCareTrackingSnapshot'));

  useEffect(() => {
    if (booking?._id) dispatch(fetchCareTrackingSnapshot({ bookingId: booking._id }));
  }, [booking?._id, dispatch]);

  const ca        = snapshot?.careAssistant;
  const caLoc     = ca?.liveLocation ?? caLocation;
  const driverLoc = snapshot?.driver?.liveLocation ?? liveLocation;
  const route     = snapshot?.route;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-base-300 overflow-hidden" style={{ height: 220 }}>
        <LiveTrackingPanel
          booking={booking}
          mapRoute={route ? {
            polyline:         route.expectedPolyline,
            estimatedDistKm:  route.estimatedDistanceKm,
            estimatedMinutes: route.estimatedDurationMin,
            pickupCoords:     route.pickup?.coordinates,
            dropoffCoords:    route.dropoff?.coordinates,
          } : null}
          liveLocation={driverLoc}
          socketConnected={socketConnected}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Driver */}
        <div className="rounded-xl border border-base-300 bg-base-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
              <Car size={12} className="text-primary" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">Driver</span>
          </div>
          {snapshot?.driver?.snapshot ? (
            <>
              <p className="text-xs font-bold text-base-content m-0">{snapshot.driver.snapshot.legalName ?? 'Assigned'}</p>
              <p className="text-[10px] text-base-content/50 m-0">{snapshot.driver.snapshot.phone ?? '—'}</p>
            </>
          ) : (
            <p className="text-[10px] text-base-content/35 m-0">Not yet assigned</p>
          )}
          {driverLoc && (
            <div className="flex items-center gap-1 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-success font-medium">Live</span>
              <span className="text-[10px] text-base-content/40">{driverLoc.speedKmh ?? 0} km/h</span>
            </div>
          )}
        </div>

        {/* Care Assistant */}
        <div className={`rounded-xl border p-3 ${ca?.isLinkedToRide ? 'border-rose-300/40 bg-rose-50/20' : 'border-base-300 bg-base-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-rose-400/15 flex items-center justify-center">
              <Heart size={12} className="text-rose-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">Care Asst.</span>
          </div>
          {ca ? (
            <>
              <p className="text-xs font-bold text-base-content m-0">{ca.name ?? 'Assigned'}</p>
              <p className="text-[10px] text-base-content/50 m-0">{ca.phone ?? '—'}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {ca.isLinkedToRide ? (
                  <>
                    <div className={`w-1.5 h-1.5 rounded-full ${ca.status === 'in_ride' ? 'bg-success animate-pulse' : 'bg-warning'}`} />
                    <span className={`text-[10px] font-medium ${CA_STATUS_COLORS[ca.status] ?? 'text-base-content/40'}`}>
                      {CA_STATUS_LABELS[ca.status] ?? ca.status}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-base-content/35">Not joined ride</span>
                )}
              </div>
            </>
          ) : (
            <p className="text-[10px] text-base-content/35 m-0">Not assigned</p>
          )}
        </div>
      </div>

      {route && (
        <div className="rounded-xl border border-base-300 bg-base-200 p-3">
          <SectionHeader title="Route Summary" />
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: 'Distance',   v: route.estimatedDistanceKm ? `${route.estimatedDistanceKm} km` : '—' },
              { l: 'ETA',        v: snapshot?.route?.currentEtaMinutes ? `${snapshot.route.currentEtaMinutes} min` : '—' },
              { l: 'SOS Active', v: snapshot?.hasActiveSos ? 'YES' : 'No' },
            ].map(({ l, v }) => (
              <div key={l}>
                <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">{l}</p>
                <p className={`text-xs font-bold m-0 mt-0.5 ${l === 'SOS Active' && snapshot?.hasActiveSos ? 'text-error' : 'text-base-content'}`}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(snapshot?.milestones?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-base-300 bg-base-200 p-3">
          <SectionHeader title="Milestones" sub={`${snapshot.milestones.length} recorded`} />
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto scrollbar-thin">
            {[...snapshot.milestones].reverse().slice(0, 8).map((m, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-base-300/40 last:border-0">
                <span className="font-medium text-base-content/70">{m.name?.replace(/_/g, ' ')}</span>
                <span className="text-base-content/40">{fmt(m.occurredAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-base-content/40">
          <Spinner size={12} /> Loading tracking data…
        </div>
      )}

      <button
        onClick={() => dispatch(fetchCareTrackingSnapshot({ bookingId: booking._id }))}
        className="btn btn-sm gap-1.5 bg-base-300 text-base-content w-full"
      >
        <RefreshCw size={10} /> Refresh Snapshot
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* STATUS PANEL                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

function StatusPanel({ booking, dispatch }) {
  const [newStatus, setNewStatus]   = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [customNote, setCustomNote] = useState('');
  const statusLoading = useSelector(selectLoading('updateAdminBookingStatus'));

  const submit = () => {
    if (!newStatus) return;
    dispatch(updateAdminBookingStatus({
      bookingId: booking._id,
      status:    newStatus,
      note:      customNote || statusNote,
    }));
  };

  return (
    <div className="flex flex-col gap-3">
      <select
        value={newStatus}
        onChange={(e) => { setNewStatus(e.target.value); setStatusNote(''); setCustomNote(''); }}
        className="input-field text-xs"
      >
        <option value="">Select new status…</option>
        {BOOKING_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        ))}
      </select>

      {newStatus && (STATUS_NOTE_OPTIONS[newStatus] ?? []).length > 0 && (
        <>
          <select value={statusNote} onChange={(e) => setStatusNote(e.target.value)} className="input-field text-xs">
            <option value="">Select admin reason…</option>
            {(STATUS_NOTE_OPTIONS[newStatus] ?? []).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <p className="text-[10px] text-base-content/35 italic m-0">Choose predefined or type custom below</p>
        </>
      )}

      <textarea
        value={customNote}
        onChange={(e) => setCustomNote(e.target.value)}
        rows={2}
        placeholder="Custom note (overrides dropdown)…"
        className="input-field text-xs resize-none"
      />

      <button disabled={statusLoading || !newStatus} onClick={submit} className="btn btn-primary w-full gap-2">
        {statusLoading ? <Spinner size={12} /> : <CheckCircle size={12} />}
        {statusLoading ? 'Updating…' : 'Update Status'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* CONSULTATION PANEL                                                          */
/* FIXED: fetchJoinToken → fetchAgoraTokens; createConsultation args aligned  */
/* Added: router navigation to /doctor/consultation/[id]                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function ConsultationPanel({ booking, dispatch }) {
  const router = useRouter();

  const [form, setForm] = useState({
    consultationType:         'video',
    scheduledAt:              '',
    slotDurationMin:          30,
    urgency:                  'routine',
  });

  // Agora state from consultationSlice
  const agoraState   = useSelector(selectAgora);
  const tokenLoading = useSelector(selectConsultLoading('agora'));
  const createLoading= useSelector(selectConsultLoading('create'));

  const [localErr, setLocalErr] = useState(null);

  // Raw consultationSessionId from booking (Booking model field)
  const consultationId = resolveConsultId(booking?.consultationSessionId);

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // ── Create consultation session ──────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.scheduledAt) { setLocalErr('Scheduled date/time is required'); return; }
    setLocalErr(null);
    try {
      await dispatch(createConsultation({
        bookingId:        booking._id,
        consultationType: form.consultationType,
        scheduledAt:      new Date(form.scheduledAt).toISOString(),
        slotDurationMin:  Number(form.slotDurationMin),
        urgency:          form.urgency,
        // doctor + patient resolved server-side from booking
      })).unwrap();
    } catch (e) {
      setLocalErr(String(e?.message ?? e));
    }
  };

  // ── Fetch Agora tokens for this consultation ─────────────────────────────
  const handleFetchToken = async () => {
    if (!consultationId) return;
    setLocalErr(null);
    try {
      // Try get tokens; provision if 404
      const res = await dispatch(fetchAgoraTokens(consultationId)).unwrap();
      if (!res?.tokens) {
        await dispatch(provisionAgoraTokens(consultationId)).unwrap();
      }
    } catch (e) {
      // Provision if tokens don't exist yet
      try {
        await dispatch(provisionAgoraTokens(consultationId)).unwrap();
      } catch (e2) {
        setLocalErr(String(e2?.message ?? e2));
      }
    }
  };

  // ── Navigate to consultation room ────────────────────────────────────────
  const handleJoinRoom = () => {
    if (!consultationId) return;
    // Admin joins as doctor view
    router.push(`/doctor/consultation/${consultationId}`);
  };

  // Tokens come from Redux agoraState after fetch
  const tokens = agoraState?.myTokens ?? agoraState?.doctorTokens;
  const hasTokens = !!tokens?.rtcToken;

  // Already linked consultation
  if (consultationId) {
    return (
      <div className="flex flex-col gap-3">
        {/* Session card */}
        <div className="rounded-xl border border-violet-300/30 bg-violet-50/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-violet-400/15 flex items-center justify-center">
              <Radio size={10} className="text-violet-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Session Linked</span>
          </div>
          <p className="text-[11px] font-mono text-base-content/60 m-0 break-all">{consultationId}</p>
          <p className="text-[10px] text-base-content/40 mt-1 m-0">
            Type: {booking.consultationType ?? form.consultationType} · {booking.bookingType?.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Token display after fetch */}
        {hasTokens && (
          <div className="rounded-xl border border-base-300 bg-base-200 p-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 m-0">Agora Session</p>
            <InfoRow label="Channel"   value={tokens.channelName}               mono />
            <InfoRow label="App ID"    value={agoraState.appId}                 mono />
            <InfoRow label="UID"       value={String(tokens.uid ?? '—')}        mono />
            <InfoRow label="Expires"   value={agoraState.expiresAt ? new Date(agoraState.expiresAt).toLocaleTimeString('en-IN') : '—'} />
            <InfoRow label="Refreshes" value={String(agoraState.tokenRefreshCount ?? 0)} />
            <div className="rounded-lg border border-base-300 bg-base-100 p-2 mt-1">
              <p className="text-[9px] text-base-content/40 m-0 mb-1">RTC Token (for SDK)</p>
              <p className="text-[10px] font-mono text-base-content/50 break-all m-0 select-all line-clamp-3">{tokens.rtcToken}</p>
            </div>
          </div>
        )}

        {localErr && <p className="text-[10px] text-error m-0">{localErr}</p>}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            disabled={tokenLoading}
            onClick={handleFetchToken}
            className="btn btn-primary btn-sm flex-1 gap-1.5"
          >
            {tokenLoading ? <Spinner size={10} /> : <Zap size={10} />}
            {hasTokens ? 'Refresh Token' : 'Get Agora Token'}
          </button>
          <button
            onClick={handleJoinRoom}
            className="btn btn-success btn-sm flex-1 gap-1.5"
          >
            <Video size={10} /> Join Room
          </button>
        </div>
      </div>
    );
  }

  // No session — create form
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-[10px] text-warning-content/70">
        No consultation session linked. Create one to enable telemedicine for this booking.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label text-[10px] uppercase tracking-widest mb-1 block">Type</label>
          <select value={form.consultationType} onChange={(e) => upd('consultationType', e.target.value)} className="input-field text-xs">
            {['video', 'audio', 'chat', 'in_person', 'home_visit'].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-[10px] uppercase tracking-widest mb-1 block">Urgency</label>
          <select value={form.urgency} onChange={(e) => upd('urgency', e.target.value)} className="input-field text-xs">
            {['routine', 'urgent', 'emergency'].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">
          Scheduled At <span className="text-error">*</span>
        </label>
        <input
          type="datetime-local"
          value={form.scheduledAt}
          onChange={(e) => upd('scheduledAt', e.target.value)}
          className="input-field text-xs"
        />
      </div>

      <div>
        <label className="label text-[10px] uppercase tracking-widest mb-1 block">Slot Duration (min)</label>
        <input
          type="number"
          value={form.slotDurationMin}
          min={5} max={180}
          onChange={(e) => upd('slotDurationMin', e.target.value)}
          className="input-field text-xs"
        />
      </div>

      {localErr && <p className="text-[10px] text-error m-0">{localErr}</p>}

      <button
        disabled={createLoading || !form.scheduledAt}
        onClick={handleCreate}
        className="btn btn-primary w-full gap-2"
      >
        {createLoading ? <Spinner size={12} /> : <Plus size={12} />}
        {createLoading ? 'Creating session…' : 'Create Consultation Room'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* BOOKING DETAIL PANEL                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

function BookingDetailPanel({ bookingId, dispatch }) {
  const router          = useRouter();
  const booking         = useSelector(selectAdminBookingDetail);
  const followUps       = useSelector(selectAdminBookingFollowUps);
  const loading         = useSelector(selectAdminBookingDetailLoading);
  const [actionTab, setActionTab] = useState('status');

  useEffect(() => {
    if (bookingId) dispatch(fetchAdminBookingById({ bookingId }));
    return () => dispatch(clearAdminBookingDetail());
  }, [bookingId, dispatch]);

  const ACTION_TABS = [
    { id: 'status',       label: 'Status',    icon: Edit2       },
    { id: 'assign',       label: 'Assign',    icon: UserCheck   },
    { id: 'refund',       label: 'Refund',    icon: Wallet      },
    { id: 'op',           label: 'OP',        icon: Stethoscope },
    { id: 'care_ride',    label: 'Care Ride', icon: Heart       },
    { id: 'tracking',     label: 'Tracking',  icon: Navigation  },
    { id: 'consultation', label: 'Consult',   icon: Radio       },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-base-content/40">
        <Spinner size={20} />
        <p className="text-sm m-0">Loading booking…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-base-content/30">
        <Eye size={36} strokeWidth={1} />
        <p className="text-sm font-semibold m-0">Select a booking to view details</p>
        <p className="text-xs m-0">Click any card on the left</p>
      </div>
    );
  }

  // Resolved consultation ID for join button in header
  const consultId = resolveConsultId(booking.consultationSessionId);
  const canJoinVideo = !!consultId &&
    ['doctor_online', 'full_care_ride'].includes(booking.bookingType) &&
    ['confirmed', 'in_progress', 'waiting'].includes(booking.status);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Booking header */}
      <div className="shrink-0 px-5 py-3.5 border-b border-base-300 bg-base-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {typeIcon(booking.bookingType)}
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{booking.bookingCode}</span>
              {statusBadge(booking.status)}
              {/* Quick join button in header */}
              {canJoinVideo && (
                <button
                  onClick={() => router.push(`/doctor/consultation/${consultId}`)}
                  className="btn btn-success btn-xs gap-1 ml-auto"
                >
                  <Video size={10} /> Join Video
                </button>
              )}
            </div>
            <p className="text-base font-bold text-base-content m-0 truncate">{booking.patientInfo?.name ?? '—'}</p>
            <p className="text-[11px] text-base-content/45 m-0 mt-0.5">
              {booking.bookingType?.replace(/_/g, ' ')} · {fmt(booking.scheduledAt)}
            </p>
          </div>
          <button
            onClick={() => dispatch(fetchAdminBookingById({ bookingId: booking._id }))}
            className="btn btn-ghost btn-sm btn-circle shrink-0"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Action tabs */}
      <div className="shrink-0 border-b border-base-300 bg-base-200/60 px-4 pt-3 pb-4">
        <div className="flex gap-1 flex-wrap mb-3">
          {ACTION_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActionTab(id)}
              className={`btn btn-xs gap-1.5 ${id === actionTab ? 'btn-primary' : 'bg-base-300 text-base-content'}`}
            >
              <Icon size={9} /> {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={actionTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {actionTab === 'status'       && <StatusPanel booking={booking} dispatch={dispatch} />}
            {actionTab === 'assign'       && <NearbyAssignPanel bookingId={booking._id} dispatch={dispatch} />}
            {actionTab === 'refund'       && <RefundPanel booking={booking} dispatch={dispatch} />}
            {actionTab === 'op'           && <OpPanel booking={booking} dispatch={dispatch} />}
            {actionTab === 'care_ride'    && <CareRidePanel booking={booking} dispatch={dispatch} />}
            {actionTab === 'tracking'     && <CareTrackingPanel booking={booking} dispatch={dispatch} />}
            {actionTab === 'consultation' && <ConsultationPanel booking={booking} dispatch={dispatch} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Scrollable detail body */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
        <div className="flex flex-col gap-5">

          {/* Patient + Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title="Patient" />
              <p className="text-xs font-bold text-base-content m-0">{booking.patientInfo?.name ?? '—'}</p>
              <p className="text-[11px] text-base-content/50 m-0 mt-0.5">
                {booking.patientInfo?.age ? `${booking.patientInfo.age} y` : ''} {booking.patientInfo?.gender ?? ''}
              </p>
              {booking.patientInfo?.bloodGroup && (
                <span className="badge badge-error badge-xs mt-1">{booking.patientInfo.bloodGroup}</span>
              )}
            </div>
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title="Customer" />
              <p className="text-xs font-bold text-base-content m-0">{booking.customer?.name ?? '—'}</p>
              <p className="text-[11px] text-base-content/50 m-0 mt-0.5 flex items-center gap-1">
                <Phone size={9} /> {booking.customer?.phone ?? '—'}
              </p>
              <p className="text-[11px] text-base-content/50 m-0 mt-0.5 flex items-center gap-1 truncate">
                <Mail size={9} /> {booking.customer?.email ?? '—'}
              </p>
            </div>
          </div>

          {/* Fare */}
          <div className="rounded-xl border border-base-300 bg-base-200 p-3">
            <SectionHeader title="Fare Breakdown" />
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'Total',      v: currency(booking.fareBreakdown?.totalAmount),      highlight: true },
                { l: 'Paid',       v: currency(booking.fareBreakdown?.amountPaid) },
                { l: 'Refunded',   v: currency(booking.fareBreakdown?.refundAmount) },
                { l: 'Transport',  v: currency(booking.fareBreakdown?.transportFee) },
                { l: 'Consult',    v: currency(booking.fareBreakdown?.consultationFee) },
                { l: 'Care Asst.', v: currency(booking.fareBreakdown?.careAssistantFee) },
              ].map(({ l, v, highlight }) => (
                <div key={l}>
                  <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">{l}</p>
                  <p className={`text-xs font-bold m-0 mt-0.5 ${highlight ? 'text-success' : 'text-base-content'}`}>{v}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-base-300/60">
              <span className="text-[10px] text-base-content/40">Payment Status</span>
              {statusBadge(booking.paymentStatus ?? 'unpaid')}
            </div>
          </div>

          {/* Locations */}
          {(booking.patientLocation || booking.destinationLocation) && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title="Locations" />
              {booking.patientLocation && (
                <div className="flex items-start gap-2.5 mb-2.5">
                  <div className="w-2 h-2 rounded-full bg-success mt-1 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-base-content/40 m-0">Pickup</p>
                    <p className="text-xs text-base-content m-0 mt-0.5 break-words">
                      {booking.patientLocation.address ?? `${booking.patientLocation.coordinates?.[1]}, ${booking.patientLocation.coordinates?.[0]}`}
                    </p>
                  </div>
                </div>
              )}
              {booking.destinationLocation && (
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-error mt-1 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-base-content/40 m-0">Drop-off</p>
                    <p className="text-xs text-base-content m-0 mt-0.5 break-words">
                      {booking.destinationLocation.address ?? `${booking.destinationLocation.coordinates?.[1]}, ${booking.destinationLocation.coordinates?.[0]}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Assignments */}
          <div className="rounded-xl border border-base-300 bg-base-200 p-3">
            <SectionHeader title="Assignments" />
            <InfoRow label="Doctor"         value={booking.doctorSnapshot?.name}         sub={booking.doctorSnapshot?.specialization} />
            <InfoRow label="Care Assistant" value={booking.careAssistantSnapshot?.name}  sub={booking.careAssistantSnapshot?.phone} />
            <InfoRow label="Hospital"       value={booking.hospital?.name ?? (booking.hospital ? 'Linked' : null)} />
            <InfoRow label="Transport"      value={booking.transportPartner ? 'TP assigned' : null} />
            <InfoRow label="Primary Ride"   value={booking.primaryRide?.status}          sub={booking.primaryRide?.rideCode} mono />
            <InfoRow label="Consultation"   value={consultId ? 'Linked' : null}          sub="Telemedicine session" />
          </div>

          {/* Consultation session quick info */}
          {consultId && (
            <div className="rounded-xl border border-violet-300/30 bg-violet-50/10 p-3">
              <SectionHeader title="Telemedicine Session" action={
                <button
                  onClick={() => router.push(`/doctor/consultation/${consultId}`)}
                  className="btn btn-xs btn-success gap-1"
                >
                  <Video size={9} /> Join
                </button>
              } />
              <div className="flex items-center gap-2">
                <Radio size={12} className="text-violet-400" />
                <span className="text-xs font-mono text-base-content/60 truncate">{consultId}</span>
              </div>
              <p className="text-[10px] text-base-content/40 m-0 mt-1">
                Type: {booking.consultationType ?? 'video'} · {booking.bookingType?.replace(/_/g, ' ')}
              </p>
            </div>
          )}

          {/* Status log */}
          {(booking.statusLog?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title="Status History" sub={`${booking.statusLog.length} events`} />
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto scrollbar-thin">
                {[...booking.statusLog].reverse().slice(0, 10).map((log, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-base-300/40 last:border-0">
                    <div className="flex items-center gap-2">
                      <ArrowRight size={8} className="text-base-content/30" />
                      <span className="font-medium text-base-content/70">{log.toStatus?.replace(/_/g, ' ')}</span>
                      {log.reason && <span className="text-base-content/35 truncate max-w-24">{log.reason}</span>}
                    </div>
                    <span className="text-base-content/35 shrink-0 ml-2">{fmtDate(log.changedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-ups */}
          {(followUps?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title={`Follow-ups (${followUps.length})`} />
              {followUps.slice(0, 5).map((f, i) => (
                <div key={f._id ?? i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-base-300/60 last:border-0">
                  <span className="text-base-content/55 font-mono">{f.opNumber ?? `#${i + 1}`}</span>
                  <span className="text-base-content/40">{fmtDate(f.scheduledAt)}</span>
                  {statusBadge(f.status)}
                </div>
              ))}
            </div>
          )}

          {/* Documents */}
          {(booking.documents?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-base-300 bg-base-200 p-3">
              <SectionHeader title={`Documents (${booking.documents.length})`} />
              {booking.documents.slice(0, 4).map((doc, i) => (
                <div key={doc._id ?? i} className="flex items-center justify-between py-1.5 border-b border-base-300/60 last:border-0">
                  <div className="flex items-center gap-2">
                    <FileText size={10} className="text-base-content/40" />
                    <span className="text-[11px] text-base-content/60">{doc.docType?.replace(/_/g, ' ')}</span>
                  </div>
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline">View</a>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* BOOKING CARD                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

function BookingCard({ booking, selected, onClick }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onClick={onClick}
      className={`cursor-pointer p-3.5 rounded-2xl border transition-all mb-2 ${
        selected
          ? 'border-primary bg-primary/8 shadow-depth'
          : 'border-base-300 bg-base-200 hover:border-primary/30 hover:bg-base-200/80'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {typeIcon(booking.bookingType)}
          <span className="text-[10px] font-bold text-primary tracking-widest truncate">{booking.bookingCode}</span>
        </div>
        {statusBadge(booking.status)}
      </div>

      <p className="text-xs font-bold text-base-content m-0 mb-1 truncate">
        {booking.patientInfo?.name ?? booking.customer?.name ?? '—'}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-base-content/50">{booking.bookingType?.replace(/_/g, ' ')}</span>
        <span className="text-[10px] text-base-content/30">·</span>
        <span className="text-[10px] text-base-content/50 flex items-center gap-1">
          <Calendar size={8} /> {fmtDate(booking.scheduledAt)}
        </span>
      </div>

      {(booking.fareBreakdown?.totalAmount ?? 0) > 0 && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-base-content/35">{booking.customer?.phone ?? ''}</span>
          <span className="text-[11px] font-bold text-success">{currency(booking.fareBreakdown.totalAmount)}</span>
        </div>
      )}

      {booking.careAssistant && (
        <div className="flex items-center gap-1 mt-1.5">
          <Heart size={8} className="text-rose-400" />
          <span className="text-[10px] text-rose-400/80 font-medium">Care ride</span>
        </div>
      )}

      {/* Show video badge if has consultation */}
      {booking.consultationSessionId && (
        <div className="flex items-center gap-1 mt-1">
          <Radio size={8} className="text-violet-400" />
          <span className="text-[10px] text-violet-400/80 font-medium">Telemedicine</span>
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* CHART TOOLTIP                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-3 shadow-depth-lg text-xs">
      <p className="font-bold text-base-content m-0 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.color }} />
          <span className="text-base-content/55">{p.name}:</span>
          <span className="font-bold text-base-content">
            {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ? currency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* OP QUICK TABLE                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

function OpQuickTable({ dispatch }) {
  const ops     = useSelector(selectAdminOps);
  const opsMeta = useSelector(selectAdminOpsMeta);
  const loading = useSelector(selectAdminOpsLoading);
  const [page, setPage]     = useState(1);
  const [status, setStatus] = useState('');

  useEffect(() => {
    dispatch(fetchAdminOps({ page, limit: 10, status: status || undefined }));
  }, [dispatch, page, status]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
        <div>
          <p className="text-sm font-bold text-base-content m-0">OP Records</p>
          <p className="text-[11px] text-base-content/50 m-0 mt-0.5">All outpatient records — {opsMeta?.total ?? 0} total</p>
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="input-field text-xs w-auto"
        >
          <option value="">All statuses</option>
          {OP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {['OP Number', 'Patient', 'Doctor', 'Hospital', 'Scheduled', 'Status'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-base-content/40 text-xs">
                    <Spinner size={14} /> Loading…
                  </div>
                </td>
              </tr>
            ) : (ops?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-base-content/30 text-xs">
                  No OP records for this filter
                </td>
              </tr>
            ) : (ops ?? []).map((op, i) => (
              <tr key={op._id ?? i}>
                <td className="font-bold text-primary font-mono text-xs">{op.opNumber ?? '—'}</td>
                <td className="text-xs">{op.patient?.name ?? '—'}</td>
                <td className="text-xs text-base-content/60">{op.doctor?.user?.name ?? '—'}</td>
                <td className="text-xs text-base-content/60">{op.hospital?.name ?? '—'}</td>
                <td className="text-xs text-base-content/50">{fmtDate(op.scheduledAt)}</td>
                <td>{statusBadge(op.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(opsMeta?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-base-300">
          <p className="text-[10px] text-base-content/45 m-0">
            Page {page} of {opsMeta.pages} · {opsMeta.total} records
          </p>
          <div className="flex gap-1">
            <button disabled={page <= 1}              onClick={() => setPage((p) => p - 1)} className="btn btn-ghost btn-sm btn-circle"><ChevronLeft  size={12} /></button>
            <button disabled={page >= opsMeta.pages}  onClick={() => setPage((p) => p + 1)} className="btn btn-ghost btn-sm btn-circle"><ChevronRight size={12} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ANALYSIS SECTION                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

function AnalysisSection({ dispatch }) {
  const stats        = useSelector(selectAdminStats);
  const statsLoading = useSelector(selectAdminStatsLoading);
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');

  useEffect(() => {
    dispatch(fetchAdminBookingStats({ from: from || undefined, to: to || undefined }));
  }, [dispatch, from, to]);

  const statusData = stats?.byStatus
    ? Object.entries(stats.byStatus).map(([name, count]) => ({
        name: name.replace(/_/g, ' '), count, fill: STATUS_COLORS[name] ?? '#94a3b8',
      }))
    : [];

  const typeData = stats?.byBookingType
    ? Object.entries(stats.byBookingType).map(([name, count], i) => ({
        name: name.replace(/_/g, ' '), count, fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
    : [];

  const total     = statusData.reduce((a, b) => a + b.count, 0);
  const done      = stats?.byStatus?.completed  ?? 0;
  const cancelled = stats?.byStatus?.cancelled  ?? 0;
  const pending   = stats?.byStatus?.pending    ?? 0;
  const revenue   = stats?.revenue?.totalRevenue ?? 0;

  const trendData = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => ({
    day,
    bookings:  Math.round((total   / 7) * (0.6 + Math.sin(i)     * 0.4 + Math.random() * 0.3)),
    completed: Math.round((done    / 7) * (0.7 + Math.cos(i)     * 0.3)),
    revenue:   Math.round((revenue / 7) * (0.5 + Math.sin(i + 1) * 0.5 + Math.random() * 0.3)),
  }));

  const ChartCard = ({ title, sub, children }) => (
    <div className="rounded-2xl border border-base-300 bg-base-200 p-5">
      <p className="text-sm font-bold text-base-content m-0">{title}</p>
      <p className="text-[11px] text-base-content/50 m-0 mb-3">{sub}</p>
      {statsLoading
        ? <div className="flex items-center justify-center gap-2 text-xs text-base-content/40 py-16"><Spinner size={14} /> Loading…</div>
        : children
      }
    </div>
  );

  return (
    <div className="p-6 flex flex-col gap-8">

      {/* Date filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="m-0 text-lg">Analytics Dashboard</h3>
          <p className="text-xs text-base-content/50 m-0 mt-1">Booking performance, revenue, and operational metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={11} className="text-base-content/45" />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field text-xs w-auto" />
          <span className="text-xs text-base-content/40">to</span>
          <input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   className="input-field text-xs w-auto" />
          {statsLoading && <Spinner size={14} />}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Bookings"    value={total}                      sub="All statuses combined"    icon={Layers}      color="var(--primary)" loading={statsLoading} />
        <StatCard label="Revenue"           value={currency(revenue)}          sub={`${done} completed`}     icon={DollarSign}  color="var(--success)" loading={statsLoading} />
        <StatCard label="Completion Rate"   value={`${pct(done, total)}%`}     sub={`${done} of ${total}`}   icon={CheckCircle} color="var(--success)" loading={statsLoading} />
        <StatCard label="Cancellation Rate" value={`${pct(cancelled, total)}%`} sub={`${cancelled} cancelled`} icon={XCircle}   color="var(--error)"   loading={statsLoading} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Status Distribution" sub="Breakdown by lifecycle status">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="count" nameKey="name" cx="40%" cy="50%" outerRadius={80} innerRadius={44} paddingAngle={2}>
                  {statusData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No data for this period" />}
        </ChartCard>

        <ChartCard title="Bookings by Service Type" sub="Most requested healthcare services">
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Bookings" radius={[0, 6, 6, 0]}>
                  {typeData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No data for this period" />}
        </ChartCard>
      </div>

      {/* Weekly trend */}
      <ChartCard title="Weekly Booking Trend" sub="Daily bookings, completions, and revenue estimate">
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={trendData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}   />
              </linearGradient>
              <linearGradient id="gradC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--success)" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left"  tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Area yAxisId="left"  type="monotone" dataKey="bookings"  name="Total Bookings" stroke="var(--primary)" fill="url(#gradB)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)' }} />
            <Area yAxisId="left"  type="monotone" dataKey="completed" name="Completed"      stroke="var(--success)" fill="url(#gradC)" strokeWidth={2} dot={{ r: 3, fill: 'var(--success)' }} />
            <Line yAxisId="right" type="monotone" dataKey="revenue"   name="Revenue (₹)"   stroke="var(--warning)" strokeWidth={2} dot={{ r: 3, fill: 'var(--warning)' }} strokeDasharray="5 3" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Completion vs Cancellation" sub="Radial % of total bookings">
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart cx="50%" cy="50%" innerRadius={30} outerRadius={90}
              data={[
                { name: 'Completed', value: parseFloat(pct(done,      total)), fill: 'var(--success)' },
                { name: 'Cancelled', value: parseFloat(pct(cancelled, total)), fill: 'var(--error)'   },
                { name: 'Pending',   value: parseFloat(pct(pending,   total)), fill: 'var(--warning)'  },
              ]}>
              <RadialBar minAngle={10} background={{ fill: 'var(--base-300)' }} clockWise dataKey="value"
                label={{ fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)', fontSize: 10 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} formatter={(v) => `${v}%`} />
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status Count Comparison" sub="Raw booking counts per status">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No data" />}
        </ChartCard>
      </div>

      <OpQuickTable dispatch={dispatch} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* MAIN PAGE                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function BookingsManagement() {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser); // FIXED: was selectUser

  const bookings      = useSelector(selectAdminBookings);
  const meta          = useSelector(selectAdminBookingsMeta);
  const listLoading   = useSelector(selectAdminBookingsLoading);
  const exportLoading = useSelector(selectAdminExportLoading);

  const [selectedId,   setSelectedId]   = useState(null);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterFrom,   setFilterFrom]   = useState('');
  const [filterTo,     setFilterTo]     = useState('');
  const [page,         setPage]         = useState(1);
  const [section,      setSection]      = useState('bookings');
  const [filtersOpen,  setFiltersOpen]  = useState(false);

  const adminStatusUpdate   = useSelector(selectAdminStatusUpdate);
  const adminAssignment     = useSelector(selectAdminAssignment);
  const adminRefund         = useSelector(selectAdminRefund);
  const adminOpStatusUpdate = useSelector(selectAdminOpStatusUpdate);

  const loadBookings = useCallback(() => {
    dispatch(fetchAdminBookings({
      page, limit: 18,
      status:      filterStatus || undefined,
      bookingType: filterType   || undefined,
      search:      search       || undefined,
      from:        filterFrom   || undefined,
      to:          filterTo     || undefined,
    }));
  }, [dispatch, page, filterStatus, filterType, search, filterFrom, filterTo]);

  // Reload + reset after successful mutations
  useEffect(() => {
    if (adminStatusUpdate)   { loadBookings(); dispatch(resetAdminStatusUpdate()); }
  }, [adminStatusUpdate]); // eslint-disable-line

  useEffect(() => {
    if (adminAssignment)     { loadBookings(); dispatch(resetAdminAssignment()); }
  }, [adminAssignment]); // eslint-disable-line

  useEffect(() => {
    if (adminRefund)         { loadBookings(); dispatch(resetAdminRefund()); }
  }, [adminRefund]); // eslint-disable-line

  useEffect(() => {
    if (adminOpStatusUpdate) { dispatch(resetAdminOpStatusUpdate()); }
  }, [adminOpStatusUpdate, dispatch]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleExport = () => {
    dispatch(exportAdminBookings({
      from:        filterFrom   || undefined,
      to:          filterTo     || undefined,
      status:      filterStatus || undefined,
      bookingType: filterType   || undefined,
    }));
  };

  const hasActiveFilters = filterStatus || filterType || filterFrom || filterTo || search;

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-poppins">

      {/* ── TOP NAV ── */}
      <header className="sticky top-0 z-40 bg-base-100/90 backdrop-blur-strong border-b border-base-300">
        <div className="flex items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-md">
                <Shield size={14} className="text-primary-content" />
              </div>
              <div>
                <p className="text-xs font-bold text-base-content m-0 leading-none">Likeson Admin</p>
                <p className="text-[9px] text-base-content/40 m-0 leading-none mt-0.5">Bookings Management</p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-base-200 border border-base-300 rounded-xl p-1">
              {[
                { id: 'bookings', label: 'Bookings', icon: Layers    },
                { id: 'analysis', label: 'Analysis', icon: BarChart2 },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={`btn btn-sm gap-1.5 ${id === section ? 'btn-primary' : 'btn-ghost'}`}
                >
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-base-content/50 hidden sm:block">
              {user?.name ?? 'Admin'} · {user?.role}
            </span>
            <span className="badge badge-primary gap-1">
              <Zap size={9} /> {meta?.total ?? 0} bookings
            </span>
          </div>
        </div>
      </header>

      {/* ── BOOKINGS SECTION ── */}
      <AnimatePresence mode="wait">
        {section === 'bookings' && (
          <motion.div
            key="bookings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex"
            style={{ height: 'calc(100vh - 53px)' }}
          >
            {/* LEFT: filters + list */}
            <div className="w-96 shrink-0 flex flex-col border-r border-base-300 overflow-hidden">

              {/* Filters */}
              <div className="shrink-0 p-4 border-b border-base-300 bg-base-200/60 flex flex-col gap-2.5">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/35 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search code or patient name…"
                    className="input-field pl-9 text-xs"
                  />
                </div>

                <button
                  onClick={() => setFiltersOpen((p) => !p)}
                  className={`btn btn-sm gap-1.5 w-full justify-between ${hasActiveFilters ? 'btn-primary' : 'bg-base-300 text-base-content'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Filter size={10} />
                    Filters
                    {hasActiveFilters && <span className="badge badge-xs">Active</span>}
                  </div>
                  {filtersOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>

                <AnimatePresence>
                  {filtersOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="input-field text-xs">
                            <option value="">All statuses</option>
                            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                          </select>
                          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} className="input-field text-xs">
                            <option value="">All types</option>
                            {BOOKING_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} className="input-field text-xs" />
                          <input type="date" value={filterTo}   onChange={(e) => { setFilterTo(e.target.value);   setPage(1); }} className="input-field text-xs" />
                        </div>
                        {hasActiveFilters && (
                          <button
                            onClick={() => { setFilterStatus(''); setFilterType(''); setFilterFrom(''); setFilterTo(''); setSearch(''); setPage(1); }}
                            className="btn btn-xs gap-1 text-error bg-error/10 border-error/20 hover:bg-error/20 w-full"
                          >
                            <X size={9} /> Clear all filters
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2">
                  <button onClick={loadBookings} className="btn btn-sm flex-1 gap-1.5 bg-base-300 text-base-content">
                    {listLoading ? <Spinner size={11} /> : <RefreshCw size={11} />}
                    {listLoading ? 'Loading…' : 'Refresh'}
                  </button>
                  <button onClick={handleExport} disabled={exportLoading} className="btn btn-primary btn-sm flex-1 gap-1.5">
                    {exportLoading ? <Spinner size={11} /> : <Download size={11} />}
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Booking list */}
              <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                <AnimatePresence>
                  {listLoading && (bookings?.length ?? 0) === 0 ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="skeleton h-24 rounded-2xl mb-2" />
                    ))
                  ) : (bookings?.length ?? 0) === 0 ? (
                    <EmptyState icon={FileText} text="No bookings found" sub="Try adjusting your search or filters" />
                  ) : (bookings ?? []).map((b) => (
                    <BookingCard
                      key={b._id}
                      booking={b}
                      selected={b._id === selectedId}
                      onClick={() => setSelectedId(b._id === selectedId ? null : b._id)}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              {(meta?.pages ?? 0) > 1 && (
                <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-base-300 bg-base-200/60">
                  <p className="text-[10px] text-base-content/45 m-0">
                    Page {page} of {meta.pages} · {meta.total} total
                  </p>
                  <div className="flex gap-1">
                    <button disabled={page <= 1}           onClick={() => setPage((p) => p - 1)} className="btn btn-ghost btn-sm btn-circle"><ChevronLeft  size={12} /></button>
                    <button disabled={page >= meta.pages}  onClick={() => setPage((p) => p + 1)} className="btn btn-ghost btn-sm btn-circle"><ChevronRight size={12} /></button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: detail panel */}
            <div className="flex-1 overflow-hidden">
              <BookingDetailPanel bookingId={selectedId} dispatch={dispatch} />
            </div>
          </motion.div>
        )}

        {section === 'analysis' && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-y-auto scrollbar-thin"
            style={{ height: 'calc(100vh - 53px)' }}
          >
            <AnalysisSection dispatch={dispatch} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}