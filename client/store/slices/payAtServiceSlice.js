import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast                              from 'react-hot-toast';
import API                                from '../api';

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate Razorpay Payment Link + QR
 * Role: partner (driver / CA / doctor / hospital / lab / admin)
 * POST /api/bookings/:bookingId/pay-at-service/generate-link
 */
export const generatePayAtServiceLink = createAsyncThunk(
  'payAtService/generateLink',
  async ({ bookingId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/bookings/${bookingId}/pay-at-service/generate-link`
      );
      return { bookingId: String(bookingId), ...data.data };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to generate payment link'
      );
    }
  }
);

/**
 * Poll payment status — partner screen polls every few seconds
 * GET /api/bookings/:bookingId/pay-at-service/status
 */
export const fetchPayAtServiceStatus = createAsyncThunk(
  'payAtService/fetchStatus',
  async ({ bookingId }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/bookings/${bookingId}/pay-at-service/status`
      );
      return { bookingId: String(bookingId), ...data.data };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to fetch payment status'
      );
    }
  }
);

/**
 * Mark manual/cash collection (fallback when QR fails)
 * POST /api/bookings/:bookingId/pay-at-service/mark-collected
 * Body: { amount, method, note? }
 */
export const markCollectedByPartner = createAsyncThunk(
  'payAtService/markCollected',
  async ({ bookingId, amount, method = 'cash', note }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/bookings/${bookingId}/pay-at-service/mark-collected`,
        { amount, method, note }
      );
      return { bookingId: String(bookingId), ...data.data };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to record collection'
      );
    }
  }
);

/**
 * Mark service complete — only after payment confirmed
 * POST /api/bookings/:bookingId/pay-at-service/complete
 */
export const markServiceComplete = createAsyncThunk(
  'payAtService/markComplete',
  async ({ bookingId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/bookings/${bookingId}/pay-at-service/complete`
      );
      return { bookingId: String(bookingId), ...data.data };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to mark service complete'
      );
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // keyed by bookingId so multiple bookings work simultaneously
  // sessions[bookingId] = { shortUrl, amount, expiresAt, paid, ... }
  sessions: {},

  // loading flags per action
  loading: {
    generateLink:    false,
    fetchStatus:     false,
    markCollected:   false,
    markComplete:    false,
  },

  // last error
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const payAtServiceSlice = createSlice({
  name: 'payAtService',
  initialState,

  reducers: {
    /**
     * Socket event: pay_at_service_link_generated
     * Call this from your socket listener to sync state without API poll
     */
    linkGeneratedFromSocket(state, action) {
      const { bookingId, shortUrl, amount, expiresAt } = action.payload;
      state.sessions[bookingId] = {
        ...state.sessions[bookingId],
        shortUrl,
        amount,
        expiresAt,
        paid:           false,
        canMarkComplete: false,
        generatedAt:    new Date().toISOString(),
      };
    },

    /**
     * Socket event: pay_at_service_paid
     * Call when socket fires — marks paid immediately, no poll needed
     */
    paidFromSocket(state, action) {
      const { bookingId, amount, paidAt, canMarkComplete } = action.payload;
      if (state.sessions[bookingId]) {
        state.sessions[bookingId].paid            = true;
        state.sessions[bookingId].paidAt          = paidAt;
        state.sessions[bookingId].canMarkComplete = canMarkComplete ?? true;
        state.sessions[bookingId].paymentStatus   = 'pay_at_service_paid';
      }
    },

    /**
     * Socket event: booking_status_change (completed)
     */
    serviceCompletedFromSocket(state, action) {
      const { bookingId, completedAt } = action.payload;
      if (state.sessions[bookingId]) {
        state.sessions[bookingId].serviceCompleted = true;
        state.sessions[bookingId].bookingStatus    = 'completed';
        if (completedAt) {
          state.sessions[bookingId].completedAt = completedAt;
        }
      }
    },

    /**
     * Clear session for a booking (on unmount / navigate away)
     */
    clearSession(state, action) {
      const { bookingId } = action.payload;
      delete state.sessions[bookingId];
    },

    clearError(state) {
      state.error = null;
    },
  },

  extraReducers: (builder) => {

    // ── generatePayAtServiceLink ────────────────────────────────────────────
    builder
      .addCase(generatePayAtServiceLink.pending, (state) => {
        state.loading.generateLink = true;
        state.error = null;
      })
    .addCase(generatePayAtServiceLink.fulfilled, (state, action) => {
  state.loading.generateLink = false;
  const { bookingId, shortUrl, qrCodeDataUrl, amount, expiresAt, alreadySent } = action.payload;

  state.sessions[bookingId] = {
    ...state.sessions[bookingId],
    shortUrl,
    qrCodeDataUrl,
    amount,
    expiresAt,
    paid:            false,
    canMarkComplete: false,
    paymentStatus:   'pay_at_service_pending',
    generatedAt:     new Date().toISOString(),
  };

  toast.success(
    alreadySent
      ? 'Active link retrieved — show QR to customer'
      : 'QR link generated — show to customer'
  );
})
      .addCase(generatePayAtServiceLink.rejected, (state, action) => {
        state.loading.generateLink = false;
        state.error = action.payload;
        toast.error(action.payload ?? 'Could not generate link');
      });

    // ── fetchPayAtServiceStatus ─────────────────────────────────────────────
    builder
      .addCase(fetchPayAtServiceStatus.pending, (state) => {
        state.loading.fetchStatus = true;
      })
      .addCase(fetchPayAtServiceStatus.fulfilled, (state, action) => {
        state.loading.fetchStatus = false;
        const {
          bookingId, paid, paymentStatus, amount,
          shortUrl, expiresAt, expired, paidAt,
          paidByCustomer, razorpayStatus, canMarkComplete,
          canRegenerateLink,
        } = action.payload;

        const prev = state.sessions[bookingId] ?? {};

        state.sessions[bookingId] = {
          ...prev,
          paid,
          paymentStatus,
          amount,
          shortUrl:          shortUrl  ?? prev.shortUrl,
          expiresAt:         expiresAt ?? prev.expiresAt,
          expired,
          paidAt,
          paidByCustomer,
          razorpayStatus,
          canMarkComplete,
          canRegenerateLink,
        };

        // Toast only on transition to paid
        if (paid && !prev.paid) {
          toast.success('Payment received! You can now mark service complete.');
        }
      })
      .addCase(fetchPayAtServiceStatus.rejected, (state, action) => {
        state.loading.fetchStatus = false;
        // silent — poll errors don't toast spam
        state.error = action.payload;
      });

    // ── markCollectedByPartner ──────────────────────────────────────────────
    builder
      .addCase(markCollectedByPartner.pending, (state) => {
        state.loading.markCollected = true;
        state.error = null;
      })
      .addCase(markCollectedByPartner.fulfilled, (state, action) => {
        state.loading.markCollected = false;
        const { bookingId, collected, amount, method, canMarkComplete } = action.payload;

        if (state.sessions[bookingId]) {
          state.sessions[bookingId].paid            = collected;
          state.sessions[bookingId].canMarkComplete = canMarkComplete;
          state.sessions[bookingId].paymentStatus   = 'paid';
          state.sessions[bookingId].collectedAmount = amount;
          state.sessions[bookingId].collectedMethod = method;
        } else {
          state.sessions[bookingId] = {
            paid: collected,
            canMarkComplete,
            paymentStatus:   'paid',
            collectedAmount: amount,
            collectedMethod: method,
          };
        }

        toast.success(`₹${amount} collected (${method}). Mark service complete.`);
      })
      .addCase(markCollectedByPartner.rejected, (state, action) => {
        state.loading.markCollected = false;
        state.error = action.payload;
        toast.error(action.payload ?? 'Could not record collection');
      });

    // ── markServiceComplete ─────────────────────────────────────────────────
    builder
      .addCase(markServiceComplete.pending, (state) => {
        state.loading.markComplete = true;
        state.error = null;
      })
      .addCase(markServiceComplete.fulfilled, (state, action) => {
        state.loading.markComplete = false;
        const { bookingId, status, completedAt } = action.payload;

        if (state.sessions[bookingId]) {
          state.sessions[bookingId].serviceCompleted = true;
          state.sessions[bookingId].completedAt      = completedAt;
          state.sessions[bookingId].bookingStatus    = status;
        }

        toast.success('Service marked complete!');
      })
      .addCase(markServiceComplete.rejected, (state, action) => {
        state.loading.markComplete = false;
        state.error = action.payload;
        toast.error(action.payload ?? 'Could not complete service');
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  linkGeneratedFromSocket,
  paidFromSocket,
  serviceCompletedFromSocket,
  clearSession,
  clearError,
} = payAtServiceSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const selectPayAtServiceSession = (bookingId) => (state) =>
  state.payAtService.sessions[String(bookingId)] ?? null;

export const selectPayAtServiceLoading = (state) =>
  state.payAtService.loading;

export const selectPayAtServiceError = (state) =>
  state.payAtService.error;

// Derived — is QR expired and not paid?
export const selectNeedsNewLink = (bookingId) => (state) => {
  const s = state.payAtService.sessions[String(bookingId)];
  if (!s) return false;
  return s.canRegenerateLink === true && !s.paid;
};

// Derived — can partner press "Mark Complete"?
export const selectCanMarkComplete = (bookingId) => (state) => {
  const s = state.payAtService.sessions[String(bookingId)];
  return s?.canMarkComplete === true && !s?.serviceCompleted;
};

// Derived — is the booking paid?
export const selectIsPaid = (bookingId) => (state) => {
  const s = state.payAtService.sessions[String(bookingId)];
  return s?.paid === true;
};

// Derived — minutes until QR expiry
export const selectMinutesUntilExpiry = (bookingId) => (state) => {
  const s = state.payAtService.sessions[String(bookingId)];
  if (!s?.expiresAt) return null;

  const diffMs = new Date(s.expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 0;

  return Math.ceil(diffMs / 60000); // Convert milliseconds to minutes
};

export default payAtServiceSlice.reducer;