'use client';
import { useState }              from 'react';
import { AnimatePresence }       from 'framer-motion';
import { useSelector }           from 'react-redux';
import {
  selectConsultation,
  selectRtStatus,
  selectConsultationLoading,
} from '@/store/slices/consultationSlice';
import { useConsultationRoom }    from '../../hooks/useConsultationRoom';
import { VideoGrid }              from './VideoGrid';
import { PiPWindow }              from './PiPWindow';
import { ControlsBar }            from './ControlsBar';
import { TimerDisplay }           from './TimerDisplay';
import { ConnectionStatusBanner } from './ConnectionStatusBanner';
import { ConsultationStatusBadge } from '../shared/ConsultationStatusBadge';
import { ConsultationSidebar }    from '../sidebar/ConsultationSidebar';
import { ReconnectingOverlay }    from '../modals/ReconnectingOverlay';
import { EndCallModal }           from '../modals/EndCallModal';
import { KickParticipantModal }   from '../modals/KickParticipantModal';
import { FeedbackModal }          from '../modals/FeedbackModal';
import { useParticipantControls } from '../../hooks/useParticipantControls';

export function ConsultationRoom({ role, consultationId }) {
  const {
    consultation, joinToken, joined, joinError, loading, rtStatus,
    client, localTracks, remoteUsers, screenShare, networkQuality, reconnect, timer,
    sidebarOpen, setSidebarOpen, activeTab, setActiveTab,
    showEndModal,      setShowEndModal,
    showFeedbackModal, setShowFeedbackModal,
    showKickModal,     setShowKickModal,
  } = useConsultationRoom(consultationId, role);

  const { kick } = useParticipantControls(consultationId);

  const [kickTarget, setKickTarget] = useState(null);
  const handleKickRequest = (participant) => {
    setKickTarget(participant);
    setShowKickModal(true);
  };

  const localName  = consultation?.patient?.name  || 'You';
const doctorName = consultation?.doctor?.user?.name || consultation?.doctor?.name || 'Doctor';
  const isPaused  = rtStatus === 'paused';

  /**
   * FIX: Loading gate split into 3 clear states:
   *
   * 1. joinError present     → show error + retry (was hidden before because
   *                            !joined kept showing spinner, never showing error msg
   *                            when joinError was set BEFORE joined ever became true)
   *
   * 2. permError present     → camera/mic denied — guide user
   *
   * 3. loading.token || !joined (no error) → normal joining spinner
   *
   * Previously: single `if (loading.token || !joined)` block showed spinner
   * even when joinError was set (e.g. missing APP_ID env) because the error text
   * was inside that block but the spinner rendered first and dominated visually.
   * Worse: if loading.token cleared but joinError was set and joined=false,
   * the UI showed "Error: <msg>" with a spinner behind it — confusing on mobile.
   */

  // State 1: Hard error — Agora failed to join (bad token, missing APP_ID, etc.)
  if (joinError) {
    return (
      <div className="consultation-room items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center p-6">
          <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <p className="font-montserrat font-bold text-base text-base-content">
              Failed to join room
            </p>
            <p className="text-sm text-base-content/60 mt-1 font-poppins break-words">
              {joinError}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary btn-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // State 2: Camera/mic permission denied
  if (localTracks.permError) {
    return (
      <div className="consultation-room items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center p-6">
          <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="font-montserrat font-bold text-base text-base-content">
              Camera &amp; microphone access required
            </p>
            <p className="text-sm text-base-content/60 mt-1 font-poppins">
              Please allow camera and microphone access in your browser settings, then reload.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary btn-sm"
          >
            Reload &amp; Try Again
          </button>
        </div>
      </div>
    );
  }

  // State 3: Still joining (token loading OR Agora not yet joined, no error)
  if (loading.token || !joined) {
    // FIX: Show what step we're on so doctor knows why it's loading
    const stepLabel = loading.token
      ? 'Getting room credentials…'
      : !joinToken
      ? 'Preparing room…'
      : 'Connecting to room…';

    return (
      <div className="consultation-room items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loading loading-lg" aria-label="Joining consultation" />
          <p className="text-sm text-base-content/60 font-poppins">
            {stepLabel}
          </p>
        </div>
      </div>
    );
  }

  // State 4: Fully joined — render room
  return (
    <div className="consultation-room" data-testid="consultation-room">
      <ConnectionStatusBanner />

      <div className="consultation-video-area">
       <VideoGrid
  localTracks={localTracks}
  remoteUsers={remoteUsers}
  localName={role === 'doctor' ? doctorName : localName}
  doctorName={doctorName}
  patientName={localName}
  role={role}
/>

        {Object.keys(remoteUsers).length > 0 && (
          <PiPWindow
            localTracks={localTracks}
            localName={localName}
            remoteUsers={remoteUsers}
          />
        )}

        <div className="absolute top-3 left-3 z-10">
          <TimerDisplay />
        </div>

        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <ConsultationStatusBadge />
        </div>

        {isPaused && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="glass-card px-8 py-5 text-center">
              <p className="font-montserrat font-bold text-lg text-base-content">
                Consultation Paused
              </p>
              <p className="text-sm text-base-content/60 mt-1">
                Waiting for the doctor to resume…
              </p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {sidebarOpen && (
            <ConsultationSidebar
              role={role}
              consultationId={consultationId}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onClose={() => setSidebarOpen(false)}
              onKickRequest={handleKickRequest}
              userId={joinToken?.uid}
            />
          )}
        </AnimatePresence>

        <ReconnectingOverlay
          isReconnecting={reconnect.isReconnecting}
          attempts={reconnect.attempts}
          failed={reconnect.failed}
          onRetry={reconnect.retryManually}
        />
      </div>

      <ControlsBar
        role={role}
        consultationId={consultationId}
        localTracks={localTracks}
        screenShare={screenShare}
        onEnd={() => setShowEndModal(true)}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((v) => !v)}
      />

      <EndCallModal
        open={showEndModal}
        onClose={() => setShowEndModal(false)}
        role={role}
        consultationId={consultationId}
      />

      <KickParticipantModal
        open={showKickModal}
        participant={kickTarget}
        onConfirm={kick}
        onClose={() => { setShowKickModal(false); setKickTarget(null); }}
      />

      <FeedbackModal
        open={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        consultationId={consultationId}
      />
    </div>
  );
}