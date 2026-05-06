import { createSlice, createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SLICE_NAME = 'booking';

const REQUEST_STATUS = Object.freeze({
  IDLE:       'idle',
  LOADING:    'loading',
  SUCCESS:    'success',
  FAILED:     'failed',
});

const SOCKET_STATUS = Object.freeze({
  DISCONNECTED: 'disconnected',
  CONNECTING:   'connecting',
  CONNECTED:    'connected',
  ERROR:        'error',
});

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET SINGLETON (module-level, NOT in Redux state — not serializable)
// ─────────────────────────────────────────────────────────────────────────────

/** @type {import('socket.io-client').Socket|null} */
let _socket = null;

/**
 * Get or create socket instance.
 * @param {string} token — JWT
 * @returns {import('socket.io-client').Socket}
 */
const getSocket = (token) => {
  if (_socket?.connected) return _socket;
  _socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_SOCKET_URL, {
    auth:             { token },
    transports:       ['websocket'],
    reconnection:     true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
  });
  return _socket;
};

const disconnectSocket = () => {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
};

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
    data:       null,
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
    data:   null,
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },
  transportEstimate: {
    data:   null,
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },
  followUpCheck: {
    data:   null,
    status: REQUEST_STATUS.IDLE,
    error:  null,
  },

  // ── Create booking ───────────────────────────────────────────────────────
  createBooking: {
    bookingType: null,
    data:        null,
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
    data:      null,
    status:    REQUEST_STATUS.IDLE,
    error:     null,
  },

  // ── Rate booking ──────────────────────────────────────────────────────────
  rateBooking: {
    bookingId: null,
    status:    REQUEST_STATUS.IDLE,
    error:     null,
  },

  // ── SOCKET ───────────────────────────────────────────────────────────────
  socket: {
    status:       SOCKET_STATUS.DISCONNECTED,   // connecting|connected|disconnected|error
    error:        null,
    joinedRooms:  [],                           // ['booking:abc', 'tp:xyz']
  },

  // ── Live location per booking (keyed by bookingId) ────────────────────────
  // { [bookingId]: { lat, lng, heading, speed, role, updatedAt } }
  liveLocations: {},

  // ── Participant presence per booking ──────────────────────────────────────
  // { [bookingId]: [{ role, name, timestamp }] }
  participants: {},

  // ── Booking state snapshot (from socket, after reconnect) ─────────────────
  bookingSnapshot: {
    bookingId:     null,
    bookingStatus: null,
    ride:          null,   // { status, liveLocation }
    tracking:      null,   // { currentLocation, remainingDistance, remainingDuration, lastUpdatedAt }
    receivedAt:    null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET THUNKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Connect socket with JWT token.
 * Attaches all event listeners and dispatches state updates.
 * @param {string} token
 */
export const connectBookingSocket = createAsyncThunk(
  `${SLICE_NAME}/connectBookingSocket`,
  async (token, { dispatch, rejectWithValue }) => {
    try {
      const socket = getSocket(token);

      // Already connected — nothing to do
      if (socket.connected) return { already: true };

      return new Promise((resolve, reject) => {
        // ── Connection events ──────────────────────────────────────────────
        socket.on('connect', () => {
          dispatch(socketConnected());
          resolve({ socketId: socket.id });
        });

        socket.on('connect_error', (err) => {
          dispatch(socketError(err.message));
          reject(err.message);
        });

        socket.on('disconnect', (reason) => {
          dispatch(socketDisconnected(reason));
        });

        socket.on('reconnect_attempt', () => {
          dispatch(socketConnecting());
        });

        socket.on('reconnect', () => {
          dispatch(socketConnected());
        });

        // ── Booking room events ────────────────────────────────────────────

        /**
         * location_update: { lat, lng, heading, speed, role, updatedAt }
         * Need bookingId context — server sends in room, client must tag it.
         * We store under all active booking rooms the socket is in.
         */
        socket.on('location_update', (payload) => {
          // Extract bookingId from joined rooms list
          const rooms = [...(socket.rooms || [])].filter((r) => r.startsWith('booking:'));
          if (rooms.length === 1) {
            const bookingId = rooms[0].replace('booking:', '');
            dispatch(setLiveLocation({ bookingId, ...payload }));
          }
          // If in multiple booking rooms — payload should carry bookingId ideally.
          // Fallback: update all active booking rooms (safe for typical 1-booking UX).
          if (rooms.length > 1) {
            for (const room of rooms) {
              const bookingId = room.replace('booking:', '');
              dispatch(setLiveLocation({ bookingId, ...payload }));
            }
          }
        });

        socket.on('booking_state_snapshot', (payload) => {
          dispatch(setBookingSnapshot(payload));
        });

        socket.on('participant_joined', (payload) => {
          dispatch(participantJoined(payload));
        });

        socket.on('participant_left', (payload) => {
          dispatch(participantLeft(payload));
        });

        /**
         * booking_status_update: server can emit this from router after
         * status changes (e.g. ride started, completed).
         * Shape: { bookingId, status }
         */
        socket.on('booking_status_update', ({ bookingId, status }) => {
          dispatch(patchBookingStatus({ bookingId, status }));
        });

        socket.on('otp_resend_requested', (payload) => {
          // Notify UI — not stored in state, use a toast or trigger component event
          toast(`OTP resend requested by ${payload.requestedBy}`);
        });

        socket.on('error', ({ message }) => {
          toast.error(`Socket: ${message}`);
        });

        socket.on('driver_offline', (payload) => {
          // Admin-facing — no customer state change needed. Log only.
          console.warn('[Socket] driver_offline', payload);
        });
      });
    } catch (err) {
      return rejectWithValue(err?.message || 'Socket connection failed');
    }
  }
);

/**
 * Join a booking room.
 * @param {string} bookingId
 */
export const joinBookingRoom = createAsyncThunk(
  `${SLICE_NAME}/joinBookingRoom`,
  async (bookingId, { dispatch, rejectWithValue }) => {
    try {
      if (!_socket?.connected) throw new Error('Socket not connected');

      return new Promise((resolve, reject) => {
        _socket.emit('join_booking_room', { bookingId });

        _socket.once('joined_room', (payload) => {
          if (payload.bookingId === bookingId) {
            dispatch(roomJoined(`booking:${bookingId}`));
            resolve(payload);
          }
        });

        _socket.once('error', ({ message }) => {
          reject(message);
        });

        // Timeout guard
        setTimeout(() => reject('Join room timeout'), 10000);
      });
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to join booking room');
    }
  }
);

/**
 * Leave a booking room.
 * @param {string} bookingId
 */
export const leaveBookingRoom = createAsyncThunk(
  `${SLICE_NAME}/leaveBookingRoom`,
  async (bookingId, { dispatch }) => {
    if (!_socket?.connected) return;
    _socket.emit('leave_booking_room', { bookingId });
    dispatch(roomLeft(`booking:${bookingId}`));
    return bookingId;
  }
);

/**
 * Join a TP room (transport partner dashboard).
 * @param {string} tpId
 */
export const joinTpRoom = createAsyncThunk(
  `${SLICE_NAME}/joinTpRoom`,
  async (tpId, { dispatch, rejectWithValue }) => {
    try {
      if (!_socket?.connected) throw new Error('Socket not connected');

      return new Promise((resolve, reject) => {
        _socket.emit('join_tp_room', { tpId });

        _socket.once('joined_room', (payload) => {
          if (payload.tpId === tpId) {
            dispatch(roomJoined(`tp:${tpId}`));
            resolve(payload);
          }
        });

        _socket.once('error', ({ message }) => reject(message));
        setTimeout(() => reject('Join TP room timeout'), 10000);
      });
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to join TP room');
    }
  }
);

/**
 * Request a booking state snapshot (useful after reconnect).
 * @param {string} bookingId
 */
export const requestBookingSnapshot = createAsyncThunk(
  `${SLICE_NAME}/requestBookingSnapshot`,
  async (bookingId, { rejectWithValue }) => {
    try {
      if (!_socket?.connected) throw new Error('Socket not connected');
      _socket.emit('request_booking_state', { bookingId });
      // Response comes via 'booking_state_snapshot' event → setBookingSnapshot reducer
      return bookingId;
    } catch (err) {
      return rejectWithValue(err?.message || 'Failed to request snapshot');
    }
  }
);

/**
 * Disconnect socket (call on logout or app unmount).
 */
export const disconnectBookingSocket = createAsyncThunk(
  `${SLICE_NAME}/disconnectBookingSocket`,
  async (_, { dispatch }) => {
    disconnectSocket();
    dispatch(socketDisconnected('manual'));
    return true;
  }
);

/**
 * Push driver location (for driver-role clients).
 * @param {{ bookingId?: string, lat: number, lng: number, heading?: number, speed?: number }} payload
 */
export const pushDriverLocation = createAsyncThunk(
  `${SLICE_NAME}/pushDriverLocation`,
  async (payload, { rejectWithValue }) => {
    try {
      if (!_socket?.connected) throw new Error('Socket not connected');
      _socket.emit('driver_location', payload);
      return true;
    } catch (err) {
      return rejectWithValue(err?.message || 'Location push failed');
    }
  }
);

/**
 * Push care assistant location.
 * @param {{ bookingId?: string, lat: number, lng: number }} payload
 */
export const pushCareLocation = createAsyncThunk(
  `${SLICE_NAME}/pushCareLocation`,
  async (payload, { rejectWithValue }) => {
    try {
      if (!_socket?.connected) throw new Error('Socket not connected');
      _socket.emit('care_location', payload);
      return true;
    } catch (err) {
      return rejectWithValue(err?.message || 'Care location push failed');
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — DISCOVERY (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

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
);

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

export const fetchBookingOptions = createAsyncThunk(
  `${SLICE_NAME}/fetchBookingOptions`,
  async (type, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/bookings/booking-options/${type}`);
      return data.data;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  }
);

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

export const checkFollowUp = createAsyncThunk(
  `${SLICE_NAME}/checkFollowUp`,
  async ({ doctorId, hospitalId }, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/follow-up/check', {
        params: { doctorId, hospitalId },
      });
      return data.data;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('followUpCheck.status') }
);

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — BOOKING POST (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

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
// ASYNC THUNKS — MANAGEMENT (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchMyBookings = createAsyncThunk(
  `${SLICE_NAME}/fetchMyBookings`,
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/bookings/my-bookings', { params });
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
);

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

export const cancelBooking = createAsyncThunk(
  `${SLICE_NAME}/cancelBooking`,
  async ({ bookingId, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/bookings/my-bookings/${bookingId}/cancel`, { reason });
      return { bookingId, ...data.data };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('cancelBooking.status') }
);

export const rateBooking = createAsyncThunk(
  `${SLICE_NAME}/rateBooking`,
  async (
    {
      bookingId,
      overallRating, overallComment,
      doctorRating, doctorComment,
      careAssistantRating, careAssistantComment,
      driverRating, driverComment,
      labRating, labComment,
    },
    { rejectWithValue }
  ) => {
    try {
      await API.post(`/bookings/my-bookings/${bookingId}/rate`, {
        overallRating, overallComment,
        doctorRating, doctorComment,
        careAssistantRating, careAssistantComment,
        driverRating, driverComment,
        labRating, labComment,
      });
      return { bookingId };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: shouldProceed('rateBooking.status') }
);

// ─────────────────────────────────────────────────────────────────────────────
// CREATE BOOKING THUNKS — matcher group
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
    // ── Existing resets ──────────────────────────────────────────────────────
    resetHospitals(state)            { state.hospitals            = initialState.hospitals; },
    resetDoctorsByHospital(state)    { state.doctorsByHospital    = initialState.doctorsByHospital; },
    resetHospitalAvailability(state) { state.hospitalAvailability = initialState.hospitalAvailability; },
    resetDoctorAvailability(state)   { state.doctorAvailability   = initialState.doctorAvailability; },
    resetLabs(state)                 { state.labs                 = initialState.labs; },
    resetLabDetail(state)            { state.labDetail            = initialState.labDetail; },
    resetBookingOptions(state)       { state.bookingOptions       = initialState.bookingOptions; },
    resetTransportEstimate(state)    { state.transportEstimate    = initialState.transportEstimate; },
    resetFollowUpCheck(state)        { state.followUpCheck        = initialState.followUpCheck; },
    resetCreateBooking(state)        { state.createBooking        = initialState.createBooking; },
    clearActiveBooking(state)        { state.activeBooking        = initialState.activeBooking; },
    resetCancelBooking(state)        { state.cancelBooking        = initialState.cancelBooking; },
    resetRateBooking(state)          { state.rateBooking          = initialState.rateBooking; },

    // ── Socket status (dispatched from socket event listeners) ──────────────
    socketConnecting(state) {
      state.socket.status = SOCKET_STATUS.CONNECTING;
      state.socket.error  = null;
    },
    socketConnected(state) {
      state.socket.status = SOCKET_STATUS.CONNECTED;
      state.socket.error  = null;
    },
    socketDisconnected(state) {
      state.socket.status      = SOCKET_STATUS.DISCONNECTED;
      state.socket.joinedRooms = [];
    },
    socketError(state, { payload }) {
      state.socket.status = SOCKET_STATUS.ERROR;
      state.socket.error  = payload;
    },

    // ── Room tracking ────────────────────────────────────────────────────────
    roomJoined(state, { payload: room }) {
      if (!state.socket.joinedRooms.includes(room)) {
        state.socket.joinedRooms.push(room);
      }
    },
    roomLeft(state, { payload: room }) {
      state.socket.joinedRooms = state.socket.joinedRooms.filter((r) => r !== room);
      // Clean up location + participants for this booking
      if (room.startsWith('booking:')) {
        const bookingId = room.replace('booking:', '');
        delete state.liveLocations[bookingId];
        delete state.participants[bookingId];
      }
    },

    // ── Live location update (from socket event) ─────────────────────────────
    /**
     * @param {{ bookingId, lat, lng, heading, speed, role, updatedAt }} payload
     */
    setLiveLocation(state, { payload }) {
      const { bookingId, ...rest } = payload;
      state.liveLocations[bookingId] = rest;
    },

    clearLiveLocation(state, { payload: bookingId }) {
      delete state.liveLocations[bookingId];
    },

    // ── Participant presence ─────────────────────────────────────────────────
    /**
     * @param {{ bookingId, role, name, timestamp }} payload
     */
    participantJoined(state, { payload }) {
      const { bookingId, ...participant } = payload;
      if (!bookingId) return;
      if (!state.participants[bookingId]) state.participants[bookingId] = [];
      // Upsert by role
      const idx = state.participants[bookingId].findIndex((p) => p.role === participant.role);
      if (idx !== -1) state.participants[bookingId][idx] = participant;
      else state.participants[bookingId].push(participant);
    },
    /**
     * @param {{ bookingId, role, name, timestamp }} payload
     */
    participantLeft(state, { payload }) {
      const { bookingId, role } = payload;
      if (!bookingId || !state.participants[bookingId]) return;
      state.participants[bookingId] = state.participants[bookingId].filter(
        (p) => p.role !== role
      );
    },

    // ── Booking snapshot (from socket after reconnect) ───────────────────────
    setBookingSnapshot(state, { payload }) {
      state.bookingSnapshot = {
        ...payload,
        receivedAt: new Date().toISOString(),
      };
      // Also patch active booking status if IDs match
      if (state.activeBooking.data?._id === payload.bookingId && payload.bookingStatus) {
        state.activeBooking.data.status = payload.bookingStatus;
      }
    },

    resetBookingSnapshot(state) {
      state.bookingSnapshot = initialState.bookingSnapshot;
    },

    // ── Optimistic status patch (from socket or local) ───────────────────────
    patchBookingStatus(state, { payload: { bookingId, status } }) {
      const idx = state.myBookings.data.findIndex((b) => b._id === bookingId);
      if (idx !== -1) state.myBookings.data[idx].status = status;
      if (state.activeBooking.data?._id === bookingId) {
        state.activeBooking.data.status = status;
      }
    },

    // ── Full wipe on logout ──────────────────────────────────────────────────
    resetBookingState() {
      disconnectSocket(); // kill socket on logout
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

    // ── fetchDoctorsByHospital ─────────────────────────────────────────────
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

    // ── checkHospitalAvailability ──────────────────────────────────────────
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

    // ── checkDoctorAvailability ────────────────────────────────────────────
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

    // ── fetchLabs ──────────────────────────────────────────────────────────
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

    // ── fetchLabDetail ─────────────────────────────────────────────────────
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

    // ── fetchBookingOptions ────────────────────────────────────────────────
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

    // ── estimateTransport ──────────────────────────────────────────────────
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

    // ── checkFollowUp ──────────────────────────────────────────────────────
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

    // ── fetchMyBookings ────────────────────────────────────────────────────
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

    // ── fetchBookingById ───────────────────────────────────────────────────
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

    // ── cancelBooking ──────────────────────────────────────────────────────
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

        const idx = state.myBookings.data.findIndex((b) => b._id === payload.bookingId);
        if (idx !== -1) state.myBookings.data[idx].status = 'cancelled';

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

    // ── rateBooking ────────────────────────────────────────────────────────
    builder
      .addCase(rateBooking.pending, (state, { meta }) => {
        state.rateBooking.status    = REQUEST_STATUS.LOADING;
        state.rateBooking.error     = null;
        state.rateBooking.bookingId = meta.arg.bookingId;
      })
      .addCase(rateBooking.fulfilled, (state, { payload }) => {
        state.rateBooking.status = REQUEST_STATUS.SUCCESS;

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

    // ── connectBookingSocket ───────────────────────────────────────────────
    builder
      .addCase(connectBookingSocket.pending, (state) => {
        state.socket.status = SOCKET_STATUS.CONNECTING;
        state.socket.error  = null;
      })
      .addCase(connectBookingSocket.fulfilled, (state) => {
        // status already set by socketConnected() action from event listener
        // fulfilled here just means the promise resolved (socket connected)
        state.socket.status = SOCKET_STATUS.CONNECTED;
      })
      .addCase(connectBookingSocket.rejected, (state, { payload }) => {
        state.socket.status = SOCKET_STATUS.ERROR;
        state.socket.error  = payload;
        toast.error(`Socket failed: ${payload}`);
      });

    // ── joinBookingRoom ────────────────────────────────────────────────────
    builder
      .addCase(joinBookingRoom.rejected, (state, { payload }) => {
        toast.error(`Room join failed: ${payload}`);
      });

    // ── joinTpRoom ─────────────────────────────────────────────────────────
    builder
      .addCase(joinTpRoom.rejected, (state, { payload }) => {
        toast.error(`TP room join failed: ${payload}`);
      });

    // ── All create booking thunks ──────────────────────────────────────────
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
  // Existing
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
  // Socket
  socketConnecting,
  socketConnected,
  socketDisconnected,
  socketError,
  roomJoined,
  roomLeft,
  // Live data
  setLiveLocation,
  clearLiveLocation,
  participantJoined,
  participantLeft,
  setBookingSnapshot,
  resetBookingSnapshot,
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

// My bookings
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

// Socket
export const selectSocketStatus             = (s) => s[SLICE_NAME].socket.status;
export const selectSocketConnected          = (s) => s[SLICE_NAME].socket.status === SOCKET_STATUS.CONNECTED;
export const selectSocketError              = (s) => s[SLICE_NAME].socket.error;
export const selectSocketJoinedRooms        = (s) => s[SLICE_NAME].socket.joinedRooms;

// Live location
export const selectLiveLocation             = (bookingId) => (s) => s[SLICE_NAME].liveLocations[bookingId] ?? null;
export const selectAllLiveLocations         = (s) => s[SLICE_NAME].liveLocations;

// Participants
export const selectParticipants             = (bookingId) => (s) => s[SLICE_NAME].participants[bookingId] ?? [];

// Snapshot
export const selectBookingSnapshot          = (s) => s[SLICE_NAME].bookingSnapshot;

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

export default bookingSlice.reducer;