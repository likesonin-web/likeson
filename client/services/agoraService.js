// services/agoraService.js
// All Agora token + recording REST calls.

import API from "@/store/api";

// ── Token management ──────────────────────────────────────────────────────────

export const provisionAgoraTokensAPI = (consultationId) =>
  API.post(`/consultations/${consultationId}/agora/provision`);

export const getAgoraTokensAPI = (consultationId) =>
  API.get(`/consultations/${consultationId}/agora/tokens`);

export const refreshAgoraTokensAPI = (consultationId) =>
  API.post(`/consultations/${consultationId}/agora/refresh`);

// ── Recording consent ─────────────────────────────────────────────────────────

export const submitRecordingConsentAPI = (consultationId, consented) =>
  API.post(`/consultations/${consultationId}/agora/recording-consent`, { consented });

// ── Recording control (admin) ─────────────────────────────────────────────────

export const startRecordingAPI = (consultationId) =>
  API.post(`/consultations/${consultationId}/agora/recording/start`);

export const stopRecordingAPI = (consultationId) =>
  API.post(`/consultations/${consultationId}/agora/recording/stop`);

export const getRecordingUrlsAPI = (consultationId) =>
  API.get(`/consultations/${consultationId}/agora/recording`);