'use client';

import { useState, useCallback } from 'react';

/**
 * Request and track camera + mic permissions.
 * Returns { permissions, request, error }.
 */
export function useDevicePermissions() {
  const [permissions, setPermissions] = useState({
    camera: 'prompt',   // 'prompt' | 'granted' | 'denied'
    microphone: 'prompt',
  });
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  const request = useCallback(async () => {
    setChecking(true);
    setError(null);

    const result = { camera: 'denied', microphone: 'denied' };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      stream.getTracks().forEach((t) => t.stop());
      result.camera = 'granted';
      result.microphone = 'granted';
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera and microphone access denied. Please allow access in browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera or microphone found. Please connect a device.');
      } else {
        setError(err.message || 'Failed to access devices.');
      }

      // Try audio-only fallback
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getTracks().forEach((t) => t.stop());
        result.microphone = 'granted';
      } catch {}
    }

    setPermissions(result);
    setChecking(false);
    return result;
  }, []);

  return { permissions, request, error, checking };
}