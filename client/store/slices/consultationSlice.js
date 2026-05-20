import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
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
 * Fetch join details (VideoSDK token + room details)
 * GET /consultations/:bookingId/join
 * Returns: { roomId, meetingId, meetingLink, token, role, allowedDurationMinutes }
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
 * PATCH /consultations/:bookingId/consent
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
 * POST /consultations/:bookingId/start
 * Returns: { status }
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
 * POST /consultations/:bookingId/end
 * Returns: { status, completedAt, durationMinutes }
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
      return response.data.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to end consultation';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Cancel Consultation
 * POST /consultations/:bookingId/cancel
 * Returns: { status, refundAmount }
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
      return response.data.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to cancel consultation';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Upload Prescription
 * POST /consultations/:bookingId/prescription
 * Returns: { prescriptionUrl }
 */
export const uploadPrescription = createAsyncThunk(
  'consultation/uploadPrescription',
  async ({ bookingId, prescriptionUrl }, { rejectWithValue }) => {
    try {
      const response = await API.post(`/consultations/${bookingId}/prescription`, { prescriptionUrl });
      toast.success('Prescription uploaded successfully');
      return response.data.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to upload prescription';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * Rate Consultation
 * POST /consultations/:bookingId/rate
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
 * GET /consultations/:bookingId/follow-up-eligibility
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
 * Log Network Quality — silent background task
 * POST /consultations/:bookingId/network-quality
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

// ── Admin Thunks ──────────────────────────────────────────────────────────────

/**
 * Fetch Admin Notes
 * GET /consultations/:bookingId/admin-notes
 */
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

/**
 * Add Admin Note
 * POST /consultations/:bookingId/admin-notes
 */
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
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // Data
  list:                [],
  pagination:          { total: 0, page: 1, limit: 20, totalPages: 0 },
  current:             null,
  pricing:             null,
  joinDetails:         null,
  followUpEligibility: null,
  adminNotesData:      null,

  // Loading states
  isFetchingList:      false,
  isFetchingCurrent:   false,
  isFetchingPricing:   false,
  isFetchingJoin:      false,
  isActionLoading:     false,
  isAdminActionLoading: false,

  // Error states
  listError:     null,
  currentError:  null,
  pricingError:  null,
  joinError:     null,
  actionError:   null,
  adminError:    null,
};

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const consultationSlice = createSlice({
  name: 'consultation',
  initialState,

  reducers: {
    clearCurrentConsultation: (state) => {
      state.current            = null;
      state.currentError       = null;
      state.joinDetails        = null;
      state.followUpEligibility = null;
      state.adminNotesData     = null;
    },
    clearJoinDetails: (state) => {
      state.joinDetails    = null;
      state.joinError      = null;
      state.isFetchingJoin = false;
    },
    clearPricing: (state) => {
      state.pricing      = null;
      state.pricingError = null;
    },
    clearErrors: (state) => {
      state.listError    = null;
      state.currentError = null;
      state.pricingError = null;
      state.joinError    = null;
      state.actionError  = null;
      state.adminError   = null;
    },
    resetConsultationState: () => initialState,
  },

  extraReducers: (builder) => {
    builder

      // ── 1. Fetch List ──────────────────────────────────────────────────────
      .addCase(fetchConsultations.pending, (state) => {
        state.isFetchingList = true;
        state.listError      = null;
      })
      .addCase(fetchConsultations.fulfilled, (state, action) => {
        state.isFetchingList = false;
        state.list           = action.payload.bookings;
        state.pagination     = action.payload.pagination;
      })
      .addCase(fetchConsultations.rejected, (state, action) => {
        state.isFetchingList = false;
        state.listError      = action.payload;
      })

      // ── 2. Fetch Current ───────────────────────────────────────────────────
      .addCase(fetchConsultationById.pending, (state) => {
        state.isFetchingCurrent = true;
        state.currentError      = null;
      })
      .addCase(fetchConsultationById.fulfilled, (state, action) => {
        state.isFetchingCurrent = false;
        state.current           = action.payload;
      })
      .addCase(fetchConsultationById.rejected, (state, action) => {
        state.isFetchingCurrent = false;
        state.currentError      = action.payload;
      })

      // ── 3. Fetch Pricing ───────────────────────────────────────────────────
      .addCase(fetchConsultationPricing.pending, (state) => {
        state.isFetchingPricing = true;
        state.pricingError      = null;
      })
      .addCase(fetchConsultationPricing.fulfilled, (state, action) => {
        state.isFetchingPricing = false;
        state.pricing           = action.payload;
      })
      .addCase(fetchConsultationPricing.rejected, (state, action) => {
        state.isFetchingPricing = false;
        state.pricingError      = action.payload;
      })

      // ── 4. Fetch Join Details ──────────────────────────────────────────────
      .addCase(fetchJoinDetails.pending, (state) => {
        state.isFetchingJoin = true;
        state.joinError      = null;
        state.joinDetails    = null;
      })
      .addCase(fetchJoinDetails.fulfilled, (state, action) => {
        state.isFetchingJoin = false;
        state.joinDetails    = action.payload;
      })
      .addCase(fetchJoinDetails.rejected, (state, action) => {
        state.isFetchingJoin = false;
        state.joinError      = action.payload;
      })

      // ── 5. Follow-Up Eligibility ───────────────────────────────────────────
      .addCase(checkFollowUpEligibility.pending, (state) => {
        state.followUpEligibility = null;
      })
      .addCase(checkFollowUpEligibility.fulfilled, (state, action) => {
        state.followUpEligibility = action.payload;
      })
      .addCase(checkFollowUpEligibility.rejected, (state) => {
        state.followUpEligibility = null;
      })

      // ── 6. Accept Consent (fulfilled only — pending/rejected via matcher) ──
      .addCase(acceptTelemedicineConsent.fulfilled, (state) => {
        state.isActionLoading = false;
        if (state.current?.onlineConsultation) {
          state.current.onlineConsultation.isTelemedicineConsentAccepted = true;
        }
      })

      // ── 7. Start Consultation ──────────────────────────────────────────────
      .addCase(startConsultation.fulfilled, (state, action) => {
        state.isActionLoading = false;
        if (state.current) {
          state.current.status = action.payload?.status ?? 'in_progress';
          if (state.current.onlineConsultation) {
            state.current.onlineConsultation.consultationStatus = 'live';
          }
        }
      })

      // ── 8. End Consultation ────────────────────────────────────────────────
      .addCase(endConsultation.fulfilled, (state, action) => {
        state.isActionLoading = false;
        if (state.current) {
          state.current.status       = action.payload?.status      ?? 'completed';
          state.current.completedAt  = action.payload?.completedAt ?? new Date().toISOString();
          if (state.current.onlineConsultation) {
            state.current.onlineConsultation.consultationStatus = 'completed';
            state.current.onlineConsultation.durationMinutes    =
              action.payload?.durationMinutes ?? 0;
          }
        }
      })

      // ── 9. Cancel Consultation ─────────────────────────────────────────────
      .addCase(cancelConsultation.fulfilled, (state, action) => {
        state.isActionLoading = false;
        if (state.current) {
          state.current.status = action.payload?.status ?? 'cancelled';
          if (state.current.fareBreakdown) {
            state.current.fareBreakdown.refundAmount =
              action.payload?.refundAmount ?? 0;
          }
          if (state.current.onlineConsultation) {
            state.current.onlineConsultation.consultationStatus = 'cancelled';
          }
        }
        // Also update in list if present
        const idx = state.list.findIndex(
          (b) => b._id === action.meta.arg.bookingId
        );
        if (idx !== -1) state.list[idx].status = action.payload?.status ?? 'cancelled';
      })

      // ── 10. Upload Prescription ────────────────────────────────────────────
      .addCase(uploadPrescription.fulfilled, (state, action) => {
        state.isActionLoading = false;
        if (state.current) {
          if (state.current.onlineConsultation) {
            state.current.onlineConsultation.prescriptionUploaded   = true;
            state.current.onlineConsultation.prescriptionUrl        =
              action.payload?.prescriptionUrl;
            state.current.onlineConsultation.prescriptionUploadedAt =
              new Date().toISOString();
          }
          if (state.current.outPatientRecord) {
            state.current.outPatientRecord.prescriptionUrl =
              action.payload?.prescriptionUrl;
          }
        }
      })

      // ── 11. Rate Consultation ──────────────────────────────────────────────
      .addCase(rateConsultation.fulfilled, (state) => {
        state.isActionLoading = false;
        if (state.current) {
          state.current.isRated = true;
        }
      })

      // ── 12. Log Network Quality ────────────────────────────────────────────
      // Silent — no state change needed, just clears loading
      .addCase(logNetworkQuality.fulfilled, (state) => {
        // no-op — background task
      })

      // ── 13. Admin Notes — Fetch ────────────────────────────────────────────
      .addCase(fetchAdminNotes.pending, (state) => {
        state.isAdminActionLoading = true;
        state.adminError           = null;
      })
      .addCase(fetchAdminNotes.fulfilled, (state, action) => {
        state.isAdminActionLoading = false;
        state.adminNotesData       = action.payload;
      })
      .addCase(fetchAdminNotes.rejected, (state, action) => {
        state.isAdminActionLoading = false;
        state.adminError           = action.payload;
      })

      // ── 14. Admin Notes — Add ──────────────────────────────────────────────
      .addCase(addAdminNote.pending, (state) => {
        state.isAdminActionLoading = true;
        state.adminError           = null;
      })
      .addCase(addAdminNote.fulfilled, (state, action) => {
        state.isAdminActionLoading = false;
        // FIX: removed hardcoded 'Current User' — server is source of truth.
        // Optimistically push what we know from the request args; refetch
        // fetchAdminNotes for accurate author/role data.
        if (state.adminNotesData?.notes) {
          state.adminNotesData.notes.push({
            timestamp:     new Date().toISOString(),
            role:          null,
            author:        null,
            transactionId: action.meta.arg.transactionId ?? null,
            note:          action.meta.arg.note,
          });
        }
      })
      .addCase(addAdminNote.rejected, (state, action) => {
        state.isAdminActionLoading = false;
        state.adminError           = action.payload;
      })

      // ── 15. MATCHERS — pending / rejected for mutation actions ─────────────
      // FIX: use .type string (e.g. 'consultation/start/pending') NOT the
      // action creator object itself. Previous code compared strings to
      // objects which always returned false — matchers never fired.
      .addMatcher(
        (action) =>
          [
            acceptTelemedicineConsent.pending.type,
            startConsultation.pending.type,
            endConsultation.pending.type,
            cancelConsultation.pending.type,
            uploadPrescription.pending.type,
            rateConsultation.pending.type,
          ].includes(action.type),
        (state) => {
          state.isActionLoading = true;
          state.actionError     = null;
        }
      )
      .addMatcher(
        (action) =>
          [
            acceptTelemedicineConsent.rejected.type,
            startConsultation.rejected.type,
            endConsultation.rejected.type,
            cancelConsultation.rejected.type,
            uploadPrescription.rejected.type,
            rateConsultation.rejected.type,
          ].includes(action.type),
        (state, action) => {
          state.isActionLoading = false;
          state.actionError     = action.payload;
        }
      );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  clearCurrentConsultation,
  clearJoinDetails,
  clearPricing,
  clearErrors,
  resetConsultationState,
} = consultationSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const selectConsultationList       = (state) => state.consultation.list;
export const selectConsultationPagination = (state) => state.consultation.pagination;
export const selectCurrentConsultation    = (state) => state.consultation.current;
export const selectConsultationPricing    = (state) => state.consultation.pricing;
export const selectJoinDetails            = (state) => state.consultation.joinDetails;
export const selectFollowUpEligibility    = (state) => state.consultation.followUpEligibility;
export const selectAdminNotesData         = (state) => state.consultation.adminNotesData;

export const selectConsultationLoaders = (state) => ({
  isFetchingList:      state.consultation.isFetchingList,
  isFetchingCurrent:   state.consultation.isFetchingCurrent,
  isFetchingPricing:   state.consultation.isFetchingPricing,
  isFetchingJoin:      state.consultation.isFetchingJoin,
  isActionLoading:     state.consultation.isActionLoading,
  isAdminActionLoading: state.consultation.isAdminActionLoading,
});

export const selectConsultationErrors = (state) => ({
  listError:    state.consultation.listError,
  currentError: state.consultation.currentError,
  pricingError: state.consultation.pricingError,
  joinError:    state.consultation.joinError,
  actionError:  state.consultation.actionError,
  adminError:   state.consultation.adminError,
});

export const selectJoinError    = (state) => state.consultation.joinError;
export const selectActionError  = (state) => state.consultation.actionError;
export const selectIsJoinLoading = (state) => state.consultation.isFetchingJoin;

export default consultationSlice.reducer;