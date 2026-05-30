'use client';
import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = (id) => `consult_timer_${id}`;

/**
 * useCallTimer
 * - Computes elapsed from actualStartTime (server source of truth)
 * - Persists elapsed to localStorage on paused/leave
 * - Restores elapsed on rejoin so timer resumes from where it left
 * - running=false → pauses tick but keeps last elapsed value
 */
export function useCallTimer(startTime = null, running = true, consultationId = null) {
  const computeElapsed = () => {
    if (!startTime) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
  };

  const [elapsed, setElapsed] = useState(() => {
    // Restore from storage on mount (handles rejoin)
    if (consultationId) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY(consultationId));
        if (raw) {
          const { elapsed: saved } = JSON.parse(raw);
          // If we have a real startTime, compute fresh — storage is fallback only
          return startTime ? computeElapsed() : (saved || 0);
        }
      } catch { /* ignore */ }
    }
    return computeElapsed();
  });

  const intervalRef = useRef(null);

  // Sync elapsed when startTime arrives from server (async)
  useEffect(() => {
    if (startTime) {
      setElapsed(computeElapsed());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime]);

  // Tick
  useEffect(() => {
    clearInterval(intervalRef.current);

    if (running && startTime) {
      intervalRef.current = setInterval(() => {
        const next = Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
        setElapsed(next);
        // Persist every 5s
        if (consultationId && next % 5 === 0) {
          try {
            localStorage.setItem(STORAGE_KEY(consultationId), JSON.stringify({ elapsed: next }));
          } catch { /* ignore */ }
        }
      }, 1000);
    } else if (!running && consultationId) {
      // Persist paused state
      try {
        localStorage.setItem(STORAGE_KEY(consultationId), JSON.stringify({ elapsed }));
      } catch { /* ignore */ }
    }

    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, startTime, consultationId]);

  // Save on tab close/navigation
  useEffect(() => {
    if (!consultationId) return;
    const save = () => {
      try {
        localStorage.setItem(STORAGE_KEY(consultationId), JSON.stringify({ elapsed }));
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [consultationId, elapsed]);

  const format = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  return { elapsed, formatted: format(elapsed) };
}