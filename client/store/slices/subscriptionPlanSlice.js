import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — PLAN CATALOGUE
// Routes: GET /subscriptions/plans, GET /subscriptions/plans/:planId
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAllPlans = createAsyncThunk(
  'subscriptions/fetchPlans',
  async (_, { rejectWithValue }) => {
    try {
      const res = await API.get('/subscriptions/plans');
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch plans');
    }
  }
);

export const fetchPlans = fetchAllPlans; // backward-compat alias

export const fetchPlanById = createAsyncThunk(
  'subscriptions/fetchPlanById',
  async (planId, { rejectWithValue }) => {
    try {
      const res = await API.get(`/subscriptions/plans/${planId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch plan');
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — CUSTOM PLAN BUILDER
// Routes:
//   GET    /subscriptions/custom-plan/pricing
//   POST   /subscriptions/custom-plan
//   PUT    /subscriptions/custom-plan/:planId
//   DELETE /subscriptions/custom-plan/:planId
//
// FIX: Custom plans NOT in GET /plans (visibleToCustomerOnly:true is excluded).
//      Custom plans stored in separate state.customPlans[], loaded via
//      GET /subscriptions/plans/:planId (by ID from mySubscription) OR
//      returned in create/update responses. We also fetch them from
//      mySubscription.plan when planType === 'custom'.
// ─────────────────────────────────────────────────────────────────────────────

export const fetchCustomPlanPricing = createAsyncThunk(
  'subscriptions/fetchCustomPlanPricing',
  async (_, { rejectWithValue }) => {
    try {
      const res = await API.get('/subscriptions/custom-plan/pricing');
      // Backend: { success, data: { optionPricing, caps } }
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch custom plan pricing');
    }
  }
);

export const createCustomPlan = createAsyncThunk(
  'subscriptions/createCustomPlan',
  async (planData, { rejectWithValue }) => {
    try {
      const res = await API.post('/subscriptions/custom-plan', planData);
      toast.success(`Custom plan "${res.data.data.name}" created!`);
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create custom plan';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const updateCustomPlan = createAsyncThunk(
  'subscriptions/updateCustomPlan',
  async ({ planId, ...planData }, { rejectWithValue }) => {
    try {
      const res = await API.put(`/subscriptions/custom-plan/${planId}`, planData);
      toast.success('Custom plan updated!');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update custom plan';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const deleteCustomPlan = createAsyncThunk(
  'subscriptions/deleteCustomPlan',
  async (planId, { rejectWithValue }) => {
    try {
      const res = await API.delete(`/subscriptions/custom-plan/${planId}`);
      toast.success('Custom plan deactivated.');
      return { planId, ...res.data };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to delete custom plan';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — PURCHASE FLOW
// Routes:
//   POST /subscriptions/buy
//   POST /subscriptions/verify
// ─────────────────────────────────────────────────────────────────────────────

export const initiateSubscriptionPurchase = createAsyncThunk(
  'subscriptions/buy',
  async (purchaseData, { rejectWithValue }) => {
    try {
      const res = await API.post('/subscriptions/buy', purchaseData);
      if (res.data.activated) toast.success('Subscription activated for free!');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Purchase failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const buySubscription = initiateSubscriptionPurchase; // alias

export const verifySubscriptionPayment = createAsyncThunk(
  'subscriptions/verifyPayment',
  async (paymentData, { rejectWithValue }) => {
    try {
      const res = await API.post('/subscriptions/verify', paymentData);
      toast.success('Payment verified! Subscription activated.');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Payment verification failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const verifyPayment = verifySubscriptionPayment; // alias

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — CUSTOMER SUBSCRIPTION MANAGEMENT
// Routes:
//   GET /subscriptions/my
//   GET /subscriptions/my/history
//   PUT /subscriptions/upgrade
//   PUT /subscriptions/cancel
//   PUT /subscriptions/toggle-auto-renew
// ─────────────────────────────────────────────────────────────────────────────

export const fetchMySubscription = createAsyncThunk(
  'subscriptions/fetchMy',
  async (_, { rejectWithValue }) => {
    try {
      const res = await API.get('/subscriptions/my');
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch subscription');
    }
  }
);

export const fetchMySubscriptionHistory = createAsyncThunk(
  'subscriptions/fetchMyHistory',
  async (params = { page: 1, limit: 10 }, { rejectWithValue }) => {
    try {
      const res = await API.get('/subscriptions/my/history', { params });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch subscription history');
    }
  }
);

export const upgradeSubscription = createAsyncThunk(
  'subscriptions/upgrade',
  async ({ newPlanId }, { rejectWithValue }) => {
    try {
      const res = await API.put('/subscriptions/upgrade', { newPlanId });
      toast.success(`Plan upgraded to ${res.data.data.planName}!`);
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Upgrade failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const cancelSubscription = createAsyncThunk(
  'subscriptions/cancel',
  async ({ reason } = {}, { rejectWithValue }) => {
    try {
      const res = await API.put('/subscriptions/cancel', { reason });
      toast.success('Subscription cancelled.');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Cancellation failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const toggleAutoRenew = createAsyncThunk(
  'subscriptions/toggleAutoRenew',
  async (_, { rejectWithValue }) => {
    try {
      const res = await API.put('/subscriptions/toggle-auto-renew');
      toast.success(`Auto-renew ${res.data.autoRenew ? 'enabled' : 'disabled'}.`);
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Toggle failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — FREE TRIAL
// Routes:
//   POST /subscriptions/free-trial/start
//   GET  /subscriptions/free-trial/eligibility
//   GET  /subscriptions/free-trial/status
//   POST /subscriptions/free-trial/convert
//   POST /subscriptions/free-trial/verify-convert
//   POST /subscriptions/free-trial/expire-stale   (admin)
//   GET  /subscriptions/admin/trials              (admin)
// ─────────────────────────────────────────────────────────────────────────────

export const startFreeTrial = createAsyncThunk(
  'subscriptions/startFreeTrial',
  async ({ planId, razorpay_payment_method_id } = {}, { rejectWithValue }) => {
    try {
      const res = await API.post('/subscriptions/free-trial/start', {
        planId,
        ...(razorpay_payment_method_id && { razorpay_payment_method_id }),
      });
      toast.success(res.data.message || 'Free trial started!');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to start free trial';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const fetchTrialEligibility = createAsyncThunk(
  'subscriptions/fetchTrialEligibility',
  async (_, { rejectWithValue }) => {
    try {
      const res = await API.get('/subscriptions/free-trial/eligibility');
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to check trial eligibility');
    }
  }
);

export const fetchTrialStatus = createAsyncThunk(
  'subscriptions/fetchTrialStatus',
  async (_, { rejectWithValue }) => {
    try {
      const res = await API.get('/subscriptions/free-trial/status');
      return res.data;
    } catch (err) {
      // 404 = no active trial — not a real error; return null gracefully
      if (err.response?.status === 404) return { activeTrial: false, daysLeft: 0, plan: null };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch trial status');
    }
  }
);

export const initiateTrialConversion = createAsyncThunk(
  'subscriptions/convertTrial',
  async ({ couponCode } = {}, { rejectWithValue }) => {
    try {
      const res = await API.post('/subscriptions/free-trial/convert', {
        ...(couponCode && { couponCode }),
      });
      if (res.data.activated) toast.success('Trial converted to paid subscription!');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Trial conversion failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const convertTrial = initiateTrialConversion; // alias

export const verifyTrialConversion = createAsyncThunk(
  'subscriptions/verifyTrialConvert',
  async (paymentData, { rejectWithValue }) => {
    try {
      const res = await API.post('/subscriptions/free-trial/verify-convert', paymentData);
      toast.success('Trial successfully converted to paid subscription!');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Trial conversion verification failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const verifyTrialConvert = verifyTrialConversion; // alias

export const expireStaleTrials = createAsyncThunk(
  'subscriptions/expireStaleTrials',
  async (_, { rejectWithValue }) => {
    try {
      const res = await API.post('/subscriptions/free-trial/expire-stale');
      toast.success(`Stale trials expired: ${res.data.expiredCount}`);
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to expire stale trials';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const adminFetchTrials = createAsyncThunk(
  'subscriptions/adminFetchTrials',
  async (params = { page: 1, limit: 20 }, { rejectWithValue }) => {
    try {
      const res = await API.get('/subscriptions/admin/trials', { params });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch admin trials');
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — CRON / SYSTEM JOBS
// Routes:
//   POST /subscriptions/send-expiry-alerts   (admin)
//   POST /subscriptions/auto-renew-trigger   (admin)
// ─────────────────────────────────────────────────────────────────────────────

export const sendExpiryAlerts = createAsyncThunk(
  'subscriptions/sendExpiryAlerts',
  async (_, { rejectWithValue }) => {
    try {
      const res = await API.post('/subscriptions/send-expiry-alerts');
      toast.success(`Expiry alerts sent: ${res.data.totalEmailsSent}`);
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to send expiry alerts';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const triggerAutoRenew = createAsyncThunk(
  'subscriptions/triggerAutoRenew',
  async (_, { rejectWithValue }) => {
    try {
      const res = await API.post('/subscriptions/auto-renew-trigger');
      toast.success('Auto-renewal process complete.');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Auto-renew trigger failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — ADMIN PLAN MANAGEMENT
// Routes:
//   GET    /subscriptions/admin/all
//   GET    /subscriptions/admin/plans
//   POST   /subscriptions/admin/plans
//   PUT    /subscriptions/admin/plans/:planId
//   DELETE /subscriptions/admin/plans/:planId        (superadmin only)
//   PUT    /subscriptions/admin/subscriptions/:subId
// ─────────────────────────────────────────────────────────────────────────────

export const adminFetchAllSubscriptions = createAsyncThunk(
  'subscriptions/adminFetchAll',
  async (params = { page: 1, limit: 20 }, { rejectWithValue }) => {
    try {
      const res = await API.get('/subscriptions/admin/all', { params });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch subscriptions');
    }
  }
);

export const adminFetchPlans = createAsyncThunk(
  'subscriptions/adminFetchPlans',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await API.get('/subscriptions/admin/plans', { params });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch admin plans');
    }
  }
);

export const adminCreatePlan = createAsyncThunk(
  'subscriptions/adminCreatePlan',
  async (planData, { rejectWithValue }) => {
    try {
      const res = await API.post('/subscriptions/admin/plans', planData);
      toast.success(`Plan "${res.data.data.name}" created!`);
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create plan';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const adminUpdatePlan = createAsyncThunk(
  'subscriptions/adminUpdatePlan',
  async ({ planId, ...planData }, { rejectWithValue }) => {
    try {
      const res = await API.put(`/subscriptions/admin/plans/${planId}`, planData);
      toast.success('Plan updated!');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update plan';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const adminDeletePlan = createAsyncThunk(
  'subscriptions/adminDeletePlan',
  async (planId, { rejectWithValue }) => {
    try {
      const res = await API.delete(`/subscriptions/admin/plans/${planId}`);
      toast.success('Plan deactivated.');
      return { planId, ...res.data };
    } catch (err) {
      const message = err.response?.data?.message || 'Deactivation failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const adminUpdateSubscription = createAsyncThunk(
  'subscriptions/adminUpdateSubscription',
  async ({ subId, ...patch }, { rejectWithValue }) => {
    try {
      const res = await API.put(`/subscriptions/admin/subscriptions/${subId}`, patch);
      toast.success('Subscription updated.');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update subscription';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
//
// FIX: name = 'subscriptions' → store key MUST match: state.subscriptions
//      All selectors use sel = (state) => state.subscriptions
//
// FIX: customPlanPricing stores payload.data = { optionPricing, caps }
//      Page accesses pricingData.optionPricing and pricingData.caps — correct.
//
// FIX: customPlans[] separate from plans[] because GET /plans excludes
//      visibleToCustomerOnly:true. Custom plans inserted from:
//        - createCustomPlan response
//        - updateCustomPlan response
//        - fetchMySubscription when planType === 'custom' (merged in reducer)
//        - deleteCustomPlan removes by planId
// ─────────────────────────────────────────────────────────────────────────────

const subscriptionPlanSlice = createSlice({
  name: 'subscriptions', // FIX: was 'subscriptions' but selectors used state.subscriptionPlan — now unified

  initialState: {
    // Public fixed plans (from GET /plans — excludes custom)
    plans: [],
    selectedPlan: null,

    // FIX: custom plans stored separately — never come from GET /plans
    customPlans: [],

    // Custom plan builder pricing — shape: { optionPricing, caps }
    customPlanPricing: null,

    // Active subscription (populated by GET /my)
    mySubscription: null,
    subscriptionHistory: [],

    // Trial
    trialEligibility: null,
    trialStatus:      null,

    // Payment orders
    pendingOrder: null, // normal purchase
    trialOrder:   null, // trial conversion

    // Admin
    adminSubscriptions: [],
    adminPlans:         [],
    adminTrials:        [],

    // Cron results
    cronResult: null,

    // Pagination
    pagination:        { total: 0, page: 1, pages: 1 },
    adminPagination:   { total: 0, page: 1, pages: 1 },
    historyPagination: { total: 0, page: 1, pages: 1 },
    trialPagination:   { total: 0, page: 1, pages: 1 },

    // Loading flags
    loading: {
      plans:              false,
      mySubscription:     false,
      history:            false,
      trial:              false,
      trialConvert:       false,
      trialVerifyConvert: false,
      purchase:           false,
      verify:             false,
      upgrade:            false,
      cancel:             false,
      autoRenew:          false,
      admin:              false,
      cron:               false,
      customPlanPricing:  false,
      customPlan:         false,
    },

    error:           null,
    customPlanError: null,
  },

  reducers: {
    clearError:           (state) => { state.error = null; },
    clearCustomPlanError: (state) => { state.customPlanError = null; },
    clearPendingOrder:    (state) => { state.pendingOrder = null; },
    clearTrialOrder:      (state) => { state.trialOrder = null; },
    setSelectedPlan:      (state, { payload }) => { state.selectedPlan = payload; },

    // Optimistic toggle for immediate UI feedback before server confirms
    optimisticToggleAutoRenew: (state) => {
      if (state.mySubscription) {
        state.mySubscription.autoRenew = !state.mySubscription.autoRenew;
      }
    },
  },

  extraReducers: (builder) => {
    const pending = (key) => (state) => { state.loading[key] = true;  state.error = null; };
    const done    = (key) => (state) => { state.loading[key] = false; };
    const fail    = (key) => (state, { payload }) => { state.loading[key] = false; state.error = payload; };

    builder

      // ── SECTION 1: PLAN CATALOGUE ─────────────────────────────────────────
      .addCase(fetchAllPlans.pending,   pending('plans'))
      .addCase(fetchAllPlans.fulfilled, (state, { payload }) => {
        state.loading.plans = false;
        // Only fixed plans come from GET /plans (visibleToCustomerOnly:false)
        state.plans = payload.data ?? [];
        if (payload.pagination) state.pagination = payload.pagination;
      })
      .addCase(fetchAllPlans.rejected, fail('plans'))

      .addCase(fetchPlanById.pending,   pending('plans'))
      .addCase(fetchPlanById.fulfilled, (state, { payload }) => {
        state.loading.plans = false;
        state.selectedPlan  = payload.data;
        // FIX: if fetched plan is custom, merge into customPlans[]
        if (payload.data?.planType === 'custom') {
          const idx = state.customPlans.findIndex((p) => p._id === payload.data._id);
          if (idx !== -1) state.customPlans[idx] = payload.data;
          else state.customPlans.unshift(payload.data);
        }
      })
      .addCase(fetchPlanById.rejected, fail('plans'))

      // ── SECTION 2: CUSTOM PLAN BUILDER ────────────────────────────────────
      .addCase(fetchCustomPlanPricing.pending, (state) => {
        state.loading.customPlanPricing = true;
        state.error = null;
      })
      .addCase(fetchCustomPlanPricing.fulfilled, (state, { payload }) => {
        state.loading.customPlanPricing = false;
        // Backend: { success, data: { optionPricing, caps } }
        // Store payload.data so selectors expose { optionPricing, caps }
        state.customPlanPricing = payload.data;
      })
      .addCase(fetchCustomPlanPricing.rejected, (state, { payload }) => {
        state.loading.customPlanPricing = false;
        state.error = payload;
      })

      .addCase(createCustomPlan.pending, (state) => {
        state.loading.customPlan = true;
        state.customPlanError    = null;
      })
      .addCase(createCustomPlan.fulfilled, (state, { payload }) => {
        state.loading.customPlan = false;
        // FIX: custom plans go into customPlans[], NOT plans[]
        state.customPlans.unshift(payload.data);
      })
      .addCase(createCustomPlan.rejected, (state, { payload }) => {
        state.loading.customPlan  = false;
        state.customPlanError = payload;
      })

      .addCase(updateCustomPlan.pending, (state) => {
        state.loading.customPlan = true;
        state.customPlanError    = null;
      })
      .addCase(updateCustomPlan.fulfilled, (state, { payload }) => {
        state.loading.customPlan = false;
        const idx = state.customPlans.findIndex((p) => p._id === payload.data._id);
        if (idx !== -1) state.customPlans[idx] = payload.data;
        if (state.selectedPlan?._id === payload.data._id) state.selectedPlan = payload.data;
      })
      .addCase(updateCustomPlan.rejected, (state, { payload }) => {
        state.loading.customPlan  = false;
        state.customPlanError = payload;
      })

      .addCase(deleteCustomPlan.pending,   (state) => { state.loading.customPlan = true; })
      .addCase(deleteCustomPlan.fulfilled, (state, { payload }) => {
        state.loading.customPlan = false;
        // FIX: remove from customPlans[], not plans[]
        state.customPlans = state.customPlans.filter((p) => p._id !== payload.planId);
        if (state.selectedPlan?._id === payload.planId) state.selectedPlan = null;
      })
      .addCase(deleteCustomPlan.rejected, (state, { payload }) => {
        state.loading.customPlan = false;
        state.error = payload;
      })

      // ── SECTION 3: PURCHASE FLOW ──────────────────────────────────────────
      .addCase(initiateSubscriptionPurchase.pending,   pending('purchase'))
      .addCase(initiateSubscriptionPurchase.fulfilled, (state, { payload }) => {
        state.loading.purchase = false;
        if (payload.activated) {
          state.mySubscription = payload.data;
          state.pendingOrder   = null;
        } else {
          state.pendingOrder = {
            orderId:  payload.orderId,
            amount:   payload.amount,
            discount: payload.discount,
            planName: payload.planName,
            planType: payload.planType,
            planId:   payload.planId,
          };
        }
      })
      .addCase(initiateSubscriptionPurchase.rejected, fail('purchase'))

      .addCase(verifySubscriptionPayment.pending, (state) => {
        state.loading.verify = true;
        state.error = null;
      })
      .addCase(verifySubscriptionPayment.fulfilled, (state, { payload }) => {
        state.loading.verify = false;
        state.mySubscription = payload.data;
        state.pendingOrder   = null;
        // FIX: if new sub is on a custom plan, merge plan into customPlans[]
        if (payload.data?.plan?.planType === 'custom') {
          const plan = payload.data.plan;
          const idx  = state.customPlans.findIndex((p) => p._id === (plan._id ?? plan));
          if (idx === -1 && typeof plan === 'object') state.customPlans.unshift(plan);
        }
      })
      .addCase(verifySubscriptionPayment.rejected, (state, { payload }) => {
        state.loading.verify = false;
        state.error = payload;
      })

      // ── SECTION 4: CUSTOMER SUBSCRIPTION MANAGEMENT ──────────────────────
      .addCase(fetchMySubscription.pending,   pending('mySubscription'))
      .addCase(fetchMySubscription.fulfilled, (state, { payload }) => {
        state.loading.mySubscription = false;
        state.mySubscription = payload.data;

        // FIX: if active sub is on a custom plan, merge plan into customPlans[]
        // so selectMyCustomPlans works even before explicit create/update
        if (payload.data?.plan?.planType === 'custom') {
          const plan = payload.data.plan;
          if (plan && typeof plan === 'object' && plan._id) {
            const idx = state.customPlans.findIndex((p) => p._id === plan._id);
            if (idx !== -1) state.customPlans[idx] = plan;
            else state.customPlans.unshift(plan);
          }
        }
      })
      .addCase(fetchMySubscription.rejected, fail('mySubscription'))

      .addCase(fetchMySubscriptionHistory.pending,   pending('history'))
      .addCase(fetchMySubscriptionHistory.fulfilled, (state, { payload }) => {
        state.loading.history     = false;
        state.subscriptionHistory = payload.data ?? [];
        if (payload.pagination) state.historyPagination = payload.pagination;
      })
      .addCase(fetchMySubscriptionHistory.rejected, fail('history'))

      .addCase(upgradeSubscription.pending, (state) => {
        state.loading.upgrade = true;
        state.error = null;
      })
      .addCase(upgradeSubscription.fulfilled, (state, { payload }) => {
        state.loading.upgrade = false;
        state.mySubscription  = payload.data;
        // Merge custom plan if upgraded to one
        if (payload.data?.plan?.planType === 'custom') {
          const plan = payload.data.plan;
          if (plan && typeof plan === 'object' && plan._id) {
            const idx = state.customPlans.findIndex((p) => p._id === plan._id);
            if (idx !== -1) state.customPlans[idx] = plan;
            else state.customPlans.unshift(plan);
          }
        }
      })
      .addCase(upgradeSubscription.rejected, (state, { payload }) => {
        state.loading.upgrade = false;
        state.error = payload;
      })

      .addCase(cancelSubscription.pending, (state) => {
        state.loading.cancel = true;
        state.error = null;
      })
      .addCase(cancelSubscription.fulfilled, (state, { payload }) => {
        state.loading.cancel = false;
        state.mySubscription = payload.data;
      })
      .addCase(cancelSubscription.rejected, (state, { payload }) => {
        state.loading.cancel = false;
        state.error = payload;
      })

      .addCase(toggleAutoRenew.pending, (state) => {
        state.loading.autoRenew = true;
        state.error = null;
      })
      .addCase(toggleAutoRenew.fulfilled, (state, { payload }) => {
        state.loading.autoRenew = false;
        if (state.mySubscription) state.mySubscription.autoRenew = payload.autoRenew;
      })
      .addCase(toggleAutoRenew.rejected, (state, { payload }) => {
        state.loading.autoRenew = false;
        // Revert optimistic toggle on failure
        if (state.mySubscription) {
          state.mySubscription.autoRenew = !state.mySubscription.autoRenew;
        }
        state.error = payload;
      })

      // ── SECTION 5: FREE TRIAL ─────────────────────────────────────────────
      .addCase(startFreeTrial.pending,   pending('trial'))
      .addCase(startFreeTrial.fulfilled, (state, { payload }) => {
        state.loading.trial    = false;
        state.mySubscription   = payload.data;
        state.trialEligibility = null; // no longer eligible
      })
      .addCase(startFreeTrial.rejected, fail('trial'))

      .addCase(fetchTrialEligibility.pending,   pending('trial'))
      .addCase(fetchTrialEligibility.fulfilled, (state, { payload }) => {
        state.loading.trial    = false;
        state.trialEligibility = payload;
      })
      .addCase(fetchTrialEligibility.rejected, fail('trial'))

      .addCase(fetchTrialStatus.pending,   pending('trial'))
      .addCase(fetchTrialStatus.fulfilled, (state, { payload }) => {
        state.loading.trial = false;
        // FIX: 404 returns { activeTrial: false } — store gracefully, don't set error
        state.trialStatus = payload;
      })
      .addCase(fetchTrialStatus.rejected, (state, { payload }) => {
        state.loading.trial = false;
        // Don't propagate trial status error to global error — non-critical
        state.trialStatus = { activeTrial: false, daysLeft: 0, plan: null };
      })

      .addCase(initiateTrialConversion.pending, (state) => {
        state.loading.trialConvert = true;
        state.error = null;
      })
      .addCase(initiateTrialConversion.fulfilled, (state, { payload }) => {
        state.loading.trialConvert = false;
        if (payload.activated) {
          state.mySubscription = payload.data;
          state.trialOrder     = null;
          state.pendingOrder   = null;
          state.trialStatus    = null;
        } else {
          state.trialOrder = {
            orderId:    payload.orderId,
            amount:     payload.amount,
            discount:   payload.discount,
            planName:   payload.planName,
            trialSubId: payload.trialSubId,
          };
        }
      })
      .addCase(initiateTrialConversion.rejected, (state, { payload }) => {
        state.loading.trialConvert = false;
        state.error = payload;
      })

      .addCase(verifyTrialConversion.pending, (state) => {
        state.loading.trialVerifyConvert = true;
        state.error = null;
      })
      .addCase(verifyTrialConversion.fulfilled, (state, { payload }) => {
        state.loading.trialVerifyConvert = false;
        state.mySubscription = payload.data;
        state.trialOrder     = null;
        state.trialStatus    = null;
      })
      .addCase(verifyTrialConversion.rejected, (state, { payload }) => {
        state.loading.trialVerifyConvert = false;
        state.error = payload;
      })

      .addCase(expireStaleTrials.pending,   pending('cron'))
      .addCase(expireStaleTrials.fulfilled, (state, { payload }) => {
        state.loading.cron = false;
        state.cronResult   = payload;
      })
      .addCase(expireStaleTrials.rejected, fail('cron'))

      .addCase(adminFetchTrials.pending,   pending('admin'))
      .addCase(adminFetchTrials.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        state.adminTrials   = payload.data ?? [];
        if (payload.pagination) state.trialPagination = payload.pagination;
      })
      .addCase(adminFetchTrials.rejected, fail('admin'))

      // ── SECTION 6: CRON ───────────────────────────────────────────────────
      .addCase(sendExpiryAlerts.pending,   pending('cron'))
      .addCase(sendExpiryAlerts.fulfilled, (state, { payload }) => {
        state.loading.cron = false;
        state.cronResult   = payload;
      })
      .addCase(sendExpiryAlerts.rejected, fail('cron'))

      .addCase(triggerAutoRenew.pending,   pending('cron'))
      .addCase(triggerAutoRenew.fulfilled, (state, { payload }) => {
        state.loading.cron = false;
        state.cronResult   = payload;
      })
      .addCase(triggerAutoRenew.rejected, fail('cron'))

      // ── SECTION 7: ADMIN PLAN MANAGEMENT ─────────────────────────────────
      .addCase(adminFetchAllSubscriptions.pending,   pending('admin'))
      .addCase(adminFetchAllSubscriptions.fulfilled, (state, { payload }) => {
        state.loading.admin      = false;
        state.adminSubscriptions = payload.data ?? [];
        if (payload.pagination) state.adminPagination = payload.pagination;
      })
      .addCase(adminFetchAllSubscriptions.rejected, fail('admin'))

      .addCase(adminFetchPlans.pending,   pending('admin'))
      .addCase(adminFetchPlans.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        state.adminPlans    = payload.data ?? [];
      })
      .addCase(adminFetchPlans.rejected, fail('admin'))

      .addCase(adminCreatePlan.pending,   pending('admin'))
      .addCase(adminCreatePlan.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        state.adminPlans.unshift(payload.data);
        if (payload.data?.planType === 'fixed') {
          state.plans.unshift(payload.data);
        }
      })
      .addCase(adminCreatePlan.rejected, fail('admin'))

      .addCase(adminUpdatePlan.pending,   pending('admin'))
      .addCase(adminUpdatePlan.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        const adminIdx = state.adminPlans.findIndex((p) => p._id === payload.data._id);
        if (adminIdx !== -1) state.adminPlans[adminIdx] = payload.data;
        const pubIdx = state.plans.findIndex((p) => p._id === payload.data._id);
        if (pubIdx !== -1) state.plans[pubIdx] = payload.data;
      })
      .addCase(adminUpdatePlan.rejected, fail('admin'))

      .addCase(adminDeletePlan.pending,   pending('admin'))
      .addCase(adminDeletePlan.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        state.adminPlans = state.adminPlans.filter((p) => p._id !== payload.planId);
        state.plans      = state.plans.filter((p) => p._id !== payload.planId);
      })
      .addCase(adminDeletePlan.rejected, fail('admin'))

      .addCase(adminUpdateSubscription.pending,   pending('admin'))
      .addCase(adminUpdateSubscription.fulfilled, (state, { payload }) => {
        state.loading.admin = false;
        const idx = state.adminSubscriptions.findIndex((s) => s._id === payload.data._id);
        if (idx !== -1) state.adminSubscriptions[idx] = payload.data;
      })
      .addCase(adminUpdateSubscription.rejected, fail('admin'));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  clearError,
  clearCustomPlanError,
  clearPendingOrder,
  clearTrialOrder,
  setSelectedPlan,
  optimisticToggleAutoRenew,
} = subscriptionPlanSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
//
// FIX: ALL selectors use state.subscriptions (matches slice name above).
//      Previous code used state.subscriptionPlan — wrong key, returned undefined.
// ─────────────────────────────────────────────────────────────────────────────

const sel = (state) => state.subscriptions; // FIX: was state.subscriptionPlan

// ── Plans ──────────────────────────────────────────────────────────────────
export const selectAllPlans   = (state) => sel(state).plans;
export const selectFixedPlans = (state) => sel(state).plans.filter(
  (p) => p.planType === 'fixed' && p.isActive !== false
);
// FIX: reads from customPlans[] — separate array, not filtered from plans[]
export const selectMyCustomPlans = (state) => sel(state).customPlans.filter(
  (p) => p.isActive !== false
);
export const selectSelectedPlan = (state) => sel(state).selectedPlan;

// ── Custom plan builder ────────────────────────────────────────────────────
// customPlanPricing = { optionPricing, caps } — page uses pricingData.optionPricing
export const selectCustomPlanPricing        = (state) => sel(state).customPlanPricing;
export const selectCustomPlanPricingLoading = (state) => sel(state).loading.customPlanPricing;
export const selectCustomPlanLoading        = (state) => sel(state).loading.customPlan;
export const selectCustomPlanError          = (state) => sel(state).customPlanError;

// ── Subscription ──────────────────────────────────────────────────────────
export const selectMySubscription      = (state) => sel(state).mySubscription;
export const selectSubscriptionHistory = (state) => sel(state).subscriptionHistory;
export const selectPendingOrder        = (state) => sel(state).pendingOrder;
export const selectTrialOrder          = (state) => sel(state).trialOrder;

export const selectMySubIsActive  = (state) => sel(state).mySubscription?.status === 'Active';
export const selectMySubIsOnTrial = (state) => sel(state).mySubscription?.status === 'Trial';
export const selectMySubHasAccess = (state) => {
  const sub = sel(state).mySubscription;
  if (!sub) return false;
  if (!['Active', 'Trial'].includes(sub.status)) return false;
  if (!sub.expiryDate) return false;
  return new Date(sub.expiryDate) > new Date();
};
export const selectMySubAutoRenew = (state) => sel(state).mySubscription?.autoRenew ?? false;

export const selectCurrentPlanName = (state) => {
  const sub = sel(state).mySubscription;
  if (!sub) return null;
  return sub.plan?.fixedTier || sub.plan?.name || sub.planName || null;
};

// ── Trial ─────────────────────────────────────────────────────────────────
export const selectTrialEligibility = (state) => sel(state).trialEligibility;
export const selectTrialStatus      = (state) => sel(state).trialStatus;
export const selectIsTrialEligible  = (state) => sel(state).trialEligibility?.eligible ?? false;
export const selectIsOnActiveTrial  = (state) => Boolean(sel(state).trialStatus?.activeTrial);
export const selectTrialDaysLeft    = (state) => sel(state).trialStatus?.daysLeft ?? 0;

// ── Admin ─────────────────────────────────────────────────────────────────
export const selectAdminSubscriptions = (state) => sel(state).adminSubscriptions;
export const selectAdminPlans         = (state) => sel(state).adminPlans;
export const selectAdminTrials        = (state) => sel(state).adminTrials;
export const selectCronResult         = (state) => sel(state).cronResult;

// ── Pagination ────────────────────────────────────────────────────────────
export const selectPagination        = (state) => sel(state).pagination;
export const selectAdminPagination   = (state) => sel(state).adminPagination;
export const selectHistoryPagination = (state) => sel(state).historyPagination;
export const selectTrialPagination   = (state) => sel(state).trialPagination;
export const selectMyHistory            = (state) => sel(state).subscriptionHistory;
export const selectMyHistoryPagination  = (state) => sel(state).historyPagination;

// ── Loading flags ─────────────────────────────────────────────────────────
// ── Loading flags ─────────────────────────────────────────────────────────
export const selectLoading                   = (state) => sel(state)?.loading;
export const selectPlansLoading              = (state) => sel(state)?.loading?.plans;
export const selectMySubLoading              = (state) => sel(state)?.loading?.mySubscription ?? false; // Added optional chaining protection
export const selectPurchaseLoading           = (state) => sel(state)?.loading?.purchase;
export const selectVerifyLoading             = (state) => sel(state)?.loading?.verify;
export const selectUpgradeLoading            = (state) => sel(state)?.loading?.upgrade;
export const selectCancelLoading             = (state) => sel(state)?.loading?.cancel;
export const selectAutoRenewLoading          = (state) => sel(state)?.loading?.autoRenew;
export const selectToggleAutoRenewLoading    = (state) => sel(state)?.loading?.autoRenew; // alias
export const selectMyHistoryLoading          = (state) => sel(state)?.loading?.history;
export const selectAdminLoading              = (state) => sel(state)?.loading?.admin;
export const selectTrialLoading              = (state) => sel(state)?.loading?.trial;
export const selectTrialStatusLoading        = (state) => sel(state)?.loading?.trial;      // alias
export const selectTrialConvertLoading       = (state) => sel(state)?.loading?.trialConvert;
export const selectTrialVerifyConvertLoading = (state) => sel(state)?.loading?.trialVerifyConvert;
export const selectCronLoading               = (state) => sel(state)?.loading?.cron;

// ── Errors ────────────────────────────────────────────────────────────────
export const selectSubscriptionError = (state) => sel(state).error;
export const selectCustomPlanErrorMsg = (state) => sel(state).customPlanError;

export default subscriptionPlanSlice.reducer;