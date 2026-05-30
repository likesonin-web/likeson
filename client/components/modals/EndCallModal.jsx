'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { PhoneOff, LogOut } from 'lucide-react';
import { useDispatch }       from 'react-redux';
import { useRouter }         from 'next/navigation';
import {
  endConsultation,
  cancelConsultation,
  selectConsultation,
} from '@/store/slices/consultationSlice';
import { useSelector } from 'react-redux';
import { isDoctor }    from '../../utils/roleHelpers';

export function EndCallModal({ open, onClose, role, consultationId }) {
  const dispatch     = useDispatch();
  const router       = useRouter();
  const consultation = useSelector(selectConsultation);

  const handleLeave = () => {
    onClose();
    router.push(
      isDoctor(role)
        ? `/doctor/consultation/${consultation?.bookingId}`
        : `/consultation/${consultation?.bookingId}`
    );
  };

  const handleEnd = async () => {
    await dispatch(endConsultation({ id: consultationId, reason: 'Doctor ended call' }));
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{   opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="End call options"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            exit={{   scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="glass-card p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                <PhoneOff size={20} className="text-error" />
              </div>
              <div>
                <h3 className="font-montserrat font-bold text-base text-base-content">
                  {isDoctor(role) ? 'End Consultation?' : 'Leave Call?'}
                </h3>
                <p className="text-xs text-base-content/60 mt-0.5">
                  {isDoctor(role)
                    ? 'This will end the call for everyone.'
                    : 'You can rejoin if the consultation is still active.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {isDoctor(role) && (
                <button
                  onClick={handleEnd}
                  className="btn btn-error gap-2 w-full"
                >
                  <PhoneOff size={16} />
                  End for Everyone
                </button>
              )}
              <button
                onClick={handleLeave}
                className="btn btn-ghost border border-base-300 gap-2 w-full"
              >
                <LogOut size={16} />
                {isDoctor(role) ? 'Leave (Keep Open)' : 'Leave Call'}
              </button>
              <button
                onClick={onClose}
                className="btn btn-ghost w-full text-base-content/60"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
