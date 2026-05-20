import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a paginated list of consultations
 */
export const fetchConsultations = createAsyncThunk(
  'consultation/fetchList',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await API.get('/consultations', { params });
      return response.data.data; // { bookings, pagination }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to fetch consultations';
      return rejectWithValue(message);
    }
  }
);

/**
 * Fetch a single consultation by ID
 */
export const fetchConsultationById = createAsyncThunk(
  'consultation/fetchById',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await API.get(`/consultations/${bookingId}`);
      return response.data.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to fetch consultation details';
      return rejectWithValue(message);
    }
  }
);

/**
 * Fetch consultation pricing breakdown
 */
export const fetchConsultationPricing = createAsyncThunk(
  'consultation/fetchPricing',
  async ({ doctorProfileId, consultationType }, { rejectWithValue }) => {
    try {
      const response = await API.get('/consultations/pricing', {
        params: { doctorProfileId, consultationType },
      });
      return response.data.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to fetch pricing';
      return rejectWithValue(message);
    }
  }
);

/**
 * Fetch join details (Video SDK token, room details)
 */
export const fetchJoinDetails = createAsyncThunk(
  'consultation/fetchJoinDetails',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await API.get(`/consultations/${bookingId}/join`);
      return response.data.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to get join details';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Accept Telemedicine Consent
 */
export const acceptTelemedicineConsent = createAsyncThunk(
  'consultation/acceptConsent',
  async ({ bookingId, ipAddress }, { rejectWithValue }) => {
    try {
      const response = await API.patch(`/consultations/${bookingId}/consent`, {
        accepted: true,
        ipAddress,
      });
      toast.success('Consent accepted successfully');
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to accept consent';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Start Consultation
 */
export const startConsultation = createAsyncThunk(
  'consultation/start',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await API.post(`/consultations/${bookingId}/start`);
      toast.success('Consultation started');
      return response.data.data; // { status }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to start consultation';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * End Consultation
 */
export const endConsultation = createAsyncThunk(
  'consultation/end',
  async ({ bookingId, reason, consultationSummary, followUpInstructions }, { rejectWithValue }) => {
    try {
      const response = await API.post(`/consultations/${bookingId}/end`, {
        reason,
        consultationSummary,
        followUpInstructions,
      });
      toast.success('Consultation ended successfully');
      return response.data.data; // { status, completedAt, durationMinutes }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to end consultation';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Cancel Consultation
 */
export const cancelConsultation = createAsyncThunk(
  'consultation/cancel',
  async ({ bookingId, reason, refundEligible, refundPercent }, { rejectWithValue }) => {
    try {
      const response = await API.post(`/consultations/${bookingId}/cancel`, {
        reason,
        refundEligible,
        refundPercent,
      });
      toast.success('Consultation cancelled');
      return response.data.data; // { status, refundAmount }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to cancel consultation';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Upload Prescription
 */
export const uploadPrescription = createAsyncThunk(
  'consultation/uploadPrescription',
  async ({ bookingId, prescriptionUrl }, { rejectWithValue }) => {
    try {
      const response = await API.post(`/consultations/${bookingId}/prescription`, { prescriptionUrl });
      toast.success('Prescription uploaded successfully');
      return response.data.data; // { prescriptionUrl }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to upload prescription';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Rate Consultation
 */
export const rateConsultation = createAsyncThunk(
  'consultation/rate',
  async ({ bookingId, doctorRating, doctorComment, overallRating, overallComment }, { rejectWithValue }) => {
    try {
      const response = await API.post(`/consultations/${bookingId}/rate`, {
        doctorRating,
        doctorComment,
        overallRating,
        overallComment,
      });
      toast.success('Thank you for your feedback');
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to submit rating';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Check Follow-Up Eligibility
 */
export const checkFollowUpEligibility = createAsyncThunk(
  'consultation/checkFollowUp',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await API.get(`/consultations/${bookingId}/follow-up-eligibility`);
      return response.data.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to check follow-up eligibility';
      return rejectWithValue(message);
    }
  }
);

/**
 * Log Network Quality (Silent background task)
 */
export const logNetworkQuality = createAsyncThunk(
  'consultation/logNetworkQuality',
  async ({ bookingId, participant, quality }, { rejectWithValue }) => {
    try {
      await API.post(`/consultations/${bookingId}/network-quality`, { participant, quality });
      return { participant, quality };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ── Admin Thunks ─────────────────────────────────────────────────────────────

export const fetchAdminNotes = createAsyncThunk(
  'consultation/fetchAdminNotes',
  async (bookingId, { rejectWithValue }) => {
    try {
      const response = await API.get(`/consultations/${bookingId}/admin-notes`);
      return response.data.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to fetch admin notes';
      return rejectWithValue(message);
    }
  }
);

export const addAdminNote = createAsyncThunk(
  'consultation/addAdminNote',
  async ({ bookingId, note, sendEmail, transactionId }, { rejectWithValue }) => {
    try {
      const response = await API.post(`/consultations/${bookingId}/admin-notes`, {
        note,
        sendEmail,
        transactionId,
      });
      toast.success('Admin note added');
      return response.data.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to add admin note';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // Data
  list: [],
  pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
  current: null,
  pricing: null,
  joinDetails: null,
  followUpEligibility: null,
  adminNotesData: null,

  // Loading States
  isFetchingList: false,
  isFetchingCurrent: false,
  isFetchingPricing: false,
  isFetchingJoin: false,
  isActionLoading: false, 
  isAdminActionLoading: false,

  // Error States
  listError: null,
  currentError: null,
  pricingError: null,
  joinError: null,
  actionError: null,
  adminError: null,
};

const consultationSlice = createSlice({
  name: 'consultation',
  initialState,
  reducers: {
    clearCurrentConsultation: (state) => {
      state.current = null;
      state.currentError = null;
      state.joinDetails = null;
      state.followUpEligibility = null;
      state.adminNotesData = null;
    },
    clearPricing: (state) => {
      state.pricing = null;
      state.pricingError = null;
    },
    clearErrors: (state) => {
      state.listError = null;
      state.currentError = null;
      state.pricingError = null;
      state.joinError = null;
      state.actionError = null;
      state.adminError = null;
    },
    resetConsultationState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // ── 1. Fetch List ──────────────────────────────────────────────────────
      .addCase(fetchConsultations.pending, (state) => {
        state.isFetchingList = true;
        state.listError = null;
      })
      .addCase(fetchConsultations.fulfilled, (state, action) => {
        state.isFetchingList = false;
        state.list = action.payload.bookings;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchConsultations.rejected, (state, action) => {
        state.isFetchingList = false;
        state.listError = action.payload;
      })

      // ── 2. Fetch Current ───────────────────────────────────────────────────
      .addCase(fetchConsultationById.pending, (state) => {
        state.isFetchingCurrent = true;
        state.currentError = null;
      })
      .addCase(fetchConsultationById.fulfilled, (state, action) => {
        state.isFetchingCurrent = false;
        state.current = action.payload;
      })
      .addCase(fetchConsultationById.rejected, (state, action) => {
        state.isFetchingCurrent = false;
        state.currentError = action.payload;
      })

      // ── 3. Fetch Pricing ───────────────────────────────────────────────────
      .addCase(fetchConsultationPricing.pending, (state) => {
        state.isFetchingPricing = true;
        state.pricingError = null;
      })
      .addCase(fetchConsultationPricing.fulfilled, (state, action) => {
        state.isFetchingPricing = false;
        state.pricing = action.payload;
      })
      .addCase(fetchConsultationPricing.rejected, (state, action) => {
        state.isFetchingPricing = false;
        state.pricingError = action.payload;
      })

      // ── 4. Fetch Join Details ──────────────────────────────────────────────
      .addCase(fetchJoinDetails.pending, (state) => {
        state.isFetchingJoin = true;
        state.joinError = null;
      })
      .addCase(fetchJoinDetails.fulfilled, (state, action) => {
        state.isFetchingJoin = false;
        state.joinDetails = action.payload;
      })
      .addCase(fetchJoinDetails.rejected, (state, action) => {
        state.isFetchingJoin = false;
        state.joinError = action.payload;
      })

      // ── 5. Follow-Up Eligibility ───────────────────────────────────────────
      .addCase(checkFollowUpEligibility.fulfilled, (state, action) => {
        state.followUpEligibility = action.payload;
      })

      // ── 6. Specific Mutation Fulfilled Logic ───────────────────────────────
      .addCase(acceptTelemedicineConsent.fulfilled, (state) => {
        state.isActionLoading = false;
        if (state.current && state.current.onlineConsultation) {
          state.current.onlineConsultation.isTelemedicineConsentAccepted = true;
        }
      })
      .addCase(startConsultation.fulfilled, (state, action) => {
        state.isActionLoading = false;
        if (state.current) {
          state.current.status = action.payload.status;
          if (state.current.onlineConsultation) {
            state.current.onlineConsultation.consultationStatus = 'live';
          }
        }
      })
      .addCase(endConsultation.fulfilled, (state, action) => {
        state.isActionLoading = false;
        if (state.current) {
          state.current.status = action.payload.status;
          state.current.completedAt = action.payload.completedAt;
          if (state.current.onlineConsultation) {
            state.current.onlineConsultation.consultationStatus = 'completed';
          }
        }
      })
      .addCase(cancelConsultation.fulfilled, (state, action) => {
        state.isActionLoading = false;
        if (state.current) {
          state.current.status = action.payload.status;
          if (state.current.fareBreakdown) {
            state.current.fareBreakdown.refundAmount = action.payload.refundAmount;
          }
        }
      })
      .addCase(uploadPrescription.fulfilled, (state, action) => {
        state.isActionLoading = false;
        if (state.current) {
          if (state.current.onlineConsultation) {
            state.current.onlineConsultation.prescriptionUploaded = true;
            state.current.onlineConsultation.prescriptionUrl = action.payload.prescriptionUrl;
          }
          if (state.current.outPatientRecord) {
            state.current.outPatientRecord.prescriptionUrl = action.payload.prescriptionUrl;
          }
        }
      })
      .addCase(rateConsultation.fulfilled, (state) => {
        state.isActionLoading = false;
        if (state.current) {
          state.current.isRated = true;
        }
      })

      // ── 7. Admin Notes ─────────────────────────────────────────────────────
      .addCase(fetchAdminNotes.pending, (state) => {
        state.isAdminActionLoading = true;
        state.adminError = null;
      })
      .addCase(fetchAdminNotes.fulfilled, (state, action) => {
        state.isAdminActionLoading = false;
        state.adminNotesData = action.payload;
      })
      .addCase(fetchAdminNotes.rejected, (state, action) => {
        state.isAdminActionLoading = false;
        state.adminError = action.payload;
      })
      .addCase(addAdminNote.pending, (state) => {
        state.isAdminActionLoading = true;
        state.adminError = null;
      })
      .addCase(addAdminNote.fulfilled, (state, action) => {
        state.isAdminActionLoading = false;
        if (state.adminNotesData && state.adminNotesData.notes) {
          const timestamp = new Date().toISOString();
          state.adminNotesData.notes.push({
            timestamp,
            role: 'Current User', 
            author: 'You',
            transactionId: action.meta.arg.transactionId || null,
            note: action.meta.arg.note,
          });
        }
      })
      .addCase(addAdminNote.rejected, (state, action) => {
        state.isAdminActionLoading = false;
        state.adminError = action.payload;
      })

      // ── 8. MATCHERS (Must be at the very end of extraReducers) ─────────────
      .addMatcher(
        (action) =>
          [
            acceptTelemedicineConsent.pending,
            startConsultation.pending,
            endConsultation.pending,
            cancelConsultation.pending,
            uploadPrescription.pending,
            rateConsultation.pending,
          ].includes(action.type),
        (state) => {
          state.isActionLoading = true;
          state.actionError = null;
        }
      )
      .addMatcher(
        (action) =>
          [
            acceptTelemedicineConsent.rejected,
            startConsultation.rejected,
            endConsultation.rejected,
            cancelConsultation.rejected,
            uploadPrescription.rejected,
            rateConsultation.rejected,
          ].includes(action.type),
        (state, action) => {
          state.isActionLoading = false;
          state.actionError = action.payload;
        }
      );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS & SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  clearCurrentConsultation,
  clearPricing,
  clearErrors,
  resetConsultationState,
} = consultationSlice.actions;

export const selectConsultationList = (state) => state.consultation.list;
export const selectConsultationPagination = (state) => state.consultation.pagination;
export const selectCurrentConsultation = (state) => state.consultation.current;
export const selectConsultationPricing = (state) => state.consultation.pricing;
export const selectJoinDetails = (state) => state.consultation.joinDetails;
export const selectFollowUpEligibility = (state) => state.consultation.followUpEligibility;
export const selectAdminNotesData = (state) => state.consultation.adminNotesData;

export const selectConsultationLoaders = (state) => ({
  isFetchingList: state.consultation.isFetchingList,
  isFetchingCurrent: state.consultation.isFetchingCurrent,
  isFetchingPricing: state.consultation.isFetchingPricing,
  isFetchingJoin: state.consultation.isFetchingJoin,
  isActionLoading: state.consultation.isActionLoading,
  isAdminActionLoading: state.consultation.isAdminActionLoading,
});

export const selectConsultationErrors = (state) => ({
  listError: state.consultation.listError,
  currentError: state.consultation.currentError,
  pricingError: state.consultation.pricingError,
  joinError: state.consultation.joinError,
  actionError: state.consultation.actionError,
  adminError: state.consultation.adminError,
});

export default consultationSlice.reducer;