
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast                              from 'react-hot-toast';
import API                                from '../api';

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

/**
 * mkThunk — wraps API call, centralises error toast + rejectWithValue.
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

/**
 * key — extracts thunk name from action type string.
 * e.g. "booking/fetchHospitals/pending" → "fetchHospitals"
 * Used as loading/error map key.
 */
const key = (type) => type.split('/')[1];

/**
 * downloadBlob — triggers browser file-save for binary responses.
 */
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
  hospitals:            [],
  hospitalDoctors:      [],
  hospitalAvailability: null,
  doctorAvailability:   null,
  labs:                 [],
  selectedLab:          null,
  bookingOptions:       null,
  transportEstimate:    null,
  followUpEligibility:  null,
  platformPricing:      null,
  consultationCoverage: null,

  // ── My bookings ───────────────────────────────────────────────────────────
  myBookings:          [],
  myBookingsMeta:      { total: 0, page: 1, limit: 10 },
  selectedBooking:     null,
  cancelBookingResult: null,
  rateBookingResult:   null,

  // ── Payment results ───────────────────────────────────────────────────────
  verifyPaymentResult:      null,
  confirmCashPaymentResult: null,

  // ── Active booking creation ───────────────────────────────────────────────
  createdBooking:       null,
  createBookingLoading: false,
  createBookingError:   null,
  /** 'idle' | 'loading' | 'succeeded' | 'failed' */
  createBookingStatus:  'idle',

  allDoctors:     [],
allDoctorsMeta: { total: 0, page: 1, limit: 20 },
deleteFailedBookingResult: null,

  subscriptionBenefitConsultations: null,
subscriptionBenefitCareAssistant: null,

  // ── Per-thunk loading / error maps ───────────────────────────────────────
  loading: {},
  errors:  {},
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

export const fetchBookingOptions = mkThunk(
  'booking/fetchBookingOptions',
  async ({ type }) => {
    const { data } = await API.get(`${BASE}/booking-options/${type}`);
    return data.data;
  }
);

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
 * checkConsultationCoverage — GET /consultation-check
 *
 * Returns: { allowed, isFree, remaining, reason, careAssistantFree, careAssistantQuota }
 * Optionally pass { consultationType } as query param.
 */
export const checkConsultationCoverage = mkThunk(
  'booking/checkConsultationCoverage',
  async ({ consultationType } = {}) => {
    const { data } = await API.get(`${BASE}/consultation-check`, {
      params: consultationType ? { consultationType } : {},
    });
    return data.data;
  }
);

export const checkFollowUpEligibility = mkThunk(
  'booking/checkFollowUpEligibility',
  async ({ doctorId, hospitalId }) => {
    const { data } = await API.get(`${BASE}/follow-up/check`, {
      params: { doctorId, hospitalId },
    });
    return data.data;
  }
);

/**
 * fetchPlatformPricing — GET /platform-pricing
 *
 * Returns: PlatformPricingConfig.careAssistant.pricingTiers[]
 * Used by care-assistant booking UI to show tier options.
 */
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
 * Creates booking + outbound ride (+ optional return ride).
 * Canonical polylines locked at creation via Google Maps / haversine fallback.
 * Care assistant auto-assigned. OP record created.
 *
 * Response data: {
 *   bookingId, bookingCode, status, scheduledAt,
 *   fareBreakdown, subscriptionCoverage,
 *   transportSummary, mapRoutes: { outbound, return },
 *   careAssistantAssigned, rides: { outbound, return },
 *   opNumber, razorpayOrder
 * }
 *
 * @param {{
 *   hospitalId: string,
 *   doctorId: string,
 *   scheduledAt: string,
 *   consultationType?: 'inPerson'|'video'|'homeVisit',
 *   patientInfo: object,
 *   patientLocation: { coordinates: [lng, lat], address: string, city: string, pincode?: string },
 *   destinationLocation?: { coordinates: [lng, lat], address?: string, city?: string },
 *   includeReturnHome?: boolean,
 *   slotId?: string,
 *   documents?: string[],
 *   paymentMethod?: 'Razorpay'|'Wallet'|'Cash',
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
 * In-person / video doctor visit. No ride created.
 *
 * Response data: { bookingId, bookingCode, opNumber, fareBreakdown,
 *                  subscriptionCoverage, razorpayOrder }
 *
 * @param {{
 *   hospitalId?: string,
 *   doctorId: string,
 *   scheduledAt: string,
 *   consultationType?: 'inPerson'|'video'|'homeVisit',
 *   patientInfo: object,
 *   slotId?: string,
 *   documents?: string[],
 *   paymentMethod?: 'Razorpay'|'Wallet'|'Cash',
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
 * Video-only consultation. No ride. Meeting link sent on confirmation.
 *
 * Response data: { bookingId, bookingCode, fareBreakdown,
 *                  subscriptionCoverage, razorpayOrder, note }
 *
 * @param {{
 *   doctorId: string,
 *   scheduledAt: string,
 *   patientInfo: object,
 *   documents?: string[],
 *   paymentMethod?: 'Razorpay'|'Wallet'|'Cash',
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
 * Waiting charges estimated; actual waiting logged in RideTracking.
 *
 * Response data: { bookingId, bookingCode, fareBreakdown, transportSummary,
 *                  mapRoutes: { outbound, return }, consultationAdded,
 *                  subscriptionCoverage, opNumber, rides, razorpayOrder }
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
 *   paymentMethod?: 'Razorpay'|'Wallet'|'Cash',
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
 * NOTE: physio bookings never consume subscription consultation quota.
 *
 * @param {{
 *   doctorId: string,
 *   scheduledAt: string,
 *   patientInfo: object,
 *   visitType?: 'inPerson'|'homeVisit',
 *   slotId?: string,
 *   documents?: string[],
 *   paymentMethod?: 'Razorpay'|'Wallet'|'Cash',
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
 * Backend checks eligibility (same doctor + hospital, within window).
 * Follow-up always charged — does NOT consume subscription quota.
 *
 * Response data: { bookingId, bookingCode, opNumber, fareBreakdown,
 *                  followUpDetails, razorpayOrder }
 *
 * @param {{
 *   doctorId: string,
 *   hospitalId?: string,
 *   scheduledAt: string,
 *   patientInfo: object,
 *   consultationType?: string,
 *   slotId?: string,
 *   paymentMethod?: 'Razorpay'|'Wallet'|'Cash',
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
 * Lab tests at center (patient travels). No ride.
 * Subscription diagnostic discount applied automatically by backend.
 *
 * Response data: { bookingId, bookingCode, fareBreakdown, testNames,
 *                  packageNames, diagnosticDiscount, razorpayOrder }
 *
 * @param {{
 *   labId: string,
 *   tests?: string[],
 *   packages?: string[],
 *   scheduledAt: string,
 *   patientInfo: object,
 *   reportDeliveryMode?: string,
 *   paymentMethod?: 'Razorpay'|'Wallet'|'Cash',
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
 * Lab tech visits patient. Canonical route: lab → patient.
 * Home collection fee waived if plan includes homeSampleCollection.
 *
 * Response data: { bookingId, bookingCode, fareBreakdown, testNames,
 *                  packageNames, homeCollectionFeeWaived,
 *                  diagnosticDiscount, mapRoute, razorpayOrder }
 *
 * NOTE: returns mapRoute (singular), NOT mapRoutes. Selector selectCreatedMapRoute.
 *
 * @param {{
 *   labId: string,
 *   tests?: string[],
 *   packages?: string[],
 *   scheduledAt: string,
 *   patientInfo: object,
 *   patientLocation: { coordinates: [lng, lat], address: string, city: string, pincode?: string },
 *   reportDeliveryMode?: string,
 *   paymentMethod?: 'Razorpay'|'Wallet'|'Cash',
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
 * Care assistant auto-assigned (nearest available). No ride.
 * Fee resolved from subscription tier (custom plan) or platform tiers.
 *
 * Response data: { bookingId, bookingCode, fareBreakdown, subscriptionCoverage,
 *                  careAssistantAssigned, durationHours, pricingSource,
 *                  pricingTier, razorpayOrder }
 *
 * @param {{
 *   patientInfo: object,
 *   patientLocation: { coordinates: [lng, lat], address: string, city: string },
 *   scheduledAt: string,
 *   durationHours?: number,
 *   paymentMethod?: 'Razorpay'|'Wallet'|'Cash',
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
// ── PAYMENT THUNKS ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * verifyRazorpayPayment — POST /verify-payment
 *
 * Verifies Razorpay signature, marks booking paid, flushes subscription usage.
 *
 * Response data: { bookingId, paymentStatus }
 *
 * @param {{
 *   bookingId: string,
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string,
 * }} payload
 */
export const verifyRazorpayPayment = mkThunk(
  'booking/verifyRazorpayPayment',
  async ({ bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
    const { data } = await API.post(`${BASE}/verify-payment`, {
      bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature,
    });
    toast.success('Payment verified!');
    return data.data; // { bookingId, paymentStatus }
  }
);

/**
 * confirmCashPayment — POST /confirm-cash-payment
 *
 * ADMIN ONLY. Marks cash-payment booking as paid, flushes subscription usage.
 * Included here because the result updates booking paymentStatus in shared state.
 *
 * Response data: { bookingId }
 *
 * @param {{
 *   bookingId: string,
 *   amountCollected?: number,
 * }} payload
 */
export const confirmCashPayment = mkThunk(
  'booking/confirmCashPayment',
  async ({ bookingId, amountCollected }) => {
    const { data } = await API.post(`${BASE}/confirm-cash-payment`, {
      bookingId,
      ...(amountCollected != null && { amountCollected }),
    });
    toast.success('Cash payment confirmed.');
    return { bookingId, ...data.data };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ── BOOKING MANAGEMENT THUNKS ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetchMyBookings — GET /my-bookings
 *
 * Paginated. Filterable by status, bookingType.
 *
 * Response shape: { data: Booking[], total, page, limit }
 */
export const fetchMyBookings = mkThunk(
  'booking/fetchMyBookings',
  async ({ status, bookingType, page = 1, limit = 10 } = {}) => {
    const { data } = await API.get(`${BASE}/my-bookings`, {
      params: { status, bookingType, page, limit },
    });
    return data; // { data, total, page, limit }
  }
);

/**
 * fetchMyBookingById — GET /my-bookings/:bookingId
 *
 * Full booking detail + mapRoute (canonical polyline from RideTracking).
 *
 * mapRoute: { polyline, currentEtaMinutes, totalDistanceKm, pickupCoords, dropoffCoords }
 */
export const fetchMyBookingById = mkThunk(
  'booking/fetchMyBookingById',
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/my-bookings/${bookingId}`);
    return data.data; // { ...booking, mapRoute }
  }
);

/**
 * cancelMyBooking — POST /my-bookings/:bookingId/cancel
 *
 * Cancellable only in pending / confirmed / pending_cash status.
 * Subscription quota recovered automatically by backend.
 *
 * Response data: { refundPercent, refundAmount, status, subscriptionRecovery }
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
 * overallRating (1–5) required. All other fields optional.
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
 * Triggers browser file download of OP zip (no state change needed).
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

export const fetchSubscriptionBenefitConsultations = mkThunk(
  'booking/fetchSubscriptionBenefitConsultations',
  async () => {
    const { data } = await API.get(`${BASE}/subscription-benefits/consultations`);
    return data.data;
  }
);

export const fetchSubscriptionBenefitCareAssistant = mkThunk(
  'booking/fetchSubscriptionBenefitCareAssistant',
  async () => {
    const { data } = await API.get(`${BASE}/subscription-benefits/care-assistant`);
    return data.data;
  }
);


// Add thunk
export const fetchAllDoctors = mkThunk(
  'booking/fetchAllDoctors',
  async ({ specialization, consultationType, city, isOnline, page = 1, limit = 20 } = {}) => {
    const { data } = await API.get(`${BASE}/doctors`, {
      params: { specialization, consultationType, city, isOnline, page, limit },
    });
    return data; // { data, total, page, limit, count }
  }
);

// ── ADD this thunk (after verifyRazorpayPayment thunk) ──────────────────────

export const deleteFailedBooking = mkThunk(
  'booking/deleteFailedBooking',
  async ({ bookingId, walletApplied = 0 }) => {
    const { data } = await API.post(`${BASE}/delete-failed-booking`, {
      bookingId,
      walletApplied,
    });
    toast.success(`Booking deleted. Wallet refunded: ₹${data.data?.walletRefunded ?? 0}`);
    return data.data; // { bookingId, walletRefunded }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const bookingSlice = createSlice({
  name: 'booking',
  initialState,

  reducers: {
    // ── Booking creation ─────────────────────────────────────────────────────

    clearCreatedBooking(state) {
      state.createdBooking       = null;
      state.createBookingLoading = false;
      state.createBookingError   = null;
      state.createBookingStatus  = 'idle';
    },

    /** Alias — some components import resetCreateBooking */
    resetCreateBooking(state) {
      state.createdBooking       = null;
      state.createBookingLoading = false;
      state.createBookingError   = null;
      state.createBookingStatus  = 'idle';
    },

    // ── Detail / list ────────────────────────────────────────────────────────

    clearSelectedBooking(state) {
      state.selectedBooking = null;
    },

    // ── Discovery ────────────────────────────────────────────────────────────

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

    resetHospitals(state) {
      state.hospitals = [];
      delete state.loading.fetchHospitals;
      delete state.errors.fetchHospitals;
    },

    resetDoctorsByHospital(state) {
      state.hospitalDoctors = [];
      delete state.loading.fetchHospitalDoctors;
      delete state.errors.fetchHospitalDoctors;
    },
    resetDeleteFailedBooking(state) {
  state.deleteFailedBookingResult = null;
  delete state.loading.deleteFailedBooking;
  delete state.errors.deleteFailedBooking;
},

    resetHospitalAvailability(state) {
      state.hospitalAvailability = null;
      delete state.loading.checkHospitalAvailability;
      delete state.errors.checkHospitalAvailability;
    },

    resetDoctorAvailability(state) {
      state.doctorAvailability = null;
      delete state.loading.checkDoctorAvailability;
      delete state.errors.checkDoctorAvailability;
    },

    resetTransportEstimate(state) {
      state.transportEstimate = null;
      delete state.loading.fetchTransportEstimate;
      delete state.errors.fetchTransportEstimate;
    },

    resetFollowUpCheck(state) {
      state.followUpEligibility = null;
      delete state.loading.checkFollowUpEligibility;
      delete state.errors.checkFollowUpEligibility;
    },

    resetBookingOptions(state) {
      state.bookingOptions = null;
      delete state.loading.fetchBookingOptions;
      delete state.errors.fetchBookingOptions;
    },

    resetConsultationCoverage(state) {
      state.consultationCoverage = null;
      delete state.loading.checkConsultationCoverage;
      delete state.errors.checkConsultationCoverage;
    },

    resetPlatformPricing(state) {
      state.platformPricing = null;
      delete state.loading.fetchPlatformPricing;
      delete state.errors.fetchPlatformPricing;
    },

    // ── Cancel / rate results ────────────────────────────────────────────────

    resetCancelBooking(state) {
      state.cancelBookingResult = null;
      delete state.loading.cancelMyBooking;
      delete state.errors.cancelMyBooking;
    },

    resetRateBooking(state) {
      state.rateBookingResult = null;
      delete state.loading.rateMyBooking;
      delete state.errors.rateMyBooking;
    },

    // ── Payment results ──────────────────────────────────────────────────────

    resetVerifyPayment(state) {
      state.verifyPaymentResult = null;
      delete state.loading.verifyRazorpayPayment;
      delete state.errors.verifyRazorpayPayment;
    },

    resetConfirmCashPayment(state) {
      state.confirmCashPaymentResult = null;
      delete state.loading.confirmCashPayment;
      delete state.errors.confirmCashPayment;
    },

    resetSubscriptionBenefitConsultations(state) {
  state.subscriptionBenefitConsultations = null;
  delete state.loading.fetchSubscriptionBenefitConsultations;
  delete state.errors.fetchSubscriptionBenefitConsultations;
},

resetSubscriptionBenefitCareAssistant(state) {
  state.subscriptionBenefitCareAssistant = null;
  delete state.loading.fetchSubscriptionBenefitCareAssistant;
  delete state.errors.fetchSubscriptionBenefitCareAssistant;
},

    // ── Global error reset ───────────────────────────────────────────────────

    clearErrors(state) {
      state.errors = {};
    },

    resetAllDoctors(state) {
  state.allDoctors     = [];
  state.allDoctorsMeta = { total: 0, page: 1, limit: 20 };
  delete state.loading.fetchAllDoctors;
  delete state.errors.fetchAllDoctors;
},
  },

  extraReducers: (builder) => {
    // ── Generic pending / rejected ─────────────────────────────────────────

    const pending = (state, action) => {
      state.loading[key(action.type)] = true;
      delete state.errors[key(action.type)];
    };

    const rejected = (state, action) => {
      state.loading[key(action.type)] = false;
      state.errors[key(action.type)]  = action.payload || 'Error';
    };

    /**
     * wire — registers pending + fulfilled + rejected for a thunk.
     * fulfilled receives (state, action) and should update state.
     */
    const wire = (thunk, fulfilled) => {
      builder
        .addCase(thunk.pending,   pending)
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading[key(action.type)] = false;
          fulfilled(state, action);
        })
        .addCase(thunk.rejected, rejected);
    };

    

    /**
     * wireCreate — variant for booking creation thunks.
     * Also drives createBookingLoading / createBookingError / createBookingStatus.
     */
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

    // ── Discovery ────────────────────────────────────────────────────────────

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
    wire(deleteFailedBooking, (state, { payload }) => {
  state.deleteFailedBookingResult = payload ?? null;
  // Remove from myBookings list
  if (payload?.bookingId) {
    state.myBookings = state.myBookings.filter(
      (b) => String(b._id) !== String(payload.bookingId)
    );
    if (
      state.selectedBooking &&
      String(state.selectedBooking._id) === String(payload.bookingId)
    ) {
      state.selectedBooking = null;
    }
    if (
      state.createdBooking &&
      String(state.createdBooking.bookingId) === String(payload.bookingId)
    ) {
      state.createdBooking = null;
    }
  }
});
    wire(fetchAllDoctors, (state, { payload }) => {
  state.allDoctors     = Array.isArray(payload?.data) ? payload.data : [];
  state.allDoctorsMeta = {
    total: payload?.total ?? 0,
    page:  payload?.page  ?? 1,
    limit: payload?.limit ?? 20,
  };
});

    wire(fetchBookingOptions, (state, { payload }) => {
      state.bookingOptions = payload ?? null;
    });

    wire(fetchTransportEstimate, (state, { payload }) => {
      state.transportEstimate = payload ?? null;
    });

    wire(checkConsultationCoverage, (state, { payload }) => {
      state.consultationCoverage = payload ?? null;
    });

    wire(checkFollowUpEligibility, (state, { payload }) => {
      state.followUpEligibility = payload ?? null;
    });

    wire(fetchPlatformPricing, (state, { payload }) => {
      state.platformPricing = payload ?? null;
    });

    // ── Booking creation ──────────────────────────────────────────────────

    wireCreate(createFullCareRide);
    wireCreate(createDoctorConsultation);
    wireCreate(createDoctorOnline);
    wireCreate(createPatientTransport);
    wireCreate(createPhysiotherapist);
    wireCreate(createFollowUp);
    wireCreate(createDiagnosticCenter);
    wireCreate(createDiagnosticHome);
    wireCreate(createCareAssistant);

    // ── Payment ───────────────────────────────────────────────────────────

    // FIX 1: single wire() — no duplicate builder.addCase for verifyRazorpayPayment
    wire(verifyRazorpayPayment, (state, { payload }) => {
      state.verifyPaymentResult = payload ?? null;

      // Sync paymentStatus in list
      if (payload?.bookingId) {
        const idx = state.myBookings.findIndex(
          (b) => b._id === payload.bookingId || String(b._id) === String(payload.bookingId)
        );
        if (idx !== -1) {
          state.myBookings[idx] = {
            ...state.myBookings[idx],
            paymentStatus: payload.paymentStatus ?? 'paid',
          };
        }
      }

      // Sync selectedBooking
      if (
        state.selectedBooking &&
        String(state.selectedBooking._id) === String(payload?.bookingId)
      ) {
        state.selectedBooking = {
          ...state.selectedBooking,
          paymentStatus: payload?.paymentStatus ?? 'paid',
        };
      }

      // Sync createdBooking (user still on payment success screen)
      if (
        state.createdBooking &&
        String(state.createdBooking.bookingId) === String(payload?.bookingId)
      ) {
        state.createdBooking = {
          ...state.createdBooking,
          paymentStatus: payload?.paymentStatus ?? 'paid',
        };
      }
    });

    wire(confirmCashPayment, (state, { payload }) => {
      state.confirmCashPaymentResult = payload ?? null;

      if (payload?.bookingId) {
        const idx = state.myBookings.findIndex(
          (b) => b._id === payload.bookingId || String(b._id) === String(payload.bookingId)
        );
        if (idx !== -1) {
          state.myBookings[idx] = {
            ...state.myBookings[idx],
            paymentStatus: 'paid',
          };
        }
        if (
          state.selectedBooking &&
          String(state.selectedBooking._id) === String(payload.bookingId)
        ) {
          state.selectedBooking = { ...state.selectedBooking, paymentStatus: 'paid' };
        }
      }
    });

    // ── Booking management ────────────────────────────────────────────────

    wire(fetchMyBookings, (state, { payload }) => {
      state.myBookings     = Array.isArray(payload?.data) ? payload.data : [];
      state.myBookingsMeta = {
        total: payload?.total ?? 0,
        page:  payload?.page  ?? 1,
        limit: payload?.limit ?? 10,
      };
    });

    wire(fetchMyBookingById, (state, { payload }) => {
      state.selectedBooking = payload ?? null;
    });

    wire(cancelMyBooking, (state, { payload }) => {
      state.cancelBookingResult = payload ?? null;
      if (payload?.bookingId) {
        const idx = state.myBookings.findIndex(
          (b) => b._id === payload.bookingId || String(b._id) === String(payload.bookingId)
        );
        if (idx !== -1) {
          state.myBookings[idx] = { ...state.myBookings[idx], status: 'cancelled' };
        }
        if (
          state.selectedBooking &&
          String(state.selectedBooking._id) === String(payload.bookingId)
        ) {
          state.selectedBooking = { ...state.selectedBooking, status: 'cancelled' };
        }
      }
    });

    wire(rateMyBooking, (state, { payload }) => {
      state.rateBookingResult = payload ?? null;
      if (payload?.bookingId) {
        const idx = state.myBookings.findIndex(
          (b) => b._id === payload.bookingId || String(b._id) === String(payload.bookingId)
        );
        if (idx !== -1) {
          state.myBookings[idx] = { ...state.myBookings[idx], isRated: true };
        }
        if (
          state.selectedBooking &&
          String(state.selectedBooking._id) === String(payload.bookingId)
        ) {
          state.selectedBooking = { ...state.selectedBooking, isRated: true };
        }
      }
    });

    wire(fetchSubscriptionBenefitConsultations, (state, { payload }) => {
  state.subscriptionBenefitConsultations = payload ?? null;
});

wire(fetchSubscriptionBenefitCareAssistant, (state, { payload }) => {
  state.subscriptionBenefitCareAssistant = payload ?? null;
});

    wire(downloadOpCard, (state, { payload }) => {
      // Side effect is browser download — no state mutation needed.
      void payload;
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  // Booking creation
  clearCreatedBooking,
  resetCreateBooking,
  // Detail
  clearSelectedBooking,
  // Discovery
  clearDiscovery,
  resetHospitals,
  resetDoctorsByHospital,
  resetHospitalAvailability,
  resetDoctorAvailability,
  resetTransportEstimate,
  resetFollowUpCheck,
  resetBookingOptions,
  resetConsultationCoverage,
  resetPlatformPricing,
  // Cancel / rate
  resetCancelBooking,
  resetRateBooking,
  // Payment
  resetVerifyPayment,
  resetConfirmCashPayment,
  resetSubscriptionBenefitConsultations,
resetSubscriptionBenefitCareAssistant,
  // Global
  clearErrors,
  resetAllDoctors,
  resetDeleteFailedBooking,
} = bookingSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// ── Discovery ─────────────────────────────────────────────────────────────────

export const selectHospitals                = (s) => s.booking.hospitals;
export const selectHospitalsLoading         = (s) => s.booking.loading.fetchHospitals              ?? false;
export const selectHospitalsError           = (s) => s.booking.errors.fetchHospitals               ?? null;

/** hospitalDoctors — also exported as selectDoctorsByHospital */
export const selectHospitalDoctors          = (s) => s.booking.hospitalDoctors;
export const selectDoctorsByHospital        = (s) => s.booking.hospitalDoctors;
export const selectDoctorsByHospitalLoading = (s) => s.booking.loading.fetchHospitalDoctors        ?? false;
export const selectDoctorsByHospitalError   = (s) => s.booking.errors.fetchHospitalDoctors         ?? null;

export const selectHospitalAvailability     = (s) => s.booking.hospitalAvailability;
export const selectHospitalAvailLoading     = (s) => s.booking.loading.checkHospitalAvailability   ?? false;
export const selectHospitalAvailError       = (s) => s.booking.errors.checkHospitalAvailability    ?? null;

export const selectDoctorAvailability       = (s) => s.booking.doctorAvailability;
export const selectDoctorAvailLoading       = (s) => s.booking.loading.checkDoctorAvailability     ?? false;
export const selectDoctorAvailError         = (s) => s.booking.errors.checkDoctorAvailability      ?? null;

export const selectLabs                     = (s) => s.booking.labs;
export const selectLabsLoading              = (s) => s.booking.loading.fetchLabs                   ?? false;
export const selectLabsError                = (s) => s.booking.errors.fetchLabs                    ?? null;

/** selectedLab — also exported as selectLabDetail */
export const selectSelectedLab              = (s) => s.booking.selectedLab;
export const selectLabDetail                = (s) => s.booking.selectedLab;
export const selectLabDetailLoading         = (s) => s.booking.loading.fetchLabById                ?? false;
export const selectLabDetailError           = (s) => s.booking.errors.fetchLabById                 ?? null;

export const selectBookingOptions           = (s) => s.booking.bookingOptions;
export const selectBookingOptionsLoading    = (s) => s.booking.loading.fetchBookingOptions         ?? false;
export const selectBookingOptionsError      = (s) => s.booking.errors.fetchBookingOptions          ?? null;

export const selectTransportEstimate        = (s) => s.booking.transportEstimate;
export const selectTransportEstimateLoading = (s) => s.booking.loading.fetchTransportEstimate      ?? false;
/** Short alias used by some components */
export const selectTransportEstimLoading    = (s) => s.booking.loading.fetchTransportEstimate      ?? false;
export const selectTransportEstimateError   = (s) => s.booking.errors.fetchTransportEstimate       ?? null;

export const selectConsultationCoverage     = (s) => s.booking.consultationCoverage;
export const selectConsultationCoverageLoad = (s) => s.booking.loading.checkConsultationCoverage   ?? false;
export const selectConsultationCoverageErr  = (s) => s.booking.errors.checkConsultationCoverage    ?? null;

/** followUpEligibility — also exported as selectFollowUpCheck */
export const selectFollowUpEligibility      = (s) => s.booking.followUpEligibility;
export const selectFollowUpCheck            = (s) => s.booking.followUpEligibility;
export const selectFollowUpCheckLoading     = (s) => s.booking.loading.checkFollowUpEligibility    ?? false;
export const selectFollowUpCheckError       = (s) => s.booking.errors.checkFollowUpEligibility     ?? null;

export const selectPlatformPricing          = (s) => s.booking.platformPricing;
export const selectPlatformPricingLoading   = (s) => s.booking.loading.fetchPlatformPricing        ?? false;
export const selectPlatformPricingError     = (s) => s.booking.errors.fetchPlatformPricing         ?? null;

// ── Booking creation ──────────────────────────────────────────────────────────

export const selectCreatedBooking           = (s) => s.booking.createdBooking;
export const selectCreateBookingData        = (s) => s.booking.createdBooking;
export const selectCreateBookingLoading     = (s) => s.booking.createBookingLoading;
export const selectCreateBookingError       = (s) => s.booking.createBookingError;
// FIX 2: was in state but never exported
export const selectCreateBookingStatus      = (s) => s.booking.createBookingStatus;

/** Scoped sub-fields of createdBooking */
export const selectCreatedRazorpayOrder     = (s) => s.booking.createdBooking?.razorpayOrder         ?? null;
export const selectCreatedMapRoutes         = (s) => s.booking.createdBooking?.mapRoutes             ?? null;
/** diagnostic-home returns mapRoute (singular) */
export const selectCreatedMapRoute          = (s) => s.booking.createdBooking?.mapRoute              ?? null;
export const selectCreatedFareBreakdown     = (s) => s.booking.createdBooking?.fareBreakdown         ?? null;
export const selectCreatedCareAssistant     = (s) => s.booking.createdBooking?.careAssistantAssigned ?? null;
export const selectCreatedOpNumber          = (s) => s.booking.createdBooking?.opNumber              ?? null;
export const selectCreatedRides             = (s) => s.booking.createdBooking?.rides                 ?? null;
export const selectCreatedBookingCode       = (s) => s.booking.createdBooking?.bookingCode           ?? null;
export const selectCreatedBookingId         = (s) => s.booking.createdBooking?.bookingId             ?? null;
export const selectCreatedSubCoverage       = (s) => s.booking.createdBooking?.subscriptionCoverage  ?? null;
export const selectCreatedTransportSummary  = (s) => s.booking.createdBooking?.transportSummary      ?? null;
export const selectCreatedDiagnosticDiscount = (s) => s.booking.createdBooking?.diagnosticDiscount   ?? null;
export const selectCreatedFollowUpDetails   = (s) => s.booking.createdBooking?.followUpDetails       ?? null;

// ── My bookings ───────────────────────────────────────────────────────────────

export const selectMyBookings               = (s) => s.booking.myBookings;
export const selectMyBookingsMeta           = (s) => s.booking.myBookingsMeta;
// FIX 2: missing selectors added
export const selectMyBookingsLoading        = (s) => s.booking.loading.fetchMyBookings              ?? false;
export const selectMyBookingsError          = (s) => s.booking.errors.fetchMyBookings               ?? null;

export const selectSelectedBooking          = (s) => s.booking.selectedBooking;
export const selectActiveBooking            = (s) => s.booking.selectedBooking;
export const selectBookingMapRoute          = (s) => s.booking.selectedBooking?.mapRoute            ?? null;

// FIX 2: added
export const selectMyBookingByIdLoading     = (s) => s.booking.loading.fetchMyBookingById           ?? false;
export const selectMyBookingByIdError       = (s) => s.booking.errors.fetchMyBookingById            ?? null;
/** Alias — some components use selectActiveBookingLoading */
export const selectActiveBookingLoading     = (s) => s.booking.loading.fetchMyBookingById           ?? false;
export const selectActiveBookingError       = (s) => s.booking.errors.fetchMyBookingById            ?? null;

export const selectCancelBooking            = (s) => s.booking.cancelBookingResult;
export const selectCancelBookingLoading     = (s) => s.booking.loading.cancelMyBooking              ?? false;
export const selectCancelBookingError       = (s) => s.booking.errors.cancelMyBooking               ?? null;

export const selectRateBooking              = (s) => s.booking.rateBookingResult;
export const selectRateBookingLoading       = (s) => s.booking.loading.rateMyBooking                ?? false;
export const selectRateBookingError         = (s) => s.booking.errors.rateMyBooking                 ?? null;

export const selectDownloadOpCardLoading    = (s) => s.booking.loading.downloadOpCard               ?? false;
export const selectDownloadOpCardError      = (s) => s.booking.errors.downloadOpCard                ?? null;

// ── Payment ───────────────────────────────────────────────────────────────────

export const selectVerifyPaymentResult      = (s) => s.booking.verifyPaymentResult;
export const selectVerifyPaymentLoading     = (s) => s.booking.loading.verifyRazorpayPayment        ?? false;
export const selectVerifyPaymentError       = (s) => s.booking.errors.verifyRazorpayPayment         ?? null;

export const selectConfirmCashPaymentResult  = (s) => s.booking.confirmCashPaymentResult;
export const selectConfirmCashPaymentLoading = (s) => s.booking.loading.confirmCashPayment          ?? false;
export const selectConfirmCashPaymentError   = (s) => s.booking.errors.confirmCashPayment           ?? null;

// ── Generic per-thunk access (factory selectors) ─────────────────────────────

export const selectLoading = (k) => (s) => s.booking.loading[k] ?? false;
export const selectError   = (k) => (s) => s.booking.errors[k]  ?? null;


export const selectSubBenefitConsultations        = (s) => s.booking.subscriptionBenefitConsultations;
export const selectSubBenefitConsultationsLoading = (s) => s.booking.loading.fetchSubscriptionBenefitConsultations ?? false;
export const selectSubBenefitConsultationsError   = (s) => s.booking.errors.fetchSubscriptionBenefitConsultations  ?? null;

// Convenience sub-selectors
export const selectSubConsultationQuota     = (s) => s.booking.subscriptionBenefitConsultations?.consultations ?? null;
export const selectSubConsultationUsed      = (s) => s.booking.subscriptionBenefitConsultations?.consultations?.used ?? 0;
export const selectSubConsultationRemaining = (s) => s.booking.subscriptionBenefitConsultations?.consultations?.remaining ?? null;
export const selectSubConsultationModes     = (s) => s.booking.subscriptionBenefitConsultations?.consultations?.modes ?? null;

export const selectSubBenefitCareAssistant        = (s) => s.booking.subscriptionBenefitCareAssistant;
export const selectSubBenefitCareAssistantLoading = (s) => s.booking.loading.fetchSubscriptionBenefitCareAssistant ?? false;
export const selectSubBenefitCareAssistantError   = (s) => s.booking.errors.fetchSubscriptionBenefitCareAssistant  ?? null;

// Convenience sub-selectors
export const selectSubCareAssistantQuota     = (s) => s.booking.subscriptionBenefitCareAssistant?.careAssistant ?? null;
export const selectSubCareAssistantUsed      = (s) => s.booking.subscriptionBenefitCareAssistant?.careAssistant?.used ?? 0;
export const selectSubCareAssistantRemaining = (s) => s.booking.subscriptionBenefitCareAssistant?.careAssistant?.remaining ?? null;
export const selectSubCareAssistantAllTiers  = (s) => s.booking.subscriptionBenefitCareAssistant?.careAssistant?.allTiers ?? [];
export const selectSubCareAssistantActiveTier = (s) => s.booking.subscriptionBenefitCareAssistant?.careAssistant?.activeTier ?? null;
export const selectSubCareAssistantIncluded  = (s) => s.booking.subscriptionBenefitCareAssistant?.included ?? false;


export const selectAllDoctors         = (s) => s.booking.allDoctors;
export const selectAllDoctorsMeta     = (s) => s.booking.allDoctorsMeta;
export const selectAllDoctorsLoading  = (s) => s.booking.loading.fetchAllDoctors  ?? false;
export const selectAllDoctorsError    = (s) => s.booking.errors.fetchAllDoctors   ?? null;


// ── deleteFailedBooking ───────────────────────────────────────────────────────
export const selectDeleteFailedBookingResult  = (s) => s.booking.deleteFailedBookingResult;
export const selectDeleteFailedBookingLoading = (s) => s.booking.loading.deleteFailedBooking ?? false;
export const selectDeleteFailedBookingError   = (s) => s.booking.errors.deleteFailedBooking  ?? null;

// ── consultationSession from doctor-online createdBooking ─────────────────────
export const selectCreatedConsultationSession = (s) => s.booking.createdBooking?.consultationSession ?? null;
// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export { BOOKING_TYPES };

export default bookingSlice.reducer;