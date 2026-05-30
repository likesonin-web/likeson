import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api'; // Assumes pre-configured Axios instance (e.g., baseURL and auth headers)
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════════════════════
// ASYNC THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

// 1. GET / — List Bookings (paginated + filtered)
export const fetchBookings = createAsyncThunk(
  'labPartnerBookings/fetchBookings',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await API.get('/lab-partner/bookings', { params });
      return response.data.data; // { bookings, pagination }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch bookings';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// 2. GET /:bookingId — Booking Detail
export const fetchBookingDetails = createAsyncThunk(
  'labPartnerBookings/fetchBookingDetails',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await API.get(`/lab-partner/bookings/${bookingId}`);
      return response.data.data.booking;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch booking details';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// 3. PATCH /:bookingId/accept — Confirm the booking
export const acceptBooking = createAsyncThunk(
  'labPartnerBookings/acceptBooking',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await API.patch(`/lab-partner/bookings/${bookingId}/accept`);
      toast.success(response.data.message);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to accept booking';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// 4. PATCH /:bookingId/assign-technician
export const assignTechnician = createAsyncThunk(
  'labPartnerBookings/assignTechnician',
  async ({ bookingId, technicianName }, { rejectWithValue }) => {
    try {
      const response = await API.patch(`/lab-partner/bookings/${bookingId}/assign-technician`, {
        technicianName,
      });
      toast.success(response.data.message);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to assign technician';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// 5. PATCH /:bookingId/collect-sample
export const collectSample = createAsyncThunk(
  'labPartnerBookings/collectSample',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await API.patch(`/lab-partner/bookings/${bookingId}/collect-sample`);
      toast.success(response.data.message);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to mark sample as collected';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// 6. POST /:bookingId/upload-report — S3 upload (Multipart form-data)
export const uploadReport = createAsyncThunk(
  'labPartnerBookings/uploadReport',
  async ({ bookingId, file }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('report', file);

      const response = await API.post(`/lab-partner/bookings/${bookingId}/upload-report`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(response.data.message);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to upload report';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// 7. POST /:bookingId/dispatch-report — Multi-channel delivery routing
export const dispatchReport = createAsyncThunk(
  'labPartnerBookings/dispatchReport',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await API.post(`/lab-partner/bookings/${bookingId}/dispatch-report`);
      toast.success(response.data.message);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to dispatch report';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// 8. PATCH /:bookingId/complete — Mark booking complete
export const completeBooking = createAsyncThunk(
  'labPartnerBookings/completeBooking',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await API.patch(`/lab-partner/bookings/${bookingId}/complete`);
      toast.success(response.data.message);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to complete booking';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// BONUS 1. GET /reports/all — All completed reports for the lab
export const fetchReportsArchive = createAsyncThunk(
  'labPartnerBookings/fetchReportsArchive',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await API.get('/lab-partner/bookings/reports/all', { params });
      return response.data.data; // { reports, pagination }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch reports archive';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// BONUS 2. GET /reports/:bookingId/download — Trigger native browser download
export const downloadReport = createAsyncThunk(
  'labPartnerBookings/downloadReport',
  async (bookingId, { rejectWithValue }) => {
    try {
      // Expect blob to handle binary data from PDF
      const response = await API.get(`/lab-partner/bookings/reports/${bookingId}/download`, {
        responseType: 'blob', 
      });
      
      // Create a temporary link to trigger the download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from Content-Disposition header if possible, else fallback
      const contentDisposition = response.headers['content-disposition'];
      let filename = `report-${bookingId}.pdf`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Download started');
      return true;
    } catch (error) {
      const message = 'Failed to download report';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// BONUS 3. POST /reports/:bookingId/send — Re-send report to customer
export const resendReport = createAsyncThunk(
  'labPartnerBookings/resendReport',
  async ({ bookingId, channels }, { rejectWithValue }) => {
    try {
      const response = await API.post(`/lab-partner/bookings/reports/${bookingId}/send`, { channels });
      toast.success(response.data.message);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to resend report';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// BONUS 4. GET /stats/summary — Lab Dashboard Stats
export const fetchDashboardStats = createAsyncThunk(
  'labPartnerBookings/fetchDashboardStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('/lab-partner/bookings/stats/summary');
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch dashboard statistics';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// BONUS 5. PATCH /:bookingId/reject — Reject a pending booking
export const rejectBooking = createAsyncThunk(
  'labPartnerBookings/rejectBooking',
  async ({ bookingId, reason }, { rejectWithValue }) => {
    try {
      const response = await API.patch(`/lab-partner/bookings/${bookingId}/reject`, { reason });
      toast.success(response.data.message);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to reject booking';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);


// ═══════════════════════════════════════════════════════════════════════════════
// SLICE DEFINITION
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // Main Bookings List
  bookings: [],
  pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  isLoadingList: false,
  
  // Single Booking Detail
  currentBooking: null,
  isLoadingDetails: false,
  
  // Reports Archive
  reports: [],
  reportsPagination: { page: 1, limit: 20, total: 0, pages: 0 },
  isLoadingReports: false,
  
  // Dashboard Stats
  dashboardStats: null,
  isLoadingStats: false,
  
  // Action Loading States (buttons, form submissions)
  isActionLoading: false, 
  
  // Errors
  error: null,
};

const labPartnerBookingSlice = createSlice({
  name: 'labPartnerBookings',
  initialState,
  reducers: {
    clearCurrentBooking: (state) => {
      state.currentBooking = null;
    },
    clearErrors: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── Fetch Bookings ──────────────────────────────────────────────────────
      .addCase(fetchBookings.pending, (state) => {
        state.isLoadingList = true;
        state.error = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.isLoadingList = false;
        state.bookings = action.payload.bookings;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.isLoadingList = false;
        state.error = action.payload;
      })

      // ── Fetch Booking Details ───────────────────────────────────────────────
      .addCase(fetchBookingDetails.pending, (state) => {
        state.isLoadingDetails = true;
        state.error = null;
      })
      .addCase(fetchBookingDetails.fulfilled, (state, action) => {
        state.isLoadingDetails = false;
        state.currentBooking = action.payload;
      })
      .addCase(fetchBookingDetails.rejected, (state, action) => {
        state.isLoadingDetails = false;
        state.error = action.payload;
      })

      // ── Fetch Reports Archive ───────────────────────────────────────────────
      .addCase(fetchReportsArchive.pending, (state) => {
        state.isLoadingReports = true;
        state.error = null;
      })
      .addCase(fetchReportsArchive.fulfilled, (state, action) => {
        state.isLoadingReports = false;
        state.reports = action.payload.reports;
        state.reportsPagination = action.payload.pagination;
      })
      .addCase(fetchReportsArchive.rejected, (state, action) => {
        state.isLoadingReports = false;
        state.error = action.payload;
      })

      // ── Fetch Dashboard Stats ───────────────────────────────────────────────
      .addCase(fetchDashboardStats.pending, (state) => {
        state.isLoadingStats = true;
        state.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.isLoadingStats = false;
        state.dashboardStats = action.payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.isLoadingStats = false;
        state.error = action.payload;
      })

      // Handle 'resendReport' explicitly BEFORE the addMatchers
      .addCase(resendReport.fulfilled, (state) => {
        state.isActionLoading = false;
      })

      // ── Action Loading Managers ─────────────────────────────────────────────
      // Manage standard UI loading spiners for mutating actions
      .addMatcher(
        (action) =>
          [
            acceptBooking.pending.type,
            assignTechnician.pending.type,
            collectSample.pending.type,
            uploadReport.pending.type,
            dispatchReport.pending.type,
            completeBooking.pending.type,
            resendReport.pending.type,
            rejectBooking.pending.type,
          ].includes(action.type),
        (state) => {
          state.isActionLoading = true;
          state.error = null;
        }
      )
      .addMatcher(
        (action) =>
          [
            acceptBooking.rejected.type,
            assignTechnician.rejected.type,
            collectSample.rejected.type,
            uploadReport.rejected.type,
            dispatchReport.rejected.type,
            completeBooking.rejected.type,
            resendReport.rejected.type,
            rejectBooking.rejected.type,
          ].includes(action.type),
        (state, action) => {
          state.isActionLoading = false;
          state.error = action.payload;
        }
      )
      
      // ── Mutating Success Handlers (Optimistic Updates) ──────────────────────
      .addMatcher(
        (action) =>
          [
            acceptBooking.fulfilled.type,
            assignTechnician.fulfilled.type,
            collectSample.fulfilled.type,
            uploadReport.fulfilled.type,
            dispatchReport.fulfilled.type,
            completeBooking.fulfilled.type,
            rejectBooking.fulfilled.type,
          ].includes(action.type),
        (state, action) => {
          state.isActionLoading = false;
          
          // Update the current booking detail if we are viewing it
          if (state.currentBooking && state.currentBooking.bookingCode === action.payload.bookingCode) {
            state.currentBooking = {
              ...state.currentBooking,
              ...action.payload, 
              // Handles top-level overwrites (like status).
              // For nested like diagnosticDetails, we merge carefully
              diagnosticDetails: {
                ...state.currentBooking.diagnosticDetails,
                ...(action.payload.technicianName && { technicianName: action.payload.technicianName }),
                ...(action.payload.reportUrl && { reportUrl: action.payload.reportUrl }),
                ...(action.payload.sampleCollectedAt && { sampleCollectedAt: action.payload.sampleCollectedAt }),
                ...(action.payload.reportReadyAt && { reportReadyAt: action.payload.reportReadyAt }),
              }
            };
          }

          // Update the specific item in the list view so UI doesn't need refresh
          const index = state.bookings.findIndex(b => b.bookingCode === action.payload.bookingCode);
          if (index !== -1) {
            state.bookings[index] = {
              ...state.bookings[index],
              ...action.payload,
              diagnosticDetails: {
                ...state.bookings[index].diagnosticDetails,
                ...(action.payload.technicianName && { technicianName: action.payload.technicianName }),
                ...(action.payload.reportUrl && { reportUrl: action.payload.reportUrl }),
                ...(action.payload.sampleCollectedAt && { sampleCollectedAt: action.payload.sampleCollectedAt }),
                ...(action.payload.reportReadyAt && { reportReadyAt: action.payload.reportReadyAt }),
              }
            };
          }
        }
      );
  },
});

export const { clearCurrentBooking, clearErrors } = labPartnerBookingSlice.actions;

export default labPartnerBookingSlice.reducer;

const selectLabState = (state) => state.labPartnerBookings;

// ═══════════════════════════════════════════════════════════════════════════════
// BASIC SELECTORS (Direct State Access)
// ═══════════════════════════════════════════════════════════════════════════════

export const selectAllBookings = (state) => selectLabState(state).bookings;
export const selectBookingsPagination = (state) => selectLabState(state).pagination;
export const selectIsLoadingList = (state) => selectLabState(state).isLoadingList;

export const selectCurrentBooking = (state) => selectLabState(state).currentBooking;
export const selectIsLoadingDetails = (state) => selectLabState(state).isLoadingDetails;

export const selectReportsArchive = (state) => selectLabState(state).reports;
export const selectReportsPagination = (state) => selectLabState(state).reportsPagination;
export const selectIsLoadingReports = (state) => selectLabState(state).isLoadingReports;

export const selectDashboardStats = (state) => selectLabState(state).dashboardStats;
export const selectIsLoadingStats = (state) => selectLabState(state).isLoadingStats;

export const selectIsActionLoading = (state) => selectLabState(state).isActionLoading;
export const selectLabError = (state) => selectLabState(state).error;