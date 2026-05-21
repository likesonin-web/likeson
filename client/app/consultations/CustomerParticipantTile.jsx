'use client';
/**
 * CustomerParticipantTile.jsx
 * Renders a single VideoSDK participant's video + audio.
 *
 * Critical bug prevention:
 * - Never re-attach stream to same element
 * - Stop tracks on unmount
 * - Dedupe audio elements
 * - Stable ref usage
 * - Memoized
 */

import React, {
  memo,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { motion } from 'framer-motion';
import { MicOff, Video, VideoOff, User } from 'lucide-react';

/**
 * @param {{
 *   participantId: string,
 *   isDoctor?: boolean,
 *   isSelf?: boolean,
 *   isCamOn?: boolean,
 *   isSpeakerOn?: boolean,
 *   isDoctorPresent?: boolean,
 *   className?: string,
 * }} props
 */
function CustomerParticipantTile({
  participantId,
  isDoctor    = false,
  isSelf      = false,
  isCamOn     = true,
  isSpeakerOn = true,
  isDoctorPresent = true,
  className   = '',
}) {
  const videoRef    = useRef(null);
  const audioRef    = useRef(null);
  const streamRef   = useRef(null);
  const mountedRef  = useRef(true);

  const [videoOn,    setVideoOn]    = useState(false);
  const [audioOn,    setAudioOn]    = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);

  // ── Lazy VideoSDK hook ─────────────────────────────────────────────────
  const [useParticipant, setUseParticipant] = useState(null);

  useEffect(() => {
    import('@videosdk.live/react-sdk').then((mod) => {
      if (mountedRef.current) setUseParticipant(() => mod.useParticipant);
    });
    return () => { mountedRef.current = false; };
  }, []);

  // ── Participant hook ───────────────────────────────────────────────────
  // We can't call hooks conditionally, so we use a wrapper component pattern.
  return useParticipant
    ? <TileWithHook
        participantId={participantId}
        isDoctor={isDoctor}
        isSelf={isSelf}
        isSpeakerOn={isSpeakerOn}
        isDoctorPresent={isDoctorPresent}
        className={className}
        useParticipant={useParticipant}
      />
    : <TileSkeleton className={className} />;
}

// ── Inner component — safe to call useParticipant ──────────────────────────

const TileWithHook = memo(function TileWithHook({
  participantId,
  isDoctor,
  isSelf,
  isSpeakerOn,
  isDoctorPresent,
  className,
  useParticipant,
}) {
  const videoRef  = useRef(null);
  const audioRef  = useRef(null);
  const mounted   = useRef(true);
  const attachedVideoStream = useRef(null);
  const attachedAudioStream = useRef(null);

  const { webcamStream, micStream, webcamOn, micOn, displayName } =
    useParticipant(participantId, {
      onStreamEnabled:  () => {},
      onStreamDisabled: () => {},
    });

  // ── Attach video stream ────────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current) return;
    if (!webcamStream) {
      videoRef.current.srcObject = null;
      attachedVideoStream.current = null;
      return;
    }
    // Prevent re-attach of same stream
    if (attachedVideoStream.current === webcamStream) return;

    const mediaStream = new MediaStream();
    webcamStream.track && mediaStream.addTrack(webcamStream.track);
    videoRef.current.srcObject = mediaStream;
    attachedVideoStream.current = webcamStream;

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      // Stop tracks on unmount
      mediaStream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
      attachedVideoStream.current = null;
    };
  }, [webcamStream]);

  // ── Attach audio stream ────────────────────────────────────────────────
  useEffect(() => {
    if (!audioRef.current || isSelf) return; // never play self audio
    if (!micStream) {
      audioRef.current.srcObject = null;
      attachedAudioStream.current = null;
      return;
    }
    if (attachedAudioStream.current === micStream) return;

    const mediaStream = new MediaStream();
    micStream.track && mediaStream.addTrack(micStream.track);
    audioRef.current.srcObject = mediaStream;
    audioRef.current.muted = !isSpeakerOn;
    attachedAudioStream.current = micStream;

    return () => {
      if (audioRef.current) audioRef.current.srcObject = null;
      mediaStream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
      attachedAudioStream.current = null;
    };
  }, [micStream, isSelf, isSpeakerOn]);

  // ── Speaker on/off ─────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = !isSpeakerOn;
  }, [isSpeakerOn]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (videoRef.current) videoRef.current.srcObject = null;
      if (audioRef.current) audioRef.current.srcObject = null;
    };
  }, []);

  const label = isSelf ? 'You' : (displayName ?? (isDoctor ? 'Doctor' : 'Participant'));

  return (
    <div className={`relative bg-base-300/50 overflow-hidden ${className}`}>
      {/* Video element */}
      {webcamOn && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={`w-full h-full object-cover ${isSelf ? 'scale-x-[-1]' : ''}`}
        />
      )}

      {/* Audio element (hidden, never for self) */}
      {!isSelf && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          data-remote="true"
          data-participant={participantId}
          style={{ display: 'none' }}
        />
      )}

      {/* No video placeholder */}
      {!webcamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2
                        bg-gradient-to-br from-base-200 to-base-300">
          <div className="w-12 h-12 rounded-full bg-base-300 border border-base-300/70
                          flex items-center justify-center">
            {isDoctor
              ? <span className="text-primary font-bold text-sm">Dr</span>
              : <User size={18} className="text-base-content/40" />
            }
          </div>
          <span className="text-xs text-base-content/50">{label}</span>
        </div>
      )}

      {/* Name + mic badge */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className="text-xs font-medium text-white bg-black/50 px-2 py-0.5 rounded-full
                         backdrop-blur-sm">
          {label}
        </span>
        {!micOn && (
          <div className="w-5 h-5 rounded-full bg-error/80 flex items-center justify-center">
            <MicOff size={10} className="text-white" />
          </div>
        )}
      </div>

      {/* Audio indicator (animated bars when speaking) */}
      {micOn && !isSelf && (
        <div className="absolute top-2 right-2 flex items-end gap-0.5 h-4">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="w-1 bg-success rounded-full"
              animate={{ height: ['4px', `${6 + i * 3}px`, '4px'] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

function TileSkeleton({ className }) {
  return (
    <div className={`bg-base-300 animate-pulse ${className}`} />
  );
}

export default memo(CustomerParticipantTile);