/**
 * operationsSlice.js — Likeson.in
 *
 * Covers EVERY route from bookingRouter1.js + bookingRouter2.js:
 *
 * ── TRANSPORT PARTNER ──────────────────────────────────────────────────────
 *  GET  /tp/assigned
 *  GET  /tp/drivers/available
 *  PATCH /:id/tp/assign-driver
 *  PATCH /:id/tp/reassign-driver
 *
 * ── CARE ASSISTANT ─────────────────────────────────────────────────────────
 *  GET  /care/assigned
 *  PATCH /:id/care/arrived
 *  PATCH /:id/care/start
 *  PATCH /:id/care/complete
 *  PATCH /care/location
 *  POST  /:id/care/request-ride
 *
 * ── HOSPITAL ───────────────────────────────────────────────────────────────
 *  GET  /hospital/upcoming
 *  PATCH /:id/hospital/confirm
 *  GET  /hospital/:hospitalId/ops
 *  GET  /hospital/:hospitalId/valid-ops
 *
 * ── DOCTOR ─────────────────────────────────────────────────────────────────
 *  GET  /doctor/ops
 *  GET  /doctor/ops/:opNumber
 *  PATCH /:id/op/complete
 *
 * ── OP CARD ────────────────────────────────────────────────────────────────
 *  GET  /op/:opNumber
 *  GET  /op/:opNumber/follow-ups
 *  GET  /op/:opNumber/download   (blob download)
 *
 * ── DRIVER ─────────────────────────────────────────────────────────────────
 *  GET  /driver/assigned
 *  PATCH /:id/ride/accept
 *  PATCH /:id/ride/reject
 *  PATCH /:id/ride/arrived
 *  POST  /:id/ride/end
 *  PATCH /driver/location         (HTTP GPS fallback)
 *
 * ── CUSTOMER ───────────────────────────────────────────────────────────────
 *  POST  /:id/request-ride
 *
 * ── ADMIN ─────────────────────────────────────────────────────────────────
 *  GET  /admin/bookings
 *  GET  /admin/bookings/stats
 *  GET  /admin/bookings/export    (CSV download)
 *  GET  /admin/bookings/:id
 *  PATCH /admin/bookings/:id/status
 *  GET  /admin/bookings/:id/nearby/care-assistants
 *  GET  /admin/bookings/:id/nearby/solo-drivers
 *  GET  /admin/bookings/:id/nearby/transport-partners
 *  GET  /admin/bookings/:id/nearby/hospitals
 *  POST  /admin/bookings/:id/assign/solo-driver
 *  POST  /admin/bookings/:id/assign/transport-partner
 *  POST  /admin/bookings/:id/assign/care-assistant
 *  POST  /admin/bookings/:id/assign/hospital
 *  PATCH /admin/bookings/:id/reassign/driver
 *  PATCH /admin/bookings/:id/reassign/care
 *  POST  /admin/bookings/:id/refund
 *  GET  /admin/ops
 *  PATCH /admin/ops/:id/status
 *  POST  /admin/care-ride/request
 *  GET  /admin/care-ride/:bookingId/nearby
 *
 * Socket thunks (thin wrappers around socketService):
 *  joinBookingRoom / leaveBookingRoom
 *  joinTpRoom      / leaveTpRoom
 *  verifyOtp       (socket-only — HTTP /ride/start removed)
 *  updateDriverStatus
 *  startGpsTracking / stopGpsTracking
 *  triggerSos
 *  reportRouteDeviation
 *  requestBookingState
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast                              from 'react-hot-toast';

import API                              from '../api';
import socketService, { DRIVER_STATUS } from '@/services/socketService';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const BASE = '/bookings';

/**
 * mkThunk — factory for standard API async thunks.
 *
 * @param {string} type  - slice/actionName
 * @param {(arg, api) => Promise<any>} fn
 */
const mkThunk = (type, fn) =>
  createAsyncThunk(type, async (arg, api) => {
    try {
      return await fn(arg, api);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Something went wrong';
      toast.error(msg);
      return api.rejectWithValue(msg);
    }
  });

/** downloadBlob — trigger browser download from blob response */
const downloadBlob = (data, filename, mime = 'application/octet-stream') => {
  const url  = window.URL.createObjectURL(new Blob([data], { type: mime }));
  const link = document.createElement('a');
  link.href  = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // ── Lists ────────────────────────────────────────────────────────────────
  adminBookings:         [],
  adminBookingsMeta:     { total: 0, page: 1, pages: 1 },
  adminStats:            null,

  adminOps:              [],
  adminOpsMeta:          { total: 0, page: 1, pages: 1 },

  tpAssignedBookings:    [],
  tpAvailableDrivers:    [],

  careAssignedBookings:  [],

  hospitalUpcoming:      [],
  hospitalOps:           [],
  hospitalOpsMeta:       { total: 0, page: 1, pages: 1 },
  hospitalValidOps:      [],
  hospitalValidOpsMeta:  { total: 0, page: 1, pages: 1 },

  doctorOps:             [],
  doctorOpsMeta:         { total: 0, page: 1, pages: 1 },

  driverAssignedRides:   [],
  driverInfo:            null,

  nearbyDrivers:         [],
  nearbyCareAssistants:  [],
  nearbyTPs:             [],
  nearbyHospitals:       [],
  careRideNearby:        null,

  // after activeRide:
careTrackingSnapshot:  null,   // from fetchCareTrackingSnapshot
careAssistantLocation: null,   // from socket care_assistant_location_update
careAssistantStatus:   null,   // from socket care_assistant_status_change
careAssistantJoined:   null,   // from socket care_assistant_joined_ride
careRideStatus: {
  status:                null,
  activeTarget:          null,
  activeNavigationTarget: null,   // ← ADD: canonical field
  rideStage:             null,    // ← ADD: new field from backend
  currentLeg:            null,
  patientPickedUp:       false,
  careAssistantJoined:   false,
  hospitalReached:       false,
  handoverCompleted:     false,
},

  // ── Single-record ────────────────────────────────────────────────────────
  selectedBooking:       null,
  selectedOp:            null,
  selectedFollowUps:     [],
  bookingSnapshot:       null,      // from socket request_booking_state
  activeRide:            null,      // ride returned from ride/end or accept

  // ── Admin operation result tracking ─────────────────────────────────────
  adminStatusUpdate:     null,      // { booking } from updateAdminBookingStatus
  adminAssignment:       null,      // { booking } from any assign thunk
  adminRefund:           null,      // { booking } from adminProcessRefund
  adminOpStatusUpdate:   null,      // { op } from updateAdminOpStatus

  // ── Socket / live state ──────────────────────────────────────────────────
  liveLocation:          null,      // latest location_update payload
  etaUpdate:             null,      // latest eta_update payload
  rideStatus:            null,      // latest ride_status_changed payload
  bookingStatus:         null,      // latest booking_status_change payload
  navigationTarget:      null,      // navigation_target_changed payload
  sosAlert:              null,
  routeDeviation:        null,
  otpResult:             null,
  gpsTracking:           false,
  socketConnected:       false,     // set externally via setSocketConnected action

  // ── Loading map — key = thunk typePrefix ────────────────────────────────
  loading:               {},

  // ── Error map — key = thunk typePrefix ───────────────────────────────────
  errors:                {},
};

// ─────────────────────────────────────────────────────────────────────────────
// ── TRANSPORT PARTNER THUNKS ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const fetchTpAssignedBookings = mkThunk(
  'operations/fetchTpAssignedBookings',
  async () => {
    const { data } = await API.get(`${BASE}/tp/assigned`);
    return data.data;
  }
);

export const fetchTpAvailableDrivers = mkThunk(
  'operations/fetchTpAvailableDrivers',
  async () => {
    const { data } = await API.get(`${BASE}/tp/drivers/available`);
    return data.data;
  }
);

export const tpAssignDriver = mkThunk(
  'operations/tpAssignDriver',
  async ({ bookingId, driverId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/tp/assign-driver`, { driverId });
    toast.success('Driver assigned');
    return data.data;
  }
);

export const tpReassignDriver = mkThunk(
  'operations/tpReassignDriver',
  async ({ bookingId, newDriverId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/tp/reassign-driver`, { newDriverId });
    toast.success('Driver reassigned');
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── CARE ASSISTANT THUNKS ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const fetchCareAssignedBookings = mkThunk(
  'operations/fetchCareAssignedBookings',
  async () => {
    const { data } = await API.get(`${BASE}/care/assigned`);
    return data.data;
  }
);

export const markCareArrived = mkThunk(
  'operations/markCareArrived',
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/arrived`);
    toast.success('Arrival marked');
    return data;
  }
);

export const markCareStart = mkThunk(
  'operations/markCareStart',
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/start`);
    toast.success('Task started');
    return data;
  }
);

export const markCareComplete = mkThunk(
  'operations/markCareComplete',
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/complete`);
    toast.success('Task completed');
    return data;
  }
);

export const updateCareLocation = mkThunk(
  'operations/updateCareLocation',
  async ({ lat, lng, bookingId, status }) => {
    const { data } = await API.patch(`${BASE}/care/location`, {
      lat, lng, bookingId, status,   // ← added status
    });
    return data;
  }
);

export const careRequestRide = mkThunk(
  'operations/careRequestRide',
  async ({ bookingId, pickupLocation, destinationLocation }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/care/request-ride`, {
      pickupLocation, destinationLocation,
    });
    toast.success('Ride requested');
    return data.data;
  }
);

// ADD after careRequestRide thunk

export const careJoinRide = mkThunk(
  'operations/careJoinRide',
  async ({ bookingId, currentLat, currentLng }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/care/join-ride`, {
      currentLat, currentLng,
    });
    toast.success('Joined ride session');
    return data.data;
  }
);

export const careUpdateRideStatus = mkThunk(
  'operations/careUpdateRideStatus',
  async ({ bookingId, status, lat, lng }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/ride-status`, {
      status, lat, lng,
    });
    return data.data;
  }
);

export const fetchCareTrackingSnapshot = mkThunk(
  'operations/fetchCareTrackingSnapshot',
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/${bookingId}/care/tracking-snapshot`);
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── HOSPITAL THUNKS ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const fetchHospitalUpcoming = mkThunk(
  'operations/fetchHospitalUpcoming',
  async () => {
    const { data } = await API.get(`${BASE}/hospital/upcoming`);
    return data.data;
  }
);

export const hospitalConfirmBooking = mkThunk(
  'operations/hospitalConfirmBooking',
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/hospital/confirm`);
    toast.success('Appointment confirmed');
    return data;
  }
);

export const fetchHospitalOps = mkThunk(
  'operations/fetchHospitalOps',
  async ({ hospitalId, status, doctorId, date, page = 1, limit = 20 } = {}) => {
    const { data } = await API.get(`${BASE}/hospital/${hospitalId}/ops`, {
      params: { status, doctorId, date, page, limit },
    });
    return data.data;
  }
);

export const fetchHospitalValidOps = mkThunk(
  'operations/fetchHospitalValidOps',
  async ({ hospitalId, doctorId, patientId, page = 1, limit = 20 } = {}) => {
 
    const { data } = await API.get(`${BASE}/hospital/${hospitalId}/valid-ops`, {
      params: { doctorId, patientId, page, limit },
    });
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── DOCTOR THUNKS ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const fetchDoctorOps = mkThunk(
  'operations/fetchDoctorOps',
  async ({ status, hospitalId, patientId, date, page = 1, limit = 20 } = {}) => {
    const { data } = await API.get(`${BASE}/doctor/ops`, {
      params: { status, hospitalId, patientId, date, page, limit },
    });
    return data.data;
  }
);

export const fetchDoctorOpByNumber = mkThunk(
  'operations/fetchDoctorOpByNumber',
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/doctor/ops/${opNumber}`);
    return data.data;
  }
);

export const completeOp = mkThunk(
  'operations/completeOp',
  async ({ bookingId, doctorNotes, prescriptionUrl, diagnosisCode, reasonForVisit }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/op/complete`, {
      doctorNotes, prescriptionUrl, diagnosisCode, reasonForVisit,
    });
    toast.success('OP completed — sent to patient');
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── OP CARD THUNKS ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const fetchOpByNumber = mkThunk(
  'operations/fetchOpByNumber',
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/op/${opNumber}`);
    return data.data;
  }
);

export const fetchOpFollowUps = mkThunk(
  'operations/fetchOpFollowUps',
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/op/${opNumber}/follow-ups`);
    return data.data;
  }
);

export const downloadOpCard = mkThunk(
  'operations/downloadOpCard',
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/op/${opNumber}/download`, {
      responseType: 'blob',
    });
    downloadBlob(data, `${opNumber}.zip`, 'application/zip');
    return { opNumber };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── DRIVER THUNKS ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const fetchDriverAssignedRides = mkThunk(
  'operations/fetchDriverAssignedRides',
  async () => {
    const { data } = await API.get(`${BASE}/driver/assigned`);
    return data.data;
  }
);

export const acceptRide = mkThunk(
  'operations/acceptRide',
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/accept`);
    toast.success('Ride accepted');
    return data.data;
  }
);

export const rejectRide = mkThunk(
  'operations/rejectRide',
  async ({ bookingId, reason }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/reject`, { reason });
    toast.success('Ride rejected');
    return data;
  }
);

export const markDriverArrived = mkThunk(
  'operations/markDriverArrived',
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/arrived`);
    toast.success('Arrival marked — OTP sent to customer');
    return data;
  }
);

// NOTE: /ride/start HTTP endpoint REMOVED.
// OTP verification is socket-only → use verifyOtpSocket thunk below.

export const endRide = mkThunk(
  'operations/endRide',
  async ({ bookingId, dropPhotoUrl, actualDistanceKm }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/ride/end`, {
      dropPhotoUrl, actualDistanceKm,
    });
    toast.success(data.message || 'Ride completed');
    return data.data;
  }
);

export const updateDriverLocationHttp = mkThunk(
  'operations/updateDriverLocationHttp',
  async ({ lat, lng, heading, speed, bookingId }) => {
    // HTTP GPS fallback — primary path is socket driver_location event
    const { data } = await API.patch(`${BASE}/driver/location`, {
      lat, lng, heading, speed, bookingId,
    });
    return data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── CUSTOMER THUNKS ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const customerRequestRide = mkThunk(
  'operations/customerRequestRide',
  async ({ bookingId, pickupLocation, destinationLocation }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/request-ride`, {
      pickupLocation, destinationLocation,
    });
    toast.success(data.message || 'Ride requested');
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── ADMIN BOOKINGS THUNKS ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAdminBookings = mkThunk(
  'operations/fetchAdminBookings',
  async ({
    status, bookingType, city, date, page = 1, limit = 20,
    search, from, to,
  } = {}) => {
    const { data } = await API.get(`${BASE}/admin/bookings`, {
      params: { status, bookingType, city, date, page, limit, search, from, to },
    });
    return data.data;
  }
);

export const fetchAdminBookingStats = mkThunk(
  'operations/fetchAdminBookingStats',
  async ({ from, to } = {}) => {
    const { data } = await API.get(`${BASE}/admin/bookings/stats`, { params: { from, to } });
    return data.data;
  }
);

export const exportAdminBookings = mkThunk(
  'operations/exportAdminBookings',
  async ({ from, to, status, bookingType } = {}) => {
    const { data } = await API.get(`${BASE}/admin/bookings/export`, {
      params: { from, to, status, bookingType },
      responseType: 'blob',
    });
    downloadBlob(data, `bookings-${Date.now()}.csv`, 'text/csv');
    return { exported: true };
  }
);

export const fetchAdminBookingById = mkThunk(
  'operations/fetchAdminBookingById',
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/admin/bookings/${bookingId}`);
    return data.data;
  }
);

export const updateAdminBookingStatus = mkThunk(
  'operations/updateAdminBookingStatus',
  async ({ bookingId, status, note }) => {
    const { data } = await API.patch(`${BASE}/admin/bookings/${bookingId}/status`, { status, note });
    toast.success('Status updated');
    return data.data;
  }
);

// ── Admin nearby ──────────────────────────────────────────────────────────────

export const fetchNearbyCareAssistants = mkThunk(
  'operations/fetchNearbyCareAssistants',
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/admin/bookings/${bookingId}/nearby/care-assistants`);
    return data.data;
  }
);

export const fetchNearbySoloDrivers = mkThunk(
  'operations/fetchNearbySoloDrivers',
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/admin/bookings/${bookingId}/nearby/solo-drivers`);
    return data.data;
  }
);

// FIXED: was fetchNearbyTPs in import — correct name is fetchNearbyTransportPartners
export const fetchNearbyTransportPartners = mkThunk(
  'operations/fetchNearbyTransportPartners',
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/admin/bookings/${bookingId}/nearby/transport-partners`);
    return data.data;
  }
);

export const fetchNearbyHospitals = mkThunk(
  'operations/fetchNearbyHospitals',
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/admin/bookings/${bookingId}/nearby/hospitals`);
    return data.data;
  }
);

// ── Admin assign ──────────────────────────────────────────────────────────────

export const adminAssignSoloDriver = mkThunk(
  'operations/adminAssignSoloDriver',
  async ({ bookingId, soloDriverPartnerId }) => {
    const { data } = await API.post(`${BASE}/admin/bookings/${bookingId}/assign/solo-driver`, {
      soloDriverPartnerId,
    });
    toast.success('Solo driver assigned');
    return data.data;
  }
);

// FIXED: was adminAssignTP in import — correct name is adminAssignTransportPartner
export const adminAssignTransportPartner = mkThunk(
  'operations/adminAssignTransportPartner',
  async ({ bookingId, transportPartnerId }) => {
    const { data } = await API.post(`${BASE}/admin/bookings/${bookingId}/assign/transport-partner`, {
      transportPartnerId,
    });
    toast.success('Transport partner assigned');
    return data.data;
  }
);

export const adminAssignCareAssistant = mkThunk(
  'operations/adminAssignCareAssistant',
  async ({ bookingId, careAssistantId }) => {
    const { data } = await API.post(`${BASE}/admin/bookings/${bookingId}/assign/care-assistant`, {
      careAssistantId,
    });
    toast.success('Care assistant assigned');
    return data.data;
  }
);

export const adminAssignHospital = mkThunk(
  'operations/adminAssignHospital',
  async ({ bookingId, hospitalId }) => {
    const { data } = await API.post(`${BASE}/admin/bookings/${bookingId}/assign/hospital`, {
      hospitalId,
    });
    toast.success('Hospital linked');
    return data.data;
  }
);

export const adminReassignDriver = mkThunk(
  'operations/adminReassignDriver',
  async ({ bookingId, newDriverId, reason }) => {
    const { data } = await API.patch(`${BASE}/admin/bookings/${bookingId}/reassign/driver`, {
      newDriverId, reason,
    });
    toast.success('Driver reassigned');
    return data.data;
  }
);

// FIXED: was adminReassignCare in import — correct name is adminReassignCareAssistant
export const adminReassignCareAssistant = mkThunk(
  'operations/adminReassignCareAssistant',
  async ({ bookingId, newCareAssistantId }) => {
    const { data } = await API.patch(`${BASE}/admin/bookings/${bookingId}/reassign/care`, {
      newCareAssistantId,
    });
    toast.success('Care assistant reassigned');
    return data;
  }
);

export const adminProcessRefund = mkThunk(
  'operations/adminProcessRefund',
  async ({ bookingId, refundAmount, reason }) => {
    const { data } = await API.post(`${BASE}/admin/bookings/${bookingId}/refund`, {
      refundAmount, reason,
    });
    toast.success('Refund initiated');
    return data.data;
  }
);

// ── Admin OP management ───────────────────────────────────────────────────────

export const fetchAdminOps = mkThunk(
  'operations/fetchAdminOps',
  async ({ doctorId, hospitalId, date, page = 1, limit = 20, status, patientId } = {}) => {
    const { data } = await API.get(`${BASE}/admin/ops`, {
      params: { doctorId, hospitalId, date, page, limit, status, patientId },
    });
    return data.data;
  }
);

export const updateAdminOpStatus = mkThunk(
  'operations/updateAdminOpStatus',
  async ({ opId, status, doctorNotes }) => {
    const { data } = await API.patch(`${BASE}/admin/ops/${opId}/status`, {
      status, doctorNotes,
    });
    toast.success('OP status updated');
    return data.data;
  }
);

// ── Admin care-ride ───────────────────────────────────────────────────────────

export const adminRequestCareRide = mkThunk(
  'operations/adminRequestCareRide',
  async ({
    bookingId, customerId, requesterType, careAssistantId,
    pickupLocation, destinationLocation,
  }) => {
    const { data } = await API.post(`${BASE}/admin/care-ride/request`, {
      bookingId, customerId, requesterType, careAssistantId,
      pickupLocation, destinationLocation,
    });
    toast.success(data.message || 'Care-ride created');
    return data.data;
  }
);

export const fetchAdminCareRideNearby = mkThunk(
  'operations/fetchAdminCareRideNearby',
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/admin/care-ride/${bookingId}/nearby`);
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── SOCKET THUNKS
//    These are lightweight dispatchers — no HTTP call.
//    Components use these so socket calls flow through Redux (logs, loading state).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * joinBookingRoom — join socket booking:{bookingId} room.
 * Server verifies auth before join.
 */
export const joinBookingRoom = createAsyncThunk(
  'operations/joinBookingRoom',
  ({ bookingId }) => {
    socketService.joinBookingRoom(bookingId);
    return { bookingId };
  }
);

export const leaveBookingRoom = createAsyncThunk(
  'operations/leaveBookingRoom',
  ({ bookingId }) => {
    socketService.leaveBookingRoom(bookingId);
    return { bookingId };
  }
);

export const joinTpRoom = createAsyncThunk(
  'operations/joinTpRoom',
  ({ tpId }) => {
    socketService.joinTpRoom(tpId);
    return { tpId };
  }
);

export const leaveTpRoom = createAsyncThunk(
  'operations/leaveTpRoom',
  ({ tpId }) => {
    socketService.leaveTpRoom(tpId);
    return { tpId };
  }
);

/**
 * verifyOtpSocket — SOLE OTP verification path.
 * HTTP /ride/start removed. This calls socket verify_otp event.
 * Resolves with otp_result payload from server.
 */
export const verifyOtpSocket = mkThunk(
  'operations/verifyOtpSocket',
  async ({ bookingId, rideId, otp }) => {
    const result = await socketService.verifyOtpAsync({ bookingId, rideId, otp });
    toast.success('OTP verified — ride started');
    return result;
  }
);

/**
 * updateDriverStatusSocket — emit driver_status_update event.
 * Covers: accepted, en_route, arrived, otp_verified, ride_started,
 *         at_stop, stop_departed, completed, cancelled.
 */
export const updateDriverStatusSocket = createAsyncThunk(
  'operations/updateDriverStatusSocket',
  ({ bookingId, rideId, status, lat, lng, meta }) => {
    socketService.updateDriverStatus({ bookingId, rideId, status, lat, lng, meta });
    return { bookingId, rideId, status };
  }
);

/**
 * startGpsTracking — begin browser geolocation watch → emits driver_location events.
 * Server throttles at 2s. Primary GPS path (HTTP /driver/location is fallback).
 */
export const startGpsTracking = createAsyncThunk(
  'operations/startGpsTracking',
  ({ bookingId } = {}) => {
    socketService.startGpsTracking({ bookingId });
    return { tracking: true };
  }
);

export const stopGpsTracking = createAsyncThunk(
  'operations/stopGpsTracking',
  () => {
    socketService.stopGpsTracking();
    return { tracking: false };
  }
);

/**
 * triggerSos — emit sos_trigger socket event.
 * Server records SOS in RideTracking + emits sos_alert to booking room + admin:ops.
 */
export const triggerSos = createAsyncThunk(
  'operations/triggerSos',
  ({ bookingId, rideId, lat, lng, sosType = 'other', description }) => {
    socketService.triggerSos({ bookingId, rideId, lat, lng, sosType, description });
    toast.error('SOS triggered — help notified');
    return { bookingId, rideId, sosType };
  }
);

/**
 * reportRouteDeviation — emit route_deviation socket event.
 */
export const reportRouteDeviation = createAsyncThunk(
  'operations/reportRouteDeviation',
  ({ bookingId, rideId, lat, lng, deviationKm, driverReason }) => {
    socketService.reportRouteDeviation({ bookingId, rideId, lat, lng, deviationKm, driverReason });
    return { bookingId, rideId, deviationKm };
  }
);

/**
 * requestBookingState — request full booking snapshot on reconnect.
 * Server responds with booking_state_snapshot event.
 * Use requestBookingStateAsync for promise-based flow.
 */
export const requestBookingState = mkThunk(
  'operations/requestBookingState',
  async ({ bookingId }) => {
    const snapshot = await socketService.requestBookingStateAsync(bookingId);
    return snapshot;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — build loading/error keys from action.type
// "operations/fetchAdminBookings/pending" → "fetchAdminBookings"
// ─────────────────────────────────────────────────────────────────────────────

const key = (type) => type.split('/')[1];

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const operationsSlice = createSlice({
  name: 'operations',
  initialState,

  reducers: {
  setCareRideWorkflow(state, action) {
  state.careRideStatus = {
    ...state.careRideStatus,
    ...action.payload,
    // map activeNavigationTarget → activeTarget for compat
    ...(action.payload.activeNavigationTarget
      ? { activeTarget: action.payload.activeNavigationTarget }
      : {}),
  };
},
    /** Call from useBookingRoom / location_update event */
    setLiveLocation(state, { payload }) {
      state.liveLocation = payload;
    },

    /** Call from useBookingRoom / eta_update event */
    setEtaUpdate(state, { payload }) {
      state.etaUpdate = payload;
    },

  setRideStatus(state, { payload }) {
  state.bookingStatus = payload;
  // Also sync careRideStatus if it has rideStage/activeNavigationTarget
  if (payload?.rideStage) {
    state.careRideStatus = {
      ...state.careRideStatus,
      rideStage:             payload.rideStage,
      activeNavigationTarget: payload.activeNavigationTarget || state.careRideStatus.activeNavigationTarget,
    };
  }
},

    /** Call from useBookingRoom / booking_status_change event */
    setBookingStatus(state, { payload }) {
      state.bookingStatus = payload;
    },

    /** Call from useBookingRoom / navigation_target_changed event */
    setNavigationTarget(state, { payload }) {
      state.navigationTarget = payload;
    },

    /** Call from useSos / sos_alert event */
    setSosAlert(state, { payload }) {
      state.sosAlert = payload;
    },

    clearSosAlert(state) {
      state.sosAlert = null;
    },

    /** Call from useBookingRoom / route_deviation_alert event */
    setRouteDeviation(state, { payload }) {
      state.routeDeviation = payload;
    },

    /** Called after OTP result handled in component */
    clearOtpResult(state) {
      state.otpResult = null;
    },

    /** Clear selected booking/op when navigating away */
    clearSelectedBooking(state) {
      state.selectedBooking    = null;
      state.bookingSnapshot    = null;
      state.liveLocation       = null;
      state.etaUpdate          = null;
      state.rideStatus         = null;
      state.bookingStatus      = null;
      state.navigationTarget   = null;
      state.sosAlert           = null;
      state.routeDeviation     = null;
    },

    /** Alias for clearSelectedBooking — matches import expectation */
    clearAdminBookingDetail(state) {
      state.selectedBooking    = null;
      state.selectedOp         = null;
      state.selectedFollowUps  = [];
      state.bookingSnapshot    = null;
      state.liveLocation       = null;
      state.etaUpdate          = null;
      state.rideStatus         = null;
      state.bookingStatus      = null;
      state.navigationTarget   = null;
      state.sosAlert           = null;
      state.routeDeviation     = null;
    },

    clearSelectedOp(state) {
      state.selectedOp        = null;
      state.selectedFollowUps = [];
    },

    clearNearby(state) {
      state.nearbyDrivers        = [];
      state.nearbyCareAssistants = [];
      state.nearbyTPs            = [];
      state.nearbyHospitals      = [];
    },

    /** Alias for clearNearby — matches import expectation */
    clearNearbyResults(state) {
      state.nearbyDrivers        = [];
      state.nearbyCareAssistants = [];
      state.nearbyTPs            = [];
      state.nearbyHospitals      = [];
    },

    clearErrors(state) {
      state.errors = {};
    },

    // ── Admin result resets ──────────────────────────────────────────────────

    /** Reset adminStatusUpdate after component has consumed it */
    resetAdminStatusUpdate(state) {
      state.adminStatusUpdate = null;
    },

    /** Reset adminAssignment after component has consumed it */
    resetAdminAssignment(state) {
      state.adminAssignment = null;
    },

    /** Reset adminRefund after component has consumed it */
    resetAdminRefund(state) {
      state.adminRefund = null;
    },

    /** Reset adminOpStatusUpdate after component has consumed it */
    resetAdminOpStatusUpdate(state) {
      state.adminOpStatusUpdate = null;
    },

    /** From socket care_assistant_location_update */
setCareAssistantLocation(state, { payload }) {
  state.careAssistantLocation = payload;
},

/** From socket care_assistant_status_change */
setCareAssistantStatus(state, { payload }) {
  state.careAssistantStatus = payload;
  if (payload?.careAssistantStatus) {
    state.careRideStatus = payload.careAssistantStatus;
  }
},

/** From socket care_assistant_joined_ride or care_assistant_attached_to_ride */
setCareAssistantJoined(state, { payload }) {
  state.careAssistantJoined = payload;
  // patch snapshot if already loaded
  if (state.careTrackingSnapshot?.careAssistant) {
    state.careTrackingSnapshot.careAssistant.status   = 'en_route_to_pickup';
    state.careTrackingSnapshot.careAssistant.joinedAt = payload?.joinedAt ?? null;
    state.careTrackingSnapshot.careAssistant.isLinkedToRide = true;
  }
},

clearCareRideState(state) {
  state.careTrackingSnapshot  = null;
  state.careAssistantLocation = null;
  state.careAssistantStatus   = null;
  state.careAssistantJoined   = null;
  state.careRideStatus        = null;
},

    /** Set socket connection status — call from SocketProvider connect/disconnect events */
    setSocketConnected(state, { payload }) {
      state.socketConnected = Boolean(payload);
    },
  },

  extraReducers: (builder) => {
    // ── Generic pending/rejected handler ─────────────────────────────────────
    const pending  = (state, action) => { state.loading[key(action.type)] = true;  delete state.errors[key(action.type)]; };
    const rejected = (state, action) => { state.loading[key(action.type)] = false; state.errors[key(action.type)]  = action.payload || 'Error'; };

    // ── Macro to wire pending/fulfilled/rejected ──────────────────────────────
    const wire = (thunk, fulfilled) => {
      builder
        .addCase(thunk.pending,   pending)
        .addCase(thunk.fulfilled, (state, action) => { state.loading[key(action.type)] = false; fulfilled(state, action); })
        .addCase(thunk.rejected,  rejected);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // TRANSPORT PARTNER
    // ─────────────────────────────────────────────────────────────────────────
    wire(fetchTpAssignedBookings, (state, { payload }) => {
      state.tpAssignedBookings = payload?.bookings ?? [];
    });

    wire(fetchTpAvailableDrivers, (state, { payload }) => {
      state.tpAvailableDrivers = payload?.drivers ?? [];
    });

    wire(tpAssignDriver, (state, { payload }) => {
      // ride in payload.ride — update primaryRide in selectedBooking if open
      if (state.selectedBooking && payload?.ride) {
        state.selectedBooking.primaryRide = payload.ride;
      }
    });

    wire(tpReassignDriver, (state) => { /* list refetch triggered by component */ });

    // ─────────────────────────────────────────────────────────────────────────
    // CARE ASSISTANT
    // ─────────────────────────────────────────────────────────────────────────
    wire(fetchCareAssignedBookings, (state, { payload }) => {
      state.careAssignedBookings = payload?.bookings ?? [];
    });

    wire(markCareArrived,  (state) => { /* component reads toast */ });
    wire(markCareStart,    (state, { payload }) => {
      if (state.selectedBooking) state.selectedBooking.status = 'in_progress';
    });
    wire(markCareComplete, (state, { payload }) => {
      if (state.selectedBooking) state.selectedBooking.status = 'completed';
    });
    wire(updateCareLocation, (state) => { /* fire-and-forget */ });
    wire(careRequestRide, (state, { payload }) => {
      if (payload?.rideId) {
        // store as activeRide so component can navigate to tracking screen
        state.activeRide = payload;
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HOSPITAL
    // ─────────────────────────────────────────────────────────────────────────
    wire(fetchHospitalUpcoming, (state, { payload }) => {
      state.hospitalUpcoming = payload?.bookings ?? [];
    });

    wire(hospitalConfirmBooking, (state) => { /* refetch list */ });

    wire(fetchHospitalOps, (state, { payload }) => {
      state.hospitalOps     = payload?.ops    ?? [];
      state.hospitalOpsMeta = {
        total: payload?.total ?? 0,
        page:  payload?.page  ?? 1,
        pages: payload?.pages ?? 1,
      };
    });

    wire(fetchHospitalValidOps, (state, { payload }) => {
      state.hospitalValidOps     = payload?.ops    ?? [];
      state.hospitalValidOpsMeta = {
        total: payload?.total ?? 0,
        page:  payload?.page  ?? 1,
        pages: payload?.pages ?? 1,
      };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // DOCTOR
    // ─────────────────────────────────────────────────────────────────────────
    wire(fetchDoctorOps, (state, { payload }) => {
      state.doctorOps     = payload?.ops    ?? [];
      state.doctorOpsMeta = {
        total: payload?.total ?? 0,
        page:  payload?.page  ?? 1,
        pages: payload?.pages ?? 1,
      };
    });

    wire(fetchDoctorOpByNumber, (state, { payload }) => {
      state.selectedOp        = payload?.op          ?? null;
      state.selectedFollowUps = payload?.followUps   ?? [];
    });

    wire(completeOp, (state, { payload }) => {
      state.selectedOp = payload?.op ?? state.selectedOp;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // OP CARD
    // ─────────────────────────────────────────────────────────────────────────
    wire(fetchOpByNumber, (state, { payload }) => {
      state.selectedOp        = payload?.op         ?? null;
      state.selectedFollowUps = payload?.followUps  ?? [];
    });

    wire(fetchOpFollowUps, (state, { payload }) => {
      state.selectedFollowUps = payload?.followUps ?? [];
    });

    wire(downloadOpCard, (state) => { /* blob trigger — no state change */ });

    // ─────────────────────────────────────────────────────────────────────────
    // DRIVER
    // ─────────────────────────────────────────────────────────────────────────
    wire(fetchDriverAssignedRides, (state, { payload }) => {
      state.driverAssignedRides = payload?.rides  ?? [];
      state.driverInfo          = payload?.driver ?? null;
    });

    wire(acceptRide, (state, { payload }) => {
      state.activeRide = payload?.ride ?? null;
      // update ride in list
      if (payload?.ride) {
        state.driverAssignedRides = state.driverAssignedRides.map(r =>
          r._id === payload.ride._id ? { ...r, ...payload.ride } : r
        );
      }
    });

    wire(rejectRide, (state) => { /* component refetches */ });

    wire(markDriverArrived, (state) => { /* OTP sent; socket otp_required arrives */ });

    wire(endRide, (state, { payload }) => {
      state.activeRide = null;
      if (payload?.booking) {
        state.selectedBooking = payload.booking;
      }
      if (payload?.returnRideId) {
        // return ride activated — component listens to return_ride_activated socket event
      }
    });

    wire(updateDriverLocationHttp, (state) => { /* fire-and-forget */ });

    // ─────────────────────────────────────────────────────────────────────────
    // CUSTOMER
    // ─────────────────────────────────────────────────────────────────────────
    wire(customerRequestRide, (state, { payload }) => {
      state.activeRide = payload ?? null;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN BOOKINGS
    // ─────────────────────────────────────────────────────────────────────────
    wire(fetchAdminBookings, (state, { payload }) => {
      state.adminBookings     = payload?.bookings ?? [];
      state.adminBookingsMeta = {
        total: payload?.total ?? 0,
        page:  payload?.page  ?? 1,
        pages: payload?.pages ?? 1,
      };
    });

    wire(fetchAdminBookingStats, (state, { payload }) => {
      state.adminStats = payload ?? null;
    });

    wire(exportAdminBookings, (state) => { /* blob download */ });

    wire(fetchAdminBookingById, (state, { payload }) => {
      state.selectedBooking = payload?.booking ?? null;
      // selectedOp populated if doctor booking
      if (payload?.opRecord)  state.selectedOp       = payload.opRecord;
      if (payload?.followUps) state.selectedFollowUps = payload.followUps;
    });

    wire(updateAdminBookingStatus, (state, { payload }) => {
      state.adminStatusUpdate = payload ?? null;
      state.selectedBooking   = payload?.booking ?? state.selectedBooking;
      // update in list
      state.adminBookings = state.adminBookings.map(b =>
        b._id === payload?.booking?._id ? { ...b, status: payload.booking.status } : b
      );
    });

    // ── Admin nearby ──────────────────────────────────────────────────────────
    wire(fetchNearbyCareAssistants, (state, { payload }) => {
      state.nearbyCareAssistants = payload?.results ?? [];
    });

    wire(fetchNearbySoloDrivers, (state, { payload }) => {
      state.nearbyDrivers = payload?.results ?? [];
    });

    wire(fetchNearbyTransportPartners, (state, { payload }) => {
      state.nearbyTPs = payload?.results ?? [];
    });

    wire(fetchNearbyHospitals, (state, { payload }) => {
      state.nearbyHospitals = payload?.results ?? [];
    });

    // ── Admin assign / reassign ───────────────────────────────────────────────
    wire(adminAssignSoloDriver, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking) {
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
      }
    });

    wire(adminAssignTransportPartner, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking) {
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
      }
    });

    wire(adminAssignCareAssistant, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking) {
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
      }
    });

    wire(adminAssignHospital, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking) {
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
      }
    });

    wire(adminReassignDriver, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      state.activeRide      = payload?.ride ?? null;
    });

    wire(adminReassignCareAssistant, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      /* component refetches booking detail */
    });

    wire(adminProcessRefund, (state, { payload }) => {
      state.adminRefund     = payload ?? null;
      state.selectedBooking = payload?.booking ?? state.selectedBooking;
      state.adminBookings   = state.adminBookings.map(b =>
        b._id === payload?.booking?._id ? { ...b, status: 'refunded', paymentStatus: 'refunded' } : b
      );
    });

    // ── Admin OP ──────────────────────────────────────────────────────────────
    wire(fetchAdminOps, (state, { payload }) => {
      state.adminOps     = payload?.ops    ?? [];
      state.adminOpsMeta = {
        total: payload?.total ?? 0,
        page:  payload?.page  ?? 1,
        pages: payload?.pages ?? 1,
      };
    });

    wire(updateAdminOpStatus, (state, { payload }) => {
      const updated = payload?.op;
      state.adminOpStatusUpdate = updated ?? null;
      if (updated) {
        state.adminOps = state.adminOps.map(o =>
          o._id === updated._id ? { ...o, status: updated.status } : o
        );
        if (state.selectedOp?._id === updated._id) {
          state.selectedOp = { ...state.selectedOp, ...updated };
        }
      }
    });

    // ── Admin care-ride ───────────────────────────────────────────────────────
    wire(adminRequestCareRide, (state, { payload }) => {
      state.activeRide     = payload ?? null;
      state.careRideNearby = payload ? {
        nearbyDrivers: payload.nearbyDrivers,
        nearbyTPs:     payload.nearbyTPs,
      } : null;
    });

    wire(fetchAdminCareRideNearby, (state, { payload }) => {
      state.careRideNearby = payload ?? null;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SOCKET THUNKS
    // ─────────────────────────────────────────────────────────────────────────
    wire(joinBookingRoom,  (state) => { /* side-effect only */ });
    wire(leaveBookingRoom, (state) => { /* side-effect only */ });
    wire(joinTpRoom,       (state) => { /* side-effect only */ });
    wire(leaveTpRoom,      (state) => { /* side-effect only */ });

    wire(verifyOtpSocket, (state, { payload }) => {
      state.otpResult = payload ?? null;
      // Navigation target switch (pickup→dropoff) arrives via socket navigation_target_changed
    });

    builder
      .addCase(updateDriverStatusSocket.fulfilled, (state, { payload }) => {
        state.rideStatus = payload ?? null;
      });

    builder
      .addCase(startGpsTracking.fulfilled, (state) => { state.gpsTracking = true; })
      .addCase(stopGpsTracking.fulfilled,  (state) => { state.gpsTracking = false; });

    builder
      .addCase(triggerSos.fulfilled, (state, { payload }) => {
        state.sosAlert = payload ?? null;
      });

    builder
      .addCase(reportRouteDeviation.fulfilled, (state, { payload }) => {
        state.routeDeviation = payload ?? null;
      });

    wire(requestBookingState, (state, { payload }) => {
      state.bookingSnapshot = payload ?? null;
    });

    // after wire(careRequestRide, ...)

wire(careJoinRide, (state, { payload }) => {
  state.careRideStatus = 'en_route_to_pickup';
  // patch snapshot if loaded
  if (state.careTrackingSnapshot?.careAssistant) {
    state.careTrackingSnapshot.careAssistant.isLinkedToRide = true;
    state.careTrackingSnapshot.careAssistant.status = 'en_route_to_pickup';
  }
});

wire(careUpdateRideStatus, (state, { payload }) => {
  if (payload?.status) state.careRideStatus = payload.status;
  if (state.careTrackingSnapshot?.careAssistant) {
    state.careTrackingSnapshot.careAssistant.status = payload?.status ?? state.careRideStatus;
  }
});

wire(fetchCareTrackingSnapshot, (state, { payload }) => {
  state.careTrackingSnapshot = payload ?? null;
  // sync CA live location into careAssistantLocation too
  if (payload?.careAssistant?.liveLocation) {
    state.careAssistantLocation = payload.careAssistant.liveLocation;
  }
  if (payload?.careAssistant?.status) {
    state.careRideStatus = payload.careAssistant.status;
  }
});
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  setLiveLocation,
  setEtaUpdate,
  setRideStatus,
  setBookingStatus,
  setNavigationTarget,
  setSosAlert,
  clearSosAlert,
  setRouteDeviation,
  clearOtpResult,
  clearSelectedBooking,
  clearAdminBookingDetail,
  clearSelectedOp,
  clearNearby,
  clearNearbyResults,
  clearErrors,
  resetAdminStatusUpdate,
  resetAdminAssignment,
  resetAdminRefund,
  resetAdminOpStatusUpdate,
  setSocketConnected,
  setCareAssistantLocation,
  setCareAssistantStatus,
  setCareAssistantJoined,
  clearCareRideState,
  setCareRideWorkflow, // <--- ADD THIS HERE
} = operationsSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// ── Admin bookings ────────────────────────────────────────────────────────────
export const selectAdminBookings             = (s) => s.operations.adminBookings;
export const selectAdminBookingsMeta         = (s) => s.operations.adminBookingsMeta;
export const selectAdminStats                = (s) => s.operations.adminStats;
export const selectAdminOps                  = (s) => s.operations.adminOps;
export const selectAdminOpsMeta              = (s) => s.operations.adminOpsMeta;

// ── Admin booking detail aliases (match import names) ────────────────────────
export const selectAdminBookingDetail        = (s) => s.operations.selectedBooking;
export const selectAdminOpRecord             = (s) => s.operations.selectedOp;
export const selectAdminBookingFollowUps     = (s) => s.operations.selectedFollowUps;

// ── Admin operation results ───────────────────────────────────────────────────
export const selectAdminStatusUpdate         = (s) => s.operations.adminStatusUpdate;
export const selectAdminAssignment           = (s) => s.operations.adminAssignment;
export const selectAdminRefund               = (s) => s.operations.adminRefund;
export const selectAdminOpStatusUpdate       = (s) => s.operations.adminOpStatusUpdate;

// ── Transport partner ─────────────────────────────────────────────────────────
export const selectTpAssignedBookings        = (s) => s.operations.tpAssignedBookings;
export const selectTpAvailableDrivers        = (s) => s.operations.tpAvailableDrivers;

// ── Care assistant ────────────────────────────────────────────────────────────
export const selectCareAssignedBookings      = (s) => s.operations.careAssignedBookings;

// ── Hospital ──────────────────────────────────────────────────────────────────
export const selectHospitalUpcoming          = (s) => s.operations.hospitalUpcoming;
export const selectHospitalOps               = (s) => s.operations.hospitalOps;
export const selectHospitalOpsMeta           = (s) => s.operations.hospitalOpsMeta;
export const selectHospitalValidOps          = (s) => s.operations.hospitalValidOps;
export const selectHospitalValidOpsMeta      = (s) => s.operations.hospitalValidOpsMeta;

// ── Doctor ────────────────────────────────────────────────────────────────────
export const selectDoctorOps                 = (s) => s.operations.doctorOps;
export const selectDoctorOpsMeta             = (s) => s.operations.doctorOpsMeta;

// ── Driver ────────────────────────────────────────────────────────────────────
export const selectDriverAssignedRides       = (s) => s.operations.driverAssignedRides;
export const selectDriverInfo                = (s) => s.operations.driverInfo;

// ── Nearby ────────────────────────────────────────────────────────────────────
export const selectNearbyDrivers             = (s) => s.operations.nearbyDrivers;
export const selectNearbyCareAssistants      = (s) => s.operations.nearbyCareAssistants;
export const selectNearbyTPs                 = (s) => s.operations.nearbyTPs;
export const selectNearbyHospitals           = (s) => s.operations.nearbyHospitals;
export const selectCareRideNearby            = (s) => s.operations.careRideNearby;

// ── Single-record ─────────────────────────────────────────────────────────────
export const selectSelectedBooking           = (s) => s.operations.selectedBooking;
export const selectSelectedOp                = (s) => s.operations.selectedOp;
export const selectSelectedFollowUps         = (s) => s.operations.selectedFollowUps;
export const selectBookingSnapshot           = (s) => s.operations.bookingSnapshot;
export const selectActiveRide                = (s) => s.operations.activeRide;

// ── Admin booking map route (derived from selectedBooking) ────────────────────
// Returns route array if backend embeds it, otherwise null.
export const selectAdminBookingMapRoute      = (s) => s.operations.selectedBooking?.route ?? null;

// ── Live / socket ─────────────────────────────────────────────────────────────
export const selectLiveLocation              = (s) => s.operations.liveLocation;
export const selectEtaUpdate                 = (s) => s.operations.etaUpdate;
export const selectRideStatus                = (s) => s.operations.rideStatus;
export const selectBookingStatus             = (s) => s.operations.bookingStatus;
export const selectNavigationTarget          = (s) => s.operations.navigationTarget;
export const selectSosAlert                  = (s) => s.operations.sosAlert;
export const selectRouteDeviation            = (s) => s.operations.routeDeviation;
export const selectOtpResult                 = (s) => s.operations.otpResult;
export const selectGpsTracking               = (s) => s.operations.gpsTracking;
export const selectSocketConnected           = (s) => s.operations.socketConnected;

// ── Per-thunk loading selectors (named aliases matching import expectations) ──
/** selectLoading('fetchAdminBookings') — generic */
export const selectLoading  = (k) => (s) => s.operations.loading[k]  ?? false;
/** selectError('fetchAdminBookings')   — generic */
export const selectError    = (k) => (s) => s.operations.errors[k]   ?? null;

// Named loading selectors (match import names exactly)
export const selectAdminBookingsLoading      = (s) => s.operations.loading['fetchAdminBookings']      ?? false;
export const selectAdminBookingDetailLoading = (s) => s.operations.loading['fetchAdminBookingById']   ?? false;
export const selectAdminStatsLoading         = (s) => s.operations.loading['fetchAdminBookingStats']  ?? false;
export const selectAdminExportLoading        = (s) => s.operations.loading['exportAdminBookings']     ?? false;
export const selectAdminOpsLoading           = (s) => s.operations.loading['fetchAdminOps']           ?? false;
export const selectAdminRefundLoading        = (s) => s.operations.loading['adminProcessRefund']      ?? false;

/**
 * selectNearbyLoading — true if ANY nearby fetch is in flight.
 */
export const selectNearbyLoading = (s) => (
  (s.operations.loading['fetchNearbyCareAssistants']    ?? false) ||
  (s.operations.loading['fetchNearbySoloDrivers']       ?? false) ||
  (s.operations.loading['fetchNearbyTransportPartners'] ?? false) ||
  (s.operations.loading['fetchNearbyHospitals']         ?? false)
);

/**
 * selectAdminAssignLoading — true if ANY assign/reassign is in flight.
 */
export const selectAdminAssignLoading = (s) => (
  (s.operations.loading['adminAssignSoloDriver']        ?? false) ||
  (s.operations.loading['adminAssignTransportPartner']  ?? false) ||
  (s.operations.loading['adminAssignCareAssistant']     ?? false) ||
  (s.operations.loading['adminAssignHospital']          ?? false) ||
  (s.operations.loading['adminReassignDriver']          ?? false) ||
  (s.operations.loading['adminReassignCareAssistant']   ?? false)
);

// ── Care Ride Tracking ────────────────────────────────────────────────────────
export const selectCareTrackingSnapshot  = (s) => s.operations.careTrackingSnapshot;
export const selectCareAssistantLocation = (s) => s.operations.careAssistantLocation;
export const selectCareAssistantStatus   = (s) => s.operations.careAssistantStatus;
export const selectCareAssistantJoined   = (s) => s.operations.careAssistantJoined;
export const selectCareRideStatus        = (s) => s.operations.careRideStatus;


export const selectRideStageOps           = (s) => s.operations.careRideStatus?.rideStage;
export const selectActiveNavigationTarget = (s) => s.operations.careRideStatus?.activeNavigationTarget;

export const selectCareTrackingLoading   = (s) =>
  s.operations.loading['fetchCareTrackingSnapshot'] ?? false;
export const selectCareJoinLoading       = (s) =>
  s.operations.loading['careJoinRide'] ?? false;

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORT DRIVER_STATUS constants for components
// ─────────────────────────────────────────────────────────────────────────────

export { DRIVER_STATUS };

export default operationsSlice.reducer;