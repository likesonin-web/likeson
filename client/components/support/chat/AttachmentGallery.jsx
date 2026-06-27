'use client';

/**
 * components/support/chat/AttachmentGallery.jsx
 * Renders a ticket's attachments — image thumbnails open lightbox-style,
 * other files show an icon + size + download link. Used in both the
 * Ticket Details panel (compact) and inside IMAGE/FILE message bubbles.
 */
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, FileSpreadsheet, FileArchive, Download, Trash2, X } from 'lucide-react';

import { deleteAttachment } from '../../../store/slices/supportSlice';
import { formatBytes, cn } from '../../../lib/supportutils';
import useRolePermissions from '../../../hooks/useRolePermissions';

const ICONS = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  zip: FileArchive,
};

function isImage(attachment) {
  return attachment.mimeType?.startsWith('image/');
}

export default function AttachmentGallery({ attachments = [], ticketId, compact = false }) {
  const dispatch = useDispatch();
  const { user, isSuperAdmin } = useRolePermissions();
  const [lightbox, setLightbox] = useState(null);

  if (!attachments.length) {
    return <p className="text-xs text-base-content/40">No attachments yet.</p>;
  }

  const canDelete = (a) => isSuperAdmin || String(a.uploadedBy?._id || a.uploadedBy) === String(user?._id);

  return (
    <>
      <div className={cn('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-4')}>
        {attachments.map((a) => {
          const Icon = ICONS[a.fileType?.toLowerCase()] || FileText;
          return (
            <motion.div
              key={a._id}
              whileHover={{ scale: 1.03 }}
              className="relative group rounded-field overflow-hidden border border-base-300 aspect-square bg-base-200"
            >
              {isImage(a) ? (
                <button onClick={() => setLightbox(a)} className="w-full h-full">
                  <img src={a.thumbnailUrl || a.imageKitUrl} alt={a.originalName} className="w-full h-full object-cover" />
                </button>
              ) : (
                <a
                  href={a.imageKitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center h-full gap-1 p-2 text-center"
                >
                  <Icon className="w-6 h-6 text-primary" />
                  <span className="text-[10px] text-base-content/60 truncate w-full">{a.originalName}</span>
                </a>
              )}

              {canDelete(a) && (
                <button
                  onClick={() => dispatch(deleteAttachment({ ticketId, attachmentId: a._id }))}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-1"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-6"
          >
            <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white">
              <X className="w-6 h-6" />
            </button>
            <img src={lightbox.imageKitUrl} alt={lightbox.originalName} className="max-h-full max-w-full rounded-box" />
            <a
              href={lightbox.imageKitUrl}
              download={lightbox.originalName}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-4 right-4 btn btn-primary btn-sm"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
