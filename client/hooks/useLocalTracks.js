'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectRtIsMuted } from '@/store/slices/consultationSlice';
import toast from 'react-hot-toast';

/**
 * useLocalTracks
 * Manages local mic + camera Agora tracks.
 * Handles forced mute from host via Redux rtIsMuted.
 */
export function useLocalTracks() {
  const dispatch   = useDispatch();
  const rtIsMuted  = useSelector(selectRtIsMuted);

  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [isMicOn,  setIsMicOn]  = useState(true);
  const [isCamOn,  setIsCamOn]  = useState(true);
  const [isReady,  setIsReady]  = useState(false);
  const [permError, setPermError] = useState(null);

  const audioRef = useRef(null);
  const videoRef = useRef(null);

  // Create tracks on mount
  useEffect(() => {
    let mounted = true;

    const initTracks = async () => {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

        const [audio, video] = await Promise.all([
          AgoraRTC.createMicrophoneAudioTrack(),
          AgoraRTC.createCameraVideoTrack(),
        ]);

        if (!mounted) {
          audio.close();
          video.close();
          return;
        }

        audioRef.current = audio;
        videoRef.current = video;
        setLocalAudioTrack(audio);
        setLocalVideoTrack(video);
        setIsReady(true);
      } catch (err) {
        if (!mounted) return;
        const isPermError =
          err.name === 'NotAllowedError' ||
          err.message?.includes('Permission') ||
          err.message?.includes('NotAllowed');
        setPermError(isPermError ? 'permission' : err.message);
        toast.error(
          isPermError
            ? 'Camera/mic permission denied. Please allow access and reload.'
            : `Media error: ${err.message}`
        );
      }
    };

    initTracks();

    return () => {
      mounted = false;
      audioRef.current?.close();
      videoRef.current?.close();
    };
  }, []);

  // React to host-forced mute
  useEffect(() => {
    if (rtIsMuted && audioRef.current) {
      audioRef.current.setEnabled(false);
      setIsMicOn(false);
      toast('You were muted by the host', { icon: '🔇' });
    }
  }, [rtIsMuted]);

  const toggleMic = useCallback(async () => {
    if (!audioRef.current) return;
    const next = !isMicOn;
    await audioRef.current.setEnabled(next);
    setIsMicOn(next);
  }, [isMicOn]);

  const toggleCam = useCallback(async () => {
    if (!videoRef.current) return;
    const next = !isCamOn;
    await videoRef.current.setEnabled(next);
    setIsCamOn(next);
  }, [isCamOn]);

  return {
    localAudioTrack,
    localVideoTrack,
    isMicOn,
    isCamOn,
    isReady,
    permError,
    toggleMic,
    toggleCam,
  };
}
