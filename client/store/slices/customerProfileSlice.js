import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════════════════════
// THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

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

export const uploadKyc = createAsyncThunk(
  'customerProfile/uploadKyc',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/customer/me/kyc', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'KYC upload failed');
    }
  },
);

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

export const addGovernmentScheme = createAsyncThunk(
  'customerProfile/addGovernmentScheme',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/customer/me/government-schemes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add scheme');
    }
  },
);

export const deleteGovernmentScheme = createAsyncThunk(
  'customerProfile/deleteGovernmentScheme',
  async (schemeId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/government-schemes/${schemeId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete scheme');
    }
  },
);

// ── Private Insurance (NEW) ───────────────────────────────────────────────────
export const addPrivateInsurance = createAsyncThunk(
  'customerProfile/addPrivateInsurance',
  async (formData, { rejectWithValue }) => {
    // formData: FormData — insurerName, policyNumber, tpaName, holderName, sumInsured, validFrom, validTo, cardFile?
    try {
      const { data } = await API.post('/customer/me/private-insurance', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add insurance');
    }
  },
);

export const deletePrivateInsurance = createAsyncThunk(
  'customerProfile/deletePrivateInsurance',
  async (insuranceId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/private-insurance/${insuranceId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete insurance');
    }
  },
);

export const addMedicalEvent = createAsyncThunk(
  'customerProfile/addMedicalEvent',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/customer/me/medical-timeline', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add medical event');
    }
  },
);

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

// ── Consent (NEW) ─────────────────────────────────────────────────────────────
export const updateConsent = createAsyncThunk(
  'customerProfile/updateConsent',
  async (payload, { rejectWithValue }) => {
    // payload: { telemedicineConsent, dataSharingConsent, marketingConsent, recordingConsent, consentVersion }
    try {
      const { data } = await API.put('/customer/me/consent', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update consent');
    }
  },
);

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

export const deleteAuditSession = createAsyncThunk(
  'customerProfile/deleteAuditSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/audit-sessions/${sessionId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove session');
    }
  },
);

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

export const deleteDeviceToken = createAsyncThunk(
  'customerProfile/deleteDeviceToken',
  async (tokenId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/device-tokens/${tokenId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove device token');
    }
  },
);

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

export const fetchNotifications = createAsyncThunk(
  'customerProfile/fetchNotifications',
  async ({ page = 1, limit = 20, unread } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (unread) params.set('unread', 'true');
      const { data } = await API.get(`/customer/me/notifications?${params}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch notifications');
    }
  },
);

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

// ── Snapshot / vitalsBaseline ─────────────────────────────────────────────────
export const fetchSnapshot = createAsyncThunk(
  'customerProfile/fetchSnapshot',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/customer/me/snapshot');
      return data.data; // { vitalsBaseline, chronicConditions, allergies, preferredLanguage, emergencyContact, bloodGroup }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch snapshot');
    }
  },
);

export const updateSnapshot = createAsyncThunk(
  'customerProfile/updateSnapshot',
  async (payload, { rejectWithValue }) => {
    // payload: { chronicConditions?, allergies?, preferredLanguage?, vitals?: { bloodPressure, pulseRate, ... } }
    try {
      const { data } = await API.put('/customer/me/snapshot', payload);
      return data.data; // { vitalsBaseline, chronicConditions, allergies, preferredLanguage }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update snapshot');
    }
  },
);

export const fetchPrescriptions = createAsyncThunk(
  'customerProfile/fetchPrescriptions',
  async ({ page = 1, limit = 10, status } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (status) params.set('status', status);
      const { data } = await API.get(`/customer/me/prescriptions?${params}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch prescriptions');
    }
  },
);

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

export const fetchReports = createAsyncThunk(
  'customerProfile/fetchReports',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/customer/me/reports');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch reports');
    }
  },
);

export const uploadReportFiles = createAsyncThunk(
  'customerProfile/uploadReportFiles',
  async ({ eventId, formData }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/customer/me/reports/${eventId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Report upload failed');
    }
  },
);

export const deleteReportFile = createAsyncThunk(
  'customerProfile/deleteReportFile',
  async ({ eventId, url }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/customer/me/reports/${eventId}/file`, { data: { url } });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete report file');
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // Core
  user:    null,
  profile: null,

  // Sub-sections — match new CustomerProfile schema
  kyc:               [],
  governmentSchemes: [],
  privateInsurances: [],    // NEW
  medicalTimeline:   [],
  medicineHistory:   [],
  consent:           null,  // NEW

  // Vitals baseline + top-level health fields (replaces flat `snapshot`)
  vitalsBaseline:    null,
  chronicConditions: [],
  allergies:         [],
  preferredLanguage: 'English',

  // Sessions & devices
  auditSessions: [],
  deviceTokens:  [],

  // Notifications
  notifications:   [],
  notifPage:       1,
  notifTotalPages: 1,
  notifTotal:      0,
  unreadCount:     0,

  // Prescriptions
  prescriptions:      [],
  prescriptionsMeta:  { page: 1, totalPages: 1, total: 0 },
  activePrescription: null,

  // Reports
  reports:      [],
  reportsTotal: 0,

  // Loading
  loading: false,
  sectionLoading: {
    profile:           false,
    kyc:               false,
    schemes:           false,
    privateInsurances: false,  // NEW
    medicalTimeline:   false,
    medicineHistory:   false,
    consent:           false,  // NEW
    snapshot:          false,
    auditSessions:     false,
    deviceTokens:      false,
    notifications:     false,
    prescriptions:     false,
    reports:           false,
    unblock:           false,
  },
  error: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const sectionPending   = (key) => (state) => { state.sectionLoading[key] = true;  state.error = null; };
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
    clearCustomerProfile: () => initialState,
    decrementUnread: (state) => { if (state.unreadCount > 0) state.unreadCount -= 1; },
    clearError: (state) => { state.error = null; },
  },

  extraReducers: (builder) => {

    // ── 1. fetchMyProfile ────────────────────────────────────────────────────
    builder
      .addCase(fetchMyProfile.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMyProfile.fulfilled, (state, { payload }) => {
        const p = payload.profile || {};
        state.loading          = false;
        state.user             = payload.user;
        state.profile          = p;

        // Arrays
        state.kyc               = p.kyc               || [];
        state.governmentSchemes = p.governmentSchemes  || [];
        state.privateInsurances = p.privateInsurances  || [];  // NEW
        state.medicalTimeline   = p.medicalTimeline    || [];
        state.medicineHistory   = p.medicineHistory    || [];

        // Consent
        state.consent           = p.consent            || null;  // NEW

        // Health fields — new schema (no longer nested under snapshot)
        state.vitalsBaseline    = p.vitalsBaseline      || null;
        state.chronicConditions = p.chronicConditions   || [];
        state.allergies         = p.allergies           || [];
        state.preferredLanguage = p.preferredLanguage   || 'English';

        // Sessions / devices live on user doc
        state.auditSessions     = payload.user?.auditSessions || [];
        state.deviceTokens      = payload.user?.deviceTokens  || [];
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
        state.profile          = payload;
        // Sync promoted fields back to state
        state.chronicConditions = payload.chronicConditions  || state.chronicConditions;
        state.allergies         = payload.allergies          || state.allergies;
        state.preferredLanguage = payload.preferredLanguage  || state.preferredLanguage;
        toast.success('Profile updated');
      })
      .addCase(updateMyCustomerProfile.rejected, sectionRejected('profile', 'Failed to update profile'));

    // ── 4. KYC ───────────────────────────────────────────────────────────────
    builder
      .addCase(uploadKyc.pending,    sectionPending('kyc'))
      .addCase(uploadKyc.fulfilled, (state, { payload }) => {
        state.sectionLoading.kyc = false;
        state.kyc = payload;
        toast.success('KYC document uploaded. Verification pending.');
      })
      .addCase(uploadKyc.rejected, sectionRejected('kyc', 'KYC upload failed'));

    builder
      .addCase(fetchKyc.pending,    sectionPending('kyc'))
      .addCase(fetchKyc.fulfilled, (state, { payload }) => {
        state.sectionLoading.kyc = false;
        state.kyc = payload;
      })
      .addCase(fetchKyc.rejected, sectionRejected('kyc', 'Failed to fetch KYC'));

    builder
      .addCase(deleteKycByType.pending,    sectionPending('kyc'))
      .addCase(deleteKycByType.fulfilled, (state, { payload }) => {
        state.sectionLoading.kyc = false;
        state.kyc = payload;
        toast.success('KYC document removed');
      })
      .addCase(deleteKycByType.rejected, sectionRejected('kyc', 'Failed to delete KYC'));

    // ── 5. Government Schemes ────────────────────────────────────────────────
    builder
      .addCase(addGovernmentScheme.pending,    sectionPending('schemes'))
      .addCase(addGovernmentScheme.fulfilled, (state, { payload }) => {
        state.sectionLoading.schemes = false;
        state.governmentSchemes = payload;
        toast.success('Government scheme added');
      })
      .addCase(addGovernmentScheme.rejected, sectionRejected('schemes', 'Failed to add scheme'));

    builder
      .addCase(deleteGovernmentScheme.pending,    sectionPending('schemes'))
      .addCase(deleteGovernmentScheme.fulfilled, (state, { payload }) => {
        state.sectionLoading.schemes = false;
        state.governmentSchemes = payload;
        toast.success('Scheme removed');
      })
      .addCase(deleteGovernmentScheme.rejected, sectionRejected('schemes', 'Failed to delete scheme'));

    // ── 6. Private Insurance (NEW) ───────────────────────────────────────────
    builder
      .addCase(addPrivateInsurance.pending,    sectionPending('privateInsurances'))
      .addCase(addPrivateInsurance.fulfilled, (state, { payload }) => {
        state.sectionLoading.privateInsurances = false;
        state.privateInsurances = payload;
        toast.success('Insurance added');
      })
      .addCase(addPrivateInsurance.rejected, sectionRejected('privateInsurances', 'Failed to add insurance'));

    builder
      .addCase(deletePrivateInsurance.pending,    sectionPending('privateInsurances'))
      .addCase(deletePrivateInsurance.fulfilled, (state, { payload }) => {
        state.sectionLoading.privateInsurances = false;
        state.privateInsurances = payload;
        toast.success('Insurance removed');
      })
      .addCase(deletePrivateInsurance.rejected, sectionRejected('privateInsurances', 'Failed to delete insurance'));

    // ── 7. Medical Timeline ──────────────────────────────────────────────────
    builder
      .addCase(addMedicalEvent.pending,    sectionPending('medicalTimeline'))
      .addCase(addMedicalEvent.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicalTimeline = false;
        state.medicalTimeline = payload;
        toast.success('Medical event added');
      })
      .addCase(addMedicalEvent.rejected, sectionRejected('medicalTimeline', 'Failed to add medical event'));

    builder
      .addCase(updateMedicalEvent.pending,    sectionPending('medicalTimeline'))
      .addCase(updateMedicalEvent.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicalTimeline = false;
        state.medicalTimeline = payload;
        toast.success('Medical event updated');
      })
      .addCase(updateMedicalEvent.rejected, sectionRejected('medicalTimeline', 'Failed to update medical event'));

    builder
      .addCase(deleteMedicalEvent.pending,    sectionPending('medicalTimeline'))
      .addCase(deleteMedicalEvent.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicalTimeline = false;
        state.medicalTimeline = payload;
        toast.success('Medical event deleted');
      })
      .addCase(deleteMedicalEvent.rejected, sectionRejected('medicalTimeline', 'Failed to delete medical event'));

    // ── 8. Medicine History ──────────────────────────────────────────────────
    builder
      .addCase(addMedicine.pending,    sectionPending('medicineHistory'))
      .addCase(addMedicine.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicineHistory = false;
        state.medicineHistory = payload;
        toast.success('Medicine added');
      })
      .addCase(addMedicine.rejected, sectionRejected('medicineHistory', 'Failed to add medicine'));

    builder
      .addCase(updateMedicine.pending,    sectionPending('medicineHistory'))
      .addCase(updateMedicine.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicineHistory = false;
        state.medicineHistory = payload;
        toast.success('Medicine updated');
      })
      .addCase(updateMedicine.rejected, sectionRejected('medicineHistory', 'Failed to update medicine'));

    builder
      .addCase(deleteMedicine.pending,    sectionPending('medicineHistory'))
      .addCase(deleteMedicine.fulfilled, (state, { payload }) => {
        state.sectionLoading.medicineHistory = false;
        state.medicineHistory = payload;
        toast.success('Medicine removed');
      })
      .addCase(deleteMedicine.rejected, sectionRejected('medicineHistory', 'Failed to delete medicine'));

    // ── 9. Consent (NEW) ─────────────────────────────────────────────────────
    builder
      .addCase(updateConsent.pending,    sectionPending('consent'))
      .addCase(updateConsent.fulfilled, (state, { payload }) => {
        state.sectionLoading.consent = false;
        state.consent = payload;
        toast.success('Consent preferences saved');
      })
      .addCase(updateConsent.rejected, sectionRejected('consent', 'Failed to update consent'));

    // ── 10. Audit Sessions ───────────────────────────────────────────────────
    builder
      .addCase(fetchAuditSessions.pending,    sectionPending('auditSessions'))
      .addCase(fetchAuditSessions.fulfilled, (state, { payload }) => {
        state.sectionLoading.auditSessions = false;
        state.auditSessions = payload;
      })
      .addCase(fetchAuditSessions.rejected, sectionRejected('auditSessions', 'Failed to fetch sessions'));

    builder
      .addCase(deleteAuditSession.pending,    sectionPending('auditSessions'))
      .addCase(deleteAuditSession.fulfilled, (state, { payload }) => {
        state.sectionLoading.auditSessions = false;
        state.auditSessions = payload;
        toast.success('Device logged out successfully');
      })
      .addCase(deleteAuditSession.rejected, sectionRejected('auditSessions', 'Failed to remove session'));

    builder
      .addCase(deleteAllAuditSessions.pending,    sectionPending('auditSessions'))
      .addCase(deleteAllAuditSessions.fulfilled, (state) => {
        state.sectionLoading.auditSessions = false;
        state.auditSessions = [];
        toast.success('Logged out from all devices');
      })
      .addCase(deleteAllAuditSessions.rejected, sectionRejected('auditSessions', 'Failed to clear sessions'));

    // ── 11. Device Tokens ────────────────────────────────────────────────────
    builder
      .addCase(deleteDeviceToken.pending,    sectionPending('deviceTokens'))
      .addCase(deleteDeviceToken.fulfilled, (state, { payload }) => {
        state.sectionLoading.deviceTokens = false;
        state.deviceTokens = payload;
        toast.success('Device token removed');
      })
      .addCase(deleteDeviceToken.rejected, sectionRejected('deviceTokens', 'Failed to remove token'));

    // ── 12. Request Unblock ──────────────────────────────────────────────────
    builder
      .addCase(requestUnblock.pending,    sectionPending('unblock'))
      .addCase(requestUnblock.fulfilled, (state, { payload }) => {
        state.sectionLoading.unblock = false;
        toast.success(payload || 'Unblock request submitted');
      })
      .addCase(requestUnblock.rejected, sectionRejected('unblock', 'Failed to submit unblock request'));

    // ── 13. Notifications ────────────────────────────────────────────────────
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

    builder
      .addCase(markAllNotificationsRead.fulfilled, (state, { payload }) => {
        state.notifications = state.notifications.map((n) => ({ ...n, isRead: true }));
        state.unreadCount   = 0;
        toast.success(payload || 'All notifications marked as read');
      })
      .addCase(markAllNotificationsRead.rejected, (_, { payload }) => {
        toast.error(payload || 'Could not mark all as read');
      });

    // ── 14. Snapshot / vitalsBaseline ────────────────────────────────────────
    builder
      .addCase(fetchSnapshot.pending,    sectionPending('snapshot'))
      .addCase(fetchSnapshot.fulfilled, (state, { payload }) => {
        // payload: { vitalsBaseline, chronicConditions, allergies, preferredLanguage, emergencyContact, bloodGroup }
        state.sectionLoading.snapshot = false;
        state.vitalsBaseline    = payload.vitalsBaseline    || null;
        state.chronicConditions = payload.chronicConditions || [];
        state.allergies         = payload.allergies         || [];
        state.preferredLanguage = payload.preferredLanguage || 'English';
      })
      .addCase(fetchSnapshot.rejected, sectionRejected('snapshot', 'Failed to fetch snapshot'));

    builder
      .addCase(updateSnapshot.pending,    sectionPending('snapshot'))
      .addCase(updateSnapshot.fulfilled, (state, { payload }) => {
        // payload: { vitalsBaseline, chronicConditions, allergies, preferredLanguage }
        state.sectionLoading.snapshot = false;
        if (payload.vitalsBaseline    !== undefined) state.vitalsBaseline    = payload.vitalsBaseline;
        if (payload.chronicConditions !== undefined) state.chronicConditions = payload.chronicConditions;
        if (payload.allergies         !== undefined) state.allergies         = payload.allergies;
        if (payload.preferredLanguage !== undefined) state.preferredLanguage = payload.preferredLanguage;
        toast.success('Health snapshot updated');
      })
      .addCase(updateSnapshot.rejected, sectionRejected('snapshot', 'Failed to update snapshot'));

    // ── 15. Prescriptions ────────────────────────────────────────────────────
    builder
      .addCase(fetchPrescriptions.pending,    sectionPending('prescriptions'))
      .addCase(fetchPrescriptions.fulfilled, (state, { payload }) => {
        state.sectionLoading.prescriptions = false;
        state.prescriptions     = payload.data;
        state.prescriptionsMeta = { page: payload.page, totalPages: payload.totalPages, total: payload.total };
      })
      .addCase(fetchPrescriptions.rejected, sectionRejected('prescriptions', 'Failed to fetch prescriptions'));

    builder
      .addCase(fetchPrescriptionByRx.pending,    sectionPending('prescriptions'))
      .addCase(fetchPrescriptionByRx.fulfilled, (state, { payload }) => {
        state.sectionLoading.prescriptions = false;
        state.activePrescription = payload;
      })
      .addCase(fetchPrescriptionByRx.rejected, sectionRejected('prescriptions', 'Prescription not found'));

    // ── 16. Reports ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchReports.pending,    sectionPending('reports'))
      .addCase(fetchReports.fulfilled, (state, { payload }) => {
        state.sectionLoading.reports = false;
        state.reports      = payload.data;
        state.reportsTotal = payload.total;
      })
      .addCase(fetchReports.rejected, sectionRejected('reports', 'Failed to fetch reports'));

    builder
      .addCase(uploadReportFiles.pending,    sectionPending('reports'))
      .addCase(uploadReportFiles.fulfilled, (state, { payload }) => {
        state.sectionLoading.reports = false;
        const idx  = state.medicalTimeline.findIndex((e) => e._id === payload._id);
        if (idx  !== -1) state.medicalTimeline[idx]  = payload;
        const rIdx = state.reports.findIndex((r) => r.eventId === payload._id);
        if (rIdx !== -1) state.reports[rIdx].reportUrls = payload.reportUrls;
        toast.success('Reports uploaded');
      })
      .addCase(uploadReportFiles.rejected, sectionRejected('reports', 'Report upload failed'));

    builder
      .addCase(deleteReportFile.pending,    sectionPending('reports'))
      .addCase(deleteReportFile.fulfilled, (state, { payload }) => {
        state.sectionLoading.reports = false;
        const idx  = state.medicalTimeline.findIndex((e) => e._id === payload._id);
        if (idx  !== -1) state.medicalTimeline[idx]  = payload;
        const rIdx = state.reports.findIndex((r) => r.eventId === payload._id);
        if (rIdx !== -1) state.reports[rIdx].reportUrls = payload.reportUrls;
        toast.success('File removed');
      })
      .addCase(deleteReportFile.rejected, sectionRejected('reports', 'Failed to delete file'));
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const { clearCustomerProfile, decrementUnread, clearError } = customerProfileSlice.actions;

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

export const selectCustomerUser        = (s) => s.customerProfile.user;
export const selectCustomerProfile     = (s) => s.customerProfile.profile;
export const selectKyc                 = (s) => s.customerProfile.kyc;
export const selectGovernmentSchemes   = (s) => s.customerProfile.governmentSchemes;
export const selectPrivateInsurances   = (s) => s.customerProfile.privateInsurances;   // NEW
export const selectConsent             = (s) => s.customerProfile.consent;              // NEW
export const selectMedicalTimeline     = (s) => s.customerProfile.medicalTimeline;
export const selectMedicineHistory     = (s) => s.customerProfile.medicineHistory;
export const selectVitalsBaseline      = (s) => s.customerProfile.vitalsBaseline;       // replaces selectSnapshot.vitals
export const selectChronicConditions   = (s) => s.customerProfile.chronicConditions;    // promoted
export const selectAllergies           = (s) => s.customerProfile.allergies;            // promoted
export const selectPreferredLanguage   = (s) => s.customerProfile.preferredLanguage;    // promoted
export const selectAuditSessions       = (s) => s.customerProfile.auditSessions;
export const selectDeviceTokens        = (s) => s.customerProfile.deviceTokens;
export const selectNotifications       = (s) => s.customerProfile.notifications;
export const selectUnreadCount         = (s) => s.customerProfile.unreadCount;
export const selectNotifMeta           = (s) => ({ page: s.customerProfile.notifPage, totalPages: s.customerProfile.notifTotalPages, total: s.customerProfile.notifTotal });
export const selectPrescriptions       = (s) => s.customerProfile.prescriptions;
export const selectPrescriptionsMeta   = (s) => s.customerProfile.prescriptionsMeta;
export const selectActivePrescription  = (s) => s.customerProfile.activePrescription;
export const selectReports             = (s) => s.customerProfile.reports;
export const selectReportsTotal        = (s) => s.customerProfile.reportsTotal;
export const selectProfileLoading      = (s) => s.customerProfile.loading;
export const selectSectionLoading      = (key) => (s) => s.customerProfile.sectionLoading[key];
export const selectProfileError        = (s) => s.customerProfile.error;

export default customerProfileSlice.reducer;