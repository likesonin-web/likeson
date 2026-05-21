'use client';
/**
 * TelemedicineConsentModal.jsx
 * Full-screen mandatory consent. Patient cannot join without accepting.
 * Calming medical design — no aggressive animations.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Phone,
  Lock,
  FileText,
  Wifi,
  Activity,
  Check,
  Loader2,
} from 'lucide-react';

import { CONSENT_ITEMS } from './constants';

const ICON_MAP = {
  disclaimer: FileText,
  emergency:  AlertTriangle,
  privacy:    Lock,
  prescription: Activity,
  network:    Wifi,
  limitation: Shield,
};

const ICON_COLOR_MAP = {
  disclaimer:  'text-primary',
  emergency:   'text-error',
  privacy:     'text-success',
  prescription:'text-info',
  network:     'text-warning',
  limitation:  'text-accent',
};

// ─────────────────────────────────────────────────────────────────────────────

function ConsentItem({ item, index }) {
  const [open, setOpen] = useState(index === 0);
  const Icon = ICON_MAP[item.id] ?? Shield;
  const colorClass = ICON_COLOR_MAP[item.id] ?? 'text-primary';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border border-base-300/60 rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3
                   bg-base-200/50 hover:bg-base-200 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-lg bg-base-300/50 flex items-center justify-center flex-shrink-0`}>
            <Icon size={14} className={colorClass} />
          </div>
          <span className="text-sm font-semibold text-base-content">{item.title}</span>
        </div>
        {open ? (
          <ChevronUp size={14} className="text-base-content/40 flex-shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-base-content/40 flex-shrink-0" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="px-4 py-3 text-sm text-base-content/70 leading-relaxed bg-base-100/30">
              {item.body}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TelemedicineConsentModal({ booking, isLoading, onAccept }) {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = useCallback(() => {
    if (!accepted || isLoading) return;
    onAccept();
  }, [accepted, isLoading, onAccept]);

  const doctorName = booking?.doctorSnapshot?.name
    ? `Dr. ${booking.doctorSnapshot.name}`
    : 'your doctor';

  return (
    <div className="min-h-screen bg-base-100 flex flex-col items-center justify-start
                    overflow-y-auto px-4 py-8"
         data-theme="customer">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg mb-6 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20
                        flex items-center justify-center mx-auto mb-4">
          <Shield size={24} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-base-content mb-2">
          Before You Begin
        </h1>
        <p className="text-base-content/60 text-sm leading-relaxed">
          Please read and accept the telemedicine consultation terms to proceed
          with your appointment with {doctorName}.
        </p>
      </motion.div>

      {/* Emergency callout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-lg mb-4 flex items-start gap-3 px-4 py-3
                   rounded-xl bg-error/8 border border-error/20"
      >
        <Phone size={16} className="text-error flex-shrink-0 mt-0.5" />
        <p className="text-sm text-error/90 font-medium">
          <strong>Emergency?</strong> Call 108 immediately. This platform is not for emergencies.
        </p>
      </motion.div>

      {/* Consent items */}
      <div className="w-full max-w-lg flex flex-col gap-2 mb-6">
        {CONSENT_ITEMS.map((item, i) => (
          <ConsentItem key={item.id} item={item} index={i} />
        ))}
      </div>

      {/* Checkbox + CTA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-lg glass-card p-5 flex flex-col gap-4"
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-primary mt-0.5"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            aria-label="I agree to telemedicine consent"
          />
          <span className="text-sm text-base-content leading-relaxed">
            I have read and understood all the above terms. I consent to the
            online telemedicine consultation and acknowledge its limitations.
          </span>
        </label>

        <button
          onClick={handleAccept}
          disabled={!accepted || isLoading}
          className="btn btn-primary w-full flex items-center gap-2 py-3"
          aria-live="polite"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Confirming consent…
            </>
          ) : (
            <>
              <Check size={16} />
              I Agree — Join Consultation
            </>
          )}
        </button>

        <p className="text-xs text-base-content/40 text-center">
          By clicking agree, your consent is recorded with a timestamp and IP address
          as per our privacy policy.
        </p>
      </motion.div>

      <div className="h-8" />
    </div>
  );
}