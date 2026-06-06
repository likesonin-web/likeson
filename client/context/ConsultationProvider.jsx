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
  const token    = useSelector(selectToken);

  const consultation  = useSelector(selectConsultation);
  const status        = useSelector(selectConsultationStatus);
  const agora         = useSelector(selectAgora);
  const myTokens      = useSelector(selectMyTokens);
  const chatMessages  = useSelector(selectChatMessages);
  const participants  = useSelector(selectParticipants);
  const waitingRoom   = useSelector(selectWaitingRoom);
  const sessionLoading = useSelector(selectLoading('session'));
  const fetchLoading   = useSelector(selectLoading('fetch'));

  // Tracks whether REST join was called — reset on leave so re-join works
  const hasJoinedRef  = useRef(false);
  // Tracks whether socket was initialised — init only once per mount
  const socketInitRef = useRef(false);
  // Tracks whether leave was already dispatched — prevents double-fire
  const hasLeftRef    = useRef(false);

  // ── Bootstrap consultation data ───────────────────────────────────────
  useEffect(() => {
    if (!consultationId) return;
    dispatch(fetchConsultationById(consultationId));
    dispatch(fetchChatHistory(consultationId));
    dispatch(fetchParticipants(consultationId));
    dispatch(fetchWaitingRoomStatus(consultationId));
  }, [consultationId, dispatch]);

  // ── Socket — init once, connect when token ready ──────────────────────
  useEffect(() => {
    if (!token || !consultationId) return;

    // Init store binding only once
    if (!socketInitRef.current) {
      initConsultationSocket(store);
      socketInitRef.current = true;
    }

    connectConsultationSocket(token);

    return () => {
      disconnectConsultationSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, consultationId]); // intentional: reconnect if token rotates

  // ── handleJoin ────────────────────────────────────────────────────────
  const handleJoin = useCallback(async (deviceInfo = {}) => {
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    hasLeftRef.current   = false;

    try {
      // 1. REST join
      await dispatch(joinConsultation({ id: consultationId, deviceInfo }));

      // 2. Fetch Agora tokens — provision if missing (both roles)
      const result = await dispatch(fetchAgoraTokens(consultationId));
      if (result.error) {
        await dispatch(provisionAgoraTokens(consultationId));
        // Fetch again after provisioning
        await dispatch(fetchAgoraTokens(consultationId));
      }

      // 3. Emit socket join
      socketJoin(consultationId, deviceInfo);
    } catch (err) {
      console.error('[ConsultationProvider] Join failed:', err);
      // Reset so caller can retry
      hasJoinedRef.current = false;
    }
  }, [consultationId, dispatch]);

  // ── handleLeave ───────────────────────────────────────────────────────
  const handleLeave = useCallback(async (metrics = {}) => {
    if (hasLeftRef.current) return;
    hasLeftRef.current  = true;
    hasJoinedRef.current = false; // allow re-join if needed

    try {
      socketLeave(consultationId, metrics);
      await dispatch(leaveConsultation({ id: consultationId, metrics }));
    } catch (err) {
      console.error('[ConsultationProvider] Leave failed:', err);
    }
  }, [consultationId, dispatch]);

  // ── handleStart (doctor only) ─────────────────────────────────────────
  const handleStart = useCallback(async () => {
    try {
      await dispatch(startConsultation(consultationId));
    } catch (err) {
      console.error('[ConsultationProvider] Start failed:', err);
    }
  }, [consultationId, dispatch]);

  // ── handleEnd (doctor only) ───────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    try {
      await dispatch(endConsultation(consultationId));
    } catch (err) {
      console.error('[ConsultationProvider] End failed:', err);
    }
  }, [consultationId, dispatch]);

  // ── Leave + cleanup on unmount ────────────────────────────────────────
  // Fire handleLeave before Redux state is cleared so socket/REST still work
  useEffect(() => {
    return () => {
      // Only fire if user actually joined and hasn't already left
      if (hasJoinedRef.current && !hasLeftRef.current) {
        handleLeave({ reason: 'unmount' });
      }
      // Clear Redux after leave dispatched
      dispatch(clearCurrent());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty — intentional, only runs on unmount

  // ── beforeunload: fire leave synchronously on tab close ───────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasJoinedRef.current && !hasLeftRef.current) {
        hasLeftRef.current = true;
        // Synchronous socket emit only — no await in beforeunload
        socketLeave(consultationId, { reason: 'beforeunload' });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [consultationId]);

  // ── Context value ─────────────────────────────────────────────────────
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