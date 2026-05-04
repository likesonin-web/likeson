/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OPERATIONS SLICE — Likeson.in
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ── Driver ──────────────────────────────────────────────────────────────────
 *  fetchDriverAssigned       GET  /bookings/driver/assigned
 *  acceptRide                PATCH /bookings/:id/ride/accept
 *  rejectRide                PATCH /bookings/:id/ride/reject
 *  markRideArrived           PATCH /bookings/:id/ride/arrived
 *  startRide                 POST  /bookings/:id/ride/start
 *  endRide                   POST  /bookings/:id/ride/end
 *  updateDriverLocation      PATCH /bookings/driver/location
 *
 *  ── Solo Driver Partner ─────────────────────────────────────────────────────
 *  fetchSoloAvailable        GET  /bookings/solo/available
 *  soloAcceptRide            PATCH /bookings/:id/solo/accept
 *  soloRejectRide            PATCH /bookings/:id/solo/reject
 *  soloMarkArrived           PATCH /bookings/:id/solo/arrived
 *  soloStartRide             POST  /bookings/:id/solo/start
 *  soloEndRide               POST  /bookings/:id/solo/end
 *  updateSoloLocation        PATCH /bookings/solo/location
 *
 *  ── Transport Partner ───────────────────────────────────────────────────────
 *  fetchTpAssigned           GET  /bookings/tp/assigned
 *  fetchTpAvailableDrivers   GET  /bookings/tp/drivers/available
 *  tpAssignDriver            PATCH /bookings/:id/tp/assign-driver
 *  tpReassignDriver          PATCH /bookings/:id/tp/reassign-driver
 *
 *  ── Care Assistant ──────────────────────────────────────────────────────────
 *  fetchCareAssigned         GET  /bookings/care/assigned
 *  markCareArrived           PATCH /bookings/:id/care/arrived
 *  startCareTask             PATCH /bookings/:id/care/start
 *  completeCareTask          PATCH /bookings/:id/care/complete
 *  updateCareLocation        PATCH /bookings/care/location
 *
 *  ── Hospital ────────────────────────────────────────────────────────────────
 *  fetchHospitalUpcoming     GET  /bookings/hospital/upcoming
 *  hospitalConfirm           PATCH /bookings/:id/hospital/confirm
 *  fetchHospitalOps          GET  /bookings/hospital/:hospitalId/ops
 *  fetchHospitalValidOps     GET  /bookings/hospital/:hospitalId/valid-ops
 *
 *  ── Doctor ──────────────────────────────────────────────────────────────────
 *  fetchDoctorOps            GET  /bookings/doctor/ops
 *  fetchDoctorOpByNumber     GET  /bookings/doctor/ops/:opNumber
 *  completeOp                PATCH /bookings/:id/op/complete
 *
 *  ── OP Public (customer + doctor + admin) ───────────────────────────────────
 *  fetchOpByNumber           GET  /bookings/op/:opNumber
 *  fetchOpFollowUps          GET  /bookings/op/:opNumber/follow-ups
 *  downloadOpZip             GET  /bookings/op/:opNumber/download
 *
 *  ── Admin: bookings ─────────────────────────────────────────────────────────
 *  fetchAdminBookings        GET  /bookings/admin/bookings
 *  fetchAdminBookingStats    GET  /bookings/admin/bookings/stats
 *  exportAdminBookings       GET  /bookings/admin/bookings/export
 *  fetchAdminBookingById     GET  /bookings/admin/bookings/:id
 *  updateAdminBookingStatus  PATCH /bookings/admin/bookings/:id/status
 *  fetchNearbySoloDrivers    GET  /bookings/admin/bookings/:id/nearby/solo-drivers
 *  fetchNearbyTPs            GET  /bookings/admin/bookings/:id/nearby/transport-partners
 *  fetchNearbyCareAssistants GET  /bookings/admin/bookings/:id/nearby/care-assistants
 *  fetchNearbyHospitals      GET  /bookings/admin/bookings/:id/nearby/hospitals
 *  adminAssignSoloDriver     POST /bookings/admin/bookings/:id/assign/solo-driver
 *  adminAssignTP             POST /bookings/admin/bookings/:id/assign/transport-partner
 *  adminAssignCareAssistant  POST /bookings/admin/bookings/:id/assign/care-assistant
 *  adminAssignHospital       POST /bookings/admin/bookings/:id/assign/hospital
 *  adminReassignDriver       PATCH /bookings/admin/bookings/:id/reassign/driver
 *  adminReassignCare         PATCH /bookings/admin/bookings/:id/reassign/care
 *  adminProcessRefund        POST /bookings/admin/bookings/:id/refund
 *  fetchAdminOps             GET  /bookings/admin/ops
 *  updateAdminOpStatus       PATCH /bookings/admin/ops/:id/status
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SLICE_NAME = 'operations';

const RS = Object.freeze({
  IDLE:    'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  FAILED:  'failed',
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const extractError = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;
  const msg = error?.response?.data?.message;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error')
    return 'Network error. Check your connection.';
  if (error?.code === 'ECONNABORTED') return 'Request timed out. Please retry.';
  return fallback;
};

const notLoading = (loadingKey) => (_arg, { getState }) => {
  const keys = loadingKey.split('.');
  let val = getState()[SLICE_NAME];
  for (const k of keys) val = val?.[k];
  return val !== RS.LOADING;
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const asyncNode = (extra = {}) => ({
  status: RS.IDLE,
  error:  null,
  data:   null,
  ...extra,
});

const listNode = () => ({
  data:   [],
  total:  0,
  page:   1,
  pages:  1,
  status: RS.IDLE,
  error:  null,
});

const initialState = {
  // ── Driver ─────────────────────────────────────────────────────────────
  driverAssigned:    listNode(),
  rideAction:        asyncNode({ bookingId: null }),
  driverLocation:    asyncNode(),

  // ── Solo Driver Partner ─────────────────────────────────────────────────
  soloAvailable:     listNode(),
  soloRideAction:    asyncNode({ bookingId: null }),
  soloLocation:      asyncNode(),

  // ── Transport Partner ───────────────────────────────────────────────────
  tpAssigned:         listNode(),
  tpAvailableDrivers: asyncNode({ drivers: [] }),
  tpDriverAction:     asyncNode({ bookingId: null }),

  // ── Care Assistant ──────────────────────────────────────────────────────
  careAssigned:  listNode(),
  careAction:    asyncNode({ bookingId: null }),
  careLocation:  asyncNode(),

  // ── Hospital ────────────────────────────────────────────────────────────
  hospitalUpcoming:  listNode(),
  hospitalAction:    asyncNode({ bookingId: null }),
  hospitalOps:       listNode(),
  hospitalValidOps:  listNode(),

  // ── Doctor ──────────────────────────────────────────────────────────────
  doctorOps:         listNode(),
  doctorOpDetail:    asyncNode({ followUps: [], isFollowUpEligible: false, daysRemaining: 0 }),
  opCompleteAction:  asyncNode({ bookingId: null }),

  // ── OP Public ───────────────────────────────────────────────────────────
  opRecord:          asyncNode({ followUps: [], isFollowUpEligible: false, daysRemaining: 0 }),
  opFollowUps:       asyncNode({ followUps: [], total: 0 }),
  opDownload:        asyncNode(),

  // ── Admin: bookings ─────────────────────────────────────────────────────
  adminBookings: {
    data:   [],
    total:  0,
    page:   1,
    pages:  1,
    status: RS.IDLE,
    error:  null,
  },
  adminBookingDetail: asyncNode({ opRecord: null, followUps: [] }),
  adminStats:         asyncNode(),
  adminExport:        asyncNode(),
  adminStatusUpdate:  asyncNode({ bookingId: null }),

  // ── Admin: nearby ────────────────────────────────────────────────────────
  nearbySoloDrivers:    asyncNode({ results: [] }),
  nearbyTPs:            asyncNode({ results: [] }),
  nearbyCareAssistants: asyncNode({ results: [] }),
  nearbyHospitals:      asyncNode({ results: [] }),

  // ── Admin: assignments ────────────────────────────────────────────────────
  adminAssignment: asyncNode({ bookingId: null }),

  // ── Admin: refund ─────────────────────────────────────────────────────────
  adminRefund: asyncNode({ bookingId: null }),

  // ── Admin: OP management ─────────────────────────────────────────────────
  adminOps: {
    data:   [],
    total:  0,
    page:   1,
    pages:  1,
    status: RS.IDLE,
    error:  null,
  },
  adminOpStatusUpdate: asyncNode({ opId: null }),
};

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — DRIVER
// ═════════════════════════════════════════════════════════════════════════════

export const fetchDriverAssigned = createAsyncThunk(
  `${SLICE_NAME}/fetchDriverAssigned`,
  async (_arg, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/driver/assigned');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('driverAssigned.status') }
);

export const acceptRide = createAsyncThunk(
  `${SLICE_NAME}/acceptRide`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/ride/accept`);
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('rideAction.status') }
);

export const rejectRide = createAsyncThunk(
  `${SLICE_NAME}/rejectRide`,
  async ({ bookingId, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/ride/reject`, { reason });
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('rideAction.status') }
);

export const markRideArrived = createAsyncThunk(
  `${SLICE_NAME}/markRideArrived`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/ride/arrived`);
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('rideAction.status') }
);

export const startRide = createAsyncThunk(
  `${SLICE_NAME}/startRide`,
  async ({ bookingId, otp }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/bookings/${bookingId}/ride/start`, { otp });
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('rideAction.status') }
);

export const endRide = createAsyncThunk(
  `${SLICE_NAME}/endRide`,
  async ({ bookingId, dropPhotoUrl, actualDistanceKm }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/bookings/${bookingId}/ride/end`, {
        dropPhotoUrl,
        actualDistanceKm,
      });
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('rideAction.status') }
);

/** GPS fallback — silent */
export const updateDriverLocation = createAsyncThunk(
  `${SLICE_NAME}/updateDriverLocation`,
  async ({ lat, lng, heading, speed, bookingId }, { rejectWithValue }) => {
    try {
      await API.patch('/bookings/driver/location', { lat, lng, heading, speed, bookingId });
      return null;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — SOLO DRIVER PARTNER
// ═════════════════════════════════════════════════════════════════════════════

export const fetchSoloAvailable = createAsyncThunk(
  `${SLICE_NAME}/fetchSoloAvailable`,
  async (_arg, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/solo/available');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('soloAvailable.status') }
);

export const soloAcceptRide = createAsyncThunk(
  `${SLICE_NAME}/soloAcceptRide`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/solo/accept`);
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('soloRideAction.status') }
);

export const soloRejectRide = createAsyncThunk(
  `${SLICE_NAME}/soloRejectRide`,
  async ({ bookingId, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/solo/reject`, { reason });
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('soloRideAction.status') }
);

export const soloMarkArrived = createAsyncThunk(
  `${SLICE_NAME}/soloMarkArrived`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/solo/arrived`);
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('soloRideAction.status') }
);

export const soloStartRide = createAsyncThunk(
  `${SLICE_NAME}/soloStartRide`,
  async ({ bookingId, otp }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/bookings/${bookingId}/solo/start`, { otp });
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('soloRideAction.status') }
);

export const soloEndRide = createAsyncThunk(
  `${SLICE_NAME}/soloEndRide`,
  async ({ bookingId, dropPhotoUrl, actualDistanceKm }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/bookings/${bookingId}/solo/end`, {
        dropPhotoUrl,
        actualDistanceKm,
      });
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('soloRideAction.status') }
);

export const updateSoloLocation = createAsyncThunk(
  `${SLICE_NAME}/updateSoloLocation`,
  async ({ lat, lng, heading, speed, bookingId }, { rejectWithValue }) => {
    try {
      await API.patch('/bookings/solo/location', { lat, lng, heading, speed, bookingId });
      return null;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — TRANSPORT PARTNER
// ═════════════════════════════════════════════════════════════════════════════

export const fetchTpAssigned = createAsyncThunk(
  `${SLICE_NAME}/fetchTpAssigned`,
  async (_arg, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/tp/assigned');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('tpAssigned.status') }
);

export const fetchTpAvailableDrivers = createAsyncThunk(
  `${SLICE_NAME}/fetchTpAvailableDrivers`,
  async (_arg, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/tp/drivers/available');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('tpAvailableDrivers.status') }
);

export const tpAssignDriver = createAsyncThunk(
  `${SLICE_NAME}/tpAssignDriver`,
  async ({ bookingId, driverId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/tp/assign-driver`, { driverId });
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('tpDriverAction.status') }
);

export const tpReassignDriver = createAsyncThunk(
  `${SLICE_NAME}/tpReassignDriver`,
  async ({ bookingId, newDriverId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/tp/reassign-driver`, { newDriverId });
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('tpDriverAction.status') }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — CARE ASSISTANT
// ═════════════════════════════════════════════════════════════════════════════

export const fetchCareAssigned = createAsyncThunk(
  `${SLICE_NAME}/fetchCareAssigned`,
  async (_arg, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/care/assigned');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('careAssigned.status') }
);

export const markCareArrived = createAsyncThunk(
  `${SLICE_NAME}/markCareArrived`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/care/arrived`);
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('careAction.status') }
);

export const startCareTask = createAsyncThunk(
  `${SLICE_NAME}/startCareTask`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/care/start`);
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('careAction.status') }
);

export const completeCareTask = createAsyncThunk(
  `${SLICE_NAME}/completeCareTask`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/care/complete`);
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('careAction.status') }
);

export const updateCareLocation = createAsyncThunk(
  `${SLICE_NAME}/updateCareLocation`,
  async ({ lat, lng, bookingId }, { rejectWithValue }) => {
    try {
      await API.patch('/bookings/care/location', { lat, lng, bookingId });
      return null;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — HOSPITAL
// ═════════════════════════════════════════════════════════════════════════════

export const fetchHospitalUpcoming = createAsyncThunk(
  `${SLICE_NAME}/fetchHospitalUpcoming`,
  async (_arg, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/hospital/upcoming');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('hospitalUpcoming.status') }
);

export const hospitalConfirm = createAsyncThunk(
  `${SLICE_NAME}/hospitalConfirm`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/hospital/confirm`);
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('hospitalAction.status') }
);

/**
 * GET /bookings/hospital/:hospitalId/ops
 * Hospital staff view all OPs at their hospital.
 * params: { hospitalId, status?, doctorId?, date?, page?, limit? }
 */
export const fetchHospitalOps = createAsyncThunk(
  `${SLICE_NAME}/fetchHospitalOps`,
  async ({ hospitalId, ...params }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/hospital/${hospitalId}/ops`, { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('hospitalOps.status') }
);

/**
 * GET /bookings/hospital/:hospitalId/valid-ops
 * OPs with active follow-up window (followUpExpiry > now).
 * params: { hospitalId, doctorId?, patientId?, page?, limit? }
 */
export const fetchHospitalValidOps = createAsyncThunk(
  `${SLICE_NAME}/fetchHospitalValidOps`,
  async ({ hospitalId, ...params }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/hospital/${hospitalId}/valid-ops`, { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('hospitalValidOps.status') }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — DOCTOR
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /bookings/doctor/ops
 * Doctor views all their OPs.
 * params: { status?, hospitalId?, patientId?, date?, page?, limit? }
 */
export const fetchDoctorOps = createAsyncThunk(
  `${SLICE_NAME}/fetchDoctorOps`,
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/doctor/ops', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('doctorOps.status') }
);

/**
 * GET /bookings/doctor/ops/:opNumber
 * Doctor views single OP with follow-up chain.
 */
export const fetchDoctorOpByNumber = createAsyncThunk(
  `${SLICE_NAME}/fetchDoctorOpByNumber`,
  async (opNumber, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/doctor/ops/${opNumber}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('doctorOpDetail.status') }
);

/**
 * PATCH /bookings/:id/op/complete
 * Doctor marks OP complete + adds notes/prescription/diagnosis.
 * body: { doctorNotes?, prescriptionUrl?, diagnosisCode?, reasonForVisit? }
 */
export const completeOp = createAsyncThunk(
  `${SLICE_NAME}/completeOp`,
  async ({ bookingId, doctorNotes, prescriptionUrl, diagnosisCode, reasonForVisit }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/${bookingId}/op/complete`, {
        doctorNotes,
        prescriptionUrl,
        diagnosisCode,
        reasonForVisit,
      });
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('opCompleteAction.status') }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — OP PUBLIC (customer + doctor + admin)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /bookings/op/:opNumber
 * Fetch OP card. Access scoped by role on server.
 */
export const fetchOpByNumber = createAsyncThunk(
  `${SLICE_NAME}/fetchOpByNumber`,
  async (opNumber, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/op/${opNumber}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('opRecord.status') }
);

/**
 * GET /bookings/op/:opNumber/follow-ups
 * All follow-up OPs for a given parent OP.
 */
export const fetchOpFollowUps = createAsyncThunk(
  `${SLICE_NAME}/fetchOpFollowUps`,
  async (opNumber, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/op/${opNumber}/follow-ups`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('opFollowUps.status') }
);

/**
 * GET /bookings/op/:opNumber/download
 * Download OP ZIP file — triggers browser download via Blob.
 */
export const downloadOpZip = createAsyncThunk(
  `${SLICE_NAME}/downloadOpZip`,
  async (opNumber, { rejectWithValue }) => {
    try {
      const response = await API.get(`/bookings/op/${opNumber}/download`, {
        responseType: 'blob',
      });
      const url      = window.URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }));
      const anchor   = document.createElement('a');
      anchor.href    = url;
      anchor.download = `${opNumber}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      return { opNumber };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Download failed.'));
    }
  },
  { condition: notLoading('opDownload.status') }
);

// ═════════════════════════════════════════════════════════════════════════════
// THUNKS — ADMIN: BOOKINGS
// ═════════════════════════════════════════════════════════════════════════════

export const fetchAdminBookings = createAsyncThunk(
  `${SLICE_NAME}/fetchAdminBookings`,
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/admin/bookings', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminBookings.status') }
);

export const fetchAdminBookingStats = createAsyncThunk(
  `${SLICE_NAME}/fetchAdminBookingStats`,
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/admin/bookings/stats', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminStats.status') }
);

export const exportAdminBookings = createAsyncThunk(
  `${SLICE_NAME}/exportAdminBookings`,
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await API.get('/bookings/admin/bookings/export', {
        params,
        responseType: 'blob',
      });
      const url    = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const anchor = document.createElement('a');
      anchor.href  = url;
      anchor.download = `bookings-export-${Date.now()}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      return null;
    } catch (err) {
      return rejectWithValue(extractError(err, 'Export failed.'));
    }
  },
  { condition: notLoading('adminExport.status') }
);

export const fetchAdminBookingById = createAsyncThunk(
  `${SLICE_NAME}/fetchAdminBookingById`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/admin/bookings/${bookingId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminBookingDetail.status') }
);

export const updateAdminBookingStatus = createAsyncThunk(
  `${SLICE_NAME}/updateAdminBookingStatus`,
  async ({ bookingId, status, note }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/admin/bookings/${bookingId}/status`, { status, note });
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminStatusUpdate.status') }
);

// ── Nearby lookups ────────────────────────────────────────────────────────────

export const fetchNearbySoloDrivers = createAsyncThunk(
  `${SLICE_NAME}/fetchNearbySoloDrivers`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/admin/bookings/${bookingId}/nearby/solo-drivers`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('nearbySoloDrivers.status') }
);

export const fetchNearbyTPs = createAsyncThunk(
  `${SLICE_NAME}/fetchNearbyTPs`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/admin/bookings/${bookingId}/nearby/transport-partners`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('nearbyTPs.status') }
);

export const fetchNearbyCareAssistants = createAsyncThunk(
  `${SLICE_NAME}/fetchNearbyCareAssistants`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/admin/bookings/${bookingId}/nearby/care-assistants`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('nearbyCareAssistants.status') }
);

export const fetchNearbyHospitals = createAsyncThunk(
  `${SLICE_NAME}/fetchNearbyHospitals`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/admin/bookings/${bookingId}/nearby/hospitals`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('nearbyHospitals.status') }
);

// ── Admin assignments ─────────────────────────────────────────────────────────

export const adminAssignSoloDriver = createAsyncThunk(
  `${SLICE_NAME}/adminAssignSoloDriver`,
  async ({ bookingId, soloDriverPartnerId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/bookings/admin/bookings/${bookingId}/assign/solo-driver`,
        { soloDriverPartnerId }
      );
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminAssignment.status') }
);

export const adminAssignTP = createAsyncThunk(
  `${SLICE_NAME}/adminAssignTP`,
  async ({ bookingId, transportPartnerId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/bookings/admin/bookings/${bookingId}/assign/transport-partner`,
        { transportPartnerId }
      );
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminAssignment.status') }
);

export const adminAssignCareAssistant = createAsyncThunk(
  `${SLICE_NAME}/adminAssignCareAssistant`,
  async ({ bookingId, careAssistantId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/bookings/admin/bookings/${bookingId}/assign/care-assistant`,
        { careAssistantId }
      );
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminAssignment.status') }
);

export const adminAssignHospital = createAsyncThunk(
  `${SLICE_NAME}/adminAssignHospital`,
  async ({ bookingId, hospitalId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/bookings/admin/bookings/${bookingId}/assign/hospital`,
        { hospitalId }
      );
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminAssignment.status') }
);

export const adminReassignDriver = createAsyncThunk(
  `${SLICE_NAME}/adminReassignDriver`,
  async ({ bookingId, newDriverUserId, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/bookings/admin/bookings/${bookingId}/reassign/driver`,
        { newDriverUserId, reason }
      );
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminAssignment.status') }
);

export const adminReassignCare = createAsyncThunk(
  `${SLICE_NAME}/adminReassignCare`,
  async ({ bookingId, newCareAssistantId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/bookings/admin/bookings/${bookingId}/reassign/care`,
        { newCareAssistantId }
      );
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminAssignment.status') }
);

export const adminProcessRefund = createAsyncThunk(
  `${SLICE_NAME}/adminProcessRefund`,
  async ({ bookingId, refundAmount, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/bookings/admin/bookings/${bookingId}/refund`,
        { refundAmount, reason }
      );
      return { bookingId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminRefund.status') }
);

// ── Admin OP management ───────────────────────────────────────────────────────

export const fetchAdminOps = createAsyncThunk(
  `${SLICE_NAME}/fetchAdminOps`,
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/admin/ops', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminOps.status') }
);

export const updateAdminOpStatus = createAsyncThunk(
  `${SLICE_NAME}/updateAdminOpStatus`,
  async ({ opId, status, doctorNotes }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/bookings/admin/ops/${opId}/status`, { status, doctorNotes });
      return { opId, ...data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  },
  { condition: notLoading('adminOpStatusUpdate.status') }
);

// ═════════════════════════════════════════════════════════════════════════════
// SLICE
// ═════════════════════════════════════════════════════════════════════════════

const operationsSlice = createSlice({
  name: SLICE_NAME,
  initialState,

  reducers: {
    // ── Resets ──────────────────────────────────────────────────────────────
    resetRideAction:          (state) => { state.rideAction         = asyncNode({ bookingId: null }); },
    resetSoloRideAction:      (state) => { state.soloRideAction     = asyncNode({ bookingId: null }); },
    resetTpDriverAction:      (state) => { state.tpDriverAction     = asyncNode({ bookingId: null }); },
    resetCareAction:          (state) => { state.careAction         = asyncNode({ bookingId: null }); },
    resetHospitalAction:      (state) => { state.hospitalAction     = asyncNode({ bookingId: null }); },
    resetAdminAssignment:     (state) => { state.adminAssignment    = asyncNode({ bookingId: null }); },
    resetAdminRefund:         (state) => { state.adminRefund        = asyncNode({ bookingId: null }); },
    resetAdminStatusUpdate:   (state) => { state.adminStatusUpdate  = asyncNode({ bookingId: null }); },
    resetAdminOpStatusUpdate: (state) => { state.adminOpStatusUpdate= asyncNode({ opId: null }); },
    resetOpCompleteAction:    (state) => { state.opCompleteAction   = asyncNode({ bookingId: null }); },
    clearAdminBookingDetail:  (state) => { state.adminBookingDetail = asyncNode({ opRecord: null, followUps: [] }); },
    clearDoctorOpDetail:      (state) => { state.doctorOpDetail     = asyncNode({ followUps: [], isFollowUpEligible: false, daysRemaining: 0 }); },
    clearOpRecord:            (state) => { state.opRecord           = asyncNode({ followUps: [], isFollowUpEligible: false, daysRemaining: 0 }); },
    clearOpFollowUps:         (state) => { state.opFollowUps        = asyncNode({ followUps: [], total: 0 }); },
    clearHospitalOps:         (state) => { state.hospitalOps        = listNode(); },
    clearHospitalValidOps:    (state) => { state.hospitalValidOps   = listNode(); },
    clearNearbyResults: (state) => {
      state.nearbySoloDrivers    = asyncNode({ results: [] });
      state.nearbyTPs            = asyncNode({ results: [] });
      state.nearbyCareAssistants = asyncNode({ results: [] });
      state.nearbyHospitals      = asyncNode({ results: [] });
    },

    /**
     * Optimistic patch: sync booking status in admin list after socket event.
     * payload: { bookingId: string, status: string }
     */
    patchAdminBookingStatus(state, { payload: { bookingId, status } }) {
      const idx = state.adminBookings.data.findIndex((b) => b._id === bookingId);
      if (idx !== -1) state.adminBookings.data[idx].status = status;
      if (state.adminBookingDetail.data?.booking?._id === bookingId) {
        state.adminBookingDetail.data.booking.status = status;
      }
    },

    /** Remove ride from driver assigned list after accept/reject. payload = bookingId */
    removeFromDriverAssigned(state, { payload: bookingId }) {
      state.driverAssigned.data = state.driverAssigned.data.filter(
        (r) => r.booking?._id !== bookingId && r.booking !== bookingId
      );
    },

    /** Full wipe on logout */
    resetOperationsState: () => initialState,
  },

  extraReducers: (builder) => {

    // ── fetchDriverAssigned ─────────────────────────────────────────────────
    builder
      .addCase(fetchDriverAssigned.pending,   (state) => { state.driverAssigned.status = RS.LOADING; state.driverAssigned.error = null; })
      .addCase(fetchDriverAssigned.fulfilled, (state, { payload }) => {
        state.driverAssigned.status = RS.SUCCESS;
        state.driverAssigned.data   = payload.rides ?? [];
      })
      .addCase(fetchDriverAssigned.rejected,  (state, { payload }) => {
        state.driverAssigned.status = RS.FAILED;
        state.driverAssigned.error  = payload;
        toast.error(payload || 'Failed to load assigned rides.');
      });

    // ── ride actions (accept / reject / arrived / start / end) ─────────────
    const rideActionPending = (state, { meta }) => {
      state.rideAction.status    = RS.LOADING;
      state.rideAction.error     = null;
      state.rideAction.data      = null;
      state.rideAction.bookingId = meta.arg?.bookingId ?? meta.arg;
    };
    const rideActionFailed = (state, { payload }) => {
      state.rideAction.status = RS.FAILED;
      state.rideAction.error  = payload;
      toast.error(payload || 'Ride action failed.');
    };

    builder
      .addCase(acceptRide.pending,      rideActionPending)
      .addCase(rejectRide.pending,      rideActionPending)
      .addCase(markRideArrived.pending, rideActionPending)
      .addCase(startRide.pending,       rideActionPending)
      .addCase(endRide.pending,         rideActionPending);

    builder
      .addCase(acceptRide.fulfilled, (state, { payload }) => {
        state.rideAction.status = RS.SUCCESS;
        state.rideAction.data   = payload;
        toast.success('Ride accepted.');
      })
      .addCase(rejectRide.fulfilled, (state, { payload }) => {
        state.rideAction.status = RS.SUCCESS;
        state.rideAction.data   = payload;
        toast.success('Ride rejected. Will be reassigned.');
      })
      .addCase(markRideArrived.fulfilled, (state, { payload }) => {
        state.rideAction.status = RS.SUCCESS;
        state.rideAction.data   = payload;
        toast.success('Arrival marked. OTP sent to customer.');
      })
      .addCase(startRide.fulfilled, (state, { payload }) => {
        state.rideAction.status = RS.SUCCESS;
        state.rideAction.data   = payload;
        toast.success('Ride started.');
      })
      .addCase(endRide.fulfilled, (state, { payload }) => {
        state.rideAction.status = RS.SUCCESS;
        state.rideAction.data   = payload;
        toast.success('Ride completed.');
      });

    builder
      .addCase(acceptRide.rejected,      rideActionFailed)
      .addCase(rejectRide.rejected,      rideActionFailed)
      .addCase(markRideArrived.rejected, rideActionFailed)
      .addCase(startRide.rejected,       rideActionFailed)
      .addCase(endRide.rejected,         rideActionFailed);

    // location — silent
    builder
      .addCase(updateDriverLocation.pending,   () => {})
      .addCase(updateDriverLocation.fulfilled, () => {})
      .addCase(updateDriverLocation.rejected,  () => {});

    // ── fetchSoloAvailable ──────────────────────────────────────────────────
    builder
      .addCase(fetchSoloAvailable.pending,   (state) => { state.soloAvailable.status = RS.LOADING; state.soloAvailable.error = null; })
      .addCase(fetchSoloAvailable.fulfilled, (state, { payload }) => {
        state.soloAvailable.status = RS.SUCCESS;
        state.soloAvailable.data   = payload.rides ?? [];
      })
      .addCase(fetchSoloAvailable.rejected,  (state, { payload }) => {
        state.soloAvailable.status = RS.FAILED;
        state.soloAvailable.error  = payload;
        toast.error(payload || 'Failed to load available rides.');
      });

    // ── solo ride actions ───────────────────────────────────────────────────
    const soloActionPending = (state, { meta }) => {
      state.soloRideAction.status    = RS.LOADING;
      state.soloRideAction.error     = null;
      state.soloRideAction.data      = null;
      state.soloRideAction.bookingId = meta.arg?.bookingId ?? meta.arg;
    };
    const soloActionFailed = (state, { payload }) => {
      state.soloRideAction.status = RS.FAILED;
      state.soloRideAction.error  = payload;
      toast.error(payload || 'Action failed.');
    };

    builder
      .addCase(soloAcceptRide.pending,  soloActionPending)
      .addCase(soloRejectRide.pending,  soloActionPending)
      .addCase(soloMarkArrived.pending, soloActionPending)
      .addCase(soloStartRide.pending,   soloActionPending)
      .addCase(soloEndRide.pending,     soloActionPending);

    builder
      .addCase(soloAcceptRide.fulfilled, (state, { payload }) => {
        state.soloRideAction.status = RS.SUCCESS;
        state.soloRideAction.data   = payload;
        toast.success('Ride accepted.');
      })
      .addCase(soloRejectRide.fulfilled, (state, { payload }) => {
        state.soloRideAction.status = RS.SUCCESS;
        state.soloRideAction.data   = payload;
        toast.success('Ride rejected. Admin notified.');
      })
      .addCase(soloMarkArrived.fulfilled, (state, { payload }) => {
        state.soloRideAction.status = RS.SUCCESS;
        state.soloRideAction.data   = payload;
        toast.success('Arrived. OTP sent to customer.');
      })
      .addCase(soloStartRide.fulfilled, (state, { payload }) => {
        state.soloRideAction.status = RS.SUCCESS;
        state.soloRideAction.data   = payload;
        toast.success('Ride started.');
      })
      .addCase(soloEndRide.fulfilled, (state, { payload }) => {
        state.soloRideAction.status = RS.SUCCESS;
        state.soloRideAction.data   = payload;
        toast.success('Ride completed.');
      });

    builder
      .addCase(soloAcceptRide.rejected,  soloActionFailed)
      .addCase(soloRejectRide.rejected,  soloActionFailed)
      .addCase(soloMarkArrived.rejected, soloActionFailed)
      .addCase(soloStartRide.rejected,   soloActionFailed)
      .addCase(soloEndRide.rejected,     soloActionFailed);

    builder
      .addCase(updateSoloLocation.pending,   () => {})
      .addCase(updateSoloLocation.fulfilled, () => {})
      .addCase(updateSoloLocation.rejected,  () => {});

    // ── fetchTpAssigned ─────────────────────────────────────────────────────
    builder
      .addCase(fetchTpAssigned.pending,   (state) => { state.tpAssigned.status = RS.LOADING; state.tpAssigned.error = null; })
      .addCase(fetchTpAssigned.fulfilled, (state, { payload }) => {
        state.tpAssigned.status = RS.SUCCESS;
        state.tpAssigned.data   = payload.bookings ?? [];
      })
      .addCase(fetchTpAssigned.rejected,  (state, { payload }) => {
        state.tpAssigned.status = RS.FAILED;
        state.tpAssigned.error  = payload;
        toast.error(payload || 'Failed to load assigned bookings.');
      });

    // ── fetchTpAvailableDrivers ─────────────────────────────────────────────
    builder
      .addCase(fetchTpAvailableDrivers.pending,   (state) => { state.tpAvailableDrivers.status = RS.LOADING; state.tpAvailableDrivers.error = null; })
      .addCase(fetchTpAvailableDrivers.fulfilled, (state, { payload }) => {
        state.tpAvailableDrivers.status  = RS.SUCCESS;
        state.tpAvailableDrivers.drivers = payload.drivers ?? [];
      })
      .addCase(fetchTpAvailableDrivers.rejected,  (state, { payload }) => {
        state.tpAvailableDrivers.status = RS.FAILED;
        state.tpAvailableDrivers.error  = payload;
        toast.error(payload || 'Failed to load drivers.');
      });

    // ── TP driver actions ───────────────────────────────────────────────────
    builder
      .addCase(tpAssignDriver.pending, (state, { meta }) => {
        state.tpDriverAction.status    = RS.LOADING;
        state.tpDriverAction.error     = null;
        state.tpDriverAction.bookingId = meta.arg.bookingId;
      })
      .addCase(tpAssignDriver.fulfilled, (state, { payload }) => {
        state.tpDriverAction.status = RS.SUCCESS;
        state.tpDriverAction.data   = payload;
        const idx = state.tpAssigned.data.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) state.tpAssigned.data[idx].status = 'confirmed';
        toast.success('Driver assigned.');
      })
      .addCase(tpAssignDriver.rejected, (state, { payload }) => {
        state.tpDriverAction.status = RS.FAILED;
        state.tpDriverAction.error  = payload;
        toast.error(payload || 'Driver assignment failed.');
      });

    builder
      .addCase(tpReassignDriver.pending, (state, { meta }) => {
        state.tpDriverAction.status    = RS.LOADING;
        state.tpDriverAction.error     = null;
        state.tpDriverAction.bookingId = meta.arg.bookingId;
      })
      .addCase(tpReassignDriver.fulfilled, (state, { payload }) => {
        state.tpDriverAction.status = RS.SUCCESS;
        state.tpDriverAction.data   = payload;
        toast.success('Driver reassigned.');
      })
      .addCase(tpReassignDriver.rejected, (state, { payload }) => {
        state.tpDriverAction.status = RS.FAILED;
        state.tpDriverAction.error  = payload;
        toast.error(payload || 'Reassignment failed.');
      });

    // ── fetchCareAssigned ───────────────────────────────────────────────────
    builder
      .addCase(fetchCareAssigned.pending,   (state) => { state.careAssigned.status = RS.LOADING; state.careAssigned.error = null; })
      .addCase(fetchCareAssigned.fulfilled, (state, { payload }) => {
        state.careAssigned.status = RS.SUCCESS;
        state.careAssigned.data   = payload.bookings ?? [];
      })
      .addCase(fetchCareAssigned.rejected,  (state, { payload }) => {
        state.careAssigned.status = RS.FAILED;
        state.careAssigned.error  = payload;
        toast.error(payload || 'Failed to load care bookings.');
      });

    // ── care actions ────────────────────────────────────────────────────────
    const careActionPending = (state, { meta }) => {
      state.careAction.status    = RS.LOADING;
      state.careAction.error     = null;
      state.careAction.data      = null;
      state.careAction.bookingId = meta.arg?.bookingId ?? meta.arg;
    };
    const careActionFailed = (state, { payload }) => {
      state.careAction.status = RS.FAILED;
      state.careAction.error  = payload;
      toast.error(payload || 'Care action failed.');
    };

    builder
      .addCase(markCareArrived.pending,  careActionPending)
      .addCase(startCareTask.pending,    careActionPending)
      .addCase(completeCareTask.pending, careActionPending);

    builder
      .addCase(markCareArrived.fulfilled, (state, { payload }) => {
        state.careAction.status = RS.SUCCESS;
        state.careAction.data   = payload;
        toast.success('Arrival confirmed.');
      })
      .addCase(startCareTask.fulfilled, (state, { payload }) => {
        state.careAction.status = RS.SUCCESS;
        state.careAction.data   = payload;
        toast.success('Task started.');
      })
      .addCase(completeCareTask.fulfilled, (state, { payload }) => {
        state.careAction.status = RS.SUCCESS;
        state.careAction.data   = payload;
        const idx = state.careAssigned.data.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) state.careAssigned.data[idx].status = 'completed';
        toast.success('Task completed.');
      });

    builder
      .addCase(markCareArrived.rejected,  careActionFailed)
      .addCase(startCareTask.rejected,    careActionFailed)
      .addCase(completeCareTask.rejected, careActionFailed);

    builder
      .addCase(updateCareLocation.pending,   () => {})
      .addCase(updateCareLocation.fulfilled, () => {})
      .addCase(updateCareLocation.rejected,  () => {});

    // ── fetchHospitalUpcoming ───────────────────────────────────────────────
    builder
      .addCase(fetchHospitalUpcoming.pending,   (state) => { state.hospitalUpcoming.status = RS.LOADING; state.hospitalUpcoming.error = null; })
      .addCase(fetchHospitalUpcoming.fulfilled, (state, { payload }) => {
        state.hospitalUpcoming.status = RS.SUCCESS;
        state.hospitalUpcoming.data   = payload.bookings ?? [];
      })
      .addCase(fetchHospitalUpcoming.rejected,  (state, { payload }) => {
        state.hospitalUpcoming.status = RS.FAILED;
        state.hospitalUpcoming.error  = payload;
        toast.error(payload || 'Failed to load upcoming appointments.');
      });

    // ── hospitalConfirm ─────────────────────────────────────────────────────
    builder
      .addCase(hospitalConfirm.pending, (state, { meta }) => {
        state.hospitalAction.status    = RS.LOADING;
        state.hospitalAction.error     = null;
        state.hospitalAction.bookingId = meta.arg;
      })
      .addCase(hospitalConfirm.fulfilled, (state, { payload }) => {
        state.hospitalAction.status = RS.SUCCESS;
        state.hospitalAction.data   = payload;
        toast.success('Appointment slot confirmed.');
      })
      .addCase(hospitalConfirm.rejected, (state, { payload }) => {
        state.hospitalAction.status = RS.FAILED;
        state.hospitalAction.error  = payload;
        toast.error(payload || 'Confirmation failed.');
      });

    // ── fetchHospitalOps ────────────────────────────────────────────────────
    builder
      .addCase(fetchHospitalOps.pending,   (state) => { state.hospitalOps.status = RS.LOADING; state.hospitalOps.error = null; })
      .addCase(fetchHospitalOps.fulfilled, (state, { payload }) => {
        state.hospitalOps.status = RS.SUCCESS;
        state.hospitalOps.data   = payload.ops ?? [];
        state.hospitalOps.total  = payload.total ?? 0;
        state.hospitalOps.page   = payload.page  ?? 1;
        state.hospitalOps.pages  = payload.pages ?? 1;
      })
      .addCase(fetchHospitalOps.rejected,  (state, { payload }) => {
        state.hospitalOps.status = RS.FAILED;
        state.hospitalOps.error  = payload;
        toast.error(payload || 'Failed to load hospital OPs.');
      });

    // ── fetchHospitalValidOps ───────────────────────────────────────────────
    builder
      .addCase(fetchHospitalValidOps.pending,   (state) => { state.hospitalValidOps.status = RS.LOADING; state.hospitalValidOps.error = null; })
      .addCase(fetchHospitalValidOps.fulfilled, (state, { payload }) => {
        state.hospitalValidOps.status = RS.SUCCESS;
        state.hospitalValidOps.data   = payload.ops ?? [];
        state.hospitalValidOps.total  = payload.total ?? 0;
        state.hospitalValidOps.page   = payload.page  ?? 1;
        state.hospitalValidOps.pages  = payload.pages ?? 1;
      })
      .addCase(fetchHospitalValidOps.rejected,  (state, { payload }) => {
        state.hospitalValidOps.status = RS.FAILED;
        state.hospitalValidOps.error  = payload;
        toast.error(payload || 'Failed to load valid OPs.');
      });

    // ── fetchDoctorOps ──────────────────────────────────────────────────────
    builder
      .addCase(fetchDoctorOps.pending,   (state) => { state.doctorOps.status = RS.LOADING; state.doctorOps.error = null; })
      .addCase(fetchDoctorOps.fulfilled, (state, { payload }) => {
        state.doctorOps.status = RS.SUCCESS;
        state.doctorOps.data   = payload.ops ?? [];
        state.doctorOps.total  = payload.total ?? 0;
        state.doctorOps.page   = payload.page  ?? 1;
        state.doctorOps.pages  = payload.pages ?? 1;
      })
      .addCase(fetchDoctorOps.rejected,  (state, { payload }) => {
        state.doctorOps.status = RS.FAILED;
        state.doctorOps.error  = payload;
        toast.error(payload || 'Failed to load your OPs.');
      });

    // ── fetchDoctorOpByNumber ───────────────────────────────────────────────
    builder
      .addCase(fetchDoctorOpByNumber.pending,   (state) => {
        state.doctorOpDetail.status              = RS.LOADING;
        state.doctorOpDetail.error               = null;
        state.doctorOpDetail.data                = null;
        state.doctorOpDetail.followUps           = [];
        state.doctorOpDetail.isFollowUpEligible  = false;
        state.doctorOpDetail.daysRemaining       = 0;
      })
      .addCase(fetchDoctorOpByNumber.fulfilled, (state, { payload }) => {
        state.doctorOpDetail.status             = RS.SUCCESS;
        state.doctorOpDetail.data               = payload.op;
        state.doctorOpDetail.followUps          = payload.followUps ?? [];
        state.doctorOpDetail.isFollowUpEligible = payload.isFollowUpEligible ?? false;
        state.doctorOpDetail.daysRemaining      = payload.daysRemaining ?? 0;
      })
      .addCase(fetchDoctorOpByNumber.rejected,  (state, { payload }) => {
        state.doctorOpDetail.status = RS.FAILED;
        state.doctorOpDetail.error  = payload;
        toast.error(payload || 'Failed to load OP record.');
      });

    // ── completeOp ──────────────────────────────────────────────────────────
    builder
      .addCase(completeOp.pending, (state, { meta }) => {
        state.opCompleteAction.status    = RS.LOADING;
        state.opCompleteAction.error     = null;
        state.opCompleteAction.data      = null;
        state.opCompleteAction.bookingId = meta.arg.bookingId;
      })
      .addCase(completeOp.fulfilled, (state, { payload }) => {
        state.opCompleteAction.status = RS.SUCCESS;
        state.opCompleteAction.data   = payload;
        // sync status in doctorOps list if present
        const idx = state.doctorOps.data.findIndex((op) => op.booking === payload.bookingId || op.booking?._id === payload.bookingId);
        if (idx !== -1) state.doctorOps.data[idx].status = 'completed';
        // sync in doctorOpDetail
        if (state.doctorOpDetail.data?.booking === payload.bookingId ||
            state.doctorOpDetail.data?.booking?._id === payload.bookingId) {
          state.doctorOpDetail.data.status = 'completed';
        }
        toast.success('OP completed. Patient notified.');
      })
      .addCase(completeOp.rejected, (state, { payload }) => {
        state.opCompleteAction.status = RS.FAILED;
        state.opCompleteAction.error  = payload;
        toast.error(payload || 'Failed to complete OP.');
      });

    // ── fetchOpByNumber ─────────────────────────────────────────────────────
    builder
      .addCase(fetchOpByNumber.pending,   (state) => {
        state.opRecord.status             = RS.LOADING;
        state.opRecord.error              = null;
        state.opRecord.data               = null;
        state.opRecord.followUps          = [];
        state.opRecord.isFollowUpEligible = false;
        state.opRecord.daysRemaining      = 0;
      })
      .addCase(fetchOpByNumber.fulfilled, (state, { payload }) => {
        state.opRecord.status             = RS.SUCCESS;
        state.opRecord.data               = payload.op;
        state.opRecord.followUps          = payload.followUps ?? [];
        state.opRecord.isFollowUpEligible = payload.isFollowUpEligible ?? false;
        state.opRecord.daysRemaining      = payload.daysRemaining ?? 0;
      })
      .addCase(fetchOpByNumber.rejected,  (state, { payload }) => {
        state.opRecord.status = RS.FAILED;
        state.opRecord.error  = payload;
        toast.error(payload || 'Failed to load OP record.');
      });

    // ── fetchOpFollowUps ────────────────────────────────────────────────────
    builder
      .addCase(fetchOpFollowUps.pending,   (state) => {
        state.opFollowUps.status    = RS.LOADING;
        state.opFollowUps.error     = null;
        state.opFollowUps.followUps = [];
        state.opFollowUps.total     = 0;
      })
      .addCase(fetchOpFollowUps.fulfilled, (state, { payload }) => {
        state.opFollowUps.status    = RS.SUCCESS;
        state.opFollowUps.followUps = payload.followUps ?? [];
        state.opFollowUps.total     = payload.total ?? 0;
      })
      .addCase(fetchOpFollowUps.rejected,  (state, { payload }) => {
        state.opFollowUps.status = RS.FAILED;
        state.opFollowUps.error  = payload;
        toast.error(payload || 'Failed to load follow-ups.');
      });

    // ── downloadOpZip ───────────────────────────────────────────────────────
    builder
      .addCase(downloadOpZip.pending,   (state) => { state.opDownload.status = RS.LOADING; state.opDownload.error = null; })
      .addCase(downloadOpZip.fulfilled, (state, { payload }) => {
        state.opDownload.status = RS.SUCCESS;
        state.opDownload.data   = payload;
        toast.success('OP card downloaded.');
      })
      .addCase(downloadOpZip.rejected,  (state, { payload }) => {
        state.opDownload.status = RS.FAILED;
        state.opDownload.error  = payload;
        toast.error(payload || 'Download failed.');
      });

    // ── fetchAdminBookings ──────────────────────────────────────────────────
    builder
      .addCase(fetchAdminBookings.pending,   (state) => { state.adminBookings.status = RS.LOADING; state.adminBookings.error = null; })
      .addCase(fetchAdminBookings.fulfilled, (state, { payload }) => {
        state.adminBookings.status = RS.SUCCESS;
        state.adminBookings.data   = payload.bookings;
        state.adminBookings.total  = payload.total;
        state.adminBookings.page   = payload.page;
        state.adminBookings.pages  = payload.pages;
      })
      .addCase(fetchAdminBookings.rejected,  (state, { payload }) => {
        state.adminBookings.status = RS.FAILED;
        state.adminBookings.error  = payload;
        toast.error(payload || 'Failed to load bookings.');
      });

    // ── fetchAdminBookingStats ──────────────────────────────────────────────
    builder
      .addCase(fetchAdminBookingStats.pending,   (state) => { state.adminStats.status = RS.LOADING; state.adminStats.error = null; state.adminStats.data = null; })
      .addCase(fetchAdminBookingStats.fulfilled, (state, { payload }) => {
        state.adminStats.status = RS.SUCCESS;
        state.adminStats.data   = payload;
      })
      .addCase(fetchAdminBookingStats.rejected,  (state, { payload }) => {
        state.adminStats.status = RS.FAILED;
        state.adminStats.error  = payload;
        toast.error(payload || 'Failed to load stats.');
      });

    // ── exportAdminBookings ─────────────────────────────────────────────────
    builder
      .addCase(exportAdminBookings.pending,   (state) => { state.adminExport.status = RS.LOADING; state.adminExport.error = null; })
      .addCase(exportAdminBookings.fulfilled, (state) => {
        state.adminExport.status = RS.SUCCESS;
        toast.success('Export downloaded.');
      })
      .addCase(exportAdminBookings.rejected,  (state, { payload }) => {
        state.adminExport.status = RS.FAILED;
        state.adminExport.error  = payload;
        toast.error(payload || 'Export failed.');
      });

    // ── fetchAdminBookingById ───────────────────────────────────────────────
    builder
      .addCase(fetchAdminBookingById.pending,   (state) => {
        state.adminBookingDetail.status   = RS.LOADING;
        state.adminBookingDetail.error    = null;
        state.adminBookingDetail.data     = null;
        state.adminBookingDetail.opRecord = null;
        state.adminBookingDetail.followUps = [];
      })
      .addCase(fetchAdminBookingById.fulfilled, (state, { payload }) => {
        state.adminBookingDetail.status    = RS.SUCCESS;
        state.adminBookingDetail.data      = payload.booking;
        state.adminBookingDetail.opRecord  = payload.opRecord  ?? null;
        state.adminBookingDetail.followUps = payload.followUps ?? [];
      })
      .addCase(fetchAdminBookingById.rejected,  (state, { payload }) => {
        state.adminBookingDetail.status = RS.FAILED;
        state.adminBookingDetail.error  = payload;
        toast.error(payload || 'Failed to load booking detail.');
      });

    // ── updateAdminBookingStatus ────────────────────────────────────────────
    builder
      .addCase(updateAdminBookingStatus.pending, (state, { meta }) => {
        state.adminStatusUpdate.status    = RS.LOADING;
        state.adminStatusUpdate.error     = null;
        state.adminStatusUpdate.bookingId = meta.arg.bookingId;
      })
      .addCase(updateAdminBookingStatus.fulfilled, (state, { payload }) => {
        state.adminStatusUpdate.status = RS.SUCCESS;
        state.adminStatusUpdate.data   = payload;
        const idx = state.adminBookings.data.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) state.adminBookings.data[idx].status = payload.booking?.status ?? payload.status;
        if (state.adminBookingDetail.data?._id === payload.bookingId && payload.booking) {
          state.adminBookingDetail.data.status = payload.booking.status;
        }
        toast.success('Booking status updated.');
      })
      .addCase(updateAdminBookingStatus.rejected, (state, { payload }) => {
        state.adminStatusUpdate.status = RS.FAILED;
        state.adminStatusUpdate.error  = payload;
        toast.error(payload || 'Status update failed.');
      });

    // ── nearby lookups ──────────────────────────────────────────────────────
    builder
      .addCase(fetchNearbySoloDrivers.pending,   (state) => { state.nearbySoloDrivers.status = RS.LOADING; state.nearbySoloDrivers.error = null; })
      .addCase(fetchNearbySoloDrivers.fulfilled, (state, { payload }) => {
        state.nearbySoloDrivers.status  = RS.SUCCESS;
        state.nearbySoloDrivers.results = payload.results ?? [];
        state.nearbySoloDrivers.data    = payload;
      })
      .addCase(fetchNearbySoloDrivers.rejected,  (state, { payload }) => {
        state.nearbySoloDrivers.status = RS.FAILED;
        state.nearbySoloDrivers.error  = payload;
        toast.error(payload || 'Failed to fetch nearby drivers.');
      });

    builder
      .addCase(fetchNearbyTPs.pending,   (state) => { state.nearbyTPs.status = RS.LOADING; state.nearbyTPs.error = null; })
      .addCase(fetchNearbyTPs.fulfilled, (state, { payload }) => {
        state.nearbyTPs.status  = RS.SUCCESS;
        state.nearbyTPs.results = payload.results ?? [];
        state.nearbyTPs.data    = payload;
      })
      .addCase(fetchNearbyTPs.rejected,  (state, { payload }) => {
        state.nearbyTPs.status = RS.FAILED;
        state.nearbyTPs.error  = payload;
        toast.error(payload || 'Failed to fetch nearby TPs.');
      });

    builder
      .addCase(fetchNearbyCareAssistants.pending,   (state) => { state.nearbyCareAssistants.status = RS.LOADING; state.nearbyCareAssistants.error = null; })
      .addCase(fetchNearbyCareAssistants.fulfilled, (state, { payload }) => {
        state.nearbyCareAssistants.status  = RS.SUCCESS;
        state.nearbyCareAssistants.results = payload.results ?? [];
        state.nearbyCareAssistants.data    = payload;
      })
      .addCase(fetchNearbyCareAssistants.rejected,  (state, { payload }) => {
        state.nearbyCareAssistants.status = RS.FAILED;
        state.nearbyCareAssistants.error  = payload;
        toast.error(payload || 'Failed to fetch nearby care assistants.');
      });

    builder
      .addCase(fetchNearbyHospitals.pending,   (state) => { state.nearbyHospitals.status = RS.LOADING; state.nearbyHospitals.error = null; })
      .addCase(fetchNearbyHospitals.fulfilled, (state, { payload }) => {
        state.nearbyHospitals.status  = RS.SUCCESS;
        state.nearbyHospitals.results = payload.results ?? [];
        state.nearbyHospitals.data    = payload;
      })
      .addCase(fetchNearbyHospitals.rejected,  (state, { payload }) => {
        state.nearbyHospitals.status = RS.FAILED;
        state.nearbyHospitals.error  = payload;
        toast.error(payload || 'Failed to fetch nearby hospitals.');
      });

    // ── admin assignments (all 6 share one node) ────────────────────────────
    const assignPending = (state, { meta }) => {
      state.adminAssignment.status    = RS.LOADING;
      state.adminAssignment.error     = null;
      state.adminAssignment.data      = null;
      state.adminAssignment.bookingId = meta.arg.bookingId;
    };
    const assignFailed = (state, { payload }) => {
      state.adminAssignment.status = RS.FAILED;
      state.adminAssignment.error  = payload;
      toast.error(payload || 'Assignment failed.');
    };

    builder
      .addCase(adminAssignSoloDriver.pending,    assignPending)
      .addCase(adminAssignTP.pending,            assignPending)
      .addCase(adminAssignCareAssistant.pending, assignPending)
      .addCase(adminAssignHospital.pending,      assignPending)
      .addCase(adminReassignDriver.pending,      assignPending)
      .addCase(adminReassignCare.pending,        assignPending);

    builder
      .addCase(adminAssignSoloDriver.fulfilled, (state, { payload }) => {
        state.adminAssignment.status = RS.SUCCESS;
        state.adminAssignment.data   = payload;
        const idx = state.adminBookings.data.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) state.adminBookings.data[idx].status = 'confirmed';
        toast.success('Solo driver assigned.');
      })
      .addCase(adminAssignTP.fulfilled, (state, { payload }) => {
        state.adminAssignment.status = RS.SUCCESS;
        state.adminAssignment.data   = payload;
        const idx = state.adminBookings.data.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) state.adminBookings.data[idx].status = 'confirmed';
        toast.success('Transport partner assigned.');
      })
      .addCase(adminAssignCareAssistant.fulfilled, (state, { payload }) => {
        state.adminAssignment.status = RS.SUCCESS;
        state.adminAssignment.data   = payload;
        toast.success('Care assistant assigned.');
      })
      .addCase(adminAssignHospital.fulfilled, (state, { payload }) => {
        state.adminAssignment.status = RS.SUCCESS;
        state.adminAssignment.data   = payload;
        toast.success('Hospital linked.');
      })
      .addCase(adminReassignDriver.fulfilled, (state, { payload }) => {
        state.adminAssignment.status = RS.SUCCESS;
        state.adminAssignment.data   = payload;
        toast.success('Driver reassigned.');
      })
      .addCase(adminReassignCare.fulfilled, (state, { payload }) => {
        state.adminAssignment.status = RS.SUCCESS;
        state.adminAssignment.data   = payload;
        toast.success('Care assistant reassigned.');
      });

    builder
      .addCase(adminAssignSoloDriver.rejected,   assignFailed)
      .addCase(adminAssignTP.rejected,           assignFailed)
      .addCase(adminAssignCareAssistant.rejected,assignFailed)
      .addCase(adminAssignHospital.rejected,     assignFailed)
      .addCase(adminReassignDriver.rejected,     assignFailed)
      .addCase(adminReassignCare.rejected,       assignFailed);

    // ── adminProcessRefund ──────────────────────────────────────────────────
    builder
      .addCase(adminProcessRefund.pending, (state, { meta }) => {
        state.adminRefund.status    = RS.LOADING;
        state.adminRefund.error     = null;
        state.adminRefund.data      = null;
        state.adminRefund.bookingId = meta.arg.bookingId;
      })
      .addCase(adminProcessRefund.fulfilled, (state, { payload }) => {
        state.adminRefund.status = RS.SUCCESS;
        state.adminRefund.data   = payload;
        const idx = state.adminBookings.data.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) state.adminBookings.data[idx].status = 'refunded';
        toast.success('Refund initiated.');
      })
      .addCase(adminProcessRefund.rejected, (state, { payload }) => {
        state.adminRefund.status = RS.FAILED;
        state.adminRefund.error  = payload;
        toast.error(payload || 'Refund failed.');
      });

    // ── fetchAdminOps ───────────────────────────────────────────────────────
    builder
      .addCase(fetchAdminOps.pending,   (state) => { state.adminOps.status = RS.LOADING; state.adminOps.error = null; })
      .addCase(fetchAdminOps.fulfilled, (state, { payload }) => {
        state.adminOps.status = RS.SUCCESS;
        state.adminOps.data   = payload.ops;
        state.adminOps.total  = payload.total;
        state.adminOps.page   = payload.page;
        state.adminOps.pages  = payload.pages;
      })
      .addCase(fetchAdminOps.rejected,  (state, { payload }) => {
        state.adminOps.status = RS.FAILED;
        state.adminOps.error  = payload;
        toast.error(payload || 'Failed to load OP records.');
      });

    // ── updateAdminOpStatus ─────────────────────────────────────────────────
    builder
      .addCase(updateAdminOpStatus.pending, (state, { meta }) => {
        state.adminOpStatusUpdate.status = RS.LOADING;
        state.adminOpStatusUpdate.error  = null;
        state.adminOpStatusUpdate.opId   = meta.arg.opId;
      })
      .addCase(updateAdminOpStatus.fulfilled, (state, { payload }) => {
        state.adminOpStatusUpdate.status = RS.SUCCESS;
        state.adminOpStatusUpdate.data   = payload;
        const idx = state.adminOps.data.findIndex((op) => op._id === payload.opId);
        if (idx !== -1) state.adminOps.data[idx].status = payload.op?.status ?? payload.status;
        toast.success('OP status updated.');
      })
      .addCase(updateAdminOpStatus.rejected, (state, { payload }) => {
        state.adminOpStatusUpdate.status = RS.FAILED;
        state.adminOpStatusUpdate.error  = payload;
        toast.error(payload || 'OP status update failed.');
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  resetRideAction,
  resetSoloRideAction,
  resetTpDriverAction,
  resetCareAction,
  resetHospitalAction,
  resetAdminAssignment,
  resetAdminRefund,
  resetAdminStatusUpdate,
  resetAdminOpStatusUpdate,
  resetOpCompleteAction,
  clearAdminBookingDetail,
  clearDoctorOpDetail,
  clearOpRecord,
  clearOpFollowUps,
  clearHospitalOps,
  clearHospitalValidOps,
  clearNearbyResults,
  patchAdminBookingStatus,
  removeFromDriverAssigned,
  resetOperationsState,
} = operationsSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

const s = (state) => state[SLICE_NAME];

// ── Driver ──────────────────────────────────────────────────────────────────
export const selectDriverAssigned      = (state) => s(state).driverAssigned.data;
export const selectDriverAssignedMeta  = (state) => s(state).driverAssigned;
export const selectRideAction          = (state) => s(state).rideAction;
export const selectRideActionLoading   = (state) => s(state).rideAction.status === RS.LOADING;

// ── Solo ─────────────────────────────────────────────────────────────────────
export const selectSoloAvailable       = (state) => s(state).soloAvailable.data;
export const selectSoloAvailableMeta   = (state) => s(state).soloAvailable;
export const selectSoloRideAction      = (state) => s(state).soloRideAction;
export const selectSoloRideLoading     = (state) => s(state).soloRideAction.status === RS.LOADING;

// ── TP ───────────────────────────────────────────────────────────────────────
export const selectTpAssigned          = (state) => s(state).tpAssigned.data;
export const selectTpAssignedMeta      = (state) => s(state).tpAssigned;
export const selectTpAvailableDrivers  = (state) => s(state).tpAvailableDrivers.drivers;
export const selectTpAvailableMeta     = (state) => s(state).tpAvailableDrivers;
export const selectTpDriverAction      = (state) => s(state).tpDriverAction;
export const selectTpDriverLoading     = (state) => s(state).tpDriverAction.status === RS.LOADING;

// ── Care ─────────────────────────────────────────────────────────────────────
export const selectCareAssigned        = (state) => s(state).careAssigned.data;
export const selectCareAssignedMeta    = (state) => s(state).careAssigned;
export const selectCareAction          = (state) => s(state).careAction;
export const selectCareActionLoading   = (state) => s(state).careAction.status === RS.LOADING;

// ── Hospital ─────────────────────────────────────────────────────────────────
export const selectHospitalUpcoming    = (state) => s(state).hospitalUpcoming.data;
export const selectHospitalUpcomingMeta= (state) => s(state).hospitalUpcoming;
export const selectHospitalAction      = (state) => s(state).hospitalAction;
export const selectHospitalOps         = (state) => s(state).hospitalOps.data;
export const selectHospitalOpsMeta     = (state) => s(state).hospitalOps;
export const selectHospitalValidOps    = (state) => s(state).hospitalValidOps.data;
export const selectHospitalValidOpsMeta= (state) => s(state).hospitalValidOps;

// ── Doctor ───────────────────────────────────────────────────────────────────
export const selectDoctorOps           = (state) => s(state).doctorOps.data;
export const selectDoctorOpsMeta       = (state) => s(state).doctorOps;
export const selectDoctorOpsLoading    = (state) => s(state).doctorOps.status === RS.LOADING;
export const selectDoctorOpDetail      = (state) => s(state).doctorOpDetail.data;
export const selectDoctorOpFollowUps   = (state) => s(state).doctorOpDetail.followUps;
export const selectDoctorOpDetailMeta  = (state) => s(state).doctorOpDetail;
export const selectOpCompleteAction    = (state) => s(state).opCompleteAction;
export const selectOpCompleteLoading   = (state) => s(state).opCompleteAction.status === RS.LOADING;

// ── OP Public ────────────────────────────────────────────────────────────────
export const selectOpRecord            = (state) => s(state).opRecord.data;
export const selectOpRecordFollowUps   = (state) => s(state).opRecord.followUps;
export const selectOpRecordMeta        = (state) => s(state).opRecord;
export const selectOpFollowUps         = (state) => s(state).opFollowUps.followUps;
export const selectOpFollowUpsMeta     = (state) => s(state).opFollowUps;
export const selectOpDownload          = (state) => s(state).opDownload;
export const selectOpDownloadLoading   = (state) => s(state).opDownload.status === RS.LOADING;

// ── Admin bookings ───────────────────────────────────────────────────────────
export const selectAdminBookings             = (state) => s(state).adminBookings.data;
export const selectAdminBookingsMeta         = (state) => s(state).adminBookings;
export const selectAdminBookingsLoading      = (state) => s(state).adminBookings.status === RS.LOADING;
export const selectAdminBookingDetail        = (state) => s(state).adminBookingDetail.data;
export const selectAdminOpRecord             = (state) => s(state).adminBookingDetail.opRecord;
export const selectAdminBookingFollowUps     = (state) => s(state).adminBookingDetail.followUps;
export const selectAdminBookingDetailLoading = (state) => s(state).adminBookingDetail.status === RS.LOADING;
export const selectAdminStats                = (state) => s(state).adminStats.data;
export const selectAdminStatsLoading         = (state) => s(state).adminStats.status === RS.LOADING;
export const selectAdminExportLoading        = (state) => s(state).adminExport.status === RS.LOADING;
export const selectAdminStatusUpdate         = (state) => s(state).adminStatusUpdate;

// ── Nearby ───────────────────────────────────────────────────────────────────
export const selectNearbySoloDrivers    = (state) => s(state).nearbySoloDrivers.results ?? [];
export const selectNearbyTPs            = (state) => s(state).nearbyTPs.results ?? [];
export const selectNearbyCareAssistants = (state) => s(state).nearbyCareAssistants.results ?? [];
export const selectNearbyHospitals      = (state) => s(state).nearbyHospitals.results ?? [];
export const selectNearbyLoading        = (state) => (
  s(state).nearbySoloDrivers.status    === RS.LOADING ||
  s(state).nearbyTPs.status            === RS.LOADING ||
  s(state).nearbyCareAssistants.status === RS.LOADING ||
  s(state).nearbyHospitals.status      === RS.LOADING
);

// ── Admin assignment ─────────────────────────────────────────────────────────
export const selectAdminAssignment    = (state) => s(state).adminAssignment;
export const selectAdminAssignLoading = (state) => s(state).adminAssignment.status === RS.LOADING;

// ── Admin refund ─────────────────────────────────────────────────────────────
export const selectAdminRefund        = (state) => s(state).adminRefund;
export const selectAdminRefundLoading = (state) => s(state).adminRefund.status === RS.LOADING;

// ── Admin OPs ────────────────────────────────────────────────────────────────
export const selectAdminOps            = (state) => s(state).adminOps.data;
export const selectAdminOpsMeta        = (state) => s(state).adminOps;
export const selectAdminOpsLoading     = (state) => s(state).adminOps.status === RS.LOADING;
export const selectAdminOpStatusUpdate = (state) => s(state).adminOpStatusUpdate;

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

export default operationsSlice.reducer;