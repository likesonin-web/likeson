'use client';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { muteParticipant, kickParticipant } from '@/store/slices/consultationSlice';
import { useConsultation } from '@/providers/ConsultationSocketProvider';

/**
 * useParticipantControls
 * Doctor/admin actions: mute, kick participants.
 */
export function useParticipantControls(consultationId) {
  const dispatch = useDispatch();
  const { emitMuteParticipant, emitKickParticipant } = useConsultation();

  const mute = useCallback(async (userId, muted = true) => {
    // Optimistic: emit socket first for instant feedback
    emitMuteParticipant({ consultationId, targetUserId: userId, muted });
    // Persist to server
    await dispatch(muteParticipant({ id: consultationId, userId, muted }));
  }, [consultationId, dispatch, emitMuteParticipant]);

const kick = useCallback(async (participantOrId, reason) => {
  // ConsultationRoom passes whole participant object; support both
  const userId = typeof participantOrId === 'object'
    ? (participantOrId.userId || participantOrId._id)
    : participantOrId;
  if (!userId) return;
  emitKickParticipant({ consultationId, targetUserId: String(userId), reason });
  await dispatch(kickParticipant({ id: consultationId, userId: String(userId), reason }));
}, [consultationId, dispatch, emitKickParticipant]);

  return { mute, kick };
}
