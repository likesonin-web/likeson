'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, FileText } from 'lucide-react';

const CONSENT_POINTS = [
  'This consultation will be conducted via video/audio call.',
  'Your personal and medical information will be kept confidential.',
  'You have the right to end the consultation at any time.',
  'The doctor may recommend in-person follow-up if necessary.',
  'Prescriptions issued are valid for 30 days from issue date.',
  'Your conversation may not be recorded unless explicitly notified.',
];

export function ConsentModal({ open, onAccept, isLoading, role }) {
  const isDoctor = role === 'doctor';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{   opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Telemedicine consent"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1,   opacity: 1, y: 0 }}
            exit={{   scale: 0.9, opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="glass-card p-6 w-full max-w-lg"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="font-montserrat font-bold text-lg text-base-content">
                  Telemedicine Consent
                </h2>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Please read and accept before proceeding
                </p>
              </div>
            </div>

            {/* Consent points */}
            <div className="bg-base-200 rounded-xl p-4 mb-5 max-h-56 overflow-y-auto">
              <ul className="flex flex-col gap-2.5">
                {CONSENT_POINTS.map((point, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary text-xs font-bold">{i + 1}</span>
                    </div>
                    <p className="text-sm text-base-content/80 leading-relaxed">{point}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Policy link */}
            <div className="flex items-center gap-2 mb-5 text-xs text-base-content/50">
              <FileText size={12} />
              By accepting, you agree to our telemedicine terms of service and privacy policy.
            </div>

            {/* Actions */}
            {isDoctor ? (
              <button onClick={onAccept} className="btn btn-primary w-full">
                Acknowledged — Continue
              </button>
            ) : (
              <button
                onClick={onAccept}
                disabled={isLoading}
                className="btn btn-primary w-full"
                aria-label="Accept consent and join waiting room"
              >
                {isLoading
                  ? <span className="loading loading-sm" />
                  : 'I Accept — Join Waiting Room'
                }
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
