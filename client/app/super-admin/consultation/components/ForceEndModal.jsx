'use client';

import React, { useState } from 'react';

export default function ForceEndModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const isValid = reason.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 backdrop-blur-sm">
      <div className="card w-full max-w-md mx-4 p-6 bg-base-100 shadow-depth-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-montserrat font-black text-base text-base-content">Force End Consultation</h3>
            <p className="text-xs text-base-content/50">This action cannot be undone.</p>
          </div>
        </div>

        <div className="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
          <span className="text-xs">Consultation will be immediately terminated and marked as completed.</span>
        </div>

        <label className="label-text block mb-1">
          Reason <span className="text-error">*</span>
          <span className="text-base-content/30 font-normal ml-1">(min 10 characters)</span>
        </label>
        <textarea
          className="input-field mb-1 resize-none text-sm"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Provide a detailed reason for force-ending this consultation…"
          autoFocus
        />
        {reason.length > 0 && !isValid && (
          <p className="text-error text-xs mb-3">Reason must be at least 10 characters.</p>
        )}

        <div className="flex gap-2 mt-4">
          <button className="btn flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-error flex-1"
            disabled={!isValid}
            onClick={() => onConfirm(reason.trim())}
          >
            Force End
          </button>
        </div>
      </div>
    </div>
  );
}