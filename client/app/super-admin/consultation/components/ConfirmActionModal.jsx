'use client';

import React, { useState } from 'react';

export default function ConfirmActionModal({
  title,
  description,
  requireReason = false,
  confirmLabel = 'Confirm',
  confirmClass  = 'btn btn-primary',
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState('');
  const canConfirm = !requireReason || reason.trim().length >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm mx-4 p-6 bg-base-100 shadow-depth-lg">
        <h3 className="font-montserrat font-black text-base mb-1">{title}</h3>
        <p className="text-xs text-base-content/60 mb-4">{description}</p>

        {requireReason && (
          <div className="mb-4">
            <label className="label-text block mb-1">
              Reason <span className="text-error">*</span>
            </label>
            <input
              className="input-field text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason…"
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn flex-1" onClick={onClose}>Cancel</button>
          <button
            className={`${confirmClass} flex-1`}
            disabled={!canConfirm}
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}