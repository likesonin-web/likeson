'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export function WaitingRoomStatus({ inQueue, queuePosition, isRejected, isTimedOut, isApproved, onRetry }) {
  return (
    <AnimatePresence mode="wait">
      {isApproved && (
        <motion.div
          key="approved"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-success" />
          </div>
          <p className="font-montserrat font-bold text-xl text-base-content">Admitted!</p>
          <p className="text-sm text-base-content/60">Joining your consultation…</p>
          <div className="loading loading-md" />
        </motion.div>
      )}

      {isRejected && !isApproved && (
        <motion.div
          key="rejected"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center">
            <XCircle size={32} className="text-error" />
          </div>
          <p className="font-montserrat font-bold text-xl text-base-content">Entry Rejected</p>
          <p className="text-sm text-base-content/60">
            The doctor was unable to see you at this time.
          </p>
          <button onClick={onRetry} className="btn btn-outline btn-sm gap-2">
            <RefreshCw size={14} /> Try Again
          </button>
        </motion.div>
      )}

      {isTimedOut && !isRejected && !isApproved && (
        <motion.div
          key="timedout"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center">
            <AlertCircle size={32} className="text-warning" />
          </div>
          <p className="font-montserrat font-bold text-xl text-base-content">Session Timed Out</p>
          <p className="text-sm text-base-content/60">
            You were in the waiting room for too long.
          </p>
          <button onClick={onRetry} className="btn btn-primary btn-sm gap-2">
            <RefreshCw size={14} /> Rejoin Queue
          </button>
        </motion.div>
      )}

      {inQueue && !isApproved && !isRejected && !isTimedOut && (
        <motion.div
          key="waiting"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <div className="relative w-20 h-20">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock size={32} className="text-primary" />
            </div>
            <span className="reconnect-ping absolute inset-0 rounded-full border-2 border-primary" />
          </div>

          <div>
            <p className="font-montserrat font-bold text-xl text-base-content">
              You&rsquo;re in the queue
            </p>
            {queuePosition && (
              <p className="text-base-content/60 text-sm mt-1">
                Position <span className="font-bold text-primary">#{queuePosition}</span> in waiting room
              </p>
            )}
          </div>

          <p className="text-sm text-base-content/50 max-w-xs">
            The doctor will admit you shortly. Please keep this window open.
          </p>

          <div className="flex gap-1.5 mt-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                className="w-2 h-2 rounded-full bg-primary"
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
