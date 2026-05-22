import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS  — mirror consultationRoutes.js exactly
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. POST /consultations ────────────────────────────────────────────────────
export const createConsultation = createAsyncThunk(
  'consultation/create',
  async (body, { rejectWithValue }) => {
    try {
      const res = await API.post('/consultations', body);
      toast.success('Consultation created');
      return res.data.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create consultation';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 2. POST /consultations/:consultationId/join ───────────────────────────────
// Returns: { roomId, meetingId, meetingLink, token, participantRole, isHost,
//            permissions, rtcConfig, waitingRoomStatus, estimatedDurationMinutes }
export const joinConsultation = createAsyncThunk(
  'consultation/join',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.post(`/consultations/${consultationId}/join`);
      return res.data.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to join consultation';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 3. GET /consultations/:consultationId ─────────────────────────────────────
export const fetchConsultationById = createAsyncThunk(
  'consultation/fetchById',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}`);
      return res.data.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch consultation';
      return rejectWithValue(msg);
    }
  }
);

// ── 4. GET /consultations/:consultationId/details ─────────────────────────────
export const fetchConsultationDetails = createAsyncThunk(
  'consultation/fetchDetails',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}/details`);
      return res.data.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch details';
      return rejectWithValue(msg);
    }
  }
);

// ── 5. GET /consultations/:consultationId/participants ────────────────────────
export const fetchParticipants = createAsyncThunk(
  'consultation/fetchParticipants',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}/participants`);
      return res.data.data.participants;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 6. GET /consultations/:consultationId/events ──────────────────────────────
export const fetchEvents = createAsyncThunk(
  'consultation/fetchEvents',
  async ({ consultationId, page = 1, limit = 50, eventType }, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}/events`, {
        params: { page, limit, eventType },
      });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 7. GET /consultations/:consultationId/analytics ───────────────────────────
export const fetchAnalytics = createAsyncThunk(
  'consultation/fetchAnalytics',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}/analytics`);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 8a. GET /consultations/:consultationId/waiting-room ───────────────────────
export const fetchWaitingRoom = createAsyncThunk(
  'consultation/fetchWaitingRoom',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}/waiting-room`);
      return res.data.data; // { waitingRoomQueue, count }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 8b. POST /consultations/:consultationId/waiting-room/admit ────────────────
export const admitPatient = createAsyncThunk(
  'consultation/admitPatient',
  async ({ consultationId, patientUserId }, { rejectWithValue }) => {
    try {
      const res = await API.post(`/consultations/${consultationId}/waiting-room/admit`, { patientUserId });
      toast.success('Patient admitted');
      return { patientUserId, ...res.data };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to admit patient';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 8c. POST /consultations/:consultationId/waiting-room/reject ───────────────
export const rejectPatient = createAsyncThunk(
  'consultation/rejectPatient',
  async ({ consultationId, patientUserId, reason }, { rejectWithValue }) => {
    try {
      const res = await API.post(`/consultations/${consultationId}/waiting-room/reject`, { patientUserId, reason });
      toast.success('Patient rejected');
      return { patientUserId, ...res.data };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reject patient';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 9a. POST /consultations/:consultationId/chat ──────────────────────────────
export const sendChatMessage = createAsyncThunk(
  'consultation/sendChat',
  async ({ consultationId, message, messageType = 'text' }, { rejectWithValue }) => {
    try {
      const res = await API.post(`/consultations/${consultationId}/chat`, { message, messageType });
      return res.data.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send message';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 9b. GET /consultations/:consultationId/chat/messages ──────────────────────
export const fetchChatMessages = createAsyncThunk(
  'consultation/fetchChat',
  async ({ consultationId, page = 1, limit = 50 }, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}/chat/messages`, {
        params: { page, limit },
      });
      return res.data.data; // { messages, pagination }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 9c. PATCH /consultations/:consultationId/chat/messages/:messageId/read ────
export const markMessageRead = createAsyncThunk(
  'consultation/markRead',
  async ({ consultationId, messageId }, { rejectWithValue }) => {
    try {
      await API.patch(`/consultations/${consultationId}/chat/messages/${messageId}/read`);
      return messageId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 10a. PATCH /consultations/:consultationId/participants/:participantId/mute ─
export const muteParticipant = createAsyncThunk(
  'consultation/muteParticipant',
  async ({ consultationId, participantId }, { rejectWithValue }) => {
    try {
      const res = await API.patch(`/consultations/${consultationId}/participants/${participantId}/mute`);
      toast.success('Participant muted');
      return { participantId, ...res.data };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to mute';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 10b. PATCH /consultations/:consultationId/participants/:participantId/remove
export const removeParticipant = createAsyncThunk(
  'consultation/removeParticipant',
  async ({ consultationId, participantId, reason }, { rejectWithValue }) => {
    try {
      const res = await API.patch(
        `/consultations/${consultationId}/participants/${participantId}/remove`,
        { reason }
      );
      toast.success('Participant removed');
      return { participantId, ...res.data };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to remove';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 11a. PATCH /consultations/:consultationId/start ──────────────────────────
export const startConsultation = createAsyncThunk(
  'consultation/start',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.patch(`/consultations/${consultationId}/start`);
      toast.success('Consultation started');
      return res.data.data; // { status }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to start';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 11b. PATCH /consultations/:consultationId/pause ──────────────────────────
export const pauseConsultation = createAsyncThunk(
  'consultation/pause',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.patch(`/consultations/${consultationId}/pause`);
      toast.success('Consultation paused');
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to pause';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 11c. PATCH /consultations/:consultationId/resume ─────────────────────────
export const resumeConsultation = createAsyncThunk(
  'consultation/resume',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.patch(`/consultations/${consultationId}/resume`);
      toast.success('Consultation resumed');
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to resume';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 11d. PATCH /consultations/:consultationId/end ────────────────────────────
export const endConsultation = createAsyncThunk(
  'consultation/end',
  async ({ consultationId, reason, summary, followUpAdvice }, { rejectWithValue }) => {
    try {
      const res = await API.patch(`/consultations/${consultationId}/end`, {
        reason, summary, followUpAdvice,
      });
      toast.success('Consultation ended');
      return res.data.data; // { status, completedAt, durationMinutes }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to end';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 11e. PATCH /consultations/:consultationId/cancel ─────────────────────────
export const cancelConsultation = createAsyncThunk(
  'consultation/cancel',
  async ({ consultationId, reason }, { rejectWithValue }) => {
    try {
      const res = await API.patch(`/consultations/${consultationId}/cancel`, { reason });
      toast.success('Consultation cancelled');
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to cancel';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 12a. PATCH /consultations/:consultationId/recording/start ────────────────
export const startRecording = createAsyncThunk(
  'consultation/startRecording',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.patch(`/consultations/${consultationId}/recording/start`);
      toast.success('Recording started');
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to start recording';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 12b. PATCH /consultations/:consultationId/recording/stop ─────────────────
export const stopRecording = createAsyncThunk(
  'consultation/stopRecording',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.patch(`/consultations/${consultationId}/recording/stop`);
      toast.success('Recording stopped');
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to stop recording';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 12c. GET /consultations/:consultationId/recordings ───────────────────────
export const fetchRecordings = createAsyncThunk(
  'consultation/fetchRecordings',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}/recordings`);
      return res.data.data.recording;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 13a. POST /consultations/:consultationId/prescriptions ────────────────────
export const issuePrescription = createAsyncThunk(
  'consultation/issuePrescription',
  async ({ consultationId, ...body }, { rejectWithValue }) => {
    try {
      const res = await API.post(`/consultations/${consultationId}/prescriptions`, body);
      toast.success('Prescription issued');
      return res.data.data; // { rxNumber, ePrescriptionId }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to issue prescription';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 13b. GET /consultations/:consultationId/prescriptions ─────────────────────
export const fetchPrescriptions = createAsyncThunk(
  'consultation/fetchPrescriptions',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}/prescriptions`);
      return res.data.data.prescriptions;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 14a. POST /consultations/:consultationId/consents ────────────────────────
export const submitConsent = createAsyncThunk(
  'consultation/submitConsent',
  async ({ consultationId, consentType = 'telemedicine', accepted = true, ipAddress }, { rejectWithValue }) => {
    try {
      const res = await API.post(`/consultations/${consultationId}/consents`, {
        consentType, accepted, ipAddress,
      });
      toast.success(`${consentType} consent recorded`);
      return { consentType, ...res.data };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit consent';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 14b. GET /consultations/:consultationId/consents ─────────────────────────
export const fetchConsents = createAsyncThunk(
  'consultation/fetchConsents',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}/consents`);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 15a. POST /consultations/:consultationId/attachments ──────────────────────
export const uploadAttachment = createAsyncThunk(
  'consultation/uploadAttachment',
  async ({ consultationId, ...body }, { rejectWithValue }) => {
    try {
      const res = await API.post(`/consultations/${consultationId}/attachments`, body);
      toast.success('File uploaded');
      return res.data.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 15b. GET /consultations/:consultationId/attachments ───────────────────────
export const fetchAttachments = createAsyncThunk(
  'consultation/fetchAttachments',
  async (consultationId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/consultations/${consultationId}/attachments`);
      return res.data.data.attachments;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 15c. DELETE /consultations/:consultationId/attachments/:attachmentId ───────
export const deleteAttachment = createAsyncThunk(
  'consultation/deleteAttachment',
  async ({ consultationId, attachmentId }, { rejectWithValue }) => {
    try {
      await API.delete(`/consultations/${consultationId}/attachments/${attachmentId}`);
      toast.success('Attachment deleted');
      return attachmentId;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── 16. GET /consultations/admin/analytics/overview ──────────────────────────
export const fetchAdminAnalytics = createAsyncThunk(
  'consultation/fetchAdminAnalytics',
  async ({ from, to } = {}, { rejectWithValue }) => {
    try {
      const res = await API.get('/consultations/admin/analytics/overview', {
        params: { from, to },
      });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── 17. GET /consultations ────────────────────────────────────────────────────
export const fetchConsultations = createAsyncThunk(
  'consultation/fetchList',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await API.get('/consultations', { params });
      return res.data.data; // { consultations, pagination }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch consultations';
      return rejectWithValue(msg);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // List
  list:        [],
  pagination:  { total: 0, page: 1, limit: 20, totalPages: 0 },

  // Current consultation (GET /:id or /:id/details)
  current:     null,

  // Join session data (token, roomId, permissions, etc.)
  joinDetails: null,

  // Participants
  participants: [],

  // Waiting room
  waitingRoom:  { queue: [], count: 0 },

  // Chat
  chatMessages: [],
  chatPagination: { total: 0, page: 1, limit: 50, totalPages: 0 },

  // Events log
  events:      [],
  eventsPagination: { total: 0, page: 1, limit: 50, totalPages: 0 },

  // Analytics
  analytics:      null,
  adminAnalytics: null,

  // Recording
  recording:      null,

  // Prescriptions
  prescriptions:  [],

  // Consents
  consents:       null,

  // Attachments
  attachments:    [],

  // ── Loading flags ───────────────────────────────────────────────────────────
  loading: {
    list:           false,
    current:        false,
    join:           false,
    participants:   false,
    waitingRoom:    false,
    chat:           false,
    events:         false,
    analytics:      false,
    adminAnalytics: false,
    recording:      false,
    prescriptions:  false,
    consents:       false,
    attachments:    false,
    action:         false,   // start/pause/resume/end/cancel/admit/reject/mute/remove
    recording_action: false, // startRecording/stopRecording
    chat_send:      false,
    prescription_issue: false,
    consent_submit: false,
    attachment_upload: false,
  },

  // ── Error flags ─────────────────────────────────────────────────────────────
  errors: {
    list:           null,
    current:        null,
    join:           null,
    participants:   null,
    waitingRoom:    null,
    chat:           null,
    events:         null,
    analytics:      null,
    adminAnalytics: null,
    recording:      null,
    prescriptions:  null,
    consents:       null,
    attachments:    null,
    action:         null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** pending matchers for "action" group */
const ACTION_PENDING = [
  startConsultation.pending.type,
  pauseConsultation.pending.type,
  resumeConsultation.pending.type,
  endConsultation.pending.type,
  cancelConsultation.pending.type,
  admitPatient.pending.type,
  rejectPatient.pending.type,
  muteParticipant.pending.type,
  removeParticipant.pending.type,
];

const ACTION_REJECTED = [
  startConsultation.rejected.type,
  pauseConsultation.rejected.type,
  resumeConsultation.rejected.type,
  endConsultation.rejected.type,
  cancelConsultation.rejected.type,
  admitPatient.rejected.type,
  rejectPatient.rejected.type,
  muteParticipant.rejected.type,
  removeParticipant.rejected.type,
];

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const consultationSlice = createSlice({
  name: 'consultation',
  initialState,

  reducers: {
    // ── Socket-driven real-time patches ───────────────────────────────────────

    /** Patch consultation status from socket event */
    setConsultationStatus(state, { payload: status }) {
      if (state.current) state.current.status = status;
    },

    /** Upsert participant from socket event */
    upsertParticipant(state, { payload }) {
      const idx = state.participants.findIndex(p => p.userId === payload.userId);
      if (idx === -1) state.participants.push(payload);
      else state.participants[idx] = { ...state.participants[idx], ...payload };
    },

    /** Mark participant disconnected */
    markParticipantLeft(state, { payload: userId }) {
      const p = state.participants.find(p => p.userId === userId);
      if (p) p.connectionStatus = 'disconnected';
    },

    /** Push incoming socket chat message */
    pushChatMessage(state, { payload }) {
      const exists = state.chatMessages.find(m => m._id === payload.messageId);
      if (!exists) state.chatMessages.push(payload);
    },

    /** Add patient to waiting room queue */
    addToWaitingQueue(state, { payload }) {
      const exists = state.waitingRoom.queue.find(w => w.userId === payload.patientUserId);
      if (!exists) {
        state.waitingRoom.queue.push({
          userId:      payload.patientUserId,
          displayName: payload.patientName,
          enteredAt:   payload.timestamp,
          waitingRoomStatus: 'waiting',
        });
        state.waitingRoom.count += 1;
      }
    },

    /** Remove from waiting room queue (admitted or rejected) */
    removeFromWaitingQueue(state, { payload: patientUserId }) {
      state.waitingRoom.queue    = state.waitingRoom.queue.filter(w => w.userId !== patientUserId);
      state.waitingRoom.count    = state.waitingRoom.queue.length;
    },

    /** Set join details directly (e.g. from socket state snapshot) */
    setJoinDetails(state, { payload }) {
      state.joinDetails = payload;
    },

    // ── Cleanup ───────────────────────────────────────────────────────────────

    clearCurrentConsultation(state) {
      state.current       = null;
      state.joinDetails   = null;
      state.participants  = [];
      state.chatMessages  = [];
      state.waitingRoom   = { queue: [], count: 0 };
      state.analytics     = null;
      state.recording     = null;
      state.prescriptions = [];
      state.consents      = null;
      state.attachments   = [];
      state.events        = [];
      state.errors        = { ...initialState.errors };
    },

    clearJoinDetails(state) {
      state.joinDetails      = null;
      state.errors.join      = null;
      state.loading.join     = false;
    },

    clearErrors(state) {
      state.errors = { ...initialState.errors };
    },

    resetConsultationState: () => initialState,
  },

  extraReducers: (builder) => {
    builder

      // ── 1. Create ─────────────────────────────────────────────────────────
      .addCase(createConsultation.pending, (state) => {
        state.loading.action = true;
        state.errors.action  = null;
      })
      .addCase(createConsultation.fulfilled, (state, { payload }) => {
        state.loading.action = false;
        // Prepend to list if present
        state.list.unshift(payload);
      })
      .addCase(createConsultation.rejected, (state, { payload }) => {
        state.loading.action = false;
        state.errors.action  = payload;
      })

      // ── 2. Join ───────────────────────────────────────────────────────────
      .addCase(joinConsultation.pending, (state) => {
        state.loading.join = true;
        state.errors.join  = null;
        state.joinDetails  = null;
      })
      .addCase(joinConsultation.fulfilled, (state, { payload }) => {
        state.loading.join = false;
        state.joinDetails  = payload;
      })
      .addCase(joinConsultation.rejected, (state, { payload }) => {
        state.loading.join = false;
        state.errors.join  = payload;
      })

      // ── 3. Fetch by ID ────────────────────────────────────────────────────
      .addCase(fetchConsultationById.pending, (state) => {
        state.loading.current = true;
        state.errors.current  = null;
      })
      .addCase(fetchConsultationById.fulfilled, (state, { payload }) => {
        state.loading.current = false;
        state.current         = payload;
      })
      .addCase(fetchConsultationById.rejected, (state, { payload }) => {
        state.loading.current = false;
        state.errors.current  = payload;
      })

      // ── 4. Fetch details (populated) ──────────────────────────────────────
      .addCase(fetchConsultationDetails.pending, (state) => {
        state.loading.current = true;
        state.errors.current  = null;
      })
      .addCase(fetchConsultationDetails.fulfilled, (state, { payload }) => {
        state.loading.current = false;
        state.current         = payload;
      })
      .addCase(fetchConsultationDetails.rejected, (state, { payload }) => {
        state.loading.current = false;
        state.errors.current  = payload;
      })

      // ── 5. Participants ───────────────────────────────────────────────────
      .addCase(fetchParticipants.pending, (state) => {
        state.loading.participants = true;
      })
      .addCase(fetchParticipants.fulfilled, (state, { payload }) => {
        state.loading.participants = false;
        state.participants         = payload ?? [];
      })
      .addCase(fetchParticipants.rejected, (state, { payload }) => {
        state.loading.participants  = false;
        state.errors.participants   = payload;
      })

      // ── 6. Events ─────────────────────────────────────────────────────────
      .addCase(fetchEvents.pending, (state) => {
        state.loading.events = true;
      })
      .addCase(fetchEvents.fulfilled, (state, { payload }) => {
        state.loading.events    = false;
        state.events            = payload.events;
        state.eventsPagination  = payload.pagination;
      })
      .addCase(fetchEvents.rejected, (state, { payload }) => {
        state.loading.events  = false;
        state.errors.events   = payload;
      })

      // ── 7. Analytics ──────────────────────────────────────────────────────
      .addCase(fetchAnalytics.pending, (state) => {
        state.loading.analytics = true;
      })
      .addCase(fetchAnalytics.fulfilled, (state, { payload }) => {
        state.loading.analytics = false;
        state.analytics         = payload;
      })
      .addCase(fetchAnalytics.rejected, (state, { payload }) => {
        state.loading.analytics = false;
        state.errors.analytics  = payload;
      })

      // ── 8a. Waiting room fetch ─────────────────────────────────────────────
      .addCase(fetchWaitingRoom.pending, (state) => {
        state.loading.waitingRoom = true;
      })
      .addCase(fetchWaitingRoom.fulfilled, (state, { payload }) => {
        state.loading.waitingRoom = false;
        state.waitingRoom.queue   = payload.waitingRoomQueue ?? [];
        state.waitingRoom.count   = payload.count ?? 0;
      })
      .addCase(fetchWaitingRoom.rejected, (state, { payload }) => {
        state.loading.waitingRoom = false;
        state.errors.waitingRoom  = payload;
      })

      // ── 8b. Admit patient ─────────────────────────────────────────────────
      .addCase(admitPatient.fulfilled, (state, { payload }) => {
        state.loading.action      = false;
        state.waitingRoom.queue   = state.waitingRoom.queue.filter(
          w => w.userId !== payload.patientUserId
        );
        state.waitingRoom.count   = state.waitingRoom.queue.length;
      })

      // ── 8c. Reject patient ────────────────────────────────────────────────
      .addCase(rejectPatient.fulfilled, (state, { payload }) => {
        state.loading.action    = false;
        state.waitingRoom.queue = state.waitingRoom.queue.filter(
          w => w.userId !== payload.patientUserId
        );
        state.waitingRoom.count = state.waitingRoom.queue.length;
      })

      // ── 9a. Send chat ─────────────────────────────────────────────────────
      .addCase(sendChatMessage.pending, (state) => {
        state.loading.chat_send = true;
      })
      .addCase(sendChatMessage.fulfilled, (state, { payload }) => {
        state.loading.chat_send = false;
        state.chatMessages.push(payload);
      })
      .addCase(sendChatMessage.rejected, (state, { payload }) => {
        state.loading.chat_send = false;
        state.errors.chat       = payload;
      })

      // ── 9b. Fetch chat ────────────────────────────────────────────────────
      .addCase(fetchChatMessages.pending, (state) => {
        state.loading.chat = true;
      })
      .addCase(fetchChatMessages.fulfilled, (state, { payload }) => {
        state.loading.chat    = false;
        state.chatMessages    = payload.messages;
        state.chatPagination  = payload.pagination;
      })
      .addCase(fetchChatMessages.rejected, (state, { payload }) => {
        state.loading.chat  = false;
        state.errors.chat   = payload;
      })

      // ── 9c. Mark read ─────────────────────────────────────────────────────
      .addCase(markMessageRead.fulfilled, (state, { payload: messageId }) => {
        const msg = state.chatMessages.find(m => m._id === messageId);
        if (msg) msg.readAt = new Date().toISOString();
      })

      // ── 10a. Mute participant ──────────────────────────────────────────────
      .addCase(muteParticipant.fulfilled, (state, { payload }) => {
        state.loading.action = false;
        const p = state.participants.find(p => p._id === payload.participantId);
        if (p) { p.isMutedByHost = true; p.microphoneEnabled = false; }
      })

      // ── 10b. Remove participant ────────────────────────────────────────────
      .addCase(removeParticipant.fulfilled, (state, { payload }) => {
        state.loading.action = false;
        state.participants   = state.participants.filter(p => p._id !== payload.participantId);
      })

      // ── 11a. Start ────────────────────────────────────────────────────────
      .addCase(startConsultation.fulfilled, (state, { payload }) => {
        state.loading.action = false;
        if (state.current)   state.current.status = payload?.status ?? 'active';
      })

      // ── 11b. Pause ────────────────────────────────────────────────────────
      .addCase(pauseConsultation.fulfilled, (state) => {
        state.loading.action = false;
        if (state.current)   state.current.status = 'paused';
      })

      // ── 11c. Resume ───────────────────────────────────────────────────────
      .addCase(resumeConsultation.fulfilled, (state) => {
        state.loading.action = false;
        if (state.current)   state.current.status = 'active';
      })

      // ── 11d. End ──────────────────────────────────────────────────────────
      .addCase(endConsultation.fulfilled, (state, { payload }) => {
        state.loading.action = false;
        if (state.current) {
          state.current.status             = payload?.status ?? 'completed';
          state.current.actualEndTime      = payload?.completedAt ?? new Date().toISOString();
          state.current.actualDurationMinutes = payload?.durationMinutes ?? 0;
        }
        // Sync in list
        const idx = state.list.findIndex(c => c.consultationId === state.current?.consultationId);
        if (idx !== -1) state.list[idx].status = 'completed';
      })

      // ── 11e. Cancel ───────────────────────────────────────────────────────
      .addCase(cancelConsultation.fulfilled, (state) => {
        state.loading.action = false;
        if (state.current)   state.current.status = 'cancelled';
        const idx = state.list.findIndex(c => c.consultationId === state.current?.consultationId);
        if (idx !== -1) state.list[idx].status = 'cancelled';
      })

      // ── 12a. Start recording ──────────────────────────────────────────────
      .addCase(startRecording.pending, (state) => {
        state.loading.recording_action = true;
      })
      .addCase(startRecording.fulfilled, (state) => {
        state.loading.recording_action = false;
        if (state.current?.recording) state.current.recording.recordingStatus = 'recording';
        if (state.recording)          state.recording.recordingStatus = 'recording';
      })
      .addCase(startRecording.rejected, (state, { payload }) => {
        state.loading.recording_action = false;
        state.errors.recording         = payload;
      })

      // ── 12b. Stop recording ───────────────────────────────────────────────
      .addCase(stopRecording.pending, (state) => {
        state.loading.recording_action = true;
      })
      .addCase(stopRecording.fulfilled, (state) => {
        state.loading.recording_action = false;
        if (state.current?.recording) state.current.recording.recordingStatus = 'processing';
        if (state.recording)          state.recording.recordingStatus = 'processing';
      })
      .addCase(stopRecording.rejected, (state, { payload }) => {
        state.loading.recording_action = false;
        state.errors.recording         = payload;
      })

      // ── 12c. Fetch recordings ─────────────────────────────────────────────
      .addCase(fetchRecordings.pending, (state) => {
        state.loading.recording = true;
      })
      .addCase(fetchRecordings.fulfilled, (state, { payload }) => {
        state.loading.recording = false;
        state.recording         = payload;
      })
      .addCase(fetchRecordings.rejected, (state, { payload }) => {
        state.loading.recording = false;
        state.errors.recording  = payload;
      })

      // ── 13a. Issue prescription ───────────────────────────────────────────
      .addCase(issuePrescription.pending, (state) => {
        state.loading.prescription_issue = true;
      })
      .addCase(issuePrescription.fulfilled, (state, { payload }) => {
        state.loading.prescription_issue = false;
        if (state.current) {
          state.current.prescriptionUploaded   = true;
          state.current.prescriptionUploadedAt = new Date().toISOString();
        }
        // payload = { rxNumber, ePrescriptionId }
        state.prescriptions.push(payload);
      })
      .addCase(issuePrescription.rejected, (state, { payload }) => {
        state.loading.prescription_issue = false;
        state.errors.prescriptions       = payload;
      })

      // ── 13b. Fetch prescriptions ──────────────────────────────────────────
      .addCase(fetchPrescriptions.pending, (state) => {
        state.loading.prescriptions = true;
      })
      .addCase(fetchPrescriptions.fulfilled, (state, { payload }) => {
        state.loading.prescriptions = false;
        state.prescriptions         = payload ?? [];
      })
      .addCase(fetchPrescriptions.rejected, (state, { payload }) => {
        state.loading.prescriptions = false;
        state.errors.prescriptions  = payload;
      })

      // ── 14a. Submit consent ───────────────────────────────────────────────
      .addCase(submitConsent.pending, (state) => {
        state.loading.consent_submit = true;
      })
      .addCase(submitConsent.fulfilled, (state, { payload }) => {
        state.loading.consent_submit = false;
        if (payload.consentType === 'telemedicine' && state.current) {
          state.current.telemedicineConsentAccepted = true;
        }
        if (payload.consentType === 'recording' && state.current) {
          state.current.recordingConsentAccepted = true;
        }
      })
      .addCase(submitConsent.rejected, (state, { payload }) => {
        state.loading.consent_submit = false;
        state.errors.consents        = payload;
      })

      // ── 14b. Fetch consents ───────────────────────────────────────────────
      .addCase(fetchConsents.pending, (state) => {
        state.loading.consents = true;
      })
      .addCase(fetchConsents.fulfilled, (state, { payload }) => {
        state.loading.consents = false;
        state.consents         = payload;
        if (state.current) {
          state.current.telemedicineConsentAccepted = payload.telemedicineConsentAccepted;
          state.current.recordingConsentAccepted    = payload.recordingConsentAccepted;
        }
      })
      .addCase(fetchConsents.rejected, (state, { payload }) => {
        state.loading.consents = false;
        state.errors.consents  = payload;
      })

      // ── 15a. Upload attachment ────────────────────────────────────────────
      .addCase(uploadAttachment.pending, (state) => {
        state.loading.attachment_upload = true;
      })
      .addCase(uploadAttachment.fulfilled, (state, { payload }) => {
        state.loading.attachment_upload = false;
        state.attachments.push(payload);
      })
      .addCase(uploadAttachment.rejected, (state, { payload }) => {
        state.loading.attachment_upload = false;
        state.errors.attachments        = payload;
      })

      // ── 15b. Fetch attachments ────────────────────────────────────────────
      .addCase(fetchAttachments.pending, (state) => {
        state.loading.attachments = true;
      })
      .addCase(fetchAttachments.fulfilled, (state, { payload }) => {
        state.loading.attachments = false;
        state.attachments         = payload ?? [];
      })
      .addCase(fetchAttachments.rejected, (state, { payload }) => {
        state.loading.attachments = false;
        state.errors.attachments  = payload;
      })

      // ── 15c. Delete attachment ────────────────────────────────────────────
      .addCase(deleteAttachment.fulfilled, (state, { payload: attachmentId }) => {
        state.attachments = state.attachments.filter(a => a._id !== attachmentId);
      })

      // ── 16. Admin analytics ───────────────────────────────────────────────
      .addCase(fetchAdminAnalytics.pending, (state) => {
        state.loading.adminAnalytics = true;
      })
      .addCase(fetchAdminAnalytics.fulfilled, (state, { payload }) => {
        state.loading.adminAnalytics = false;
        state.adminAnalytics         = payload;
      })
      .addCase(fetchAdminAnalytics.rejected, (state, { payload }) => {
        state.loading.adminAnalytics = false;
        state.errors.adminAnalytics  = payload;
      })

      // ── 17. List ──────────────────────────────────────────────────────────
      .addCase(fetchConsultations.pending, (state) => {
        state.loading.list = true;
        state.errors.list  = null;
      })
      .addCase(fetchConsultations.fulfilled, (state, { payload }) => {
        state.loading.list = false;
        state.list         = payload.consultations;
        state.pagination   = payload.pagination;
      })
      .addCase(fetchConsultations.rejected, (state, { payload }) => {
        state.loading.list = false;
        state.errors.list  = payload;
      })

      // ── Matchers — action group pending/rejected ───────────────────────────
      .addMatcher(
        (action) => ACTION_PENDING.includes(action.type),
        (state) => {
          state.loading.action = true;
          state.errors.action  = null;
        }
      )
      .addMatcher(
        (action) => ACTION_REJECTED.includes(action.type),
        (state, action) => {
          state.loading.action = false;
          state.errors.action  = action.payload;
        }
      );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  setConsultationStatus,
  upsertParticipant,
  markParticipantLeft,
  pushChatMessage,
  addToWaitingQueue,
  removeFromWaitingQueue,
  setJoinDetails,
  clearCurrentConsultation,
  clearJoinDetails,
  clearErrors,
  resetConsultationState,
} = consultationSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

const s = (state) => state.consultation;

export const selectConsultationList       = (state) => s(state).list;
export const selectConsultationPagination = (state) => s(state).pagination;
export const selectCurrentConsultation    = (state) => s(state).current;
export const selectJoinDetails            = (state) => s(state).joinDetails;
export const selectParticipants           = (state) => s(state).participants;
export const selectWaitingRoom            = (state) => s(state).waitingRoom;
export const selectChatMessages           = (state) => s(state).chatMessages;
export const selectChatPagination         = (state) => s(state).chatPagination;
export const selectEvents                 = (state) => s(state).events;
export const selectEventsPagination       = (state) => s(state).eventsPagination;
export const selectAnalytics              = (state) => s(state).analytics;
export const selectAdminAnalytics         = (state) => s(state).adminAnalytics;
export const selectRecording              = (state) => s(state).recording;
export const selectPrescriptions          = (state) => s(state).prescriptions;
export const selectConsents               = (state) => s(state).consents;
export const selectAttachments            = (state) => s(state).attachments;

export const selectConsultationLoading = (state) => s(state).loading;
export const selectConsultationErrors  = (state) => s(state).errors;

// Granular
export const selectIsJoinLoading          = (state) => s(state).loading.join;
export const selectJoinError              = (state) => s(state).errors.join;
export const selectIsActionLoading        = (state) => s(state).loading.action;
export const selectActionError            = (state) => s(state).errors.action;
export const selectIsListLoading          = (state) => s(state).loading.list;
export const selectIsCurrentLoading       = (state) => s(state).loading.current;
export const selectIsRecordingActionLoading = (state) => s(state).loading.recording_action;

// Derived
export const selectTelemedicineConsented  = (state) => s(state).current?.telemedicineConsentAccepted ?? false;
export const selectRecordingConsented     = (state) => s(state).current?.recordingConsentAccepted ?? false;
export const selectWaitingQueueCount      = (state) => s(state).waitingRoom.count;
export const selectIsRecording            = (state) =>
  s(state).recording?.recordingStatus === 'recording' ||
  s(state).current?.recording?.recordingStatus === 'recording';

export default consultationSlice.reducer;