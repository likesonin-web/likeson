// ═══════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT SLICE — LIKESON HEALTHCARE
// File: store/slices/careAssistantSlice.js
//
// Every route in careAssistantRouter.js is mapped 1-to-1 to a createAsyncThunk.
// Sections mirror the router exactly:
//   A  Profile Setup         (getProfile, updateProfile)
//   B  Upload                (getUploadAuth, uploadPhoto, uploadDocument)
//   C  KYC                   (submitKyc, getKycStatus)
//   D  Training              (updateTraining, addCertificate, deleteCertificate)
//   E  Schedule              (getSchedule, updateSchedule)
//   F  Availability/Location (updateAvailability, updateLocation, updateStatus)
//   G  Bank Details          (getBankDetails, updateBankDetails)
//   H  Health Declaration    (updateHealthDeclaration)
//   I  Onboarding Wizard     (updateOnboardingStep, completeOnboarding)
//   J  Settings              (getSettings, updateNotifPrefs, updateServiceArea,
//                             registerDeviceToken, removeDeviceToken)
//   K  Security              (changePassword, sendEmailOtp, verifyEmailOtp,
//                             getSessions, revokeSession, revokeAllSessions,
//                             requestAccountDeletion, confirmAccountDeletion)
//   L  Performance           (getPerformance)
//   M  Admin                 (adminCreateCareAssistant, adminGetAll,
//                             adminGetOne, adminKycAction,
//                             adminPoliceVerification, adminBlockCA,
//                             adminUnblockCA, adminVerifyCertificate,
//                             adminUpdatePerformance, adminUpdateNotes,
//                             adminVerifyBank, adminGetStats, adminGetNearby)
// ═══════════════════════════════════════════════════════════════════════════════

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — unwrap axios response and surface server error message
// ─────────────────────────────────────────────────────────────────────────────
const rejectWithMsg = (error, thunkAPI) =>
  thunkAPI.rejectWithValue(
    error?.response?.data?.message || error.message || 'Something went wrong'
  );

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A — PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/care-assistant/profile
export const getProfile = createAsyncThunk(
  'careAssistant/getProfile',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/profile');
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PUT /api/care-assistant/profile
// payload: { fullName?, dateOfBirth?, gender?, phone?, alternatePhone?, email?,
//            address?, bio?, experienceYears?, specializations?, languagesKnown?,
//            workType?, emergencyContact?, preferredServiceAreas?, maxServiceRadiusKm?,
//            notifPrefs? }
export const updateProfile = createAsyncThunk(
  'careAssistant/updateProfile',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put('/care-assistant/profile', payload);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B — UPLOAD (ImageKit)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/care-assistant/upload/auth
export const getUploadAuth = createAsyncThunk(
  'careAssistant/getUploadAuth',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/upload/auth');
      return data.data; // { token, expire, signature }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// POST /api/care-assistant/upload/photo
// payload: File object (browser File)
export const uploadPhoto = createAsyncThunk(
  'careAssistant/uploadPhoto',
  async (file, thunkAPI) => {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const { data } = await API.post('/care-assistant/upload/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data; // { url, fileId, profile }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// POST /api/care-assistant/upload/document
// payload: { file: File, docType: 'aadhaar_front'|'aadhaar_back'|'pan_card'|'police_verification'|'certificate' }
export const uploadDocument = createAsyncThunk(
  'careAssistant/uploadDocument',
  async ({ file, docType }, thunkAPI) => {
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('docType', docType);
      const { data } = await API.post('/care-assistant/upload/document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { docType, ...data.data }; // { docType, url, fileId, profile }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C — KYC
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /api/care-assistant/kyc/submit
// payload: { aadhaarNumber?: string, panNumber?: string }
export const submitKyc = createAsyncThunk(
  'careAssistant/submitKyc',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put('/care-assistant/kyc/submit', payload);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// GET /api/care-assistant/kyc/status
export const getKycStatus = createAsyncThunk(
  'careAssistant/getKycStatus',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/kyc/status');
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION D — TRAINING & CERTIFICATES
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /api/care-assistant/training
// payload: { isFirstAidCertified?, patientEtiquetteTrained?, mobilitySupportTrained?,
//            medicationManagement?, woundCare? }
export const updateTraining = createAsyncThunk(
  'careAssistant/updateTraining',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put('/care-assistant/training', payload);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// POST /api/care-assistant/training/certificates
// payload: { name: string, issuedBy?, issuedAt?, expiresAt?, documentUrl? }
export const addCertificate = createAsyncThunk(
  'careAssistant/addCertificate',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.post('/care-assistant/training/certificates', payload);
      return data.data; // updated certificates array
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// DELETE /api/care-assistant/training/certificates/:certId
export const deleteCertificate = createAsyncThunk(
  'careAssistant/deleteCertificate',
  async (certId, thunkAPI) => {
    try {
      const { data } = await API.delete(`/care-assistant/training/certificates/${certId}`);
      return data.data; // updated certificates array
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION E — WEEKLY SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/care-assistant/schedule
export const getSchedule = createAsyncThunk(
  'careAssistant/getSchedule',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/schedule');
      return data.data; // { weeklySchedule, workType }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PUT /api/care-assistant/schedule
// payload: { monday?: { isAvailable, startTime, endTime, maxHoursPerDay }, ..., workType? }
export const updateSchedule = createAsyncThunk(
  'careAssistant/updateSchedule',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put('/care-assistant/schedule', payload);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION F — AVAILABILITY & REAL-TIME LOCATION
// ═══════════════════════════════════════════════════════════════════════════════

// PATCH /api/care-assistant/availability
// payload: { isOnline?: boolean, currentCity?: string, minNoticeMinutes?: number }
export const updateAvailability = createAsyncThunk(
  'careAssistant/updateAvailability',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch('/care-assistant/availability', payload);
      return data.data; // { availability, status, isDispatchable }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/location
// payload: { longitude: number, latitude: number }
export const updateLocation = createAsyncThunk(
  'careAssistant/updateLocation',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch('/care-assistant/location', payload);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/status
// payload: { status: 'Available' | 'On-Break' | 'Offline' }
export const updateStatus = createAsyncThunk(
  'careAssistant/updateStatus',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch('/care-assistant/status', payload);
      return data.data; // { status, availability.isOnline }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION G — BANK DETAILS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/care-assistant/bank
export const getBankDetails = createAsyncThunk(
  'careAssistant/getBankDetails',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/bank');
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PUT /api/care-assistant/bank
// payload: { accountHolderName?, accountNumber?, ifscCode?, bankName?, upiId? }
export const updateBankDetails = createAsyncThunk(
  'careAssistant/updateBankDetails',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put('/care-assistant/bank', payload);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION H — HEALTH DECLARATION
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /api/care-assistant/health-declaration
// payload: { isMedicallyFit: boolean, anyKnownConditions?: string }
export const updateHealthDeclaration = createAsyncThunk(
  'careAssistant/updateHealthDeclaration',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put('/care-assistant/health-declaration', payload);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION I — ONBOARDING WIZARD
// ═══════════════════════════════════════════════════════════════════════════════

// PATCH /api/care-assistant/onboarding/step
// payload: { step: number }
export const updateOnboardingStep = createAsyncThunk(
  'careAssistant/updateOnboardingStep',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch('/care-assistant/onboarding/step', payload);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/onboarding/complete
export const completeOnboarding = createAsyncThunk(
  'careAssistant/completeOnboarding',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.patch('/care-assistant/onboarding/complete');
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION J — SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/care-assistant/settings
export const getSettings = createAsyncThunk(
  'careAssistant/getSettings',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/settings');
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PUT /api/care-assistant/settings/notifications
// payload: { sms?: boolean, email?: boolean, push?: boolean, whatsapp?: boolean }
export const updateNotifPrefs = createAsyncThunk(
  'careAssistant/updateNotifPrefs',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put('/care-assistant/settings/notifications', payload);
      return data.data; // notifPrefs object
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PUT /api/care-assistant/settings/service-area
// payload: { preferredServiceAreas?: string[], maxServiceRadiusKm?: number }
export const updateServiceArea = createAsyncThunk(
  'careAssistant/updateServiceArea',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put('/care-assistant/settings/service-area', payload);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// POST /api/care-assistant/settings/device-token
// payload: { token: string }
export const registerDeviceToken = createAsyncThunk(
  'careAssistant/registerDeviceToken',
  async (payload, thunkAPI) => {
    try {
      await API.post('/care-assistant/settings/device-token', payload);
      return payload.token;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// DELETE /api/care-assistant/settings/device-token
// payload: { token: string }
export const removeDeviceToken = createAsyncThunk(
  'careAssistant/removeDeviceToken',
  async (payload, thunkAPI) => {
    try {
      await API.delete('/care-assistant/settings/device-token', { data: payload });
      return payload.token;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION K — SECURITY
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /api/care-assistant/security/change-password
// payload: { currentPassword, newPassword, confirmNewPassword }
export const changePassword = createAsyncThunk(
  'careAssistant/changePassword',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put('/care-assistant/security/change-password', payload);
      return data.message;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// POST /api/care-assistant/security/send-email-otp
export const sendEmailOtp = createAsyncThunk(
  'careAssistant/sendEmailOtp',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.post('/care-assistant/security/send-email-otp');
      return data.message;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// POST /api/care-assistant/security/verify-email-otp
// payload: { otp: string }
export const verifyEmailOtp = createAsyncThunk(
  'careAssistant/verifyEmailOtp',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.post('/care-assistant/security/verify-email-otp', payload);
      return data.message;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// GET /api/care-assistant/security/sessions
export const getSessions = createAsyncThunk(
  'careAssistant/getSessions',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/security/sessions');
      return data.data; // { sessions, lastLoginAt, lastLoginIp, loginCount, sessionCount }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// DELETE /api/care-assistant/security/sessions/:sessionId
export const revokeSession = createAsyncThunk(
  'careAssistant/revokeSession',
  async (sessionId, thunkAPI) => {
    try {
      const { data } = await API.delete(`/care-assistant/security/sessions/${sessionId}`);
      return data.data.sessions;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// DELETE /api/care-assistant/security/sessions  (revoke ALL except current)
export const revokeAllSessions = createAsyncThunk(
  'careAssistant/revokeAllSessions',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.delete('/care-assistant/security/sessions');
      return data.message;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// POST /api/care-assistant/security/request-account-deletion
export const requestAccountDeletion = createAsyncThunk(
  'careAssistant/requestAccountDeletion',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.post('/care-assistant/security/request-account-deletion');
      return data.message;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// DELETE /api/care-assistant/security/confirm-account-deletion
// payload: { otp: string, reason?: string }
export const confirmAccountDeletion = createAsyncThunk(
  'careAssistant/confirmAccountDeletion',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.delete(
        '/care-assistant/security/confirm-account-deletion',
        { data: payload }
      );
      return data.message;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION L — PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/care-assistant/performance
export const getPerformance = createAsyncThunk(
  'careAssistant/getPerformance',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/performance');
      return data.data; // { performance, earnings }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION M — ADMIN THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/care-assistant/admin/create
// payload: { fullName, email, phone?, alternatePhone?, dateOfBirth?, gender?,
//            address?, bio?, experienceYears?, specializations?, languagesKnown?, workType? }
export const adminCreateCareAssistant = createAsyncThunk(
  'careAssistant/adminCreateCareAssistant',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.post('/care-assistant/admin/create', payload);
      return data.data; // { user, profile }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// GET /api/care-assistant/admin/all
// payload (query params): { page?, limit?, status?, workType?, city?, kycStatus?,
//                           isActive?, isBlocked?, search?, sortBy?, sortOrder? }
export const adminGetAll = createAsyncThunk(
  'careAssistant/adminGetAll',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/admin/all', { params });
      return data; // { data: profiles[], pagination }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// GET /api/care-assistant/admin/stats/overview
export const adminGetStats = createAsyncThunk(
  'careAssistant/adminGetStats',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/admin/stats/overview');
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// GET /api/care-assistant/admin/nearby
// payload: { lng: number, lat: number, radiusKm?: number, status?: string }
export const adminGetNearby = createAsyncThunk(
  'careAssistant/adminGetNearby',
  async (params, thunkAPI) => {
    try {
      const { data } = await API.get('/care-assistant/admin/nearby', { params });
      return data; // { count, data: profiles[] }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// GET /api/care-assistant/admin/:id
export const adminGetOne = createAsyncThunk(
  'careAssistant/adminGetOne',
  async (id, thunkAPI) => {
    try {
      const { data } = await API.get(`/care-assistant/admin/${id}`);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/admin/:id/kyc
// payload: { id: string, action: 'approve'|'reject', rejectionReason?: string }
export const adminKycAction = createAsyncThunk(
  'careAssistant/adminKycAction',
  async ({ id, ...body }, thunkAPI) => {
    try {
      const { data } = await API.patch(`/care-assistant/admin/${id}/kyc`, body);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/admin/:id/police-verification
// payload: { id: string, status: 'Pending'|'Completed'|'Rejected',
//            backgroundCheckUrl?: string, backgroundCheckDate?: string }
export const adminPoliceVerification = createAsyncThunk(
  'careAssistant/adminPoliceVerification',
  async ({ id, ...body }, thunkAPI) => {
    try {
      const { data } = await API.patch(`/care-assistant/admin/${id}/police-verification`, body);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/admin/:id/block
// payload: { id: string, blockReason: string, unblockAt?: string }
export const adminBlockCA = createAsyncThunk(
  'careAssistant/adminBlockCA',
  async ({ id, ...body }, thunkAPI) => {
    try {
      const { data } = await API.patch(`/care-assistant/admin/${id}/block`, body);
      return { id, message: data.message };
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/admin/:id/unblock
export const adminUnblockCA = createAsyncThunk(
  'careAssistant/adminUnblockCA',
  async (id, thunkAPI) => {
    try {
      const { data } = await API.patch(`/care-assistant/admin/${id}/unblock`);
      return { id, message: data.message };
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/admin/:id/verify-certificate/:certId
// payload: { id: string, certId: string }
export const adminVerifyCertificate = createAsyncThunk(
  'careAssistant/adminVerifyCertificate',
  async ({ id, certId }, thunkAPI) => {
    try {
      const { data } = await API.patch(
        `/care-assistant/admin/${id}/verify-certificate/${certId}`
      );
      return data.data; // updated certificates array
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/admin/:id/performance
// payload: { id: string, ...performanceFields, ...earningsFields }
export const adminUpdatePerformance = createAsyncThunk(
  'careAssistant/adminUpdatePerformance',
  async ({ id, ...body }, thunkAPI) => {
    try {
      const { data } = await API.patch(`/care-assistant/admin/${id}/performance`, body);
      return data.data; // { performance, earnings }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/admin/:id/notes
// payload: { id: string, adminNotes?: string, tags?: string[] }
export const adminUpdateNotes = createAsyncThunk(
  'careAssistant/adminUpdateNotes',
  async ({ id, ...body }, thunkAPI) => {
    try {
      const { data } = await API.patch(`/care-assistant/admin/${id}/notes`, body);
      return data.data; // { adminNotes, tags }
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// PATCH /api/care-assistant/admin/:id/bank/verify
export const adminVerifyBank = createAsyncThunk(
  'careAssistant/adminVerifyBank',
  async (id, thunkAPI) => {
    try {
      const { data } = await API.patch(`/care-assistant/admin/${id}/bank/verify`);
      return data.data;
    } catch (error) {
      return rejectWithMsg(error, thunkAPI);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // ── My profile (care assistant self view) ───────────────────────────────────
  profile:             null,

  // ── KYC ─────────────────────────────────────────────────────────────────────
  kycStatus:           null,

  // ── Schedule ────────────────────────────────────────────────────────────────
  schedule:            null,

  // ── Settings ────────────────────────────────────────────────────────────────
  settings:            null,

  // ── Bank details (masked) ────────────────────────────────────────────────────
  bankDetails:         null,

  // ── Performance & earnings ───────────────────────────────────────────────────
  performance:         null,
  earnings:            null,

  // ── Security — sessions ─────────────────────────────────────────────────────
  sessions:            [],
  lastLoginAt:         null,
  lastLoginIp:         null,
  loginCount:          0,

  // ── ImageKit upload auth ─────────────────────────────────────────────────────
  uploadAuth:          null,

  // ── Admin — list view ────────────────────────────────────────────────────────
  adminList:           [],
  adminPagination:     { total: 0, page: 1, limit: 20, totalPages: 0 },
  adminSelected:       null,   // single profile loaded by adminGetOne
  adminStats:          null,
  adminNearby:         [],
  adminNearbyCount:    0,

  // ── Loading flags — granular per operation ───────────────────────────────────
  loading: {
    profile:             false,
    updateProfile:       false,
    uploadAuth:          false,
    uploadPhoto:         false,
    uploadDocument:      false,
    kyc:                 false,
    training:            false,
    schedule:            false,
    availability:        false,
    location:            false,
    status:              false,
    bank:                false,
    health:              false,
    onboarding:          false,
    settings:            false,
    security:            false,
    performance:         false,
    adminCreate:         false,
    adminList:           false,
    adminSingle:         false,
    adminAction:         false,
    adminStats:          false,
    adminNearby:         false,
  },

  // ── Error — granular per operation ──────────────────────────────────────────
  error: {
    profile:             null,
    updateProfile:       null,
    uploadAuth:          null,
    uploadPhoto:         null,
    uploadDocument:      null,
    kyc:                 null,
    training:            null,
    schedule:            null,
    availability:        null,
    location:            null,
    status:              null,
    bank:                null,
    health:              null,
    onboarding:          null,
    settings:            null,
    security:            null,
    performance:         null,
    adminCreate:         null,
    adminList:           null,
    adminSingle:         null,
    adminAction:         null,
    adminStats:          null,
    adminNearby:         null,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const careAssistantSlice = createSlice({
  name: 'careAssistant',
  initialState,
  reducers: {
    // Manually clear a specific error (e.g. on modal close)
    clearError: (state, action) => {
      const key = action.payload;
      if (key && state.error[key] !== undefined) {
        state.error[key] = null;
      }
    },
    // Clear all errors
    clearAllErrors: (state) => {
      Object.keys(state.error).forEach((k) => { state.error[k] = null; });
    },
    // Reset the entire slice (logout)
    resetCareAssistant: () => initialState,
    // Optimistic availability toggle (for instant UI feedback before server confirms)
    setOnlineOptimistic: (state, action) => {
      if (state.profile) {
        state.profile.availability = {
          ...(state.profile.availability || {}),
          isOnline: action.payload,
        };
        state.profile.status = action.payload ? 'Available' : 'Offline';
      }
    },
  },

  extraReducers: (builder) => {

    // ── Helper to register pending / rejected pairs cleanly ──────────────────
    const pending  = (key) => (state) => { state.loading[key] = true;  state.error[key] = null; };
    const rejected = (key) => (state, action) => {
      state.loading[key] = false;
      state.error[key]   = action.payload;
      toast.error(action.payload || 'An error occurred');
    };

    // ─────────────────────────────────────────────────────────────────────────
    // A — PROFILE
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(getProfile.pending,   pending('profile'))
      .addCase(getProfile.fulfilled, (state, action) => {
        state.loading.profile = false;
        state.profile         = action.payload;
      })
      .addCase(getProfile.rejected,  rejected('profile'));

    builder
      .addCase(updateProfile.pending,   pending('updateProfile'))
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading.updateProfile = false;
        state.profile               = action.payload;
        toast.success('Profile updated successfully');
      })
      .addCase(updateProfile.rejected,  rejected('updateProfile'));

    // ─────────────────────────────────────────────────────────────────────────
    // B — UPLOAD
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(getUploadAuth.pending,   pending('uploadAuth'))
      .addCase(getUploadAuth.fulfilled, (state, action) => {
        state.loading.uploadAuth = false;
        state.uploadAuth         = action.payload;
      })
      .addCase(getUploadAuth.rejected,  rejected('uploadAuth'));

    builder
      .addCase(uploadPhoto.pending,   pending('uploadPhoto'))
      .addCase(uploadPhoto.fulfilled, (state, action) => {
        state.loading.uploadPhoto = false;
        if (state.profile) {
          state.profile.photoUrl                  = action.payload.url;
          state.profile.profileCompletionPercent  = action.payload.profile?.profileCompletionPercent ?? state.profile.profileCompletionPercent;
        }
        toast.success('Photo uploaded successfully');
      })
      .addCase(uploadPhoto.rejected,  rejected('uploadPhoto'));

    builder
      .addCase(uploadDocument.pending,   pending('uploadDocument'))
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.loading.uploadDocument = false;
        // Update the kyc/verification completion percent if profile exists
        if (state.profile && action.payload.profile) {
          state.profile.profileCompletionPercent = action.payload.profile.profileCompletionPercent;
          // Reflect newly uploaded document URLs back into profile.kyc
          const { docType, url } = action.payload;
          const map = {
            aadhaar_front:       ['kyc', 'aadhaarFrontUrl'],
            aadhaar_back:        ['kyc', 'aadhaarBackUrl'],
            pan_card:            ['kyc', 'panCardUrl'],
            police_verification: ['verification', 'backgroundCheckUrl'],
          };
          if (map[docType]) {
            const [section, field] = map[docType];
            if (!state.profile[section]) state.profile[section] = {};
            state.profile[section][field] = url;
          }
        }
        toast.success(`Document uploaded successfully`);
      })
      .addCase(uploadDocument.rejected,  rejected('uploadDocument'));

    // ─────────────────────────────────────────────────────────────────────────
    // C — KYC
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(submitKyc.pending,   pending('kyc'))
      .addCase(submitKyc.fulfilled, (state, action) => {
        state.loading.kyc   = false;
        state.kycStatus     = action.payload;
        if (state.profile) {
          state.profile.kyc                      = { ...state.profile.kyc, ...action.payload };
          state.profile.profileCompletionPercent = action.payload.profileCompletionPercent ?? state.profile.profileCompletionPercent;
        }
        toast.success('KYC submitted for review');
      })
      .addCase(submitKyc.rejected,  rejected('kyc'));

    builder
      .addCase(getKycStatus.pending,   pending('kyc'))
      .addCase(getKycStatus.fulfilled, (state, action) => {
        state.loading.kyc = false;
        state.kycStatus   = action.payload;
      })
      .addCase(getKycStatus.rejected,  rejected('kyc'));

    // ─────────────────────────────────────────────────────────────────────────
    // D — TRAINING
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(updateTraining.pending,   pending('training'))
      .addCase(updateTraining.fulfilled, (state, action) => {
        state.loading.training = false;
        if (state.profile) {
          state.profile.training                 = action.payload.training;
          state.profile.profileCompletionPercent = action.payload.profileCompletionPercent ?? state.profile.profileCompletionPercent;
        }
        toast.success('Training details updated');
      })
      .addCase(updateTraining.rejected,  rejected('training'));

    builder
      .addCase(addCertificate.pending,   pending('training'))
      .addCase(addCertificate.fulfilled, (state, action) => {
        state.loading.training = false;
        if (state.profile?.training) {
          state.profile.training.certificates = action.payload;
        }
        toast.success('Certificate added');
      })
      .addCase(addCertificate.rejected,  rejected('training'));

    builder
      .addCase(deleteCertificate.pending,   pending('training'))
      .addCase(deleteCertificate.fulfilled, (state, action) => {
        state.loading.training = false;
        if (state.profile?.training) {
          state.profile.training.certificates = action.payload;
        }
        toast.success('Certificate removed');
      })
      .addCase(deleteCertificate.rejected,  rejected('training'));

    // ─────────────────────────────────────────────────────────────────────────
    // E — SCHEDULE
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(getSchedule.pending,   pending('schedule'))
      .addCase(getSchedule.fulfilled, (state, action) => {
        state.loading.schedule = false;
        state.schedule         = action.payload;
        if (state.profile) {
          state.profile.weeklySchedule = action.payload.weeklySchedule;
          state.profile.workType       = action.payload.workType;
        }
      })
      .addCase(getSchedule.rejected,  rejected('schedule'));

    builder
      .addCase(updateSchedule.pending,   pending('schedule'))
      .addCase(updateSchedule.fulfilled, (state, action) => {
        state.loading.schedule = false;
        state.schedule         = action.payload;
        if (state.profile) {
          state.profile.weeklySchedule           = action.payload.weeklySchedule;
          state.profile.workType                 = action.payload.workType;
          state.profile.profileCompletionPercent = action.payload.profileCompletionPercent ?? state.profile.profileCompletionPercent;
        }
        toast.success('Schedule updated');
      })
      .addCase(updateSchedule.rejected,  rejected('schedule'));

    // ─────────────────────────────────────────────────────────────────────────
    // F — AVAILABILITY / LOCATION / STATUS
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(updateAvailability.pending,   pending('availability'))
      .addCase(updateAvailability.fulfilled, (state, action) => {
        state.loading.availability = false;
        if (state.profile) {
          state.profile.availability = action.payload.availability;
          state.profile.status       = action.payload.status;
        }
      })
      .addCase(updateAvailability.rejected,  rejected('availability'));

    builder
      .addCase(updateLocation.pending,   pending('location'))
      .addCase(updateLocation.fulfilled, (state, action) => {
        state.loading.location = false;
        if (state.profile) {
          state.profile.location = action.payload.location;
        }
      })
      .addCase(updateLocation.rejected,  rejected('location'));

    builder
      .addCase(updateStatus.pending,   pending('status'))
      .addCase(updateStatus.fulfilled, (state, action) => {
        state.loading.status = false;
        if (state.profile) {
          state.profile.status                    = action.payload.status;
          state.profile.availability              = {
            ...(state.profile.availability || {}),
            isOnline: action.payload['availability.isOnline'] ?? action.payload.availability?.isOnline,
          };
        }
        toast.success(`Status set to ${action.payload.status}`);
      })
      .addCase(updateStatus.rejected,  rejected('status'));

    // ─────────────────────────────────────────────────────────────────────────
    // G — BANK DETAILS
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(getBankDetails.pending,   pending('bank'))
      .addCase(getBankDetails.fulfilled, (state, action) => {
        state.loading.bank = false;
        state.bankDetails  = action.payload;
      })
      .addCase(getBankDetails.rejected,  rejected('bank'));

    builder
      .addCase(updateBankDetails.pending,   pending('bank'))
      .addCase(updateBankDetails.fulfilled, (state, action) => {
        state.loading.bank = false;
        state.bankDetails  = action.payload;
        if (state.profile) {
          state.profile.profileCompletionPercent = action.payload.profileCompletionPercent ?? state.profile.profileCompletionPercent;
        }
        toast.success('Bank details saved');
      })
      .addCase(updateBankDetails.rejected,  rejected('bank'));

    // ─────────────────────────────────────────────────────────────────────────
    // H — HEALTH DECLARATION
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(updateHealthDeclaration.pending,   pending('health'))
      .addCase(updateHealthDeclaration.fulfilled, (state, action) => {
        state.loading.health = false;
        if (state.profile) {
          state.profile.healthDeclaration        = action.payload.healthDeclaration;
          state.profile.profileCompletionPercent = action.payload.profileCompletionPercent ?? state.profile.profileCompletionPercent;
        }
        toast.success('Health declaration saved');
      })
      .addCase(updateHealthDeclaration.rejected,  rejected('health'));

    // ─────────────────────────────────────────────────────────────────────────
    // I — ONBOARDING
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(updateOnboardingStep.pending,   pending('onboarding'))
      .addCase(updateOnboardingStep.fulfilled, (state, action) => {
        state.loading.onboarding = false;
        if (state.profile) {
          state.profile.onboarding               = action.payload.onboarding;
          state.profile.profileCompletionPercent = action.payload.profileCompletionPercent ?? state.profile.profileCompletionPercent;
        }
      })
      .addCase(updateOnboardingStep.rejected,  rejected('onboarding'));

    builder
      .addCase(completeOnboarding.pending,   pending('onboarding'))
      .addCase(completeOnboarding.fulfilled, (state, action) => {
        state.loading.onboarding = false;
        if (state.profile) {
          state.profile.onboarding               = action.payload.onboarding;
          state.profile.profileCompletionPercent = action.payload.profileCompletionPercent ?? state.profile.profileCompletionPercent;
        }
        toast.success('Onboarding completed! Welcome to Likeson.');
      })
      .addCase(completeOnboarding.rejected,  rejected('onboarding'));

    // ─────────────────────────────────────────────────────────────────────────
    // J — SETTINGS
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(getSettings.pending,   pending('settings'))
      .addCase(getSettings.fulfilled, (state, action) => {
        state.loading.settings = false;
        state.settings         = action.payload;
      })
      .addCase(getSettings.rejected,  rejected('settings'));

    builder
      .addCase(updateNotifPrefs.pending,   pending('settings'))
      .addCase(updateNotifPrefs.fulfilled, (state, action) => {
        state.loading.settings = false;
        if (state.settings) state.settings.notifPrefs = action.payload;
        if (state.profile)  state.profile.notifPrefs  = action.payload;
        toast.success('Notification preferences updated');
      })
      .addCase(updateNotifPrefs.rejected,  rejected('settings'));

    builder
      .addCase(updateServiceArea.pending,   pending('settings'))
      .addCase(updateServiceArea.fulfilled, (state, action) => {
        state.loading.settings = false;
        if (state.profile) {
          state.profile.preferredServiceAreas = action.payload.preferredServiceAreas;
          state.profile.maxServiceRadiusKm    = action.payload.maxServiceRadiusKm;
        }
        toast.success('Service area updated');
      })
      .addCase(updateServiceArea.rejected,  rejected('settings'));

    builder
      .addCase(registerDeviceToken.pending,   pending('settings'))
      .addCase(registerDeviceToken.fulfilled, (state) => {
        state.loading.settings = false;
      })
      .addCase(registerDeviceToken.rejected,  rejected('settings'));

    builder
      .addCase(removeDeviceToken.pending,   pending('settings'))
      .addCase(removeDeviceToken.fulfilled, (state) => {
        state.loading.settings = false;
      })
      .addCase(removeDeviceToken.rejected,  rejected('settings'));

    // ─────────────────────────────────────────────────────────────────────────
    // K — SECURITY
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(changePassword.pending,   pending('security'))
      .addCase(changePassword.fulfilled, (state) => {
        state.loading.security = false;
        toast.success('Password changed successfully');
      })
      .addCase(changePassword.rejected,  rejected('security'));

    builder
      .addCase(sendEmailOtp.pending,   pending('security'))
      .addCase(sendEmailOtp.fulfilled, (state) => {
        state.loading.security = false;
        toast.success('OTP sent to your email');
      })
      .addCase(sendEmailOtp.rejected,  rejected('security'));

    builder
      .addCase(verifyEmailOtp.pending,   pending('security'))
      .addCase(verifyEmailOtp.fulfilled, (state) => {
        state.loading.security = false;
        toast.success('Email verified successfully');
      })
      .addCase(verifyEmailOtp.rejected,  rejected('security'));

    builder
      .addCase(getSessions.pending,   pending('security'))
      .addCase(getSessions.fulfilled, (state, action) => {
        state.loading.security = false;
        state.sessions         = action.payload.sessions;
        state.lastLoginAt      = action.payload.lastLoginAt;
        state.lastLoginIp      = action.payload.lastLoginIp;
        state.loginCount       = action.payload.loginCount;
      })
      .addCase(getSessions.rejected,  rejected('security'));

    builder
      .addCase(revokeSession.pending,   pending('security'))
      .addCase(revokeSession.fulfilled, (state, action) => {
        state.loading.security = false;
        state.sessions         = action.payload;
        toast.success('Session revoked');
      })
      .addCase(revokeSession.rejected,  rejected('security'));

    builder
      .addCase(revokeAllSessions.pending,   pending('security'))
      .addCase(revokeAllSessions.fulfilled, (state) => {
        state.loading.security = false;
        // Keep only 1 session (the current one — handled server-side)
        if (state.sessions.length > 1) state.sessions = [state.sessions[0]];
        toast.success('All other sessions revoked');
      })
      .addCase(revokeAllSessions.rejected,  rejected('security'));

    builder
      .addCase(requestAccountDeletion.pending,   pending('security'))
      .addCase(requestAccountDeletion.fulfilled, (state) => {
        state.loading.security = false;
        toast.success('Deletion OTP sent to your email');
      })
      .addCase(requestAccountDeletion.rejected,  rejected('security'));

    builder
      .addCase(confirmAccountDeletion.pending,   pending('security'))
      .addCase(confirmAccountDeletion.fulfilled, (state) => {
        // Clear everything on successful deletion
        Object.assign(state, initialState);
        toast.success('Your account has been deleted');
      })
      .addCase(confirmAccountDeletion.rejected,  rejected('security'));

    // ─────────────────────────────────────────────────────────────────────────
    // L — PERFORMANCE
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(getPerformance.pending,   pending('performance'))
      .addCase(getPerformance.fulfilled, (state, action) => {
        state.loading.performance = false;
        state.performance         = action.payload.performance;
        state.earnings            = action.payload.earnings;
      })
      .addCase(getPerformance.rejected,  rejected('performance'));

    // ─────────────────────────────────────────────────────────────────────────
    // M — ADMIN
    // ─────────────────────────────────────────────────────────────────────────

    builder
      .addCase(adminCreateCareAssistant.pending,   pending('adminCreate'))
      .addCase(adminCreateCareAssistant.fulfilled, (state, action) => {
        state.loading.adminCreate = false;
        // Prepend new profile to admin list if already loaded
        if (state.adminList.length) {
          state.adminList.unshift(action.payload.profile);
          state.adminPagination.total += 1;
        }
        toast.success('Care assistant account created. Welcome email sent.');
      })
      .addCase(adminCreateCareAssistant.rejected,  rejected('adminCreate'));

    builder
      .addCase(adminGetAll.pending,   pending('adminList'))
      .addCase(adminGetAll.fulfilled, (state, action) => {
        state.loading.adminList    = false;
        state.adminList            = action.payload.data;
        state.adminPagination      = action.payload.pagination;
      })
      .addCase(adminGetAll.rejected,  rejected('adminList'));

    builder
      .addCase(adminGetStats.pending,   pending('adminStats'))
      .addCase(adminGetStats.fulfilled, (state, action) => {
        state.loading.adminStats = false;
        state.adminStats         = action.payload;
      })
      .addCase(adminGetStats.rejected,  rejected('adminStats'));

    builder
      .addCase(adminGetNearby.pending,   pending('adminNearby'))
      .addCase(adminGetNearby.fulfilled, (state, action) => {
        state.loading.adminNearby = false;
        state.adminNearby         = action.payload.data;
        state.adminNearbyCount    = action.payload.count;
      })
      .addCase(adminGetNearby.rejected,  rejected('adminNearby'));

    builder
      .addCase(adminGetOne.pending,   pending('adminSingle'))
      .addCase(adminGetOne.fulfilled, (state, action) => {
        state.loading.adminSingle = false;
        state.adminSelected       = action.payload;
      })
      .addCase(adminGetOne.rejected,  rejected('adminSingle'));

    builder
      .addCase(adminKycAction.pending,   pending('adminAction'))
      .addCase(adminKycAction.fulfilled, (state, action) => {
        state.loading.adminAction = false;
        // Sync into selected and list
        if (state.adminSelected) {
          state.adminSelected.kyc                = action.payload.kyc ?? state.adminSelected.kyc;
          state.adminSelected.isActive           = action.payload.isActive ?? state.adminSelected.isActive;
          state.adminSelected.verification       = action.payload.verification ?? state.adminSelected.verification;
        }
        const idx = state.adminList.findIndex((p) => p._id === action.payload._id);
        if (idx !== -1) state.adminList[idx] = { ...state.adminList[idx], ...action.payload };
        toast.success(`KYC action applied`);
      })
      .addCase(adminKycAction.rejected,  rejected('adminAction'));

    builder
      .addCase(adminPoliceVerification.pending,   pending('adminAction'))
      .addCase(adminPoliceVerification.fulfilled, (state, action) => {
        state.loading.adminAction = false;
        if (state.adminSelected) {
          state.adminSelected.verification = action.payload.verification;
        }
        const idx = state.adminList.findIndex((p) => p._id === action.payload._id);
        if (idx !== -1) state.adminList[idx] = { ...state.adminList[idx], ...action.payload };
        toast.success('Police verification updated');
      })
      .addCase(adminPoliceVerification.rejected,  rejected('adminAction'));

    builder
      .addCase(adminBlockCA.pending,   pending('adminAction'))
      .addCase(adminBlockCA.fulfilled, (state, action) => {
        state.loading.adminAction = false;
        const { id } = action.payload;
        if (state.adminSelected?._id === id) {
          state.adminSelected.isBlocked = true;
          state.adminSelected.status    = 'Suspended';
        }
        const idx = state.adminList.findIndex((p) => p._id === id);
        if (idx !== -1) {
          state.adminList[idx].isBlocked = true;
          state.adminList[idx].status    = 'Suspended';
        }
        toast.success('Care assistant suspended');
      })
      .addCase(adminBlockCA.rejected,  rejected('adminAction'));

    builder
      .addCase(adminUnblockCA.pending,   pending('adminAction'))
      .addCase(adminUnblockCA.fulfilled, (state, action) => {
        state.loading.adminAction = false;
        const { id } = action.payload;
        if (state.adminSelected?._id === id) {
          state.adminSelected.isBlocked = false;
          state.adminSelected.status    = 'Offline';
        }
        const idx = state.adminList.findIndex((p) => p._id === id);
        if (idx !== -1) {
          state.adminList[idx].isBlocked = false;
          state.adminList[idx].status    = 'Offline';
        }
        toast.success('Care assistant unblocked');
      })
      .addCase(adminUnblockCA.rejected,  rejected('adminAction'));

    builder
      .addCase(adminVerifyCertificate.pending,   pending('adminAction'))
      .addCase(adminVerifyCertificate.fulfilled, (state, action) => {
        state.loading.adminAction = false;
        if (state.adminSelected?.training) {
          state.adminSelected.training.certificates = action.payload;
        }
        toast.success('Certificate verified');
      })
      .addCase(adminVerifyCertificate.rejected,  rejected('adminAction'));

    builder
      .addCase(adminUpdatePerformance.pending,   pending('adminAction'))
      .addCase(adminUpdatePerformance.fulfilled, (state, action) => {
        state.loading.adminAction = false;
        if (state.adminSelected) {
          state.adminSelected.performance = action.payload.performance;
          state.adminSelected.earnings    = action.payload.earnings;
        }
        toast.success('Performance updated');
      })
      .addCase(adminUpdatePerformance.rejected,  rejected('adminAction'));

    builder
      .addCase(adminUpdateNotes.pending,   pending('adminAction'))
      .addCase(adminUpdateNotes.fulfilled, (state, action) => {
        state.loading.adminAction = false;
        if (state.adminSelected) {
          state.adminSelected.adminNotes = action.payload.adminNotes;
          state.adminSelected.tags       = action.payload.tags;
        }
        toast.success('Notes updated');
      })
      .addCase(adminUpdateNotes.rejected,  rejected('adminAction'));

    builder
      .addCase(adminVerifyBank.pending,   pending('adminAction'))
      .addCase(adminVerifyBank.fulfilled, (state, action) => {
        state.loading.adminAction = false;
        if (state.adminSelected) {
          state.adminSelected.bankDetails = {
            ...state.adminSelected.bankDetails,
            ...action.payload,
          };
        }
        toast.success('Bank account verified');
      })
      .addCase(adminVerifyBank.rejected,  rejected('adminAction'));
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const {
  clearError,
  clearAllErrors,
  resetCareAssistant,
  setOnlineOptimistic,
} = careAssistantSlice.actions;

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Self (care assistant) ────────────────────────────────────────────────────
export const selectProfile            = (state) => state.careAssistant.profile;
export const selectKycStatus          = (state) => state.careAssistant.kycStatus;
export const selectSchedule           = (state) => state.careAssistant.schedule;
export const selectSettings           = (state) => state.careAssistant.settings;
export const selectBankDetails        = (state) => state.careAssistant.bankDetails;
export const selectPerformance        = (state) => state.careAssistant.performance;
export const selectEarnings           = (state) => state.careAssistant.earnings;
export const selectUploadAuth         = (state) => state.careAssistant.uploadAuth;
export const selectSessions           = (state) => state.careAssistant.sessions;
export const selectLastLoginAt        = (state) => state.careAssistant.lastLoginAt;
export const selectLastLoginIp        = (state) => state.careAssistant.lastLoginIp;
export const selectLoginCount         = (state) => state.careAssistant.loginCount;
export const selectIsOnline           = (state) => state.careAssistant.profile?.availability?.isOnline ?? false;
export const selectCurrentStatus      = (state) => state.careAssistant.profile?.status ?? 'Offline';
export const selectProfileCompletion  = (state) => state.careAssistant.profile?.profileCompletionPercent ?? 0;
export const selectIsDispatchable     = (state) => state.careAssistant.profile?.isDispatchable ?? false;

// ── Admin ────────────────────────────────────────────────────────────────────
export const selectAdminList          = (state) => state.careAssistant.adminList;
export const selectAdminPagination    = (state) => state.careAssistant.adminPagination;
export const selectAdminSelected      = (state) => state.careAssistant.adminSelected;
export const selectAdminStats         = (state) => state.careAssistant.adminStats;
export const selectAdminNearby        = (state) => state.careAssistant.adminNearby;
export const selectAdminNearbyCount   = (state) => state.careAssistant.adminNearbyCount;

// ── Loading ──────────────────────────────────────────────────────────────────
export const selectLoading            = (state) => state.careAssistant.loading;
export const selectLoadingKey         = (key)   => (state) => state.careAssistant.loading[key] ?? false;

// ── Errors ───────────────────────────────────────────────────────────────────
export const selectErrors             = (state) => state.careAssistant.error;
export const selectErrorKey           = (key)   => (state) => state.careAssistant.error[key] ?? null;

export default careAssistantSlice.reducer;