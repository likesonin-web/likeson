'use client';
/**
 * ConsultationCompletedScreen.jsx
 * Post-consultation experience.
 * Shows: summary, prescription, rating form, follow-up eligibility.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Star, FileText, Download,
  RefreshCw, Clock, ChevronRight, Heart,
  Loader2, ExternalLink, ThumbsUp, AlertTriangle,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// STAR RATING
// ─────────────────────────────────────────────────────────────────────────────

function StarRating({ value, onChange, label }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wide">{label}</span>}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform hover:scale-110 active:scale-95"
            aria-label={`${n} star${n !== 1 ? 's' : ''}`}
          >
            <Star
              size={28}
              className="transition-colors"
              fill={(hover || value) >= n ? '#f59e0b' : 'none'}
              stroke={(hover || value) >= n ? '#f59e0b' : '#d1d5db'}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UP CARD
// ─────────────────────────────────────────────────────────────────────────────

function FollowUpCard({ followUp }) {
  if (!followUp?.eligible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card p-4 flex items-start gap-3
                 border border-primary/20 bg-primary/5"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <RefreshCw size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-base-content">Follow-up Available</p>
        <p className="text-xs text-base-content/60 mt-0.5">
          Book a follow-up at a discounted rate.
          {followUp.daysLeft > 0 && ` Valid for ${followUp.daysLeft} more day${followUp.daysLeft !== 1 ? 's' : ''}.`}
        </p>
        {followUp.followUpFee && (
          <p className="text-xs font-semibold text-primary mt-1">
            ₹{followUp.followUpFee} follow-up fee
          </p>
        )}
      </div>
      <ChevronRight size={16} className="text-base-content/30 flex-shrink-0 mt-1" />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function ConsultationCompletedScreen({
  booking,
  followUp,
  onRate,
  isActionLoading,
}) {
  const [doctorRating,   setDoctorRating]   = useState(0);
  const [overallRating,  setOverallRating]  = useState(0);
  const [doctorComment,  setDoctorComment]  = useState('');
  const [overallComment, setOverallComment] = useState('');
  const [submitted,      setSubmitted]      = useState(booking?.isRated ?? false);
  const [activeTab,      setActiveTab]      = useState('summary'); // summary | prescription | rating

  const prescriptionUrl = booking?.onlineConsultation?.prescriptionUrl;
  const summary         = booking?.onlineConsultation?.consultationSummary;
  const followUpInstr   = booking?.onlineConsultation?.followUpInstructions;
  const durationMins    = booking?.onlineConsultation?.durationMinutes;
  const completedAt     = booking?.completedAt
    ? new Date(booking.completedAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  const handleSubmitRating = useCallback(async () => {
    if (!doctorRating || !overallRating) return;
    try {
      await onRate({ doctorRating, doctorComment, overallRating, overallComment });
      setSubmitted(true);
    } catch (_) { /* toast handled in thunk */ }
  }, [doctorRating, doctorComment, overallRating, overallComment, onRate]);

  const TABS = [
    { id: 'summary',      label: 'Summary' },
    { id: 'prescription', label: 'Prescription', badge: !!prescriptionUrl },
    { id: 'rating',       label: 'Rate',         badge: !submitted },
  ];

  return (
    <div className="min-h-screen bg-base-100 flex flex-col items-center px-4 py-8 overflow-y-auto"
         data-theme="customer">
      <div className="w-full max-w-lg flex flex-col gap-5">

        {/* Success header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, delay: 0.1 }}
            className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/30
                       flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle2 size={28} className="text-success" />
          </motion.div>
          <h1 className="text-2xl font-bold text-base-content mb-1">
            Consultation Complete
          </h1>
          <p className="text-sm text-base-content/60">
            {completedAt ? `Ended at ${completedAt}` : 'Your consultation has ended.'}
            {durationMins ? ` · ${durationMins} min` : ''}
          </p>
        </motion.div>

        {/* Doctor card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20
                          flex items-center justify-center overflow-hidden flex-shrink-0">
            {booking?.doctor?.profilePhotoUrl ? (
              <img src={booking.doctor.profilePhotoUrl} alt="Doctor"
                   className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary font-bold text-sm">Dr</span>
            )}
          </div>
          <div>
            <p className="font-semibold text-sm text-base-content">
              {booking?.doctorSnapshot?.name
                ? `Dr. ${booking.doctorSnapshot.name}`
                : 'Consulting Doctor'}
            </p>
            <p className="text-xs text-base-content/50">
              {booking?.doctorSnapshot?.specialization ?? 'General Physician'}
            </p>
          </div>
          <div className="ml-auto">
            <span className="badge badge-success badge-sm">Completed</span>
          </div>
        </motion.div>

        {/* Follow-up */}
        <FollowUpCard followUp={followUp} />

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex gap-1 p-1 bg-base-200/60 rounded-xl mb-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all
                  relative flex items-center justify-center gap-1
                  ${activeTab === tab.id
                    ? 'bg-base-100 text-base-content shadow-sm border border-base-300/40'
                    : 'text-base-content/50 hover:text-base-content/80'
                  }`}
              >
                {tab.label}
                {tab.badge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            {/* SUMMARY TAB */}
            {activeTab === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-3"
              >
                {summary ? (
                  <div className="glass-card p-4">
                    <p className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-2">
                      Consultation Summary
                    </p>
                    <p className="text-sm text-base-content leading-relaxed">{summary}</p>
                  </div>
                ) : (
                  <div className="glass-card p-4 text-center">
                    <p className="text-sm text-base-content/50">
                      Summary will be available shortly.
                    </p>
                  </div>
                )}

                {followUpInstr && (
                  <div className="glass-card p-4 border border-info/20 bg-info/5">
                    <p className="text-xs font-semibold text-info uppercase tracking-wide mb-2">
                      Follow-up Instructions
                    </p>
                    <p className="text-sm text-base-content leading-relaxed">{followUpInstr}</p>
                  </div>
                )}

                {/* Booking ref */}
                <div className="flex items-center justify-between text-xs text-base-content/40 px-1">
                  <span>Booking: {booking?.bookingCode ?? '—'}</span>
                  <Clock size={10} />
                </div>
              </motion.div>
            )}

            {/* PRESCRIPTION TAB */}
            {activeTab === 'prescription' && (
              <motion.div
                key="prescription"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-3"
              >
                {prescriptionUrl ? (
                  <>
                    <div className="glass-card overflow-hidden">
                      <div className="p-3 bg-success/5 border-b border-success/20
                                      flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-success" />
                        <span className="text-xs font-semibold text-success">Prescription Ready</span>
                      </div>
                      <iframe
                        src={`${prescriptionUrl}#toolbar=0`}
                        className="w-full h-64 border-0"
                        title="Prescription preview"
                      />
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={prescriptionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost flex-1 flex items-center gap-2 text-sm"
                      >
                        <ExternalLink size={13} /> Open
                      </a>
                      <a
                        href={prescriptionUrl}
                        download="prescription.pdf"
                        className="btn btn-primary flex-1 flex items-center gap-2 text-sm"
                      >
                        <Download size={13} /> Download
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="glass-card p-8 text-center flex flex-col items-center gap-3">
                    <FileText size={28} className="text-base-content/20" />
                    <p className="text-sm text-base-content/50">
                      Your prescription will appear here once the doctor uploads it.
                    </p>
                    <p className="text-xs text-base-content/30">
                      You'll receive a notification when it's ready.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* RATING TAB */}
            {activeTab === 'rating' && (
              <motion.div
                key="rating"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-4"
              >
                {submitted ? (
                  <div className="glass-card p-8 text-center flex flex-col items-center gap-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 10 }}
                    >
                      <ThumbsUp size={32} className="text-success" />
                    </motion.div>
                    <p className="font-semibold text-base-content">Thank you for your feedback!</p>
                    <p className="text-sm text-base-content/50">
                      Your rating helps us improve the quality of care.
                    </p>
                  </div>
                ) : (
                  <div className="glass-card p-5 flex flex-col gap-5">
                    <p className="text-sm font-medium text-base-content">
                      How was your consultation?
                    </p>

                    <StarRating
                      label="Doctor Rating"
                      value={doctorRating}
                      onChange={setDoctorRating}
                    />
                    <textarea
                      value={doctorComment}
                      onChange={(e) => setDoctorComment(e.target.value)}
                      placeholder="Comments about the doctor (optional)"
                      rows={2}
                      className="input-field text-sm resize-none"
                    />

                    <StarRating
                      label="Overall Experience"
                      value={overallRating}
                      onChange={setOverallRating}
                    />
                    <textarea
                      value={overallComment}
                      onChange={(e) => setOverallComment(e.target.value)}
                      placeholder="Overall comments (optional)"
                      rows={2}
                      className="input-field text-sm resize-none"
                    />

                    <button
                      onClick={handleSubmitRating}
                      disabled={!doctorRating || !overallRating || isActionLoading}
                      className="btn btn-primary w-full flex items-center gap-2"
                    >
                      {isActionLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Heart size={14} />
                      )}
                      Submit Feedback
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Bottom nav */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center pb-4"
        >
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.href = '/dashboard';
            }}
            className="btn btn-ghost text-sm text-base-content/50 flex items-center gap-2 mx-auto"
          >
            Back to Dashboard
          </button>
        </motion.div>

      </div>
    </div>
  );
}