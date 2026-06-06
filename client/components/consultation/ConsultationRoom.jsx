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
import toast from 'react-hot-toast';
import {
  selectChatMessages,
  selectTimer,
  selectMutedParticipants,
  selectKickedParticipants,
} from '@/store/slices/consultationSlice';
import { socketGetTimer } from '@/services/consultationSocketService';

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
        <a
          href={userRole === 'doctor' ? '/doctor/appointments' : '/appointments'}
          className="btn btn-ghost"
        >
          Back to Appointments
        </a>
      </div>
    </motion.div>
  </div>
));
SessionEndScreen.displayName = 'SessionEndScreen';

// ── Reconnect overlay ─────────────────────────────────────────────────────────

const ReconnectOverlay = memo(() => (
  <div
    className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    role="alert"
  >
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

// ── Session Timer Overlay ─────────────────────────────────────────────────────

const SessionTimerOverlay = memo(({ consultation, isJoined }) => {
  const reduxTimer = useSelector(selectTimer);
  const [remainingSec, setRemainingSec] = useState(null);

  useEffect(() => {
    const compute = () => {
      if (reduxTimer?.remainingSec != null) return reduxTimer.remainingSec;
      const deadline =
        consultation?.timerState?.hardDeadlineAt ?? reduxTimer?.hardDeadlineAt;
      if (deadline) {
        const sec = Math.floor((new Date(deadline) - Date.now()) / 1000);
        return Math.max(0, sec);
      }
      return null;
    };

    setRemainingSec(compute());

    const id = setInterval(() => {
      setRemainingSec(prev => {
        if (reduxTimer?.remainingSec != null) return reduxTimer.remainingSec;
        if (prev === null || prev <= 0) return prev;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [reduxTimer, consultation]);

  useEffect(() => {
    if (reduxTimer?.remainingSec != null) setRemainingSec(reduxTimer.remainingSec);
  }, [reduxTimer?.remainingSec]);

  const autoEnded = reduxTimer?.autoEnded ?? false;
  if (!isJoined || remainingSec === null || autoEnded) return null;

  const mins = Math.floor(remainingSec / 60);
  const secs = String(remainingSec % 60).padStart(2, '0');
  const isUrgent  = remainingSec <= 60;
  const isWarning = remainingSec <= 300 && remainingSec > 60;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <motion.div
        key={isUrgent ? 'urgent' : isWarning ? 'warn' : 'normal'}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-sm shadow-lg border backdrop-blur-sm
          ${isUrgent
            ? 'bg-error text-error-content border-error/60 shadow-error/30 animate-pulse'
            : isWarning
            ? 'bg-warning/90 text-warning-content border-warning/50 shadow-warning/20'
            : 'bg-black/65 text-white border-white/10'
          }`}
      >
        <span>⏱</span>
        <span>{mins}:{secs}</span>
        {isUrgent  && <span className="text-[0.65rem] font-bold animate-bounce">· Ending now!</span>}
        {isWarning && <span className="text-[0.65rem] font-semibold animate-pulse">· Ending soon</span>}
      </motion.div>
    </div>
  );
});
SessionTimerOverlay.displayName = 'SessionTimerOverlay';

// ── Waiting for other participant — full-screen overlay ───────────────────────
// Shows local video as full background, elegant waiting card on top

const WaitingForParticipant = memo(({
  localVideoTrack, isCamOn, isMicOn, networkQuality,
  userRole, isDoctor, consultation, isJoined, isConnecting,
}) => {
  const otherRole   = isDoctor ? 'patient' : 'doctor';
  const otherName   = isDoctor
    ? (consultation?.patientSnapshot?.name ?? 'your patient')
    : (consultation?.doctorSnapshot?.name  ?? 'your doctor');
  const otherTitle  = isDoctor ? 'Patient' : 'Dr. ' + (consultation?.doctorSnapshot?.name ?? '');
  const scheduledAt = consultation?.scheduledAt
    ? new Date(consultation.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null;

  // Animated dots
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => setDots(p => p.length >= 3 ? '' : p + '.'), 600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-neutral">

      {/* ── Local video — full blurred background ── */}
      {isJoined && localVideoTrack && isCamOn ? (
        <div className="absolute inset-0">
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
            className="w-full h-full rounded-none border-none"
            hideOverlay={true}
          />
          {/* Dark gradient overlay so card is readable */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>
      ) : (
        /* No camera — dark mesh background */
        <div className="absolute inset-0 bg-neutral">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, var(--p) 0%, transparent 50%),
                                radial-gradient(circle at 80% 20%, var(--s) 0%, transparent 40%),
                                radial-gradient(circle at 60% 80%, var(--a) 0%, transparent 40%)`,
            }}
          />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `linear-gradient(var(--bc) 1px, transparent 1px),
                                linear-gradient(90deg, var(--bc) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>
      )}

      {/* ── Center card ── */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="pointer-events-auto flex flex-col items-center text-center max-w-xs w-full"
        >
          {/* Avatar ring with pulse */}
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
              <span className="text-3xl">
                {isDoctor ? '🧑‍⚕️' : '👤'}
              </span>
            </div>
            {/* Animated ring */}
            <span className="absolute inset-0 rounded-full border-2 border-primary/50 animate-ping" />
            <span className="absolute inset-0 rounded-full border border-primary/30 scale-110 animate-pulse" />
          </div>

          {/* Status text */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-5 shadow-2xl w-full">
            <p className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] mb-2 font-montserrat">
              {isConnecting ? 'Connecting' : 'Waiting for'}
            </p>
            <p className="text-white font-montserrat font-bold text-lg leading-tight mb-1 truncate">
              {isDoctor
                ? (consultation?.patientSnapshot?.name ?? 'Patient')
                : (consultation?.doctorSnapshot?.name
                    ? `Dr. ${consultation.doctorSnapshot.name}`
                    : 'Doctor')
              }
            </p>
            <p className="text-white/50 text-xs font-poppins capitalize mb-4">
              {isDoctor
                ? 'to join the session'
                : (consultation?.doctorSnapshot?.specialization ?? 'to start the session')
              }
            </p>

            {/* Waiting indicator */}
            <div className="flex items-center justify-center gap-2">
              <span className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </span>
              <span className="text-white/40 text-xs font-poppins">
                {isConnecting ? 'Connecting to session' : 'Awaiting connection'}
              </span>
            </div>

            {/* Scheduled time badge */}
            {scheduledAt && (
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-center gap-1.5 text-white/40 text-xs font-poppins">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
                </svg>
                Scheduled at {scheduledAt}
              </div>
            )}
          </div>

          {/* Connected badge */}
          {isJoined && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 flex items-center gap-2 bg-success/20 text-success border border-success/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              You are connected
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* ── Self preview — bottom-left corner when cam is on ── */}
      {isJoined && localVideoTrack && isCamOn && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute bottom-4 left-4 w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl z-10"
        >
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
            className="rounded-none border-none"
            hideOverlay={false}
          />
        </motion.div>
      )}
    </div>
  );
});
WaitingForParticipant.displayName = 'WaitingForParticipant';

// ── Main Room ─────────────────────────────────────────────────────────────────

const ConsultationRoom = memo(({ isDoctor = false }) => {
  const {
    consultationId, consultation, status,
    myTokens, userRole, userId,
    handleJoin, handleStart, handleLeave,
  } = useConsultation();

  const {
    localVideoTrack, localAudioTrack,
    screenVideoTrack,
    remoteUsers,
    isJoined, isMicOn, isCamOn,
    isSharingScreen, networkQuality, connectionState,
    joinChannel, isConnecting, error,
    uidNameMap,
  } = useAgora();
const [joinPrefs, setJoinPrefs] = useState(null);
  const chatMessages       = useSelector(selectChatMessages);
  const mutedParticipants  = useSelector(selectMutedParticipants);
  const kickedParticipants = useSelector(selectKickedParticipants);

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

  useEffect(() => {
    if (isJoined && consultationId) socketGetTimer(consultationId);
  }, [isJoined, consultationId]);

  useEffect(() => {
    if (!userId || kickedParticipants.length === 0) return;
    if (kickedParticipants.includes(userId)) {
      toast?.error?.('You have been removed from the session by the doctor.');
      handleLeave();
    }
  }, [kickedParticipants, userId, handleLeave]);

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
  },
  joinPrefs ?? {}  // ← add this arg
);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTokens, isJoined, isConnecting, sessionReady]);

  useEffect(() => {
    if (!isJoined || !isDoctor || status === 'in_progress') return;
    handleStart();
  }, [isJoined, isDoctor, status, handleStart]);

  const onWaitingRoomReady = useCallback((prefs) => {
  setJoinPrefs(prefs);
  setSessionReady(true);
}, []);

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

  const anyScreenShare   = isSharingScreen || remoteScreens.length > 0;
  const pinnedScreenUser = remoteScreens[0] ?? null;
  const showLocalScreen  = isSharingScreen && !pinnedScreenUser;

  const resolveParticipantDetails = useCallback((uid, fallbackName) => {
    if (uidNameMap && uidNameMap[uid]) {
      const meta = uidNameMap[uid];
      const name = meta.name && !['You', 'you'].includes(meta.name) ? meta.name : null;
      if (name) return { name, role: meta.role || '' };
    }
    if (!consultation) return { name: fallbackName || 'Participant', role: '' };
    if (uid === consultation?.agora?.doctorUid) {
      return {
        name: consultation.doctorSnapshot?.name || 'Doctor',
        role: consultation.doctorSnapshot?.specialization || 'Doctor',
      };
    }
    if (uid === consultation?.agora?.patientUid) {
      return { name: consultation.patientSnapshot?.name || 'Patient', role: 'Patient' };
    }
    const isGenericUid = !fallbackName || /^[Uu]ser[-_]?\d+$/.test(String(fallbackName));
    if (isGenericUid) {
      const cams = remoteUsers.filter(u => !u.isScreenShare);
      if (cams.length === 1 && cams[0].uid === uid) {
        const isDoc = consultation?.agora?.doctorUid
          ? cams[0].uid === consultation.agora.doctorUid
          : userRole === 'patient';
        if (isDoc) {
          return {
            name: consultation.doctorSnapshot?.name || 'Doctor',
            role: consultation.doctorSnapshot?.specialization || 'Doctor',
          };
        }
        return { name: consultation.patientSnapshot?.name || 'Patient', role: 'Patient' };
      }
      return { name: 'Participant', role: '' };
    }
    return { name: fallbackName, role: '' };
  }, [consultation, uidNameMap, remoteUsers, userRole]);

  if (sessionEnded) {
    return <SessionEndScreen userRole={userRole} consultationId={consultationId} />;
  }

  const shouldShowWaiting = !sessionReady || (!isJoined && !isConnecting);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-neutral overflow-hidden font-poppins">

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

      <div className="flex-1 relative flex overflow-hidden min-h-0 h-full">
        <div className="flex-1 relative flex flex-col overflow-hidden min-h-0 min-w-0 h-full">

          {/* ── SCREEN-SHARE MODE ── */}
          {anyScreenShare ? (
            <div className="flex-1 flex flex-col-reverse sm:flex-row overflow-hidden min-h-0 h-full w-full">

              {/* Screen area */}
              <div className="flex-1 relative overflow-hidden bg-black min-w-0 min-h-0 h-full">
                {pinnedScreenUser ? (
                  <VideoTile
                    track={pinnedScreenUser.videoTrack}
                    audioTrack={pinnedScreenUser.audioTrack}
                    isLocal={false}
                    isAudioEnabled
                    isVideoEnabled={!!pinnedScreenUser.videoTrack}
                    userName={resolveParticipantDetails(pinnedScreenUser.uid, pinnedScreenUser.userName).name}
                    userRole={resolveParticipantDetails(pinnedScreenUser.uid, pinnedScreenUser.userName).role}
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
                    🖥️ You are presenting
                  </div>
                )}
                <SessionTimerOverlay consultation={consultation} isJoined={isJoined} />
              </div>

              {/* Camera strip */}
              <div className="
                flex flex-row sm:flex-col
                h-28 sm:h-auto
                w-full sm:w-[30%] sm:max-w-xs
                shrink-0 gap-2 p-2
                bg-black/80
                border-b sm:border-b-0 sm:border-l border-white/10
                overflow-x-auto sm:overflow-x-hidden
                overflow-y-hidden sm:overflow-y-auto
                scrollbar-thin
              ">
                {isJoined && (
                  <div className="relative h-full sm:h-auto w-auto sm:w-full aspect-video rounded-xl overflow-hidden border border-white/10 shrink-0">
                    <VideoTile
                      track={localVideoTrack}
                      isLocal={true}
                      isAudioEnabled={isMicOn}
                      isVideoEnabled={isCamOn}
                      userName="You"
                      userRole={userRole}
                      networkQuality={networkQuality}
                      isSharingScreen={isSharingScreen}
                      isScreenShare={false}
                      className="rounded-none border-none"
                    />
                  </div>
                )}
                {remoteCameras
                  .filter(u => pinnedScreenUser ? u.uid !== pinnedScreenUser.uid : true)
                  .map(u => {
                    const details = resolveParticipantDetails(u.uid, u.userName);
                    return (
                      <div
                        key={u.uid}
                        className="relative h-full sm:h-auto w-auto sm:w-full aspect-video rounded-xl overflow-hidden border border-white/10 shrink-0"
                      >
                        <VideoTile
                          track={u.videoTrack}
                          audioTrack={u.audioTrack}
                          isLocal={false}
                          isAudioEnabled={!!u.audioTrack}
                          isVideoEnabled={!!u.videoTrack}
                          userName={details.name}
                          userRole={details.role}
                          networkQuality={0}
                          isScreenShare={false}
                          className="rounded-none border-none"
                        />
                      </div>
                    );
                  })
                }
              </div>
            </div>

          ) : (
            /* ── NORMAL MODE ── */
            <div className="flex-1 relative overflow-hidden">
              {remoteCameras.length === 0 ? (
                /* ── No remote user yet: local video full-bg + waiting overlay ── */
                <WaitingForParticipant
                  localVideoTrack={localVideoTrack}
                  isCamOn={isCamOn}
                  isMicOn={isMicOn}
                  networkQuality={networkQuality}
                  userRole={userRole}
                  isDoctor={isDoctor}
                  consultation={consultation}
                  isJoined={isJoined}
                  isConnecting={isConnecting}
                />
              ) : remoteCameras.length === 1 ? (
                /* ── 1-on-1: remote full-screen + local PIP ── */
                <>
                  <VideoTile
                    track={remoteCameras[0].videoTrack}
                    audioTrack={remoteCameras[0].audioTrack}
                    isLocal={false}
                    isAudioEnabled={!!remoteCameras[0].audioTrack}
                    isVideoEnabled={!!remoteCameras[0].videoTrack}
                    userName={resolveParticipantDetails(remoteCameras[0].uid, remoteCameras[0].userName).name}
                    userRole={resolveParticipantDetails(remoteCameras[0].uid, remoteCameras[0].userName).role}
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
                /* ── Multi-party grid ── */
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

              {/* Live / Connecting badge — only when remote user present */}
              {remoteCameras.length > 0 && (
                <>
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
                </>
              )}

              <SessionTimerOverlay consultation={consultation} isJoined={isJoined} />
            </div>
          )}
        </div>

        {/* ── SIDEBARS ── */}
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

      {/* ControlBar — hidden during waiting room */}
      {!shouldShowWaiting && (
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
      )}
    </div>
  );
});
ConsultationRoom.displayName = 'ConsultationRoom';

export default ConsultationRoom;