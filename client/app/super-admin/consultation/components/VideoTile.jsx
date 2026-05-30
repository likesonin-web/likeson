'use client';

import React, { useRef, useEffect } from 'react';

const qualityColor = (nq) => {
  if (!nq) return '';
  const up = nq.uplinkNetworkQuality ?? 0;
  if (up <= 1) return 'text-success';
  if (up <= 3) return 'text-warning';
  return 'text-error';
};

const qualityLabel = (nq) => {
  if (!nq) return null;
  const up = nq.uplinkNetworkQuality ?? 0;
  if (up === 0) return 'Unknown';
  if (up <= 1) return 'Excellent';
  if (up <= 2) return 'Good';
  if (up <= 3) return 'Fair';
  if (up <= 4) return 'Poor';
  return 'Bad';
};

export default function VideoTile({ label, track, participant, networkQuality }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (track && videoRef.current) {
      track.play(videoRef.current);
    }
    return () => {
      track?.stop();
    };
  }, [track]);

  const isDisconnected =
    participant?.connectionStatus === 'disconnected' ||
    participant?.connectionStatus === 'never_joined';

  return (
    <div className="card relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
      {/* Video element */}
      <div ref={videoRef} className="absolute inset-0 bg-neutral" />

      {/* No video placeholder */}
      {!track && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-300 gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
            />
          </svg>
          <span className="text-xs text-base-content/40">No video</span>
        </div>
      )}

      {/* Disconnected overlay */}
      {isDisconnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-300/80 backdrop-blur-sm">
          <span className="badge badge-error">Disconnected</span>
        </div>
      )}

      {/* Labels */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 flex items-center justify-between bg-gradient-to-t from-neutral/80 to-transparent">
        <span className="text-neutral-content text-xs font-semibold truncate">{label}</span>
        <div className="flex items-center gap-1">
          {networkQuality && (
            <span className={`text-[10px] font-bold ${qualityColor(networkQuality)}`}>
              {qualityLabel(networkQuality)}
            </span>
          )}
          {participant?.handRaised && (
            <span title="Hand raised">✋</span>
          )}
        </div>
      </div>

      {/* Observing badge on top-right */}
      <div className="absolute top-2 right-2">
        <span className="badge badge-info badge-xs">Observing</span>
      </div>
    </div>
  );
}