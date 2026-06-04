'use client';

import React, {
  useState, useRef, useEffect, useCallback, useMemo, memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgora } from '@/context/AgoraProvider';
import { useConsultation } from '@/context/ConsultationProvider';
import VideoTile from './VideoTile';
import ControlBar from './ControlBar';
import ChatPanel from './ChatPanel';
import ClinicalPanel from './ClinicalPanel';
import { ParticipantsPanel, SettingsPanel } from './Panels';
import WaitingRoom from './WaitingRoom';
import { useSelector } from 'react-redux';
import { selectChatMessages } from '@/store/slices/consultationSlice';

// ── Session end screen ────────────────────────────────────────────────────────

const SessionEndScreen = memo(({ userRole, consultationId }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-100/95 backdrop-blur-md p-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-base-100 border border-base-300 shadow-2xl rounded-2xl p-8 sm:p-12 max-w-sm w-full text-center"
    >
      <div className="w-16 h-16 rounded-full bg-success/15 text-success text-3xl flex items-center justify-center mx-auto mb-5 font-black shadow-inner">
        ✓
      </div>
      <h2 className="font-montserrat text-2xl font-bold text-base-content mb-2 tracking-tight">
        Session Ended
      </h2>
      <p className="text-sm text-base-content/60 font-poppins mb-8">
        {userRole === 'doctor'
          ? 'The consultation has been completed.'
          : 'Thank you. Your consultation is complete.'}
      </p>
      <div className="flex flex-col gap-3">
        {userRole === 'patient' && (
          <a href={`/consultation/${consultationId}/rating`} className="btn btn-primary">
            Rate your Experience
          </a>
        )}
        <a href={userRole === 'doctor' ? '/doctor/appointments' : '/appointments'} className="btn btn-ghost">
          Back to Appointments
        </a>
      </div>
    </motion.div>
  </div>
));
SessionEndScreen.displayName = 'SessionEndScreen';

// ── Reconnect overlay ─────────────────────────────────────────────────────────

const ReconnectOverlay = memo(() => (
  <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="alert">
    <div className="bg-base-100 border border-base-300 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3">
      <span className="loading loading-spinner loading-md text-warning" />
      <p className="text-sm font-bold font-montserrat text-base-content uppercase tracking-wide">
        Reconnecting…
      </p>
    </div>
  </div>
));
ReconnectOverlay.displayName = 'ReconnectOverlay';

// ── Draggable PIP ─────────────────────────────────────────────────────────────

const PIPVideo = memo(({ children }) => {
  const ref      = useRef(null);
  const dragging = useRef(false);
  const origin   = useRef({});

  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    const rect = ref.current.getBoundingClientRect();
    origin.current = { px: e.clientX, py: e.clientY, left: rect.left, top: rect.top };
    ref.current.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - origin.current.px;
    const dy = e.clientY - origin.current.py;
    ref.current.style.left   = `${origin.current.left + dx}px`;
    ref.current.style.top    = `${origin.current.top  + dy}px`;
    ref.current.style.right  = 'auto';
    ref.current.style.bottom = 'auto';
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  return (
    <div
      ref={ref}
      className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-32 h-48 sm:w-44 sm:h-60 z-30 cursor-move rounded-xl overflow-hidden shadow-2xl border-2 border-primary/40 hover:border-primary transition-colors touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
    </div>
  );
});
PIPVideo.displayName = 'PIPVideo';

// ── Camera strip tile (bottom bar in screen-share mode) ───────────────────────

const CameraStripTile = memo(({
  track, audioTrack, isLocal, isAudioEnabled, isVideoEnabled,
  userName, userRole, networkQuality, isSharingScreen,
}) => (
  <div className="relative shrink-0 w-40 h-28 sm:w-48 sm:h-36 rounded-xl overflow-hidden border-2 border-base-300/50 hover:border-primary/60 transition-colors bg-neutral shadow-lg">
    <VideoTile
      track={track}
      audioTrack={audioTrack}
      isLocal={isLocal}
      isAudioEnabled={isAudioEnabled}
      isVideoEnabled={isVideoEnabled}
      userName={userName}
      userRole={userRole}
      networkQuality={networkQuality}
      isSharingScreen={isLocal && isSharingScreen}
      isScreenShare={false}
      className="rounded-none border-none min-h-0"
    />
  </div>
));
CameraStripTile.displayName = 'CameraStripTile';

// ── Main Room ─────────────────────────────────────────────────────────────────

const ConsultationRoom = memo(({ isDoctor = false }) => {
  const {
    consultationId, consultation, status,
    myTokens, userRole, userId,
    handleJoin, handleStart,
  } = useConsultation();

  const {
    localVideoTrack, localAudioTrack,
    screenVideoTrack,
    remoteUsers,
    isJoined, isMicOn, isCamOn,
    isSharingScreen, networkQuality, connectionState,
    joinChannel, isConnecting, error,
  } = useAgora();

  const chatMessages = useSelector(selectChatMessages);

  const [showChat,         setShowChat]         = useState(false);
  const [showClinical,     setShowClinical]     = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings,     setShowSettings]     = useState(false);
  const [sessionReady,     setSessionReady]     = useState(false);
  const [lastReadCount,    setLastReadCount]    = useState(0);

  const unreadMessages = showChat ? 0 : chatMessages.length - lastReadCount;
  useEffect(() => {
    if (showChat) setLastReadCount(chatMessages.length);
  }, [showChat, chatMessages.length]);

  // Auto-join when tokens available + ready
  useEffect(() => {
    if (!myTokens || isJoined || isConnecting || !sessionReady) return;
    if (!myTokens.rtcToken || !myTokens.uid) return;
    joinChannel(
      {
        appId:       myTokens.appId,
        channelName: myTokens.channelName,
        uid:         myTokens.uid,
        rtcToken:    myTokens.rtcToken,
      },
      {
        name: consultation?.patientSnapshot?.name ?? consultation?.doctorSnapshot?.name ?? '',
        role: userRole,
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTokens, isJoined, isConnecting, sessionReady]);

  useEffect(() => {
    if (!isJoined || !isDoctor || status === 'in_progress') return;
    handleStart();
  }, [isJoined, isDoctor, status, handleStart]);

  const onWaitingRoomReady = useCallback(() => setSessionReady(true), []);

  const sessionEnded = [
    'completed', 'cancelled', 'missed',
    'no_show_patient', 'no_show_doctor', 'technical_failure',
  ].includes(status);

  const closeSidebar = useCallback(() => {
    setShowChat(false);
    setShowClinical(false);
    setShowParticipants(false);
    setShowSettings(false);
  }, []);

  const activeSidebar = showClinical     ? 'clinical'
    : showChat         ? 'chat'
    : showParticipants ? 'participants'
    : showSettings     ? 'settings'
    : null;

  const remoteScreens  = useMemo(() => remoteUsers.filter(u => u.isScreenShare),  [remoteUsers]);
  const remoteCameras  = useMemo(() => remoteUsers.filter(u => !u.isScreenShare), [remoteUsers]);

  const anyScreenShare = isSharingScreen || remoteScreens.length > 0;
  const pinnedScreenUser = remoteScreens[0] ?? null;
  const showLocalScreen  = isSharingScreen && !pinnedScreenUser;

  // ── MAP AGORA UIDS TO DB CONTEXT ──────────────────────────────────────────────
  // This completely solves the "user1234" issue by tying Agora streams to DB records.
  const resolveParticipantDetails = useCallback((uid, fallbackName) => {
    if (!consultation) return { name: fallbackName || 'Participant', role: '' };

    // Doctor Match
    if (uid === consultation?.agora?.doctorUid) {
      return {
        name: consultation.doctorSnapshot?.name || 'Doctor',
        role: consultation.doctorSnapshot?.specialization || 'Doctor'
      };
    }
    // Patient Match
    if (uid === consultation?.agora?.patientUid) {
      return {
        name: consultation.patientSnapshot?.name || 'Patient',
        role: 'Patient'
      };
    }

    // Generic fallback if not matched
    const nameStr = fallbackName && !fallbackName.startsWith('user') ? fallbackName : 'Participant';
    return { name: nameStr, role: '' };
  }, [consultation]);


  if (sessionEnded) {
    return <SessionEndScreen userRole={userRole} consultationId={consultationId} />;
  }

  const shouldShowWaiting = !sessionReady || (!isJoined && !isConnecting);

  return (
    <div className="relative flex flex-col w-full h-screen h-[100dvh] bg-neutral overflow-hidden font-poppins">

      {/* Waiting room overlay */}
      <AnimatePresence>
        {shouldShowWaiting && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-base-100"
          >
            <WaitingRoom onReady={onWaitingRoomReady} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 relative flex overflow-hidden min-h-0">
        <div className="flex-1 relative flex flex-col overflow-hidden">

          {/* ── SCREEN-SHARE MODE ── */}
          {anyScreenShare ? (
            <>
              <div className="flex-1 relative overflow-hidden bg-black">
                {pinnedScreenUser ? (
                  <VideoTile
                    track={pinnedScreenUser.videoTrack}
                    audioTrack={pinnedScreenUser.audioTrack}
                    isLocal={false}
                    isAudioEnabled
                    isVideoEnabled={!!pinnedScreenUser.videoTrack}
                    // Resolve Real Name + Details
                    userName={resolveParticipantDetails(pinnedScreenUser.uid, pinnedScreenUser.userName).name}
                    userRole={resolveParticipantDetails(pinnedScreenUser.uid).role}
                    networkQuality={0}
                    isScreenShare={true}
                    isMain={true}
                    className="w-full h-full rounded-none border-none"
                  />
                ) : showLocalScreen && screenVideoTrack ? (
                  <VideoTile
                    track={screenVideoTrack}
                    audioTrack={null}
                    isLocal={true}
                    isAudioEnabled={false}
                    isVideoEnabled={true}
                    userName="You"
                    userRole={userRole}
                    networkQuality={networkQuality}
                    isSharingScreen={false}
                    isScreenShare={true}
                    isMain={true}
                    className="w-full h-full rounded-none border-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 text-white">
                    <span className="loading loading-spinner loading-lg text-white/40 mb-4" />
                    <p className="text-sm text-white/60">Starting screen share…</p>
                  </div>
                )}

                <AnimatePresence>
                  {connectionState === 'RECONNECTING' && (
                    <motion.div key="recon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <ReconnectOverlay />
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-error text-error-content px-4 py-2 rounded-lg text-sm font-semibold shadow-lg" role="alert">
                    {error}
                  </div>
                )}

                {isJoined && (
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-white">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Live
                  </div>
                )}

                {showLocalScreen && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-accent/90 text-accent-content px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">
                    🖥️ You are presenting your screen
                  </div>
                )}
              </div>

              {/* ── Google Meet style camera strip ── */}
              <div className="h-36 sm:h-40 bg-black/80 border-t border-white/10 flex items-center gap-3 px-4 overflow-x-auto shrink-0 scrollbar-thin">
                <CameraStripTile
                  track={localVideoTrack}
                  isLocal={true}
                  isAudioEnabled={isMicOn}
                  isVideoEnabled={isCamOn}
                  userName="You"
                  userRole={userRole}
                  networkQuality={networkQuality}
                  isSharingScreen={isSharingScreen}
                />
                {remoteCameras.map(u => {
                  const details = resolveParticipantDetails(u.uid, u.userName);
                  return (
                    <CameraStripTile
                      key={u.uid}
                      track={u.videoTrack}
                      audioTrack={u.audioTrack}
                      isLocal={false}
                      isAudioEnabled={!!u.audioTrack}
                      isVideoEnabled={!!u.videoTrack}
                      userName={details.name}
                      userRole={details.role}
                      networkQuality={0}
                      isSharingScreen={false}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            /* ── NORMAL MODE ── */
            <div className="flex-1 relative">
              {remoteCameras.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-neutral gap-4">
                  <div className="w-20 h-20 rounded-full bg-base-300 flex items-center justify-center">
                    <span className="text-3xl">👤</span>
                  </div>
                  <p className="text-base-content/60 text-sm font-medium">
                    {isDoctor ? 'Waiting for patient to join…' : 'Waiting for doctor to join…'}
                  </p>
                  {isJoined && (
                    <div className="flex items-center gap-2 bg-success/10 text-success px-3 py-1.5 rounded-full text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      You are connected
                    </div>
                  )}
                </div>
              ) : remoteCameras.length === 1 ? (
                <>
                  <VideoTile
                    track={remoteCameras[0].videoTrack}
                    audioTrack={remoteCameras[0].audioTrack}
                    isLocal={false}
                    isAudioEnabled={!!remoteCameras[0].audioTrack}
                    isVideoEnabled={!!remoteCameras[0].videoTrack}
                    userName={resolveParticipantDetails(remoteCameras[0].uid, remoteCameras[0].userName).name}
                    userRole={resolveParticipantDetails(remoteCameras[0].uid).role}
                    networkQuality={0}
                    isScreenShare={false}
                    isMain={true}
                    className="w-full h-full rounded-none border-none"
                  />
                  {isJoined && (
                    <PIPVideo>
                      <VideoTile
                        track={localVideoTrack}
                        isLocal={true}
                        isAudioEnabled={isMicOn}
                        isVideoEnabled={isCamOn}
                        userName="You"
                        userRole={userRole}
                        networkQuality={networkQuality}
                        isSharingScreen={false}
                        isScreenShare={false}
                        className="rounded-none border-none min-h-0"
                      />
                    </PIPVideo>
                  )}
                </>
              ) : (
                /* Multi-party grid */
                <div
                  className="w-full h-full grid gap-2 p-2"
                  style={{
                    gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(remoteCameras.length + 1))}, 1fr)`,
                    gridTemplateRows:    `repeat(${Math.ceil((remoteCameras.length + 1) / Math.ceil(Math.sqrt(remoteCameras.length + 1)))}, 1fr)`,
                  }}
                >
                  {isJoined && (
                    <VideoTile
                      track={localVideoTrack}
                      isLocal={true}
                      isAudioEnabled={isMicOn}
                      isVideoEnabled={isCamOn}
                      userName="You"
                      userRole={userRole}
                      networkQuality={networkQuality}
                      isSharingScreen={false}
                      isScreenShare={false}
                      className="w-full h-full"
                    />
                  )}
                  {remoteCameras.map(u => {
                    const details = resolveParticipantDetails(u.uid, u.userName);
                    return (
                      <VideoTile
                        key={u.uid}
                        track={u.videoTrack}
                        audioTrack={u.audioTrack}
                        isLocal={false}
                        isAudioEnabled={!!u.audioTrack}
                        isVideoEnabled={!!u.videoTrack}
                        userName={details.name}
                        userRole={details.role}
                        networkQuality={0}
                        isScreenShare={false}
                        className="w-full h-full"
                      />
                    );
                  })}
                </div>
              )}

              {/* Overlays */}
              <AnimatePresence>
                {connectionState === 'RECONNECTING' && (
                  <motion.div key="recon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ReconnectOverlay />
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-error text-error-content px-4 py-2 rounded-lg text-sm font-semibold shadow-lg" role="alert">
                  {error}
                </div>
              )}

              {isJoined && (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-white">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Live
                </div>
              )}
              {isConnecting && (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-white">
                  <span className="loading loading-xs loading-spinner" /> Connecting…
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SIDEBARS ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeSidebar === 'chat' && (
            <motion.aside
              key="chat"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 h-full z-40 shadow-2xl"
            >
              <ChatPanel onClose={closeSidebar} />
            </motion.aside>
          )}

          {activeSidebar === 'clinical' && (isDoctor || ['admin', 'superadmin'].includes(userRole)) && (
            <motion.aside
              key="clinical"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 h-full z-40 shadow-2xl"
            >
              <ClinicalPanel onClose={closeSidebar} />
            </motion.aside>
          )}

          {activeSidebar === 'participants' && (
            <motion.aside
              key="participants"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 h-full z-40 shadow-2xl"
            >
              <ParticipantsPanel onClose={closeSidebar} />
            </motion.aside>
          )}

          {activeSidebar === 'settings' && (
            <motion.aside
              key="settings"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 h-full z-40 shadow-2xl"
            >
              <SettingsPanel onClose={closeSidebar} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <ControlBar
        onToggleChat={() => { const n = !showChat; closeSidebar(); setShowChat(n); }}
        onToggleClinical={() => { const n = !showClinical; closeSidebar(); setShowClinical(n); }}
        onToggleParticipants={() => { const n = !showParticipants; closeSidebar(); setShowParticipants(n); }}
        onToggleSettings={() => { const n = !showSettings; closeSidebar(); setShowSettings(n); }}
        unreadMessages={unreadMessages}
        isChatOpen={showChat}
        isClinicalOpen={showClinical}
        isParticipantsOpen={showParticipants}
        isSettingsOpen={showSettings}
        isDoctor={isDoctor}
      />
    </div>
  );
});
ConsultationRoom.displayName = 'ConsultationRoom';

export default ConsultationRoom;