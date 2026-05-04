/**
 * @file heroPageSlice.js
 * @desc Enterprise-grade Redux slice for Hero Page management.
 *       Covers every route exposed by heroPageRoutes.js:
 *
 *  GET    /api/v1/hero/imagekit/auth   → fetchImageKitAuth
 *  GET    /api/v1/hero/active          → fetchActiveHero
 *  GET    /api/v1/hero                 → fetchHeroPages
 *  GET    /api/v1/hero/:id             → fetchHeroPageById
 *  POST   /api/v1/hero                 → createHeroPage
 *  PUT    /api/v1/hero/:id             → updateHeroPage
 *  PATCH  /api/v1/hero/:id/toggle      → toggleHeroPage
 *  PATCH  /api/v1/hero/:id/priority    → updateHeroPriority
 *  POST   /api/v1/hero/:id/media       → replaceHeroMedia
 *  DELETE /api/v1/hero/:id             → deleteHeroPage
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const extractError = (error) => {
  if (!error) return 'An unknown error occurred';
  const res = error?.response?.data;
  if (res) {
    if (Array.isArray(res.errors) && res.errors.length > 0) return res.errors.join(' | ');
    if (typeof res.message === 'string' && res.message) return res.message;
  }
  if (error?.message) return error.message;
  return 'An unknown error occurred';
};

const reject = (error, rejectWithValue) =>
  rejectWithValue({ message: extractError(error) });

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  activeHero: null,
  heroes: [],
  pagination: { total: 0, page: 1, limit: 10, pages: 1 },
  selectedHero: null,
  imagekitAuth: null,
  loading: {
    activeHero:   false,
    list:         false,
    detail:       false,
    create:       false,
    update:       false,
    toggle:       false,
    priority:     false,
    media:        false,
    delete:       false,
    imagekitAuth: false,
  },
  uploadProgress: null,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchActiveHero = createAsyncThunk(
  'heroPage/fetchActiveHero',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hero/active');
      return data.data;
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

export const fetchHeroPages = createAsyncThunk(
  'heroPage/fetchHeroPages',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hero', { params });
      return data;
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

export const fetchHeroPageById = createAsyncThunk(
  'heroPage/fetchHeroPageById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hero/${id}`);
      return data.data;
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

export const createHeroPage = createAsyncThunk(
  'heroPage/createHeroPage',
  async ({ formData, onProgress }, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.post('/hero', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          const pct = Math.round((evt.loaded * 100) / (evt.total ?? 1));
          dispatch(heroPageSlice.actions.setUploadProgress(pct));
          onProgress?.(pct);
        },
      });
      return data.data;
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

export const updateHeroPage = createAsyncThunk(
  'heroPage/updateHeroPage',
  async ({ id, formData, onProgress }, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.put(`/hero/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          const pct = Math.round((evt.loaded * 100) / (evt.total ?? 1));
          dispatch(heroPageSlice.actions.setUploadProgress(pct));
          onProgress?.(pct);
        },
      });
      return data.data;
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

export const toggleHeroPage = createAsyncThunk(
  'heroPage/toggleHeroPage',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/hero/${id}/toggle`);
      return data.data;
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

export const updateHeroPriority = createAsyncThunk(
  'heroPage/updateHeroPriority',
  async ({ id, priority }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/hero/${id}/priority`, { priority });
      return data.data;
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

export const replaceHeroMedia = createAsyncThunk(
  'heroPage/replaceHeroMedia',
  async ({ id, formData, onProgress }, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.post(`/hero/${id}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          const pct = Math.round((evt.loaded * 100) / (evt.total ?? 1));
          dispatch(heroPageSlice.actions.setUploadProgress(pct));
          onProgress?.(pct);
        },
      });
      return { id, media: data.data };
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

export const deleteHeroPage = createAsyncThunk(
  'heroPage/deleteHeroPage',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/hero/${id}`);
      return id;
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

export const fetchImageKitAuth = createAsyncThunk(
  'heroPage/fetchImageKitAuth',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hero/imagekit/auth');
      return data.data;
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const heroPageSlice = createSlice({
  name: 'heroPage',
  initialState,

  reducers: {
    setUploadProgress(state, { payload }) { state.uploadProgress = payload; },
    clearUploadProgress(state) { state.uploadProgress = null; },
    selectHero(state, { payload }) { state.selectedHero = payload; },
    clearSelectedHero(state) { state.selectedHero = null; },
    clearError(state) { state.error = null; },
    resetHeroState() { return initialState; },
  },

  extraReducers: (builder) => {

    // ── fetchActiveHero ──────────────────────────────────────────────────────
    builder
      .addCase(fetchActiveHero.pending, (state) => {
        state.loading.activeHero = true;
        state.error = null;
      })
      .addCase(fetchActiveHero.fulfilled, (state, { payload }) => {
        state.loading.activeHero = false;
        state.activeHero = payload;
      })
      .addCase(fetchActiveHero.rejected, (state, { payload }) => {
        state.loading.activeHero = false;
        state.error = payload?.message ?? 'Failed to fetch active hero';
      });

    // ── fetchHeroPages ───────────────────────────────────────────────────────
    builder
      .addCase(fetchHeroPages.pending, (state) => {
        state.loading.list = true;
        state.error = null;
      })
      .addCase(fetchHeroPages.fulfilled, (state, { payload }) => {
        state.loading.list = false;
        state.heroes = payload.data;
        state.pagination = payload.pagination;
      })
      .addCase(fetchHeroPages.rejected, (state, { payload }) => {
        state.loading.list = false;
        state.error = payload?.message ?? 'Failed to fetch hero pages';
        toast.error(state.error);
      });

    // ── fetchHeroPageById ────────────────────────────────────────────────────
    builder
      .addCase(fetchHeroPageById.pending, (state) => {
        state.loading.detail = true;
        state.selectedHero = null;
        state.error = null;
      })
      .addCase(fetchHeroPageById.fulfilled, (state, { payload }) => {
        state.loading.detail = false;
        state.selectedHero = payload;
      })
      .addCase(fetchHeroPageById.rejected, (state, { payload }) => {
        state.loading.detail = false;
        state.error = payload?.message ?? 'Failed to fetch hero page';
        toast.error(state.error);
      });

    // ── createHeroPage ───────────────────────────────────────────────────────
    builder
      .addCase(createHeroPage.pending, (state) => {
        state.loading.create = true;
        state.uploadProgress = 0;
        state.error = null;
      })
      .addCase(createHeroPage.fulfilled, (state, { payload }) => {
        state.loading.create = false;
        state.uploadProgress = null;
        state.heroes.unshift(payload);
        state.pagination.total += 1;
        toast.success('Hero page created successfully');
      })
      .addCase(createHeroPage.rejected, (state, { payload }) => {
        state.loading.create = false;
        state.uploadProgress = null;
        state.error = payload?.message ?? 'Failed to create hero page';
        toast.error(state.error);
      });

    // ── updateHeroPage ───────────────────────────────────────────────────────
    builder
      .addCase(updateHeroPage.pending, (state) => {
        state.loading.update = true;
        state.uploadProgress = 0;
        state.error = null;
      })
      .addCase(updateHeroPage.fulfilled, (state, { payload }) => {
        state.loading.update = false;
        state.uploadProgress = null;
        const idx = state.heroes.findIndex((h) => h._id === payload._id);
        if (idx !== -1) state.heroes[idx] = payload;
        if (state.selectedHero?._id === payload._id) state.selectedHero = payload;
        if (state.activeHero?._id === payload._id) state.activeHero = payload;
        toast.success('Hero page updated successfully');
      })
      .addCase(updateHeroPage.rejected, (state, { payload }) => {
        state.loading.update = false;
        state.uploadProgress = null;
        state.error = payload?.message ?? 'Failed to update hero page';
        toast.error(state.error);
      });

    // ── toggleHeroPage ───────────────────────────────────────────────────────
    builder
      .addCase(toggleHeroPage.pending, (state) => {
        state.loading.toggle = true;
        state.error = null;
      })
      .addCase(toggleHeroPage.fulfilled, (state, { payload }) => {
        state.loading.toggle = false;
        // BUG 7 FIX: server now returns { _id, isActive, activeTo, activeFrom }
        // so the Mongoose pre-save auto-deactivation (activeTo expired) is
        // reflected here instead of leaving the list showing a stale isActive.
        const { _id, isActive, activeTo, activeFrom } = payload;

        const idx = state.heroes.findIndex((h) => h._id === _id);
        if (idx !== -1) {
          state.heroes[idx].isActive = isActive;
          // Sync schedule fields in case pre-save hook mutated them
          if (activeTo   !== undefined) state.heroes[idx].activeTo   = activeTo;
          if (activeFrom !== undefined) state.heroes[idx].activeFrom = activeFrom;
        }

        if (state.selectedHero?._id === _id) {
          state.selectedHero.isActive = isActive;
          if (activeTo   !== undefined) state.selectedHero.activeTo   = activeTo;
          if (activeFrom !== undefined) state.selectedHero.activeFrom = activeFrom;
        }

        toast.success(`Hero page ${isActive ? 'activated' : 'deactivated'}`);
      })
      .addCase(toggleHeroPage.rejected, (state, { payload }) => {
        state.loading.toggle = false;
        state.error = payload?.message ?? 'Failed to toggle hero page';
        toast.error(state.error);
      });

    // ── updateHeroPriority ───────────────────────────────────────────────────
    builder
      .addCase(updateHeroPriority.pending, (state) => {
        state.loading.priority = true;
        state.error = null;
      })
      .addCase(updateHeroPriority.fulfilled, (state, { payload }) => {
        state.loading.priority = false;
        const { _id, priority } = payload;
        const idx = state.heroes.findIndex((h) => h._id === _id);
        if (idx !== -1) state.heroes[idx].priority = priority;
        if (state.selectedHero?._id === _id) state.selectedHero.priority = priority;
        toast.success('Priority updated');
      })
      .addCase(updateHeroPriority.rejected, (state, { payload }) => {
        state.loading.priority = false;
        state.error = payload?.message ?? 'Failed to update priority';
        toast.error(state.error);
      });

    // ── replaceHeroMedia ─────────────────────────────────────────────────────
    builder
      .addCase(replaceHeroMedia.pending, (state) => {
        state.loading.media = true;
        state.uploadProgress = 0;
        state.error = null;
      })
      .addCase(replaceHeroMedia.fulfilled, (state, { payload }) => {
        state.loading.media = false;
        state.uploadProgress = null;
        const { id, media } = payload;
        const idx = state.heroes.findIndex((h) => h._id === id);
        if (idx !== -1) state.heroes[idx].media = media;
        if (state.selectedHero?._id === id) state.selectedHero.media = media;
        if (state.activeHero?._id === id) state.activeHero.media = media;
        toast.success('Hero media replaced');
      })
      .addCase(replaceHeroMedia.rejected, (state, { payload }) => {
        state.loading.media = false;
        state.uploadProgress = null;
        state.error = payload?.message ?? 'Failed to replace hero media';
        toast.error(state.error);
      });

    // ── deleteHeroPage ───────────────────────────────────────────────────────
    builder
      .addCase(deleteHeroPage.pending, (state) => {
        state.loading.delete = true;
        state.error = null;
      })
      .addCase(deleteHeroPage.fulfilled, (state, { payload: deletedId }) => {
        state.loading.delete = false;
        state.heroes = state.heroes.filter((h) => h._id !== deletedId);
        state.pagination.total = Math.max(0, state.pagination.total - 1);
        if (state.selectedHero?._id === deletedId) state.selectedHero = null;
        if (state.activeHero?._id   === deletedId) state.activeHero   = null;
        toast.success('Hero page deleted');
      })
      .addCase(deleteHeroPage.rejected, (state, { payload }) => {
        state.loading.delete = false;
        state.error = payload?.message ?? 'Failed to delete hero page';
        toast.error(state.error);
      });

    // ── fetchImageKitAuth ────────────────────────────────────────────────────
    builder
      .addCase(fetchImageKitAuth.pending, (state) => {
        state.loading.imagekitAuth = true;
        state.error = null;
      })
      .addCase(fetchImageKitAuth.fulfilled, (state, { payload }) => {
        state.loading.imagekitAuth = false;
        state.imagekitAuth = payload;
      })
      .addCase(fetchImageKitAuth.rejected, (state, { payload }) => {
        state.loading.imagekitAuth = false;
        state.error = payload?.message ?? 'Failed to fetch ImageKit auth';
        toast.error(state.error);
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  setUploadProgress,
  clearUploadProgress,
  selectHero,
  clearSelectedHero,
  clearError,
  resetHeroState,
} = heroPageSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const selectActiveHero      = (state) => state.heroPage.activeHero;
export const selectHeroes          = (state) => state.heroPage.heroes;
export const selectHeroPagination  = (state) => state.heroPage.pagination;
export const selectSelectedHero    = (state) => state.heroPage.selectedHero;
export const selectImageKitAuth    = (state) => state.heroPage.imagekitAuth;
export const selectUploadProgress  = (state) => state.heroPage.uploadProgress;
export const selectHeroError       = (state) => state.heroPage.error;

export const selectLoadingActiveHero   = (state) => state.heroPage.loading.activeHero;
export const selectLoadingList         = (state) => state.heroPage.loading.list;
export const selectLoadingDetail       = (state) => state.heroPage.loading.detail;
export const selectLoadingCreate       = (state) => state.heroPage.loading.create;
export const selectLoadingUpdate       = (state) => state.heroPage.loading.update;
export const selectLoadingToggle       = (state) => state.heroPage.loading.toggle;
export const selectLoadingPriority     = (state) => state.heroPage.loading.priority;
export const selectLoadingMedia        = (state) => state.heroPage.loading.media;
export const selectLoadingDelete       = (state) => state.heroPage.loading.delete;
export const selectLoadingImageKitAuth = (state) => state.heroPage.loading.imagekitAuth;

export const selectAnyHeroLoading = (state) =>
  Object.values(state.heroPage.loading).some(Boolean);

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

export default heroPageSlice.reducer;