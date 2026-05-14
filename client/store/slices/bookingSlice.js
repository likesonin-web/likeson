/**
 * BookingSlice.js — Likeson.in
 *
 * Covers EVERY route from bookingRouterCustomer.js:
 *
 * ── DISCOVERY ──────────────────────────────────────────────────────────────
 *  GET  /hospitals
 *  GET  /hospitals/:hospitalId/doctors
 *  GET  /hospitals/:hospitalId/availability
 *  GET  /doctors/:doctorId/availability
 *  GET  /labs
 *  GET  /labs/:labId
 *  GET  /booking-options/:type
 *  GET  /transport/estimate
 *  GET  /follow-up/check
 *
 * ── BOOKING CREATION ───────────────────────────────────────────────────────
 *  POST /full-care-ride
 *  POST /doctor-consultation
 *  POST /doctor-online
 *  POST /patient-transport
 *  POST /physiotherapist
 *  POST /follow-up
 *  POST /diagnostic-center
 *  POST /diagnostic-home
 *  POST /care-assistant
 *
 * ── BOOKING MANAGEMENT ─────────────────────────────────────────────────────
 *  GET  /my-bookings
 *  GET  /my-bookings/:bookingId
 *  POST /my-bookings/:bookingId/cancel
 *  POST /my-bookings/:bookingId/rate
 *  GET  /my-bookings/:bookingId/op-download  (blob)
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast                              from 'react-hot-toast';

import API from '../api';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const BASE = '/bookings';

export const BOOKING_TYPES = [
  'full_care_ride',
  'doctor_consultation',
  'doctor_online',
  'patient_transport',
  'physiotherapist',
  'follow_up',
  'diagnostic_center',
  'diagnostic_home',
  'care_assistant',
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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

const downloadBlob = (data, filename, mime = 'application/zip') => {
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
  // ── Discovery ─────────────────────────────────────────────────────────────
  hospitals:             [],
  hospitalDoctors:       [],       // alias: doctorsByHospital
  hospitalAvailability:  null,
  doctorAvailability:    null,
  labs:                  [],
  selectedLab:           null,     // alias: labDetail
  bookingOptions:        null,
  transportEstimate:     null,
  followUpEligibility:   null,     // alias: followUpCheck

  // ── My bookings ───────────────────────────────────────────────────────────
  myBookings:            [],
  myBookingsMeta:        { total: 0, page: 1, limit: 10 },
  selectedBooking:       null,
  cancelBookingResult:   null,
  rateBookingResult:     null,
  verifyPaymentResult: null, 

  // ── Active booking creation result ────────────────────────────────────────
  createdBooking:        null,     // data / loading / error / status tracked below
  createBookingLoading:  false,
  createBookingError:    null,
  createBookingStatus:   'idle',   // 'idle' | 'loading' | 'succeeded' | 'failed'
platformPricing: null,
  // ── Loading / errors ──────────────────────────────────────────────────────
  loading:               {},
  errors:                {},
};

// ─────────────────────────────────────────────────────────────────────────────
// ── DISCOVERY THUNKS ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const fetchHospitals = mkThunk(
  'booking/fetchHospitals',
  async ({ city, hospitalType } = {}) => {
    const { data } = await API.get(`${BASE}/hospitals`, { params: { city, hospitalType } });
    return data.data;
  }
);

export const fetchHospitalDoctors = mkThunk(
  'booking/fetchHospitalDoctors',
  async ({ hospitalId }) => {
    const { data } = await API.get(`${BASE}/hospitals/${hospitalId}/doctors`);
    return data.data;
  }
);

export const checkHospitalAvailability = mkThunk(
  'booking/checkHospitalAvailability',
  async ({ hospitalId, scheduledAt }) => {
    const { data } = await API.get(`${BASE}/hospitals/${hospitalId}/availability`, {
      params: { scheduledAt },
    });
    return data.data;
  }
);

export const checkDoctorAvailability = mkThunk(
  'booking/checkDoctorAvailability',
  async ({ doctorId, scheduledAt, hospitalId }) => {
    const { data } = await API.get(`${BASE}/doctors/${doctorId}/availability`, {
      params: { scheduledAt, hospitalId },
    });
    return data.data;
  }
);

export const fetchLabs = mkThunk(
  'booking/fetchLabs',
  async ({ city, labType, homeCollection } = {}) => {
    const { data } = await API.get(`${BASE}/labs`, {
      params: { city, labType, homeCollection },
    });
    return data.data;
  }
);

export const fetchLabById = mkThunk(
  'booking/fetchLabById',
  async ({ labId }) => {
    const { data } = await API.get(`${BASE}/labs/${labId}`);
    return data.data;
  }
);

/**
 * fetchBookingOptions — /booking-options/:type
 * Returns description, steps, notes, components for a booking type.
 */
export const fetchBookingOptions = mkThunk(
  'booking/fetchBookingOptions',
  async ({ type }) => {
    const { data } = await API.get(`${BASE}/booking-options/${type}`);
    return data.data;
  }
);

/**
 * fetchTransportEstimate — pre-booking straight-line estimate.
 * Actual fare locked via Google Maps canonical route at ride creation.
 */
export const fetchTransportEstimate = mkThunk(
  'booking/fetchTransportEstimate',
  async ({
    pickupLng, pickupLat, dropoffLng, dropoffLat,
    includeReturn  = false,
    waitingMinutes = 0,
    bookingType    = 'patient_transport',
  }) => {
    const { data } = await API.get(`${BASE}/transport/estimate`, {
      params: { pickupLng, pickupLat, dropoffLng, dropoffLat, includeReturn, waitingMinutes, bookingType },
    });
    return data.data;
  }
);

/**
 * checkFollowUpEligibility — check if customer is eligible for follow-up.
 * Requires doctorId. hospitalId optional.
 */
export const checkFollowUpEligibility = mkThunk(
  'booking/checkFollowUpEligibility',
  async ({ doctorId, hospitalId }) => {
    const { data } = await API.get(`${BASE}/follow-up/check`, {
      params: { doctorId, hospitalId },
    });
    return data.data;
  }
);

// THUNK — add with other discovery thunks
export const fetchPlatformPricing = mkThunk(
  'booking/fetchPlatformPricing',
  async () => {
    const { data } = await API.get(`${BASE}/platform-pricing`);
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── BOOKING CREATION THUNKS ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createFullCareRide — POST /full-care-ride
 *
 * Creates booking + outbound ride (+ return ride if includeReturnHome).
 * Canonical polylines locked at creation.
 * Care assistant auto-assigned.
 * OP record created.
 * Returns: bookingId, bookingCode, fareBreakdown, mapRoutes, rides,
 *          careAssistantAssigned, opNumber, razorpayOrder.
 *
 * @param {{
 *   hospitalId: string,
 *   doctorId: string,
 *   scheduledAt: string,
 *   consultationType?: string,
 *   patientInfo: object,
 *   patientLocation: { coordinates: [lng, lat], address: string, city: string, pincode?: string },
 *   destinationLocation?: { coordinates: [lng, lat], address?: string, city?: string },
 *   includeReturnHome?: boolean,
 *   slotId?: string,
 *   documents?: string[],
 *   paymentMethod?: 'Razorpay'|'Wallet',
 *   couponCode?: string,
 *   coinsToRedeem?: number,
 * }} payload
 */
export const createFullCareRide = mkThunk(
  'booking/createFullCareRide',
  async (payload) => {
    const { data } = await API.post(`${BASE}/full-care-ride`, payload);
    toast.success('Full care ride booked!');
    return data.data;
  }
);

/**
 * createDoctorConsultation — POST /doctor-consultation
 *
 * In-person doctor visit. No ride created.
 * Returns: bookingId, bookingCode, opNumber, fareBreakdown, razorpayOrder.
 *
 * @param {{
 *   hospitalId?: string,
 *   doctorId: string,
 *   scheduledAt: string,
 *   consultationType?: string,
 *   patientInfo: object,
 *   slotId?: string,
 *   documents?: string[],
 *   paymentMethod?: 'Razorpay'|'Wallet',
 *   couponCode?: string,
 *   coinsToRedeem?: number,
 * }} payload
 */
export const createDoctorConsultation = mkThunk(
  'booking/createDoctorConsultation',
  async (payload) => {
    const { data } = await API.post(`${BASE}/doctor-consultation`, payload);
    toast.success('Appointment confirmed!');
    return data.data;
  }
);

/**
 * createDoctorOnline — POST /doctor-online
 *
 * Video consultation. No ride. Meeting link sent on confirmation.
 * Returns: bookingId, bookingCode, fareBreakdown, razorpayOrder.
 *
 * @param {{
 *   doctorId: string,
 *   scheduledAt: string,
 *   patientInfo: object,
 *   documents?: string[],
 *   paymentMethod?: 'Razorpay'|'Wallet',
 * }} payload
 */
export const createDoctorOnline = mkThunk(
  'booking/createDoctorOnline',
  async (payload) => {
    const { data } = await API.post(`${BASE}/doctor-online`, payload);
    toast.success('Online consultation booked!');
    return data.data;
  }
);

/**
 * createPatientTransport — POST /patient-transport
 *
 * Standalone transport. Canonical routes locked at creation.
 * Optional: includeReturn (reversed route), addConsultation (adds doctor OP).
 * Waiting charges estimated upfront; actual waiting logged in RideTracking.
 * Returns: bookingId, bookingCode, fareBreakdown, mapRoutes, transportSummary,
 *          rides, opNumber (if consultation), razorpayOrder.
 *
 * @param {{
 *   patientInfo: object,
 *   patientLocation: { coordinates: [lng, lat], address: string, city: string, pincode?: string },
 *   destinationLocation: { coordinates: [lng, lat], address: string, city: string },
 *   scheduledAt: string,
 *   includeReturn?: boolean,
 *   waitingMinutes?: number,
 *   vehicleClass?: string,
 *   addConsultation?: boolean,
 *   hospitalId?: string,
 *   doctorId?: string,
 *   consultationType?: string,
 *   slotId?: string,
 *   paymentMethod?: 'Razorpay'|'Wallet',
 *   couponCode?: string,
 *   coinsToRedeem?: number,
 * }} payload
 */
export const createPatientTransport = mkThunk(
  'booking/createPatientTransport',
  async (payload) => {
    const { data } = await API.post(`${BASE}/patient-transport`, payload);
    toast.success('Transport booked!');
    return data.data;
  }
);

/**
 * createPhysiotherapist — POST /physiotherapist
 *
 * @param {{
 *   doctorId: string,
 *   scheduledAt: string,
 *   patientInfo: object,
 *   visitType?: 'inPerson'|'homeVisit',
 *   slotId?: string,
 *   documents?: string[],
 *   paymentMethod?: 'Razorpay'|'Wallet',
 * }} payload
 */
export const createPhysiotherapist = mkThunk(
  'booking/createPhysiotherapist',
  async (payload) => {
    const { data } = await API.post(`${BASE}/physiotherapist`, payload);
    toast.success('Physiotherapy appointment confirmed!');
    return data.data;
  }
);

/**
 * createFollowUp — POST /follow-up
 *
 * Eligibility checked by backend (same doctor + hospital, within window).
 * followUpParentBooking set from followUpCheck.parentOp.
 * Returns: bookingId, bookingCode, opNumber, fareBreakdown, followUpDetails, razorpayOrder.
 *
 * @param {{
 *   doctorId: string,
 *   hospitalId?: string,
 *   scheduledAt: string,
 *   patientInfo: object,
 *   consultationType?: string,
 *   slotId?: string,
 *   paymentMethod?: 'Razorpay'|'Wallet',
 * }} payload
 */
export const createFollowUp = mkThunk(
  'booking/createFollowUp',
  async (payload) => {
    const { data } = await API.post(`${BASE}/follow-up`, payload);
    toast.success('Follow-up booked!');
    return data.data;
  }
);

/**
 * createDiagnosticCenter — POST /diagnostic-center
 *
 * Lab tests at diagnostic center (patient travels to lab). No ride created.
 * Subscription diagnostic discount applied automatically.
 * Returns: bookingId, bookingCode, fareBreakdown, testNames, packageNames,
 *          diagnosticDiscount, razorpayOrder.
 *
 * @param {{
 *   labId: string,
 *   tests?: string[],
 *   packages?: string[],
 *   scheduledAt: string,
 *   patientInfo: object,
 *   reportDeliveryMode?: string,
 *   paymentMethod?: 'Razorpay'|'Wallet',
 * }} payload
 */
export const createDiagnosticCenter = mkThunk(
  'booking/createDiagnosticCenter',
  async (payload) => {
    const { data } = await API.post(`${BASE}/diagnostic-center`, payload);
    toast.success('Diagnostic appointment booked!');
    return data.data;
  }
);

/**
 * createDiagnosticHome — POST /diagnostic-home
 *
 * Lab technician visits patient. Canonical route locked: lab → patient address.
 * Home collection fee waived if subscription plan includes it.
 * Returns: bookingId, bookingCode, fareBreakdown, testNames, packageNames,
 *          homeCollectionFeeWaived, mapRoute, razorpayOrder.
 *
 * @param {{
 *   labId: string,
 *   tests?: string[],
 *   packages?: string[],
 *   scheduledAt: string,
 *   patientInfo: object,
 *   patientLocation: { coordinates: [lng, lat], address: string, city: string, pincode?: string },
 *   reportDeliveryMode?: string,
 *   paymentMethod?: 'Razorpay'|'Wallet',
 * }} payload
 */
export const createDiagnosticHome = mkThunk(
  'booking/createDiagnosticHome',
  async (payload) => {
    const { data } = await API.post(`${BASE}/diagnostic-home`, payload);
    toast.success('Home collection booked!');
    return data.data;
  }
);

/**
 * createCareAssistant — POST /care-assistant
 *
 * Care assistant auto-assigned (nearest available). No ride created.
 * Returns: bookingId, bookingCode, fareBreakdown, careAssistantAssigned,
 *          durationHours, pricingTier, razorpayOrder.
 *
 * @param {{
 *   patientInfo: object,
 *   patientLocation: { coordinates: [lng, lat], address: string, city: string },
 *   scheduledAt: string,
 *   durationHours?: number,
 *   paymentMethod?: 'Razorpay'|'Wallet',
 * }} payload
 */
export const createCareAssistant = mkThunk(
  'booking/createCareAssistant',
  async (payload) => {
    const { data } = await API.post(`${BASE}/care-assistant`, payload);
    toast.success('Care assistant assigned!');
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── BOOKING MANAGEMENT THUNKS ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const fetchMyBookings = mkThunk(
  'booking/fetchMyBookings',
  async ({ status, bookingType, page = 1, limit = 10 } = {}) => {
    const { data } = await API.get(`${BASE}/my-bookings`, {
      params: { status, bookingType, page, limit },
    });
    return data;
  }
);

/**
 * fetchMyBookingById — GET /my-bookings/:bookingId
 *
 * Returns full booking detail + mapRoute (canonical polyline from RideTracking).
 * mapRoute = { polyline, currentEtaMinutes, totalDistanceKm, pickupCoords, dropoffCoords }
 */
export const fetchMyBookingById = mkThunk(
  'booking/fetchMyBookingById',
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/my-bookings/${bookingId}`);
    return data.data;
  }
);

/**
 * cancelMyBooking — POST /my-bookings/:bookingId/cancel
 *
 * Only cancellable in pending/confirmed status.
 * Returns: refundPercent, refundAmount, status.
 */
export const cancelMyBooking = mkThunk(
  'booking/cancelMyBooking',
  async ({ bookingId, reason }) => {
    const { data } = await API.post(`${BASE}/my-bookings/${bookingId}/cancel`, { reason });
    toast.success(`Booking cancelled. Refund: ₹${data.data?.refundAmount ?? 0}`);
    return { bookingId, ...data.data };
  }
);

/**
 * rateMyBooking — POST /my-bookings/:bookingId/rate
 *
 * Only for completed, un-rated bookings.
 * Supports: overallRating (required, 1-5), doctorRating, careAssistantRating,
 *           driverRating, labRating — all with optional comment fields.
 */
export const rateMyBooking = mkThunk(
  'booking/rateMyBooking',
  async ({
    bookingId,
    overallRating, overallComment,
    doctorRating,  doctorComment,
    careAssistantRating, careAssistantComment,
    driverRating,  driverComment,
    labRating,     labComment,
  }) => {
    const { data } = await API.post(`${BASE}/my-bookings/${bookingId}/rate`, {
      overallRating, overallComment,
      doctorRating,  doctorComment,
      careAssistantRating, careAssistantComment,
      driverRating,  driverComment,
      labRating,     labComment,
    });
    toast.success('Rating submitted!');
    return { bookingId };
  }
);

/**
 * downloadOpCard — GET /my-bookings/:bookingId/op-download
 *
 * Customer downloads OP zip by bookingId (no need to know opNumber).
 * Triggers browser file download.
 */
export const downloadOpCard = mkThunk(
  'booking/downloadOpCard',
  async ({ bookingId, filename = 'op-card.zip' }) => {
    const { data } = await API.get(`${BASE}/my-bookings/${bookingId}/op-download`, {
      responseType: 'blob',
    });
    downloadBlob(data, filename, 'application/zip');
    return { bookingId };
  }
);


export const verifyRazorpayPayment = mkThunk(
  'booking/verifyRazorpayPayment',
  async ({ bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
    const { data } = await API.post(`${BASE}/verify-payment`, {
      bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature,
    });
    toast.success('Payment verified!');
    return { bookingId, ...data.data };
  }
);
// ─────────────────────────────────────────────────────────────────────────────
// KEY HELPER — "booking/fetchHospitals/pending" → "fetchHospitals"
// ─────────────────────────────────────────────────────────────────────────────

const key = (type) => type.split('/')[1];

// Booking creation thunks list — used to track createBookingLoading/Error/Status
const CREATE_THUNKS = [
  'createFullCareRide',
  'createDoctorConsultation',
  'createDoctorOnline',
  'createPatientTransport',
  'createPhysiotherapist',
  'createFollowUp',
  'createDiagnosticCenter',
  'createDiagnosticHome',
  'createCareAssistant',
];

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const bookingSlice = createSlice({
  name: 'booking',
  initialState,

  reducers: {
    // ── Existing ────────────────────────────────────────────────────────────

    /** Clear created booking after payment screen consumed it */
    clearCreatedBooking(state) {
      state.createdBooking       = null;
      state.createBookingLoading = false;
      state.createBookingError   = null;
      state.createBookingStatus  = 'idle';
    },

    /** Alias used by components: resetCreateBooking */
    resetCreateBooking(state) {
      state.createdBooking       = null;
      state.createBookingLoading = false;
      state.createBookingError   = null;
      state.createBookingStatus  = 'idle';
    },

    /** Clear selected booking when navigating away from detail */
    clearSelectedBooking(state) {
      state.selectedBooking = null;
    },

    /** Clear discovery state (hospitals, labs, doctors) between searches */
    clearDiscovery(state) {
      state.hospitals            = [];
      state.hospitalDoctors      = [];
      state.hospitalAvailability = null;
      state.doctorAvailability   = null;
      state.labs                 = [];
      state.selectedLab          = null;
      state.bookingOptions       = null;
      state.transportEstimate    = null;
      state.followUpEligibility  = null;
    },

    /** Reset cancellation state */
    resetCancelBooking(state) {
      state.cancelBookingResult = null;
      delete state.loading['cancelMyBooking'];
      delete state.errors['cancelMyBooking'];
    },

    /** Reset rating state */
    resetRateBooking(state) {
      state.rateBookingResult = null;
      delete state.loading['rateMyBooking'];
      delete state.errors['rateMyBooking'];
    },

    clearErrors(state) {
      state.errors = {};
    },

    // ── NEW: granular reset actions required by components ──────────────────

    /** Reset hospitals list + loading/error */
    resetHospitals(state) {
      state.hospitals = [];
      delete state.loading['fetchHospitals'];
      delete state.errors['fetchHospitals'];
    },

    /** Reset hospitalDoctors list + loading/error */
    resetDoctorsByHospital(state) {
      state.hospitalDoctors = [];
      delete state.loading['fetchHospitalDoctors'];
      delete state.errors['fetchHospitalDoctors'];
    },

    /** Reset hospitalAvailability + loading/error */
    resetHospitalAvailability(state) {
      state.hospitalAvailability = null;
      delete state.loading['checkHospitalAvailability'];
      delete state.errors['checkHospitalAvailability'];
    },

    /** Reset doctorAvailability + loading/error */
    resetDoctorAvailability(state) {
      state.doctorAvailability = null;
      delete state.loading['checkDoctorAvailability'];
      delete state.errors['checkDoctorAvailability'];
    },

    /** Reset transportEstimate + loading/error */
    resetTransportEstimate(state) {
      state.transportEstimate = null;
      delete state.loading['fetchTransportEstimate'];
      delete state.errors['fetchTransportEstimate'];
    },

    /** Reset followUpEligibility + loading/error */
    resetFollowUpCheck(state) {
      state.followUpEligibility = null;
      delete state.loading['checkFollowUpEligibility'];
      delete state.errors['checkFollowUpEligibility'];
    },

    /** Reset bookingOptions + loading/error */
    resetBookingOptions(state) {
      state.bookingOptions = null;
      delete state.loading['fetchBookingOptions'];
      delete state.errors['fetchBookingOptions'];
    },
  },

  extraReducers: (builder) => {
    // Generic pending / rejected handlers
    const pending  = (state, action) => {
      state.loading[key(action.type)] = true;
      delete state.errors[key(action.type)];
    };
    const rejected = (state, action) => {
      state.loading[key(action.type)] = false;
      state.errors[key(action.type)]  = action.payload || 'Error';
    };

    // Wire helper — avoids repeating addCase 3× per thunk
    const wire = (thunk, fulfilled) => {
      builder
        .addCase(thunk.pending,   pending)
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading[key(action.type)] = false;
          fulfilled(state, action);
        })
        .addCase(thunk.rejected, rejected);
    };

    // ── Discovery ─────────────────────────────────────────────────────────

    wire(fetchHospitals, (state, { payload }) => {
      state.hospitals = Array.isArray(payload) ? payload : [];
    });

    wire(fetchHospitalDoctors, (state, { payload }) => {
      state.hospitalDoctors = Array.isArray(payload) ? payload : [];
    });

    wire(checkHospitalAvailability, (state, { payload }) => {
      state.hospitalAvailability = payload ?? null;
    });

    wire(checkDoctorAvailability, (state, { payload }) => {
      state.doctorAvailability = payload ?? null;
    });

    wire(fetchLabs, (state, { payload }) => {
      state.labs = Array.isArray(payload) ? payload : [];
    });

    wire(fetchLabById, (state, { payload }) => {
      state.selectedLab = payload ?? null;
    });

    wire(fetchBookingOptions, (state, { payload }) => {
      state.bookingOptions = payload ?? null;
    });

    wire(fetchTransportEstimate, (state, { payload }) => {
      state.transportEstimate = payload ?? null;
    });

    wire(checkFollowUpEligibility, (state, { payload }) => {
      state.followUpEligibility = payload ?? null;
    });
    wire(fetchPlatformPricing, (state, { payload }) => {
  state.platformPricing = payload ?? null;
});
    // ── Booking creation ──────────────────────────────────────────────────
    // All POST booking routes → store result in createdBooking.
    // Also drive dedicated createBookingLoading / createBookingError / createBookingStatus.

    const wireCreate = (thunk) => {
      builder
        .addCase(thunk.pending, (state, action) => {
          pending(state, action);
          state.createBookingLoading = true;
          state.createBookingError   = null;
          state.createBookingStatus  = 'loading';
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading[key(action.type)] = false;
          state.createdBooking       = action.payload ?? null;
          state.createBookingLoading = false;
          state.createBookingError   = null;
          state.createBookingStatus  = 'succeeded';
        })
        .addCase(thunk.rejected, (state, action) => {
          rejected(state, action);
          state.createBookingLoading = false;
          state.createBookingError   = action.payload || 'Error';
          state.createBookingStatus  = 'failed';
        });
    };

    wireCreate(createFullCareRide);
    wireCreate(createDoctorConsultation);
    wireCreate(createDoctorOnline);
    wireCreate(createPatientTransport);
    wireCreate(createPhysiotherapist);
    wireCreate(createFollowUp);
    wireCreate(createDiagnosticCenter);
    wireCreate(createDiagnosticHome);
    wireCreate(createCareAssistant);

    // ── Booking management ────────────────────────────────────────────────

    wire(fetchMyBookings, (state, { payload }) => {
      state.myBookings     = payload?.data  ?? [];
      state.myBookingsMeta = {
        total: payload?.total ?? 0,
        page:  payload?.page  ?? 1,
        limit: payload?.limit ?? 10,
      };
    });

    wire(fetchMyBookingById, (state, { payload }) => {
      // payload = { ...booking, mapRoute }
      state.selectedBooking = payload ?? null;
    });

    wire(cancelMyBooking, (state, { payload }) => {
      state.cancelBookingResult = payload ?? null;
      if (payload?.bookingId) {
        const idx = state.myBookings.findIndex(
          (b) => b._id === payload.bookingId || b._id?.toString() === payload.bookingId
        );
        if (idx !== -1) {
          state.myBookings[idx] = { ...state.myBookings[idx], status: 'cancelled' };
        }
      }
    });

    wire(rateMyBooking, (state, { payload }) => {
      state.rateBookingResult = payload ?? null;
      if (payload?.bookingId) {
        const idx = state.myBookings.findIndex(
          (b) => b._id === payload.bookingId || b._id?.toString() === payload.bookingId
        );
        if (idx !== -1) {
          state.myBookings[idx] = { ...state.myBookings[idx], isRated: true };
        }
      }
      if (state.selectedBooking && (
        state.selectedBooking._id === payload?.bookingId ||
        state.selectedBooking._id?.toString() === payload?.bookingId
      )) {
        state.selectedBooking = { ...state.selectedBooking, isRated: true };
      }
    });

    wire(downloadOpCard, (state, { payload }) => {
      // No state update needed — side effect is browser download.
      void payload;
    });

    wire(verifyRazorpayPayment, (state, { payload }) => {
  state.verifyPaymentResult = payload ?? null;
  // update paymentStatus in list + selectedBooking
  if (payload?.bookingId) {
    const idx = state.myBookings.findIndex(
      (b) => b._id === payload.bookingId || b._id?.toString() === payload.bookingId
    );
    if (idx !== -1) {
      state.myBookings[idx] = { ...state.myBookings[idx], paymentStatus: 'paid' };
    }
  }
  if (state.selectedBooking && (
    state.selectedBooking._id === payload?.bookingId ||
    state.selectedBooking._id?.toString() === payload?.bookingId
  )) {
    state.selectedBooking = { ...state.selectedBooking, paymentStatus: 'paid' };
  }
  if (state.createdBooking) {
    state.createdBooking = { ...state.createdBooking, paymentStatus: 'paid' };
  }
}); 
  },
  
});



// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  // existing
  clearCreatedBooking,
  clearSelectedBooking,
  clearDiscovery,
  clearErrors,
  resetCancelBooking,
  resetRateBooking,
  // new — required by components
  resetCreateBooking,
  resetHospitals,
  resetDoctorsByHospital,
  resetHospitalAvailability,
  resetDoctorAvailability,
  resetTransportEstimate,
  resetFollowUpCheck,
  resetBookingOptions,
} = bookingSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// ── Discovery ────────────────────────────────────────────────────────────────

export const selectHospitals               = (s) => s.booking.hospitals;
export const selectHospitalsLoading        = (s) => s.booking.loading['fetchHospitals']              ?? false;
export const selectHospitalsError          = (s) => s.booking.errors['fetchHospitals']               ?? null;

// hospitalDoctors — also exported as selectDoctorsByHospital (component alias)
export const selectHospitalDoctors         = (s) => s.booking.hospitalDoctors;
export const selectDoctorsByHospital       = (s) => s.booking.hospitalDoctors;
export const selectDoctorsByHospitalLoading = (s) => s.booking.loading['fetchHospitalDoctors']       ?? false;
export const selectDoctorsByHospitalError  = (s) => s.booking.errors['fetchHospitalDoctors']         ?? null;

export const selectHospitalAvailability    = (s) => s.booking.hospitalAvailability;
export const selectHospitalAvailLoading    = (s) => s.booking.loading['checkHospitalAvailability']   ?? false;
export const selectHospitalAvailError      = (s) => s.booking.errors['checkHospitalAvailability']    ?? null;

export const selectDoctorAvailability      = (s) => s.booking.doctorAvailability;
export const selectDoctorAvailLoading      = (s) => s.booking.loading['checkDoctorAvailability']     ?? false;
export const selectDoctorAvailError        = (s) => s.booking.errors['checkDoctorAvailability']      ?? null;

export const selectLabs                    = (s) => s.booking.labs;
export const selectLabsLoading             = (s) => s.booking.loading['fetchLabs']                   ?? false;
export const selectLabsError               = (s) => s.booking.errors['fetchLabs']                    ?? null;

// selectedLab — also exported as selectLabDetail (component alias)
export const selectSelectedLab             = (s) => s.booking.selectedLab;
export const selectLabDetail               = (s) => s.booking.selectedLab;
export const selectLabDetailLoading        = (s) => s.booking.loading['fetchLabById']                ?? false;
export const selectLabDetailError          = (s) => s.booking.errors['fetchLabById']                 ?? null;

export const selectBookingOptions          = (s) => s.booking.bookingOptions;
export const selectBookingOptionsLoading   = (s) => s.booking.loading['fetchBookingOptions']         ?? false;
export const selectBookingOptionsError     = (s) => s.booking.errors['fetchBookingOptions']          ?? null;

export const selectTransportEstimate       = (s) => s.booking.transportEstimate;
export const selectTransportEstimLoading   = (s) => s.booking.loading['fetchTransportEstimate']      ?? false;  // matches component import name
export const selectTransportEstimateLoading = (s) => s.booking.loading['fetchTransportEstimate']     ?? false;  // verbose alias
export const selectTransportEstimateError  = (s) => s.booking.errors['fetchTransportEstimate']       ?? null;

// followUpEligibility — also exported as selectFollowUpCheck (component alias)
export const selectFollowUpEligibility     = (s) => s.booking.followUpEligibility;
export const selectFollowUpCheck           = (s) => s.booking.followUpEligibility;
export const selectFollowUpCheckLoading    = (s) => s.booking.loading['checkFollowUpEligibility']    ?? false;
export const selectFollowUpCheckError      = (s) => s.booking.errors['checkFollowUpEligibility']     ?? null;

// ── Booking creation ─────────────────────────────────────────────────────────

export const selectCreatedBooking          = (s) => s.booking.createdBooking;

// Component aliases for createdBooking
export const selectCreateBookingData       = (s) => s.booking.createdBooking;
export const selectCreateBookingLoading    = (s) => s.booking.createBookingLoading;
export const selectCreateBookingError      = (s) => s.booking.createBookingError;
export const selectCreateBookingStatus     = (s) => s.booking.createBookingStatus;

// Scoped sub-fields of createdBooking
export const selectCreatedRazorpayOrder    = (s) => s.booking.createdBooking?.razorpayOrder        ?? null;
export const selectCreatedMapRoutes        = (s) => s.booking.createdBooking?.mapRoutes             ?? null;
export const selectCreatedFareBreakdown    = (s) => s.booking.createdBooking?.fareBreakdown         ?? null;
export const selectCreatedCareAssistant    = (s) => s.booking.createdBooking?.careAssistantAssigned ?? null;
export const selectCreatedOpNumber         = (s) => s.booking.createdBooking?.opNumber              ?? null;
export const selectCreatedRides            = (s) => s.booking.createdBooking?.rides                 ?? null;
// diagnostic-home returns single mapRoute (not mapRoutes)
export const selectCreatedMapRoute         = (s) => s.booking.createdBooking?.mapRoute              ?? null;

// ── My bookings ──────────────────────────────────────────────────────────────

export const selectMyBookings              = (s) => s.booking.myBookings;
export const selectMyBookingsMeta          = (s) => s.booking.myBookingsMeta;
export const selectSelectedBooking         = (s) => s.booking.selectedBooking;
export const selectActiveBooking           = (s) => s.booking.selectedBooking; // alias

// mapRoute from selectedBooking (canonical polyline for customer map)
export const selectBookingMapRoute         = (s) => s.booking.selectedBooking?.mapRoute ?? null;

// Cancel / rate results
export const selectCancelBooking           = (s) => s.booking.cancelBookingResult;
export const selectRateBooking             = (s) => s.booking.rateBookingResult;

// ── Generic per-thunk loading/error ─────────────────────────────────────────

export const selectLoading = (k) => (s) => s.booking.loading[k] ?? false;
export const selectError   = (k) => (s) => s.booking.errors[k]  ?? null;

// Named shortcuts
export const selectCancelBookingLoading    = (s) => s.booking.loading['cancelMyBooking']    ?? false;
export const selectCancelBookingError      = (s) => s.booking.errors['cancelMyBooking']     ?? null;
export const selectRateBookingLoading      = (s) => s.booking.loading['rateMyBooking']      ?? false;
export const selectRateBookingError        = (s) => s.booking.errors['rateMyBooking']       ?? null;
export const selectDownloadOpCardLoading   = (s) => s.booking.loading['downloadOpCard']     ?? false;
export const selectDownloadOpCardError     = (s) => s.booking.errors['downloadOpCard']      ?? null;
export const selectActiveBookingLoading    = (s) => s.booking.loading['fetchMyBookingById'] ?? false;
export const selectActiveBookingError      = (s) => s.booking.errors['fetchMyBookingById']  ?? null;


export const selectVerifyPaymentResult  = (s) => s.booking.verifyPaymentResult;
export const selectVerifyPaymentLoading = (s) => s.booking.loading['verifyRazorpayPayment'] ?? false;
export const selectVerifyPaymentError   = (s) => s.booking.errors['verifyRazorpayPayment']  ?? null;
export const selectPlatformPricing        = (s) => s.booking.platformPricing;
export const selectPlatformPricingLoading = (s) => s.booking.loading['fetchPlatformPricing'] ?? false;
export const selectPlatformPricingError   = (s) => s.booking.errors['fetchPlatformPricing']  ?? null;
// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export { BOOKING_TYPES };

export default bookingSlice.reducer;