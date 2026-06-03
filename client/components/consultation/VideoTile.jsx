'use client';

/**
 * VideoTile.jsx — PRODUCTION GRADE
 *
 * FIXES:
 * 1. data-agora-video attribute on container so the full-consultation recorder
 *    can querySelectorAll('[data-agora-video] video') to capture every frame.
 * 2. track.play() / track.stop() lifecycle is correct — called once per track
 *    instance, cleaned up properly on unmount or track change.
 * 3. Remote audio tracks: AudioTrack.play() is called explicitly (not just video).
 * 4. isSharingScreen prop drives the "Screen sharing active" overlay for the
 *    LOCAL tile — no DOM-layer duplication.
 * 5. isScreenShare prop (from enriched remoteUser) renders a monitor icon
 *    overlay on remote screen-share tiles.
 */

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
  track,               // ILocalVideoTrack | IRemoteVideoTrack | null
  audioTrack,          // IRemoteAudioTrack | null — only used on remote tiles
  isLocal       = false,
  isAudioEnabled = true,
  isVideoEnabled = true,
  userName      = '',
  userRole      = '',
  networkQuality = 0,
  className     = '',
  isSpeaking    = false,
  isMain        = false,
  isSharingScreen = false,   // true when THIS local client is sharing screen
  isScreenShare   = false,   // true when this tile IS a screen-share stream (remote)
}) => {
  const containerRef = useRef(null);
  const playedVideoRef = useRef(null);
  const playedAudioRef = useRef(null);

  // ── Play / stop video track ────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !track) return;
    if (playedVideoRef.current === track) return;

    // Local screen share: don't play in DOM (would cause duplication)
    if (isLocal && isSharingScreen) return;

    try {
      track.play(el);
      playedVideoRef.current = track;
    } catch (err) {
      console.warn('[VideoTile] track.play failed:', err);
    }

    return () => {
      if (playedVideoRef.current === track) {
        try { track.stop(); } catch {}
        playedVideoRef.current = null;
      }
    };
  }, [track, isLocal, isSharingScreen]);

  // ── Play / stop audio track (remote only) ────────────────────────────
  // FIX: AgoraRTC requires audioTrack.play() to be called explicitly.
  // Without this, remote audio is silent even though it's subscribed.
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

  const displayName = userName || (isLocal ? 'You' : 'Participant');
  const initial     = displayName[0]?.toUpperCase() ?? '?';

  const showVideoEl = !isScreenShare
    ? (isVideoEnabled && !!track && !(isLocal && isSharingScreen))
    : !!track; // screen share tile always shows video

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      // data-agora-video allows full-consultation recorder to find all video els
      data-agora-video="true"
      className={`relative w-full h-full min-h-[120px] bg-neutral overflow-hidden rounded-xl border border-base-300/50 isolate group ${className}`}
    >
      {/* Agora renders the video into this div */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full z-0"
        style={{
          display: showVideoEl ? 'block' : 'none',
          // Agora appends a div > video inside this element
        }}
      />

      {/* Screen sharing overlay for LOCAL sharer */}
      {isLocal && isSharingScreen && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-200/95 z-10 p-4 text-center">
          <Monitor size={40} className="text-accent mb-3" />
          <p className="font-bold text-accent text-sm">Sharing screen</p>
          <p className="text-[0.7rem] text-base-content/60 mt-1">
            Others can see your screen
          </p>
        </div>
      )}

      {/* Screen share badge for REMOTE screen tiles */}
      {isScreenShare && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-accent/90 text-accent-content text-[0.65rem] font-bold px-2 py-1 rounded-full shadow-md">
          <Monitor size={11} /> Screen
        </div>
      )}

      {/* Avatar fallback when camera off */}
      {!showVideoEl && !isSharingScreen && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral z-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/15 flex items-center justify-center mb-2 shadow-inner">
            <span className="font-black text-2xl sm:text-3xl text-primary">
              {initial}
            </span>
          </div>
          <p className="font-semibold text-base-content/80 text-sm">{displayName}</p>
        </div>
      )}

      {/* Bottom info bar */}
      <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-white text-xs font-semibold truncate max-w-[120px]">
            {isScreenShare ? `${displayName}'s screen` : displayName}
          </span>
          {isLocal && (
            <span className="badge badge-primary badge-xs shrink-0">You</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NetworkBars quality={networkQuality} />
          {!isAudioEnabled && (
            <span className="text-error" aria-label="Muted">
              <MicOff size={13} />
            </span>
          )}
          {!isVideoEnabled && !isSharingScreen && !isScreenShare && (
            <span className="text-base-content/60" aria-label="Camera off">
              <VideoOff size={13} />
            </span>
          )}
        </div>
      </div>

      {/* Speaking ring */}
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