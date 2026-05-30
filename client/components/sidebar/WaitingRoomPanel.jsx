'use client';
import { useSelector, useDispatch } from 'react-redux';
import { selectRtWaitingQueue, approveWaitingRoom, rejectWaitingRoom } from '@/store/slices/consultationSlice';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, UserCheck, UserX, Users, AlertCircle } from 'lucide-react';
import { AvatarWithStatus } from '../shared/AvatarWithStatus';
import { formatDistanceToNow } from 'date-fns';

/**
 * FIX: Previously filtered waitingRoomStatus === 'waiting' only.
 * Patient was marked 'timed_out' by server sweep → filtered out → "No patients waiting".
 *
 * Fix: Show patients with status 'waiting' OR 'timed_out'.
 * 'timed_out' patients can still be manually admitted by the doctor — doctor should see them.
 * Only hide 'approved', 'rejected', 'admitted' (already handled).
 */
const ACTIONABLE_STATUSES = new Set(['waiting', 'timed_out']);

function WaitingPatientCard({ entry, consultationId }) {
  const dispatch = useDispatch();

  const handleAdmit = () => {
    dispatch(approveWaitingRoom({ id: consultationId, userId: entry.userId }));
  };

  const handleReject = () => {
    dispatch(rejectWaitingRoom({ id: consultationId, userId: entry.userId, reason: 'Rejected by doctor' }));
  };

  const timeAgo = entry.enteredAt
    ? formatDistanceToNow(new Date(entry.enteredAt), { addSuffix: true })
    : '';

  const isTimedOut = entry.waitingRoomStatus === 'timed_out';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{   opacity: 0, y: -10 }}
      className="card p-3 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <AvatarWithStatus name={entry.name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-base-content truncate">{entry.name || 'Patient'}</p>
          <p className="text-xs text-base-content/50 flex items-center gap-1">
            <Clock size={10} />
            {timeAgo || 'Waiting'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="badge badge-warning badge-xs">#{entry.queuePosition}</span>
          {/* FIX: Show timed_out badge so doctor understands the state */}
          {isTimedOut && (
            <span className="badge badge-error badge-xs flex items-center gap-0.5">
              <AlertCircle size={8} />
              timed out
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={handleAdmit}
          className="btn btn-success btn-sm flex-1 gap-1"
          aria-label={`Admit ${entry.name}`}
        >
          <UserCheck size={13} />
          Admit
        </button>
        <button
          onClick={handleReject}
          className="btn btn-ghost btn-sm flex-1 gap-1 text-error border border-error/30"
          aria-label={`Reject ${entry.name}`}
        >
          <UserX size={13} />
          Reject
        </button>
      </div>
    </motion.div>
  );
}

export function WaitingRoomPanel({ consultationId }) {
  const waitingQueue = useSelector(selectRtWaitingQueue);

  // FIX: Include 'timed_out' — patient may still be reachable and doctor can admit manually
  const actionable = Object.values(waitingQueue).filter(
    (e) => ACTIONABLE_STATUSES.has(e.waitingRoomStatus)
  );

  if (actionable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center">
          <Users size={24} className="text-base-content/30" />
        </div>
        <p className="text-sm font-semibold text-base-content/50">No patients waiting</p>
        <p className="text-xs text-base-content/30">
          Patients will appear here once they join the waiting room.
        </p>
      </div>
    );
  }

  const waitingCount  = actionable.filter(e => e.waitingRoomStatus === 'waiting').length;
  const timedOutCount = actionable.filter(e => e.waitingRoomStatus === 'timed_out').length;

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wider">
          {waitingCount} waiting
          {timedOutCount > 0 && (
            <span className="ml-1 text-error/60">· {timedOutCount} timed out</span>
          )}
        </p>
      </div>
      <AnimatePresence initial={false}>
        {actionable.map((entry) => (
          <WaitingPatientCard
            key={entry.userId}
            entry={entry}
            consultationId={consultationId}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}