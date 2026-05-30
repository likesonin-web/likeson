'use client';
import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import {
  selectConsultation,
  selectRtWaitingQueue,
  selectRtConsentAccepted,
  selectConsultationLoading,
  enterWaitingRoom,
  submitConsent,
  fetchConsents,
  fetchWaitingRoom,
} from '@/store/slices/consultationSlice';
import { useConsultation } from '@/providers/ConsultationSocketProvider';

/**
 * useWaitingRoom — patient-only hook
 *
 * FIX 1: On mount, fetchWaitingRoom to restore queue state from server.
 *         Previously patient state was only from Redux rt (socket events) —
 *         if patient refreshed or re-opened, rt.waitingQueue was empty,
 *         so inQueue=false and patient saw blank screen instead of queue position.
 *
 * FIX 2: If server returns waitingRoomStatus='timed_out' for this patient,
 *         set isTimedOut=true immediately from API (not just from socket event).
 *         Previously only socket event 'waiting_room_timed_out' set isTimedOut,
 *         so patients who refreshed page were stuck in limbo.
 *
 * FIX 3: retryEnterQueue now pushes a new queue entry cleanly by calling
 *         enterWaitingRoom — server handles upsert/re-push correctly.
 */
export function useWaitingRoom(consultationId) {
  const dispatch      = useDispatch();
  const router        = useRouter();
  const consultation   = useSelector(selectConsultation);
  const waitingQueue   = useSelector(selectRtWaitingQueue);
  const consentAccepted = useSelector(selectRtConsentAccepted);
  const loading        = useSelector(selectConsultationLoading);

  const { emitConsentGiven } = useConsultation();

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [inQueue,          setInQueue]          = useState(false);
  const [queuePosition,    setQueuePosition]    = useState(null);
  const [isRejected,       setIsRejected]       = useState(false);
  const [isTimedOut,       setIsTimedOut]       = useState(false);
  const [isApproved,       setIsApproved]       = useState(false);

  const currentUserId = consultation?.patient?._id || consultation?.patient;

  // Check consent on mount
  useEffect(() => {
    if (!consultationId) return;
    dispatch(fetchConsents(consultationId));
  }, [consultationId, dispatch]);

  // FIX 1: Fetch waiting room state from server on mount
  // Restores queue state after page refresh without waiting for socket event
  useEffect(() => {
    if (!consultationId) return;
    dispatch(fetchWaitingRoom(consultationId));
  }, [consultationId, dispatch]);

  // Show consent modal if not accepted
  useEffect(() => {
    if (!consentAccepted) {
      setShowConsentModal(true);
    }
  }, [consentAccepted]);

  // Watch waiting queue for own userId
  useEffect(() => {
    if (!currentUserId) return;
    const myEntry = waitingQueue[String(currentUserId)];

    if (!myEntry) return;

    setQueuePosition(myEntry.queuePosition);
    setInQueue(true);

    // FIX 2: Derive all states from waitingRoomStatus field directly
    // instead of relying only on separate socket events
    const status = myEntry.waitingRoomStatus;

    if (status === 'approved' || status === 'admitted') {
      setIsApproved(true);
      setIsTimedOut(false);
      setIsRejected(false);
      router.push(`/consultation/room/${consultationId}`);
    } else if (status === 'rejected') {
      setIsRejected(true);
      setIsTimedOut(false);
      setIsApproved(false);
    } else if (status === 'timed_out') {
      // FIX 2: Set timed_out from API data, not just socket event
      setIsTimedOut(true);
      setIsRejected(false);
      setIsApproved(false);
    } else if (status === 'waiting') {
      // Active in queue — clear any stale error states
      setIsTimedOut(false);
      setIsRejected(false);
      setIsApproved(false);
    }
  }, [waitingQueue, currentUserId, consultationId, router]);

  const acceptConsent = useCallback(async () => {
    await dispatch(submitConsent({ id: consultationId, consentType: 'telemedicine', accepted: true }));
    emitConsentGiven({ consultationId });
    setShowConsentModal(false);

    // Enter waiting room right after consent
    await dispatch(enterWaitingRoom(consultationId));
    setInQueue(true);
  }, [dispatch, consultationId, emitConsentGiven]);

  const retryEnterQueue = useCallback(async () => {
    // FIX 3: Reset local state first, then re-enter — server handles upsert
    setIsTimedOut(false);
    setIsRejected(false);
    setInQueue(false);

    const result = await dispatch(enterWaitingRoom(consultationId));
    if (!result.error) {
      setInQueue(true);
    }
  }, [dispatch, consultationId]);

  return {
    showConsentModal,
    consentAccepted,
    inQueue,
    queuePosition,
    isRejected,
    isTimedOut,
    isApproved,
    isLoading: loading.waitingRoom || loading.consent,
    acceptConsent,
    retryEnterQueue,
  };
}