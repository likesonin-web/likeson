'use client';
import { useEffect, useRef } from 'react';
import { MicOff, Hand } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectRtRaisedHands, selectRtParticipants } from '@/store/slices/consultationSlice';
import { AvatarWithStatus } from '../shared/AvatarWithStatus';
import { isScreenShareUser } from '../../utils/agoraHelpers';

export function RemoteVideoTile({ uid, videoTrack, audioTrack, className = '' }) {
  const containerRef  = useRef(null);
  const raisedHands   = useSelector(selectRtRaisedHands);
  const participants  = useSelector(selectRtParticipants);

  // Find participant info by agoraUid or userId
  const participant = Object.values(participants).find(
    (p) => String(p.agoraUid) === String(uid) || String(p.userId) === String(uid)
  );
  const name        = participant?.name || (isScreenShareUser(uid) ? 'Screen' : `User ${uid}`);
  const isMuted     = participant?.isMutedByHost;
  const hasHand     = !!raisedHands[participant?.userId];
  const isScreen    = isScreenShareUser(uid);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    videoTrack.play(containerRef.current);
    return () => videoTrack.stop();
  }, [videoTrack]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{   opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`video-tile relative overflow-hidden bg-neutral ${className}`}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* No video overlay */}
      {!videoTrack && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral">
          {isScreen
            ? <span className="text-base-content/40 text-sm">Screen share</span>
            : <AvatarWithStatus name={name} size="xl" />
          }
        </div>
      )}

      {/* Raised hand indicator */}
      {hasHand && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-warning text-warning-content text-xs font-bold"
        >
          <Hand size={12} />
          Hand raised
        </motion.div>
      )}

      {/* Name tag */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 text-white text-xs font-semibold backdrop-blur-sm">
        {isMuted && <MicOff size={10} className="text-error" aria-label="Muted by host" />}
        <span>{name}</span>
        {isScreen && <span className="badge badge-xs badge-info">Screen</span>}
      </div>
    </motion.div>
  );
}
