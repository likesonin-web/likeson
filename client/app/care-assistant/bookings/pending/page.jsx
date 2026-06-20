'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import { useRouter }                         from 'next/navigation';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  Calendar, Clock, User, Phone, MapPin, CheckCircle2, XCircle,
  Activity, Heart, UserCheck, UserX, Navigation, Bell, AlertTriangle, Inbox
} from 'lucide-react';

import {
  fetchCAPendingBookings,
  fetchCABookings,
  acceptCABooking,
  rejectCABooking,
  selectCAPendingBookings,
  selectCABookings,
  selectCAPendingCount,
  selectClinicalLoading,
} from '@/store/slices/clinicalSlice';
import BackButton from '@/components/BackButton';

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.22 } },
};

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1,   transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.94, transition: { duration: 0.18 } },
};

// ─── Constants & Helpers ──────────────────────────────────────────────────────
const BOOKING_TYPE_LABELS = {
  full_care_ride:      'Full Care Ride',
  doctor_consultation: 'Doctor Consultation',
  doctor_online:       'Online Consultation',
  physiotherapist:     'Physiotherapy',
  care_assistant:      'Care Assistant',
  diagnostic_center:   'Diagnostic Center',
  diagnostic_home:     'Home Diagnostic',
  patient_transport:   'Patient Transport',
  follow_up:           'Follow-Up',
};

const RIDE_BOOKING_TYPES = new Set(['full_care_ride', 'patient_transport', 'diagnostic_home', 'care_assistant']);
const TRACKABLE_STATUSES = new Set(['pending', 'confirmed', 'in_progress']);

function getRideId(booking) {
  if (!booking) return null;
  const raw = booking.primaryRide || booking.rides?.[0];
  if (!raw) return null;
  return typeof raw === 'string' ? raw : (raw._id?.toString() ?? raw.toString());
}

function canTrack(booking) {
  if (!booking) return false;
  return RIDE_BOOKING_TYPES.has(booking.bookingType) && !!getRideId(booking) && TRACKABLE_STATUSES.has(booking.status);
}

function FieldNote({ children }) {
  return <span className="block text-[0.68rem] font-medium text-base-content/40 mt-0.5 leading-tight tracking-wide">{children}</span>;
}

function Spinner({ size = 'md' }) {
  return <span className={`loading loading-spinner loading-${size}`} />;
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-md bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary/50" />
      </div>
      <p className="text-base font-bold text-base-content/60">{title}</p>
      <p className="text-sm text-base-content/40 mt-1 max-w-xs">{subtitle}</p>
    </motion.div>
  );
}

// ─── Active Booking Card ──────────────────────────────────────────────────────
function ActiveBookingCard({ booking }) {
  const router = useRouter();
  const patientName = booking.patientInfo?.name || booking.customer?.name || 'Unknown Patient';
  const phone       = booking.customer?.phone   || booking.patientInfo?.phone || '—';
  const trackable   = canTrack(booking);

  return (
    <motion.div variants={fadeUp} className=" border rounded-md overflow-hidden border-l-4 border-l-success">
      <div className="flex items-start justify-between px-5 pt-5 pb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-success" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-success border-2 border-white"></span>
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-base-content truncate">{patientName}</p>
            <p className="text-xs text-base-content/50 mt-0.5">Active Care Session</p>
          </div>
        </div>
      </div>

      <div className="px-5 pb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">Type</p>
          <span className="badge badge-xs badge-accent mt-1">{BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}</span>
        </div>
        <div>
          <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">Phone</p>
          <p className="font-semibold text-base-content text-xs mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> {phone}</p>
        </div>
        {booking.patientLocation?.address && (
          <div className="col-span-2">
            <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">Location</p>
            <p className="font-semibold text-base-content text-xs mt-0.5 flex items-start gap-1">
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-1">{booking.patientLocation.address}</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 pb-5 pt-3 border-t border-base-300/60 bg-base-200/50">
        <button onClick={() => router.push(`/care-assistant/active-record?bookingId=${booking._id}`)} className="btn btn-success   flex-1 gap-1.5 shadow-sm hover:shadow-md">
          <Activity className="w-4 h-4" /> Go to Care Record
        </button>
        {trackable && (
          <button onClick={() => router.push(`/care-assistant/tracking/${booking._id}/${getRideId(booking)}?type=${booking.bookingType}`)} className="btn btn-outline  gap-1.5">
            <Navigation className="w-4 h-4" /> Track
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Pending Booking Card ─────────────────────────────────────────────────────
function PendingBookingCard({ booking, onAccept, onReject, isAccepting, isRejecting }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason]         = useState('');

  const patientName = booking.patientInfo?.name || booking.customer?.name || 'Unknown Patient';
  const phone       = booking.customer?.phone   || booking.patientInfo?.phone || '—';
  const scheduled   = booking.scheduledAt ? new Date(booking.scheduledAt) : null;

  function handleReject() {
    onReject(booking._id, reason);
    setRejectOpen(false);
    setReason('');
  }

  return (
    <motion.div variants={fadeUp} className="card overflow-hidden border-l-4 border-l-warning">
      <div className="flex items-start justify-between px-5 pt-5 pb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-base-content truncate">{patientName}</p>
            <span className="badge badge-xs badge-accent mt-1">{BOOKING_TYPE_LABELS[booking.bookingType] || booking.bookingType}</span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">Phone</p>
          <p className="font-semibold text-base-content text-xs mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> {phone}</p>
        </div>
        {scheduled && (
          <div>
            <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">Scheduled</p>
            <p className="font-semibold text-base-content text-xs mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {scheduled.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
        {booking.patientLocation?.address && (
          <div className="col-span-2">
            <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wide">Location</p>
            <p className="font-semibold text-base-content text-xs mt-0.5 flex items-start gap-1">
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-1">{booking.patientLocation.address}</span>
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {rejectOpen && (
          <motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit" className="px-5 pb-3">
            <label className="label"><span className="label-text">Reason for rejection</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Personal emergency..." rows={2} className="input-field resize-none text-xs" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 px-5 pb-5 pt-3 border-t border-base-300/60 bg-base-200/50">
        <button onClick={() => onAccept(booking._id)} disabled={isAccepting || isRejecting} className="btn btn-primary  flex-1 gap-1.5 shadow-sm hover:shadow-md">
          {isAccepting ? <Spinner size="xs" /> : <UserCheck className="w-4 h-4" />} Accept
        </button>

        {!rejectOpen ? (
          <button onClick={() => setRejectOpen(true)} disabled={isAccepting || isRejecting} className="btn btn-outline  flex-1 gap-1.5 border-error text-error hover:bg-error hover:text-error-content hover:border-error">
            <UserX className="w-4 h-4" /> Reject
          </button>
        ) : (
          <div className="flex gap-2 flex-1">
            <button onClick={handleReject} disabled={isRejecting} className="btn btn-error  flex-1 gap-1 shadow-sm">
              {isRejecting ? <Spinner size="xs" /> : <XCircle className="w-3.5 h-3.5" />} Confirm
            </button>
            <button onClick={() => setRejectOpen(false)} className="btn btn-ghost ">Cancel</button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ActiveBookings() {
  const dispatch = useDispatch();

  const pendingBookings = useSelector(selectCAPendingBookings);
  const pendingCount    = useSelector(selectCAPendingCount);
  const allBookings     = useSelector(selectCABookings);
  
  const loadingPending = useSelector(selectClinicalLoading('fetchCAPendingBookings'));
  const loadingActive  = useSelector(selectClinicalLoading('fetchCABookings'));
  const loadingAccept  = useSelector(selectClinicalLoading('acceptCABooking'));
  const loadingReject  = useSelector(selectClinicalLoading('rejectCABooking'));

  const [tab, setTab] = useState('new');
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  const loadPending = useCallback(() => dispatch(fetchCAPendingBookings()), [dispatch]);
  const loadActive  = useCallback(() => dispatch(fetchCABookings({ status: 'in_progress', limit: 50 })), [dispatch]);

  useEffect(() => {
    if (tab === 'new') loadPending();
    if (tab === 'active') loadActive();
  }, [tab, loadPending, loadActive]);

  async function handleAccept(bookingId) {
    setAcceptingId(bookingId);
    await dispatch(acceptCABooking({ bookingId, patientSnapshot: null }));
    setAcceptingId(null);
    loadPending();
  }

  async function handleReject(bookingId, reason) {
    setRejectingId(bookingId);
    await dispatch(rejectCABooking({ bookingId, reason }));
    setRejectingId(null);
    loadPending();
  }

  const activeBookings = allBookings.filter(b => b.status === 'in_progress');

  return (
    <div data-theme="care-assistant" className="min-h-screen bg-base-100 relative overflow-hidden">
      {/* Master Level Background Effects */}
      <div className="fixed top-0 left-1/2 w-[70vw] h-[50vh] -translate-x-1/2 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10 mix-blend-multiply dark:mix-blend-screen" />
      <div className="fixed bottom-0 right-0 w-[40vw] h-[40vh] bg-secondary/10 rounded-full blur-[100px] pointer-events-none -z-10 mix-blend-multiply dark:mix-blend-screen" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <BackButton className='my-3' />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-md flex items-center justify-center bg-[image:var(--bg-gradient-primary)] shadow-primary">
                <Activity className="w-6 h-6 text-primary-content" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-base-content tracking-tight">Active & New Tasks</h1>
                <p className="text-sm text-base-content/50 mt-1">Manage incoming requests and ongoing care</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.08 }}>
          <div className="flex gap-1 p-1.5 rounded-xl bg-base-200/80 backdrop-blur-sm w-fit border border-base-300">
            {[
              { key: 'new', label: 'New Requests', icon: Bell, badge: pendingCount },
              { key: 'active', label: 'In Progress', icon: Activity, badge: null },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 relative
                  ${tab === t.key ? 'bg-base-100 text-primary shadow-sm ring-1 ring-base-300' : 'text-base-content/50 hover:text-base-content/80'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
                {t.badge > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-warning-content text-[0.6rem] font-black flex items-center justify-center bg-warning ring-2 ring-base-100">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {tab === 'new' && (
            <motion.div key="new" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {loadingPending ? (
                <div className="flex justify-center py-20"><Spinner size="lg" /></div>
              ) : pendingBookings.length === 0 ? (
                <EmptyState icon={Inbox} title="No pending requests" subtitle="You're all caught up! New bookings will appear here." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {pendingBookings.map(b => (
                    <PendingBookingCard key={b._id} booking={b} onAccept={handleAccept} onReject={handleReject}
                      isAccepting={acceptingId === b._id && loadingAccept}
                      isRejecting={rejectingId === b._id && loadingReject} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'active' && (
            <motion.div key="active" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {loadingActive ? (
                <div className="flex justify-center py-20"><Spinner size="lg" /></div>
              ) : activeBookings.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No active tasks" subtitle="You don't have any care sessions currently in progress." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {activeBookings.map(b => <ActiveBookingCard key={b._id} booking={b} />)}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}