'use client';

/**
 * hooks/useTicketUpload.js
 * Drives the upload queue: drag-drop / paste / picker -> ImageKit -> attachment.
 */
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { uploadTicketAttachment, removeUploadQueueItem, selectUploadQueue } from '../store/slices/supportSlice';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from '../lib/supportconstants';

/** Generates a local-only id for tracking upload progress — no extra dependency needed. */
const makeLocalId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `upl_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export default function useTicketUpload(ticketId, context = 'message') {
  const dispatch = useDispatch();
  const uploadQueue = useSelector(selectUploadQueue);
  const [localIds, setLocalIds] = useState([]);

  const validate = (file) => {
    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
      toast.error(`${file.name}: file type not allowed.`);
      return false;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error(`${file.name}: exceeds 10MB limit.`);
      return false;
    }
    return true;
  };

  const enqueueFiles = useCallback(
    (files) => {
      const accepted = Array.from(files).filter(validate);
      const newLocalIds = accepted.map((file) => {
        const localId = makeLocalId();
        dispatch(uploadTicketAttachment({ ticketId, file, context, localId }));
        return localId;
      });
      setLocalIds((prev) => [...prev, ...newLocalIds]);
      return newLocalIds;
    },
    [ticketId, context, dispatch]
  );

  const retry = useCallback(
    (localId, file) => {
      dispatch(uploadTicketAttachment({ ticketId, file, context, localId }));
    },
    [ticketId, context, dispatch]
  );

  const dismiss = useCallback((localId) => dispatch(removeUploadQueueItem(localId)), [dispatch]);

  const items = localIds.map((id) => ({ localId: id, ...uploadQueue[id] })).filter((i) => i.fileName);

  return { items, enqueueFiles, retry, dismiss };
}
