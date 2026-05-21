'use client';
/**
 * ConsultationSummaryModal.jsx
 * Doctor fills summary, diagnosis, follow-up before ending session.
 */

import React, { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, ChevronRight, Loader2 } from 'lucide-react';

/**
 * @param {object}   props
 * @param {boolean}  props.isOpen
 * @param {boolean}  props.isLoading
 * @param {Function} props.onClose
 * @param {Function} props.onSubmit  - ({ summary, followUpInstructions, reason }) => void
 */
export const ConsultationSummaryModal = memo(function ConsultationSummaryModal({
  isOpen,
  isLoading = false,
  onClose,
  onSubmit,
}) {
  const [summary,         setSummary]         = useState('');
  const [followUp,        setFollowUp]        = useState('');
  const [diagnosis,       setDiagnosis]       = useState('');
  const [reason,          setReason]          = useState('Consultation completed');
  const [prescriptionUrl, setPrescriptionUrl] = useState('');

  const handleSubmit = useCallback(() => {
    onSubmit?.({
      consultationSummary:  `${diagnosis ? `Diagnosis: ${diagnosis}\n\n` : ''}${summary}`,
      followUpInstructions: followUp,
      reason,
      prescriptionUrl: prescriptionUrl || undefined,
    });
  }, [summary, followUp, diagnosis, reason, prescriptionUrl, onSubmit]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="summary-modal-title"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-depth-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-base-300">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <FileText size={18} className="text-primary" />
                </div>
                <div>
                  <h2 id="summary-modal-title" className="text-base font-bold text-base-content">
                    End Consultation
                  </h2>
                  <p className="text-xs text-base-content/50">Add summary before closing session</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="btn btn-ghost btn-sm btn-circle"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Diagnosis */}
              <div>
                <label className="label mb-1">
                  <span className="label-text">Diagnosis / Chief Complaint</span>
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Viral fever, Hypertension follow-up..."
                  className="input-field"
                  maxLength={300}
                />
              </div>

              {/* Summary */}
              <div>
                <label className="label mb-1">
                  <span className="label-text">Consultation Summary <span className="text-error">*</span></span>
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief summary of the consultation, findings, and recommendations..."
                  rows={4}
                  className="input-field resize-none"
                  maxLength={2000}
                  required
                />
                <p className="text-xs text-base-content/40 text-right mt-1">{summary.length}/2000</p>
              </div>

              {/* Follow-up */}
              <div>
                <label className="label mb-1">
                  <span className="label-text">Follow-up Instructions</span>
                </label>
                <textarea
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  placeholder="Medicines, lifestyle changes, next appointment..."
                  rows={3}
                  className="input-field resize-none"
                  maxLength={1500}
                />
              </div>

              {/* Prescription URL */}
              <div>
                <label className="label mb-1">
                  <span className="label-text">Prescription URL (optional)</span>
                </label>
                <input
                  type="url"
                  value={prescriptionUrl}
                  onChange={(e) => setPrescriptionUrl(e.target.value)}
                  placeholder="https://..."
                  className="input-field"
                />
                <p className="text-xs text-base-content/40 mt-1">Upload prescription via storage first, paste URL here</p>
              </div>

              {/* Reason for ending */}
              <div>
                <label className="label mb-1">
                  <span className="label-text">Reason for Ending</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-field"
                >
                  <option value="Consultation completed">Consultation completed</option>
                  <option value="Duration limit reached">Duration limit reached</option>
                  <option value="Patient emergency">Patient emergency</option>
                  <option value="Technical issues">Technical issues</option>
                  <option value="Patient requested end">Patient requested end</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-end p-5 border-t border-base-300">
              <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={isLoading}>
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!summary.trim() || isLoading}
                className="btn btn-error btn-sm gap-2"
              >
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ChevronRight size={14} />
                )}
                End Consultation
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default ConsultationSummaryModal;