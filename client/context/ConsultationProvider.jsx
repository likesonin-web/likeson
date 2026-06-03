'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectToken } from '@/store/slices/userSlice';
import {
  fetchConsultationById,
  joinConsultation,
  leaveConsultation,
  startConsultation,
  endConsultation,
  fetchAgoraTokens,
  provisionAgoraTokens,
  fetchChatHistory,
  fetchParticipants,
  fetchWaitingRoomStatus,
  selectConsultation,
  selectConsultationStatus,
  selectAgora,
  selectMyTokens,
  selectChatMessages,
  selectParticipants,
  selectWaitingRoom,
  selectLoading,
  clearCurrent,
} from '@/store/slices/consultationSlice';
import {
  connectConsultationSocket,
  disconnectConsultationSocket,
  socketJoin,
  socketLeave,
  initConsultationSocket,
} from '@/services/consultationSocketService';
import { store } from '@/store';

// ── Context ───────────────────────────────────────────────────────────────────

const ConsultationContext = createContext(null);

export const useConsultation = () => {
  const ctx = useContext(ConsultationContext);
  if (!ctx) throw new Error('useConsultation must be inside ConsultationProvider');
  return ctx;
};

// ── Provider ──────────────────────────────────────────────────────────────────

export default function ConsultationProvider({
  children,
  consultationId,
  userRole, // 'doctor' | 'patient'
  userId,
}) {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const consultation = useSelector(selectConsultation);
  const status = useSelector(selectConsultationStatus);
  const agora = useSelector(selectAgora);
  const myTokens = useSelector(selectMyTokens);
  const chatMessages = useSelector(selectChatMessages);
  const participants = useSelector(selectParticipants);
  const waitingRoom = useSelector(selectWaitingRoom);
  const sessionLoading = useSelector(selectLoading('session'));
  const fetchLoading = useSelector(selectLoading('fetch'));
  const hasJoinedRef = useRef(false);

  // ── Bootstrap consultation data ───────────────────────────────────────────
  useEffect(() => {
    if (!consultationId) return;

    dispatch(fetchConsultationById(consultationId));
    dispatch(fetchChatHistory(consultationId));
    dispatch(fetchParticipants(consultationId));
    dispatch(fetchWaitingRoomStatus(consultationId));
  }, [consultationId, dispatch]);

  // ── Socket connection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !consultationId) return;

    initConsultationSocket(store);
    const socket = connectConsultationSocket(token);

    return () => {
      disconnectConsultationSocket();
    };
  }, [token, consultationId]);

  // ── Join consultation (REST + socket) ─────────────────────────────────────
  const handleJoin = useCallback(async (deviceInfo = {}) => {
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    try {
      // 1. REST join → gets tokens back
      await dispatch(joinConsultation({ id: consultationId, deviceInfo }));

      // 2. Fetch Agora tokens if not provisioned
      const result = await dispatch(fetchAgoraTokens(consultationId));
      if (result.error) {
        // Provision if doctor and tokens missing
        if (userRole === 'doctor') {
          await dispatch(provisionAgoraTokens(consultationId));
        }
      }

      // 3. Socket join
      socketJoin(consultationId, deviceInfo);
    } catch (err) {
      console.error('[ConsultationProvider] Join failed:', err);
      hasJoinedRef.current = false;
    }
  }, [consultationId, userRole, dispatch]);

  // ── Leave consultation ────────────────────────────────────────────────────
  const handleLeave = useCallback(async (metrics = {}) => {
    try {
      socketLeave(consultationId, metrics);
      await dispatch(leaveConsultation({ id: consultationId, metrics }));
    } catch (err) {
      console.error('[ConsultationProvider] Leave failed:', err);
    }
  }, [consultationId, dispatch]);

  // ── Start session (doctor only) ───────────────────────────────────────────
  const handleStart = useCallback(async () => {
    await dispatch(startConsultation(consultationId));
  }, [consultationId, dispatch]);

  // ── End session (doctor only) ─────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    await dispatch(endConsultation(consultationId));
  }, [consultationId, dispatch]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      dispatch(clearCurrent());
    };
  }, [dispatch]);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    consultationId,
    consultation,
    status,
    agora,
    myTokens,
    chatMessages,
    participants,
    waitingRoom,
    sessionLoading,
    fetchLoading,
    userRole,
    userId,
    handleJoin,
    handleLeave,
    handleStart,
    handleEnd,
  }), [
    consultationId, consultation, status, agora, myTokens,
    chatMessages, participants, waitingRoom, sessionLoading,
    fetchLoading, userRole, userId,
    handleJoin, handleLeave, handleStart, handleEnd,
  ]);

  return (
    <ConsultationContext.Provider value={value}>
      {children}
    </ConsultationContext.Provider>
  );
}