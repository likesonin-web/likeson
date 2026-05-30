'use client';
import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Minimize2, Maximize2 } from 'lucide-react';
import { LocalVideoTile } from './LocalVideoTile';

export function PiPWindow({ localTracks, localName, remoteUsers }) {
  const [minimized,  setMinimized]  = useState(false);
  const [position,   setPosition]   = useState({ x: 16, y: 16 });
  const dragStart    = useRef(null);

  // Show the "other party" in PiP if there's a remote user
  const firstRemote = Object.values(remoteUsers)[0];

  if (!firstRemote && !localTracks.localVideoTrack) return null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragConstraints={{ left: 0, right: 400, top: 0, bottom: 600 }}
      className="pip-draggable absolute top-4 right-4 z-30 rounded-xl overflow-hidden shadow-depth-lg border border-base-300/50"
      style={{ width: minimized ? 48 : 160, height: minimized ? 48 : 120 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      aria-label="Picture in picture window"
    >
      {!minimized && (
        <LocalVideoTile
          videoTrack={localTracks.localVideoTrack}
          isMicOn={localTracks.isMicOn}
          isCamOn={localTracks.isCamOn}
          name={localName}
          className="w-full h-full"
        />
      )}

      {minimized && (
        <div className="w-full h-full bg-neutral flex items-center justify-center">
          <span className="text-neutral-content/60 text-xs">PiP</span>
        </div>
      )}

      <button
        onClick={() => setMinimized((v) => !v)}
        className="absolute top-1 right-1 btn btn-xs btn-circle bg-black/50 text-white border-none"
        aria-label={minimized ? 'Expand PiP' : 'Minimize PiP'}
      >
        {minimized ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
      </button>
    </motion.div>
  );
}
