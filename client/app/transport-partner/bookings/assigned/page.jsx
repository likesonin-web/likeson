'use client';

/**
 * TpBookingsManagement.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Transport Partner — Booking Management Dashboard
 *
 * ROUTES USED (from bookingRouter2.js):
 *   GET  /bookings/tp/assigned              → fetchTpAssignedBookings
 *   GET  /bookings/tp/drivers/available     → fetchTpAvailableDrivers
 *   PATCH /bookings/:id/tp/assign-driver    → tpAssignDriver   { driverId }
 *   PATCH /bookings/:id/tp/reassign-driver  → tpReassignDriver { newDriverId }
 *
 * BUSINESS RULES (enforced in UI):
 *   • Admin assigns the booking to TP first (POST /assign/transport-partner).
 *     TP's job is to assign one of its OWN fleet drivers.
 *   • Admin NEVER assigns an agency Driver directly — only TP can do that.
 *   • "Assign" creates a new Ride + RideTracking doc and sets booking → confirmed.
 *   • "Reassign" cancels in-flight rides and creates a fresh one with the new driver.
 *   • Only drivers with { ownerAgency: tp._id, status:'Available', isVerified:true }
 *     are shown — the backend enforces this, we just display what comes back.
 *
 * REDUX SLICE (operationsSlice.js):
 *   selectTpAssignedBookings  → state.operations.tpAssignedBookings (array)
 *   selectTpAvailableDrivers  → state.operations.tpAvailableDrivers (array)
 *   selectLoading(key)        → state.operations.loading[key] (boolean)
 *   selectError(key)          → state.operations.errors[key] (string|null)
 *
 * KEY CORRECTIONS from original:
 *   1. Used selectLoading / selectError factory selectors (not missing selectors).
 *   2. tpReassignDriver takes { bookingId, newDriverId } — not driverId.
 *   3. Modal closes only on confirmed success (ref-based prev-loading pattern).
 *   4. Booking rows show rider data from primaryRide.driverSnapshot (populated).
 *   5. Added Framer Motion transitions throughout.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
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
  Zap, Shield, TrendingUp, Layers, Star,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft:           { label: 'Draft',           color: 'bg-base-200 text-base-content/60 border-base-300',      dot: 'bg-base-content/30' },
  payment_pending: { label: 'Payment Pending', color: 'bg-warning/10 text-warning border-warning/30',          dot: 'bg-warning' },
  pending:         { label: 'Pending',         color: 'bg-warning/10 text-warning border-warning/30',          dot: 'bg-warning' },
  confirmed:       { label: 'Confirmed',       color: 'bg-success/10 text-success border-success/40',          dot: 'bg-success' },
  in_progress:     { label: 'In Progress',     color: 'bg-info/10 text-info border-info/30',                   dot: 'bg-info' },
  completed:       { label: 'Completed',       color: 'bg-primary/10 text-primary border-primary/20',          dot: 'bg-primary' },
  cancelled:       { label: 'Cancelled',       color: 'bg-error/10 text-error border-error/30',                dot: 'bg-error' },
  no_show:         { label: 'No Show',         color: 'bg-error/10 text-error border-error/30',                dot: 'bg-error' },
  refund_pending:  { label: 'Refund Pending',  color: 'bg-warning/10 text-warning border-warning/30',          dot: 'bg-warning' },
  refunded:        { label: 'Refunded',        color: 'bg-base-200 text-base-content/50 border-base-300',      dot: 'bg-base-content/30' },
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

/**
 * Booking statuses that are actionable for driver assignment:
 * Only pending/confirmed bookings can have drivers assigned.
 * in_progress means the ride has already started — reassignment still allowed
 * but the driver swap route handles cleanup.
 */
const ASSIGNABLE_STATUSES = ['pending', 'confirmed'];

const CHART_COLORS = [
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-error)',
  'var(--color-info)',
  'var(--color-accent)',
];

// Animation variants
const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.3 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25 } },
  exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Status badge using STATUS_CONFIG. Falls back to pending style. */
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

/** Muted helper text beneath a field — explains what the value represents. */
const FieldNote = ({ children }) => (
  <p className="text-[10px] text-base-content/40 mt-0.5 font-normal leading-tight">{children}</p>
);

/** Column/section label in ALLCAPS small text. */
const SectionLabel = ({ children }) => (
  <label className="block text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-0.5">
    {children}
  </label>
);

/** Small info chip with icon + value. Used inside detail cards. */
const InfoChip = ({ icon: Icon, label, value, note }) => (
  <div className="flex flex-col gap-0.5">
    <SectionLabel>{label}</SectionLabel>
    <div className="flex items-center gap-1.5 text-sm font-semibold text-base-content">
      {Icon && <Icon size={12} className="text-primary shrink-0" />}
      <span className="truncate">{value || '—'}</span>
    </div>
    {note && <FieldNote>{note}</FieldNote>}
  </div>
);

/** Spinner in xs/sm/md/lg sizes. */
const Spinner = ({ size = 'md' }) => {
  const s = {
    xs: 'w-3 h-3 border-[2px]',
    sm: 'w-4 h-4 border-[2px]',
    md: 'w-5 h-5 border-2',
    lg: 'w-7 h-7 border-[3px]',
  };
  return <div className={`${s[size]} rounded-full border-primary/30 border-t-primary animate-spin`} />;
};

/** Empty state with icon + message. */
const EmptyState = ({ icon: Icon = ClipboardList, title, desc }) => (
  <motion.div variants={fadeUp} initial="hidden" animate="visible"
    className="flex flex-col items-center justify-center py-20 gap-4">
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
      <Icon size={28} className="text-primary/50" />
    </div>
    <div className="text-center">
      <p className="font-bold text-base-content/70 text-sm">{title}</p>
      <p className="text-xs text-base-content/40 mt-1 max-w-xs">{desc}</p>
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT_MAP = {
  primary: { border: 'border-t-primary', bg: 'bg-primary/5',  icon: 'text-primary', val: 'text-primary' },
  warning: { border: 'border-t-warning', bg: 'bg-warning/5',  icon: 'text-warning', val: 'text-warning' },
  success: { border: 'border-t-success', bg: 'bg-success/5',  icon: 'text-success', val: 'text-success' },
  info:    { border: 'border-t-info',    bg: 'bg-info/5',     icon: 'text-info',    val: 'text-info'    },
  error:   { border: 'border-t-error',   bg: 'bg-error/5',    icon: 'text-error',   val: 'text-error'   },
};

const StatCard = ({ icon: Icon, label, value, sub, accentColor = 'primary' }) => {
  const a = ACCENT_MAP[accentColor] || ACCENT_MAP.primary;
  return (
    <motion.div variants={fadeUp}
      className={`rounded-xl border border-base-300 border-t-4 ${a.border} ${a.bg} p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-200`}
    >
      <div className="flex items-center justify-between">
        <Icon size={18} className={a.icon} />
        <ArrowUpRight size={13} className="text-base-content/20" />
      </div>
      <div>
        <div className={`font-black text-3xl leading-none ${a.val}`}>{value}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-base-content/50 mt-1">{label}</div>
        {sub && <div className="text-[10px] text-base-content/40 mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER CARD — used in assign modal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a single fleet driver for selection in the assign/reassign modal.
 * driver shape (from GET /tp/drivers/available):
 *   { _id, legalName, phone, driverCode, status, performance.rating,
 *     assignedVehicleSnapshot.{ registrationNumber, make, model, color },
 *     kyc.licenceClass }
 */
const DriverCard = ({ driver, onSelect, selected, disabled }) => (
  <motion.div
    whileHover={!disabled ? { scale: 1.01 } : {}}
    whileTap={!disabled ? { scale: 0.99 } : {}}
    onClick={() => !disabled && onSelect(driver)}
    className={`rounded-xl border p-3 cursor-pointer transition-all duration-200 select-none ${
      selected
        ? 'border-primary bg-primary/10 shadow-sm shadow-primary/20'
        : 'border-base-300 bg-base-100 hover:border-primary/50 hover:bg-primary/5'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <User size={15} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-base-content truncate">{driver.legalName || 'Driver'}</p>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${driver.status === 'Available' ? 'bg-success' : 'bg-warning'}`} />
        </div>
        <p className="text-xs text-base-content/50 truncate">{driver.driverCode}</p>
      </div>
      {selected && <CheckCircle2 size={15} className="text-primary shrink-0" />}
    </div>

    <div className="mt-2.5 grid grid-cols-3 gap-1 text-center">
      {[
        { val: driver.performance?.rating?.toFixed(1) || '—', lbl: 'Rating' },
        { val: driver.assignedVehicleSnapshot?.registrationNumber || '—', lbl: 'Vehicle' },
        { val: driver.phone || '—', lbl: 'Phone' },
      ].map(({ val, lbl }) => (
        <div key={lbl} className="rounded-lg bg-base-200 py-1 px-1">
          <p className="text-xs font-bold text-base-content truncate">{val}</p>
          <p className="text-[10px] text-base-content/40">{lbl}</p>
        </div>
      ))}
    </div>
    {driver.assignedVehicleSnapshot?.make && (
      <FieldNote>{driver.assignedVehicleSnapshot.make} {driver.assignedVehicleSnapshot.model || ''} · {driver.assignedVehicleSnapshot.color || ''}</FieldNote>
    )}
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGN DRIVER MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modal for assigning or reassigning a fleet driver.
 *
 * mode = 'assign'   → calls PATCH /:id/tp/assign-driver   { driverId }
 * mode = 'reassign' → calls PATCH /:id/tp/reassign-driver { newDriverId }
 *
 * Drivers list comes from GET /tp/drivers/available (already in Redux).
 * actionLoading prevents double-submission.
 * actionError shows backend validation messages.
 */
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

  const isAssign = mode === 'assign';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <motion.div
          variants={scaleIn} initial="hidden" animate="visible" exit="exit"
          className="relative w-full max-w-lg bg-base-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between bg-base-200 shrink-0">
            <div>
              <h3 className="font-black text-base-content text-base flex items-center gap-2">
                <Zap size={16} className="text-primary" />
                {isAssign ? 'Assign Driver' : 'Reassign Driver'}
              </h3>
              <p className="text-xs text-base-content/50 mt-0.5">
                {isAssign
                  ? 'Select an available driver from your fleet — creates ride + tracking'
                  : 'Swap the current driver — old ride cancelled, new ride created automatically'}
              </p>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
              <XCircle size={16} />
            </button>
          </div>

          {/* Booking Context */}
          <div className="px-6 py-3 bg-primary/5 border-b border-primary/20 shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">Booking to assign</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <InfoChip icon={ClipboardList} label="Booking Code" value={booking.bookingCode} note="Unique booking reference" />
              <InfoChip icon={User} label="Patient" value={booking.patientInfo?.name} note="Patient name on booking" />
              <InfoChip icon={Package} label="Type" value={BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType} note="Service type" />
              <InfoChip icon={Calendar} label="Scheduled"
                value={booking.scheduledAt
                  ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                  : '—'}
                note="Pickup date and time"
              />
              <InfoChip icon={MapPin} label="Pickup"
                value={booking.patientLocation?.address || booking.patientLocation?.city || '—'}
                note="Patient pickup location"
              />
              <InfoChip icon={Navigation} label="Drop"
                value={booking.destinationLocation?.address || booking.destinationLocation?.city || '—'}
                note="Destination"
              />
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {actionError && (
              <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="exit"
                className="mx-6 mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-error/10 border border-error/30 text-xs text-error shrink-0"
              >
                <XCircle size={13} className="shrink-0 mt-0.5" />
                {actionError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Driver search */}
          <div className="px-6 pt-4 pb-2 shrink-0">
            <SectionLabel>Search Your Available Drivers</SectionLabel>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Name, driver code or phone…"
                className="input-field w-full pl-9 text-xs h-9"
              />
            </div>
            <FieldNote>Only Active + Verified + Available-status drivers in your fleet are shown</FieldNote>
          </div>

          {/* Driver list */}
          <div className="px-6 pb-2 overflow-y-auto scrollbar-thin flex-1 space-y-2 min-h-0">
            {driversLoading ? (
              <div className="flex justify-center py-8"><Spinner size="lg" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Users} title="No drivers found"
                desc={searchQ ? 'Try a different name or code' : 'All fleet drivers are on-trip or offline'} />
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
                {filtered.map(driver => (
                  <motion.div key={driver._id} variants={fadeUp}>
                    <DriverCard
                      driver={driver}
                      selected={selectedDriver?._id === driver._id}
                      onSelect={setSelectedDriver}
                      disabled={actionLoading}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-base-300 bg-base-200 flex items-center justify-between shrink-0">
            <div className="text-sm text-base-content/60">
              {selectedDriver
                ? <span className="text-success font-semibold flex items-center gap-1.5"><CheckCircle2 size={13} /> {selectedDriver.legalName}</span>
                : <span className="text-base-content/40 text-xs">No driver selected yet</span>
              }
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
              <button
                onClick={() => selectedDriver && onConfirm(booking._id, selectedDriver._id, mode)}
                disabled={!selectedDriver || actionLoading}
                className="btn btn-primary btn-sm gap-2"
              >
                {actionLoading ? <Spinner size="xs" /> : <CheckCircle2 size={13} />}
                {isAssign ? 'Assign Driver' : 'Swap Driver'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Side drawer showing full booking detail.
 * Populated from the booking object returned by GET /tp/assigned.
 * The backend populates: customer, doctor, hospital, primaryRide (with driverSnapshot).
 */
const BookingDetailDrawer = ({ booking, onClose, onAssign, onReassign }) => {
  if (!booking) return null;

  /**
   * primaryRide is populated by the backend (select: status, driverSnapshot, vehicleSnapshot,
   * estimatedDistanceKm, estimatedDurationMin). A truthy value means a ride exists;
   * check driverSnapshot for actual driver info.
   */
  const hasRide      = !!booking.primaryRide;
  const driverSnap   = booking.primaryRide?.driverSnapshot;
  const vehicleSnap  = booking.primaryRide?.vehicleSnapshot;
  const rideStatus   = booking.primaryRide?.status;
  const isActionable = ASSIGNABLE_STATUSES.includes(booking.status);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex justify-end"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-w-md bg-base-100 h-full overflow-y-auto scrollbar-thin shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 px-6 py-4 bg-base-200 border-b border-base-300 flex items-center justify-between shrink-0">
            <div className="flex flex-col gap-1">
              <h3 className="font-black text-base-content text-base">{booking.bookingCode}</h3>
              <div className="flex items-center gap-2">
                <StatusBadge status={booking.status} />
                {booking.consultationType && (
                  <span className="text-xs text-base-content/50 bg-base-300 px-2 py-0.5 rounded-full">
                    {booking.consultationType}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle"><XCircle size={16} /></button>
          </div>

          <div className="flex-1 p-6 space-y-6">

            {/* ── Patient ───────────────────────────────────────────────── */}
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2.5 flex items-center gap-1.5">
                <User size={11} /> Patient Information
              </p>
              <div className="card p-4 grid grid-cols-2 gap-4">
                <InfoChip icon={User} label="Patient Name" value={booking.patientInfo?.name} note="Name on booking form" />
                <InfoChip icon={Phone} label="Phone" value={booking.patientInfo?.phone} note="Patient contact" />
                <InfoChip label="Age / Gender"
                  value={`${booking.patientInfo?.age ?? '—'} yrs / ${booking.patientInfo?.gender || '—'}`}
                  note="Demographics" />
                <InfoChip label="Blood Group" value={booking.patientInfo?.bloodGroup || '—'} note="Medical reference" />
                <div className="col-span-2">
                  <InfoChip label="Is Self Booking"
                    value={booking.patientInfo?.isSelf ? 'Yes — patient is booking for themselves' : 'No — booked by family/carer'}
                    note="Booking relationship" />
                </div>
              </div>
            </section>

            {/* ── Booking Details ───────────────────────────────────────── */}
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2.5 flex items-center gap-1.5">
                <ClipboardList size={11} /> Booking Details
              </p>
              <div className="card p-4 grid grid-cols-2 gap-4">
                <InfoChip icon={Package} label="Service Type"
                  value={BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}
                  note="Booking category" />
                <InfoChip icon={Calendar} label="Scheduled"
                  value={booking.scheduledAt
                    ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                    : '—'}
                  note="Pickup date and time" />
                <InfoChip icon={MapPin} label="Pickup"
                  value={booking.patientLocation?.address || booking.patientLocation?.city || '—'}
                  note={`City: ${booking.patientLocation?.city || '—'} · Pin: ${booking.patientLocation?.pincode || '—'}`} />
                <InfoChip icon={Navigation} label="Destination"
                  value={booking.destinationLocation?.address || booking.destinationLocation?.city || '—'}
                  note="Drop-off location" />
              </div>
            </section>

            {/* ── Doctor / Hospital (if populated) ─────────────────────── */}
            {(booking.doctor || booking.hospital) && (
              <section>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2.5 flex items-center gap-1.5">
                  <Activity size={11} /> Medical Provider
                </p>
                <div className="card p-4 grid grid-cols-2 gap-4">
                  {booking.doctor && (
                    <>
                      <InfoChip label="Doctor"
                        value={booking.doctorSnapshot?.name || booking.doctor?.user?.name || '—'}
                        note="Assigned physician" />
                      <InfoChip label="Specialization"
                        value={booking.doctor?.specialization || booking.doctorSnapshot?.specialization || '—'}
                        note="Medical specialty" />
                    </>
                  )}
                  {booking.hospital && (
                    <>
                      <InfoChip label="Hospital" value={booking.hospital?.name || '—'} note="Facility name" />
                      <InfoChip icon={Phone} label="Hospital Phone"
                        value={booking.hospital?.contact?.phone || '—'}
                        note="Facility contact" />
                    </>
                  )}
                </div>
              </section>
            )}

            {/* ── Fare Breakdown ────────────────────────────────────────── */}
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2.5 flex items-center gap-1.5">
                <IndianRupee size={11} /> Fare Breakdown
              </p>
              <div className="card p-4 grid grid-cols-2 gap-4">
                <InfoChip icon={IndianRupee} label="Transport Fee"
                  value={booking.fareBreakdown?.transportFee != null ? `₹${booking.fareBreakdown.transportFee}` : '—'}
                  note="Vehicle dispatch charge" />
                <InfoChip icon={IndianRupee} label="Total Amount"
                  value={booking.fareBreakdown?.totalAmount != null ? `₹${booking.fareBreakdown.totalAmount}` : '—'}
                  note="Grand total payable" />
                <InfoChip label="Payment Status"
                  value={booking.paymentStatus || '—'}
                  note="Current payment state" />
                <InfoChip icon={IndianRupee} label="Amount Paid"
                  value={booking.fareBreakdown?.amountPaid != null ? `₹${booking.fareBreakdown.amountPaid}` : '—'}
                  note="Amount collected so far" />
              </div>
            </section>

            {/* ── Ride / Driver ─────────────────────────────────────────── */}
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2.5 flex items-center gap-1.5">
                <Car size={11} /> Ride & Driver
              </p>
              <div className="card p-4 grid grid-cols-2 gap-4">
                <InfoChip icon={Car} label="Ride State"
                  value={hasRide ? rideStatus || 'Created' : 'No Ride Yet'}
                  note="Whether a ride doc exists" />
                <InfoChip label="Distance (Est.)"
                  value={booking.primaryRide?.estimatedDistanceKm != null
                    ? `${booking.primaryRide.estimatedDistanceKm} km` : '—'}
                  note="Route distance estimate" />
                {driverSnap ? (
                  <>
                    <InfoChip icon={User} label="Driver Name" value={driverSnap.name || '—'} note="Assigned driver" />
                    <InfoChip icon={Phone} label="Driver Phone" value={driverSnap.phone || '—'} note="Driver contact" />
                  </>
                ) : (
                  <div className="col-span-2">
                    <div className="rounded-lg bg-warning/10 border border-warning/30 p-2.5 text-xs text-warning font-semibold flex items-center gap-2">
                      <AlertTriangle size={13} /> No driver assigned yet — assign from your fleet below
                    </div>
                  </div>
                )}
                {vehicleSnap && (
                  <InfoChip icon={Truck} label="Vehicle"
                    value={`${vehicleSnap.make || ''} ${vehicleSnap.model || ''} · ${vehicleSnap.registrationNumber || '—'}`}
                    note="Assigned vehicle" />
                )}
              </div>
            </section>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 px-6 py-4 bg-base-200 border-t border-base-300 flex gap-3 shrink-0">
            {isActionable && !hasRide && (
              <button onClick={() => onAssign(booking)} className="btn btn-primary flex-1 gap-2">
                <UserPlus size={14} /> Assign Driver
              </button>
            )}
            {isActionable && hasRide && (
              <button onClick={() => onReassign(booking)} className="btn btn-warning flex-1 gap-2">
                <RefreshCw size={14} /> Swap Driver
              </button>
            )}
            {!isActionable && (
              <div className="flex-1 text-xs text-base-content/50 flex items-center gap-2">
                <Info size={13} />
                Booking status <strong>{booking.status}</strong> — driver changes not available
              </div>
            )}
            <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING TABLE ROW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single booking row. Shows core dispatch info.
 * primaryRide is populated by the backend with driverSnapshot.
 *
 * Actions available by status:
 *   pending/confirmed + no ride  → Assign
 *   pending/confirmed + ride     → Swap (reassign)
 *   other statuses               → View only
 */
const BookingRow = ({ booking, onViewDetail, onAssign, onReassign, index }) => {
  const hasRide      = !!booking.primaryRide;
  const isActionable = ASSIGNABLE_STATUSES.includes(booking.status);
  const driverSnap   = booking.primaryRide?.driverSnapshot;

  return (
    <motion.tr
      variants={fadeUp}
      className="group hover:bg-primary/5 transition-colors duration-150"
    >
      {/* Code */}
      <td className="py-3">
        <p className="font-bold text-primary text-sm">{booking.bookingCode}</p>
        <p className="text-[10px] text-base-content/40">
          {new Date(booking.createdAt || booking.scheduledAt).toLocaleDateString('en-IN')}
        </p>
      </td>

      {/* Patient */}
      <td>
        <p className="font-semibold text-sm text-base-content">{booking.patientInfo?.name || '—'}</p>
        <p className="text-xs text-base-content/40">{booking.patientInfo?.phone || '—'}</p>
      </td>

      {/* Type */}
      <td>
        <p className="text-sm text-base-content font-medium">
          {BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}
        </p>
        <p className="text-[10px] text-base-content/40">Service type</p>
      </td>

      {/* Scheduled */}
      <td>
        <p className="text-sm text-base-content font-medium">
          {booking.scheduledAt
            ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
            : '—'}
        </p>
        <p className="text-[10px] text-base-content/40">Pickup time</p>
      </td>

      {/* Status */}
      <td><StatusBadge status={booking.status} /></td>

      {/* Driver */}
      <td>
        {driverSnap ? (
          <div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-success bg-success/10 border border-success/40 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={9} /> Assigned
            </span>
            <p className="text-[10px] text-base-content/40 mt-0.5 truncate max-w-[100px]">{driverSnap.name}</p>
          </div>
        ) : hasRide ? (
          <div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-info bg-info/10 border border-info/30 px-2 py-0.5 rounded-full">
              <Car size={9} /> Ride Created
            </span>
            <p className="text-[10px] text-base-content/40 mt-0.5">No driver snapshot yet</p>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full">
            <AlertTriangle size={9} /> Unassigned
          </span>
        )}
      </td>

      {/* Fare */}
      <td>
        <p className="text-sm font-bold text-base-content">
          {booking.fareBreakdown?.totalAmount != null ? `₹${booking.fareBreakdown.totalAmount}` : '—'}
        </p>
        <p className="text-[10px] text-base-content/40">{booking.paymentStatus || '—'}</p>
      </td>

      {/* Actions */}
      <td>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onViewDetail(booking)} className="btn btn-ghost btn-xs btn-circle" title="View details">
            <Eye size={13} />
          </button>
          {isActionable && !hasRide && (
            <button onClick={() => onAssign(booking)} className="btn btn-primary btn-xs gap-1">
              <UserPlus size={11} /> Assign
            </button>
          )}
          {isActionable && hasRide && (
            <button onClick={() => onReassign(booking)} className="btn btn-warning btn-xs gap-1">
              <RefreshCw size={11} /> Swap
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARTS PANEL
// ─────────────────────────────────────────────────────────────────────────────

const ChartsPanel = ({ bookings }) => {
  const statusCounts = (bookings || []).reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const typeCounts = (bookings || []).reduce((acc, b) => {
    const lbl = BOOKING_TYPE_LABELS[b.bookingType] || b.bookingType;
    acc[lbl] = (acc[lbl] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: STATUS_CONFIG[name]?.label || name, value,
  }));

  const barData = Object.entries(typeCounts).map(([name, value]) => ({
    name: name.length > 14 ? name.slice(0, 14) + '…' : name, count: value,
  }));

  const tooltipStyle = {
    background: 'var(--color-base-200)',
    border: '1px solid var(--color-base-300)',
    borderRadius: '0.5rem',
    fontSize: '0.7rem',
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible"
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      <motion.div variants={fadeUp} className="card p-5">
        <p className="font-black text-xs uppercase tracking-widest text-base-content mb-0.5">Status Distribution</p>
        <p className="text-[10px] text-base-content/40 mb-4">All assigned bookings by current lifecycle status</p>
        {pieData.length === 0
          ? <div className="flex items-center justify-center h-40 text-base-content/30 text-sm">No data yet</div>
          : <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconSize={9} wrapperStyle={{ fontSize: '0.7rem' }} />
              </PieChart>
            </ResponsiveContainer>
        }
      </motion.div>

      <motion.div variants={fadeUp} className="card p-5">
        <p className="font-black text-xs uppercase tracking-widest text-base-content mb-0.5">Bookings by Service Type</p>
        <p className="text-[10px] text-base-content/40 mb-4">Volume per service category dispatched to your fleet</p>
        {barData.length === 0
          ? <div className="flex items-center justify-center h-40 text-base-content/30 text-sm">No data yet</div>
          : <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: -22, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--color-base-content)', opacity: 0.5 }} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--color-base-content)', opacity: 0.5 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
        }
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABLE DRIVERS PANEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shows the TP's available fleet drivers from GET /tp/drivers/available.
 * These are the same drivers shown inside the assign modal.
 * Useful as a standalone overview before deciding who to assign.
 */
const AvailableDriversPanel = ({ drivers, loading, onRefresh }) => (
  <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card p-5">
    <div className="flex items-center justify-between mb-4">
      <div>
        <p className="font-black text-xs uppercase tracking-widest text-base-content flex items-center gap-2">
          <Shield size={13} className="text-primary" />
          Available Fleet Drivers
        </p>
        <p className="text-[10px] text-base-content/40 mt-0.5">
          Active + Verified + Available — ready to be assigned · GET /tp/drivers/available
        </p>
      </div>
      <button onClick={onRefresh} disabled={loading} className="btn btn-ghost btn-sm btn-circle" title="Refresh driver list">
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>

    {loading ? (
      <div className="flex justify-center py-10"><Spinner size="lg" /></div>
    ) : !drivers?.length ? (
      <EmptyState icon={Users} title="No drivers available"
        desc="All fleet drivers are on-trip, offline, or unverified" />
    ) : (
      <motion.div variants={stagger} initial="hidden" animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
      >
        {drivers.map(driver => (
          <motion.div key={driver._id} variants={fadeUp}
            className="rounded-xl border border-base-300 bg-base-200 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User size={13} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-base-content truncate">{driver.legalName}</p>
                <p className="text-[10px] text-base-content/40">{driver.driverCode}</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-success shrink-0" title="Available" />
            </div>

            <div className="grid grid-cols-3 gap-1 text-center">
              {[
                { val: driver.performance?.rating?.toFixed(1) || '—', lbl: 'Rating', icon: <Star size={8} className="mx-auto text-warning mb-0.5" /> },
                { val: driver.assignedVehicleSnapshot?.registrationNumber || '—', lbl: 'Vehicle' },
                { val: driver.phone || '—', lbl: 'Phone' },
              ].map(({ val, lbl, icon }) => (
                <div key={lbl} className="bg-base-100 rounded-lg p-1.5">
                  {icon}
                  <p className="text-[10px] font-bold text-base-content truncate">{val}</p>
                  <p className="text-[9px] text-base-content/40">{lbl}</p>
                </div>
              ))}
            </div>

            {driver.assignedVehicleSnapshot && (
              <FieldNote>
                {driver.assignedVehicleSnapshot.make || '—'} {driver.assignedVehicleSnapshot.model || ''} · {driver.kyc?.licenceClass || '—'}
              </FieldNote>
            )}
          </motion.div>
        ))}
      </motion.div>
    )}
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TpBookingsManagement() {
  const dispatch = useDispatch();

  // ── Redux selectors ────────────────────────────────────────────────────────
  // tpAssignedBookings ← GET /tp/assigned → data.data.bookings
  // tpAvailableDrivers ← GET /tp/drivers/available → data.data.drivers
  const bookings     = useSelector(selectTpAssignedBookings); // array | []
  const availDrivers = useSelector(selectTpAvailableDrivers); // array | []

  // Loading keys match the thunk type strings: 'fetchTpAssignedBookings' etc.
  const isBookingsLoading = useSelector(selectLoading('fetchTpAssignedBookings'));
  const isDriversLoading  = useSelector(selectLoading('fetchTpAvailableDrivers'));
  const isAssigning       = useSelector(selectLoading('tpAssignDriver'));
  const isReassigning     = useSelector(selectLoading('tpReassignDriver'));
  const actionLoading     = isAssigning || isReassigning;

  // Error keys match thunk type strings
  const assignError   = useSelector(selectError('tpAssignDriver'));
  const reassignError = useSelector(selectError('tpReassignDriver'));
  const actionError   = assignError || reassignError || null;

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [searchQ,         setSearchQ]         = useState('');
  const [statusFilter,    setStatusFilter]     = useState('all');
  const [typeFilter,      setTypeFilter]       = useState('all');
  const [showCharts,      setShowCharts]       = useState(true);
  const [showDriverPanel, setShowDriverPanel]  = useState(false);

  const [selectedBooking, setSelectedBooking] = useState(null); // detail drawer
  const [assignModal,     setAssignModal]     = useState(null); // { booking, mode }

  // Track actionLoading transitions to auto-close modal on success
  const prevActionLoading = useRef(false);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchTpAssignedBookings());
    dispatch(fetchTpAvailableDrivers());
  }, [dispatch]);

  // ── Close modal + refresh on successful assign/reassign ────────────────────
  useEffect(() => {
    if (prevActionLoading.current && !actionLoading && !actionError && assignModal) {
      setAssignModal(null);
      dispatch(fetchTpAssignedBookings()); // refresh list to show new driver
    }
    prevActionLoading.current = actionLoading;
  }, [actionLoading, actionError, assignModal, dispatch]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRefreshBookings = useCallback(() => dispatch(fetchTpAssignedBookings()), [dispatch]);
  const handleRefreshDrivers  = useCallback(() => dispatch(fetchTpAvailableDrivers()),  [dispatch]);
  const handleAssign          = useCallback(b => setAssignModal({ booking: b, mode: 'assign' }),   []);
  const handleReassign        = useCallback(b => setAssignModal({ booking: b, mode: 'reassign' }), []);

  /**
   * Called by modal on confirm.
   * CRITICAL: tpAssignDriver takes { bookingId, driverId }
   *           tpReassignDriver takes { bookingId, newDriverId } — NOT driverId
   */
  const handleConfirmAssign = useCallback((bookingId, driverId, mode) => {
    if (mode === 'assign') {
      dispatch(tpAssignDriver({ bookingId, driverId }));
    } else {
      dispatch(tpReassignDriver({ bookingId, newDriverId: driverId }));
    }
  }, [dispatch]);

  // ── Filtered bookings ──────────────────────────────────────────────────────
  const filtered = (bookings || []).filter(b => {
    const q = searchQ.toLowerCase();
    const matchSearch = !searchQ ||
      b.bookingCode?.toLowerCase().includes(q) ||
      b.patientInfo?.name?.toLowerCase().includes(q) ||
      b.patientInfo?.phone?.includes(searchQ);
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchType   = typeFilter   === 'all' || b.bookingType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // ── Quick stats ────────────────────────────────────────────────────────────
  const total      = bookings?.length    || 0;
  const pending    = (bookings || []).filter(b => b.status === 'pending').length;
  const confirmed  = (bookings || []).filter(b => b.status === 'confirmed').length;
  const inProgress = (bookings || []).filter(b => b.status === 'in_progress').length;
  // Unassigned = actionable status but no ride doc
  const noDriver   = (bookings || []).filter(b =>
    ASSIGNABLE_STATUSES.includes(b.status) && !b.primaryRide
  ).length;

  const uniqueTypes = [...new Set((bookings || []).map(b => b.bookingType))];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-100" data-theme="transportpartner">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-30 bg-base-100/80 backdrop-blur-strong border-b border-base-300 px-6 py-4"
      >
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-1 h-10 rounded-full bg-gradient-to-b from-primary to-secondary" />
            <div>
              <h1 className="font-black text-xl text-base-content flex items-center gap-2">
                <Truck size={20} className="text-primary" />
                Booking Management
              </h1>
              <p className="text-[10px] text-base-content/50 uppercase tracking-wider">
                Transport Partner Fleet Dashboard · Assign drivers to admin-dispatched bookings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleRefreshBookings} disabled={isBookingsLoading}
              className="btn btn-ghost btn-sm gap-2">
              <RefreshCw size={14} className={isBookingsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowDriverPanel(v => !v)}
              className={`btn btn-sm gap-2 ${showDriverPanel ? 'btn-primary' : 'btn-outline'}`}
            >
              <Users size={14} />
              Fleet ({availDrivers?.length || 0} available)
            </button>
          </div>
        </div>
      </motion.header>

      {/* ── Page Body ─────────────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Stats */}
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4"
        >
          <StatCard icon={ClipboardList} label="Total Assigned"  value={total}      sub="Dispatched by admin"   accentColor="primary" />
          <StatCard icon={Clock}         label="Pending"         value={pending}    sub="Awaiting driver"       accentColor="warning" />
          <StatCard icon={CheckCircle2}  label="Confirmed"       value={confirmed}  sub="Driver assigned"       accentColor="success" />
          <StatCard icon={TrendingUp}    label="In Progress"     value={inProgress} sub="Ride underway"         accentColor="info"    />
          <StatCard icon={AlertTriangle} label="Needs Driver"    value={noDriver}   sub="Action required"       accentColor="error"   />
        </motion.div>

        {/* Analytics toggle */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-base-content/50 flex items-center gap-1.5">
            <Activity size={11} className="text-primary" /> Analytics Overview
          </p>
          <button onClick={() => setShowCharts(v => !v)} className="btn btn-ghost btn-xs gap-1">
            {showCharts ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showCharts ? 'Hide' : 'Show'} Charts
          </button>
        </div>

        <AnimatePresence>
          {showCharts && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="exit">
              <ChartsPanel bookings={bookings || []} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Available drivers panel */}
        <AnimatePresence>
          {showDriverPanel && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="exit">
              <AvailableDriversPanel
                drivers={availDrivers}
                loading={isDriversLoading}
                onRefresh={handleRefreshDrivers}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bookings Table ──────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="card overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-base-300 bg-base-200 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="font-black text-xs uppercase tracking-widest text-base-content">Assigned Bookings</p>
              <p className="text-[10px] text-base-content/40 mt-0.5">
                {filtered.length} of {total} bookings · GET /bookings/tp/assigned
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-52">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Code, patient name, phone…"
                  className="input-field w-full pl-8 text-xs h-8" />
              </div>

              {/* Status filter */}
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="input-field text-xs h-8 w-full sm:w-36">
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {/* Type filter */}
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="input-field text-xs h-8 w-full sm:w-44">
                <option value="all">All Service Types</option>
                {uniqueTypes.map(t => (
                  <option key={t} value={t}>{BOOKING_TYPE_LABELS[t] || t}</option>
                ))}
              </select>
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
              <EmptyState icon={ClipboardList}
                title={searchQ || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'No bookings match your filters'
                  : 'No bookings assigned yet'}
                desc={searchQ || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Clear filters to see all assigned bookings'
                  : 'Admin will dispatch bookings to your fleet — they appear here'}
              />
            ) : (
              <motion.table
                variants={stagger} initial="hidden" animate="visible"
                className="table"
              >
                <thead>
                  <tr>
                    {[
                      ['Booking Code', 'Unique ref'],
                      ['Patient', 'Name / phone'],
                      ['Service Type', 'Category'],
                      ['Scheduled', 'Date / time'],
                      ['Status', 'Lifecycle'],
                      ['Driver', 'Assignment'],
                      ['Fare', 'Total / paid'],
                      ['Actions', 'Assign / view'],
                    ].map(([h, s]) => (
                      <th key={h}>
                        {h}<br />
                        <span className="text-base-content/30 font-normal normal-case tracking-normal text-[9px]">{s}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((booking, i) => (
                    <BookingRow
                      key={booking._id}
                      booking={booking}
                      index={i}
                      onViewDetail={setSelectedBooking}
                      onAssign={handleAssign}
                      onReassign={handleReassign}
                    />
                  ))}
                </tbody>
              </motion.table>
            )}
          </div>

          {/* Table footer */}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-base-300 bg-base-200 flex items-center justify-between text-[10px] text-base-content/40">
              <span>{filtered.length} booking{filtered.length !== 1 ? 's' : ''} shown</span>
              {noDriver > 0 && (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-warning font-bold"
                >
                  ⚠ {noDriver} booking{noDriver !== 1 ? 's' : ''} need driver assignment
                </motion.span>
              )}
            </div>
          )}
        </motion.div>

        {/* How It Works */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible"
          className="card p-5 border-primary/20 bg-primary/5"
        >
          <div className="flex items-start gap-3">
            <Info size={15} className="text-primary mt-0.5 shrink-0" />
            <div className="space-y-1.5">
              <p className="font-black text-sm text-primary">How Fleet Dispatch Works</p>
              <div className="text-[11px] text-base-content/70 space-y-1 leading-relaxed">
                <p><strong>1. Admin assigns booking to your TP</strong> — via POST /admin/bookings/:id/assign/transport-partner. You see it here immediately.</p>
                <p><strong>2. You pick a driver</strong> — Click <em>Assign</em> → select an available fleet driver → confirm. Backend calls PATCH /:id/tp/assign-driver, creates a Ride + RideTracking doc and sets booking → confirmed.</p>
                <p><strong>3. Driver accepts in app</strong> — PATCH /:id/ride/accept changes ride to driver_accepted. Customer is notified with driver details.</p>
                <p><strong>4. Need to swap?</strong> — Click <em>Swap</em> → pick a new driver → confirm. Backend calls PATCH /:id/tp/reassign-driver, cancels the old ride and creates a fresh one. Customer is re-notified.</p>
                <p><strong>Note:</strong> Only drivers belonging to your fleet (ownerAgency = your TP ID) with status=Available are shown. Admin cannot assign your fleet's drivers directly.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailDrawer
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onAssign={b => { setSelectedBooking(null); handleAssign(b); }}
            onReassign={b => { setSelectedBooking(null); handleReassign(b); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
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
      </AnimatePresence>
    </div>
  );
}