/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * transportPartnerSlice.js — Likeson.in
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Covers EVERY route in TransportPartnerRoutes.js
 *
 *  §A  Transport Partner — own profile, KYC, settings, security
 *  §B  Transport Partner — vehicle management
 *  §C  Transport Partner — driver management
 *  §D  Transport Partner — bank & settlement
 *  §E  Transport Partner — service zones & pricing
 *  §G  Transport Partner — dashboard stats & activity logs
 *  §H  Driver — own profile, KYC, shift, location, status, rewards, bank, logs
 *  §I  Admin — partner management (list, create, update, status, kyc, notes, delete)
 *  §J  Admin — vehicle verification
 *  §K  Admin — driver management (platform-wide)
 *  §L  Admin — pricing / platform-fee overrides / settlement
 *  §M  Admin — system logs
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — unwrap axios response or throw error message
// ─────────────────────────────────────────────────────────────────────────────
const unwrap = (res) => res.data;

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
      const res = await API.get('/transport/profile');
      return unwrap(res);
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
      const res = await API.patch('/transport/profile', data);
      return unwrap(res);
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
      const res = await API.put('/transport/kyc', data);
      return unwrap(res);
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
      const res = await API.get('/transport/kyc/status');
      return unwrap(res);
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
      const res = await API.patch('/transport/settings/notifications', data);
      return unwrap(res);
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
      const res = await API.patch('/transport/settings/availability', data);
      return unwrap(res);
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
      const res = await API.patch('/transport/settings/settlement-cycle', { settlementCycle });
      return unwrap(res);
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
      const res = await API.get('/transport/security/sessions');
      return unwrap(res);
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
      const res = await API.delete(`/transport/security/sessions/${sessionId}`);
      return { ...unwrap(res), sessionId };
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** DELETE /api/transport/security/sessions (all) */
export const revokeAllTPSessions = createAsyncThunk(
  'transportPartner/revokeAllTPSessions',
  async (_, { rejectWithValue }) => {
    try {
      const res = await API.delete('/transport/security/sessions');
      return unwrap(res);
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
      const res = await API.delete(`/transport/security/device-tokens/${tokenId}`);
      return { ...unwrap(res), tokenId };
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
      const res = await API.get('/transport/vehicles', { params });
      return unwrap(res);
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
      const res = await API.get(`/transport/vehicles/${vehicleId}`);
      return unwrap(res);
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
      const res = await API.post('/transport/vehicles', data);
      return unwrap(res);
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
      const res = await API.patch(`/transport/vehicles/${vehicleId}`, data);
      return unwrap(res);
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
      const res = await API.delete(`/transport/vehicles/${vehicleId}`, {
        params: { hard },
      });
      return { ...unwrap(res), vehicleId };
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
      const res = await API.patch(`/transport/vehicles/${vehicleId}/assign-driver`, { driverId });
      return unwrap(res);
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
      const res = await API.patch(`/transport/vehicles/${vehicleId}/unassign-driver`);
      return unwrap(res);
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
      const res = await API.post(`/transport/vehicles/${vehicleId}/photos`, { photoUrls });
      return unwrap(res);
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
      const res = await API.get('/transport/drivers', { params });
      return unwrap(res);
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
      const res = await API.get(`/transport/drivers/${driverId}`);
      return unwrap(res);
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
      const res = await API.post('/transport/drivers', data);
      return unwrap(res);
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
      const res = await API.patch(`/transport/drivers/${driverId}`, data);
      return unwrap(res);
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
      const res = await API.patch(`/transport/drivers/${driverId}/toggle-active`);
      return unwrap(res);
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
      const res = await API.patch(`/transport/drivers/${driverId}/pause`, { pauseReason, pausedUntil });
      return unwrap(res);
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
      const res = await API.patch(`/transport/drivers/${driverId}/unpause`);
      return unwrap(res);
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
      const res = await API.delete(`/transport/drivers/${driverId}`);
      return { ...unwrap(res), driverId };
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
      const res = await API.get(`/transport/drivers/${driverId}/performance`);
      return unwrap(res);
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
      const res = await API.get(`/transport/drivers/${driverId}/logs`, { params });
      return unwrap(res);
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
      const res = await API.get('/transport/bank');
      return unwrap(res);
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
      const res = await API.post('/transport/bank/accounts', data);
      return unwrap(res);
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
      const res = await API.patch(`/transport/bank/accounts/${accountId}/set-primary`);
      return unwrap(res);
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
      const res = await API.delete(`/transport/bank/accounts/${accountId}`);
      return { ...unwrap(res), accountId };
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
      const res = await API.post('/transport/bank/upi', data);
      return unwrap(res);
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
      const res = await API.delete(`/transport/bank/upi/${upiId}`);
      return { ...unwrap(res), upiId };
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
      const res = await API.patch('/transport/bank/preferred-method', { method });
      return unwrap(res);
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
      const res = await API.get('/transport/zones');
      return unwrap(res);
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
      const res = await API.post('/transport/zones', data);
      return unwrap(res);
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
      const res = await API.patch(`/transport/zones/${zoneId}`, data);
      return unwrap(res);
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
      const res = await API.delete(`/transport/zones/${zoneId}`);
      return { ...unwrap(res), zoneId };
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
      const res = await API.get('/transport/pricing');
      return unwrap(res);
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
      const res = await API.patch('/transport/pricing', data);
      return unwrap(res);
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
      const res = await API.get('/transport/dashboard');
      return unwrap(res);
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
      const res = await API.get('/transport/logs', { params });
      return unwrap(res);
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
      const res = await API.get('/transport/driver/me');
      return unwrap(res);
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
      const res = await API.patch('/transport/driver/me', data);
      return unwrap(res);
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
      const res = await API.put('/transport/driver/kyc', data);
      return unwrap(res);
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
      const res = await API.patch('/transport/driver/shift', data);
      return unwrap(res);
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
      const res = await API.patch('/transport/driver/status', { status });
      return unwrap(res);
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
      const res = await API.patch('/transport/driver/location', { lng, lat, heading, speedKmh });
      return unwrap(res);
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
      const res = await API.get('/transport/driver/rewards');
      return unwrap(res);
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
      const res = await API.put('/transport/driver/bank', data);
      return unwrap(res);
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
      const res = await API.get('/transport/driver/logs', { params });
      return unwrap(res);
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
      const res = await API.get('/transport/admin/partners', { params });
      return unwrap(res);
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
      const res = await API.get(`/transport/admin/partners/${partnerId}`);
      return unwrap(res);
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
      const res = await API.post('/transport/admin/partners', data);
      return unwrap(res);
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
      const res = await API.patch(`/transport/admin/partners/${partnerId}`, data);
      return unwrap(res);
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
      const res = await API.patch(`/transport/admin/partners/${partnerId}/status`, { status, reason });
      return unwrap(res);
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
      const res = await API.patch(`/transport/admin/partners/${partnerId}/kyc`, data);
      return unwrap(res);
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
      const res = await API.patch(`/transport/admin/partners/${partnerId}/internal-notes`, { notes });
      return unwrap(res);
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
      const res = await API.delete(`/transport/admin/partners/${partnerId}`);
      return { ...unwrap(res), partnerId };
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
      const res = await API.get(`/transport/admin/partners/${partnerId}/logs`, { params });
      return unwrap(res);
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
      const res = await API.get('/transport/admin/vehicles/pending', { params });
      return unwrap(res);
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
      const res = await API.patch(
        `/transport/admin/vehicles/${partnerId}/${vehicleId}/verify`,
        { verificationStatus, rejectionReason }
      );
      return unwrap(res);
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §K  ADMIN — DRIVER MANAGEMENT (PLATFORM-WIDE)
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/admin/drivers */
export const adminFetchAllDrivers = createAsyncThunk(
  'transportPartner/adminFetchAllDrivers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await API.get('/transport/admin/drivers', { params });
      return unwrap(res);
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** GET /api/transport/admin/drivers/available */
export const adminFetchAvailableDrivers = createAsyncThunk(
  'transportPartner/adminFetchAvailableDrivers',
  async (params, { rejectWithValue }) => {
    try {
      const res = await API.get('/transport/admin/drivers/available', { params });
      return unwrap(res);
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
      const res = await API.get(`/transport/admin/drivers/${driverId}`);
      return unwrap(res);
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
      const res = await API.patch(`/transport/admin/drivers/${driverId}/kyc`, {
        verificationStatus, rejectionReason,
      });
      return unwrap(res);
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
      const res = await API.patch(`/transport/admin/drivers/${driverId}/block`, { blockReason });
      return unwrap(res);
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
      const res = await API.patch(`/transport/admin/drivers/${driverId}/unblock`);
      return unwrap(res);
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
      const res = await API.patch(`/transport/admin/drivers/${driverId}/admin-notes`, { notes });
      return unwrap(res);
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
      const res = await API.post(`/transport/admin/drivers/${driverId}/coins`, {
        type, amount, description,
      });
      return unwrap(res);
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
      const res = await API.get(`/transport/admin/drivers/${driverId}/logs`, { params });
      return unwrap(res);
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
      const res = await API.get('/transport/admin/pricing/global');
      return unwrap(res);
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

/** PATCH /api/transport/admin/pricing/global */
export const adminUpdateGlobalPricing = createAsyncThunk(
  'transportPartner/adminUpdateGlobalPricing',
  async (data, { rejectWithValue }) => {
    try {
      const res = await API.patch('/transport/admin/pricing/global', data);
      return unwrap(res);
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
      const res = await API.patch(`/transport/admin/partners/${partnerId}/platform-fee`, {
        type, value, clear,
      });
      return unwrap(res);
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
      const res = await API.patch(`/transport/admin/partners/${partnerId}/settlement`, { amount });
      return unwrap(res);
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// §M  ADMIN — SYSTEM LOGS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/transport/admin/logs */
export const adminFetchTransportLogs = createAsyncThunk(
  'transportPartner/adminFetchTransportLogs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await API.get('/transport/admin/logs', { params });
      return unwrap(res);
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
      const res = await API.get('/transport/admin/stats');
      return unwrap(res);
    } catch (err) {
      return rejectWith(err, rejectWithValue);
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═════════════════════════════════════════════════════════════════════════════

const initialState = {
  // ── §A ──────────────────────────────────────────────────────────────────
  profile:          null,
  kycStatus:        null,
  sessions:         null,

  // ── §B ──────────────────────────────────────────────────────────────────
  vehicles:         [],
  vehicleDetail:    null,

  // ── §C ──────────────────────────────────────────────────────────────────
  drivers:          [],
  driverTotal:      0,
  driverDetail:     null,
  driverPerformance: null,
  driverLogs:       [],

  // ── §D ──────────────────────────────────────────────────────────────────
  bankDetails:      null,

  // ── §E ──────────────────────────────────────────────────────────────────
  zones:            [],
  pricing:          null,

  // ── §G ──────────────────────────────────────────────────────────────────
  dashboard:        null,
  tpLogs:           [],

  // ── §H ──────────────────────────────────────────────────────────────────
  driverMe:         null,
  driverRewards:    null,
  driverOwnLogs:    [],

  // ── §I ──────────────────────────────────────────────────────────────────
  adminPartners:    [],
  adminPartnersTotal: 0,
  adminPartnerDetail: null,
  adminPartnerLogs: [],

  // ── §J ──────────────────────────────────────────────────────────────────
  pendingVehicles:  [],

  // ── §K ──────────────────────────────────────────────────────────────────
  adminDrivers:     [],
  adminDriversTotal: 0,
  adminDriverDetail: null,
  adminAvailableDrivers: [],
  adminDriverLogs:  [],

  // ── §L ──────────────────────────────────────────────────────────────────
  globalPricing:    null,

  // ── §M ──────────────────────────────────────────────────────────────────
  adminLogs:        [],
  adminLogsTotal:   0,
  adminStats:       null,

  // ── Meta ─────────────────────────────────────────────────────────────────
  loading:          false,
  error:            null,
};

// ═════════════════════════════════════════════════════════════════════════════
// HELPER — build standard pending / rejected handlers
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Attaches the three standard lifecycle cases for a thunk.
 * Usage:  addCases(builder, myThunk, (state, action) => { ... })
 */
const addCases = (builder, thunk, onFulfilled) => {
  builder
    .addCase(thunk.pending, (state) => {
      state.loading = true;
      state.error   = null;
    })
    .addCase(thunk.fulfilled, (state, action) => {
      state.loading = false;
      onFulfilled(state, action);
    })
    .addCase(thunk.rejected, (state, action) => {
      state.loading = false;
      state.error   = action.payload;
      toast.error(action.payload || 'Request failed');
    });
};

// ═════════════════════════════════════════════════════════════════════════════
// SLICE
// ═════════════════════════════════════════════════════════════════════════════

const transportPartnerSlice = createSlice({
  name: 'transportPartner',
  initialState,

  reducers: {
    /** Clear any lingering error banner */
    clearTPError: (state) => { state.error = null; },
    /** Reset the entire slice (e.g. on logout) */
    resetTPState: () => initialState,
  },

  extraReducers: (builder) => {

    // ── §A ────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPProfile, (state, { payload }) => {
      state.profile = payload.data;
    });

    addCases(builder, updateTPProfile, (state, { payload }) => {
      state.profile = payload.data;
      toast.success(payload.message || 'Profile updated');
    });

    addCases(builder, submitTPKyc, (state, { payload }) => {
      if (state.profile) state.profile.ownerKyc = payload.data;
      toast.success(payload.message || 'KYC submitted');
    });

    addCases(builder, fetchTPKycStatus, (state, { payload }) => {
      state.kycStatus = payload.data;
    });

    addCases(builder, updateTPNotifications, (state, { payload }) => {
      if (state.profile) state.profile.notifications = payload.data;
      toast.success(payload.message || 'Notifications updated');
    });

    addCases(builder, updateTPAvailability, (state, { payload }) => {
      if (state.profile) {
        state.profile.isAvailable       = payload.data?.isAvailable;
        state.profile.availabilityHours = payload.data?.availabilityHours;
      }
      toast.success(payload.message || 'Availability updated');
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

    // ── §B ────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPVehicles, (state, { payload }) => {
      state.vehicles = payload.data;
    });

    addCases(builder, fetchTPVehicleById, (state, { payload }) => {
      state.vehicleDetail = payload.data;
    });

    addCases(builder, addTPVehicle, (state, { payload }) => {
      state.vehicles.push(payload.data);
      toast.success(payload.message || 'Vehicle added');
    });

    addCases(builder, updateTPVehicle, (state, { payload }) => {
      const idx = state.vehicles.findIndex((v) => v._id === payload.data?._id);
      if (idx !== -1) state.vehicles[idx] = payload.data;
      toast.success(payload.message || 'Vehicle updated');
    });

    addCases(builder, deleteTPVehicle, (state, { payload }) => {
      state.vehicles = state.vehicles.filter((v) => v._id !== payload.vehicleId);
      toast.success(payload.message || 'Vehicle removed');
    });

    addCases(builder, assignDriverToVehicle, (state, { payload }) => {
      toast.success(payload.message || 'Driver assigned');
    });

    addCases(builder, unassignDriverFromVehicle, (state, { payload }) => {
      toast.success(payload.message || 'Driver unassigned');
    });

    addCases(builder, addTPVehiclePhotos, (state, { payload }) => {
      toast.success(payload.message || 'Photos added');
    });

    // ── §C ────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPDrivers, (state, { payload }) => {
      state.drivers     = payload.data;
      state.driverTotal = payload.total;
    });

    addCases(builder, fetchTPDriverById, (state, { payload }) => {
      state.driverDetail = payload.data;
    });

    addCases(builder, registerTPDriver, (state, { payload }) => {
      state.drivers.unshift(payload.data?.driver);
      toast.success(payload.message || 'Driver registered');
    });

    addCases(builder, updateTPDriver, (state, { payload }) => {
      const idx = state.drivers.findIndex((d) => d._id === payload.data?._id);
      if (idx !== -1) state.drivers[idx] = payload.data;
      toast.success(payload.message || 'Driver updated');
    });

    addCases(builder, toggleTPDriverActive, (state, { payload }) => {
      toast.success(payload.message || 'Driver status toggled');
    });

    addCases(builder, pauseTPDriver, (state, { payload }) => {
      toast.success(payload.message || 'Driver paused');
    });

    addCases(builder, unpauseTPDriver, (state, { payload }) => {
      toast.success(payload.message || 'Driver unpaused');
    });

    addCases(builder, removeTPDriver, (state, { payload }) => {
      state.drivers = state.drivers.filter((d) => d._id !== payload.driverId);
      toast.success(payload.message || 'Driver removed');
    });

    addCases(builder, fetchTPDriverPerformance, (state, { payload }) => {
      state.driverPerformance = payload.data;
    });

    addCases(builder, fetchTPDriverLogs, (state, { payload }) => {
      state.driverLogs = payload.data;
    });

    // ── §D ────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPBankDetails, (state, { payload }) => {
      state.bankDetails = payload.data;
    });

    addCases(builder, addTPBankAccount, (state, { payload }) => {
      if (state.bankDetails) state.bankDetails.bankAccounts = payload.data;
      toast.success(payload.message || 'Bank account added');
    });

    addCases(builder, setTPPrimaryBankAccount, (state, { payload }) => {
      toast.success(payload.message || 'Primary account updated');
    });

    addCases(builder, removeTPBankAccount, (state, { payload }) => {
      if (state.bankDetails?.bankAccounts) {
        state.bankDetails.bankAccounts = state.bankDetails.bankAccounts.filter(
          (a) => a._id !== payload.accountId
        );
      }
      toast.success(payload.message || 'Bank account removed');
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
      toast.success(payload.message || 'UPI handle removed');
    });

    addCases(builder, updateTPPreferredSettlementMethod, (state, { payload }) => {
      if (state.bankDetails) {
        state.bankDetails.preferredSettlementMethod =
          payload.data?.preferredSettlementMethod;
      }
      toast.success('Settlement method updated');
    });

    // ── §E ────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPZones, (state, { payload }) => {
      state.zones = payload.data;
    });

    addCases(builder, addTPZone, (state, { payload }) => {
      state.zones = payload.data;
      toast.success('Service zone added');
    });

    addCases(builder, updateTPZone, (state, { payload }) => {
      const idx = state.zones.findIndex((z) => z._id === payload.data?._id);
      if (idx !== -1) state.zones[idx] = payload.data;
      toast.success('Zone updated');
    });

    addCases(builder, removeTPZone, (state, { payload }) => {
      state.zones = state.zones.filter((z) => z._id !== payload.zoneId);
      toast.success(payload.message || 'Zone removed');
    });

    addCases(builder, fetchTPPricing, (state, { payload }) => {
      state.pricing = payload.data;
    });

    addCases(builder, updateTPPricing, (state, { payload }) => {
      state.pricing = { ...state.pricing, pricing: payload.data };
      toast.success('Pricing updated');
    });

    // ── §G ────────────────────────────────────────────────────────────────

    addCases(builder, fetchTPDashboard, (state, { payload }) => {
      state.dashboard = payload.data;
    });

    addCases(builder, fetchTPLogs, (state, { payload }) => {
      state.tpLogs = payload.data;
    });

    // ── §H ────────────────────────────────────────────────────────────────

    addCases(builder, fetchDriverMe, (state, { payload }) => {
      state.driverMe = payload.data;
    });

    addCases(builder, updateDriverMe, (state, { payload }) => {
      state.driverMe = payload.data;
      toast.success(payload.message || 'Profile updated');
    });

    addCases(builder, submitDriverKyc, (state, { payload }) => {
      if (state.driverMe?.kyc) {
        state.driverMe.kyc.verificationStatus = payload.data?.verificationStatus;
      }
      toast.success(payload.message || 'KYC submitted');
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
      if (state.driverMe) state.driverMe.location = payload.data;
    });

    addCases(builder, fetchDriverRewards, (state, { payload }) => {
      state.driverRewards = payload.data;
    });

    addCases(builder, updateDriverBank, (state, { payload }) => {
      if (state.driverMe) state.driverMe.bankDetails = payload.data;
      toast.success(payload.message || 'Bank details updated');
    });

    addCases(builder, fetchDriverLogs, (state, { payload }) => {
      state.driverOwnLogs = payload.data;
    });

    // ── §I ────────────────────────────────────────────────────────────────

    addCases(builder, adminFetchPartners, (state, { payload }) => {
      state.adminPartners      = payload.data;
      state.adminPartnersTotal = payload.total;
    });

    addCases(builder, adminFetchPartnerById, (state, { payload }) => {
      state.adminPartnerDetail = payload.data;
    });

    addCases(builder, adminCreatePartner, (state, { payload }) => {
      state.adminPartners.unshift(payload.data?.partner);
      state.adminPartnersTotal += 1;
      toast.success(payload.message || 'Partner created');
    });

    addCases(builder, adminUpdatePartner, (state, { payload }) => {
      const idx = state.adminPartners.findIndex((p) => p._id === payload.data?._id);
      if (idx !== -1) state.adminPartners[idx] = payload.data;
      if (state.adminPartnerDetail?._id === payload.data?._id) {
        state.adminPartnerDetail = payload.data;
      }
      toast.success(payload.message || 'Partner updated');
    });

    addCases(builder, adminUpdatePartnerStatus, (state, { payload }) => {
      const idx = state.adminPartners.findIndex((p) => p._id === payload.data?._id);
      if (idx !== -1) {
        state.adminPartners[idx].partnershipStatus = payload.data?.partnershipStatus;
      }
      if (state.adminPartnerDetail?._id === payload.data?._id) {
        state.adminPartnerDetail.partnershipStatus = payload.data?.partnershipStatus;
      }
      toast.success(payload.message || 'Status updated');
    });

    addCases(builder, adminUpdatePartnerKyc, (state, { payload }) => {
      if (state.adminPartnerDetail) {
        state.adminPartnerDetail.ownerKyc = payload.data;
      }
      toast.success(payload.message || 'KYC updated');
    });

    addCases(builder, adminUpdatePartnerNotes, (state, { payload }) => {
      if (state.adminPartnerDetail) {
        state.adminPartnerDetail.internalNotes = payload.data?.internalNotes;
      }
      toast.success('Internal notes saved');
    });

    addCases(builder, adminDeletePartner, (state, { payload }) => {
      state.adminPartners = state.adminPartners.filter(
        (p) => p._id !== payload.partnerId
      );
      state.adminPartnersTotal = Math.max(0, state.adminPartnersTotal - 1);
      if (state.adminPartnerDetail?._id === payload.partnerId) {
        state.adminPartnerDetail = null;
      }
      toast.success(payload.message || 'Partner deleted');
    });

    addCases(builder, adminFetchPartnerLogs, (state, { payload }) => {
      state.adminPartnerLogs = payload.data;
    });

    // ── §J ────────────────────────────────────────────────────────────────

    addCases(builder, adminFetchPendingVehicles, (state, { payload }) => {
      state.pendingVehicles = payload.data;
    });

    addCases(builder, adminVerifyVehicle, (state, { payload }) => {
      toast.success(payload.message || 'Vehicle status updated');
    });

    // ── §K ────────────────────────────────────────────────────────────────

    addCases(builder, adminFetchAllDrivers, (state, { payload }) => {
      state.adminDrivers      = payload.data;
      state.adminDriversTotal = payload.total;
    });

    addCases(builder, adminFetchAvailableDrivers, (state, { payload }) => {
      state.adminAvailableDrivers = payload.data;
    });

    addCases(builder, adminFetchDriverById, (state, { payload }) => {
      state.adminDriverDetail = payload.data;
    });

    addCases(builder, adminVerifyDriverKyc, (state, { payload }) => {
      if (state.adminDriverDetail?._id === payload.data?._id) {
        state.adminDriverDetail = { ...state.adminDriverDetail, ...payload.data };
      }
      toast.success(payload.message || 'KYC updated');
    });

    addCases(builder, adminBlockDriver, (state, { payload }) => {
      if (state.adminDriverDetail) state.adminDriverDetail.isBlocked = true;
      const idx = state.adminDrivers.findIndex((d) => d.isBlocked !== undefined);
      toast.success(payload.message || 'Driver blocked');
    });

    addCases(builder, adminUnblockDriver, (state, { payload }) => {
      if (state.adminDriverDetail) state.adminDriverDetail.isBlocked = false;
      toast.success(payload.message || 'Driver unblocked');
    });

    addCases(builder, adminUpdateDriverNotes, (state, { payload }) => {
      if (state.adminDriverDetail) {
        state.adminDriverDetail.adminNotes = payload.data?.adminNotes;
      }
      toast.success('Admin notes saved');
    });

    addCases(builder, adminAdjustDriverCoins, (state, { payload }) => {
      if (state.adminDriverDetail?.rewards) {
        state.adminDriverDetail.rewards.coinBalance = payload.coinBalance;
      }
      toast.success(payload.message || 'Coins adjusted');
    });

    addCases(builder, adminFetchDriverLogs, (state, { payload }) => {
      state.adminDriverLogs = payload.data;
    });

    // ── §L ────────────────────────────────────────────────────────────────

    addCases(builder, adminFetchGlobalPricing, (state, { payload }) => {
      state.globalPricing = payload.data;
    });

    addCases(builder, adminUpdateGlobalPricing, (state, { payload }) => {
      state.globalPricing = payload.data;
      toast.success(payload.message || 'Global pricing updated');
    });

    addCases(builder, adminSetPartnerPlatformFee, (state, { payload }) => {
      if (state.adminPartnerDetail) {
        state.adminPartnerDetail.platformFeeOverride = payload.data;
      }
      toast.success(payload.message || 'Platform fee updated');
    });

    addCases(builder, adminProcessPartnerSettlement, (state, { payload }) => {
      toast.success(payload.message || 'Settlement processed');
    });

    // ── §M ────────────────────────────────────────────────────────────────

    addCases(builder, adminFetchTransportLogs, (state, { payload }) => {
      state.adminLogs      = payload.data;
      state.adminLogsTotal = payload.total;
    });

    addCases(builder, adminFetchTransportStats, (state, { payload }) => {
      state.adminStats = payload.data;
    });
  },
});

export const { clearTPError, resetTPState } = transportPartnerSlice.actions;

export default transportPartnerSlice.reducer;