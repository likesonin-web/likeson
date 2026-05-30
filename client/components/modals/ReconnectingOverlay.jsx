'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';

export function ReconnectingOverlay({ isReconnecting, attempts, failed, onRetry }) {
  return (
    <AnimatePresence>
      {(isReconnecting || failed) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{   opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="alertdialog"
          aria-label="Reconnecting"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            exit={{   scale: 0.9, opacity: 0 }}
            className="glass-card p-8 flex flex-col items-center gap-4 max-w-sm w-full mx-4 text-center"
          >
            <div className="relative">
              <WifiOff size={40} className="text-warning" />
              {isReconnecting && (
                <span className="reconnect-ping absolute inset-0 rounded-full" />
              )}
            </div>

            {failed ? (
              <>
                <h3 className="font-montserrat font-bold text-lg text-base-content">
                  Unable to Reconnect
                </h3>
                <p className="text-sm text-base-content/60">
                  Connection failed after multiple attempts.
                </p>
                <button onClick={onRetry} className="btn btn-primary gap-2">
                  <RefreshCw size={16} />
                  Try Again
                </button>
              </>
            ) : (
              <>
                <h3 className="font-montserrat font-bold text-lg text-base-content">
                  Reconnecting…
                </h3>
                <p className="text-sm text-base-content/60">
                  Attempt {attempts} of 10. Please wait.
                </p>
                <div className="loading loading-md" aria-label="Loading" />
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
