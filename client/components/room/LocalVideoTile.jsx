'use client';
import { useEffect, useRef } from 'react';
import { MicOff } from 'lucide-react';
import { AvatarWithStatus } from '../shared/AvatarWithStatus';

export function LocalVideoTile({ videoTrack, isMicOn, isCamOn, name, className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current || !isCamOn) return;
    videoTrack.play(containerRef.current);
    return () => videoTrack.stop();
  }, [videoTrack, isCamOn]);

  return (
    <div className={`video-tile relative overflow-hidden bg-neutral ${className}`}>
      {/* Video container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Camera off overlay */}
      {(!isCamOn || !videoTrack) && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral">
          <AvatarWithStatus name={name} size="xl" />
        </div>
      )}

      {/* Name tag */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 text-white text-xs font-semibold backdrop-blur-sm">
        {!isMicOn && <MicOff size={10} className="text-error" aria-label="Muted" />}
        <span>{name || 'You'}</span>
        <span className="badge badge-xs badge-primary">You</span>
      </div>
    </div>
  );
}
