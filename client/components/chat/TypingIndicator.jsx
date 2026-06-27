'use client';

import { motion } from 'framer-motion';

export default function TypingIndicator({ names = [] }) {
  if (!names.length) return null;
  const label = names.length === 1 ? `${names[0]} is typing` : `${names.length} people are typing`;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-base-content/55">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-primary"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      {label}…
    </div>
  );
}
