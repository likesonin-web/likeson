import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';


// ═══════════════════════════════════════════════════════════════
// ASYNC THUNKS — TERMS & CONDITIONS
// ═══════════════════════════════════════════════════════════════

export const fetchActiveTerms = createAsyncThunk(
  'legal/fetchActiveTerms',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/legal/terms');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch Terms & Conditions');
    }
  }
);

export const fetchAllTermsVersions = createAsyncThunk(
  'legal/fetchAllTermsVersions',
  async ({ page = 1, limit = 10 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/legal/terms/all?page=${page}&limit=${limit}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch Terms versions');
    }
  }
);

export const fetchTermsById = createAsyncThunk(
  'legal/fetchTermsById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/legal/terms/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch Terms version');
    }
  }
);

export const createTerms = createAsyncThunk(
  'legal/createTerms',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/legal/terms', payload);
      toast.success('Terms & Conditions draft created successfully');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create Terms & Conditions';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const updateTerms = createAsyncThunk(
  'legal/updateTerms',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/legal/terms/${id}`, payload);
      toast.success('Terms & Conditions updated successfully');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update Terms & Conditions';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const publishTerms = createAsyncThunk(
  'legal/publishTerms',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/legal/terms/${id}/publish`);
      toast.success(data.message || 'Terms & Conditions published successfully');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to publish Terms & Conditions';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const deleteTerms = createAsyncThunk(
  'legal/deleteTerms',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/legal/terms/${id}`);
      toast.success('Draft Terms & Conditions deleted');
      return id;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete Terms & Conditions';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);


// ═══════════════════════════════════════════════════════════════
// ASYNC THUNKS — PRIVACY POLICY
// ═══════════════════════════════════════════════════════════════

export const fetchActivePrivacyPolicy = createAsyncThunk(
  'legal/fetchActivePrivacyPolicy',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/legal/privacy');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch Privacy Policy');
    }
  }
);

export const fetchAllPrivacyVersions = createAsyncThunk(
  'legal/fetchAllPrivacyVersions',
  async ({ page = 1, limit = 10 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/legal/privacy/all?page=${page}&limit=${limit}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch Privacy Policy versions');
    }
  }
);

export const fetchPrivacyById = createAsyncThunk(
  'legal/fetchPrivacyById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/legal/privacy/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch Privacy Policy version');
    }
  }
);

export const createPrivacyPolicy = createAsyncThunk(
  'legal/createPrivacyPolicy',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/legal/privacy', payload);
      toast.success('Privacy Policy draft created successfully');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create Privacy Policy';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const updatePrivacyPolicy = createAsyncThunk(
  'legal/updatePrivacyPolicy',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/legal/privacy/${id}`, payload);
      toast.success('Privacy Policy updated successfully');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update Privacy Policy';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const publishPrivacyPolicy = createAsyncThunk(
  'legal/publishPrivacyPolicy',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/legal/privacy/${id}/publish`);
      toast.success(data.message || 'Privacy Policy published successfully');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to publish Privacy Policy';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const deletePrivacyPolicy = createAsyncThunk(
  'legal/deletePrivacyPolicy',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/legal/privacy/${id}`);
      toast.success('Draft Privacy Policy deleted');
      return id;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete Privacy Policy';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);


// ═══════════════════════════════════════════════════════════════
// ASYNC THUNKS — USER CONSENT
// ═══════════════════════════════════════════════════════════════

export const recordConsent = createAsyncThunk(
  'legal/recordConsent',
  async ({ method = 'explicit_checkbox', platform = 'web', deviceName } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/legal/consent', { method, platform, deviceName });
      toast.success('Your consent has been recorded. Thank you!');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to record consent';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchMyConsents = createAsyncThunk(
  'legal/fetchMyConsents',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/legal/consent/me');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch your consent history');
    }
  }
);

export const fetchConsentStatus = createAsyncThunk(
  'legal/fetchConsentStatus',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/legal/consent/status');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch consent status');
    }
  }
);

export const fetchAllUserConsents = createAsyncThunk(
  'legal/fetchAllUserConsents',
  async ({ userId, platform, method, page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (userId) params.append('userId', userId);
      if (platform) params.append('platform', platform);
      if (method) params.append('method', method);

      const { data } = await API.get(`/legal/consent/users?${params.toString()}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch user consents');
    }
  }
);

export const withdrawConsent = createAsyncThunk(
  'legal/withdrawConsent',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/legal/consent/${id}/withdraw`, { reason });
      toast.success('Consent withdrawn successfully');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to withdraw consent';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);


// ═══════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════

const initialState = {
  // ── Terms ──────────────────────────────────
  terms: {
    active: null,           // Currently published Terms document
    selected: null,         // A single version being viewed/edited
    allVersions: [],
    pagination: { total: 0, page: 1, pages: 1 },
    loading: false,
    submitting: false,      // Create / update / publish / delete
    error: null,
  },

  // ── Privacy Policy ─────────────────────────
  privacy: {
    active: null,
    selected: null,
    allVersions: [],
    pagination: { total: 0, page: 1, pages: 1 },
    loading: false,
    submitting: false,
    error: null,
  },

  // ── Consent ────────────────────────────────
  consent: {
    myHistory: [],          // Current user's consent records
    allUsers: [],           // Admin view of all users' consents
    pagination: { total: 0, page: 1, pages: 1 },
    status: {               // From /consent/status
      termsAccepted: false,
      privacyAccepted: false,
      consentRequired: true,
      activeTermsVersion: null,
      activePrivacyVersion: null,
    },
    loading: false,
    submitting: false,
    error: null,
  },
};


// ═══════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════

const legalSlice = createSlice({
  name: 'legal',
  initialState,

  reducers: {
    clearTermsError: (state) => { state.terms.error = null; },
    clearPrivacyError: (state) => { state.privacy.error = null; },
    clearConsentError: (state) => { state.consent.error = null; },
    clearSelectedTerms: (state) => { state.terms.selected = null; },
    clearSelectedPrivacy: (state) => { state.privacy.selected = null; },
    resetLegalState: () => initialState,
  },

  extraReducers: (builder) => {

    // ─────────────────────────────────────────
    // TERMS & CONDITIONS
    // ─────────────────────────────────────────

    // Fetch Active
    builder
      .addCase(fetchActiveTerms.pending, (state) => {
        state.terms.loading = true;
        state.terms.error = null;
      })
      .addCase(fetchActiveTerms.fulfilled, (state, { payload }) => {
        state.terms.loading = false;
        state.terms.active = payload;
      })
      .addCase(fetchActiveTerms.rejected, (state, { payload }) => {
        state.terms.loading = false;
        state.terms.error = payload;
      });

    // Fetch All Versions
    builder
      .addCase(fetchAllTermsVersions.pending, (state) => {
        state.terms.loading = true;
        state.terms.error = null;
      })
      .addCase(fetchAllTermsVersions.fulfilled, (state, { payload }) => {
        state.terms.loading = false;
        state.terms.allVersions = payload.data;
        state.terms.pagination = {
          total: payload.total,
          page: payload.page,
          pages: payload.pages,
        };
      })
      .addCase(fetchAllTermsVersions.rejected, (state, { payload }) => {
        state.terms.loading = false;
        state.terms.error = payload;
      });

    // Fetch By ID
    builder
      .addCase(fetchTermsById.pending, (state) => {
        state.terms.loading = true;
        state.terms.error = null;
      })
      .addCase(fetchTermsById.fulfilled, (state, { payload }) => {
        state.terms.loading = false;
        state.terms.selected = payload;
      })
      .addCase(fetchTermsById.rejected, (state, { payload }) => {
        state.terms.loading = false;
        state.terms.error = payload;
      });

    // Create
    builder
      .addCase(createTerms.pending, (state) => {
        state.terms.submitting = true;
        state.terms.error = null;
      })
      .addCase(createTerms.fulfilled, (state, { payload }) => {
        state.terms.submitting = false;
        state.terms.allVersions.unshift(payload);
      })
      .addCase(createTerms.rejected, (state, { payload }) => {
        state.terms.submitting = false;
        state.terms.error = payload;
      });

    // Update
    builder
      .addCase(updateTerms.pending, (state) => {
        state.terms.submitting = true;
        state.terms.error = null;
      })
      .addCase(updateTerms.fulfilled, (state, { payload }) => {
        state.terms.submitting = false;
        state.terms.selected = payload;
        const idx = state.terms.allVersions.findIndex((t) => t._id === payload._id);
        if (idx !== -1) state.terms.allVersions[idx] = payload;
      })
      .addCase(updateTerms.rejected, (state, { payload }) => {
        state.terms.submitting = false;
        state.terms.error = payload;
      });

    // Publish
    builder
      .addCase(publishTerms.pending, (state) => {
        state.terms.submitting = true;
        state.terms.error = null;
      })
      .addCase(publishTerms.fulfilled, (state, { payload }) => {
        state.terms.submitting = false;
        state.terms.active = payload;
        // Mark all others as inactive in local state
        state.terms.allVersions = state.terms.allVersions.map((t) => ({
          ...t,
          isActive: t._id === payload._id,
        }));
      })
      .addCase(publishTerms.rejected, (state, { payload }) => {
        state.terms.submitting = false;
        state.terms.error = payload;
      });

    // Delete
    builder
      .addCase(deleteTerms.pending, (state) => {
        state.terms.submitting = true;
        state.terms.error = null;
      })
      .addCase(deleteTerms.fulfilled, (state, { payload }) => {
        state.terms.submitting = false;
        state.terms.allVersions = state.terms.allVersions.filter((t) => t._id !== payload);
        if (state.terms.selected?._id === payload) state.terms.selected = null;
      })
      .addCase(deleteTerms.rejected, (state, { payload }) => {
        state.terms.submitting = false;
        state.terms.error = payload;
      });


    // ─────────────────────────────────────────
    // PRIVACY POLICY
    // ─────────────────────────────────────────

    builder
      .addCase(fetchActivePrivacyPolicy.pending, (state) => {
        state.privacy.loading = true;
        state.privacy.error = null;
      })
      .addCase(fetchActivePrivacyPolicy.fulfilled, (state, { payload }) => {
        state.privacy.loading = false;
        state.privacy.active = payload;
      })
      .addCase(fetchActivePrivacyPolicy.rejected, (state, { payload }) => {
        state.privacy.loading = false;
        state.privacy.error = payload;
      });

    builder
      .addCase(fetchAllPrivacyVersions.pending, (state) => {
        state.privacy.loading = true;
        state.privacy.error = null;
      })
      .addCase(fetchAllPrivacyVersions.fulfilled, (state, { payload }) => {
        state.privacy.loading = false;
        state.privacy.allVersions = payload.data;
        state.privacy.pagination = {
          total: payload.total,
          page: payload.page,
          pages: payload.pages,
        };
      })
      .addCase(fetchAllPrivacyVersions.rejected, (state, { payload }) => {
        state.privacy.loading = false;
        state.privacy.error = payload;
      });

    builder
      .addCase(fetchPrivacyById.pending, (state) => {
        state.privacy.loading = true;
        state.privacy.error = null;
      })
      .addCase(fetchPrivacyById.fulfilled, (state, { payload }) => {
        state.privacy.loading = false;
        state.privacy.selected = payload;
      })
      .addCase(fetchPrivacyById.rejected, (state, { payload }) => {
        state.privacy.loading = false;
        state.privacy.error = payload;
      });

    builder
      .addCase(createPrivacyPolicy.pending, (state) => {
        state.privacy.submitting = true;
        state.privacy.error = null;
      })
      .addCase(createPrivacyPolicy.fulfilled, (state, { payload }) => {
        state.privacy.submitting = false;
        state.privacy.allVersions.unshift(payload);
      })
      .addCase(createPrivacyPolicy.rejected, (state, { payload }) => {
        state.privacy.submitting = false;
        state.privacy.error = payload;
      });

    builder
      .addCase(updatePrivacyPolicy.pending, (state) => {
        state.privacy.submitting = true;
        state.privacy.error = null;
      })
      .addCase(updatePrivacyPolicy.fulfilled, (state, { payload }) => {
        state.privacy.submitting = false;
        state.privacy.selected = payload;
        const idx = state.privacy.allVersions.findIndex((p) => p._id === payload._id);
        if (idx !== -1) state.privacy.allVersions[idx] = payload;
      })
      .addCase(updatePrivacyPolicy.rejected, (state, { payload }) => {
        state.privacy.submitting = false;
        state.privacy.error = payload;
      });

    builder
      .addCase(publishPrivacyPolicy.pending, (state) => {
        state.privacy.submitting = true;
        state.privacy.error = null;
      })
      .addCase(publishPrivacyPolicy.fulfilled, (state, { payload }) => {
        state.privacy.submitting = false;
        state.privacy.active = payload;
        state.privacy.allVersions = state.privacy.allVersions.map((p) => ({
          ...p,
          isActive: p._id === payload._id,
        }));
      })
      .addCase(publishPrivacyPolicy.rejected, (state, { payload }) => {
        state.privacy.submitting = false;
        state.privacy.error = payload;
      });

    builder
      .addCase(deletePrivacyPolicy.pending, (state) => {
        state.privacy.submitting = true;
        state.privacy.error = null;
      })
      .addCase(deletePrivacyPolicy.fulfilled, (state, { payload }) => {
        state.privacy.submitting = false;
        state.privacy.allVersions = state.privacy.allVersions.filter((p) => p._id !== payload);
        if (state.privacy.selected?._id === payload) state.privacy.selected = null;
      })
      .addCase(deletePrivacyPolicy.rejected, (state, { payload }) => {
        state.privacy.submitting = false;
        state.privacy.error = payload;
      });


    // ─────────────────────────────────────────
    // USER CONSENT
    // ─────────────────────────────────────────

    builder
      .addCase(recordConsent.pending, (state) => {
        state.consent.submitting = true;
        state.consent.error = null;
      })
      .addCase(recordConsent.fulfilled, (state, { payload }) => {
        state.consent.submitting = false;
        state.consent.myHistory.unshift(payload);
        // Immediately reflect acceptance in status
        state.consent.status.termsAccepted = true;
        state.consent.status.privacyAccepted = true;
        state.consent.status.consentRequired = false;
      })
      .addCase(recordConsent.rejected, (state, { payload }) => {
        state.consent.submitting = false;
        state.consent.error = payload;
      });

    builder
      .addCase(fetchMyConsents.pending, (state) => {
        state.consent.loading = true;
        state.consent.error = null;
      })
      .addCase(fetchMyConsents.fulfilled, (state, { payload }) => {
        state.consent.loading = false;
        state.consent.myHistory = payload;
      })
      .addCase(fetchMyConsents.rejected, (state, { payload }) => {
        state.consent.loading = false;
        state.consent.error = payload;
      });

    builder
      .addCase(fetchConsentStatus.pending, (state) => {
        state.consent.loading = true;
        state.consent.error = null;
      })
      .addCase(fetchConsentStatus.fulfilled, (state, { payload }) => {
        state.consent.loading = false;
        state.consent.status = payload;
      })
      .addCase(fetchConsentStatus.rejected, (state, { payload }) => {
        state.consent.loading = false;
        state.consent.error = payload;
      });

    builder
      .addCase(fetchAllUserConsents.pending, (state) => {
        state.consent.loading = true;
        state.consent.error = null;
      })
      .addCase(fetchAllUserConsents.fulfilled, (state, { payload }) => {
        state.consent.loading = false;
        state.consent.allUsers = payload.data;
        state.consent.pagination = {
          total: payload.total,
          page: payload.page,
          pages: payload.pages,
        };
      })
      .addCase(fetchAllUserConsents.rejected, (state, { payload }) => {
        state.consent.loading = false;
        state.consent.error = payload;
      });

    builder
      .addCase(withdrawConsent.pending, (state) => {
        state.consent.submitting = true;
        state.consent.error = null;
      })
      .addCase(withdrawConsent.fulfilled, (state, { payload }) => {
        state.consent.submitting = false;
        const idx = state.consent.myHistory.findIndex((c) => c._id === payload._id);
        if (idx !== -1) state.consent.myHistory[idx] = payload;
        const adminIdx = state.consent.allUsers.findIndex((c) => c._id === payload._id);
        if (adminIdx !== -1) state.consent.allUsers[adminIdx] = payload;
      })
      .addCase(withdrawConsent.rejected, (state, { payload }) => {
        state.consent.submitting = false;
        state.consent.error = payload;
      });
  },
});


// ═══════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════

export const {
  clearTermsError,
  clearPrivacyError,
  clearConsentError,
  clearSelectedTerms,
  clearSelectedPrivacy,
  resetLegalState,
} = legalSlice.actions;


// ═══════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════

// Terms
export const selectActiveTerms         = (state) => state.legal.terms.active;
export const selectSelectedTerms       = (state) => state.legal.terms.selected;
export const selectAllTermsVersions    = (state) => state.legal.terms.allVersions;
export const selectTermsPagination     = (state) => state.legal.terms.pagination;
export const selectTermsLoading        = (state) => state.legal.terms.loading;
export const selectTermsSubmitting     = (state) => state.legal.terms.submitting;
export const selectTermsError          = (state) => state.legal.terms.error;

// Privacy
export const selectActivePrivacy       = (state) => state.legal.privacy.active;
export const selectSelectedPrivacy     = (state) => state.legal.privacy.selected;
export const selectAllPrivacyVersions  = (state) => state.legal.privacy.allVersions;
export const selectPrivacyPagination   = (state) => state.legal.privacy.pagination;
export const selectPrivacyLoading      = (state) => state.legal.privacy.loading;
export const selectPrivacySubmitting   = (state) => state.legal.privacy.submitting;
export const selectPrivacyError        = (state) => state.legal.privacy.error;

// Consent
export const selectMyConsents          = (state) => state.legal.consent.myHistory;
export const selectAllUserConsents     = (state) => state.legal.consent.allUsers;
export const selectConsentPagination   = (state) => state.legal.consent.pagination;
export const selectConsentStatus       = (state) => state.legal.consent.status;
export const selectConsentRequired     = (state) => state.legal.consent.status.consentRequired;
export const selectConsentLoading      = (state) => state.legal.consent.loading;
export const selectConsentSubmitting   = (state) => state.legal.consent.submitting;
export const selectConsentError        = (state) => state.legal.consent.error;


export default legalSlice.reducer;