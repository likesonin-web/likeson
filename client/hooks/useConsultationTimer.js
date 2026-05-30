import { useEffect, useRef, useState, useCallback } from 'react';

const STORAGE_KEY = (id) => `consult_timer_${id}`;

/**
 * Persists timer state across leave/rejoin via localStorage.
 * Reads elapsed on mount. Pauses on leave (beforeunload).
 * Resumes from stored elapsed when rejoining.
 */
export default function useConsultationTimer({ consultationId, isActive, actualStartTime }) {
  const [elapsed, setElapsed]   = useState(0);    // seconds
  const [running, setRunning]   = useState(false);
  const intervalRef = useRef(null);
  const startRef    = useRef(null); // monotonic start = Date.now() - elapsed_at_start

  // On mount: restore from storage or compute from actualStartTime
  useEffect(() => {
    if (!consultationId) return;

    const stored = localStorage.getItem(STORAGE_KEY(consultationId));
    if (stored) {
      const { elapsed: savedElapsed, pausedAt } = JSON.parse(stored);
      // If we stored a pausedAt, use that elapsed directly
      setElapsed(savedElapsed || 0);
      startRef.current = Date.now() - (savedElapsed || 0) * 1000;
    } else if (actualStartTime) {
      // Compute from server start time
      const serverElapsed = Math.floor((Date.now() - new Date(actualStartTime).getTime()) / 1000);
      setElapsed(Math.max(0, serverElapsed));
      startRef.current = new Date(actualStartTime).getTime();
    }
  }, [consultationId, actualStartTime]);

  // Start/stop ticker based on isActive
  useEffect(() => {
    if (isActive) {
      if (!startRef.current) {
        startRef.current = Date.now() - elapsed * 1000;
      }
      setRunning(true);
      intervalRef.current = setInterval(() => {
        const newElapsed = Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(newElapsed);
        // Persist every 5s
        if (newElapsed % 5 === 0) {
          localStorage.setItem(STORAGE_KEY(consultationId), JSON.stringify({ elapsed: newElapsed }));
        }
      }, 1000);
    } else {
      setRunning(false);
      clearInterval(intervalRef.current);
      // Persist paused state
      if (consultationId) {
        localStorage.setItem(STORAGE_KEY(consultationId), JSON.stringify({ elapsed, pausedAt: Date.now() }));
      }
    }
    return () => clearInterval(intervalRef.current);
  }, [isActive, consultationId]);

  // Save on page leave
  useEffect(() => {
    const save = () => {
      if (consultationId) {
        localStorage.setItem(STORAGE_KEY(consultationId), JSON.stringify({ elapsed, pausedAt: Date.now() }));
      }
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [consultationId, elapsed]);

  // Cleanup storage when consultation ends
  const clearTimer = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY(consultationId));
    setElapsed(0);
    setRunning(false);
    clearInterval(intervalRef.current);
  }, [consultationId]);

  const format = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };

  return { elapsed, running, display: format(elapsed), clearTimer };
}