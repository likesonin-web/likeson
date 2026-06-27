'use client';

/**
 * components/support/chat/FileUploader.jsx
 * Drag-drop + click-to-browse uploader feeding useTicketUpload. Shows a
 * per-file progress bar and retry/dismiss controls. Paste-image support
 * lives in MessageComposer (paste events fire on the textarea, not here).
 */
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, X, RefreshCw, CheckCircle2, AlertCircle, FileIcon } from 'lucide-react';

import useTicketUpload from '../../../hooks/useTicketUpload';
import { formatBytes, cn } from '../../../lib/supportutils';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from '../../../lib/supportconstants';

export default function FileUploader({ ticketId, context = 'message', compact = false }) {
  const { items, enqueueFiles, retry, dismiss } = useTicketUpload(ticketId, context);

  const onDrop = useCallback((accepted) => enqueueFiles(accepted), [enqueueFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_UPLOAD_MIME_TYPES.reduce((acc, m) => ({ ...acc, [m]: [] }), {}),
    maxSize: MAX_UPLOAD_SIZE_BYTES,
    noClick: compact,
  });

  return (
    <div className="space-y-2">
      {!compact && (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-field p-4 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'
          )}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-6 h-6 mx-auto text-primary mb-1" />
          <p className="text-xs text-base-content/60">
            {isDragActive ? 'Drop files to upload' : 'Drag & drop, or click to browse'}
          </p>
          <p className="text-[10px] text-base-content/40 mt-0.5">Images, PDF, DOC, XLSX, ZIP · up to 10MB</p>
        </div>
      )}

      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.localId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 rounded-field bg-base-200 px-2.5 py-2"
          >
            <FileIcon className="w-4 h-4 text-base-content/50 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{item.fileName}</p>
              {item.status === 'uploading' && (
                <div className="progress-bar mt-1">
                  <motion.div className="progress-bar-fill" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              {item.status === 'error' && <p className="text-[10px] text-error">{item.error}</p>}
            </div>
            {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
            {item.status === 'error' && (
              <button onClick={() => retry(item.localId)} className="btn btn-ghost btn-circle btn-xs">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => dismiss(item.localId)} className="btn btn-ghost btn-circle btn-xs">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
