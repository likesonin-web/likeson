/**
 * rideRequestSlice.js — Likeson.in
 *
 * Covers all routes from rideRequestRouter.js
 *
 * Routes:
 *   POST   /ride-requests/customer                    → customerRequestRide
 *   POST   /ride-requests/care-assistant              → careAssistantRequestRide
 *   GET    /ride-requests/:rideId                     → fetchRide
 *   GET    /ride-requests/admin/all                   → fetchAdminAllRides
 *   GET    /ride-requests/admin/:rideId/nearby        → fetchNearbyDrivers
 *   POST   /ride-requests/admin/:rideId/assign        → adminAssignRide
 *   PATCH  /ride-requests/tp/:rideId/assign-driver    → tpAssignDriver
 *   PATCH  /ride-requests/:rideId/status              → updateRideStatus
 *   GET    /ride-requests/:rideId/live                → fetchRideLive
 *   GET    /ride-requests/:rideId/tracking            → fetchRideTracking
 *   POST   /ride-requests/:rideId/tracking/milestone  → postMilestone
 *
 * Socket events (from socketService.js SOCKET_EVENTS):
 *   ride_requested, ride_assigned, ride_status_changed,
 *   driver_accepted, driver_en_route, driver_arrived,
 *   otp_verified, ride_started, at_stop, ride_completed,
 *   ride_cancelled, navigation_target_changed, location_update,
 *   eta_update, otp_result, otp_wrong_attempt
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /ride-requests/customer ───────────────────────────────────────────
export const customerRequestRide = createAsyncThunk(
  'rideRequest/customerRequestRide',
  async (payload, { rejectWithValue }) => {
    // payload: { pickupLocation, destinationLocation, scheduledAt?, bookingId?, notes? }
    try {
      const { data } = await API.post('/ride-requests/customer', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── POST /ride-requests/care-assistant ────────────────────────────────────
export const careAssistantRequestRide = createAsyncThunk(
  'rideRequest/careAssistantRequestRide',
  async (payload, { rejectWithValue }) => {
    // payload: { pickupLocation, destinationLocation, bookingId, scheduledAt?, notes? }
    try {
      const { data } = await API.post('/ride-requests/care-assistant', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── GET /ride-requests/:rideId ────────────────────────────────────────────
export const fetchRide = createAsyncThunk(
  'rideRequest/fetchRide',
  async (rideId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/ride-requests/${rideId}`);
      return data.data.ride;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── GET /ride-requests/admin/all ──────────────────────────────────────────
export const fetchAdminAllRides = createAsyncThunk(
  'rideRequest/fetchAdminAllRides',
  async ({ status = 'searching', page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/ride-requests/admin/all', {
        params: { status, page, limit },
      });
      return data.data; // { rides, total, page, pages }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── GET /ride-requests/admin/:rideId/nearby ───────────────────────────────
export const fetchNearbyDrivers = createAsyncThunk(
  'rideRequest/fetchNearbyDrivers',
  async (rideId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/ride-requests/admin/${rideId}/nearby`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── POST /ride-requests/admin/:rideId/assign ──────────────────────────────
export const adminAssignRide = createAsyncThunk(
  'rideRequest/adminAssignRide',
  async ({ rideId, assignType, assignId }, { rejectWithValue }) => {
    // assignType: 'tp' | 'solo'
    // assignId: TransportPartner._id | SoloDriverPartner._id
    try {
      const { data } = await API.post(`/ride-requests/admin/${rideId}/assign`, {
        assignType,
        assignId,
      });
      return { rideId, ...data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── PATCH /ride-requests/tp/:rideId/assign-driver ─────────────────────────
export const tpAssignDriver = createAsyncThunk(
  'rideRequest/tpAssignDriver',
  async ({ rideId, driverId }, { rejectWithValue }) => {
    // driverId = Driver._id (NOT User._id)
    try {
      const { data } = await API.patch(`/ride-requests/tp/${rideId}/assign-driver`, {
        driverId,
      });
      return data.data; // { rideId, driverId, status }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── PATCH /ride-requests/:rideId/status ──────────────────────────────────
// action strings: accept | start_route | arrived | verify_otp |
//                 start_ride | at_stop | resume | complete | cancel
export const updateRideStatus = createAsyncThunk(
  'rideRequest/updateRideStatus',
  async ({ rideId, action, otp, stopIndex, cancelReason, eta } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/ride-requests/${rideId}/status`, {
        action,
        ...(otp          !== undefined && { otp }),
        ...(stopIndex    !== undefined && { stopIndex }),
        ...(cancelReason !== undefined && { cancelReason }),
        ...(eta          !== undefined && { eta }),
      });
      return { rideId, ...data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── GET /ride-requests/:rideId/live ──────────────────────────────────────
export const fetchRideLive = createAsyncThunk(
  'rideRequest/fetchRideLive',
  async (rideId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/ride-requests/${rideId}/live`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── GET /ride-requests/:rideId/tracking ──────────────────────────────────
export const fetchRideTracking = createAsyncThunk(
  'rideRequest/fetchRideTracking',
  async ({ rideId, breadcrumbs = 100 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/ride-requests/${rideId}/tracking`, {
        params: { breadcrumbs },
      });
      return data.data; // { ride, tracking, socketHint, _serverTime }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── POST /ride-requests/:rideId/tracking/milestone ───────────────────────
export const postMilestone = createAsyncThunk(
  'rideRequest/postMilestone',
  async ({ rideId, name, coordinates = null, stopSequence = null, meta = null } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/ride-requests/${rideId}/tracking/milestone`, {
        name,
        coordinates,
        stopSequence,
        meta,
      });
      return data.data; // { rideId, milestone, bookingRoom }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // Single ride being viewed/tracked
  currentRide: null,

  // Live snapshot (polling fallback)
  liveData: null,

  // Full tracking doc (breadcrumbs, milestones, polylines)
  trackingData: null,

  // Admin: list of rides
  adminRides: [],
  adminTotal: 0,
  adminPage:  1,
  adminPages: 1,

  // Admin: nearby search result for a ride
  nearbyResult: null,

  // Ride just created (customer / care-assistant)
  createdRide: null,

  // Socket-pushed live state (updated by socket actions below)
  socketLive: {
    status:            null,
    liveLocation:      null,
    etaMinutes:        null,
    etaTarget:         null,
    navigationTarget:  null,  // { currentTarget, coords, address, polyline }
    driverSnapshot:    null,
    vehicleSnapshot:   null,
    otpResult:         null,
    wrongOtpAttempts:  0,
  },

  // Loading states per operation
  loading: {
    customerRequest:    false,
    careRequest:        false,
    fetchRide:          false,
    adminAll:           false,
    nearby:             false,
    adminAssign:        false,
    tpAssign:           false,
    statusUpdate:       false,
    live:               false,
    tracking:           false,
    milestone:          false,
  },

  errors: {
    customerRequest:    null,
    careRequest:        null,
    fetchRide:          null,
    adminAll:           null,
    nearby:             null,
    adminAssign:        null,
    tpAssign:           null,
    statusUpdate:       null,
    live:               null,
    tracking:           null,
    milestone:          null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const rideRequestSlice = createSlice({
  name: 'rideRequest',
  initialState,

  reducers: {
    // ── Socket event handlers ──────────────────────────────────────────────
    // Call these from SocketProvider listeners (useBookingRoom / useSocket).

    // location_update → SOCKET_EVENTS.LOCATION_UPDATE
    socketLocationUpdate(state, action) {
      // payload: { lat, lng, heading, speedKmh, updatedAt, … }
      state.liveData = state.liveData
        ? { ...state.liveData, liveLocation: action.payload }
        : null;
      state.socketLive.liveLocation = action.payload;
    },

    // eta_update → SOCKET_EVENTS.ETA_UPDATE
    socketEtaUpdate(state, action) {
      // payload: { etaMinutes, distanceRemainingKm, currentTarget, … }
      state.socketLive.etaMinutes = action.payload.etaMinutes ?? state.socketLive.etaMinutes;
      state.socketLive.etaTarget  = action.payload.currentTarget ?? state.socketLive.etaTarget;
      if (state.liveData) state.liveData.currentEtaMinutes = action.payload.etaMinutes;
    },

    // ride_status_changed → SOCKET_EVENTS.RIDE_STATUS_CHANGED
    socketRideStatusChanged(state, action) {
      // payload: { rideId, bookingId, status, timestamp, … }
      state.socketLive.status = action.payload.status;
      if (state.currentRide?._id === action.payload.rideId) {
        state.currentRide.status = action.payload.status;
      }
    },

    // driver_accepted, driver_en_route, driver_arrived, otp_verified,
    // ride_started, at_stop, ride_completed, ride_cancelled
    socketDriverAccepted(state, action) {
      state.socketLive.status = 'driver_accepted';
      if (state.currentRide) state.currentRide.status = 'driver_accepted';
    },
    socketDriverEnRoute(state, action) {
      state.socketLive.status    = 'driver_en_route';
      state.socketLive.etaMinutes = action.payload?.currentEtaMinutes ?? state.socketLive.etaMinutes;
      if (state.currentRide) state.currentRide.status = 'driver_en_route';
    },
    socketDriverArrived(state, action) {
      state.socketLive.status = 'driver_arrived';
      if (state.currentRide) state.currentRide.status = 'driver_arrived';
    },
    socketOtpVerified(state, action) {
      state.socketLive.status    = 'otp_verified';
      state.socketLive.otpResult = { success: true, ...action.payload };
      if (state.currentRide) state.currentRide.status = 'otp_verified';
    },
    socketRideStarted(state, action) {
      state.socketLive.status = 'in_progress';
      if (state.currentRide) state.currentRide.status = 'in_progress';
    },
    socketAtStop(state, action) {
      state.socketLive.status = 'at_stop';
      if (state.currentRide) state.currentRide.status = 'at_stop';
    },
    socketRideCompleted(state, action) {
      state.socketLive.status = 'completed';
      if (state.currentRide) state.currentRide.status = 'completed';
    },
    socketRideCancelled(state, action) {
      state.socketLive.status = 'cancelled';
      if (state.currentRide) state.currentRide.status = 'cancelled';
    },

    // navigation_target_changed → SOCKET_EVENTS.NAVIGATION_TARGET_CHANGED
    // payload: { currentTarget, coords, address, polyline, bookingId, rideId }
    socketNavigationTargetChanged(state, action) {
      state.socketLive.navigationTarget = action.payload;
    },

    // otp_result → SOCKET_EVENTS.OTP_RESULT
    socketOtpResult(state, action) {
      state.socketLive.otpResult = action.payload;
    },

    // otp_wrong_attempt → SOCKET_EVENTS.OTP_WRONG_ATTEMPT
    socketOtpWrongAttempt(state) {
      state.socketLive.wrongOtpAttempts += 1;
    },

    // ride_assigned (socket — after admin/TP assigns driver)
    socketRideAssigned(state, action) {
      // payload: { rideId, bookingId, status, driverSnapshot }
      state.socketLive.status         = action.payload.status;
      state.socketLive.driverSnapshot = action.payload.driverSnapshot ?? state.socketLive.driverSnapshot;
      if (state.currentRide?._id === action.payload.rideId) {
        state.currentRide.status = action.payload.status;
      }
    },

    // ── Manual resets ──────────────────────────────────────────────────────
    clearCurrentRide(state) {
      state.currentRide     = null;
      state.liveData        = null;
      state.trackingData    = null;
      state.nearbyResult    = null;
      state.createdRide     = null;
      state.socketLive      = initialState.socketLive;
    },

    clearCreatedRide(state) {
      state.createdRide = null;
    },

    clearNearby(state) {
      state.nearbyResult = null;
    },

    clearErrors(state) {
      state.errors = initialState.errors;
    },

    resetSocketLive(state) {
      state.socketLive = initialState.socketLive;
    },
  },

  extraReducers: (builder) => {

    // ── customerRequestRide ────────────────────────────────────────────────
    builder
      .addCase(customerRequestRide.pending, (state) => {
        state.loading.customerRequest = true;
        state.errors.customerRequest  = null;
      })
      .addCase(customerRequestRide.fulfilled, (state, action) => {
        state.loading.customerRequest = false;
        state.createdRide             = action.payload;
        toast.success('Ride requested. Waiting for driver assignment.');
      })
      .addCase(customerRequestRide.rejected, (state, action) => {
        state.loading.customerRequest = false;
        state.errors.customerRequest  = action.payload;
        toast.error(action.payload || 'Ride request failed');
      });

    // ── careAssistantRequestRide ───────────────────────────────────────────
    builder
      .addCase(careAssistantRequestRide.pending, (state) => {
        state.loading.careRequest = true;
        state.errors.careRequest  = null;
      })
      .addCase(careAssistantRequestRide.fulfilled, (state, action) => {
        state.loading.careRequest = false;
        state.createdRide         = action.payload;
        toast.success('Ride requested for patient.');
      })
      .addCase(careAssistantRequestRide.rejected, (state, action) => {
        state.loading.careRequest = false;
        state.errors.careRequest  = action.payload;
        toast.error(action.payload || 'Care assistant ride request failed');
      });

    // ── fetchRide ─────────────────────────────────────────────────────────
    builder
      .addCase(fetchRide.pending, (state) => {
        state.loading.fetchRide = true;
        state.errors.fetchRide  = null;
      })
      .addCase(fetchRide.fulfilled, (state, action) => {
        state.loading.fetchRide = false;
        state.currentRide       = action.payload;
        // Sync socket live status with fetched ride status
        state.socketLive.status = action.payload.status;
      })
      .addCase(fetchRide.rejected, (state, action) => {
        state.loading.fetchRide = false;
        state.errors.fetchRide  = action.payload;
        toast.error(action.payload || 'Could not fetch ride');
      });

    // ── fetchAdminAllRides ────────────────────────────────────────────────
    builder
      .addCase(fetchAdminAllRides.pending, (state) => {
        state.loading.adminAll = true;
        state.errors.adminAll  = null;
      })
      .addCase(fetchAdminAllRides.fulfilled, (state, action) => {
        state.loading.adminAll = false;
        state.adminRides       = action.payload.rides;
        state.adminTotal       = action.payload.total;
        state.adminPage        = action.payload.page;
        state.adminPages       = action.payload.pages;
      })
      .addCase(fetchAdminAllRides.rejected, (state, action) => {
        state.loading.adminAll = false;
        state.errors.adminAll  = action.payload;
        toast.error(action.payload || 'Could not fetch rides');
      });

    // ── fetchNearbyDrivers ────────────────────────────────────────────────
    builder
      .addCase(fetchNearbyDrivers.pending, (state) => {
        state.loading.nearby = true;
        state.errors.nearby  = null;
      })
      .addCase(fetchNearbyDrivers.fulfilled, (state, action) => {
        state.loading.nearby  = false;
        state.nearbyResult    = action.payload;
      })
      .addCase(fetchNearbyDrivers.rejected, (state, action) => {
        state.loading.nearby = false;
        state.errors.nearby  = action.payload;
        toast.error(action.payload || 'Nearby search failed');
      });

    // ── adminAssignRide ───────────────────────────────────────────────────
    builder
      .addCase(adminAssignRide.pending, (state) => {
        state.loading.adminAssign = true;
        state.errors.adminAssign  = null;
      })
      .addCase(adminAssignRide.fulfilled, (state, action) => {
        state.loading.adminAssign = false;
        // Remove assigned ride from admin list (no longer 'searching')
        state.adminRides = state.adminRides.filter(
          (r) => r._id !== action.payload.rideId
        );
        toast.success(
          action.payload.assignedTo === 'tp'
            ? 'Transport partner assigned. Waiting for driver.'
            : 'Solo driver assigned.'
        );
      })
      .addCase(adminAssignRide.rejected, (state, action) => {
        state.loading.adminAssign = false;
        state.errors.adminAssign  = action.payload;
        toast.error(action.payload || 'Assignment failed');
      });

    // ── tpAssignDriver ────────────────────────────────────────────────────
    builder
      .addCase(tpAssignDriver.pending, (state) => {
        state.loading.tpAssign = true;
        state.errors.tpAssign  = null;
      })
      .addCase(tpAssignDriver.fulfilled, (state, action) => {
        state.loading.tpAssign = false;
        if (state.currentRide?._id === action.payload.rideId) {
          state.currentRide.status = action.payload.status;
          state.socketLive.status  = action.payload.status;
        }
        toast.success('Driver assigned to ride.');
      })
      .addCase(tpAssignDriver.rejected, (state, action) => {
        state.loading.tpAssign = false;
        state.errors.tpAssign  = action.payload;
        toast.error(action.payload || 'Driver assignment failed');
      });

    // ── updateRideStatus ──────────────────────────────────────────────────
    builder
      .addCase(updateRideStatus.pending, (state) => {
        state.loading.statusUpdate = true;
        state.errors.statusUpdate  = null;
      })
      .addCase(updateRideStatus.fulfilled, (state, action) => {
        state.loading.statusUpdate = false;
        const newStatus = action.payload.status;
        if (state.currentRide?._id === action.payload.rideId) {
          state.currentRide.status = newStatus;
        }
        state.socketLive.status = newStatus;

        // Action-specific toasts
        const toastMap = {
          driver_accepted: 'Ride accepted.',
          driver_en_route: 'En route to pickup.',
          driver_arrived:  'Arrived at pickup. OTP sent to customer.',
          otp_verified:    'OTP verified.',
          in_progress:     'Ride started.',
          at_stop:         'Stopped.',
          completed:       'Ride completed.',
          cancelled:       'Ride cancelled.',
        };
        if (toastMap[newStatus]) toast.success(toastMap[newStatus]);
      })
      .addCase(updateRideStatus.rejected, (state, action) => {
        state.loading.statusUpdate = false;
        state.errors.statusUpdate  = action.payload;
        toast.error(action.payload || 'Status update failed');
      });

    // ── fetchRideLive ─────────────────────────────────────────────────────
    builder
      .addCase(fetchRideLive.pending, (state) => {
        state.loading.live = true;
        state.errors.live  = null;
      })
      .addCase(fetchRideLive.fulfilled, (state, action) => {
        state.loading.live = false;
        state.liveData     = action.payload;
        // Sync status
        state.socketLive.status    = action.payload.status;
        state.socketLive.etaMinutes = action.payload.currentEtaMinutes ?? state.socketLive.etaMinutes;
        state.socketLive.etaTarget  = action.payload.currentEtaTarget  ?? state.socketLive.etaTarget;
        state.socketLive.liveLocation = action.payload.liveLocation ?? state.socketLive.liveLocation;
      })
      .addCase(fetchRideLive.rejected, (state, action) => {
        state.loading.live = false;
        state.errors.live  = action.payload;
      });

    // ── fetchRideTracking ─────────────────────────────────────────────────
    builder
      .addCase(fetchRideTracking.pending, (state) => {
        state.loading.tracking = true;
        state.errors.tracking  = null;
      })
      .addCase(fetchRideTracking.fulfilled, (state, action) => {
        state.loading.tracking = false;
        state.trackingData     = action.payload;
        // Also hydrate currentRide from tracking snapshot
        if (action.payload.ride) {
          state.currentRide       = action.payload.ride;
          state.socketLive.status = action.payload.ride.status;
        }
      })
      .addCase(fetchRideTracking.rejected, (state, action) => {
        state.loading.tracking = false;
        state.errors.tracking  = action.payload;
        toast.error(action.payload || 'Could not load tracking data');
      });

    // ── postMilestone ─────────────────────────────────────────────────────
    builder
      .addCase(postMilestone.pending, (state) => {
        state.loading.milestone = true;
        state.errors.milestone  = null;
      })
      .addCase(postMilestone.fulfilled, (state, action) => {
        state.loading.milestone = false;
        // Append milestone to trackingData if loaded
        if (state.trackingData?.tracking?.milestones) {
          state.trackingData.tracking.milestones.push(action.payload.milestone);
        }
      })
      .addCase(postMilestone.rejected, (state, action) => {
        state.loading.milestone = false;
        state.errors.milestone  = action.payload;
        toast.error(action.payload || 'Milestone record failed');
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS (socket handlers + manual resets)
// ─────────────────────────────────────────────────────────────────────────────

export const {
  // Socket event actions — dispatch from SocketProvider listeners
  socketLocationUpdate,
  socketEtaUpdate,
  socketRideStatusChanged,
  socketDriverAccepted,
  socketDriverEnRoute,
  socketDriverArrived,
  socketOtpVerified,
  socketRideStarted,
  socketAtStop,
  socketRideCompleted,
  socketRideCancelled,
  socketNavigationTargetChanged,
  socketOtpResult,
  socketOtpWrongAttempt,
  socketRideAssigned,

  // Manual resets
  clearCurrentRide,
  clearCreatedRide,
  clearNearby,
  clearErrors,
  resetSocketLive,
} = rideRequestSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const selectCurrentRide        = (s) => s.rideRequest.currentRide;
export const selectCreatedRide        = (s) => s.rideRequest.createdRide;
export const selectLiveData           = (s) => s.rideRequest.liveData;
export const selectTrackingData       = (s) => s.rideRequest.trackingData;
export const selectAdminRides         = (s) => s.rideRequest.adminRides;
export const selectAdminPagination    = (s) => ({
  total: s.rideRequest.adminTotal,
  page:  s.rideRequest.adminPage,
  pages: s.rideRequest.adminPages,
});
export const selectNearbyResult       = (s) => s.rideRequest.nearbyResult;
export const selectSocketLive         = (s) => s.rideRequest.socketLive;
export const selectRideStatus         = (s) => s.rideRequest.socketLive.status;
export const selectLiveLocation       = (s) => s.rideRequest.socketLive.liveLocation;
export const selectNavigationTarget   = (s) => s.rideRequest.socketLive.navigationTarget;
export const selectEta                = (s) => ({
  minutes: s.rideRequest.socketLive.etaMinutes,
  target:  s.rideRequest.socketLive.etaTarget,
});
export const selectOtpResult          = (s) => s.rideRequest.socketLive.otpResult;
export const selectWrongOtpAttempts   = (s) => s.rideRequest.socketLive.wrongOtpAttempts;

export const selectRideLoading        = (s) => s.rideRequest.loading;
export const selectRideErrors         = (s) => s.rideRequest.errors;

// Per-operation loading shortcuts
export const selectStatusUpdating     = (s) => s.rideRequest.loading.statusUpdate;
export const selectTrackingLoading    = (s) => s.rideRequest.loading.tracking;
export const selectLiveLoading        = (s) => s.rideRequest.loading.live;
export const selectAdminAllLoading    = (s) => s.rideRequest.loading.adminAll;
export const selectNearbyLoading      = (s) => s.rideRequest.loading.nearby;
export const selectAdminAssignLoading = (s) => s.rideRequest.loading.adminAssign;
export const selectTpAssignLoading    = (s) => s.rideRequest.loading.tpAssign;

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET WIRING HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * wireRideSocketEvents — call inside SocketProvider or a component.
 *
 * Usage (inside SocketProvider or useEffect):
 *   const unsub = wireRideSocketEvents(on, SOCKET_EVENTS, dispatch);
 *   return unsub;
 *
 * @param {Function} on              — socketService.on
 * @param {object}   SOCKET_EVENTS   — from socketService.js
 * @param {Function} dispatch        — Redux dispatch
 * @returns {() => void}             — cleanup fn
 */
export function wireRideSocketEvents(on, SOCKET_EVENTS, dispatch) {
  const EV = SOCKET_EVENTS;

  const unsubs = [
    on(EV.LOCATION_UPDATE,           (d) => dispatch(socketLocationUpdate(d))),
    on(EV.ETA_UPDATE,                (d) => dispatch(socketEtaUpdate(d))),
    on(EV.RIDE_STATUS_CHANGED,       (d) => dispatch(socketRideStatusChanged(d))),
    on(EV.NAVIGATION_TARGET_CHANGED, (d) => dispatch(socketNavigationTargetChanged(d))),
    on(EV.OTP_RESULT,                (d) => dispatch(socketOtpResult(d))),
    on(EV.OTP_WRONG_ATTEMPT,         ()  => dispatch(socketOtpWrongAttempt())),

    // Fine-grained ride status events
    on('driver_accepted',  (d) => dispatch(socketDriverAccepted(d))),
    on('driver_en_route',  (d) => dispatch(socketDriverEnRoute(d))),
    on('driver_arrived',   (d) => dispatch(socketDriverArrived(d))),
    on('otp_verified',     (d) => dispatch(socketOtpVerified(d))),
    on('ride_started',     (d) => dispatch(socketRideStarted(d))),
    on('at_stop',          (d) => dispatch(socketAtStop(d))),
    on('ride_completed',   (d) => dispatch(socketRideCompleted(d))),
    on('ride_cancelled',   (d) => dispatch(socketRideCancelled(d))),
    on('ride_assigned',    (d) => dispatch(socketRideAssigned(d))),
  ];

  return () => unsubs.forEach((fn) => fn?.());
}

export default rideRequestSlice.reducer;