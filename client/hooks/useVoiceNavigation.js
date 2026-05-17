'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * useVoiceNavigation
 * Browser SpeechSynthesis wrapper for turn-by-turn navigation.
 * Supports Telugu + English.
 *
 * FIXES:
 * - No cancellation mid-speech (queue instead of cancel)
 * - Throttle per unique text AND per-maneuver distance bucket
 * - announceManeuver fires once per distance band (300m, 100m, now)
 * - voices loaded async via onvoiceschanged — no empty array race
 * - isSpeaking guard prevents queue pile-up
 */
export function useVoiceNavigation() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Queue: array of { text, lang, force }
  const queueRef           = useRef([]);
  const isSpeakingRef      = useRef(false);
  const pausedRef          = useRef(false);
  const voicesRef          = useRef([]);
  const voicesReadyRef     = useRef(false);

  // Per-maneuver distance band tracking to prevent re-announcements
  // key = stepIndex, value = last band spoken ('300' | '100' | 'now')
  const maneuverBandRef    = useRef({});

  // Last spoken for dedup
  const lastSpokenTextRef  = useRef('');
  const lastSpokenAtRef    = useRef(0);

  // ── Voice loading ──────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      voicesReadyRef.current = true;
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  // ── Process queue ──────────────────────────────────────────
  const processQueue = useCallback(() => {
    if (isSpeakingRef.current || pausedRef.current || !queueRef.current.length) return;
    if (!window.speechSynthesis) return;

    const { text, lang } = queueRef.current.shift();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang   = lang;
    utter.rate   = 0.92;
    utter.pitch  = 1.0;
    utter.volume = 1.0;

    // Prefer en-IN; fallback to any English
    const voices     = voicesRef.current;
    const enIN       = voices.find(v => v.lang === 'en-IN');
    const enFallback = voices.find(v => v.lang.startsWith('en'));
    const teVoice    = voices.find(v => v.lang.startsWith('te'));

    if (lang.startsWith('te') && teVoice) utter.voice = teVoice;
    else if (enIN) utter.voice = enIN;
    else if (enFallback) utter.voice = enFallback;

    isSpeakingRef.current = true;

    utter.onend = utter.onerror = () => {
      isSpeakingRef.current = false;
      // Process next after brief pause
      setTimeout(processQueue, 300);
    };

    try {
      window.speechSynthesis.speak(utter);
    } catch (e) {
      isSpeakingRef.current = false;
    }
  }, []);

  // ── Core speak ─────────────────────────────────────────────
  const speak = useCallback((text, { force = false, lang = 'en-IN' } = {}) => {
    if (!voiceEnabled && !force) return;
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;

    const now = Date.now();

    // Dedup: same text within 20s → skip unless forced
    if (
      !force &&
      text === lastSpokenTextRef.current &&
      now - lastSpokenAtRef.current < 20_000
    ) return;

    // Don't pile identical items in queue
    if (queueRef.current.some(q => q.text === text)) return;

    lastSpokenTextRef.current = text;
    lastSpokenAtRef.current   = now;

    queueRef.current.push({ text, lang, force });
    processQueue();
  }, [voiceEnabled, processQueue]);

  // ── Maneuver announcement (once per distance band per step) ─
  const announceManeuver = useCallback((instruction, distanceMeters, stepIndex = -1) => {
    if (!instruction) return;

    // Determine band
    let band;
    if (distanceMeters > 400) band = '500';
    else if (distanceMeters > 150) band = '300';
    else if (distanceMeters > 50)  band = '100';
    else                            band = 'now';

    const bandKey = `${stepIndex}_${band}`;

    // Already spoken this band for this step → skip
    if (maneuverBandRef.current[bandKey]) return;
    maneuverBandRef.current[bandKey] = true;

    let text;
    if (band === '500') text = `In ${Math.round(distanceMeters / 100) * 100} meters, ${instruction}`;
    else if (band === '300') text = `In 300 meters, ${instruction}`;
    else if (band === '100') text = `In 100 meters, ${instruction}`;
    else text = instruction;

    speak(text);
  }, [speak]);

  const resetManeuverBands = useCallback(() => {
    maneuverBandRef.current = {};
  }, []);

  const announceArrival = useCallback((target = 'destination') => {
    const text = target === 'pickup'
      ? 'You have arrived at the pickup location'
      : 'You have arrived at the destination';
    speak(text, { force: true });
  }, [speak]);

  const announceRerouting = useCallback(() => {
    // Clear queue, cancel current, say rerouting
    queueRef.current = [];
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
    }
    pausedRef.current = true;
    speak('Recalculating route', { force: true });
    setTimeout(() => {
      pausedRef.current = false;
      processQueue();
    }, 3500);
  }, [speak, processQueue]);

  const pauseSpeaking = useCallback(() => {
    pausedRef.current = true;
    queueRef.current  = [];
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
    }
  }, []);

  const resumeSpeaking = useCallback(() => {
    pausedRef.current = false;
    processQueue();
  }, [processQueue]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      if (prev) {
        // Turning off: clear everything
        queueRef.current = [];
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          isSpeakingRef.current = false;
        }
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
  };
}