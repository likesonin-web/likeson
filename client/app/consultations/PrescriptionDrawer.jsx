'use client';
/**
 * PrescriptionDrawer.jsx
 * Shows prescription PDF when doctor uploads it.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, FileText, Download, ExternalLink,
  ZoomIn, ZoomOut, Share2, CheckCircle2,
} from 'lucide-react';

export function PrescriptionDrawer({ booking, onClose }) {
  const [zoom, setZoom] = useState(1);
  const prescriptionUrl = booking?.onlineConsultation?.prescriptionUrl;
  const uploadedAt = booking?.onlineConsultation?.prescriptionUploadedAt;

  const uploadedStr = uploadedAt
    ? new Date(uploadedAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col
                 max-h-[85vh] bg-base-100 rounded-t-2xl shadow-2xl
                 border-t border-base-300/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3
                      border-b border-base-300/40">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-success" />
          <span className="font-semibold text-sm">Prescription</span>
          {uploadedStr && (
            <span className="text-xs text-base-content/40">{uploadedStr}</span>
          )}
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-base-200
                                              flex items-center justify-center hover:bg-base-300 transition-colors">
          <X size={14} className="text-base-content/70" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {prescriptionUrl ? (
          <>
            {/* PDF viewer */}
            <div className="p-3 overflow-hidden" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              <iframe
                src={`${prescriptionUrl}#toolbar=0`}
                className="w-full min-h-[400px] rounded-xl border border-base-300/40"
                title="Prescription"
              />
            </div>

            {/* Zoom + actions */}
            <div className="px-4 pb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                  className="btn btn-ghost btn-sm w-8 h-8 p-0"
                  aria-label="Zoom out"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="text-xs text-base-content/50 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                  className="btn btn-ghost btn-sm w-8 h-8 p-0"
                  aria-label="Zoom in"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <a
                  href={prescriptionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm flex items-center gap-1.5 text-xs"
                >
                  <ExternalLink size={12} /> Open
                </a>
                <a
                  href={prescriptionUrl}
                  download="prescription.pdf"
                  className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs"
                >
                  <Download size={12} /> Download
                </a>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText size={32} className="text-base-content/20" />
            <p className="text-sm text-base-content/50 text-center px-8">
              Your prescription will appear here once the doctor uploads it.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default PrescriptionDrawer;


 