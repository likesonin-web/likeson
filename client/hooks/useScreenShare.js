'use client';
import { useState, useRef, useCallback } from 'react';
import { useConsultation } from '@/providers/ConsultationSocketProvider';
import toast from 'react-hot-toast';

/**
 * useScreenShare — FIXED
 *
 * BUG: Received `client` (state snapshot) and `localVideoTrack` (state snapshot)
 *   — both could be null/stale when screen share button clicked because:
 *   a) client state lags behind clientRef in useAgoraRoom
 *   b) localVideoTrack captured at hook init, stale if cam re-creates
 *
 * FIX: Accept clientRef (always live) and full localTracks object.
 *   Read .current at call time, never at hook init.
 */
export function useScreenShare(clientRef, localTracks, consultationId, screenUid) {
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const screenTrackRef = useRef(null);

  const { emitScreenShareStart, emitScreenShareStop } = useConsultation();

  const startScreenShare = useCallback(async () => {
    const client = clientRef?.current ?? clientRef; // support both ref and direct client
    if (!client || isSharing || isLoading) return;
    setIsLoading(true);
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

      const screenTrack = await AgoraRTC.createScreenVideoTrack(
        { encoderConfig: '1080p_1', optimizationMode: 'detail' },
        'disable' // no audio
      );

      // Unpublish camera track if currently published
      const camTrack = localTracks?.localVideoTrack;
      if (camTrack) {
        try { await client.unpublish([camTrack]); } catch { /* not published yet — fine */ }
      }

      const tracks = Array.isArray(screenTrack) ? screenTrack : [screenTrack];
      await client.publish(tracks);
      screenTrackRef.current = screenTrack;
      setIsSharing(true);
      emitScreenShareStart({ consultationId });

      // Browser native stop button
      const mainTrack = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
      mainTrack?.on('track-ended', () => stopScreenShare());

    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        toast.error(`Screen share failed: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientRef, isSharing, isLoading, consultationId, localTracks]);

  const stopScreenShare = useCallback(async () => {
    const client = clientRef?.current ?? clientRef;
    const track  = screenTrackRef.current;
    if (!client || !track) return;
    try {
      const tracks = Array.isArray(track) ? track : [track];
      await client.unpublish(tracks);
      tracks.forEach((t) => t.close());
      screenTrackRef.current = null;

      // Re-publish camera
      const camTrack = localTracks?.localVideoTrack;
      if (camTrack) {
        try { await client.publish([camTrack]); } catch (e) {
          console.warn('[ScreenShare] cam re-publish failed:', e.message);
        }
      }

      setIsSharing(false);
      emitScreenShareStop({ consultationId });
    } catch (err) {
      toast.error(`Stop screen share failed: ${err.message}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientRef, consultationId, localTracks]);

  const toggleScreenShare = useCallback(() => {
    return isSharing ? stopScreenShare() : startScreenShare();
  }, [isSharing, startScreenShare, stopScreenShare]);

  return { isSharing, isLoading, toggleScreenShare, startScreenShare, stopScreenShare };
}