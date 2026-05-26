import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

/**
 * @section INITIAL_STATE
 */
const initialState = {
    pharmacyOrders: {
        data: [],
        pagination: { total: 0, page: 1, pages: 0 },
        loading: false,
        error: null,
    },
    financialLedger: {
        data: [],
        pagination: { total: 0, page: 1, pages: 0 },
        loading: false,
        error: null,
    },
    billingSummary: {
        summary: [],
        planBreakdown: [],        // FIX: new field returned by router
        upcomingRenewals: [],
        loading: false,
        error: null,
    },
    auditLogs: {
        data: [],
        pagination: { total: 0, page: 1, pages: 0 }, // FIX: router now returns pagination
        loading: false,
        error: null,
    },
    refunds: {
        processing: false,
        lastProcessedOrder: null,
        error: null,
    },
    // FIX: new state for wallet routes added in router
    walletDetail: {
        data: null,
        transactions: [],
        pagination: { total: 0, page: 1, pages: 0 },
        loading: false,
        error: null,
    },
    walletAdjust: {
        processing: false,
        error: null,
    },
};

/**
 * @section ASYNC_THUNKS
 */

// Pharmacy Orders
export const fetchPharmacyOrders = createAsyncThunk(
    'superadmin/fetchPharmacyOrders',
    async (params, { rejectWithValue }) => {
        try {
            const response = await API.get('/superadmin/pharmacy-orders', { params });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch pharmacy orders';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// Financial Ledger
export const fetchFinancialLedger = createAsyncThunk(
    'superadmin/fetchFinancialLedger',
    async (params, { rejectWithValue }) => {
        try {
            const response = await API.get('/superadmin/financial-ledger', { params });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch financial ledger';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// Billing Summary — router returns: { summary, planBreakdown, upcomingRenewals }
export const fetchBillingSummary = createAsyncThunk(
    'superadmin/fetchBillingSummary',
    async (_, { rejectWithValue }) => {
        try {
            const response = await API.get('/superadmin/subscriptions/billing-summary');
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch billing summary';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// Process Refund
export const processOrderRefund = createAsyncThunk(
    'superadmin/processOrderRefund',
    async ({ orderId, refundData }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/superadmin/refunds/process/${orderId}`, refundData);
            toast.success('Refund processed successfully');
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Refund processing failed';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// Audit Logs — router now returns { data, pagination }
export const fetchAuditLogs = createAsyncThunk(
    'superadmin/fetchAuditLogs',
    async (params, { rejectWithValue }) => {
        try {
            const response = await API.get('/superadmin/system/audit-logs', { params });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch audit logs';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// FIX: new thunk — GET /superadmin/wallet/:userId
// Returns: { data: walletDetail, transactions: { data, pagination } }
export const fetchUserWallet = createAsyncThunk(
    'superadmin/fetchUserWallet',
    async ({ userId, params }, { rejectWithValue }) => {
        try {
            const response = await API.get(`/superadmin/wallet/${userId}`, { params });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch wallet';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// FIX: new thunk — POST /superadmin/wallet/:userId/adjust
// Body: { type: 'Credit'|'Debit', amount, description }
// purpose auto-resolved to Admin_Credit / Admin_Debit in router
export const adjustUserWallet = createAsyncThunk(
    'superadmin/adjustUserWallet',
    async ({ userId, adjustData }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/superadmin/wallet/${userId}/adjust`, adjustData);
            toast.success(`Wallet ${adjustData.type.toLowerCase()} applied`);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Wallet adjustment failed';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

/**
 * @section SLICE
 */
const superadminSlice = createSlice({
    name: 'superadmin',
    initialState,
    reducers: {
        clearSuperadminState: (state) => {
            Object.assign(state, initialState);
        },
        resetRefundStatus: (state) => {
            state.refunds.processing = false;
            state.refunds.error = null;
        },
        // FIX: clear wallet detail when switching users
        clearWalletDetail: (state) => {
            state.walletDetail = initialState.walletDetail;
        },
    },
    extraReducers: (builder) => {
        builder
            // ── Pharmacy Orders ──────────────────────────────────────────────
            .addCase(fetchPharmacyOrders.pending, (state) => {
                state.pharmacyOrders.loading = true;
                state.pharmacyOrders.error   = null;
            })
            .addCase(fetchPharmacyOrders.fulfilled, (state, action) => {
                state.pharmacyOrders.loading    = false;
                state.pharmacyOrders.data       = action.payload.data;
                state.pharmacyOrders.pagination = action.payload.pagination;
            })
            .addCase(fetchPharmacyOrders.rejected, (state, action) => {
                state.pharmacyOrders.loading = false;
                state.pharmacyOrders.error   = action.payload;
            })

            // ── Financial Ledger ─────────────────────────────────────────────
            .addCase(fetchFinancialLedger.pending, (state) => {
                state.financialLedger.loading = true;
                state.financialLedger.error   = null;
            })
            .addCase(fetchFinancialLedger.fulfilled, (state, action) => {
                state.financialLedger.loading    = false;
                state.financialLedger.data       = action.payload.data;
                state.financialLedger.pagination = action.payload.pagination;
            })
            .addCase(fetchFinancialLedger.rejected, (state, action) => {
                state.financialLedger.loading = false;
                state.financialLedger.error   = action.payload;
            })

            // ── Billing Summary ──────────────────────────────────────────────
            .addCase(fetchBillingSummary.pending, (state) => {
                state.billingSummary.loading = true;
                state.billingSummary.error   = null;  // FIX: was missing
            })
            .addCase(fetchBillingSummary.fulfilled, (state, action) => {
                state.billingSummary.loading          = false;
                state.billingSummary.summary          = action.payload.summary;
                state.billingSummary.planBreakdown    = action.payload.planBreakdown;  // FIX: was missing
                state.billingSummary.upcomingRenewals = action.payload.upcomingRenewals;
            })
            .addCase(fetchBillingSummary.rejected, (state, action) => {
                state.billingSummary.loading = false;
                state.billingSummary.error   = action.payload;
            })

            // ── Process Refund ───────────────────────────────────────────────
            .addCase(processOrderRefund.pending, (state) => {
                state.refunds.processing = true;
                state.refunds.error      = null;
            })
            .addCase(processOrderRefund.fulfilled, (state, action) => {
                state.refunds.processing        = false;
                state.refunds.lastProcessedOrder = action.payload.order;
                // Sync updated order in local list without full refetch
                const idx = state.pharmacyOrders.data.findIndex(
                    (o) => o.orderId === action.payload.order.orderId
                );
                if (idx !== -1) state.pharmacyOrders.data[idx] = action.payload.order;
            })
            .addCase(processOrderRefund.rejected, (state, action) => {
                state.refunds.processing = false;
                state.refunds.error      = action.payload;
            })

            // ── Audit Logs ───────────────────────────────────────────────────
            .addCase(fetchAuditLogs.pending, (state) => {
                state.auditLogs.loading = true;
                state.auditLogs.error   = null;   // FIX: was missing
            })
            .addCase(fetchAuditLogs.fulfilled, (state, action) => {
                state.auditLogs.loading    = false;
                state.auditLogs.data       = action.payload.data;
                state.auditLogs.pagination = action.payload.pagination;  // FIX: was missing
            })
            .addCase(fetchAuditLogs.rejected, (state, action) => {
                state.auditLogs.loading = false;
                state.auditLogs.error   = action.payload;
            })

            // ── Wallet Detail (new) ──────────────────────────────────────────
            .addCase(fetchUserWallet.pending, (state) => {
                state.walletDetail.loading = true;
                state.walletDetail.error   = null;
            })
            .addCase(fetchUserWallet.fulfilled, (state, action) => {
                state.walletDetail.loading    = false;
                state.walletDetail.data       = action.payload.data;
                state.walletDetail.transactions = action.payload.transactions.data;
                state.walletDetail.pagination   = action.payload.transactions.pagination;
            })
            .addCase(fetchUserWallet.rejected, (state, action) => {
                state.walletDetail.loading = false;
                state.walletDetail.error   = action.payload;
            })

            // ── Wallet Adjust (new) ──────────────────────────────────────────
            .addCase(adjustUserWallet.pending, (state) => {
                state.walletAdjust.processing = true;
                state.walletAdjust.error      = null;
            })
            .addCase(adjustUserWallet.fulfilled, (state, action) => {
                state.walletAdjust.processing = false;
                // Sync balance in walletDetail if same user is loaded
                if (state.walletDetail.data) {
                    state.walletDetail.data.balance          = action.payload.balance;
                    state.walletDetail.data.availableBalance = action.payload.balance;
                }
            })
            .addCase(adjustUserWallet.rejected, (state, action) => {
                state.walletAdjust.processing = false;
                state.walletAdjust.error      = action.payload;
            });
    },
});

export const {
    clearSuperadminState,
    resetRefundStatus,
    clearWalletDetail,
} = superadminSlice.actions;

/**
 * @section SELECTORS
 */
export const selectPharmacyOrders   = (state) => state.superadmin.pharmacyOrders;
export const selectFinancialLedger  = (state) => state.superadmin.financialLedger;
export const selectBillingAnalytics = (state) => state.superadmin.billingSummary;   // includes planBreakdown
export const selectAuditLogs        = (state) => state.superadmin.auditLogs;
export const selectRefundState      = (state) => state.superadmin.refunds;
export const selectWalletDetail     = (state) => state.superadmin.walletDetail;     // new
export const selectWalletAdjust     = (state) => state.superadmin.walletAdjust;     // new

export default superadminSlice.reducer;