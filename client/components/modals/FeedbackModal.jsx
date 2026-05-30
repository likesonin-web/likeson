'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { submitFeedback, selectConsultationLoading } from '@/store/slices/consultationSlice';

function StarRating({ label, value, onChange, required }) {
  return (
    <div>
      <label className="label-text mb-1 block">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <div className="flex gap-1" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`p-1 rounded transition-colors ${star <= value ? 'text-warning' : 'text-base-300 hover:text-warning/60'}`}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            <Star size={20} fill={star <= value ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function FeedbackModal({ open, onClose, consultationId }) {
  const dispatch = useDispatch();
  const loading  = useSelector(selectConsultationLoading);

  const [ratings, setRatings] = useState({
    patientRating:           0,
    audioQualityRating:      0,
    videoQualityRating:      0,
    waitingExperienceRating: 0,
  });
  const [review, setReview] = useState('');

  const setRating = useCallback((key, val) => {
    setRatings((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleSubmit = async () => {
    if (!ratings.patientRating) return;
    await dispatch(submitFeedback({ id: consultationId, ...ratings, review }));
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
          role="dialog"
          aria-modal="true"
          aria-label="Rate your consultation"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1,   opacity: 1, y: 0 }}
            exit={{   scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="glass-card p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-montserrat font-bold text-lg text-base-content">
                Rate Your Consultation
              </h3>
              <button
                onClick={onClose}
                className="btn btn-xs btn-circle btn-ghost"
                aria-label="Skip feedback"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <StarRating
                label="Overall Experience"
                value={ratings.patientRating}
                onChange={(v) => setRating('patientRating', v)}
                required
              />
              <StarRating
                label="Audio Quality"
                value={ratings.audioQualityRating}
                onChange={(v) => setRating('audioQualityRating', v)}
              />
              <StarRating
                label="Video Quality"
                value={ratings.videoQualityRating}
                onChange={(v) => setRating('videoQualityRating', v)}
              />
              <StarRating
                label="Waiting Experience"
                value={ratings.waitingExperienceRating}
                onChange={(v) => setRating('waitingExperienceRating', v)}
              />

              <div>
                <label className="label-text mb-1 block" htmlFor="review">
                  Comments (optional)
                </label>
                <textarea
                  id="review"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Share your experience…"
                  className="rx-textarea"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSubmit}
                disabled={!ratings.patientRating || loading.feedback}
                className="btn btn-primary flex-1"
              >
                {loading.feedback ? <span className="loading loading-sm" /> : 'Submit Feedback'}
              </button>
              <button onClick={onClose} className="btn btn-ghost text-base-content/60">
                Skip
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
