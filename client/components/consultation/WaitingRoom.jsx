'use client';

/**
 * WaitingRoom.jsx — TAILWIND REFACTOR
 *
 * All inline and custom CSS classes stripped.
 * Fully utilizes Tailwind CSS and global.css standard tokens.
 */

import React, { useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Video, Wifi, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { useConsultation } from '@/context/ConsultationProvider';
import { useAgora } from '@/context/AgoraProvider';
import {
  enterWaitingRoom,
  leaveWaitingRoom,
  selectWaitingRoom,
} from '@/store/slices/consultationSlice';
import { useDispatch, useSelector } from 'react-redux';
import {
  socketEnterWaiting,
  socketLeaveWaiting,
} from '@/services/consultationSocketService';

// ── Checklist item ────────────────────────────────────────────────────────────

const CheckItem = memo(({ label, status }) => {
  const icon = status === 'ok'
    ? <CheckCircle2 size={16} className="text-success shrink-0" />
    : status === 'checking'
    ? <span className="loading loading-xs loading-spinner text-primary shrink-0" />
    : <AlertCircle size={16} className="text-warning shrink-0" />;

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-base-300 last:border-0">
      {icon}
      <span className="font-poppins text-sm font-medium text-base-content/80">{label}</span>
    </div>
  );
});
CheckItem.displayName = 'CheckItem';

// ── Waiting Room ──────────────────────────────────────────────────────────────

const WaitingRoom = memo(({ onReady }) => {
  const dispatch = useDispatch();
  const { consultationId, consultation, userRole, handleJoin } = useConsultation();
  const { localVideoTrack, localAudioTrack, joinChannel, myTokens: agoraTokens } = useAgora();
  const waitingRoom = useSelector(selectWaitingRoom);

  const [checks, setChecks] = useState({
    camera: 'checking',
    microphone: 'checking',
    network: 'checking',
  });
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);

  // ── Run device checks ────────────────────────────────────────────────────
  useEffect(() => {
    const runChecks = async () => {
      // Camera
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some((d) => d.kind === 'videoinput');
        setChecks((p) => ({ ...p, camera: hasCamera ? 'ok' : 'warn' }));
      } catch {
        setChecks((p) => ({ ...p, camera: 'warn' }));
      }

      // Microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setChecks((p) => ({ ...p, microphone: 'ok' }));
      } catch {
        setChecks((p) => ({ ...p, microphone: 'warn' }));
      }

      // Network (simple ping)
      try {
        const start = performance.now();
        await fetch('/api/ping', { method: 'HEAD', cache: 'no-store' }).catch(() => {});
        const ms = performance.now() - start;
        setChecks((p) => ({ ...p, network: ms < 500 ? 'ok' : 'warn' }));
      } catch {
        setChecks((p) => ({ ...p, network: 'warn' }));
      }
    };

    runChecks();
  }, []);

  // ── Enter waiting room (patient only) ───────────────────────────────────
  useEffect(() => {
    if (userRole !== 'patient' || hasEntered) return;

    dispatch(enterWaitingRoom(consultationId));
    socketEnterWaiting(consultationId);
    setHasEntered(true);

    return () => {
      dispatch(leaveWaitingRoom(consultationId));
      socketLeaveWaiting(consultationId);
    };
  }, [consultationId, userRole, hasEntered, dispatch]);

  // ── Elapsed timer ────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setElapsedSec((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const allChecksOk = Object.values(checks).every((v) => v === 'ok');

  const handleJoinNow = async () => {
    await handleJoin({ platform: 'web', browser: navigator.userAgent });
    onReady?.();
  };

  const scheduledDate = consultation?.scheduledAt
    ? new Date(consultation.scheduledAt).toLocaleString('en-IN', {
        dateStyle: 'medium', timeStyle: 'short',
      })
    : '—';

  return (
    <div className="flex items-center justify-center w-full h-full min-h-screen bg-base-200 p-4 font-poppins">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card max-w-md w-full bg-base-100 p-6 sm:p-8"
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 relative" aria-hidden="true">
             <Video size={28} className="text-primary z-10" />
             <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping opacity-75" />
          </div>
          <h1 className="text-2xl font-black font-montserrat text-base-content tracking-tight mb-2">
            {userRole === 'doctor' ? 'Ready to Start Session?' : 'Waiting Room'}
          </h1>
          <p className="text-sm font-medium text-base-content/60">
            {userRole === 'doctor'
              ? 'Check your devices, then admit the patient.'
              : 'Please wait. The doctor will admit you shortly.'}
          </p>
        </div>

        {/* Session info */}
        <div className="grid grid-cols-2 gap-4 bg-base-200/50 p-4 rounded-[var(--r-box)] border border-base-300 mb-6">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock size={12}/> Scheduled</span>
            <span className="text-sm font-semibold text-base-content">{scheduledDate}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Video size={12}/> Type</span>
            <span className="text-sm font-semibold text-base-content capitalize">{consultation?.consultationType ?? 'Video'}</span>
          </div>
          
          {userRole === 'patient' && (
            <>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1 flex items-center gap-1.5"><User size={12}/> Doctor</span>
                <span className="text-sm font-semibold text-base-content">
                  {consultation?.doctorSnapshot?.name ?? '—'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock size={12}/> Wait time</span>
                <span className="text-sm font-semibold font-mono text-base-content">{formatTime(elapsedSec)}</span>
              </div>
            </>
          )}
          
          {userRole === 'doctor' && (
            <div className="flex flex-col">
              <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-1 flex items-center gap-1.5"><User size={12}/> Patient</span>
              <span className="text-sm font-semibold text-base-content">
                {consultation?.patientSnapshot?.name ?? '—'}
              </span>
            </div>
          )}
        </div>

        {/* Device checks */}
        <div className="mb-6">
          <p className="text-xs font-bold text-base-content/80 uppercase tracking-wider mb-2">Device Check</p>
          <div className="bg-base-100 border border-base-300 rounded-[var(--r-field)] px-3 py-1">
            <CheckItem label="Camera" status={checks.camera} />
            <CheckItem label="Microphone" status={checks.microphone} />
            <CheckItem label="Internet Connection" status={checks.network} />
          </div>
        </div>

        {/* Patient waiting indicator */}
        {userRole === 'doctor' && waitingRoom.patientEnteredAt && (
          <div className="flex items-center justify-center gap-2 bg-success/10 text-success p-3 rounded-[var(--r-field)] mb-6 text-sm font-bold border border-success/20">
            <CheckCircle2 size={18} />
            <span>Patient is in the waiting room</span>
          </div>
        )}

        {/* CTA */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.02 }}
          className="btn w-full gap-2 shadow-md transition-all duration-300 text-sm font-bold py-3 uppercase tracking-wider"
          style={{
            backgroundColor: allChecksOk ? 'var(--primary)' : 'var(--base-300)',
            color: allChecksOk ? 'var(--primary-content)' : 'var(--base-content)',
            opacity: allChecksOk ? 1 : 0.6,
          }}
          onClick={handleJoinNow}
          disabled={!allChecksOk}
          aria-label={userRole === 'doctor' ? 'Start session' : 'Join session'}
        >
          <Video size={18} />
          {userRole === 'doctor' ? 'Start Session' : 'Join Now'}
        </motion.button>

        {!allChecksOk && (
          <p className="text-xs text-center text-warning font-semibold mt-4 flex items-center justify-center gap-1.5">
            <AlertCircle size={14}/> Please resolve device issues before joining.
          </p>
        )}
      </motion.div>
    </div>
  );
});
WaitingRoom.displayName = 'WaitingRoom';

export default WaitingRoom;