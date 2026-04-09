import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════
//  USER THUNKS
// ═══════════════════════════════════════════════════════════════

/** Fetch all live marquees visible to the logged-in user */
export const fetchMarquees = createAsyncThunk(
  'marquee/fetchMarquees',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/marquee');
      return data.marquees;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to load marquees');
    }
  }
);

/** Dismiss a marquee for the current user */
export const dismissMarquee = createAsyncThunk(
  'marquee/dismissMarquee',
  async (marqueeId, { rejectWithValue }) => {
    try {
      await API.post(`/marquee/${marqueeId}/dismiss`);
      return marqueeId;
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
//  ADMIN THUNKS
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

/** Admin: quick toggle isActive */
export const toggleMarquee = createAsyncThunk(
  'marquee/toggleMarquee',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/marquee/admin/${id}/toggle`);
      toast.success(data.message);
      return { id, isActive: data.isActive };
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to toggle marquee';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/** Admin: archive / unarchive */
export const archiveMarquee = createAsyncThunk(
  'marquee/archiveMarquee',
  async ({ id, archive = true }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/marquee/admin/${id}/archive`, { archive });
      toast.success(archive ? 'Marquee archived' : 'Marquee unarchived');
      return data.marquee;
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to archive marquee';
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

/** Admin: clear dismissal log */
export const clearDismissals = createAsyncThunk(
  'marquee/clearDismissals',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/marquee/admin/${id}/dismissals`);
      toast.success('Dismissal log cleared');
      return id;
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to clear dismissals';
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

  // Mutation loading (create / update / archive / delete / clearDismissals)
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
      state.userError     = null;
      state.adminError    = null;
      state.selectedError = null;
      state.actionError   = null;
      state.analyticsError = null;
    },
    clearSelectedMarquee(state) {
      state.selected      = null;
      state.selectedError = null;
    },
    resetMarqueeState: () => initialState,

    /**
     * Optimistically remove a marquee from the user-facing list
     * before the dismiss API call resolves.
     * Call this right before dispatching dismissMarquee so the UI
     * feels instant. dismissMarquee.fulfilled will then no-op
     * (the item is already gone).
     */
    optimisticallyDismiss(state, { payload: marqueeId }) {
      state.marquees = state.marquees.filter((m) => m._id !== marqueeId);
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
    // fulfilled: remove from list (covers the case where optimisticallyDismiss
    // was NOT called; if it was called the filter is a safe no-op)
    builder
      .addCase(dismissMarquee.fulfilled, (s, { payload: id }) => {
        s.marquees = s.marquees.filter((m) => m._id !== id);
      })
      .addCase(dismissMarquee.rejected, (s, { payload }) => {
        // If dismiss failed, re-fetch so the dismissed item reappears
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
        s.actionLoading       = false;
        s.adminMarquees       = [payload, ...s.adminMarquees];
        s.adminPagination     = { ...s.adminPagination, total: s.adminPagination.total + 1 };
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

    // ── toggleMarquee ────────────────────────────────────────────────────────
    builder
      .addCase(toggleMarquee.pending,   (s) => { s.actionLoading = true;  s.actionError = null; })
      .addCase(toggleMarquee.fulfilled, (s, { payload: { id, isActive } }) => {
        s.actionLoading = false;
        s.adminMarquees = s.adminMarquees.map((m) =>
          m._id === id ? { ...m, isActive } : m
        );
        if (s.selected?._id === id) s.selected = { ...s.selected, isActive };
      })
      .addCase(toggleMarquee.rejected,  (s, { payload }) => {
        s.actionLoading = false;
        s.actionError   = payload;
      });

    // ── archiveMarquee ───────────────────────────────────────────────────────
    builder
      .addCase(archiveMarquee.pending,   (s) => { s.actionLoading = true;  s.actionError = null; })
      .addCase(archiveMarquee.fulfilled, (s, { payload }) => {
        s.actionLoading = false;
        s.adminMarquees = s.adminMarquees.map((m) => m._id === payload._id ? payload : m);
        if (s.selected?._id === payload._id) s.selected = payload;
      })
      .addCase(archiveMarquee.rejected,  (s, { payload }) => {
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

    // ── clearDismissals ──────────────────────────────────────────────────────
    builder
      .addCase(clearDismissals.pending,   (s) => { s.actionLoading = true;  s.actionError = null; })
      .addCase(clearDismissals.fulfilled, (s, { payload: id }) => {
        s.actionLoading = false;
        // Reset dismissedBy array AND analytics.dismissals count in admin list
        s.adminMarquees = s.adminMarquees.map((m) =>
          m._id === id
            ? { ...m, dismissedBy: [], analytics: { ...m.analytics, dismissals: 0 } }
            : m
        );
        if (s.selected?._id === id) {
          s.selected = {
            ...s.selected,
            dismissedBy: [],
            analytics: { ...s.selected.analytics, dismissals: 0 },
          };
        }
      })
      .addCase(clearDismissals.rejected,  (s, { payload }) => {
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