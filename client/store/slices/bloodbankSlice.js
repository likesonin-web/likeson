import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const pending  = (state)        => { state.loading = true; state.error = null; };
const rejected = (state, action) => {
  state.loading = false;
  state.error   = action.payload;
  toast.error(action.payload || 'Something went wrong');
};
const rj = (err) => err?.response?.data?.message || err.message;

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /blood-banks */
export const fetchBloodBanks = createAsyncThunk(
  'bloodBank/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/blood-banks', { params });
      return data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/nearby */
export const fetchNearbyBanks = createAsyncThunk(
  'bloodBank/fetchNearby',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/blood-banks/nearby', { params });
      return data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/slug/:slug */
export const fetchBankBySlug = createAsyncThunk(
  'bloodBank/fetchBySlug',
  async (slug, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/blood-banks/slug/${slug}`);
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/:id */
export const fetchBankById = createAsyncThunk(
  'bloodBank/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/blood-banks/${id}`);
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/:id/inventory */
export const fetchPublicInventory = createAsyncThunk(
  'bloodBank/fetchPublicInventory',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/blood-banks/${id}/inventory`);
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/:id/inventory/search */
export const searchInventory = createAsyncThunk(
  'bloodBank/searchInventory',
  async ({ id, params }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/blood-banks/${id}/inventory/search`, { params });
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/:id/reviews */
export const fetchReviews = createAsyncThunk(
  'bloodBank/fetchReviews',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/blood-banks/${id}/reviews`);
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /blood-banks/:id/reviews */
export const postReview = createAsyncThunk(
  'bloodBank/postReview',
  async ({ id, reviewData }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/blood-banks/${id}/reviews`, reviewData);
      toast.success('Review submitted!');
      return data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** POST /blood-banks/:id/request — create Razorpay order */
export const createBloodRequest = createAsyncThunk(
  'bloodBank/createRequest',
  async ({ id, requestData }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/blood-banks/${id}/request`, requestData);
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** POST /blood-banks/request/verify-payment */
export const verifyPayment = createAsyncThunk(
  'bloodBank/verifyPayment',
  async (paymentData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/blood-banks/request/verify-payment', paymentData);
      toast.success('Payment verified! Request confirmed.');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// BLOOD_BANK MANAGER THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /blood-banks — create profile */
export const createBloodBank = createAsyncThunk(
  'bloodBank/create',
  async (bankData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/blood-banks', bankData);
      toast.success('Blood bank created! Awaiting verification.');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/me */
export const fetchMyBank = createAsyncThunk(
  'bloodBank/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/blood-banks/me');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/me */
export const updateMyBank = createAsyncThunk(
  'bloodBank/updateMe',
  async (updateData, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/blood-banks/me', updateData);
      toast.success('Profile updated!');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/me/logo — multipart */
export const uploadLogo = createAsyncThunk(
  'bloodBank/uploadLogo',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/blood-banks/me/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Logo uploaded!');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/me/licenses — multipart */
export const updateLicense = createAsyncThunk(
  'bloodBank/updateLicense',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/blood-banks/me/licenses', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('License saved!');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/me/accreditations — multipart */
export const updateAccreditation = createAsyncThunk(
  'bloodBank/updateAccreditation',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/blood-banks/me/accreditations', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Accreditation saved!');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/me/bank-details */
export const updateBankDetails = createAsyncThunk(
  'bloodBank/updateBankDetails',
  async (details, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/blood-banks/me/bank-details', details);
      toast.success('Bank details updated!');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/me/stock-alerts */
export const updateStockAlerts = createAsyncThunk(
  'bloodBank/updateStockAlerts',
  async (alertsData, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/blood-banks/me/stock-alerts', alertsData);
      toast.success('Stock alerts updated!');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/me/pricing */
export const updatePricing = createAsyncThunk(
  'bloodBank/updatePricing',
  async (pricingData, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/blood-banks/me/pricing', pricingData);
      toast.success('Pricing updated!');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/me/inventory */
export const fetchMyInventory = createAsyncThunk(
  'bloodBank/fetchMyInventory',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/blood-banks/me/inventory');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** POST /blood-banks/me/inventory */
export const createInventorySlot = createAsyncThunk(
  'bloodBank/createInventorySlot',
  async (slotData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/blood-banks/me/inventory', slotData);
      toast.success('Inventory slot created!');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** POST /blood-banks/me/inventory/:invId/units */
export const addBloodUnit = createAsyncThunk(
  'bloodBank/addBloodUnit',
  async ({ invId, unitData }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/blood-banks/me/inventory/${invId}/units`, unitData);
      toast.success('Blood unit added!');
      return { invId, unit: data.data };
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/me/inventory/:invId/units/:unitId */
export const updateBloodUnit = createAsyncThunk(
  'bloodBank/updateBloodUnit',
  async ({ invId, unitId, updateData }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(
        `/blood-banks/me/inventory/${invId}/units/${unitId}`,
        updateData
      );
      toast.success('Unit updated!');
      return { invId, unit: data.data };
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** POST /blood-banks/me/inventory/:invId/expiry-check */
export const runExpiryCheck = createAsyncThunk(
  'bloodBank/runExpiryCheck',
  async (invId, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/blood-banks/me/inventory/${invId}/expiry-check`);
      toast.success('Expiry check complete!');
      return { invId, result: data.data };
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/me/requests */
export const fetchMyRequests = createAsyncThunk(
  'bloodBank/fetchMyRequests',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/blood-banks/me/requests');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/me/requests/:reqId/respond */
export const respondToRequest = createAsyncThunk(
  'bloodBank/respondToRequest',
  async ({ reqId, action, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(
        `/blood-banks/me/requests/${reqId}/respond`,
        { action, reason }
      );
      toast.success(data.message);
      return { reqId, action };
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/me/requests/:reqId/issue */
export const issueBloodUnits = createAsyncThunk(
  'bloodBank/issueUnits',
  async ({ reqId, issueData }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(
        `/blood-banks/me/requests/${reqId}/issue`,
        issueData
      );
      toast.success(data.message);
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/me/stats */
export const fetchMyStats = createAsyncThunk(
  'bloodBank/fetchMyStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/blood-banks/me/stats');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/me/status-log */
export const fetchStatusLog = createAsyncThunk(
  'bloodBank/fetchStatusLog',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/blood-banks/me/status-log');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// HOSPITAL THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /blood-banks/linked */
export const fetchLinkedBanks = createAsyncThunk(
  'bloodBank/fetchLinked',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/blood-banks/linked');
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** POST /blood-banks/:id/link */
export const linkBloodBank = createAsyncThunk(
  'bloodBank/link',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/blood-banks/${id}/link`);
      toast.success(data.message);
      return id;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** DELETE /blood-banks/:id/link */
export const unlinkBloodBank = createAsyncThunk(
  'bloodBank/unlink',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/blood-banks/${id}/link`);
      toast.success(data.message);
      return id;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /blood-banks/admin/all */
export const adminFetchAllBanks = createAsyncThunk(
  'bloodBank/adminFetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/blood-banks/admin/all', { params });
      return data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/admin/:id */
export const adminFetchBank = createAsyncThunk(
  'bloodBank/adminFetchOne',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/blood-banks/admin/${id}`);
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** GET /blood-banks/admin/:id/stats */
export const adminFetchBankStats = createAsyncThunk(
  'bloodBank/adminFetchStats',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/blood-banks/admin/${id}/stats`);
      return data.data;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/admin/:id/status */
export const adminUpdateStatus = createAsyncThunk(
  'bloodBank/adminUpdateStatus',
  async ({ id, status, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/blood-banks/admin/${id}/status`, { status, reason });
      toast.success(data.message);
      return { id, status };
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/admin/:id/verify */
export const adminVerifyBank = createAsyncThunk(
  'bloodBank/adminVerify',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/blood-banks/admin/${id}/verify`);
      toast.success('Blood bank verified!');
      return { id, data: data.data };
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/admin/:id/featured */
export const adminToggleFeatured = createAsyncThunk(
  'bloodBank/adminToggleFeatured',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/blood-banks/admin/${id}/featured`);
      toast.success(data.message);
      return { id, isFeatured: data.data.isFeatured };
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** PUT /blood-banks/admin/:id/licenses/:licId/verify */
export const adminVerifyLicense = createAsyncThunk(
  'bloodBank/adminVerifyLicense',
  async ({ id, licId }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/blood-banks/admin/${id}/licenses/${licId}/verify`);
      toast.success('License verified!');
      return { id, license: data.data };
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

/** DELETE /blood-banks/admin/:id */
export const adminDeleteBank = createAsyncThunk(
  'bloodBank/adminDelete',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/blood-banks/admin/${id}`);
      toast.success('Blood bank permanently deleted.');
      return id;
    } catch (err) { return rejectWithValue(rj(err)); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // Public list
  banks:          [],
  total:          0,
  page:           1,
  pages:          1,

  // Single bank (public view)
  selectedBank:   null,

  // Public inventory
  publicInventory:  [],
  inventorySearch:  [],
  reviews:          [],

  // Customer
  razorpayOrder:    null,
  paymentResult:    null,

  // Manager — own profile
  myBank:           null,
  myInventory:      [],
  myRequests:       [],
  myStats:          null,
  statusLog:        [],

  // Hospital
  linkedBanks:      [],

  // Admin
  adminBanks:       [],
  adminTotal:       0,
  adminSelectedBank: null,
  adminStats:       null,

  // UI
  loading:  false,
  error:    null,
};

const bloodBankSlice = createSlice({
  name: 'bloodBank',
  initialState,
  reducers: {
    clearError:        (state) => { state.error = null; },
    clearSelectedBank: (state) => { state.selectedBank = null; },
    clearRazorpayOrder:(state) => { state.razorpayOrder = null; state.paymentResult = null; },
  },
  extraReducers: (builder) => {

    // ── fetchBloodBanks ──────────────────────────────────────────────────────
    builder
      .addCase(fetchBloodBanks.pending,   pending)
      .addCase(fetchBloodBanks.rejected,  rejected)
      .addCase(fetchBloodBanks.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.banks   = payload.data;
        state.total   = payload.total;
        state.page    = payload.page;
        state.pages   = payload.pages;
      });

    // ── fetchNearbyBanks ─────────────────────────────────────────────────────
    builder
      .addCase(fetchNearbyBanks.pending,   pending)
      .addCase(fetchNearbyBanks.rejected,  rejected)
      .addCase(fetchNearbyBanks.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.banks   = payload.data;
      });

    // ── fetchBankBySlug ──────────────────────────────────────────────────────
    builder
      .addCase(fetchBankBySlug.pending,   pending)
      .addCase(fetchBankBySlug.rejected,  rejected)
      .addCase(fetchBankBySlug.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.selectedBank = payload;
      });

    // ── fetchBankById ────────────────────────────────────────────────────────
    builder
      .addCase(fetchBankById.pending,   pending)
      .addCase(fetchBankById.rejected,  rejected)
      .addCase(fetchBankById.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.selectedBank = payload;
      });

    // ── fetchPublicInventory ─────────────────────────────────────────────────
    builder
      .addCase(fetchPublicInventory.pending,   pending)
      .addCase(fetchPublicInventory.rejected,  rejected)
      .addCase(fetchPublicInventory.fulfilled, (state, { payload }) => {
        state.loading         = false;
        state.publicInventory = payload;
      });

    // ── searchInventory ──────────────────────────────────────────────────────
    builder
      .addCase(searchInventory.pending,   pending)
      .addCase(searchInventory.rejected,  rejected)
      .addCase(searchInventory.fulfilled, (state, { payload }) => {
        state.loading         = false;
        state.inventorySearch = payload;
      });

    // ── fetchReviews ─────────────────────────────────────────────────────────
    builder
      .addCase(fetchReviews.pending,   pending)
      .addCase(fetchReviews.rejected,  rejected)
      .addCase(fetchReviews.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.reviews = payload;
      });

    // ── postReview ───────────────────────────────────────────────────────────
    builder
      .addCase(postReview.pending,   pending)
      .addCase(postReview.rejected,  rejected)
      .addCase(postReview.fulfilled, (state) => { state.loading = false; });

    // ── createBloodRequest ───────────────────────────────────────────────────
    builder
      .addCase(createBloodRequest.pending,   pending)
      .addCase(createBloodRequest.rejected,  rejected)
      .addCase(createBloodRequest.fulfilled, (state, { payload }) => {
        state.loading       = false;
        state.razorpayOrder = payload;
      });

    // ── verifyPayment ────────────────────────────────────────────────────────
    builder
      .addCase(verifyPayment.pending,   pending)
      .addCase(verifyPayment.rejected,  rejected)
      .addCase(verifyPayment.fulfilled, (state, { payload }) => {
        state.loading       = false;
        state.paymentResult = payload;
        state.razorpayOrder = null;
      });

    // ── createBloodBank ──────────────────────────────────────────────────────
    builder
      .addCase(createBloodBank.pending,   pending)
      .addCase(createBloodBank.rejected,  rejected)
      .addCase(createBloodBank.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.myBank  = payload;
      });

    // ── fetchMyBank ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchMyBank.pending,   pending)
      .addCase(fetchMyBank.rejected,  rejected)
      .addCase(fetchMyBank.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.myBank  = payload;
      });

    // ── updateMyBank ─────────────────────────────────────────────────────────
    builder
      .addCase(updateMyBank.pending,   pending)
      .addCase(updateMyBank.rejected,  rejected)
      .addCase(updateMyBank.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.myBank  = payload;
      });

    // ── uploadLogo ───────────────────────────────────────────────────────────
    builder
      .addCase(uploadLogo.pending,   pending)
      .addCase(uploadLogo.rejected,  rejected)
      .addCase(uploadLogo.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (state.myBank) state.myBank.logoUrl = payload.logoUrl;
      });

    // ── updateLicense ────────────────────────────────────────────────────────
    builder
      .addCase(updateLicense.pending,   pending)
      .addCase(updateLicense.rejected,  rejected)
      .addCase(updateLicense.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (state.myBank) state.myBank.licenses = payload;
      });

    // ── updateAccreditation ──────────────────────────────────────────────────
    builder
      .addCase(updateAccreditation.pending,   pending)
      .addCase(updateAccreditation.rejected,  rejected)
      .addCase(updateAccreditation.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (state.myBank) state.myBank.accreditations = payload;
      });

    // ── updateBankDetails ────────────────────────────────────────────────────
    builder
      .addCase(updateBankDetails.pending,   pending)
      .addCase(updateBankDetails.rejected,  rejected)
      .addCase(updateBankDetails.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (state.myBank) state.myBank.bankDetails = { ...state.myBank.bankDetails, ...payload };
      });

    // ── updateStockAlerts ────────────────────────────────────────────────────
    builder
      .addCase(updateStockAlerts.pending,   pending)
      .addCase(updateStockAlerts.rejected,  rejected)
      .addCase(updateStockAlerts.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (state.myBank) state.myBank.stockAlerts = payload;
      });

    // ── updatePricing ────────────────────────────────────────────────────────
    builder
      .addCase(updatePricing.pending,   pending)
      .addCase(updatePricing.rejected,  rejected)
      .addCase(updatePricing.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (state.myBank) state.myBank.pricing = payload;
      });

    // ── fetchMyInventory ─────────────────────────────────────────────────────
    builder
      .addCase(fetchMyInventory.pending,   pending)
      .addCase(fetchMyInventory.rejected,  rejected)
      .addCase(fetchMyInventory.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.myInventory  = payload;
      });

    // ── createInventorySlot ──────────────────────────────────────────────────
    builder
      .addCase(createInventorySlot.pending,   pending)
      .addCase(createInventorySlot.rejected,  rejected)
      .addCase(createInventorySlot.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.myInventory.push(payload);
      });

    // ── addBloodUnit ─────────────────────────────────────────────────────────
    builder
      .addCase(addBloodUnit.pending,   pending)
      .addCase(addBloodUnit.rejected,  rejected)
      .addCase(addBloodUnit.fulfilled, (state) => { state.loading = false; });

    // ── updateBloodUnit ──────────────────────────────────────────────────────
    builder
      .addCase(updateBloodUnit.pending,   pending)
      .addCase(updateBloodUnit.rejected,  rejected)
      .addCase(updateBloodUnit.fulfilled, (state) => { state.loading = false; });

    // ── runExpiryCheck ───────────────────────────────────────────────────────
    builder
      .addCase(runExpiryCheck.pending,   pending)
      .addCase(runExpiryCheck.rejected,  rejected)
      .addCase(runExpiryCheck.fulfilled, (state, { payload }) => {
        state.loading = false;
        const slot = state.myInventory.find(i => i._id === payload.invId);
        if (slot) Object.assign(slot, payload.result);
      });

    // ── fetchMyRequests ──────────────────────────────────────────────────────
    builder
      .addCase(fetchMyRequests.pending,   pending)
      .addCase(fetchMyRequests.rejected,  rejected)
      .addCase(fetchMyRequests.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.myRequests  = payload || [];
      });

    // ── respondToRequest ─────────────────────────────────────────────────────
    builder
      .addCase(respondToRequest.pending,   pending)
      .addCase(respondToRequest.rejected,  rejected)
      .addCase(respondToRequest.fulfilled, (state) => { state.loading = false; });

    // ── issueBloodUnits ──────────────────────────────────────────────────────
    builder
      .addCase(issueBloodUnits.pending,   pending)
      .addCase(issueBloodUnits.rejected,  rejected)
      .addCase(issueBloodUnits.fulfilled, (state) => { state.loading = false; });

    // ── fetchMyStats ─────────────────────────────────────────────────────────
    builder
      .addCase(fetchMyStats.pending,   pending)
      .addCase(fetchMyStats.rejected,  rejected)
      .addCase(fetchMyStats.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.myStats = payload;
      });

    // ── fetchStatusLog ───────────────────────────────────────────────────────
    builder
      .addCase(fetchStatusLog.pending,   pending)
      .addCase(fetchStatusLog.rejected,  rejected)
      .addCase(fetchStatusLog.fulfilled, (state, { payload }) => {
        state.loading    = false;
        state.statusLog  = payload;
      });

    // ── fetchLinkedBanks ─────────────────────────────────────────────────────
    builder
      .addCase(fetchLinkedBanks.pending,   pending)
      .addCase(fetchLinkedBanks.rejected,  rejected)
      .addCase(fetchLinkedBanks.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.linkedBanks = payload;
      });

    // ── linkBloodBank ────────────────────────────────────────────────────────
    builder
      .addCase(linkBloodBank.pending,   pending)
      .addCase(linkBloodBank.rejected,  rejected)
      .addCase(linkBloodBank.fulfilled, (state) => { state.loading = false; });

    // ── unlinkBloodBank ──────────────────────────────────────────────────────
    builder
      .addCase(unlinkBloodBank.pending,   pending)
      .addCase(unlinkBloodBank.rejected,  rejected)
      .addCase(unlinkBloodBank.fulfilled, (state, { payload: id }) => {
        state.loading     = false;
        state.linkedBanks = state.linkedBanks.filter(b => b._id !== id);
      });

    // ── adminFetchAllBanks ───────────────────────────────────────────────────
    builder
      .addCase(adminFetchAllBanks.pending,   pending)
      .addCase(adminFetchAllBanks.rejected,  rejected)
      .addCase(adminFetchAllBanks.fulfilled, (state, { payload }) => {
        state.loading    = false;
        state.adminBanks = payload.data;
        state.adminTotal = payload.total;
      });

    // ── adminFetchBank ───────────────────────────────────────────────────────
    builder
      .addCase(adminFetchBank.pending,   pending)
      .addCase(adminFetchBank.rejected,  rejected)
      .addCase(adminFetchBank.fulfilled, (state, { payload }) => {
        state.loading           = false;
        state.adminSelectedBank = payload;
      });

    // ── adminFetchBankStats ──────────────────────────────────────────────────
    builder
      .addCase(adminFetchBankStats.pending,   pending)
      .addCase(adminFetchBankStats.rejected,  rejected)
      .addCase(adminFetchBankStats.fulfilled, (state, { payload }) => {
        state.loading    = false;
        state.adminStats = payload;
      });

    // ── adminUpdateStatus ────────────────────────────────────────────────────
    builder
      .addCase(adminUpdateStatus.pending,   pending)
      .addCase(adminUpdateStatus.rejected,  rejected)
      .addCase(adminUpdateStatus.fulfilled, (state, { payload }) => {
        state.loading = false;
        const bank = state.adminBanks.find(b => b._id === payload.id);
        if (bank) bank.status = payload.status;
        if (state.adminSelectedBank?._id === payload.id)
          state.adminSelectedBank.status = payload.status;
      });

    // ── adminVerifyBank ──────────────────────────────────────────────────────
    builder
      .addCase(adminVerifyBank.pending,   pending)
      .addCase(adminVerifyBank.rejected,  rejected)
      .addCase(adminVerifyBank.fulfilled, (state, { payload }) => {
        state.loading = false;
        const bank = state.adminBanks.find(b => b._id === payload.id);
        if (bank) { bank.isVerified = true; bank.status = 'active'; }
        if (state.adminSelectedBank?._id === payload.id)
          Object.assign(state.adminSelectedBank, payload.data);
      });

    // ── adminToggleFeatured ──────────────────────────────────────────────────
    builder
      .addCase(adminToggleFeatured.pending,   pending)
      .addCase(adminToggleFeatured.rejected,  rejected)
      .addCase(adminToggleFeatured.fulfilled, (state, { payload }) => {
        state.loading = false;
        const bank = state.adminBanks.find(b => b._id === payload.id);
        if (bank) bank.isFeatured = payload.isFeatured;
        if (state.adminSelectedBank?._id === payload.id)
          state.adminSelectedBank.isFeatured = payload.isFeatured;
      });

    // ── adminVerifyLicense ───────────────────────────────────────────────────
    builder
      .addCase(adminVerifyLicense.pending,   pending)
      .addCase(adminVerifyLicense.rejected,  rejected)
      .addCase(adminVerifyLicense.fulfilled, (state) => { state.loading = false; });

    // ── adminDeleteBank ──────────────────────────────────────────────────────
    builder
      .addCase(adminDeleteBank.pending,   pending)
      .addCase(adminDeleteBank.rejected,  rejected)
      .addCase(adminDeleteBank.fulfilled, (state, { payload: id }) => {
        state.loading    = false;
        state.adminBanks = state.adminBanks.filter(b => b._id !== id);
        if (state.adminSelectedBank?._id === id) state.adminSelectedBank = null;
      });
  },
});

export const { clearError, clearSelectedBank, clearRazorpayOrder } = bloodBankSlice.actions;
export default bloodBankSlice.reducer;