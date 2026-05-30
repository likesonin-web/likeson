'use client';

import React from 'react';

export default function AdminNotesTab({ notes, onChange, onSave, loading }) {
  return (
    <div className="flex flex-col h-full px-3 py-3 gap-3">
      <div>
        <p className="label-text text-[10px] uppercase tracking-widest text-base-content/40 mb-1">
          Internal Admin Notes
        </p>
        <p className="text-[10px] text-base-content/30">
          Only visible to admin/superadmin. Not shown to doctor or patient.
        </p>
      </div>

      <textarea
        className="input-field flex-1 resize-none text-xs"
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => notes.trim() && onSave(notes)}
        placeholder="Add internal notes here… (auto-saves on blur)"
        rows={12}
      />

      <button
        className="btn btn-primary btn-sm w-full"
        onClick={() => notes.trim() && onSave(notes)}
        disabled={!notes.trim() || loading}
      >
        {loading ? <span className="loading loading-xs" /> : 'Save Notes'}
      </button>
    </div>
  );
}