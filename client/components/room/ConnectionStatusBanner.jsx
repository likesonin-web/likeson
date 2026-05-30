'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectRtConnected } from '@/store/slices/consultationSlice';

export function ConnectionStatusBanner() {
  const connected = useSelector(selectRtConnected);

  return (
    <AnimatePresence>
      {!connected && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -60,  opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute top-0 left-0 right-0 z-40 flex items-center justify-center gap-2 px-4 py-2 bg-warning text-warning-content text-sm font-semibold"
          role="alert"
          aria-live="assertive"
        >
          <WifiOff size={16} />
          Connection lost — reconnecting…
          <RefreshCw size={14} className="animate-spin" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
