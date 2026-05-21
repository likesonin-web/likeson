/**
 * useSessionTimer.js
 * Counts up from consultation start, warns at thresholds, auto-ends.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TIMER_WARNINGS, TIMER_TICK_MS } from '@/utils/constants';
import { clearTimers } from '@/utils/cleanup';

/**
 * @param {object} params
 * @param {string|null} params.startedAt        - ISO string when consultation started
 * @param {number}      params.allowedMinutes   - max duration in minutes
 * @param {boolean}     params.isLive           - only tick when live
 * @param {Function}    params.onWarning        - (minutesLeft: number) => void
 * @param {Function}    params.onExpire         - () => void
 */
export function useSessionTimer({ startedAt, allowedMinutes, isLive, onWarning, onExpire }) {
  const [elapsedSeconds, setElapsedSeconds]   = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(allowedMinutes * 60);
  const [warnedThresholds, setWarnedThresholds] = useState(new Set());

  const intervalRef      = useRef(null);
  const warnedRef        = useRef(new Set());
  const onWarningRef     = useRef(onWarning);
  const onExpireRef      = useRef(onExpire);
  const expiredRef       = useRef(false);

  // Keep callbacks stable
  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);
  useEffect(() => { onExpireRef.current  = onExpire;  }, [onExpire]);

  const tick = useCallback(() => {
    if (!startedAt) return;

    const start    = new Date(startedAt).getTime();
    const nowMs    = Date.now();
    const elapsed  = Math.floor((nowMs - start) / 1000);
    const allowed  = allowedMinutes * 60;
    const remaining = Math.max(0, allowed - elapsed);

    setElapsedSeconds(elapsed);
    setRemainingSeconds(remaining);

    // Check warning thresholds
    const remainingMins = Math.ceil(remaining / 60);
    for (const threshold of TIMER_WARNINGS) {
      if (remainingMins <= threshold && !warnedRef.current.has(threshold)) {
        warnedRef.current.add(threshold);
        setWarnedThresholds(new Set(warnedRef.current));
        onWarningRef.current?.(threshold);
      }
    }

    // Expired
    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current?.();
    }
  }, [startedAt, allowedMinutes]);

  useEffect(() => {
    if (!isLive || !startedAt) {
      clearTimers(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    // Reset on new session
    expiredRef.current = false;
    warnedRef.current  = new Set();
    setWarnedThresholds(new Set());

    tick(); // immediate first tick
    intervalRef.current = setInterval(tick, TIMER_TICK_MS);

    return () => clearTimers(intervalRef.current);
  }, [isLive, startedAt, tick]);

  const formatTime = useCallback((totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, []);

  return {
    elapsedSeconds,
    remainingSeconds,
    elapsedFormatted:   formatTime(elapsedSeconds),
    remainingFormatted: formatTime(remainingSeconds),
    isExpired:          expiredRef.current,
    warnedThresholds,
    percentUsed: allowedMinutes > 0
      ? Math.min(100, (elapsedSeconds / (allowedMinutes * 60)) * 100)
      : 0,
  };
}