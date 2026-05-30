'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { UserX } from 'lucide-react';
import { useState } from 'react';

export function KickParticipantModal({ open, participant, onConfirm, onClose }) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(participant?.userId, reason);
    setReason('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{   opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Remove participant"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            exit={{   scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="glass-card p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                <UserX size={20} className="text-error" />
              </div>
              <div>
                <h3 className="font-montserrat font-bold text-base">Remove Participant</h3>
                <p className="text-xs text-base-content/60 mt-0.5">
                  {participant?.name || 'This participant'} will be removed from the call.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="label-text mb-1 block" htmlFor="kick-reason">
                Reason (optional)
              </label>
              <input
                id="kick-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Disruptive behaviour"
                className="input-field"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={handleConfirm} className="btn btn-error flex-1">
                Remove
              </button>
              <button onClick={onClose} className="btn btn-ghost flex-1">
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
