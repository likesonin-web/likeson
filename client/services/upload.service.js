/**
 * services/upload.service.js
 *
 * Wraps routes/support/upload.routes.js. Uses multipart/form-data so the
 * existing ImageKit-backed multer pipeline on the server is untouched.
 */
import API from '@/store/api';

/**
 * @param {string} ticketId
 * @param {File} file
 * @param {'message'|'internal_note'|'ticket'} context
 * @param {(percent:number)=>void} [onProgress]
 */
export const uploadAttachment = (ticketId, file, context = 'message', onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('context', context);

  return API.post(`/support/upload/tickets/${ticketId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (!onProgress || !evt.total) return;
      onProgress(Math.round((evt.loaded * 100) / evt.total));
    },
  }).then((r) => r.data);
};

export const listAttachments = (ticketId) =>
  API.get(`/support/upload/tickets/${ticketId}/attachments`).then((r) => r.data);

export const deleteAttachment = (attachmentId) =>
  API.delete(`/support/upload/attachments/${attachmentId}`).then((r) => r.data);

export const getImageKitAuth = () => API.get('/support/upload/imagekit-auth').then((r) => r.data);
