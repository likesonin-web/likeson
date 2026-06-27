'use client';

import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/** Shared modal shell — header with close button, scrollable body, optional footer. */
export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md', footer }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className={`w-full ${maxWidth} max-h-[85vh] flex flex-col bg-base-100 rounded-box shadow-xl overflow-hidden`}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
              <h3 className="font-bold text-base">{title}</h3>
              <button type="button" onClick={onClose} className="btn btn-ghost btn-circle btn-sm" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">{children}</div>
            {footer && <div className="px-5 py-3 border-t border-base-300">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
