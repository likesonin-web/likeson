'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAnnouncementBand } from '@/utils/navigationUtils';

// Priority levels — higher = preempt lower
const PRIORITY = { LOW: 0, NORMAL: 1, HIGH: 2, CRITICAL: 3 };

export function useVoiceNavigation() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const queueRef        = useRef([]);        // { text, lang, priority, id }
  const isSpeakingRef   = useRef(false);
  const pausedRef       = useRef(false);
  const voicesRef       = useRef([]);
  const voicesReadyRef  = useRef(false);
  const currentUtterRef = useRef(null);
  const retryTimerRef   = useRef(null);

  // Per-maneuver per-step per-band dedup: key = `${stepIdx}_${bandKey}`
  const announcedBandsRef = useRef({});

  // Android Chrome workaround — synth sometimes silently locks up
  const synthWatchdogRef  = useRef(null);

  // ── Voice loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const load = () => {
      voicesRef.current    = window.speechSynthesis.getVoices();
      voicesReadyRef.current = voicesRef.current.length > 0;
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);

    // iOS Safari needs resume on user interaction to unlock audio
    const unlockAudio = () => {
      if (window.speechSynthesis?.paused) {
        window.speechSynthesis.resume();
      }
    };
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click',      unlockAudio, { once: true });

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('click', unlockAudio);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (synthWatchdogRef.current) clearInterval(synthWatchdogRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ── Android Chrome watchdog — detects stuck synth ─────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    synthWatchdogRef.current = setInterval(() => {
      if (!isSpeakingRef.current) return;
      // If synth claims speaking but has been stuck > 8s, cancel + recover
      if (window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        const elapsed = Date.now() - (currentUtterRef.current?._startTs || Date.now());
        if (elapsed > 8000) {
          window.speechSynthesis.cancel();
          isSpeakingRef.current = false;
          retryTimerRef.current = setTimeout(processQueue, 400);
        }
      }
    }, 2000);

    return () => clearInterval(synthWatchdogRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Select best voice ──────────────────────────────────────────────────────
  const selectVoice = useCallback((lang = 'en-IN') => {
    const voices = voicesRef.current;
    if (!voices.length) return undefined;

    // Telugu
    if (lang.startsWith('te')) {
      return voices.find(v => v.lang.startsWith('te'));
    }
    // English India preferred
    const enIN = voices.find(v => v.lang === 'en-IN');
    if (enIN) return enIN;

    // Female en-IN variants
    const enINLike = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('India') || v.name.includes('Raveena'))
    );
    if (enINLike) return enINLike;

    // Any English
    return voices.find(v => v.lang.startsWith('en'));
  }, []);

  // ── Process queue ──────────────────────────────────────────────────────────
  const processQueue = useCallback(() => {
    if (pausedRef.current || !queueRef.current.length) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (isSpeakingRef.current) return;

    const item = queueRef.current.shift();
    if (!item) return;

    const utter       = new SpeechSynthesisUtterance(item.text);
    utter.lang        = item.lang || 'en-IN';
    utter.rate        = 0.9;
    utter.pitch       = 1.0;
    utter.volume      = 1.0;
    utter.voice       = selectVoice(item.lang);
    utter._startTs    = Date.now();
    currentUtterRef.current = utter;

    isSpeakingRef.current = true;

    const finish = () => {
      isSpeakingRef.current   = false;
      currentUtterRef.current = null;
      retryTimerRef.current   = setTimeout(processQueue, 250);
    };

    utter.onend   = finish;
    utter.onerror = (e) => {
      // 'interrupted' is normal when we cancel — not a real error
      if (e.error !== 'interrupted') {
        console.warn('[Voice] error:', e.error);
      }
      finish();
    };

    try {
      window.speechSynthesis.cancel();         // clear any stuck utterance
      window.speechSynthesis.speak(utter);

      // Android Chrome sometimes needs a resume after speak
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (err) {
      console.warn('[Voice] speak failed:', err);
      finish();
    }
  }, [selectVoice]);

  // ── Core speak — priority queue with preemption ────────────────────────────
  const speak = useCallback((text, {
    priority = PRIORITY.NORMAL,
    lang     = 'en-IN',
    force    = false,
  } = {}) => {
    if (!text) return;
    if (!voiceEnabled && !force) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Deduplicate — don't queue same text twice in a row
    const last = queueRef.current[queueRef.current.length - 1];
    if (last?.text === text) return;

    // If new item has CRITICAL priority, preempt everything
    if (priority >= PRIORITY.CRITICAL) {
      queueRef.current = [];
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
    }

    // Drop lower-priority items if high-priority comes in
    if (priority >= PRIORITY.HIGH) {
      queueRef.current = queueRef.current.filter(q => q.priority >= PRIORITY.HIGH);
    }

    queueRef.current.push({ text, lang, priority, id: `${Date.now()}_${Math.random()}` });

    // Sort by priority descending
    queueRef.current.sort((a, b) => b.priority - a.priority);

    if (!isSpeakingRef.current) processQueue();
  }, [voiceEnabled, processQueue]);

  // ── Maneuver announcement — once per step per distance band ───────────────
  const announceManeuver = useCallback((instruction, distanceMeters, stepIndex = -1, speedKmh = 30) => {
    if (!instruction || distanceMeters == null) return;

    const band = getAnnouncementBand(distanceMeters, speedKmh);
    if (!band) return;

    const key = `${stepIndex}_${band.key}`;
    if (announcedBandsRef.current[key]) return;
    announcedBandsRef.current[key] = true;

    let text;
    if (band.key === 'now') {
      text = instruction;                           // "Turn left onto Main St"
    } else {
      text = `${band.prefix(distanceMeters)}, ${instruction.toLowerCase()}`;
    }

    const priority = band.key === 'now' ? PRIORITY.HIGH : PRIORITY.NORMAL;
    speak(text, { priority });
  }, [speak]);

  const resetManeuverBands = useCallback(() => {
    announcedBandsRef.current = {};
  }, []);

  const resetStepBands = useCallback((stepIndex) => {
    // Clear bands for a specific step only
    Object.keys(announcedBandsRef.current).forEach(k => {
      if (k.startsWith(`${stepIndex}_`)) {
        delete announcedBandsRef.current[k];
      }
    });
  }, []);

  // ── Arrival ────────────────────────────────────────────────────────────────
  const announceArrival = useCallback((target = 'destination') => {
    const text = target === 'pickup'
      ? 'You have arrived at the pickup location.'
      : 'You have arrived at your destination.';
    speak(text, { priority: PRIORITY.CRITICAL, force: true });
  }, [speak]);

  // ── Rerouting ──────────────────────────────────────────────────────────────
  const announceRerouting = useCallback(() => {
    speak('Recalculating route.', { priority: PRIORITY.CRITICAL, force: true });
  }, [speak]);

  // ── Roundabout ────────────────────────────────────────────────────────────
  const announceRoundabout = useCallback((exitNumber) => {
    const text = exitNumber
      ? `At the roundabout, take exit ${exitNumber}.`
      : 'Enter the roundabout.';
    speak(text, { priority: PRIORITY.HIGH });
  }, [speak]);

  // ── Pause / resume ─────────────────────────────────────────────────────────
  const pauseSpeaking = useCallback(() => {
    pausedRef.current = true;
    queueRef.current  = [];
    window.speechSynthesis?.cancel();
    isSpeakingRef.current = false;
  }, []);

  const resumeSpeaking = useCallback(() => {
    pausedRef.current = false;
    processQueue();
  }, [processQueue]);

  // ── Toggle voice ───────────────────────────────────────────────────────────
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
    announceRoundabout,
    pauseSpeaking,
    resumeSpeaking,
    resetManeuverBands,
    resetStepBands,
    PRIORITY,
  };
}