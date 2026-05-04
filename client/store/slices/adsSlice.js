/**
 * adsSlice.js
 * Redux slice for Advertisement management.
 *
 * State shape:
 *   bannersByKey  — { "Page_Slot": Ad[] }  keyed so multiple slots on same page don't clobber each other
 *   activeBanners — flat deduplicated list  (kept for legacy consumer components)
 *   allAds        — full list for admin table
 *   analytics     — { totalViews, totalClicks, avgCtr, activeCount }
 *   loading       — true only on first load (no data yet); false once we have data
 *   isRefreshing  — background refresh in progress (shows spinner without blocking UI)
 *   error         — last error message string | null
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetchAllAds
 * Admin only — fetches every ad regardless of status.
 * Used by the AdsManagement admin panel table.
 */
export const fetchAllAds = createAsyncThunk(
  'ads/fetchAllAds',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('/ads');
      return response.data.data; // Ad[]
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch ads' });
    }
  }
);

/**
 * fetchActiveBanners
 * Customer-facing — fetches Active ads for a specific page + slot.
 * Backend already filters by: status, schedule window, displayHours,
 * budget guard, and geo radius. Frontend just renders what comes back.
 *
 * @param {{ page: string, slot: string }} params
 * @returns {{ page, slot, data: Ad[] }}
 *
 * BUG FIX: previously returned only `data`; reducer couldn't build the key
 * without page+slot. Now returns all three so reducer can store correctly.
 */
export const fetchActiveBanners = createAsyncThunk(
  'ads/fetchActiveBanners',
  async ({ page, slot }, { rejectWithValue }) => {
    try {
      const response = await API.get('/ads/serve', { params: { page, slot } });
      // Return page+slot alongside data so reducer can key correctly
      return { page, slot, data: response.data.data };
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to serve ads' });
    }
  }
);

/**
 * createAd
 * Admin only — creates a new advertisement.
 * Backend injects createdBy from JWT; do NOT send it from frontend.
 */
export const createAd = createAsyncThunk(
  'ads/createAd',
  async (adData, { rejectWithValue }) => {
    try {
      const response = await API.post('/ads', adData);
      toast.success('Campaign launched successfully! 🚀');
      return response.data.data; // newly created Ad
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create ad';
      toast.error(message);
      return rejectWithValue(error.response?.data);
    }
  }
);

/**
 * updateAd
 * Admin only — replaces an existing ad's fields via PUT.
 * runValidators: true on backend ensures schema validation still fires.
 *
 * @param {{ id: string, adData: Partial<Ad> }}
 */
export const updateAd = createAsyncThunk(
  'ads/updateAd',
  async ({ id, adData }, { rejectWithValue }) => {
    try {
      const response = await API.put(`/ads/${id}`, adData);
      toast.success('Advertisement updated');
      return response.data.data; // updated Ad
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
      return rejectWithValue(error.response?.data);
    }
  }
);

/**
 * archiveAd
 * Admin only — soft-deletes by setting status = "Archived".
 * Returns the archived ad's _id so reducer can remove it from state.
 *
 * @param {string} id — Ad _id
 */
export const archiveAd = createAsyncThunk(
  'ads/archiveAd',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/ads/${id}`);
      toast.success('Ad archived');
      return id; // just the id; reducer removes it from lists
    } catch (error) {
      toast.error('Failed to archive ad');
      return rejectWithValue(error.response?.data);
    }
  }
);

/**
 * getAdAnalytics
 * Admin — aggregated stats: totalViews, totalClicks, avgCtr, activeCount.
 * Called on mount and every 30 s for a live dashboard feel.
 */
export const getAdAnalytics = createAsyncThunk(
  'ads/getAnalytics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('/ads/analytics');
      return response.data.data; // { totalViews, totalClicks, avgCtr, activeCount }
    } catch (error) {
      return rejectWithValue(error.response?.data);
    }
  }
);

/**
 * trackAdActivity
 * Customer-facing — records a "click" or "view" interaction.
 * Backend enforces a 5-second cooldown per user+ad+type to prevent spam.
 * A null spend in the response means the event was deduplicated (ignored).
 *
 * @param {{ id: string, type: 'click'|'view' }}
 * @returns {{ id, spend: number|null, type }}
 *
 * BUG FIX (was): $inc used wrong field names (`analytics.click` / `analytics.view`)
 *                — counters never incremented. Backend now uses correct plural fields.
 * BUG FIX (was): reducer always incremented both clicks AND views regardless of type.
 */
export const trackAdActivity = createAsyncThunk(
  'ads/trackActivity',
  async ({ id, type }, { rejectWithValue }) => {
    try {
      const response = await API.patch(`/ads/${id}/track`, { type });
      return { id, spend: response.data.spend, type };
    } catch (error) {
      // Silent fail on tracking — never surface to user
      return rejectWithValue(error.response?.data);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * updateAdInState
 * Applies `updater(ad)` mutation to every copy of the ad that lives in state:
 *   • allAds flat list
 *   • every bannersByKey bucket
 * Keeps allAds and bannersByKey in sync without duplicate logic.
 *
 * @param {object} state
 * @param {string} id     — Ad _id
 * @param {function} updater — mutate the ad in place (Immer-safe)
 */
const updateAdInState = (state, id, updater) => {
  // Update in allAds
  const adInAll = state.allAds.find((a) => a._id === id);
  if (adInAll) updater(adInAll);

  // Update in every keyed banner bucket
  Object.keys(state.bannersByKey).forEach((key) => {
    const ad = state.bannersByKey[key].find((a) => a._id === id);
    if (ad) updater(ad);
  });
};

/**
 * removeAdFromBanners
 * Removes an ad from ALL bannersByKey buckets + flat activeBanners.
 * Called when an ad is archived, depleted, or paused.
 *
 * @param {object} state
 * @param {string} id — Ad _id
 */
const removeAdFromBanners = (state, id) => {
  Object.keys(state.bannersByKey).forEach((key) => {
    state.bannersByKey[key] = state.bannersByKey[key].filter((a) => a._id !== id);
  });
  state.activeBanners = state.activeBanners.filter((a) => a._id !== id);
};

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const adsSlice = createSlice({
  name: 'ads',
  initialState: {
    /**
     * bannersByKey
     * Keyed map: { "Global_Hero_Banner": Ad[], "Medicine_Store_Native_Feed": Ad[] }
     *
     * WHY: multiple AdBanner components on one page each fetch a different
     * page+slot. A flat `activeBanners` array caused them to clobber each
     * other. The key is `${page}_${slot}`.
     */
    bannersByKey: {},

    /**
     * activeBanners
     * Flat deduplicated list of all currently active banners across all slots.
     * Kept for backward compat with any component that doesn't use bannersByKey.
     * Source of truth is bannersByKey; this is a derived convenience list.
     */
    activeBanners: [],

    /**
     * allAds
     * Complete list of every ad — used only by admin views.
     * Populated by fetchAllAds. Never used for customer-facing rendering.
     */
    allAds: [],

    /**
     * analytics
     * Aggregated stats from GET /ads/analytics.
     * Shape: { totalViews, totalClicks, avgCtr, activeCount }
     */
    analytics: {
      totalViews: 0,
      totalClicks: 0,
      avgCtr: 0,
      activeCount: 0,
    },

    /**
     * loading
     * true ONLY on the very first fetch when we have no data yet.
     * Used to show skeleton loaders. Goes false once data arrives.
     * Subsequent refreshes use `isRefreshing` instead (no skeleton flash).
     */
    loading: false,

    /**
     * isRefreshing
     * true during any background network call even when we already have data.
     * Used to show a subtle spinner in the header without blocking the table.
     */
    isRefreshing: false,

    /**
     * lastUpdated
     * ISO timestamp of the last successful fetchAllAds or fetchActiveBanners.
     * Useful for "last synced X minutes ago" UI.
     */
    lastUpdated: null,

    /**
     * error
     * Last error message string, or null if everything is fine.
     * Cleared by the clearAdError action.
     */
    error: null,
  },

  reducers: {
    /**
     * clearAdError
     * Resets the error field. Call this before showing an error-sensitive form
     * so stale errors don't appear immediately on mount.
     */
    clearAdError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder

      // ── fetchAllAds ──────────────────────────────────────────────────────
      .addCase(fetchAllAds.pending, (state) => {
        // Only show skeleton loader on first fetch (no data yet)
        if (state.allAds.length === 0) state.loading = true;
        state.isRefreshing = true;
        state.error = null;
      })
      .addCase(fetchAllAds.fulfilled, (state, action) => {
        state.loading = false;
        state.isRefreshing = false;
        state.allAds = action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchAllAds.rejected, (state, action) => {
        state.loading = false;
        state.isRefreshing = false;
        state.error = action.payload?.message || 'Failed to fetch ads';
      })

      // ── fetchActiveBanners ───────────────────────────────────────────────
      .addCase(fetchActiveBanners.pending, (state) => {
        state.isRefreshing = true;
      })
      .addCase(fetchActiveBanners.fulfilled, (state, action) => {
        state.isRefreshing = false;
        const { page, slot, data } = action.payload;

        // Store under composite key so multiple slots don't overwrite each other
        const key = `${page}_${slot}`;
        state.bannersByKey[key] = data;

        // Merge into flat activeBanners (deduplicate by _id)
        const existingIds = new Set(state.activeBanners.map((a) => a._id));
        data.forEach((ad) => {
          if (!existingIds.has(ad._id)) {
            state.activeBanners.push(ad);
          }
        });

        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchActiveBanners.rejected, (state) => {
        state.isRefreshing = false;
        // Intentionally silent — don't show error toast for banner failures
      })

      // ── createAd ────────────────────────────────────────────────────────
      .addCase(createAd.fulfilled, (state, action) => {
        // Prepend so new ad appears at top of admin table immediately
        state.allAds.unshift(action.payload);
      })

      // ── updateAd ────────────────────────────────────────────────────────
      .addCase(updateAd.fulfilled, (state, action) => {
        const updatedAd = action.payload;

        // Replace in allAds
        const index = state.allAds.findIndex((ad) => ad._id === updatedAd._id);
        if (index !== -1) state.allAds[index] = updatedAd;

        // Determine if ad should leave active rotation
        const budgetDepleted = updatedAd.budget.currentSpend >= updatedAd.budget.totalMax;
        const shouldRemoveFromBanners = updatedAd.status !== 'Active' || budgetDepleted;

        if (shouldRemoveFromBanners) {
          // Ad is no longer eligible to show — purge from all banner buckets
          removeAdFromBanners(state, updatedAd._id);
        } else {
          // Ad still active — update it in place wherever it exists in banners
          Object.keys(state.bannersByKey).forEach((key) => {
            const i = state.bannersByKey[key].findIndex((a) => a._id === updatedAd._id);
            if (i !== -1) state.bannersByKey[key][i] = updatedAd;
          });
          const ai = state.activeBanners.findIndex((a) => a._id === updatedAd._id);
          if (ai !== -1) state.activeBanners[ai] = updatedAd;
        }
      })

      // ── archiveAd ────────────────────────────────────────────────────────
      .addCase(archiveAd.fulfilled, (state, action) => {
        // action.payload is just the id (string)
        const id = action.payload;
        state.allAds = state.allAds.filter((ad) => ad._id !== id);
        removeAdFromBanners(state, id);
      })

      // ── getAdAnalytics ───────────────────────────────────────────────────
      .addCase(getAdAnalytics.fulfilled, (state, action) => {
        // Merge so partial updates don't wipe existing fields
        state.analytics = { ...state.analytics, ...(action.payload ?? {}) };
      })

      // ── trackAdActivity ──────────────────────────────────────────────────
      .addCase(trackAdActivity.fulfilled, (state, action) => {
        const { id, spend, type } = action.payload;

        // spend === null means backend deduped it (5-second cooldown hit) — skip
        if (spend === null) return;

        updateAdInState(state, id, (ad) => {
          // Update spend from authoritative backend value
          ad.budget.currentSpend = spend;

          // BUG FIX: was incrementing both clicks AND views regardless of type.
          // Now only increment the correct counter.
          if (type === 'click') {
            ad.analytics.clicks = (ad.analytics.clicks ?? 0) + 1;
          } else if (type === 'view') {
            ad.analytics.views = (ad.analytics.views ?? 0) + 1;
          }

          // Optimistically mark depleted if spend hit the cap
          if (spend >= ad.budget.totalMax) {
            ad.status = 'Depleted';
          }
        });

        // If ad is now depleted, pull it from banner lists so it stops rendering
        const anyAd =
          state.allAds.find((a) => a._id === id) ||
          Object.values(state.bannersByKey).flat().find((a) => a._id === id);

        if (anyAd && spend >= anyAd.budget.totalMax) {
          removeAdFromBanners(state, id);
        }
      })

      // ── Global error catcher ─────────────────────────────────────────────
      // Catches any thunk that ends in /rejected not already handled above.
      // Sets error state so UI can show a fallback message if needed.
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        (state, action) => {
          state.loading = false;
          state.isRefreshing = false;
          // Don't overwrite a more specific error already set
          if (!state.error) {
            state.error = action.payload?.message || 'An unexpected error occurred';
          }
        }
      );
  },
});

export const { clearAdError } = adsSlice.actions;
export default adsSlice.reducer;