/**
 * subscriptionSlice.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Redux Toolkit slice for the full Subscription domain.
 *
 * Aligned with subscriptionRouter.js fixes:
 *
 *   § 3  Purchase Flow
 *         POST /buy       → NOW returns { activated, orderId?, amount, data? }
 *                           - activated=true  → ₹0 plan, sub already created,
 *                             no Razorpay needed.  Sets mySubscription directly.
 *                           - activated=false → paid, store pendingOrder as before.
 *
 *         POST /verify    → planId & amount now OPTIONAL in body (router resolves
 *                           from Razorpay order notes).  Slice sends them anyway
 *                           for belt-and-suspenders but won't break if absent.
 *
 *   § 4  Customer Sub Management
 *         PUT /upgrade    → now accepts Active OR Trial status on the server.
 *                           No slice change needed — fulfilled handler already
 *                           patches mySubscription.
 *         PUT /cancel     → now accepts Active OR Trial on the server.
 *                           No slice change needed.
 *
 *   § 7  Free Trial
 *         POST /free-trial/convert → NOW returns { activated, orderId?, data? }
 *                           Same two-path logic as /buy:
 *                           - activated=true  → ₹0 conversion, sub already Active.
 *                           - activated=false → paid, store trialOrder.
 *
 *         POST /free-trial/verify-convert
 *                           amount now optional in body — slice still sends it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
//  INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely extracts a user-safe error message from an Axios error.
 * Never leaks stack traces or DB internals into the Redux store.
 */
const extractError = (error) => {
  if (error?.response?.data?.errors) {
    return error.response.data.errors.map((e) => e.msg).join(', ');
  }
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message === 'Network Error')
    return 'Network error. Please check your connection.';
  return 'Something went wrong. Please try again.';
};

/**
 * Thunk factory — reduces per-thunk boilerplate.
 * @param {string}   typePrefix
 * @param {Function} apiFn          (arg, thunkAPI) => Promise<any>
 * @param {object}   [opts]
 * @param {string}   [opts.successMsg]   toast shown on fulfilled
 * @param {boolean}  [opts.silentError]  suppress error toast (background calls)
 */
const makeThunk = (typePrefix, apiFn, opts = {}) =>
  createAsyncThunk(typePrefix, async (arg, thunkAPI) => {
    try {
      const result = await apiFn(arg, thunkAPI);
      if (opts.successMsg) toast.success(opts.successMsg);
      return result;
    } catch (error) {
      const message = extractError(error);
      if (!opts.silentError) toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
//  § 1  PLAN CATALOGUE
// ─────────────────────────────────────────────────────────────────────────────

/** GET /subscriptions/plans */
export const fetchAllPlans = makeThunk('subscriptions/fetchAllPlans', async () => {
  const { data } = await API.get('/subscriptions/plans');
  return data; // { success, count, data: Plan[] }
});

/** GET /subscriptions/plans/:planId */
export const fetchPlanById = makeThunk('subscriptions/fetchPlanById', async (planId) => {
  const { data } = await API.get(`/subscriptions/plans/${planId}`);
  return data; // { success, data: Plan }
});

// ─────────────────────────────────────────────────────────────────────────────
//  § 2  CUSTOM PLAN BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/** GET /subscriptions/custom-plan/pricing */
export const fetchCustomPlanPricing = makeThunk(
  'subscriptions/fetchCustomPlanPricing',
  async () => {
    const { data } = await API.get('/subscriptions/custom-plan/pricing');
    return data; // { success, data: { unitPrices, caps } }
  }
);

/** POST /subscriptions/custom-plan — payload: { name, options[] } */
export const createCustomPlan = makeThunk(
  'subscriptions/createCustomPlan',
  async (payload) => {
    const { data } = await API.post('/subscriptions/custom-plan', payload);
    return data; // { success, data: Plan }
  },
  { successMsg: 'Custom plan created successfully!' }
);

/** PUT /subscriptions/custom-plan/:planId — payload: { planId, name?, options[] } */
export const updateCustomPlan = makeThunk(
  'subscriptions/updateCustomPlan',
  async ({ planId, ...payload }) => {
    const { data } = await API.put(`/subscriptions/custom-plan/${planId}`, payload);
    return data; // { success, data: Plan }
  },
  { successMsg: 'Custom plan updated.' }
);

/** DELETE /subscriptions/custom-plan/:planId */
export const deleteCustomPlan = makeThunk(
  'subscriptions/deleteCustomPlan',
  async (planId) => {
    const { data } = await API.delete(`/subscriptions/custom-plan/${planId}`);
    return { ...data, planId };
  },
  { successMsg: 'Custom plan deactivated.' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 3  PURCHASE FLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /subscriptions/buy
 * payload: { planId, amount, couponCode? }
 *
 * Router response shapes:
 *   ₹0 plan  → { success, activated: true,  data: UserSubscription, message }
 *   paid     → { success, activated: false, orderId, amount, discount,
 *                planName, planType, planId }
 *
 * The fulfilled handler checks `activated` to decide whether to store a
 * pendingOrder or immediately set mySubscription.
 */
export const initiateSubscriptionPurchase = makeThunk(
  'subscriptions/initiateSubscriptionPurchase',
  async (payload) => {
    const { data } = await API.post('/subscriptions/buy', payload);
    return data;
  }
);

/**
 * POST /subscriptions/verify
 * payload: { razorpay_order_id, razorpay_payment_id, razorpay_signature,
 *             planId?, amount? }
 * planId and amount are optional — router resolves from Razorpay order notes
 * when absent.  We still send them for safety.
 */
export const verifySubscriptionPayment = makeThunk(
  'subscriptions/verifySubscriptionPayment',
  async (payload) => {
    const { data } = await API.post('/subscriptions/verify', payload);
    return data; // { success, data: UserSubscription }
  },
  { successMsg: 'Subscription activated! Welcome aboard 🎉' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 4  CUSTOMER SUBSCRIPTION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** GET /subscriptions/my */
export const fetchMySubscription = makeThunk(
  'subscriptions/fetchMySubscription',
  async () => {
    const { data } = await API.get('/subscriptions/my');
    return data; // { success, data: UserSubscription }
  },
  { silentError: true } // 404 expected when no sub exists
);

/** GET /subscriptions/my/history — params: { page?, limit? } */
export const fetchMySubscriptionHistory = makeThunk(
  'subscriptions/fetchMySubscriptionHistory',
  async (params = {}) => {
    const { data } = await API.get('/subscriptions/my/history', { params });
    return data; // { success, pagination, data: UserSubscription[] }
  }
);

/**
 * PUT /subscriptions/upgrade
 * payload: { newPlanId }
 * Server now accepts Active OR Trial status — works for trial users too.
 */
export const upgradeSubscription = makeThunk(
  'subscriptions/upgradeSubscription',
  async (payload) => {
    const { data } = await API.put('/subscriptions/upgrade', payload);
    return data; // { success, data: UserSubscription }
  },
  { successMsg: 'Plan upgraded successfully.' }
);

/**
 * PUT /subscriptions/cancel
 * Server now accepts Active OR Trial status.
 */
export const cancelSubscription = makeThunk(
  'subscriptions/cancelSubscription',
  async () => {
    const { data } = await API.put('/subscriptions/cancel');
    return data; // { success, message, data: UserSubscription }
  },
  { successMsg: 'Subscription cancelled. You retain access until the current period ends.' }
);

/** PUT /subscriptions/toggle-auto-renew */
export const toggleAutoRenew = makeThunk(
  'subscriptions/toggleAutoRenew',
  async () => {
    const { data } = await API.put('/subscriptions/toggle-auto-renew');
    return data; // { success, autoRenew: boolean, message }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 5  CRON / SYSTEM JOBS  (Admin)
// ─────────────────────────────────────────────────────────────────────────────

/** POST /subscriptions/send-expiry-alerts */
export const sendExpiryAlerts = makeThunk(
  'subscriptions/sendExpiryAlerts',
  async () => {
    const { data } = await API.post('/subscriptions/send-expiry-alerts');
    return data; // { success, totalProcessed, totalEmailsSent, details }
  },
  { successMsg: 'Expiry alert emails dispatched.' }
);

/** POST /subscriptions/auto-renew-trigger */
export const triggerAutoRenew = makeThunk(
  'subscriptions/triggerAutoRenew',
  async () => {
    const { data } = await API.post('/subscriptions/auto-renew-trigger');
    return data; // { success, message, summary, details }
  },
  { successMsg: 'Auto-renewal process completed.' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 6  ADMIN PLAN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** GET /subscriptions/admin/all — params: { page?, limit?, status?, userId? } */
export const adminFetchAllSubscriptions = makeThunk(
  'subscriptions/adminFetchAllSubscriptions',
  async (params = {}) => {
    const { data } = await API.get('/subscriptions/admin/all', { params });
    return data; // { success, pagination, data: UserSubscription[] }
  }
);

/** GET /subscriptions/admin/plans — params: { planType?, isActive? } */
export const adminFetchAllPlans = makeThunk(
  'subscriptions/adminFetchAllPlans',
  async (params = {}) => {
    const { data } = await API.get('/subscriptions/admin/plans', { params });
    return data; // { success, count, data: Plan[] }
  }
);

/** POST /subscriptions/admin/plans — payload: full plan body */
export const adminCreatePlan = makeThunk(
  'subscriptions/adminCreatePlan',
  async (payload) => {
    const { data } = await API.post('/subscriptions/admin/plans', payload);
    return data; // { success, data: Plan }
  },
  { successMsg: 'Plan created.' }
);

/** PUT /subscriptions/admin/plans/:planId — payload: { planId, ...fields } */
export const adminUpdatePlan = makeThunk(
  'subscriptions/adminUpdatePlan',
  async ({ planId, ...payload }) => {
    const { data } = await API.put(`/subscriptions/admin/plans/${planId}`, payload);
    return data; // { success, data: Plan }
  },
  { successMsg: 'Plan updated.' }
);

/** DELETE /subscriptions/admin/plans/:planId (superadmin only) */
export const adminDeactivatePlan = makeThunk(
  'subscriptions/adminDeactivatePlan',
  async (planId) => {
    const { data } = await API.delete(`/subscriptions/admin/plans/${planId}`);
    return { ...data, planId };
  },
  { successMsg: 'Plan deactivated.' }
);

/** PUT /subscriptions/admin/subscriptions/:subId — payload: { subId, ...fields } */
export const adminUpdateSubscription = makeThunk(
  'subscriptions/adminUpdateSubscription',
  async ({ subId, ...payload }) => {
    const { data } = await API.put(`/subscriptions/admin/subscriptions/${subId}`, payload);
    return data; // { success, data: UserSubscription }
  },
  { successMsg: 'Subscription updated.' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 7  FREE TRIAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /subscriptions/free-trial/start
 * payload: { planId, razorpay_payment_method_id? }
 * Always ₹0 — no Razorpay call on the server.
 */
export const startFreeTrial = makeThunk(
  'subscriptions/startFreeTrial',
  async (payload) => {
    const { data } = await API.post('/subscriptions/free-trial/start', payload);
    return data; // { success, message, trialExpiry, data: UserSubscription }
  },
  { successMsg: 'Your free trial has started! Enjoy full access.' }
);

/** GET /subscriptions/free-trial/eligibility */
export const fetchTrialEligibility = makeThunk(
  'subscriptions/fetchTrialEligibility',
  async () => {
    const { data } = await API.get('/subscriptions/free-trial/eligibility');
    return data; // { success, eligible, reason, eligiblePlans }
  },
  { silentError: true }
);

/** GET /subscriptions/free-trial/status */
export const fetchTrialStatus = makeThunk(
  'subscriptions/fetchTrialStatus',
  async () => {
    const { data } = await API.get('/subscriptions/free-trial/status');
    return data; // { success, activeTrial, daysLeft, trialExpiry, plan, data }
  },
  { silentError: true }
);

/**
 * POST /subscriptions/free-trial/convert
 * payload: { couponCode? }
 *
 * Router response shapes (mirrors /buy):
 *   ₹0 conversion → { success, activated: true,  data: UserSubscription, message }
 *   paid          → { success, activated: false, orderId, amount, discount,
 *                     planName, trialSubId }
 *
 * The fulfilled handler checks `activated` to decide the code path.
 */
export const initiateTrialConversion = makeThunk(
  'subscriptions/initiateTrialConversion',
  async (payload = {}) => {
    const { data } = await API.post('/subscriptions/free-trial/convert', payload);
    return data;
  }
);

/**
 * POST /subscriptions/free-trial/verify-convert
 * payload: { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount? }
 * amount is optional — router resolves from Razorpay order when absent.
 */
export const verifyTrialConversion = makeThunk(
  'subscriptions/verifyTrialConversion',
  async (payload) => {
    const { data } = await API.post('/subscriptions/free-trial/verify-convert', payload);
    return data; // { success, message, data: UserSubscription }
  },
  { successMsg: 'Trial converted — your subscription is now active! 🎉' }
);

/** POST /subscriptions/free-trial/expire-stale (admin cron) */
export const adminExpireStaleTrials = makeThunk(
  'subscriptions/adminExpireStaleTrials',
  async () => {
    const { data } = await API.post('/subscriptions/free-trial/expire-stale');
    return data; // { success, expiredCount, details }
  },
  { successMsg: 'Stale trials expired and notifications sent.' }
);

/** GET /subscriptions/admin/trials — params: { page?, limit?, status?, userId? } */
export const adminFetchAllTrials = makeThunk(
  'subscriptions/adminFetchAllTrials',
  async (params = {}) => {
    const { data } = await API.get('/subscriptions/admin/trials', { params });
    return data; // { success, pagination, data: UserSubscription[] }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const paginationInit = () => ({ total: 0, page: 1, pages: 1 });
const asyncStatusInit = () => ({ loading: false, error: null });

const initialState = {
  // § 1 Plan Catalogue
  plans:              [],
  selectedPlan:       null,
  plansStatus:        asyncStatusInit(),
  selectedPlanStatus: asyncStatusInit(),

  // § 2 Custom Plan Builder
  customPlanPricing:       null,
  customPlanPricingStatus: asyncStatusInit(),
  customPlanStatus:        asyncStatusInit(),

  // § 3 Purchase Flow
  // pendingOrder is set ONLY for paid flows (activated=false).
  // For ₹0 flows (activated=true) mySubscription is set directly instead.
  pendingOrder:    null,
  purchaseStatus:  asyncStatusInit(),
  verifyStatus:    asyncStatusInit(),

  // § 4 Customer Subscription Management
  mySubscription:      null,
  mySubStatus:         asyncStatusInit(),
  myHistory:           [],
  myHistoryPagination: paginationInit(),
  myHistoryStatus:     asyncStatusInit(),
  upgradeStatus:         asyncStatusInit(),
  cancelStatus:          asyncStatusInit(),
  toggleAutoRenewStatus: asyncStatusInit(),

  // § 5 Cron / System Jobs
  expiryAlertResult: null,
  expiryAlertStatus: asyncStatusInit(),
  autoRenewResult:   null,
  autoRenewStatus:   asyncStatusInit(),

  // § 6 Admin Plan Management
  adminSubscriptions:    [],
  adminSubPagination:    paginationInit(),
  adminSubStatus:        asyncStatusInit(),
  adminPlans:            [],
  adminPlansStatus:      asyncStatusInit(),
  adminPlanMutateStatus: asyncStatusInit(),
  adminSubUpdateStatus:  asyncStatusInit(),

  // § 7 Free Trial
  // trialOrder is set ONLY for paid trial-conversion flows (activated=false).
  // For ₹0 conversions mySubscription is set directly.
  trialEligibility:        null,
  trialEligibilityStatus:  asyncStatusInit(),
  trialStatus:             null,
  trialStatusFetchStatus:  asyncStatusInit(),
  trialOrder:              null,
  trialConvertStatus:      asyncStatusInit(),
  trialVerifyConvertStatus: asyncStatusInit(),
  adminTrials:             [],
  adminTrialsPagination:   paginationInit(),
  adminTrialsStatus:       asyncStatusInit(),
  adminExpireStaleStatus:  asyncStatusInit(),
};

// ─────────────────────────────────────────────────────────────────────────────
//  SLICE
// ─────────────────────────────────────────────────────────────────────────────

const subscriptionSlice = createSlice({
  name: 'subscriptions',
  initialState,

  reducers: {
    /** Call on logout — wipes all subscription state */
    clearSubscriptionState: () => initialState,

    /**
     * Clears the Razorpay pending order (paid subscription flow).
     * Call after checkout modal closes or payment is verified.
     */
    clearPendingOrder: (state) => {
      state.pendingOrder   = null;
      state.purchaseStatus = asyncStatusInit();
      state.verifyStatus   = asyncStatusInit();
    },

    /**
     * Clears the Razorpay trial conversion order.
     * Call after trial checkout modal closes or payment is verified.
     */
    clearTrialOrder: (state) => {
      state.trialOrder              = null;
      state.trialConvertStatus      = asyncStatusInit();
      state.trialVerifyConvertStatus = asyncStatusInit();
    },

    /** Clears a named status error — useful before form re-submission */
    clearError: (state, action) => {
      const key = action.payload; // e.g. 'purchaseStatus'
      if (state[key]) state[key].error = null;
    },

    /**
     * Optimistically flip autoRenew before the API round-trip.
     * The toggleAutoRenew.rejected handler reverts this on failure.
     */
    optimisticToggleAutoRenew: (state) => {
      if (state.mySubscription) {
        state.mySubscription.autoRenew = !state.mySubscription.autoRenew;
      }
    },

    /** Clears cron result panels in the admin UI */
    clearCronResults: (state) => {
      state.expiryAlertResult = null;
      state.autoRenewResult   = null;
    },
  },

  extraReducers: (builder) => {
    // Convenience factories — keep extraReducers terse
    const pending  = (key) => (state)         => { state[key].loading = true;  state[key].error = null; };
    const rejected = (key) => (state, action) => { state[key].loading = false; state[key].error = action.payload; };

    // ── § 1 Plan Catalogue ──────────────────────────────────────────────────
    builder
      .addCase(fetchAllPlans.pending,   pending('plansStatus'))
      .addCase(fetchAllPlans.rejected,  rejected('plansStatus'))
      .addCase(fetchAllPlans.fulfilled, (state, { payload }) => {
        state.plansStatus.loading = false;
        state.plans = payload.data ?? [];
      })

      .addCase(fetchPlanById.pending,   pending('selectedPlanStatus'))
      .addCase(fetchPlanById.rejected,  rejected('selectedPlanStatus'))
      .addCase(fetchPlanById.fulfilled, (state, { payload }) => {
        state.selectedPlanStatus.loading = false;
        state.selectedPlan = payload.data ?? null;
      })

    // ── § 2 Custom Plan Builder ─────────────────────────────────────────────
      .addCase(fetchCustomPlanPricing.pending,   pending('customPlanPricingStatus'))
      .addCase(fetchCustomPlanPricing.rejected,  rejected('customPlanPricingStatus'))
      .addCase(fetchCustomPlanPricing.fulfilled, (state, { payload }) => {
        state.customPlanPricingStatus.loading = false;
        state.customPlanPricing = payload.data ?? null;
      })

      .addCase(createCustomPlan.pending,   pending('customPlanStatus'))
      .addCase(createCustomPlan.rejected,  rejected('customPlanStatus'))
      .addCase(createCustomPlan.fulfilled, (state, { payload }) => {
        state.customPlanStatus.loading = false;
        const newPlan = payload.data;
        if (newPlan) {
          // Server deactivated any previous custom plan — replace in list
          state.plans = [
            ...state.plans.filter((p) => p.planType !== 'custom'),
            newPlan,
          ];
        }
      })

      .addCase(updateCustomPlan.pending,   pending('customPlanStatus'))
      .addCase(updateCustomPlan.rejected,  rejected('customPlanStatus'))
      .addCase(updateCustomPlan.fulfilled, (state, { payload }) => {
        state.customPlanStatus.loading = false;
        const updated = payload.data;
        if (updated) {
          state.plans = state.plans.map((p) => (p._id === updated._id ? updated : p));
          if (state.selectedPlan?._id === updated._id) state.selectedPlan = updated;
        }
      })

      .addCase(deleteCustomPlan.pending,   pending('customPlanStatus'))
      .addCase(deleteCustomPlan.rejected,  rejected('customPlanStatus'))
      .addCase(deleteCustomPlan.fulfilled, (state, { payload }) => {
        state.customPlanStatus.loading = false;
        state.plans = state.plans.filter((p) => p._id !== payload.planId);
        if (state.selectedPlan?._id === payload.planId) state.selectedPlan = null;
      })

    // ── § 3 Purchase Flow ───────────────────────────────────────────────────
      /**
       * initiateSubscriptionPurchase.fulfilled
       *
       * Two router response shapes:
       *
       *   PATH B (₹0 / free): { activated: true, data: UserSubscription, message }
       *     → Subscription is already created server-side.
       *       Set mySubscription immediately; do NOT store a pendingOrder.
       *       Show success toast here because there's no subsequent /verify call.
       *
       *   PATH A (paid):      { activated: false, orderId, amount, discount,
       *                          planName, planType, planId }
       *     → Store as pendingOrder so the Razorpay checkout modal can read it.
       *       Success toast fires later via verifySubscriptionPayment.
       */
      .addCase(initiateSubscriptionPurchase.pending,   pending('purchaseStatus'))
      .addCase(initiateSubscriptionPurchase.rejected,  rejected('purchaseStatus'))
      .addCase(initiateSubscriptionPurchase.fulfilled, (state, { payload }) => {
        state.purchaseStatus.loading = false;

        if (payload.activated) {
          // ₹0 path — subscription already active
          state.mySubscription = payload.data ?? null;
          state.pendingOrder   = null;
          toast.success(payload.message || 'Subscription activated for free! 🎉');
        } else {
          // Paid path — store order for Razorpay checkout
          const { orderId, amount, discount, planName, planType, planId } = payload;
          state.pendingOrder = { orderId, amount, discount, planName, planType, planId };
        }
      })

      .addCase(verifySubscriptionPayment.pending,   pending('verifyStatus'))
      .addCase(verifySubscriptionPayment.rejected,  rejected('verifyStatus'))
      .addCase(verifySubscriptionPayment.fulfilled, (state, { payload }) => {
        state.verifyStatus.loading = false;
        state.pendingOrder         = null; // order consumed
        state.mySubscription       = payload.data ?? null;
      })

    // ── § 4 Customer Subscription Management ───────────────────────────────
      .addCase(fetchMySubscription.pending,   pending('mySubStatus'))
      .addCase(fetchMySubscription.rejected,  (state, { payload }) => {
        state.mySubStatus.loading = false;
        // 404 "No subscription found" is a normal state, not a UI error
        if (payload?.includes?.('No subscription')) {
          state.mySubscription    = null;
          state.mySubStatus.error = null;
        } else {
          state.mySubStatus.error = payload;
        }
      })
      .addCase(fetchMySubscription.fulfilled, (state, { payload }) => {
        state.mySubStatus.loading = false;
        state.mySubscription = payload.data ?? null;
      })

      .addCase(fetchMySubscriptionHistory.pending,   pending('myHistoryStatus'))
      .addCase(fetchMySubscriptionHistory.rejected,  rejected('myHistoryStatus'))
      .addCase(fetchMySubscriptionHistory.fulfilled, (state, { payload }) => {
        state.myHistoryStatus.loading = false;
        state.myHistory           = payload.data        ?? [];
        state.myHistoryPagination = payload.pagination  ?? paginationInit();
      })

      // upgradeSubscription — server now accepts Active OR Trial
      .addCase(upgradeSubscription.pending,   pending('upgradeStatus'))
      .addCase(upgradeSubscription.rejected,  rejected('upgradeStatus'))
      .addCase(upgradeSubscription.fulfilled, (state, { payload }) => {
        state.upgradeStatus.loading = false;
        // Server always returns the updated sub with status 'Active'
        state.mySubscription = payload.data ?? state.mySubscription;
        // Clear any stale trial state since the sub is now Active
        if (state.trialStatus) state.trialStatus = { activeTrial: false };
      })

      // cancelSubscription — server now accepts Active OR Trial
      .addCase(cancelSubscription.pending,   pending('cancelStatus'))
      .addCase(cancelSubscription.rejected,  rejected('cancelStatus'))
      .addCase(cancelSubscription.fulfilled, (state, { payload }) => {
        state.cancelStatus.loading = false;
        state.mySubscription = payload.data ?? state.mySubscription;
        // If a trial was cancelled clear trial state too
        if (state.trialStatus?.activeTrial) state.trialStatus = { activeTrial: false };
      })

      .addCase(toggleAutoRenew.pending,   pending('toggleAutoRenewStatus'))
      .addCase(toggleAutoRenew.rejected,  (state, { payload }) => {
        state.toggleAutoRenewStatus.loading = false;
        state.toggleAutoRenewStatus.error   = payload;
        // Revert the optimistic update on failure
        if (state.mySubscription) {
          state.mySubscription.autoRenew = !state.mySubscription.autoRenew;
        }
      })
      .addCase(toggleAutoRenew.fulfilled, (state, { payload }) => {
        state.toggleAutoRenewStatus.loading = false;
        // Server is source of truth
        if (state.mySubscription) {
          state.mySubscription.autoRenew = payload.autoRenew;
        }
        toast.success(payload.message ?? 'Auto-renew preference saved.');
      })

    // ── § 5 Cron / System Jobs ──────────────────────────────────────────────
      .addCase(sendExpiryAlerts.pending,   pending('expiryAlertStatus'))
      .addCase(sendExpiryAlerts.rejected,  rejected('expiryAlertStatus'))
      .addCase(sendExpiryAlerts.fulfilled, (state, { payload }) => {
        state.expiryAlertStatus.loading = false;
        state.expiryAlertResult = {
          totalProcessed:  payload.totalProcessed,
          totalEmailsSent: payload.totalEmailsSent,
          details:         payload.details,
        };
      })

      .addCase(triggerAutoRenew.pending,   pending('autoRenewStatus'))
      .addCase(triggerAutoRenew.rejected,  rejected('autoRenewStatus'))
      .addCase(triggerAutoRenew.fulfilled, (state, { payload }) => {
        state.autoRenewStatus.loading = false;
        state.autoRenewResult = { summary: payload.summary, details: payload.details };
      })

    // ── § 6 Admin Plan Management ───────────────────────────────────────────
      .addCase(adminFetchAllSubscriptions.pending,   pending('adminSubStatus'))
      .addCase(adminFetchAllSubscriptions.rejected,  rejected('adminSubStatus'))
      .addCase(adminFetchAllSubscriptions.fulfilled, (state, { payload }) => {
        state.adminSubStatus.loading = false;
        state.adminSubscriptions = payload.data        ?? [];
        state.adminSubPagination = payload.pagination  ?? paginationInit();
      })

      .addCase(adminFetchAllPlans.pending,   pending('adminPlansStatus'))
      .addCase(adminFetchAllPlans.rejected,  rejected('adminPlansStatus'))
      .addCase(adminFetchAllPlans.fulfilled, (state, { payload }) => {
        state.adminPlansStatus.loading = false;
        state.adminPlans = payload.data ?? [];
      })

      .addCase(adminCreatePlan.pending,   pending('adminPlanMutateStatus'))
      .addCase(adminCreatePlan.rejected,  rejected('adminPlanMutateStatus'))
      .addCase(adminCreatePlan.fulfilled, (state, { payload }) => {
        state.adminPlanMutateStatus.loading = false;
        const created = payload.data;
        if (created) {
          state.adminPlans = [created, ...state.adminPlans];
          // Surface in customer-facing plan list if already loaded
          if (state.plans.length > 0) state.plans = [created, ...state.plans];
        }
      })

      .addCase(adminUpdatePlan.pending,   pending('adminPlanMutateStatus'))
      .addCase(adminUpdatePlan.rejected,  rejected('adminPlanMutateStatus'))
      .addCase(adminUpdatePlan.fulfilled, (state, { payload }) => {
        state.adminPlanMutateStatus.loading = false;
        const updated = payload.data;
        if (updated) {
          state.adminPlans = state.adminPlans.map((p) => (p._id === updated._id ? updated : p));
          state.plans      = state.plans.map((p)      => (p._id === updated._id ? updated : p));
          if (state.selectedPlan?._id === updated._id) state.selectedPlan = updated;
        }
      })

      .addCase(adminDeactivatePlan.pending,   pending('adminPlanMutateStatus'))
      .addCase(adminDeactivatePlan.rejected,  rejected('adminPlanMutateStatus'))
      .addCase(adminDeactivatePlan.fulfilled, (state, { payload }) => {
        state.adminPlanMutateStatus.loading = false;
        // Mark inactive rather than remove — preserves list context in admin UI
        state.adminPlans = state.adminPlans.map((p) =>
          p._id === payload.planId ? { ...p, isActive: false } : p
        );
        state.plans = state.plans.filter((p) => p._id !== payload.planId);
      })

      .addCase(adminUpdateSubscription.pending,   pending('adminSubUpdateStatus'))
      .addCase(adminUpdateSubscription.rejected,  rejected('adminSubUpdateStatus'))
      .addCase(adminUpdateSubscription.fulfilled, (state, { payload }) => {
        state.adminSubUpdateStatus.loading = false;
        const updated = payload.data;
        if (updated) {
          state.adminSubscriptions = state.adminSubscriptions.map((s) =>
            s._id === updated._id ? updated : s
          );
          // Keep customer view in sync if same document
          if (state.mySubscription?._id === updated._id) state.mySubscription = updated;
        }
      })

    // ── § 7 Free Trial ──────────────────────────────────────────────────────
      .addCase(startFreeTrial.pending,   pending('trialStatusFetchStatus'))
      .addCase(startFreeTrial.rejected,  rejected('trialStatusFetchStatus'))
      .addCase(startFreeTrial.fulfilled, (state, { payload }) => {
        state.trialStatusFetchStatus.loading = false;
        const sub = payload.data;
        if (sub) {
          state.mySubscription = sub;
          state.trialStatus = {
            activeTrial: true,
            trialExpiry: payload.trialExpiry,
            daysLeft:    payload.daysLeft ?? null,
            plan:        sub.plan ?? null,
            data:        sub,
          };
          // Mark ineligible immediately so UI updates without a round-trip
          if (state.trialEligibility) {
            state.trialEligibility.eligible = false;
            state.trialEligibility.reason   = 'Free trial already used.';
          }
        }
      })

      .addCase(fetchTrialEligibility.pending,   pending('trialEligibilityStatus'))
      .addCase(fetchTrialEligibility.rejected,  rejected('trialEligibilityStatus'))
      .addCase(fetchTrialEligibility.fulfilled, (state, { payload }) => {
        state.trialEligibilityStatus.loading = false;
        state.trialEligibility = {
          eligible:      payload.eligible,
          reason:        payload.reason        ?? null,
          eligiblePlans: payload.eligiblePlans ?? [],
        };
      })

      .addCase(fetchTrialStatus.pending,   pending('trialStatusFetchStatus'))
      .addCase(fetchTrialStatus.rejected,  (state, { payload }) => {
        state.trialStatusFetchStatus.loading = false;
        // 404 "No active trial" is a normal state, not a hard UI error
        if (payload?.includes?.('No active trial')) {
          state.trialStatus = { activeTrial: false };
          state.trialStatusFetchStatus.error = null;
        } else {
          state.trialStatusFetchStatus.error = payload;
        }
      })
      .addCase(fetchTrialStatus.fulfilled, (state, { payload }) => {
        state.trialStatusFetchStatus.loading = false;
        state.trialStatus = {
          activeTrial: payload.activeTrial,
          daysLeft:    payload.daysLeft    ?? 0,
          trialExpiry: payload.trialExpiry ?? null,
          plan:        payload.plan        ?? null,
          data:        payload.data        ?? null,
        };
      })

      /**
       * initiateTrialConversion.fulfilled
       *
       * Two router response shapes (same logic as initiateSubscriptionPurchase):
       *
       *   PATH B (₹0): { activated: true, data: UserSubscription, message }
       *     → Trial already converted server-side.
       *       Set mySubscription to the now-Active doc; clear trialStatus.
       *       Show success toast immediately.
       *
       *   PATH A (paid): { activated: false, orderId, amount, discount,
       *                    planName, trialSubId }
       *     → Store as trialOrder; Razorpay checkout opens in the component.
       *       Success toast fires later via verifyTrialConversion.
       */
      .addCase(initiateTrialConversion.pending,   pending('trialConvertStatus'))
      .addCase(initiateTrialConversion.rejected,  rejected('trialConvertStatus'))
      .addCase(initiateTrialConversion.fulfilled, (state, { payload }) => {
        state.trialConvertStatus.loading = false;

        if (payload.activated) {
          // ₹0 path — already converted server-side
          state.mySubscription = payload.data ?? null;
          state.trialOrder     = null;
          state.trialStatus    = { activeTrial: false };
          toast.success(payload.message || 'Trial converted — your subscription is now active! 🎉');
        } else {
          // Paid path — store order for Razorpay checkout
          const { orderId, amount, discount, planName, trialSubId } = payload;
          state.trialOrder = { orderId, amount, discount, planName, trialSubId };
        }
      })

      .addCase(verifyTrialConversion.pending,   pending('trialVerifyConvertStatus'))
      .addCase(verifyTrialConversion.rejected,  rejected('trialVerifyConvertStatus'))
      .addCase(verifyTrialConversion.fulfilled, (state, { payload }) => {
        state.trialVerifyConvertStatus.loading = false;
        state.trialOrder   = null; // order consumed
        const converted    = payload.data;
        if (converted) {
          state.mySubscription = converted;
          state.trialStatus    = { activeTrial: false }; // trial → paid
        }
      })

      .addCase(adminExpireStaleTrials.pending,   pending('adminExpireStaleStatus'))
      .addCase(adminExpireStaleTrials.rejected,  rejected('adminExpireStaleStatus'))
      .addCase(adminExpireStaleTrials.fulfilled, (state) => {
        state.adminExpireStaleStatus.loading = false;
        // Reflect in admin trials list if already loaded
        if (state.adminTrials.length > 0) {
          const now = new Date();
          state.adminTrials = state.adminTrials.map((t) =>
            t.status === 'Trial' && new Date(t.expiryDate) < now
              ? { ...t, status: 'Expired' }
              : t
          );
        }
      })

      .addCase(adminFetchAllTrials.pending,   pending('adminTrialsStatus'))
      .addCase(adminFetchAllTrials.rejected,  rejected('adminTrialsStatus'))
      .addCase(adminFetchAllTrials.fulfilled, (state, { payload }) => {
        state.adminTrialsStatus.loading = false;
        state.adminTrials           = payload.data        ?? [];
        state.adminTrialsPagination = payload.pagination  ?? paginationInit();
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  clearSubscriptionState,
  clearPendingOrder,
  clearTrialOrder,
  clearError,
  optimisticToggleAutoRenew,
  clearCronResults,
} = subscriptionSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
//  SELECTORS
//  — pure functions; derived values computed here, never stored in state
//  — memo-safe: return primitives or stable references only
// ─────────────────────────────────────────────────────────────────────────────

const sel = (state) => state.subscriptions;

// § 1 Plans
export const selectAllPlans          = (state) => sel(state).plans;
export const selectFixedPlans        = (state) => sel(state).plans.filter((p) => p.planType === 'fixed');
export const selectMyCustomPlans     = (state) => sel(state).plans.filter((p) => p.planType === 'custom');
export const selectSelectedPlan      = (state) => sel(state).selectedPlan;
export const selectPlansLoading      = (state) => sel(state).plansStatus.loading;
export const selectPlansError        = (state) => sel(state).plansStatus.error;

// § 2 Custom Plan Builder
export const selectCustomPlanPricing        = (state) => sel(state).customPlanPricing;
export const selectCustomPlanPricingLoading = (state) => sel(state).customPlanPricingStatus.loading;
export const selectCustomPlanLoading        = (state) => sel(state).customPlanStatus.loading;
export const selectCustomPlanError          = (state) => sel(state).customPlanStatus.error;

// § 3 Purchase
export const selectPendingOrder     = (state) => sel(state).pendingOrder;
export const selectPurchaseLoading  = (state) => sel(state).purchaseStatus.loading;
export const selectPurchaseError    = (state) => sel(state).purchaseStatus.error;
export const selectVerifyLoading    = (state) => sel(state).verifyStatus.loading;
export const selectVerifyError      = (state) => sel(state).verifyStatus.error;

// § 4 Customer Sub
export const selectMySubscription         = (state) => sel(state).mySubscription;
export const selectMySubIsActive          = (state) => sel(state).mySubscription?.status === 'Active';
export const selectMySubIsOnTrial         = (state) => sel(state).mySubscription?.status === 'Trial';
/** True when the user has any live access (Active OR Trial) */
export const selectMySubHasAccess         = (state) => ['Active', 'Trial'].includes(sel(state).mySubscription?.status);
export const selectMySubAutoRenew         = (state) => sel(state).mySubscription?.autoRenew ?? false;
export const selectMySubLoading           = (state) => sel(state).mySubStatus.loading;
export const selectMySubError             = (state) => sel(state).mySubStatus.error;
export const selectMyHistory              = (state) => sel(state).myHistory;
export const selectMyHistoryPagination    = (state) => sel(state).myHistoryPagination;
export const selectMyHistoryLoading       = (state) => sel(state).myHistoryStatus.loading;
export const selectUpgradeLoading         = (state) => sel(state).upgradeStatus.loading;
export const selectUpgradeError           = (state) => sel(state).upgradeStatus.error;
export const selectCancelLoading          = (state) => sel(state).cancelStatus.loading;
export const selectToggleAutoRenewLoading = (state) => sel(state).toggleAutoRenewStatus.loading;

// § 5 Cron
export const selectExpiryAlertResult  = (state) => sel(state).expiryAlertResult;
export const selectExpiryAlertLoading = (state) => sel(state).expiryAlertStatus.loading;
export const selectAutoRenewResult    = (state) => sel(state).autoRenewResult;
export const selectAutoRenewLoading   = (state) => sel(state).autoRenewStatus.loading;

// § 6 Admin
export const selectAdminSubscriptions     = (state) => sel(state).adminSubscriptions;
export const selectAdminSubPagination     = (state) => sel(state).adminSubPagination;
export const selectAdminSubLoading        = (state) => sel(state).adminSubStatus.loading;
export const selectAdminPlans             = (state) => sel(state).adminPlans;
export const selectAdminPlansLoading      = (state) => sel(state).adminPlansStatus.loading;
export const selectAdminPlanMutateLoading = (state) => sel(state).adminPlanMutateStatus.loading;
export const selectAdminPlanMutateError   = (state) => sel(state).adminPlanMutateStatus.error;
export const selectAdminSubUpdateLoading  = (state) => sel(state).adminSubUpdateStatus.loading;

// § 7 Free Trial
export const selectTrialEligibility          = (state) => sel(state).trialEligibility;
export const selectIsTrialEligible           = (state) => sel(state).trialEligibility?.eligible ?? null;
export const selectTrialEligibilityLoading   = (state) => sel(state).trialEligibilityStatus.loading;
export const selectTrialStatus               = (state) => sel(state).trialStatus;
export const selectIsOnActiveTrial           = (state) => sel(state).trialStatus?.activeTrial ?? false;
export const selectTrialDaysLeft             = (state) => sel(state).trialStatus?.daysLeft ?? 0;
export const selectTrialStatusLoading        = (state) => sel(state).trialStatusFetchStatus.loading;
export const selectTrialOrder                = (state) => sel(state).trialOrder;
export const selectTrialConvertLoading       = (state) => sel(state).trialConvertStatus.loading;
export const selectTrialConvertError         = (state) => sel(state).trialConvertStatus.error;
export const selectTrialVerifyConvertLoading = (state) => sel(state).trialVerifyConvertStatus.loading;
export const selectTrialVerifyConvertError   = (state) => sel(state).trialVerifyConvertStatus.error;
export const selectAdminTrials               = (state) => sel(state).adminTrials;
export const selectAdminTrialsPagination     = (state) => sel(state).adminTrialsPagination;
export const selectAdminTrialsLoading        = (state) => sel(state).adminTrialsStatus.loading;
export const selectAdminExpireStaleLoading   = (state) => sel(state).adminExpireStaleStatus.loading;

// ─────────────────────────────────────────────────────────────────────────────
//  DEFAULT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default subscriptionSlice.reducer;

/**
 * Root reducer registration:
 *
 *   import subscriptionsReducer from './subscriptionSlice';
 *
 *   export const rootReducer = combineReducers({
 *     subscriptions: subscriptionsReducer,
 *     // ...other slices
 *   });
 */