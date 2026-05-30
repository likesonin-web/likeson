'use client';
import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import {
  fetchJoinToken,
  fetchWaitingRoom,
  fetchParticipants,
  fetchPrescriptions,
  fetchAttachments,
  selectConsultation,
  selectJoinToken,
  selectRtConnected,
  selectRtIsKicked,
  selectRtStatus,
  selectConsultationLoading,
} from '@/store/slices/consultationSlice';
import { useConsultation } from '@/providers/ConsultationSocketProvider';
import { useAgoraRoom }     from './useAgoraRoom';
import { useLocalTracks }   from './useLocalTracks';
import { useRemoteUsers }   from './useRemoteUsers';
import { useScreenShare }   from './useScreenShare';
import { useNetworkQuality } from './useNetworkQuality';
import { useReconnect }     from './useReconnect';
import { useCallTimer }     from './useCallTimer';
import { isDoctor }         from '../utils/roleHelpers';
import { isCompleted }      from '../utils/consultationStatus';

/**
 * useConsultationRoom
 * FIX 1: Step 2 waits for BOTH joinToken AND consultation._id before socket join.
 *         Previously joinToken alone triggered join — consultation could still be null
 *         → bookingId undefined → socket room join failed silently.
 *
 * FIX 2: handleAcceptAndJoin in doctor booking page is a separate file, but here
 *         the fetchJoinToken is guarded: only fires once consultation is loaded.
 *
 * FIX 3: Dependency array includes consultation._id so if consultation loads after
 *         token, Step 2 still fires correctly.
 */
export function useConsultationRoom(consultationId, role) {
  const dispatch    = useDispatch();
  const router      = useRouter();

  const consultation = useSelector(selectConsultation);
  const joinToken    = useSelector(selectJoinToken);
  const rtConnected  = useSelector(selectRtConnected);
  const rtIsKicked   = useSelector(selectRtIsKicked);
  const rtStatus     = useSelector(selectRtStatus);
  const loading      = useSelector(selectConsultationLoading);

  const {
    joinConsultation,
    leaveConsultation,
    emitDoctorStatus,
  } = useConsultation();

  const [showKickModal,     setShowKickModal]     = useState(false);
  const [showEndModal,      setShowEndModal]       = useState(false);
  const [showFeedbackModal, setShowFeedbackModal]  = useState(false);
  const [sidebarOpen,       setSidebarOpen]        = useState(false);
  const [activeTab,         setActiveTab]          = useState('participants');

  // Step 1: Fetch join token — only after consultation is loaded to ensure status is valid
  // FIX: previously fired immediately, but if status wasn't 'waiting|active|scheduled' yet
  //      (e.g. acceptConsultation hadn't resolved), token fetch returned 400.
  useEffect(() => {
    if (consultationId && consultation?._id) {
      dispatch(fetchJoinToken(consultationId));
    }
  }, [consultationId, consultation?._id, dispatch]);

  // Step 2: Join socket room — wait for BOTH token AND consultation with valid bookingId
  useEffect(() => {
    // FIX: Guard on consultation._id AND bookingId — previously only checked joinToken
    //      which caused socket join with bookingId=undefined → room join failed silently
    if (!joinToken?.token || !consultation?._id || !consultation?.bookingId) return;

    const bookingId = String(consultation.bookingId);

    joinConsultation({ consultationId, bookingId });

    if (isDoctor(role)) {
      emitDoctorStatus(true);
      dispatch(fetchWaitingRoom(consultationId));
    }

    dispatch(fetchParticipants(consultationId));
    dispatch(fetchPrescriptions(consultationId));
    dispatch(fetchAttachments({ id: consultationId }));

    return () => {
      leaveConsultation({ consultationId, bookingId });
      if (isDoctor(role)) emitDoctorStatus(false);
    };
  // FIX: Added consultation._id and consultation.bookingId to deps
  //      so this effect re-runs if consultation loads after token
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinToken?.token, consultationId, consultation?._id, consultation?.bookingId]);

  // Agora room — only pass values when all 3 present to avoid partial-init
  const { client, joined, joinError, clientRef } = useAgoraRoom({
  channelName: joinToken?.channelName,
  token:       joinToken?.token,
  uid:         joinToken?.uid,
  consultationId,
});


  // Local tracks
  const localTracks = useLocalTracks();

  // Publish local tracks once joined
useEffect(() => {
  // Use clientRef.current — always live, never stale
  if (!clientRef.current || !joined || !localTracks.isReady) return;
  const tracks = [];
  if (localTracks.localAudioTrack) tracks.push(localTracks.localAudioTrack);
  if (localTracks.localVideoTrack) tracks.push(localTracks.localVideoTrack);
  if (tracks.length) {
    clientRef.current.publish(tracks).catch((err) => {
      // Already published is fine — happens on StrictMode double-run
      if (!err.message?.includes('already published')) {
        console.error('[Room] publish tracks error:', err.message);
      }
    });
  }
}, [clientRef, joined, localTracks.isReady]);

  // Remote users
  const remoteUsers = useRemoteUsers(client);

  // Screen share
 const screenShare = useScreenShare(
  clientRef,           // pass ref — never stale
  localTracks,         // pass full localTracks — useScreenShare manages cam ref internally
  consultationId,
  joinToken?.screenUid
);

  // Network quality
  const networkQuality = useNetworkQuality(client, consultationId);

  // Reconnect
  const reconnect = useReconnect(consultationId);

  // Call timer
const timer = useCallTimer(
  consultation?.actualStartTime,
  rtStatus === 'active',
  consultationId,
);

  // Kicked → show modal then redirect
  useEffect(() => {
    if (rtIsKicked) {
      setShowKickModal(true);
      setTimeout(() => {
        router.push(isDoctor(role)
          ? `/doctor/consultation/${consultation?.bookingId}`
          : `/consultation/${consultation?.bookingId}`
        );
      }, 3000);
    }
  }, [rtIsKicked, router, role, consultation?.bookingId]);

  // Completed → feedback (patient) or summary (doctor)
  useEffect(() => {
    if (isCompleted(rtStatus)) {
      if (!isDoctor(role)) {
        setShowFeedbackModal(true);
      }
    }
  }, [rtStatus, role]);

  return {
    // State
    consultation,
    joinToken,
    joined,
    joinError,
    loading,
    rtStatus,
    rtConnected,

    // Video
    client,
    localTracks,
    remoteUsers,
    screenShare,
    networkQuality,

    // Reconnect
    reconnect,

    // Timer
    timer,

    // UI state
    sidebarOpen,
    setSidebarOpen,
    activeTab,
    setActiveTab,
    showKickModal,
    setShowKickModal,
    showEndModal,
    setShowEndModal,
    showFeedbackModal,
    setShowFeedbackModal,
  };
}