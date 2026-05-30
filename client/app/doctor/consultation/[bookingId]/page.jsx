'use client';
import { useEffect }         from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchConsultationByBooking,
  acceptConsultation,
  selectConsultation,
  selectConsultationLoading,
  selectConsultationError,
} from '@/store/slices/consultationSlice';
import { selectUser } from '@/store/slices/userSlice';
import { motion }    from 'framer-motion';
import { isInRoom, isTerminal } from '@/utils/consultationStatus';
import { isDoctor }  from '@/utils/roleHelpers';
import { Stethoscope, Play, Calendar, Clock, User } from 'lucide-react';

export default function DoctorBookingEntryPage() {
  const params    = useParams();
  const router    = useRouter();
  const dispatch  = useDispatch();
  const bookingId = params.bookingId;

  const consultation = useSelector(selectConsultation);
  const loading      = useSelector(selectConsultationLoading);
  const error        = useSelector(selectConsultationError);
  const user         = useSelector(selectUser);

  useEffect(() => {
    if (bookingId) dispatch(fetchConsultationByBooking(bookingId));
  }, [bookingId, dispatch]);

  useEffect(() => {
    if (!consultation || !user) return;

    // Role guard — patient should use patient route
    if (!isDoctor(user.role)) {
      router.replace(`/consultation/${bookingId}`);
      return;
    }

    // If already in room, redirect
    if (isInRoom(consultation.status)) {
      router.replace(`/doctor/consultation/room/${consultation._id}`);
    }
  }, [consultation, user, bookingId, router]);

  const handleAcceptAndJoin = async () => {
    if (!consultation) return;

    // FIX: Use the returned payload's _id instead of stale consultation._id from closure.
    // acceptConsultation may return an updated consultation with confirmed _id.
    // If it fails (rejectWithValue), payload is a string error — don't navigate.
    if (consultation.status === 'created' || consultation.status === 'scheduled') {
      const result = await dispatch(acceptConsultation(consultation._id));

      // If rejected, result.payload is an error string — abort navigation
      if (result.error || typeof result.payload === 'string') {
        // Toast already fired from slice extraReducers rejected handler
        return;
      }

      // Use _id from returned payload if available (most reliable)
      const consultationId = result.payload?._id || consultation._id;
      router.push(`/doctor/consultation/room/${consultationId}`);
      return;
    }

    // Already in waiting/active — just go to room
    router.push(`/doctor/consultation/room/${consultation._id}`);
  };

  if (loading.fetch) {
    return (
      <div className="min-h-dvh flex items-center justify-center" data-theme="doctor">
        <div className="loading loading-lg" />
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4" data-theme="doctor">
        <div className="glass-card p-8 max-w-sm w-full text-center flex flex-col gap-4">
          <h2 className="font-montserrat font-bold text-lg">No consultation found</h2>
          <p className="text-sm text-base-content/60">{error || 'No consultation linked to this booking.'}</p>
          <button onClick={() => router.back()} className="btn btn-primary btn-sm">Go Back</button>
        </div>
      </div>
    );
  }

  // Terminal status — doctor summary
  if (isTerminal(consultation.status)) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4" data-theme="doctor">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 max-w-md w-full flex flex-col gap-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Stethoscope size={20} className="text-primary" />
            </div>
            <h2 className="font-montserrat font-bold text-xl text-base-content">
              Consultation Summary
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="stat-card-label">Duration</p>
              <p className="stat-card-value text-2xl">{consultation.actualDurationMinutes ?? 0}m</p>
            </div>
            <div className="stat-card">
              <p className="stat-card-label">Status</p>
              <p className="stat-card-value text-2xl capitalize">{consultation.status}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm text-base-content/70">
            <div className="flex items-center gap-2">
              <User size={14} />
              Patient: {consultation.patient?.name || 'Unknown'}
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} />
              {new Date(consultation.scheduledStartTime).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </div>
          </div>

          <button onClick={() => router.push('/')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // Pre-room — doctor ready screen
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-base-100" data-theme="doctor">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="glass-card p-8 max-w-md w-full flex flex-col gap-6 items-center text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-primary">
          <Stethoscope size={28} className="text-primary-content" />
        </div>

        <div>
          <h1 className="font-montserrat font-black text-2xl text-base-content">
            Ready to consult?
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Patient will join from the waiting room once you start.
          </p>
        </div>

        {/* Consultation info */}
        <div className="w-full bg-base-200 rounded-xl p-4 text-left flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-base-content/50 uppercase tracking-wider">Patient</span>
            <span className="text-sm font-semibold text-base-content">
              {consultation.patient?.name || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-base-content/50 uppercase tracking-wider">Scheduled</span>
            <span className="text-sm font-semibold text-base-content flex items-center gap-1">
              <Clock size={12} />
              {new Date(consultation.scheduledStartTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-base-content/50 uppercase tracking-wider">Type</span>
            <span className="badge badge-primary badge-sm capitalize">
              {consultation.consultationType}
            </span>
          </div>
        </div>

        <button
          onClick={handleAcceptAndJoin}
          disabled={loading.lifecycle}
          className="btn btn-primary btn-lg w-full gap-2"
          aria-label="Join consultation room"
        >
          {loading.lifecycle
            ? <span className="loading loading-sm" />
            : <><Play size={18} /> Start Consultation</>
          }
        </button>

        <p className="text-xs text-base-content/40">
          Ensure your camera and microphone are working before joining.
        </p>
      </motion.div>
    </div>
  );
}