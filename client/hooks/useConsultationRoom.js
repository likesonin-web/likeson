/**
 * useConsultationRoom.js — FIXED v2
 *
 * ROOT CAUSE FIX: "Token is invalid" (401)
 * ─────────────────────────────────────────────────────────────────
 * The VideoSDK token has a short TTL (~2 hours from the `iat`).
 * The original hook used whatever token was already in Redux/props
 * at render time — if the component mounted after the token expired
 * (or the page was open a long time before clicking Join), VideoSDK
 * rejected it with 401.
 *
 * FIX STRATEGY:
 * 1. Never trust a cached token. Re-fetch join details immediately
 *    before calling join().
 * 2. The hook accepts `fetchFreshJoinDetails` — an async fn that
 *    hits your backend and returns { roomId, token, ... }.
 * 3. joinedRef still guards against double-join.
 * 4. If the re-fetch itself fails, surface a clean error.
 *
 * ADDITIONAL FIXES:
 * - Removed screen share (was causing issues per v7 notes)
 * - Removed `endMeeting` SDK call (leave() is sufficient for doctor)
 * - `mountedRef` guards all async setState calls
 * - Cleaned up unused imports
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch }  from 'react-redux';
import { useMeeting }   from '@videosdk.live/react-sdk';
import {
  startConsultation,
  endConsultation,
} from '@/store/slices/consultationSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONSULTATION_STATUS = {
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  LIVE:      'live',
};

// ─── Helper: safely stop a MediaStream ────────────────────────────────────────

function stopMediaStream(stream) {
  try {
    stream?.getTracks?.().forEach((t) => t.stop());
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object}   params
 * @param {string}   params.bookingId
 * @param {object|null} params.booking              - full booking object (for status check)
 * @param {Function} params.fetchFreshJoinDetails   - async () => { roomId, token, allowedDurationMinutes, role }
 *                                                    Called right before join to guarantee a fresh token.
 * @param {Function} params.onMeetingEnd            - called when meeting ends (local or remote trigger)
 */
export function useConsultationRoom({
  bookingId,
  booking,
  fetchFreshJoinDetails,
  onMeetingEnd,
}) {
  const dispatch = useDispatch();

  // ── State ──────────────────────────────────────────────────────────────────
  const [meetingState,  setMeetingState]  = useState('idle');
  // idle | fetching | joining | live | ended | error
  const [meetingError,  setMeetingError]  = useState(null);
  const [isCamOn,       setIsCamOn]       = useState(true);
  const [isMicOn,       setIsMicOn]       = useState(true);
  const [isSpeakerOn,   setIsSpeakerOn]   = useState(true);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [isRecording,   setIsRecording]   = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const joinedRef   = useRef(false);   // guard: prevents double-join
  const mountedRef  = useRef(true);    // guard: prevents setState after unmount
  const tokenRef    = useRef(null);    // holds the freshly-fetched token for SDK

  // ── Unmount cleanup ────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── VideoSDK meeting ───────────────────────────────────────────────────────
  const {
    join,
    leave,
    toggleMic,
    toggleWebcam,
    startRecording: sdkStartRecording,
    stopRecording:  sdkStopRecording,
    localMicOn,
    localWebcamOn,
    participants,
    meetingId: sdkMeetingId,
  } = useMeeting({
    onMeetingJoined: () => {
      if (!mountedRef.current) return;
      setMeetingState('live');
      setMeetingError(null);
    },
    onMeetingLeft: () => {
      if (!mountedRef.current) return;
      joinedRef.current = false;
      setMeetingState('ended');
      onMeetingEnd?.();
    },
    onError: (err) => {
      if (!mountedRef.current) return;
      // Specifically surface token errors clearly
      const msg = err?.message ?? 'Meeting error';
      const isTokenError =
        msg.toLowerCase().includes('token') ||
        msg.toLowerCase().includes('401')   ||
        msg.toLowerCase().includes('unauthorized');

      setMeetingError(
        isTokenError
          ? 'Session token expired. Please refresh and rejoin.'
          : msg,
      );
      setMeetingState('error');
      joinedRef.current = false;
    },
  });

  // Sync SDK media state
  useEffect(() => { setIsMicOn(localMicOn);    }, [localMicOn]);
  useEffect(() => { setIsCamOn(localWebcamOn); }, [localWebcamOn]);

  // ── Fullscreen sync ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // CORE FIX: joinRoom — always fetches a FRESH token before joining
  // Never relies on a cached token from Redux / props.
  // ─────────────────────────────────────────────────────────────────────────

  const joinRoom = useCallback(async () => {
    if (joinedRef.current) return; // already joined or joining

    // Bail if consultation is already done
    const consultStatus = booking?.onlineConsultation?.consultationStatus;
    if (
      consultStatus === CONSULTATION_STATUS.COMPLETED ||
      consultStatus === CONSULTATION_STATUS.CANCELLED
    ) {
      setMeetingError('This consultation has already ended.');
      setMeetingState('error');
      return;
    }

    if (typeof fetchFreshJoinDetails !== 'function') {
      setMeetingError('No token fetcher provided.');
      setMeetingState('error');
      return;
    }

    // 1. Fetch fresh token RIGHT NOW — don't use anything cached
    setMeetingState('fetching');
    setMeetingError(null);

    let freshDetails;
    try {
      freshDetails = await fetchFreshJoinDetails(bookingId);
    } catch (err) {
      if (!mountedRef.current) return;
      setMeetingError(err?.message ?? 'Failed to fetch join details. Please retry.');
      setMeetingState('error');
      return;
    }

    if (!mountedRef.current) return;

    if (!freshDetails?.token || !freshDetails?.roomId) {
      setMeetingError('Invalid join details received from server.');
      setMeetingState('error');
      return;
    }

    // 2. Decode and validate token expiry before even trying to join
    try {
      const payload     = JSON.parse(atob(freshDetails.token.split('.')[1]));
      const expiresAt   = payload.exp * 1000;
      const nowMs       = Date.now();
      const safetyBuffer = 30 * 1000; // 30s buffer

      if (expiresAt - nowMs < safetyBuffer) {
        setMeetingError('Fresh token is already expired. Please contact support.');
        setMeetingState('error');
        return;
      }
    } catch {
      // If we can't decode, proceed and let SDK handle it
    }

    // 3. Store token for SDK (MeetingProvider token prop must update)
    tokenRef.current = freshDetails.token;

    // 4. Join — guard set BEFORE async join() to prevent race
    joinedRef.current = true;
    setMeetingState('joining');

    try {
      join();
    } catch (err) {
      joinedRef.current = false;
      setMeetingState('error');
      setMeetingError(err?.message ?? 'Join failed');
    }
  }, [bookingId, booking, fetchFreshJoinDetails, join]);

  // ── Start consultation (marks booking in_progress on backend) ─────────────
  const handleStartConsultation = useCallback(async () => {
    if (!bookingId) return;
    try {
      await dispatch(startConsultation(bookingId)).unwrap();
    } catch (err) {
      if (mountedRef.current) {
        setMeetingError(err?.message ?? 'Failed to start consultation');
      }
    }
  }, [bookingId, dispatch]);

  // ── End consultation ───────────────────────────────────────────────────────
  const handleEndConsultation = useCallback(async ({
    reason               = 'Doctor ended session',
    consultationSummary  = '',
    followUpInstructions = '',
  } = {}) => {
    if (!bookingId) return;
    try {
      await dispatch(endConsultation({
        bookingId,
        reason,
        consultationSummary,
        followUpInstructions,
      })).unwrap();
      leave();
    } catch (err) {
      if (mountedRef.current) {
        setMeetingError(err?.message ?? 'Failed to end consultation');
      }
    }
  }, [bookingId, dispatch, leave]);

  // ── Leave (doctor leaves, patient stays) ──────────────────────────────────
  const handleLeave = useCallback(() => {
    leave();
  }, [leave]);

  // ── Fullscreen toggle ──────────────────────────────────────────────────────
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  // ── Recording ─────────────────────────────────────────────────────────────
  const handleStartRecording = useCallback(() => {
    sdkStartRecording?.();
    setIsRecording(true);
  }, [sdkStartRecording]);

  const handleStopRecording = useCallback(() => {
    sdkStopRecording?.();
    setIsRecording(false);
  }, [sdkStopRecording]);

  // ── Exposed token (for MeetingProvider token prop) ─────────────────────────
  // Callers should pass tokenRef.current to MeetingProvider — it updates
  // only when joinRoom() successfully fetches a fresh token.
  const getFreshToken = useCallback(() => tokenRef.current, []);

  return {
    // State
    meetingState,   // 'idle' | 'fetching' | 'joining' | 'live' | 'ended' | 'error'
    meetingError,
    isCamOn,
    isMicOn,
    isSpeakerOn,
    isFullscreen,
    isRecording,
    participants,
    sdkMeetingId,

    // Actions
    joinRoom,                               // call this on "Join" button click
    leave:            handleLeave,
    toggleMic:        () => toggleMic(),    // wrapped to avoid Circular JSON crash
    toggleWebcam:     () => toggleWebcam(), // same
    toggleFullscreen: handleToggleFullscreen,
    startConsultation: handleStartConsultation,
    endConsultation:   handleEndConsultation,
    setIsSpeakerOn,
    startRecording:   handleStartRecording,
    stopRecording:    handleStopRecording,
    getFreshToken,    // pass to MeetingProvider token prop
  };
}