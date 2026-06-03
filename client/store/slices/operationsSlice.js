/**
 * operationsSlice.js — Likeson.in
 *
 * COMPLETE — covers ALL routes from both router files:
 *   bookingRouter (driver/care/admin/customer routes)
 *   bookingRouter2 (consultation + TP + hospital + doctor + OP + admin)
 *
 * ADDED vs original:
 *   fetchConsultation           GET  /consultations/:bookingId
 *   confirmConsultation         PATCH /consultations/:id/confirm
 *   acceptConsultation          PATCH /consultations/:id/accept
 *   startConsultation           PATCH /consultations/:id/start
 *   endConsultation             PATCH /consultations/:id/end
 *   submitConsultationConsent   PATCH /consultations/:id/consent
 *   sendConsultationChat        POST  /consultations/:id/chat
 *   fetchConsultationJoinToken  GET  /consultations/:id/join-token
 *
 * CA FIXES (preserved from prior revision):
 *   careRideStatus always OBJECT — never string/null
 *   setCareAssistantStatus patches status field only
 *   careJoinRide / careUpdateRideStatus / fetchCareTrackingSnapshot patch status only
 *   clearCareRideState restores to initial OBJECT shape
 *   adminAssignCareAssistant stores caJoinPoint
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";

import API from "../api";
import socketService, { DRIVER_STATUS } from "@/services/socketService";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "/bookings";

const mkThunk = (type, fn) =>
  createAsyncThunk(type, async (arg, api) => {
    try {
      return await fn(arg, api);
    } catch (err) {
      const msg =
        err?.response?.data?.message || err.message || "Something went wrong";
      toast.error(msg);
      return api.rejectWithValue(msg);
    }
  });

const downloadBlob = (data, filename, mime = "application/octet-stream") => {
  const url = window.URL.createObjectURL(new Blob([data], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL CARE RIDE STATUS SHAPE — always object, never string/null
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_CARE_RIDE_STATUS = {
  status: null, // 'not_joined'|'en_route_to_pickup'|'at_pickup'|'in_ride'|'departed'
  activeTarget: null,
  activeNavigationTarget: null,
  rideStage: null,
  currentLeg: null,
  patientPickedUp: false,
  careAssistantJoined: false,
  hospitalReached: false,
  handoverCompleted: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // ── Lists ─────────────────────────────────────────────────────────────────
  adminBookings: [],
  adminBookingsMeta: { total: 0, page: 1, pages: 1 },
  adminStats: null,

  adminOps: [],
  adminOpsMeta: { total: 0, page: 1, pages: 1 },

  tpAssignedBookings: [],
  tpAvailableDrivers: [],

  careAssignedBookings: [],

  hospitalUpcoming: [],
  hospitalOps: [],
  hospitalOpsMeta: { total: 0, page: 1, pages: 1 },
  hospitalValidOps: [],
  hospitalValidOpsMeta: { total: 0, page: 1, pages: 1 },

  doctorOps: [],
  doctorOpsMeta: { total: 0, page: 1, pages: 1 },

  driverAssignedRides: [],
  driverInfo: null,

  nearbyDrivers: [],
  nearbyCareAssistants: [],
  nearbyTPs: [],
  nearbyHospitals: [],
  careRideNearby: null,

  // ── Consultation ───────────────────────────────────────────────────────────
  consultation: null,          // active consultation document
  consultationJoinToken: null, // Agora token + room info for join
  consultationChat: [],        // chat messages array

  // ── CA tracking state ──────────────────────────────────────────────────────
  careTrackingSnapshot: null,
  careAssistantLocation: null,
  careAssistantStatus: null,
  careAssistantJoined: null,
  // Always OBJECT — never string/null
  careRideStatus: { ...INITIAL_CARE_RIDE_STATUS },
  caJoinPoint: null,

  // ── Single-record ──────────────────────────────────────────────────────────
  selectedBooking: null,
  selectedOp: null,
  selectedFollowUps: [],
  bookingSnapshot: null,
  activeRide: null,

  // ── Admin operation results ────────────────────────────────────────────────
  adminStatusUpdate: null,
  adminAssignment: null,
  adminRefund: null,
  adminOpStatusUpdate: null,

  // ── Socket / live state ────────────────────────────────────────────────────
  liveLocation: null,
  etaUpdate: null,
  rideStatus: null,
  bookingStatus: null,
  navigationTarget: null,
  sosAlert: null,
  routeDeviation: null,
  otpResult: null,
  gpsTracking: false,
  socketConnected: false,

  // ── Loading / error maps ───────────────────────────────────────────────────
  loading: {},
  errors: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — TRANSPORT PARTNER
// ─────────────────────────────────────────────────────────────────────────────

export const fetchTpAssignedBookings = mkThunk(
  "operations/fetchTpAssignedBookings",
  async () => {
    const { data } = await API.get(`${BASE}/tp/assigned`);
    return data.data;
  },
);

export const fetchTpAvailableDrivers = mkThunk(
  "operations/fetchTpAvailableDrivers",
  async () => {
    const { data } = await API.get(`${BASE}/tp/drivers/available`);
    return data.data;
  },
);

export const tpAssignDriver = mkThunk(
  "operations/tpAssignDriver",
  async ({ bookingId, driverId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/tp/assign-driver`, {
      driverId,
    });
    toast.success("Driver assigned");
    return data.data;
  },
);

export const tpReassignDriver = mkThunk(
  "operations/tpReassignDriver",
  async ({ bookingId, newDriverId }) => {
    const { data } = await API.patch(
      `${BASE}/${bookingId}/tp/reassign-driver`,
      { newDriverId },
    );
    toast.success("Driver reassigned");
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — CONSULTATION  (NEW — routes from bookingRouter2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /consultations/:bookingId
 * Fetch Consultation document linked to a booking.
 * Roles: customer (own), doctor (assigned), hospital, admin.
 */
export const fetchConsultation = mkThunk(
  "operations/fetchConsultation",
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/consultations/${bookingId}`);
    return data.data;
  },
);

/**
 * PATCH /consultations/:consultationId/confirm
 * Doctor or admin confirms / schedules consultation. Sends OP card to patient.
 * Body: { consentAccepted?: boolean }
 */
export const confirmConsultation = mkThunk(
  "operations/confirmConsultation",
  async ({ consultationId, consentAccepted = false }) => {
    const { data } = await API.patch(
      `${BASE}/consultations/${consultationId}/confirm`,
      { consentAccepted },
    );
    toast.success("Consultation confirmed — OP sent to patient");
    return data.data;
  },
);

/**
 * PATCH /consultations/:consultationId/accept
 * Doctor explicitly accepts incoming consultation (created/scheduled → waiting).
 * Sends OP card to patient.
 */
export const acceptConsultation = mkThunk(
  "operations/acceptConsultation",
  async ({ consultationId }) => {
    const { data } = await API.patch(
      `${BASE}/consultations/${consultationId}/accept`,
    );
    toast.success("Consultation accepted — patient notified");
    return data.data;
  },
);

/**
 * PATCH /consultations/:consultationId/start
 * Doctor starts active session (waiting → active).
 * Requires telemedicine consent accepted.
 */
export const startConsultation = mkThunk(
  "operations/startConsultation",
  async ({ consultationId }) => {
    const { data } = await API.patch(
      `${BASE}/consultations/${consultationId}/start`,
    );
    toast.success("Consultation started");
    return data.data;
  },
);

/**
 * PATCH /consultations/:consultationId/end
 * End active/paused consultation.
 * Body: { reason?: string, prescriptionUploaded?: boolean }
 */
export const endConsultation = mkThunk(
  "operations/endConsultation",
  async ({ consultationId, reason, prescriptionUploaded = false }) => {
    const { data } = await API.patch(
      `${BASE}/consultations/${consultationId}/end`,
      { reason, prescriptionUploaded },
    );
    toast.success("Consultation ended");
    return data.data;
  },
);

/**
 * PATCH /consultations/:consultationId/consent
 * Patient submits telemedicine / recording / ai_analysis consent.
 * Body: { consentType: string, accepted: boolean }
 */
export const submitConsultationConsent = mkThunk(
  "operations/submitConsultationConsent",
  async ({ consultationId, consentType = "telemedicine", accepted = true }) => {
    const { data } = await API.patch(
      `${BASE}/consultations/${consultationId}/consent`,
      { consentType, accepted },
    );
    return data.data; // { consentType, accepted }
  },
);

/**
 * POST /consultations/:consultationId/chat
 * Send chat message inside active consultation.
 * Body: { message: string, messageType?: string }
 */
export const sendConsultationChat = mkThunk(
  "operations/sendConsultationChat",
  async ({ consultationId, message, messageType = "text" }) => {
    const { data } = await API.post(
      `${BASE}/consultations/${consultationId}/chat`,
      { message, messageType },
    );
    return data.data; // { message: chatEntry }
  },
);

/**
 * GET /consultations/:consultationId/join-token
 * Get Agora room token for doctor or patient.
 * Returns: { token, role, uid, channelName, roomId, meetingId, appId, ... }
 */
export const fetchConsultationJoinToken = mkThunk(
  "operations/fetchConsultationJoinToken",
  async ({ consultationId }) => {
    const { data } = await API.get(
      `${BASE}/consultations/${consultationId}/join-token`,
    );
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — CARE ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────

export const fetchCareAssignedBookings = mkThunk(
  "operations/fetchCareAssignedBookings",
  async () => {
    const { data } = await API.get(`${BASE}/care/assigned`);
    return data.data;
  },
);

export const markCareArrived = mkThunk(
  "operations/markCareArrived",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/arrived`);
    toast.success("Arrival marked");
    return data;
  },
);

export const markCareStart = mkThunk(
  "operations/markCareStart",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/start`);
    toast.success("Task started");
    return data;
  },
);

export const markCareComplete = mkThunk(
  "operations/markCareComplete",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/complete`);
    toast.success("Task completed");
    return data;
  },
);

export const updateCareLocation = mkThunk(
  "operations/updateCareLocation",
  async ({ lat, lng, bookingId, status }) => {
    const { data } = await API.patch(`${BASE}/care/location`, {
      lat,
      lng,
      bookingId,
      status,
    });
    return data;
  },
);

export const careRequestRide = mkThunk(
  "operations/careRequestRide",
  async ({ bookingId, pickupLocation, destinationLocation }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/care/request-ride`, {
      pickupLocation,
      destinationLocation,
    });
    toast.success("Ride requested");
    return data.data;
  },
);

export const careJoinRide = mkThunk(
  "operations/careJoinRide",
  async ({ bookingId, currentLat, currentLng }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/care/join-ride`, {
      currentLat,
      currentLng,
    });
    toast.success("Joined ride session");
    return data.data;
  },
);

export const careUpdateRideStatus = mkThunk(
  "operations/careUpdateRideStatus",
  async ({ bookingId, status, lat, lng }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/care/ride-status`, {
      status,
      lat,
      lng,
    });
    return data.data;
  },
);

export const fetchCareTrackingSnapshot = mkThunk(
  "operations/fetchCareTrackingSnapshot",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/${bookingId}/care/tracking-snapshot`,
    );
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — HOSPITAL
// ─────────────────────────────────────────────────────────────────────────────

export const fetchHospitalUpcoming = mkThunk(
  "operations/fetchHospitalUpcoming",
  async () => {
    const { data } = await API.get(`${BASE}/hospital/upcoming`);
    return data.data;
  },
);

export const hospitalConfirmBooking = mkThunk(
  "operations/hospitalConfirmBooking",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/hospital/confirm`);
    toast.success("Appointment confirmed");
    return data;
  },
);

export const fetchHospitalOps = mkThunk(
  "operations/fetchHospitalOps",
  async ({ hospitalId, status, doctorId, date, page = 1, limit = 20 } = {}) => {
    const { data } = await API.get(`${BASE}/hospital/${hospitalId}/ops`, {
      params: { status, doctorId, date, page, limit },
    });
    return data.data;
  },
);

export const fetchHospitalValidOps = mkThunk(
  "operations/fetchHospitalValidOps",
  async ({ hospitalId, doctorId, patientId, page = 1, limit = 20 } = {}) => {
    const { data } = await API.get(`${BASE}/hospital/${hospitalId}/valid-ops`, {
      params: { doctorId, patientId, page, limit },
    });
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — DOCTOR
// ─────────────────────────────────────────────────────────────────────────────

export const fetchDoctorOps = mkThunk(
  "operations/fetchDoctorOps",
  async ({
    status,
    hospitalId,
    patientId,
    date,
    page = 1,
    limit = 20,
  } = {}) => {
    const { data } = await API.get(`${BASE}/doctor/ops`, {
      params: { status, hospitalId, patientId, date, page, limit },
    });
    return data.data;
  },
);

export const fetchDoctorOpByNumber = mkThunk(
  "operations/fetchDoctorOpByNumber",
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/doctor/ops/${opNumber}`);
    return data.data;
  },
);

export const completeOp = mkThunk(
  "operations/completeOp",
  async ({
    bookingId,
    doctorNotes,
    prescriptionUrl,
    diagnosisCode,
    reasonForVisit,
  }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/op/complete`, {
      doctorNotes,
      prescriptionUrl,
      diagnosisCode,
      reasonForVisit,
    });
    toast.success("OP completed — sent to patient");
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — OP CARD
// ─────────────────────────────────────────────────────────────────────────────

export const fetchOpByNumber = mkThunk(
  "operations/fetchOpByNumber",
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/op/${opNumber}`);
    return data.data;
  },
);

export const fetchOpFollowUps = mkThunk(
  "operations/fetchOpFollowUps",
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/op/${opNumber}/follow-ups`);
    return data.data;
  },
);

export const downloadOpCard = mkThunk(
  "operations/downloadOpCard",
  async ({ opNumber }) => {
    const { data } = await API.get(`${BASE}/op/${opNumber}/download`, {
      responseType: "blob",
    });
    downloadBlob(data, `${opNumber}.zip`, "application/zip");
    return { opNumber };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — DRIVER
// ─────────────────────────────────────────────────────────────────────────────

export const fetchDriverAssignedRides = mkThunk(
  "operations/fetchDriverAssignedRides",
  async () => {
    const { data } = await API.get(`${BASE}/driver/assigned`);
    return data.data;
  },
);

export const acceptRide = mkThunk(
  "operations/acceptRide",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/accept`);
    toast.success("Ride accepted");
    return data.data;
  },
);

export const rejectRide = mkThunk(
  "operations/rejectRide",
  async ({ bookingId, reason }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/reject`, {
      reason,
    });
    toast.success("Ride rejected");
    return data;
  },
);

export const markDriverArrived = mkThunk(
  "operations/markDriverArrived",
  async ({ bookingId }) => {
    const { data } = await API.patch(`${BASE}/${bookingId}/ride/arrived`);
    toast.success("Arrival marked — OTP sent to customer");
    return data;
  },
);

export const endRide = mkThunk(
  "operations/endRide",
  async ({ bookingId, dropPhotoUrl, actualDistanceKm }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/ride/end`, {
      dropPhotoUrl,
      actualDistanceKm,
    });
    toast.success(data.message || "Ride completed");
    return data.data;
  },
);

export const updateDriverLocationHttp = mkThunk(
  "operations/updateDriverLocationHttp",
  async ({ lat, lng, heading, speed, bookingId }) => {
    const { data } = await API.patch(`${BASE}/driver/location`, {
      lat,
      lng,
      heading,
      speed,
      bookingId,
    });
    return data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — CUSTOMER
// ─────────────────────────────────────────────────────────────────────────────

export const customerRequestRide = mkThunk(
  "operations/customerRequestRide",
  async ({ bookingId, pickupLocation, destinationLocation }) => {
    const { data } = await API.post(`${BASE}/${bookingId}/request-ride`, {
      pickupLocation,
      destinationLocation,
    });
    toast.success(data.message || "Ride requested");
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — ADMIN BOOKINGS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAdminBookings = mkThunk(
  "operations/fetchAdminBookings",
  async ({
    status,
    bookingType,
    city,
    date,
    page = 1,
    limit = 20,
    search,
    from,
    to,
  } = {}) => {
    const { data } = await API.get(`${BASE}/admin/bookings`, {
      params: { status, bookingType, city, date, page, limit, search, from, to },
    });
    return data.data;
  },
);

export const fetchAdminBookingStats = mkThunk(
  "operations/fetchAdminBookingStats",
  async ({ from, to } = {}) => {
    const { data } = await API.get(`${BASE}/admin/bookings/stats`, {
      params: { from, to },
    });
    return data.data;
  },
);

export const exportAdminBookings = mkThunk(
  "operations/exportAdminBookings",
  async ({ from, to, status, bookingType } = {}) => {
    const { data } = await API.get(`${BASE}/admin/bookings/export`, {
      params: { from, to, status, bookingType },
      responseType: "blob",
    });
    downloadBlob(data, `bookings-${Date.now()}.csv`, "text/csv");
    return { exported: true };
  },
);

export const fetchAdminBookingById = mkThunk(
  "operations/fetchAdminBookingById",
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/admin/bookings/${bookingId}`);
    return data.data;
  },
);

export const updateAdminBookingStatus = mkThunk(
  "operations/updateAdminBookingStatus",
  async ({ bookingId, status, note }) => {
    const { data } = await API.patch(
      `${BASE}/admin/bookings/${bookingId}/status`,
      { status, note },
    );
    toast.success("Status updated");
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — ADMIN NEARBY
// ─────────────────────────────────────────────────────────────────────────────

export const fetchNearbyCareAssistants = mkThunk(
  "operations/fetchNearbyCareAssistants",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/bookings/${bookingId}/nearby/care-assistants`,
    );
    return data.data;
  },
);

export const fetchNearbySoloDrivers = mkThunk(
  "operations/fetchNearbySoloDrivers",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/bookings/${bookingId}/nearby/solo-drivers`,
    );
    return data.data;
  },
);

export const fetchNearbyTransportPartners = mkThunk(
  "operations/fetchNearbyTransportPartners",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/bookings/${bookingId}/nearby/transport-partners`,
    );
    return data.data;
  },
);

export const fetchNearbyHospitals = mkThunk(
  "operations/fetchNearbyHospitals",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/bookings/${bookingId}/nearby/hospitals`,
    );
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — ADMIN ASSIGN / REASSIGN
// ─────────────────────────────────────────────────────────────────────────────

export const adminAssignSoloDriver = mkThunk(
  "operations/adminAssignSoloDriver",
  async ({ bookingId, soloDriverPartnerId }) => {
    const { data } = await API.post(
      `${BASE}/admin/bookings/${bookingId}/assign/solo-driver`,
      { soloDriverPartnerId },
    );
    toast.success("Solo driver assigned");
    return data.data;
  },
);

export const adminAssignTransportPartner = mkThunk(
  "operations/adminAssignTransportPartner",
  async ({ bookingId, transportPartnerId }) => {
    const { data } = await API.post(
      `${BASE}/admin/bookings/${bookingId}/assign/transport-partner`,
      { transportPartnerId },
    );
    toast.success("Transport partner assigned");
    return data.data;
  },
);

export const adminAssignCareAssistant = mkThunk(
  "operations/adminAssignCareAssistant",
  async ({ bookingId, careAssistantId }) => {
    const { data } = await API.post(
      `${BASE}/admin/bookings/${bookingId}/assign/care-assistant`,
      { careAssistantId },
    );
    toast.success("Care assistant assigned");
    return data.data; // { booking, caJoinPoint }
  },
);

export const adminAssignHospital = mkThunk(
  "operations/adminAssignHospital",
  async ({ bookingId, hospitalId }) => {
    const { data } = await API.post(
      `${BASE}/admin/bookings/${bookingId}/assign/hospital`,
      { hospitalId },
    );
    toast.success("Hospital linked");
    return data.data;
  },
);

export const adminReassignDriver = mkThunk(
  "operations/adminReassignDriver",
  async ({ bookingId, newDriverId, reason }) => {
    const { data } = await API.patch(
      `${BASE}/admin/bookings/${bookingId}/reassign/driver`,
      { newDriverId, reason },
    );
    toast.success("Driver reassigned");
    return data.data;
  },
);

export const adminReassignCareAssistant = mkThunk(
  "operations/adminReassignCareAssistant",
  async ({ bookingId, newCareAssistantId }) => {
    const { data } = await API.patch(
      `${BASE}/admin/bookings/${bookingId}/reassign/care`,
      { newCareAssistantId },
    );
    toast.success("Care assistant reassigned");
    return data;
  },
);

export const adminProcessRefund = mkThunk(
  "operations/adminProcessRefund",
  async ({ bookingId, refundAmount, reason }) => {
    const { data } = await API.post(
      `${BASE}/admin/bookings/${bookingId}/refund`,
      { refundAmount, reason },
    );
    toast.success("Refund initiated");
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — ADMIN OPS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAdminOps = mkThunk(
  "operations/fetchAdminOps",
  async ({
    doctorId,
    hospitalId,
    date,
    page = 1,
    limit = 20,
    status,
    patientId,
  } = {}) => {
    const { data } = await API.get(`${BASE}/admin/ops`, {
      params: { doctorId, hospitalId, date, page, limit, status, patientId },
    });
    return data.data;
  },
);

export const updateAdminOpStatus = mkThunk(
  "operations/updateAdminOpStatus",
  async ({ opId, status, doctorNotes }) => {
    const { data } = await API.patch(`${BASE}/admin/ops/${opId}/status`, {
      status,
      doctorNotes,
    });
    toast.success("OP status updated");
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — ADMIN CARE-RIDE
// ─────────────────────────────────────────────────────────────────────────────

export const adminRequestCareRide = mkThunk(
  "operations/adminRequestCareRide",
  async ({
    bookingId,
    customerId,
    requesterType,
    careAssistantId,
    pickupLocation,
    destinationLocation,
  }) => {
    const { data } = await API.post(`${BASE}/admin/care-ride/request`, {
      bookingId,
      customerId,
      requesterType,
      careAssistantId,
      pickupLocation,
      destinationLocation,
    });
    toast.success(data.message || "Care-ride created");
    return data.data;
  },
);

export const fetchAdminCareRideNearby = mkThunk(
  "operations/fetchAdminCareRideNearby",
  async ({ bookingId }) => {
    const { data } = await API.get(
      `${BASE}/admin/care-ride/${bookingId}/nearby`,
    );
    return data.data;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — SOCKET
// ─────────────────────────────────────────────────────────────────────────────

export const joinBookingRoom = createAsyncThunk(
  "operations/joinBookingRoom",
  ({ bookingId }) => {
    socketService.joinBookingRoom(bookingId);
    return { bookingId };
  },
);

export const leaveBookingRoom = createAsyncThunk(
  "operations/leaveBookingRoom",
  ({ bookingId }) => {
    socketService.leaveBookingRoom(bookingId);
    return { bookingId };
  },
);

export const joinTpRoom = createAsyncThunk(
  "operations/joinTpRoom",
  ({ tpId }) => {
    socketService.joinTpRoom(tpId);
    return { tpId };
  },
);

export const leaveTpRoom = createAsyncThunk(
  "operations/leaveTpRoom",
  ({ tpId }) => {
    socketService.leaveTpRoom(tpId);
    return { tpId };
  },
);

export const verifyOtpSocket = mkThunk(
  "operations/verifyOtpSocket",
  async ({ bookingId, rideId, otp }) => {
    const result = await socketService.verifyOtpAsync({ bookingId, rideId, otp });
    toast.success("OTP verified — ride started");
    return result;
  },
);

export const updateDriverStatusSocket = createAsyncThunk(
  "operations/updateDriverStatusSocket",
  ({ bookingId, rideId, status, lat, lng, meta }) => {
    socketService.updateDriverStatus({ bookingId, rideId, status, lat, lng, meta });
    return { bookingId, rideId, status };
  },
);

export const startGpsTracking = createAsyncThunk(
  "operations/startGpsTracking",
  ({ bookingId } = {}) => {
    socketService.startGpsTracking({ bookingId });
    return { tracking: true };
  },
);

export const stopGpsTracking = createAsyncThunk(
  "operations/stopGpsTracking",
  () => {
    socketService.stopGpsTracking();
    return { tracking: false };
  },
);

export const triggerSos = createAsyncThunk(
  "operations/triggerSos",
  ({ bookingId, rideId, lat, lng, sosType = "other", description }) => {
    socketService.triggerSos({ bookingId, rideId, lat, lng, sosType, description });
    toast.error("SOS triggered — help notified");
    return { bookingId, rideId, sosType };
  },
);

export const reportRouteDeviation = createAsyncThunk(
  "operations/reportRouteDeviation",
  ({ bookingId, rideId, lat, lng, deviationKm, driverReason }) => {
    socketService.reportRouteDeviation({
      bookingId, rideId, lat, lng, deviationKm, driverReason,
    });
    return { bookingId, rideId, deviationKm };
  },
);

export const requestBookingState = mkThunk(
  "operations/requestBookingState",
  async ({ bookingId }) => {
    const snapshot = await socketService.requestBookingStateAsync(bookingId);
    return snapshot;
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const key = (type) => type.split("/")[1];

const operationsSlice = createSlice({
  name: "operations",
  initialState,

  reducers: {
    // Merge into careRideStatus object — never replace with string
    setCareRideWorkflow(state, { payload }) {
      state.careRideStatus = {
        ...state.careRideStatus,
        ...payload,
        ...(payload.activeNavigationTarget
          ? { activeTarget: payload.activeNavigationTarget }
          : {}),
      };
    },

    setLiveLocation(state, { payload }) {
      state.liveLocation = payload;
    },

    setEtaUpdate(state, { payload }) {
      state.etaUpdate = payload;
    },

    setRideStatus(state, { payload }) {
      state.rideStatus = payload;
      if (payload?.rideStage || payload?.activeNavigationTarget) {
        state.careRideStatus = {
          ...state.careRideStatus,
          ...(payload.rideStage ? { rideStage: payload.rideStage } : {}),
          ...(payload.activeNavigationTarget
            ? {
                activeNavigationTarget: payload.activeNavigationTarget,
                activeTarget: payload.activeNavigationTarget,
              }
            : {}),
        };
      }
    },

    setBookingStatus(state, { payload }) {
      state.bookingStatus = payload;
    },

    setNavigationTarget(state, { payload }) {
      state.navigationTarget = payload;
    },

    setSosAlert(state, { payload }) {
      state.sosAlert = payload;
    },

    clearSosAlert(state) {
      state.sosAlert = null;
    },

    setRouteDeviation(state, { payload }) {
      state.routeDeviation = payload;
    },

    clearOtpResult(state) {
      state.otpResult = null;
    },

    clearSelectedBooking(state) {
      state.selectedBooking = null;
      state.bookingSnapshot = null;
      state.liveLocation = null;
      state.etaUpdate = null;
      state.rideStatus = null;
      state.bookingStatus = null;
      state.navigationTarget = null;
      state.sosAlert = null;
      state.routeDeviation = null;
    },

    clearAdminBookingDetail(state) {
      state.selectedBooking = null;
      state.selectedOp = null;
      state.selectedFollowUps = [];
      state.bookingSnapshot = null;
      state.liveLocation = null;
      state.etaUpdate = null;
      state.rideStatus = null;
      state.bookingStatus = null;
      state.navigationTarget = null;
      state.sosAlert = null;
      state.routeDeviation = null;
    },

    clearSelectedOp(state) {
      state.selectedOp = null;
      state.selectedFollowUps = [];
    },

    clearNearby(state) {
      state.nearbyDrivers = [];
      state.nearbyCareAssistants = [];
      state.nearbyTPs = [];
      state.nearbyHospitals = [];
    },

    clearNearbyResults(state) {
      state.nearbyDrivers = [];
      state.nearbyCareAssistants = [];
      state.nearbyTPs = [];
      state.nearbyHospitals = [];
    },

    clearErrors(state) {
      state.errors = {};
    },

    resetAdminStatusUpdate(state) {
      state.adminStatusUpdate = null;
    },
    resetAdminAssignment(state) {
      state.adminAssignment = null;
    },
    resetAdminRefund(state) {
      state.adminRefund = null;
    },
    resetAdminOpStatusUpdate(state) {
      state.adminOpStatusUpdate = null;
    },

    // Consultation reducers
    clearConsultation(state) {
      state.consultation = null;
      state.consultationJoinToken = null;
      state.consultationChat = [];
    },

    // Socket-pushed consultation events (connect via socketService listener)
    setConsultationFromSocket(state, { payload }) {
      if (state.consultation?._id === payload?._id || !state.consultation) {
        state.consultation = { ...(state.consultation ?? {}), ...payload };
      }
    },

    appendConsultationChatMessage(state, { payload }) {
      // payload = chat message object from socket chat_message event
      state.consultationChat = [...state.consultationChat, payload];
    },

    // ── CA socket reducers ──────────────────────────────────────────────────

    setCareAssistantLocation(state, { payload }) {
      state.careAssistantLocation = payload;
      if (payload?.role === "care_assistant") {
        state.liveLocation = payload;
      }
    },

    // Patch careRideStatus.status only — never replace whole object
    setCareAssistantStatus(state, { payload }) {
      state.careAssistantStatus = payload;
      if (payload?.careAssistantStatus) {
        state.careRideStatus = {
          ...state.careRideStatus,
          status: payload.careAssistantStatus,
        };
      }
    },

    setCareAssistantJoined(state, { payload }) {
      state.careAssistantJoined = payload;
      if (payload?.caJoinPoint) {
        state.caJoinPoint = payload.caJoinPoint;
      }
      state.careRideStatus = {
        ...state.careRideStatus,
        careAssistantJoined: true,
        status: "en_route_to_pickup",
      };
      if (state.careTrackingSnapshot?.careAssistant) {
        state.careTrackingSnapshot.careAssistant.status = "en_route_to_pickup";
        state.careTrackingSnapshot.careAssistant.joinedAt =
          payload?.joinedAt ?? null;
        state.careTrackingSnapshot.careAssistant.isLinkedToRide = true;
        if (payload?.caJoinPoint && state.careTrackingSnapshot.route) {
          state.careTrackingSnapshot.route.caJoinWaypoint = payload.caJoinPoint;
        }
      }
    },

    // Restore careRideStatus to initial OBJECT — never null
    clearCareRideState(state) {
      state.careTrackingSnapshot = null;
      state.careAssistantLocation = null;
      state.careAssistantStatus = null;
      state.careAssistantJoined = null;
      state.caJoinPoint = null;
      state.careRideStatus = { ...INITIAL_CARE_RIDE_STATUS };
    },

    setSocketConnected(state, { payload }) {
      state.socketConnected = Boolean(payload);
    },
  },

  extraReducers: (builder) => {
    const pending = (state, action) => {
      state.loading[key(action.type)] = true;
      delete state.errors[key(action.type)];
    };
    const rejected = (state, action) => {
      state.loading[key(action.type)] = false;
      state.errors[key(action.type)] = action.payload || "Error";
    };

    const wire = (thunk, fulfilled) => {
      builder
        .addCase(thunk.pending, pending)
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading[key(action.type)] = false;
          fulfilled(state, action);
        })
        .addCase(thunk.rejected, rejected);
    };

    // ── Transport Partner ───────────────────────────────────────────────────
    wire(fetchTpAssignedBookings, (state, { payload }) => {
      state.tpAssignedBookings = payload?.bookings ?? [];
    });
    wire(fetchTpAvailableDrivers, (state, { payload }) => {
      state.tpAvailableDrivers = payload?.drivers ?? [];
    });
    wire(tpAssignDriver, (state, { payload }) => {
      if (state.selectedBooking && payload?.ride)
        state.selectedBooking.primaryRide = payload.ride;
    });
    wire(tpReassignDriver, (state) => {});

    // ── Consultation ────────────────────────────────────────────────────────
    wire(fetchConsultation, (state, { payload }) => {
      state.consultation = payload?.consultation ?? null;
      // Seed chat messages if present in consultation
      if (payload?.consultation?.chatMessages) {
        state.consultationChat = payload.consultation.chatMessages;
      }
    });
    wire(confirmConsultation, (state, { payload }) => {
      state.consultation = payload?.consultation ?? state.consultation;
    });
    wire(acceptConsultation, (state, { payload }) => {
      state.consultation = payload?.consultation ?? state.consultation;
    });
    wire(startConsultation, (state, { payload }) => {
      state.consultation = payload?.consultation ?? state.consultation;
    });
    wire(endConsultation, (state, { payload }) => {
      state.consultation = payload?.consultation ?? state.consultation;
    });
    wire(submitConsultationConsent, (state, { payload }) => {
      // payload = { consentType, accepted }
      // Sync quick flag on local consultation doc
      if (state.consultation) {
        if (payload?.consentType === "telemedicine") {
          state.consultation.telemedicineConsentAccepted =
            payload?.accepted ?? false;
        }
        if (payload?.consentType === "recording") {
          state.consultation.recordingConsentAccepted =
            payload?.accepted ?? false;
        }
      }
    });
    wire(sendConsultationChat, (state, { payload }) => {
      if (payload?.message) {
        state.consultationChat = [
          ...state.consultationChat,
          payload.message,
        ];
      }
    });
    wire(fetchConsultationJoinToken, (state, { payload }) => {
      state.consultationJoinToken = payload ?? null;
    });

    // ── Care Assistant ──────────────────────────────────────────────────────
    wire(fetchCareAssignedBookings, (state, { payload }) => {
      state.careAssignedBookings = payload?.bookings ?? [];
    });
    wire(markCareArrived, (state) => {});
    wire(markCareStart, (state) => {
      if (state.selectedBooking) state.selectedBooking.status = "in_progress";
    });
    wire(markCareComplete, (state) => {
      if (state.selectedBooking) state.selectedBooking.status = "completed";
    });
    wire(updateCareLocation, (state) => {});
    wire(careRequestRide, (state, { payload }) => {
      if (payload?.rideId) state.activeRide = payload;
    });

    // Patch careRideStatus.status — never replace object
    wire(careJoinRide, (state) => {
      state.careRideStatus = {
        ...state.careRideStatus,
        status: "en_route_to_pickup",
        careAssistantJoined: true,
      };
      if (state.careTrackingSnapshot?.careAssistant) {
        state.careTrackingSnapshot.careAssistant.isLinkedToRide = true;
        state.careTrackingSnapshot.careAssistant.status = "en_route_to_pickup";
      }
    });

    wire(careUpdateRideStatus, (state, { payload }) => {
      if (payload?.status) {
        state.careRideStatus = {
          ...state.careRideStatus,
          status: payload.status,
        };
      }
      if (state.careTrackingSnapshot?.careAssistant && payload?.status) {
        state.careTrackingSnapshot.careAssistant.status = payload.status;
      }
    });

    wire(fetchCareTrackingSnapshot, (state, { payload }) => {
      state.careTrackingSnapshot = payload ?? null;
      if (payload?.careAssistant?.liveLocation) {
        state.careAssistantLocation = payload.careAssistant.liveLocation;
        if (payload?.bookingType === "care_assistant") {
          state.liveLocation = payload.careAssistant.liveLocation;
        }
      }
      if (payload?.careAssistant?.status) {
        state.careRideStatus = {
          ...state.careRideStatus,
          status: payload.careAssistant.status,
        };
      }
      if (payload?.rideStage) {
        state.careRideStatus = {
          ...state.careRideStatus,
          rideStage: payload.rideStage,
        };
      }
      if (payload?.route?.caJoinWaypoint) {
        state.caJoinPoint = payload.route.caJoinWaypoint;
      }
    });

    // ── Hospital ────────────────────────────────────────────────────────────
    wire(fetchHospitalUpcoming, (state, { payload }) => {
      state.hospitalUpcoming = payload?.bookings ?? [];
    });
    wire(hospitalConfirmBooking, (state) => {});
    wire(fetchHospitalOps, (state, { payload }) => {
      state.hospitalOps = payload?.ops ?? [];
      state.hospitalOpsMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });
    wire(fetchHospitalValidOps, (state, { payload }) => {
      state.hospitalValidOps = payload?.ops ?? [];
      state.hospitalValidOpsMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });

    // ── Doctor ──────────────────────────────────────────────────────────────
    wire(fetchDoctorOps, (state, { payload }) => {
      state.doctorOps = payload?.ops ?? [];
      state.doctorOpsMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });
    wire(fetchDoctorOpByNumber, (state, { payload }) => {
      state.selectedOp = payload?.op ?? null;
      state.selectedFollowUps = payload?.followUps ?? [];
    });
    wire(completeOp, (state, { payload }) => {
      state.selectedOp = payload?.op ?? state.selectedOp;
    });

    // ── OP Card ─────────────────────────────────────────────────────────────
    wire(fetchOpByNumber, (state, { payload }) => {
      state.selectedOp = payload?.op ?? null;
      state.selectedFollowUps = payload?.followUps ?? [];
    });
    wire(fetchOpFollowUps, (state, { payload }) => {
      state.selectedFollowUps = payload?.followUps ?? [];
    });
    wire(downloadOpCard, (state) => {});

    // ── Driver ──────────────────────────────────────────────────────────────
    wire(fetchDriverAssignedRides, (state, { payload }) => {
      state.driverAssignedRides = payload?.rides ?? [];
      state.driverInfo = payload?.driver ?? null;
    });
    wire(acceptRide, (state, { payload }) => {
      state.activeRide = payload?.ride ?? null;
      if (payload?.ride) {
        state.driverAssignedRides = state.driverAssignedRides.map((r) =>
          r._id === payload.ride._id ? { ...r, ...payload.ride } : r,
        );
      }
    });
    wire(rejectRide, (state) => {});
    wire(markDriverArrived, (state) => {});
    wire(endRide, (state, { payload }) => {
      state.activeRide = null;
      if (payload?.booking) state.selectedBooking = payload.booking;
    });
    wire(updateDriverLocationHttp, (state) => {});

    // ── Customer ────────────────────────────────────────────────────────────
    wire(customerRequestRide, (state, { payload }) => {
      state.activeRide = payload ?? null;
    });

    // ── Admin Bookings ──────────────────────────────────────────────────────
    wire(fetchAdminBookings, (state, { payload }) => {
      state.adminBookings = payload?.bookings ?? [];
      state.adminBookingsMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });
    wire(fetchAdminBookingStats, (state, { payload }) => {
      state.adminStats = payload ?? null;
    });
    wire(exportAdminBookings, (state) => {});
    wire(fetchAdminBookingById, (state, { payload }) => {
      state.selectedBooking = payload?.booking ?? null;
      if (payload?.opRecord) state.selectedOp = payload.opRecord;
      if (payload?.followUps) state.selectedFollowUps = payload.followUps;
      // Seed consultation from admin detail fetch (backend returns it)
      if (payload?.consultation) state.consultation = payload.consultation;
    });
    wire(updateAdminBookingStatus, (state, { payload }) => {
      state.adminStatusUpdate = payload ?? null;
      state.selectedBooking = payload?.booking ?? state.selectedBooking;
      state.adminBookings = state.adminBookings.map((b) =>
        b._id === payload?.booking?._id
          ? { ...b, status: payload.booking.status }
          : b,
      );
    });

    // ── Admin Nearby ────────────────────────────────────────────────────────
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

    // ── Admin Assign / Reassign ─────────────────────────────────────────────
    wire(adminAssignSoloDriver, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking)
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
    });
    wire(adminAssignTransportPartner, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking)
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
    });
    // Handle new { booking, caJoinPoint } shape from backend
    wire(adminAssignCareAssistant, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking)
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
      if (payload?.caJoinPoint) {
        state.caJoinPoint = payload.caJoinPoint;
        if (state.careTrackingSnapshot?.route) {
          state.careTrackingSnapshot.route.caJoinWaypoint = payload.caJoinPoint;
        }
      }
    });
    wire(adminAssignHospital, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      if (state.selectedBooking && payload?.booking)
        state.selectedBooking = { ...state.selectedBooking, ...payload.booking };
    });
    wire(adminReassignDriver, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
      state.activeRide = payload?.ride ?? null;
    });
    wire(adminReassignCareAssistant, (state, { payload }) => {
      state.adminAssignment = payload ?? null;
    });
    wire(adminProcessRefund, (state, { payload }) => {
      state.adminRefund = payload ?? null;
      state.selectedBooking = payload?.booking ?? state.selectedBooking;
      state.adminBookings = state.adminBookings.map((b) =>
        b._id === payload?.booking?._id
          ? { ...b, status: "refunded", paymentStatus: "refunded" }
          : b,
      );
    });

    // ── Admin OP ────────────────────────────────────────────────────────────
    wire(fetchAdminOps, (state, { payload }) => {
      state.adminOps = payload?.ops ?? [];
      state.adminOpsMeta = {
        total: payload?.total ?? 0,
        page: payload?.page ?? 1,
        pages: payload?.pages ?? 1,
      };
    });
    wire(updateAdminOpStatus, (state, { payload }) => {
      const updated = payload?.op;
      state.adminOpStatusUpdate = updated ?? null;
      if (updated) {
        state.adminOps = state.adminOps.map((o) =>
          o._id === updated._id ? { ...o, status: updated.status } : o,
        );
        if (state.selectedOp?._id === updated._id)
          state.selectedOp = { ...state.selectedOp, ...updated };
      }
    });

    // ── Admin Care-Ride ─────────────────────────────────────────────────────
    wire(adminRequestCareRide, (state, { payload }) => {
      state.activeRide = payload ?? null;
      state.careRideNearby = payload
        ? { nearbyDrivers: payload.nearbyDrivers, nearbyTPs: payload.nearbyTPs }
        : null;
    });
    wire(fetchAdminCareRideNearby, (state, { payload }) => {
      state.careRideNearby = payload ?? null;
    });

    // ── Socket Thunks ───────────────────────────────────────────────────────
    wire(joinBookingRoom, (state) => {});
    wire(leaveBookingRoom, (state) => {});
    wire(joinTpRoom, (state) => {});
    wire(leaveTpRoom, (state) => {});
    wire(verifyOtpSocket, (state, { payload }) => {
      state.otpResult = payload ?? null;
    });

    builder
      .addCase(updateDriverStatusSocket.fulfilled, (state, { payload }) => {
        state.rideStatus = payload ?? null;
      })
      .addCase(startGpsTracking.fulfilled, (state) => {
        state.gpsTracking = true;
      })
      .addCase(stopGpsTracking.fulfilled, (state) => {
        state.gpsTracking = false;
      })
      .addCase(triggerSos.fulfilled, (state, { payload }) => {
        state.sosAlert = payload ?? null;
      })
      .addCase(reportRouteDeviation.fulfilled, (state, { payload }) => {
        state.routeDeviation = payload ?? null;
      });

    wire(requestBookingState, (state, { payload }) => {
      state.bookingSnapshot = payload ?? null;
    });
  },
});

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
  setCareRideWorkflow,
  // Consultation
  clearConsultation,
  setConsultationFromSocket,
  appendConsultationChatMessage,
} = operationsSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const selectAdminBookings = (s) => s.operations.adminBookings;
export const selectAdminBookingsMeta = (s) => s.operations.adminBookingsMeta;
export const selectAdminStats = (s) => s.operations.adminStats;
export const selectAdminOps = (s) => s.operations.adminOps;
export const selectAdminOpsMeta = (s) => s.operations.adminOpsMeta;
export const selectAdminBookingDetail = (s) => s.operations.selectedBooking;
export const selectAdminOpRecord = (s) => s.operations.selectedOp;
export const selectAdminBookingFollowUps = (s) => s.operations.selectedFollowUps;
export const selectAdminStatusUpdate = (s) => s.operations.adminStatusUpdate;
export const selectAdminAssignment = (s) => s.operations.adminAssignment;
export const selectAdminRefund = (s) => s.operations.adminRefund;
export const selectAdminOpStatusUpdate = (s) => s.operations.adminOpStatusUpdate;
export const selectTpAssignedBookings = (s) => s.operations.tpAssignedBookings;
export const selectTpAvailableDrivers = (s) => s.operations.tpAvailableDrivers;
export const selectCareAssignedBookings = (s) => s.operations.careAssignedBookings;
export const selectHospitalUpcoming = (s) => s.operations.hospitalUpcoming;
export const selectHospitalOps = (s) => s.operations.hospitalOps;
export const selectHospitalOpsMeta = (s) => s.operations.hospitalOpsMeta;
export const selectHospitalValidOps = (s) => s.operations.hospitalValidOps;
export const selectHospitalValidOpsMeta = (s) => s.operations.hospitalValidOpsMeta;
export const selectDoctorOps = (s) => s.operations.doctorOps;
export const selectDoctorOpsMeta = (s) => s.operations.doctorOpsMeta;
export const selectDriverAssignedRides = (s) => s.operations.driverAssignedRides;
export const selectDriverInfo = (s) => s.operations.driverInfo;
export const selectNearbyDrivers = (s) => s.operations.nearbyDrivers;
export const selectNearbyCareAssistants = (s) => s.operations.nearbyCareAssistants;
export const selectNearbyTPs = (s) => s.operations.nearbyTPs;
export const selectNearbyHospitals = (s) => s.operations.nearbyHospitals;
export const selectCareRideNearby = (s) => s.operations.careRideNearby;
export const selectSelectedBooking = (s) => s.operations.selectedBooking;
export const selectSelectedOp = (s) => s.operations.selectedOp;
export const selectSelectedFollowUps = (s) => s.operations.selectedFollowUps;
export const selectBookingSnapshot = (s) => s.operations.bookingSnapshot;
export const selectActiveRide = (s) => s.operations.activeRide;
export const selectAdminBookingMapRoute = (s) =>
  s.operations.selectedBooking?.route ?? null;
export const selectLiveLocation = (s) => s.operations.liveLocation;
export const selectEtaUpdate = (s) => s.operations.etaUpdate;
export const selectRideStatus = (s) => s.operations.rideStatus;
export const selectBookingStatus = (s) => s.operations.bookingStatus;
export const selectNavigationTarget = (s) => s.operations.navigationTarget;
export const selectSosAlert = (s) => s.operations.sosAlert;
export const selectRouteDeviation = (s) => s.operations.routeDeviation;
export const selectOtpResult = (s) => s.operations.otpResult;
export const selectGpsTracking = (s) => s.operations.gpsTracking;
export const selectSocketConnected = (s) => s.operations.socketConnected;
export const selectLoading = (k) => (s) => s.operations.loading[k] ?? false;
export const selectError = (k) => (s) => s.operations.errors[k] ?? null;

// Loading convenience selectors
export const selectAdminBookingsLoading = (s) =>
  s.operations.loading["fetchAdminBookings"] ?? false;
export const selectAdminBookingDetailLoading = (s) =>
  s.operations.loading["fetchAdminBookingById"] ?? false;
export const selectAdminStatsLoading = (s) =>
  s.operations.loading["fetchAdminBookingStats"] ?? false;
export const selectAdminExportLoading = (s) =>
  s.operations.loading["exportAdminBookings"] ?? false;
export const selectAdminOpsLoading = (s) =>
  s.operations.loading["fetchAdminOps"] ?? false;
export const selectAdminRefundLoading = (s) =>
  s.operations.loading["adminProcessRefund"] ?? false;
export const selectNearbyLoading = (s) =>
  (s.operations.loading["fetchNearbyCareAssistants"] ?? false) ||
  (s.operations.loading["fetchNearbySoloDrivers"] ?? false) ||
  (s.operations.loading["fetchNearbyTransportPartners"] ?? false) ||
  (s.operations.loading["fetchNearbyHospitals"] ?? false);
export const selectAdminAssignLoading = (s) =>
  (s.operations.loading["adminAssignSoloDriver"] ?? false) ||
  (s.operations.loading["adminAssignTransportPartner"] ?? false) ||
  (s.operations.loading["adminAssignCareAssistant"] ?? false) ||
  (s.operations.loading["adminAssignHospital"] ?? false) ||
  (s.operations.loading["adminReassignDriver"] ?? false) ||
  (s.operations.loading["adminReassignCareAssistant"] ?? false);

// ── Consultation Selectors ───────────────────────────────────────────────────
export const selectConsultation = (s) => s.operations.consultation;
export const selectConsultationJoinToken = (s) => s.operations.consultationJoinToken;
export const selectConsultationChat = (s) => s.operations.consultationChat;
export const selectConsultationLoading = (s) =>
  s.operations.loading["fetchConsultation"] ?? false;
export const selectConfirmConsultationLoading = (s) =>
  s.operations.loading["confirmConsultation"] ?? false;
export const selectAcceptConsultationLoading = (s) =>
  s.operations.loading["acceptConsultation"] ?? false;
export const selectStartConsultationLoading = (s) =>
  s.operations.loading["startConsultation"] ?? false;
export const selectEndConsultationLoading = (s) =>
  s.operations.loading["endConsultation"] ?? false;
export const selectJoinTokenLoading = (s) =>
  s.operations.loading["fetchConsultationJoinToken"] ?? false;
export const selectSendChatLoading = (s) =>
  s.operations.loading["sendConsultationChat"] ?? false;

// ── CA Tracking Selectors ────────────────────────────────────────────────────
export const selectCareTrackingSnapshot = (s) => s.operations.careTrackingSnapshot;
export const selectCareAssistantLocation = (s) => s.operations.careAssistantLocation;
export const selectCareAssistantStatus = (s) => s.operations.careAssistantStatus;
export const selectCareAssistantJoined = (s) => s.operations.careAssistantJoined;
// Always object — safe for .status, .rideStage etc
export const selectCareRideStatus = (s) => s.operations.careRideStatus;
export const selectRideStageOps = (s) =>
  s.operations.careRideStatus?.rideStage ?? null;
export const selectActiveNavigationTarget = (s) =>
  s.operations.careRideStatus?.activeNavigationTarget ?? null;
export const selectCareTrackingLoading = (s) =>
  s.operations.loading["fetchCareTrackingSnapshot"] ?? false;
export const selectCareJoinLoading = (s) =>
  s.operations.loading["careJoinRide"] ?? false;
export const selectCaJoinPoint = (s) => s.operations.caJoinPoint;

export { DRIVER_STATUS };
export default operationsSlice.reducer;