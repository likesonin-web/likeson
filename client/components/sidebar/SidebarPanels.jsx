'use client';

import { useState as _useState, useRef as _useRef } from 'react';
import { Trash2, Paperclip, Download, FileText, Image } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  deleteAttachment,
  uploadAttachment,
  fetchAttachments,
  selectAttachments,
  selectConsultationLoading,
  saveDoctorNotes,
} from '@/store/slices/consultationSlice';

/* ── VitalsSection ─────────────────────────────────────────────────────────── */
export function VitalsSection({ vitals, onChange }) {
  const fields = [
    { key: 'bloodPressure', label: 'BP',       placeholder: '120/80' },
    { key: 'pulseRate',     label: 'Pulse',    placeholder: 'bpm' },
    { key: 'temperature',   label: 'Temp',     placeholder: '°F' },
    { key: 'spO2',          label: 'SpO₂',     placeholder: '%' },
    { key: 'bloodSugar',    label: 'Sugar',    placeholder: 'mg/dL' },
    { key: 'weightKg',      label: 'Weight',   placeholder: 'kg' },
    { key: 'heightCm',      label: 'Height',   placeholder: 'cm' },
  ];

  return (
    <div>
      <p className="rx-section-title">Vitals</p>
      <div className="rx-vitals-grid">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="rx-label" htmlFor={`vital-${key}`}>{label}</label>
            <input
              id={`vital-${key}`}
              value={vitals?.[key] || ''}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder={placeholder}
              className="rx-input"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── MedicineRow ─────────────────────────────────────────────────────────── */
const FREQUENCIES = ['OD', 'BD', 'TDS', 'QID', 'SOS', 'HS', 'AC', 'PC', 'STAT', 'Weekly', 'Monthly', 'As Directed'];
const TIMINGS     = ['Before Food', 'After Food', 'With Food', 'Empty Stomach', 'Bedtime', 'As Directed'];
const ROUTES      = ['Oral', 'Topical', 'IV', 'IM', 'Inhalation', 'Sublingual', 'Rectal', 'Other'];

export function MedicineRow({ medicine, index, onChange, onRemove }) {
  const set = (field, val) => onChange(index, field, val);

  return (
    <div className="rx-medicine-row">
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="rx-remove-btn"
        aria-label="Remove medicine"
      >
        <Trash2 size={12} />
      </button>

      <div className="rx-medicine-grid">
        <div>
          <label className="rx-label">Medicine Name</label>
          <input
            value={medicine.medicineName}
            onChange={(e) => set('medicineName', e.target.value)}
            placeholder="e.g. Paracetamol"
            className="rx-input"
          />
        </div>
        <div>
          <label className="rx-label">Dosage</label>
          <input
            value={medicine.dosage}
            onChange={(e) => set('dosage', e.target.value)}
            placeholder="500mg"
            className="rx-input"
          />
        </div>
        <div>
          <label className="rx-label">Frequency</label>
          <select value={medicine.frequency} onChange={(e) => set('frequency', e.target.value)} className="rx-select">
            {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="rx-label">Duration (days)</label>
          <input
            type="number"
            min={1}
            value={medicine.durationDays}
            onChange={(e) => set('durationDays', Number(e.target.value))}
            className="rx-input"
          />
        </div>
        <div>
          <label className="rx-label">Timing</label>
          <select value={medicine.timing} onChange={(e) => set('timing', e.target.value)} className="rx-select">
            {TIMINGS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="rx-label">Route</label>
          <select value={medicine.route} onChange={(e) => set('route', e.target.value)} className="rx-select">
            {ROUTES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="rx-label">Instructions</label>
        <input
          value={medicine.instructions || ''}
          onChange={(e) => set('instructions', e.target.value)}
          placeholder="Additional instructions…"
          className="rx-input"
        />
      </div>
    </div>
  );
}

/* ── LabTestRow ─────────────────────────────────────────────────────────── */
export function LabTestRow({ test, index, onChange, onRemove }) {
  const set = (field, val) => onChange(index, field, val);

  return (
    <div className="rx-lab-row relative">
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="rx-remove-btn"
        aria-label="Remove lab test"
      >
        <Trash2 size={12} />
      </button>

      <div>
        <label className="rx-label">Test Name</label>
        <input
          value={test.testName}
          onChange={(e) => set('testName', e.target.value)}
          placeholder="e.g. CBC, HbA1c"
          className="rx-input"
        />
      </div>
      <div>
        <label className="rx-label">Urgency</label>
        <select value={test.urgency} onChange={(e) => set('urgency', e.target.value)} className="rx-select">
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="stat">STAT</option>
        </select>
      </div>
      <div>
        <label className="rx-label">Instructions</label>
        <input
          value={test.instructions || ''}
          onChange={(e) => set('instructions', e.target.value)}
          placeholder="Fasting, morning sample…"
          className="rx-input"
        />
      </div>
    </div>
  );
}

/* ── DoctorNotesPanel ─────────────────────────────────────────────────────── */
export function DoctorNotesPanel({ consultationId }) {
  const dispatch = useDispatch();
  const loading  = useSelector(selectConsultationLoading);
  const [notes, setNotes] = _useState('');

  const save = () => dispatch(saveDoctorNotes({ id: consultationId, notes }));

  return (
    <div className="p-3 flex flex-col gap-3">
      <p className="rx-section-title">Private Notes</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Clinical notes visible only to you…"
        className="rx-textarea"
        rows={6}
        aria-label="Doctor private notes"
      />
      <button
        onClick={save}
        disabled={loading.notes || !notes.trim()}
        className="btn btn-primary btn-sm self-end"
      >
        {loading.notes ? <span className="loading loading-xs" /> : 'Save Notes'}
      </button>
    </div>
  );
}

/* ── AttachmentItem ─────────────────────────────────────────────────────── */
function AttachmentItem({ attachment, onDelete, canDelete }) {
  const isImage = attachment.mimeType?.startsWith('image/');

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
      <div className="w-8 h-8 rounded bg-base-300 flex items-center justify-center shrink-0">
        {isImage ? <Image size={16} className="text-info" /> : <FileText size={16} className="text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-base-content truncate">{attachment.fileName}</p>
        <p className="text-xs text-base-content/40">{attachment.attachmentType}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        {attachment.storageUrl && (
          <a
            href={attachment.storageUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-xs btn-circle btn-ghost"
            aria-label="Download"
          >
            <Download size={12} />
          </a>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(attachment._id)}
            className="btn btn-xs btn-circle btn-ghost text-error"
            aria-label="Delete attachment"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── AttachmentsPanel ─────────────────────────────────────────────────────── */
export function AttachmentsPanel({ consultationId, userId }) {
  const dispatch    = useDispatch();
  const loading     = useSelector(selectConsultationLoading);
  const attachments = useSelector(selectAttachments);
  const fileRef     = _useRef(null);
  const [type, setType]         = _useState('medical_document');
  const [desc, setDesc]         = _useState('');
  const [preview, setPreview]   = _useState(null);
  const [uploading, setUploading] = _useState(false);

  const TYPES = ['prescription','lab_report','xray','scan','insurance','medical_document','image','video'];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreview({ file, name: file.name, size: file.size });
  };

  const handleUpload = async () => {
    if (!preview?.file) return;
    setUploading(true);
    await dispatch(uploadAttachment({
      id: consultationId,
      file: preview.file,
      attachmentType: type,
      description: desc,
      accessLevel: 'shared',
    }));
    await dispatch(fetchAttachments({ id: consultationId }));
    setPreview(null);
    setDesc('');
    if (fileRef.current) fileRef.current.value = '';
    setUploading(false);
  };

  const handleDelete = (attachmentId) => {
    dispatch(deleteAttachment({ id: consultationId, attachmentId }));
  };

  const active = attachments.filter((a) => !a.isDeleted);

  return (
    <div className="flex flex-col h-full">
      {/* Header + Upload button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-base-300 shrink-0">
        <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
          Files ({active.length})
        </span>
        <button
          onClick={() => fileRef.current?.click()}
          className="btn btn-xs btn-primary gap-1"
          aria-label="Upload file"
        >
          <Paperclip size={11} />
          Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.mp4,.doc,.docx,.webp"
          onChange={handleFileChange}
        />
      </div>

      {/* Upload preview */}
      {preview && (
        <div className="mx-3 mt-2 p-3 rounded-xl border border-primary/30 bg-primary/5 flex flex-col gap-2 shrink-0">
          <p className="text-xs font-semibold text-base-content truncate">{preview.name}</p>
          <p className="text-xs text-base-content/40">{(preview.size / 1024).toFixed(1)} KB</p>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="select select-xs select-bordered w-full"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="input input-xs input-bordered w-full"
          />
          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn btn-xs btn-primary flex-1"
            >
              {uploading ? <span className="loading loading-xs" /> : 'Upload'}
            </button>
            <button
              onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
              className="btn btn-xs btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
            <Paperclip size={24} className="text-base-content/20" />
            <p className="text-sm text-base-content/40">No attachments yet</p>
            <p className="text-xs text-base-content/30">Click Upload to add files</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {active.map((att) => (
              <AttachmentItem
                key={att._id}
                attachment={att}
                onDelete={handleDelete}
                canDelete={String(att.uploadedBy) === String(userId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}