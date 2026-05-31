'use client';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Car, Navigation, Lock, X } from 'lucide-react';

const SOS_TYPES = [
  { type: 'medical',   label: 'Medical Emergency', icon: ShieldAlert, cls: 'text-error'   },
  { type: 'accident',  label: 'Vehicle Breakdown',  icon: Car,         cls: 'text-warning' },
  { type: 'safety',    label: 'Route Deviation',    icon: Navigation,  cls: 'text-primary' },
  { type: 'other',     label: 'Unsafe Situation',   icon: Lock,        cls: 'text-error'   },
];

/**
 * RideSosPanel
 *
 * Props:
 *  - onTriggerSos(sosType, description) — calls socketService.triggerSos via SocketProvider
 *  - hasActiveSos     {boolean}
 *  - bookingId        {string}
 *  - rideId           {string}
 */
export default function RideSosPanel({ onTriggerSos, hasActiveSos, bookingId, rideId }) {
  const [showModal, setShowModal]   = useState(false);
  const [selected,  setSelected]    = useState(null);
  const [desc,      setDesc]        = useState('');
  const [triggered, setTriggered]   = useState(false);

  const handleOpen = useCallback(() => {
    setShowModal(true);
    setSelected(null);
    setDesc('');
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selected) return;
    onTriggerSos?.(selected, desc || selected);
    setTriggered(true);
    setTimeout(() => {
      setShowModal(false);
      setTriggered(false);
    }, 2000);
  }, [selected, desc, onTriggerSos]);

  if (hasActiveSos) {
    return (
      <div className="card p-4 border-l-4 border-error bg-error/5">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-error animate-pulse" />
          <p className="text-sm font-bold text-error">SOS Active — Help Notified</p>
        </div>
        <p className="text-xs text-error/70 mt-1">Emergency services and admin have been alerted.</p>
      </div>
    );
  }

  return (
    <>
      {/* SOS Trigger Button */}
      <div className="card p-4">
        <button
          onClick={handleOpen}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-error/10 border-2 border-error/30 text-error font-bold text-sm hover:bg-error/20 active:scale-95 transition-all"
          aria-label="Trigger SOS Emergency"
        >
          <ShieldAlert size={18} />
          Emergency SOS
        </button>
        <p className="text-xs text-base-content/40 text-center mt-2">
          Only for real emergencies. Notifies admin + emergency services.
        </p>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="w-full max-w-md bg-base-100 rounded-2xl border border-error/30 p-5 shadow-depth-lg"
            >
              {triggered ? (
                <div className="text-center py-6">
                  <ShieldAlert size={40} className="mx-auto text-error mb-3" />
                  <p className="font-bold text-lg text-error">SOS Triggered</p>
                  <p className="text-sm text-base-content/60 mt-1">Help is on the way.</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={18} className="text-error" />
                      <h3 className="font-bold text-base text-base-content">Emergency SOS</h3>
                    </div>
                    <button
                      onClick={() => setShowModal(false)}
                      className="btn btn-ghost btn-xs btn-circle"
                      aria-label="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Type selection */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {SOS_TYPES.map(({ type, label, icon: Icon, cls }) => (
                      <button
                        key={type}
                        onClick={() => setSelected(type)}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left text-sm font-medium transition-all
                          ${selected === type
                            ? 'border-error bg-error/10 text-error'
                            : 'border-base-300 bg-base-200 text-base-content/70 hover:border-error/40'
                          }`}
                        aria-pressed={selected === type}
                      >
                        <Icon size={15} className={selected === type ? 'text-error' : cls} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Description */}
                  <textarea
                    placeholder="Brief description (optional)"
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    rows={2}
                    className="w-full text-sm bg-base-200 border border-base-300 rounded-lg px-3 py-2 outline-none focus:border-error resize-none mb-4 placeholder:text-base-content/30"
                    maxLength={200}
                  />

                  {/* Confirm */}
                  <button
                    onClick={handleConfirm}
                    disabled={!selected}
                    className="btn btn-error w-full"
                    aria-label="Confirm SOS"
                  >
                    <ShieldAlert size={15} />
                    Confirm SOS — Send Alert
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}