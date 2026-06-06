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

// ── Scoped video style injected once per type ─────────────────────────────────
// Agora SDK injects: containerRef > div > video
// We must force sizing on BOTH the inner div and the video element.
// Using a scoped <style> block is the most reliable approach since
// Tailwind arbitrary selectors [&_video] may not compile in all setups.

const SCREEN_STYLE = `
  [data-ss="1"],
  [data-ss="1"] div,
  [data-ss="1"] video {
    position: absolute !important;
    top: 0 !important; left: 0 !important;
    width: 100% !important; height: 100% !important;
    max-width: none !important; max-height: none !important;
    transform: none !important; zoom: 1 !important;
    object-fit: contain !important;
    background: #000 !important;
  }
`;

const CAMERA_STYLE = `
  [data-cam="1"],
  [data-cam="1"] div,
  [data-cam="1"] video {
    position: absolute !important;
    top: 0 !important; left: 0 !important;
    width: 100% !important; height: 100% !important;
    max-width: none !important; max-height: none !important;
    transform: none !important; zoom: 1 !important;
    object-fit: cover !important;
    object-position: center !important;
  }
`;

// Inject once into <head> — idempotent
if (typeof document !== 'undefined') {
  if (!document.getElementById('vt-screen-style')) {
    const s = document.createElement('style');
    s.id = 'vt-screen-style';
    s.textContent = SCREEN_STYLE;
    document.head.appendChild(s);
  }
  if (!document.getElementById('vt-camera-style')) {
    const s = document.createElement('style');
    s.id = 'vt-camera-style';
    s.textContent = CAMERA_STYLE;
    document.head.appendChild(s);
  }
}

// ── Video Tile ────────────────────────────────────────────────────────────────

const VideoTile = memo(({
  track,
  audioTrack,
  isLocal        = false,
  isAudioEnabled = true,
  isVideoEnabled = true,
  userName       = '',
  userRole       = '',
  networkQuality = 0,
  className      = '',
  isSpeaking     = false,
  isMain         = false,
  isSharingScreen = false,
  isScreenShare   = false,
}) => {
  const containerRef   = useRef(null);
  const playedVideoRef = useRef(null);
  const playedAudioRef = useRef(null);

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
        try { if (!isScreenShare) track.stop(); } catch {}
        playedVideoRef.current = null;
      }
    };
  }, [track, isLocal, isSharingScreen, isScreenShare]);

  // ── Force video sizing after Agora injects the element ────────────────
  // Agora may inject the <video> slightly after track.play() resolves,
  // so we watch with a MutationObserver and apply inline styles directly.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const applyStyles = () => {
      el.querySelectorAll('div, video').forEach((node) => {
        // Strip Agora SDK inline dimensions (e.g. width:1280px height:720px)
        // that cause video to appear zoomed inside a smaller container
        node.style.position = 'absolute';
        node.style.top = '0';
        node.style.left = '0';
        node.style.width = '100%';
        node.style.height = '100%';
        node.style.maxWidth = 'none';
        node.style.maxHeight = 'none';
        node.style.transform = 'none';
        node.style.zoom = '1';
        if (node.tagName === 'VIDEO') {
          // Use contain for all video — shows full face on mobile, full screen for screenshare
          // cover crops face on portrait mobile which is the reported bug
          node.style.objectFit = 'contain';
          node.style.objectPosition = 'center center';
          node.style.background = '#000';
        }
      });
    };

    // Apply immediately in case video already exists
    applyStyles();

    // Watch for Agora inserting the video element
    const observer = new MutationObserver(applyStyles);
    observer.observe(el, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [track, isScreenShare]);

  // ── Play / stop audio track (remote only) ─────────────────────────────
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

  const cleanName   = userName && userName.startsWith('user') ? 'Participant' : userName;
  const displayName = cleanName || (isLocal ? 'You' : 'Participant');
  const initial     = displayName[0]?.toUpperCase() ?? '?';

  const showVideoEl = isScreenShare
    ? !!track
    : (isVideoEnabled && !!track && !(isLocal && isSharingScreen && !isScreenShare));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      data-agora-video="true"
      className={`relative w-full h-full ${isMain ? '' : 'min-h-[120px]'} bg-neutral overflow-hidden rounded-xl border border-base-300/50 isolate group ${className}`}
    >
      {/* Container Agora renders into — position absolute to fill parent */}
      <div
        ref={containerRef}
        data-ss={isScreenShare ? '1' : undefined}
        data-cam={!isScreenShare ? '1' : undefined}
        className="absolute inset-0 w-full h-full z-0 overflow-hidden"
        style={{
          display: showVideoEl ? 'block' : 'none',
          background: isScreenShare ? '#000' : undefined,
        }}
      />

      {isScreenShare && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-accent/90 text-accent-content text-[0.65rem] font-bold px-2 py-1 rounded-full shadow-md pointer-events-none">
          <Monitor size={11} /> Screen
        </div>
      )}

      {!showVideoEl && !isScreenShare && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral z-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/15 flex items-center justify-center mb-2 shadow-inner">
            <span className="font-black text-2xl sm:text-3xl text-primary">{initial}</span>
          </div>
          <p className="font-semibold text-base-content/80 text-sm">{displayName}</p>
          {userRole && <p className="text-xs text-base-content/50 mt-1">{userRole}</p>}
        </div>
      )}

      {/* Bottom info bar */}
      <div className="absolute bottom-2 left-2 right-2 z-20 flex items-start w-fit justify-between px-2.5 py-1.5 rounded-lg bg-base-100/60 backdrop-blur-sm">
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-base-content text-xs font-semibold truncate max-w-[120px] sm:max-w-[160px]">
              {isScreenShare ? `${displayName}'s screen` : displayName}
            </span>
            {isLocal && <span className="badge badge-primary text-base-content badge-xs shrink-0">You</span>}
          </div>
          {userRole && !isLocal && !isScreenShare && (
            <span className="text-base-content/70 text-[10px] mt-0.5 tracking-wide truncate">{userRole}</span>
          )}
        </div>
        <div className="flex items-center ml-4 gap-2 shrink-0 mt-0.5">
          <NetworkBars quality={networkQuality} />
          {!isAudioEnabled && !isScreenShare && (
            <span className="text-error" aria-label="Muted"><MicOff size={13} /></span>
          )}
          {!isVideoEnabled && !isSharingScreen && !isScreenShare && (
            <span className="text-white/60" aria-label="Camera off"><VideoOff size={13} /></span>
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