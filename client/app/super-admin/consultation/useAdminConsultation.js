'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  fetchAdminFullConsultation,
  fetchJoinToken,
  fetchChatHistory,
  fetchPrescriptions,
  fetchAdminStats,
  adminForceEnd,
  saveAdminNotes,
  cancelConsultation,
  confirmConsultation,
  approveWaitingRoom,
  sendChatMessage,
} from '@/store/slices/consultationSlice';
import { useConsultation } from '@/contexts/ConsultationContext';

// ─── Agora singleton ───────────────────────────────────────────────────────────
let _agoraClient = null;
const getAgoraClient = () => {
  if (!_agoraClient) {
    _agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'h264' });
  }
  return _agoraClient;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAdminConsultation(consultationId, bookingId) {
  const dispatch = useDispatch();
  const { joinConsultation, leaveConsultation, emitParticipantJoin, emitParticipantLeave } =
    useConsultation();

  const consultation  = useSelector((s) => s.consultation.current);
  const joinToken     = useSelector((s) => s.consultation.joinToken);
  const chatMessages  = useSelector((s) => s.consultation.chatMessages);
  const prescriptions = useSelector((s) => s.consultation.prescriptions);
  const loading       = useSelector((s) => s.consultation.loading);
  const rt            = useSelector((s) => s.consultation.rt);
  const stats         = useSelector((s) => s.consultation.stats);

  const [hasJoined, setHasJoined]         = useState(false);
  const [remoteUsers, setRemoteUsers]     = useState([]);
  const [isMuted, setIsMuted]             = useState(false);
  const [pollingActive, setPollingActive] = useState(true);

  const clientRef      = useRef(null);
  const pollingRef     = useRef(null);
  const audioTracksRef = useRef({});

  // ── On mount: fetch data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!consultationId) return;
    dispatch(fetchAdminFullConsultation(consultationId));
    dispatch(fetchJoinToken(consultationId));
    dispatch(fetchChatHistory({ id: consultationId }));
    dispatch(fetchPrescriptions(consultationId));
    dispatch(fetchAdminStats());
  }, [consultationId, dispatch]);

  // ── Join socket room when bookingId available ──────────────────────────────
  useEffect(() => {
    const bId = bookingId || consultation?.bookingId;
    if (!consultationId || !bId) return;
    joinConsultation({ consultationId, bookingId: bId });
    return () => {
      const currentBId = bookingId || consultation?.bookingId;
      leaveConsultation({ consultationId, bookingId: currentBId, reason: 'admin_left' });
      emitParticipantLeave({ consultationId, reason: 'admin_left' });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, bookingId, consultation?.bookingId]);

  // ── Polling every 30s ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!consultationId || !pollingActive) return;
    pollingRef.current = setInterval(() => {
      dispatch(fetchAdminFullConsultation(consultationId));
    }, 30_000);
    return () => clearInterval(pollingRef.current);
  }, [consultationId, pollingActive, dispatch]);

  // ── Agora join as observer ─────────────────────────────────────────────────
  const joinAsObserver = useCallback(async () => {
    if (!joinToken || !consultation?.agoraChannelId) return;
    try {
      const client = getAgoraClient();
      clientRef.current = client;

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          audioTracksRef.current[user.uid] = user.audioTrack;
          if (!isMuted) user.audioTrack?.play();
        }
        setRemoteUsers((prev) => {
          const exists = prev.find((u) => u.uid === user.uid);
          return exists ? prev.map((u) => (u.uid === user.uid ? user : u)) : [...prev, user];
        });
      });

      client.on('user-unpublished', (user) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      client.on('user-left', (user) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      await client.join(
        joinToken.appId,
        joinToken.channelName || consultation.agoraChannelId,
        joinToken.token,
        joinToken.uid || null
      );

      // Admin: no publish — observer only
      setHasJoined(true);
      emitParticipantJoin({
        consultationId,
        agoraUid: joinToken.uid || 0,
        deviceType: 'desktop',
      });
    } catch (err) {
      console.error('[AdminConsultation] Agora join error:', err);
    }
  }, [joinToken, consultation?.agoraChannelId, consultationId, isMuted, emitParticipantJoin]);

  // ── Unmount: leave Agora ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.leave().catch(() => {});
        clientRef.current = null;
      }
      Object.values(audioTracksRef.current).forEach((t) => t?.stop());
      audioTracksRef.current = {};
    };
  }, []);

  // ── Mute/unmute local speaker ──────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const muting = !isMuted;
    Object.values(audioTracksRef.current).forEach((t) => {
      muting ? t?.stop() : t?.play();
    });
    setIsMuted(muting);
  }, [isMuted]);

  // ── Resolve doctor / patient video tracks ─────────────────────────────────
  const doctorParticipant  = consultation?.participants?.find((p) => p.role === 'doctor');
  const patientParticipant = consultation?.participants?.find((p) => p.role === 'patient');

  const doctorVideoTrack  = remoteUsers.find((u) =>
    String(u.uid) === String(doctorParticipant?.participantId)
  )?.videoTrack ?? null;

  const patientVideoTrack = remoteUsers.find((u) =>
    String(u.uid) === String(patientParticipant?.participantId)
  )?.videoTrack ?? null;

  // ── Admin actions ──────────────────────────────────────────────────────────
  const handleForceEnd = useCallback(
    (reason) => dispatch(adminForceEnd({ id: consultationId, reason })),
    [consultationId, dispatch]
  );

  const handleSaveAdminNotes = useCallback(
    (notes) => dispatch(saveAdminNotes({ id: consultationId, notes })),
    [consultationId, dispatch]
  );

  const handleCancelConsultation = useCallback(
    (reason) => dispatch(cancelConsultation({ id: consultationId, reason })),
    [consultationId, dispatch]
  );

  const handleConfirmConsultation = useCallback(
    () => dispatch(confirmConsultation({ id: consultationId })),
    [consultationId, dispatch]
  );

  const handleApproveWaitingRoom = useCallback(
    (userId) => dispatch(approveWaitingRoom({ id: consultationId, userId })),
    [consultationId, dispatch]
  );

  const handleSendMessage = useCallback(
    (message) => dispatch(sendChatMessage({ id: consultationId, message, messageType: 'text' })),
    [consultationId, dispatch]
  );

  // ── Derived analytics ──────────────────────────────────────────────────────
  const networkAnalytics = consultation?.networkAnalytics ?? [];
  const sdkErrors        = consultation?.sdkErrors ?? [];
  const reconnectLogs    = consultation?.reconnectLogs ?? [];

  return {
    consultation,
    joinToken,
    chatMessages,
    prescriptions,
    loading,
    rt,
    stats,
    hasJoined,
    setHasJoined,
    remoteUsers,
    doctorVideoTrack,
    patientVideoTrack,
    isMuted,
    toggleMute,
    joinAsObserver,
    handleForceEnd,
    handleSaveAdminNotes,
    handleCancelConsultation,
    handleConfirmConsultation,
    handleApproveWaitingRoom,
    handleSendMessage,
    networkAnalytics,
    sdkErrors,
    reconnectLogs,
    pollingActive,
    setPollingActive,
  };
}