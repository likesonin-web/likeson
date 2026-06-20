import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const pending  = (state, key) => { state[key].loading = true;  state[key].error = null; };
const rejected = (state, key, action) => {
  state[key].loading = false;
  state[key].error   = action.payload;
};
const fulfilled = (state, key, action) => {
  state[key].loading = false;
  state[key].data    = action.payload;
  state[key].error   = null;
};

const buildSection = () => ({ loading: false, data: null, error: null });

const handleError = (err, thunkAPI) => {
  const msg = err?.response?.data?.message || err.message || 'Something went wrong';
  toast.error(msg);
  return thunkAPI.rejectWithValue(msg);
};

// ─────────────────────────────────────────────────────────────────────────────
// §1  OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

export const fetchOverview = createAsyncThunk(
  'adminAnalytics/fetchOverview',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/overview', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §2  BOOKING ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchBookings = createAsyncThunk(
  'adminAnalytics/fetchBookings',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/bookings', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §3  APPOINTMENT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAppointments = createAsyncThunk(
  'adminAnalytics/fetchAppointments',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/appointments', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

export const fetchAppointmentById = createAsyncThunk(
  'adminAnalytics/fetchAppointmentById',
  async (id, thunkAPI) => {
    try {
      const { data } = await API.get(`/admin/analytics/appointments/${id}`);
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §4  SPECIALTIES & DOCTOR ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchSpecialties = createAsyncThunk(
  'adminAnalytics/fetchSpecialties',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/specialties', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

export const fetchDoctors = createAsyncThunk(
  'adminAnalytics/fetchDoctors',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/doctors', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

export const fetchDoctorById = createAsyncThunk(
  'adminAnalytics/fetchDoctorById',
  async ({ id, params = {} }, thunkAPI) => {
    try {
      const { data } = await API.get(`/admin/analytics/doctors/${id}`, { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §5  BOOKING SCHEDULES
// ─────────────────────────────────────────────────────────────────────────────

export const fetchSchedules = createAsyncThunk(
  'adminAnalytics/fetchSchedules',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/schedules', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §6  DOCTOR–HOSPITAL AVAILABILITY
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAvailability = createAsyncThunk(
  'adminAnalytics/fetchAvailability',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/availability', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §7  REPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchReportBookings = createAsyncThunk(
  'adminAnalytics/fetchReportBookings',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/reports/bookings', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

export const fetchReportRevenue = createAsyncThunk(
  'adminAnalytics/fetchReportRevenue',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/reports/revenue', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

export const fetchReportUsers = createAsyncThunk(
  'adminAnalytics/fetchReportUsers',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/reports/users', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

export const fetchReportDoctors = createAsyncThunk(
  'adminAnalytics/fetchReportDoctors',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/reports/doctors', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §8  REFERRALS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchReferrals = createAsyncThunk(
  'adminAnalytics/fetchReferrals',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/referrals', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §9  REGIONAL
// ─────────────────────────────────────────────────────────────────────────────

export const fetchRegional = createAsyncThunk(
  'adminAnalytics/fetchRegional',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/regional');
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §10  FINANCE
// ─────────────────────────────────────────────────────────────────────────────

export const fetchFinance = createAsyncThunk(
  'adminAnalytics/fetchFinance',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/finance', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §11  USERS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchUsers = createAsyncThunk(
  'adminAnalytics/fetchUsers',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/users', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §12  SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchSubscriptions = createAsyncThunk(
  'adminAnalytics/fetchSubscriptions',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/subscriptions', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §13  TRANSPORT
// ─────────────────────────────────────────────────────────────────────────────

export const fetchTransport = createAsyncThunk(
  'adminAnalytics/fetchTransport',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/transport', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §14  PHARMACY
// ─────────────────────────────────────────────────────────────────────────────

export const fetchPharmacy = createAsyncThunk(
  'adminAnalytics/fetchPharmacy',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/pharmacy', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §15  LABS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchLabs = createAsyncThunk(
  'adminAnalytics/fetchLabs',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/labs', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §16  ADS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAds = createAsyncThunk(
  'adminAnalytics/fetchAds',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/ads', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §17  BLOOD BANK
// ─────────────────────────────────────────────────────────────────────────────

export const fetchBloodBank = createAsyncThunk(
  'adminAnalytics/fetchBloodBank',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/bloodbank', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §18  WALLET
// ─────────────────────────────────────────────────────────────────────────────

export const fetchWallet = createAsyncThunk(
  'adminAnalytics/fetchWallet',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/wallet', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §19  TOP EARNERS (THIS WEEK) — cross-platform leaderboard
// ─────────────────────────────────────────────────────────────────────────────

export const fetchTopEarners = createAsyncThunk(
  'adminAnalytics/fetchTopEarners',
  async (params = {}, thunkAPI) => {
    try {
      const { data } = await API.get('/admin/analytics/top-earners', { params });
      return data;
    } catch (err) { return handleError(err, thunkAPI); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────
const initialState = {
  // §1
  overview:           buildSection(),
  // §2
  bookings:           buildSection(),
  // §3
  appointments:       buildSection(),
  appointmentDetail:  buildSection(),
  // §4
  specialties:        buildSection(),
  doctors:            buildSection(),
  doctorDetail:       buildSection(),
  // §5
  schedules:          buildSection(),
  // §6
  availability:       buildSection(),
  // §7
  reportBookings:     buildSection(),
  reportRevenue:      buildSection(),
  reportUsers:        buildSection(),
  reportDoctors:      buildSection(),
  // §8
  referrals:          buildSection(),
  // §9
  regional:           buildSection(),
  // §10
  finance:            buildSection(),
  // §11
  users:              buildSection(),
  // §12
  subscriptions:      buildSection(),
  // §13
  transport:          buildSection(),
  // §14
  pharmacy:           buildSection(),
  // §15
  labs:               buildSection(),
  // §16
  ads:                buildSection(),
  // §17
  bloodBank:          buildSection(),
// §18
  wallet:             buildSection(),
  // §19
  topEarners:         buildSection(),
};

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const adminAnalyticsSlice = createSlice({
  name: 'adminAnalytics',
  initialState,

  reducers: {
    // Manual reset helpers — useful when unmounting a page
    resetOverview:          (state) => { state.overview          = buildSection(); },
    resetBookings:          (state) => { state.bookings          = buildSection(); },
    resetAppointments:      (state) => { state.appointments      = buildSection(); },
    resetAppointmentDetail: (state) => { state.appointmentDetail = buildSection(); },
    resetSpecialties:       (state) => { state.specialties       = buildSection(); },
    resetDoctors:           (state) => { state.doctors           = buildSection(); },
    resetDoctorDetail:      (state) => { state.doctorDetail      = buildSection(); },
    resetSchedules:         (state) => { state.schedules         = buildSection(); },
    resetAvailability:      (state) => { state.availability      = buildSection(); },
    resetReportBookings:    (state) => { state.reportBookings    = buildSection(); },
    resetReportRevenue:     (state) => { state.reportRevenue     = buildSection(); },
    resetReportUsers:       (state) => { state.reportUsers       = buildSection(); },
    resetReportDoctors:     (state) => { state.reportDoctors     = buildSection(); },
    resetReferrals:         (state) => { state.referrals         = buildSection(); },
    resetRegional:          (state) => { state.regional          = buildSection(); },
    resetFinance:           (state) => { state.finance           = buildSection(); },
    resetUsers:             (state) => { state.users             = buildSection(); },
    resetSubscriptions:     (state) => { state.subscriptions     = buildSection(); },
    resetTransport:         (state) => { state.transport         = buildSection(); },
    resetPharmacy:          (state) => { state.pharmacy          = buildSection(); },
    resetLabs:              (state) => { state.labs              = buildSection(); },
    resetAds:               (state) => { state.ads               = buildSection(); },
resetBloodBank:         (state) => { state.bloodBank         = buildSection(); },
    resetWallet:            (state) => { state.wallet            = buildSection(); },
    resetTopEarners:        (state) => { state.topEarners        = buildSection(); },
    resetAll:               ()      => initialState,
  },

  extraReducers: (builder) => {

    // ── §1 OVERVIEW ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchOverview.pending,   (s) => pending(s,  'overview'))
      .addCase(fetchOverview.rejected,  (s, a) => rejected(s, 'overview', a))
      .addCase(fetchOverview.fulfilled, (s, a) => fulfilled(s, 'overview', a));

    // ── §2 BOOKINGS ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchBookings.pending,   (s) => pending(s,  'bookings'))
      .addCase(fetchBookings.rejected,  (s, a) => rejected(s, 'bookings', a))
      .addCase(fetchBookings.fulfilled, (s, a) => fulfilled(s, 'bookings', a));

    // ── §3 APPOINTMENTS ───────────────────────────────────────────────────────
    builder
      .addCase(fetchAppointments.pending,   (s) => pending(s,  'appointments'))
      .addCase(fetchAppointments.rejected,  (s, a) => rejected(s, 'appointments', a))
      .addCase(fetchAppointments.fulfilled, (s, a) => fulfilled(s, 'appointments', a));

    builder
      .addCase(fetchAppointmentById.pending,   (s) => pending(s,  'appointmentDetail'))
      .addCase(fetchAppointmentById.rejected,  (s, a) => rejected(s, 'appointmentDetail', a))
      .addCase(fetchAppointmentById.fulfilled, (s, a) => fulfilled(s, 'appointmentDetail', a));

    // ── §4 SPECIALTIES & DOCTORS ──────────────────────────────────────────────
    builder
      .addCase(fetchSpecialties.pending,   (s) => pending(s,  'specialties'))
      .addCase(fetchSpecialties.rejected,  (s, a) => rejected(s, 'specialties', a))
      .addCase(fetchSpecialties.fulfilled, (s, a) => fulfilled(s, 'specialties', a));

    builder
      .addCase(fetchDoctors.pending,   (s) => pending(s,  'doctors'))
      .addCase(fetchDoctors.rejected,  (s, a) => rejected(s, 'doctors', a))
      .addCase(fetchDoctors.fulfilled, (s, a) => fulfilled(s, 'doctors', a));

    builder
      .addCase(fetchDoctorById.pending,   (s) => pending(s,  'doctorDetail'))
      .addCase(fetchDoctorById.rejected,  (s, a) => rejected(s, 'doctorDetail', a))
      .addCase(fetchDoctorById.fulfilled, (s, a) => fulfilled(s, 'doctorDetail', a));

    // ── §5 SCHEDULES ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchSchedules.pending,   (s) => pending(s,  'schedules'))
      .addCase(fetchSchedules.rejected,  (s, a) => rejected(s, 'schedules', a))
      .addCase(fetchSchedules.fulfilled, (s, a) => fulfilled(s, 'schedules', a));

    // ── §6 AVAILABILITY ───────────────────────────────────────────────────────
    builder
      .addCase(fetchAvailability.pending,   (s) => pending(s,  'availability'))
      .addCase(fetchAvailability.rejected,  (s, a) => rejected(s, 'availability', a))
      .addCase(fetchAvailability.fulfilled, (s, a) => fulfilled(s, 'availability', a));

    // ── §7 REPORTS ────────────────────────────────────────────────────────────
    builder
      .addCase(fetchReportBookings.pending,   (s) => pending(s,  'reportBookings'))
      .addCase(fetchReportBookings.rejected,  (s, a) => rejected(s, 'reportBookings', a))
      .addCase(fetchReportBookings.fulfilled, (s, a) => fulfilled(s, 'reportBookings', a));

    builder
      .addCase(fetchReportRevenue.pending,   (s) => pending(s,  'reportRevenue'))
      .addCase(fetchReportRevenue.rejected,  (s, a) => rejected(s, 'reportRevenue', a))
      .addCase(fetchReportRevenue.fulfilled, (s, a) => fulfilled(s, 'reportRevenue', a));

    builder
      .addCase(fetchReportUsers.pending,   (s) => pending(s,  'reportUsers'))
      .addCase(fetchReportUsers.rejected,  (s, a) => rejected(s, 'reportUsers', a))
      .addCase(fetchReportUsers.fulfilled, (s, a) => fulfilled(s, 'reportUsers', a));

    builder
      .addCase(fetchReportDoctors.pending,   (s) => pending(s,  'reportDoctors'))
      .addCase(fetchReportDoctors.rejected,  (s, a) => rejected(s, 'reportDoctors', a))
      .addCase(fetchReportDoctors.fulfilled, (s, a) => fulfilled(s, 'reportDoctors', a));

    // ── §8 REFERRALS ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchReferrals.pending,   (s) => pending(s,  'referrals'))
      .addCase(fetchReferrals.rejected,  (s, a) => rejected(s, 'referrals', a))
      .addCase(fetchReferrals.fulfilled, (s, a) => fulfilled(s, 'referrals', a));

    // ── §9 REGIONAL ───────────────────────────────────────────────────────────
    builder
      .addCase(fetchRegional.pending,   (s) => pending(s,  'regional'))
      .addCase(fetchRegional.rejected,  (s, a) => rejected(s, 'regional', a))
      .addCase(fetchRegional.fulfilled, (s, a) => fulfilled(s, 'regional', a));

    // ── §10 FINANCE ───────────────────────────────────────────────────────────
    builder
      .addCase(fetchFinance.pending,   (s) => pending(s,  'finance'))
      .addCase(fetchFinance.rejected,  (s, a) => rejected(s, 'finance', a))
      .addCase(fetchFinance.fulfilled, (s, a) => fulfilled(s, 'finance', a));

    // ── §11 USERS ─────────────────────────────────────────────────────────────
    builder
      .addCase(fetchUsers.pending,   (s) => pending(s,  'users'))
      .addCase(fetchUsers.rejected,  (s, a) => rejected(s, 'users', a))
      .addCase(fetchUsers.fulfilled, (s, a) => fulfilled(s, 'users', a));

    // ── §12 SUBSCRIPTIONS ─────────────────────────────────────────────────────
    builder
      .addCase(fetchSubscriptions.pending,   (s) => pending(s,  'subscriptions'))
      .addCase(fetchSubscriptions.rejected,  (s, a) => rejected(s, 'subscriptions', a))
      .addCase(fetchSubscriptions.fulfilled, (s, a) => fulfilled(s, 'subscriptions', a));

    // ── §13 TRANSPORT ─────────────────────────────────────────────────────────
    builder
      .addCase(fetchTransport.pending,   (s) => pending(s,  'transport'))
      .addCase(fetchTransport.rejected,  (s, a) => rejected(s, 'transport', a))
      .addCase(fetchTransport.fulfilled, (s, a) => fulfilled(s, 'transport', a));

    // ── §14 PHARMACY ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchPharmacy.pending,   (s) => pending(s,  'pharmacy'))
      .addCase(fetchPharmacy.rejected,  (s, a) => rejected(s, 'pharmacy', a))
      .addCase(fetchPharmacy.fulfilled, (s, a) => fulfilled(s, 'pharmacy', a));

    // ── §15 LABS ──────────────────────────────────────────────────────────────
    builder
      .addCase(fetchLabs.pending,   (s) => pending(s,  'labs'))
      .addCase(fetchLabs.rejected,  (s, a) => rejected(s, 'labs', a))
      .addCase(fetchLabs.fulfilled, (s, a) => fulfilled(s, 'labs', a));

    // ── §16 ADS ───────────────────────────────────────────────────────────────
    builder
      .addCase(fetchAds.pending,   (s) => pending(s,  'ads'))
      .addCase(fetchAds.rejected,  (s, a) => rejected(s, 'ads', a))
      .addCase(fetchAds.fulfilled, (s, a) => fulfilled(s, 'ads', a));

    // ── §17 BLOOD BANK ────────────────────────────────────────────────────────
    builder
      .addCase(fetchBloodBank.pending,   (s) => pending(s,  'bloodBank'))
      .addCase(fetchBloodBank.rejected,  (s, a) => rejected(s, 'bloodBank', a))
      .addCase(fetchBloodBank.fulfilled, (s, a) => fulfilled(s, 'bloodBank', a));

// ── §18 WALLET ────────────────────────────────────────────────────────────
    builder
      .addCase(fetchWallet.pending,   (s) => pending(s,  'wallet'))
      .addCase(fetchWallet.rejected,  (s, a) => rejected(s, 'wallet', a))
      .addCase(fetchWallet.fulfilled, (s, a) => fulfilled(s, 'wallet', a));

    // ── §19 TOP EARNERS ───────────────────────────────────────────────────────
    builder
      .addCase(fetchTopEarners.pending,   (s) => pending(s,  'topEarners'))
      .addCase(fetchTopEarners.rejected,  (s, a) => rejected(s, 'topEarners', a))
      .addCase(fetchTopEarners.fulfilled, (s, a) => fulfilled(s, 'topEarners', a));
  },
});

export const {
  resetOverview,
  resetBookings,
  resetAppointments,
  resetAppointmentDetail,
  resetSpecialties,
  resetDoctors,
  resetDoctorDetail,
  resetSchedules,
  resetAvailability,
  resetReportBookings,
  resetReportRevenue,
  resetReportUsers,
  resetReportDoctors,
  resetReferrals,
  resetRegional,
  resetFinance,
  resetUsers,
  resetSubscriptions,
  resetTransport,
  resetPharmacy,
  resetLabs,
  resetAds,
  resetBloodBank,
  resetWallet,
  resetTopEarners,
  resetAll,
} = adminAnalyticsSlice.actions;

export default adminAnalyticsSlice.reducer;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

const sel = (key) => (state) => state.adminAnalytics[key];

// §1 Overview
export const selectOverview        = sel('overview');
export const selectOverviewData    = (s) => s.adminAnalytics.overview.data;
export const selectOverviewLoading = (s) => s.adminAnalytics.overview.loading;
export const selectOverviewError   = (s) => s.adminAnalytics.overview.error;
// Quick sub-selectors
export const selectOverviewTrends  = (s) => s.adminAnalytics.overview.data?.trends;
export const selectOverviewTotals  = (s) => s.adminAnalytics.overview.data?.totals;
export const selectOverviewRevenue = (s) => s.adminAnalytics.overview.data?.revenue;
export const selectPendingKycDoctors = (s) => s.adminAnalytics.overview.data?.pendingKycDoctors;
export const selectActiveSubscriptions = (s) => s.adminAnalytics.overview.data?.activeSubscriptions;

// §2 Bookings
export const selectBookings        = sel('bookings');
export const selectBookingsData    = (s) => s.adminAnalytics.bookings.data;
export const selectBookingsLoading = (s) => s.adminAnalytics.bookings.loading;
export const selectBookingsError   = (s) => s.adminAnalytics.bookings.error;
export const selectBookingsSummary = (s) => s.adminAnalytics.bookings.data?.summary;
export const selectBookingsCharts  = (s) => s.adminAnalytics.bookings.data?.charts;
export const selectTopDoctors      = (s) => s.adminAnalytics.bookings.data?.topDoctors;
export const selectTopHospitals    = (s) => s.adminAnalytics.bookings.data?.topHospitals;
export const selectBookingsList    = (s) => s.adminAnalytics.bookings.data?.list;

// §3 Appointments
export const selectAppointments        = sel('appointments');
export const selectAppointmentsData    = (s) => s.adminAnalytics.appointments.data;
export const selectAppointmentsLoading = (s) => s.adminAnalytics.appointments.loading;
export const selectAppointmentsError   = (s) => s.adminAnalytics.appointments.error;
export const selectAppointmentsSummary = (s) => s.adminAnalytics.appointments.data?.summary;
export const selectAppointmentsList    = (s) => s.adminAnalytics.appointments.data?.list;

export const selectAppointmentDetail        = sel('appointmentDetail');
export const selectAppointmentDetailData    = (s) => s.adminAnalytics.appointmentDetail.data;
export const selectAppointmentDetailLoading = (s) => s.adminAnalytics.appointmentDetail.loading;
export const selectAppointmentDetailError   = (s) => s.adminAnalytics.appointmentDetail.error;
export const selectAppointmentDetailBooking = (s) => s.adminAnalytics.appointmentDetail.data?.booking;
export const selectAppointmentDetailOpRecord= (s) => s.adminAnalytics.appointmentDetail.data?.opRecord;

// §4 Specialties & Doctors
export const selectSpecialties        = sel('specialties');
export const selectSpecialtiesData    = (s) => s.adminAnalytics.specialties.data;
export const selectSpecialtiesLoading = (s) => s.adminAnalytics.specialties.loading;
export const selectSpecialtiesError   = (s) => s.adminAnalytics.specialties.error;
export const selectSpecialtiesList    = (s) => s.adminAnalytics.specialties.data?.specialties;
export const selectRatingDistribution = (s) => s.adminAnalytics.specialties.data?.ratingDistribution;

export const selectDoctors        = sel('doctors');
export const selectDoctorsData    = (s) => s.adminAnalytics.doctors.data;
export const selectDoctorsLoading = (s) => s.adminAnalytics.doctors.loading;
export const selectDoctorsError   = (s) => s.adminAnalytics.doctors.error;
export const selectDoctorsList    = (s) => s.adminAnalytics.doctors.data?.list;
export const selectDoctorsKycQueue = (s) => s.adminAnalytics.doctors.data?.kycQueue;

export const selectDoctorDetail        = sel('doctorDetail');
export const selectDoctorDetailData    = (s) => s.adminAnalytics.doctorDetail.data;
export const selectDoctorDetailLoading = (s) => s.adminAnalytics.doctorDetail.loading;
export const selectDoctorDetailError   = (s) => s.adminAnalytics.doctorDetail.error;
export const selectDoctorDetailProfile = (s) => s.adminAnalytics.doctorDetail.data?.doctor;
export const selectDoctorDetailStats   = (s) => s.adminAnalytics.doctorDetail.data?.bookingStats;
export const selectDoctorDetailRecent  = (s) => s.adminAnalytics.doctorDetail.data?.recentBookings;
export const selectDoctorDetailOpStats = (s) => s.adminAnalytics.doctorDetail.data?.opStats;

// §5 Schedules
export const selectSchedules           = sel('schedules');
export const selectSchedulesData       = (s) => s.adminAnalytics.schedules.data;
export const selectSchedulesLoading    = (s) => s.adminAnalytics.schedules.loading;
export const selectSchedulesError      = (s) => s.adminAnalytics.schedules.error;
export const selectHourlyDistribution  = (s) => s.adminAnalytics.schedules.data?.hourlyDistribution;
export const selectWeekdayDistribution = (s) => s.adminAnalytics.schedules.data?.weekdayDistribution;
export const selectMonthlyVolume       = (s) => s.adminAnalytics.schedules.data?.monthlyVolume;
export const selectSlotUtilisation     = (s) => s.adminAnalytics.schedules.data?.slotUtilisation;
export const selectUpcomingBusyDays    = (s) => s.adminAnalytics.schedules.data?.upcomingBusyDays;

// §6 Availability
export const selectAvailability        = sel('availability');
export const selectAvailabilityData    = (s) => s.adminAnalytics.availability.data;
export const selectAvailabilityLoading = (s) => s.adminAnalytics.availability.loading;
export const selectAvailabilityError   = (s) => s.adminAnalytics.availability.error;
export const selectAvailabilitySummary = (s) => s.adminAnalytics.availability.data?.summary;
export const selectAvailabilityDoctors = (s) => s.adminAnalytics.availability.data?.doctors;
export const selectAvailabilityHospitals = (s) => s.adminAnalytics.availability.data?.hospitals;
export const selectHospitalStats       = (s) => s.adminAnalytics.availability.data?.hospitalStats;

// §7 Reports
export const selectReportBookings        = sel('reportBookings');
export const selectReportBookingsData    = (s) => s.adminAnalytics.reportBookings.data;
export const selectReportBookingsLoading = (s) => s.adminAnalytics.reportBookings.loading;
export const selectReportBookingsError   = (s) => s.adminAnalytics.reportBookings.error;
export const selectReportBookingsFlat    = (s) => s.adminAnalytics.reportBookings.data?.data;

export const selectReportRevenue        = sel('reportRevenue');
export const selectReportRevenueData    = (s) => s.adminAnalytics.reportRevenue.data;
export const selectReportRevenueLoading = (s) => s.adminAnalytics.reportRevenue.loading;
export const selectReportRevenueError   = (s) => s.adminAnalytics.reportRevenue.error;
export const selectDailyRevenue         = (s) => s.adminAnalytics.reportRevenue.data?.dailyRevenue;
export const selectRevenueByType        = (s) => s.adminAnalytics.reportRevenue.data?.revenueByType;

export const selectReportUsers        = sel('reportUsers');
export const selectReportUsersData    = (s) => s.adminAnalytics.reportUsers.data;
export const selectReportUsersLoading = (s) => s.adminAnalytics.reportUsers.loading;
export const selectReportUsersError   = (s) => s.adminAnalytics.reportUsers.error;
export const selectReportUsersList    = (s) => s.adminAnalytics.reportUsers.data?.list;
export const selectReportUsersByRole  = (s) => s.adminAnalytics.reportUsers.data?.byRole;

export const selectReportDoctors        = sel('reportDoctors');
export const selectReportDoctorsData    = (s) => s.adminAnalytics.reportDoctors.data;
export const selectReportDoctorsLoading = (s) => s.adminAnalytics.reportDoctors.loading;
export const selectReportDoctorsError   = (s) => s.adminAnalytics.reportDoctors.error;
export const selectReportDoctorsFlat    = (s) => s.adminAnalytics.reportDoctors.data?.data;

// §8 Referrals
export const selectReferrals            = sel('referrals');
export const selectReferralsData        = (s) => s.adminAnalytics.referrals.data;
export const selectReferralsLoading     = (s) => s.adminAnalytics.referrals.loading;
export const selectReferralsError       = (s) => s.adminAnalytics.referrals.error;
export const selectReferralsSummary     = (s) => s.adminAnalytics.referrals.data?.summary;
export const selectTopReferrers         = (s) => s.adminAnalytics.referrals.data?.topReferrers;
export const selectDailyReferrals       = (s) => s.adminAnalytics.referrals.data?.dailyReferrals;
export const selectReferralsList        = (s) => s.adminAnalytics.referrals.data?.list;

// §9 Regional
export const selectRegional        = sel('regional');
export const selectRegionalData    = (s) => s.adminAnalytics.regional.data;
export const selectRegionalLoading = (s) => s.adminAnalytics.regional.loading;
export const selectRegionalError   = (s) => s.adminAnalytics.regional.error;
export const selectRegionalCities  = (s) => s.adminAnalytics.regional.data?.cities;
export const selectRegionalRaw     = (s) => s.adminAnalytics.regional.data?.raw;

// §10 Finance
export const selectFinance        = sel('finance');
export const selectFinanceData    = (s) => s.adminAnalytics.finance.data;
export const selectFinanceLoading = (s) => s.adminAnalytics.finance.loading;
export const selectFinanceError   = (s) => s.adminAnalytics.finance.error;
export const selectFinanceSummary = (s) => s.adminAnalytics.finance.data?.summary;
export const selectBookingRevenueByType = (s) => s.adminAnalytics.finance.data?.bookingRevenueByType;
export const selectPharmacyRevenueByMethod = (s) => s.adminAnalytics.finance.data?.pharmacyRevenueByPaymentMethod;
export const selectSubscriptionRevenue = (s) => s.adminAnalytics.finance.data?.subscriptionRevenue;
export const selectWalletSnapshot  = (s) => s.adminAnalytics.finance.data?.walletSnapshot;

// §11 Users
export const selectUsers        = sel('users');
export const selectUsersData    = (s) => s.adminAnalytics.users.data;
export const selectUsersLoading = (s) => s.adminAnalytics.users.loading;
export const selectUsersError   = (s) => s.adminAnalytics.users.error;
export const selectUsersSummary = (s) => s.adminAnalytics.users.data?.summary;
export const selectUsersGrowthChart = (s) => s.adminAnalytics.users.data?.growthChart;
export const selectUsersList    = (s) => s.adminAnalytics.users.data?.list;

// §12 Subscriptions
export const selectSubscriptions        = sel('subscriptions');
export const selectSubscriptionsData    = (s) => s.adminAnalytics.subscriptions.data;
export const selectSubscriptionsLoading = (s) => s.adminAnalytics.subscriptions.loading;
export const selectSubscriptionsError   = (s) => s.adminAnalytics.subscriptions.error;
export const selectSubscriptionPlans    = (s) => s.adminAnalytics.subscriptions.data?.plans;
export const selectSubscriptionsByTier  = (s) => s.adminAnalytics.subscriptions.data?.byTier;
export const selectSubscriptionsByStatus = (s) => s.adminAnalytics.subscriptions.data?.byStatus;
export const selectSubscriptionChurn    = (s) => s.adminAnalytics.subscriptions.data?.churn;
export const selectTrialConversion      = (s) => s.adminAnalytics.subscriptions.data?.trialConversion;
export const selectSubscriptionsList    = (s) => s.adminAnalytics.subscriptions.data?.list;

// §13 Transport
export const selectTransport        = sel('transport');
export const selectTransportData    = (s) => s.adminAnalytics.transport.data;
export const selectTransportLoading = (s) => s.adminAnalytics.transport.loading;
export const selectTransportError   = (s) => s.adminAnalytics.transport.error;
export const selectTransportSummary = (s) => s.adminAnalytics.transport.data?.summary;
export const selectAgencies         = (s) => s.adminAnalytics.transport.data?.agencies;
export const selectExpiringCompliance = (s) => s.adminAnalytics.transport.data?.summary?.expiringCompliance;

// §14 Pharmacy
export const selectPharmacy        = sel('pharmacy');
export const selectPharmacyData    = (s) => s.adminAnalytics.pharmacy.data;
export const selectPharmacyLoading = (s) => s.adminAnalytics.pharmacy.loading;
export const selectPharmacyError   = (s) => s.adminAnalytics.pharmacy.error;
export const selectPharmacySummary = (s) => s.adminAnalytics.pharmacy.data?.summary;
export const selectPharmacyByPaymentMethod = (s) => s.adminAnalytics.pharmacy.data?.byPaymentMethod;
export const selectPharmacyByDeliveryStatus = (s) => s.adminAnalytics.pharmacy.data?.byDeliveryStatus;
export const selectTopMedicines    = (s) => s.adminAnalytics.pharmacy.data?.topMedicines;
export const selectCategoryDistribution = (s) => s.adminAnalytics.pharmacy.data?.categoryDistribution;
export const selectPharmacyOrders  = (s) => s.adminAnalytics.pharmacy.data?.orders;

// §15 Labs
export const selectLabs        = sel('labs');
export const selectLabsData    = (s) => s.adminAnalytics.labs.data;
export const selectLabsLoading = (s) => s.adminAnalytics.labs.loading;
export const selectLabsError   = (s) => s.adminAnalytics.labs.error;
export const selectLabsSummary = (s) => s.adminAnalytics.labs.data?.summary;
export const selectLabsByStatus = (s) => s.adminAnalytics.labs.data?.byStatus;
export const selectLabsByType  = (s) => s.adminAnalytics.labs.data?.byType;
export const selectBookingsFromLabs = (s) => s.adminAnalytics.labs.data?.bookingsFromLabs;
export const selectTopLabsByRating = (s) => s.adminAnalytics.labs.data?.topLabsByRating;
export const selectLabsList    = (s) => s.adminAnalytics.labs.data?.list;

// §16 Ads
export const selectAds        = sel('ads');
export const selectAdsData    = (s) => s.adminAnalytics.ads.data;
export const selectAdsLoading = (s) => s.adminAnalytics.ads.loading;
export const selectAdsError   = (s) => s.adminAnalytics.ads.error;
export const selectAdsSummary = (s) => s.adminAnalytics.ads.data?.summary;
export const selectAdsByStatus = (s) => s.adminAnalytics.ads.data?.byStatus;
export const selectAdsByPlacement = (s) => s.adminAnalytics.ads.data?.byPlacement;
export const selectAdsByPricingModel = (s) => s.adminAnalytics.ads.data?.byPricingModel;
export const selectTopPerformingAds = (s) => s.adminAnalytics.ads.data?.topPerformers;
export const selectAdsList    = (s) => s.adminAnalytics.ads.data?.list;

// §17 Blood Bank
export const selectBloodBank        = sel('bloodBank');
export const selectBloodBankData    = (s) => s.adminAnalytics.bloodBank.data;
export const selectBloodBankLoading = (s) => s.adminAnalytics.bloodBank.loading;
export const selectBloodBankError   = (s) => s.adminAnalytics.bloodBank.error;
export const selectBloodBankSummary = (s) => s.adminAnalytics.bloodBank.data?.summary;
export const selectBloodBankByCity  = (s) => s.adminAnalytics.bloodBank.data?.byCity;
export const selectBloodGroupInventory = (s) => s.adminAnalytics.bloodBank.data?.bloodGroupInventory;
export const selectBloodRequestStats = (s) => s.adminAnalytics.bloodBank.data?.requestStats;
export const selectBloodBankList    = (s) => s.adminAnalytics.bloodBank.data?.list;

// §18 Wallet
export const selectWallet            = sel('wallet');
export const selectWalletData        = (s) => s.adminAnalytics.wallet.data;
export const selectWalletLoading     = (s) => s.adminAnalytics.wallet.loading;
export const selectWalletError       = (s) => s.adminAnalytics.wallet.error;
export const selectWalletPlatform    = (s) => s.adminAnalytics.wallet.data?.platform;
export const selectWalletByPurpose   = (s) => s.adminAnalytics.wallet.data?.byPurpose;
export const selectWithdrawalStats   = (s) => s.adminAnalytics.wallet.data?.withdrawalStats;
export const selectPendingWithdrawals = (s) => s.adminAnalytics.wallet.data?.pendingWithdrawals;
export const selectDailyTxnVolume    = (s) => s.adminAnalytics.wallet.data?.dailyTxnVolume;
export const selectTopWallets        = (s) => s.adminAnalytics.wallet.data?.topWallets;
export const selectWalletList        = (s) => s.adminAnalytics.wallet.data?.list;

// §19 Top Earners (This Week)
export const selectTopEarners            = sel('topEarners');
export const selectTopEarnersData        = (s) => s.adminAnalytics.topEarners.data;
export const selectTopEarnersLoading     = (s) => s.adminAnalytics.topEarners.loading;
export const selectTopEarnersError       = (s) => s.adminAnalytics.topEarners.error;
export const selectTopEarnersUnified     = (s) => s.adminAnalytics.topEarners.data?.topEarnersThisWeek;
export const selectTopEarnersByCategory  = (s) => s.adminAnalytics.topEarners.data?.byCategory;
export const selectTopEarnersDoctors     = (s) => s.adminAnalytics.topEarners.data?.byCategory?.doctors;
export const selectTopEarnersAgencyDrivers = (s) => s.adminAnalytics.topEarners.data?.byCategory?.agencyDrivers;
export const selectTopEarnersAgencies    = (s) => s.adminAnalytics.topEarners.data?.byCategory?.transportAgencies;
export const selectTopEarnersSoloDrivers = (s) => s.adminAnalytics.topEarners.data?.byCategory?.soloDrivers;
export const selectTopEarnersLabPartners = (s) => s.adminAnalytics.topEarners.data?.byCategory?.labPartners;
export const selectTopEarnersPharmacyStores = (s) => s.adminAnalytics.topEarners.data?.byCategory?.pharmacyStores;
export const selectTopEarnersLifetime    = (s) => s.adminAnalytics.topEarners.data?.lifetimeLeaderboards;