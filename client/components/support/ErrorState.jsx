'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="m-3 alert alert-error"
    >
      <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
      <p className="flex-1 text-sm font-semibold text-base-content leading-snug">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-sm btn-outline shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </motion.div>
  );
}
