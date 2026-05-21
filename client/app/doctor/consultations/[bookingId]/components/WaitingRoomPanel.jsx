'use client';
/**
 * WaitingRoomPanel.jsx
 * Doctor controls for waiting room: approve/reject/timeout patients.
 */

import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, UserX, Clock, Users, Loader2, Bell } from 'lucide-react';
import { clearTimers } from '@/utils/cleanup';

const WAIT_TIMEOUT_SECONDS = 120; // auto-reject after 2 min if doctor ignores

/**
 * @param {object} props
 * @param {Array}    props.waitingPatients  - [{ id, name, joinedAt, avatarUrl }]
 * @param {boolean}  props.waitingRoomEnabled
 * @param {Function} props.onApprove        - (patientId) => void
 * @param {Function} props.onReject         - (patientId) => void
 */
export const WaitingRoomPanel = memo(function WaitingRoomPanel({
  waitingPatients = [],
  waitingRoomEnabled = true,
  onApprove,
  onReject,
}) {
  if (!waitingRoomEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-base-content/40 gap-2">
        <Users size={24} />
        <span className="text-sm">Waiting room disabled</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-base-content">Waiting Room</h4>
        {waitingPatients.length > 0 && (
          <span className="badge badge-warning badge-xs">{waitingPatients.length} waiting</span>
        )}
      </div>

      {waitingPatients.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-base-content/40 gap-2">
          <Clock size={20} />
          <span className="text-xs">No patients waiting</span>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {waitingPatients.map((patient) => (
            <WaitingPatientCard
              key={patient.id}
              patient={patient}
              onApprove={onApprove}
              onReject={onReject}
              timeoutSeconds={WAIT_TIMEOUT_SECONDS}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
});

const WaitingPatientCard = memo(function WaitingPatientCard({
  patient, onApprove, onReject, timeoutSeconds,
}) {
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [loading,     setLoading]     = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    const joined = new Date(patient.joinedAt).getTime();
    const update = () => {
      setWaitSeconds(Math.floor((Date.now() - joined) / 1000));
    };
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => clearTimers(intervalRef.current);
  }, [patient.joinedAt]);

  const handleApprove = useCallback(async () => {
    setLoading(true);
    try { await onApprove?.(patient.id); }
    finally { setLoading(false); }
  }, [patient.id, onApprove]);

  const handleReject = useCallback(async () => {
    setLoading(true);
    try { await onReject?.(patient.id); }
    finally { setLoading(false); }
  }, [patient.id, onReject]);

  const formatWait = (s) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const isUrgent = waitSeconds > timeoutSeconds * 0.7;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`
        flex items-center gap-3 p-3 rounded-xl border transition-colors
        ${isUrgent
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-base-200 border-base-300'
        }
      `}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
        {patient.avatarUrl ? (
          <img src={patient.avatarUrl} alt={patient.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span className="text-primary font-bold text-sm">
            {patient.name?.[0]?.toUpperCase() ?? 'P'}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-base-content truncate">{patient.name}</p>
        <div className="flex items-center gap-1 text-xs text-base-content/50">
          <Clock size={10} />
          <span className={isUrgent ? 'text-amber-400' : ''}>
            Waiting {formatWait(waitSeconds)}
          </span>
        </div>
      </div>

      {/* Actions */}
      {loading ? (
        <Loader2 size={16} className="animate-spin text-primary" />
      ) : (
        <div className="flex gap-1.5">
          <button
            onClick={handleApprove}
            aria-label={`Approve ${patient.name}`}
            className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors border border-emerald-500/30"
          >
            <UserCheck size={14} />
          </button>
          <button
            onClick={handleReject}
            aria-label={`Reject ${patient.name}`}
            className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors border border-red-500/30"
          >
            <UserX size={14} />
          </button>
        </div>
      )}
    </motion.div>
  );
});

export default WaitingRoomPanel;