// store/slices/consultationSlice.js
// Fat slice — all consultation state. Fixes + new features added.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";

import {
  createConsultationAPI,
  getConsultationByIdAPI,
  getConsultationByBookingAPI,
  updateConsultationAPI,
  cancelConsultationAPI,
  deleteConsultationAPI,
  joinConsultationAPI,
  leaveConsultationAPI,
  startConsultationAPI,
  endConsultationAPI,
  pauseConsultationAPI,
  resumeConsultationAPI,
  reportTechnicalFailureAPI,
  markNoShowAPI,
  enterWaitingRoomAPI,
  leaveWaitingRoomAPI,
  getWaitingRoomStatusAPI,
  getDoctorScheduleAPI,
  getDoctorHistoryAPI,
  getDoctorStatsAPI,
  getDoctorActiveAPI,
  getDoctorMyAPI,
  getPatientHistoryAPI,
  getPatientUpcomingAPI,
  getPatientActiveAPI,
  getMyConsultationsAPI,
  getAdminAllAPI,
  getAdminUpcomingAPI,
  getAdminActiveAPI,
  getAdminStatsAPI,
  assignAdminAPI,
  overrideStatusAPI,
  getParticipantsAPI,
  addParticipantAPI,
  removeParticipantAPI,
  getParticipantEventsAPI,
  updateNetworkQualityAPI,
  saveMetricsAPI,
  getMetricsAPI,
  submitRatingAPI,
  getRatingAPI,
  editRatingAPI,
  createFollowUpAPI,
  getFollowUpHistoryAPI,
  triggerAutoMissAPI,
  triggerTokenRefreshAPI,
  triggerRemindersAPI,
   triggerExpirePrescriptionsAPI,
  muteParticipantAPI,
  unmuteParticipantAPI,
  kickParticipantAPI,
  getConsultationTimerAPI,
  triggerAutoEndAPI,
  triggerTimerReminderAPI,
} from "../../services/consultationService";

import {
  provisionAgoraTokensAPI,
  getAgoraTokensAPI,
  refreshAgoraTokensAPI,
  submitRecordingConsentAPI,
  startRecordingAPI,
  stopRecordingAPI,
  getRecordingUrlsAPI,
} from "../../services/agoraService";

import {
  saveVitalsAPI,
  saveNotesAPI,
  getNotesAPI,
  issuePrescriptionAPI,
  getPrescriptionsAPI,
  saveReferralAPI,
  getReferralAPI,
  sendChatMessageAPI,
  getChatHistoryAPI,
  deleteChatMessageAPI,
  uploadDocumentsAPI,
} from "../../services/prescriptionService";

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  current: null,
  status: null,
  statusMeta: null,
  list: [],
  pagination: null,
  doctorSchedule: [],
  doctorHistory: [],
  doctorStats: null,
  doctorActive: [],
  patientHistory: [],
  patientUpcoming: [],
  patientActive: [],
  myConsultations: [],
  adminAll: [],
  adminUpcoming: [],
  adminActive: [],
  adminStats: null,
  sessionStartedAt: null,
  sessionEndedAt: null,
  actualDurationSec: null,
  agora: {
    appId: null,
    channelName: null,
    rtmChannelName: null,
    doctorTokens: null,
    patientTokens: null,
    myTokens: null,
    expiresAt: null,
    tokenRefreshCount: 0,
    isRecordingEnabled: false,
    isRecordingActive: false,
    recordingConsentDoctor: false,
    recordingConsentPatient: false,
    recordingStartedAt: null,
    recordingStoppedAt: null,
    recordingUrls: [],
    // Local recording (MediaRecorder)
    localRecordingActive: false,
    localRecordingStartedAt: null,
  },
  waitingRoom: {
    patientEnteredAt: null,
    patientLeft: false,
    estimatedWaitMin: 5,
    queuePosition: 1,
    doctorReadyAt: null,
  },
  participants: {
    core: { doctor: null, patient: null },
    additional: [],
    events: [],
    extra: [],
  },
  networkQuality: {},
  vitals: null,
  notes: null,
  prescriptions: [],
  referral: null,
  documents: [],
  prescriptionPreview: null,
  // FIX: pendingChatIds tracks REST-sent messages to prevent socket double-add
  chatMessages: [],
  pendingChatIds: [], // temp IDs optimistically added; cleared when socket confirms
  typingUsers: [],
  rating: null,
  isRated: false,
  metrics: null,
  followUpChain: [],
  followUpChildren: [],
  cronResults: {},
    timer: {
    maxTimeSec: null,
    remainingSec: null,
    elapsedSec: null,
    hardDeadlineAt: null,
    reminderSent: false,
    autoEnded: false,
    segments: [],
  },
  mutedParticipants: [],  // tracks who is muted by doctor
  kickedParticipants: [], // tracks who was kicked this session
  adminMessages: [],
  loading: {
    fetch: false,
    create: false,
    session: false,
    agora: false,
    clinical: false,
    chat: false,
    rating: false,
    participants: false,
    waitingRoom: false,
    admin: false,
    cron: false,
    followUp: false,
  },
  error: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ASYNC THUNKS (unchanged ones kept; new/fixed ones documented)
// ═══════════════════════════════════════════════════════════════════════════════

const mkThunk = (name, fn, loadingDomain, successMsg) =>
  createAsyncThunk(name, async (arg, { rejectWithValue }) => {
    try {
      const res = await fn(arg);
      if (successMsg) toast.success(successMsg);
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  });

export const createConsultation = createAsyncThunk(
  "consultation/create",
  async (data, { rejectWithValue }) => {
    try {
      const res = await createConsultationAPI(data);
      toast.success("Consultation created");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const fetchConsultationById = createAsyncThunk(
  "consultation/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      return (await getConsultationByIdAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchConsultationByBooking = createAsyncThunk(
  "consultation/fetchByBooking",
  async (bookingId, { rejectWithValue }) => {
    try {
      return (await getConsultationByBookingAPI(bookingId)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const updateConsultation = createAsyncThunk(
  "consultation/update",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await updateConsultationAPI(id, data);
      toast.success("Updated");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const cancelConsultation = createAsyncThunk(
  "consultation/cancel",
  async ({ id, reason, refundable }, { rejectWithValue }) => {
    try {
      const res = await cancelConsultationAPI(id, reason, refundable);
      toast.success("Cancelled");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const deleteConsultation = createAsyncThunk(
  "consultation/delete",
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const res = await deleteConsultationAPI(id, reason);
      toast.success("Deleted");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const joinConsultation = createAsyncThunk(
  "consultation/join",
  async ({ id, deviceInfo }, { rejectWithValue }) => {
    try {
      return (await joinConsultationAPI(id, deviceInfo)).data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const leaveConsultation = createAsyncThunk(
  "consultation/leave",
  async ({ id, metrics }, { rejectWithValue }) => {
    try {
      return (await leaveConsultationAPI(id, metrics)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const startConsultation = createAsyncThunk(
  "consultation/start",
  async (id, { rejectWithValue }) => {
    try {
      const res = await startConsultationAPI(id);
      toast.success("Session started");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const endConsultation = createAsyncThunk(
  "consultation/end",
  async (id, { rejectWithValue }) => {
    try {
      const res = await endConsultationAPI(id);
      toast.success("Session ended");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const pauseConsultation = createAsyncThunk(
  "consultation/pause",
  async (id, { rejectWithValue }) => {
    try {
      return (await pauseConsultationAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const resumeConsultation = createAsyncThunk(
  "consultation/resume",
  async (id, { rejectWithValue }) => {
    try {
      return (await resumeConsultationAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const reportTechnicalFailure = createAsyncThunk(
  "consultation/technicalFailure",
  async ({ id, errorDetails }, { rejectWithValue }) => {
    try {
      return (await reportTechnicalFailureAPI(id, errorDetails)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const markNoShow = createAsyncThunk(
  "consultation/noShow",
  async ({ id, who, reason }, { rejectWithValue }) => {
    try {
      const res = await markNoShowAPI(id, who, reason);
      toast.success(`No-show: ${who}`);
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const enterWaitingRoom = createAsyncThunk(
  "consultation/enterWaiting",
  async (id, { rejectWithValue }) => {
    try {
      return (await enterWaitingRoomAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const leaveWaitingRoom = createAsyncThunk(
  "consultation/leaveWaiting",
  async (id, { rejectWithValue }) => {
    try {
      return (await leaveWaitingRoomAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchWaitingRoomStatus = createAsyncThunk(
  "consultation/waitingStatus",
  async (id, { rejectWithValue }) => {
    try {
      return (await getWaitingRoomStatusAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const provisionAgoraTokens = createAsyncThunk(
  "consultation/agora/provision",
  async (consultationId, { rejectWithValue }) => {
    try {
      return (await provisionAgoraTokensAPI(consultationId)).data;
    } catch (err) {
      toast.error("Failed to provision tokens");
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchAgoraTokens = createAsyncThunk(
  "consultation/agora/getTokens",
  async (consultationId, { rejectWithValue }) => {
    try {
      return (await getAgoraTokensAPI(consultationId)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const refreshAgoraTokens = createAsyncThunk(
  "consultation/agora/refresh",
  async (consultationId, { rejectWithValue }) => {
    try {
      return (await refreshAgoraTokensAPI(consultationId)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const submitRecordingConsent = createAsyncThunk(
  "consultation/agora/recordingConsent",
  async ({ consultationId, consented }, { rejectWithValue }) => {
    try {
      return (await submitRecordingConsentAPI(consultationId, consented)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const startRecording = createAsyncThunk(
  "consultation/agora/startRecording",
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await startRecordingAPI(consultationId);
      toast.success("Recording started");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const stopRecording = createAsyncThunk(
  "consultation/agora/stopRecording",
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await stopRecordingAPI(consultationId);
      toast.success("Recording stopped");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const fetchRecordingUrls = createAsyncThunk(
  "consultation/agora/recordingUrls",
  async (consultationId, { rejectWithValue }) => {
    try {
      return (await getRecordingUrlsAPI(consultationId)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchDoctorSchedule = createAsyncThunk(
  "consultation/doctorSchedule",
  async (_, { rejectWithValue }) => {
    try {
      return (await getDoctorScheduleAPI()).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchDoctorHistory = createAsyncThunk(
  "consultation/doctorHistory",
  async (params, { rejectWithValue }) => {
    try {
      return (await getDoctorHistoryAPI(params)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchDoctorStats = createAsyncThunk(
  "consultation/doctorStats",
  async (_, { rejectWithValue }) => {
    try {
      return (await getDoctorStatsAPI()).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchDoctorActive = createAsyncThunk(
  "consultation/doctorActive",
  async (_, { rejectWithValue }) => {
    try {
      return (await getDoctorActiveAPI()).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchDoctorMy = createAsyncThunk(
  "consultation/doctorMy",
  async (params, { rejectWithValue }) => {
    try {
      return (await getDoctorMyAPI(params)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchPatientHistory = createAsyncThunk(
  "consultation/patientHistory",
  async (params, { rejectWithValue }) => {
    try {
      return (await getPatientHistoryAPI(params)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchPatientUpcoming = createAsyncThunk(
  "consultation/patientUpcoming",
  async (_, { rejectWithValue }) => {
    try {
      return (await getPatientUpcomingAPI()).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchPatientActive = createAsyncThunk(
  "consultation/patientActive",
  async (_, { rejectWithValue }) => {
    try {
      return (await getPatientActiveAPI()).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchMyConsultations = createAsyncThunk(
  "consultation/my",
  async (params, { rejectWithValue }) => {
    try {
      return (await getMyConsultationsAPI(params)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchAdminAll = createAsyncThunk(
  "consultation/adminAll",
  async (params, { rejectWithValue }) => {
    try {
      return (await getAdminAllAPI(params)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchAdminUpcoming = createAsyncThunk(
  "consultation/adminUpcoming",
  async (_, { rejectWithValue }) => {
    try {
      return (await getAdminUpcomingAPI()).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchAdminActive = createAsyncThunk(
  "consultation/adminActive",
  async (_, { rejectWithValue }) => {
    try {
      return (await getAdminActiveAPI()).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchAdminStats = createAsyncThunk(
  "consultation/adminStats",
  async (_, { rejectWithValue }) => {
    try {
      return (await getAdminStatsAPI()).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const assignAdmin = createAsyncThunk(
  "consultation/assignAdmin",
  async ({ id, adminId }, { rejectWithValue }) => {
    try {
      const res = await assignAdminAPI(id, adminId);
      toast.success("Admin assigned");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const overrideStatus = createAsyncThunk(
  "consultation/overrideStatus",
  async ({ id, status, reason }, { rejectWithValue }) => {
    try {
      const res = await overrideStatusAPI(id, status, reason);
      toast.success("Status overridden");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const fetchParticipants = createAsyncThunk(
  "consultation/participants/fetch",
  async (id, { rejectWithValue }) => {
    try {
      return (await getParticipantsAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const addParticipant = createAsyncThunk(
  "consultation/participants/add",
  async ({ id, userId, role }, { rejectWithValue }) => {
    try {
      const res = await addParticipantAPI(id, userId, role);
      toast.success("Participant added");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const removeParticipant = createAsyncThunk(
  "consultation/participants/remove",
  async ({ id, userId }, { rejectWithValue }) => {
    try {
      await removeParticipantAPI(id, userId);
      toast.success("Participant removed");
      return { userId };
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const fetchParticipantEvents = createAsyncThunk(
  "consultation/participants/events",
  async (id, { rejectWithValue }) => {
    try {
      return (await getParticipantEventsAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const updateNetworkQuality = createAsyncThunk(
  "consultation/participants/networkQuality",
  async ({ id, userId, quality }, { rejectWithValue }) => {
    try {
      await updateNetworkQualityAPI(id, userId, quality);
      return { userId, quality };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const saveVitals = createAsyncThunk(
  "consultation/clinical/vitals",
  async ({ consultationId, vitals }, { rejectWithValue }) => {
    try {
      const res = await saveVitalsAPI(consultationId, vitals);
      toast.success("Vitals saved");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const saveNotes = createAsyncThunk(
  "consultation/clinical/notes",
  async ({ consultationId, notes }, { rejectWithValue }) => {
    try {
      const res = await saveNotesAPI(consultationId, notes);
      toast.success("Notes saved");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const fetchNotes = createAsyncThunk(
  "consultation/clinical/fetchNotes",
  async (consultationId, { rejectWithValue }) => {
    try {
      return (await getNotesAPI(consultationId)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const issuePrescription = createAsyncThunk(
  "consultation/clinical/issuePrescription",
  async ({ consultationId, data }, { rejectWithValue }) => {
    try {
      const res = await issuePrescriptionAPI(consultationId, data);
      toast.success("Prescription issued");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const fetchPrescriptions = createAsyncThunk(
  "consultation/clinical/prescriptions",
  async (consultationId, { rejectWithValue }) => {
    try {
      return (await getPrescriptionsAPI(consultationId)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const saveReferral = createAsyncThunk(
  "consultation/clinical/referral",
  async ({ consultationId, data }, { rejectWithValue }) => {
    try {
      const res = await saveReferralAPI(consultationId, data);
      toast.success("Referral saved");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const fetchReferral = createAsyncThunk(
  "consultation/clinical/fetchReferral",
  async (consultationId, { rejectWithValue }) => {
    try {
      return (await getReferralAPI(consultationId)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

/**
 * sendChatMessage — REST for persistence ONLY.
 * FIX: do NOT push returned message into chatMessages here.
 * Socket event "consultation:chat:message" handles display (dedupes by _id).
 * This prevents double-display.
 */
export const sendChatMessage = createAsyncThunk(
  "consultation/chat/send",
  async ({ consultationId, message }, { rejectWithValue }) => {
    try {
      return (
        await sendChatMessageAPI(consultationId, message, message._isMultipart)
      ).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchChatHistory = createAsyncThunk(
  "consultation/chat/history",
  async (consultationId, { rejectWithValue }) => {
    try {
      return (await getChatHistoryAPI(consultationId)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const deleteChatMessage = createAsyncThunk(
  "consultation/chat/delete",
  async ({ consultationId, messageId }, { rejectWithValue }) => {
    try {
      await deleteChatMessageAPI(consultationId, messageId);
      return { messageId };
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const uploadDocuments = createAsyncThunk(
  "consultation/clinical/documents",
  async ({ consultationId, formData }, { rejectWithValue }) => {
    try {
      const res = await uploadDocumentsAPI(consultationId, formData);
      toast.success("Documents uploaded");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const submitRating = createAsyncThunk(
  "consultation/rating/submit",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await submitRatingAPI(id, data);
      toast.success("Rating submitted");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const fetchRating = createAsyncThunk(
  "consultation/rating/fetch",
  async (id, { rejectWithValue }) => {
    try {
      return (await getRatingAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const editRating = createAsyncThunk(
  "consultation/rating/edit",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await editRatingAPI(id, data);
      toast.success("Rating updated");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const saveMetrics = createAsyncThunk(
  "consultation/metrics/save",
  async ({ id, metrics }, { rejectWithValue }) => {
    try {
      return (await saveMetricsAPI(id, metrics)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const fetchMetrics = createAsyncThunk(
  "consultation/metrics/fetch",
  async (id, { rejectWithValue }) => {
    try {
      return (await getMetricsAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const createFollowUp = createAsyncThunk(
  "consultation/followUp/create",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await createFollowUpAPI(id, data);
      toast.success("Follow-up created");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const fetchFollowUpHistory = createAsyncThunk(
  "consultation/followUp/history",
  async (id, { rejectWithValue }) => {
    try {
      return (await getFollowUpHistoryAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const triggerAutoMiss = createAsyncThunk(
  "consultation/cron/autoMiss",
  async (cronKey, { rejectWithValue }) => {
    try {
      const res = await triggerAutoMissAPI(cronKey);
      toast.success(`Auto-miss: ${res.data.processed}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const triggerTokenRefreshCron = createAsyncThunk(
  "consultation/cron/tokenRefresh",
  async (cronKey, { rejectWithValue }) => {
    try {
      const res = await triggerTokenRefreshAPI(cronKey);
      toast.success(`Token refresh: ${res.data.refreshed}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const triggerReminders = createAsyncThunk(
  "consultation/cron/reminders",
  async (cronKey, { rejectWithValue }) => {
    try {
      const res = await triggerRemindersAPI(cronKey);
      toast.success(`Reminders: ${res.data.sent}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const muteParticipant = createAsyncThunk(
  "consultation/participants/mute",
  async ({ id, userId }, { rejectWithValue }) => {
    try {
      const res = await muteParticipantAPI(id, userId);
      toast.success("Participant muted");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const unmuteParticipant = createAsyncThunk(
  "consultation/participants/unmute",
  async ({ id, userId }, { rejectWithValue }) => {
    try {
      const res = await unmuteParticipantAPI(id, userId);
      toast.success("Participant unmuted");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const kickParticipant = createAsyncThunk(
  "consultation/participants/kick",
  async ({ id, userId, reason }, { rejectWithValue }) => {
    try {
      const res = await kickParticipantAPI(id, userId, reason);
      toast.success("Participant removed");
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

export const fetchConsultationTimer = createAsyncThunk(
  "consultation/timer/fetch",
  async (id, { rejectWithValue }) => {
    try {
      return (await getConsultationTimerAPI(id)).data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const triggerAutoEnd = createAsyncThunk(
  "consultation/cron/autoEnd",
  async (cronKey, { rejectWithValue }) => {
    try {
      const res = await triggerAutoEndAPI(cronKey);
      toast.success(`Auto-end: ${res.data.autoEnded}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

export const triggerTimerReminder = createAsyncThunk(
  "consultation/cron/timerReminder",
  async (cronKey, { rejectWithValue }) => {
    try {
      const res = await triggerTimerReminderAPI(cronKey);
      toast.success(`Reminders sent: ${res.data.reminded}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);


export const triggerExpirePrescriptions = createAsyncThunk(
  "consultation/cron/expirePrescriptions",
  async (cronKey, { rejectWithValue }) => {
    try {
      const res = await triggerExpirePrescriptionsAPI(cronKey);
      toast.success(`Expired: ${res.data.expired}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const consultationSlice = createSlice({
  name: "consultation",
  initialState,

  reducers: {
    resetConsultation: () => initialState,

    clearCurrent: (state) => {
      state.current = null;
      state.status = null;
      state.statusMeta = null;
      state.agora = initialState.agora;
      state.waitingRoom = initialState.waitingRoom;
      state.participants = initialState.participants;
      state.chatMessages = [];
      state.pendingChatIds = [];
      state.typingUsers = [];
      state.vitals = null;
      state.notes = null;
      state.prescriptions = [];
      state.referral = null;
      state.metrics = null;
      state.rating = null;
      state.isRated = false;
      state.networkQuality = {};
      state.prescriptionPreview = null;
      state.adminMessages = [];
      state.sessionStartedAt = null;
      state.sessionEndedAt = null;
      state.actualDurationSec = null;
      state.documents = [];
      state.timer = initialState.timer;
      state.mutedParticipants = [];
      state.kickedParticipants = [];
    },

    clearError: (state) => {
      state.error = null;
    },

    // ── Socket actions ────────────────────────────────────────────────────────

    socketStatusUpdate: (state, { payload }) => {
      state.status = payload.status;
      state.statusMeta = payload.statusMeta ?? state.statusMeta;
      if (state.current) state.current.status = payload.status;
    },

    socketParticipantJoined: (state, { payload }) => {
      const exists = state.participants.events.find(
        (e) => e.userId === payload.userId && !e.leftAt,
      );
      if (!exists) {
        state.participants.events.push({
          userId: payload.userId,
          role: payload.role,
          // FIX: use name from payload if present
          name: payload.name || payload.userName || null,
          joinedAt: new Date().toISOString(),
        });
      }
      if (payload.status) state.status = payload.status;
    },

    socketParticipantLeft: (state, { payload }) => {
      const evt = state.participants.events
        .filter((e) => e.userId === payload.userId && !e.leftAt)
        .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))[0];
      if (evt) evt.leftAt = payload.leftAt || new Date().toISOString();
      if (payload.status) {
        state.status = payload.status;
        state.statusMeta = payload.statusMeta ?? state.statusMeta;
      }
    },

    socketParticipantDisconnected: (state, { payload }) => {
      const evt = state.participants.events
        .filter((e) => e.userId === payload.userId && !e.leftAt)
        .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))[0];
      if (evt) {
        evt.leftAt = payload.at || new Date().toISOString();
        evt.disconnectReason = payload.reason;
      }
    },

    socketPatientWaiting: (state, { payload }) => {
      state.waitingRoom.patientEnteredAt = payload.enteredAt;
      state.waitingRoom.patientLeft = false;
      if (payload.status) state.status = payload.status;
    },

    socketPatientLeftWaiting: (state, { payload }) => {
      state.waitingRoom.patientLeft = true;
      state.waitingRoom.patientLeftAt = payload.leftAt;
    },

    /**
     * FIX double-send: socket event is single source of truth for display.
     * REST thunk fulfilled does NOT push to chatMessages.
     */
    socketChatMessage: (state, { payload }) => {
      const dup = state.chatMessages.find((m) => m._id === payload._id);
      if (!dup) state.chatMessages.push(payload);
    },

    socketChatTyping: (state, { payload }) => {
      if (payload.isTyping) {
        const exists = state.typingUsers.find(
          (u) => u.userId === payload.userId,
        );
        if (!exists) state.typingUsers.push(payload);
      } else {
        state.typingUsers = state.typingUsers.filter(
          (u) => u.userId !== payload.userId,
        );
      }
    },

    socketVitalsUpdate: (state, { payload }) => {
      state.vitals = payload.vitals;
    },
    socketQosUpdate: (state, { payload }) => {
      state.networkQuality[payload.userId] = payload.quality;
    },
    socketPrescriptionPreview: (state, { payload }) => {
      state.prescriptionPreview = payload.preview;
    },

    socketPrescriptionReady: (state, { payload }) => {
      const exists = state.prescriptions.find(
        (p) => p.rxNumber === payload.rxNumber,
      );
      if (!exists)
        state.prescriptions.push({
          rxNumber: payload.rxNumber,
          _id: payload.rxId,
          status: "issued",
        });
      toast.success(`Prescription ${payload.rxNumber} ready`);
    },

    socketAdminMessage: (state, { payload }) => {
      state.adminMessages.push(payload);
      toast(payload.message, {
        icon: payload.type === "warning" ? "⚠️" : "ℹ️",
      });
    },

    socketTokenRefreshed: (state, { payload }) => {
      if (payload.tokens) state.agora.myTokens = payload.tokens;
      if (payload.expiresAt) state.agora.expiresAt = payload.expiresAt;
      if (payload.tokenRefreshCount !== undefined)
        state.agora.tokenRefreshCount = payload.tokenRefreshCount;
    },

    // ── Recording socket events ───────────────────────────────────────────────
    socketRecordingStarted: (state, { payload }) => {
      state.agora.isRecordingActive = true;
      state.agora.isRecordingEnabled = true;
      state.agora.recordingStartedAt =
        payload.startedAt ?? new Date().toISOString();
    },

    socketRecordingStopped: (state, { payload }) => {
      state.agora.isRecordingActive = false;
      state.agora.recordingStoppedAt =
        payload.stoppedAt ?? new Date().toISOString();
      if (payload.urls) state.agora.recordingUrls = payload.urls;
    },

    // ── Participant management socket events ──────────────────────────────────
    socketParticipantAdded: (state, { payload }) => {
      // payload: { userId, role, name, addedAt }
      const exists = state.participants.additional.find(
        (p) => p.userId === payload.userId,
      );
      if (!exists) state.participants.additional.push(payload);
    },

    socketParticipantRemoved: (state, { payload }) => {
      state.participants.additional = state.participants.additional.filter(
        (p) => p.userId !== payload.userId,
      );
    },

    socketMuted: (state, { payload }) => {
      if (payload.isMuted) {
        if (!state.mutedParticipants.includes(payload.targetUserId)) {
          state.mutedParticipants.push(payload.targetUserId);
        }
      } else {
        state.mutedParticipants = state.mutedParticipants.filter(
          (id) => id !== payload.targetUserId,
        );
      }
      // Update participantEvent flag if present
      const evt = state.participants.events.find(
        (e) => e.userId === payload.targetUserId && !e.leftAt,
      );
      if (evt) evt.isMutedByDoctor = payload.isMuted;
    },

    socketKicked: (state, { payload }) => {
      if (!state.kickedParticipants.includes(payload.targetUserId)) {
        state.kickedParticipants.push(payload.targetUserId);
      }
      // Mark event as kicked
      const evt = state.participants.events.find(
        (e) => e.userId === payload.targetUserId && !e.leftAt,
      );
      if (evt) {
        evt.isKicked = true;
        evt.leftAt = payload.at || new Date().toISOString();
      }
    },

    socketTimerUpdate: (state, { payload }) => {
      state.timer = {
        maxTimeSec:     payload.maxTimeSec    ?? state.timer.maxTimeSec,
        remainingSec:   payload.remainingSec  ?? state.timer.remainingSec,
        elapsedSec:     payload.elapsedSec    ?? state.timer.elapsedSec,
        hardDeadlineAt: payload.hardDeadlineAt?? state.timer.hardDeadlineAt,
        reminderSent:   payload.reminderSent  ?? state.timer.reminderSent,
        autoEnded:      payload.autoEnded     ?? state.timer.autoEnded,
        segments:       payload.segments      ?? state.timer.segments,
      };
      if (payload.autoEnded) {
        state.status = "completed";
        if (state.current) state.current.status = "completed";
      }
    },

    clearMutedKicked: (state) => {
      state.mutedParticipants = [];
      state.kickedParticipants = [];
    },

    // ── Local recording (MediaRecorder) ───────────────────────────────────────
    setLocalRecordingActive: (state, { payload }) => {
      state.agora.localRecordingActive = payload;
      if (payload)
        state.agora.localRecordingStartedAt = new Date().toISOString();
    },

    // ── Manual setters ────────────────────────────────────────────────────────
    setAgoraMyTokens: (state, { payload }) => {
      state.agora.myTokens = payload;
    },
    clearTypingUsers: (state) => {
      state.typingUsers = [];
    },
    clearPrescriptionPreview: (state) => {
      state.prescriptionPreview = null;
    },
    clearAdminMessages: (state) => {
      state.adminMessages = [];
    },
  },

  extraReducers: (builder) => {
    const setLoading = (domain) => (state) => {
      state.loading[domain] = true;
      state.error = null;
    };
    const clearLoading = (domain) => (state) => {
      state.loading[domain] = false;
    };
    const setError =
      (domain) =>
      (state, { payload }) => {
        state.loading[domain] = false;
        state.error = payload;
      };

    builder
      // CREATE
      .addCase(createConsultation.pending, setLoading("create"))
      .addCase(createConsultation.fulfilled, (state, { payload }) => {
        state.loading.create = false;
        state.current = payload.consultation ?? null;
        state.status = payload.consultation?.status ?? null;
        if (payload.agoraTokens)
          state.agora = { ...state.agora, ...payload.agoraTokens };
      })
      .addCase(createConsultation.rejected, setError("create"))

      // FETCH BY ID
      .addCase(fetchConsultationById.pending, setLoading("fetch"))
      .addCase(fetchConsultationById.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.current = payload.consultation ?? null;
        state.status = payload.consultation?.status ?? null;
      })
      .addCase(fetchConsultationById.rejected, setError("fetch"))

      // FETCH BY BOOKING
      .addCase(fetchConsultationByBooking.pending, setLoading("fetch"))
      .addCase(fetchConsultationByBooking.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.current = payload.consultation ?? null;
        state.status = payload.consultation?.status ?? null;
      })
      .addCase(fetchConsultationByBooking.rejected, setError("fetch"))

      // UPDATE
      .addCase(updateConsultation.pending, setLoading("fetch"))
      .addCase(updateConsultation.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.current = payload.consultation ?? state.current;
        if (payload.consultation?.status)
          state.status = payload.consultation.status;
      })
      .addCase(updateConsultation.rejected, setError("fetch"))

      // CANCEL
      .addCase(cancelConsultation.pending, setLoading("session"))
      .addCase(cancelConsultation.fulfilled, (state, { payload }) => {
        state.loading.session = false;
        state.status = payload.status ?? "cancelled";
        if (state.current) state.current.status = state.status;
      })
      .addCase(cancelConsultation.rejected, setError("session"))

      // DELETE
      .addCase(deleteConsultation.pending, setLoading("session"))
      .addCase(deleteConsultation.fulfilled, (state) => {
        state.loading.session = false;
        state.current = null;
        state.status = null;
      })
      .addCase(deleteConsultation.rejected, setError("session"))

      // JOIN
      .addCase(joinConsultation.pending, setLoading("session"))
      .addCase(joinConsultation.fulfilled, (state, { payload }) => {
        state.loading.session = false;
        if (payload.status) state.status = payload.status;
        if (payload.tokens) state.agora.myTokens = payload.tokens;
        if (state.current && payload.status)
          state.current.status = payload.status;
      })
      .addCase(joinConsultation.rejected, setError("session"))

      // LEAVE
      .addCase(leaveConsultation.pending, setLoading("session"))
      .addCase(leaveConsultation.fulfilled, (state, { payload }) => {
        state.loading.session = false;
        if (payload.status) {
          state.status = payload.status;
          if (state.current) state.current.status = payload.status;
        }
      })
      .addCase(leaveConsultation.rejected, setError("session"))

      // START
      .addCase(startConsultation.pending, setLoading("session"))
      .addCase(startConsultation.fulfilled, (state, { payload }) => {
        state.loading.session = false;
        state.status = payload.status ?? "in_progress";
        state.sessionStartedAt = new Date().toISOString();
        if (state.current) state.current.status = state.status;
      })
      .addCase(startConsultation.rejected, setError("session"))

      // END
      .addCase(endConsultation.pending, setLoading("session"))
      .addCase(endConsultation.fulfilled, (state, { payload }) => {
        state.loading.session = false;
        state.status = payload.status ?? "completed";
        state.sessionEndedAt = new Date().toISOString();
        state.actualDurationSec = payload.actualDurationSec ?? null;
        if (state.current) state.current.status = state.status;
      })
      .addCase(endConsultation.rejected, setError("session"))

      // PAUSE
      .addCase(pauseConsultation.pending, setLoading("session"))
      .addCase(pauseConsultation.fulfilled, (state, { payload }) => {
        state.loading.session = false;
        state.status = payload.status ?? "paused";
        if (state.current) state.current.status = state.status;
      })
      .addCase(pauseConsultation.rejected, setError("session"))

      // RESUME
      .addCase(resumeConsultation.pending, setLoading("session"))
      .addCase(resumeConsultation.fulfilled, (state, { payload }) => {
        state.loading.session = false;
        state.status = payload.status ?? "in_progress";
        if (state.current) state.current.status = state.status;
      })
      .addCase(resumeConsultation.rejected, setError("session"))

      // TECHNICAL FAILURE
      .addCase(reportTechnicalFailure.pending, setLoading("session"))
      .addCase(reportTechnicalFailure.fulfilled, (state, { payload }) => {
        state.loading.session = false;
        state.status = payload.status ?? "technical_failure";
        if (state.current) state.current.status = state.status;
      })
      .addCase(reportTechnicalFailure.rejected, setError("session"))

      // NO SHOW
      .addCase(markNoShow.pending, setLoading("session"))
      .addCase(markNoShow.fulfilled, (state, { payload }) => {
        state.loading.session = false;
        if (payload.status) {
          state.status = payload.status;
          if (state.current) state.current.status = payload.status;
        }
      })
      .addCase(markNoShow.rejected, setError("session"))

      // WAITING ROOM
      .addCase(enterWaitingRoom.pending, setLoading("waitingRoom"))
      .addCase(enterWaitingRoom.fulfilled, (state, { payload }) => {
        state.loading.waitingRoom = false;
        if (payload.status) state.status = payload.status;
        if (payload.waitingRoom)
          state.waitingRoom = { ...state.waitingRoom, ...payload.waitingRoom };
      })
      .addCase(enterWaitingRoom.rejected, setError("waitingRoom"))
      .addCase(leaveWaitingRoom.pending, setLoading("waitingRoom"))
      .addCase(leaveWaitingRoom.fulfilled, (state, { payload }) => {
        state.loading.waitingRoom = false;
        if (payload.waitingRoom)
          state.waitingRoom = { ...state.waitingRoom, ...payload.waitingRoom };
      })
      .addCase(leaveWaitingRoom.rejected, setError("waitingRoom"))
      .addCase(fetchWaitingRoomStatus.pending, setLoading("waitingRoom"))
      .addCase(fetchWaitingRoomStatus.fulfilled, (state, { payload }) => {
        state.loading.waitingRoom = false;
        if (payload.status) state.status = payload.status;
        if (payload.waitingRoom)
          state.waitingRoom = { ...state.waitingRoom, ...payload.waitingRoom };
      })
      .addCase(fetchWaitingRoomStatus.rejected, setError("waitingRoom"))

      // AGORA
      .addCase(provisionAgoraTokens.pending, setLoading("agora"))
      .addCase(provisionAgoraTokens.fulfilled, (state, { payload }) => {
        state.loading.agora = false;
        state.agora.appId = payload.appId ?? state.agora.appId;
        state.agora.channelName =
          payload.channelName ?? state.agora.channelName;
        state.agora.rtmChannelName =
          payload.rtmChannelName ?? state.agora.rtmChannelName;
        state.agora.expiresAt = payload.expiresAt ?? state.agora.expiresAt;
        state.agora.doctorTokens =
          payload.doctorTokens ?? state.agora.doctorTokens;
        state.agora.patientTokens =
          payload.patientTokens ?? state.agora.patientTokens;
      })
      .addCase(provisionAgoraTokens.rejected, setError("agora"))
      .addCase(fetchAgoraTokens.pending, setLoading("agora"))
      .addCase(fetchAgoraTokens.fulfilled, (state, { payload }) => {
        state.loading.agora = false;
        state.agora.myTokens = payload.tokens ?? null;
        if (payload.tokens?.expiresAt)
          state.agora.expiresAt = payload.tokens.expiresAt;
      })
      .addCase(fetchAgoraTokens.rejected, setError("agora"))
      .addCase(refreshAgoraTokens.pending, setLoading("agora"))
      .addCase(refreshAgoraTokens.fulfilled, (state, { payload }) => {
        state.loading.agora = false;
        state.agora.expiresAt = payload.expiresAt ?? state.agora.expiresAt;
        state.agora.tokenRefreshCount =
          payload.tokenRefreshCount ?? state.agora.tokenRefreshCount;
        if (payload.tokens) state.agora.myTokens = payload.tokens;
      })
      .addCase(refreshAgoraTokens.rejected, setError("agora"))
      .addCase(submitRecordingConsent.pending, setLoading("agora"))
      .addCase(submitRecordingConsent.fulfilled, (state, { payload }) => {
        state.loading.agora = false;
        if (payload.bothConsented) state.agora.isRecordingEnabled = true;
        if (payload.recordingConsentDoctor !== undefined)
          state.agora.recordingConsentDoctor = payload.recordingConsentDoctor;
        if (payload.recordingConsentPatient !== undefined)
          state.agora.recordingConsentPatient = payload.recordingConsentPatient;
      })
      .addCase(submitRecordingConsent.rejected, setError("agora"))
      .addCase(startRecording.pending, setLoading("agora"))
      .addCase(startRecording.fulfilled, (state, { payload }) => {
        state.loading.agora = false;
        state.agora.isRecordingEnabled = true;
        state.agora.isRecordingActive = true;
        state.agora.recordingStartedAt =
          payload.startedAt ?? new Date().toISOString();
      })
      .addCase(startRecording.rejected, setError("agora"))
      .addCase(stopRecording.pending, setLoading("agora"))
      .addCase(stopRecording.fulfilled, (state, { payload }) => {
        state.loading.agora = false;
        state.agora.isRecordingActive = false;
        state.agora.recordingStoppedAt =
          payload.stoppedAt ?? new Date().toISOString();
      })
      .addCase(stopRecording.rejected, setError("agora"))
      .addCase(fetchRecordingUrls.pending, setLoading("agora"))
      .addCase(fetchRecordingUrls.fulfilled, (state, { payload }) => {
        state.loading.agora = false;
        state.agora.recordingUrls = payload.urls ?? [];
        state.agora.recordingStartedAt =
          payload.recordingStartedAt ?? state.agora.recordingStartedAt;
        state.agora.recordingStoppedAt =
          payload.recordingStoppedAt ?? state.agora.recordingStoppedAt;
        state.agora.isRecordingEnabled =
          payload.isRecordingEnabled ?? state.agora.isRecordingEnabled;
      })
      .addCase(fetchRecordingUrls.rejected, setError("agora"))

      // DASHBOARD — DOCTOR
      .addCase(fetchDoctorSchedule.pending, setLoading("fetch"))
      .addCase(fetchDoctorSchedule.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.doctorSchedule = payload.schedule ?? [];
      })
      .addCase(fetchDoctorSchedule.rejected, setError("fetch"))
      .addCase(fetchDoctorHistory.pending, setLoading("fetch"))
      .addCase(fetchDoctorHistory.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.doctorHistory = payload.consultations ?? [];
        state.pagination = payload.pagination ?? null;
      })
      .addCase(fetchDoctorHistory.rejected, setError("fetch"))
      .addCase(fetchDoctorStats.pending, setLoading("fetch"))
      .addCase(fetchDoctorStats.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.doctorStats = payload.stats ?? null;
      })
      .addCase(fetchDoctorStats.rejected, setError("fetch"))
      .addCase(fetchDoctorActive.pending, setLoading("fetch"))
      .addCase(fetchDoctorActive.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.doctorActive = payload.sessions ?? [];
      })
      .addCase(fetchDoctorActive.rejected, setError("fetch"))
      .addCase(fetchDoctorMy.pending, setLoading("fetch"))
      .addCase(fetchDoctorMy.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.list = payload.consultations ?? [];
        state.pagination = payload.pagination ?? null;
      })
      .addCase(fetchDoctorMy.rejected, setError("fetch"))

      // DASHBOARD — PATIENT
      .addCase(fetchPatientHistory.pending, setLoading("fetch"))
      .addCase(fetchPatientHistory.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.patientHistory = payload.consultations ?? [];
        state.pagination = payload.pagination ?? null;
      })
      .addCase(fetchPatientHistory.rejected, setError("fetch"))
      .addCase(fetchPatientUpcoming.pending, setLoading("fetch"))
      .addCase(fetchPatientUpcoming.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.patientUpcoming = payload.consultations ?? [];
      })
      .addCase(fetchPatientUpcoming.rejected, setError("fetch"))
      .addCase(fetchPatientActive.pending, setLoading("fetch"))
      .addCase(fetchPatientActive.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.patientActive = payload.sessions ?? [];
      })
      .addCase(fetchPatientActive.rejected, setError("fetch"))
      .addCase(fetchMyConsultations.pending, setLoading("fetch"))
      .addCase(fetchMyConsultations.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.myConsultations = payload.consultations ?? [];
        state.pagination = payload.pagination ?? null;
      })
      .addCase(fetchMyConsultations.rejected, setError("fetch"))

      // DASHBOARD — ADMIN
      .addCase(fetchAdminAll.pending, setLoading("admin"))
      .addCase(fetchAdminAll.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        state.adminAll = payload.consultations ?? [];
        state.pagination = payload.pagination ?? null;
      })
      .addCase(fetchAdminAll.rejected, setError("admin"))
      .addCase(fetchAdminUpcoming.pending, setLoading("admin"))
      .addCase(fetchAdminUpcoming.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        state.adminUpcoming = payload.consultations ?? [];
      })
      .addCase(fetchAdminUpcoming.rejected, setError("admin"))
      .addCase(fetchAdminActive.pending, setLoading("admin"))
      .addCase(fetchAdminActive.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        state.adminActive = payload.sessions ?? [];
      })
      .addCase(fetchAdminActive.rejected, setError("admin"))
      .addCase(fetchAdminStats.pending, setLoading("admin"))
      .addCase(fetchAdminStats.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        state.adminStats = payload.stats ?? null;
      })
      .addCase(fetchAdminStats.rejected, setError("admin"))
      .addCase(assignAdmin.pending, setLoading("admin"))
      .addCase(assignAdmin.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        if (state.current?._id === payload.consultation?._id)
          state.current = payload.consultation;
      })
      .addCase(assignAdmin.rejected, setError("admin"))
      .addCase(overrideStatus.pending, setLoading("admin"))
      .addCase(overrideStatus.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        if (payload.consultation?.status) {
          state.status = payload.consultation.status;
          if (state.current) state.current.status = state.status;
        }
      })
      .addCase(overrideStatus.rejected, setError("admin"))

      // PARTICIPANTS
      .addCase(fetchParticipants.pending, setLoading("participants"))
      .addCase(fetchParticipants.fulfilled, (state, { payload }) => {
        state.loading.participants = false;
        state.participants = {
          core: payload.core ?? state.participants.core,
          additional: payload.additional ?? [],
          events: payload.events ?? [],
          extra: payload.extraParticipants ?? [],
        };
      })
      .addCase(fetchParticipants.rejected, setError("participants"))
      .addCase(addParticipant.pending, setLoading("participants"))
      .addCase(addParticipant.fulfilled, (state, { payload }) => {
        state.loading.participants = false;
        // If payload has the new participant info, add to additional list
        if (payload.participant) {
          const exists = state.participants.additional.find(
            (p) => p.userId === payload.participant.userId,
          );
          if (!exists) state.participants.additional.push(payload.participant);
        }
      })
      .addCase(addParticipant.rejected, setError("participants"))
      .addCase(removeParticipant.pending, setLoading("participants"))
      .addCase(removeParticipant.fulfilled, (state, { payload }) => {
        state.loading.participants = false;
        state.participants.additional = state.participants.additional.filter(
          (p) => p.userId !== payload.userId,
        );
      })
      .addCase(removeParticipant.rejected, setError("participants"))
      .addCase(fetchParticipantEvents.fulfilled, (state, { payload }) => {
        state.participants.events = payload.events ?? [];
      })
      .addCase(updateNetworkQuality.fulfilled, (state, { payload }) => {
        state.networkQuality[payload.userId] = payload.quality;
      })

      // CLINICAL — VITALS
      .addCase(saveVitals.pending, setLoading("clinical"))
      .addCase(saveVitals.fulfilled, (state, { payload }) => {
        state.loading.clinical = false;
        state.vitals = payload.vitals ?? null;
      })
      .addCase(saveVitals.rejected, setError("clinical"))

      // CLINICAL — NOTES
      .addCase(saveNotes.pending, setLoading("clinical"))
      .addCase(saveNotes.fulfilled, (state, { payload }) => {
        state.loading.clinical = false;
        state.notes = payload.notes ?? null;
      })
      .addCase(saveNotes.rejected, setError("clinical"))
      .addCase(fetchNotes.pending, setLoading("clinical"))
      .addCase(fetchNotes.fulfilled, (state, { payload }) => {
        state.loading.clinical = false;
        state.notes = payload.notes ?? null;
      })
      .addCase(fetchNotes.rejected, setError("clinical"))

      // CLINICAL — PRESCRIPTIONS
      .addCase(issuePrescription.pending, setLoading("clinical"))
      .addCase(issuePrescription.fulfilled, (state, { payload }) => {
        state.loading.clinical = false;
        if (payload.prescription)
          state.prescriptions.push(payload.prescription);
      })
      .addCase(issuePrescription.rejected, setError("clinical"))
      .addCase(fetchPrescriptions.pending, setLoading("clinical"))
      .addCase(fetchPrescriptions.fulfilled, (state, { payload }) => {
        state.loading.clinical = false;
        state.prescriptions = payload.prescriptions ?? [];
      })
      .addCase(fetchPrescriptions.rejected, setError("clinical"))

      // CLINICAL — REFERRAL
      .addCase(saveReferral.pending, setLoading("clinical"))
      .addCase(saveReferral.fulfilled, (state, { payload }) => {
        state.loading.clinical = false;
        state.referral = payload.referral ?? null;
      })
      .addCase(saveReferral.rejected, setError("clinical"))
      .addCase(fetchReferral.pending, setLoading("clinical"))
      .addCase(fetchReferral.fulfilled, (state, { payload }) => {
        state.loading.clinical = false;
        state.referral = payload.referral ?? null;
      })
      .addCase(fetchReferral.rejected, setError("clinical"))

      // CHAT
      // FIX: sendChatMessage.fulfilled does NOT push to chatMessages
      // Socket event handles display. REST just ensures persistence.
      .addCase(sendChatMessage.pending, setLoading("chat"))
      .addCase(sendChatMessage.fulfilled, (state) => {
        state.loading.chat = false;
      })
      .addCase(sendChatMessage.rejected, setError("chat"))
      .addCase(fetchChatHistory.pending, setLoading("chat"))
      .addCase(fetchChatHistory.fulfilled, (state, { payload }) => {
        state.loading.chat = false;
        state.chatMessages = payload.messages ?? [];
      })
      .addCase(fetchChatHistory.rejected, setError("chat"))
      .addCase(deleteChatMessage.fulfilled, (state, { payload }) => {
        const msg = state.chatMessages.find((m) => m._id === payload.messageId);
        if (msg) msg.isDeleted = true;
      })
      .addCase(uploadDocuments.pending, setLoading("clinical"))
      .addCase(uploadDocuments.fulfilled, (state, { payload }) => {
        state.loading.clinical = false;
        if (payload.documents) state.documents.push(...payload.documents);
      })
      .addCase(uploadDocuments.rejected, setError("clinical"))

      // RATING
      .addCase(submitRating.pending, setLoading("rating"))
      .addCase(submitRating.fulfilled, (state, { payload }) => {
        state.loading.rating = false;
        state.rating = payload.rating ?? null;
        state.isRated = true;
      })
      .addCase(submitRating.rejected, setError("rating"))
      .addCase(fetchRating.pending, setLoading("rating"))
      .addCase(fetchRating.fulfilled, (state, { payload }) => {
        state.loading.rating = false;
        state.rating = payload.rating ?? null;
        state.isRated = payload.isRated ?? false;
      })
      .addCase(fetchRating.rejected, setError("rating"))
      .addCase(editRating.pending, setLoading("rating"))
      .addCase(editRating.fulfilled, (state, { payload }) => {
        state.loading.rating = false;
        state.rating = payload.rating ?? state.rating;
      })
      .addCase(editRating.rejected, setError("rating"))

      // METRICS
      .addCase(saveMetrics.pending, setLoading("fetch"))
      .addCase(saveMetrics.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.metrics = payload.metrics ?? null;
      })
      .addCase(saveMetrics.rejected, setError("fetch"))
      .addCase(fetchMetrics.pending, setLoading("fetch"))
      .addCase(fetchMetrics.fulfilled, (state, { payload }) => {
        state.loading.fetch = false;
        state.metrics = payload.metrics ?? null;
      })
      .addCase(fetchMetrics.rejected, setError("fetch"))

      // FOLLOW-UP
      .addCase(createFollowUp.pending, setLoading("followUp"))
      .addCase(createFollowUp.fulfilled, (state) => {
        state.loading.followUp = false;
      })
      .addCase(createFollowUp.rejected, setError("followUp"))
      .addCase(fetchFollowUpHistory.pending, setLoading("followUp"))
      .addCase(fetchFollowUpHistory.fulfilled, (state, { payload }) => {
        state.loading.followUp = false;
        state.followUpChain = payload.chain ?? [];
        state.followUpChildren = payload.children ?? [];
      })
      .addCase(fetchFollowUpHistory.rejected, setError("followUp"))

      // CRON
      .addCase(triggerAutoMiss.pending, setLoading("cron"))
      .addCase(triggerAutoMiss.fulfilled, (state, { payload }) => {
        state.loading.cron = false;
        state.cronResults.autoMiss = payload;
      })
      .addCase(triggerAutoMiss.rejected, setError("cron"))
      .addCase(triggerTokenRefreshCron.pending, setLoading("cron"))
      .addCase(triggerTokenRefreshCron.fulfilled, (state, { payload }) => {
        state.loading.cron = false;
        state.cronResults.tokenRefresh = payload;
      })
      .addCase(triggerTokenRefreshCron.rejected, setError("cron"))
      .addCase(triggerReminders.pending, setLoading("cron"))
      .addCase(triggerReminders.fulfilled, (state, { payload }) => {
        state.loading.cron = false;
        state.cronResults.reminders = payload;
      })
      .addCase(triggerReminders.rejected, setError("cron"))
      .addCase(triggerExpirePrescriptions.pending, setLoading("cron"))
      .addCase(triggerExpirePrescriptions.fulfilled, (state, { payload }) => {
        state.loading.cron = false;
        state.cronResults.expirePrescriptions = payload;
      })
      .addCase(triggerExpirePrescriptions.rejected, setError("cron"))
       .addCase(muteParticipant.fulfilled, (state, { payload }) => {
        if (payload.mutedUserId) {
          if (!state.mutedParticipants.includes(payload.mutedUserId)) {
            state.mutedParticipants.push(payload.mutedUserId);
          }
        }
      })
      // UNMUTE
      .addCase(unmuteParticipant.fulfilled, (state, { payload }) => {
        state.mutedParticipants = state.mutedParticipants.filter(
          (id) => id !== payload.mutedUserId,
        );
      })
      // KICK
      .addCase(kickParticipant.fulfilled, (state, { payload }) => {
        if (payload.kickedUserId) {
          if (!state.kickedParticipants.includes(payload.kickedUserId)) {
            state.kickedParticipants.push(payload.kickedUserId);
          }
          state.participants.events = state.participants.events.map((e) =>
            e.userId === payload.kickedUserId ? { ...e, isKicked: true } : e,
          );
        }
      })
      // TIMER
      .addCase(fetchConsultationTimer.fulfilled, (state, { payload }) => {
        state.timer = payload.timer ?? state.timer;
      })
      // CRON — AUTO END
      .addCase(triggerAutoEnd.pending, setLoading("cron"))
      .addCase(triggerAutoEnd.fulfilled, (state, { payload }) => {
        state.loading.cron = false;
        state.cronResults.autoEnd = payload;
      })
      .addCase(triggerAutoEnd.rejected, setError("cron"))
      // CRON — TIMER REMINDER
      .addCase(triggerTimerReminder.pending, setLoading("cron"))
      .addCase(triggerTimerReminder.fulfilled, (state, { payload }) => {
        state.loading.cron = false;
        state.cronResults.timerReminder = payload;
      })
      .addCase(triggerTimerReminder.rejected, setError("cron"))

      
  },
  
});

// ── Exports ───────────────────────────────────────────────────────────────────

export const {
  resetConsultation,
  clearCurrent,
  clearError,
  setAgoraMyTokens,
  clearTypingUsers,
  clearPrescriptionPreview,
  clearAdminMessages,
  setLocalRecordingActive,
  socketStatusUpdate,
  socketParticipantJoined,
  socketParticipantLeft,
  socketParticipantDisconnected,
  socketPatientWaiting,
  socketPatientLeftWaiting,
  socketChatMessage,
  socketChatTyping,
  socketVitalsUpdate,
  socketQosUpdate,
  socketPrescriptionPreview,
  socketPrescriptionReady,
  socketAdminMessage,
  socketTokenRefreshed,
  socketRecordingStarted,
  socketRecordingStopped,
  socketParticipantAdded,
  socketParticipantRemoved,
    socketMuted,
  socketKicked,
  socketTimerUpdate,
  clearMutedKicked
} = consultationSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectConsultation = (s) => s.consultation.current;
export const selectConsultationStatus = (s) => s.consultation.status;
export const selectStatusMeta = (s) => s.consultation.statusMeta;
export const selectSessionStartedAt = (s) => s.consultation.sessionStartedAt;
export const selectSessionEndedAt = (s) => s.consultation.sessionEndedAt;
export const selectActualDurationSec = (s) => s.consultation.actualDurationSec;
export const selectConsultationList = (s) => s.consultation.list;
export const selectPagination = (s) => s.consultation.pagination;
export const selectDoctorSchedule = (s) => s.consultation.doctorSchedule;
export const selectDoctorHistory = (s) => s.consultation.doctorHistory;
export const selectDoctorStats = (s) => s.consultation.doctorStats;
export const selectDoctorActive = (s) => s.consultation.doctorActive;
export const selectPatientHistory = (s) => s.consultation.patientHistory;
export const selectPatientUpcoming = (s) => s.consultation.patientUpcoming;
export const selectPatientActive = (s) => s.consultation.patientActive;
export const selectMyConsultations = (s) => s.consultation.myConsultations;
export const selectAdminAll = (s) => s.consultation.adminAll;
export const selectAdminUpcoming = (s) => s.consultation.adminUpcoming;
export const selectAdminActive = (s) => s.consultation.adminActive;
export const selectAdminStats = (s) => s.consultation.adminStats;
export const selectAgora = (s) => s.consultation.agora;
export const selectMyTokens = (s) => s.consultation.agora.myTokens;
export const selectAgoraChannel = (s) => s.consultation.agora.channelName;
export const selectAgoraAppId = (s) => s.consultation.agora.appId;
export const selectWaitingRoom = (s) => s.consultation.waitingRoom;
export const selectParticipants = (s) => s.consultation.participants;
export const selectNetworkQuality = (s) => s.consultation.networkQuality;
export const selectVitals = (s) => s.consultation.vitals;
export const selectNotes = (s) => s.consultation.notes;
export const selectPrescriptions = (s) => s.consultation.prescriptions;
export const selectReferral = (s) => s.consultation.referral;
export const selectPrescriptionPreview = (s) =>
  s.consultation.prescriptionPreview;
export const selectDocuments = (s) => s.consultation.documents;
export const selectChatMessages = (s) => s.consultation.chatMessages;
export const selectTypingUsers = (s) => s.consultation.typingUsers;
export const selectRating = (s) => ({
  rating: s.consultation.rating,
  isRated: s.consultation.isRated,
});
export const selectMetrics = (s) => s.consultation.metrics;
export const selectFollowUp = (s) => ({
  chain: s.consultation.followUpChain,
  children: s.consultation.followUpChildren,
});
export const selectCronResults = (s) => s.consultation.cronResults;
export const selectAdminMessages = (s) => s.consultation.adminMessages;
export const selectLoading = (domain) => (s) => s.consultation.loading[domain];
export const selectAnyLoading = (s) =>
  Object.values(s.consultation.loading).some(Boolean);
export const selectError = (s) => s.consultation.error;
export const selectLocalRecordingActive = (s) =>
  s.consultation.agora.localRecordingActive;
export const selectTimer = (s) => s.consultation.timer;
export const selectMutedParticipants = (s) => s.consultation.mutedParticipants;
export const selectKickedParticipants = (s) => s.consultation.kickedParticipants;
export const selectIsParticipantMuted = (userId) => (s) =>
  s.consultation.mutedParticipants.includes(userId);
export const selectIsParticipantKicked = (userId) => (s) =>
  s.consultation.kickedParticipants.includes(userId);
export const selectRecordingActive = (s) =>
  s.consultation.agora.isRecordingActive;

export default consultationSlice.reducer;
