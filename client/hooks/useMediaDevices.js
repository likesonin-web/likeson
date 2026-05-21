/**
 * useMediaDevices.js
 * Enumerate cameras/mics/speakers. No stream leaks.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { stopMediaStream } from '@/utils/cleanup';

export function useMediaDevices() {
  const [cameras,         setCameras]         = useState([]);
  const [microphones,     setMicrophones]     = useState([]);
  const [speakers,        setSpeakers]        = useState([]);
  const [selectedCamera,  setSelectedCamera]  = useState('');
  const [selectedMic,     setSelectedMic]     = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [permError,       setPermError]       = useState(null);

  const probeStreamRef = useRef(null);

  const enumerate = useCallback(async () => {
    try {
      // Request temp stream to unlock device labels
      if (!probeStreamRef.current) {
        probeStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: true, audio: true,
        });
      }

      const devices = await navigator.mediaDevices.enumerateDevices();

      const cams  = devices.filter((d) => d.kind === 'videoinput');
      const mics  = devices.filter((d) => d.kind === 'audioinput');
      const spkrs = devices.filter((d) => d.kind === 'audiooutput');

      setCameras(cams);
      setMicrophones(mics);
      setSpeakers(spkrs);

      // Set defaults
      if (cams.length  && !selectedCamera)  setSelectedCamera(cams[0].deviceId);
      if (mics.length  && !selectedMic)     setSelectedMic(mics[0].deviceId);
      if (spkrs.length && !selectedSpeaker) setSelectedSpeaker(spkrs[0].deviceId);

      setPermError(null);
    } catch (err) {
      setPermError(err.name === 'NotAllowedError'
        ? 'Camera/microphone permission denied.'
        : err.message);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    enumerate();

    const handler = () => enumerate();
    navigator.mediaDevices?.addEventListener('devicechange', handler);

    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handler);
      // Stop probe stream — never keep camera active after unmount
      stopMediaStream(probeStreamRef.current);
      probeStreamRef.current = null;
    };
  }, []); // eslint-disable-line

  return {
    cameras,
    microphones,
    speakers,
    selectedCamera,
    selectedMic,
    selectedSpeaker,
    setSelectedCamera,
    setSelectedMic,
    setSelectedSpeaker,
    permError,
    enumerate,
  };
}