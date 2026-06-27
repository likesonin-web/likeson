'use client';

/**
 * components/support/modals/ModalShell.jsx
 * Shared overlay + entry animation so every modal in this folder behaves
 * identically (per "Modal Entry" animation requirement).
 */
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function ModalShell({ open, onClose, title, children, footer, maxWidth = 'max-w-md' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className={`card w-full ${maxWidth} bg-base-100 p-5 max-h-[85vh] overflow-y-auto`}
          >
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-bold">{title}</h5>
              <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
            {footer && <div className="flex items-center justify-end gap-2 mt-5">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
