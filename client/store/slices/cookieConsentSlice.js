import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ── Thunks ─────────────────────────────────────────────────────────────────────

/** GET /api/cookie-consent/policy — public, no auth */
export const fetchCookiePolicy = createAsyncThunk(
  'cookieConsent/fetchPolicy',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/cookie-consent/policy');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to load cookie policy.');
    }
  }
);

/** GET /api/cookie-consent/status — auth required */
export const fetchCookieStatus = createAsyncThunk(
  'cookieConsent/fetchStatus',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/cookie-consent/status');
      return data; // { hasConsented, version, preferences, consentedAt }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to fetch cookie status.');
    }
  }
);

/** POST /api/cookie-consent/accept — accept all */
export const acceptAllCookies = createAsyncThunk(
  'cookieConsent/acceptAll',
  async (payload = {}, { rejectWithValue }) => {
    // payload: { platform?, state?, city? }
    try {
      const { data } = await API.post('/cookie-consent/accept', payload);
      return data; // { version, preferences }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to accept cookies.');
    }
  }
);

/** POST /api/cookie-consent/reject — reject non-essential */
export const rejectNonEssentialCookies = createAsyncThunk(
  'cookieConsent/rejectNonEssential',
  async (payload = {}, { rejectWithValue }) => {
    // payload: { platform?, state?, city? }
    try {
      const { data } = await API.post('/cookie-consent/reject', payload);
      return data; // { version, preferences }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to reject cookies.');
    }
  }
);

/** PATCH /api/cookie-consent/settings — granular toggle */
export const updateCookieSettings = createAsyncThunk(
  'cookieConsent/updateSettings',
  async (payload, { rejectWithValue }) => {
    // payload: { analytics?, marketing?, functional?, platform?, state?, city? }
    try {
      const { data } = await API.patch('/cookie-consent/settings', payload);
      return data; // { version, preferences }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to update cookie settings.');
    }
  }
);

/** DELETE /api/cookie-consent/withdraw — DPDP withdraw */
export const withdrawCookieConsent = createAsyncThunk(
  'cookieConsent/withdraw',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.delete('/cookie-consent/withdraw');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message ?? 'Failed to withdraw consent.');
    }
  }
);

// ── Initial State ──────────────────────────────────────────────────────────────

const initialState = {
  // Policy doc (banner content)
  policy: null,
  policyLoading: false,
  policyError: null,

  // User consent status
  hasConsented: false,
  version: null,
  consentedAt: null,

  // Preferences — mirrors server DEFAULT_REJECT_ALL until fetched
  preferences: {
    essential:  true,
    analytics:  false,
    marketing:  false,
    functional: false,
  },

  // Banner visibility — show if user hasn't consented current version
  showBanner: false,

  // Settings panel open state (UI only)
  settingsPanelOpen: false,

  // Async state
  loading: false,
  error: null,
};

// ── Slice ──────────────────────────────────────────────────────────────────────

const cookieConsentSlice = createSlice({
  name: 'cookieConsent',
  initialState,

  reducers: {
    /** Toggle settings panel open/close */
    toggleSettingsPanel(state) {
      state.settingsPanelOpen = !state.settingsPanelOpen;
    },
    openSettingsPanel(state) {
      state.settingsPanelOpen = true;
    },
    closeSettingsPanel(state) {
      state.settingsPanelOpen = false;
    },

    /** Dismiss banner without consent (guest / not logged in) */
    dismissBanner(state) {
      state.showBanner = false;
    },

    /** Optimistic local preference toggle (before save) */
    togglePreferenceLocal(state, action) {
      // action.payload: 'analytics' | 'marketing' | 'functional'
      const key = action.payload;
      if (key === 'essential') return; // locked
      state.preferences[key] = !state.preferences[key];
    },

    /** Reset error */
    clearCookieError(state) {
      state.error = null;
    },
  },

  extraReducers: (builder) => {

    // ── fetchCookiePolicy ────────────────────────────────────────────────────
    builder
      .addCase(fetchCookiePolicy.pending, (state) => {
        state.policyLoading = true;
        state.policyError   = null;
      })
      .addCase(fetchCookiePolicy.fulfilled, (state, { payload }) => {
        state.policyLoading = false;
        state.policy        = payload;
      })
      .addCase(fetchCookiePolicy.rejected, (state, { payload }) => {
        state.policyLoading = false;
        state.policyError   = payload;
      });

    // ── fetchCookieStatus ────────────────────────────────────────────────────
    builder
      .addCase(fetchCookieStatus.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchCookieStatus.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.hasConsented = payload.hasConsented;
        state.version      = payload.version;
        state.consentedAt  = payload.consentedAt ?? null;
        state.preferences  = payload.preferences ?? initialState.preferences;
        state.showBanner   = !payload.hasConsented;
      })
      .addCase(fetchCookieStatus.rejected, (state, { payload }) => {
        state.loading    = false;
        state.error      = payload;
        state.showBanner = true; // show banner if status fetch fails
      });

    // ── acceptAllCookies ─────────────────────────────────────────────────────
    builder
      .addCase(acceptAllCookies.pending, (state) => {
        state.loading = true;
      })
      .addCase(acceptAllCookies.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.hasConsented = true;
        state.version      = payload.version;
        state.preferences  = payload.preferences;
        state.showBanner   = false;
        state.settingsPanelOpen = false;
        toast.success('All cookies accepted.');
      })
      .addCase(acceptAllCookies.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
        toast.error(payload ?? 'Failed to accept cookies.');
      });

    // ── rejectNonEssentialCookies ────────────────────────────────────────────
    builder
      .addCase(rejectNonEssentialCookies.pending, (state) => {
        state.loading = true;
      })
      .addCase(rejectNonEssentialCookies.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.hasConsented = true;
        state.version      = payload.version;
        state.preferences  = payload.preferences;
        state.showBanner   = false;
        state.settingsPanelOpen = false;
        toast.success('Non-essential cookies rejected.');
      })
      .addCase(rejectNonEssentialCookies.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
        toast.error(payload ?? 'Failed to reject cookies.');
      });

    // ── updateCookieSettings ─────────────────────────────────────────────────
    builder
      .addCase(updateCookieSettings.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateCookieSettings.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.hasConsented = true;
        state.version      = payload.version;
        state.preferences  = payload.preferences;
        state.showBanner   = false;
        state.settingsPanelOpen = false;
        toast.success('Cookie settings saved.');
      })
      .addCase(updateCookieSettings.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
        toast.error(payload ?? 'Failed to save cookie settings.');
      });

    // ── withdrawCookieConsent ────────────────────────────────────────────────
    builder
      .addCase(withdrawCookieConsent.pending, (state) => {
        state.loading = true;
      })
      .addCase(withdrawCookieConsent.fulfilled, (state) => {
        state.loading      = false;
        state.hasConsented = false;
        state.preferences  = initialState.preferences;
        state.consentedAt  = null;
        state.showBanner   = true;
        toast.success('Cookie consent withdrawn.');
      })
      .addCase(withdrawCookieConsent.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
        toast.error(payload ?? 'Failed to withdraw consent.');
      });
  },
});

// ── Actions ───────────────────────────────────────────────────────────────────

export const {
  toggleSettingsPanel,
  openSettingsPanel,
  closeSettingsPanel,
  dismissBanner,
  togglePreferenceLocal,
  clearCookieError,
} = cookieConsentSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectCookiePolicy        = (s) => s.cookieConsent.policy;
export const selectCookiePreferences   = (s) => s.cookieConsent.preferences;
export const selectHasCookieConsented  = (s) => s.cookieConsent.hasConsented;
export const selectShowCookieBanner    = (s) => s.cookieConsent.showBanner;
export const selectSettingsPanelOpen   = (s) => s.cookieConsent.settingsPanelOpen;
export const selectCookieVersion       = (s) => s.cookieConsent.version;
export const selectCookieLoading       = (s) => s.cookieConsent.loading;
export const selectCookieError         = (s) => s.cookieConsent.error;

export default cookieConsentSlice.reducer;