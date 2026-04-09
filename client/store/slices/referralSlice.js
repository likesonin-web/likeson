/**
 * @file    referralSlice.js
 * @desc    Enterprise-grade Redux Toolkit slice for Referral & Coins system.
 *
 *          Mirrors every endpoint in referralRoutes.js exactly:
 *            GET  /api/referral/my-code              → getMyReferralCode
 *            GET  /api/referral/my-referrals          → getMyReferrals
 *            POST /api/referral/redeem-coins          → redeemReferralCoins
 *            GET  /api/referral/validate/:code        → validateReferralCode
 *            GET  /api/referral/admin/overview        → adminGetReferralOverview
 *            GET  /api/referral/admin/leaderboard     → adminGetLeaderboard
 *            GET  /api/referral/admin/user/:userId    → adminGetUserReferralDetail
 *            GET  /api/referral/admin/transactions    → adminGetReferralTransactions
 *            POST /api/referral/admin/manual-award    → adminManualAward
 *
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  ERROR EXTRACTOR
// ═══════════════════════════════════════════════════════════════════════════════

const extractError = (err, fallback = 'Something went wrong. Please try again.') => {
  const serverMsg = err?.response?.data?.message;
  const errors    = err?.response?.data?.errors;

  if (Array.isArray(errors) && errors.length > 0)
    return errors.map((e) => e.msg || e.message || '').filter(Boolean).join('. ');

  if (typeof serverMsg === 'string' && serverMsg.length < 300) return serverMsg;
  if (err?.message === 'Network Error') return 'No internet connection. Please check your network.';

  return fallback;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 2  INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // ── My referral dashboard ──────────────────────────────────────────────────
  myCode: {
    referralCode:         null,
    shareableUrl:         null,
    redeemPoints:         0,
    coinsValue:           '₹0.00',
    successfulReferrals:  0,
    pendingReferrals:     0,
    coinsPerReferral:     1000,
    refereeBonus:         500,
    minRedeemPoints:      500,
    pointsPerRupee:       100,
  },

  // ── My referral list ───────────────────────────────────────────────────────
  myReferrals: {
    data:    [],
    summary: {
      totalReferrals:     0,
      completedReferrals: 0,
      pendingReferrals:   0,
      totalCoinsEarned:   0,
      totalRupeesEarned:  '₹0.00',
      currentCoins:       0,
    },
    pagination: {
      total: 0,
      page:  1,
      pages: 1,
      limit: 20,
    },
  },

  // ── Validation result (for sign-up page referral code input) ──────────────
  validation: {
    valid:        null, // true | false | null (not checked yet)
    referralCode: null,
    referrerName: null,
    refereeBonus: null,
    bonusValue:   null,
  },

  // ── Redeem result (last successful redemption) ────────────────────────────
  lastRedeem: null,
  // { pointsRedeemed, rupeesEarned, walletBalance, remainingCoins, remainingValue }

  // ── Admin: platform overview ───────────────────────────────────────────────
  adminOverview: null,
  // { totalInvites, completedReferrals, pendingReferrals, totalCoinsAwarded,
  //   totalRupeesDistributed, conversionRate, recentCompleted30d, activeReferrers }

  // ── Admin: leaderboard ────────────────────────────────────────────────────
  adminLeaderboard: {
    data: [],
    pagination: {
      total: 0,
      page:  1,
      pages: 1,
      limit: 20,
    },
  },

  // ── Admin: per-user referral detail ───────────────────────────────────────
  adminUserDetail: null,
  // Full report object from GET /admin/user/:userId

  // ── Admin: referral bonus transactions ────────────────────────────────────
  adminTransactions: {
    data: [],
    pagination: {
      total: 0,
      page:  1,
      pages: 1,
      limit: 20,
    },
  },

  // ── Admin: last manual award result ──────────────────────────────────────
  lastManualAward: null,

  // ── Global async state ─────────────────────────────────────────────────────
  loading: false,
  error:   null,

  // ── Fine-grained per-feature loaders ──────────────────────────────────────
  loaders: {
    myCode:             false,
    myReferrals:        false,
    redeemCoins:        false,
    validateCode:       false,
    adminOverview:      false,
    adminLeaderboard:   false,
    adminUserDetail:    false,
    adminTransactions:  false,
    adminManualAward:   false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 3  ASYNC THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 3.1  USER-FACING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/referral/my-code
 * Returns referral code, shareable URL, coin balance, and stats.
 */
export const getMyReferralCode = createAsyncThunk(
  'referral/getMyReferralCode',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/referral/my-code');
      return data.data;
      // {
      //   referralCode, shareableUrl, redeemPoints, coinsValue,
      //   successfulReferrals, pendingReferrals,
      //   coinsPerReferral, refereeBonus, minRedeemPoints, pointsPerRupee
      // }
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load referral code.'));
    }
  }
);

/**
 * GET /api/referral/my-referrals
 * Paginated list of all referrals made by the authenticated user.
 * @param {{ page?, limit?, status?: 'pending'|'completed' }}
 */
export const getMyReferrals = createAsyncThunk(
  'referral/getMyReferrals',
  async ({ page = 1, limit = 20, status } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      if (status) params.set('status', status);
      const { data } = await API.get(`/referral/my-referrals?${params}`);
      return data.data;
      // { referrals: [], summary: {}, pagination: {} }
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load referrals.'));
    }
  }
);

/**
 * POST /api/referral/redeem-coins
 * Convert coins → INR and credit user's wallet.
 * @param {number} points — must be >= 500 (MIN_REDEEM_POINTS)
 *
 * NOTE: After this succeeds you should also dispatch userSlice.patchCoins()
 *       to keep the user's redeemPoints in userSlice in sync:
 *
 *       const result = await dispatch(redeemReferralCoins(500)).unwrap();
 *       dispatch(patchCoins(result.remainingCoins));
 */
export const redeemReferralCoins = createAsyncThunk(
  'referral/redeemReferralCoins',
  async (points, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/referral/redeem-coins', { points });
      toast.success(data.message ?? `${points} coins redeemed successfully!`);
      return data.data;
      // { pointsRedeemed, rupeesEarned, walletBalance, remainingCoins, remainingValue }
    } catch (err) {
      const msg = extractError(err, 'Coin redemption failed.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * GET /api/referral/validate/:code
 * Public — validates a referral code during signup.
 * Clears previous validation state before the request.
 * @param {string} code
 */
export const validateReferralCode = createAsyncThunk(
  'referral/validateReferralCode',
  async (code, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/referral/validate/${encodeURIComponent(code.trim().toUpperCase())}`
      );
      return data.data;
      // { valid, referralCode, referrerName, refereeBonus, bonusValue }
    } catch (err) {
      // 404 means invalid code — map to a structured result, not a hard error
      if (err?.response?.status === 404) {
        return rejectWithValue('Referral code not found or invalid.');
      }
      return rejectWithValue(extractError(err, 'Code validation failed.'));
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3.2  ADMIN / SUPERADMIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/referral/admin/overview
 * Platform-wide referral statistics.
 */
export const adminGetReferralOverview = createAsyncThunk(
  'referral/adminGetReferralOverview',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/referral/admin/overview');
      return data.data;
      // {
      //   totalInvites, completedReferrals, pendingReferrals,
      //   totalCoinsAwarded, totalRupeesDistributed,
      //   conversionRate, recentCompleted30d, activeReferrers,
      //   coinsPerReferral, refereeBonus
      // }
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load referral overview.'));
    }
  }
);

/**
 * GET /api/referral/admin/leaderboard
 * Top referrers ranked by successful referral count.
 * @param {{ page?, limit? }}
 */
export const adminGetLeaderboard = createAsyncThunk(
  'referral/adminGetLeaderboard',
  async ({ page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      const { data } = await API.get(`/referral/admin/leaderboard?${params}`);
      return data.data;
      // { leaderboard: [{ rank, _id, name, email, role, successfulReferrals, totalCoinsEarned, totalRupeesEarned, ... }], pagination }
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load leaderboard.'));
    }
  }
);

/**
 * GET /api/referral/admin/user/:userId
 * Detailed referral report for a specific user.
 * @param {string} userId — MongoDB ObjectId
 */
export const adminGetUserReferralDetail = createAsyncThunk(
  'referral/adminGetUserReferralDetail',
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/referral/admin/user/${userId}`);
      return data.data;
      // {
      //   user: { _id, name, email, phone, role, avatar, createdAt, referralCode },
      //   referralSummary: { ... },
      //   walletSummary: { ... },
      //   referredBy: null | { name, email, role, referralCode },
      //   referredByCode: null | string,
      //   referrals: { completed: [], pending: [] }
      // }
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load user referral detail.'));
    }
  }
);

/**
 * GET /api/referral/admin/transactions
 * Finance audit — all platform referral bonus wallet credits (Superadmin only).
 * @param {{ page?, limit? }}
 */
export const adminGetReferralTransactions = createAsyncThunk(
  'referral/adminGetReferralTransactions',
  async ({ page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page, limit });
      const { data } = await API.get(`/referral/admin/transactions?${params}`);
      return { data: data.data, pagination: data.pagination };
      // { data: [...transactions], pagination: { total, page, pages, limit } }
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load referral transactions.'));
    }
  }
);

/**
 * POST /api/referral/admin/manual-award
 * Superadmin: manually award coins + auto-credit wallet.
 * @param {{ userId: string, coins: number, reason: string }}
 */
export const adminManualAward = createAsyncThunk(
  'referral/adminManualAward',
  async ({ userId, coins, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/referral/admin/manual-award', {
        userId,
        coins,
        reason,
      });
      toast.success(data.message ?? `${coins} coins awarded successfully!`);
      return data.data;
      // { userId, userName, coinsAwarded, rupeesAwarded, totalCoins, walletBalance }
    } catch (err) {
      const msg = extractError(err, 'Manual award failed.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 4  LOADER KEY MAP
// ═══════════════════════════════════════════════════════════════════════════════

const LOADER_MAP = {
  'referral/getMyReferralCode':          'myCode',
  'referral/getMyReferrals':             'myReferrals',
  'referral/redeemReferralCoins':        'redeemCoins',
  'referral/validateReferralCode':       'validateCode',
  'referral/adminGetReferralOverview':   'adminOverview',
  'referral/adminGetLeaderboard':        'adminLeaderboard',
  'referral/adminGetUserReferralDetail': 'adminUserDetail',
  'referral/adminGetReferralTransactions': 'adminTransactions',
  'referral/adminManualAward':           'adminManualAward',
};

const getLoaderKey = (actionType) => {
  const base = actionType.split('/').slice(0, 2).join('/');
  return LOADER_MAP[base] ?? null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 5  SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const referralSlice = createSlice({
  name: 'referral',
  initialState,

  // ── Synchronous actions ────────────────────────────────────────────────────
  reducers: {
    clearReferralError: (state) => {
      state.error = null;
    },

    /** Reset validation state when user clears the referral code input */
    clearValidation: (state) => {
      state.validation = {
        valid:        null,
        referralCode: null,
        referrerName: null,
        refereeBonus: null,
        bonusValue:   null,
      };
    },

    /** Clear last redeem result (e.g. after showing success modal) */
    clearLastRedeem: (state) => {
      state.lastRedeem = null;
    },

    /** Clear admin user detail (e.g. on modal close) */
    clearAdminUserDetail: (state) => {
      state.adminUserDetail = null;
    },

    /**
     * Patch myCode.redeemPoints locally (e.g. called by userSlice after
     * redeemCoins succeeds so the referral dashboard stays in sync).
     */
    patchMyCoins: (state, action) => {
      state.myCode.redeemPoints = action.payload;
      state.myCode.coinsValue   = `₹${(action.payload / 100).toFixed(2)}`;
    },
  },

  // ── Async matchers ─────────────────────────────────────────────────────────
  extraReducers: (builder) => {
    builder
      // ── PENDING ────────────────────────────────────────────────────────────
      .addMatcher(
        (action) => action.type.endsWith('/pending'),
        (state, action) => {
          if (!action.type.startsWith('referral/')) return;
          state.loading = true;
          state.error   = null;
          const key = getLoaderKey(action.type);
          if (key) state.loaders[key] = true;
        }
      )

      // ── REJECTED ───────────────────────────────────────────────────────────
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        (state, action) => {
          if (!action.type.startsWith('referral/')) return;
          state.loading = false;
          state.error   = action.payload ?? 'An unexpected error occurred.';
          const key = getLoaderKey(action.type);
          if (key) state.loaders[key] = false;

          // For validateReferralCode, store as validation.valid = false
          if (action.type === validateReferralCode.rejected.type) {
            state.validation = {
              valid:        false,
              referralCode: null,
              referrerName: null,
              refereeBonus: null,
              bonusValue:   null,
            };
          }
        }
      )

      // ── FULFILLED ──────────────────────────────────────────────────────────
      .addMatcher(
        (action) => action.type.endsWith('/fulfilled'),
        (state, action) => {
          if (!action.type.startsWith('referral/')) return;
          state.loading = false;
          state.error   = null;
          const key = getLoaderKey(action.type);
          if (key) state.loaders[key] = false;

          // ── getMyReferralCode ──────────────────────────────────────────────
          if (action.type === getMyReferralCode.fulfilled.type && action.payload) {
            state.myCode = { ...state.myCode, ...action.payload };
          }

          // ── getMyReferrals ─────────────────────────────────────────────────
          if (action.type === getMyReferrals.fulfilled.type && action.payload) {
            state.myReferrals.data       = action.payload.referrals  ?? [];
            state.myReferrals.summary    = action.payload.summary     ?? state.myReferrals.summary;
            state.myReferrals.pagination = action.payload.pagination  ?? state.myReferrals.pagination;
          }

          // ── redeemReferralCoins ────────────────────────────────────────────
          if (action.type === redeemReferralCoins.fulfilled.type && action.payload) {
            state.lastRedeem = action.payload;

            // Update myCode coins locally so dashboard refreshes without a re-fetch
            state.myCode.redeemPoints = action.payload.remainingCoins ?? state.myCode.redeemPoints;
            state.myCode.coinsValue   = action.payload.remainingValue ?? state.myCode.coinsValue;
          }

          // ── validateReferralCode ───────────────────────────────────────────
          if (action.type === validateReferralCode.fulfilled.type && action.payload) {
            state.validation = {
              valid:        action.payload.valid        ?? true,
              referralCode: action.payload.referralCode ?? null,
              referrerName: action.payload.referrerName ?? null,
              refereeBonus: action.payload.refereeBonus ?? null,
              bonusValue:   action.payload.bonusValue   ?? null,
            };
          }

          // ── adminGetReferralOverview ───────────────────────────────────────
          if (action.type === adminGetReferralOverview.fulfilled.type) {
            state.adminOverview = action.payload ?? null;
          }

          // ── adminGetLeaderboard ────────────────────────────────────────────
          if (action.type === adminGetLeaderboard.fulfilled.type && action.payload) {
            state.adminLeaderboard.data       = action.payload.leaderboard ?? [];
            state.adminLeaderboard.pagination = action.payload.pagination  ?? state.adminLeaderboard.pagination;
          }

          // ── adminGetUserReferralDetail ─────────────────────────────────────
          if (action.type === adminGetUserReferralDetail.fulfilled.type) {
            state.adminUserDetail = action.payload ?? null;
          }

          // ── adminGetReferralTransactions ───────────────────────────────────
          if (action.type === adminGetReferralTransactions.fulfilled.type && action.payload) {
            state.adminTransactions.data       = action.payload.data       ?? [];
            state.adminTransactions.pagination = action.payload.pagination ?? state.adminTransactions.pagination;
          }

          // ── adminManualAward ───────────────────────────────────────────────
          if (action.type === adminManualAward.fulfilled.type) {
            state.lastManualAward = action.payload ?? null;

            // Optimistically update this user in adminUserDetail if it's open
            if (
              state.adminUserDetail &&
              state.adminUserDetail.user?._id === action.payload?.userId?.toString()
            ) {
              state.adminUserDetail = {
                ...state.adminUserDetail,
                referralSummary: {
                  ...state.adminUserDetail.referralSummary,
                  currentCoins: action.payload.totalCoins ?? state.adminUserDetail.referralSummary?.currentCoins,
                },
                walletSummary: {
                  ...state.adminUserDetail.walletSummary,
                  balance: action.payload.walletBalance ?? state.adminUserDetail.walletSummary?.balance,
                },
              };
            }
          }
        }
      );
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const {
  clearReferralError,
  clearValidation,
  clearLastRedeem,
  clearAdminUserDetail,
  patchMyCoins,
} = referralSlice.actions;

export default referralSlice.reducer;