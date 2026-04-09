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

/**
 * Extracts the most meaningful error message from an Axios error response.
 * Falls back to a generic string so the UI always has something to display.
 *
 * @param {unknown} error  — the raw error caught in a thunk
 * @returns {string}
 */
const extractError = (error) => {
  if (!error) return 'An unknown error occurred';

  // Axios structured response
  const res = error?.response?.data;
  if (res) {
    // Array of validation messages
    if (Array.isArray(res.errors) && res.errors.length > 0) {
      return res.errors.join(' | ');
    }
    if (typeof res.message === 'string' && res.message) return res.message;
  }

  if (error?.message) return error.message;
  return 'An unknown error occurred';
};

/**
 * Builds a rejectWithValue payload that is consistent across all thunks.
 *
 * @param {unknown} error
 * @param {Function} rejectWithValue  — RTK thunk API helper
 */
const reject = (error, rejectWithValue) =>
  rejectWithValue({ message: extractError(error) });

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef  {Object} HeroMedia
 * @property {string} type      — 'image' | 'video' | 'lottie'
 * @property {string} url
 * @property {string} altText
 * @property {string|null} poster
 * @property {number|null} width
 * @property {number|null} height
 */

/**
 * @typedef  {Object} HeroPage
 * @property {string}  _id
 * @property {string}  internalName
 * @property {string}  headline
 * @property {string|null} highlightedText
 * @property {string|null} subheadline
 * @property {string|null} description
 * @property {Object|null} badge
 * @property {Array}   ctaButtons
 * @property {HeroMedia|null} media
 * @property {boolean} isActive
 * @property {string|null} activeFrom
 * @property {string|null} activeTo
 * @property {number}  priority
 * @property {Object}  seo
 * @property {string|null} analyticsTag
 * @property {string}  createdAt
 * @property {string}  updatedAt
 */

const initialState = {
  // ── Public / storefront ─────────────────────────────────────────────────
  /** The single currently-visible hero shown on the public-facing page. */
  activeHero: null,

  // ── Admin list ───────────────────────────────────────────────────────────
  /** All hero pages returned by the paginated admin list. */
  heroes: [],

  /** Pagination metadata from the last list fetch. */
  pagination: {
    total: 0,
    page:  1,
    limit: 10,
    pages: 1,
  },

  // ── Detail / edit target ─────────────────────────────────────────────────
  /** The hero page currently open in the edit drawer / modal. */
  selectedHero: null,

  // ── ImageKit client-auth ─────────────────────────────────────────────────
  /** ImageKit auth params returned by the server for direct client uploads. */
  imagekitAuth: null,

  // ── Loading flags  (one per thunk to avoid UI false-positives) ───────────
  loading: {
    activeHero:     false,
    list:           false,
    detail:         false,
    create:         false,
    update:         false,
    toggle:         false,
    priority:       false,
    media:          false,
    delete:         false,
    imagekitAuth:   false,
  },

  // ── Upload progress (0-100, null when idle) ──────────────────────────────
  uploadProgress: null,

  // ── Error state ──────────────────────────────────────────────────────────
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. GET /api/v1/hero/active ────────────────────────────────────────────────
/**
 * Fetch the single highest-priority, currently-visible hero.
 * Used by the public storefront / landing page — no auth required.
 */
export const fetchActiveHero = createAsyncThunk(
  'heroPage/fetchActiveHero',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hero/active');
      return data.data; // HeroPage object
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

// ── 2. GET /api/v1/hero ───────────────────────────────────────────────────────
/**
 * Paginated admin list.
 *
 * @param {{ page?: number, limit?: number, isActive?: boolean, search?: string }} params
 */
export const fetchHeroPages = createAsyncThunk(
  'heroPage/fetchHeroPages',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hero', { params });
      return data; // { data: HeroPage[], pagination }
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

// ── 3. GET /api/v1/hero/:id ───────────────────────────────────────────────────
/**
 * Fetch a single hero page by ID — for the admin edit form.
 *
 * @param {string} id — MongoDB ObjectId
 */
export const fetchHeroPageById = createAsyncThunk(
  'heroPage/fetchHeroPageById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hero/${id}`);
      return data.data; // HeroPage object
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

// ── 4. POST /api/v1/hero ──────────────────────────────────────────────────────
/**
 * Create a new hero page.
 * Accepts a FormData object so file uploads work transparently.
 *
 * @param {{ formData: FormData, onProgress?: (pct: number) => void }} payload
 */
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
      return data.data; // HeroPage object
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

// ── 5. PUT /api/v1/hero/:id ───────────────────────────────────────────────────
/**
 * Full / partial update of a hero page.
 * Accepts FormData for optional media re-upload.
 *
 * @param {{ id: string, formData: FormData, onProgress?: (pct: number) => void }} payload
 */
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
      return data.data; // Updated HeroPage object
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

// ── 6. PATCH /api/v1/hero/:id/toggle ─────────────────────────────────────────
/**
 * Toggle the isActive flag of a hero page.
 *
 * @param {string} id — MongoDB ObjectId
 */
export const toggleHeroPage = createAsyncThunk(
  'heroPage/toggleHeroPage',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/hero/${id}/toggle`);
      return data.data; // { _id, isActive }
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

// ── 7. PATCH /api/v1/hero/:id/priority ───────────────────────────────────────
/**
 * Update only the display priority of a hero page.
 *
 * @param {{ id: string, priority: number }} payload
 */
export const updateHeroPriority = createAsyncThunk(
  'heroPage/updateHeroPriority',
  async ({ id, priority }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/hero/${id}/priority`, { priority });
      return data.data; // { _id, internalName, priority, isActive }
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

// ── 8. POST /api/v1/hero/:id/media ────────────────────────────────────────────
/**
 * Replace only the media asset of a hero page.
 *
 * @param {{ id: string, formData: FormData, onProgress?: (pct: number) => void }} payload
 */
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
      return { id, media: data.data }; // { id, HeroMedia }
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

// ── 9. DELETE /api/v1/hero/:id ────────────────────────────────────────────────
/**
 * Hard-delete a hero page (superadmin only).
 *
 * @param {string} id — MongoDB ObjectId
 */
export const deleteHeroPage = createAsyncThunk(
  'heroPage/deleteHeroPage',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/hero/${id}`);
      return id; // Return deleted ID so the reducer can remove it from state
    } catch (error) {
      return reject(error, rejectWithValue);
    }
  }
);

// ── 10. GET /api/v1/hero/imagekit/auth ───────────────────────────────────────
/**
 * Fetch ImageKit client-side auth params for direct browser → ImageKit uploads.
 * Params expire in ~30 min; call this right before a direct upload.
 */
export const fetchImageKitAuth = createAsyncThunk(
  'heroPage/fetchImageKitAuth',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hero/imagekit/auth');
      return data.data; // { token, expire, signature }
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

  // ── Synchronous actions ──────────────────────────────────────────────────
  reducers: {
    /** Manually set upload progress (dispatched by thunks). */
    setUploadProgress(state, { payload }) {
      state.uploadProgress = payload;
    },

    /** Reset upload progress to idle after a request completes. */
    clearUploadProgress(state) {
      state.uploadProgress = null;
    },

    /** Open a hero page for editing — sets it as the selected record. */
    selectHero(state, { payload }) {
      state.selectedHero = payload;
    },

    /** Clear the edit target (e.g. when closing a modal). */
    clearSelectedHero(state) {
      state.selectedHero = null;
    },

    /** Manually clear the global error flag. */
    clearError(state) {
      state.error = null;
    },

    /** Reset the entire slice back to its initial state. */
    resetHeroState() {
      return initialState;
    },
  },

  // ── Async action handlers ────────────────────────────────────────────────
  extraReducers: (builder) => {

    // ── fetchActiveHero ──────────────────────────────────────────────────
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
        // No toast — this is a public background fetch
      });

    // ── fetchHeroPages ────────────────────────────────────────────────────
    builder
      .addCase(fetchHeroPages.pending, (state) => {
        state.loading.list = true;
        state.error = null;
      })
      .addCase(fetchHeroPages.fulfilled, (state, { payload }) => {
        state.loading.list = false;
        state.heroes    = payload.data;
        state.pagination = payload.pagination;
      })
      .addCase(fetchHeroPages.rejected, (state, { payload }) => {
        state.loading.list = false;
        state.error = payload?.message ?? 'Failed to fetch hero pages';
        toast.error(state.error);
      });

    // ── fetchHeroPageById ─────────────────────────────────────────────────
    builder
      .addCase(fetchHeroPageById.pending, (state) => {
        state.loading.detail = true;
        state.selectedHero   = null;
        state.error = null;
      })
      .addCase(fetchHeroPageById.fulfilled, (state, { payload }) => {
        state.loading.detail = false;
        state.selectedHero   = payload;
      })
      .addCase(fetchHeroPageById.rejected, (state, { payload }) => {
        state.loading.detail = false;
        state.error = payload?.message ?? 'Failed to fetch hero page';
        toast.error(state.error);
      });

    // ── createHeroPage ────────────────────────────────────────────────────
    builder
      .addCase(createHeroPage.pending, (state) => {
        state.loading.create  = true;
        state.uploadProgress  = 0;
        state.error = null;
      })
      .addCase(createHeroPage.fulfilled, (state, { payload }) => {
        state.loading.create  = false;
        state.uploadProgress  = null;
        // Prepend to list so the new item is immediately visible
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

    // ── updateHeroPage ────────────────────────────────────────────────────
    builder
      .addCase(updateHeroPage.pending, (state) => {
        state.loading.update = true;
        state.uploadProgress = 0;
        state.error = null;
      })
      .addCase(updateHeroPage.fulfilled, (state, { payload }) => {
        state.loading.update = false;
        state.uploadProgress = null;

        // Patch the item in the list array — avoid full re-fetch
        const idx = state.heroes.findIndex((h) => h._id === payload._id);
        if (idx !== -1) state.heroes[idx] = payload;

        // If the updated hero is the currently selected one, refresh it
        if (state.selectedHero?._id === payload._id) {
          state.selectedHero = payload;
        }

        // If it was the active hero on the storefront, refresh that too
        if (state.activeHero?._id === payload._id) {
          state.activeHero = payload;
        }

        toast.success('Hero page updated successfully');
      })
      .addCase(updateHeroPage.rejected, (state, { payload }) => {
        state.loading.update = false;
        state.uploadProgress = null;
        state.error = payload?.message ?? 'Failed to update hero page';
        toast.error(state.error);
      });

    // ── toggleHeroPage ────────────────────────────────────────────────────
    builder
      .addCase(toggleHeroPage.pending, (state) => {
        state.loading.toggle = true;
        state.error = null;
      })
      .addCase(toggleHeroPage.fulfilled, (state, { payload }) => {
        state.loading.toggle = false;
        const { _id, isActive } = payload;

        // Patch isActive in the list
        const idx = state.heroes.findIndex((h) => h._id === _id);
        if (idx !== -1) state.heroes[idx].isActive = isActive;

        // Patch selectedHero if it's the same record
        if (state.selectedHero?._id === _id) {
          state.selectedHero.isActive = isActive;
        }

        toast.success(`Hero page ${isActive ? 'activated' : 'deactivated'}`);
      })
      .addCase(toggleHeroPage.rejected, (state, { payload }) => {
        state.loading.toggle = false;
        state.error = payload?.message ?? 'Failed to toggle hero page';
        toast.error(state.error);
      });

    // ── updateHeroPriority ────────────────────────────────────────────────
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

        if (state.selectedHero?._id === _id) {
          state.selectedHero.priority = priority;
        }

        toast.success('Priority updated');
      })
      .addCase(updateHeroPriority.rejected, (state, { payload }) => {
        state.loading.priority = false;
        state.error = payload?.message ?? 'Failed to update priority';
        toast.error(state.error);
      });

    // ── replaceHeroMedia ──────────────────────────────────────────────────
    builder
      .addCase(replaceHeroMedia.pending, (state) => {
        state.loading.media  = true;
        state.uploadProgress = 0;
        state.error = null;
      })
      .addCase(replaceHeroMedia.fulfilled, (state, { payload }) => {
        state.loading.media  = false;
        state.uploadProgress = null;
        const { id, media } = payload;

        const idx = state.heroes.findIndex((h) => h._id === id);
        if (idx !== -1) state.heroes[idx].media = media;

        if (state.selectedHero?._id === id) {
          state.selectedHero.media = media;
        }
        if (state.activeHero?._id === id) {
          state.activeHero.media = media;
        }

        toast.success('Hero media replaced');
      })
      .addCase(replaceHeroMedia.rejected, (state, { payload }) => {
        state.loading.media  = false;
        state.uploadProgress = null;
        state.error = payload?.message ?? 'Failed to replace hero media';
        toast.error(state.error);
      });

    // ── deleteHeroPage ────────────────────────────────────────────────────
    builder
      .addCase(deleteHeroPage.pending, (state) => {
        state.loading.delete = true;
        state.error = null;
      })
      .addCase(deleteHeroPage.fulfilled, (state, { payload: deletedId }) => {
        state.loading.delete  = false;
        state.heroes          = state.heroes.filter((h) => h._id !== deletedId);
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

    // ── fetchImageKitAuth ─────────────────────────────────────────────────
    builder
      .addCase(fetchImageKitAuth.pending, (state) => {
        state.loading.imagekitAuth = true;
        state.error = null;
      })
      .addCase(fetchImageKitAuth.fulfilled, (state, { payload }) => {
        state.loading.imagekitAuth = false;
        state.imagekitAuth         = payload;
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

/** @param {Object} state — root Redux state */

export const selectActiveHero      = (state) => state.heroPage.activeHero;
export const selectHeroes          = (state) => state.heroPage.heroes;
export const selectHeroPagination  = (state) => state.heroPage.pagination;
export const selectSelectedHero    = (state) => state.heroPage.selectedHero;
export const selectImageKitAuth    = (state) => state.heroPage.imagekitAuth;
export const selectUploadProgress  = (state) => state.heroPage.uploadProgress;
export const selectHeroError       = (state) => state.heroPage.error;

/** Per-action loading selectors — avoids consumers reading the full loading object. */
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

/**
 * Derived selector — true if ANY async operation is in flight.
 * Useful for disabling forms globally.
 */
export const selectAnyHeroLoading = (state) =>
  Object.values(state.heroPage.loading).some(Boolean);

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER (default export)
// ─────────────────────────────────────────────────────────────────────────────

export default heroPageSlice.reducer;