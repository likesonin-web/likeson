'use client';

/**
 * components/support/chat/TypingIndicator.jsx
 */
import { motion, AnimatePresence } from 'framer-motion';

export default function TypingIndicator({ typingUsers = [] }) {
  if (!typingUsers.length) return null;

  const label =
    typingUsers.length === 1
      ? `${typingUsers[0].userName} is typing`
      : `${typingUsers.length} people are typing`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 px-4 py-1.5 text-xs text-base-content/50 bg-base-100 border-t border-base-300"
      >
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary inline-block"
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
            />
          ))}
        </span>
        <span>{label}…</span>
      </motion.div>
    </AnimatePresence>
  );
}