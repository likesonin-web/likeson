'use client';
 

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import consultationSocketService, {
  CONSULTATION_EVENTS as EV,
} from '@/services/consultationSocketService';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const ConsultationContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function ConsultationSocketProvider({
  token,
  consultationId,
  children,
  onConnect,
  onDisconnect,
  onError,
  autoJoin = true,         // auto emit consultation:join after connect
  autoRequestState = true, // auto request state snapshot on (re)connect
}) {
  // ── Connection state ───────────────────────────────────────────────────────
  const [connStatus,     setConnStatus]     = useState('disconnected');
  const [lastError,      setLastError]      = useState(null);

  // ── Consultation state ─────────────────────────────────────────────────────
  const [joined,         setJoined]         = useState(false);
  const [participantRole,setParticipantRole]= useState(null);
  const [consultationStatus, setConsultationStatus] = useState(null);
  const [snapshot,       setSnapshot]       = useState(null);

  // ── Participants ───────────────────────────────────────────────────────────
  const [participants,   setParticipants]   = useState([]);

  // ── Waiting room ───────────────────────────────────────────────────────────
  const [waitingQueue,   setWaitingQueue]   = useState([]);
  const [waitingStatus,  setWaitingStatus]  = useState(null); // patient side

  // ── Media ──────────────────────────────────────────────────────────────────
  const [micEnabled,     setMicEnabled]     = useState(true);
  const [cameraEnabled,  setCameraEnabled]  = useState(true);
  const [screenSharing,  setScreenSharing]  = useState(false);
  const [recording,      setRecording]      = useState(false);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [chatMessages,   setChatMessages]   = useState([]);

  // ── Network ───────────────────────────────────────────────────────────────
  const [callQuality,    setCallQuality]    = useState(null);

  // ── Misc ───────────────────────────────────────────────────────────────────
  const [reactions,      setReactions]      = useState([]);  // ephemeral
  const [handRaises,     setHandRaises]     = useState({});  // { userId: bool }
  const [removed,        setRemoved]        = useState(false);
  const [endRequested,   setEndRequested]   = useState(null);
  const [latencyMs,      setLatencyMs]      = useState(null);
  const pingRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // INIT SOCKET
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      consultationSocketService.destroy();
      setConnStatus('disconnected');
      return;
    }

    setConnStatus('connecting');
    const sock = consultationSocketService.init(token);

    // ── Connection events ────────────────────────────────────────────────────
    const onConn = () => {
      setConnStatus('connected');
      setLastError(null);
      onConnect?.();
      if (autoJoin && consultationId) {
        consultationSocketService.joinConsultation(consultationId);
      }
      if (autoRequestState && consultationId) {
        consultationSocketService.requestState(consultationId);
      }
    };

    const onDisc = (reason) => {
      setConnStatus('disconnected');
      setJoined(false);
      onDisconnect?.(reason);
      if (consultationId) {
        consultationSocketService.signalReconnecting(consultationId);
      }
    };

    const onConnErr = (err) => {
      setLastError(err.message);
      setConnStatus('error');
      onError?.(err);
    };

    sock.on('connect',       onConn);
    sock.on('disconnect',    onDisc);
    sock.on('connect_error', onConnErr);
    sock.on('error',         onConnErr);

    // ── Consultation events ──────────────────────────────────────────────────

    const handlers = [
      // Joined
      sock.on(EV.JOINED, (d) => {
        if (d.consultationId !== consultationId) return;
        setJoined(true);
        setParticipantRole(d.participantRole);
      }),

      // Participant joined/left
      sock.on(EV.PARTICIPANT_JOINED, (d) => {
        if (d.consultationId !== consultationId) return;
        setParticipants((prev) => {
          const exists = prev.find((p) => p.userId === d.userId);
          if (exists) return prev.map((p) => p.userId === d.userId ? { ...p, ...d, connectionStatus: 'connected' } : p);
          return [...prev, { userId: d.userId, displayName: d.displayName, role: d.participantRole, connectionStatus: 'connected' }];
        });
      }),

      sock.on(EV.PARTICIPANT_LEFT, (d) => {
        if (d.consultationId !== consultationId) return;
        setParticipants((prev) =>
          prev.map((p) => p.userId === d.userId ? { ...p, connectionStatus: 'disconnected' } : p)
        );
      }),

      // Waiting room — patient side
      sock.on(EV.WAITING_ROOM_ENTERED, (d) => {
        if (d.consultationId !== consultationId) return;
        setWaitingStatus('waiting');
      }),

      sock.on(EV.WAITING_ROOM_APPROVED, (d) => {
        if (d.consultationId !== consultationId) return;
        setWaitingStatus('admitted');
        setJoined(true);
      }),

      sock.on(EV.WAITING_ROOM_REJECTED, (d) => {
        if (d.consultationId !== consultationId) return;
        setWaitingStatus('rejected');
      }),

      // Waiting room — doctor side (queue updates)
      sock.on(EV.WAITING_ROOM_UPDATED, (d) => {
        if (d.consultationId !== consultationId) return;
        if (d.action === 'patient_entered') {
          setWaitingQueue((prev) => {
            const exists = prev.find((w) => w.patientUserId === d.patientUserId);
            if (exists) return prev;
            return [...prev, { patientUserId: d.patientUserId, patientName: d.patientName, enteredAt: d.timestamp }];
          });
        }
        if (d.action === 'admitted' || d.action === 'rejected') {
          setWaitingQueue((prev) => prev.filter((w) => w.patientUserId !== d.patientUserId));
        }
      }),

      // Consultation lifecycle
      sock.on(EV.CONSULTATION_STARTED, (d) => {
        if (d.consultationId !== consultationId) return;
        setConsultationStatus('active');
      }),

      sock.on(EV.CONSULTATION_ENDED, (d) => {
        if (d.consultationId !== consultationId) return;
        setConsultationStatus('completed');
        setJoined(false);
      }),

      sock.on(EV.PAUSED, (d) => {
        if (d.consultationId !== consultationId) return;
        setConsultationStatus('paused');
      }),

      sock.on(EV.RESUMED, (d) => {
        if (d.consultationId !== consultationId) return;
        setConsultationStatus('active');
      }),

      sock.on(EV.CANCELLED, (d) => {
        if (d.consultationId !== consultationId) return;
        setConsultationStatus('cancelled');
        setJoined(false);
      }),

      // Chat
      sock.on(EV.CHAT_MESSAGE, (d) => {
        if (d.consultationId !== consultationId) return;
        setChatMessages((prev) => [...prev, d]);
      }),

      // Media
      sock.on(EV.PARTICIPANT_MIC_CHANGED, (d) => {
        if (d.consultationId !== consultationId) return;
        setParticipants((prev) =>
          prev.map((p) => p.userId === d.userId ? { ...p, microphoneEnabled: d.enabled } : p)
        );
      }),

      sock.on(EV.PARTICIPANT_CAMERA_CHANGED, (d) => {
        if (d.consultationId !== consultationId) return;
        setParticipants((prev) =>
          prev.map((p) => p.userId === d.userId ? { ...p, cameraEnabled: d.enabled } : p)
        );
      }),

      sock.on(EV.PARTICIPANT_MUTED, (d) => {
        if (d.consultationId !== consultationId) return;
        setParticipants((prev) =>
          prev.map((p) => p.userId === d.targetUserId ? { ...p, isMutedByHost: true, microphoneEnabled: false } : p)
        );
      }),

      sock.on(EV.PARTICIPANT_REMOVED, (d) => {
        if (d.consultationId !== consultationId) return;
        setParticipants((prev) => prev.filter((p) => p.userId !== d.targetUserId));
      }),

      // Screen share
      sock.on(EV.SCREEN_SHARE_STARTED, (d) => {
        if (d.consultationId !== consultationId) return;
        setParticipants((prev) =>
          prev.map((p) => p.userId === d.userId ? { ...p, screenSharing: true } : p)
        );
      }),

      sock.on(EV.SCREEN_SHARE_STOPPED, (d) => {
        if (d.consultationId !== consultationId) return;
        setParticipants((prev) =>
          prev.map((p) => p.userId === d.userId ? { ...p, screenSharing: false } : p)
        );
      }),

      // Recording
      sock.on(EV.RECORDING_STARTED, (d) => {
        if (d.consultationId !== consultationId) return;
        setRecording(true);
      }),

      sock.on(EV.RECORDING_STOPPED, (d) => {
        if (d.consultationId !== consultationId) return;
        setRecording(false);
      }),

      // Network quality
      sock.on(EV.CALL_QUALITY_UPDATED, (d) => {
        if (d.consultationId !== consultationId) return;
        setCallQuality(d);
      }),

      // Hand raise
      sock.on(EV.HAND_RAISED, (d) => {
        if (d.consultationId !== consultationId) return;
        setHandRaises((prev) => ({ ...prev, [d.userId]: d.raised }));
      }),

      // Reactions (ephemeral — clear after 3s)
      sock.on(EV.REACTION, (d) => {
        if (d.consultationId !== consultationId) return;
        const id = `${d.userId}_${Date.now()}`;
        setReactions((prev) => [...prev, { ...d, id }]);
        setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3_000);
      }),

      // Removed from session
      sock.on(EV.REMOVED, (d) => {
        if (d.consultationId !== consultationId) return;
        setRemoved(true);
        setJoined(false);
      }),

      // End requested
      sock.on(EV.END_REQUESTED, (d) => {
        if (d.consultationId !== consultationId) return;
        setEndRequested(d);
      }),

      // Auto-disconnect
      sock.on(EV.AUTO_DISCONNECT, () => {
        setConnStatus('disconnected');
        setJoined(false);
      }),

      // State snapshot (reconnect recovery)
      sock.on(EV.STATE_SNAPSHOT, (d) => {
        if (d.consultationId !== consultationId) return;
        setSnapshot(d);
        if (d.status) setConsultationStatus(d.status);
        if (d.participants) setParticipants(d.participants);
      }),

      // Token expiring
      sock.on(EV.TOKEN_EXPIRING, (d) => {
        if (d.consultationId !== consultationId) return;
        console.warn('[ConsultationSocket] Token expiring — refresh via REST:', d.message);
        onError?.({ message: 'TOKEN_EXPIRING', ...d });
      }),

      // Pong (latency)
      sock.on(EV.PONG_HEALTH, () => {
        if (pingRef.current) {
          setLatencyMs(Date.now() - pingRef.current);
          pingRef.current = null;
        }
      }),
    ];

    // handlers array contains unsub fns (sock.on returns undefined in socket.io-client —
    // we track via the service's internal listener map; cleanup below)
    return () => {
      sock.off('connect',       onConn);
      sock.off('disconnect',    onDisc);
      sock.off('connect_error', onConnErr);
      sock.off('error',         onConnErr);
      consultationSocketService.destroy();
      setConnStatus('disconnected');
      setJoined(false);
    };
  }, [token, consultationId]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION CALLBACKS
  // ─────────────────────────────────────────────────────────────────────────

  const join = useCallback(() => {
    consultationSocketService.joinConsultation(consultationId);
  }, [consultationId]);

  const leave = useCallback(() => {
    consultationSocketService.leaveConsultation(consultationId);
    setJoined(false);
  }, [consultationId]);

  const sendChat = useCallback((message, messageType = 'text', attachments = []) => {
    consultationSocketService.sendChat(consultationId, message, messageType, attachments);
  }, [consultationId]);

  const toggleMic = useCallback((enabled) => {
    setMicEnabled(enabled);
    consultationSocketService.toggleMic(consultationId, enabled);
  }, [consultationId]);

  const toggleCamera = useCallback((enabled) => {
    setCameraEnabled(enabled);
    consultationSocketService.toggleCamera(consultationId, enabled);
  }, [consultationId]);

  const raiseHand = useCallback((raised) => {
    consultationSocketService.raiseHand(consultationId, raised);
  }, [consultationId]);

  const sendReaction = useCallback((emoji) => {
    consultationSocketService.sendReaction(consultationId, emoji);
  }, [consultationId]);

  const reportNetworkQuality = useCallback((quality, metrics = {}) => {
    consultationSocketService.reportNetworkQuality(consultationId, quality, metrics);
  }, [consultationId]);

  const requestEnd = useCallback((reason = '') => {
    consultationSocketService.requestEnd(consultationId, reason);
  }, [consultationId]);

  const startScreen = useCallback(() => {
    setScreenSharing(true);
    consultationSocketService.startScreenShare(consultationId);
  }, [consultationId]);

  const stopScreen = useCallback(() => {
    setScreenSharing(false);
    consultationSocketService.stopScreenShare(consultationId);
  }, [consultationId]);

  // Host actions
  const startConsultation = useCallback(() => {
    consultationSocketService.startConsultation(consultationId);
  }, [consultationId]);

  const admitPatient = useCallback((patientUserId) => {
    consultationSocketService.admitPatient(consultationId, patientUserId);
    setWaitingQueue((prev) => prev.filter((w) => w.patientUserId !== patientUserId));
  }, [consultationId]);

  const rejectPatient = useCallback((patientUserId, reason = '') => {
    consultationSocketService.rejectPatient(consultationId, patientUserId, reason);
    setWaitingQueue((prev) => prev.filter((w) => w.patientUserId !== patientUserId));
  }, [consultationId]);

  const muteParticipant = useCallback((targetUserId) => {
    consultationSocketService.muteParticipant(consultationId, targetUserId);
  }, [consultationId]);

  const removeParticipant = useCallback((targetUserId, reason = '') => {
    consultationSocketService.removeParticipant(consultationId, targetUserId, reason);
  }, [consultationId]);

  const startRecording = useCallback(() => {
    consultationSocketService.startRecording(consultationId);
  }, [consultationId]);

  const stopRecording = useCallback(() => {
    consultationSocketService.stopRecording(consultationId);
  }, [consultationId]);

  const endConsultation = useCallback((reason = '', summary = '') => {
    consultationSocketService.endConsultation(consultationId, reason, summary);
  }, [consultationId]);

  const ping = useCallback(() => {
    pingRef.current = Date.now();
    consultationSocketService.ping();
  }, []);

  const refreshState = useCallback(() => {
    consultationSocketService.requestState(consultationId);
  }, [consultationId]);

  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXT VALUE
  // ─────────────────────────────────────────────────────────────────────────

  const ctx = {
    // Connection
    connStatus,
    connected:  connStatus === 'connected',
    lastError,
    latencyMs,

    // Consultation state
    joined,
    participantRole,
    consultationStatus,
    snapshot,
    removed,
    endRequested,
    waitingStatus,

    // Participants
    participants,

    // Waiting room (doctor)
    waitingQueue,

    // Chat
    chatMessages,

    // Media state
    micEnabled,
    cameraEnabled,
    screenSharing,
    recording,

    // Network
    callQuality,

    // Ephemeral
    reactions,
    handRaises,

    // Actions — patient / common
    join,
    leave,
    sendChat,
    toggleMic,
    toggleCamera,
    raiseHand,
    sendReaction,
    reportNetworkQuality,
    requestEnd,
    startScreen,
    stopScreen,
    ping,
    refreshState,

    // Actions — host (doctor/admin)
    startConsultation,
    admitPatient,
    rejectPatient,
    muteParticipant,
    removeParticipant,
    startRecording,
    stopRecording,
    endConsultation,

    // Raw service access (escape hatch)
    on:   consultationSocketService.on.bind(consultationSocketService),
    off:  consultationSocketService.off.bind(consultationSocketService),
    once: consultationSocketService.once.bind(consultationSocketService),
    emit: consultationSocketService.emit.bind(consultationSocketService),

    // Constants
    CONSULTATION_EVENTS: EV,
  };

  return (
    <ConsultationContext.Provider value={ctx}>
      {children}
    </ConsultationContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useConsultation() {
  const ctx = useContext(ConsultationContext);
  if (!ctx) throw new Error('useConsultation must be inside <ConsultationSocketProvider>');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUSED HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/** Chat messages + send action. */
export function useConsultationChat() {
  const { chatMessages, sendChat } = useConsultation();
  return { chatMessages, sendChat };
}

/**
 * Waiting room management (doctor perspective).
 * Returns queue + admit/reject actions.
 */
export function useWaitingRoom() {
  const { waitingQueue, admitPatient, rejectPatient, waitingStatus } = useConsultation();
  return { waitingQueue, admitPatient, rejectPatient, waitingStatus };
}

/** Live participant list. */
export function useParticipants() {
  const { participants, muteParticipant, removeParticipant } = useConsultation();
  return { participants, muteParticipant, removeParticipant };
}

/** Media controls: mic, camera, screen share, recording. */
export function useConsultationMedia() {
  const {
    micEnabled, cameraEnabled, screenSharing, recording,
    toggleMic, toggleCamera, startScreen, stopScreen,
    startRecording, stopRecording,
  } = useConsultation();

  return {
    micEnabled, cameraEnabled, screenSharing, recording,
    toggleMic, toggleCamera, startScreen, stopScreen,
    startRecording, stopRecording,
  };
}

/** Connection status + latency. */
export function useConsultationHealth() {
  const { connected, connStatus, lastError, latencyMs, ping } = useConsultation();
  return { connected, connStatus, lastError, latencyMs, ping };
}

export { CONSULTATION_EVENTS } from '@/services/consultationSocketService';
export default ConsultationSocketProvider;