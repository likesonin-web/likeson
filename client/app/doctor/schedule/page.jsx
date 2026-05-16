'use client';

import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  CalendarCheck, ChevronLeft, ChevronRight, Clock,
  User, Phone, Hospital, UserCheck, Video,
  Home, Stethoscope, Circle, ExternalLink, X,
  CalendarDays, ArrowRight, Loader2,
} from 'lucide-react';
import {
  fetchDoctorSchedule,
  fetchDoctorScheduleByDate,
  selectDoctorSchedule,
  selectDoctorScheduleByDate,
  selectAvailabilityLoading,
} from '@/store/slices/availabilitySlice';

/* ─── animation ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' } }),
};
const slideIn = {
  hidden: { opacity: 0, x: 24  },
  show:   { opacity: 1, x: 0,   transition: { duration: 0.3, ease: 'easeOut' } },
  exit:   { opacity: 0, x: 24,  transition: { duration: 0.2 } },
};

/* ─── helpers ─── */
const pad = n => String(n).padStart(2, '0');

const toDateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDisplayDate = (date) =>
  date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const getMonthDays = (year, month) => {
  const first    = new Date(year, month, 1);
  const last     = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7; // Monday = 0
  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
};

/* ─── consultation type badge ─── */
const ConsultBadge = ({ type }) => {
  const cfg = {
    inPerson:  { label: 'In-Person', icon: Stethoscope, cls: 'badge-primary' },
    video:     { label: 'Video',     icon: Video,       cls: 'badge-secondary' },
    homeVisit: { label: 'Home',      icon: Home,        cls: 'badge-accent' },
  }[type] || { label: type || 'Unknown', icon: Circle, cls: 'badge-info' };

  const Icon = cfg.icon;
  return (
    <span className={`badge ${cfg.cls} gap-1 text-[10px]`}>
      <Icon className="w-2.5 h-2.5" /> {cfg.label}
    </span>
  );
};

/* ─── status badge ─── */
const StatusBadge = ({ status }) => {
  const cfg = {
    pending:     'badge-warning',
    confirmed:   'badge-success',
    in_progress: 'badge-info',
    completed:   'badge-success',
    cancelled:   'badge-error',
    no_show:     'badge-error',
  }[status] || 'badge-primary';
  return (
    <span className={`badge ${cfg} text-[10px] capitalize`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

/* ─── booking card (in panel) ─── */
const BookingCard = ({ booking, delay, onClick, selected }) => {
  const patient = booking.patientInfo;
  const time    = formatTime(booking.scheduledAt);

  return (
    <motion.div
      variants={fadeUp} custom={delay} initial="hidden" animate="show"
      onClick={() => onClick(booking)}
      className={`p-4 rounded-xl border cursor-pointer transition-all ${
        selected
          ? 'border-primary/50 bg-primary/5'
          : 'border-base-300/60 bg-base-200 hover:border-primary/30 hover:bg-base-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-base-content leading-tight">{patient?.name || '—'}</p>
            <p className="text-[11px] text-base-content/50">
              {patient?.age ? `${patient.age}y` : ''} {patient?.gender || ''}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-xs font-mono font-bold text-primary">
            <Clock className="w-3 h-3" /> {time}
          </div>
          <StatusBadge status={booking.status} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <ConsultBadge type={booking.consultationType} />
        {booking.bookingCode && (
          <span className="text-[10px] font-mono text-base-content/30">{booking.bookingCode}</span>
        )}
      </div>
    </motion.div>
  );
};

/* ─── detail panel ─── */
const DetailPanel = ({ booking, onClose }) => {
  if (!booking) return null;
  const patient = booking.patientInfo;
  const customer = booking.customer;
  const hospital = booking.hospital;
  const ca = booking.careAssistant;

  const rows = [
    { label: 'Booking Code',      value: booking.bookingCode,                      mono: true },
    { label: 'Type',              value: booking.bookingType?.replace(/_/g, ' '),  cap: true },
    { label: 'Scheduled',         value: booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString('en-IN') : '—' },
    { label: 'Patient',           value: patient?.name },
    { label: 'Age / Gender',      value: `${patient?.age || '—'} · ${patient?.gender || '—'}` },
    { label: 'Patient Phone',     value: patient?.phone },
    { label: 'Customer',          value: customer?.name },
    { label: 'Customer Phone',    value: customer?.phone },
    { label: 'Hospital',          value: hospital?.name },
    { label: 'Care Assistant',    value: ca?.fullName },
    { label: 'Total Amount',      value: booking.fareBreakdown?.totalAmount ? `₹${booking.fareBreakdown.totalAmount.toLocaleString('en-IN')}` : '—' },
    { label: 'Payment Status',    value: booking.paymentStatus, cap: true },
  ].filter(r => r.value);

  return (
    <motion.div
      variants={slideIn} initial="hidden" animate="show" exit="exit"
      className="h-full flex flex-col"
    >
      {/* panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-base-300/60">
        <div>
          <h3 className="text-sm font-black text-base-content">Booking Details</h3>
          <p className="text-[11px] text-base-content/50 font-mono mt-0.5">{booking.bookingCode}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-base-300/60 text-base-content/40 hover:text-base-content transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* status + type */}
      <div className="px-5 py-3 border-b border-base-300/60 flex items-center gap-2 flex-wrap">
        <StatusBadge status={booking.status} />
        <ConsultBadge type={booking.consultationType} />
      </div>

      {/* rows */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-0">
        {rows.map((r, i) => (
          <div key={i} className="flex items-start justify-between py-2.5 border-b border-base-300/60 last:border-0 gap-3">
            <span className="text-xs text-base-content/50 flex-shrink-0 w-28">{r.label}</span>
            <span className={`text-xs font-semibold text-base-content text-right ${r.mono ? 'font-mono' : ''} ${r.cap ? 'capitalize' : ''}`}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {/* action */}
      <div className="px-5 py-4 border-t border-base-300/60">
        <Link
          href={`/dashboard/bookings/${booking._id}`}
          className="btn btn-primary w-full text-sm flex items-center justify-center gap-2"
        >
          View Full Booking <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
};

/* ─── calendar day cell ─── */
const DayCell = ({ date, bookingsOnDay, isToday, isSelected, onClick }) => {
  const count = bookingsOnDay.length;
  const hasBookings = count > 0;

  return (
    <button
      type="button"
      onClick={() => date && onClick(date)}
      disabled={!date}
      className={`
        relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5
        text-sm font-semibold transition-all duration-150 border
        ${!date ? 'invisible' : ''}
        ${isSelected
          ? 'bg-primary text-primary-content border-primary shadow-primary'
          : isToday
            ? 'bg-primary/10 text-primary border-primary/30'
            : hasBookings
              ? 'bg-base-200 text-base-content border-primary/20 hover:border-primary/40'
              : 'bg-base-200/50 text-base-content/40 border-base-300/40 hover:border-base-300'
        }
      `}
    >
      <span>{date?.getDate()}</span>
      {hasBookings && !isSelected && (
        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-content' : 'bg-primary'}`} />
      )}
      {isSelected && hasBookings && (
        <span className="text-[10px] font-bold opacity-75">{count}</span>
      )}
    </button>
  );
};

/* ─── main page ─── */
export default function Schedule() {
  const dispatch = useDispatch();
  const upcoming = useSelector(selectDoctorSchedule);
  const loading  = useSelector(selectAvailabilityLoading);

  const [viewDate, setViewDate]         = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState(null);

  const today = useMemo(() => new Date(), []);

  /* initial load: upcoming 14 days */
  useEffect(() => {
    dispatch(fetchDoctorSchedule({ days: 60 }));
  }, [dispatch]);

  /* fetch by specific date when selected */
  useEffect(() => {
    dispatch(fetchDoctorScheduleByDate(toDateKey(selectedDate)));
  }, [dispatch, selectedDate]);

  /* bookings map: dateKey → bookings[] */
  const bookingsByDate = useMemo(() => {
    const map = {};
    upcoming.forEach(b => {
      if (!b.scheduledAt) return;
      const key = toDateKey(new Date(b.scheduledAt));
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [upcoming]);

  const selectedKey = toDateKey(selectedDate);
  const selectedBookings = bookingsByDate[selectedKey] || [];

  /* navigation */
  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const calDays = getMonthDays(viewDate.getFullYear(), viewDate.getMonth());

  const monthLabel = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setSelectedBooking(null);
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-[family-name:var(--font-family-poppins)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-primary">
              <CalendarCheck className="w-5 h-5 text-primary-content" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-base-content">Schedule</h1>
              <p className="text-sm text-base-content/50">Upcoming appointments and booking calendar</p>
            </div>
          </div>
        </motion.div>

        {/* ── Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">

          {/* ── Left: Calendar ── */}
          <div className="space-y-5">

            {/* Calendar card */}
            <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show"
              className="rounded-2xl border border-base-300/60 bg-base-200 p-5">

              {/* month nav */}
              <div className="flex items-center justify-between mb-5">
                <button onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-base-300/60 text-base-content/50 hover:text-base-content transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-black text-base-content tracking-wide">{monthLabel}</h2>
                <button onClick={nextMonth}
                  className="p-1.5 rounded-lg hover:bg-base-300/60 text-base-content/50 hover:text-base-content transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* weekday labels */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                  <p key={d} className="text-center text-[10px] font-bold text-base-content/30 uppercase tracking-wider">
                    {d}
                  </p>
                ))}
              </div>

              {/* days grid */}
              <div className="grid grid-cols-7 gap-1">
                {calDays.map((date, i) => (
                  <DayCell
                    key={i}
                    date={date}
                    bookingsOnDay={date ? (bookingsByDate[toDateKey(date)] || []) : []}
                    isToday={date ? toDateKey(date) === toDateKey(today) : false}
                    isSelected={date ? toDateKey(date) === selectedKey : false}
                    onClick={handleDayClick}
                  />
                ))}
              </div>

              {/* legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-base-300/60">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-[11px] text-base-content/50">Has bookings</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary/20 border border-primary/30" />
                  <span className="text-[11px] text-base-content/50">Today</span>
                </div>
              </div>
            </motion.div>

            {/* upcoming summary strip */}
            <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show"
              className="rounded-2xl border border-base-300/60 bg-base-200 p-5">
              <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 text-primary" /> Upcoming (Next 7 Days)
              </h3>
              {loading ? (
                <div className="space-y-2">
                  {[0,1,2].map(i => <div key={i} className="h-8 rounded-lg skeleton" />)}
                </div>
              ) : upcoming.length === 0 ? (
                <p className="text-sm text-base-content/30 italic">No upcoming bookings</p>
              ) : (
                <div className="space-y-1.5">
                  {upcoming.slice(0, 5).map((b, i) => {
                    const d = new Date(b.scheduledAt);
                    return (
                      <button
                        key={b._id} type="button"
                        onClick={() => { setSelectedDate(d); setSelectedBooking(b); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-base-300/60 hover:border-primary/30 hover:bg-base-100 transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center w-10 flex-shrink-0">
                            <p className="text-[10px] text-base-content/40 uppercase leading-none">{d.toLocaleDateString('en-IN', { month: 'short' })}</p>
                            <p className="text-sm font-black text-base-content font-mono">{pad(d.getDate())}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-base-content leading-tight">{b.patientInfo?.name || '—'}</p>
                            <p className="text-[10px] text-base-content/40">{formatTime(b.scheduledAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={b.status} />
                          <ArrowRight className="w-3 h-3 text-base-content/20" />
                        </div>
                      </button>
                    );
                  })}
                  {upcoming.length > 5 && (
                    <p className="text-[11px] text-base-content/30 text-center pt-1">
                      +{upcoming.length - 5} more
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Right: Selected day bookings + detail ── */}
          <div className="space-y-4">

            {/* selected date header */}
            <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show">
              <h2 className="text-sm font-black text-base-content">
                {formatDisplayDate(selectedDate)}
              </h2>
              <p className="text-xs text-base-content/40 mt-0.5">
                {selectedBookings.length > 0
                  ? `${selectedBookings.length} booking${selectedBookings.length > 1 ? 's' : ''}`
                  : 'No bookings'
                }
              </p>
            </motion.div>

            {/* bookings list OR detail panel */}
            <AnimatePresence mode="wait">
              {selectedBooking ? (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="rounded-2xl border border-base-300/60 bg-base-200 overflow-hidden"
                  style={{ minHeight: 440 }}
                >
                  <DetailPanel
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                  />
                </motion.div>
              ) : (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {loading ? (
                    <div className="space-y-3">
                      {[0,1,2].map(i => <div key={i} className="h-20 rounded-xl skeleton" />)}
                    </div>
                  ) : selectedBookings.length === 0 ? (
                    <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show"
                      className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-base-300/60 text-center">
                      <CalendarDays className="w-10 h-10 text-base-content/15 mb-3" />
                      <p className="text-sm font-semibold text-base-content/30">No bookings on this day</p>
                      <p className="text-xs text-base-content/20 mt-1">Select another date to view appointments</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-3">
                      {selectedBookings
                        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                        .map((b, i) => (
                          <BookingCard
                            key={b._id} booking={b} delay={i}
                            selected={selectedBooking?._id === b._id}
                            onClick={setSelectedBooking}
                          />
                        ))
                      }
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}