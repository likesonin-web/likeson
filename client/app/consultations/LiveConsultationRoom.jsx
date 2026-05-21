'use client';
/**
 * LiveConsultationRoom.jsx
 * VideoSDK meeting room with full controls.
 * Lazy-loaded by CustomerOnlineConsultation.
 *
 * Responsibilities:
 * - Initialize MeetingProvider
 * - Render participant tiles
 * - Floating controls
 * - Chat + prescription drawers
 * - Reconnect overlays
 * - Network quality monitoring
 * - Session timer + warning
 */

import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Clock,
  AlertTriangle,
  Phone,
} from 'lucide-react';

import { useMeetingContext } from '@/context/MeetingContext';
import { MEETING_STATE, MAX_RECONNECT_ATTEMPTS } from './constants'

// Lazy sub-components
const CustomerParticipantTile   = lazy(() => import('./CustomerParticipantTile'));
const CustomerMeetingControls   = lazy(() => import('./CustomerMeetingControls'));
const ConsultationChatDrawer    = lazy(() => import('./ConsultationChatDrawer'));
const PrescriptionDrawer        = lazy(() => import('./PrescriptionDrawer'));
const ConnectionQualityBadge    = lazy(() => import('./ConnectionQualityBadge'));

// VideoSDK MeetingProvider — lazy to avoid SSR issues
let MeetingProvider = null;

// ─────────────────────────────────────────────────────────────────────────────
// RECONNECT OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

function ReconnectOverlay({ reconnectCount, onManualRetry }) {
  const tooManyAttempts = reconnectCount >= MAX_RECONNECT_ATTEMPTS;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center
                 bg-base-100/90 backdrop-blur-md rounded-2xl gap-4"
    >
      {tooManyAttempts ? (
        <>
          <div className="w-14 h-14 rounded-full bg-error/10 border border-error/30
                          flex items-center justify-center">
            <WifiOff size={24} className="text-error" />
          </div>
          <div className="text-center px-4">
            <p className="font-semibold text-base-content">Connection Lost</p>
            <p className="text-sm text-base-content/60 mt-1">
              Unable to reconnect after {reconnectCount} attempts.
            </p>
          </div>
          <button onClick={onManualRetry} className="btn btn-primary btn-sm">
            <RefreshCw size={14} />
            Retry Connection
          </button>
        </>
      ) : (
        <>
          <Loader2 size={32} className="text-primary animate-spin" />
          <p className="text-base-content/70 text-sm">Reconnecting… (attempt {reconnectCount})</p>
        </>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION WARNING BANNER
// ─────────────────────────────────────────────────────────────────────────────

function SessionWarningBanner({ remaining, isExpired }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
        ${isExpired
          ? 'bg-error/10 border border-error/30 text-error'
          : 'bg-warning/10 border border-warning/30 text-warning'
        }`}
    >
      <Clock size={14} />
      {isExpired
        ? 'Session time expired'
        : `Session ending in ${remaining}`
      }
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER ROOM (inside MeetingProvider context)
// ─────────────────────────────────────────────────────────────────────────────

function RoomInner({
  booking,
  joinDetails,
  timer,
  networkQuality,
  onNetworkQualityChange,
  onEnd,
  onReconnect,
  isActionLoading,
}) {
  const {
    meetingState,
    participants,
    localParticipantId,
    isMicOn, isCamOn, isSpeakerOn, isHandRaised,
    isDoctorPresent,
    reconnectCount,
    messages, sendMessage,
    toggleMic, toggleCam, toggleSpeaker, toggleHand,
    safeJoin, safeLeave, switchCamera,
    meetingRef,
  } = useMeetingContext();

  const [chatOpen,        setChatOpen]        = useState(false);
  const [prescOpen,       setPrescOpen]       = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [unreadCount,     setUnreadCount]     = useState(0);
  const containerRef = useRef(null);

  // ── Join on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    safeJoin();
    return () => safeLeave();
  }, []); // eslint-disable-line

  // ── Chat unread counter ────────────────────────────────────────────────
  useEffect(() => {
    if (!chatOpen && messages.length > 0) {
      setUnreadCount((n) => n + 1);
    }
  }, [messages.length]); // eslint-disable-line

  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  // ── Fullscreen toggle ──────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Network quality from VideoSDK ──────────────────────────────────────
  // VideoSDK exposes stats — poll periodically
  useEffect(() => {
    if (meetingState !== 'CONNECTED') return;
    const interval = setInterval(() => {
      // Use connection type as proxy when VideoSDK stats unavailable
      const conn = navigator?.connection;
      if (!conn) return;
      let quality = 'good';
      if (conn.effectiveType === '4g' || !conn.effectiveType) quality = 'excellent';
      else if (conn.effectiveType === '3g') quality = 'good';
      else if (conn.effectiveType === '2g') quality = 'poor';
      else if (!navigator.onLine) quality = 'disconnected';
      onNetworkQualityChange(quality);
    }, 10_000);
    return () => clearInterval(interval);
  }, [meetingState, onNetworkQualityChange]);

  // ── Handle end ─────────────────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    safeLeave();
    onEnd();
  }, [safeLeave, onEnd]);

  // ── Participant list (exclude self, deduplicated) ─────────────────────
  const remoteParticipants = useMemo(() => {
    const arr = [];
    participants.forEach((p, id) => {
      if (id !== localParticipantId) arr.push(p);
    });
    return arr;
  }, [participants, localParticipantId]);

  const isReconnecting = meetingState === 'RECONNECTING' || meetingState === 'CONNECTING';
  const docParticipant = remoteParticipants[0] ?? null;

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen bg-base-100 flex flex-col overflow-hidden"
    >
      {/* ── TOP BAR ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-base-100/80
                      backdrop-blur-sm border-b border-base-300/50 z-10">
        {/* Doctor info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30
                          flex items-center justify-center overflow-hidden flex-shrink-0">
            {booking?.doctor?.profilePhotoUrl ? (
              <img
                src={booking.doctor.profilePhotoUrl}
                alt="Doctor"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-primary text-xs font-bold">Dr</span>
            )}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-base-content line-clamp-1">
              {booking?.doctorSnapshot?.name
                ? `Dr. ${booking.doctorSnapshot.name}`
                : 'Consulting Doctor'}
            </p>
            <p className="text-xs text-base-content/50">
              {booking?.doctorSnapshot?.specialization ?? 'General Physician'}
            </p>
          </div>
        </div>

        {/* Right: timer + network */}
        <div className="flex items-center gap-3">
          {(timer.isWarning || timer.isExpired) && (
            <SessionWarningBanner remaining={timer.remaining} isExpired={timer.isExpired} />
          )}
          <div className="flex flex-col items-end">
            <span className={`text-sm font-mono font-semibold
              ${timer.isExpired ? 'text-error' : timer.isWarning ? 'text-warning' : 'text-base-content'}`}>
              {timer.elapsed}
            </span>
            <span className="text-xs text-base-content/40">
              / {booking?.onlineConsultation?.allowedDurationMinutes ?? 30}m
            </span>
          </div>
          <Suspense fallback={null}>
            <ConnectionQualityBadge quality={networkQuality} compact />
          </Suspense>
        </div>
      </div>

      {/* ── VIDEO AREA ───────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden bg-base-200/50">

        {/* Doctor tile (main) */}
        <div className="absolute inset-0">
          {docParticipant ? (
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="text-primary animate-spin" size={32} />
              </div>
            }>
              <CustomerParticipantTile
                participantId={docParticipant.id}
                isDoctor
                isDoctorPresent={isDoctorPresent}
                isSpeakerOn={isSpeakerOn}
                className="w-full h-full"
              />
            </Suspense>
          ) : (
            <DoctorPlaceholder isDoctorPresent={isDoctorPresent} />
          )}
        </div>

        {/* Self preview (pip) */}
        {localParticipantId && (
          <div className="absolute bottom-20 right-4 w-24 h-36 md:w-32 md:h-48
                          rounded-xl overflow-hidden shadow-xl border-2 border-base-100/50
                          z-10">
            <Suspense fallback={<div className="w-full h-full bg-base-300 animate-pulse" />}>
              <CustomerParticipantTile
                participantId={localParticipantId}
                isSelf
                isCamOn={isCamOn}
                className="w-full h-full"
              />
            </Suspense>
          </div>
        )}

        {/* Reconnect overlay */}
        <AnimatePresence>
          {isReconnecting && (
            <ReconnectOverlay
              reconnectCount={reconnectCount}
              onManualRetry={onReconnect}
            />
          )}
        </AnimatePresence>

      </div>

      {/* ── CONTROLS ─────────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <CustomerMeetingControls
          isMicOn={isMicOn}
          isCamOn={isCamOn}
          isSpeakerOn={isSpeakerOn}
          isHandRaised={isHandRaised}
          isFullscreen={isFullscreen}
          chatUnread={unreadCount}
          hasPrescription={booking?.onlineConsultation?.prescriptionUploaded}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onToggleSpeaker={toggleSpeaker}
          onToggleHand={toggleHand}
          onToggleFullscreen={toggleFullscreen}
          onOpenChat={() => setChatOpen(true)}
          onOpenPrescription={() => setPrescOpen(true)}
          onSwitchCamera={switchCamera}
          onLeave={handleLeave}
          isActionLoading={isActionLoading}
        />
      </Suspense>

      {/* ── CHAT DRAWER ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {chatOpen && (
          <Suspense fallback={null}>
            <ConsultationChatDrawer
              messages={messages}
              onSend={sendMessage}
              onClose={() => setChatOpen(false)}
              localParticipantId={localParticipantId}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* ── PRESCRIPTION DRAWER ──────────────────────────────────────── */}
      <AnimatePresence>
        {prescOpen && (
          <Suspense fallback={null}>
            <PrescriptionDrawer
              booking={booking}
              onClose={() => setPrescOpen(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>

    </div>
  );
}

// Placeholder when doctor hasn't joined
function DoctorPlaceholder({ isDoctorPresent }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4
                    bg-gradient-to-br from-base-200 to-base-300">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20
                        flex items-center justify-center">
          <span className="text-primary text-2xl font-bold">Dr</span>
        </div>
        {!isDoctorPresent && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full
                          bg-warning border-2 border-base-100
                          flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-warning-content animate-ping" />
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-base-content/70 font-medium text-sm">
          {isDoctorPresent ? 'Doctor is in the room' : 'Waiting for doctor to start video…'}
        </p>
        {!isDoctorPresent && (
          <p className="text-base-content/40 text-xs mt-1">Audio may be active</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — wraps with MeetingProvider
// ─────────────────────────────────────────────────────────────────────────────

export default function LiveConsultationRoom(props) {
  const { joinDetails } = props;
  const [Provider, setProvider] = useState(null);
  const { _callbacks } = useMeetingContext?.() ?? {};

  // Lazy load MeetingProvider
  useEffect(() => {
    import('@videosdk.live/react-sdk').then((mod) => {
      setProvider(() => mod.MeetingProvider);
    }).catch(() => {
      console.error('[LiveConsultationRoom] Failed to load VideoSDK MeetingProvider');
    });
  }, []);

  if (!Provider || !joinDetails?.token || !joinDetails?.roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-primary animate-spin" />
          <p className="text-sm text-base-content/50">Loading meeting room…</p>
        </div>
      </div>
    );
  }

  return (
    <Provider
      config={{
        meetingId:   joinDetails.roomId,
        micEnabled:  true,
        webcamEnabled: true,
        name:        'Patient',
        token:       joinDetails.token,
        mode:        'CONFERENCE',
      }}
      token={joinDetails.token}
      onMeetingJoined={_callbacks?.onMeetingJoined}
      onMeetingLeft={_callbacks?.onMeetingLeft}
      onParticipantJoined={_callbacks?.onParticipantJoined}
      onParticipantLeft={_callbacks?.onParticipantLeft}
      onError={_callbacks?.onError}
    >
      <RoomInner {...props} />
    </Provider>
  );
}

// Need useMemo in RoomInner
const { useMemo } = React;