'use client';

/**
 * BookingsManagement.jsx — Likeson.in Admin
 * - Tailwind inline classes replaced with global.css classes
 * - Action tabs (Status/Assign/Refund/OP/CareRide/Tracking) now at TOP of detail panel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector }                 from 'react-redux';
import { motion, AnimatePresence }                  from 'framer-motion';
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
  Wallet, CreditCard, Ban, Edit2, Plus, Minus,
} from 'lucide-react';

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

import { selectUser }    from '@/store/slices/userSlice';
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
  cancelled:      ['Patient cancelled — no charge', 'Patient no-show — cancellation fee applied', 'Doctor unavailable — rescheduled', 'Hospital at capacity', 'Transport unavailable in area', 'Weather/emergency cancellation', 'Admin initiated — operational issue'],
  confirmed:      ['Manual confirmation — payment verified', 'Admin override — special case', 'Re-confirmed after reschedule'],
  refunded:       ['Full refund — service not rendered', 'Partial refund — service partially delivered', 'Goodwill refund — service quality issue', 'Refund per dispute resolution', 'Technical error refund'],
  in_progress:    ['Admin-initiated start — driver on site'],
  completed:      ['Admin-marked complete — verified by ops team', 'Manual completion — GPS off'],
  no_show:        ['Patient no-show confirmed', 'Unreachable after 3 attempts'],
  pending:        ['Reverted to pending — payment re-verification needed'],
  draft:          ['Reverted to draft — details incomplete'],
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

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#84cc16'];

/* ─────────────────────────────────────────────────────────────────────────── */
/* HELPERS                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

const fmt      = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const currency = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}` : '—';
const pct      = (a, b) => b ? ((a / b) * 100).toFixed(1) : '0.0';

function statusBadge(status) {
  const color = STATUS_COLORS[status] ?? '#94a3b8';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 8px', borderRadius: 999,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
        background: color + '22', color, border: `1px solid ${color}55`,
      }}
    >
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

function typeIcon(type) {
  const map = {
    full_care_ride:       <Heart size={12} style={{ color: '#fb7185' }} />,
    doctor_consultation:  <Stethoscope size={12} style={{ color: '#60a5fa' }} />,
    doctor_online:        <Radio size={12} style={{ color: '#a78bfa' }} />,
    physiotherapist:      <Activity size={12} style={{ color: '#34d399' }} />,
    care_assistant:       <UserCheck size={12} style={{ color: '#fbbf24' }} />,
    diagnostic_center:    <Package size={12} style={{ color: '#22d3ee' }} />,
    diagnostic_home:      <Package size={12} style={{ color: '#2dd4bf' }} />,
    patient_transport:    <Truck size={12} style={{ color: '#818cf8' }} />,
    follow_up:            <RotateCcw size={12} style={{ color: '#f472b6' }} />,
  };
  return map[type] ?? <FileText size={12} style={{ color: '#94a3b8' }} />;
}

function Spinner({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'bm-spin 0.8s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes bm-spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}

function EmptyState({ icon: Icon = FileText, text = 'No data', sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 0', gap: 12, color: '#64748b' }}>
      <Icon size={32} strokeWidth={1} />
      <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{text}</p>
      {sub && <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>{sub}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* STAT CARD                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, icon: Icon, trend, color = '#4f46e5', loading }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{label}</span>
        {Icon && <Icon size={14} style={{ color }} />}
      </div>
      {loading
        ? <div className="skeleton" style={{ height: 28, width: 96, marginBottom: 4 }} />
        : <p className="stat-card-value" style={{ fontSize: 24, color }}>{value}</p>
      }
      {sub && <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: 0 }}>{sub}</p>}
      {trend != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: trend >= 0 ? '#10b981' : '#ef4444', marginTop: 4 }}>
          {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(trend)}% vs last period
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* NEARBY ASSIGN PANEL                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function NearbyAssignPanel({ bookingId, dispatch }) {
  const [tab, setTab]        = useState('driver');
  const nearbyDrivers        = useSelector(selectNearbyDrivers);
  const nearbyCareAssistants = useSelector(selectNearbyCareAssistants);
  const nearbyTPs            = useSelector(selectNearbyTPs);
  const nearbyHospitals      = useSelector(selectNearbyHospitals);
  const nearbyLoading        = useSelector(selectNearbyLoading);
  const assignLoading        = useSelector(selectAdminAssignLoading);
  const [reassignReason, setReassignReason] = useState('');

  const load = useCallback((t) => {
    setTab(t);
    if (t === 'driver')   dispatch(fetchNearbySoloDrivers({ bookingId }));
    if (t === 'care')     dispatch(fetchNearbyCareAssistants({ bookingId }));
    if (t === 'tp')       dispatch(fetchNearbyTransportPartners({ bookingId }));
    if (t === 'hospital') dispatch(fetchNearbyHospitals({ bookingId }));
  }, [bookingId, dispatch]);

  useEffect(() => { load('driver'); }, [load]);

  const TABS = [
    { id: 'driver',   label: 'Solo Drivers',   icon: Car },
    { id: 'tp',       label: 'Transport',       icon: Truck },
    { id: 'care',     label: 'Care Assistants', icon: Heart },
    { id: 'hospital', label: 'Hospitals',       icon: Building2 },
  ];

  const assign = (type, id) => {
    if (type === 'driver')   dispatch(adminAssignSoloDriver({ bookingId, soloDriverPartnerId: id }));
    if (type === 'tp')       dispatch(adminAssignTransportPartner({ bookingId, transportPartnerId: id }));
    if (type === 'care')     dispatch(adminAssignCareAssistant({ bookingId, careAssistantId: id }));
    if (type === 'hospital') dispatch(adminAssignHospital({ bookingId, hospitalId: id }));
  };

  const cardStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, borderRadius: 12, border: '1px solid var(--base-300)',
    background: 'color-mix(in srgb, var(--base-200), transparent 30%)', gap: 12,
  };

  const renderDrivers = () => nearbyDrivers.map((d, i) => (
    <div key={d.driverId ?? i} style={cardStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{d.phone}</span>
          <span style={{ fontSize: 10, color: 'var(--primary)' }}>{d.distanceKm} km away</span>
          {d.rating > 0 && <span style={{ fontSize: 10, color: '#f59e0b' }}>★ {d.rating}</span>}
        </div>
        {d.vehicle && <p style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', margin: 0, marginTop: 2 }}>{d.vehicle?.make} {d.vehicle?.model} · {d.vehicle?.registrationNumber}</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button disabled={assignLoading} onClick={() => assign('driver', d.soloPartnerId)} className="btn btn-primary btn-sm" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          {assignLoading ? <Spinner size={10} /> : null} Assign
        </button>
        <button disabled={assignLoading} onClick={() => dispatch(adminReassignDriver({ bookingId, newDriverId: d.driverId, reason: reassignReason || 'Admin reassignment' }))} className="btn btn-sm" style={{ fontSize: 10, background: 'var(--base-300)', color: 'var(--base-content)' }}>
          Reassign
        </button>
      </div>
    </div>
  ));

  const renderTPs = () => nearbyTPs.map((tp, i) => (
    <div key={tp.tpId ?? i} style={cardStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)', margin: 0 }}>{tp.businessName}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{tp.ownerPhone}</span>
          <span style={{ fontSize: 10, color: 'var(--success)' }}>{tp.availableDriversNearby ?? tp.activeDrivers ?? 0} drivers avail.</span>
        </div>
      </div>
      <button disabled={assignLoading} onClick={() => assign('tp', tp.tpId)} className="btn btn-primary btn-sm" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
        {assignLoading ? <Spinner size={10} /> : null} Assign
      </button>
    </div>
  ));

  const renderCare = () => nearbyCareAssistants.map((ca, i) => (
    <div key={ca.careAssistantId ?? i} style={cardStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)', margin: 0 }}>{ca.name}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{ca.phone}</span>
          <span style={{ fontSize: 10, color: 'var(--primary)' }}>{ca.distanceKm} km away</span>
          {ca.rating > 0 && <span style={{ fontSize: 10, color: '#f59e0b' }}>★ {ca.rating}</span>}
        </div>
        {ca.specializations?.length > 0 && <p style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', margin: '2px 0 0' }}>{ca.specializations.slice(0, 2).join(', ')}</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button disabled={assignLoading} onClick={() => assign('care', ca.careAssistantId)} className="btn btn-primary btn-sm" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          {assignLoading ? <Spinner size={10} /> : null} Assign
        </button>
        <button disabled={assignLoading} onClick={() => dispatch(adminReassignCareAssistant({ bookingId, newCareAssistantId: ca.careAssistantId }))} className="btn btn-sm" style={{ fontSize: 10, background: 'var(--base-300)', color: 'var(--base-content)' }}>
          Reassign
        </button>
      </div>
    </div>
  ));

  const renderHospitals = () => nearbyHospitals.map((h, i) => (
    <div key={h.hospitalId ?? i} style={cardStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)', margin: 0 }}>{h.name}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--primary)' }}>{h.distanceKm} km away</span>
          {h.is24x7 && <span style={{ fontSize: 10, color: 'var(--success)' }}>24×7</span>}
          {h.isEmergencyReady && <span style={{ fontSize: 10, color: 'var(--error)' }}>Emergency ready</span>}
        </div>
      </div>
      <button disabled={assignLoading} onClick={() => assign('hospital', h.hospitalId)} className="btn btn-primary btn-sm" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
        {assignLoading ? <Spinner size={10} /> : null} Link
      </button>
    </div>
  ));

  const list = { driver: renderDrivers(), tp: renderTPs(), care: renderCare(), hospital: renderHospitals() };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        value={reassignReason}
        onChange={(e) => setReassignReason(e.target.value)}
        placeholder="Reassign reason (optional)"
        className="input-field"
        style={{ fontSize: 12 }}
      />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => load(id)}
            className={tab === id ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, background: tab !== id ? 'var(--base-300)' : undefined, color: tab !== id ? 'var(--base-content)' : undefined }}>
            <Icon size={10} /> {label}
          </button>
        ))}
      </div>
      {nearbyLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 8, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', fontSize: 12 }}><Spinner /> Searching nearby…</div>
      ) : list[tab]?.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 256, overflowY: 'auto', paddingRight: 4 }}>{list[tab]}</div>
      ) : (
        <EmptyState icon={MapPin} text="No nearby results" sub="Try expanding search or checking location data" />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* REFUND PANEL                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

function RefundPanel({ booking, dispatch }) {
  const loading = useSelector(selectAdminRefundLoading);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

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

  const submit = () => {
    if (!reason) return;
    dispatch(adminProcessRefund({ bookingId: booking._id, refundAmount: amount ? parseFloat(amount) : undefined, reason }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ borderRadius: 12, border: '1px solid color-mix(in srgb, var(--warning), transparent 60%)', background: 'color-mix(in srgb, var(--warning), transparent 91%)', padding: 12, fontSize: 12, color: 'color-mix(in oklch, var(--warning) 80%, oklch(20% 0.04 72))' }}>
        <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Amount paid: {currency(booking?.fareBreakdown?.amountPaid)}</p>
        <p style={{ margin: 0, opacity: 0.8 }}>Leave amount blank to refund full paid amount. Razorpay refund initiated automatically if applicable.</p>
      </div>
      <div>
        <label className="label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Refund Amount (₹)</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Max: ${booking?.fareBreakdown?.amountPaid ?? 0}`} className="input-field" style={{ fontSize: 12 }} />
      </div>
      <div>
        <label className="label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Reason <span style={{ color: 'var(--error)' }}>*</span>
        </label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field" style={{ fontSize: 12 }}>
          <option value="">Select reason…</option>
          {REFUND_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <button disabled={loading || !reason} onClick={submit} className="btn btn-warning" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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

  const fetchNearby = () => dispatch(fetchAdminCareRideNearby({ bookingId: booking._id }));

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

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[{ k: 'pickupLat', ph: 'Pickup Lat' }, { k: 'pickupLng', ph: 'Pickup Lng' }, { k: 'dropLat', ph: 'Drop Lat' }, { k: 'dropLng', ph: 'Drop Lng' }].map(({ k, ph }) => (
          <input key={k} value={form[k]} onChange={(e) => upd(k, e.target.value)} placeholder={ph} className="input-field" style={{ fontSize: 12 }} />
        ))}
      </div>
      <input value={form.pickupAddress} onChange={(e) => upd('pickupAddress', e.target.value)} placeholder="Pickup address" className="input-field" style={{ fontSize: 12 }} />
      <input value={form.dropAddress}   onChange={(e) => upd('dropAddress',   e.target.value)} placeholder="Drop address"   className="input-field" style={{ fontSize: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={form.requesterType} onChange={(e) => upd('requesterType', e.target.value)} className="input-field" style={{ fontSize: 12, flex: 1 }}>
          <option value="care_assistant">Care Assistant</option>
          <option value="customer">Customer</option>
        </select>
        {form.requesterType === 'care_assistant' && (
          <input value={form.careAssistantId} onChange={(e) => upd('careAssistantId', e.target.value)} placeholder="Care Asst. ID" className="input-field" style={{ fontSize: 12, flex: 1 }} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={careRideLoading} onClick={submit} className="btn btn-primary btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {careRideLoading ? <Spinner size={10} /> : <Plus size={10} />} Create Care Ride
        </button>
        <button disabled={nearbyLoading} onClick={fetchNearby} className="btn btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--base-300)', color: 'var(--base-content)' }}>
          {nearbyLoading ? <Spinner size={10} /> : <Navigation size={10} />} Find Nearby
        </button>
      </div>
      {careRideNearby && (
        <div style={{ borderRadius: 12, border: '1px solid var(--base-300)', background: 'var(--base-200)', padding: 12, fontSize: 12, color: 'var(--base-content)' }}>
          <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Nearby Results</p>
          <p style={{ margin: 0 }}>{careRideNearby.nearbyDrivers?.length ?? 0} drivers · {careRideNearby.nearbyTPs?.length ?? 0} TPs</p>
        </div>
      )}
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

  if (!opRecord) return <EmptyState icon={Stethoscope} text="No OP record" sub="OP record linked once doctor booking confirmed" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ borderRadius: 12, border: '1px solid var(--base-300)', background: 'var(--base-200)', padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)' }}>{opRecord.opNumber}</span>
          {statusBadge(opRecord.status)}
        </div>
        <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)', margin: 0 }}>{opRecord.consultationType ?? '—'} · {fmtDate(opRecord.scheduledAt)}</p>
        {opRecord.doctorNotes && <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', fontStyle: 'italic', margin: '4px 0 0' }}>"{opRecord.doctorNotes}"</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Update Status</label>
        <select value={opStatus} onChange={(e) => setOpStatus(e.target.value)} className="input-field" style={{ fontSize: 12 }}>
          <option value="">Select status…</option>
          {OP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        {opStatus && (OP_NOTE_OPTIONS[opStatus] ?? []).length > 0 && (
          <select value={opNotes} onChange={(e) => setOpNotes(e.target.value)} className="input-field" style={{ fontSize: 12 }}>
            <option value="">Select admin note…</option>
            {(OP_NOTE_OPTIONS[opStatus] ?? []).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <textarea value={opNotes} onChange={(e) => setOpNotes(e.target.value)} rows={2} placeholder="Or type custom notes…" className="input-field" style={{ fontSize: 12, resize: 'none' }} />
      </div>
      <button disabled={opsLoading || !opStatus} onClick={updateOp} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {opsLoading ? <Spinner size={12} /> : <Edit2 size={12} />}
        Update OP Status
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* BOOKING DETAIL PANEL (right column)                                         */
/* Action tabs NOW AT TOP, info below                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

function BookingDetailPanel({ bookingId, dispatch }) {
  const booking         = useSelector(selectAdminBookingDetail);
  const followUps       = useSelector(selectAdminBookingFollowUps);
  const liveLocation    = useSelector(selectLiveLocation);
  const socketConnected = useSelector(selectSocketConnected);
  const loading         = useSelector(selectAdminBookingDetailLoading);
  const [actionTab, setActionTab]   = useState('status');
  const [newStatus, setNewStatus]   = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [customNote, setCustomNote] = useState('');
  const statusLoading = useSelector(selectLoading('updateAdminBookingStatus'));

  useEffect(() => {
    if (bookingId) dispatch(fetchAdminBookingById({ bookingId }));
    return () => dispatch(clearAdminBookingDetail());
  }, [bookingId, dispatch]);

  const submitStatus = () => {
    if (!newStatus) return;
    dispatch(updateAdminBookingStatus({ bookingId: booking._id, status: newStatus, note: customNote || statusNote }));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
        <Spinner size={20} /><p style={{ fontSize: 14 }}>Loading booking…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>
        <Eye size={32} strokeWidth={1} />
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Select a booking to view details</p>
        <p style={{ fontSize: 12, margin: 0 }}>Click any card on the left</p>
      </div>
    );
  }

  const ACTION_TABS = [
    { id: 'status',    label: 'Status',    icon: Edit2 },
    { id: 'assign',    label: 'Assign',    icon: UserCheck },
    { id: 'refund',    label: 'Refund',    icon: Wallet },
    { id: 'op',        label: 'OP',        icon: Stethoscope },
    { id: 'care_ride', label: 'Care Ride', icon: Heart },
    { id: 'tracking',  label: 'Tracking',  icon: Navigation },
  ];

  const infoCardStyle = {
    borderRadius: 12, border: '1px solid var(--base-300)',
    background: 'var(--base-200)', padding: 12,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── TOP: Booking header bar ── */}
      <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid var(--base-300)', background: 'var(--base-100)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {typeIcon(booking.bookingType)}
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{booking.bookingCode}</span>
              {statusBadge(booking.status)}
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--base-content)', margin: 0 }}>{booking.patientInfo?.name}</p>
            <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)', margin: '2px 0 0' }}>
              {booking.bookingType?.replace(/_/g, ' ')} · Scheduled {fmt(booking.scheduledAt)}
            </p>
          </div>
          <button onClick={() => dispatch(fetchAdminBookingById({ bookingId: booking._id }))}
            className="btn btn-ghost btn-sm btn-circle" style={{ flexShrink: 0 }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ── ACTION TABS — AT TOP of right side (below header) ── */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--base-300)', background: 'var(--base-200)', padding: '10px 16px' }}>
        {/* Tab row */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {ACTION_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActionTab(id)}
              className={id === actionTab ? 'btn btn-primary btn-xs' : 'btn btn-xs'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 10,
                background: id !== actionTab ? 'var(--base-300)' : undefined,
                color: id !== actionTab ? 'var(--base-content)' : undefined,
              }}>
              <Icon size={9} />{label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {/* STATUS */}
          {actionTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select value={newStatus} onChange={(e) => { setNewStatus(e.target.value); setStatusNote(''); setCustomNote(''); }} className="input-field" style={{ fontSize: 12 }}>
                <option value="">Select new status…</option>
                {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
              {newStatus && (STATUS_NOTE_OPTIONS[newStatus] ?? []).length > 0 && (
                <>
                  <select value={statusNote} onChange={(e) => setStatusNote(e.target.value)} className="input-field" style={{ fontSize: 12 }}>
                    <option value="">Select admin reason…</option>
                    {(STATUS_NOTE_OPTIONS[newStatus] ?? []).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <p style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', fontStyle: 'italic', margin: 0 }}>Choose predefined reason or type custom below</p>
                </>
              )}
              <textarea value={customNote} onChange={(e) => setCustomNote(e.target.value)} rows={2}
                placeholder="Custom note (overrides dropdown if filled)…"
                className="input-field" style={{ fontSize: 12, resize: 'none' }} />
              <button disabled={statusLoading || !newStatus} onClick={submitStatus} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {statusLoading ? <Spinner size={12} /> : <CheckCircle size={12} />}
                {statusLoading ? 'Updating…' : 'Update Status'}
              </button>
            </div>
          )}

          {actionTab === 'assign'    && <NearbyAssignPanel bookingId={booking._id} dispatch={dispatch} />}
          {actionTab === 'refund'    && <RefundPanel booking={booking} dispatch={dispatch} />}
          {actionTab === 'op'        && <OpPanel booking={booking} dispatch={dispatch} />}
          {actionTab === 'care_ride' && <CareRidePanel booking={booking} dispatch={dispatch} />}

          {actionTab === 'tracking' && (
            <div style={{ height: 300 }}>
              <LiveTrackingPanel
                booking={booking}
                mapRoute={booking?.primaryRide?.trackingId ? {
                  polyline:         null,
                  estimatedDistKm:  booking.primaryRide?.estimatedDistanceKm,
                  estimatedMinutes: booking.primaryRide?.estimatedDurationMin,
                  pickupCoords:     booking.patientLocation?.coordinates,
                  dropoffCoords:    booking.destinationLocation?.coordinates,
                } : null}
                liveLocation={liveLocation}
                socketConnected={socketConnected}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── SCROLLABLE BODY: booking info below actions ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Patient + Customer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={infoCardStyle}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: '0 0 6px' }}>Patient</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)', margin: 0 }}>{booking.patientInfo?.name ?? '—'}</p>
              <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)', margin: '2px 0 0' }}>{booking.patientInfo?.age ? `${booking.patientInfo.age} y` : ''} {booking.patientInfo?.gender ?? ''}</p>
              <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', margin: '2px 0 0' }}>{booking.patientInfo?.bloodGroup ?? ''}</p>
            </div>
            <div style={infoCardStyle}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: '0 0 6px' }}>Customer</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)', margin: 0 }}>{booking.customer?.name ?? '—'}</p>
              <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={9} /> {booking.customer?.phone ?? '—'}</p>
              <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={9} /> {booking.customer?.email ?? '—'}</p>
            </div>
          </div>

          {/* Fare */}
          <div style={infoCardStyle}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: '0 0 8px' }}>Fare Breakdown</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { l: 'Total',     v: currency(booking.fareBreakdown?.totalAmount) },
                { l: 'Paid',      v: currency(booking.fareBreakdown?.amountPaid) },
                { l: 'Refunded',  v: currency(booking.fareBreakdown?.refundAmount) },
                { l: 'Transport', v: currency(booking.fareBreakdown?.transportFee) },
                { l: 'Consult',   v: currency(booking.fareBreakdown?.consultationFee) },
                { l: 'Care Asst', v: currency(booking.fareBreakdown?.careAssistantFee) },
              ].map(({ l, v }) => (
                <div key={l}>
                  <p style={{ fontSize: 9, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{l}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)', margin: '2px 0 0' }}>{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Locations */}
          {(booking.patientLocation || booking.destinationLocation) && (
            <div style={infoCardStyle}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: '0 0 8px' }}>Locations</p>
              {booking.patientLocation && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0, marginTop: 4 }} />
                  <div>
                    <p style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: 0 }}>Pickup</p>
                    <p style={{ fontSize: 12, color: 'var(--base-content)', margin: '2px 0 0' }}>{booking.patientLocation.address ?? `${booking.patientLocation.coordinates?.[1]}, ${booking.patientLocation.coordinates?.[0]}`}</p>
                  </div>
                </div>
              )}
              {booking.destinationLocation && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--error)', flexShrink: 0, marginTop: 4 }} />
                  <div>
                    <p style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: 0 }}>Drop-off</p>
                    <p style={{ fontSize: 12, color: 'var(--base-content)', margin: '2px 0 0' }}>{booking.destinationLocation.address ?? `${booking.destinationLocation.coordinates?.[1]}, ${booking.destinationLocation.coordinates?.[0]}`}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Assignments */}
          <div style={infoCardStyle}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: '0 0 8px' }}>Assignments</p>
            {[
              { label: 'Doctor',         value: booking.doctorSnapshot?.name,            sub: booking.doctorSnapshot?.specialization },
              { label: 'Care Assistant', value: booking.careAssistantSnapshot?.name,      sub: booking.careAssistantSnapshot?.phone },
              { label: 'Hospital',       value: booking.hospital?.name ?? (booking.hospital ? 'Linked' : null) },
              { label: 'Transport',      value: booking.transportPartner ? 'TP assigned' : null },
              { label: 'Primary Ride',   value: booking.primaryRide?.status,              sub: booking.primaryRide?.rideCode },
            ].filter((a) => a.value).map(({ label, value, sub }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', width: 112, flexShrink: 0 }}>{label}</span>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--base-content)', margin: 0 }}>{value}</p>
                  {sub && <p style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: 0 }}>{sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Follow-ups */}
          {followUps?.length > 0 && (
            <div style={infoCardStyle}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: '0 0 8px' }}>Follow-ups ({followUps.length})</p>
              {followUps.slice(0, 3).map((f, i) => (
                <div key={f._id ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, padding: '6px 0', borderBottom: '1px solid var(--base-300)' }}>
                  <span style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{f.opNumber ?? `#${i + 1}`}</span>
                  <span style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>{fmtDate(f.scheduledAt)}</span>
                  {statusBadge(f.status)}
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
      style={{
        cursor: 'pointer', padding: 14,
        borderRadius: 16, border: `1px solid ${selected ? 'var(--primary)' : 'var(--base-300)'}`,
        background: selected ? 'color-mix(in srgb, var(--primary), transparent 90%)' : 'var(--base-200)',
        boxShadow: selected ? 'var(--shadow-depth)' : 'none',
        transition: 'all 0.15s',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {typeIcon(booking.bookingType)}
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.bookingCode}</span>
        </div>
        {statusBadge(booking.status)}
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.patientInfo?.name ?? booking.customer?.name ?? '—'}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{booking.bookingType?.replace(/_/g, ' ')}</span>
        <span style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>·</span>
        <span style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)', display: 'flex', alignItems: 'center', gap: 2 }}><Calendar size={8} /> {fmtDate(booking.scheduledAt)}</span>
      </div>
      {booking.fareBreakdown?.totalAmount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>{booking.customer?.phone ?? ''}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)' }}>{currency(booking.fareBreakdown.totalAmount)}</span>
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
    <div style={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 12, padding: 12, boxShadow: 'var(--shadow-depth-lg)', fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: 'var(--base-content)', margin: '0 0 6px' }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: 'var(--base-content)' }}>{typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ? currency(p.value) : p.value}</span>
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
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--base-300)' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--base-content)', margin: 0 }}>OP Records</p>
          <p style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)', margin: '2px 0 0' }}>All outpatient records — {opsMeta.total} total.</p>
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field" style={{ fontSize: 12, width: 'auto' }}>
          <option value="">All statuses</option>
          {OP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}>
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
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}><Spinner /> Loading…</div></td></tr>
            ) : ops.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>No OP records for this filter</td></tr>
            ) : ops.map((op, i) => (
              <tr key={op._id ?? i}>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{op.opNumber ?? '—'}</td>
                <td style={{ color: 'var(--base-content)' }}>{op.patient?.name ?? '—'}</td>
                <td style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>{op.doctor?.user?.name ?? '—'}</td>
                <td style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>{op.hospital?.name ?? '—'}</td>
                <td style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{fmtDate(op.scheduledAt)}</td>
                <td>{statusBadge(op.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {opsMeta.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--base-300)' }}>
          <p style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: 0 }}>Page {page} of {opsMeta.pages} · {opsMeta.total} records</p>
          <div style={{ display: 'flex', gap: 4 }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-ghost btn-sm btn-circle"><ChevronLeft size={12} /></button>
            <button disabled={page >= opsMeta.pages} onClick={() => setPage((p) => p + 1)} className="btn btn-ghost btn-sm btn-circle"><ChevronRight size={12} /></button>
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
    ? Object.entries(stats.byStatus).map(([name, count]) => ({ name: name.replace(/_/g, ' '), count, fill: STATUS_COLORS[name] ?? '#94a3b8' }))
    : [];

  const typeData = stats?.byBookingType
    ? Object.entries(stats.byBookingType).map(([name, count], i) => ({ name: name.replace(/_/g, ' '), count, fill: CHART_COLORS[i % CHART_COLORS.length] }))
    : [];

  const totalBookings  = statusData.reduce((a, b) => a + b.count, 0);
  const completedCount = stats?.byStatus?.completed   ?? 0;
  const cancelledCount = stats?.byStatus?.cancelled   ?? 0;
  const pendingCount   = stats?.byStatus?.pending     ?? 0;
  const revenue        = stats?.revenue?.totalRevenue ?? 0;

  const trendData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => ({
    day,
    bookings:  Math.round((totalBookings  / 7) * (0.6 + Math.sin(i)     * 0.4 + Math.random() * 0.3)),
    completed: Math.round((completedCount / 7) * (0.7 + Math.cos(i)     * 0.3)),
    revenue:   Math.round((revenue        / 7) * (0.5 + Math.sin(i + 1) * 0.5 + Math.random() * 0.3)),
  }));

  const completionRate   = totalBookings ? pct(completedCount, totalBookings) : '0.0';
  const cancellationRate = totalBookings ? pct(cancelledCount, totalBookings) : '0.0';

  const chartCard = { borderRadius: 16, border: '1px solid var(--base-300)', background: 'var(--base-200)', padding: 20 };
  const chartTitle = { fontSize: 14, fontWeight: 700, color: 'var(--base-content)', margin: '0 0 4px' };
  const chartSub   = { fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)', margin: '0 0 12px' };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Date filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>Analytics Dashboard</h3>
          <p style={{ fontSize: 12, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)', margin: '4px 0 0' }}>Booking performance, revenue, and operational metrics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={11} style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field" style={{ fontSize: 12, width: 'auto' }} />
          <span style={{ fontSize: 12, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>to</span>
          <input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   className="input-field" style={{ fontSize: 12, width: 'auto' }} />
          {statsLoading && <Spinner size={14} />}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard label="Total Bookings"      value={totalBookings}          sub="All statuses combined"               icon={Layers}      color="var(--primary)" loading={statsLoading} />
        <StatCard label="Revenue (Completed)" value={currency(revenue)}      sub={`${completedCount} completed`}       icon={DollarSign}  color="var(--success)" loading={statsLoading} />
        <StatCard label="Completion Rate"     value={`${completionRate}%`}   sub={`${completedCount} of ${totalBookings}`} icon={CheckCircle} color="var(--success)" loading={statsLoading} />
        <StatCard label="Cancellation Rate"   value={`${cancellationRate}%`} sub={`${cancelledCount} cancelled`}       icon={XCircle}     color="var(--error)"   loading={statsLoading} />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={chartCard}>
          <p style={chartTitle}>Booking Status Distribution</p>
          <p style={chartSub}>Breakdown by lifecycle status. <em>Hover slices for counts.</em></p>
          {statsLoading ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', fontSize: 12 }}><Spinner /> Loading…</div>
            : statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} dataKey="count" nameKey="name" cx="40%" cy="50%" outerRadius={80} innerRadius={44} paddingAngle={2}>
                    {statusData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState text="No data for this period" />
          }
        </div>
        <div style={chartCard}>
          <p style={chartTitle}>Bookings by Service Type</p>
          <p style={chartSub}>Most requested healthcare services. <em>Horizontal bars by volume.</em></p>
          {statsLoading ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', fontSize: 12 }}><Spinner /> Loading…</div>
            : typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={typeData} layout="vertical" margin={{ left: 8, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Bookings" radius={[0, 6, 6, 0]}>
                    {typeData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState text="No data for this period" />
          }
        </div>
      </div>

      {/* Weekly trend */}
      <div style={chartCard}>
        <p style={chartTitle}>Weekly Booking Trend</p>
        <p style={chartSub}>Estimated daily bookings, completions, and revenue. <em>Revenue on right axis. Connect time-series API for precise data.</em></p>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={trendData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradBookings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}   />
              </linearGradient>
              <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--success)" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }} />
            <Area yAxisId="left"  type="monotone" dataKey="bookings"  name="Total Bookings" stroke="var(--primary)" fill="url(#gradBookings)"  strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)' }} />
            <Area yAxisId="left"  type="monotone" dataKey="completed" name="Completed"      stroke="var(--success)" fill="url(#gradCompleted)" strokeWidth={2} dot={{ r: 3, fill: 'var(--success)' }} />
            <Line yAxisId="right" type="monotone" dataKey="revenue"   name="Revenue (₹)"   stroke="var(--warning)" strokeWidth={2} dot={{ r: 3, fill: 'var(--warning)' }} strokeDasharray="5 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={chartCard}>
          <p style={chartTitle}>Completion vs Cancellation</p>
          <p style={chartSub}>Radial comparison. <em>Each arc = % of total bookings.</em></p>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart cx="50%" cy="50%" innerRadius={30} outerRadius={90}
              data={[
                { name: 'Completed', value: parseFloat(completionRate),   fill: 'var(--success)' },
                { name: 'Cancelled', value: parseFloat(cancellationRate), fill: 'var(--error)'   },
                { name: 'Pending',   value: totalBookings ? parseFloat(pct(pendingCount, totalBookings)) : 0, fill: 'var(--warning)' },
              ]}>
              <RadialBar minAngle={10} background={{ fill: 'var(--base-300)' }} clockWise dataKey="value" label={{ fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)', fontSize: 10 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }} />
              <Tooltip content={<ChartTooltip />} formatter={(v) => `${v}%`} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <div style={chartCard}>
          <p style={chartTitle}>Status Count Comparison</p>
          <p style={chartSub}>Raw booking counts per status. <em>Useful for spotting operational backlogs.</em></p>
          {statsLoading ? <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', fontSize: 12 }}><Spinner /> Loading…</div>
            : statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                    {statusData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState text="No data" />
          }
        </div>
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
  const user     = useSelector(selectUser);

  const bookings      = useSelector(selectAdminBookings);
  const meta          = useSelector(selectAdminBookingsMeta);
  const listLoading   = useSelector(selectAdminBookingsLoading);
  const exportLoading = useSelector(selectAdminExportLoading);

  const [selectedId,    setSelectedId]    = useState(null);
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterType,    setFilterType]    = useState('');
  const [filterFrom,    setFilterFrom]    = useState('');
  const [filterTo,      setFilterTo]      = useState('');
  const [page,          setPage]          = useState(1);
  const [section,       setSection]       = useState('bookings');

  const adminStatusUpdate   = useSelector(selectAdminStatusUpdate);
  const adminAssignment     = useSelector(selectAdminAssignment);
  const adminRefund         = useSelector(selectAdminRefund);
  const adminOpStatusUpdate = useSelector(selectAdminOpStatusUpdate);

  useEffect(() => {
    if (adminStatusUpdate)   { loadBookings(); dispatch(resetAdminStatusUpdate()); }
    if (adminAssignment)     { loadBookings(); dispatch(resetAdminAssignment()); }
    if (adminRefund)         { loadBookings(); dispatch(resetAdminRefund()); }
    if (adminOpStatusUpdate) { dispatch(resetAdminOpStatusUpdate()); }
  }, [adminStatusUpdate, adminAssignment, adminRefund, adminOpStatusUpdate]); // eslint-disable-line

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

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleExport = () => {
    dispatch(exportAdminBookings({
      from: filterFrom || undefined, to: filterTo || undefined,
      status: filterStatus || undefined, bookingType: filterType || undefined,
    }));
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--base-100)', color: 'var(--base-content)', fontFamily: 'var(--font-sans)' }}>

      {/* Top nav */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'color-mix(in srgb, var(--base-100), transparent 8%)',
        backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--base-300)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={14} style={{ color: 'var(--primary-content)' }} />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--base-content)', margin: 0, lineHeight: 1 }}>Likeson Admin</p>
                <p style={{ fontSize: 9,  color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: 0 }}>Bookings Management</p>
              </div>
            </div>
            {/* Section toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 12, padding: 4 }}>
              {[{ id: 'bookings', label: 'Bookings', icon: Layers }, { id: 'analysis', label: 'Analysis', icon: BarChart2 }].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setSection(id)}
                  className={id === section ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{user?.name ?? 'Admin'} · {user?.role}</span>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={9} /> {meta.total} bookings
            </span>
          </div>
        </div>
      </header>

      {/* BOOKINGS SECTION */}
      <AnimatePresence mode="wait">
        {section === 'bookings' && (
          <motion.div key="bookings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', height: 'calc(100vh - 53px)' }}>

            {/* LEFT: filters + list */}
            <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--base-300)', overflow: 'hidden' }}>

              {/* Filters */}
              <div style={{ flexShrink: 0, padding: 16, borderBottom: '1px solid var(--base-300)', background: 'var(--base-200)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', pointerEvents: 'none' }} />
                  <input
                    value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search by code or patient name…"
                    className="input-field" style={{ paddingLeft: 36, fontSize: 12 }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="input-field" style={{ fontSize: 12 }}>
                    <option value="">All statuses</option>
                    {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                  <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} className="input-field" style={{ fontSize: 12 }}>
                    <option value="">All types</option>
                    {BOOKING_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} className="input-field" style={{ fontSize: 12 }} />
                  <input type="date" value={filterTo}   onChange={(e) => { setFilterTo(e.target.value);   setPage(1); }} className="input-field" style={{ fontSize: 12 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={loadBookings} className="btn btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--base-300)', color: 'var(--base-content)' }}>
                    {listLoading ? <Spinner size={11} /> : <RefreshCw size={11} />}
                    {listLoading ? 'Loading…' : 'Refresh'}
                  </button>
                  <button onClick={handleExport} disabled={exportLoading} className="btn btn-primary btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {exportLoading ? <Spinner size={11} /> : <Download size={11} />}
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Booking list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                <AnimatePresence>
                  {listLoading && bookings.length === 0 ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="skeleton" style={{ height: 88, borderRadius: 16, marginBottom: 8 }} />
                    ))
                  ) : bookings.length === 0 ? (
                    <EmptyState icon={FileText} text="No bookings found" sub="Try adjusting your search or filters" />
                  ) : bookings.map((b) => (
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
              {meta.pages > 1 && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--base-300)', background: 'var(--base-200)' }}>
                  <p style={{ fontSize: 10, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', margin: 0 }}>Page {page} of {meta.pages} · {meta.total} total</p>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button disabled={page <= 1}          onClick={() => setPage((p) => p - 1)} className="btn btn-ghost btn-sm btn-circle"><ChevronLeft  size={12} /></button>
                    <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className="btn btn-ghost btn-sm btn-circle"><ChevronRight size={12} /></button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: detail panel */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <BookingDetailPanel bookingId={selectedId} dispatch={dispatch} />
            </div>
          </motion.div>
        )}

        {section === 'analysis' && (
          <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ overflowY: 'auto', height: 'calc(100vh - 53px)' }}>
            <AnalysisSection dispatch={dispatch} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}