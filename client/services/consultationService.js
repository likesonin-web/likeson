// services/consultationService.js
// All REST calls — no Redux logic.

import API from "@/store/api";

export const createConsultationAPI = (data) => API.post("/consultations/create", data);
export const getConsultationByIdAPI = (id) => API.get(`/consultations/${id}`);
export const getConsultationByBookingAPI = (bookingId) => API.get(`/consultations/booking/${bookingId}`);
export const listConsultationsAPI = (params) => API.get("/consultations/admin/all", { params });
export const updateConsultationAPI = (id, data) => API.patch(`/consultations/${id}`, data);
export const cancelConsultationAPI = (id, reason, refundable = false) =>
  API.post(`/consultations/${id}/cancel`, { reason, refundable });
export const deleteConsultationAPI = (id, reason) =>
  API.delete(`/consultations/${id}`, { data: { reason } });

export const joinConsultationAPI = (id, deviceInfo = {}) =>
  API.post(`/consultations/${id}/join`, { deviceInfo });
export const leaveConsultationAPI = (id, metrics = {}) =>
  API.post(`/consultations/${id}/leave`, { metrics });
export const startConsultationAPI = (id) => API.post(`/consultations/${id}/start`);
export const endConsultationAPI = (id) => API.post(`/consultations/${id}/end`);
export const pauseConsultationAPI = (id) => API.post(`/consultations/${id}/pause`);
export const resumeConsultationAPI = (id) => API.post(`/consultations/${id}/resume`);
export const reportTechnicalFailureAPI = (id, errorDetails) =>
  API.post(`/consultations/${id}/technical-failure`, { errorDetails });
export const markNoShowAPI = (id, who = "patient", reason) =>
  API.post(`/consultations/${id}/no-show`, { who, reason });

export const enterWaitingRoomAPI = (id) => API.post(`/consultations/${id}/waiting-room/enter`);
export const leaveWaitingRoomAPI = (id) => API.post(`/consultations/${id}/waiting-room/leave`);
export const getWaitingRoomStatusAPI = (id) => API.post(`/consultations/${id}/waiting-room/status`);

export const getDoctorScheduleAPI = () => API.get("/consultations/doctor/schedule");
export const getDoctorHistoryAPI = (params) => API.get("/consultations/doctor/history", { params });
export const getDoctorStatsAPI = () => API.get("/consultations/doctor/stats");
export const getDoctorActiveAPI = () => API.get("/consultations/doctor/active");
export const getDoctorMyAPI = (params) => API.get("/consultations/doctor/my", { params });
export const getPatientHistoryAPI = (params) => API.get("/consultations/patient/history", { params });
export const getPatientUpcomingAPI = () => API.get("/consultations/patient/upcoming");
export const getPatientActiveAPI = () => API.get("/consultations/patient/active");
export const getMyConsultationsAPI = (params) => API.get("/consultations/my", { params });

export const getAdminAllAPI = (params) => API.get("/consultations/admin/all", { params });
export const getAdminUpcomingAPI = () => API.get("/consultations/admin/upcoming");
export const getAdminActiveAPI = () => API.get("/consultations/admin/active");
export const getAdminStatsAPI = () => API.get("/consultations/admin/stats");
export const assignAdminAPI = (id, adminId) =>
  API.post(`/consultations/admin/${id}/assign`, { adminId });
export const overrideStatusAPI = (id, status, reason) =>
  API.patch(`/consultations/admin/${id}/override-status`, { status, reason });

export const getParticipantsAPI = (id) => API.get(`/consultations/${id}/participants`);
export const addParticipantAPI = (id, userId, role) =>
  API.post(`/consultations/${id}/participants`, { userId, role });
export const removeParticipantAPI = (id, userId) =>
  API.delete(`/consultations/${id}/participants/${userId}`);
export const getParticipantEventsAPI = (id) => API.get(`/consultations/${id}/participants/events`);
export const updateNetworkQualityAPI = (id, userId, quality) =>
  API.patch(`/consultations/${id}/participants/${userId}/network-quality`, { quality });

export const saveMetricsAPI = (id, metrics) => API.put(`/consultations/${id}/metrics`, metrics);
export const getMetricsAPI = (id) => API.get(`/consultations/${id}/metrics`);

export const submitRatingAPI = (id, data) => API.post(`/consultations/${id}/rating`, data);
export const getRatingAPI = (id) => API.get(`/consultations/${id}/rating`);
export const editRatingAPI = (id, data) => API.patch(`/consultations/${id}/rating`, data);

// Follow-up — includes followUpDate field
export const createFollowUpAPI = (id, data) => API.post(`/consultations/${id}/follow-up`, data);
export const getFollowUpHistoryAPI = (id) => API.get(`/consultations/${id}/follow-up/history`);

export const triggerAutoMissAPI = (cronKey) =>
  API.post("/consultations/cron/auto-miss", {}, { headers: { "x-cron-key": cronKey } });
export const triggerTokenRefreshAPI = (cronKey) =>
  API.post("/consultations/cron/token-refresh", {}, { headers: { "x-cron-key": cronKey } });
export const triggerRemindersAPI = (cronKey) =>
  API.post("/consultations/cron/reminders", {}, { headers: { "x-cron-key": cronKey } });
export const triggerExpirePrescriptionsAPI = (cronKey) =>
  API.post("/consultations/cron/expire-prescriptions", {}, { headers: { "x-cron-key": cronKey } });

export const muteParticipantAPI = (id, userId) =>
  API.post(`/consultations/${id}/participants/${userId}/mute`);

export const unmuteParticipantAPI = (id, userId) =>
  API.post(`/consultations/${id}/participants/${userId}/unmute`);

export const kickParticipantAPI = (id, userId, reason) =>
  API.post(`/consultations/${id}/participants/${userId}/kick`, { reason });

export const getConsultationTimerAPI = (id) =>
  API.get(`/consultations/${id}/timer`);

export const triggerAutoEndAPI = (cronKey) =>
  API.post("/consultations/cron/auto-end", {}, { headers: { "x-cron-key": cronKey } });

export const triggerTimerReminderAPI = (cronKey) =>
  API.post("/consultations/cron/timer-reminder", {}, { headers: { "x-cron-key": cronKey } });