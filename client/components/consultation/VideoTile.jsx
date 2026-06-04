'use client';

import React, { useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { MicOff, VideoOff, Monitor } from 'lucide-react';

// ── Network quality bars ──────────────────────────────────────────────────────

export const NetworkBars = memo(({ quality }) => {
  const heights = [6, 10, 14];
  const getColor = (barIdx) => {
    if (!quality || quality === 0) return 'bg-base-content/20';
    if (quality <= 2) return 'bg-success';
    if (quality <= 4) return barIdx === 0 ? 'bg-warning' : 'bg-base-content/20';
    return barIdx === 0 ? 'bg-error' : 'bg-base-content/20';
  };

  return (
    <div className="flex items-end gap-[2px] h-4" aria-label={`Network quality ${quality}`}>
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-1 rounded-sm transition-colors duration-300 ${getColor(i)}`}
          style={{ height: h }}
        />
      ))}
    </div>
  );
});
NetworkBars.displayName = 'NetworkBars';

// ── Video Tile ────────────────────────────────────────────────────────────────

const VideoTile = memo(({
  track,               
  audioTrack,          
  isLocal       = false,
  isAudioEnabled = true,
  isVideoEnabled = true,
  userName      = '',
  userRole      = '',
  networkQuality = 0,
  className     = '',
  isSpeaking    = false,
  isMain        = false,
  isSharingScreen = false,   
  isScreenShare   = false,   
}) => {
  const containerRef    = useRef(null);
  const playedVideoRef  = useRef(null);
  const playedAudioRef  = useRef(null);

  // ── Play / stop video track ────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !track) return;
    if (playedVideoRef.current === track) return;

    if (isLocal && isSharingScreen && !isScreenShare) return;

    try {
      track.play(el);
      playedVideoRef.current = track;
    } catch (err) {
      console.warn('[VideoTile] track.play failed:', err);
    }

    return () => {
      if (playedVideoRef.current === track) {
        try {
          if (!isScreenShare) {
            track.stop();
          }
        } catch {}
        playedVideoRef.current = null;
      }
    };
  }, [track, isLocal, isSharingScreen, isScreenShare]);

  // ── Play / stop audio track (remote only) ────────────────────────────
  useEffect(() => {
    if (!audioTrack || isLocal) return;
    if (playedAudioRef.current === audioTrack) return;

    try {
      audioTrack.play();
      playedAudioRef.current = audioTrack;
    } catch (err) {
      console.warn('[VideoTile] audioTrack.play failed:', err);
    }

    return () => {
      if (playedAudioRef.current === audioTrack) {
        try { audioTrack.stop(); } catch {}
        playedAudioRef.current = null;
      }
    };
  }, [audioTrack, isLocal]);

  // Clean up display name to prevent default generic IDs like "user1234"
  const cleanName = userName && userName.startsWith('user') ? 'Participant' : userName;
  const displayName = cleanName || (isLocal ? 'You' : 'Participant');
  const initial = displayName[0]?.toUpperCase() ?? '?';

  const showVideoEl = isScreenShare
    ? !!track
    : (isVideoEnabled && !!track && !(isLocal && isSharingScreen && !isScreenShare));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      data-agora-video="true"
      className={`relative w-full h-full min-h-[120px] bg-neutral overflow-hidden rounded-xl border border-base-300/50 isolate group ${className}`}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full z-0"
        style={{ display: showVideoEl ? 'block' : 'none' }}
      />

      {isScreenShare && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-accent/90 text-accent-content text-[0.65rem] font-bold px-2 py-1 rounded-full shadow-md pointer-events-none">
          <Monitor size={11} /> Screen
        </div>
      )}

      {!showVideoEl && !isScreenShare && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral z-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/15 flex items-center justify-center mb-2 shadow-inner">
            <span className="font-black text-2xl sm:text-3xl text-primary">
              {initial}
            </span>
          </div>
          <p className="font-semibold text-base-content/80 text-sm">{displayName}</p>
          {userRole && <p className="text-xs text-base-content/50 mt-1">{userRole}</p>}
        </div>
      )}

      {/* Bottom info bar - Updated to show details and roles */}
      <div className="absolute bottom-2 left-2 right-2 z-20 flex items-start justify-between px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm">
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-semibold truncate max-w-[120px] sm:max-w-[160px]">
              {isScreenShare ? `${displayName}'s screen` : displayName}
            </span>
            {isLocal && (
              <span className="badge badge-primary badge-xs shrink-0">You</span>
            )}
          </div>
          {/* Display User Role / Extra details */}
          {userRole && !isLocal && !isScreenShare && (
            <span className="text-white/70 text-[10px] mt-0.5 tracking-wide truncate">
              {userRole}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <NetworkBars quality={networkQuality} />
          {!isAudioEnabled && !isScreenShare && (
            <span className="text-error" aria-label="Muted">
              <MicOff size={13} />
            </span>
          )}
          {!isVideoEnabled && !isSharingScreen && !isScreenShare && (
            <span className="text-white/60" aria-label="Camera off">
              <VideoOff size={13} />
            </span>
          )}
        </div>
      </div>

      {isSpeaking && (
        <div
          className="absolute inset-0 rounded-xl border-2 border-primary z-30 pointer-events-none animate-pulse"
          aria-hidden="true"
        />
      )}
    </motion.div>
  );
});
VideoTile.displayName = 'VideoTile';

export default VideoTile;