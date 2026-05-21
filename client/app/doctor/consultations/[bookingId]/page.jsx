'use client';
/**
 * DoctorOnlineConsultation.jsx
 * Likeson.in — Production telemedicine room for doctors.
 *
 * Doctor-only. Validates role, booking type, payment status.
 * Prevents: double-join, duplicate participants, stream leaks,
 *           stale listeners, rerender storms.
 */

import React, {
  useEffect, useCallback, useRef, useState, useMemo, memo, lazy, Suspense,
} from 'react';
import { useParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { MeetingProvider } from '@videosdk.live/react-sdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Loader2, WifiOff, AlertTriangle, Clock,
  Play, Users, Activity,
} from 'lucide-react';

// Redux
import {
  fetchJoinDetails,
  fetchConsultationById,
  startConsultation,
  endConsultation,
  selectJoinDetails,
  selectCurrentConsultation,
  selectConsultationLoaders,
  selectConsultationErrors,
  clearCurrentConsultation,
  clearJoinDetails,
} from '@/store/slices/consultationSlice'; // adjust to actual path

// Socket
import { useSocket, useBookingRoom } from '@/context/SocketProvider'; // adjust path

// Hooks
import { useSessionTimer }   from '@/hooks/useSessionTimer';
import { useParticipantMap } from '@/hooks/useParticipantMap';
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor';
import { useMediaDevices }   from '@/hooks/useMediaDevices';
import { useConsultationRoom } from '@/hooks/useConsultationRoom';

// Components
import { ParticipantTile }           from './components/ParticipantTile';
import { MeetingControls }           from './components/MeetingControls';
import { WaitingRoomPanel }          from './components/WaitingRoomPanel';
import { ConsultationChat }          from './components/ConsultationChat';
import { NetworkQualityBadge }       from './components/NetworkQualityBadge';
import { ConsultationSidebar }       from './components/ConsultationSidebar';
import { ConsultationSummaryModal }  from './components/ConsultationSummaryModal';
import { DeviceSettingsModal }       from './components/DeviceSettingsModal';

// Constants
import { CONSULTATION_STATUS, PANEL_TABS, BOOKING_STATUS } from '@/utils/constants';
import { createListenerRegistry } from '@/utils/cleanup';

 

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS GUARD
// ─────────────────────────────────────────────────────────────────────────────

function ForbiddenScreen({ reason }) {
  return (
    <div
      data-theme="doctor"
      className="min-h-screen flex flex-col items-center justify-center bg-base-100 gap-6 p-8"
    >
      <div className="w-20 h-20 rounded-2xl bg-error/10 flex items-center justify-center border border-error/30">
        <Shield size={40} className="text-error" />
      </div>
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-black text-base-content mb-2">Access Denied</h1>
        <p className="text-base-content/60 text-sm">{reason}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────────────────────

function ConsultationSkeleton() {
  return (
    <div data-theme="doctor" className="min-h-screen flex items-center justify-center bg-base-100">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={40} className="text-primary animate-spin" />
        <p className="text-sm text-base-content/50 font-medium">Loading consultation room…</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMER DISPLAY  (memoized — re-renders only on tick, not on parent)
// ─────────────────────────────────────────────────────────────────────────────

const SessionTimerDisplay = memo(function SessionTimerDisplay({
  elapsedFormatted, remainingFormatted, percentUsed, warnedThresholds,
}) {
  const isWarning  = warnedThresholds.has(5) || warnedThresholds.has(1);
  const isCritical = warnedThresholds.has(1);

  return (
    <div className={`
      flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold
      ${isCritical
        ? 'bg-red-500/15 border-red-500/40 text-red-400 animate-pulse'
        : isWarning
          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
          : 'bg-base-200 border-base-300 text-base-content/70'
      }
    `}>
      <Clock size={12} />
      <span>{elapsedFormatted}</span>
      <span className="opacity-40">/</span>
      <span className={isCritical ? 'text-red-400' : 'text-base-content/40'}>
        {remainingFormatted} left
      </span>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTICIPANT GRID  (memoized, uses stable participantList)
// ─────────────────────────────────────────────────────────────────────────────

const ParticipantGrid = memo(function ParticipantGrid({ participantList, localId }) {
  if (participantList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-base-content/30">
        <Users size={48} />
        <p className="text-sm">Waiting for patient to join…</p>
      </div>
    );
  }

  const gridClass = participantList.length === 1
    ? 'grid-cols-1'
    : participantList.length === 2
      ? 'grid-cols-2'
      : participantList.length <= 4
        ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <div className={`grid ${gridClass} gap-3 w-full h-full p-3`}>
      {participantList.map((p) => (
        <ParticipantTile
          key={p.id}                 // stable key — prevents unmount/remount
          participantId={p.id}
          isDoctor={p.id === localId}
          displayName={p.displayName}
        />
      ))}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// INNER ROOM — rendered inside MeetingProvider
// ─────────────────────────────────────────────────────────────────────────────

function ConsultationRoom({ bookingId, booking, joinDetails, currentUser }) {
  const dispatch = useDispatch();

  // UI state
  const [activePanelTab,    setActivePanelTab]    = useState(PANEL_TABS.CHAT);
  const [showPanel,         setShowPanel]          = useState(true);
  const [showSidebar,       setShowSidebar]        = useState(true);
  const [showSummaryModal,  setShowSummaryModal]   = useState(false);
  const [showSettingsModal, setShowSettingsModal]  = useState(false);
  const [noiseSuppression,  setNoiseSuppression]   = useState(false);
  const [waitingPatients,   setWaitingPatients]    = useState([]);
  const [timerWarningMsg,   setTimerWarningMsg]    = useState(null);

  const loaders = useSelector(selectConsultationLoaders);

  // Participant map — zero duplicate
  const {
    participantList,
    participantCount,
    upsertParticipant,
    removeParticipant,
  } = useParticipantMap();

  // Media devices
  const devices = useMediaDevices();

  // Meeting room controls
  const {
    meetingState, meetingError, isCamOn, isMicOn, isSpeakerOn,
    isScreenSharing, isFullscreen, isRecording,
    toggleMic, toggleWebcam, toggleScreenShare, toggleFullscreen,
    startRecording, stopRecording, setIsSpeakerOn,
    startConsultation: handleStartRoom,
    endConsultation: handleEndRoom,
    participants, sdkMeetingId, leave,
  } = useConsultationRoom({
    bookingId,
    joinDetails,
    booking,
    onMeetingEnd: useCallback(() => {
      // Meeting ended remotely — navigate away
      if (typeof window !== 'undefined') {
        window.location.href = `/doctor/dashboard`;
      }
    }, []),
  });

  // Sync participants from SDK to our dedupe Map — prevents duplicate cards
  useEffect(() => {
    if (!participants) return;
    participants.forEach((p, id) => upsertParticipant({ id, displayName: p.displayName }));
  }, [participants, upsertParticipant]);

  const isLive = meetingState === 'live';
  const oc     = booking?.onlineConsultation;

  // Session timer
  const { elapsedFormatted, remainingFormatted, percentUsed, warnedThresholds } = useSessionTimer({
    startedAt:       oc?.startedAt,
    allowedMinutes:  joinDetails?.allowedDurationMinutes ?? 30,
    isLive:          isLive && oc?.consultationStatus === CONSULTATION_STATUS.LIVE,
    onWarning: useCallback((mins) => {
      setTimerWarningMsg(`${mins} minute${mins === 1 ? '' : 's'} remaining in consultation.`);
    }, []),
    onExpire: useCallback(() => {
      setTimerWarningMsg('Session time expired. Please end the consultation.');
    }, []),
  });

  // Network monitor
  const { quality, reconnectCount, isDisconnected } = useNetworkMonitor({
    bookingId,
    isLive,
    participantRole: 'doctor',
  });

  // Socket — booking room listener
  const { on: socketOn, off: socketOff } = useSocket();

  useEffect(() => {
    if (!bookingId) return;

    const reg = createListenerRegistry(socketOn, socketOff);

    reg.add('booking_status_change', (data) => {
      if (data.bookingId !== bookingId) return;
      dispatch(fetchConsultationById(bookingId));
    });

    reg.add('participant_joined', (data) => {
      if (data.bookingId !== bookingId) return;
      if (data.role === 'patient' && oc?.waitingRoomEnabled && !oc?.waitingRoomApproved) {
        setWaitingPatients((prev) => {
          if (prev.some((p) => p.id === data.participantId)) return prev;
          return [...prev, {
            id:       data.participantId,
            name:     data.displayName ?? 'Patient',
            joinedAt: new Date().toISOString(),
          }];
        });
      }
    });

    reg.add('participant_left', (data) => {
      if (data.bookingId !== bookingId) return;
      removeParticipant(data.participantId);
      setWaitingPatients((prev) => prev.filter((p) => p.id !== data.participantId));
    });

    return () => reg.removeAll();
  }, [bookingId, socketOn, socketOff, dispatch, removeParticipant, oc?.waitingRoomEnabled, oc?.waitingRoomApproved]);

  // Waiting room handlers
  const handleApprovePatient = useCallback(async (patientId) => {
    // TODO: emit socket approve event or call API
    setWaitingPatients((prev) => prev.filter((p) => p.id !== patientId));
  }, []);

  const handleRejectPatient = useCallback(async (patientId) => {
    setWaitingPatients((prev) => prev.filter((p) => p.id !== patientId));
  }, []);

  // End consultation flow
  const handleEndConsultationClick = useCallback(() => {
    setShowSummaryModal(true);
  }, []);

  const handleSummarySubmit = useCallback(async (summaryData) => {
    setShowSummaryModal(false);
    await handleEndRoom(summaryData);
  }, [handleEndRoom]);

  // Emergency disconnect — leave VideoSDK immediately without backend end
  const handleEmergencyDisconnect = useCallback(() => {
    leave();
  }, [leave]);

  // Start consultation button (when booking is confirmed, not yet in_progress)
  const showStartButton = booking?.status === BOOKING_STATUS.CONFIRMED
    && oc?.consultationStatus === CONSULTATION_STATUS.CREATED;

  return (
    <div
      data-theme="doctor"
      className="doc-room flex flex-col h-screen bg-base-100 overflow-hidden"
    >
      {/* ── TOP BAR ── */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-base-300 bg-base-200/80 backdrop-blur-xl shrink-0 z-30">
        {/* Left */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-base-content/30'}`} />
            <span className="text-sm font-bold text-base-content">
              {booking?.bookingCode ?? 'Consultation'}
            </span>
          </div>
          {isLive && (
            <SessionTimerDisplay
              elapsedFormatted={elapsedFormatted}
              remainingFormatted={remainingFormatted}
              percentUsed={percentUsed}
              warnedThresholds={warnedThresholds}
            />
          )}
          {isRecording && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-500/15 border border-red-500/30 rounded-full">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-red-400 font-bold uppercase">Rec</span>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <NetworkQualityBadge quality={quality} reconnectCount={reconnectCount} compact />
          <span className="text-xs text-base-content/40 flex items-center gap-1">
            <Users size={12} />
            {participantCount}
          </span>
          <button
            onClick={() => setShowSidebar((v) => !v)}
            className="btn btn-ghost btn-xs hidden lg:flex"
            aria-label="Toggle sidebar"
          >
            Sidebar
          </button>
        </div>
      </header>

      {/* ── MAIN BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR — patient info, notes */}
        <AnimatePresence initial={false}>
          {showSidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="hidden lg:flex flex-col border-r border-base-300 bg-base-100 overflow-hidden shrink-0"
              style={{ width: 280 }}
            >
              <ConsultationSidebar
                booking={booking}
                joinDetails={joinDetails}
                bookingId={bookingId}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* CENTER — VIDEO GRID */}
        <div className="flex-1 flex flex-col bg-neutral/5 overflow-hidden relative">

          {/* Start button overlay */}
          {showStartButton && isLive && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-base-100/80 backdrop-blur-sm">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
                  <Activity size={32} className="text-primary" />
                </div>
                <p className="text-base font-semibold text-base-content">Ready to start?</p>
                <p className="text-sm text-base-content/50">Click to officially begin the consultation</p>
                <button
                  onClick={handleStartRoom}
                  disabled={loaders.isActionLoading}
                  className="btn btn-primary gap-2"
                >
                  {loaders.isActionLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} />
                  )}
                  Start Consultation
                </button>
              </div>
            </div>
          )}

          {/* Meeting state overlays */}
          {meetingState === 'joining' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-base-100">
              <Loader2 size={36} className="text-primary animate-spin" />
              <p className="text-sm text-base-content/60">Joining room…</p>
            </div>
          )}

          {meetingState === 'error' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-base-100 p-8">
              <AlertTriangle size={36} className="text-error" />
              <p className="text-sm font-semibold text-error">{meetingError}</p>
              <button onClick={() => window.location.reload()} className="btn btn-outline btn-sm">
                Retry
              </button>
            </div>
          )}

          {isDisconnected && meetingState === 'live' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-red-500/15 border border-red-500/30 rounded-full text-sm text-red-400">
              <WifiOff size={14} />
              Connection lost — attempting to reconnect…
            </div>
          )}

          {/* Timer warning toast */}
          <AnimatePresence>
            {timerWarningMsg && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-full text-sm text-amber-400 cursor-pointer"
                onClick={() => setTimerWarningMsg(null)}
              >
                <Clock size={14} />
                {timerWarningMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Participant grid */}
          <div className="flex-1 overflow-hidden pb-20">
            <ParticipantGrid
              participantList={participantList}
              localId={currentUser?._id}
            />
          </div>
        </div>

        {/* RIGHT PANEL — chat, participants, waiting room */}
        <AnimatePresence initial={false}>
          {showPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="hidden md:flex flex-col border-l border-base-300 bg-base-100 overflow-hidden shrink-0"
              style={{ width: 300 }}
            >
              {/* Panel tabs */}
              <div className="flex border-b border-base-300 shrink-0">
                {[
                  { id: PANEL_TABS.CHAT,         label: 'Chat' },
                  { id: PANEL_TABS.PARTICIPANTS,  label: `Pts (${participantCount})` },
                  { id: PANEL_TABS.WAITING,       label: `Wait${waitingPatients.length > 0 ? ` (${waitingPatients.length})` : ''}` },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setActivePanelTab(id)}
                    className={`
                      flex-1 px-2 py-2.5 text-xs font-semibold border-b-2 transition-colors
                      ${activePanelTab === id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-base-content/50 hover:text-base-content'
                      }
                    `}
                  >
                    {label}
                    {id === PANEL_TABS.WAITING && waitingPatients.length > 0 && (
                      <span className="ml-1 w-1.5 h-1.5 bg-amber-400 rounded-full inline-block" />
                    )}
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-hidden">
                {activePanelTab === PANEL_TABS.CHAT && (
                  <ConsultationChat doctorName={currentUser?.name} />
                )}
                {activePanelTab === PANEL_TABS.PARTICIPANTS && (
                  <div className="p-3 space-y-2 overflow-y-auto h-full scrollbar-thin">
                    {participantList.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 p-2 bg-base-200 rounded-lg">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {p.displayName?.[0]?.toUpperCase() ?? 'P'}
                        </div>
                        <span className="text-xs font-medium text-base-content truncate flex-1">
                          {p.displayName}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {activePanelTab === PANEL_TABS.WAITING && (
                  <WaitingRoomPanel
                    waitingPatients={waitingPatients}
                    waitingRoomEnabled={oc?.waitingRoomEnabled ?? true}
                    onApprove={handleApprovePatient}
                    onReject={handleRejectPatient}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── FLOATING CONTROLS ── */}
      <MeetingControls
        isMicOn={isMicOn}
        isCamOn={isCamOn}
        isScreenSharing={isScreenSharing}
        isFullscreen={isFullscreen}
        isRecording={isRecording}
        recordingEnabled={oc?.recordingEnabled ?? false}
        showChat={activePanelTab === PANEL_TABS.CHAT && showPanel}
        showParticipants={activePanelTab === PANEL_TABS.PARTICIPANTS && showPanel}
        meetingState={meetingState}
        onToggleMic={toggleMic}
        onToggleCam={toggleWebcam}
        onToggleScreenShare={toggleScreenShare}
        onToggleFullscreen={toggleFullscreen}
        onToggleChat={useCallback(() => {
          setActivePanelTab(PANEL_TABS.CHAT);
          setShowPanel((v) => activePanelTab === PANEL_TABS.CHAT ? !v : true);
        }, [activePanelTab])}
        onToggleParticipants={useCallback(() => {
          setActivePanelTab(PANEL_TABS.PARTICIPANTS);
          setShowPanel((v) => activePanelTab === PANEL_TABS.PARTICIPANTS ? !v : true);
        }, [activePanelTab])}
        onOpenSettings={() => setShowSettingsModal(true)}
        onRaiseHand={useCallback(() => {}, [])}
        onToggleRecording={isRecording ? stopRecording : startRecording}
        onEndConsultation={handleEndConsultationClick}
        onEmergencyDisconnect={handleEmergencyDisconnect}
      />

      {/* ── MODALS ── */}
      <ConsultationSummaryModal
        isOpen={showSummaryModal}
        isLoading={loaders.isActionLoading}
        onClose={() => setShowSummaryModal(false)}
        onSubmit={handleSummarySubmit}
      />

      <DeviceSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        {...devices}
        onCameraChange={devices.setSelectedCamera}
        onMicChange={devices.setSelectedMic}
        onSpeakerChange={devices.setSelectedSpeaker}
        noiseSuppression={noiseSuppression}
        onToggleNoiseSuppression={() => setNoiseSuppression((v) => !v)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT EXPORT — validates access, fetches data, wraps MeetingProvider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {{ bookingId: string }} props.params
 */
export default function DoctorOnlineConsultation( ) {
  const params = useParams(); // 3. Get all route params
  const bookingId = params?.bookingId; // 4. Access your dynamic segment name
  
  const dispatch = useDispatch();

  const joinDetails = useSelector(selectJoinDetails);
  const booking     = useSelector(selectCurrentConsultation);
  const loaders     = useSelector(selectConsultationLoaders);
  const errors      = useSelector(selectConsultationErrors);

  // Current user from auth — inject via your auth selector
  // Example: const currentUser = useSelector(selectCurrentUser);
  const currentUser = null; // TODO: replace with actual auth selector

  const [accessError, setAccessError] = useState(null);
  const fetchedRef = useRef(false);

  // ── Fetch booking + join details once ────────────────────────────────────
  useEffect(() => {
    if (!bookingId || fetchedRef.current) return;
    fetchedRef.current = true;

    const controller = new AbortController();

    (async () => {
      try {
        const [bResult, jResult] = await Promise.all([
          dispatch(fetchConsultationById(bookingId)),
          dispatch(fetchJoinDetails(bookingId)),
        ]);

        // Validate access on resolved data
        const b = bResult.payload;
        if (!b) { setAccessError('Booking not found.'); return; }
        if (b.bookingType !== 'doctor_online') { setAccessError('This booking is not an online consultation.'); return; }
        if (!['confirmed', 'in_progress'].includes(b.status)) { setAccessError(`Booking status "${b.status}" does not allow joining.`); return; }
        if (b.paymentStatus !== 'paid') { setAccessError('Payment not completed for this consultation.'); return; }

      } catch (err) {
        if (!controller.signal.aborted) setAccessError('Failed to load consultation room.');
      }
    })();

    return () => {
      controller.abort();
      dispatch(clearCurrentConsultation());
      dispatch(clearJoinDetails());
    };
  }, [bookingId, dispatch]);

  // ── Loading states ─────────────────────────────────────────────────────────
  if (loaders.isFetchingCurrent || loaders.isFetchingJoin) {
    return <ConsultationSkeleton />;
  }

  // ── Access error ──────────────────────────────────────────────────────────
  if (accessError || errors.joinError || errors.currentError) {
    return <ForbiddenScreen reason={accessError || errors.joinError || errors.currentError} />;
  }

  // ── Join details not ready ────────────────────────────────────────────────
  if (!joinDetails?.token || !joinDetails?.roomId) {
    return <ConsultationSkeleton />;
  }

  // ── Render MeetingProvider → ConsultationRoom ─────────────────────────────
  return (
    <MeetingProvider
      config={{
        meetingId: joinDetails.roomId,
        micEnabled: true,
        webcamEnabled: true,
        name: currentUser?.name ?? 'Doctor',
        mode: 'CONFERENCE',
        multiStream: true,
      }}
      token={joinDetails.token}
      reinitialiseMeetingOnConfigChange={false}
      joinWithoutUserInteraction={false}
    >
      <ConsultationRoom
        bookingId={bookingId}
        booking={booking}
        joinDetails={joinDetails}
        currentUser={currentUser}
      />
    </MeetingProvider>
  );
}