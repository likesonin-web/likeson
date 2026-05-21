'use client';
/**
 * ParticipantTile.jsx
 * Memoized participant video tile. Zero stream leaks.
 * Uses useParticipant from VideoSDK — stable ref per participant ID.
 */

import React, { memo, useRef, useEffect } from 'react';
import { useParticipant } from '@videosdk.live/react-sdk';
import { Mic, MicOff, Video, VideoOff, UserCircle2 } from 'lucide-react';

/**
 * @param {object} props
 * @param {string}  props.participantId  - stable VideoSDK participant ID
 * @param {boolean} props.isDoctor       - render doctor badge
 * @param {boolean} props.isSpotlight    - large spotlight mode
 * @param {string}  props.displayName
 */
export const ParticipantTile = memo(function ParticipantTile({
  participantId,
  isDoctor    = false,
  isSpotlight = false,
  displayName = 'Participant',
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const {
    webcamStream,
    micStream,
    webcamOn,
    micOn,
    isLocal,
    displayName: sdkName,
  } = useParticipant(participantId, {
    onStreamEnabled:  () => {},
    onStreamDisabled: () => {},
  });

  const name = sdkName || displayName;

  // Attach webcam stream to video element — stable ref, no leak
  useEffect(() => {
    if (!videoRef.current || !webcamStream) return;

    const mediaStream = new MediaStream();
    mediaStream.addTrack(webcamStream.track);
    videoRef.current.srcObject = mediaStream;

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      // Do NOT stop tracks here — VideoSDK owns the tracks
    };
  }, [webcamStream]);

  // Attach mic stream to audio element
  useEffect(() => {
    if (!audioRef.current || !micStream || isLocal) return;

    const mediaStream = new MediaStream();
    mediaStream.addTrack(micStream.track);
    audioRef.current.srcObject = mediaStream;

    return () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    };
  }, [micStream, isLocal]);

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl bg-base-300 border border-white/10
        ${isSpotlight ? 'w-full h-full' : 'w-full aspect-video'}
        group transition-all duration-300
      `}
      aria-label={`${name} - ${webcamOn ? 'camera on' : 'camera off'}, ${micOn ? 'mic on' : 'mic off'}`}
    >
      {/* Video */}
      {webcamOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-base-300 to-base-200">
          <UserCircle2 size={isSpotlight ? 80 : 40} className="text-base-content/30" />
        </div>
      )}

      {/* Hidden audio */}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}

      {/* Name bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
        <span className="text-white text-xs font-semibold truncate max-w-[70%]">
          {name}
          {isLocal && <span className="ml-1 opacity-60">(You)</span>}
        </span>
        <div className="flex items-center gap-1">
          {isDoctor && (
            <span className="px-1.5 py-0.5 bg-primary/80 text-white text-[10px] font-bold rounded uppercase tracking-wide">
              Dr
            </span>
          )}
          {micOn ? (
            <Mic size={12} className="text-white/80" />
          ) : (
            <MicOff size={12} className="text-red-400" />
          )}
          {webcamOn ? (
            <Video size={12} className="text-white/80" />
          ) : (
            <VideoOff size={12} className="text-red-400" />
          )}
        </div>
      </div>

      {/* Mic activity pulse */}
      {micOn && !isLocal && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      )}
    </div>
  );
}, (prev, next) => prev.participantId === next.participantId && prev.isSpotlight === next.isSpotlight);

export default ParticipantTile;