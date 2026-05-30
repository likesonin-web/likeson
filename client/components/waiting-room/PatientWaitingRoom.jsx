'use client';
import { useEffect }         from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams }         from 'next/navigation';
import { motion }            from 'framer-motion';
import { Stethoscope }       from 'lucide-react';
import { fetchConsultationById, selectConsultation } from '@/store/slices/consultationSlice';
import { useWaitingRoom }    from '../../hooks/useWaitingRoom';
import { ConsentModal }      from './ConsentModal';
import { WaitingRoomStatus } from './WaitingRoomStatus';
import { DoctorStatusBadge } from './DoctorStatusBadge';
import { useConsultation }   from '@/providers/ConsultationSocketProvider';

export function PatientWaitingRoom({ consultationId }) {
  const dispatch     = useDispatch();
  const consultation = useSelector(selectConsultation);
  const { joinConsultation } = useConsultation();

  // Fetch consultation if not loaded
  useEffect(() => {
    if (consultationId) {
      dispatch(fetchConsultationById(consultationId));
    }
  }, [consultationId, dispatch]);

  // Join socket room for real-time events
  useEffect(() => {
    if (!consultation) return;
    joinConsultation({
      consultationId,
      bookingId: String(consultation.bookingId),
    });
  }, [consultation, consultationId, joinConsultation]);

  const {
    showConsentModal,
    inQueue,
    queuePosition,
    isRejected,
    isTimedOut,
    isApproved,
    isLoading,
    acceptConsent,
    retryEnterQueue,
  } = useWaitingRoom(consultationId);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center relative overflow-hidden bg-base-100">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 30% 40%, var(--primary) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, var(--secondary) 0%, transparent 60%)',
        }}
        aria-hidden
      />

      {/* Floating circles decoration */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y:      [0, -20, 0],
            x:      [0, 10, 0],
            scale:  [1, 1.05, 1],
            opacity:[0.06, 0.12, 0.06],
          }}
          transition={{ duration: 5 + i * 2, repeat: Infinity, delay: i * 1.5 }}
          className="absolute rounded-full bg-primary pointer-events-none"
          style={{
            width:  80 + i * 60,
            height: 80 + i * 60,
            top:    `${10 + i * 20}%`,
            left:   `${5 + i * 22}%`,
          }}
          aria-hidden
        />
      ))}

      {/* Content card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="glass-card p-8 w-full max-w-sm mx-4 flex flex-col items-center gap-6 relative z-10"
      >
        {/* Logo/brand */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Stethoscope size={20} className="text-primary-content" />
          </div>
          <span className="font-montserrat font-black text-xl text-base-content">
            Telemedicine
          </span>
        </div>

        {/* Doctor status */}
        <DoctorStatusBadge />

        {/* Main status area */}
        {consultation ? (
          <WaitingRoomStatus
            inQueue={inQueue}
            queuePosition={queuePosition}
            isRejected={isRejected}
            isTimedOut={isTimedOut}
            isApproved={isApproved}
            onRetry={retryEnterQueue}
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="loading loading-md" />
            <p className="text-sm text-base-content/50">Loading consultation…</p>
          </div>
        )}

        {/* Consultation info */}
        {consultation && (
          <div className="w-full bg-base-200 rounded-xl p-3 text-center">
            <p className="text-xs text-base-content/50">Booking</p>
            <p className="font-mono text-xs font-bold text-base-content">
              #{String(consultation.bookingId).slice(-8).toUpperCase()}
            </p>
          </div>
        )}
      </motion.div>

      {/* Consent modal — no X, patient must accept */}
      <ConsentModal
        open={showConsentModal}
        onAccept={acceptConsent}
        isLoading={isLoading}
        role="customer"
      />
    </div>
  );
}
