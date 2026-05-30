/**
 * consultationSlice.js — COMPLETE & CORRECTED
 *
 
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import API from "../api";
import toast from "react-hot-toast";

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — CREATE
// ══════════════════════════════════════════════════════════════════════════════

export const createConsultation = createAsyncThunk(
  "consultation/create",
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/consultations", body);
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — READ
// ══════════════════════════════════════════════════════════════════════════════

export const fetchConsultationById = createAsyncThunk(
  "consultation/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/consultations/${id}`);
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchConsultationByBooking = createAsyncThunk(
  "consultation/fetchByBooking",
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/consultations/by-booking/${bookingId}`);
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchPatientConsultations = createAsyncThunk(
  "consultation/fetchPatientList",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/consultations/patient/me", { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchDoctorConsultations = createAsyncThunk(
  "consultation/fetchDoctorList",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/consultations/doctor/me", { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchAdminConsultations = createAsyncThunk(
  "consultation/fetchAdminList",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/consultations/admin/all", { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchAdminStats = createAsyncThunk(
  "consultation/fetchAdminStats",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/consultations/admin/stats", { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchAdminFullConsultation = createAsyncThunk(
  "consultation/fetchAdminFull",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/consultations/${id}/admin/full`);
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const verifyPrescription = createAsyncThunk(
  "consultation/verifyPrescription",
  async (rxNumber, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/consultations/prescriptions/verify/${rxNumber}`,
      );
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — TOKEN / JOIN
// ══════════════════════════════════════════════════════════════════════════════

export const fetchJoinToken = createAsyncThunk(
  "consultation/fetchJoinToken",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/consultations/${id}/join-token`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — CONSENT
// ══════════════════════════════════════════════════════════════════════════════

export const submitConsent = createAsyncThunk(
  "consultation/submitConsent",
  async (
    {
      id,
      consentType = "telemedicine",
      accepted = true,
      consentVersion = "1.0",
    },
    { rejectWithValue },
  ) => {
    try {
      await API.patch(`/consultations/${id}/consent`, {
        consentType,
        accepted,
        consentVersion,
      });
      return { id, consentType, accepted };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchConsents = createAsyncThunk(
  "consultation/fetchConsents",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/consultations/${id}/consents`);
      return {
        id,
        consents: data.data.consents,
        telemedicineConsentAccepted: data.data.telemedicineConsentAccepted,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — WAITING ROOM
// ══════════════════════════════════════════════════════════════════════════════

export const enterWaitingRoom = createAsyncThunk(
  "consultation/enterWaitingRoom",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/consultations/${id}/waiting-room/enter`,
      );
      return { id, ...data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const approveWaitingRoom = createAsyncThunk(
  "consultation/approveWaitingRoom",
  async ({ id, userId }, { rejectWithValue }) => {
    try {
      await API.patch(`/consultations/${id}/waiting-room/approve`, { userId });
      return { id, userId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const rejectWaitingRoom = createAsyncThunk(
  "consultation/rejectWaitingRoom",
  async ({ id, userId, reason }, { rejectWithValue }) => {
    try {
      await API.patch(`/consultations/${id}/waiting-room/reject`, {
        userId,
        reason,
      });
      return { id, userId, reason };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchWaitingRoom = createAsyncThunk(
  "consultation/fetchWaitingRoom",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/consultations/${id}/waiting-room`);
      return { id, queue: data.data.queue };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — LIFECYCLE
// ══════════════════════════════════════════════════════════════════════════════

export const acceptConsultation = createAsyncThunk(
  "consultation/accept",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/consultations/${id}/accept`);
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const confirmConsultation = createAsyncThunk(
  "consultation/confirm",
  async ({ id, consentAccepted = false }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/consultations/${id}/confirm`, {
        consentAccepted,
      });
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const startConsultation = createAsyncThunk(
  "consultation/start",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/consultations/${id}/start`);
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const pauseConsultation = createAsyncThunk(
  "consultation/pause",
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/consultations/${id}/pause`, {
        reason,
      });
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const resumeConsultation = createAsyncThunk(
  "consultation/resume",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/consultations/${id}/resume`);
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const endConsultation = createAsyncThunk(
  "consultation/end",
  async ({ id, reason, prescriptionUploaded = false }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/consultations/${id}/end`, {
        reason,
        prescriptionUploaded,
      });
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const cancelConsultation = createAsyncThunk(
  "consultation/cancel",
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/consultations/${id}/cancel`, {
        reason,
      });
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — FILE ATTACHMENTS
// ══════════════════════════════════════════════════════════════════════════════

export const uploadAttachment = createAsyncThunk(
  "consultation/uploadAttachment",
  async (
    {
      id,
      file,
      attachmentType = "medical_document",
      description,
      accessLevel = "shared",
    },
    { rejectWithValue },
  ) => {
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("attachmentType", attachmentType);
      if (description) form.append("description", description);
      form.append("accessLevel", accessLevel);
      const { data } = await API.post(
        `/consultations/${id}/attachments`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return { id, attachment: data.data.attachment };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchAttachments = createAsyncThunk(
  "consultation/fetchAttachments",
  async ({ id, type } = {}, { rejectWithValue }) => {
    try {
      const params = type ? { type } : {};
      const { data } = await API.get(`/consultations/${id}/attachments`, {
        params,
      });
      return { id, attachments: data.data.attachments };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const deleteAttachment = createAsyncThunk(
  "consultation/deleteAttachment",
  async ({ id, attachmentId }, { rejectWithValue }) => {
    try {
      await API.delete(`/consultations/${id}/attachments/${attachmentId}`);
      return { id, attachmentId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — PRESCRIPTION
// ══════════════════════════════════════════════════════════════════════════════

export const uploadPrescription = createAsyncThunk(
  "consultation/uploadPrescription",
  async ({ id, file }, { rejectWithValue }) => {
    try {
      const form = new FormData();
      form.append("prescription", file);
      const { data } = await API.post(
        `/consultations/${id}/prescription/upload`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return { id, fileUrl: data.data.fileUrl, fileName: data.data.fileName };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const issuePrescription = createAsyncThunk(
  "consultation/issuePrescription",
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/consultations/${id}/prescription`,
        body,
      );
      return { id, prescription: data.data.prescription };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchPrescriptions = createAsyncThunk(
  "consultation/fetchPrescriptions",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/consultations/${id}/prescriptions`);
      return { id, prescriptions: data.data.prescriptions };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — PARTICIPANTS
// ══════════════════════════════════════════════════════════════════════════════

export const muteParticipant = createAsyncThunk(
  "consultation/muteParticipant",
  async ({ id, userId, muted = true }, { rejectWithValue }) => {
    try {
      await API.patch(`/consultations/${id}/participants/${userId}/mute`, {
        muted,
      });
      return { id, userId, muted };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const kickParticipant = createAsyncThunk(
  "consultation/kickParticipant",
  async ({ id, userId, reason }, { rejectWithValue }) => {
    try {
      await API.delete(`/consultations/${id}/participants/${userId}`, {
        data: { reason },
      });
      return { id, userId, reason };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const toggleScreenShare = createAsyncThunk(
  "consultation/toggleScreenShare",
  async ({ id, enabled }, { rejectWithValue }) => {
    try {
      await API.patch(`/consultations/${id}/screen-share`, { enabled });
      return { id, enabled };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchParticipants = createAsyncThunk(
  "consultation/fetchParticipants",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/consultations/${id}/participants`);
      return { id, participants: data.data.participants };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — NOTES & FEEDBACK
// ══════════════════════════════════════════════════════════════════════════════

export const saveDoctorNotes = createAsyncThunk(
  "consultation/saveDoctorNotes",
  async ({ id, notes }, { rejectWithValue }) => {
    try {
      await API.patch(`/consultations/${id}/doctor-notes`, { notes });
      return { id, notes };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const submitFeedback = createAsyncThunk(
  "consultation/submitFeedback",
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/consultations/${id}/feedback`, body);
      return { id, feedback: data.data.feedback };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const saveAdminNotes = createAsyncThunk(
  "consultation/saveAdminNotes",
  async ({ id, notes }, { rejectWithValue }) => {
    try {
      await API.patch(`/consultations/${id}/admin/notes`, { notes });
      return { id, notes };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — NETWORK ANALYTICS & SDK ERRORS
// ══════════════════════════════════════════════════════════════════════════════

export const pushAnalytics = createAsyncThunk(
  "consultation/pushAnalytics",
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      await API.post(`/consultations/${id}/analytics`, body);
      return null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const fetchAnalytics = createAsyncThunk(
  "consultation/fetchAnalytics",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/consultations/${id}/analytics`);
      return { id, analytics: data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const reportSdkError = createAsyncThunk(
  "consultation/reportSdkError",
  async ({ id, code, message, severity = "error" }, { rejectWithValue }) => {
    try {
      await API.post(`/consultations/${id}/sdk-error`, {
        code,
        message,
        severity,
      });
      return null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — EVENT LOGS
// ══════════════════════════════════════════════════════════════════════════════

export const fetchEventLogs = createAsyncThunk(
  "consultation/fetchEventLogs",
  async ({ id, ...params }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/consultations/${id}/events`, { params });
      return { id, events: data.data.events, total: data.data.total };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const logEvent = createAsyncThunk(
  "consultation/logEvent",
  async (
    { id, eventType, payload, severity = "info" },
    { rejectWithValue },
  ) => {
    try {
      await API.post(`/consultations/${id}/events`, {
        eventType,
        payload,
        severity,
      });
      return { id, eventType };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — ADMIN
// ══════════════════════════════════════════════════════════════════════════════

export const adminForceEnd = createAsyncThunk(
  "consultation/adminForceEnd",
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/consultations/${id}/admin/force-end`, {
        reason,
      });
      return data.data.consultation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const setAdminPriority = createAsyncThunk(
  "consultation/setAdminPriority",
  async ({ id, priority }, { rejectWithValue }) => {
    try {
      await API.patch(`/consultations/${id}/admin/priority`, { priority });
      return { id, priority };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const reassignDoctor = createAsyncThunk(
  "consultation/reassignDoctor",
  async ({ id, doctorProfileId }, { rejectWithValue }) => {
    try {
      await API.patch(`/consultations/${id}/admin/reassign-doctor`, {
        doctorProfileId,
      });
      return { id, doctorProfileId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const adminBulkAction = createAsyncThunk(
  "consultation/adminBulkAction",
  async ({ consultationIds, action, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/consultations/admin/bulk-action", {
        consultationIds,
        action,
        reason,
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ══════════════════════════════════════════════════════════════════════════════

const initialState = {
  current: null,
  joinToken: null,
  consents: [],
  waitingQueue: [],
  participants: [],
  attachments: [],
  prescriptions: [],
  analytics: null,
  eventLogs: [],
  verifiedRx: null,

  list: [],
  total: 0,
  page: 1,
  pages: 1,

  stats: null,
  bulkResult: null,

  rt: {
    connected: false,
    consultationId: null,
    bookingId: null,
    status: null,
    appId: null,
    channelName: null,
    telemedicineConsentRequired: false,
    waitingRoomEnabled: false,
    participantCount: 0,

    participants: {},
    waitingQueue: {},
    typingUsers: {},
    raisedHands: {},
    screenSharing: {},
    networkQuality: {},
    reconnectAttempts: [],
    onlineDoctors: {},

    kicked: false,
    kickReason: null,
    muted: false,
    waitingRoomTimedOut: false,

    telemedicineConsentAccepted: false,
    consents: [],
    prescriptions: [],
    attachments: [],

    adminBroadcasts: [],
    reassignedDoctorId: null,
  },

  loading: {
    fetch: false,
    list: false,
    token: false,
    lifecycle: false,
    consent: false,
    waitingRoom: false,
    attachment: false,
    prescription: false,
    participant: false,
    notes: false,
    feedback: false,
    analytics: false,
    events: false,
    stats: false,
    admin: false,
    verify: false,
  },

  error: null,
};

const patchInList = (state, updated) => {
  if (!updated) return;
  const idx = state.list.findIndex((c) => c._id === updated._id);
  if (idx >= 0) state.list[idx] = updated;
  if (state.current?._id === updated._id) state.current = updated;
};

// ══════════════════════════════════════════════════════════════════════════════
// SLICE
// ══════════════════════════════════════════════════════════════════════════════

const consultationSlice = createSlice({
  name: "consultation",
  initialState,
  reducers: {
    clearCurrent(state) {
      state.current = null;
      state.joinToken = null;
      state.consents = [];
      state.waitingQueue = [];
      state.participants = [];
      state.attachments = [];
      state.prescriptions = [];
      state.analytics = null;
      state.eventLogs = [];
      state.verifiedRx = null;
    },
    clearError(state) {
      state.error = null;
    },
    clearList(state) {
      state.list = [];
      state.total = 0;
      state.page = 1;
      state.pages = 1;
    },
    clearBulkResult(state) {
      state.bulkResult = null;
    },

    rtJoined(state, { payload }) {
      state.rt.connected = true;
      state.rt.consultationId = payload.consultationId;
      state.rt.bookingId = payload.bookingId;
      state.rt.status = payload.status;
      state.rt.appId = payload.appId;
      state.rt.channelName = payload.channelName;
      state.rt.telemedicineConsentRequired =
        payload.telemedicineConsentRequired ?? false;
      state.rt.waitingRoomEnabled = payload.waitingRoomEnabled ?? false;
      state.rt.participantCount = payload.participantCount ?? 0;

      // Seed doctor/patient into current consultation
      if (payload.doctor && state.current) {
        state.current.doctor = { ...state.current.doctor, ...payload.doctor };
      }
      if (payload.patient && state.current) {
        state.current.patient = {
          ...state.current.patient,
          ...payload.patient,
        };
      }

      // Seed existing participants
      if (payload.existingParticipants?.length) {
        payload.existingParticipants.forEach((p) => {
          state.rt.participants[p.userId] = p;
        });
        state.rt.participantCount = payload.existingParticipants.filter(
          (p) => p.connectionStatus === "connected",
        ).length;
      }

      // Seed waiting queue
      if (payload.existingWaitingQueue?.length) {
        payload.existingWaitingQueue.forEach((e) => {
          state.rt.waitingQueue[e.userId] = e;
        });
      }
    },

    rtStatusUpdate(state, { payload }) {
      if (payload.status) {
        state.rt.status = payload.status;
        if (state.current) {
          state.current.status = payload.status;
          // Only patch list if item exists — avoid full scan on every event
          const idx = state.list.findIndex((c) => c._id === state.current._id);
          if (idx >= 0)
            state.list[idx] = { ...state.list[idx], status: payload.status };
        }
      }
      if (payload.actualDurationMinutes !== undefined && state.current) {
        state.current.actualDurationMinutes = payload.actualDurationMinutes;
      }
      if (payload.cancelledBy !== undefined && state.current) {
        state.current.cancelledBy = payload.cancelledBy;
      }
    },

    rtParticipantConnected(state, { payload }) {
      state.rt.participants[payload.userId] = {
        ...state.rt.participants[payload.userId],
        userId: payload.userId,
        role: payload.role,
        name: payload.name,
        connectionStatus: "connected",
        connectedAt: payload.timestamp,
      };
      state.rt.participantCount = Object.values(state.rt.participants).filter(
        (p) => p.connectionStatus === "connected",
      ).length;
    },

    rtParticipantDisconnected(state, { payload }) {
      if (state.rt.participants[payload.userId]) {
        state.rt.participants[payload.userId].connectionStatus = "disconnected";
        state.rt.participants[payload.userId].disconnectedAt =
          payload.timestamp;
        state.rt.participants[payload.userId].disconnectReason = payload.reason;
      }
      state.rt.participantCount = Object.values(state.rt.participants).filter(
        (p) => p.connectionStatus === "connected",
      ).length;
      delete state.rt.typingUsers[payload.userId];
      delete state.rt.raisedHands[payload.userId];
      delete state.rt.screenSharing[payload.userId];
    },

    rtParticipantJoined(state, { payload }) {
      state.rt.participants[payload.userId] = {
        ...state.rt.participants[payload.userId],
        userId: payload.userId,
        role: payload.role,
        name: payload.name,
        agoraUid: payload.agoraUid,
        connectionStatus: "connected",
        joinedAt: payload.timestamp,
      };
      state.rt.participantCount = Object.values(state.rt.participants).filter(
        (p) => p.connectionStatus === "connected",
      ).length;
    },

    rtParticipantLeft(state, { payload }) {
      if (state.rt.participants[payload.userId]) {
        state.rt.participants[payload.userId].connectionStatus = "disconnected";
        state.rt.participants[payload.userId].leftAt = payload.timestamp;
        state.rt.participants[payload.userId].leaveReason = payload.reason;
      }
      state.rt.participantCount = Object.values(state.rt.participants).filter(
        (p) => p.connectionStatus === "connected",
      ).length;
      delete state.rt.typingUsers[payload.userId];
      delete state.rt.raisedHands[payload.userId];
      delete state.rt.screenSharing[payload.userId];
    },

    rtParticipantMuted(state, { payload }) {
      if (state.rt.participants[payload.targetUserId]) {
        state.rt.participants[payload.targetUserId].isMutedByHost = true;
      }
    },

    rtParticipantUnmuted(state, { payload }) {
      if (state.rt.participants[payload.targetUserId]) {
        state.rt.participants[payload.targetUserId].isMutedByHost = false;
      }
    },

    rtParticipantKicked(state, { payload }) {
      if (state.rt.participants[payload.targetUserId]) {
        state.rt.participants[payload.targetUserId].connectionStatus =
          "disconnected";
        state.rt.participants[payload.targetUserId].kicked = true;
        state.rt.participants[payload.targetUserId].kickReason = payload.reason;
        state.rt.participants[payload.targetUserId].leftAt = payload.timestamp;
      }
      state.rt.participantCount = Object.values(state.rt.participants).filter(
        (p) => p.connectionStatus === "connected",
      ).length;
      delete state.rt.screenSharing[payload.targetUserId];
    },

    rtYouWereKicked(state, { payload }) {
      state.rt.kicked = true;
      state.rt.kickReason = payload.reason ?? null;
    },

    rtYouWereMuted(state) {
      state.rt.muted = true;
    },
    rtYouWereUnmuted(state) {
      state.rt.muted = false;
    },

    rtPatientEnteredWaiting(state, { payload }) {
      state.rt.waitingQueue[payload.patientId] = {
        userId: payload.patientId,
        name: payload.patientName ?? "Patient",
        queuePosition: payload.queuePosition,
        waitingRoomStatus: "waiting",
        enteredAt: payload.timestamp,
      };
      if (["scheduled", "created"].includes(state.rt.status)) {
        state.rt.status = "waiting";
      }
    },

    rtWaitingRoomApproved(state, { payload }) {
      if (state.rt.waitingQueue[payload.userId]) {
        state.rt.waitingQueue[payload.userId].waitingRoomStatus = "approved";
        state.rt.waitingQueue[payload.userId].approvedAt = payload.timestamp;
      }
      if (state.rt.status === "waiting") state.rt.status = "active";
      if (state.current?.status === "waiting") state.current.status = "active";
    },

    rtWaitingRoomRejected(state, { payload }) {
      if (state.rt.waitingQueue[payload.userId]) {
        state.rt.waitingQueue[payload.userId].waitingRoomStatus = "rejected";
        state.rt.waitingQueue[payload.userId].rejectedAt = payload.timestamp;
        state.rt.waitingQueue[payload.userId].rejectionReason =
          payload.reason ?? null;
      }
    },

    rtWaitingRoomTimedOut(state) {
      state.rt.waitingRoomTimedOut = true;
      Object.keys(state.rt.waitingQueue).forEach((uid) => {
        if (state.rt.waitingQueue[uid].waitingRoomStatus === "waiting") {
          state.rt.waitingQueue[uid].waitingRoomStatus = "timed_out";
        }
      });
    },

    rtTypingStart(state, { payload }) {
      state.rt.typingUsers[payload.userId] = {
        name: payload.name,
        role: payload.role,
      };
    },

    rtTypingStop(state, { payload }) {
      delete state.rt.typingUsers[payload.userId];
    },

    rtHandRaised(state, { payload }) {
      state.rt.raisedHands[payload.userId] = {
        name: payload.name,
        role: payload.role,
        timestamp: payload.timestamp,
      };
    },

    rtHandLowered(state, { payload }) {
      delete state.rt.raisedHands[payload.userId];
    },

    rtScreenShareToggled(state, { payload }) {
      if (state.current && state.current._id === payload.consultationId) {
        state.current.screenShareEnabled = payload.screenShareEnabled;
      }
    },

    rtScreenShareStarted(state, { payload }) {
      state.rt.screenSharing[payload.userId] = {
        role: payload.role,
        timestamp: payload.timestamp,
      };
    },

    rtScreenShareStopped(state, { payload }) {
      delete state.rt.screenSharing[payload.userId];
    },

    rtConsentUpdated(state, { payload }) {
      if (payload.consentType === "telemedicine") {
        state.rt.telemedicineConsentAccepted = payload.accepted;
        state.rt.telemedicineConsentRequired = !payload.accepted;
        if (state.current)
          state.current.telemedicineConsentAccepted = payload.accepted;
      }
      const idx = state.rt.consents.findIndex(
        (c) => c.consentType === payload.consentType,
      );
      const entry = {
        consentType: payload.consentType,
        accepted: payload.accepted,
        acceptedAt: payload.timestamp,
      };
      if (idx >= 0) state.rt.consents[idx] = entry;
      else state.rt.consents.push(entry);
    },

    rtPrescriptionEvent(state, { payload }) {
      if (state.current) state.current.prescriptionUploaded = true;
      if (payload.rxId) {
        const exists = state.rt.prescriptions.some(
          (p) => p._id === payload.rxId,
        );
        if (!exists) {
          state.rt.prescriptions.push({
            _id: payload.rxId,
            rxNumber: payload.rxNumber,
            issuedAt: payload.timestamp,
            fileUrl: payload.fileUrl ?? null,
          });
        }
      }
    },

    rtAttachmentUploaded(state, { payload }) {
      const exists = state.rt.attachments.some(
        (a) => a._id === payload.attachmentId,
      );
      if (!exists) {
        state.rt.attachments.push({
          _id: payload.attachmentId,
          attachmentType: payload.attachmentType,
          uploaderRole: payload.uploaderRole,
          fileName: payload.fileName,
          uploadedAt: payload.timestamp,
        });
      }
    },

    rtNetworkQuality(state, { payload }) {
      state.rt.networkQuality[payload.userId] = {
        role: payload.role,
        uplinkNetworkQuality: payload.uplinkNetworkQuality,
        downlinkNetworkQuality: payload.downlinkNetworkQuality,
        latency: payload.latency,
        packetLoss: payload.packetLoss,
        timestamp: payload.timestamp,
      };
    },

    rtReconnectAttempt(state, { payload }) {
      state.rt.reconnectAttempts.push({
        userId: payload.userId,
        role: payload.role,
        timestamp: payload.timestamp,
        success: false,
      });
    },

    rtReconnectSuccess(state, { payload }) {
      const idx = [...state.rt.reconnectAttempts]
        .reverse()
        .findIndex((r) => r.userId === payload.userId && !r.success);
      if (idx >= 0) {
        const realIdx = state.rt.reconnectAttempts.length - 1 - idx;
        state.rt.reconnectAttempts[realIdx].success = true;
        state.rt.reconnectAttempts[realIdx].reconnectedAt = payload.timestamp;
      }
    },

    rtDoctorOnline(state, { payload }) {
      state.rt.onlineDoctors[payload.doctorUserId] = {
        name: payload.doctorName,
        timestamp: payload.timestamp,
      };
    },

    rtDoctorOffline(state, { payload }) {
      delete state.rt.onlineDoctors[payload.doctorUserId];
    },

    rtDoctorReassigned(state, { payload }) {
      state.rt.reassignedDoctorId = payload.newDoctorId;
      if (state.current) state.current.doctor = payload.newDoctorId;
    },

    rtAdminBroadcast(state, { payload }) {
      state.rt.adminBroadcasts.push({
        message: payload.message,
        from: payload.from,
        timestamp: payload.timestamp,
      });
    },

    rtConnectionLost(state, { payload }) {
      state.rt.connected = false;
      state.rt.disconnectReason = payload?.reason;
    },

    rtStateSynced(state, { payload }) {
      if (payload.status) state.rt.status = payload.status;

      // Sync doctor/patient info into current consultation
      if (payload.doctor && state.current) {
        state.current.doctor = { ...state.current.doctor, ...payload.doctor };
      }
      if (payload.patient && state.current) {
        state.current.patient = {
          ...state.current.patient,
          ...payload.patient,
        };
      }

      if (payload.waitingQueue) {
        payload.waitingQueue.forEach((entry) => {
          state.rt.waitingQueue[entry.userId] = entry;
        });
      }

      if (payload.participants) {
        payload.participants.forEach((p) => {
          state.rt.participants[p.userId] = {
            ...state.rt.participants[p.userId],
            ...p,
          };
        });
      }
    },

    rtConnectionRecovered(state) {
      state.rt.connected = true;
      state.rt.disconnectReason = null;
    },

    resetRt(state) {
      state.rt = { ...initialState.rt };
    },
  },

  extraReducers: (builder) => {
    // ── Section 1: Create ─────────────────────────────────────────────────────
    builder
      .addCase(createConsultation.pending, (s) => {
        s.loading.lifecycle = true;
        s.error = null;
      })
      .addCase(createConsultation.fulfilled, (s, { payload }) => {
        s.loading.lifecycle = false;
        s.current = payload;
        toast.success("Consultation created");
      })
      .addCase(createConsultation.rejected, (s, { payload }) => {
        s.loading.lifecycle = false;
        s.error = payload;
        toast.error(payload || "Failed to create consultation");
      });

    // ── Section 2: Read ───────────────────────────────────────────────────────
    builder
      .addCase(fetchConsultationById.pending, (s) => {
        s.loading.fetch = true;
        s.error = null;
      })
      .addCase(fetchConsultationById.fulfilled, (s, { payload }) => {
        s.loading.fetch = false;
        s.current = payload;
      })
      .addCase(fetchConsultationById.rejected, (s, { payload }) => {
        s.loading.fetch = false;
        s.error = payload;
        toast.error(payload || "Failed to load consultation");
      });

    builder
      .addCase(fetchConsultationByBooking.pending, (s) => {
        s.loading.fetch = true;
      })
      .addCase(fetchConsultationByBooking.fulfilled, (s, { payload }) => {
        s.loading.fetch = false;
        s.current = payload;
      })
      .addCase(fetchConsultationByBooking.rejected, (s, { payload }) => {
        s.loading.fetch = false;
        s.error = payload;
      });

    [
      fetchPatientConsultations,
      fetchDoctorConsultations,
      fetchAdminConsultations,
    ].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (s) => {
          s.loading.list = true;
          s.error = null;
        })
        .addCase(thunk.fulfilled, (s, { payload }) => {
          s.loading.list = false;
          s.list = payload.consultations;
          s.total = payload.total;
          s.page = payload.page;
          s.pages = payload.pages;
        })
        .addCase(thunk.rejected, (s, { payload }) => {
          s.loading.list = false;
          s.error = payload;
          toast.error(payload || "Failed to load consultations");
        });
    });

    builder
      .addCase(fetchAdminStats.pending, (s) => {
        s.loading.stats = true;
      })
      .addCase(fetchAdminStats.fulfilled, (s, { payload }) => {
        s.loading.stats = false;
        s.stats = payload;
      })
      .addCase(fetchAdminStats.rejected, (s, { payload }) => {
        s.loading.stats = false;
        s.error = payload;
      });

    builder
      .addCase(fetchAdminFullConsultation.pending, (s) => {
        s.loading.fetch = true;
      })
      .addCase(fetchAdminFullConsultation.fulfilled, (s, { payload }) => {
        s.loading.fetch = false;
        s.current = payload;
      })
      .addCase(fetchAdminFullConsultation.rejected, (s, { payload }) => {
        s.loading.fetch = false;
        s.error = payload;
      });

    builder
      .addCase(verifyPrescription.pending, (s) => {
        s.loading.verify = true;
        s.verifiedRx = null;
      })
      .addCase(verifyPrescription.fulfilled, (s, { payload }) => {
        s.loading.verify = false;
        s.verifiedRx = payload;
      })
      .addCase(verifyPrescription.rejected, (s, { payload }) => {
        s.loading.verify = false;
        s.error = payload;
        toast.error(payload || "Prescription not found");
      });

    // ── Section 3: Token ──────────────────────────────────────────────────────
    builder
      .addCase(fetchJoinToken.pending, (s) => {
        s.loading.token = true;
        s.error = null;
      })
      .addCase(fetchJoinToken.fulfilled, (s, { payload }) => {
        s.loading.token = false;
        s.joinToken = payload;
      })
      .addCase(fetchJoinToken.rejected, (s, { payload }) => {
        s.loading.token = false;
        s.error = payload;
        toast.error(payload || "Failed to get join token");
      });

    // ── Section 4: Consent ────────────────────────────────────────────────────
    builder
      .addCase(submitConsent.pending, (s) => {
        s.loading.consent = true;
      })
      .addCase(submitConsent.fulfilled, (s, { payload }) => {
        s.loading.consent = false;
        if (s.current && payload.consentType === "telemedicine") {
          s.current.telemedicineConsentAccepted = payload.accepted;
        }
        toast.success("Consent recorded");
      })
      .addCase(submitConsent.rejected, (s, { payload }) => {
        s.loading.consent = false;
        s.error = payload;
        toast.error(payload || "Consent failed");
      });

    builder
      .addCase(fetchConsents.pending, (s) => {
        s.loading.consent = true;
      })
      .addCase(fetchConsents.fulfilled, (s, { payload }) => {
        s.loading.consent = false;
        s.consents = payload.consents;
        if (s.current)
          s.current.telemedicineConsentAccepted =
            payload.telemedicineConsentAccepted;
      })
      .addCase(fetchConsents.rejected, (s) => {
        s.loading.consent = false;
      });

    // ── Section 5: Waiting Room ───────────────────────────────────────────────
    builder
      .addCase(enterWaitingRoom.pending, (s) => {
        s.loading.waitingRoom = true;
      })
      .addCase(enterWaitingRoom.fulfilled, (s, { payload }) => {
        s.loading.waitingRoom = false;
        if (s.current) s.current.status = "waiting";
        const patientId = String(
          s.current?.patient?._id || s.current?.patient || "",
        );
        if (patientId) {
          s.rt.waitingQueue[patientId] = {
            userId: patientId,
            name: "You",
            queuePosition: payload.queuePosition ?? 1,
            waitingRoomStatus: "waiting",
            enteredAt: new Date().toISOString(),
          };
        }
        toast.success("Entered waiting room");
      })
      .addCase(enterWaitingRoom.rejected, (s, { payload }) => {
        s.loading.waitingRoom = false;
        toast.error(payload || "Failed to enter waiting room");
      });

    builder
      .addCase(approveWaitingRoom.pending, (s) => {
        s.loading.waitingRoom = true;
      })
      .addCase(approveWaitingRoom.fulfilled, (s, { payload }) => {
        s.loading.waitingRoom = false;
        s.waitingQueue = s.waitingQueue.filter(
          (u) => u.userId !== payload.userId,
        );
        toast.success("Patient approved");
      })
      .addCase(approveWaitingRoom.rejected, (s, { payload }) => {
        s.loading.waitingRoom = false;
        toast.error(payload || "Approval failed");
      });

    builder
      .addCase(rejectWaitingRoom.pending, (s) => {
        s.loading.waitingRoom = true;
      })
      .addCase(rejectWaitingRoom.fulfilled, (s, { payload }) => {
        s.loading.waitingRoom = false;
        s.waitingQueue = s.waitingQueue.filter(
          (u) => u.userId !== payload.userId,
        );
        toast.success("Patient rejected from waiting room");
      })
      .addCase(rejectWaitingRoom.rejected, (s, { payload }) => {
        s.loading.waitingRoom = false;
        toast.error(payload || "Rejection failed");
      });

    builder
      .addCase(fetchWaitingRoom.pending, (s) => {
        s.loading.waitingRoom = true;
      })
      .addCase(fetchWaitingRoom.fulfilled, (s, { payload }) => {
        s.loading.waitingRoom = false;
        s.waitingQueue = payload.queue;

        // FIX: Include 'timed_out' entries — doctor panel needs to see them to admit manually.
        // Previously only 'waiting' was synced → timed_out patients were invisible to doctor.
        const ACTIONABLE = ["waiting", "timed_out"];

        payload.queue
          .filter((e) => ACTIONABLE.includes(e.waitingRoomStatus))
          .forEach((e) => {
            const uid = String(e.userId);
            // Always overwrite — server is source of truth for status
            s.rt.waitingQueue[uid] = {
              userId: uid,
              name: e.displayName || e.name || "Patient",
              queuePosition: e.queuePosition,
              waitingRoomStatus: e.waitingRoomStatus,
              enteredAt: e.enteredAt,
            };
          });
      })
      .addCase(fetchWaitingRoom.rejected, (s) => {
        s.loading.waitingRoom = false;
      });

    // ── Section 6: Lifecycle ──────────────────────────────────────────────────
    [
      { thunk: acceptConsultation, msg: "Consultation accepted" },
      { thunk: confirmConsultation, msg: "Consultation confirmed" },
      { thunk: startConsultation, msg: "Consultation started" },
      { thunk: pauseConsultation, msg: "Consultation paused" },
      { thunk: resumeConsultation, msg: "Consultation resumed" },
      { thunk: endConsultation, msg: "Consultation ended" },
      { thunk: cancelConsultation, msg: "Consultation cancelled" },
    ].forEach(({ thunk, msg }) => {
      builder
        .addCase(thunk.pending, (s) => {
          s.loading.lifecycle = true;
          s.error = null;
        })
        .addCase(thunk.fulfilled, (s, { payload }) => {
          s.loading.lifecycle = false;
          if (payload) {
            s.current = payload;
            patchInList(s, payload);
          }
          toast.success(msg);
        })
        .addCase(thunk.rejected, (s, { payload }) => {
          s.loading.lifecycle = false;
          s.error = payload;
          toast.error(payload || `${msg} failed`);
        });
    });

    // ── Section 7: Attachments ────────────────────────────────────────────────
    builder
      .addCase(uploadAttachment.pending, (s) => {
        s.loading.attachment = true;
      })
      .addCase(uploadAttachment.fulfilled, (s, { payload }) => {
        s.loading.attachment = false;
        s.attachments.push(payload.attachment);
        toast.success("File uploaded");
      })
      .addCase(uploadAttachment.rejected, (s, { payload }) => {
        s.loading.attachment = false;
        toast.error(payload || "Upload failed");
      });

    builder
      .addCase(fetchAttachments.pending, (s) => {
        s.loading.attachment = true;
      })
      .addCase(fetchAttachments.fulfilled, (s, { payload }) => {
        s.loading.attachment = false;
        s.attachments = payload.attachments;
      })
      .addCase(fetchAttachments.rejected, (s) => {
        s.loading.attachment = false;
      });

    builder
      .addCase(deleteAttachment.pending, (s) => {
        s.loading.attachment = true;
      })
      .addCase(deleteAttachment.fulfilled, (s, { payload }) => {
        s.loading.attachment = false;
        s.attachments = s.attachments.filter(
          (a) => a._id !== payload.attachmentId,
        );
        toast.success("Attachment deleted");
      })
      .addCase(deleteAttachment.rejected, (s, { payload }) => {
        s.loading.attachment = false;
        toast.error(payload || "Delete failed");
      });

    // ── Section 8: Prescription ───────────────────────────────────────────────
    builder
      .addCase(uploadPrescription.pending, (s) => {
        s.loading.prescription = true;
      })
      .addCase(uploadPrescription.fulfilled, (s) => {
        s.loading.prescription = false;
        if (s.current) s.current.prescriptionUploaded = true;
        toast.success("Prescription uploaded");
      })
      .addCase(uploadPrescription.rejected, (s, { payload }) => {
        s.loading.prescription = false;
        toast.error(payload || "Upload failed");
      });

    builder
      .addCase(issuePrescription.pending, (s) => {
        s.loading.prescription = true;
      })
      .addCase(issuePrescription.fulfilled, (s, { payload }) => {
        s.loading.prescription = false;
        s.prescriptions.push(payload.prescription);
        if (s.current) s.current.prescriptionUploaded = true;
        toast.success(
          `Prescription issued — RX#${payload.prescription.rxNumber}`,
        );
      })
      .addCase(issuePrescription.rejected, (s, { payload }) => {
        s.loading.prescription = false;
        toast.error(payload || "Prescription failed");
      });

    builder
      .addCase(fetchPrescriptions.pending, (s) => {
        s.loading.prescription = true;
      })
      .addCase(fetchPrescriptions.fulfilled, (s, { payload }) => {
        s.loading.prescription = false;
        s.prescriptions = payload.prescriptions;
      })
      .addCase(fetchPrescriptions.rejected, (s) => {
        s.loading.prescription = false;
      });

    // ── Section 9: Participants ──────────────────────────────────────────────
    builder
      .addCase(muteParticipant.pending, (s) => {
        s.loading.participant = true;
      })
      .addCase(muteParticipant.fulfilled, (s, { payload }) => {
        s.loading.participant = false;
        const p = s.participants.find((x) => x.userId === payload.userId);
        if (p) p.isMutedByHost = payload.muted;
        toast.success(
          payload.muted ? "Participant muted" : "Participant unmuted",
        );
      })
      .addCase(muteParticipant.rejected, (s, { payload }) => {
        s.loading.participant = false;
        toast.error(payload || "Mute failed");
      });

    builder
      .addCase(kickParticipant.pending, (s) => {
        s.loading.participant = true;
      })
      .addCase(kickParticipant.fulfilled, (s, { payload }) => {
        s.loading.participant = false;
        // REST list
        s.participants = s.participants.filter(
          (p) => String(p.userId) !== String(payload.userId),
        );
        // RT map — mark disconnected (socket event may arrive late)
        if (s.rt.participants[payload.userId]) {
          s.rt.participants[payload.userId].connectionStatus = "disconnected";
          s.rt.participants[payload.userId].kicked = true;
        }
        s.rt.participantCount = Object.values(s.rt.participants).filter(
          (p) => p.connectionStatus === "connected",
        ).length;
        toast.success("Participant removed");
      })
      .addCase(kickParticipant.rejected, (s, { payload }) => {
        s.loading.participant = false;
        toast.error(payload || "Kick failed");
      });

    builder
      .addCase(toggleScreenShare.pending, (s) => {
        s.loading.participant = true;
      })
      .addCase(toggleScreenShare.fulfilled, (s, { payload }) => {
        s.loading.participant = false;
        if (s.current?._id === payload.id)
          s.current.screenShareEnabled = payload.enabled;
        toast.success(
          `Screen share ${payload.enabled ? "enabled" : "disabled"}`,
        );
      })
      .addCase(toggleScreenShare.rejected, (s, { payload }) => {
        s.loading.participant = false;
        toast.error(payload || "Screen share toggle failed");
      });

    builder
      .addCase(fetchParticipants.pending, (s) => {
        s.loading.participant = true;
      })
      .addCase(fetchParticipants.fulfilled, (s, { payload }) => {
        s.loading.participant = false;
        s.participants = payload.participants;
      })
      .addCase(fetchParticipants.rejected, (s) => {
        s.loading.participant = false;
      });

    // ── Section 10: Notes & Feedback ──────────────────────────────────────────
    builder
      .addCase(saveDoctorNotes.pending, (s) => {
        s.loading.notes = true;
      })
      .addCase(saveDoctorNotes.fulfilled, (s) => {
        s.loading.notes = false;
        toast.success("Notes saved");
      })
      .addCase(saveDoctorNotes.rejected, (s, { payload }) => {
        s.loading.notes = false;
        toast.error(payload || "Notes save failed");
      });

    builder
      .addCase(submitFeedback.pending, (s) => {
        s.loading.feedback = true;
      })
      .addCase(submitFeedback.fulfilled, (s, { payload }) => {
        s.loading.feedback = false;
        if (s.current) {
          s.current.feedback = payload.feedback;
          s.current.isRated = true;
        }
        toast.success("Thank you for your feedback!");
      })
      .addCase(submitFeedback.rejected, (s, { payload }) => {
        s.loading.feedback = false;
        toast.error(payload || "Feedback failed");
      });

    builder
      .addCase(saveAdminNotes.pending, (s) => {
        s.loading.notes = true;
      })
      .addCase(saveAdminNotes.fulfilled, (s) => {
        s.loading.notes = false;
        toast.success("Admin notes saved");
      })
      .addCase(saveAdminNotes.rejected, (s, { payload }) => {
        s.loading.notes = false;
        toast.error(payload || "Failed");
      });

    // ── Section 11: Analytics & SDK Errors ───────────────────────────────────
    builder
      .addCase(pushAnalytics.rejected, () => {
        /* silent */
      })
      .addCase(reportSdkError.rejected, () => {
        /* silent */
      });

    builder
      .addCase(fetchAnalytics.pending, (s) => {
        s.loading.analytics = true;
      })
      .addCase(fetchAnalytics.fulfilled, (s, { payload }) => {
        s.loading.analytics = false;
        // payload.analytics = consultationAnalytics object from server summary
        // payload = { id, analytics: { avgLatency, avgBandwidth, ... } }
        s.analytics = payload.analytics ?? payload; // guard both shapes
      })
      .addCase(fetchAnalytics.rejected, (s) => {
        s.loading.analytics = false;
      });

    // ── Section 12: Event Logs ────────────────────────────────────────────────
    builder
      .addCase(fetchEventLogs.pending, (s) => {
        s.loading.events = true;
      })
      .addCase(fetchEventLogs.fulfilled, (s, { payload }) => {
        s.loading.events = false;
        s.eventLogs = payload.events;
      })
      .addCase(fetchEventLogs.rejected, (s) => {
        s.loading.events = false;
      });

    builder.addCase(logEvent.rejected, () => {
      /* silent — client-side telemetry */
    });

    // ── Section 13: Admin ─────────────────────────────────────────────────────
    builder
      .addCase(adminForceEnd.pending, (s) => {
        s.loading.admin = true;
        s.error = null;
      })
      .addCase(adminForceEnd.fulfilled, (s, { payload }) => {
        s.loading.admin = false;
        if (payload) {
          s.current = payload;
          patchInList(s, payload);
        }
        toast.success("Force-ended");
      })
      .addCase(adminForceEnd.rejected, (s, { payload }) => {
        s.loading.admin = false;
        toast.error(payload || "Force-end failed");
      });

    builder
      .addCase(setAdminPriority.pending, (s) => {
        s.loading.admin = true;
      })
      .addCase(setAdminPriority.fulfilled, (s, { payload }) => {
        s.loading.admin = false;
        if (s.current?._id === payload.id)
          s.current.priority = payload.priority;
        const item = s.list.find((c) => c._id === payload.id);
        if (item) item.priority = payload.priority;
        toast.success(`Priority set to ${payload.priority}`);
      })
      .addCase(setAdminPriority.rejected, (s, { payload }) => {
        s.loading.admin = false;
        toast.error(payload || "Priority update failed");
      });

    builder
      .addCase(reassignDoctor.pending, (s) => {
        s.loading.admin = true;
      })
      .addCase(reassignDoctor.fulfilled, (s, { payload }) => {
        s.loading.admin = false;
        if (s.current?._id === payload.id)
          s.current.doctor = payload.doctorProfileId;
        toast.success("Doctor reassigned");
      })
      .addCase(reassignDoctor.rejected, (s, { payload }) => {
        s.loading.admin = false;
        toast.error(payload || "Reassign failed");
      });

    builder
      .addCase(adminBulkAction.pending, (s) => {
        s.loading.admin = true;
        s.bulkResult = null;
      })
      .addCase(adminBulkAction.fulfilled, (s, { payload }) => {
        s.loading.admin = false;
        s.bulkResult = payload;
        toast.success(`Bulk action: ${payload.modified} updated`);
      })
      .addCase(adminBulkAction.rejected, (s, { payload }) => {
        s.loading.admin = false;
        toast.error(payload || "Bulk action failed");
      });
  },
});

export const {
  clearCurrent,
  clearError,
  clearList,
  clearBulkResult,

  rtJoined,
  rtStatusUpdate,
  rtParticipantConnected,
  rtParticipantDisconnected,
  rtParticipantJoined,
  rtParticipantLeft,
  rtParticipantMuted,
  rtParticipantUnmuted,
  rtParticipantKicked,
  rtYouWereKicked,
  rtYouWereMuted,
  rtYouWereUnmuted,
  rtPatientEnteredWaiting,
  rtWaitingRoomApproved,
  rtWaitingRoomRejected,
  rtWaitingRoomTimedOut,
  rtTypingStart,
  rtTypingStop,
  rtHandRaised,
  rtHandLowered,
  rtScreenShareToggled,
  rtScreenShareStarted,
  rtScreenShareStopped,
  rtConsentUpdated,
  rtPrescriptionEvent,
  rtAttachmentUploaded,
  rtNetworkQuality,
  rtReconnectAttempt,
  rtReconnectSuccess,
  rtDoctorOnline,
  rtDoctorOffline,
  rtDoctorReassigned,
  rtAdminBroadcast,
  rtConnectionLost,
  rtStateSynced,
  rtConnectionRecovered,
  resetRt,
} = consultationSlice.actions;

export default consultationSlice.reducer;

export const selectConsultation = (s) => s.consultation.current;
export const selectJoinToken = (s) => s.consultation.joinToken;
export const selectConsultationList = (s) => s.consultation.list;
export const selectConsultationTotal = (s) => s.consultation.total;
export const selectConsultationPage = (s) => s.consultation.page;
export const selectConsultationPages = (s) => s.consultation.pages;
export const selectConsultationStats = (s) => s.consultation.stats;
export const selectConsultationError = (s) => s.consultation.error;
export const selectAttachments = (s) => s.consultation.attachments;
export const selectPrescriptions = (s) => s.consultation.prescriptions;
export const selectConsents = (s) => s.consultation.consents;
export const selectWaitingQueue = (s) => s.consultation.waitingQueue;
export const selectParticipants = (s) => s.consultation.participants;
export const selectAnalytics = (s) => s.consultation.analytics;
export const selectEventLogs = (s) => s.consultation.eventLogs;
export const selectVerifiedRx = (s) => s.consultation.verifiedRx;
export const selectBulkResult = (s) => s.consultation.bulkResult;
export const selectConsultationLoading = (s) => s.consultation.loading;

export const selectRt = (s) => s.consultation.rt;
export const selectRtStatus = (s) => s.consultation.rt.status;
export const selectRtParticipants = (s) => s.consultation.rt.participants;
export const selectRtWaitingQueue = (s) => s.consultation.rt.waitingQueue;
export const selectRtTypingUsers = (s) => s.consultation.rt.typingUsers;
export const selectRtRaisedHands = (s) => s.consultation.rt.raisedHands;
export const selectRtScreenSharing = (s) => s.consultation.rt.screenSharing;
export const selectRtNetworkQuality = (s) => s.consultation.rt.networkQuality;
export const selectRtIsKicked = (s) => s.consultation.rt.kicked;
export const selectRtIsMuted = (s) => s.consultation.rt.muted;
export const selectRtOnlineDoctors = (s) => s.consultation.rt.onlineDoctors;
export const selectRtAdminBroadcasts = (s) => s.consultation.rt.adminBroadcasts;
export const selectRtParticipantCount = (s) =>
  s.consultation.rt.participantCount;
export const selectRtConsentAccepted = (s) =>
  s.consultation.rt.telemedicineConsentAccepted;
export const selectRtConnected = (s) => s.consultation.rt.connected;
