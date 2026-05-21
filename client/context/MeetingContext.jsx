'use client';

/**
 * MeetingContext.jsx
 * Centralised VideoSDK meeting state. Wraps useMeeting + participant management.
 * Prevents duplicate joins, stale listeners, media leaks.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';

// ---------------------------------------------------------------------------
// Types / shape references (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} MeetingContextValue
 * @property {boolean}  isMicOn
 * @property {boolean}  isCamOn
 * @property {boolean}  isSpeakerOn
 * @property {boolean}  isHandRaised
 * @property {string}   meetingState
 * @property {Map}      participants
 * @property {string|null} localParticipantId
 * @property {Function} toggleMic
 * @property {Function} toggleCam
 * @property {Function} toggleSpeaker
 * @property {Function} toggleHand
 * @property {Function} safeJoin
 * @property {Function} safeLeave
 * @property {Function} switchCamera
 * @property {number}   reconnectCount
 * @property {boolean}  isDoctorPresent
 * @property {string[]} messages
 * @property {Function} sendMessage
 */

const MeetingContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * MeetingContextProvider
 * Must be a child of VideoSDK's MeetingProvider.
 * @param {{ children: React.ReactNode, onMeetingLeft?: Function, onError?: Function }} props
 */
export function MeetingContextProvider({ children, onMeetingLeft, onError }) {
  // ── Local state ─────────────────────────────────────────────────────────
  const [meetingState,       setMeetingState]       = useState('IDLE');
  const [isMicOn,            setIsMicOn]            = useState(true);
  const [isCamOn,            setIsCamOn]            = useState(true);
  const [isSpeakerOn,        setIsSpeakerOn]        = useState(true);
  const [isHandRaised,       setIsHandRaised]       = useState(false);
  const [participants,       setParticipants]       = useState(new Map());
  const [localParticipantId, setLocalParticipantId] = useState(null);
  const [reconnectCount,     setReconnectCount]     = useState(0);
  const [messages,           setMessages]           = useState([]);
  const [isDoctorPresent,    setIsDoctorPresent]    = useState(false);

  // ── Refs (stable, no rerender) ───────────────────────────────────────────
  const hasJoinedRef     = useRef(false);
  const meetingRef       = useRef(null);
  const cleanupCallbacks = useRef([]);

  // ── Lazy VideoSDK import ───────────────────────────────────────────────
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [useMeetingFn, setUseMeetingFn] = useState(null);
  const [useParticipantFn, setUseParticipantFn] = useState(null);

  useEffect(() => {
    let cancelled = false;
    import('@videosdk.live/react-sdk')
      .then((mod) => {
        if (cancelled) return;
        setUseMeetingFn(() => mod.useMeeting);
        setUseParticipantFn(() => mod.useParticipant);
        setSdkLoaded(true);
      })
      .catch((err) => {
        console.error('[MeetingContext] SDK load failed:', err);
        onError?.({ type: 'SDK_LOAD_FAILED', message: 'VideoSDK failed to load.' });
      });
    return () => { cancelled = true; };
  }, [onError]);

  // ── Cleanup helpers ──────────────────────────────────────────────────────

  const registerCleanup = useCallback((fn) => {
    cleanupCallbacks.current.push(fn);
  }, []);

  const runCleanup = useCallback(() => {
    cleanupCallbacks.current.forEach((fn) => {
      try { fn(); } catch (_) { /* silent */ }
    });
    cleanupCallbacks.current = [];
  }, []);

  const stopLocalTracks = useCallback(() => {
    try {
      meetingRef.current?.localParticipant?.videoTrack?.stop?.();
      meetingRef.current?.localParticipant?.audioTrack?.stop?.();
    } catch (_) { /* silent */ }
  }, []);

  // ── Meeting event handlers ───────────────────────────────────────────────

  const onMeetingJoined = useCallback(() => {
    setMeetingState('CONNECTED');
    const localId = meetingRef.current?.localParticipant?.id;
    if (localId) setLocalParticipantId(localId);
  }, []);

  const onMeetingLeftHandler = useCallback(() => {
    setMeetingState('CLOSED');
    stopLocalTracks();
    runCleanup();
    hasJoinedRef.current = false;
    onMeetingLeft?.();
  }, [onMeetingLeft, runCleanup, stopLocalTracks]);

  const onParticipantJoined = useCallback((participant) => {
    setParticipants((prev) => {
      if (prev.has(participant.id)) return prev;
      const next = new Map(prev);
      next.set(participant.id, participant);
      return next;
    });
    if (participant?.displayName?.toLowerCase().includes('dr')) {
      setIsDoctorPresent(true);
    }
  }, []);

  const onParticipantLeft = useCallback((participant) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      next.delete(participant.id);
      return next;
    });
    setIsDoctorPresent((prev) => {
      if (!prev) return false;
      const remaining = meetingRef.current?.participants;
      if (!remaining) return false;
      return [...remaining.values()].some((p) =>
        p.displayName?.toLowerCase().includes('dr')
      );
    });
  }, []);

  // Renamed from onError to handleMeetingError to avoid conflict with prop
  const handleMeetingError = useCallback((data) => {
    console.error('[Meeting] Error:', data);
    setMeetingState('FAILED');
    onError?.({ type: 'MEETING_ERROR', ...data });
  }, [onError]);

  const onMeetingStateChanged = useCallback(({ state }) => {
    setMeetingState(state);
    if (state === 'RECONNECTING') {
      setReconnectCount((n) => n + 1);
    }
  }, []);

  const onChatMessage = useCallback(({ message, senderId, timestamp, senderName }) => {
    setMessages((prev) => {
      const key = `${senderId}-${timestamp}`;
      const alreadyHas = prev.some((m) => `${m.senderId}-${m.timestamp}` === key);
      if (alreadyHas) return prev;
      return [...prev, { message, senderId, timestamp, senderName, id: key }];
    });
  }, []);

  // ── Controls ─────────────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    if (isMicOn) {
      meeting.muteMic?.();
      setIsMicOn(false);
    } else {
      meeting.unmuteMic?.();
      setIsMicOn(true);
    }
  }, [isMicOn]);

  const toggleCam = useCallback(() => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    if (isCamOn) {
      meeting.disableWebcam?.();
      setIsCamOn(false);
    } else {
      meeting.enableWebcam?.();
      setIsCamOn(true);
    }
  }, [isCamOn]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      document.querySelectorAll('audio[data-remote]').forEach((el) => {
        el.muted = !next;
      });
      return next;
    });
  }, []);

  const toggleHand = useCallback(() => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    const next = !isHandRaised;
    setIsHandRaised(next);
    meeting.pubSub?.publish?.('RAISE_HAND', JSON.stringify({ raised: next }), { persist: false });
  }, [isHandRaised]);

  const switchCamera = useCallback(async () => {
    const meeting = meetingRef.current;
    if (!meeting) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      if (videoDevices.length < 2) return;
      const current = meeting.localParticipant?.videoTrack?.label;
      const next = videoDevices.find((d) => d.label !== current) ?? videoDevices[0];
      meeting.changeWebcam?.(next.deviceId);
    } catch (err) {
      console.warn('[switchCamera]', err.message);
    }
  }, []);

  const safeJoin = useCallback(() => {
    if (hasJoinedRef.current) return;
    if (!meetingRef.current) return;
    hasJoinedRef.current = true;
    setMeetingState('CONNECTING');
    meetingRef.current.join?.();
  }, []);

  const safeLeave = useCallback(() => {
    if (!hasJoinedRef.current && !meetingRef.current) return;
    stopLocalTracks();
    meetingRef.current?.leave?.();
    runCleanup();
    hasJoinedRef.current = false;
  }, [stopLocalTracks, runCleanup]);

  const sendMessage = useCallback((text) => {
    meetingRef.current?.pubSub?.publish?.('CHAT', text, { persist: true });
  }, []);

  useEffect(() => {
    return () => { safeLeave(); };
  }, [safeLeave]);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    meetingState,
    isMicOn, isCamOn, isSpeakerOn, isHandRaised,
    participants, localParticipantId,
    reconnectCount, isDoctorPresent,
    messages, sendMessage,
    toggleMic, toggleCam, toggleSpeaker, toggleHand,
    safeJoin, safeLeave, switchCamera,
    meetingRef,
    registerCleanup,
    sdkLoaded,
    useMeetingFn,
    useParticipantFn,
    _callbacks: {
      onMeetingJoined,
      onMeetingLeft: onMeetingLeftHandler,
      onParticipantJoined,
      onParticipantLeft,
      onError: handleMeetingError,
      onMeetingStateChanged,
      onChatMessage,
    },
  }), [
    meetingState, isMicOn, isCamOn, isSpeakerOn, isHandRaised,
    participants, localParticipantId, reconnectCount, isDoctorPresent,
    messages, sendMessage, toggleMic, toggleCam, toggleSpeaker, toggleHand,
    safeJoin, safeLeave, switchCamera, registerCleanup, sdkLoaded,
    useMeetingFn, useParticipantFn,
    onMeetingJoined, onMeetingLeftHandler, onParticipantJoined,
    onParticipantLeft, handleMeetingError, onMeetingStateChanged, onChatMessage,
  ]);

  return (
    <MeetingContext.Provider value={value}>
      {children}
    </MeetingContext.Provider>
  );
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useMeetingContext() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error('useMeetingContext must be inside MeetingContextProvider');
  return ctx;
}

export default MeetingContext;