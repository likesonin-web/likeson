import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════
//  USER THUNKS (CONSUMPTION)
// ═══════════════════════════════════════════════════════════════

/** Fetch all live marquees visible to the logged-in user or guest */
export const fetchMarquees = createAsyncThunk(
  'marquee/fetchMarquees',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/marquee');
      
      // Filter out marquees the user has already dismissed locally
      if (typeof window !== 'undefined') {
        const visibleMarquees = data.marquees.filter(
          (m) => !localStorage.getItem(`marquee_dismissed_${m.clientKey}`)
        );
        return visibleMarquees;
      }
      
      return data.marquees;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to load marquees');
    }
  }
);

/** * Dismiss a marquee. 
 * Saves the clientKey locally and pings the backend for analytics.
 * Accepts the entire marquee object: { _id, clientKey } 
 */
export const dismissMarquee = createAsyncThunk(
  'marquee/dismissMarquee',
  async (marquee, { rejectWithValue }) => {
    try {
      // 1. Instantly save to local storage
      if (typeof window !== 'undefined' && marquee.clientKey) {
        localStorage.setItem(`marquee_dismissed_${marquee.clientKey}`, 'true');
      }
      // 2. Ping backend for analytics (fire-and-forget style)
      await API.post(`/marquee/${marquee._id}/dismiss`);
      return marquee._id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to dismiss');
    }
  }
);

/** Track a CTA click (fire-and-forget) */
export const trackMarqueeClick = createAsyncThunk(
  'marquee/trackClick',
  async (marqueeId, { rejectWithValue }) => {
    try {
      await API.post(`/marquee/${marqueeId}/click`);
      return marqueeId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to track click');
    }
  }
);

// ═══════════════════════════════════════════════════════════════
//  ADMIN THUNKS (MANAGEMENT)
// ═══════════════════════════════════════════════════════════════

/** Admin: fetch all marquees with filters + pagination */
export const fetchAdminMarquees = createAsyncThunk(
  'marquee/fetchAdminMarquees',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/marquee/admin', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to load marquees');
    }
  }
);

/** Admin: fetch single marquee by id */
export const fetchAdminMarqueeById = createAsyncThunk(
  'marquee/fetchAdminMarqueeById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/marquee/admin/${id}`);
      return data.marquee;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Marquee not found');
    }
  }
);

/** Admin: create a new marquee */
export const createMarquee = createAsyncThunk(
  'marquee/createMarquee',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/marquee/admin', payload);
      toast.success('Marquee created successfully!');
      return data.marquee;
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to create marquee';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/** Admin: update a marquee */
export const updateMarquee = createAsyncThunk(
  'marquee/updateMarquee',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/marquee/admin/${id}`, payload);
      toast.success('Marquee updated!');
      return data.marquee;
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to update marquee';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/** Admin: Update status (replaces toggle and archive endpoints) */
export const updateMarqueeStatus = createAsyncThunk(
  'marquee/updateMarqueeStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/marquee/admin/${id}/status`, { status });
      toast.success(data.message);
      return { id, status: data.status };
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to update status';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/** Admin: hard delete (superadmin only) */
export const deleteMarquee = createAsyncThunk(
  'marquee/deleteMarquee',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/marquee/admin/${id}`);
      toast.success('Marquee deleted');
      return id;
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to delete marquee';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/** Admin: Reset analytics (impressions, clicks, dismissals) */
export const resetMarqueeAnalytics = createAsyncThunk(
  'marquee/resetMarqueeAnalytics',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/marquee/admin/${id}/analytics`);
      toast.success(data.message);
      return id;
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to reset analytics';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/** Admin: fetch analytics summary */
export const fetchMarqueeAnalytics = createAsyncThunk(
  'marquee/fetchMarqueeAnalytics',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/marquee/admin/analytics/summary');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to load analytics');
    }
  }
);

// ═══════════════════════════════════════════════════════════════
//  INITIAL STATE
// ═══════════════════════════════════════════════════════════════

const initialState = {
  // User-facing
  marquees:    [],
  userLoading: false,
  userError:   null,

  // Admin list
  adminMarquees:   [],
  adminPagination: { total: 0, pages: 1, page: 1, limit: 20 },
  adminLoading:    false,
  adminError:      null,

  // Single marquee (admin detail / edit)
  selected:        null,
  selectedLoading: false,
  selectedError:   null,

  // Mutation loading
  actionLoading: false,
  actionError:   null,

  // Analytics
  analytics: {
    summary:    null,
    byType:     [],
    topClicked: [],
  },
  analyticsLoading: false,
  analyticsError:   null,
};

// ═══════════════════════════════════════════════════════════════
//  SLICE
// ═══════════════════════════════════════════════════════════════

const marqueeSlice = createSlice({
  name: 'marquee',
  initialState,

  reducers: {
    clearMarqueeErrors(state) {
      state.userError      = null;
      state.adminError     = null;
      state.selectedError  = null;
      state.actionError    = null;
      state.analyticsError = null;
    },
    clearSelectedMarquee(state) {
      state.selected      = null;
      state.selectedError = null;
    },
    resetMarqueeState: () => initialState,

    /**
     * Optimistically remove a marquee from the user-facing list.
     * Receives the whole marquee object to cache the clientKey immediately.
     */
    optimisticallyDismiss(state, { payload: marquee }) {
      if (typeof window !== 'undefined' && marquee.clientKey) {
        localStorage.setItem(`marquee_dismissed_${marquee.clientKey}`, 'true');
      }
      state.marquees = state.marquees.filter((m) => m._id !== marquee._id);
    },
  },

  extraReducers: (builder) => {

    // ── fetchMarquees ────────────────────────────────────────────────────────
    builder
      .addCase(fetchMarquees.pending,   (s) => { s.userLoading = true;  s.userError = null; })
      .addCase(fetchMarquees.fulfilled, (s, { payload }) => {
        s.userLoading = false;
        s.marquees    = payload ?? [];
      })
      .addCase(fetchMarquees.rejected,  (s, { payload }) => {
        s.userLoading = false;
        s.userError   = payload;
      });

    // ── dismissMarquee ───────────────────────────────────────────────────────
    builder
      .addCase(dismissMarquee.fulfilled, (s, { payload: id }) => {
        s.marquees = s.marquees.filter((m) => m._id !== id);
      })
      .addCase(dismissMarquee.rejected, (s, { payload }) => {
        s.userError = payload;
      });

    // ── trackMarqueeClick ────────────────────────────────────────────────────
    builder
      .addCase(trackMarqueeClick.fulfilled, (s, { payload: id }) => {
        const m = s.marquees.find((m) => m._id === id);
        if (m?.analytics) m.analytics.clicks = (m.analytics.clicks || 0) + 1;
      });

    // ── fetchAdminMarquees ───────────────────────────────────────────────────
    builder
      .addCase(fetchAdminMarquees.pending,   (s) => { s.adminLoading = true;  s.adminError = null; })
      .addCase(fetchAdminMarquees.fulfilled, (s, { payload }) => {
        s.adminLoading    = false;
        s.adminMarquees   = payload.marquees   ?? [];
        s.adminPagination = payload.pagination ?? initialState.adminPagination;
      })
      .addCase(fetchAdminMarquees.rejected,  (s, { payload }) => {
        s.adminLoading = false;
        s.adminError   = payload;
      });

    // ── fetchAdminMarqueeById ────────────────────────────────────────────────
    builder
      .addCase(fetchAdminMarqueeById.pending,   (s) => { s.selectedLoading = true;  s.selectedError = null; })
      .addCase(fetchAdminMarqueeById.fulfilled, (s, { payload }) => {
        s.selectedLoading = false;
        s.selected        = payload;
      })
      .addCase(fetchAdminMarqueeById.rejected,  (s, { payload }) => {
        s.selectedLoading = false;
        s.selectedError   = payload;
      });

    // ── createMarquee ────────────────────────────────────────────────────────
    builder
      .addCase(createMarquee.pending,   (s) => { s.actionLoading = true;  s.actionError = null; })
      .addCase(createMarquee.fulfilled, (s, { payload }) => {
        s.actionLoading   = false;
        s.adminMarquees   = [payload, ...s.adminMarquees];
        s.adminPagination = { ...s.adminPagination, total: s.adminPagination.total + 1 };
      })
      .addCase(createMarquee.rejected,  (s, { payload }) => {
        s.actionLoading = false;
        s.actionError   = payload;
      });

    // ── updateMarquee ────────────────────────────────────────────────────────
    builder
      .addCase(updateMarquee.pending,   (s) => { s.actionLoading = true;  s.actionError = null; })
      .addCase(updateMarquee.fulfilled, (s, { payload }) => {
        s.actionLoading = false;
        s.adminMarquees = s.adminMarquees.map((m) => m._id === payload._id ? payload : m);
        if (s.selected?._id === payload._id) s.selected = payload;
      })
      .addCase(updateMarquee.rejected,  (s, { payload }) => {
        s.actionLoading = false;
        s.actionError   = payload;
      });

    // ── updateMarqueeStatus ──────────────────────────────────────────────────
    builder
      .addCase(updateMarqueeStatus.pending,   (s) => { s.actionLoading = true;  s.actionError = null; })
      .addCase(updateMarqueeStatus.fulfilled, (s, { payload: { id, status } }) => {
        s.actionLoading = false;
        s.adminMarquees = s.adminMarquees.map((m) => m._id === id ? { ...m, status } : m);
        if (s.selected?._id === id) s.selected = { ...s.selected, status };
      })
      .addCase(updateMarqueeStatus.rejected,  (s, { payload }) => {
        s.actionLoading = false;
        s.actionError   = payload;
      });

    // ── deleteMarquee ────────────────────────────────────────────────────────
    builder
      .addCase(deleteMarquee.pending,   (s) => { s.actionLoading = true;  s.actionError = null; })
      .addCase(deleteMarquee.fulfilled, (s, { payload: id }) => {
        s.actionLoading   = false;
        s.adminMarquees   = s.adminMarquees.filter((m) => m._id !== id);
        s.adminPagination = { ...s.adminPagination, total: Math.max(0, s.adminPagination.total - 1) };
        if (s.selected?._id === id) s.selected = null;
      })
      .addCase(deleteMarquee.rejected,  (s, { payload }) => {
        s.actionLoading = false;
        s.actionError   = payload;
      });

    // ── resetMarqueeAnalytics ────────────────────────────────────────────────
    builder
      .addCase(resetMarqueeAnalytics.pending,   (s) => { s.actionLoading = true;  s.actionError = null; })
      .addCase(resetMarqueeAnalytics.fulfilled, (s, { payload: id }) => {
        s.actionLoading = false;
        const defaultAnalytics = { impressions: 0, clicks: 0, dismissals: 0 };
        s.adminMarquees = s.adminMarquees.map((m) =>
          m._id === id ? { ...m, analytics: defaultAnalytics } : m
        );
        if (s.selected?._id === id) {
          s.selected = { ...s.selected, analytics: defaultAnalytics };
        }
      })
      .addCase(resetMarqueeAnalytics.rejected,  (s, { payload }) => {
        s.actionLoading = false;
        s.actionError   = payload;
      });

    // ── fetchMarqueeAnalytics ────────────────────────────────────────────────
    builder
      .addCase(fetchMarqueeAnalytics.pending,   (s) => { s.analyticsLoading = true;  s.analyticsError = null; })
      .addCase(fetchMarqueeAnalytics.fulfilled, (s, { payload }) => {
        s.analyticsLoading     = false;
        s.analytics.summary    = payload.summary    ?? null;
        s.analytics.byType     = payload.byType     ?? [];
        s.analytics.topClicked = payload.topClicked ?? [];
      })
      .addCase(fetchMarqueeAnalytics.rejected,  (s, { payload }) => {
        s.analyticsLoading = false;
        s.analyticsError   = payload;
      });
  },
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export const {
  clearMarqueeErrors,
  clearSelectedMarquee,
  resetMarqueeState,
  optimisticallyDismiss,
} = marqueeSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

// User-facing
export const selectMarquees     = (s) => s.marquee.marquees;
export const selectUserLoading  = (s) => s.marquee.userLoading;
export const selectUserError    = (s) => s.marquee.userError;
export const selectMarqueeCount = (s) => s.marquee.marquees.length;

// Admin list
export const selectAdminMarquees   = (s) => s.marquee.adminMarquees;
export const selectAdminPagination = (s) => s.marquee.adminPagination;
export const selectAdminLoading    = (s) => s.marquee.adminLoading;
export const selectAdminError      = (s) => s.marquee.adminError;

// Selected
export const selectSelectedMarquee = (s) => s.marquee.selected;
export const selectSelectedLoading = (s) => s.marquee.selectedLoading;
export const selectSelectedError   = (s) => s.marquee.selectedError;

// Mutations
export const selectActionLoading = (s) => s.marquee.actionLoading;
export const selectActionError   = (s) => s.marquee.actionError;

// Analytics
export const selectAnalytics        = (s) => s.marquee.analytics;
export const selectAnalyticsSummary = (s) => s.marquee.analytics.summary;
export const selectAnalyticsByType  = (s) => s.marquee.analytics.byType;
export const selectTopClicked       = (s) => s.marquee.analytics.topClicked;
export const selectAnalyticsLoading = (s) => s.marquee.analyticsLoading;
export const selectAnalyticsError   = (s) => s.marquee.analyticsError;

export default marqueeSlice.reducer;