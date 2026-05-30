'use client';
import { useSelector } from 'react-redux';
import { selectRtParticipants } from '@/store/slices/consultationSlice';
import { AnimatePresence, motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { ParticipantCard }     from './ParticipantCard';
import { useParticipantControls } from '../../hooks/useParticipantControls';

export function ParticipantsPanel({ consultationId, viewerRole, onKickRequest }) {
  const participants  = useSelector(selectRtParticipants);
  const participantList = Object.values(participants);
  const connected     = participantList.filter((p) => p.connectionStatus === 'connected');

  const { mute } = useParticipantControls(consultationId);

  if (connected.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center">
          <Users size={24} className="text-base-content/30" />
        </div>
        <p className="text-sm text-base-content/50">No participants yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wider px-2 mb-1">
        {connected.length} in call
      </p>
      <AnimatePresence initial={false}>
        {connected.map((p) => (
          <motion.div
            key={p.userId || p.participantId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{   opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <ParticipantCard
              participant={p}
              viewerRole={viewerRole}
              onMute={mute}
              onKick={onKickRequest}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
