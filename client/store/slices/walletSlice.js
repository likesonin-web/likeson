import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────
const initialState = {
  // ── Core wallet ─────────────────────────────────────────────────────────────
  wallet: null, // Full wallet object from GET /me

  // ── Withdrawable balance breakdown ──────────────────────────────────────────
  /**
   * Shape: {
   *   balance, withdrawableBalance, lockedBalance,
   *   withdrawableAvailable, nonWithdrawable,
   *   withdrawableSources, note,
   *   withdrawalLimits: { minAmount, maxAmount, dailyLimit, usedToday }
   * }
   */
  withdrawableInfo: null,

  // ── Bank accounts ─────────────────────────────────────────────────────────
  bankAccounts: [], // Array of masked bank account objects

  // ── Withdrawals (user) ────────────────────────────────────────────────────
  withdrawals: {
    requests: [],
    total:    0,
    page:     1,
    limit:    20,
  },
  activeWithdrawal: null, // Single withdrawal detail (GET /withdrawals/:requestId)

  // ── Admin: withdrawal queue ────────────────────────────────────────────────
  adminWithdrawals: {
    requests: [],
    total:    0,
    page:     1,
    limit:    20,
  },

  // ── Admin: wallet list ────────────────────────────────────────────────────
  adminWallets: {
    wallets: [],
    total:   0,
    page:    1,
    limit:   20,
  },

  // ── Transactions (server-paginated, used by admin wallet detail) ──────────
  // User transactions are embedded in wallet.transactions (from GET /me)

  // ── Granular loading flags ────────────────────────────────────────────────
  loading:                 false, // fetchWalletDetails
  actionLoading:           false, // add-money, verify-topup
  bankAccountsLoading:     false, // fetchBankAccounts
  bankAccountActing:       false, // add / remove / set-primary / admin verify
  withdrawalsLoading:      false, // fetchWithdrawals, fetchWithdrawalById
  withdrawalActing:        false, // submit / cancel / admin actions
  withdrawableLoading:     false, // fetchWithdrawableBalance
  adminWithdrawalsLoading: false, // fetchAdminWithdrawals
  adminWalletsLoading:     false, // fetchAdminWallets

  // ── Error ─────────────────────────────────────────────────────────────────
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extracts the error message from an Axios error response. */
const extractError = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.message ?? fallback;

// ─────────────────────────────────────────────────────────────────────────────
// Async Thunks
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// CORE WALLET
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/wallet/me
 * Fetches the authenticated user's full wallet document
 * (balance, transactions, bank accounts, etc.)
 */
export const fetchWalletDetails = createAsyncThunk(
  'wallet/fetchDetails',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/wallet/me');
      return data.wallet;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load wallet'));
    }
  }
);

/**
 * GET /api/wallet/withdrawable-balance
 * Returns full withdrawable vs non-withdrawable balance breakdown + daily limit info.
 *
 * Response shape:
 *   { balance, withdrawableBalance, lockedBalance, withdrawableAvailable,
 *     nonWithdrawable, withdrawableSources, note, withdrawalLimits }
 *
 * NOTE: Only Add_Money + Referral_Bonus credits are withdrawable.
 *       All other credits — P2P, Cashback, Refunds, Coins — are NOT withdrawable.
 */
export const fetchWithdrawableBalance = createAsyncThunk(
  'wallet/fetchWithdrawableBalance',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/wallet/withdrawable-balance');
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to fetch withdrawable balance'));
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// RAZORPAY TOP-UP
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/wallet/add-money
 * Initialises a Razorpay order for wallet top-up (minimum ₹100).
 * Payload: { amount: number }
 * Returns: { rzpOrder, razorpayKey }
 */
export const initializeWalletTopup = createAsyncThunk(
  'wallet/initTopup',
  async ({ amount }, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/wallet/add-money', { amount });
      return data; // { rzpOrder, razorpayKey }
    } catch (error) {
      toast.error(extractError(error, 'Failed to initialize top-up'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * POST /api/wallet/verify-topup
 * Verifies Razorpay HMAC signature.
 * Server fetches the authoritative amount from Razorpay — do NOT send amount.
 * Idempotent — duplicate payment IDs are rejected server-side with 409.
 *
 * Payload: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Returns: updated wallet object
 *
 * NOTE: `displayAmount` is a UI-only hint passed through so the success
 *       toast can show the credited amount — it is NOT sent to the server.
 */
export const verifyWalletTopup = createAsyncThunk(
  'wallet/verifyTopup',
  async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature, displayAmount }, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/wallet/verify-topup', {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        // amount intentionally NOT sent — server verifies with Razorpay directly
      });
      toast.success(
        displayAmount
          ? `₹${Number(displayAmount).toLocaleString('en-IN')} added to your wallet!`
          : 'Wallet top-up successful!'
      );
      return data.wallet;
    } catch (error) {
      toast.error(extractError(error, 'Payment verification failed'));
      return rejectWithValue(extractError(error));
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// BANK ACCOUNTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/wallet/bank-accounts
 * Returns all bank accounts on the wallet (account numbers masked).
 */
export const fetchBankAccounts = createAsyncThunk(
  'wallet/fetchBankAccounts',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/wallet/bank-accounts');
      return data.bankAccounts;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load bank accounts'));
    }
  }
);

/**
 * POST /api/wallet/bank-accounts
 * Adds a new bank account (maximum 3 per wallet).
 * Router auto-creates Razorpay Contact + Fund Account and marks isVerified: true.
 *
 * Payload:
 *   { accountHolderName, accountNumber, ifscCode,
 *     bankName?, branchName?, accountType?, isPrimary? }
 *
 * Returns: Updated full bank accounts list (masked)
 */
export const addBankAccount = createAsyncThunk(
  'wallet/addBankAccount',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/wallet/bank-accounts', payload);
      toast.success('Bank account verified and added successfully.');
      return data.bankAccounts;
    } catch (error) {
      toast.error(extractError(error, 'Failed to add bank account'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * PATCH /api/wallet/bank-accounts/:bankAccountId/set-primary
 * Sets a bank account as the default payout account.
 *
 * Returns: { bankAccountId, primaryBankAccount }
 */
export const setPrimaryBankAccount = createAsyncThunk(
  'wallet/setPrimaryBankAccount',
  async ({ bankAccountId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/wallet/bank-accounts/${bankAccountId}/set-primary`
      );
      toast.success('Primary bank account updated');
      return { bankAccountId, primaryBankAccount: data.primaryBankAccount };
    } catch (error) {
      toast.error(extractError(error, 'Failed to update primary account'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * DELETE /api/wallet/bank-accounts/:bankAccountId
 * Removes a bank account.
 * Cannot remove the primary while others exist — set a new primary first.
 * Cannot remove an account with a pending/approved withdrawal.
 *
 * Returns: bankAccountId (used to filter local state)
 */
export const removeBankAccount = createAsyncThunk(
  'wallet/removeBankAccount',
  async ({ bankAccountId }, { rejectWithValue }) => {
    try {
      await API.delete(`/wallet/bank-accounts/${bankAccountId}`);
      toast.success('Bank account removed');
      return bankAccountId;
    } catch (error) {
      toast.error(extractError(error, 'Failed to remove bank account'));
      return rejectWithValue(extractError(error));
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// WITHDRAWALS (USER)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/wallet/withdrawals?page=&limit=&status=
 * Returns paginated withdrawal request history for the authenticated user.
 *
 * Returns: { success, total, page, limit, withdrawals }
 */
export const fetchWithdrawals = createAsyncThunk(
  'wallet/fetchWithdrawals',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/wallet/withdrawals', { params });
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load withdrawals'));
    }
  }
);

/**
 * GET /api/wallet/withdrawals/:requestId
 * Fetches details of a single withdrawal request.
 *
 * Returns: withdrawal request object (accountNumber stripped, maskedAccount added)
 */
export const fetchWithdrawalById = createAsyncThunk(
  'wallet/fetchWithdrawalById',
  async ({ requestId }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/wallet/withdrawals/${requestId}`);
      return data.request;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load withdrawal details'));
    }
  }
);

/**
 * POST /api/wallet/withdrawals
 * Submits a new withdrawal request (requires a verified bank account).
 *
 * IMPORTANT — withdrawable funds:
 *   Only Add_Money (Razorpay top-up) and Referral_Bonus credits are withdrawable.
 *
 * Payload: { amount: number, bankAccountId: string }
 * Returns: { success, message, request, withdrawableAvailable }
 */
export const requestWithdrawal = createAsyncThunk(
  'wallet/requestWithdrawal',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.post('/wallet/withdrawals', payload);
      toast.success('Withdrawal request submitted. Awaiting admin approval.');
      dispatch(fetchWalletDetails());
      dispatch(fetchWithdrawableBalance());
      return data;
    } catch (error) {
      toast.error(extractError(error, 'Failed to submit withdrawal request'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * POST /api/wallet/withdrawals/:requestId/cancel
 * Cancels a Pending withdrawal request before admin acts on it.
 * Releases the locked balance back to withdrawableAvailable.
 *
 * Returns: requestId (used to update status in local state)
 */
export const cancelWithdrawal = createAsyncThunk(
  'wallet/cancelWithdrawal',
  async ({ requestId }, { rejectWithValue, dispatch }) => {
    try {
      await API.post(`/wallet/withdrawals/${requestId}/cancel`);
      toast.success('Withdrawal cancelled. Funds unlocked.');
      dispatch(fetchWalletDetails());
      dispatch(fetchWithdrawableBalance());
      return requestId;
    } catch (error) {
      toast.error(extractError(error, 'Failed to cancel withdrawal'));
      return rejectWithValue(extractError(error));
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS (user — server-paginated endpoint)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/wallet/transactions?page=&limit=&type=&purpose=
 * Returns paginated transaction history for the authenticated user.
 * Use this for large histories; wallet.transactions in /me is capped at last 1000.
 *
 * Returns: { success, total, page, limit, transactions }
 */
export const fetchTransactions = createAsyncThunk(
  'wallet/fetchTransactions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/wallet/transactions', { params });
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load transactions'));
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — WITHDRAWAL MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/wallet/admin/withdrawals?status=&page=&limit=
 * [Admin] Lists all withdrawal requests across all wallets filtered by status.
 * Requires role: admin | superadmin | finance.
 *
 * Returns: { success, total, page, limit, withdrawals }
 *   Each item: { walletId, userId, user: { name, email, phone }, request }
 */
export const fetchAdminWithdrawals = createAsyncThunk(
  'wallet/fetchAdminWithdrawals',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/wallet/admin/withdrawals', { params });
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load admin withdrawals'));
    }
  }
);

/**
 * POST /api/wallet/admin/withdrawals/:requestId/approve
 * [Admin] Approves a pending withdrawal request.
 * Status changes: Pending → Approved.
 *
 * Payload: { walletId: string }
 * Returns: { requestId, updatedRequest }
 */
export const approveWithdrawal = createAsyncThunk(
  'wallet/approveWithdrawal',
  async ({ requestId, walletId }, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.post(
        `/wallet/admin/withdrawals/${requestId}/approve`,
        { walletId }
      );
      toast.success('Withdrawal approved');
      dispatch(fetchAdminWithdrawals());
      return { requestId, updatedRequest: data.request };
    } catch (error) {
      toast.error(extractError(error, 'Failed to approve withdrawal'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * POST /api/wallet/admin/withdrawals/:requestId/complete
 * [Admin] Initiates the Razorpay X Payout server-side and marks withdrawal Completed.
 *
 * CRITICAL: Server calls Razorpay X internally — client supplies ONLY { walletId }.
 * Do NOT send razorpayPayoutId from the client.
 *
 * Payload: { walletId: string }
 * Returns: { success, payoutId, status, newBalance }
 *
 * BUG FIX: Router returns { payoutId, status } — not { razorpayPayoutId, razorpayPayoutStatus }.
 */
export const completeWithdrawal = createAsyncThunk(
  'wallet/completeWithdrawal',
  async ({ requestId, walletId }, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.post(
        `/wallet/admin/withdrawals/${requestId}/complete`,
        { walletId }
      );
      toast.success('Payout initiated and wallet debited');
      dispatch(fetchAdminWithdrawals());
      return {
        requestId,
        payoutId:   data.payoutId,   // matches router response key
        status:     data.status,     // Razorpay payout status e.g. 'processing'
        newBalance: data.newBalance,
      };
    } catch (error) {
      toast.error(extractError(error, 'Failed to complete withdrawal'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * POST /api/wallet/admin/withdrawals/:requestId/reject
 * [Admin] Rejects a pending withdrawal request. Releases the locked amount.
 *
 * Payload: { walletId: string, adminNote?: string }
 * Returns: requestId
 */
export const rejectWithdrawal = createAsyncThunk(
  'wallet/rejectWithdrawal',
  async ({ requestId, walletId, adminNote }, { rejectWithValue, dispatch }) => {
    try {
      await API.post(
        `/wallet/admin/withdrawals/${requestId}/reject`,
        { walletId, adminNote }
      );
      toast.success('Withdrawal rejected and funds unlocked');
      dispatch(fetchAdminWithdrawals());
      return requestId;
    } catch (error) {
      toast.error(extractError(error, 'Failed to reject withdrawal'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * POST /api/wallet/admin/withdrawals/:requestId/fail
 * [Admin] Marks a withdrawal as failed. Releases lock and credits Withdrawal_Reversal.
 *
 * Payload: { walletId: string, failureReason?: string }
 * Returns: { requestId, newBalance, withdrawableBalance }
 */
export const failWithdrawal = createAsyncThunk(
  'wallet/failWithdrawal',
  async ({ requestId, walletId, failureReason }, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.post(
        `/wallet/admin/withdrawals/${requestId}/fail`,
        { walletId, failureReason }
      );
      toast.success('Withdrawal marked as failed. Amount reversed to user wallet.');
      dispatch(fetchAdminWithdrawals());
      return {
        requestId,
        newBalance:          data.newBalance,
        withdrawableBalance: data.withdrawableBalance,
      };
    } catch (error) {
      toast.error(extractError(error, 'Failed to mark withdrawal as failed'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * PATCH /api/wallet/admin/bank-accounts/:walletId/:bankAccountId/verify
 * [Admin] Manually verifies a bank account and links Razorpay Fund Account ID.
 * Required when auto-verification during addBankAccount failed.
 *
 * BUG FIX: razorpayContactId removed from schema — do NOT send it.
 *
 * Payload: { razorpayFundAccountId: string }
 * Returns: verified bank account object (masked)
 */
export const adminVerifyBankAccount = createAsyncThunk(
  'wallet/adminVerifyBankAccount',
  async ({ walletId, bankAccountId, razorpayFundAccountId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/wallet/admin/bank-accounts/${walletId}/${bankAccountId}/verify`,
        { razorpayFundAccountId } // razorpayContactId removed from schema
      );
      toast.success('Bank account verified successfully');
      return data.account;
    } catch (error) {
      toast.error(extractError(error, 'Failed to verify bank account'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * POST /api/wallet/admin/credit
 * [Admin] Manually credits a wallet (Admin_Credit purpose).
 *
 * Payload: { walletId, amount, description?, note? }
 * Returns: { success, message, newBalance }
 */
export const adminCreditWallet = createAsyncThunk(
  'wallet/adminCreditWallet',
  async ({ walletId, amount, description, note }, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/wallet/admin/credit', {
        walletId, amount, description, note,
      });
      toast.success(`₹${Number(amount).toLocaleString('en-IN')} credited successfully`);
      return { walletId, newBalance: data.newBalance };
    } catch (error) {
      toast.error(extractError(error, 'Failed to credit wallet'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * POST /api/wallet/admin/debit
 * [Admin] Manually debits a wallet (Admin_Debit purpose).
 *
 * Payload: { walletId, amount, description?, note? }
 * Returns: { success, message, newBalance }
 */
export const adminDebitWallet = createAsyncThunk(
  'wallet/adminDebitWallet',
  async ({ walletId, amount, description, note }, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/wallet/admin/debit', {
        walletId, amount, description, note,
      });
      toast.success(`₹${Number(amount).toLocaleString('en-IN')} debited successfully`);
      return { walletId, newBalance: data.newBalance };
    } catch (error) {
      toast.error(extractError(error, 'Failed to debit wallet'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * GET /api/wallet/admin/wallets?page=&limit=&isActive=
 * [Admin] Lists all wallets with user info.
 *
 * Returns: { success, total, page, limit, wallets }
 */
export const fetchAdminWallets = createAsyncThunk(
  'wallet/fetchAdminWallets',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/wallet/admin/wallets', { params });
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load wallets'));
    }
  }
);

/**
 * GET /api/wallet/admin/wallets/:walletId
 * [Admin] Returns full wallet detail for a single user.
 *
 * Returns: { success, wallet }
 */
export const fetchAdminWalletById = createAsyncThunk(
  'wallet/fetchAdminWalletById',
  async ({ walletId }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/wallet/admin/wallets/${walletId}`);
      return data.wallet;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load wallet detail'));
    }
  }
);

/**
 * PATCH /api/wallet/admin/wallets/:walletId/toggle-active
 * [Admin] Activates or deactivates a wallet.
 *
 * Payload: { isActive: boolean }
 * Returns: { success, isActive }
 */
export const toggleWalletActive = createAsyncThunk(
  'wallet/toggleWalletActive',
  async ({ walletId, isActive }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/wallet/admin/wallets/${walletId}/toggle-active`,
        { isActive }
      );
      toast.success(`Wallet ${isActive ? 'activated' : 'deactivated'}`);
      return { walletId, isActive: data.isActive };
    } catch (error) {
      toast.error(extractError(error, 'Failed to update wallet status'));
      return rejectWithValue(extractError(error));
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────
const walletSlice = createSlice({
  name: 'wallet',
  initialState,

  reducers: {
    /** Clears the global error field. Call on modal close / page unmount. */
    clearWalletErrors: (state) => {
      state.error = null;
    },

    /** Clears the active withdrawal detail. Call on detail modal close. */
    clearActiveWithdrawal: (state) => {
      state.activeWithdrawal = null;
    },

    /**
     * Manually patch the wallet balance in state (e.g. optimistic update
     * after a Razorpay success callback before verify-topup response arrives).
     */
    patchWalletBalance: (state, action) => {
      if (state.wallet) {
        state.wallet.balance = action.payload;
      }
    },
  },

  extraReducers: (builder) => {
    builder

      // ════════════════════════════════════════════════════════════════════════
      // FETCH WALLET DETAILS
      // ════════════════════════════════════════════════════════════════════════
      .addCase(fetchWalletDetails.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchWalletDetails.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.wallet  = payload;
        // Sync bank accounts from wallet embed so both slices stay consistent
        if (Array.isArray(payload?.bankAccounts)) {
          state.bankAccounts = payload.bankAccounts;
        }
      })
      .addCase(fetchWalletDetails.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
      })

      // ════════════════════════════════════════════════════════════════════════
      // FETCH WITHDRAWABLE BALANCE
      // ════════════════════════════════════════════════════════════════════════
      .addCase(fetchWithdrawableBalance.pending, (state) => {
        state.withdrawableLoading = true;
        state.error               = null;
      })
      .addCase(fetchWithdrawableBalance.fulfilled, (state, { payload }) => {
        state.withdrawableLoading = false;
        state.withdrawableInfo    = payload;
      })
      .addCase(fetchWithdrawableBalance.rejected, (state, { payload }) => {
        state.withdrawableLoading = false;
        state.error               = payload;
      })

      // ════════════════════════════════════════════════════════════════════════
      // RAZORPAY TOP-UP — INIT
      // ════════════════════════════════════════════════════════════════════════
      .addCase(initializeWalletTopup.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(initializeWalletTopup.fulfilled, (state) => {
        // rzpOrder returned directly to caller via unwrap() — no state update needed
        state.actionLoading = false;
      })
      .addCase(initializeWalletTopup.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      })

      // ════════════════════════════════════════════════════════════════════════
      // RAZORPAY TOP-UP — VERIFY
      // ════════════════════════════════════════════════════════════════════════
      .addCase(verifyWalletTopup.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(verifyWalletTopup.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.wallet        = payload;
        // Sync bank accounts from the returned wallet
        if (Array.isArray(payload?.bankAccounts)) {
          state.bankAccounts = payload.bankAccounts;
        }
        // Immediately reflect new balance in withdrawableInfo so UI stays coherent
        if (state.withdrawableInfo && payload) {
          state.withdrawableInfo.balance               = payload.balance;
          state.withdrawableInfo.withdrawableBalance   = payload.withdrawableBalance;
          state.withdrawableInfo.withdrawableAvailable = payload.withdrawableAvailable ?? payload.withdrawableBalance;
          state.withdrawableInfo.lockedBalance         = payload.lockedBalance ?? 0;
        }
      })
      .addCase(verifyWalletTopup.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      })

      // ════════════════════════════════════════════════════════════════════════
      // BANK ACCOUNTS
      // ════════════════════════════════════════════════════════════════════════
      .addCase(fetchBankAccounts.pending, (state) => {
        state.bankAccountsLoading = true;
        state.error               = null;
      })
      .addCase(fetchBankAccounts.fulfilled, (state, { payload }) => {
        state.bankAccountsLoading = false;
        state.bankAccounts        = payload;
      })
      .addCase(fetchBankAccounts.rejected, (state, { payload }) => {
        state.bankAccountsLoading = false;
        state.error               = payload;
      })

      // ── Add Bank Account ────────────────────────────────────────────────────
      .addCase(addBankAccount.pending, (state) => {
        state.bankAccountActing = true;
        state.error             = null;
      })
      .addCase(addBankAccount.fulfilled, (state, { payload }) => {
        state.bankAccountActing = false;
        state.bankAccounts      = payload; // Full updated list from server
      })
      .addCase(addBankAccount.rejected, (state, { payload }) => {
        state.bankAccountActing = false;
        state.error             = payload;
      })

      // ── Set Primary Bank Account ──────────────────────────────────────────
      .addCase(setPrimaryBankAccount.pending, (state) => {
        state.bankAccountActing = true;
        state.error             = null;
      })
      .addCase(setPrimaryBankAccount.fulfilled, (state, { payload }) => {
        state.bankAccountActing = false;
        // Flip isPrimary flags locally without a full re-fetch
        state.bankAccounts = state.bankAccounts.map((acc) => ({
          ...acc,
          isPrimary: acc._id === payload.bankAccountId,
        }));
      })
      .addCase(setPrimaryBankAccount.rejected, (state, { payload }) => {
        state.bankAccountActing = false;
        state.error             = payload;
      })

      // ── Remove Bank Account ───────────────────────────────────────────────
      .addCase(removeBankAccount.pending, (state) => {
        state.bankAccountActing = true;
        state.error             = null;
      })
      .addCase(removeBankAccount.fulfilled, (state, { payload }) => {
        state.bankAccountActing = false;
        state.bankAccounts      = state.bankAccounts.filter(
          (acc) => acc._id !== payload
        );
      })
      .addCase(removeBankAccount.rejected, (state, { payload }) => {
        state.bankAccountActing = false;
        state.error             = payload;
      })

      // ════════════════════════════════════════════════════════════════════════
      // WITHDRAWALS (USER)
      // ════════════════════════════════════════════════════════════════════════
      .addCase(fetchWithdrawals.pending, (state) => {
        state.withdrawalsLoading = true;
        state.error              = null;
      })
      .addCase(fetchWithdrawals.fulfilled, (state, { payload }) => {
        state.withdrawalsLoading = false;
        state.withdrawals = {
          requests: payload.withdrawals,
          total:    payload.total,
          page:     payload.page,
          limit:    payload.limit,
        };
      })
      .addCase(fetchWithdrawals.rejected, (state, { payload }) => {
        state.withdrawalsLoading = false;
        state.error              = payload;
      })

      // ── Fetch Withdrawal By ID ────────────────────────────────────────────
      .addCase(fetchWithdrawalById.pending, (state) => {
        state.withdrawalsLoading = true;
        state.error              = null;
      })
      .addCase(fetchWithdrawalById.fulfilled, (state, { payload }) => {
        state.withdrawalsLoading = false;
        state.activeWithdrawal   = payload;
      })
      .addCase(fetchWithdrawalById.rejected, (state, { payload }) => {
        state.withdrawalsLoading = false;
        state.error              = payload;
      })

      // ── Request Withdrawal ────────────────────────────────────────────────
      .addCase(requestWithdrawal.pending, (state) => {
        state.withdrawalActing = true;
        state.error            = null;
      })
      .addCase(requestWithdrawal.fulfilled, (state, { payload }) => {
        state.withdrawalActing = false;
        // Prepend the new pending request so it shows at the top
        if (payload?.request) {
          state.withdrawals.requests.unshift(payload.request);
          state.withdrawals.total += 1;
        }
        // Sync withdrawableAvailable immediately so UI reflects the lock
        if (state.withdrawableInfo && payload?.withdrawableAvailable !== undefined) {
          state.withdrawableInfo.withdrawableAvailable = payload.withdrawableAvailable;
        }
      })
      .addCase(requestWithdrawal.rejected, (state, { payload }) => {
        state.withdrawalActing = false;
        state.error            = payload;
      })

      // ── Cancel Withdrawal ─────────────────────────────────────────────────
      .addCase(cancelWithdrawal.pending, (state) => {
        state.withdrawalActing = true;
        state.error            = null;
      })
      .addCase(cancelWithdrawal.fulfilled, (state, { payload: requestId }) => {
        state.withdrawalActing = false;
        // Mark as Rejected locally so UI updates immediately before re-fetch
        state.withdrawals.requests = state.withdrawals.requests.map((r) =>
          r.requestId === requestId ? { ...r, status: 'Rejected' } : r
        );
        if (state.activeWithdrawal?.requestId === requestId) {
          state.activeWithdrawal = { ...state.activeWithdrawal, status: 'Rejected' };
        }
      })
      .addCase(cancelWithdrawal.rejected, (state, { payload }) => {
        state.withdrawalActing = false;
        state.error            = payload;
      })

      // ════════════════════════════════════════════════════════════════════════
      // ADMIN — FETCH WITHDRAWAL QUEUE
      // ════════════════════════════════════════════════════════════════════════
      .addCase(fetchAdminWithdrawals.pending, (state) => {
        state.adminWithdrawalsLoading = true;
        state.error                   = null;
      })
      .addCase(fetchAdminWithdrawals.fulfilled, (state, { payload }) => {
        state.adminWithdrawalsLoading = false;
        state.adminWithdrawals = {
          requests: payload.withdrawals,
          total:    payload.total,
          page:     payload.page,
          limit:    payload.limit,
        };
      })
      .addCase(fetchAdminWithdrawals.rejected, (state, { payload }) => {
        state.adminWithdrawalsLoading = false;
        state.error                   = payload;
      })

      // ── Admin: Approve Withdrawal ─────────────────────────────────────────
      .addCase(approveWithdrawal.pending, (state) => {
        state.withdrawalActing = true;
        state.error            = null;
      })
      .addCase(approveWithdrawal.fulfilled, (state, { payload }) => {
        state.withdrawalActing = false;
        state.adminWithdrawals.requests = state.adminWithdrawals.requests.map((item) =>
          item.request?.requestId === payload.requestId
            ? { ...item, request: { ...item.request, ...payload.updatedRequest } }
            : item
        );
      })
      .addCase(approveWithdrawal.rejected, (state, { payload }) => {
        state.withdrawalActing = false;
        state.error            = payload;
      })

      // ── Admin: Complete Withdrawal (Razorpay X Payout initiated server-side)
      .addCase(completeWithdrawal.pending, (state) => {
        state.withdrawalActing = true;
        state.error            = null;
      })
      .addCase(completeWithdrawal.fulfilled, (state, { payload }) => {
        state.withdrawalActing = false;
        // Remove from queue — now Completed
        state.adminWithdrawals.requests = state.adminWithdrawals.requests.filter(
          (item) => item.request?.requestId !== payload.requestId
        );
        if (state.adminWithdrawals.total > 0) state.adminWithdrawals.total -= 1;
      })
      .addCase(completeWithdrawal.rejected, (state, { payload }) => {
        state.withdrawalActing = false;
        state.error            = payload;
      })

      // ── Admin: Reject Withdrawal ──────────────────────────────────────────
      .addCase(rejectWithdrawal.pending, (state) => {
        state.withdrawalActing = true;
        state.error            = null;
      })
      .addCase(rejectWithdrawal.fulfilled, (state, { payload: requestId }) => {
        state.withdrawalActing          = false;
        state.adminWithdrawals.requests = state.adminWithdrawals.requests.filter(
          (item) => item.request?.requestId !== requestId
        );
        if (state.adminWithdrawals.total > 0) state.adminWithdrawals.total -= 1;
      })
      .addCase(rejectWithdrawal.rejected, (state, { payload }) => {
        state.withdrawalActing = false;
        state.error            = payload;
      })

      // ── Admin: Fail Withdrawal ────────────────────────────────────────────
      .addCase(failWithdrawal.pending, (state) => {
        state.withdrawalActing = true;
        state.error            = null;
      })
      .addCase(failWithdrawal.fulfilled, (state, { payload }) => {
        state.withdrawalActing          = false;
        state.adminWithdrawals.requests = state.adminWithdrawals.requests.filter(
          (item) => item.request?.requestId !== payload.requestId
        );
        if (state.adminWithdrawals.total > 0) state.adminWithdrawals.total -= 1;
      })
      .addCase(failWithdrawal.rejected, (state, { payload }) => {
        state.withdrawalActing = false;
        state.error            = payload;
      })

      // ── Admin: Verify Bank Account ────────────────────────────────────────
      .addCase(adminVerifyBankAccount.pending, (state) => {
        state.bankAccountActing = true;
        state.error             = null;
      })
      .addCase(adminVerifyBankAccount.fulfilled, (state) => {
        state.bankAccountActing = false;
        // Admin is acting on another user's account — no local bankAccounts to patch
      })
      .addCase(adminVerifyBankAccount.rejected, (state, { payload }) => {
        state.bankAccountActing = false;
        state.error             = payload;
      })

      // ── Admin: Credit Wallet ──────────────────────────────────────────────
      .addCase(adminCreditWallet.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(adminCreditWallet.fulfilled, (state) => {
        state.actionLoading = false;
      })
      .addCase(adminCreditWallet.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      })

      // ── Admin: Debit Wallet ───────────────────────────────────────────────
      .addCase(adminDebitWallet.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(adminDebitWallet.fulfilled, (state) => {
        state.actionLoading = false;
      })
      .addCase(adminDebitWallet.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      })

      // ── Admin: Fetch Wallets List ─────────────────────────────────────────
      .addCase(fetchAdminWallets.pending, (state) => {
        state.adminWalletsLoading = true;
        state.error               = null;
      })
      .addCase(fetchAdminWallets.fulfilled, (state, { payload }) => {
        state.adminWalletsLoading = false;
        state.adminWallets = {
          wallets: payload.wallets,
          total:   payload.total,
          page:    payload.page,
          limit:   payload.limit,
        };
      })
      .addCase(fetchAdminWallets.rejected, (state, { payload }) => {
        state.adminWalletsLoading = false;
        state.error               = payload;
      })

      // ── Admin: Toggle Wallet Active ───────────────────────────────────────
      .addCase(toggleWalletActive.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(toggleWalletActive.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        // Patch the wallet in the admin list in-place
        state.adminWallets.wallets = state.adminWallets.wallets.map((w) =>
          w._id === payload.walletId ? { ...w, isActive: payload.isActive } : w
        );
      })
      .addCase(toggleWalletActive.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────
export const {
  clearWalletErrors,
  clearActiveWithdrawal,
  patchWalletBalance,
} = walletSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────────────────────────────────────────

// ── Core wallet ───────────────────────────────────────────────────────────────
export const selectWalletData          = (state) => state.wallet.wallet;
export const selectWalletBalance       = (state) => state.wallet.wallet?.balance ?? 0;
export const selectWalletTransactions  = (state) => state.wallet.wallet?.transactions ?? [];
export const selectWalletLoading       = (state) => state.wallet.loading;
export const selectWalletActionLoading = (state) => state.wallet.actionLoading;
export const selectWalletError         = (state) => state.wallet.error;
export const selectWalletIsActive      = (state) => state.wallet.wallet?.isActive ?? true;

// ── Withdrawable balance ──────────────────────────────────────────────────────
export const selectWithdrawableInfo       = (state) => state.wallet.withdrawableInfo;
export const selectWithdrawableBalance    = (state) => state.wallet.withdrawableInfo?.withdrawableBalance    ?? 0;
export const selectWithdrawableAvailable  = (state) => state.wallet.withdrawableInfo?.withdrawableAvailable ?? 0;
export const selectLockedBalance          = (state) => state.wallet.withdrawableInfo?.lockedBalance          ?? 0;
export const selectNonWithdrawable        = (state) => state.wallet.withdrawableInfo?.nonWithdrawable        ?? 0;
export const selectWithdrawalLimits       = (state) => state.wallet.withdrawableInfo?.withdrawalLimits       ?? null;
export const selectWithdrawableLoading    = (state) => state.wallet.withdrawableLoading;

// ── Bank accounts ─────────────────────────────────────────────────────────────
export const selectBankAccounts         = (state) => state.wallet.bankAccounts;
export const selectPrimaryBankAccount   = (state) =>
  state.wallet.bankAccounts.find((a) => a.isPrimary) ?? null;
export const selectVerifiedBankAccounts = (state) =>
  state.wallet.bankAccounts.filter((a) => a.isVerified);
export const selectBankAccountsLoading  = (state) => state.wallet.bankAccountsLoading;
export const selectBankAccountActing    = (state) => state.wallet.bankAccountActing;

// ── Withdrawals (user) ────────────────────────────────────────────────────────
export const selectWithdrawals        = (state) => state.wallet.withdrawals.requests;
export const selectWithdrawalsTotal   = (state) => state.wallet.withdrawals.total;
export const selectWithdrawalsPage    = (state) => state.wallet.withdrawals.page;
export const selectWithdrawalsLimit   = (state) => state.wallet.withdrawals.limit;
export const selectWithdrawalsLoading = (state) => state.wallet.withdrawalsLoading;
export const selectWithdrawalActing   = (state) => state.wallet.withdrawalActing;
export const selectActiveWithdrawal   = (state) => state.wallet.activeWithdrawal;

// ── Admin withdrawals ─────────────────────────────────────────────────────────
export const selectAdminWithdrawals        = (state) => state.wallet.adminWithdrawals.requests;
export const selectAdminWithdrawalsTotal   = (state) => state.wallet.adminWithdrawals.total;
export const selectAdminWithdrawalsPage    = (state) => state.wallet.adminWithdrawals.page;
export const selectAdminWithdrawalsLimit   = (state) => state.wallet.adminWithdrawals.limit;
export const selectAdminWithdrawalsLoading = (state) => state.wallet.adminWithdrawalsLoading;

// ── Admin wallets ─────────────────────────────────────────────────────────────
export const selectAdminWallets        = (state) => state.wallet.adminWallets.wallets;
export const selectAdminWalletsTotal   = (state) => state.wallet.adminWallets.total;
export const selectAdminWalletsLoading = (state) => state.wallet.adminWalletsLoading;

export default walletSlice.reducer;