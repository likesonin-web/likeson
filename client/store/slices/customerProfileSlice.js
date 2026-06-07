import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════════════════════
// ASYNC THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

// ── 1. GET /me ─────────────────────────────────────────────────────────────────
export const fetchMyProfile = createAsyncThunk(
  'customerProfile/fetchMyProfile',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/customer/me');
      return data.data; // { user, profile }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch profile');
    }
  },
);

// ── 2. PUT /me ─────────────────────────────────────────────────────────────────
export const updateMyUser = createAsyncThunk(
  'customerProfile/updateMyUser',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/customer/me', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update user');
    }
  },
);

// ── 3. PUT /me/profile ─────────────────────────────────────────────────────────
export const updateMyCustomerProfile = createAsyncThunk(
  'customerProfile/updateMyCustomerProfile',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/customer/me/profile', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update profile');
    }
  },
);

// ── 4. POST /me/kyc ────────────────────────────────────────────────────────────
export const uploadKyc = createAsyncThunk(
  'customerProfile/uploadKyc',
  async (formData, { rejectWithValue }) => {
    // formData: FormData with fields: type, documentNumber, holderName, documentFile?, backSideFile?
    try {
      const { data } = await API.post('/customer/me/kyc', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data; // updated kyc array
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'KYC upload failed');
    }
  },
);

// ── 5a. POST /me/government-schemes ───────────────────────────────────────────
export const addGovernmentScheme = createAsyncThunk(
  'customerProfile/addGovernmentScheme',
  async (formData, { rejectWithValue }) => {
    // formData: FormData with fields: schemeName, beneficiaryId, holderName, documentFile?
    try {
      const { data } = await API.post('/customer/me/government-schemes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data; // updated governmentSchemes array
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add scheme');
    }
  },
);

// ── 5b. DELETE /me/government-schemes/:schemeId ────────────────────────────────
export const deleteGovernmentScheme = createAsyncThunk(
  'customerProfile/deleteGovernmentScheme',
  async (schemeId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/government-schemes/${schemeId}`);
      return data.data; // updated governmentSchemes array
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete scheme');
    }
  },
);

// ── 6a. POST /me/medical-timeline ─────────────────────────────────────────────
export const addMedicalEvent = createAsyncThunk(
  'customerProfile/addMedicalEvent',
  async (formData, { rejectWithValue }) => {
    // formData: FormData with fields: eventTitle, hospitalName, description, doctorName, date, reportFiles[]
    try {
      const { data } = await API.post('/customer/me/medical-timeline', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data; // updated medicalTimeline array
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add medical event');
    }
  },
);

// ── 6b. PUT /me/medical-timeline/:eventId ─────────────────────────────────────
export const updateMedicalEvent = createAsyncThunk(
  'customerProfile/updateMedicalEvent',
  async ({ eventId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/customer/me/medical-timeline/${eventId}`, payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update medical event');
    }
  },
);

// ── 6c. DELETE /me/medical-timeline/:eventId ──────────────────────────────────
export const deleteMedicalEvent = createAsyncThunk(
  'customerProfile/deleteMedicalEvent',
  async (eventId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/medical-timeline/${eventId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete medical event');
    }
  },
);

// ── 7a. POST /me/medicine-history ─────────────────────────────────────────────
export const addMedicine = createAsyncThunk(
  'customerProfile/addMedicine',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/customer/me/medicine-history', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add medicine');
    }
  },
);

// ── 7b. PUT /me/medicine-history/:medId ───────────────────────────────────────
export const updateMedicine = createAsyncThunk(
  'customerProfile/updateMedicine',
  async ({ medId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/customer/me/medicine-history/${medId}`, payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update medicine');
    }
  },
);

// ── 7c. DELETE /me/medicine-history/:medId ────────────────────────────────────
export const deleteMedicine = createAsyncThunk(
  'customerProfile/deleteMedicine',
  async (medId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/medicine-history/${medId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete medicine');
    }
  },
);

// ── 8. GET /me/audit-sessions ─────────────────────────────────────────────────
export const fetchAuditSessions = createAsyncThunk(
  'customerProfile/fetchAuditSessions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/customer/me/audit-sessions');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch sessions');
    }
  },
);

// ── 9a. DELETE /me/audit-sessions/:sessionId ──────────────────────────────────
export const deleteAuditSession = createAsyncThunk(
  'customerProfile/deleteAuditSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/audit-sessions/${sessionId}`);
      return data.data; // updated auditSessions array
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove session');
    }
  },
);

// ── 9b. DELETE /me/audit-sessions (all) ───────────────────────────────────────
export const deleteAllAuditSessions = createAsyncThunk(
  'customerProfile/deleteAllAuditSessions',
  async (_, { rejectWithValue }) => {
    try {
      await API.delete('/customer/me/audit-sessions');
      return [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to clear all sessions');
    }
  },
);

// ── 10. DELETE /me/device-tokens/:tokenId ─────────────────────────────────────
export const deleteDeviceToken = createAsyncThunk(
  'customerProfile/deleteDeviceToken',
  async (tokenId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/device-tokens/${tokenId}`);
      return data.data; // updated deviceTokens array
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove device token');
    }
  },
);

// ── 11. POST /me/request-unblock ──────────────────────────────────────────────
export const requestUnblock = createAsyncThunk(
  'customerProfile/requestUnblock',
  async (reason, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/customer/me/request-unblock', { reason });
      return data.message;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to submit unblock request');
    }
  },
);

// ── 12. GET /me/notifications ─────────────────────────────────────────────────
export const fetchNotifications = createAsyncThunk(
  'customerProfile/fetchNotifications',
  async ({ page = 1, limit = 20, unread } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (unread) params.set('unread', 'true');
      const { data } = await API.get(`/customer/me/notifications?${params}`);
      return data; // { data, page, totalPages, total }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch notifications');
    }
  },
);

// ── 12a. PATCH /me/notifications/:id/read ─────────────────────────────────────
export const markNotificationRead = createAsyncThunk(
  'customerProfile/markNotificationRead',
  async (notifId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/customer/me/notifications/${notifId}/read`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark notification');
    }
  },
);

// ── 12b. PATCH /me/notifications/read-all ─────────────────────────────────────
export const markAllNotificationsRead = createAsyncThunk(
  'customerProfile/markAllNotificationsRead',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/customer/me/notifications/read-all');
      return data.message;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark all read');
    }
  },
);

// ── 13a. GET /me/snapshot ─────────────────────────────────────────────────────
export const fetchSnapshot = createAsyncThunk(
  'customerProfile/fetchSnapshot',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/customer/me/snapshot');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch snapshot');
    }
  },
);

// ── 13b. PUT /me/snapshot ─────────────────────────────────────────────────────
export const updateSnapshot = createAsyncThunk(
  'customerProfile/updateSnapshot',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/customer/me/snapshot', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update snapshot');
    }
  },
);


// ── 14. GET /me/prescriptions ─────────────────────────────────────────────────
export const fetchPrescriptions = createAsyncThunk(
  'customerProfile/fetchPrescriptions',
  async ({ page = 1, limit = 10, status } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (status) params.set('status', status);
      const { data } = await API.get(`/customer/me/prescriptions?${params}`);
      return data; // { data, page, totalPages, total }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch prescriptions');
    }
  },
);

// ── 15. GET /me/prescriptions/:rxNumber ───────────────────────────────────────
export const fetchPrescriptionByRx = createAsyncThunk(
  'customerProfile/fetchPrescriptionByRx',
  async (rxNumber, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/customer/me/prescriptions/${rxNumber}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Prescription not found');
    }
  },
);

// ── 16. GET /me/reports ───────────────────────────────────────────────────────
export const fetchReports = createAsyncThunk(
  'customerProfile/fetchReports',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/customer/me/reports');
      return data; // { data, total }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch reports');
    }
  },
);

// ── 17. POST /me/reports/:eventId/upload ──────────────────────────────────────
export const uploadReportFiles = createAsyncThunk(
  'customerProfile/uploadReportFiles',
  async ({ eventId, formData }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/customer/me/reports/${eventId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data; // updated event
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Report upload failed');
    }
  },
);

// ── 18. DELETE /me/reports/:eventId/file ──────────────────────────────────────
export const deleteReportFile = createAsyncThunk(
  'customerProfile/deleteReportFile',
  async ({ eventId, url }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/reports/${eventId}/file`, { data: { url } });
      return data.data; // updated event
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete report file');
    }
  },
);

// ── 19. GET /me/kyc ───────────────────────────────────────────────────────────
export const fetchKyc = createAsyncThunk(
  'customerProfile/fetchKyc',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/customer/me/kyc');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch KYC');
    }
  },
);

// ── 20. DELETE /me/kyc/:type ──────────────────────────────────────────────────
export const deleteKycByType = createAsyncThunk(
  'customerProfile/deleteKycByType',
  async (type, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/kyc/${type}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete KYC');
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // Core profile
  user:    null,
  profile: null,

  // Sub-sections
  kyc:               [],
  governmentSchemes: [],
  medicalTimeline:   [],
  medicineHistory:   [],
  snapshot:          null,

  // Sessions & devices
  auditSessions: [],
  deviceTokens:  [],

  // Notifications
  notifications:      [],
  notifPage:          1,
  notifTotalPages:    1,
  notifTotal:         0,
  unreadCount:        0,

prescriptions:        [],
prescriptionsMeta:    { page: 1, totalPages: 1, total: 0 },
activePrescription:   null,

// Reports (flattened)
reports:              [],
reportsTotal:         0,

  // Global loading / error
  loading:        false,
  sectionLoading: {
    profile:           false,
    kyc:               false,
     prescriptions:  false,
  reports:        false,
    schemes:           false,
    medicalTimeline:   false,
    medicineHistory:   false,
    snapshot:          false,
    auditSessions:     false,
    deviceTokens:      false,
    notifications:     false,
    unblock:           false,
  },
  error: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Mark a section as loading */
const sectionPending  = (key) => (state) => { state.sectionLoading[key] = true;  state.error = null; };
const sectionFulfilled = (key) => (state) => { state.sectionLoading[key] = false; };
const sectionRejected  = (key, msg) => (state, { payload }) => {
  state.sectionLoading[key] = false;
  state.error = payload;
  toast.error(payload || msg);
};

// ═══════════════════════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const customerProfileSlice = createSlice({
  name: 'customerProfile',
  initialState,

  reducers: {
    /** Clear all profile data (e.g., on logout) */
    clearCustomerProfile: () => initialState,

    /** Optimistically decrement unread count */
    decrementUnread: (state) => {
      if (state.unreadCount > 0) state.unreadCount -= 1;
    },

    /** Reset section-level error */
    clearError: (state) => { state.error = null; },
  },

  extraReducers: (builder) => {
    // ── 1. fetchMyProfile ────────────────────────────────────────────────────
    builder
      .addCase(fetchMyProfile.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchMyProfile.fulfilled, (state, { payload }) => {
        state.loading         = false;
        state.user            = payload.user;
        state.profile         = payload.profile;
        state.kyc             = payload.profile?.kyc             || [];
        state.governmentSchemes = payload.profile?.governmentSchemes || [];
        state.medicalTimeline = payload.profile?.medicalTimeline || [];
        state.medicineHistory = payload.profile?.medicineHistory || [];
        state.snapshot        = payload.profile?.snapshot        || null;
        state.auditSessions   = payload.user?.auditSessions      || [];
        state.deviceTokens    = payload.user?.deviceTokens       || [];
      })
      .addCase(fetchMyProfile.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
        toast.error(payload || 'Failed to load profile');
      });

    // ── 2. updateMyUser ──────────────────────────────────────────────────────
    builder
      .addCase(updateMyUser.pending,    sectionPending('profile'))
      .addCase(updateMyUser.fulfilled, (state, { payload }) => {
        state.sectionLoading.profile = false;
        state.user = payload;
        toast.success('Profile updated successfully');
      })
      .addCase(updateMyUser.rejected, sectionRejected('profile', 'Failed to update user'));

    // ── 3. updateMyCustomerProfile ───────────────────────────────────────────
    builder
      .addCase(updateMyCustomerProfile.pending,    sectionPending('profile'))
      .addCase(updateMyCustomerProfile.fulfilled, (state, { payload }) => {
        state.sectionLoading.profile = false;
        state.profile = payload;
        toast.success('Profile updated');
      })
      .addCase(updateMyCustomerProfile.rejected, sectionRejected('profile', 'Failed to update profile'));

    // ── 4. uploadKyc ─────────────────────────────────────────────────────────
    builder
      .addCase(uploadKyc.pending,    sectionPending('kyc'))
      .addCase(uploadKyc.fulfilled, (state, { payload }) => {
        state.sectionLoading.kyc = false;
        state.kyc = payload;
        toast.success('KYC document uploaded. Verification pending.');
      })
      .addCase(uploadKyc.rejected, sectionRejected('kyc', 'KYC upload failed'));

    // ── 5a. addGovernmentScheme ──────────────────────────────────────────────
    builder
      .addCase(addGovernmentScheme.pending,    sectionPending('schemes'))
      .addCase(addGovernmentScheme.fulfilled, (state, { payload }) => {
        state.sectionLoading.schemes = false;
        state.governmentSchemes = payload;
        toast.success('Government scheme added');
      })
      .addCase(addGovernmentScheme.rejected, sectionRejected('schemes', 'Failed to add scheme'));

    // ── 5b. deleteGovernmentScheme ───────────────────────────────────────────
    builder
      .addCase(deleteGovernmentScheme.pending,    sectionPending('schemes'))
      .addCase(deleteGovernmentScheme.fulfilled, (state, { payload }) => {
        state.sectionLoading.schemes = false;
        state.governmentSchemes = payload;
        toast.success('Scheme removed');
      })
      .addCase(deleteGovernmentScheme.rejected, sectionRejected('schemes', 'Failed to delete scheme'));

    // ── 6a. addMedicalEvent ──────────────────────────────────────────────────
    builder
      .addCase(addMedicalEvent.pending,    sectionPending('medicalTimeline'))
      .addCase(addMedicalEvent.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicalTimeline = false;
        state.medicalTimeline = payload;
        toast.success('Medical event added');
      })
      .addCase(addMedicalEvent.rejected, sectionRejected('medicalTimeline', 'Failed to add medical event'));

    // ── 6b. updateMedicalEvent ───────────────────────────────────────────────
    builder
      .addCase(updateMedicalEvent.pending,    sectionPending('medicalTimeline'))
      .addCase(updateMedicalEvent.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicalTimeline = false;
        state.medicalTimeline = payload;
        toast.success('Medical event updated');
      })
      .addCase(updateMedicalEvent.rejected, sectionRejected('medicalTimeline', 'Failed to update medical event'));

    // ── 6c. deleteMedicalEvent ───────────────────────────────────────────────
    builder
      .addCase(deleteMedicalEvent.pending,    sectionPending('medicalTimeline'))
      .addCase(deleteMedicalEvent.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicalTimeline = false;
        state.medicalTimeline = payload;
        toast.success('Medical event deleted');
      })
      .addCase(deleteMedicalEvent.rejected, sectionRejected('medicalTimeline', 'Failed to delete medical event'));

    // ── 7a. addMedicine ──────────────────────────────────────────────────────
    builder
      .addCase(addMedicine.pending,    sectionPending('medicineHistory'))
      .addCase(addMedicine.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicineHistory = false;
        state.medicineHistory = payload;
        toast.success('Medicine added');
      })
      .addCase(addMedicine.rejected, sectionRejected('medicineHistory', 'Failed to add medicine'));

    // ── 7b. updateMedicine ───────────────────────────────────────────────────
    builder
      .addCase(updateMedicine.pending,    sectionPending('medicineHistory'))
      .addCase(updateMedicine.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicineHistory = false;
        state.medicineHistory = payload;
        toast.success('Medicine updated');
      })
      .addCase(updateMedicine.rejected, sectionRejected('medicineHistory', 'Failed to update medicine'));

    // ── 7c. deleteMedicine ───────────────────────────────────────────────────
    builder
      .addCase(deleteMedicine.pending,    sectionPending('medicineHistory'))
      .addCase(deleteMedicine.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicineHistory = false;
        state.medicineHistory = payload;
        toast.success('Medicine removed');
      })
      .addCase(deleteMedicine.rejected, sectionRejected('medicineHistory', 'Failed to delete medicine'));

    // ── 8. fetchAuditSessions ────────────────────────────────────────────────
    builder
      .addCase(fetchAuditSessions.pending,    sectionPending('auditSessions'))
      .addCase(fetchAuditSessions.fulfilled, (state, { payload }) => {
        state.sectionLoading.auditSessions = false;
        state.auditSessions = payload;
      })
      .addCase(fetchAuditSessions.rejected, sectionRejected('auditSessions', 'Failed to fetch sessions'));

    // ── 9a. deleteAuditSession ───────────────────────────────────────────────
    builder
      .addCase(deleteAuditSession.pending,    sectionPending('auditSessions'))
      .addCase(deleteAuditSession.fulfilled, (state, { payload }) => {
        state.sectionLoading.auditSessions = false;
        state.auditSessions = payload;
        toast.success('Device logged out successfully');
      })
      .addCase(deleteAuditSession.rejected, sectionRejected('auditSessions', 'Failed to remove session'));

    // ── 9b. deleteAllAuditSessions ───────────────────────────────────────────
    builder
      .addCase(deleteAllAuditSessions.pending,    sectionPending('auditSessions'))
      .addCase(deleteAllAuditSessions.fulfilled, (state) => {
        state.sectionLoading.auditSessions = false;
        state.auditSessions = [];
        toast.success('Logged out from all devices');
      })
      .addCase(deleteAllAuditSessions.rejected, sectionRejected('auditSessions', 'Failed to clear sessions'));

    // ── 10. deleteDeviceToken ────────────────────────────────────────────────
    builder
      .addCase(deleteDeviceToken.pending,    sectionPending('deviceTokens'))
      .addCase(deleteDeviceToken.fulfilled, (state, { payload }) => {
        state.sectionLoading.deviceTokens = false;
        state.deviceTokens = payload;
        toast.success('Device token removed');
      })
      .addCase(deleteDeviceToken.rejected, sectionRejected('deviceTokens', 'Failed to remove token'));

    // ── 11. requestUnblock ───────────────────────────────────────────────────
    builder
      .addCase(requestUnblock.pending,    sectionPending('unblock'))
      .addCase(requestUnblock.fulfilled, (state, { payload }) => {
        state.sectionLoading.unblock = false;
        toast.success(payload || 'Unblock request submitted');
      })
      .addCase(requestUnblock.rejected, sectionRejected('unblock', 'Failed to submit unblock request'));

    // ── 12. fetchNotifications ───────────────────────────────────────────────
    builder
      .addCase(fetchNotifications.pending,    sectionPending('notifications'))
      .addCase(fetchNotifications.fulfilled, (state, { payload }) => {
        state.sectionLoading.notifications = false;
        state.notifications   = payload.data;
        state.notifPage       = payload.page;
        state.notifTotalPages = payload.totalPages;
        state.notifTotal      = payload.total;
        state.unreadCount     = payload.data.filter((n) => !n.isRead).length;
      })
      .addCase(fetchNotifications.rejected, sectionRejected('notifications', 'Failed to fetch notifications'));

    // ── 12a. markNotificationRead ────────────────────────────────────────────
    builder
      .addCase(markNotificationRead.fulfilled, (state, { payload }) => {
        const idx = state.notifications.findIndex((n) => n._id === payload._id);
        if (idx !== -1) {
          state.notifications[idx] = payload;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markNotificationRead.rejected, (_, { payload }) => {
        toast.error(payload || 'Could not mark notification as read');
      });

    // ── 12b. markAllNotificationsRead ────────────────────────────────────────
    builder
      .addCase(markAllNotificationsRead.fulfilled, (state, { payload }) => {
        state.notifications = state.notifications.map((n) => ({ ...n, isRead: true }));
        state.unreadCount   = 0;
        toast.success(payload || 'All notifications marked as read');
      })
      .addCase(markAllNotificationsRead.rejected, (_, { payload }) => {
        toast.error(payload || 'Could not mark all as read');
      });

    // ── 13a. fetchSnapshot ───────────────────────────────────────────────────
    builder
      .addCase(fetchSnapshot.pending,    sectionPending('snapshot'))
      .addCase(fetchSnapshot.fulfilled, (state, { payload }) => {
        state.sectionLoading.snapshot = false;
        state.snapshot = payload;
      })
      .addCase(fetchSnapshot.rejected, sectionRejected('snapshot', 'Failed to fetch snapshot'));

    // ── 13b. updateSnapshot ──────────────────────────────────────────────────
    builder
      .addCase(updateSnapshot.pending,    sectionPending('snapshot'))
      .addCase(updateSnapshot.fulfilled, (state, { payload }) => {
        state.sectionLoading.snapshot = false;
        state.snapshot = payload;
        toast.success('Health snapshot updated');
      })
      .addCase(updateSnapshot.rejected, sectionRejected('snapshot', 'Failed to update snapshot'));

// ── 14. fetchPrescriptions ───────────────────────────────────────────────────
builder
  .addCase(fetchPrescriptions.pending,    sectionPending('prescriptions'))
  .addCase(fetchPrescriptions.fulfilled, (state, { payload }) => {
    state.sectionLoading.prescriptions = false;
    state.prescriptions     = payload.data;
    state.prescriptionsMeta = {
      page:       payload.page,
      totalPages: payload.totalPages,
      total:      payload.total,
    };
  })
  .addCase(fetchPrescriptions.rejected, sectionRejected('prescriptions', 'Failed to fetch prescriptions'));

// ── 15. fetchPrescriptionByRx ────────────────────────────────────────────────
builder
  .addCase(fetchPrescriptionByRx.pending,    sectionPending('prescriptions'))
  .addCase(fetchPrescriptionByRx.fulfilled, (state, { payload }) => {
    state.sectionLoading.prescriptions = false;
    state.activePrescription = payload;
  })
  .addCase(fetchPrescriptionByRx.rejected, sectionRejected('prescriptions', 'Prescription not found'));

// ── 16. fetchReports ─────────────────────────────────────────────────────────
builder
  .addCase(fetchReports.pending,    sectionPending('reports'))
  .addCase(fetchReports.fulfilled, (state, { payload }) => {
    state.sectionLoading.reports = false;
    state.reports      = payload.data;
    state.reportsTotal = payload.total;
  })
  .addCase(fetchReports.rejected, sectionRejected('reports', 'Failed to fetch reports'));

// ── 17. uploadReportFiles ─────────────────────────────────────────────────────
builder
  .addCase(uploadReportFiles.pending,    sectionPending('reports'))
  .addCase(uploadReportFiles.fulfilled, (state, { payload }) => {
    state.sectionLoading.reports = false;
    // Sync updated event back into medicalTimeline
    const idx = state.medicalTimeline.findIndex((e) => e._id === payload._id);
    if (idx !== -1) state.medicalTimeline[idx] = payload;
    // Sync into reports list
    const rIdx = state.reports.findIndex((r) => r.eventId === payload._id);
    if (rIdx !== -1) state.reports[rIdx].reportUrls = payload.reportUrls;
    toast.success('Reports uploaded');
  })
  .addCase(uploadReportFiles.rejected, sectionRejected('reports', 'Report upload failed'));

// ── 18. deleteReportFile ──────────────────────────────────────────────────────
builder
  .addCase(deleteReportFile.pending,    sectionPending('reports'))
  .addCase(deleteReportFile.fulfilled, (state, { payload }) => {
    state.sectionLoading.reports = false;
    const idx = state.medicalTimeline.findIndex((e) => e._id === payload._id);
    if (idx !== -1) state.medicalTimeline[idx] = payload;
    const rIdx = state.reports.findIndex((r) => r.eventId === payload._id);
    if (rIdx !== -1) state.reports[rIdx].reportUrls = payload.reportUrls;
    toast.success('File removed');
  })
  .addCase(deleteReportFile.rejected, sectionRejected('reports', 'Failed to delete file'));

// ── 19. fetchKyc ─────────────────────────────────────────────────────────────
builder
  .addCase(fetchKyc.pending,    sectionPending('kyc'))
  .addCase(fetchKyc.fulfilled, (state, { payload }) => {
    state.sectionLoading.kyc = false;
    state.kyc = payload;
  })
  .addCase(fetchKyc.rejected, sectionRejected('kyc', 'Failed to fetch KYC'));

// ── 20. deleteKycByType ───────────────────────────────────────────────────────
builder
  .addCase(deleteKycByType.pending,    sectionPending('kyc'))
  .addCase(deleteKycByType.fulfilled, (state, { payload }) => {
    state.sectionLoading.kyc = false;
    state.kyc = payload;
    toast.success('KYC document removed');
  })
  .addCase(deleteKycByType.rejected, sectionRejected('kyc', 'Failed to delete KYC'));


    },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const { clearCustomerProfile, decrementUnread, clearError } = customerProfileSlice.actions;

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

export const selectCustomerUser            = (s) => s.customerProfile.user;
export const selectCustomerProfile         = (s) => s.customerProfile.profile;
export const selectKyc                     = (s) => s.customerProfile.kyc;
export const selectGovernmentSchemes       = (s) => s.customerProfile.governmentSchemes;
export const selectMedicalTimeline         = (s) => s.customerProfile.medicalTimeline;
export const selectMedicineHistory         = (s) => s.customerProfile.medicineHistory;
export const selectSnapshot                = (s) => s.customerProfile.snapshot;
export const selectAuditSessions           = (s) => s.customerProfile.auditSessions;
export const selectDeviceTokens            = (s) => s.customerProfile.deviceTokens;
export const selectNotifications           = (s) => s.customerProfile.notifications;
export const selectUnreadCount             = (s) => s.customerProfile.unreadCount;
export const selectNotifMeta               = (s) => ({
  page: s.customerProfile.notifPage,
  totalPages: s.customerProfile.notifTotalPages,
  total: s.customerProfile.notifTotal,
});
export const selectProfileLoading          = (s) => s.customerProfile.loading;
export const selectSectionLoading          = (key) => (s) => s.customerProfile.sectionLoading[key];
export const selectProfileError            = (s) => s.customerProfile.error;
export const selectPrescriptions      = (s) => s.customerProfile.prescriptions;
export const selectPrescriptionsMeta  = (s) => s.customerProfile.prescriptionsMeta;
export const selectActivePrescription = (s) => s.customerProfile.activePrescription;
export const selectReports            = (s) => s.customerProfile.reports;
export const selectReportsTotal       = (s) => s.customerProfile.reportsTotal;
export default customerProfileSlice.reducer;