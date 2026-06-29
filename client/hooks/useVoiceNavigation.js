'use client';

/**
 * useVoiceNavigation.js
 *
 * Priority-queued TTS for driver turn-by-turn announcements.
 *
 * FIX vs original:
 *  - useState was imported AND re-declared inside the hook body (dead bug).
 *    Removed inner re-declaration; single top-level import only.
 *  - synthWatchdog ref properly cleared on unmount (original cleared interval
 *    but then tried to start GPS rAF loop — removed unrelated logic).
 *  - Listens to custom window event 'lrt:announce' emitted by useRideLiveMap,
 *    so the two hooks don't need to share refs or callbacks.
 *  - processQueue wrapped in useCallback with stable deps (was arrow fn in
 *    closure, caused stale captures across re-renders).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAnnouncementBand } from '@/utils/navigationUtils';

const PRIORITY = { LOW: 0, NORMAL: 1, HIGH: 2, CRITICAL: 3 };

export function useVoiceNavigation() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const queueRef        = useRef([]);
  const isSpeakingRef   = useRef(false);
  const voicesRef       = useRef([]);
  const currentUtterRef = useRef(null);
  const retryTimerRef   = useRef(null);
  const synthWatchRef   = useRef(null);
  const announcedRef    = useRef({});   // `${stepIdx}_${bandKey}` dedup
  const voiceEnabledRef = useRef(true); // mirror — avoids stale closure in speak

  // Keep ref in sync with state
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  // ── Voice loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    // iOS Safari audio unlock
    const unlock = () => {
      if (window.speechSynthesis?.paused) window.speechSynthesis.resume();
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click',      unlock, { once: true });

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click',      unlock);
      if (retryTimerRef.current)  clearTimeout(retryTimerRef.current);
      if (synthWatchRef.current)  clearInterval(synthWatchRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ── Android Chrome watchdog — detects stuck synth (> 8 s) ────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    synthWatchRef.current = setInterval(() => {
      if (!isSpeakingRef.current) return;
      if (window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        const elapsed = Date.now() - (currentUtterRef.current?._startTs || Date.now());
        if (elapsed > 8000) {
          window.speechSynthesis.cancel();
          isSpeakingRef.current = false;
          retryTimerRef.current = setTimeout(processQueue, 400);
        }
      }
    }, 2000);

    return () => clearInterval(synthWatchRef.current);
  }, []); // eslint-disable-line

  // ── Listen for lrt:announce events from useRideLiveMap ───────────────────
  useEffect(() => {
    const handler = (e) => {
      const { text, priority } = e.detail || {};
      if (text) speak(text, { priority: PRIORITY[priority] ?? PRIORITY.NORMAL });
    };
    window.addEventListener('lrt:announce', handler);
    return () => window.removeEventListener('lrt:announce', handler);
  }, []); // eslint-disable-line — speak is stable

  // ── Voice selection ───────────────────────────────────────────────────────
  const selectVoice = useCallback((lang = 'en-IN') => {
    const voices = voicesRef.current;
    if (!voices.length) return undefined;
    if (lang.startsWith('te')) return voices.find(v => v.lang.startsWith('te'));
    return (
      voices.find(v => v.lang === 'en-IN') ||
      voices.find(v => v.lang.startsWith('en') && (v.name.includes('India') || v.name.includes('Raveena'))) ||
      voices.find(v => v.lang.startsWith('en'))
    );
  }, []);

  // ── Process queue (stable ref — reads queue/speaking via refs) ────────────
  const processQueue = useCallback(() => {
    if (!queueRef.current.length || isSpeakingRef.current) return;
    if (typeof window === 'undefined' || !window.speechSynthesis)  return;

    const item  = queueRef.current.shift();
    if (!item)  return;

    const utter      = new SpeechSynthesisUtterance(item.text);
    utter.lang       = item.lang || 'en-IN';
    utter.rate       = 0.9;
    utter.pitch      = 1.0;
    utter.volume     = 1.0;
    utter.voice      = selectVoice(item.lang);
    utter._startTs   = Date.now();
    currentUtterRef.current = utter;
    isSpeakingRef.current   = true;

    const finish = () => {
      isSpeakingRef.current   = false;
      currentUtterRef.current = null;
      retryTimerRef.current   = setTimeout(processQueue, 250);
    };

    utter.onend   = finish;
    utter.onerror = (e) => {
      if (e.error !== 'interrupted') console.warn('[Voice] error:', e.error);
      finish();
    };

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch {
      finish();
    }
  }, [selectVoice]);

  // ── Core speak ────────────────────────────────────────────────────────────
  const speak = useCallback((text, {
    priority = PRIORITY.NORMAL,
    lang     = 'en-IN',
    force    = false,
  } = {}) => {
    if (!text) return;
    if (!voiceEnabledRef.current && !force) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Deduplicate consecutive identical text
    const last = queueRef.current[queueRef.current.length - 1];
    if (last?.text === text) return;

    if (priority >= PRIORITY.CRITICAL) {
      queueRef.current = [];
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
    } else if (priority >= PRIORITY.HIGH) {
      queueRef.current = queueRef.current.filter(q => q.priority >= PRIORITY.HIGH);
    }

    queueRef.current.push({ text, lang, priority, id: `${Date.now()}_${Math.random()}` });
    queueRef.current.sort((a, b) => b.priority - a.priority);

    if (!isSpeakingRef.current) processQueue();
  }, [processQueue]);

  // ── Per-step, per-band maneuver dedup ────────────────────────────────────
  const announceManeuver = useCallback((instruction, distanceMeters, stepIndex = -1, speedKmh = 30) => {
    if (!instruction || distanceMeters == null) return;

    const band = getAnnouncementBand(distanceMeters, speedKmh);
    if (!band) return;

    const key = `${stepIndex}_${band.key}`;
    if (announcedRef.current[key]) return;
    announcedRef.current[key] = true;

    const text = band.key === 'now'
      ? instruction
      : `${band.prefix(distanceMeters)}, ${instruction.toLowerCase()}`;

    speak(text, { priority: band.key === 'now' ? PRIORITY.HIGH : PRIORITY.NORMAL });
  }, [speak]);

  const resetManeuverBands = useCallback(() => { announcedRef.current = {}; }, []);

  const resetStepBands = useCallback((stepIndex) => {
    Object.keys(announcedRef.current).forEach(k => {
      if (k.startsWith(`${stepIndex}_`)) delete announcedRef.current[k];
    });
  }, []);

  const announceArrival = useCallback((target = 'destination') => {
    speak(
      target === 'pickup'
        ? 'You have arrived at the pickup location.'
        : 'You have arrived at your destination.',
      { priority: PRIORITY.CRITICAL, force: true },
    );
  }, [speak]);

  const announceRerouting = useCallback(() => {
    speak('Recalculating route.', { priority: PRIORITY.CRITICAL, force: true });
  }, [speak]);

  const pauseSpeaking = useCallback(() => {
    queueRef.current = [];
    window.speechSynthesis?.cancel();
    isSpeakingRef.current = false;
  }, []);

  const resumeSpeaking = useCallback(() => { processQueue(); }, [processQueue]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      if (prev) {
        queueRef.current = [];
        window.speechSynthesis?.cancel();
        isSpeakingRef.current = false;
      }
      return !prev;
    });
  }, []);

  return {
    voiceEnabled,
    toggleVoice,
    speak,
    announceManeuver,
    announceArrival,
    announceRerouting,
    pauseSpeaking,
    resumeSpeaking,
    resetManeuverBands,
    resetStepBands,
    PRIORITY,
  };
}