'use client';
/**
 * CustomerOnlineConsultation.jsx
 * Main telemedicine page for patients — Likeson.in
 *
 * Architecture:
 *  - Redux is single source of truth
 *  - MeetingContextProvider wraps VideoSDK
 *  - SocketProvider handles real-time sync
 *  - Phase-based rendering prevents impossible states
 *  - All heavy components lazy-loaded
 *
 * @param {{ params: { bookingId: string } }} props
 */

import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Lock,
  Loader2,
  WifiOff,
  RefreshCw,
  Shield,
  LogOut,
} from 'lucide-react';
import { useParams } from 'next/navigation';
// ── Context + Providers ────────────────────────────────────────────────────
import { SocketProvider, useSocket } from '@/context/SocketProvider';
import { MeetingContextProvider } from '@/context/MeetingContext';

// ── Hooks ──────────────────────────────────────────────────────────────────
import {
  useConsultationCore,
  useDevicePermissions,
  useSessionTimer,
} from '@/hooks/useConsultationCore';

// ── Constants ─────────────────────────────────────────────────────────────
import { CONSULTATION_PHASES } from '../../constants';

// ── Auth selector (adjust path to match your store) ──────────────────────
// import { selectAuthUser } from '@/store/slices/authSlice';

// ── Lazy components ───────────────────────────────────────────────────────
const TelemedicineConsentModal  = lazy(() => import('../../TelemedicineConsentModal'));
const WaitingRoomScreen         = lazy(() => import('../../WaitingRoomScreen'));
const LiveConsultationRoom      = lazy(() => import('../../LiveConsultationRoom'));
const ConsultationCompletedScreen = lazy(() => import('../../ConsultationCompletedScreen'));
const DevicePermissionModal     = lazy(() => import('../../DevicePermissionModal'));

// ─────────────────────────────────────────────────────────────────────────────
// PHASE TRANSITION ANIMATION CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const phaseVariants = {
  initial:  { opacity: 0, y: 16, scale: 0.98 },
  animate:  { opacity: 1, y: 0,  scale: 1    },
  exit:     { opacity: 0, y: -8, scale: 0.98 },
};

const phaseTransition = { duration: 0.35, ease: [0.4, 0, 0.2, 1] };

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-100"
         data-theme="customer">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-6"
      >
        {/* Logo pulse */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-primary/10 border border-primary/30
                          flex items-center justify-center backdrop-blur-sm">
            <Shield size={28} className="text-primary" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-base-content/60 text-sm font-medium tracking-wide">
            Preparing your consultation…
          </p>
          <div className="flex gap-1 mt-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS DENIED SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function AccessDeniedScreen({ reason, onBack }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 px-4"
         data-theme="customer">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="glass-card max-w-md w-full p-8 text-center flex flex-col items-center gap-6"
      >
        <div className="w-16 h-16 rounded-full bg-error/10 border border-error/30
                        flex items-center justify-center">
          <Lock size={28} className="text-error" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-base-content mb-2">Access Denied</h2>
          <p className="text-base-content/60 text-sm leading-relaxed">
            {reason ?? 'You do not have permission to access this consultation.'}
          </p>
        </div>
        <button
          onClick={onBack}
          className="btn btn-outline w-full flex items-center gap-2"
        >
          <LogOut size={16} />
          Go Back
        </button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 px-4"
         data-theme="customer">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card max-w-md w-full p-8 text-center flex flex-col items-center gap-6"
      >
        <div className="w-16 h-16 rounded-full bg-warning/10 border border-warning/30
                        flex items-center justify-center">
          <AlertTriangle size={28} className="text-warning" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-base-content mb-2">Something went wrong</h2>
          <p className="text-base-content/60 text-sm">{error}</p>
        </div>
        <button
          onClick={onRetry}
          className="btn btn-primary w-full flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN INNER COMPONENT (has access to socket context)
// ─────────────────────────────────────────────────────────────────────────────

function ConsultationInner({ bookingId, user }) {
  const coreHook = useConsultationCore({ bookingId, user });
  const {
    booking, joinDetails, followUp,
    isLoading, isActionLoading, errors,
    phase, accessDenied,
    sessionElapsed, networkQuality, logQuality,
    handleAcceptConsent, handleEndConsultation, handleRate, handleReconnect,
  } = coreHook;

  const devPermissions = useDevicePermissions();
  const timer = useSessionTimer(
    sessionElapsed,
    booking?.onlineConsultation?.allowedDurationMinutes ?? 30
  );

  // ── Permission check gate ─────────────────────────────────────────────
  const [showPermModal, setShowPermModal] = useState(false);
  useEffect(() => {
    if (phase === CONSULTATION_PHASES.LIVE && devPermissions.camPermission === 'denied') {
      setShowPermModal(true);
    }
  }, [phase, devPermissions.camPermission]);

  const onBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }, []);

  // ── Error state ───────────────────────────────────────────────────────
  const criticalError = errors.currentError || errors.joinError;
  if (!isLoading && criticalError && phase === CONSULTATION_PHASES.LOADING) {
    return <ErrorScreen error={criticalError} onRetry={() => window.location.reload()} />;
  }

  // ── Render by phase ───────────────────────────────────────────────────
  return (
    <div data-theme="customer" className="min-h-screen bg-base-100">
      <AnimatePresence mode="wait">

        {/* LOADING */}
        {phase === CONSULTATION_PHASES.LOADING && (
          <motion.div key="loading" {...phaseVariants} transition={phaseTransition}>
            <LoadingScreen />
          </motion.div>
        )}

        {/* ACCESS DENIED */}
        {phase === CONSULTATION_PHASES.DENIED && (
          <motion.div key="denied" {...phaseVariants} transition={phaseTransition}>
            <AccessDeniedScreen reason={accessDenied} onBack={onBack} />
          </motion.div>
        )}

        {/* CONSENT */}
        {phase === CONSULTATION_PHASES.CONSENT && (
          <motion.div key="consent" {...phaseVariants} transition={phaseTransition}>
            <Suspense fallback={<LoadingScreen />}>
              <TelemedicineConsentModal
                booking={booking}
                isLoading={isActionLoading}
                onAccept={handleAcceptConsent}
              />
            </Suspense>
          </motion.div>
        )}

        {/* WAITING ROOM */}
        {phase === CONSULTATION_PHASES.WAITING && (
          <motion.div key="waiting" {...phaseVariants} transition={phaseTransition}>
            <Suspense fallback={<LoadingScreen />}>
              <WaitingRoomScreen
                booking={booking}
                onBack={onBack}
              />
            </Suspense>
          </motion.div>
        )}

        {/* LIVE ROOM */}
        {phase === CONSULTATION_PHASES.LIVE && joinDetails && (
          <motion.div key="live" {...phaseVariants} transition={phaseTransition}>
            <Suspense fallback={<LoadingScreen />}>
              <MeetingContextProvider
                onMeetingLeft={handleEndConsultation}
                onError={(err) => {
                  console.error('[Meeting error]', err);
                  handleReconnect();
                }}
              >
                <LiveConsultationRoom
                  booking={booking}
                  joinDetails={joinDetails}
                  timer={timer}
                  sessionElapsed={sessionElapsed}
                  networkQuality={networkQuality}
                  onNetworkQualityChange={logQuality}
                  onEnd={handleEndConsultation}
                  onReconnect={handleReconnect}
                  isActionLoading={isActionLoading}
                />
              </MeetingContextProvider>
            </Suspense>
          </motion.div>
        )}

        {/* COMPLETED */}
        {phase === CONSULTATION_PHASES.COMPLETED && (
          <motion.div key="completed" {...phaseVariants} transition={phaseTransition}>
            <Suspense fallback={<LoadingScreen />}>
              <ConsultationCompletedScreen
                booking={booking}
                followUp={followUp}
                onRate={handleRate}
                isActionLoading={isActionLoading}
              />
            </Suspense>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Device permission modal overlay */}
      {showPermModal && (
        <Suspense fallback={null}>
          <DevicePermissionModal
            permissions={devPermissions}
            onClose={() => setShowPermModal(false)}
            onRecheck={devPermissions.recheck}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT EXPORT
// Wraps with SocketProvider (needs auth token from store)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CustomerOnlineConsultation
 * Entry point. Params come from Next.js App Router.
 *
 * Usage in page.jsx:
 *   export default function Page({ params }) {
 *     return <CustomerOnlineConsultation params={params} />;
 *   }
 */
export default function CustomerOnlineConsultation( ) {
  const params = useParams(); // 3. Get all route params
  const bookingId = params?.bookingId; // 4. Access your dynamic segment name
  
  const dispatch = useDispatch();

  // ── Get auth user from your auth slice ────────────────────────────────
  // Replace selectAuthUser with your actual selector:
  // const user = useSelector(selectAuthUser);
  // For now we use a placeholder — replace with real selector:
  const user = useSelector((state) => state.user?.user ?? null);
  const authToken = useSelector((state) => state.user?.token ?? null);

  if (!bookingId) {
    return <ErrorScreen error="No booking ID provided." onRetry={() => {}} />;
  }

  return (
    <SocketProvider
      token={authToken}
      showStatusBadge={false} // We have our own network indicator
    >
      <ConsultationInner bookingId={bookingId} user={user} />
    </SocketProvider>
  );
}