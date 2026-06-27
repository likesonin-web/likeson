'use client';

import { Phone, PhoneOff, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import Avatar from './Avatar';

export default function IncomingCallModal({ call, onAccept, onDecline }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    // BUG FIX #28 – AnimatePresence needs its direct child to have a `key`
    // so exit animations fire when `call` goes from truthy to null.
    // The outer guard was also wrong: we must always render AnimatePresence
    // (with `call` controlling the child), not bail early before it.
    <AnimatePresence>
      {call && (
        <motion.div
          key="incoming-call-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral/70 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 16, opacity: 0 }}
            className="w-full max-w-sm bg-base-100 rounded-box shadow-2xl p-6 text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-4">
              Incoming {call.type === 'video' ? 'video' : 'voice'} call
            </p>

            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="flex justify-center mb-3"
            >
              <Avatar src={call.initiator?.avatar} name={call.initiator?.name} size="xl" />
            </motion.div>

            <h3 className="text-lg font-bold">{call.initiator?.name}</h3>
            <p className="text-sm text-base-content/55 capitalize mb-8">{call.initiator?.role}</p>

            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={onDecline}
                className="btn btn-circle btn-error w-14 h-14"
                aria-label="Decline call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="btn btn-circle btn-success w-14 h-14"
                aria-label="Accept call"
              >
                {call.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
