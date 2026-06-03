// services/prescriptionService.js

import API from "@/store/api";

export const saveVitalsAPI = (consultationId, vitals) =>
  API.put(`/consultations/${consultationId}/vitals`, vitals);

export const saveNotesAPI = (consultationId, notes) =>
  API.put(`/consultations/${consultationId}/notes`, notes);

export const getNotesAPI = (consultationId) =>
  API.get(`/consultations/${consultationId}/notes`);

/**
 * issuePrescriptionAPI — supports both JSON (manual) and FormData (upload).
 * If data is FormData (file upload), axios auto-sets multipart headers.
 */
export const issuePrescriptionAPI = (consultationId, data) =>
  API.post(`/consultations/${consultationId}/prescriptions`, data,
    data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
  );

export const getPrescriptionsAPI = (consultationId) =>
  API.get(`/consultations/${consultationId}/prescriptions`);

// Referral — GET + POST
export const saveReferralAPI = (consultationId, data) =>
  API.post(`/consultations/${consultationId}/referral`, data);

export const getReferralAPI = (consultationId) =>
  API.get(`/consultations/${consultationId}/referral`);

// Chat
export const sendChatMessageAPI = (consultationId, message) => {
  const isFormData = message instanceof FormData;
  return API.post(
    `/consultations/${consultationId}/chat`,
    message,
    isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
  );
};

export const getChatHistoryAPI = (consultationId) =>
  API.get(`/consultations/${consultationId}/chat`);

export const deleteChatMessageAPI = (consultationId, messageId) =>
  API.delete(`/consultations/${consultationId}/chat/${messageId}`);

export const uploadDocumentsAPI = (consultationId, formData) =>
  API.post(`/consultations/${consultationId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });