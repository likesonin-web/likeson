'use client';
/**
 * useConsultationCore.js
 * Core hook: data fetching, role validation, phase management, socket sync.
 * Redux is single source of truth — NO local state duplication.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchConsultationById,
  fetchJoinDetails,
  acceptTelemedicineConsent,
  endConsultation,
  rateConsultation,
  checkFollowUpEligibility,
  logNetworkQuality,
  selectCurrentConsultation,
  selectJoinDetails,
  selectConsultationLoaders,
  selectConsultationErrors,
  selectFollowUpEligibility,
  clearCurrentConsultation,
  clearJoinDetails,
} from '@/store/slices/consultationSlice';

import { useSocket, useBookingRoom } from '@/context/SocketProvider';
import {
  CONSULTATION_STATUS,
  CONSULTATION_PHASES,
  NETWORK_LOG_INTERVAL_MS,
  RECONNECT_THROTTLE_MS,
} from '../app/consultations/constants';

/**
 * useConsultationCore
 * @param {{ bookingId: string, user: Object }} options
 * @returns {Object}
 */
export function useConsultationCore({ bookingId, user }) {
  const dispatch = useDispatch();

  // ── Redux selectors ───────────────────────────────────────────────────────
  const booking          = useSelector(selectCurrentConsultation);
  const joinDetails      = useSelector(selectJoinDetails);
  const loaders          = useSelector(selectConsultationLoaders);
  const errors           = useSelector(selectConsultationErrors);
  const followUp         = useSelector(selectFollowUpEligibility);

  // ── Local UI state (NOT data state — never duplicate Redux) ───────────────
  const [phase,          setPhase]          = useState(CONSULTATION_PHASES.LOADING);
  const [accessDenied,   setAccessDenied]   = useState(null); // null = ok, string = reason
  const [networkQuality, setNetworkQuality] = useState('good');
  const [sessionElapsed, setSessionElapsed] = useState(0); // seconds

  // ── Refs ──────────────────────────────────────────────────────────────────
  const timerRef       = useRef(null);
  const netLogTimer    = useRef(null);
  const lastReconnect  = useRef(0);
  const phaseLockRef   = useRef(false); // prevent phase race

  // ── Socket ───────────────────────────────────────────────────────────────
  const { on, connected } = useSocket();
  const { bookingStatus } = useBookingRoom(bookingId);

  // ── 1. Initial data fetch ─────────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) return;
    dispatch(fetchConsultationById(bookingId));
    return () => {
      dispatch(clearCurrentConsultation());
      dispatch(clearJoinDetails());
    };
  }, [bookingId, dispatch]);

  // ── 2. Role + access validation ───────────────────────────────────────────
  useEffect(() => {
    if (!booking || !user) return;
    if (loaders.isFetchingCurrent) return;

    // Role check
    if (user.role !== 'customer') {
      setAccessDenied('Only patients can access this page.');
      setPhase(CONSULTATION_PHASES.DENIED);
      return;
    }

    // Ownership
    const customerId = booking.customer?._id ?? booking.customer;
    if (customerId?.toString() !== user._id?.toString()) {
      setAccessDenied('This consultation does not belong to your account.');
      setPhase(CONSULTATION_PHASES.DENIED);
      return;
    }

    // Type
    if (booking.bookingType !== 'doctor_online') {
      setAccessDenied('This booking is not an online consultation.');
      setPhase(CONSULTATION_PHASES.DENIED);
      return;
    }

    // Payment
    if (booking.paymentStatus !== 'paid') {
      setAccessDenied('Payment required to access this consultation.');
      setPhase(CONSULTATION_PHASES.DENIED);
      return;
    }

    // Status
    if (!['confirmed', 'in_progress', 'completed'].includes(booking.status)) {
      setAccessDenied(`Consultation status "${booking.status}" is not accessible.`);
      setPhase(CONSULTATION_PHASES.DENIED);
      return;
    }

    // Completed → go to completion screen
    if (booking.status === 'completed') {
      setPhase(CONSULTATION_PHASES.COMPLETED);
      dispatch(checkFollowUpEligibility(bookingId));
      return;
    }

    // Consent check
    const consentAccepted = booking.onlineConsultation?.isTelemedicineConsentAccepted;
    if (!consentAccepted) {
      setPhase(CONSULTATION_PHASES.CONSENT);
      return;
    }

    // Determine live vs waiting
    const consultationStatus = booking.onlineConsultation?.consultationStatus;
    if (consultationStatus === CONSULTATION_STATUS.LIVE || booking.status === 'in_progress') {
      // Fetch join details if not yet loaded
      if (!joinDetails && !loaders.isFetchingJoin) {
        dispatch(fetchJoinDetails(bookingId));
      }
      setPhase(CONSULTATION_PHASES.LIVE);
    } else {
      setPhase(CONSULTATION_PHASES.WAITING);
    }
  }, [booking, user, loaders.isFetchingCurrent, joinDetails, bookingId, dispatch]);

  // ── 3. Socket booking status sync ─────────────────────────────────────────
  useEffect(() => {
    if (!bookingStatus) return;
    const status = bookingStatus.consultationStatus ?? bookingStatus.status;

    if (status === CONSULTATION_STATUS.LIVE || bookingStatus.status === 'in_progress') {
      if (!joinDetails && !loaders.isFetchingJoin) {
        dispatch(fetchJoinDetails(bookingId));
      }
      if (!phaseLockRef.current) setPhase(CONSULTATION_PHASES.LIVE);
    }

    if (status === CONSULTATION_STATUS.COMPLETED || bookingStatus.status === 'completed') {
      setPhase(CONSULTATION_PHASES.COMPLETED);
      dispatch(checkFollowUpEligibility(bookingId));
    }
  }, [bookingStatus, joinDetails, loaders.isFetchingJoin, bookingId, dispatch]);

  // ── 4. Consultation started socket event ──────────────────────────────────
  useEffect(() => {
    if (!bookingId || !connected) return;
    const unsub = on('consultation:started', (data) => {
      if (data.bookingId !== bookingId) return;
      if (!joinDetails && !loaders.isFetchingJoin) {
        dispatch(fetchJoinDetails(bookingId));
      }
      setPhase(CONSULTATION_PHASES.LIVE);
    });
    return () => unsub?.();
  }, [bookingId, connected, joinDetails, loaders.isFetchingJoin, dispatch, on]);

  // ── 5. Consultation ended socket event ────────────────────────────────────
  useEffect(() => {
    if (!bookingId || !connected) return;
    const unsub = on('consultation:ended', (data) => {
      if (data.bookingId !== bookingId) return;
      setPhase(CONSULTATION_PHASES.COMPLETED);
      dispatch(checkFollowUpEligibility(bookingId));
      dispatch(fetchConsultationById(bookingId)); // refresh for prescription etc.
    });
    return () => unsub?.();
  }, [bookingId, connected, dispatch, on]);

  // ── 6. Session timer (starts when LIVE) ──────────────────────────────────
  useEffect(() => {
    if (phase !== CONSULTATION_PHASES.LIVE) {
      clearInterval(timerRef.current);
      return;
    }
    const startedAt = booking?.onlineConsultation?.startedAt
      ? new Date(booking.onlineConsultation.startedAt)
      : new Date();

    timerRef.current = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [phase, booking?.onlineConsultation?.startedAt]);

  // ── 7. Network quality logging ────────────────────────────────────────────
  const logQuality = useCallback((quality) => {
    setNetworkQuality(quality);
    dispatch(logNetworkQuality({ bookingId, participant: 'patient', quality }));
  }, [bookingId, dispatch]);

  useEffect(() => {
    if (phase !== CONSULTATION_PHASES.LIVE) return;
    netLogTimer.current = setInterval(() => {
      dispatch(logNetworkQuality({ bookingId, participant: 'patient', quality: networkQuality }));
    }, NETWORK_LOG_INTERVAL_MS);
    return () => clearInterval(netLogTimer.current);
  }, [phase, networkQuality, bookingId, dispatch]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAcceptConsent = useCallback(async () => {
    try {
      const ipAddress = await fetch('https://api.ipify.org?format=json')
        .then((r) => r.json())
        .then((d) => d.ip)
        .catch(() => null);
      await dispatch(acceptTelemedicineConsent({ bookingId, ipAddress })).unwrap();
      await dispatch(fetchJoinDetails(bookingId)).unwrap();
      setPhase(CONSULTATION_PHASES.LIVE);
    } catch (err) {
      console.error('[handleAcceptConsent]', err);
    }
  }, [bookingId, dispatch]);

  const handleEndConsultation = useCallback(async () => {
    await dispatch(endConsultation({ bookingId, reason: 'patient_ended' })).unwrap();
    setPhase(CONSULTATION_PHASES.COMPLETED);
    dispatch(checkFollowUpEligibility(bookingId));
  }, [bookingId, dispatch]);

  const handleRate = useCallback(async (ratingData) => {
    await dispatch(rateConsultation({ bookingId, ...ratingData })).unwrap();
  }, [bookingId, dispatch]);

  const handleReconnect = useCallback(() => {
    const now = Date.now();
    if (now - lastReconnect.current < RECONNECT_THROTTLE_MS) return;
    lastReconnect.current = now;
    dispatch(fetchJoinDetails(bookingId));
  }, [bookingId, dispatch]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(netLogTimer.current);
    };
  }, []);

  return {
    // Data (from Redux)
    booking,
    joinDetails,
    followUp,

    // Loaders
    isLoading:    loaders.isFetchingCurrent || loaders.isFetchingJoin,
    isActionLoading: loaders.isActionLoading,

    // Errors
    errors,

    // Phase
    phase,
    setPhase,
    accessDenied,

    // Session
    sessionElapsed,
    networkQuality,
    logQuality,

    // Actions
    handleAcceptConsent,
    handleEndConsultation,
    handleRate,
    handleReconnect,
  };
}

// ---------------------------------------------------------------------------

/**
 * useDevicePermissions
 * Check and request camera/mic permissions.
 */
export function useDevicePermissions() {
  const [camPermission, setCamPermission]   = useState('prompt'); // granted | denied | prompt
  const [micPermission, setMicPermission]   = useState('prompt');
  const [checking, setChecking]             = useState(false);
  const streamRef = useRef(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setCamPermission('granted');
      setMicPermission('granted');
      // Stop tracks immediately — just checking
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCamPermission('denied');
        setMicPermission('denied');
      } else if (err.name === 'NotFoundError') {
        setCamPermission('denied');
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line

  return { camPermission, micPermission, checking, recheck: check };
}

/**
 * useSessionTimer
 * Formats seconds → MM:SS display string + warning threshold.
 */
export function useSessionTimer(elapsedSecs, allowedMinutes = 30) {
  const totalSecs    = allowedMinutes * 60;
  const remaining    = Math.max(0, totalSecs - elapsedSecs);
  const isWarning    = remaining <= 120 && remaining > 0;
  const isExpired    = remaining === 0;

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return {
    elapsed:       fmt(elapsedSecs),
    remaining:     fmt(remaining),
    remainingSecs: remaining,
    isWarning,
    isExpired,
    progressPercent: Math.min(100, (elapsedSecs / totalSecs) * 100),
  };
}