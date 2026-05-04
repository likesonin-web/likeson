import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════════════════════
// ── UTILITIES ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracts a clean error message from Axios error responses.
 * Never exposes raw server internals to the Redux state.
 */
const extractError = (err) => {
  const data = err?.response?.data;
  if (!data) return err?.message ?? 'An unexpected error occurred.';
  if (data.errors?.length) {
    return data.errors.map((e) => e.message).join(', ');
  }
  return data.message ?? 'Something went wrong.';
};

/**
 * Generates a standard async status record.
 * Keeps loading/error state co-located per operation key.
 */
const asyncStatus = () => ({ loading: false, error: null });

// ═══════════════════════════════════════════════════════════════════════════════
// ── INITIAL STATE ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // §A — Profile
  profile: null,

  // §B — Status & Location
  driverStatus: null,   // 'Available' | 'Offline' | 'On-Break' | 'On-Trip' | 'Suspended'

  // §C — KYC & Documents
  kyc:     null,
  medical: null,

  // §D — Bank Details
  bank: null,

  // §E — Earnings & Rewards
  earnings:     null,
  performance:  null,
  badges:       null,
  coinTransactions: {
    data:       [],
    coinBalance: 0,
    tier:        null,
    pagination: {
      total:      0,
      page:       1,
      limit:      20,
      totalPages: 0,
      hasNext:    false,
      hasPrev:    false,
    },
  },

  // §F — Onboarding & Settings
  onboarding:        null,
  notifPrefs:        null,

  // §G — Read-only Lookups
  vehicle:    null,
  agency:     null,
  compliance: null,

  // ── Per-operation async status map ──────────────────────────────────────────
  ops: {
    fetchProfile:              asyncStatus(),
    updateProfile:             asyncStatus(),
    updateStatus:              asyncStatus(),
    updateLocation:            asyncStatus(),
    fetchKyc:                  asyncStatus(),
    submitKyc:                 asyncStatus(),
    fetchMedical:              asyncStatus(),
    updateMedical:             asyncStatus(),
    fetchBank:                 asyncStatus(),
    updateBank:                asyncStatus(),
    fetchEarnings:             asyncStatus(),
    fetchCoinTransactions:     asyncStatus(),
    fetchBadges:               asyncStatus(),
    fetchPerformance:          asyncStatus(),
    fetchOnboarding:           asyncStatus(),
    acceptTerms:               asyncStatus(),
    updateNotifPrefs:          asyncStatus(),
    fetchVehicle:              asyncStatus(),
    fetchAgency:               asyncStatus(),
    fetchCompliance:           asyncStatus(),
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ── §A  PROFILE ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchProfile = createAsyncThunk(
  'driver/fetchProfile',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchProfile.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/profile');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const updateProfile = createAsyncThunk(
  'driver/updateProfile',
  async (payload, { rejectWithValue, getState }) => {
    if (getState().driver.ops.updateProfile.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.patch('/driver/profile', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §B  STATUS & LOCATION ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const updateDriverStatus = createAsyncThunk(
  'driver/updateStatus',
  async (status, { rejectWithValue, getState }) => {
    if (getState().driver.ops.updateStatus.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.patch('/driver/status', { status });
      return data.data; // { status }
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const updateDriverLocation = createAsyncThunk(
  'driver/updateLocation',
  async ({ coordinates, heading, speedKmh }, { rejectWithValue }) => {
    try {
      await API.patch('/driver/location', { coordinates, heading, speedKmh });
      return true;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §C  KYC & DOCUMENTS ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchKyc = createAsyncThunk(
  'driver/fetchKyc',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchKyc.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/kyc');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const submitKyc = createAsyncThunk(
  'driver/submitKyc',
  async (kycPayload, { rejectWithValue, getState }) => {
    if (getState().driver.ops.submitKyc.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.patch('/driver/kyc', { kyc: kycPayload });
      return data.data; // { kycStatus: 'Pending' }
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchMedical = createAsyncThunk(
  'driver/fetchMedical',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchMedical.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/medical');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const updateMedical = createAsyncThunk(
  'driver/updateMedical',
  async (payload, { rejectWithValue, getState }) => {
    if (getState().driver.ops.updateMedical.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.patch('/driver/medical', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §D  BANK DETAILS ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchBank = createAsyncThunk(
  'driver/fetchBank',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchBank.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/bank');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const updateBank = createAsyncThunk(
  'driver/updateBank',
  async (bankPayload, { rejectWithValue, getState }) => {
    if (getState().driver.ops.updateBank.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.patch('/driver/bank', { bankDetails: bankPayload });
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §E  EARNINGS & REWARDS ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchEarnings = createAsyncThunk(
  'driver/fetchEarnings',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchEarnings.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/earnings');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/**
 * params: { page?, limit?, type? }
 */
export const fetchCoinTransactions = createAsyncThunk(
  'driver/fetchCoinTransactions',
  async (params = {}, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchCoinTransactions.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/coin-transactions', { params });
      return {
        transactions: data.data.transactions,
        coinBalance:  data.data.coinBalance,
        tier:         data.data.tier,
        pagination:   data.pagination,
      };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchBadges = createAsyncThunk(
  'driver/fetchBadges',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchBadges.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/badges');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchPerformance = createAsyncThunk(
  'driver/fetchPerformance',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchPerformance.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/performance');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §F  ONBOARDING & SETTINGS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchOnboarding = createAsyncThunk(
  'driver/fetchOnboarding',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchOnboarding.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/onboarding');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const acceptTerms = createAsyncThunk(
  'driver/acceptTerms',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.acceptTerms.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.post('/driver/onboarding/accept-terms');
      return data.data; // { acceptedAt } | undefined (already accepted)
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/**
 * payload: { smsAlerts?, whatsappAlerts?, pushNotifications? }
 */
export const updateNotifPrefs = createAsyncThunk(
  'driver/updateNotifPrefs',
  async (payload, { rejectWithValue, getState }) => {
    if (getState().driver.ops.updateNotifPrefs.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.patch('/driver/notification-preferences', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── §G  READ-ONLY LOOKUPS ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchVehicle = createAsyncThunk(
  'driver/fetchVehicle',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchVehicle.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/vehicle');
      return data.data; // null if not assigned
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchAgency = createAsyncThunk(
  'driver/fetchAgency',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchAgency.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/agency');
      return data.data; // null if not linked
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchCompliance = createAsyncThunk(
  'driver/fetchCompliance',
  async (_, { rejectWithValue, getState }) => {
    if (getState().driver.ops.fetchCompliance.loading) return rejectWithValue('Request in progress.');
    try {
      const { data } = await API.get('/driver/compliance');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── SLICE ──────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Helper: builds the three lifecycle case reducers for a given op key,
 * applying the fulfilled handler only when provided.
 */
const buildCases = (builder, thunk, opKey, onFulfilled) => {
  builder
    .addCase(thunk.pending, (state) => {
      state.ops[opKey].loading = true;
      state.ops[opKey].error   = null;
    })
    .addCase(thunk.fulfilled, (state, action) => {
      state.ops[opKey].loading = false;
      state.ops[opKey].error   = null;
      if (onFulfilled) onFulfilled(state, action);
    })
    .addCase(thunk.rejected, (state, action) => {
      state.ops[opKey].loading = false;
      state.ops[opKey].error   = action.payload ?? 'Unknown error.';
    });
};

const driverSlice = createSlice({
  name: 'driver',
  initialState,

  reducers: {
    /** Hard reset — call on logout to clear all driver state. */
    resetDriverState: () => initialState,

    /** Optimistically update local status (e.g., after socket push). */
    setDriverStatusLocal: (state, action) => {
      state.driverStatus = action.payload;
      if (state.profile) state.profile.status = action.payload;
    },

    /** Clear per-operation error for a given op key (for form retry UX). */
    clearOpError: (state, action) => {
      const opKey = action.payload;
      if (state.ops[opKey]) state.ops[opKey].error = null;
    },

    /** Clear all op errors at once (e.g., on route change). */
    clearAllOpErrors: (state) => {
      for (const key of Object.keys(state.ops)) {
        state.ops[key].error = null;
      }
    },

    /** Patch coin balance locally (e.g., after socket COIN_UPDATED event). */
    updateCoinBalanceLocal: (state, action) => {
      state.coinTransactions.coinBalance = action.payload;
    },
  },

  extraReducers: (builder) => {
    // ── §A  Profile ──────────────────────────────────────────────────────────

    buildCases(builder, fetchProfile, 'fetchProfile', (state, { payload }) => {
      state.profile      = payload;
      state.driverStatus = payload?.status ?? state.driverStatus;
    });

    buildCases(builder, updateProfile, 'updateProfile', (state, { payload }) => {
      state.profile = payload;
      toast.success('Profile updated successfully.');
    });

    // ── §B  Status & Location ────────────────────────────────────────────────

    buildCases(builder, updateDriverStatus, 'updateStatus', (state, { payload }) => {
      state.driverStatus = payload.status;
      if (state.profile) state.profile.status = payload.status;
      toast.success(`You are now ${payload.status}.`);
    });

    // Location update is silent — no toast, no state mutation needed
    buildCases(builder, updateDriverLocation, 'updateLocation');

    // ── §C  KYC & Documents ──────────────────────────────────────────────────

    buildCases(builder, fetchKyc, 'fetchKyc', (state, { payload }) => {
      state.kyc = payload;
    });

    buildCases(builder, submitKyc, 'submitKyc', (state, { payload }) => {
      if (state.kyc) state.kyc.verificationStatus = payload?.kycStatus ?? 'Pending';
      toast.success('KYC submitted. Pending admin review.');
    });

    buildCases(builder, fetchMedical, 'fetchMedical', (state, { payload }) => {
      state.medical = payload;
    });

    buildCases(builder, updateMedical, 'updateMedical', (state, { payload }) => {
      state.medical = payload;
      toast.success('Medical fitness updated.');
    });

    // ── §D  Bank ─────────────────────────────────────────────────────────────

    buildCases(builder, fetchBank, 'fetchBank', (state, { payload }) => {
      state.bank = payload;
    });

    buildCases(builder, updateBank, 'updateBank', (state, { payload }) => {
      // Merge partial response (only last4, bankName, isBankVerified returned)
      state.bank = { ...(state.bank ?? {}), ...payload };
      toast.success('Bank details updated. Verification pending.');
    });

    // ── §E  Earnings & Rewards ────────────────────────────────────────────────

    buildCases(builder, fetchEarnings, 'fetchEarnings', (state, { payload }) => {
      state.earnings = payload;
    });

    buildCases(builder, fetchCoinTransactions, 'fetchCoinTransactions', (state, { payload }) => {
      state.coinTransactions.data        = payload.transactions;
      state.coinTransactions.coinBalance = payload.coinBalance;
      state.coinTransactions.tier        = payload.tier;
      state.coinTransactions.pagination  = payload.pagination;
    });

    buildCases(builder, fetchBadges, 'fetchBadges', (state, { payload }) => {
      state.badges = payload;
    });

    buildCases(builder, fetchPerformance, 'fetchPerformance', (state, { payload }) => {
      state.performance = payload;
    });

    // ── §F  Onboarding & Settings ─────────────────────────────────────────────

    buildCases(builder, fetchOnboarding, 'fetchOnboarding', (state, { payload }) => {
      state.onboarding = payload;
    });

    buildCases(builder, acceptTerms, 'acceptTerms', (state, { payload }) => {
      if (state.onboarding) {
        state.onboarding.checklist = {
          ...(state.onboarding.checklist ?? {}),
          agreedToTerms: true,
        };
        if (payload?.acceptedAt && state.onboarding.onboarding) {
          state.onboarding.onboarding.agreedToTermsAt = payload.acceptedAt;
        }
      }
      toast.success('Terms & conditions accepted.');
    });

    buildCases(builder, updateNotifPrefs, 'updateNotifPrefs', (state, { payload }) => {
      state.notifPrefs = payload;
      toast.success('Notification preferences updated.');
    });

    // ── §G  Read-only Lookups ─────────────────────────────────────────────────

    buildCases(builder, fetchVehicle, 'fetchVehicle', (state, { payload }) => {
      state.vehicle = payload; // null if not assigned
    });

    buildCases(builder, fetchAgency, 'fetchAgency', (state, { payload }) => {
      state.agency = payload; // null if not linked
    });

    buildCases(builder, fetchCompliance, 'fetchCompliance', (state, { payload }) => {
      state.compliance = payload;
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── ACTIONS ────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const {
  resetDriverState,
  setDriverStatusLocal,
  clearOpError,
  clearAllOpErrors,
  updateCoinBalanceLocal,
} = driverSlice.actions;

// ═══════════════════════════════════════════════════════════════════════════════
// ── SELECTORS ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const s = (state) => state.driver;

// ── Data selectors ────────────────────────────────────────────────────────────
export const selectProfile              = (state) => s(state).profile;
export const selectDriverStatus         = (state) => s(state).driverStatus;
export const selectKyc                  = (state) => s(state).kyc;
export const selectMedical              = (state) => s(state).medical;
export const selectBank                 = (state) => s(state).bank;
export const selectEarnings             = (state) => s(state).earnings;
export const selectCoinTransactions     = (state) => s(state).coinTransactions;
export const selectBadges               = (state) => s(state).badges;
export const selectPerformance          = (state) => s(state).performance;
export const selectOnboarding           = (state) => s(state).onboarding;
export const selectNotifPrefs           = (state) => s(state).notifPrefs;
export const selectVehicle              = (state) => s(state).vehicle;
export const selectAgency               = (state) => s(state).agency;
export const selectCompliance           = (state) => s(state).compliance;

// ── Op selectors (loading / error per operation) ──────────────────────────────
export const selectOp = (opKey) => (state) => s(state).ops[opKey];

export const selectOpLoading = (opKey) => (state) => s(state).ops[opKey]?.loading ?? false;
export const selectOpError   = (opKey) => (state) => s(state).ops[opKey]?.error   ?? null;

// ── Derived convenience selectors ─────────────────────────────────────────────
export const selectIsOnline             = (state) => s(state).driverStatus === 'Available';
export const selectIsKycVerified        = (state) => s(state).kyc?.verificationStatus === 'Verified';
export const selectIsOnboardingComplete = (state) =>
  s(state).onboarding?.isOnboardingComplete ?? false;

export const selectHasVehicle = (state) =>
  !!s(state).vehicle?.snapshot?.registrationNumber;

export const selectCoinBalance = (state) =>
  s(state).coinTransactions.coinBalance;

export const selectRewardTier = (state) =>
  s(state).coinTransactions.tier ?? s(state).badges?.tier ?? null;

export const selectHasExpiringCompliance = (state) =>
  s(state).compliance?.hasExpiringCompliance ?? false;

// ═══════════════════════════════════════════════════════════════════════════════

export default driverSlice.reducer;