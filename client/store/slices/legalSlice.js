import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const DOCUMENT_TYPES = [
  'terms_and_conditions',
  'privacy_policy',
  'refund_policy',
  'cookie_policy',
  'disclaimer',
];

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // ── Public ──────────────────────────────────────────────────────────────────
  activeDocs:      {},        // { terms_and_conditions: {...}, privacy_policy: {...} }
  activeDocsList:  [],        // footer list — all published docs
  activeDocsError: null,

  // ── Consent ─────────────────────────────────────────────────────────────────
  consentStatus: {
    // { terms_and_conditions: { accepted, currentVersion, effectiveDate }, ... }
  },
  consentRequired:   false,
  consentHistory:    [],
  consentLoading:    false,
  consentError:      null,

  // ── Admin — list ────────────────────────────────────────────────────────────
  adminDocs:    [],
  adminTotal:   0,
  adminPage:    1,
  adminPages:   0,
  adminLoading: false,
  adminError:   null,

  // ── Admin — single doc ───────────────────────────────────────────────────────
  selectedDoc:         null,
  selectedDocLoading:  false,
  selectedDocError:    null,

  // ── Admin — version history ──────────────────────────────────────────────────
  versionHistory:        [],
  versionHistoryLoading: false,
  versionHistoryError:   null,

  // ── Admin — consents ─────────────────────────────────────────────────────────
  docConsents:        [],
  docConsentsTotal:   0,
  docConsentsPages:   0,
  docConsentsLoading: false,
  docConsentsError:   null,

  // ── Admin — cross-doc consent report ─────────────────────────────────────────
  allConsents:        [],
  allConsentsTotal:   0,
  allConsentsPages:   0,
  allConsentsLoading: false,
  allConsentsError:   null,

  // ── Checksum ──────────────────────────────────────────────────────────────────
  checksumResult:  null,
  checksumLoading: false,
  checksumError:   null,

  // ── Mutation loading flags (keyed by action name) ────────────────────────────
  mutating: {},   // { 'publishDoc/64abc': true }
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Extract error message from axios error or plain Error */
const extractError = (err) =>
  err?.response?.data?.message ?? err?.message ?? 'Something went wrong.';

/** Mutation key used in `mutating` map */
const mKey = (name, id = '') => (id ? `${name}/${id}` : name);

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all active published docs (footer / onboarding list)
 * GET /api/legal/active
 */
export const fetchActiveDocs = createAsyncThunk(
  'legal/fetchActiveDocs',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/legal/active');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/**
 * Fetch single active doc by type
 * GET /api/legal/:type?platform=&audience=
 */
export const fetchActiveDocByType = createAsyncThunk(
  'legal/fetchActiveDocByType',
  async ({ type, platform, audience } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (platform) params.platform = platform;
      if (audience) params.audience = audience;
      const { data } = await API.get(`/legal/${type}`, { params });
      return { type, doc: data.data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENT THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check consent status for current user
 * GET /api/legal/consent/status
 */
export const fetchConsentStatus = createAsyncThunk(
  'legal/fetchConsentStatus',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/legal/consent/status');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/**
 * Fetch current user's consent history
 * GET /api/legal/consent/me
 */
export const fetchMyConsentHistory = createAsyncThunk(
  'legal/fetchMyConsentHistory',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/legal/consent/me');
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/**
 * Record consent for one or more document types
 * POST /api/legal/consent
 * @param {Object} payload { documentTypes, method, platform, state, city }
 */
export const recordConsent = createAsyncThunk(
  'legal/recordConsent',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.post('/legal/consent', payload);
      toast.success('Consent recorded successfully.');
      // Refresh consent status after recording
      dispatch(fetchConsentStatus());
      return data.data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Withdraw consent for a specific document type + version
 * PATCH /api/legal/consent/withdraw
 * @param {Object} payload { documentType, version, reason }
 */
export const withdrawConsent = createAsyncThunk(
  'legal/withdrawConsent',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.patch('/legal/consent/withdraw', payload);
      toast.success('Consent withdrawn.');
      dispatch(fetchConsentStatus());
      dispatch(fetchMyConsentHistory());
      return data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — LIST / FETCH THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * List all documents with pagination + filters
 * GET /api/legal/admin/all
 * @param {Object} params { type, status, platform, audience, page, limit }
 */
export const fetchAdminDocs = createAsyncThunk(
  'legal/fetchAdminDocs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/legal/admin/all', { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/**
 * Fetch single document by ID (full, with sections + version history)
 * GET /api/legal/admin/:id
 */
export const fetchAdminDocById = createAsyncThunk(
  'legal/fetchAdminDocById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/legal/admin/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/**
 * Fetch version history of a document
 * GET /api/legal/admin/:id/version-history
 */
export const fetchVersionHistory = createAsyncThunk(
  'legal/fetchVersionHistory',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/legal/admin/${id}/version-history`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/**
 * Fetch consents for a specific document
 * GET /api/legal/admin/:id/consents
 * @param {Object} { id, page, limit, withdrawn, version }
 */
export const fetchDocConsents = createAsyncThunk(
  'legal/fetchDocConsents',
  async ({ id, ...params }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/legal/admin/${id}/consents`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/**
 * Cross-doc consent report (all users)
 * GET /api/legal/admin/consents/users
 * @param {Object} params { userId, platform, method, page, limit }
 */
export const fetchAllConsents = createAsyncThunk(
  'legal/fetchAllConsents',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/legal/admin/consents/users', { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — MUTATION THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create new draft document
 * POST /api/legal/admin
 */
export const createLegalDoc = createAsyncThunk(
  'legal/createLegalDoc',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/legal/admin', payload);
      toast.success('Document created as draft.');
      return data.data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Update draft document
 * PATCH /api/legal/admin/:id
 */
export const updateLegalDoc = createAsyncThunk(
  'legal/updateLegalDoc',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/legal/admin/${id}`, payload);
      toast.success('Document updated.');
      return data.data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Submit draft → review
 * PATCH /api/legal/admin/:id/submit-review
 */
export const submitDocForReview = createAsyncThunk(
  'legal/submitDocForReview',
  async (id, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.patch(`/legal/admin/${id}/submit-review`);
      toast.success('Document submitted for review.');
      dispatch(fetchAdminDocById(id));
      return data.data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Approve document (review → approved)
 * PATCH /api/legal/admin/:id/approve
 */
export const approveDoc = createAsyncThunk(
  'legal/approveDoc',
  async (id, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.patch(`/legal/admin/${id}/approve`);
      toast.success('Document approved.');
      dispatch(fetchAdminDocById(id));
      return data.data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Publish document → active (auto-supersedes current active)
 * PATCH /api/legal/admin/:id/publish
 * @param {Object} { id, changeSummary }
 */
export const publishDoc = createAsyncThunk(
  'legal/publishDoc',
  async ({ id, changeSummary = 'Published' }, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.patch(`/legal/admin/${id}/publish`, { changeSummary });
      toast.success(`Document is now live.`);
      dispatch(fetchAdminDocById(id));
      dispatch(fetchActiveDocs());
      return data.data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Clone active doc as new draft with bumped version
 * PATCH /api/legal/admin/:id/new-version
 * @param {Object} { id, newVersion }
 */
export const createNewVersion = createAsyncThunk(
  'legal/createNewVersion',
  async ({ id, newVersion }, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.patch(`/legal/admin/${id}/new-version`, { newVersion });
      toast.success(`Draft v${newVersion} created.`);
      dispatch(fetchAdminDocs());
      return data.data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Archive an active document
 * PATCH /api/legal/admin/:id/archive
 */
export const archiveDoc = createAsyncThunk(
  'legal/archiveDoc',
  async (id, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.patch(`/legal/admin/${id}/archive`);
      toast.success('Document archived.');
      dispatch(fetchAdminDocById(id));
      return data.data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Soft-delete a draft document
 * DELETE /api/legal/admin/:id
 */
export const deleteLegalDoc = createAsyncThunk(
  'legal/deleteLegalDoc',
  async (id, { rejectWithValue, dispatch }) => {
    try {
      await API.delete(`/legal/admin/${id}`);
      toast.success('Document deleted.');
      dispatch(fetchAdminDocs());
      return id;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * Verify document checksum (tamper detection)
 * GET /api/legal/admin/:id/verify-checksum
 */
export const verifyChecksum = createAsyncThunk(
  'legal/verifyChecksum',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/legal/admin/${id}/verify-checksum`);
      if (!data.intact) toast.error('⚠ Checksum mismatch! Document may be tampered.');
      else toast.success('Document integrity verified.');
      return data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const legalSlice = createSlice({
  name: 'legal',
  initialState,

  reducers: {
    /** Clear selected doc when navigating away */
    clearSelectedDoc(state) {
      state.selectedDoc        = null;
      state.selectedDocError   = null;
      state.versionHistory     = [];
      state.checksumResult     = null;
    },

    /** Clear admin list errors */
    clearAdminError(state) {
      state.adminError = null;
    },

    /** Clear consent errors */
    clearConsentError(state) {
      state.consentError = null;
    },

    /** Reset doc consent list (on modal close) */
    clearDocConsents(state) {
      state.docConsents        = [];
      state.docConsentsTotal   = 0;
      state.docConsentsPages   = 0;
      state.docConsentsError   = null;
    },

    /** Reset cross-doc consent report */
    clearAllConsents(state) {
      state.allConsents        = [];
      state.allConsentsTotal   = 0;
      state.allConsentsPages   = 0;
      state.allConsentsError   = null;
    },

    /** Manually patch a doc in adminDocs list (optimistic update) */
    patchAdminDoc(state, { payload: { id, changes } }) {
      const idx = state.adminDocs.findIndex((d) => d._id === id);
      if (idx !== -1) state.adminDocs[idx] = { ...state.adminDocs[idx], ...changes };
      if (state.selectedDoc?._id === id) {
        state.selectedDoc = { ...state.selectedDoc, ...changes };
      }
    },
  },

  extraReducers: (builder) => {

    // ── Helper: generic pending/rejected for mutation thunks ────────────────────
    const mutationPending  = (name) => (state, { meta }) => {
      state.mutating[mKey(name, meta.arg?.id ?? meta.arg)] = true;
    };
    const mutationFulfilled = (name) => (state, { meta }) => {
      delete state.mutating[mKey(name, meta.arg?.id ?? meta.arg)];
    };
    const mutationRejected  = (name) => (state, { meta }) => {
      delete state.mutating[mKey(name, meta.arg?.id ?? meta.arg)];
    };

    // ── fetchActiveDocs ─────────────────────────────────────────────────────────
    builder
      .addCase(fetchActiveDocs.pending, (state) => {
        state.activeDocsError = null;
      })
      .addCase(fetchActiveDocs.fulfilled, (state, { payload }) => {
        state.activeDocsList = payload;
        // Also key by documentType for quick lookup
        payload.forEach((doc) => {
          state.activeDocs[doc.documentType] = doc;
        });
      })
      .addCase(fetchActiveDocs.rejected, (state, { payload }) => {
        state.activeDocsError = payload;
      });

    // ── fetchActiveDocByType ────────────────────────────────────────────────────
    builder
      .addCase(fetchActiveDocByType.fulfilled, (state, { payload }) => {
        state.activeDocs[payload.type] = payload.doc;
      })
      .addCase(fetchActiveDocByType.rejected, (state, { payload }) => {
        state.activeDocsError = payload;
      });

    // ── fetchConsentStatus ──────────────────────────────────────────────────────
    builder
      .addCase(fetchConsentStatus.pending, (state) => {
        state.consentLoading = true;
        state.consentError   = null;
      })
      .addCase(fetchConsentStatus.fulfilled, (state, { payload }) => {
        state.consentLoading  = false;
        state.consentStatus   = payload.data;
        state.consentRequired = payload.consentRequired;
      })
      .addCase(fetchConsentStatus.rejected, (state, { payload }) => {
        state.consentLoading = false;
        state.consentError   = payload;
      });

    // ── fetchMyConsentHistory ───────────────────────────────────────────────────
    builder
      .addCase(fetchMyConsentHistory.pending, (state) => {
        state.consentLoading = true;
      })
      .addCase(fetchMyConsentHistory.fulfilled, (state, { payload }) => {
        state.consentLoading  = false;
        state.consentHistory  = payload;
      })
      .addCase(fetchMyConsentHistory.rejected, (state, { payload }) => {
        state.consentLoading = false;
        state.consentError   = payload;
      });

    // ── recordConsent ───────────────────────────────────────────────────────────
    builder
      .addCase(recordConsent.pending, (state) => {
        state.consentLoading = true;
        state.consentError   = null;
      })
      .addCase(recordConsent.fulfilled, (state) => {
        state.consentLoading = false;
      })
      .addCase(recordConsent.rejected, (state, { payload }) => {
        state.consentLoading = false;
        state.consentError   = payload;
      });

    // ── withdrawConsent ─────────────────────────────────────────────────────────
    builder
      .addCase(withdrawConsent.pending, (state) => {
        state.consentLoading = true;
      })
      .addCase(withdrawConsent.fulfilled, (state) => {
        state.consentLoading = false;
      })
      .addCase(withdrawConsent.rejected, (state, { payload }) => {
        state.consentLoading = false;
        state.consentError   = payload;
      });

    // ── fetchAdminDocs ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchAdminDocs.pending, (state) => {
        state.adminLoading = true;
        state.adminError   = null;
      })
      .addCase(fetchAdminDocs.fulfilled, (state, { payload }) => {
        state.adminLoading = false;
        state.adminDocs    = payload.data;
        state.adminTotal   = payload.total;
        state.adminPage    = payload.page;
        state.adminPages   = payload.pages;
      })
      .addCase(fetchAdminDocs.rejected, (state, { payload }) => {
        state.adminLoading = false;
        state.adminError   = payload;
      });

    // ── fetchAdminDocById ───────────────────────────────────────────────────────
    builder
      .addCase(fetchAdminDocById.pending, (state) => {
        state.selectedDocLoading = true;
        state.selectedDocError   = null;
        state.selectedDoc        = null;
      })
      .addCase(fetchAdminDocById.fulfilled, (state, { payload }) => {
        state.selectedDocLoading = false;
        state.selectedDoc        = payload;
      })
      .addCase(fetchAdminDocById.rejected, (state, { payload }) => {
        state.selectedDocLoading = false;
        state.selectedDocError   = payload;
      });

    // ── fetchVersionHistory ─────────────────────────────────────────────────────
    builder
      .addCase(fetchVersionHistory.pending, (state) => {
        state.versionHistoryLoading = true;
        state.versionHistoryError   = null;
      })
      .addCase(fetchVersionHistory.fulfilled, (state, { payload }) => {
        state.versionHistoryLoading = false;
        state.versionHistory        = payload?.versionHistory ?? [];
      })
      .addCase(fetchVersionHistory.rejected, (state, { payload }) => {
        state.versionHistoryLoading = false;
        state.versionHistoryError   = payload;
      });

    // ── fetchDocConsents ────────────────────────────────────────────────────────
    builder
      .addCase(fetchDocConsents.pending, (state) => {
        state.docConsentsLoading = true;
        state.docConsentsError   = null;
      })
      .addCase(fetchDocConsents.fulfilled, (state, { payload }) => {
        state.docConsentsLoading = false;
        state.docConsents        = payload.data;
        state.docConsentsTotal   = payload.total;
        state.docConsentsPages   = payload.pages;
      })
      .addCase(fetchDocConsents.rejected, (state, { payload }) => {
        state.docConsentsLoading = false;
        state.docConsentsError   = payload;
      });

    // ── fetchAllConsents ────────────────────────────────────────────────────────
    builder
      .addCase(fetchAllConsents.pending, (state) => {
        state.allConsentsLoading = true;
        state.allConsentsError   = null;
      })
      .addCase(fetchAllConsents.fulfilled, (state, { payload }) => {
        state.allConsentsLoading = false;
        state.allConsents        = payload.data;
        state.allConsentsTotal   = payload.total;
        state.allConsentsPages   = payload.pages;
      })
      .addCase(fetchAllConsents.rejected, (state, { payload }) => {
        state.allConsentsLoading = false;
        state.allConsentsError   = payload;
      });

    // ── createLegalDoc ──────────────────────────────────────────────────────────
    builder
      .addCase(createLegalDoc.pending,   mutationPending('createLegalDoc'))
      .addCase(createLegalDoc.fulfilled, (state, { payload, meta }) => {
        mutationFulfilled('createLegalDoc')(state, { meta });
        state.adminDocs.unshift(payload);
        state.adminTotal += 1;
      })
      .addCase(createLegalDoc.rejected,  mutationRejected('createLegalDoc'));

    // ── updateLegalDoc ──────────────────────────────────────────────────────────
    builder
      .addCase(updateLegalDoc.pending,   mutationPending('updateLegalDoc'))
      .addCase(updateLegalDoc.fulfilled, (state, { payload, meta }) => {
        mutationFulfilled('updateLegalDoc')(state, { meta });
        // Patch in list
        const idx = state.adminDocs.findIndex((d) => d._id === payload._id);
        if (idx !== -1) state.adminDocs[idx] = { ...state.adminDocs[idx], ...payload };
        // Patch selected
        if (state.selectedDoc?._id === payload._id) state.selectedDoc = payload;
      })
      .addCase(updateLegalDoc.rejected,  mutationRejected('updateLegalDoc'));

    // ── submitDocForReview ──────────────────────────────────────────────────────
    builder
      .addCase(submitDocForReview.pending,   mutationPending('submitDocForReview'))
      .addCase(submitDocForReview.fulfilled, (state, { payload, meta }) => {
        mutationFulfilled('submitDocForReview')(state, { meta });
        const idx = state.adminDocs.findIndex((d) => d._id === meta.arg);
        if (idx !== -1) state.adminDocs[idx].status = 'review';
      })
      .addCase(submitDocForReview.rejected,  mutationRejected('submitDocForReview'));

    // ── approveDoc ──────────────────────────────────────────────────────────────
    builder
      .addCase(approveDoc.pending,   mutationPending('approveDoc'))
      .addCase(approveDoc.fulfilled, (state, { meta }) => {
        mutationFulfilled('approveDoc')(state, { meta });
        const idx = state.adminDocs.findIndex((d) => d._id === meta.arg);
        if (idx !== -1) state.adminDocs[idx].status = 'approved';
      })
      .addCase(approveDoc.rejected,  mutationRejected('approveDoc'));

    // ── publishDoc ──────────────────────────────────────────────────────────────
    builder
      .addCase(publishDoc.pending,   mutationPending('publishDoc'))
      .addCase(publishDoc.fulfilled, (state, { payload, meta }) => {
        mutationFulfilled('publishDoc')(state, { meta });
        // Supersede any previously active doc of same type in list
        state.adminDocs.forEach((d) => {
          if (
            d.documentType === payload.documentType &&
            d._id !== payload._id &&
            d.status === 'active'
          ) {
            d.status      = 'superseded';
            d.isPublished = false;
          }
        });
        const idx = state.adminDocs.findIndex((d) => d._id === payload._id);
        if (idx !== -1) {
          state.adminDocs[idx].status      = 'active';
          state.adminDocs[idx].isPublished = true;
          state.adminDocs[idx].publishedAt = payload.publishedAt;
        }
        // Update activeDocs cache
        state.activeDocs[payload.documentType] = payload;
      })
      .addCase(publishDoc.rejected,  mutationRejected('publishDoc'));

    // ── createNewVersion ────────────────────────────────────────────────────────
    builder
      .addCase(createNewVersion.pending,   mutationPending('createNewVersion'))
      .addCase(createNewVersion.fulfilled, (state, { meta }) => {
        mutationFulfilled('createNewVersion')(state, { meta });
      })
      .addCase(createNewVersion.rejected,  mutationRejected('createNewVersion'));

    // ── archiveDoc ──────────────────────────────────────────────────────────────
    builder
      .addCase(archiveDoc.pending,   mutationPending('archiveDoc'))
      .addCase(archiveDoc.fulfilled, (state, { meta }) => {
        mutationFulfilled('archiveDoc')(state, { meta });
        const idx = state.adminDocs.findIndex((d) => d._id === meta.arg);
        if (idx !== -1) {
          state.adminDocs[idx].status      = 'archived';
          state.adminDocs[idx].isPublished = false;
        }
      })
      .addCase(archiveDoc.rejected,  mutationRejected('archiveDoc'));

    // ── deleteLegalDoc ──────────────────────────────────────────────────────────
    builder
      .addCase(deleteLegalDoc.pending,   mutationPending('deleteLegalDoc'))
      .addCase(deleteLegalDoc.fulfilled, (state, { payload: id, meta }) => {
        mutationFulfilled('deleteLegalDoc')(state, { meta });
        state.adminDocs  = state.adminDocs.filter((d) => d._id !== id);
        state.adminTotal = Math.max(0, state.adminTotal - 1);
        if (state.selectedDoc?._id === id) state.selectedDoc = null;
      })
      .addCase(deleteLegalDoc.rejected,  mutationRejected('deleteLegalDoc'));

    // ── verifyChecksum ──────────────────────────────────────────────────────────
    builder
      .addCase(verifyChecksum.pending, (state) => {
        state.checksumLoading = true;
        state.checksumResult  = null;
        state.checksumError   = null;
      })
      .addCase(verifyChecksum.fulfilled, (state, { payload }) => {
        state.checksumLoading = false;
        state.checksumResult  = payload;
      })
      .addCase(verifyChecksum.rejected, (state, { payload }) => {
        state.checksumLoading = false;
        state.checksumError   = payload;
      });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const {
  clearSelectedDoc,
  clearAdminError,
  clearConsentError,
  clearDocConsents,
  clearAllConsents,
  patchAdminDoc,
} = legalSlice.actions;

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Public ────────────────────────────────────────────────────────────────────
export const selectActiveDocsList     = (s) => s.legal.activeDocsList;
export const selectActiveDocByType    = (type) => (s) => s.legal.activeDocs[type] ?? null;
export const selectActiveDocsError    = (s) => s.legal.activeDocsError;

// ── Consent ───────────────────────────────────────────────────────────────────
export const selectConsentStatus      = (s) => s.legal.consentStatus;
export const selectConsentRequired    = (s) => s.legal.consentRequired;
export const selectConsentHistory     = (s) => s.legal.consentHistory;
export const selectConsentLoading     = (s) => s.legal.consentLoading;
export const selectConsentError       = (s) => s.legal.consentError;

// ── Admin list ────────────────────────────────────────────────────────────────
export const selectAdminDocs          = (s) => s.legal.adminDocs;
export const selectAdminDocsLoading   = (s) => s.legal.adminLoading;
export const selectAdminDocsError     = (s) => s.legal.adminError;
export const selectAdminPagination    = (s) => ({
  total: s.legal.adminTotal,
  page:  s.legal.adminPage,
  pages: s.legal.adminPages,
});

// ── Selected doc ──────────────────────────────────────────────────────────────
export const selectSelectedDoc        = (s) => s.legal.selectedDoc;
export const selectSelectedDocLoading = (s) => s.legal.selectedDocLoading;
export const selectSelectedDocError   = (s) => s.legal.selectedDocError;

// ── Version history ───────────────────────────────────────────────────────────
export const selectVersionHistory        = (s) => s.legal.versionHistory;
export const selectVersionHistoryLoading = (s) => s.legal.versionHistoryLoading;

// ── Doc consents ──────────────────────────────────────────────────────────────
export const selectDocConsents        = (s) => s.legal.docConsents;
export const selectDocConsentsLoading = (s) => s.legal.docConsentsLoading;
export const selectDocConsentsPagination = (s) => ({
  total: s.legal.docConsentsTotal,
  pages: s.legal.docConsentsPages,
});

// ── Cross-doc consent report ──────────────────────────────────────────────────
export const selectAllConsents        = (s) => s.legal.allConsents;
export const selectAllConsentsLoading = (s) => s.legal.allConsentsLoading;
export const selectAllConsentsPagination = (s) => ({
  total: s.legal.allConsentsTotal,
  pages: s.legal.allConsentsPages,
});

// ── Checksum ──────────────────────────────────────────────────────────────────
export const selectChecksumResult     = (s) => s.legal.checksumResult;
export const selectChecksumLoading    = (s) => s.legal.checksumLoading;

// ── Mutation loading helpers ──────────────────────────────────────────────────
export const selectIsMutating = (name, id = '') => (s) =>
  !!s.legal.mutating[mKey(name, id)];

// Convenience per-action
export const selectIsCreating          = (s) => selectIsMutating('createLegalDoc')(s);
export const selectIsUpdating   = (id) => selectIsMutating('updateLegalDoc', id);
export const selectIsSubmitting = (id) => selectIsMutating('submitDocForReview', id);
export const selectIsApproving  = (id) => selectIsMutating('approveDoc', id);
export const selectIsPublishing = (id) => selectIsMutating('publishDoc', id);
export const selectIsArchiving  = (id) => selectIsMutating('archiveDoc', id);
export const selectIsDeleting   = (id) => selectIsMutating('deleteLegalDoc', id);

// ═══════════════════════════════════════════════════════════════════════════════

export default legalSlice.reducer;