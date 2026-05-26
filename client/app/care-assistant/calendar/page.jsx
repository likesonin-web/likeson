'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  Stethoscope,
  X,
  Activity,
  CheckCircle2,
  Loader2,
  AlertCircle,
  HeartPulse,
  CalendarCheck,
} from 'lucide-react';

import {
  fetchCareAssistantTasks,
  fetchCareAssistantTasksByDate,
  selectCareAssistantTasks,
  selectCareAssistantTasksByDate,
  selectAvailabilityLoading,
  selectAvailabilityError,
} from '@/store/slices/availabilitySlice';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const STATUS_CONFIG = {
  confirmed:   { label: 'Confirmed',   color: 'var(--success)',  bg: 'color-mix(in oklch, var(--success) 15%, transparent)' },
  in_progress: { label: 'In Progress', color: 'var(--info)',     bg: 'color-mix(in oklch, var(--info) 15%, transparent)'    },
  pending:     { label: 'Pending',     color: 'var(--warning)',  bg: 'color-mix(in oklch, var(--warning) 15%, transparent)' },
  completed:   { label: 'Completed',   color: 'var(--primary)',  bg: 'color-mix(in oklch, var(--primary) 15%, transparent)' },
  cancelled:   { label: 'Cancelled',   color: 'var(--error)',    bg: 'color-mix(in oklch, var(--error) 15%, transparent)'   },
  default:     { label: 'Unknown',     color: 'var(--neutral-content)', bg: 'var(--base-200)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(date) {
  return date.toISOString().split('T')[0];
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatFullDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getStatusCfg(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.default;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = getStatusCfg(status);
  return (
    <span
      className="badge text-xs font-semibold"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}`,
        borderRadius: 'var(--r-selector)',
        padding: '2px 10px',
      }}
    >
      {cfg.label}
    </span>
  );
}

function BookingCard({ booking, onClick }) {
  const time = formatTime(booking.scheduledAt);
  const patient = booking.patientInfo?.name || booking.customer?.name || 'Patient';
  const type = booking.bookingType?.replace(/_/g, ' ') || 'Care';
  const cfg = getStatusCfg(booking.status);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.015, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(booking)}
      className="w-full text-left"
      style={{ marginBottom: 10 }}
    >
      <div
        className="card"
        style={{
          padding: '14px 16px',
          borderLeft: `4px solid ${cfg.color}`,
          borderRadius: 'var(--r-box)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: cfg.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <HeartPulse size={18} style={{ color: cfg.color }} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: 'var(--base-content)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {patient}
          </p>
          <p style={{ fontSize: 12, color: 'color-mix(in oklch, var(--base-content) 60%, transparent)', margin: '2px 0 0', textTransform: 'capitalize' }}>
            {type}
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: cfg.color, margin: 0 }}>{time}</p>
          <StatusBadge status={booking.status} />
        </div>
      </div>
    </motion.button>
  );
}

function BookingDetailDrawer({ booking, onClose }) {
  const patient  = booking.patientInfo || {};
  const customer = booking.customer    || {};
  const doctor   = booking.doctor      || {};
  const type     = booking.bookingType?.replace(/_/g, ' ') || 'Care';

  return (
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0',
      }}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 600,
          background: 'var(--base-100)',
          borderRadius: 'var(--r-box) var(--r-box) 0 0',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--base-300)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'color-mix(in oklch, var(--primary) 12%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CalendarCheck size={22} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--base-content)', lineHeight: 1.2 }}>
              {patient.name || customer.name || 'Patient'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)', textTransform: 'capitalize' }}>
              {type}
            </p>
          </div>
          <StatusBadge status={booking.status} />
          <button
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm"
            style={{ flexShrink: 0 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--base-300)', margin: '0 20px' }} />

        {/* Body */}
        <div style={{ padding: '16px 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Time & Date */}
          <Section icon={<Clock size={16} />} title="Schedule">
            <InfoRow label="Date" value={formatFullDate(booking.scheduledAt)} />
            <InfoRow label="Time" value={formatTime(booking.scheduledAt)} />
            {booking.bookingCode && <InfoRow label="Booking ID" value={booking.bookingCode} mono />}
          </Section>

          {/* Patient Info */}
          <Section icon={<User size={16} />} title="Patient">
            {patient.name && <InfoRow label="Name" value={patient.name} />}
            {patient.age && <InfoRow label="Age" value={`${patient.age} yrs`} />}
            {patient.gender && <InfoRow label="Gender" value={patient.gender} />}
            {patient.bloodGroup && <InfoRow label="Blood Group" value={patient.bloodGroup} />}
            {patient.weight && <InfoRow label="Weight" value={`${patient.weight} kg`} />}
            {patient.phone && (
              <InfoRow label="Phone" value={patient.phone} icon={<Phone size={13} />} />
            )}
          </Section>

          {/* Doctor Info (if any) */}
          {(doctor.specialization || booking.doctorSnapshot?.name) && (
            <Section icon={<Stethoscope size={16} />} title="Doctor">
              {booking.doctorSnapshot?.name && <InfoRow label="Name" value={booking.doctorSnapshot.name} />}
              {booking.doctorSnapshot?.specialization && <InfoRow label="Specialty" value={booking.doctorSnapshot.specialization} />}
              {booking.consultationType && (
                <InfoRow label="Type" value={booking.consultationType} />
              )}
            </Section>
          )}

          {/* Location (if any) */}
          {booking.patientLocation?.address && (
            <Section icon={<MapPin size={16} />} title="Location">
              <InfoRow label="Address" value={booking.patientLocation.address} />
              {booking.patientLocation.city && <InfoRow label="City" value={booking.patientLocation.city} />}
              {booking.patientLocation.pincode && <InfoRow label="PIN" value={booking.patientLocation.pincode} />}
            </Section>
          )}

          {/* Fare */}
          {booking.fareBreakdown?.totalAmount > 0 && (
            <Section icon={<Activity size={16} />} title="Fare Breakdown">
              {booking.fareBreakdown.consultationFee > 0  && <InfoRow label="Consultation" value={`₹${booking.fareBreakdown.consultationFee}`} />}
              {booking.fareBreakdown.careAssistantFee > 0 && <InfoRow label="Care Assistant" value={`₹${booking.fareBreakdown.careAssistantFee}`} />}
              {booking.fareBreakdown.platformFee > 0      && <InfoRow label="Platform Fee" value={`₹${booking.fareBreakdown.platformFee}`} />}
              {booking.fareBreakdown.taxes > 0            && <InfoRow label="Taxes" value={`₹${booking.fareBreakdown.taxes}`} />}
              {booking.fareBreakdown.discount > 0         && <InfoRow label="Discount" value={`-₹${booking.fareBreakdown.discount}`} />}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--base-300)' }}>
                <InfoRow label="Total" value={`₹${booking.fareBreakdown.totalAmount}`} bold />
              </div>
            </Section>
          )}

          {/* Payment status */}
          <Section icon={<CheckCircle2 size={16} />} title="Payment">
            <InfoRow label="Payment Status" value={booking.paymentStatus || '—'} />
          </Section>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ color: 'var(--primary)' }}>{icon}</span>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
          {title}
        </p>
      </div>
      <div
        style={{
          background: 'var(--base-200)',
          borderRadius: 'var(--r-field)',
          padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon, mono, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)', flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: bold ? 700 : 500,
          color: bold ? 'var(--primary)' : 'var(--base-content)',
          fontFamily: mono ? 'monospace' : undefined,
          textAlign: 'right',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {icon}{value}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Schedule() {
  const dispatch = useDispatch();
  const router   = useRouter();

  const tasks       = useSelector(selectCareAssistantTasks);
  const isLoading   = useSelector(selectAvailabilityLoading);
  const error       = useSelector(selectAvailabilityError);

  const today       = new Date();
  const [viewDate, setViewDate]         = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Fetch upcoming tasks on mount (30 days to populate calendar)
  useEffect(() => {
    dispatch(fetchCareAssistantTasks({ days: 30 }));
  }, [dispatch]);

  // Also fetch by date when selected
  const handleDateClick = useCallback((date) => {
    const ymd = toYMD(date);
    setSelectedDate(ymd);
    dispatch(fetchCareAssistantTasksByDate(ymd));
  }, [dispatch]);

  // Build a set of dates that have bookings for dot indicators
  const bookedDates = new Set(
    tasks.map(b => toYMD(new Date(b.scheduledAt)))
  );

  // Get bookings for selected date (from tasks array, filtered)
  const dateBookings = selectedDate
    ? tasks.filter(b => toYMD(new Date(b.scheduledAt)) === selectedDate)
    : [];

  // Calendar grid
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calDays = [];

  // Pad start
  for (let i = 0; i < firstDay; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday   = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    handleDateClick(today);
  };

  const todayStr = toYMD(today);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--base-100)',
        paddingBottom: 40,
        fontFamily: 'var(--font-family-poppins, sans-serif)',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: 'var(--base-100)',
          borderBottom: '1px solid var(--base-300)',
          padding: '12px 16px',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => router.back()}
            className="btn btn-ghost btn-circle btn-sm"
            aria-label="Go back"
          >
            <ArrowLeft size={20} style={{ color: 'var(--primary)' }} />
          </motion.button>

          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--base-content)', lineHeight: 1.2, fontFamily: 'var(--font-family-montserrat, sans-serif)' }}>
              My Schedule
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
              Care Assistant
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={goToday}
            className="btn btn-outline btn-sm"
            style={{ fontSize: 12 }}
          >
            <Calendar size={14} />
            Today
          </motion.button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 0' }}>

        {/* ── Calendar ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="card"
          style={{ padding: '16px', marginBottom: 20 }}
        >
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={prevMonth}
              className="btn btn-ghost btn-circle btn-sm"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </motion.button>
            <motion.h2
              key={`${year}-${month}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                flex: 1, textAlign: 'center', margin: 0,
                fontSize: 16, fontWeight: 700, color: 'var(--base-content)',
                fontFamily: 'var(--font-family-montserrat, sans-serif)',
              }}
            >
              {MONTHS[month]} {year}
            </motion.h2>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={nextMonth}
              className="btn btn-ghost btn-circle btn-sm"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </motion.button>
          </div>

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
            {DAYS_SHORT.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', padding: '4px 0', letterSpacing: '0.04em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {calDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;

              const dateObj = new Date(year, month, day);
              const ymd     = toYMD(dateObj);
              const isToday    = ymd === todayStr;
              const isSelected = ymd === selectedDate;
              const hasBooking = bookedDates.has(ymd);
              const isPast     = dateObj < new Date(todayStr);

              return (
                <motion.button
                  key={ymd}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => handleDateClick(dateObj)}
                  style={{
                    position: 'relative',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    height: 42,
                    borderRadius: 'var(--r-field)',
                    border: isSelected
                      ? '2px solid var(--primary)'
                      : isToday
                        ? '1.5px solid color-mix(in oklch, var(--primary) 40%, transparent)'
                        : '1px solid transparent',
                    background: isSelected
                      ? 'var(--primary)'
                      : isToday
                        ? 'color-mix(in oklch, var(--primary) 10%, transparent)'
                        : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    opacity: isPast && !isToday && !isSelected ? 0.45 : 1,
                  }}
                  aria-label={`${day} ${MONTHS[month]}`}
                >
                  <span
                    style={{
                      fontSize: 13, fontWeight: isToday || isSelected ? 700 : 500,
                      color: isSelected
                        ? 'var(--primary-content)'
                        : isToday
                          ? 'var(--primary)'
                          : 'var(--base-content)',
                      lineHeight: 1,
                    }}
                  >
                    {day}
                  </span>
                  {hasBooking && (
                    <span
                      style={{
                        position: 'absolute', bottom: 5,
                        width: 5, height: 5, borderRadius: '50%',
                        background: isSelected ? 'var(--primary-content)' : 'var(--accent)',
                      }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Legend ── */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', padding: '0 2px' }}>
          {[
            { dot: 'var(--accent)', label: 'Has bookings' },
            { dot: 'var(--primary)', label: 'Selected' },
            { dot: 'color-mix(in oklch, var(--primary) 40%, transparent)', label: 'Today', border: true },
          ].map(({ dot, label, border }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: dot,
                border: border ? `1.5px solid ${dot}` : undefined,
              }} />
              <span style={{ fontSize: 12, color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Day Bookings ── */}
        <AnimatePresence mode="wait">
          {selectedDate ? (
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {/* Section title */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--base-content)', fontFamily: 'var(--font-family-montserrat, sans-serif)' }}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                {dateBookings.length > 0 && (
                  <span
                    className="badge badge-primary"
                    style={{ fontSize: 12 }}
                  >
                    {dateBookings.length} booking{dateBookings.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <Loader2 size={28} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : error ? (
                <div className="alert alert-error" style={{ marginBottom: 12 }}>
                  <AlertCircle size={16} />
                  <span style={{ fontSize: 13 }}>{error}</span>
                </div>
              ) : dateBookings.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    textAlign: 'center', padding: '36px 20px',
                    background: 'var(--base-200)',
                    borderRadius: 'var(--r-box)',
                  }}
                >
                  <Calendar size={36} style={{ color: 'color-mix(in oklch, var(--base-content) 25%, transparent)', margin: '0 auto 10px' }} />
                  <p style={{ margin: 0, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)', fontSize: 14 }}>
                    No bookings for this day
                  </p>
                </motion.div>
              ) : (
                <div>
                  {dateBookings
                    .slice()
                    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                    .map(booking => (
                      <BookingCard
                        key={booking._id}
                        booking={booking}
                        onClick={setSelectedBooking}
                      />
                    ))
                  }
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                textAlign: 'center', padding: '40px 20px',
                background: 'var(--base-200)',
                borderRadius: 'var(--r-box)',
              }}
            >
              <Calendar size={40} style={{ color: 'color-mix(in oklch, var(--primary) 50%, transparent)', margin: '0 auto 12px' }} />
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--base-content)' }}>
                Select a date
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                Tap any date to view your bookings
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Monthly Summary Stats ── */}
        {tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{ marginTop: 28 }}
          >
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
              Month Overview
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {[
                { label: 'Total Tasks',  value: tasks.length,                                                          icon: <CalendarCheck size={18} /> },
                { label: 'Confirmed',    value: tasks.filter(b => b.status === 'confirmed').length,                    icon: <CheckCircle2 size={18} /> },
                { label: 'In Progress',  value: tasks.filter(b => b.status === 'in_progress').length,                  icon: <Activity size={18} />     },
                { label: 'Active Days',  value: new Set(tasks.map(b => toYMD(new Date(b.scheduledAt)))).size,          icon: <Calendar size={18} />     },
              ].map(({ label, value, icon }) => (
                <div
                  key={label}
                  className="stat-card"
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 'var(--r-field)',
                      background: 'color-mix(in oklch, var(--primary) 12%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--primary)', flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>
                  <div>
                    <p className="stat-card-value" style={{ fontSize: 22 }}>{value}</p>
                    <p className="stat-card-label">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Booking Detail Drawer ── */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailDrawer
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
          />
        )}
      </AnimatePresence>

      {/* Spin keyframe for loader */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}