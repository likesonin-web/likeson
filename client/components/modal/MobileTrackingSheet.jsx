'use client';
import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

const SNAP_HEIGHTS = {
  peek:   '72px',   // just the drag handle + status strip
  mid:    '55vh',
  full:   '92vh',
};

const SNAP_LEVELS = ['peek', 'mid', 'full'];

/**
 * MobileTrackingSheet
 * Drag-up bottom sheet for mobile tracking view.
 *
 * Props:
 *  - children   — content rendered inside
 *  - statusStrip — element shown at all snap levels (ETA + status)
 */
export default function MobileTrackingSheet({ children, statusStrip }) {
  const [snapIdx, setSnapIdx] = useState(1); // default: mid
  const dragControls          = useDragControls();
  const sheetRef              = useRef(null);

  const snapLevel  = SNAP_LEVELS[snapIdx];
  const snapHeight = SNAP_HEIGHTS[snapLevel];

  const cycleUp = useCallback(() => {
    setSnapIdx(i => Math.min(i + 1, SNAP_LEVELS.length - 1));
  }, []);

  const cycleDown = useCallback(() => {
    setSnapIdx(i => Math.max(i - 1, 0));
  }, []);

  return (
    <motion.div
      ref={sheetRef}
      animate={{ height: snapHeight }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      className="fixed bottom-0 left-0 right-0 z-30 bg-base-100 border-t border-base-300 rounded-t-2xl shadow-depth-lg flex flex-col overflow-hidden"
      aria-label="Ride tracking details"
    >
      {/* Drag handle + controls */}
      <div
        className="flex-shrink-0 flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
        onPointerDown={e => dragControls.start(e)}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-base-300 mb-2" aria-hidden="true" />

        {/* Expand / collapse */}
        <div className="flex items-center justify-between w-full px-3">
          <div className="flex-1">{statusStrip}</div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={cycleDown}
              disabled={snapIdx === 0}
              className="btn btn-ghost btn-xs btn-circle"
              aria-label="Collapse sheet"
            >
              <ChevronDown size={16} />
            </button>
            <button
              onClick={cycleUp}
              disabled={snapIdx === SNAP_LEVELS.length - 1}
              className="btn btn-ghost btn-xs btn-circle"
              aria-label="Expand sheet"
            >
              <ChevronUp size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <AnimatePresence>
        {snapLevel !== 'peek' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto px-3 pb-6 space-y-3 scrollbar-thin"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}