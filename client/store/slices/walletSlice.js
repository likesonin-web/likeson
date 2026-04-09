import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────
const initialState = {
  // ── Core wallet ─────────────────────────────────────────────────────────────
  wallet:   null,   // Full wallet object from GET /me
  myUpiId:  null,   // Authenticated user's UPI ID

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

  // ── Bank accounts ────────────────────────────────────────────────────────────
  bankAccounts: [],   // Array of masked bank account objects

  // ── Withdrawals (user) ───────────────────────────────────────────────────────
  withdrawals: {
    requests: [],
    total:    0,
    page:     1,
    limit:    20,
  },
  activeWithdrawal: null,  // Single withdrawal detail (GET /withdrawals/:requestId)

  // ── Admin: withdrawal queue ──────────────────────────────────────────────────
  adminWithdrawals: {
    requests: [],
    total:    0,
    page:     1,
    limit:    20,
  },

  // ── P2P transfer history ─────────────────────────────────────────────────────
  transferHistory: {
    transfers: [],
    total:     0,
    page:      1,
    limit:     20,
  },

  // ── UPI Lookup ───────────────────────────────────────────────────────────────
  lookupResult: null,   // { success, isSelf, receiver: { name, upiId, avatar, mode } }

  // ── Granular loading flags ───────────────────────────────────────────────────
  loading:                 false,  // fetchWalletDetails
  actionLoading:           false,  // add-money, verify-topup, transfer
  historyLoading:          false,  // fetchTransferHistory
  lookupLoading:           false,  // lookupTransferTarget
  bankAccountsLoading:     false,  // fetchBankAccounts
  bankAccountActing:       false,  // add / remove / set-primary (user)
  withdrawalsLoading:      false,  // fetchWithdrawals, fetchWithdrawalById
  withdrawalActing:        false,  // submit / cancel / admin actions
  withdrawableLoading:     false,  // fetchWithdrawableBalance
  adminWithdrawalsLoading: false,  // fetchAdminWithdrawals

  // ── Error ────────────────────────────────────────────────────────────────────
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
 * GET /api/wallet/upi-id
 * Fetches the authenticated user's UPI ID for display / QR generation.
 */
export const fetchMyUpiId = createAsyncThunk(
  'wallet/fetchMyUpiId',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/wallet/upi-id');
      return data.upiId;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to fetch UPI ID'));
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
 *       P2P received funds, cashback, etc. are NOT withdrawable.
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
 * Verifies Razorpay HMAC signature and credits the wallet.
 * Idempotent — duplicate payment IDs are rejected server-side with 409.
 *
 * Payload: { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount }
 * Returns: updated wallet object
 */
export const verifyWalletTopup = createAsyncThunk(
  'wallet/verifyTopup',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/wallet/verify-topup', payload);
      toast.success(
        `₹${Number(payload.amount).toLocaleString('en-IN')} added to your wallet!`
      );
      return data.wallet;
    } catch (error) {
      toast.error(extractError(error, 'Payment verification failed'));
      return rejectWithValue(extractError(error));
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// UPI LOOKUP
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/wallet/lookup
 * Resolves a UPI ID / phone number / QR string to a receiver's public profile.
 *
 * Payload (exactly one of):
 *   { upiId: string }
 *   { phone: string }
 *   { qrString: string }
 *
 * Returns: { success, isSelf, receiver: { name, upiId, avatar, mode } }
 */
export const lookupTransferTarget = createAsyncThunk(
  'wallet/lookupTarget',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/wallet/lookup', payload);
      return data;
    } catch (error) {
      toast.error(extractError(error, 'User not found'));
      return rejectWithValue(extractError(error));
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// P2P TRANSFER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/wallet/transfer
 * Sends money from the authenticated user's wallet to another Likeson wallet.
 *
 * Payload: { amount, note?, upiId | phone | qrString }
 *
 * Returns: { success, message, transfer: { pairTxnId, amount, mode,
 *            receiverUpiId, receiverName, newBalance } }
 *
 * Note: Funds transferred via P2P arrive as P2P_Receive on the receiver side,
 *       which is NOT withdrawable. Only Add_Money + Referral_Bonus are withdrawable.
 */
export const transferMoney = createAsyncThunk(
  'wallet/transferMoney',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.post('/wallet/transfer', payload);
      toast.success(data.message || 'Money sent successfully');
      // Re-fetch full wallet to keep balance + transactions in sync
      dispatch(fetchWalletDetails());
      return data;
    } catch (error) {
      toast.error(extractError(error, 'Transfer failed'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * GET /api/wallet/transfers?page=&limit=
 * Returns paginated P2P transfer history for the authenticated user.
 *
 * Returns: { success, total, page, limit, transfers }
 */
export const fetchTransferHistory = createAsyncThunk(
  'wallet/fetchTransferHistory',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/wallet/transfers', { params });
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load transfer history'));
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
 * Newly added accounts start as unverified — admin must verify before withdrawal.
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
      toast.success('Bank account added. Pending verification.');
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
 * Returns: primaryBankAccount object
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
 *   P2P received funds, cashback, and coin conversions are NOT withdrawable.
 *   The server returns a clear error message if balance is insufficient or ineligible.
 *
 * Payload: { amount: number, bankAccountId: string }
 *
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
 * Actual payout is triggered separately via /complete.
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
 * [Admin] Initiates the Razorpay X Payout directly from the server and
 * marks the withdrawal as completed, debiting the user's wallet.
 *
 * IMPORTANT: The server calls the Razorpay X Payout API internally using
 * RAZORPAY_X_KEY_ID / RAZORPAY_X_KEY_SECRET env vars. The client does NOT
 * supply a razorpayPayoutId — it is obtained from Razorpay and stored server-side.
 *
 * Prerequisites:
 *   - Bank account must have razorpayFundAccountId set (via admin verify endpoint).
 *   - RAZORPAY_X_ACCOUNT_NUMBER must be configured on the server.
 *
 * Payload: { walletId: string }
 * Returns: { success, razorpayPayoutId, razorpayPayoutStatus, newBalance, withdrawableBalance }
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
        razorpayPayoutId:     data.razorpayPayoutId,
        razorpayPayoutStatus: data.razorpayPayoutStatus,
        newBalance:           data.newBalance,
        withdrawableBalance:  data.withdrawableBalance,
      };
    } catch (error) {
      toast.error(extractError(error, 'Failed to complete withdrawal'));
      return rejectWithValue(extractError(error));
    }
  }
);

/**
 * POST /api/wallet/admin/withdrawals/:requestId/reject
 * [Admin] Rejects a pending withdrawal request.
 * Releases the locked amount back to withdrawableAvailable.
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
 * [Admin] Marks a withdrawal as failed (e.g. Razorpay payout failed externally).
 * Releases the locked amount and credits a Withdrawal_Reversal transaction,
 * restoring the user's withdrawableBalance.
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
 * [Admin] Marks a bank account as verified after penny-drop / manual check.
 * Also stores razorpayFundAccountId + razorpayContactId for future payouts.
 * Without razorpayFundAccountId, the /complete endpoint will reject the payout.
 *
 * Payload: { razorpayFundAccountId?: string, razorpayContactId?: string }
 * Returns: verified bank account object (masked)
 */
export const adminVerifyBankAccount = createAsyncThunk(
  'wallet/adminVerifyBankAccount',
  async (
    { walletId, bankAccountId, razorpayFundAccountId, razorpayContactId },
    { rejectWithValue }
  ) => {
    try {
      const { data } = await API.patch(
        `/wallet/admin/bank-accounts/${walletId}/${bankAccountId}/verify`,
        { razorpayFundAccountId, razorpayContactId }
      );
      toast.success('Bank account verified successfully');
      return data.account;
    } catch (error) {
      toast.error(extractError(error, 'Failed to verify bank account'));
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

    /** Clears the UPI lookup result. Call after transfer completes or modal closes. */
    clearLookupResult: (state) => {
      state.lookupResult = null;
    },

    /** Clears the active withdrawal detail. Call on detail modal close. */
    clearActiveWithdrawal: (state) => {
      state.activeWithdrawal = null;
    },

    /**
     * Manually patch the wallet balance in state (e.g. after a Razorpay
     * success callback before the verify-topup response arrives).
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
        // Keep myUpiId in sync if the wallet carries it
        if (payload?.upiId) state.myUpiId = payload.upiId;
      })
      .addCase(fetchWalletDetails.rejected, (state, { payload }) => {
        state.loading = false;
        state.error   = payload;
      })

      // ════════════════════════════════════════════════════════════════════════
      // FETCH MY UPI ID
      // ════════════════════════════════════════════════════════════════════════
      .addCase(fetchMyUpiId.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchMyUpiId.fulfilled, (state, { payload }) => {
        state.myUpiId = payload;
      })
      .addCase(fetchMyUpiId.rejected, (state, { payload }) => {
        state.error = payload;
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
        // rzpOrder is returned directly to the caller — no state update needed
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
        // Sync withdrawableInfo balances so UI reflects the credit immediately
        if (state.withdrawableInfo && payload) {
          state.withdrawableInfo.balance              = payload.balance;
          state.withdrawableInfo.withdrawableBalance  = payload.withdrawableBalance;
          state.withdrawableInfo.withdrawableAvailable = payload.withdrawableAvailable;
          state.withdrawableInfo.lockedBalance        = payload.lockedBalance;
        }
      })
      .addCase(verifyWalletTopup.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      })

      // ════════════════════════════════════════════════════════════════════════
      // UPI LOOKUP
      // ════════════════════════════════════════════════════════════════════════
      .addCase(lookupTransferTarget.pending, (state) => {
        state.lookupLoading = true;
        state.lookupResult  = null;
        state.error         = null;
      })
      .addCase(lookupTransferTarget.fulfilled, (state, { payload }) => {
        state.lookupLoading = false;
        state.lookupResult  = payload;
      })
      .addCase(lookupTransferTarget.rejected, (state, { payload }) => {
        state.lookupLoading = false;
        state.error         = payload;
      })

      // ════════════════════════════════════════════════════════════════════════
      // P2P TRANSFER
      // ════════════════════════════════════════════════════════════════════════
      .addCase(transferMoney.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(transferMoney.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.lookupResult  = null; // Clear lookup so form resets
        // Optimistically update balance from server response
        if (state.wallet && payload?.transfer?.newBalance !== undefined) {
          state.wallet.balance = payload.transfer.newBalance;
        }
      })
      .addCase(transferMoney.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      })

      // ── Transfer History ────────────────────────────────────────────────────
      .addCase(fetchTransferHistory.pending, (state) => {
        state.historyLoading = true;
        state.error          = null;
      })
      .addCase(fetchTransferHistory.fulfilled, (state, { payload }) => {
        state.historyLoading  = false;
        state.transferHistory = {
          transfers: payload.transfers,
          total:     payload.total,
          page:      payload.page,
          limit:     payload.limit,
        };
      })
      .addCase(fetchTransferHistory.rejected, (state, { payload }) => {
        state.historyLoading = false;
        state.error          = payload;
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

      // ── Set Primary Bank Account ─────────────────────────────────────────────
      .addCase(setPrimaryBankAccount.pending, (state) => {
        state.bankAccountActing = true;
        state.error             = null;
      })
      .addCase(setPrimaryBankAccount.fulfilled, (state, { payload }) => {
        state.bankAccountActing = false;
        // Flip isPrimary flags locally without needing a full re-fetch
        state.bankAccounts = state.bankAccounts.map((acc) => ({
          ...acc,
          isPrimary: acc._id === payload.bankAccountId,
        }));
      })
      .addCase(setPrimaryBankAccount.rejected, (state, { payload }) => {
        state.bankAccountActing = false;
        state.error             = payload;
      })

      // ── Remove Bank Account ──────────────────────────────────────────────────
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

      // ── Fetch Withdrawal By ID ───────────────────────────────────────────────
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

      // ── Request Withdrawal ───────────────────────────────────────────────────
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

      // ── Cancel Withdrawal ────────────────────────────────────────────────────
      .addCase(cancelWithdrawal.pending, (state) => {
        state.withdrawalActing = true;
        state.error            = null;
      })
      .addCase(cancelWithdrawal.fulfilled, (state, { payload: requestId }) => {
        state.withdrawalActing = false;
        // Mark as Rejected locally so the UI updates before the re-fetch resolves
        state.withdrawals.requests = state.withdrawals.requests.map((r) =>
          r.requestId === requestId ? { ...r, status: 'Rejected' } : r
        );
        // Also clear activeWithdrawal if it was the same request
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

      // ── Admin: Approve Withdrawal ────────────────────────────────────────────
      .addCase(approveWithdrawal.pending, (state) => {
        state.withdrawalActing = true;
        state.error            = null;
      })
      .addCase(approveWithdrawal.fulfilled, (state, { payload }) => {
        state.withdrawalActing = false;
        // Update the request status inline — stays in the queue until /complete or /reject
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

      // ── Admin: Complete Withdrawal (Razorpay X Payout initiated server-side) ─
      .addCase(completeWithdrawal.pending, (state) => {
        state.withdrawalActing = true;
        state.error            = null;
      })
      .addCase(completeWithdrawal.fulfilled, (state, { payload }) => {
        state.withdrawalActing = false;
        // Remove from the admin queue — it is now Completed
        state.adminWithdrawals.requests = state.adminWithdrawals.requests.filter(
          (item) => item.request?.requestId !== payload.requestId
        );
        if (state.adminWithdrawals.total > 0) state.adminWithdrawals.total -= 1;
      })
      .addCase(completeWithdrawal.rejected, (state, { payload }) => {
        state.withdrawalActing = false;
        state.error            = payload;
      })

      // ── Admin: Reject Withdrawal ─────────────────────────────────────────────
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

      // ── Admin: Fail Withdrawal ───────────────────────────────────────────────
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

      // ── Admin: Verify Bank Account ───────────────────────────────────────────
      .addCase(adminVerifyBankAccount.pending, (state) => {
        state.bankAccountActing = true;
        state.error             = null;
      })
      .addCase(adminVerifyBankAccount.fulfilled, (state) => {
        // Admin is verifying another user's account — no local bank account
        // array to patch here. The user will see the change after re-fetching.
        state.bankAccountActing = false;
      })
      .addCase(adminVerifyBankAccount.rejected, (state, { payload }) => {
        state.bankAccountActing = false;
        state.error             = payload;
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────
export const {
  clearWalletErrors,
  clearLookupResult,
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
export const selectMyUpiId             = (state) => state.wallet.myUpiId;
export const selectWalletLoading       = (state) => state.wallet.loading;
export const selectWalletActionLoading = (state) => state.wallet.actionLoading;
export const selectWalletError         = (state) => state.wallet.error;

// ── Withdrawable balance ──────────────────────────────────────────────────────
export const selectWithdrawableInfo       = (state) => state.wallet.withdrawableInfo;
export const selectWithdrawableBalance    = (state) => state.wallet.withdrawableInfo?.withdrawableBalance    ?? 0;
export const selectWithdrawableAvailable  = (state) => state.wallet.withdrawableInfo?.withdrawableAvailable ?? 0;
export const selectLockedBalance          = (state) => state.wallet.withdrawableInfo?.lockedBalance          ?? 0;
export const selectNonWithdrawable        = (state) => state.wallet.withdrawableInfo?.nonWithdrawable        ?? 0;
export const selectWithdrawalLimits       = (state) => state.wallet.withdrawableInfo?.withdrawalLimits       ?? null;
export const selectWithdrawableLoading    = (state) => state.wallet.withdrawableLoading;

// ── Bank accounts ─────────────────────────────────────────────────────────────
export const selectBankAccounts        = (state) => state.wallet.bankAccounts;
export const selectPrimaryBankAccount  = (state) =>
  state.wallet.bankAccounts.find((a) => a.isPrimary) ?? null;
export const selectVerifiedBankAccounts = (state) =>
  state.wallet.bankAccounts.filter((a) => a.isVerified);
export const selectBankAccountsLoading = (state) => state.wallet.bankAccountsLoading;
export const selectBankAccountActing   = (state) => state.wallet.bankAccountActing;

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

// ── P2P transfer history ──────────────────────────────────────────────────────
export const selectTransferHistory        = (state) => state.wallet.transferHistory;
export const selectTransfers              = (state) => state.wallet.transferHistory.transfers;
export const selectTransfersTotal         = (state) => state.wallet.transferHistory.total;
export const selectHistoryLoading         = (state) => state.wallet.historyLoading;

// ── UPI Lookup ────────────────────────────────────────────────────────────────
export const selectLookupResult  = (state) => state.wallet.lookupResult;
export const selectLookupLoading = (state) => state.wallet.lookupLoading;
export const selectLookupIsSelf  = (state) => state.wallet.lookupResult?.isSelf ?? false;
export const selectLookupReceiver = (state) => state.wallet.lookupResult?.receiver ?? null;

export default walletSlice.reducer;