 
import { createSlice, createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SLICE_NAME = 'booking';

const REQUEST_STATUS = Object.freeze({
  IDLE:    'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  FAILED:  'failed',
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const extractErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;
  const serverMsg = error?.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.trim()) return serverMsg.trim();
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error')
    return 'Network error. Please check your connection.';
  if (error?.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
  return fallback;
};

/**
 * FIX S3 — renamed from isAlreadyLoading to shouldProceed.
 * RTK condition: return false = ABORT, return true = ALLOW.
 * Prevents duplicate in-flight requests for the same key.
 * Returns true (allow) when status is NOT loading.
 */
const shouldProceed = (loadingKey) => (_arg, { getState }) => {
  const keys   = loadingKey.split('.');
  let   cursor = getState()[SLICE_NAME];
  for (const k of keys) cursor = cursor?.[k];
  return cursor !== REQUEST_STATUS.LOADING;
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // ── Discovery ────────────────────────────────────────────────────────────
  hospitals: {
    data:   [],
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },

  doctorsByHospital: {
    hospitalId: null,
    data:       [],
    status:     REQUEST_STATUS.IDLE,
    error:      null,
  },

  hospitalAvailability: {
    hospitalId: null,
    data:       null,  // { available, reason? }
    status:     REQUEST_STATUS.IDLE,
    error:      null,
  },

  doctorAvailability: {
    doctorId: null,
    data:     null,
    status:   REQUEST_STATUS.IDLE,
    error:    null,
  },

  labs: {
    data:   [],
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },

  labDetail: {
    labId:  null,
    data:   null,
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },

  bookingOptions: {
    type:   null,
    data:   null,  // { bookingType, components, features }
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },

  transportEstimate: {
    data:   null,
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },

  followUpCheck: {
    data:   null,  // { isEligible, reason, followUpFee, parentOpNumber, ... }
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },

  // ── Create booking (one shared bucket, reset between flows) ──────────────
  createBooking: {
    bookingType: null,
    data:        null,  // full response.data from whichever POST was last called
    status:      REQUEST_STATUS.IDLE,
    error:       null,
  },

  // ── My bookings list ─────────────────────────────────────────────────────
  myBookings: {
    data:   [],
    total:  0,
    page:   1,
    limit:  10,
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },

  // ── Active booking detail ─────────────────────────────────────────────────
  activeBooking: {
    data:   null,
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },

  // ── Cancel booking ────────────────────────────────────────────────────────
  cancelBooking: {
    bookingId: null,
    data:      null,  // { refundPercent, refundAmount, status }
    status:    REQUEST_STATUS.IDLE,
    error:     null,
  },

  // ── Rate booking ──────────────────────────────────────────────────────────
  rateBooking: {
    bookingId: null,
    status:    REQUEST_STATUS.IDLE,
    error:     null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — DISCOVERY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /hospitals
 * @param {{ city?: string, hospitalType?: string }} params
 */
export const fetchHospitals = createAsyncThunk(
  `${SLICE_NAME}/fetchHospitals`,
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/hospitals', { params });
      return data.data;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('hospitals.status') }
);

/**
 * GET /hospitals/:hospitalId/doctors
 * @param {string} hospitalId
 *
 * FIX S4 — NO condition guard here.
 * Condition would block re-fetch when hospitalId changes but status=SUCCESS.
 * Let component control when to dispatch (dispatch on hospitalId change).
 */
export const fetchDoctorsByHospital = createAsyncThunk(
  `${SLICE_NAME}/fetchDoctorsByHospital`,
  async (hospitalId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/hospitals/${hospitalId}/doctors`);
      return { hospitalId, doctors: data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
  // FIX S4: no condition — allow re-fetch on different hospitalId
);

/**
 * GET /hospitals/:hospitalId/availability
 * @param {{ hospitalId: string, scheduledAt: string }} payload
 */
export const checkHospitalAvailability = createAsyncThunk(
  `${SLICE_NAME}/checkHospitalAvailability`,
  async ({ hospitalId, scheduledAt }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/hospitals/${hospitalId}/availability`, {
        params: { scheduledAt },
      });
      return { hospitalId, ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('hospitalAvailability.status') }
);

/**
 * GET /doctors/:doctorId/availability
 * @param {{ doctorId: string, scheduledAt: string, hospitalId?: string }} payload
 */
export const checkDoctorAvailability = createAsyncThunk(
  `${SLICE_NAME}/checkDoctorAvailability`,
  async ({ doctorId, scheduledAt, hospitalId }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/doctors/${doctorId}/availability`, {
        params: { scheduledAt, hospitalId },
      });
      return { doctorId, ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('doctorAvailability.status') }
);

/**
 * GET /labs
 * @param {{ city?: string, labType?: string, homeCollection?: boolean }} params
 */
export const fetchLabs = createAsyncThunk(
  `${SLICE_NAME}/fetchLabs`,
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/labs', { params });
      return data.data;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('labs.status') }
);

/**
 * GET /labs/:labId
 * @param {string} labId
 */
export const fetchLabDetail = createAsyncThunk(
  `${SLICE_NAME}/fetchLabDetail`,
  async (labId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/labs/${labId}`);
      return { labId, lab: data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('labDetail.status') }
);

/**
 * GET /booking-options/:type
 * @param {string} type — one of CUSTOMER_BOOKING_TYPES
 * NOTE: No condition guard — type changes require fresh fetch each time.
 */
export const fetchBookingOptions = createAsyncThunk(
  `${SLICE_NAME}/fetchBookingOptions`,
  async (type, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/booking-options/${type}`);
      return data.data; // { bookingType, components, features }
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
  // no condition — type varies per call
);

/**
 * GET /transport/estimate
 * @param {{
 *   pickupLng: number, pickupLat: number,
 *   dropoffLng: number, dropoffLat: number,
 *   includeReturn?: boolean,
 *   waitingMinutes?: number,
 *   bookingType?: 'patient_transport'|'full_care_ride'|'diagnostic_home',
 * }} params
 */
export const estimateTransport = createAsyncThunk(
  `${SLICE_NAME}/estimateTransport`,
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/transport/estimate', { params });
      return data.data;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('transportEstimate.status') }
);

/**
 * GET /follow-up/check
 * @param {{ doctorId: string, hospitalId?: string }} params
 */
export const checkFollowUp = createAsyncThunk(
  `${SLICE_NAME}/checkFollowUp`,
  async ({ doctorId, hospitalId }, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/follow-up/check', {
        params: { doctorId, hospitalId },
      });
      return data.data; // { isEligible, reason, followUpFee, ... }
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('followUpCheck.status') }
);

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — BOOKING (POST)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /full-care-ride
 * @param {{
 *   hospitalId, doctorId, scheduledAt,
 *   consultationType?, patientInfo,
 *   patientLocation: { coordinates:[lng,lat], address, city, pincode },
 *   destinationLocation?, includeReturnHome?, slotId?,
 *   documents?, paymentMethod?, couponCode?, coinsToRedeem?
 * }} payload
 */
export const createFullCareRide = createAsyncThunk(
  `${SLICE_NAME}/createFullCareRide`,
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/bookings/full-care-ride', payload);
      return { bookingType: 'full_care_ride', ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('createBooking.status') }
);

/**
 * POST /doctor-consultation
 * @param {{
 *   hospitalId?, doctorId, scheduledAt, consultationType?,
 *   patientInfo, slotId?, documents?, paymentMethod?, couponCode?, coinsToRedeem?
 * }} payload
 */
export const createDoctorConsultation = createAsyncThunk(
  `${SLICE_NAME}/createDoctorConsultation`,
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/bookings/doctor-consultation', payload);
      return { bookingType: 'doctor_consultation', ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('createBooking.status') }
);

/**
 * POST /doctor-online
 * @param {{
 *   doctorId, scheduledAt, patientInfo,
 *   documents?, paymentMethod?
 * }} payload
 */
export const createDoctorOnline = createAsyncThunk(
  `${SLICE_NAME}/createDoctorOnline`,
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/bookings/doctor-online', payload);
      return { bookingType: 'doctor_online', ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('createBooking.status') }
);

/**
 * POST /physiotherapist
 * @param {{
 *   doctorId, scheduledAt, patientInfo,
 *   visitType?: 'inPerson'|'homeVisit',
 *   slotId?, documents?, paymentMethod?
 * }} payload
 *
 * NOTE: Requires 'physiotherapist' in CUSTOMER_BOOKING_TYPES (bookingRouterShared.js).
 * Route POST /physiotherapist exists in router — re-add to constant.
 */
export const createPhysiotherapist = createAsyncThunk(
  `${SLICE_NAME}/createPhysiotherapist`,
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/bookings/physiotherapist', payload);
      return { bookingType: 'physiotherapist', ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('createBooking.status') }
);

/**
 * POST /care-assistant
 * @param {{
 *   patientInfo,
 *   patientLocation: { coordinates:[lng,lat], address, city },
 *   scheduledAt, durationHours?, paymentMethod?
 * }} payload
 */
export const createCareAssistant = createAsyncThunk(
  `${SLICE_NAME}/createCareAssistant`,
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/bookings/care-assistant', payload);
      return { bookingType: 'care_assistant', ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('createBooking.status') }
);

/**
 * POST /diagnostic-center
 * @param {{
 *   labId, tests?: string[], packages?: string[], scheduledAt,
 *   patientInfo, reportDeliveryMode?, paymentMethod?
 * }} payload
 */
export const createDiagnosticCenter = createAsyncThunk(
  `${SLICE_NAME}/createDiagnosticCenter`,
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/bookings/diagnostic-center', payload);
      return { bookingType: 'diagnostic_center', ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('createBooking.status') }
);

/**
 * POST /diagnostic-home
 * @param {{
 *   labId, tests?, packages?, scheduledAt,
 *   patientInfo,
 *   patientLocation: { coordinates:[lng,lat], address, city, pincode },
 *   reportDeliveryMode?, paymentMethod?
 * }} payload
 */
export const createDiagnosticHome = createAsyncThunk(
  `${SLICE_NAME}/createDiagnosticHome`,
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/bookings/diagnostic-home', payload);
      return { bookingType: 'diagnostic_home', ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('createBooking.status') }
);

/**
 * POST /patient-transport
 * @param {{
 *   patientInfo,
 *   patientLocation: { coordinates:[lng,lat], address, city },
 *   destinationLocation: { coordinates:[lng,lat], address, city },
 *   scheduledAt,
 *   includeReturn?: boolean,
 *   waitingMinutes?: number,
 *   vehicleClass?: 'two_wheeler'|'four_wheeler'|'ambulance',
 *   addConsultation?: boolean,
 *   hospitalId?, doctorId?, consultationType?, slotId?,
 *   paymentMethod?, couponCode?, coinsToRedeem?
 * }} payload
 */
export const createPatientTransport = createAsyncThunk(
  `${SLICE_NAME}/createPatientTransport`,
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/bookings/patient-transport', payload);
      return { bookingType: 'patient_transport', ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('createBooking.status') }
);

/**
 * POST /follow-up
 * @param {{
 *   doctorId, hospitalId?, scheduledAt, patientInfo,
 *   consultationType?, slotId?, paymentMethod?
 * }} payload
 */
export const createFollowUp = createAsyncThunk(
  `${SLICE_NAME}/createFollowUp`,
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/bookings/follow-up', payload);
      return { bookingType: 'follow_up', ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('createBooking.status') }
);

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /my-bookings
 * @param {{ status?: string, bookingType?: string, page?: number, limit?: number }} params
 * No condition — pagination requires re-fetch each page change.
 */
export const fetchMyBookings = createAsyncThunk(
  `${SLICE_NAME}/fetchMyBookings`,
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/my-bookings', { params });
      // Router returns: { success, total, page, limit, data: [] }
      return {
        bookings: data.data,
        total:    data.total,
        page:     data.page,
        limit:    data.limit,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
  // no condition — pagination changes require fresh fetch
);

/**
 * GET /my-bookings/:bookingId
 * @param {string} bookingId
 */
export const fetchBookingById = createAsyncThunk(
  `${SLICE_NAME}/fetchBookingById`,
  async (bookingId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/my-bookings/${bookingId}`);
      return data.data;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('activeBooking.status') }
);

/**
 * POST /my-bookings/:bookingId/cancel
 * Router accepts POST (not DELETE). Body: { reason? }
 * @param {{ bookingId: string, reason?: string }} payload
 */
export const cancelBooking = createAsyncThunk(
  `${SLICE_NAME}/cancelBooking`,
  async ({ bookingId, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/bookings/my-bookings/${bookingId}/cancel`, { reason });
      // Router returns: { success, message, data: { refundPercent, refundAmount, status } }
      return { bookingId, ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('cancelBooking.status') }
);

/**
 * POST /my-bookings/:bookingId/rate
 * Router returns { success: true, message: 'Rating submitted successfully' } only.
 * No booking object in response — optimistic patch applied in reducer.
 *
 * FIX S1 — removed unused `data` destructure from API call.
 *
 * @param {{
 *   bookingId: string,
 *   overallRating: number,        // 1-5, required
 *   overallComment?: string,
 *   doctorRating?: number,
 *   doctorComment?: string,
 *   careAssistantRating?: number,
 *   careAssistantComment?: string,
 *   driverRating?: number,
 *   driverComment?: string,
 *   labRating?: number,
 *   labComment?: string,
 * }} payload
 */
export const rateBooking = createAsyncThunk(
  `${SLICE_NAME}/rateBooking`,
  async (
    {
      bookingId,
      overallRating,
      overallComment,
      doctorRating,
      doctorComment,
      careAssistantRating,
      careAssistantComment,
      driverRating,
      driverComment,
      labRating,
      labComment,
    },
    { rejectWithValue }
  ) => {
    try {
      // FIX S1 — response is { success, message } only — no data payload needed
      await API.post(`/bookings/my-bookings/${bookingId}/rate`, {
        overallRating,
        overallComment,
        doctorRating,
        doctorComment,
        careAssistantRating,
        careAssistantComment,
        driverRating,
        driverComment,
        labRating,
        labComment,
      });
      return { bookingId };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('rateBooking.status') }
);

// ─────────────────────────────────────────────────────────────────────────────
// ALL CREATE BOOKING THUNKS — for matcher grouping
// ─────────────────────────────────────────────────────────────────────────────

const ALL_CREATE_THUNKS = [
  createFullCareRide,
  createDoctorConsultation,
  createDoctorOnline,
  createPhysiotherapist,
  createCareAssistant,
  createDiagnosticCenter,
  createDiagnosticHome,
  createPatientTransport,
  createFollowUp,
];

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const bookingSlice = createSlice({
  name: SLICE_NAME,
  initialState,

  reducers: {
    // ── Resets ──────────────────────────────────────────────────────────────

    resetHospitals(state) {
      state.hospitals = initialState.hospitals;
    },
    resetDoctorsByHospital(state) {
      state.doctorsByHospital = initialState.doctorsByHospital;
    },
    resetHospitalAvailability(state) {
      state.hospitalAvailability = initialState.hospitalAvailability;
    },
    resetDoctorAvailability(state) {
      state.doctorAvailability = initialState.doctorAvailability;
    },
    resetLabs(state) {
      state.labs = initialState.labs;
    },
    resetLabDetail(state) {
      state.labDetail = initialState.labDetail;
    },
    resetBookingOptions(state) {
      state.bookingOptions = initialState.bookingOptions;
    },
    resetTransportEstimate(state) {
      state.transportEstimate = initialState.transportEstimate;
    },
    resetFollowUpCheck(state) {
      state.followUpCheck = initialState.followUpCheck;
    },

    /** Call when leaving booking creation flow */
    resetCreateBooking(state) {
      state.createBooking = initialState.createBooking;
    },

    /** Call when leaving booking detail screen */
    clearActiveBooking(state) {
      state.activeBooking = initialState.activeBooking;
    },

    resetCancelBooking(state) {
      state.cancelBooking = initialState.cancelBooking;
    },

    resetRateBooking(state) {
      state.rateBooking = initialState.rateBooking;
    },

    /**
     * Optimistic status patch from socket event.
     * @param {{ bookingId: string, status: string }} action.payload
     */
    patchBookingStatus(state, { payload: { bookingId, status } }) {
      const idx = state.myBookings.data.findIndex((b) => b._id === bookingId);
      if (idx !== -1) state.myBookings.data[idx].status = status;
      if (state.activeBooking.data?._id === bookingId) {
        state.activeBooking.data.status = status;
      }
    },

    /** Full wipe on logout */
    resetBookingState() {
      return initialState;
    },
  },

  extraReducers: (builder) => {
    // ── fetchHospitals ────────────────────────────────────────────────────
    builder
      .addCase(fetchHospitals.pending, (state) => {
        state.hospitals.status = REQUEST_STATUS.LOADING;
        state.hospitals.error  = null;
      })
      .addCase(fetchHospitals.fulfilled, (state, { payload }) => {
        state.hospitals.status = REQUEST_STATUS.SUCCESS;
        state.hospitals.data   = payload;
      })
      .addCase(fetchHospitals.rejected, (state, { payload }) => {
        state.hospitals.status = REQUEST_STATUS.FAILED;
        state.hospitals.error  = payload;
        toast.error(payload || 'Failed to load hospitals.');
      });

    // ── fetchDoctorsByHospital ────────────────────────────────────────────
    builder
      .addCase(fetchDoctorsByHospital.pending, (state) => {
        state.doctorsByHospital.status = REQUEST_STATUS.LOADING;
        state.doctorsByHospital.error  = null;
        state.doctorsByHospital.data   = [];
      })
      .addCase(fetchDoctorsByHospital.fulfilled, (state, { payload }) => {
        state.doctorsByHospital.status     = REQUEST_STATUS.SUCCESS;
        state.doctorsByHospital.hospitalId = payload.hospitalId;
        state.doctorsByHospital.data       = payload.doctors;
      })
      .addCase(fetchDoctorsByHospital.rejected, (state, { payload }) => {
        state.doctorsByHospital.status = REQUEST_STATUS.FAILED;
        state.doctorsByHospital.error  = payload;
        toast.error(payload || 'Failed to load doctors.');
      });

    // ── checkHospitalAvailability ─────────────────────────────────────────
    builder
      .addCase(checkHospitalAvailability.pending, (state) => {
        state.hospitalAvailability.status = REQUEST_STATUS.LOADING;
        state.hospitalAvailability.error  = null;
        state.hospitalAvailability.data   = null;
      })
      .addCase(checkHospitalAvailability.fulfilled, (state, { payload }) => {
        state.hospitalAvailability.status     = REQUEST_STATUS.SUCCESS;
        state.hospitalAvailability.hospitalId = payload.hospitalId;
        state.hospitalAvailability.data       = payload;
      })
      .addCase(checkHospitalAvailability.rejected, (state, { payload }) => {
        state.hospitalAvailability.status = REQUEST_STATUS.FAILED;
        state.hospitalAvailability.error  = payload;
        toast.error(payload || 'Availability check failed.');
      });

    // ── checkDoctorAvailability ───────────────────────────────────────────
    builder
      .addCase(checkDoctorAvailability.pending, (state) => {
        state.doctorAvailability.status = REQUEST_STATUS.LOADING;
        state.doctorAvailability.error  = null;
        state.doctorAvailability.data   = null;
      })
      .addCase(checkDoctorAvailability.fulfilled, (state, { payload }) => {
        state.doctorAvailability.status   = REQUEST_STATUS.SUCCESS;
        state.doctorAvailability.doctorId = payload.doctorId;
        state.doctorAvailability.data     = payload;
      })
      .addCase(checkDoctorAvailability.rejected, (state, { payload }) => {
        state.doctorAvailability.status = REQUEST_STATUS.FAILED;
        state.doctorAvailability.error  = payload;
        toast.error(payload || 'Doctor availability check failed.');
      });

    // ── fetchLabs ─────────────────────────────────────────────────────────
    builder
      .addCase(fetchLabs.pending, (state) => {
        state.labs.status = REQUEST_STATUS.LOADING;
        state.labs.error  = null;
      })
      .addCase(fetchLabs.fulfilled, (state, { payload }) => {
        state.labs.status = REQUEST_STATUS.SUCCESS;
        state.labs.data   = payload;
      })
      .addCase(fetchLabs.rejected, (state, { payload }) => {
        state.labs.status = REQUEST_STATUS.FAILED;
        state.labs.error  = payload;
        toast.error(payload || 'Failed to load labs.');
      });

    // ── fetchLabDetail ────────────────────────────────────────────────────
    builder
      .addCase(fetchLabDetail.pending, (state) => {
        state.labDetail.status = REQUEST_STATUS.LOADING;
        state.labDetail.error  = null;
        state.labDetail.data   = null;
      })
      .addCase(fetchLabDetail.fulfilled, (state, { payload }) => {
        state.labDetail.status = REQUEST_STATUS.SUCCESS;
        state.labDetail.labId  = payload.labId;
        state.labDetail.data   = payload.lab;
      })
      .addCase(fetchLabDetail.rejected, (state, { payload }) => {
        state.labDetail.status = REQUEST_STATUS.FAILED;
        state.labDetail.error  = payload;
        toast.error(payload || 'Failed to load lab details.');
      });

    // ── fetchBookingOptions ───────────────────────────────────────────────
    builder
      .addCase(fetchBookingOptions.pending, (state) => {
        state.bookingOptions.status = REQUEST_STATUS.LOADING;
        state.bookingOptions.error  = null;
        state.bookingOptions.data   = null;
      })
      .addCase(fetchBookingOptions.fulfilled, (state, { payload }) => {
        state.bookingOptions.status = REQUEST_STATUS.SUCCESS;
        state.bookingOptions.type   = payload.bookingType;
        state.bookingOptions.data   = payload;
      })
      .addCase(fetchBookingOptions.rejected, (state, { payload }) => {
        state.bookingOptions.status = REQUEST_STATUS.FAILED;
        state.bookingOptions.error  = payload;
        toast.error(payload || 'Failed to load booking options.');
      });

    // ── estimateTransport ─────────────────────────────────────────────────
    builder
      .addCase(estimateTransport.pending, (state) => {
        state.transportEstimate.status = REQUEST_STATUS.LOADING;
        state.transportEstimate.error  = null;
        state.transportEstimate.data   = null;
      })
      .addCase(estimateTransport.fulfilled, (state, { payload }) => {
        state.transportEstimate.status = REQUEST_STATUS.SUCCESS;
        state.transportEstimate.data   = payload;
      })
      .addCase(estimateTransport.rejected, (state, { payload }) => {
        state.transportEstimate.status = REQUEST_STATUS.FAILED;
        state.transportEstimate.error  = payload;
        toast.error(payload || 'Failed to estimate transport fare.');
      });

    // ── checkFollowUp ─────────────────────────────────────────────────────
    builder
      .addCase(checkFollowUp.pending, (state) => {
        state.followUpCheck.status = REQUEST_STATUS.LOADING;
        state.followUpCheck.error  = null;
        state.followUpCheck.data   = null;
      })
      .addCase(checkFollowUp.fulfilled, (state, { payload }) => {
        state.followUpCheck.status = REQUEST_STATUS.SUCCESS;
        state.followUpCheck.data   = payload;
      })
      .addCase(checkFollowUp.rejected, (state, { payload }) => {
        state.followUpCheck.status = REQUEST_STATUS.FAILED;
        state.followUpCheck.error  = payload;
        toast.error(payload || 'Follow-up eligibility check failed.');
      });

    // ── fetchMyBookings ───────────────────────────────────────────────────
    builder
      .addCase(fetchMyBookings.pending, (state) => {
        state.myBookings.status = REQUEST_STATUS.LOADING;
        state.myBookings.error  = null;
      })
      .addCase(fetchMyBookings.fulfilled, (state, { payload }) => {
        state.myBookings.status = REQUEST_STATUS.SUCCESS;
        state.myBookings.data   = payload.bookings;
        state.myBookings.total  = payload.total;
        state.myBookings.page   = payload.page;
        state.myBookings.limit  = payload.limit;
      })
      .addCase(fetchMyBookings.rejected, (state, { payload }) => {
        state.myBookings.status = REQUEST_STATUS.FAILED;
        state.myBookings.error  = payload;
        toast.error(payload || 'Failed to load bookings.');
      });

    // ── fetchBookingById ──────────────────────────────────────────────────
    builder
      .addCase(fetchBookingById.pending, (state) => {
        state.activeBooking.status = REQUEST_STATUS.LOADING;
        state.activeBooking.error  = null;
        state.activeBooking.data   = null;
      })
      .addCase(fetchBookingById.fulfilled, (state, { payload }) => {
        state.activeBooking.status = REQUEST_STATUS.SUCCESS;
        state.activeBooking.data   = payload;
      })
      .addCase(fetchBookingById.rejected, (state, { payload }) => {
        state.activeBooking.status = REQUEST_STATUS.FAILED;
        state.activeBooking.error  = payload;
        toast.error(payload || 'Failed to load booking details.');
      });

    // ── cancelBooking ─────────────────────────────────────────────────────
    builder
      .addCase(cancelBooking.pending, (state, { meta }) => {
        state.cancelBooking.status    = REQUEST_STATUS.LOADING;
        state.cancelBooking.error     = null;
        state.cancelBooking.data      = null;
        state.cancelBooking.bookingId = meta.arg.bookingId;
      })
      .addCase(cancelBooking.fulfilled, (state, { payload }) => {
        state.cancelBooking.status = REQUEST_STATUS.SUCCESS;
        state.cancelBooking.data   = {
          refundPercent: payload.refundPercent,
          refundAmount:  payload.refundAmount,
          status:        payload.status,
        };

        // Sync list
        const idx = state.myBookings.data.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) state.myBookings.data[idx].status = 'cancelled';

        // Sync active detail
        if (state.activeBooking.data?._id === payload.bookingId) {
          state.activeBooking.data.status = 'cancelled';
        }

        toast.success(
          `Booking cancelled.${
            payload.refundAmount > 0
              ? ` Refund of ₹${payload.refundAmount} will be processed.`
              : ''
          }`
        );
      })
      .addCase(cancelBooking.rejected, (state, { payload }) => {
        state.cancelBooking.status = REQUEST_STATUS.FAILED;
        state.cancelBooking.error  = payload;
        toast.error(payload || 'Failed to cancel booking.');
      });

    // ── rateBooking ───────────────────────────────────────────────────────
    // Router returns { success, message } only — no booking object in response.
    // Mark isRated optimistically in local state via bookingId from thunk arg.
    builder
      .addCase(rateBooking.pending, (state, { meta }) => {
        state.rateBooking.status    = REQUEST_STATUS.LOADING;
        state.rateBooking.error     = null;
        state.rateBooking.bookingId = meta.arg.bookingId;
      })
      .addCase(rateBooking.fulfilled, (state, { payload }) => {
        state.rateBooking.status = REQUEST_STATUS.SUCCESS;

        // Optimistic patch — set isRated flag
        if (state.activeBooking.data?._id === payload.bookingId) {
          state.activeBooking.data.isRated = true;
        }
        const idx = state.myBookings.data.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) state.myBookings.data[idx].isRated = true;

        toast.success('Rating submitted. Thank you!');
      })
      .addCase(rateBooking.rejected, (state, { payload }) => {
        state.rateBooking.status = REQUEST_STATUS.FAILED;
        state.rateBooking.error  = payload;
        toast.error(payload || 'Failed to submit rating.');
      });

    // ── All create booking thunks (shared bucket) ─────────────────────────
    // NOTE: addMatcher calls must come AFTER all addCase calls.
    builder
      .addMatcher(
        isAnyOf(...ALL_CREATE_THUNKS.map((t) => t.pending)),
        (state) => {
          state.createBooking.status = REQUEST_STATUS.LOADING;
          state.createBooking.error  = null;
          state.createBooking.data   = null;
        }
      )
      .addMatcher(
        isAnyOf(...ALL_CREATE_THUNKS.map((t) => t.fulfilled)),
        (state, { payload }) => {
          state.createBooking.status      = REQUEST_STATUS.SUCCESS;
          state.createBooking.bookingType = payload.bookingType;
          state.createBooking.data        = payload;
          toast.success('Booking created successfully!');
        }
      )
      .addMatcher(
        isAnyOf(...ALL_CREATE_THUNKS.map((t) => t.rejected)),
        (state, { payload }) => {
          state.createBooking.status = REQUEST_STATUS.FAILED;
          state.createBooking.error  = payload;
          toast.error(payload || 'Failed to create booking.');
        }
      );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  resetHospitals,
  resetDoctorsByHospital,
  resetHospitalAvailability,
  resetDoctorAvailability,
  resetLabs,
  resetLabDetail,
  resetBookingOptions,
  resetTransportEstimate,
  resetFollowUpCheck,
  resetCreateBooking,
  clearActiveBooking,
  resetCancelBooking,
  resetRateBooking,
  patchBookingStatus,
  resetBookingState,
} = bookingSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// Discovery
export const selectHospitals                = (s) => s[SLICE_NAME].hospitals.data;
export const selectHospitalsLoading         = (s) => s[SLICE_NAME].hospitals.status === REQUEST_STATUS.LOADING;
export const selectHospitalsError           = (s) => s[SLICE_NAME].hospitals.error;

export const selectDoctorsByHospital        = (s) => s[SLICE_NAME].doctorsByHospital.data;
export const selectDoctorsByHospitalId      = (s) => s[SLICE_NAME].doctorsByHospital.hospitalId;
export const selectDoctorsByHospitalLoading = (s) => s[SLICE_NAME].doctorsByHospital.status === REQUEST_STATUS.LOADING;
export const selectDoctorsByHospitalError   = (s) => s[SLICE_NAME].doctorsByHospital.error;

export const selectHospitalAvailability     = (s) => s[SLICE_NAME].hospitalAvailability.data;
export const selectHospitalAvailLoading     = (s) => s[SLICE_NAME].hospitalAvailability.status === REQUEST_STATUS.LOADING;

export const selectDoctorAvailability       = (s) => s[SLICE_NAME].doctorAvailability.data;
export const selectDoctorAvailLoading       = (s) => s[SLICE_NAME].doctorAvailability.status === REQUEST_STATUS.LOADING;

export const selectLabs                     = (s) => s[SLICE_NAME].labs.data;
export const selectLabsLoading              = (s) => s[SLICE_NAME].labs.status === REQUEST_STATUS.LOADING;
export const selectLabsError                = (s) => s[SLICE_NAME].labs.error;

export const selectLabDetail                = (s) => s[SLICE_NAME].labDetail.data;
export const selectLabDetailLoading         = (s) => s[SLICE_NAME].labDetail.status === REQUEST_STATUS.LOADING;
export const selectLabDetailError           = (s) => s[SLICE_NAME].labDetail.error;

export const selectBookingOptions           = (s) => s[SLICE_NAME].bookingOptions.data;
export const selectBookingOptionsType       = (s) => s[SLICE_NAME].bookingOptions.type;
export const selectBookingOptionsLoading    = (s) => s[SLICE_NAME].bookingOptions.status === REQUEST_STATUS.LOADING;

export const selectTransportEstimate        = (s) => s[SLICE_NAME].transportEstimate.data;
export const selectTransportEstimLoading    = (s) => s[SLICE_NAME].transportEstimate.status === REQUEST_STATUS.LOADING;
export const selectTransportEstimError      = (s) => s[SLICE_NAME].transportEstimate.error;

export const selectFollowUpCheck            = (s) => s[SLICE_NAME].followUpCheck.data;
export const selectFollowUpCheckLoading     = (s) => s[SLICE_NAME].followUpCheck.status === REQUEST_STATUS.LOADING;
export const selectFollowUpCheckError       = (s) => s[SLICE_NAME].followUpCheck.error;

// Create booking
export const selectCreateBookingData        = (s) => s[SLICE_NAME].createBooking.data;
export const selectCreateBookingType        = (s) => s[SLICE_NAME].createBooking.bookingType;
export const selectCreateBookingLoading     = (s) => s[SLICE_NAME].createBooking.status === REQUEST_STATUS.LOADING;
export const selectCreateBookingError       = (s) => s[SLICE_NAME].createBooking.error;
export const selectCreateBookingStatus      = (s) => s[SLICE_NAME].createBooking.status;

// My bookings list
export const selectMyBookings               = (s) => s[SLICE_NAME].myBookings.data;
export const selectMyBookingsMeta           = (s) => ({
  total:  s[SLICE_NAME].myBookings.total,
  page:   s[SLICE_NAME].myBookings.page,
  limit:  s[SLICE_NAME].myBookings.limit,
  status: s[SLICE_NAME].myBookings.status,
  error:  s[SLICE_NAME].myBookings.error,
});
export const selectMyBookingsLoading        = (s) => s[SLICE_NAME].myBookings.status === REQUEST_STATUS.LOADING;

// Active booking
export const selectActiveBooking            = (s) => s[SLICE_NAME].activeBooking.data;
export const selectActiveBookingLoading     = (s) => s[SLICE_NAME].activeBooking.status === REQUEST_STATUS.LOADING;
export const selectActiveBookingError       = (s) => s[SLICE_NAME].activeBooking.error;

// Cancel
export const selectCancelBooking            = (s) => s[SLICE_NAME].cancelBooking;
export const selectCancelBookingLoading     = (s) => s[SLICE_NAME].cancelBooking.status === REQUEST_STATUS.LOADING;
export const selectCancelBookingError       = (s) => s[SLICE_NAME].cancelBooking.error;

// Rate
export const selectRateBooking              = (s) => s[SLICE_NAME].rateBooking;
export const selectRateBookingLoading       = (s) => s[SLICE_NAME].rateBooking.status === REQUEST_STATUS.LOADING;
export const selectRateBookingError         = (s) => s[SLICE_NAME].rateBooking.error;

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

export default bookingSlice.reducer;