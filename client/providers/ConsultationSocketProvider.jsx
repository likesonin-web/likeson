// ─── ConsultationSocketProvider.jsx ──────────────────────────────────────────
// Route: /providers/ConsultationSocketProvider.jsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
} from 'react';
import { useSelector } from 'react-redux';
import { selectToken, selectUser } from '@/store/slices/userSlice';
import consultationService from '@/services/consultationService';
import { store } from '@/store/index';

// ─── Context ──────────────────────────────────────────────────────────────────

const ConsultationContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ConsultationProvider({ children }) {
  const token = useSelector(selectToken);
  const user  = useSelector(selectUser);

  // ── Connect / disconnect on auth change ──────────────────────────────────
useEffect(() => {
  if (!token || !user) {
    consultationService.disconnect();
    return;
  }
  consultationService.connect(store);
  return () => consultationService.disconnect();
}, [token]); // user change no-op if token same

  // ── Stable callbacks ──────────────────────────────────────────────────────

  // connection
  const isConnected           = useCallback(() => consultationService.isConnected(), []);

  // room
  const joinConsultation      = useCallback((p) => consultationService.joinConsultation(p), []);
  const leaveConsultation     = useCallback((p) => consultationService.leaveConsultation(p), []);

  // Agora SDK bridge
  const emitParticipantJoin   = useCallback((p) => consultationService.emitParticipantJoin(p), []);
  const emitParticipantLeave  = useCallback((p) => consultationService.emitParticipantLeave(p), []);
  const emitNetworkQuality    = useCallback((p) => consultationService.emitNetworkQuality(p), []);
  const emitReconnectAttempt  = useCallback((p) => consultationService.emitReconnectAttempt(p), []);
  const emitReconnectSuccess  = useCallback((p) => consultationService.emitReconnectSuccess(p), []);
  const emitSdkError          = useCallback((p) => consultationService.emitSdkError(p), []);

  // screen share
  const emitScreenShareStart  = useCallback((p) => consultationService.emitScreenShareStart(p), []);
  const emitScreenShareStop   = useCallback((p) => consultationService.emitScreenShareStop(p), []);

  // interaction
  const emitRaiseHand         = useCallback((p) => consultationService.emitRaiseHand(p), []);
  const emitLowerHand         = useCallback((p) => consultationService.emitLowerHand(p), []);

  // telemedicine
  const emitConsentGiven      = useCallback((p) => consultationService.emitConsentGiven(p), []);
  const emitDoctorStatus      = useCallback((online) => consultationService.emitDoctorStatus(online), []);

  // host actions (doctor / admin)
  const emitKickParticipant   = useCallback((p) => consultationService.emitKickParticipant(p), []);
  const emitMuteParticipant   = useCallback((p) => consultationService.emitMuteParticipant(p), []);

  // admin
  const emitAdminBroadcast    = useCallback((p) => consultationService.emitAdminBroadcast(p), []);

  // util
  const ping                  = useCallback(() => consultationService.ping(), []);

  const value = {
    isConnected,

    // room
    joinConsultation,
    leaveConsultation,

    // Agora
    emitParticipantJoin,
    emitParticipantLeave,
    emitNetworkQuality,
    emitReconnectAttempt,
    emitReconnectSuccess,
    emitSdkError,

    // screen share
    emitScreenShareStart,
    emitScreenShareStop,

    // interaction
    emitRaiseHand,
    emitLowerHand,

    // telemedicine
    emitConsentGiven,
    emitDoctorStatus,

    // host actions
    emitKickParticipant,
    emitMuteParticipant,

    // admin
    emitAdminBroadcast,

    // util
    ping,
  };

  return (
    <ConsultationContext.Provider value={value}>
      {children}
    </ConsultationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConsultation() {
  const ctx = useContext(ConsultationContext);
  if (!ctx) throw new Error('useConsultation must be used inside <ConsultationProvider>');
  return ctx;
}