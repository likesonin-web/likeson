/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * transportPartnerSlice.js — Likeson.in
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Production Redux Toolkit slice covering ALL routes in TransportPartnerRoutes.js
 *
 *  §A  Transport Partner — own profile, KYC, settings, security
 *  §B  Transport Partner — vehicle management
 *  §C  Transport Partner — driver management
 *  §D  Transport Partner — bank & settlement
 *  §E  Transport Partner — service zones & pricing
 *  §G  Transport Partner — dashboard stats & activity logs
 *  §H  Driver — own profile, KYC, shift, location, status, rewards, bank, logs
 *        + photo, emergency, notifs, performance, coins, certs, kyc-doc,
 *          kyc-licence, medical-fitness, compliance, onboarding
 *  §I  Admin — partner management (list, create, update, status, kyc, notes, delete)
 *  §J  Admin — vehicle verification
 *  §K  Admin — driver management (platform-wide)
 *  §L  Admin — pricing / platform-fee overrides / settlement
 *  §M  Admin — system logs & stats
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Unwrap axios response payload. */
const unwrap = (res) => res.data;

/** Extract error message from axios error and call rejectWithValue. */
const rejectWith = (error, rejectWithValue) => {
  const msg =
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong';
  return rejectWithValue(msg);
};

// ═════════════════════════════════════════════════════════════════════════════
// §A  TRANSPORT PARTNER — OWN PROFILE, KYC, SETTINGS, SECURITY
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/profile */
export const fetchTPProfile = createAsyncThunk(
  'transportPartner/fetchTPProfile',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/profile'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/profile */
export const updateTPProfile = createAsyncThunk(
  'transportPartner/updateTPProfile',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/profile', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PUT /api/transport/kyc */
export const submitTPKyc = createAsyncThunk(
  'transportPartner/submitTPKyc',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.put('/transport/kyc', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/kyc/status */
export const fetchTPKycStatus = createAsyncThunk(
  'transportPartner/fetchTPKycStatus',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/kyc/status'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/settings/notifications */
export const updateTPNotifications = createAsyncThunk(
  'transportPartner/updateTPNotifications',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/settings/notifications', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/settings/availability */
export const updateTPAvailability = createAsyncThunk(
  'transportPartner/updateTPAvailability',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/settings/availability', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/settings/settlement-cycle */
export const updateTPSettlementCycle = createAsyncThunk(
  'transportPartner/updateTPSettlementCycle',
  async ({ settlementCycle }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/settings/settlement-cycle', { settlementCycle }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/security/sessions */
export const fetchTPSessions = createAsyncThunk(
  'transportPartner/fetchTPSessions',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/security/sessions'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/security/sessions/:sessionId */
export const revokeTPSession = createAsyncThunk(
  'transportPartner/revokeTPSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.delete(`/transport/security/sessions/${sessionId}`));
      return { ...res, sessionId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/security/sessions — revoke ALL */
export const revokeAllTPSessions = createAsyncThunk(
  'transportPartner/revokeAllTPSessions',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.delete('/transport/security/sessions'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/security/device-tokens/:tokenId */
export const removeTPDeviceToken = createAsyncThunk(
  'transportPartner/removeTPDeviceToken',
  async (tokenId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.delete(`/transport/security/device-tokens/${tokenId}`));
      return { ...res, tokenId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §B  TRANSPORT PARTNER — VEHICLE MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/vehicles */
export const fetchTPVehicles = createAsyncThunk(
  'transportPartner/fetchTPVehicles',
  async (params = {}, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/vehicles', { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/vehicles/:vehicleId */
export const fetchTPVehicleById = createAsyncThunk(
  'transportPartner/fetchTPVehicleById',
  async (vehicleId, { rejectWithValue }) => {
    try {
      return unwrap(await API.get(`/transport/vehicles/${vehicleId}`));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** POST /api/transport/vehicles */
export const addTPVehicle = createAsyncThunk(
  'transportPartner/addTPVehicle',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.post('/transport/vehicles', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/vehicles/:vehicleId */
export const updateTPVehicle = createAsyncThunk(
  'transportPartner/updateTPVehicle',
  async ({ vehicleId, data }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch(`/transport/vehicles/${vehicleId}`, data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/vehicles/:vehicleId */
export const deleteTPVehicle = createAsyncThunk(
  'transportPartner/deleteTPVehicle',
  async ({ vehicleId, hard = false }, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.delete(`/transport/vehicles/${vehicleId}`, { params: { hard } }));
      return { ...res, vehicleId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/vehicles/:vehicleId/assign-driver */
export const assignDriverToVehicle = createAsyncThunk(
  'transportPartner/assignDriverToVehicle',
  async ({ vehicleId, driverId }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch(`/transport/vehicles/${vehicleId}/assign-driver`, { driverId }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/vehicles/:vehicleId/unassign-driver */
export const unassignDriverFromVehicle = createAsyncThunk(
  'transportPartner/unassignDriverFromVehicle',
  async (vehicleId, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch(`/transport/vehicles/${vehicleId}/unassign-driver`));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** POST /api/transport/vehicles/:vehicleId/photos */
export const addTPVehiclePhotos = createAsyncThunk(
  'transportPartner/addTPVehiclePhotos',
  async ({ vehicleId, photoUrls }, { rejectWithValue }) => {
    try {
      return unwrap(await API.post(`/transport/vehicles/${vehicleId}/photos`, { photoUrls }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §C  TRANSPORT PARTNER — DRIVER MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/drivers */
export const fetchTPDrivers = createAsyncThunk(
  'transportPartner/fetchTPDrivers',
  async (params = {}, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/drivers', { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/drivers/:driverId */
export const fetchTPDriverById = createAsyncThunk(
  'transportPartner/fetchTPDriverById',
  async (driverId, { rejectWithValue }) => {
    try {
      return unwrap(await API.get(`/transport/drivers/${driverId}`));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** POST /api/transport/drivers */
export const registerTPDriver = createAsyncThunk(
  'transportPartner/registerTPDriver',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.post('/transport/drivers', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/drivers/:driverId */
export const updateTPDriver = createAsyncThunk(
  'transportPartner/updateTPDriver',
  async ({ driverId, data }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch(`/transport/drivers/${driverId}`, data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/drivers/:driverId/toggle-active */
export const toggleTPDriverActive = createAsyncThunk(
  'transportPartner/toggleTPDriverActive',
  async (driverId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.patch(`/transport/drivers/${driverId}/toggle-active`));
      return { ...res, driverId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/drivers/:driverId/pause */
export const pauseTPDriver = createAsyncThunk(
  'transportPartner/pauseTPDriver',
  async ({ driverId, pauseReason, pausedUntil }, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.patch(`/transport/drivers/${driverId}/pause`, { pauseReason, pausedUntil }));
      return { ...res, driverId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/drivers/:driverId/unpause */
export const unpauseTPDriver = createAsyncThunk(
  'transportPartner/unpauseTPDriver',
  async (driverId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.patch(`/transport/drivers/${driverId}/unpause`));
      return { ...res, driverId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/drivers/:driverId */
export const removeTPDriver = createAsyncThunk(
  'transportPartner/removeTPDriver',
  async (driverId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.delete(`/transport/drivers/${driverId}`));
      return { ...res, driverId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/drivers/:driverId/performance */
export const fetchTPDriverPerformance = createAsyncThunk(
  'transportPartner/fetchTPDriverPerformance',
  async (driverId, { rejectWithValue }) => {
    try {
      return unwrap(await API.get(`/transport/drivers/${driverId}/performance`));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/drivers/:driverId/logs */
export const fetchTPDriverLogs = createAsyncThunk(
  'transportPartner/fetchTPDriverLogs',
  async ({ driverId, params = {} }, { rejectWithValue }) => {
    try {
      return unwrap(await API.get(`/transport/drivers/${driverId}/logs`, { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §D  TRANSPORT PARTNER — BANK & SETTLEMENT
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/bank */
export const fetchTPBankDetails = createAsyncThunk(
  'transportPartner/fetchTPBankDetails',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/bank'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** POST /api/transport/bank/accounts */
export const addTPBankAccount = createAsyncThunk(
  'transportPartner/addTPBankAccount',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.post('/transport/bank/accounts', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/bank/accounts/:accountId/set-primary */
export const setTPPrimaryBankAccount = createAsyncThunk(
  'transportPartner/setTPPrimaryBankAccount',
  async (accountId, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch(`/transport/bank/accounts/${accountId}/set-primary`));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/bank/accounts/:accountId */
export const removeTPBankAccount = createAsyncThunk(
  'transportPartner/removeTPBankAccount',
  async (accountId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.delete(`/transport/bank/accounts/${accountId}`));
      return { ...res, accountId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** POST /api/transport/bank/upi */
export const addTPUpiHandle = createAsyncThunk(
  'transportPartner/addTPUpiHandle',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.post('/transport/bank/upi', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/bank/upi/:upiId */
export const removeTPUpiHandle = createAsyncThunk(
  'transportPartner/removeTPUpiHandle',
  async (upiId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.delete(`/transport/bank/upi/${upiId}`));
      return { ...res, upiId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/bank/preferred-method */
export const updateTPPreferredSettlementMethod = createAsyncThunk(
  'transportPartner/updateTPPreferredSettlementMethod',
  async ({ method }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/bank/preferred-method', { method }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §E  TRANSPORT PARTNER — SERVICE ZONES & PRICING
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/zones */
export const fetchTPZones = createAsyncThunk(
  'transportPartner/fetchTPZones',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/zones'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** POST /api/transport/zones */
export const addTPZone = createAsyncThunk(
  'transportPartner/addTPZone',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.post('/transport/zones', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/zones/:zoneId */
export const updateTPZone = createAsyncThunk(
  'transportPartner/updateTPZone',
  async ({ zoneId, data }, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.patch(`/transport/zones/${zoneId}`, data));
      return { ...res, zoneId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/zones/:zoneId */
export const removeTPZone = createAsyncThunk(
  'transportPartner/removeTPZone',
  async (zoneId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.delete(`/transport/zones/${zoneId}`));
      return { ...res, zoneId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/pricing */
export const fetchTPPricing = createAsyncThunk(
  'transportPartner/fetchTPPricing',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/pricing'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/pricing */
export const updateTPPricing = createAsyncThunk(
  'transportPartner/updateTPPricing',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/pricing', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §G  TRANSPORT PARTNER — DASHBOARD STATS & ACTIVITY LOGS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/dashboard */
export const fetchTPDashboard = createAsyncThunk(
  'transportPartner/fetchTPDashboard',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/dashboard'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/logs */
export const fetchTPLogs = createAsyncThunk(
  'transportPartner/fetchTPLogs',
  async (params = {}, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/logs', { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §H  DRIVER — OWN PROFILE, KYC, SHIFT, LOCATION, STATUS, REWARDS, BANK, LOGS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/driver/me */
export const fetchDriverMe = createAsyncThunk(
  'transportPartner/fetchDriverMe',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/driver/me'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/driver/me */
export const updateDriverMe = createAsyncThunk(
  'transportPartner/updateDriverMe',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/driver/me', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/driver/me/photo */
export const updateDriverPhoto = createAsyncThunk(
  'transportPartner/updateDriverPhoto',
  async ({ photoUrl }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/driver/me/photo', { photoUrl }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/driver/me/photo */
export const removeDriverPhoto = createAsyncThunk(
  'transportPartner/removeDriverPhoto',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.delete('/transport/driver/me/photo'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/driver/me/emergency */
export const updateDriverEmergencyContact = createAsyncThunk(
  'transportPartner/updateDriverEmergencyContact',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/driver/me/emergency', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/driver/me/notifs */
export const updateDriverNotifPrefs = createAsyncThunk(
  'transportPartner/updateDriverNotifPrefs',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/driver/me/notifs', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/driver/me/performance */
export const fetchDriverOwnPerformance = createAsyncThunk(
  'transportPartner/fetchDriverOwnPerformance',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/driver/me/performance'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/driver/me/coins */
export const fetchDriverCoinHistory = createAsyncThunk(
  'transportPartner/fetchDriverCoinHistory',
  async (params = {}, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/driver/me/coins', { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** POST /api/transport/driver/me/certs */
export const addDriverCertificate = createAsyncThunk(
  'transportPartner/addDriverCertificate',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.post('/transport/driver/me/certs', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/driver/me/certs/:certId */
export const removeDriverCertificate = createAsyncThunk(
  'transportPartner/removeDriverCertificate',
  async (certId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.delete(`/transport/driver/me/certs/${certId}`));
      return { ...res, certId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PUT /api/transport/driver/kyc */
export const submitDriverKyc = createAsyncThunk(
  'transportPartner/submitDriverKyc',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.put('/transport/driver/kyc', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/driver/kyc/document */
export const reuploadDriverKycDocument = createAsyncThunk(
  'transportPartner/reuploadDriverKycDocument',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/driver/kyc/document', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/driver/kyc/licence-numbers */
export const updateDriverLicenceNumbers = createAsyncThunk(
  'transportPartner/updateDriverLicenceNumbers',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/driver/kyc/licence-numbers', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PUT /api/transport/driver/medical-fitness */
export const updateDriverMedicalFitness = createAsyncThunk(
  'transportPartner/updateDriverMedicalFitness',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.put('/transport/driver/medical-fitness', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/driver/me/compliance */
export const fetchDriverCompliance = createAsyncThunk(
  'transportPartner/fetchDriverCompliance',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/driver/me/compliance'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/driver/onboarding */
export const updateDriverOnboarding = createAsyncThunk(
  'transportPartner/updateDriverOnboarding',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/driver/onboarding', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** POST /api/transport/driver/onboarding/complete */
export const completeDriverOnboarding = createAsyncThunk(
  'transportPartner/completeDriverOnboarding',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.post('/transport/driver/onboarding/complete'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/driver/shift */
export const updateDriverShift = createAsyncThunk(
  'transportPartner/updateDriverShift',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/driver/shift', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/driver/status */
export const updateDriverStatus = createAsyncThunk(
  'transportPartner/updateDriverStatus',
  async ({ status }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/driver/status', { status }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/driver/location */
export const updateDriverLocation = createAsyncThunk(
  'transportPartner/updateDriverLocation',
  async ({ lng, lat, heading, speedKmh }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/driver/location', { lng, lat, heading, speedKmh }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/driver/rewards */
export const fetchDriverRewards = createAsyncThunk(
  'transportPartner/fetchDriverRewards',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/driver/rewards'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PUT /api/transport/driver/bank */
export const updateDriverBank = createAsyncThunk(
  'transportPartner/updateDriverBank',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.put('/transport/driver/bank', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/driver/logs */
export const fetchDriverLogs = createAsyncThunk(
  'transportPartner/fetchDriverLogs',
  async (params = {}, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/driver/logs', { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §I  ADMIN — PARTNER MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/admin/partners */
export const adminFetchPartners = createAsyncThunk(
  'transportPartner/adminFetchPartners',
  async (params = {}, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/admin/partners', { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/admin/partners/:partnerId */
export const adminFetchPartnerById = createAsyncThunk(
  'transportPartner/adminFetchPartnerById',
  async (partnerId, { rejectWithValue }) => {
    try {
      return unwrap(await API.get(`/transport/admin/partners/${partnerId}`));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** POST /api/transport/admin/partners */
export const adminCreatePartner = createAsyncThunk(
  'transportPartner/adminCreatePartner',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.post('/transport/admin/partners', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/partners/:partnerId */
export const adminUpdatePartner = createAsyncThunk(
  'transportPartner/adminUpdatePartner',
  async ({ partnerId, data }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch(`/transport/admin/partners/${partnerId}`, data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/partners/:partnerId/status */
export const adminUpdatePartnerStatus = createAsyncThunk(
  'transportPartner/adminUpdatePartnerStatus',
  async ({ partnerId, status, reason }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch(`/transport/admin/partners/${partnerId}/status`, { status, reason }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/partners/:partnerId/kyc */
export const adminUpdatePartnerKyc = createAsyncThunk(
  'transportPartner/adminUpdatePartnerKyc',
  async ({ partnerId, ...data }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch(`/transport/admin/partners/${partnerId}/kyc`, data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/partners/:partnerId/internal-notes */
export const adminUpdatePartnerNotes = createAsyncThunk(
  'transportPartner/adminUpdatePartnerNotes',
  async ({ partnerId, notes }, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch(`/transport/admin/partners/${partnerId}/internal-notes`, { notes }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/admin/partners/:partnerId */
export const adminDeletePartner = createAsyncThunk(
  'transportPartner/adminDeletePartner',
  async (partnerId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.delete(`/transport/admin/partners/${partnerId}`));
      return { ...res, partnerId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/admin/partners/:partnerId/logs */
export const adminFetchPartnerLogs = createAsyncThunk(
  'transportPartner/adminFetchPartnerLogs',
  async ({ partnerId, params = {} }, { rejectWithValue }) => {
    try {
      return unwrap(await API.get(`/transport/admin/partners/${partnerId}/logs`, { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §J  ADMIN — VEHICLE VERIFICATION
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/admin/vehicles/pending */
export const adminFetchPendingVehicles = createAsyncThunk(
  'transportPartner/adminFetchPendingVehicles',
  async (params = {}, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/admin/vehicles/pending', { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/vehicles/:partnerId/:vehicleId/verify */
export const adminVerifyVehicle = createAsyncThunk(
  'transportPartner/adminVerifyVehicle',
  async ({ partnerId, vehicleId, verificationStatus, rejectionReason }, { rejectWithValue }) => {
    try {
      const res = unwrap(
        await API.patch(`/transport/admin/vehicles/${partnerId}/${vehicleId}/verify`, {
          verificationStatus,
          rejectionReason,
        })
      );
      return { ...res, partnerId, vehicleId, verificationStatus };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §K  ADMIN — DRIVER MANAGEMENT (PLATFORM-WIDE)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/transport/admin/drivers/available
 * NOTE: Must call before adminFetchDriverById to avoid Express route ordering collision.
 */
export const adminFetchAvailableDrivers = createAsyncThunk(
  'transportPartner/adminFetchAvailableDrivers',
  async (params, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/admin/drivers/available', { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/admin/drivers */
export const adminFetchAllDrivers = createAsyncThunk(
  'transportPartner/adminFetchAllDrivers',
  async (params = {}, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/admin/drivers', { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/admin/drivers/:driverId */
export const adminFetchDriverById = createAsyncThunk(
  'transportPartner/adminFetchDriverById',
  async (driverId, { rejectWithValue }) => {
    try {
      return unwrap(await API.get(`/transport/admin/drivers/${driverId}`));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/drivers/:driverId/kyc */
export const adminVerifyDriverKyc = createAsyncThunk(
  'transportPartner/adminVerifyDriverKyc',
  async ({ driverId, verificationStatus, rejectionReason }, { rejectWithValue }) => {
    try {
      const res = unwrap(
        await API.patch(`/transport/admin/drivers/${driverId}/kyc`, { verificationStatus, rejectionReason })
      );
      return { ...res, driverId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/drivers/:driverId/block */
export const adminBlockDriver = createAsyncThunk(
  'transportPartner/adminBlockDriver',
  async ({ driverId, blockReason }, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.patch(`/transport/admin/drivers/${driverId}/block`, { blockReason }));
      return { ...res, driverId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/drivers/:driverId/unblock */
export const adminUnblockDriver = createAsyncThunk(
  'transportPartner/adminUnblockDriver',
  async (driverId, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.patch(`/transport/admin/drivers/${driverId}/unblock`));
      return { ...res, driverId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/drivers/:driverId/admin-notes */
export const adminUpdateDriverNotes = createAsyncThunk(
  'transportPartner/adminUpdateDriverNotes',
  async ({ driverId, notes }, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.patch(`/transport/admin/drivers/${driverId}/admin-notes`, { notes }));
      return { ...res, driverId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** POST /api/transport/admin/drivers/:driverId/coins */
export const adminAdjustDriverCoins = createAsyncThunk(
  'transportPartner/adminAdjustDriverCoins',
  async ({ driverId, type, amount, description }, { rejectWithValue }) => {
    try {
      const res = unwrap(
        await API.post(`/transport/admin/drivers/${driverId}/coins`, { type, amount, description })
      );
      return { ...res, driverId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/admin/drivers/:driverId/logs */
export const adminFetchDriverLogs = createAsyncThunk(
  'transportPartner/adminFetchDriverLogs',
  async ({ driverId, params = {} }, { rejectWithValue }) => {
    try {
      return unwrap(await API.get(`/transport/admin/drivers/${driverId}/logs`, { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §L  ADMIN — PRICING / PLATFORM-FEE OVERRIDES / SETTLEMENT
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/admin/pricing/global */
export const adminFetchGlobalPricing = createAsyncThunk(
  'transportPartner/adminFetchGlobalPricing',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/admin/pricing/global'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/pricing/global — superadmin only */
export const adminUpdateGlobalPricing = createAsyncThunk(
  'transportPartner/adminUpdateGlobalPricing',
  async (data, { rejectWithValue }) => {
    try {
      return unwrap(await API.patch('/transport/admin/pricing/global', data));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/partners/:partnerId/platform-fee */
export const adminSetPartnerPlatformFee = createAsyncThunk(
  'transportPartner/adminSetPartnerPlatformFee',
  async ({ partnerId, type, value, clear }, { rejectWithValue }) => {
    try {
      const res = unwrap(
        await API.patch(`/transport/admin/partners/${partnerId}/platform-fee`, { type, value, clear })
      );
      return { ...res, partnerId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/partners/:partnerId/settlement */
export const adminProcessPartnerSettlement = createAsyncThunk(
  'transportPartner/adminProcessPartnerSettlement',
  async ({ partnerId, amount }, { rejectWithValue }) => {
    try {
      const res = unwrap(await API.patch(`/transport/admin/partners/${partnerId}/settlement`, { amount }));
      return { ...res, partnerId, amount };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §M  ADMIN — SYSTEM LOGS & STATS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/admin/logs */
export const adminFetchTransportLogs = createAsyncThunk(
  'transportPartner/adminFetchTransportLogs',
  async (params = {}, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/admin/logs', { params }));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/admin/stats */
export const adminFetchTransportStats = createAsyncThunk(
  'transportPartner/adminFetchTransportStats',
  async (_, { rejectWithValue }) => {
    try {
      return unwrap(await API.get('/transport/admin/stats'));
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═════════════════════════════════════════════════════════════════════════════

const initialState = {
  // ── §A  Own profile, KYC, sessions ─────────────────────────────────────────
  profile: null,
  kycStatus: null,
  sessions: null,

  // ── §B  Vehicles ────────────────────────────────────────────────────────────
  vehicles: [],
  vehicleDetail: null,

  // ── §C  Agency drivers ──────────────────────────────────────────────────────
  drivers: [],
  driverTotal: 0,
  driverDetail: null,
  driverPerformance: null,
  driverLogs: [],
  driverLogsTotal: 0,

  // ── §D  Bank & settlement ───────────────────────────────────────────────────
  bankDetails: null,

  // ── §E  Zones & pricing ─────────────────────────────────────────────────────
  zones: [],
  pricing: null,

  // ── §G  Dashboard & own logs ────────────────────────────────────────────────
  dashboard: null,
  tpLogs: [],
  tpLogsTotal: 0,

  // ── §H  Driver self ─────────────────────────────────────────────────────────
  driverMe: null,
  driverRewards: null,
  driverOwnLogs: [],
  driverOwnLogsTotal: 0,
  driverOwnPerformance: null,
  driverCoinHistory: null,
  driverCompliance: null,

  // ── §I  Admin: partners ─────────────────────────────────────────────────────
  adminPartners: [],
  adminPartnersTotal: 0,
  adminPartnerDetail: null,
  adminPartnerLogs: [],
  adminPartnerLogsTotal: 0,

  // ── §J  Admin: pending vehicles ─────────────────────────────────────────────
  pendingVehicles: [],
  pendingVehiclesTotal: 0,

  // ── §K  Admin: platform drivers ─────────────────────────────────────────────
  adminDrivers: [],
  adminDriversTotal: 0,
  adminDriverDetail: null,
  adminAvailableDrivers: [],
  adminDriverLogs: [],
  adminDriverLogsTotal: 0,

  // ── §L  Admin: pricing ──────────────────────────────────────────────────────
  globalPricing: null,

  // ── §M  Admin: logs & stats ─────────────────────────────────────────────────
  adminLogs: [],
  adminLogsTotal: 0,
  adminStats: null,

  // ── Meta ────────────────────────────────────────────────────────────────────
  loading: false,
  error: null,
};

// ═════════════════════════════════════════════════════════════════════════════
// BUILDER HELPER
// addCases(builder, thunk, fulfilledReducer)
// ═════════════════════════════════════════════════════════════════════════════

const addCases = (builder, thunk, onFulfilled) => {
  builder
    .addCase(thunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(thunk.fulfilled, (state, action) => {
      state.loading = false;
      onFulfilled(state, action);
    })
    .addCase(thunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload ?? 'Request failed';
      toast.error(action.payload ?? 'Request failed');
    });
};

// ═════════════════════════════════════════════════════════════════════════════
// SLICE
// ═════════════════════════════════════════════════════════════════════════════

const transportPartnerSlice = createSlice({
  name: 'transportPartner',
  initialState,

  reducers: {
    /** Clear error banner without mutating other state. */
    clearTPError(state) {
      state.error = null;
    },

    /** Full state reset — call on logout or partner switch. */
    resetTPState() {
      return initialState;
    },

    /**
     * Optimistically update a single driver's isActive flag.
     * Useful for immediate UI feedback before the thunk settles.
     */
    setDriverActiveOptimistic(state, action) {
      const { driverId, isActive } = action.payload;
      const driver = state.drivers.find((d) => d._id === driverId);
      if (driver) driver.isActive = isActive;
    },
  },

  extraReducers: (builder) => {

    // ── §A ──────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPProfile, (state, { payload }) => {
      state.profile = payload.data;
    });

    addCases(builder, updateTPProfile, (state, { payload }) => {
      state.profile = payload.data;
      toast.success(payload.message ?? 'Profile updated');
    });

    addCases(builder, submitTPKyc, (state, { payload }) => {
      if (state.profile) state.profile.ownerKyc = payload.data;
      toast.success(payload.message ?? 'KYC submitted for review');
    });

    addCases(builder, fetchTPKycStatus, (state, { payload }) => {
      state.kycStatus = payload.data;
    });

    addCases(builder, updateTPNotifications, (state, { payload }) => {
      if (state.profile) state.profile.notifications = payload.data;
      toast.success(payload.message ?? 'Notification preferences updated');
    });

    addCases(builder, updateTPAvailability, (state, { payload }) => {
      if (state.profile) {
        state.profile.isAvailable = payload.data?.isAvailable;
        state.profile.availabilityHours = payload.data?.availabilityHours;
      }
      toast.success(payload.message ?? 'Availability updated');
    });

    addCases(builder, updateTPSettlementCycle, (state, { payload }) => {
      if (state.profile) state.profile.settlementCycle = payload.data?.settlementCycle;
      toast.success('Settlement cycle updated');
    });

    addCases(builder, fetchTPSessions, (state, { payload }) => {
      state.sessions = payload.data;
    });

    addCases(builder, revokeTPSession, (state, { payload }) => {
      if (state.sessions?.auditSessions) {
        state.sessions.auditSessions = state.sessions.auditSessions.filter(
          (s) => s._id !== payload.sessionId
        );
      }
      toast.success('Session revoked');
    });

    addCases(builder, revokeAllTPSessions, (state) => {
      if (state.sessions) state.sessions.auditSessions = [];
      toast.success('All sessions revoked');
    });

    addCases(builder, removeTPDeviceToken, (state, { payload }) => {
      if (state.sessions?.deviceTokens) {
        state.sessions.deviceTokens = state.sessions.deviceTokens.filter(
          (t) => t._id !== payload.tokenId
        );
      }
      toast.success('Device token removed');
    });

    // ── §B ──────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPVehicles, (state, { payload }) => {
      state.vehicles = payload.data;
    });

    addCases(builder, fetchTPVehicleById, (state, { payload }) => {
      state.vehicleDetail = payload.data;
    });

    addCases(builder, addTPVehicle, (state, { payload }) => {
      if (payload.data) state.vehicles.push(payload.data);
      toast.success(payload.message ?? 'Vehicle added');
    });

    addCases(builder, updateTPVehicle, (state, { payload }) => {
      if (payload.data?._id) {
        const idx = state.vehicles.findIndex((v) => v._id === payload.data._id);
        if (idx !== -1) state.vehicles[idx] = payload.data;
        if (state.vehicleDetail?._id === payload.data._id) {
          state.vehicleDetail = payload.data;
        }
      }
      toast.success(payload.message ?? 'Vehicle updated');
    });

    addCases(builder, deleteTPVehicle, (state, { payload }) => {
      state.vehicles = state.vehicles.filter((v) => v._id !== payload.vehicleId);
      if (state.vehicleDetail?._id === payload.vehicleId) state.vehicleDetail = null;
      toast.success(payload.message ?? 'Vehicle removed');
    });

    addCases(builder, assignDriverToVehicle, (state, { payload }) => {
      toast.success(payload.message ?? 'Driver assigned to vehicle');
    });

    addCases(builder, unassignDriverFromVehicle, (state, { payload }) => {
      toast.success(payload.message ?? 'Driver unassigned from vehicle');
    });

    addCases(builder, addTPVehiclePhotos, (state, { payload }) => {
      toast.success(payload.message ?? 'Photos added');
    });

    // ── §C ──────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPDrivers, (state, { payload }) => {
      state.drivers = payload.data;
      state.driverTotal = payload.total ?? payload.data.length;
    });

    addCases(builder, fetchTPDriverById, (state, { payload }) => {
      state.driverDetail = payload.data;
    });

    addCases(builder, registerTPDriver, (state, { payload }) => {
      if (payload.data?.driver) {
        state.drivers.unshift(payload.data.driver);
        state.driverTotal += 1;
      }
      toast.success(payload.message ?? 'Driver registered successfully');
    });

    addCases(builder, updateTPDriver, (state, { payload }) => {
      if (payload.data?._id) {
        const idx = state.drivers.findIndex((d) => d._id === payload.data._id);
        if (idx !== -1) state.drivers[idx] = payload.data;
        if (state.driverDetail?._id === payload.data._id) state.driverDetail = payload.data;
      }
      toast.success(payload.message ?? 'Driver updated');
    });

    addCases(builder, toggleTPDriverActive, (state, { payload }) => {
      if (payload.driverId !== undefined) {
        const driver = state.drivers.find((d) => d._id === payload.driverId);
        if (driver) driver.isActive = payload.isActive;
        if (state.driverDetail?._id === payload.driverId) {
          state.driverDetail.isActive = payload.isActive;
        }
      }
      toast.success(payload.message ?? 'Driver status toggled');
    });

    addCases(builder, pauseTPDriver, (state, { payload }) => {
      if (payload.driverId) {
        const driver = state.drivers.find((d) => d._id === payload.driverId);
        if (driver) {
          driver.isPaused = true;
          if (payload.data?.pausedUntil) driver.pausedUntil = payload.data.pausedUntil;
        }
        if (state.driverDetail?._id === payload.driverId) {
          state.driverDetail.isPaused = true;
        }
      }
      toast.success(payload.message ?? 'Driver paused');
    });

    addCases(builder, unpauseTPDriver, (state, { payload }) => {
      if (payload.driverId) {
        const driver = state.drivers.find((d) => d._id === payload.driverId);
        if (driver) {
          driver.isPaused = false;
          driver.pausedUntil = null;
          driver.pauseReason = null;
        }
        if (state.driverDetail?._id === payload.driverId) {
          state.driverDetail.isPaused = false;
        }
      }
      toast.success(payload.message ?? 'Driver unpaused');
    });

    addCases(builder, removeTPDriver, (state, { payload }) => {
      state.drivers = state.drivers.filter((d) => d._id !== payload.driverId);
      state.driverTotal = Math.max(0, state.driverTotal - 1);
      if (state.driverDetail?._id === payload.driverId) state.driverDetail = null;
      toast.success(payload.message ?? 'Driver removed from agency');
    });

    addCases(builder, fetchTPDriverPerformance, (state, { payload }) => {
      state.driverPerformance = payload.data;
    });

    addCases(builder, fetchTPDriverLogs, (state, { payload }) => {
      state.driverLogs = payload.data;
      state.driverLogsTotal = payload.total ?? payload.data.length;
    });

    // ── §D ──────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPBankDetails, (state, { payload }) => {
      state.bankDetails = payload.data;
    });

    addCases(builder, addTPBankAccount, (state, { payload }) => {
      if (state.bankDetails) state.bankDetails.bankAccounts = payload.data;
      toast.success(payload.message ?? 'Bank account added');
    });

    addCases(builder, setTPPrimaryBankAccount, (state, { payload }) => {
      toast.success(payload.message ?? 'Primary account updated');
      // Full bankDetails refresh recommended after this action
    });

    addCases(builder, removeTPBankAccount, (state, { payload }) => {
      if (state.bankDetails?.bankAccounts) {
        state.bankDetails.bankAccounts = state.bankDetails.bankAccounts.filter(
          (a) => a._id !== payload.accountId
        );
      }
      toast.success(payload.message ?? 'Bank account removed');
    });

    addCases(builder, addTPUpiHandle, (state, { payload }) => {
      if (state.bankDetails) state.bankDetails.upiHandles = payload.data;
      toast.success('UPI handle added');
    });

    addCases(builder, removeTPUpiHandle, (state, { payload }) => {
      if (state.bankDetails?.upiHandles) {
        state.bankDetails.upiHandles = state.bankDetails.upiHandles.filter(
          (u) => u._id !== payload.upiId
        );
      }
      toast.success(payload.message ?? 'UPI handle removed');
    });

    addCases(builder, updateTPPreferredSettlementMethod, (state, { payload }) => {
      if (state.bankDetails) {
        state.bankDetails.preferredSettlementMethod =
          payload.data?.preferredSettlementMethod;
      }
      toast.success('Settlement method updated');
    });

    // ── §E ──────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPZones, (state, { payload }) => {
      state.zones = payload.data;
    });

    addCases(builder, addTPZone, (state, { payload }) => {
      state.zones = payload.data;
      toast.success('Service zone added');
    });

    addCases(builder, updateTPZone, (state, { payload }) => {
      if (payload.data && payload.zoneId) {
        const idx = state.zones.findIndex((z) => z._id === payload.zoneId);
        if (idx !== -1) state.zones[idx] = payload.data;
      }
      toast.success('Zone updated');
    });

    addCases(builder, removeTPZone, (state, { payload }) => {
      state.zones = state.zones.filter((z) => z._id !== payload.zoneId);
      toast.success(payload.message ?? 'Service zone removed');
    });

    addCases(builder, fetchTPPricing, (state, { payload }) => {
      state.pricing = payload.data;
    });

    addCases(builder, updateTPPricing, (state, { payload }) => {
      if (state.pricing) state.pricing.pricing = payload.data;
      else state.pricing = { pricing: payload.data };
      toast.success('Pricing updated');
    });

    // ── §G ──────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPDashboard, (state, { payload }) => {
      state.dashboard = payload.data;
    });

    addCases(builder, fetchTPLogs, (state, { payload }) => {
      state.tpLogs = payload.data;
      state.tpLogsTotal = payload.total ?? payload.data.length;
    });

    // ── §H ──────────────────────────────────────────────────────────────────

    addCases(builder, fetchDriverMe, (state, { payload }) => {
      state.driverMe = payload.data;
    });

    addCases(builder, updateDriverMe, (state, { payload }) => {
      state.driverMe = payload.data;
      toast.success(payload.message ?? 'Profile updated');
    });

    addCases(builder, updateDriverPhoto, (state, { payload }) => {
      if (state.driverMe) state.driverMe.photoUrl = payload.data?.photoUrl;
      toast.success(payload.message ?? 'Profile photo updated');
    });

    addCases(builder, removeDriverPhoto, (state, { payload }) => {
      if (state.driverMe) state.driverMe.photoUrl = null;
      toast.success(payload.message ?? 'Profile photo removed');
    });

    addCases(builder, updateDriverEmergencyContact, (state, { payload }) => {
      if (state.driverMe) state.driverMe.emergencyContact = payload.data;
      toast.success(payload.message ?? 'Emergency contact updated');
    });

    addCases(builder, updateDriverNotifPrefs, (state, { payload }) => {
      if (state.driverMe) state.driverMe.notifPrefs = payload.data;
      toast.success(payload.message ?? 'Notification preferences updated');
    });

    addCases(builder, fetchDriverOwnPerformance, (state, { payload }) => {
      state.driverOwnPerformance = payload.data;
    });

    addCases(builder, fetchDriverCoinHistory, (state, { payload }) => {
      state.driverCoinHistory = payload.data;
    });

    addCases(builder, addDriverCertificate, (state, { payload }) => {
      if (state.driverMe) {
        if (!state.driverMe.trainingCertificates) state.driverMe.trainingCertificates = [];
        state.driverMe.trainingCertificates.push(payload.data);
      }
      toast.success(payload.message ?? 'Certificate added');
    });

    addCases(builder, removeDriverCertificate, (state, { payload }) => {
      if (state.driverMe?.trainingCertificates) {
        state.driverMe.trainingCertificates = state.driverMe.trainingCertificates.filter(
          (c) => c._id !== payload.certId
        );
      }
      toast.success(payload.message ?? 'Certificate removed');
    });

    addCases(builder, submitDriverKyc, (state, { payload }) => {
      if (state.driverMe?.kyc) {
        state.driverMe.kyc.verificationStatus = payload.data?.verificationStatus;
      }
      toast.success(payload.message ?? 'KYC submitted for review');
    });

    addCases(builder, reuploadDriverKycDocument, (state, { payload }) => {
      if (state.driverMe?.kyc) {
        Object.assign(state.driverMe.kyc, payload.data);
      }
      toast.success(payload.message ?? 'Document submitted for re-review');
    });

    addCases(builder, updateDriverLicenceNumbers, (state, { payload }) => {
      if (state.driverMe?.kyc) {
        Object.assign(state.driverMe.kyc, payload.data);
      }
      toast.success(payload.message ?? 'Licence details updated');
    });

    addCases(builder, updateDriverMedicalFitness, (state, { payload }) => {
      if (state.driverMe) state.driverMe.medicalFitness = payload.data;
      toast.success(payload.message ?? 'Medical fitness updated');
    });

    addCases(builder, fetchDriverCompliance, (state, { payload }) => {
      state.driverCompliance = payload.data;
    });

    addCases(builder, updateDriverOnboarding, (state, { payload }) => {
      if (state.driverMe) state.driverMe.onboarding = payload.data;
      toast.success('Onboarding progress saved');
    });

    addCases(builder, completeDriverOnboarding, (state, { payload }) => {
      if (state.driverMe) state.driverMe.onboarding = payload.data;
      toast.success(payload.message ?? 'Onboarding complete');
    });

    addCases(builder, updateDriverShift, (state, { payload }) => {
      if (state.driverMe) state.driverMe.shift = payload.data;
      toast.success('Shift updated');
    });

    addCases(builder, updateDriverStatus, (state, { payload }) => {
      if (state.driverMe) state.driverMe.status = payload.status;
      toast.success(`Status: ${payload.status}`);
    });

    addCases(builder, updateDriverLocation, (state, { payload }) => {
      // Silent update — no toast (called at high frequency)
      if (state.driverMe) state.driverMe.location = payload.data;
    });

    addCases(builder, fetchDriverRewards, (state, { payload }) => {
      state.driverRewards = payload.data;
    });

    addCases(builder, updateDriverBank, (state, { payload }) => {
      if (state.driverMe) state.driverMe.bankDetails = payload.data;
      toast.success(payload.message ?? 'Bank details updated');
    });

    addCases(builder, fetchDriverLogs, (state, { payload }) => {
      state.driverOwnLogs = payload.data;
      state.driverOwnLogsTotal = payload.total ?? payload.data.length;
    });

    // ── §I ──────────────────────────────────────────────────────────────────

    addCases(builder, adminFetchPartners, (state, { payload }) => {
      state.adminPartners = payload.data;
      state.adminPartnersTotal = payload.total ?? payload.data.length;
    });

    addCases(builder, adminFetchPartnerById, (state, { payload }) => {
      state.adminPartnerDetail = payload.data;
    });

    addCases(builder, adminCreatePartner, (state, { payload }) => {
      if (payload.data?.partner) {
        state.adminPartners.unshift(payload.data.partner);
        state.adminPartnersTotal += 1;
      }
      toast.success(payload.message ?? 'Transport partner created');
    });

    addCases(builder, adminUpdatePartner, (state, { payload }) => {
      if (payload.data?._id) {
        const idx = state.adminPartners.findIndex((p) => p._id === payload.data._id);
        if (idx !== -1) state.adminPartners[idx] = payload.data;
        if (state.adminPartnerDetail?._id === payload.data._id) {
          state.adminPartnerDetail = payload.data;
        }
      }
      toast.success(payload.message ?? 'Partner updated');
    });

    addCases(builder, adminUpdatePartnerStatus, (state, { payload }) => {
      if (payload.data?._id) {
        const id = payload.data._id;
        const idx = state.adminPartners.findIndex((p) => p._id === id);
        if (idx !== -1) {
          state.adminPartners[idx].partnershipStatus = payload.data.partnershipStatus;
          state.adminPartners[idx].verifiedAt = payload.data.verifiedAt;
          state.adminPartners[idx].partnerSince = payload.data.partnerSince;
        }
        if (state.adminPartnerDetail?._id === id) {
          state.adminPartnerDetail.partnershipStatus = payload.data.partnershipStatus;
          state.adminPartnerDetail.verifiedAt = payload.data.verifiedAt;
          state.adminPartnerDetail.partnerSince = payload.data.partnerSince;
        }
      }
      toast.success(payload.message ?? 'Partner status updated');
    });

    addCases(builder, adminUpdatePartnerKyc, (state, { payload }) => {
      if (state.adminPartnerDetail) {
        state.adminPartnerDetail.ownerKyc = payload.data;
      }
      toast.success(payload.message ?? 'KYC updated');
    });

    addCases(builder, adminUpdatePartnerNotes, (state, { payload }) => {
      if (state.adminPartnerDetail) {
        state.adminPartnerDetail.internalNotes = payload.data?.internalNotes;
      }
      toast.success('Internal notes saved');
    });

    addCases(builder, adminDeletePartner, (state, { payload }) => {
      state.adminPartners = state.adminPartners.filter((p) => p._id !== payload.partnerId);
      state.adminPartnersTotal = Math.max(0, state.adminPartnersTotal - 1);
      if (state.adminPartnerDetail?._id === payload.partnerId) {
        state.adminPartnerDetail = null;
      }
      toast.success(payload.message ?? 'Partner deleted');
    });

    addCases(builder, adminFetchPartnerLogs, (state, { payload }) => {
      state.adminPartnerLogs = payload.data;
      state.adminPartnerLogsTotal = payload.total ?? payload.data.length;
    });

    // ── §J ──────────────────────────────────────────────────────────────────

    addCases(builder, adminFetchPendingVehicles, (state, { payload }) => {
      state.pendingVehicles = payload.data;
      state.pendingVehiclesTotal = payload.count ?? payload.data.length;
    });

    addCases(builder, adminVerifyVehicle, (state, { payload }) => {
      if (payload.vehicleId) {
        state.pendingVehicles = state.pendingVehicles.filter(
          (item) => item.vehicle?._id !== payload.vehicleId
        );
        state.pendingVehiclesTotal = Math.max(0, state.pendingVehiclesTotal - 1);
      }
      toast.success(payload.message ?? `Vehicle ${payload.verificationStatus}`);
    });

    // ── §K ──────────────────────────────────────────────────────────────────

    addCases(builder, adminFetchAvailableDrivers, (state, { payload }) => {
      state.adminAvailableDrivers = payload.data;
    });

    addCases(builder, adminFetchAllDrivers, (state, { payload }) => {
      state.adminDrivers = payload.data;
      state.adminDriversTotal = payload.total ?? payload.data.length;
    });

    addCases(builder, adminFetchDriverById, (state, { payload }) => {
      state.adminDriverDetail = payload.data;
    });

    addCases(builder, adminVerifyDriverKyc, (state, { payload }) => {
      if (payload.data?._id) {
        if (state.adminDriverDetail?._id === payload.data._id) {
          Object.assign(state.adminDriverDetail, payload.data);
        }
        const idx = state.adminDrivers.findIndex((d) => d._id === payload.data._id);
        if (idx !== -1) {
          state.adminDrivers[idx] = { ...state.adminDrivers[idx], ...payload.data };
        }
      }
      toast.success(payload.message ?? 'Driver KYC updated');
    });

    addCases(builder, adminBlockDriver, (state, { payload }) => {
      if (payload.driverId) {
        const driver = state.adminDrivers.find((d) => d._id === payload.driverId);
        if (driver) { driver.isBlocked = true; driver.isActive = false; }
        if (state.adminDriverDetail?._id === payload.driverId) {
          state.adminDriverDetail.isBlocked = true;
          state.adminDriverDetail.isActive = false;
        }
      }
      toast.success(payload.message ?? 'Driver blocked');
    });

    addCases(builder, adminUnblockDriver, (state, { payload }) => {
      if (payload.driverId) {
        const driver = state.adminDrivers.find((d) => d._id === payload.driverId);
        if (driver) { driver.isBlocked = false; }
        if (state.adminDriverDetail?._id === payload.driverId) {
          state.adminDriverDetail.isBlocked = false;
        }
      }
      toast.success(payload.message ?? 'Driver unblocked');
    });

    addCases(builder, adminUpdateDriverNotes, (state, { payload }) => {
      if (payload.driverId && state.adminDriverDetail?._id === payload.driverId) {
        state.adminDriverDetail.adminNotes = payload.data?.adminNotes;
      }
      toast.success('Admin notes saved');
    });

    addCases(builder, adminAdjustDriverCoins, (state, { payload }) => {
      if (payload.driverId && state.adminDriverDetail?._id === payload.driverId) {
        if (state.adminDriverDetail.rewards) {
          state.adminDriverDetail.rewards.coinBalance = payload.coinBalance;
        }
      }
      toast.success(payload.message ?? 'Coins adjusted');
    });

    addCases(builder, adminFetchDriverLogs, (state, { payload }) => {
      state.adminDriverLogs = payload.data;
      state.adminDriverLogsTotal = payload.total ?? payload.data.length;
    });

    // ── §L ──────────────────────────────────────────────────────────────────

    addCases(builder, adminFetchGlobalPricing, (state, { payload }) => {
      state.globalPricing = payload.data;
    });

    addCases(builder, adminUpdateGlobalPricing, (state, { payload }) => {
      state.globalPricing = payload.data;
      toast.success(payload.message ?? 'Global pricing updated');
    });

    addCases(builder, adminSetPartnerPlatformFee, (state, { payload }) => {
      if (payload.partnerId && state.adminPartnerDetail?._id === payload.partnerId) {
        state.adminPartnerDetail.platformFeeOverride = payload.data ?? null;
      }
      toast.success(payload.message ?? 'Platform fee override applied');
    });

    addCases(builder, adminProcessPartnerSettlement, (state, { payload }) => {
      if (payload.partnerId && state.adminPartnerDetail?._id === payload.partnerId) {
        const bank = state.adminPartnerDetail.bankDetails;
        if (bank) {
          bank.pendingSettlementAmount = Math.max(
            0,
            (bank.pendingSettlementAmount ?? 0) - (payload.amount ?? 0)
          );
          bank.totalSettledAmount = (bank.totalSettledAmount ?? 0) + (payload.amount ?? 0);
        }
      }
      toast.success(payload.message ?? 'Settlement processed');
    });

    // ── §M ──────────────────────────────────────────────────────────────────

    addCases(builder, adminFetchTransportLogs, (state, { payload }) => {
      state.adminLogs = payload.data;
      state.adminLogsTotal = payload.total ?? payload.data.length;
    });

    addCases(builder, adminFetchTransportStats, (state, { payload }) => {
      state.adminStats = payload.data;
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  clearTPError,
  resetTPState, 
  setDriverActiveOptimistic,
} = transportPartnerSlice.actions;

export default transportPartnerSlice.reducer;