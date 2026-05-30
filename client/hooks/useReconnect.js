'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectRtConnected } from '@/store/slices/consultationSlice';
import { useConsultation } from '@/providers/ConsultationSocketProvider';

const MAX_ATTEMPTS = 10;
const BASE_DELAY   = 1000;

/**
 * useReconnect
 * Watches rt.connected; starts exponential backoff on disconnect.
 * Shows overlay while reconnecting.
 */
export function useReconnect(consultationId) {
  const rtConnected = useSelector(selectRtConnected);
  const { emitReconnectAttempt, emitReconnectSuccess } = useConsultation();

  const [isReconnecting, setIsReconnecting] = useState(false);
  const [attempts,       setAttempts]       = useState(0);
  const [failed,         setFailed]         = useState(false);

  const timerRef   = useRef(null);
  const attemptsRef = useRef(0);
  const wasConnected = useRef(false);

  useEffect(() => {
    if (rtConnected) {
      if (wasConnected.current === false && attemptsRef.current > 0) {
        // Recovered
        setIsReconnecting(false);
        setAttempts(0);
        setFailed(false);
        attemptsRef.current = 0;
        clearTimeout(timerRef.current);
        emitReconnectSuccess({ consultationId });
      }
      wasConnected.current = true;
    } else {
      if (wasConnected.current === true) {
        // Just disconnected — start reconnect loop
        setIsReconnecting(true);
        attemptReconnect();
      }
      wasConnected.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtConnected]);

  const attemptReconnect = useCallback(() => {
    if (attemptsRef.current >= MAX_ATTEMPTS) {
      setFailed(true);
      setIsReconnecting(false);
      return;
    }

    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);

    const delay = BASE_DELAY * Math.pow(2, attemptsRef.current - 1);
    emitReconnectAttempt({ consultationId, reason: 'connection_lost' });

    timerRef.current = setTimeout(() => {
      // Socket.io handles actual reconnect; we just track attempts
      if (!wasConnected.current) {
        attemptReconnect();
      }
    }, delay);
  }, [consultationId, emitReconnectAttempt]);

  const retryManually = useCallback(() => {
    setFailed(false);
    attemptsRef.current = 0;
    setAttempts(0);
    setIsReconnecting(true);
    attemptReconnect();
  }, [attemptReconnect]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { isReconnecting, attempts, failed, retryManually };
}
