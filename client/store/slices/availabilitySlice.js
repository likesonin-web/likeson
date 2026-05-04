import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — DOCTOR
// ─────────────────────────────────────────────────────────────────────────────

export const fetchDoctorWeekly = createAsyncThunk(
  'availability/doctor/fetchWeekly',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/doctor/weekly');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

export const updateDoctorWeekly = createAsyncThunk(
  'availability/doctor/updateWeekly',
  async (weeklyAvailability, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/availability/doctor/weekly', { weeklyAvailability });
      toast.success('Weekly availability updated');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update weekly availability');
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { day: 'Monday', isAvailable?: boolean, slots?: [] } */
export const updateDoctorDay = createAsyncThunk(
  'availability/doctor/updateDay',
  async ({ day, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/availability/doctor/day/${day}`, body);
      toast.success(`${day} updated`);
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message ?? `Failed to update ${day}`);
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { days?: number } */
export const fetchDoctorSchedule = createAsyncThunk(
  'availability/doctor/fetchSchedule',
  async ({ days = 7 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/doctor/schedule', { params: { days } });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: 'YYYY-MM-DD' */
export const fetchDoctorScheduleByDate = createAsyncThunk(
  'availability/doctor/fetchScheduleByDate',
  async (date, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/availability/doctor/schedule/date/${date}`);
      return { date, bookings: data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { isOnline: boolean } */
export const toggleDoctorOnlineStatus = createAsyncThunk(
  'availability/doctor/toggleOnlineStatus',
  async ({ isOnline }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/availability/doctor/online-status', { isOnline });
      toast.success(isOnline ? 'You are now online' : 'You are now offline');
      return isOnline;
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update online status');
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — HOSPITAL
// ─────────────────────────────────────────────────────────────────────────────

export const fetchHospitalHours = createAsyncThunk(
  'availability/hospital/fetchHours',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/hospital/hours');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { is24x7?: boolean, operatingHours?: [] } */
export const updateHospitalHours = createAsyncThunk(
  'availability/hospital/updateHours',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/availability/hospital/hours', payload);
      toast.success('Operating hours updated');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update operating hours');
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { days?: number } */
export const fetchHospitalDoctorsSchedules = createAsyncThunk(
  'availability/hospital/fetchDoctorsSchedules',
  async ({ days = 7 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/hospital/doctors/schedules', { params: { days } });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: 'YYYY-MM-DD' */
export const fetchHospitalScheduleByDate = createAsyncThunk(
  'availability/hospital/fetchScheduleByDate',
  async (date, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/availability/hospital/schedule/date/${date}`);
      return { date, bookings: data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — CARE ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────

export const fetchCareAssistantWeekly = createAsyncThunk(
  'availability/careAssistant/fetchWeekly',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/care-assistant/weekly');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/**
 * payload: {
 *   weeklySchedule: {
 *     monday?: { isAvailable, startTime, endTime, maxHoursPerDay },
 *     ...
 *   }
 * }
 */
export const updateCareAssistantWeekly = createAsyncThunk(
  'availability/careAssistant/updateWeekly',
  async (weeklySchedule, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/availability/care-assistant/weekly', { weeklySchedule });
      toast.success('Schedule updated');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update schedule');
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { isOnline: boolean, status?: 'Available'|'Offline'|'On-Break' } */
export const toggleCareAssistantStatus = createAsyncThunk(
  'availability/careAssistant/toggleStatus',
  async ({ isOnline, status }, { rejectWithValue }) => {
    try {
      await API.patch('/availability/care-assistant/status', { isOnline, status });
      const newStatus = status ?? (isOnline ? 'Available' : 'Offline');
      toast.success(`Status → ${newStatus}`);
      return { isOnline, status: newStatus };
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update status');
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { days?: number } */
export const fetchCareAssistantTasks = createAsyncThunk(
  'availability/careAssistant/fetchTasks',
  async ({ days = 7 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/care-assistant/tasks', { params: { days } });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: 'YYYY-MM-DD' */
export const fetchCareAssistantTasksByDate = createAsyncThunk(
  'availability/careAssistant/fetchTasksByDate',
  async (date, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/availability/care-assistant/tasks/date/${date}`);
      return { date, bookings: data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — TRANSPORT PARTNER
// ─────────────────────────────────────────────────────────────────────────────

export const fetchTransportHours = createAsyncThunk(
  'availability/transport/fetchHours',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/transport/hours');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { isAvailable?: boolean, availabilityHours?: { start, end } } */
export const updateTransportHours = createAsyncThunk(
  'availability/transport/updateHours',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/availability/transport/hours', payload);
      toast.success('Availability updated');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update availability');
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

export const fetchTransportFleetStatus = createAsyncThunk(
  'availability/transport/fetchFleetStatus',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/transport/fleet/status');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { days?: number } */
export const fetchTransportRidesSchedule = createAsyncThunk(
  'availability/transport/fetchRidesSchedule',
  async ({ days = 7 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/transport/rides/schedule', { params: { days } });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: 'YYYY-MM-DD' */
export const fetchTransportRidesByDate = createAsyncThunk(
  'availability/transport/fetchRidesByDate',
  async (date, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/availability/transport/rides/date/${date}`);
      return { date, rides: data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS — SOLO DRIVER PARTNER
// ─────────────────────────────────────────────────────────────────────────────

export const fetchSoloHours = createAsyncThunk(
  'availability/solo/fetchHours',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/solo/hours');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { isAvailable?: boolean, availabilityHours?: { start, end } } */
export const updateSoloHours = createAsyncThunk(
  'availability/solo/updateHours',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/availability/solo/hours', payload);
      toast.success('Availability updated');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update availability');
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: { days?: number } */
export const fetchSoloRidesSchedule = createAsyncThunk(
  'availability/solo/fetchRidesSchedule',
  async ({ days = 7 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/availability/solo/rides/schedule', { params: { days } });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/** payload: 'YYYY-MM-DD' */
export const fetchSoloRidesByDate = createAsyncThunk(
  'availability/solo/fetchRidesByDate',
  async (date, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/availability/solo/rides/date/${date}`);
      return { date, rides: data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

/**
 * payload: [{ city, state, pinCodes?, radiusKm?, isActive? }]
 */
export const updateSoloServiceZones = createAsyncThunk(
  'availability/solo/updateServiceZones',
  async (serviceZones, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/availability/solo/service-zones', { serviceZones });
      toast.success('Service zones updated');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update service zones');
      return rejectWithValue(err.response?.data?.message ?? err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // ── Doctor ────────────────────────────────────────────────────────────────
  doctor: {
    weeklyAvailability:  [],
    schedule:            [],       // upcoming bookings
    scheduleByDate:      {},       // { 'YYYY-MM-DD': [...bookings] }
    isOnline:            false,
  },

  // ── Hospital ──────────────────────────────────────────────────────────────
  hospital: {
    hours:              null,      // { name, is24x7, operatingHours }
    doctorsSchedules:   [],        // grouped by doctor
    scheduleByDate:     {},        // { 'YYYY-MM-DD': [...bookings] }
  },

  // ── Care Assistant ────────────────────────────────────────────────────────
  careAssistant: {
    weeklySchedule:   null,        // { weeklySchedule, workType, availability, status }
    tasks:            [],          // upcoming bookings
    tasksByDate:      {},          // { 'YYYY-MM-DD': [...bookings] }
    isOnline:         false,
    status:           'Offline',
  },

  // ── Transport Partner ─────────────────────────────────────────────────────
  transport: {
    hours:          null,          // { businessName, isAvailable, availabilityHours, serviceZones }
    fleetStatus:    null,          // { businessName, fleetInfo, vehicleSummary }
    ridesSchedule:  [],            // upcoming rides
    ridesByDate:    {},            // { 'YYYY-MM-DD': [...rides] }
  },

  // ── Solo Driver Partner ───────────────────────────────────────────────────
  solo: {
    hours:          null,          // { isAvailable, availabilityHours, serviceZones, partnershipStatus }
    ridesSchedule:  [],            // upcoming rides
    ridesByDate:    {},            // { 'YYYY-MM-DD': [...rides] }
    serviceZones:   [],
  },

  // ── Shared ────────────────────────────────────────────────────────────────
  loading:  false,
  error:    null,
};

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const availabilitySlice = createSlice({
  name: 'availability',
  initialState,

  reducers: {
    clearAvailabilityError: (state) => { state.error = null; },

    // Optimistic doctor online toggle (before server confirms)
    setDoctorOnlineOptimistic: (state, { payload }) => {
      state.doctor.isOnline = payload;
    },

    // Optimistic care assistant status toggle
    setCareAssistantStatusOptimistic: (state, { payload: { isOnline, status } }) => {
      state.careAssistant.isOnline = isOnline;
      state.careAssistant.status   = status ?? (isOnline ? 'Available' : 'Offline');
    },

    // Reset a specific role's state
    resetDoctorAvailability:       (state) => { state.doctor       = initialState.doctor; },
    resetHospitalAvailability:     (state) => { state.hospital     = initialState.hospital; },
    resetCareAssistantAvailability:(state) => { state.careAssistant= initialState.careAssistant; },
    resetTransportAvailability:    (state) => { state.transport    = initialState.transport; },
    resetSoloAvailability:         (state) => { state.solo         = initialState.solo; },
  },

  extraReducers: (builder) => {

    // ── helper: set loading / error generically ──────────────────────────────
    const pending  = (state) => { state.loading = true;  state.error = null; };
    const rejected = (state, { payload }) => { state.loading = false; state.error = payload; };

    // ════════════════════════════════════════════════════════════════════════
    // DOCTOR
    // ════════════════════════════════════════════════════════════════════════

    builder
      // fetchDoctorWeekly
      .addCase(fetchDoctorWeekly.pending, pending)
      .addCase(fetchDoctorWeekly.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.doctor.weeklyAvailability = payload;
      })
      .addCase(fetchDoctorWeekly.rejected, rejected)

      // updateDoctorWeekly
      .addCase(updateDoctorWeekly.pending, pending)
      .addCase(updateDoctorWeekly.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.doctor.weeklyAvailability = payload;
      })
      .addCase(updateDoctorWeekly.rejected, rejected)

      // updateDoctorDay
      .addCase(updateDoctorDay.pending, pending)
      .addCase(updateDoctorDay.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.doctor.weeklyAvailability = payload;
      })
      .addCase(updateDoctorDay.rejected, rejected)

      // fetchDoctorSchedule
      .addCase(fetchDoctorSchedule.pending, pending)
      .addCase(fetchDoctorSchedule.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.doctor.schedule = payload;
      })
      .addCase(fetchDoctorSchedule.rejected, rejected)

      // fetchDoctorScheduleByDate
      .addCase(fetchDoctorScheduleByDate.pending, pending)
      .addCase(fetchDoctorScheduleByDate.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.doctor.scheduleByDate[payload.date] = payload.bookings;
      })
      .addCase(fetchDoctorScheduleByDate.rejected, rejected)

      // toggleDoctorOnlineStatus
      .addCase(toggleDoctorOnlineStatus.pending, pending)
      .addCase(toggleDoctorOnlineStatus.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.doctor.isOnline = payload;
      })
      .addCase(toggleDoctorOnlineStatus.rejected, rejected)

    // ════════════════════════════════════════════════════════════════════════
    // HOSPITAL
    // ════════════════════════════════════════════════════════════════════════

      // fetchHospitalHours
      .addCase(fetchHospitalHours.pending, pending)
      .addCase(fetchHospitalHours.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.hospital.hours = payload;
      })
      .addCase(fetchHospitalHours.rejected, rejected)

      // updateHospitalHours
      .addCase(updateHospitalHours.pending, pending)
      .addCase(updateHospitalHours.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (state.hospital.hours) {
          state.hospital.hours.operatingHours = payload.operatingHours;
          state.hospital.hours.is24x7         = payload.is24x7;
        } else {
          state.hospital.hours = payload;
        }
      })
      .addCase(updateHospitalHours.rejected, rejected)

      // fetchHospitalDoctorsSchedules
      .addCase(fetchHospitalDoctorsSchedules.pending, pending)
      .addCase(fetchHospitalDoctorsSchedules.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.hospital.doctorsSchedules = payload;
      })
      .addCase(fetchHospitalDoctorsSchedules.rejected, rejected)

      // fetchHospitalScheduleByDate
      .addCase(fetchHospitalScheduleByDate.pending, pending)
      .addCase(fetchHospitalScheduleByDate.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.hospital.scheduleByDate[payload.date] = payload.bookings;
      })
      .addCase(fetchHospitalScheduleByDate.rejected, rejected)

    // ════════════════════════════════════════════════════════════════════════
    // CARE ASSISTANT
    // ════════════════════════════════════════════════════════════════════════

      // fetchCareAssistantWeekly
      .addCase(fetchCareAssistantWeekly.pending, pending)
      .addCase(fetchCareAssistantWeekly.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.careAssistant.weeklySchedule = payload.weeklySchedule;
        state.careAssistant.isOnline       = payload.availability?.isOnline ?? false;
        state.careAssistant.status         = payload.status ?? 'Offline';
      })
      .addCase(fetchCareAssistantWeekly.rejected, rejected)

      // updateCareAssistantWeekly
      .addCase(updateCareAssistantWeekly.pending, pending)
      .addCase(updateCareAssistantWeekly.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.careAssistant.weeklySchedule = payload;
      })
      .addCase(updateCareAssistantWeekly.rejected, rejected)

      // toggleCareAssistantStatus
      .addCase(toggleCareAssistantStatus.pending, pending)
      .addCase(toggleCareAssistantStatus.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.careAssistant.isOnline = payload.isOnline;
        state.careAssistant.status   = payload.status;
      })
      .addCase(toggleCareAssistantStatus.rejected, rejected)

      // fetchCareAssistantTasks
      .addCase(fetchCareAssistantTasks.pending, pending)
      .addCase(fetchCareAssistantTasks.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.careAssistant.tasks = payload;
      })
      .addCase(fetchCareAssistantTasks.rejected, rejected)

      // fetchCareAssistantTasksByDate
      .addCase(fetchCareAssistantTasksByDate.pending, pending)
      .addCase(fetchCareAssistantTasksByDate.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.careAssistant.tasksByDate[payload.date] = payload.bookings;
      })
      .addCase(fetchCareAssistantTasksByDate.rejected, rejected)

    // ════════════════════════════════════════════════════════════════════════
    // TRANSPORT PARTNER
    // ════════════════════════════════════════════════════════════════════════

      // fetchTransportHours
      .addCase(fetchTransportHours.pending, pending)
      .addCase(fetchTransportHours.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.transport.hours = payload;
      })
      .addCase(fetchTransportHours.rejected, rejected)

      // updateTransportHours
      .addCase(updateTransportHours.pending, pending)
      .addCase(updateTransportHours.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.transport.hours = payload;
      })
      .addCase(updateTransportHours.rejected, rejected)

      // fetchTransportFleetStatus
      .addCase(fetchTransportFleetStatus.pending, pending)
      .addCase(fetchTransportFleetStatus.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.transport.fleetStatus = payload;
      })
      .addCase(fetchTransportFleetStatus.rejected, rejected)

      // fetchTransportRidesSchedule
      .addCase(fetchTransportRidesSchedule.pending, pending)
      .addCase(fetchTransportRidesSchedule.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.transport.ridesSchedule = payload;
      })
      .addCase(fetchTransportRidesSchedule.rejected, rejected)

      // fetchTransportRidesByDate
      .addCase(fetchTransportRidesByDate.pending, pending)
      .addCase(fetchTransportRidesByDate.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.transport.ridesByDate[payload.date] = payload.rides;
      })
      .addCase(fetchTransportRidesByDate.rejected, rejected)

    // ════════════════════════════════════════════════════════════════════════
    // SOLO DRIVER PARTNER
    // ════════════════════════════════════════════════════════════════════════

      // fetchSoloHours
      .addCase(fetchSoloHours.pending, pending)
      .addCase(fetchSoloHours.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.solo.hours        = payload;
        state.solo.serviceZones = payload.serviceZones ?? [];
      })
      .addCase(fetchSoloHours.rejected, rejected)

      // updateSoloHours
      .addCase(updateSoloHours.pending, pending)
      .addCase(updateSoloHours.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (state.solo.hours) {
          state.solo.hours.isAvailable       = payload.isAvailable;
          state.solo.hours.availabilityHours = payload.availabilityHours;
        } else {
          state.solo.hours = payload;
        }
      })
      .addCase(updateSoloHours.rejected, rejected)

      // fetchSoloRidesSchedule
      .addCase(fetchSoloRidesSchedule.pending, pending)
      .addCase(fetchSoloRidesSchedule.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.solo.ridesSchedule = payload;
      })
      .addCase(fetchSoloRidesSchedule.rejected, rejected)

      // fetchSoloRidesByDate
      .addCase(fetchSoloRidesByDate.pending, pending)
      .addCase(fetchSoloRidesByDate.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.solo.ridesByDate[payload.date] = payload.rides;
      })
      .addCase(fetchSoloRidesByDate.rejected, rejected)

      // updateSoloServiceZones
      .addCase(updateSoloServiceZones.pending, pending)
      .addCase(updateSoloServiceZones.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.solo.serviceZones = payload;
        if (state.solo.hours) state.solo.hours.serviceZones = payload;
      })
      .addCase(updateSoloServiceZones.rejected, rejected);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  clearAvailabilityError,
  setDoctorOnlineOptimistic,
  setCareAssistantStatusOptimistic,
  resetDoctorAvailability,
  resetHospitalAvailability,
  resetCareAssistantAvailability,
  resetTransportAvailability,
  resetSoloAvailability,
} = availabilitySlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const selectAvailabilityLoading = (s) => s.availability.loading;
export const selectAvailabilityError   = (s) => s.availability.error;

// Doctor
export const selectDoctorWeeklyAvailability  = (s) => s.availability.doctor.weeklyAvailability;
export const selectDoctorSchedule            = (s) => s.availability.doctor.schedule;
export const selectDoctorScheduleByDate      = (date) => (s) => s.availability.doctor.scheduleByDate[date] ?? [];
export const selectDoctorIsOnline            = (s) => s.availability.doctor.isOnline;

// Hospital
export const selectHospitalHours             = (s) => s.availability.hospital.hours;
export const selectHospitalDoctorsSchedules  = (s) => s.availability.hospital.doctorsSchedules;
export const selectHospitalScheduleByDate    = (date) => (s) => s.availability.hospital.scheduleByDate[date] ?? [];

// Care Assistant
export const selectCareAssistantWeekly       = (s) => s.availability.careAssistant.weeklySchedule;
export const selectCareAssistantTasks        = (s) => s.availability.careAssistant.tasks;
export const selectCareAssistantTasksByDate  = (date) => (s) => s.availability.careAssistant.tasksByDate[date] ?? [];
export const selectCareAssistantIsOnline     = (s) => s.availability.careAssistant.isOnline;
export const selectCareAssistantStatus       = (s) => s.availability.careAssistant.status;

// Transport
export const selectTransportHours            = (s) => s.availability.transport.hours;
export const selectTransportFleetStatus      = (s) => s.availability.transport.fleetStatus;
export const selectTransportRidesSchedule    = (s) => s.availability.transport.ridesSchedule;
export const selectTransportRidesByDate      = (date) => (s) => s.availability.transport.ridesByDate[date] ?? [];

// Solo
export const selectSoloHours                 = (s) => s.availability.solo.hours;
export const selectSoloRidesSchedule         = (s) => s.availability.solo.ridesSchedule;
export const selectSoloRidesByDate           = (date) => (s) => s.availability.solo.ridesByDate[date] ?? [];
export const selectSoloServiceZones          = (s) => s.availability.solo.serviceZones;

export default availabilitySlice.reducer;