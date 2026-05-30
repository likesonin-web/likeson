// FILE: components/consultation/AttachmentsPanel.jsx
'use client'

import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  uploadAttachment,
  fetchAttachments,
  deleteAttachment,
  selectAttachments,
  selectConsultationLoading,
} from '@/store/slices/consultationSlice';

const TYPE_ICONS = {
  prescription: '💊',
  lab_report:   '🧪',
  xray:         '🩻',
  scan:         '🖼️',
  insurance:    '📋',
  medical_document: '📄',
  image:        '🖼️',
  video:        '🎥',
};

export default function AttachmentsPanel({ consultationId, canUpload = true }) {
  const dispatch = useDispatch();
  
  // Safely grab state
  const attachments = useSelector(selectAttachments);
  const loading = useSelector(selectConsultationLoading);
  
  const fileRef = useRef(null);
  const [type, setType] = useState('medical_document');
  const [desc, setDesc] = useState('');
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreview({ file, name: file.name, size: file.size });
  };

  const handleUpload = async () => {
    if (!preview?.file) return;
    setUploading(true);
    
    try {
      await dispatch(uploadAttachment({
        id: consultationId,
        file: preview.file,
        attachmentType: type,
        description: desc,
        accessLevel: 'shared',
      }));
      await dispatch(fetchAttachments({ id: consultationId }));
      
      // Only reset if successful
      setPreview(null);
      setDesc('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (attachmentId) => {
    dispatch(deleteAttachment({ id: consultationId, attachmentId }));
  };

  // FIX 1: Safely filter to prevent crashes if 'attachments' is undefined
  const active = Array.isArray(attachments) 
    ? attachments.filter(a => !a.isDeleted) 
    : [];

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header + Upload Button */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">
          Files ({active.length})
        </h3>
        {canUpload && (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.mp4,.doc,.docx"
        onChange={handleFileChange}
      />

      {/* Upload preview card */}
      {preview && (
        <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-3 bg-blue-50 dark:bg-blue-950 flex flex-col gap-2">
          <p className="text-xs font-medium text-blue-800 dark:text-blue-300 truncate">{preview.name}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">{(preview.size / 1024).toFixed(1)} KB</p>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="text-xs border border-blue-300 dark:border-blue-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {['prescription','lab_report','xray','scan','insurance','medical_document','image','video']
              .map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)
            }
          </select>
          <input
            type="text"
            placeholder="Description (optional)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            className="text-xs border border-blue-300 dark:border-blue-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {uploading ? 'Uploading…' : 'Confirm Upload'}
            </button>
            <button
              onClick={() => { setPreview(null); if(fileRef.current) fileRef.current.value = ''; }}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
        {active.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-xs gap-2">
            <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            No files yet
          </div>
        )}
        
        {active.map(att => (
          <div
            key={att._id}
            className="group flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-blue-200 dark:hover:border-blue-700 transition-colors"
          >
            <span className="text-2xl flex-shrink-0">{TYPE_ICONS[att.attachmentType] || '📎'}</span>
            
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{att.fileName}</p>
              <p className="text-xs text-gray-400 capitalize">{att.attachmentType?.replace(/_/g, ' ')}</p>
              {att.description && <p className="text-xs text-gray-400 truncate">{att.description}</p>}
              <p className="text-xs text-gray-300 dark:text-gray-600">
                {att.uploaderRole} · {att.uploadedAt ? new Date(att.uploadedAt).toLocaleDateString() : ''}
              </p>
            </div>
            
            {/* FIX 2: Added flex-shrink-0 here to stop buttons from getting squished */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              {att.storageUrl && (
                <a
                  href={att.storageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900 text-blue-600 transition-colors"
                  title="Download"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              )}
              <button
                onClick={() => handleDelete(att._id)}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900 text-red-400 transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}