/**
 * searchSlice.js
 *
 * Redux Toolkit slice for the unified search system.
 * Covers all 13 routes from searchRouter.js:
 *
 *   Thunks:
 *     searchDoctors        → GET /search/doctors
 *     searchHospitals      → GET /search/hospitals
 *     searchLabs           → GET /search/labs
 *     searchMedicines      → GET /search/medicines
 *     searchGlobal         → GET /search/global
 *     fetchAutocomplete    → GET /search/autocomplete
 *     fetchTrending        → GET /search/trending
 *     fetchPopular         → GET /search/popular
 *     fetchRecentSearches  → GET /search/recent
 *     clearRecentSearches  → DELETE /search/recent
 *     deleteRecentEntry    → DELETE /search/recent?q=...
 *     fetchNearby          → GET /search/nearby
 *     fetchSpecializations → GET /search/specializations
 *     fetchSearchStats     → GET /search/stats   [admin]
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const BASE = '/search';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Build query string from params object — drops undefined/null/empty values */
function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v);
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

/** Unified API error message extractor */
function extractError(err) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error  ||
    err?.message                ||
    'Something went wrong.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const paginatedInit = {
  data:       [],
  pagination: { page: 1, limit: 10, total: 0, pages: 0 },
  loading:    false,
  error:      null,
};

const initialState = {
  // ── Entity searches ────────────────────────────────────────────────────────
  doctors: { ...paginatedInit },
  hospitals: { ...paginatedInit },
  labs: { ...paginatedInit },
  medicines: { ...paginatedInit },

  // ── Global federated search ───────────────────────────────────────────────
  global: {
    doctors:   [],
    hospitals: [],
    labs:      [],
    medicines: [],
    loading:   false,
    error:     null,
  },

  // ── Autocomplete ──────────────────────────────────────────────────────────
  autocomplete: {
    suggestions: [],
    loading:     false,
    error:       null,
  },

  // ── Trending ──────────────────────────────────────────────────────────────
  trending: {
    data:    [],
    loading: false,
    error:   null,
  },

  // ── Popular ───────────────────────────────────────────────────────────────
  popular: {
    data:    [],
    loading: false,
    error:   null,
  },

  // ── Recent searches (authenticated user) ─────────────────────────────────
  recent: {
    data:    [],
    loading: false,
    error:   null,
  },

  // ── Nearby ────────────────────────────────────────────────────────────────
  nearby: {
    hospital:  [],
    lab:       [],
    location:  null,   // { lat, lng }
    radiusKm:  null,
    loading:   false,
    error:     null,
  },

  // ── Specializations ───────────────────────────────────────────────────────
  specializations: {
    data:    [],
    loading: false,
    error:   null,
  },

  // ── Admin stats ───────────────────────────────────────────────────────────
  stats: {
    topQueries:       [],
    zeroResults:      [],
    volumeByCategory: [],
    volumeByDay:      [],
    periodDays:       7,
    loading:          false,
    error:            null,
  },

  // ── Active query tracking (for UI state, clearing, etc.) ─────────────────
  activeQuery:    '',
  activeCategory: 'all',
};

// ─────────────────────────────────────────────────────────────────────────────
// THUNKS
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Search Doctors ─────────────────────────────────────────────────────────
/**
 * Params:
 *   q, specialization, lat, lng, maxKm,
 *   sort, page, limit,
 *   inPerson, video, homeVisit,
 *   verified
 */
export const searchDoctors = createAsyncThunk(
  'search/searchDoctors',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/doctors${buildQuery(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 2. Search Hospitals ───────────────────────────────────────────────────────
/**
 * Params:
 *   q, hospitalType, city, lat, lng, maxKm,
 *   accreditations (comma-sep string),
 *   facilities (comma-sep string),
 *   sort, page, limit
 */
export const searchHospitals = createAsyncThunk(
  'search/searchHospitals',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/hospitals${buildQuery(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 3. Search Labs ────────────────────────────────────────────────────────────
/**
 * Params:
 *   q, labType, testName, city, lat, lng, maxKm,
 *   homeCollection (bool string),
 *   accreditations (comma-sep),
 *   sort, page, limit
 */
export const searchLabs = createAsyncThunk(
  'search/searchLabs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/labs${buildQuery(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 4. Search Medicines ───────────────────────────────────────────────────────
/**
 * Params:
 *   q, category, schedule, manufacturer,
 *   otcOnly (bool string),
 *   prescriptionRequired (bool string),
 *   sort, page, limit
 */
export const searchMedicines = createAsyncThunk(
  'search/searchMedicines',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/medicines${buildQuery(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 5. Global Federated Search ────────────────────────────────────────────────
/**
 * Params:
 *   q (required), limit (per category), lat, lng
 */
export const searchGlobal = createAsyncThunk(
  'search/searchGlobal',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/global${buildQuery(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 6. Autocomplete ───────────────────────────────────────────────────────────
/**
 * Params:
 *   q (min 2 chars, required),
 *   category — doctor | hospital | lab | medicine | all
 */
export const fetchAutocomplete = createAsyncThunk(
  'search/fetchAutocomplete',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/autocomplete${buildQuery(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 7. Trending ───────────────────────────────────────────────────────────────
/**
 * Params:
 *   category — optional filter
 *   limit    — 1–20 (default 10)
 */
export const fetchTrending = createAsyncThunk(
  'search/fetchTrending',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/trending${buildQuery(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 8. Popular ────────────────────────────────────────────────────────────────
/**
 * Params:
 *   category — optional filter
 *   limit    — 1–30 (default 15)
 */
export const fetchPopular = createAsyncThunk(
  'search/fetchPopular',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/popular${buildQuery(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 9. Fetch Recent Searches (auth) ──────────────────────────────────────────
/**
 * No params. Uses JWT from API interceptor.
 */
export const fetchRecentSearches = createAsyncThunk(
  'search/fetchRecentSearches',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/recent`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 10. Clear All Recent Searches (auth) ─────────────────────────────────────
/**
 * No params. Deletes ALL recent searches for the authenticated user.
 */
export const clearRecentSearches = createAsyncThunk(
  'search/clearRecentSearches',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`${BASE}/recent`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 11. Delete Single Recent Entry (auth) ────────────────────────────────────
/**
 * Params:
 *   q — exact query string to remove
 */
export const deleteRecentEntry = createAsyncThunk(
  'search/deleteRecentEntry',
  async ({ q } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`${BASE}/recent${buildQuery({ q })}`);
      return { data, removedQuery: q };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 12. Fetch Nearby ─────────────────────────────────────────────────────────
/**
 * Params:
 *   lat, lng   — user coords (defaults to Vijayawada on backend)
 *   maxKm      — radius (default 10)
 *   types      — comma-sep: hospital,lab
 *   limit      — per entity (default 5, max 15)
 */
export const fetchNearby = createAsyncThunk(
  'search/fetchNearby',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/nearby${buildQuery(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 13. Fetch Specializations ────────────────────────────────────────────────
/**
 * No params. Returns all doctor specializations with counts.
 */
export const fetchSpecializations = createAsyncThunk(
  'search/fetchSpecializations',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/specializations`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── 14. Fetch Search Stats (admin) ───────────────────────────────────────────
/**
 * Params:
 *   days — 1–30 (default 7)
 *
 * Access: superadmin | admin only
 */
export const fetchSearchStats = createAsyncThunk(
  'search/fetchSearchStats',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/stats${buildQuery(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const searchSlice = createSlice({
  name: 'search',
  initialState,

  reducers: {
    // ── Sync actions ──────────────────────────────────────────────────────────

    /** Update the active query string (for controlled inputs) */
    setActiveQuery(state, action) {
      state.activeQuery = action.payload ?? '';
    },

    /** Update the active category */
    setActiveCategory(state, action) {
      state.activeCategory = action.payload ?? 'all';
    },

    /** Clear autocomplete suggestions (on blur, route change, etc.) */
    clearAutocomplete(state) {
      state.autocomplete.suggestions = [];
      state.autocomplete.error       = null;
    },

    /** Reset a specific entity search to initial paginated state */
    resetDoctorSearch(state) {
      state.doctors = { ...paginatedInit };
    },
    resetHospitalSearch(state) {
      state.hospitals = { ...paginatedInit };
    },
    resetLabSearch(state) {
      state.labs = { ...paginatedInit };
    },
    resetMedicineSearch(state) {
      state.medicines = { ...paginatedInit };
    },

    /** Reset global search */
    resetGlobalSearch(state) {
      state.global = {
        doctors: [], hospitals: [], labs: [], medicines: [],
        loading: false, error: null,
      };
    },

    /** Reset entire search state (on logout / page unmount) */
    resetSearchState() {
      return initialState;
    },

    /** Optimistically remove a recent entry from local state */
    removeRecentEntryOptimistic(state, action) {
      const q = action.payload;
      state.recent.data = state.recent.data.filter((r) => r.query !== q);
    },
  },

  extraReducers: (builder) => {

    // ── 1. searchDoctors ────────────────────────────────────────────────────
    builder
      .addCase(searchDoctors.pending, (state) => {
        state.doctors.loading = true;
        state.doctors.error   = null;
      })
      .addCase(searchDoctors.fulfilled, (state, { payload }) => {
        state.doctors.loading    = false;
        state.doctors.data       = payload.data        ?? [];
        state.doctors.pagination = payload.pagination  ?? paginatedInit.pagination;
      })
      .addCase(searchDoctors.rejected, (state, { payload }) => {
        state.doctors.loading = false;
        state.doctors.error   = payload;
        toast.error(payload || 'Doctor search failed.');
      });

    // ── 2. searchHospitals ──────────────────────────────────────────────────
    builder
      .addCase(searchHospitals.pending, (state) => {
        state.hospitals.loading = true;
        state.hospitals.error   = null;
      })
      .addCase(searchHospitals.fulfilled, (state, { payload }) => {
        state.hospitals.loading    = false;
        state.hospitals.data       = payload.data        ?? [];
        state.hospitals.pagination = payload.pagination  ?? paginatedInit.pagination;
      })
      .addCase(searchHospitals.rejected, (state, { payload }) => {
        state.hospitals.loading = false;
        state.hospitals.error   = payload;
        toast.error(payload || 'Hospital search failed.');
      });

    // ── 3. searchLabs ───────────────────────────────────────────────────────
    builder
      .addCase(searchLabs.pending, (state) => {
        state.labs.loading = true;
        state.labs.error   = null;
      })
      .addCase(searchLabs.fulfilled, (state, { payload }) => {
        state.labs.loading    = false;
        state.labs.data       = payload.data        ?? [];
        state.labs.pagination = payload.pagination  ?? paginatedInit.pagination;
      })
      .addCase(searchLabs.rejected, (state, { payload }) => {
        state.labs.loading = false;
        state.labs.error   = payload;
        toast.error(payload || 'Lab search failed.');
      });

    // ── 4. searchMedicines ──────────────────────────────────────────────────
    builder
      .addCase(searchMedicines.pending, (state) => {
        state.medicines.loading = true;
        state.medicines.error   = null;
      })
      .addCase(searchMedicines.fulfilled, (state, { payload }) => {
        state.medicines.loading    = false;
        state.medicines.data       = payload.data        ?? [];
        state.medicines.pagination = payload.pagination  ?? paginatedInit.pagination;
      })
      .addCase(searchMedicines.rejected, (state, { payload }) => {
        state.medicines.loading = false;
        state.medicines.error   = payload;
        toast.error(payload || 'Medicine search failed.');
      });

    // ── 5. searchGlobal ─────────────────────────────────────────────────────
    builder
      .addCase(searchGlobal.pending, (state) => {
        state.global.loading = true;
        state.global.error   = null;
      })
      .addCase(searchGlobal.fulfilled, (state, { payload }) => {
        state.global.loading   = false;
        state.global.doctors   = payload.data?.doctors   ?? [];
        state.global.hospitals = payload.data?.hospitals ?? [];
        state.global.labs      = payload.data?.labs      ?? [];
        state.global.medicines = payload.data?.medicines ?? [];
      })
      .addCase(searchGlobal.rejected, (state, { payload }) => {
        state.global.loading = false;
        state.global.error   = payload;
        toast.error(payload || 'Global search failed.');
      });

    // ── 6. fetchAutocomplete ────────────────────────────────────────────────
    builder
      .addCase(fetchAutocomplete.pending, (state) => {
        state.autocomplete.loading = true;
        state.autocomplete.error   = null;
      })
      .addCase(fetchAutocomplete.fulfilled, (state, { payload }) => {
        state.autocomplete.loading     = false;
        state.autocomplete.suggestions = payload.data ?? [];
      })
      .addCase(fetchAutocomplete.rejected, (state, { payload }) => {
        state.autocomplete.loading     = false;
        state.autocomplete.error       = payload;
        state.autocomplete.suggestions = [];
        // No toast — autocomplete errors are silent UX
      });

    // ── 7. fetchTrending ────────────────────────────────────────────────────
    builder
      .addCase(fetchTrending.pending, (state) => {
        state.trending.loading = true;
        state.trending.error   = null;
      })
      .addCase(fetchTrending.fulfilled, (state, { payload }) => {
        state.trending.loading = false;
        state.trending.data    = payload.data ?? [];
      })
      .addCase(fetchTrending.rejected, (state, { payload }) => {
        state.trending.loading = false;
        state.trending.error   = payload;
      });

    // ── 8. fetchPopular ─────────────────────────────────────────────────────
    builder
      .addCase(fetchPopular.pending, (state) => {
        state.popular.loading = true;
        state.popular.error   = null;
      })
      .addCase(fetchPopular.fulfilled, (state, { payload }) => {
        state.popular.loading = false;
        state.popular.data    = payload.data ?? [];
      })
      .addCase(fetchPopular.rejected, (state, { payload }) => {
        state.popular.loading = false;
        state.popular.error   = payload;
      });

    // ── 9. fetchRecentSearches ──────────────────────────────────────────────
    builder
      .addCase(fetchRecentSearches.pending, (state) => {
        state.recent.loading = true;
        state.recent.error   = null;
      })
      .addCase(fetchRecentSearches.fulfilled, (state, { payload }) => {
        state.recent.loading = false;
        state.recent.data    = payload.data ?? [];
      })
      .addCase(fetchRecentSearches.rejected, (state, { payload }) => {
        state.recent.loading = false;
        state.recent.error   = payload;
      });

    // ── 10. clearRecentSearches ─────────────────────────────────────────────
    builder
      .addCase(clearRecentSearches.pending, (state) => {
        state.recent.loading = true;
        state.recent.error   = null;
      })
      .addCase(clearRecentSearches.fulfilled, (state) => {
        state.recent.loading = false;
        state.recent.data    = [];
        toast.success('Recent searches cleared.');
      })
      .addCase(clearRecentSearches.rejected, (state, { payload }) => {
        state.recent.loading = false;
        state.recent.error   = payload;
        toast.error(payload || 'Failed to clear recent searches.');
      });

    // ── 11. deleteRecentEntry ───────────────────────────────────────────────
    builder
      .addCase(deleteRecentEntry.pending, (state) => {
        state.recent.error = null;
        // Optimistic update happens via removeRecentEntryOptimistic action
      })
      .addCase(deleteRecentEntry.fulfilled, (state, { payload }) => {
        // Confirm removal (in case optimistic update wasn't called)
        if (payload.removedQuery) {
          state.recent.data = state.recent.data.filter(
            (r) => r.query !== payload.removedQuery
          );
        }
      })
      .addCase(deleteRecentEntry.rejected, (state, { payload, meta }) => {
        state.recent.error = payload;
        // Rollback: re-fetch on failure
        toast.error(payload || 'Failed to remove search entry.');
      });

    // ── 12. fetchNearby ─────────────────────────────────────────────────────
    builder
      .addCase(fetchNearby.pending, (state) => {
        state.nearby.loading  = true;
        state.nearby.error    = null;
      })
      .addCase(fetchNearby.fulfilled, (state, { payload }) => {
        state.nearby.loading   = false;
        state.nearby.hospital  = payload.data?.hospital ?? [];
        state.nearby.lab       = payload.data?.lab       ?? [];
        state.nearby.location  = payload.location        ?? null;
        state.nearby.radiusKm  = payload.radiusKm        ?? null;
      })
      .addCase(fetchNearby.rejected, (state, { payload }) => {
        state.nearby.loading = false;
        state.nearby.error   = payload;
        toast.error(payload || 'Failed to fetch nearby results.');
      });

    // ── 13. fetchSpecializations ────────────────────────────────────────────
    builder
      .addCase(fetchSpecializations.pending, (state) => {
        state.specializations.loading = true;
        state.specializations.error   = null;
      })
      .addCase(fetchSpecializations.fulfilled, (state, { payload }) => {
        state.specializations.loading = false;
        state.specializations.data    = payload.data ?? [];
      })
      .addCase(fetchSpecializations.rejected, (state, { payload }) => {
        state.specializations.loading = false;
        state.specializations.error   = payload;
      });

    // ── 14. fetchSearchStats (admin) ────────────────────────────────────────
    builder
      .addCase(fetchSearchStats.pending, (state) => {
        state.stats.loading = true;
        state.stats.error   = null;
      })
      .addCase(fetchSearchStats.fulfilled, (state, { payload }) => {
        const d = payload.data ?? {};
        state.stats.loading          = false;
        state.stats.topQueries       = d.topQueries       ?? [];
        state.stats.zeroResults      = d.zeroResults      ?? [];
        state.stats.volumeByCategory = d.volumeByCategory ?? [];
        state.stats.volumeByDay      = d.volumeByDay      ?? [];
        state.stats.periodDays       = d.periodDays       ?? 7;
      })
      .addCase(fetchSearchStats.rejected, (state, { payload }) => {
        state.stats.loading = false;
        state.stats.error   = payload;
        toast.error(payload || 'Failed to load search stats.');
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  setActiveQuery,
  setActiveCategory,
  clearAutocomplete,
  resetDoctorSearch,
  resetHospitalSearch,
  resetLabSearch,
  resetMedicineSearch,
  resetGlobalSearch,
  resetSearchState,
  removeRecentEntryOptimistic,
} = searchSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// ── Entity search selectors ────────────────────────────────────────────────
export const selectDoctorResults    = (s) => s.search.doctors;
export const selectHospitalResults  = (s) => s.search.hospitals;
export const selectLabResults       = (s) => s.search.labs;
export const selectMedicineResults  = (s) => s.search.medicines;

// ── Global search selectors ────────────────────────────────────────────────
export const selectGlobalResults    = (s) => s.search.global;
export const selectGlobalDoctors    = (s) => s.search.global.doctors;
export const selectGlobalHospitals  = (s) => s.search.global.hospitals;
export const selectGlobalLabs       = (s) => s.search.global.labs;
export const selectGlobalMedicines  = (s) => s.search.global.medicines;
export const selectGlobalLoading    = (s) => s.search.global.loading;

// ── Autocomplete selectors ─────────────────────────────────────────────────
export const selectSuggestions      = (s) => s.search.autocomplete.suggestions;
export const selectAutocompleteLoading = (s) => s.search.autocomplete.loading;

// ── Trending / Popular ─────────────────────────────────────────────────────
export const selectTrending         = (s) => s.search.trending.data;
export const selectTrendingLoading  = (s) => s.search.trending.loading;
export const selectPopular          = (s) => s.search.popular.data;
export const selectPopularLoading   = (s) => s.search.popular.loading;

// ── Recent searches ────────────────────────────────────────────────────────
export const selectRecentSearches   = (s) => s.search.recent.data;
export const selectRecentLoading    = (s) => s.search.recent.loading;

// ── Nearby ─────────────────────────────────────────────────────────────────
export const selectNearbyHospitals  = (s) => s.search.nearby.hospital;
export const selectNearbyLabs       = (s) => s.search.nearby.lab;
export const selectNearbyLocation   = (s) => s.search.nearby.location;
export const selectNearbyLoading    = (s) => s.search.nearby.loading;

// ── Specializations ────────────────────────────────────────────────────────
export const selectSpecializations  = (s) => s.search.specializations.data;
export const selectSpecializationsLoading = (s) => s.search.specializations.loading;

// ── Admin stats ────────────────────────────────────────────────────────────
export const selectSearchStats      = (s) => s.search.stats;
export const selectStatsLoading     = (s) => s.search.stats.loading;

// ── Query / category tracking ──────────────────────────────────────────────
export const selectActiveQuery      = (s) => s.search.activeQuery;
export const selectActiveCategory   = (s) => s.search.activeCategory;

// ── Derived: any search loading (for global spinner) ──────────────────────
export const selectAnySearchLoading = (s) =>
  s.search.doctors.loading   ||
  s.search.hospitals.loading ||
  s.search.labs.loading      ||
  s.search.medicines.loading ||
  s.search.global.loading;

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default searchSlice.reducer;

 