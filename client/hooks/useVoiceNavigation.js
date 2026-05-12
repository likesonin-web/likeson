'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * useVoiceNavigation
 * Browser SpeechSynthesis wrapper for turn-by-turn navigation.
 * Supports Telugu + English. Throttles duplicate announcements.
 */
export function useVoiceNavigation() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const lastSpokenRef = useRef('');
  const lastSpokenAtRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const pausedRef = useRef(false);

  const speak = useCallback((text, { force = false, lang = 'en-IN' } = {}) => {
    if (!voiceEnabled && !force) return;
    if (pausedRef.current) return;
    if (!window.speechSynthesis) return;

    const now = Date.now();
    // Throttle: same text within 30s = skip
    if (!force && text === lastSpokenRef.current && now - lastSpokenAtRef.current < 30_000) return;

    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.volume = 1.0;

    // Try Telugu voice first if available
    const voices = window.speechSynthesis.getVoices();
    const teluguVoice = voices.find(v => v.lang.startsWith('te'));
    const englishInVoice = voices.find(v => v.lang === 'en-IN');
    if (teluguVoice && lang.startsWith('te')) utter.voice = teluguVoice;
    else if (englishInVoice) utter.voice = englishInVoice;

    utter.onstart = () => { isSpeakingRef.current = true; };
    utter.onend = () => { isSpeakingRef.current = false; };
    utter.onerror = () => { isSpeakingRef.current = false; };

    lastSpokenRef.current = text;
    lastSpokenAtRef.current = now;

    window.speechSynthesis.speak(utter);
  }, [voiceEnabled]);

  const announceManeuver = useCallback((instruction, distanceMeters) => {
    if (!instruction) return;
    let text = '';
    if (distanceMeters > 500) {
      text = `In ${Math.round(distanceMeters / 100) * 100} meters, ${instruction}`;
    } else if (distanceMeters > 100) {
      text = `In ${distanceMeters} meters, ${instruction}`;
    } else {
      text = instruction;
    }
    speak(text);
  }, [speak]);

  const announceArrival = useCallback((target = 'destination') => {
    speak(`You have arrived at your ${target}`, { force: true });
  }, [speak]);

  const announceRerouting = useCallback(() => {
    pausedRef.current = true;
    speak('Recalculating route', { force: true });
    setTimeout(() => { pausedRef.current = false; }, 4000);
  }, [speak]);

  const pauseSpeaking = useCallback(() => {
    pausedRef.current = true;
    window.speechSynthesis?.cancel();
  }, []);

  const resumeSpeaking = useCallback(() => {
    pausedRef.current = false;
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      if (prev) window.speechSynthesis?.cancel();
      return !prev;
    });
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
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
  };
}