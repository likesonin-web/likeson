'use client';

/**
 * TpBookingsManagement.jsx — Transport Partner Booking Management Page
 *
 * CORRECTED thunk/selector names (matched to operationsSlice.js exports):
 *   fetchTpAssignedBookings  — GET  /bookings/tp/assigned
 *   fetchTpAvailableDrivers  — GET  /bookings/tp/drivers/available
 *   tpAssignDriver           — PATCH /bookings/:id/tp/assign-driver
 *   tpReassignDriver         — PATCH /bookings/:id/tp/reassign-driver
 *
 * Selectors used:
 *   selectTpAssignedBookings
 *   selectTpAvailableDrivers
 *   selectLoading('fetchTpAssignedBookings')
 *   selectLoading('fetchTpAvailableDrivers')
 *   selectLoading('tpAssignDriver')
 *   selectLoading('tpReassignDriver')
 *   selectError('tpAssignDriver')
 *   selectError('tpReassignDriver')
 *
 * NOTE: resetTpDriverAction / selectTpDriverAction / selectTpAssignedMeta /
 *       selectTpAvailableMeta do NOT exist in operationsSlice — removed.
 *       Driver action state managed locally + via error selectors.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchTpAssignedBookings,
  fetchTpAvailableDrivers,
  tpAssignDriver,
  tpReassignDriver,
  selectTpAssignedBookings,
  selectTpAvailableDrivers,
  selectLoading,
  selectError,
} from '@/store/slices/operationsSlice';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

import {
  ClipboardList, RefreshCw, UserPlus, Users, Car,
  MapPin, Clock, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Search, Eye,
  Navigation, Phone, Calendar, Activity,
  Package, ArrowUpRight, Truck, User, Info, IndianRupee,
  Zap, Shield, TrendingUp,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'bg-warning/10 text-warning border-warning/30',   dot: 'bg-warning'  },
  confirmed:   { label: 'Confirmed',   color: 'bg-success/10 text-success border-success/40',   dot: 'bg-success'  },
  in_progress: { label: 'In Progress', color: 'bg-info/10 text-info border-info/30',            dot: 'bg-info'     },
  completed:   { label: 'Completed',   color: 'bg-primary/10 text-primary border-primary/20',  dot: 'bg-primary'  },
  cancelled:   { label: 'Cancelled',   color: 'bg-error/10 text-error border-error/30',         dot: 'bg-error'    },
  no_show:     { label: 'No Show',     color: 'bg-error/10 text-error border-error/30',         dot: 'bg-error'    },
};

const BOOKING_TYPE_LABELS = {
  full_care_ride:      'Full Care Ride',
  doctor_consultation: 'Doctor Consultation',
  doctor_online:       'Online Consultation',
  physiotherapist:     'Physiotherapist',
  care_assistant:      'Care Assistant',
  diagnostic_center:   'Diagnostic Center',
  diagnostic_home:     'Diagnostic Home',
  patient_transport:   'Patient Transport',
  follow_up:           'Follow-up',
};

const CHART_COLORS = [
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-error)',
  'var(--color-info)',
  'var(--color-accent)',
];

// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const FieldNote = ({ children }) => (
  <p className="text-xs text-base-content/50 mt-0.5 font-normal">{children}</p>
);

const SectionLabel = ({ children }) => (
  <label className="block text-xs font-bold uppercase tracking-widest text-base-content/50 mb-1">
    {children}
  </label>
);

const InfoChip = ({ icon: Icon, label, value, note }) => (
  <div className="flex flex-col gap-0.5">
    <SectionLabel>{label}</SectionLabel>
    <div className="flex items-center gap-1.5 text-sm font-semibold text-base-content">
      {Icon && <Icon size={13} className="text-primary shrink-0" />}
      <span>{value || '—'}</span>
    </div>
    {note && <FieldNote>{note}</FieldNote>}
  </div>
);

const Spinner = ({ size = 'md' }) => {
  const s = { xs: 'w-3 h-3 border-[2px]', sm: 'w-4 h-4 border-[2px]', md: 'w-5 h-5 border-2', lg: 'w-7 h-7 border-[3px]' };
  return <div className={`${s[size]} rounded-full border-primary/30 border-t-primary animate-spin`} />;
};

const EmptyState = ({ icon: Icon = ClipboardList, title, desc }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
      <Icon size={32} className="text-primary/60" />
    </div>
    <div className="text-center">
      <p className="font-bold text-base-content/70">{title}</p>
      <p className="text-sm text-base-content/40 mt-1">{desc}</p>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD — redesigned with accent stripe
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, accentColor = 'primary' }) => {
  const colorMap = {
    primary: 'border-t-primary bg-primary/5',
    warning: 'border-t-warning bg-warning/5',
    success: 'border-t-success bg-success/5',
    info:    'border-t-info    bg-info/5',
    error:   'border-t-error   bg-error/5',
  };
  const iconMap = {
    primary: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
    info:    'text-info',
    error:   'text-error',
  };
  const valMap = {
    primary: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
    info:    'text-info',
    error:   'text-error',
  };

  return (
    <div className={`rounded-xl border border-base-300 border-t-4 ${colorMap[accentColor]} p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <Icon size={20} className={iconMap[accentColor]} />
        <ArrowUpRight size={14} className="text-base-content/20" />
      </div>
      <div>
        <div className={`font-black text-3xl leading-none ${valMap[accentColor]}`}>{value}</div>
        <div className="text-xs font-bold uppercase tracking-widest text-base-content/50 mt-1">{label}</div>
        {sub && <div className="text-xs text-base-content/40 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER CARD (for modal driver list)
// ─────────────────────────────────────────────────────────────────────────────

const DriverCard = ({ driver, onSelect, selected, disabled }) => (
  <div
    onClick={() => !disabled && onSelect(driver)}
    className={`rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
      selected
        ? 'border-primary bg-primary/10 shadow-primary'
        : 'border-base-300 bg-base-100 hover:border-primary/50 hover:bg-primary/5'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <User size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-base-content truncate">{driver.legalName || 'Driver'}</p>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${driver.status === 'Available' ? 'bg-success' : 'bg-warning'}`} />
        </div>
        <p className="text-xs text-base-content/50 truncate">{driver.driverCode}</p>
      </div>
      {selected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
    </div>

    <div className="mt-2 grid grid-cols-3 gap-1 text-center">
      <div className="rounded-lg bg-base-200 py-1 px-2">
        <p className="text-xs font-bold text-base-content">{driver.performance?.rating?.toFixed(1) || '—'}</p>
        <p className="text-[10px] text-base-content/40">Rating</p>
      </div>
      <div className="rounded-lg bg-base-200 py-1 px-2">
        <p className="text-xs font-bold text-base-content truncate">{driver.assignedVehicleSnapshot?.registrationNumber || '—'}</p>
        <p className="text-[10px] text-base-content/40">Vehicle</p>
      </div>
      <div className="rounded-lg bg-base-200 py-1 px-2">
        <p className="text-xs font-bold text-base-content">{driver.phone || '—'}</p>
        <p className="text-[10px] text-base-content/40">Phone</p>
      </div>
    </div>
    <FieldNote>Click to select this driver for assignment</FieldNote>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGN DRIVER MODAL
// ─────────────────────────────────────────────────────────────────────────────

const AssignDriverModal = ({
  booking,
  mode,
  drivers,
  driversLoading,
  actionLoading,
  actionError,
  onConfirm,
  onClose,
}) => {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [searchQ, setSearchQ] = useState('');

  const filtered = (drivers || []).filter(d =>
    !searchQ ||
    d.legalName?.toLowerCase().includes(searchQ.toLowerCase()) ||
    d.driverCode?.toLowerCase().includes(searchQ.toLowerCase()) ||
    d.phone?.includes(searchQ)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-base-100 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between bg-base-200">
          <div>
            <h3 className="font-black text-base-content text-lg flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              {mode === 'assign' ? 'Assign Driver' : 'Reassign Driver'}
            </h3>
            <p className="text-xs text-base-content/50 mt-0.5">
              {mode === 'assign'
                ? 'Select an available driver from your fleet'
                : 'Replace current driver with a new fleet driver'}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <XCircle size={18} />
          </button>
        </div>

        {/* Booking Summary */}
        <div className="px-6 py-3 bg-primary/5 border-b border-primary/20">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <SectionLabel>Booking Code</SectionLabel>
              <p className="font-bold text-primary">{booking.bookingCode}</p>
              <FieldNote>Unique booking reference</FieldNote>
            </div>
            <div>
              <SectionLabel>Patient</SectionLabel>
              <p className="font-semibold text-base-content">{booking.patientInfo?.name}</p>
              <FieldNote>Patient name on booking</FieldNote>
            </div>
            <div>
              <SectionLabel>Type</SectionLabel>
              <p className="font-semibold text-base-content">{BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}</p>
              <FieldNote>Service type</FieldNote>
            </div>
            <div>
              <SectionLabel>Scheduled</SectionLabel>
              <p className="font-semibold text-base-content">
                {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
              </p>
              <FieldNote>Pickup date and time</FieldNote>
            </div>
          </div>
        </div>

        {/* Error */}
        {actionError && (
          <div className="mx-6 mt-3 alert alert-error text-xs py-2">
            <XCircle size={14} className="text-error shrink-0" />
            {actionError}
          </div>
        )}

        {/* Driver Search */}
        <div className="px-6 pt-4 pb-2">
          <SectionLabel>Search Available Drivers</SectionLabel>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search by name, code or phone…"
              className="input-field w-full pl-9 text-sm h-9"
            />
          </div>
          <FieldNote>Only Active + Verified + Available drivers shown</FieldNote>
        </div>

        {/* Driver List */}
        <div className="px-6 pb-2 max-h-52 overflow-y-auto scrollbar-thin space-y-2">
          {driversLoading ? (
            <div className="flex justify-center py-8"><Spinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="No drivers found" desc="All drivers may be on-trip or unavailable" />
          ) : (
            filtered.map(driver => (
              <DriverCard
                key={driver._id}
                driver={driver}
                selected={selectedDriver?._id === driver._id}
                onSelect={setSelectedDriver}
                disabled={actionLoading}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-base-300 flex items-center justify-between bg-base-200">
          <div className="text-sm text-base-content/60">
            {selectedDriver
              ? <span className="text-success font-semibold flex items-center gap-1"><CheckCircle2 size={14} /> {selectedDriver.legalName} selected</span>
              : <span className="text-base-content/40">No driver selected</span>
            }
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
            <button
              onClick={() => selectedDriver && onConfirm(booking._id, selectedDriver._id, mode)}
              disabled={!selectedDriver || actionLoading}
              className="btn btn-primary btn-sm gap-2"
            >
              {actionLoading ? <Spinner size="xs" /> : <CheckCircle2 size={14} />}
              {mode === 'assign' ? 'Assign' : 'Reassign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

const BookingDetailDrawer = ({ booking, onClose, onAssign, onReassign }) => {
  if (!booking) return null;
  const hasDriver = !!booking.primaryRide;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-base-100 h-full overflow-y-auto scrollbar-thin shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 bg-base-200 border-b border-base-300 flex items-center justify-between">
          <div>
            <h3 className="font-black text-base-content">{booking.bookingCode}</h3>
            <StatusBadge status={booking.status} />
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <XCircle size={18} />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Patient */}
          <section>
            <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
              <User size={12} /> Patient Information
            </h4>
            <div className="card p-4 grid grid-cols-2 gap-4">
              <InfoChip icon={User} label="Patient Name" value={booking.patientInfo?.name} note="Full name" />
              <InfoChip icon={Phone} label="Contact" value={booking.patientInfo?.phone} note="Phone number" />
              <InfoChip icon={Activity} label="Age / Gender"
                value={`${booking.patientInfo?.age || '—'} / ${booking.patientInfo?.gender || '—'}`}
                note="Patient demographics" />
              <InfoChip label="Blood Group" value={booking.patientInfo?.bloodGroup} note="Medical reference" />
            </div>
          </section>

          {/* Booking */}
          <section>
            <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
              <ClipboardList size={12} /> Booking Details
            </h4>
            <div className="card p-4 grid grid-cols-2 gap-4">
              <InfoChip icon={Package} label="Booking Type"
                value={BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}
                note="Service category" />
              <InfoChip icon={Calendar} label="Scheduled At"
                value={booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                note="Pickup date and time" />
              <InfoChip icon={MapPin} label="Pickup"
                value={booking.patientLocation?.address || booking.patientLocation?.city || '—'}
                note="Patient pickup address" />
              <InfoChip icon={Navigation} label="Destination"
                value={booking.destinationLocation?.address || booking.destinationLocation?.city || '—'}
                note="Drop-off destination" />
            </div>
          </section>

          {/* Fare */}
          <section>
            <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
              <IndianRupee size={12} /> Fare Breakdown
            </h4>
            <div className="card p-4 grid grid-cols-2 gap-4">
              <InfoChip icon={IndianRupee} label="Transport Fee"
                value={booking.fareBreakdown?.transportFee ? `₹${booking.fareBreakdown.transportFee}` : '—'}
                note="Vehicle dispatch charge" />
              <InfoChip icon={IndianRupee} label="Total Amount"
                value={booking.fareBreakdown?.totalAmount ? `₹${booking.fareBreakdown.totalAmount}` : '—'}
                note="Grand total payable" />
              <InfoChip label="Payment Status" value={booking.paymentStatus || '—'} note="Current payment state" />
              <InfoChip icon={IndianRupee} label="Amount Paid"
                value={booking.fareBreakdown?.amountPaid ? `₹${booking.fareBreakdown.amountPaid}` : '—'}
                note="Amount collected" />
            </div>
          </section>

          {/* Ride */}
          <section>
            <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
              <Car size={12} /> Ride Status
            </h4>
            <div className="card p-4 grid grid-cols-2 gap-4">
              <InfoChip icon={Car} label="Primary Ride"
                value={booking.primaryRide ? 'Ride Created' : 'No Ride Yet'}
                note="Dispatch status" />
              <InfoChip icon={Truck} label="Ride Status"
                value={booking.primaryRide?.status || '—'}
                note="Ride lifecycle state" />
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 px-6 py-4 bg-base-200 border-t border-base-300 flex gap-3">
          {!hasDriver ? (
            <button onClick={() => onAssign(booking)} className="btn btn-primary flex-1 gap-2">
              <UserPlus size={15} /> Assign Driver
            </button>
          ) : (
            <button onClick={() => onReassign(booking)} className="btn btn-warning flex-1 gap-2">
              <RefreshCw size={15} /> Reassign Driver
            </button>
          )}
          <button onClick={onClose} className="btn btn-ghost">Close</button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING ROW — refreshed layout
// ─────────────────────────────────────────────────────────────────────────────

const BookingRow = ({ booking, onViewDetail, onAssign, onReassign }) => {
  const hasDriver = !!booking.primaryRide;
  const isActionable = ['pending', 'confirmed'].includes(booking.status);

  return (
    <tr className="group">
      <td>
        <div>
          <p className="font-bold text-primary text-sm">{booking.bookingCode}</p>
          <p className="text-xs text-base-content/40 mt-0.5">Booking ID</p>
        </div>
      </td>
      <td>
        <div>
          <p className="font-semibold text-sm text-base-content">{booking.patientInfo?.name || '—'}</p>
          <p className="text-xs text-base-content/40">{booking.patientInfo?.phone || '—'}</p>
        </div>
      </td>
      <td>
        <p className="text-sm text-base-content font-medium">
          {BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}
        </p>
        <p className="text-xs text-base-content/40">Service</p>
      </td>
      <td>
        <p className="text-sm text-base-content font-medium">
          {booking.scheduledAt
            ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
            : '—'}
        </p>
        <p className="text-xs text-base-content/40">Pickup time</p>
      </td>
      <td>
        <StatusBadge status={booking.status} />
      </td>
      <td>
        {hasDriver ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-success bg-success/10 border border-success/40 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={10} /> Assigned
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full">
            <AlertTriangle size={10} /> No Driver
          </span>
        )}
        <p className="text-xs text-base-content/40 mt-0.5">Driver state</p>
      </td>
      <td>
        <p className="text-sm font-bold text-base-content">
          {booking.fareBreakdown?.totalAmount ? `₹${booking.fareBreakdown.totalAmount}` : '—'}
        </p>
        <p className="text-xs text-base-content/40">Total fare</p>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewDetail(booking)}
            className="btn btn-ghost btn-xs btn-circle"
            title="View booking details"
          >
            <Eye size={14} />
          </button>
          {isActionable && !hasDriver && (
            <button
              onClick={() => onAssign(booking)}
              className="btn btn-primary btn-xs gap-1"
            >
              <UserPlus size={12} /> Assign
            </button>
          )}
          {isActionable && hasDriver && (
            <button
              onClick={() => onReassign(booking)}
              className="btn btn-warning btn-xs gap-1"
            >
              <RefreshCw size={12} /> Swap
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARTS PANEL
// ─────────────────────────────────────────────────────────────────────────────

const ChartsPanel = ({ bookings }) => {
  const statusCounts = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const typeCounts = bookings.reduce((acc, b) => {
    const label = BOOKING_TYPE_LABELS[b.bookingType] || b.bookingType;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: STATUS_CONFIG[name]?.label || name,
    value,
  }));

  const barData = Object.entries(typeCounts).map(([name, value]) => ({
    name: name.length > 12 ? name.slice(0, 12) + '…' : name,
    count: value,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5">
        <div className="mb-4">
          <h3 className="font-black text-base-content text-sm uppercase tracking-widest">Status Distribution</h3>
          <p className="text-xs text-base-content/40 mt-0.5">All assigned bookings by current status</p>
        </div>
        {pieData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-base-content/30 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--color-base-200)', border: '1px solid var(--color-base-300)', borderRadius: '0.5rem', fontSize: '0.75rem' }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '0.75rem' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-4">
          <h3 className="font-black text-base-content text-sm uppercase tracking-widest">Bookings by Type</h3>
          <p className="text-xs text-base-content/40 mt-0.5">Count per service type in your fleet</p>
        </div>
        {barData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-base-content/30 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-base-content)', opacity: 0.5 }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-base-content)', opacity: 0.5 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--color-base-200)', border: '1px solid var(--color-base-300)', borderRadius: '0.5rem', fontSize: '0.75rem' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {barData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABLE DRIVERS PANEL
// ─────────────────────────────────────────────────────────────────────────────

const AvailableDriversPanel = ({ drivers, loading, onRefresh }) => (
  <div className="card p-5">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="font-black text-base-content text-sm uppercase tracking-widest flex items-center gap-2">
          <Shield size={14} className="text-primary" />
          Available Fleet Drivers
        </h3>
        <p className="text-xs text-base-content/40 mt-0.5">Active + Verified + Available — ready to accept bookings</p>
      </div>
      <button onClick={onRefresh} disabled={loading} className="btn btn-ghost btn-sm btn-circle">
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
    {loading ? (
      <div className="flex justify-center py-10"><Spinner size="lg" /></div>
    ) : !drivers?.length ? (
      <EmptyState icon={Users} title="No drivers available" desc="All fleet drivers are on-trip or offline" />
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {drivers.map(driver => (
          <div key={driver._id} className="rounded-xl border border-base-300 bg-base-200 p-3 hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-base-content truncate">{driver.legalName}</p>
                <p className="text-xs text-base-content/40">{driver.driverCode}</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-success" title="Available" />
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-xs">
              <div className="bg-base-100 rounded p-1">
                <p className="font-bold text-base-content">{driver.performance?.rating?.toFixed(1) || '—'}</p>
                <p className="text-base-content/40">Rating</p>
              </div>
              <div className="bg-base-100 rounded p-1">
                <p className="font-bold text-base-content truncate">{driver.assignedVehicleSnapshot?.registrationNumber || '—'}</p>
                <p className="text-base-content/40">Vehicle</p>
              </div>
              <div className="bg-base-100 rounded p-1">
                <p className="font-bold text-base-content">{driver.phone || '—'}</p>
                <p className="text-base-content/40">Phone</p>
              </div>
            </div>
            <FieldNote>
              {driver.assignedVehicleSnapshot?.make || '—'} {driver.assignedVehicleSnapshot?.model || ''}
            </FieldNote>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TpBookingsManagement() {
  const dispatch = useDispatch();

  // ── Redux State ────────────────────────────────────────────────────────────
  // CORRECTED: use actual slice export names
  const bookings      = useSelector(selectTpAssignedBookings);
  const availDrivers  = useSelector(selectTpAvailableDrivers);

  // Loading — use generic selectLoading factory from slice
  const isBookingsLoading  = useSelector(selectLoading('fetchTpAssignedBookings'));
  const isDriversLoading   = useSelector(selectLoading('fetchTpAvailableDrivers'));
  const isAssigning        = useSelector(selectLoading('tpAssignDriver'));
  const isReassigning      = useSelector(selectLoading('tpReassignDriver'));
  const actionLoading      = isAssigning || isReassigning;

  // Errors from slice
  const assignError    = useSelector(selectError('tpAssignDriver'));
  const reassignError  = useSelector(selectError('tpReassignDriver'));
  const actionError    = assignError || reassignError;

  // ── Local State ────────────────────────────────────────────────────────────
  const [searchQ,        setSearchQ]        = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [typeFilter,     setTypeFilter]     = useState('all');
  const [showCharts,     setShowCharts]     = useState(true);
  const [showDriverPanel, setShowDriverPanel] = useState(false);

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [assignModal,     setAssignModal]     = useState(null);  // { booking, mode }

  // Track prev actionLoading to detect completion
  const prevActionLoading = useRef(false);

  // ── Fetch on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchTpAssignedBookings());
    dispatch(fetchTpAvailableDrivers());
  }, [dispatch]);

  // ── Close modal + refresh on action success ────────────────────────────────
  // When actionLoading goes false→true→false and no error = success
  useEffect(() => {
    if (prevActionLoading.current && !actionLoading && !actionError && assignModal) {
      setAssignModal(null);
      dispatch(fetchTpAssignedBookings());
    }
    prevActionLoading.current = actionLoading;
  }, [actionLoading, actionError, assignModal, dispatch]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRefreshBookings = useCallback(() => dispatch(fetchTpAssignedBookings()), [dispatch]);
  const handleRefreshDrivers  = useCallback(() => dispatch(fetchTpAvailableDrivers()), [dispatch]);
  const handleAssign   = (booking) => setAssignModal({ booking, mode: 'assign' });
  const handleReassign = (booking) => setAssignModal({ booking, mode: 'reassign' });

  const handleConfirmAssign = useCallback((bookingId, driverId, mode) => {
    if (mode === 'assign') {
      dispatch(tpAssignDriver({ bookingId, driverId }));
    } else {
      dispatch(tpReassignDriver({ bookingId, newDriverId: driverId }));
    }
  }, [dispatch]);

  // ── Filtered Bookings ──────────────────────────────────────────────────────
  const filtered = (bookings || []).filter(b => {
    const matchSearch = !searchQ ||
      b.bookingCode?.toLowerCase().includes(searchQ.toLowerCase()) ||
      b.patientInfo?.name?.toLowerCase().includes(searchQ.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchType   = typeFilter   === 'all' || b.bookingType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total      = bookings?.length || 0;
  const pending    = bookings?.filter(b => b.status === 'pending').length    || 0;
  const confirmed  = bookings?.filter(b => b.status === 'confirmed').length  || 0;
  const inProgress = bookings?.filter(b => b.status === 'in_progress').length|| 0;
  const noDriver   = bookings?.filter(b => !b.primaryRide && ['pending','confirmed'].includes(b.status)).length || 0;

  const uniqueTypes = [...new Set((bookings || []).map(b => b.bookingType))];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-100" data-theme="transportpartner">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-base-100/80 backdrop-blur-strong border-b border-base-300 px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Teal accent stripe */}
            <div className="w-1 h-10 rounded-full bg-primary" />
            <div>
              <h1 className="font-black text-xl text-base-content tracking-tight flex items-center gap-2">
                <Truck size={20} className="text-primary" />
                Booking Management
              </h1>
              <p className="text-xs text-base-content/50">
                Assign, reassign and track drivers across your fleet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshBookings}
              disabled={isBookingsLoading}
              className="btn btn-ghost btn-sm gap-2"
            >
              <RefreshCw size={15} className={isBookingsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowDriverPanel(v => !v)}
              className={`btn btn-sm gap-2 ${showDriverPanel ? 'btn-primary' : 'btn-outline'}`}
            >
              <Users size={15} />
              Fleet ({availDrivers?.length || 0})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Stats Row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard icon={ClipboardList} label="Total Assigned"   value={total}      sub="Admin dispatched"    accentColor="primary" />
          <StatCard icon={Clock}         label="Pending"          value={pending}    sub="Awaiting action"    accentColor="warning" />
          <StatCard icon={CheckCircle2}  label="Confirmed"        value={confirmed}  sub="Driver assigned"    accentColor="success" />
          <StatCard icon={TrendingUp}    label="In Progress"      value={inProgress} sub="Ride ongoing"       accentColor="info"    />
          <StatCard icon={AlertTriangle} label="Needs Driver"     value={noDriver}   sub="Unassigned rides"   accentColor="error"   />
        </div>

        {/* ── Charts Toggle ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-base-content/50 flex items-center gap-2">
            <Activity size={12} className="text-primary" />
            Analytics Overview
          </h2>
          <button
            onClick={() => setShowCharts(v => !v)}
            className="btn btn-ghost btn-xs gap-1"
          >
            {showCharts ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showCharts ? 'Hide' : 'Show'} Charts
          </button>
        </div>

        {showCharts && <ChartsPanel bookings={bookings || []} />}

        {/* ── Available Drivers Panel ────────────────────────────────────────── */}
        {showDriverPanel && (
          <AvailableDriversPanel
            drivers={availDrivers}
            loading={isDriversLoading}
            onRefresh={handleRefreshDrivers}
          />
        )}

        {/* ── Bookings Table ─────────────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-base-300 bg-base-200 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <h3 className="font-black text-base-content text-sm uppercase tracking-widest">Assigned Bookings</h3>
              <p className="text-xs text-base-content/40 mt-0.5">
                Showing {filtered.length} of {total} — GET /bookings/tp/assigned
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-56">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search booking or patient…"
                className="input-field w-full pl-8 text-xs h-8"
              />
              <FieldNote>Filter by booking code or patient name</FieldNote>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-36">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="input-field w-full text-xs h-8 pr-2"
              >
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <FieldNote>Filter by status</FieldNote>
            </div>

            {/* Type Filter */}
            <div className="w-full sm:w-40">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="input-field w-full text-xs h-8 pr-2"
              >
                <option value="all">All Types</option>
                {uniqueTypes.map(t => (
                  <option key={t} value={t}>{BOOKING_TYPE_LABELS[t] || t}</option>
                ))}
              </select>
              <FieldNote>Filter by service category</FieldNote>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {isBookingsLoading ? (
              <div className="flex justify-center items-center py-20 gap-3">
                <Spinner size="lg" />
                <p className="text-base-content/50 text-sm">Loading assigned bookings…</p>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No bookings found" desc="No bookings match your current filters" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Booking Code<br /><span className="text-base-content/30 font-normal normal-case tracking-normal">Unique ID</span></th>
                    <th>Patient<br /><span className="text-base-content/30 font-normal normal-case tracking-normal">Name / Phone</span></th>
                    <th>Type<br /><span className="text-base-content/30 font-normal normal-case tracking-normal">Service</span></th>
                    <th>Scheduled<br /><span className="text-base-content/30 font-normal normal-case tracking-normal">Date / Time</span></th>
                    <th>Status<br /><span className="text-base-content/30 font-normal normal-case tracking-normal">Current</span></th>
                    <th>Driver<br /><span className="text-base-content/30 font-normal normal-case tracking-normal">Assignment</span></th>
                    <th>Fare<br /><span className="text-base-content/30 font-normal normal-case tracking-normal">Total</span></th>
                    <th>Actions<br /><span className="text-base-content/30 font-normal normal-case tracking-normal">Assign / View</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(booking => (
                    <BookingRow
                      key={booking._id}
                      booking={booking}
                      onViewDetail={setSelectedBooking}
                      onAssign={handleAssign}
                      onReassign={handleReassign}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-base-300 bg-base-200 flex items-center justify-between text-xs text-base-content/40">
              <span>{filtered.length} booking{filtered.length !== 1 ? 's' : ''} displayed</span>
              {noDriver > 0 && (
                <span className="text-warning font-bold">
                  ⚠ {noDriver} booking{noDriver !== 1 ? 's' : ''} need driver assignment
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Info Box ───────────────────────────────────────────────────────── */}
        <div className="card p-4 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-base-content/70 space-y-1">
              <p className="font-bold text-sm text-primary">How Booking Management Works</p>
              <p>1. <strong>Assigned Bookings</strong> — Admin dispatches bookings to your fleet via POST /assign/transport-partner.</p>
              <p>2. <strong>Assign Driver</strong> — You assign an available fleet driver via PATCH /:id/tp/assign-driver. Driver notified and ride created.</p>
              <p>3. <strong>Reassign Driver</strong> — Replace current driver via PATCH /:id/tp/reassign-driver. Old ride cancelled, new ride created.</p>
              <p>4. <strong>Available Drivers</strong> — Fetched live via GET /tp/drivers/available — only Active, Verified, Available-status drivers shown.</p>
            </div>
          </div>
        </div>

      </div>

      {/* ── Modals & Drawers ─────────────────────────────────────────────────── */}

      {selectedBooking && (
        <BookingDetailDrawer
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onAssign={(b) => { setSelectedBooking(null); handleAssign(b); }}
          onReassign={(b) => { setSelectedBooking(null); handleReassign(b); }}
        />
      )}

      {assignModal && (
        <AssignDriverModal
          booking={assignModal.booking}
          mode={assignModal.mode}
          drivers={availDrivers}
          driversLoading={isDriversLoading}
          actionLoading={actionLoading}
          actionError={actionError}
          onConfirm={handleConfirmAssign}
          onClose={() => setAssignModal(null)}
        />
      )}
    </div>
  );
}