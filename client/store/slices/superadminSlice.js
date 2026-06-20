import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

/**
 * @section INITIAL_STATE
 */
const initialState = {
    // §2 Pharmacy Orders
    pharmacyOrders: {
        data: [],
        pagination: { total: 0, page: 1, pages: 0, limit: 20 },
        loading: false,
        error: null,
    },
    pharmacyOrderDetail: {
        data: null,
        loading: false,
        error: null,
    },

    // §3 Bookings
    bookings: {
        data: [],
        pagination: { total: 0, page: 1, pages: 0, limit: 20 },
        loading: false,
        error: null,
    },
    bookingDetail: {
        data: null,
        loading: false,
        error: null,
    },

    // §4 Financial Ledger
    financialLedger: {
        data: [],
        summary: [], // From facet summary
        pagination: { total: 0, page: 1, pages: 0, limit: 20 },
        loading: false,
        error: null,
    },

    // §5 Subscriptions
    billingSummary: {
        summary: [],
        planBreakdown: [],
        upcomingRenewals: [],
        revenueTimeline: [], // Added from router
        loading: false,
        error: null,
    },

    // §6 Refunds
    refunds: {
        processing: false,
        lastProcessedOrder: null,
        error: null,
    },

    // §7 Wallet Management
    walletDetail: {
        data: null,
        transactions: [],
        pagination: { total: 0, page: 1, pages: 0, limit: 20 },
        loading: false,
        error: null,
    },
    walletAdjust: {
        processing: false,
        error: null,
    },

    // §8 Audit Logs
    auditLogs: {
        data: [],
        pagination: { total: 0, page: 1, pages: 0, limit: 20 },
        loading: false,
        error: null,
    },

    // §9 Medicines / Inventory
    medicines: {
        data: [],
        pagination: { total: 0, page: 1, pages: 0, limit: 20 },
        loading: false,
        error: null,
    },

    // §10 Revenue Analytics
    revenueAnalytics: {
        data: null, // Holds { period, revenue }
        loading: false,
        error: null,
    },
};

/**
 * @section ASYNC_THUNKS
 */

// ── §2 Pharmacy Orders ──────────────────────────────────────────────
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

export const fetchPharmacyOrderDetail = createAsyncThunk(
    'superadmin/fetchPharmacyOrderDetail',
    async (orderId, { rejectWithValue }) => {
        try {
            const response = await API.get(`/superadmin/pharmacy-orders/${orderId}`);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch pharmacy order details';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// ── §3 Bookings ─────────────────────────────────────────────────────
export const fetchBookings = createAsyncThunk(
    'superadmin/fetchBookings',
    async (params, { rejectWithValue }) => {
        try {
            const response = await API.get('/superadmin/bookings', { params });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch bookings';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

export const fetchBookingDetail = createAsyncThunk(
    'superadmin/fetchBookingDetail',
    async (bookingCode, { rejectWithValue }) => {
        try {
            const response = await API.get(`/superadmin/bookings/${bookingCode}`);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch booking details';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// ── §4 Financial Ledger ─────────────────────────────────────────────
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

// ── §5 Subscriptions (Billing Summary) ──────────────────────────────
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

// ── §6 Refunds ──────────────────────────────────────────────────────
export const processPharmacyRefund = createAsyncThunk(
    'superadmin/processPharmacyRefund',
    async ({ orderId, refundData }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/superadmin/refunds/pharmacy/${orderId}`, refundData);
            toast.success('Refund processed successfully');
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Refund processing failed';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

export const processBookingRefund = createAsyncThunk(
    'superadmin/processBookingRefund',
    async ({ bookingId, refundData }, { rejectWithValue }) => {
        try {
            const response = await API.post(`/superadmin/refunds/booking/${bookingId}`, refundData);
            toast.success('Refund processed successfully');
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Refund processing failed';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// ── §7 Wallet Management ────────────────────────────────────────────
export const fetchUserWallet = createAsyncThunk(
    'superadmin/fetchUserWallet',
    async ({ userId, params }, { rejectWithValue }) => {
        try {
            const response = await API.get(`/superadmin/wallet/${userId}`, { params });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch wallet details';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

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

// ── §8 Audit Logs ───────────────────────────────────────────────────
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

// ── §9 Medicines / Inventory ────────────────────────────────────────
export const fetchMedicines = createAsyncThunk(
    'superadmin/fetchMedicines',
    async (params, { rejectWithValue }) => {
        try {
            const response = await API.get('/superadmin/medicines', { params });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch medicines';
            toast.error(message);
            return rejectWithValue(message);
        }
    }
);

// ── §10 Revenue Analytics ───────────────────────────────────────────
export const fetchRevenueAnalytics = createAsyncThunk(
    'superadmin/fetchRevenueAnalytics',
    async (params, { rejectWithValue }) => {
        try {
            const response = await API.get('/superadmin/analytics/revenue', { params });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to fetch revenue analytics';
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
            state.refunds.lastProcessedOrder = null;
        },
        clearWalletDetail: (state) => {
            state.walletDetail = initialState.walletDetail;
        },
        clearPharmacyOrderDetail: (state) => {
            state.pharmacyOrderDetail = initialState.pharmacyOrderDetail;
        },
        clearBookingDetail: (state) => {
            state.bookingDetail = initialState.bookingDetail;
        },
    },
    extraReducers: (builder) => {
        builder
            // ── §2 Pharmacy Orders ────────────────────────────────────────────
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
            // Pharmacy Order Detail
            .addCase(fetchPharmacyOrderDetail.pending, (state) => {
                state.pharmacyOrderDetail.loading = true;
                state.pharmacyOrderDetail.error   = null;
            })
            .addCase(fetchPharmacyOrderDetail.fulfilled, (state, action) => {
                state.pharmacyOrderDetail.loading = false;
                state.pharmacyOrderDetail.data    = action.payload.data;
            })
            .addCase(fetchPharmacyOrderDetail.rejected, (state, action) => {
                state.pharmacyOrderDetail.loading = false;
                state.pharmacyOrderDetail.error   = action.payload;
            })

            // ── §3 Bookings ───────────────────────────────────────────────────
            .addCase(fetchBookings.pending, (state) => {
                state.bookings.loading = true;
                state.bookings.error   = null;
            })
            .addCase(fetchBookings.fulfilled, (state, action) => {
                state.bookings.loading    = false;
                state.bookings.data       = action.payload.data;
                state.bookings.pagination = action.payload.pagination;
            })
            .addCase(fetchBookings.rejected, (state, action) => {
                state.bookings.loading = false;
                state.bookings.error   = action.payload;
            })
            // Booking Detail
            .addCase(fetchBookingDetail.pending, (state) => {
                state.bookingDetail.loading = true;
                state.bookingDetail.error   = null;
            })
            .addCase(fetchBookingDetail.fulfilled, (state, action) => {
                state.bookingDetail.loading = false;
                state.bookingDetail.data    = action.payload.data;
            })
            .addCase(fetchBookingDetail.rejected, (state, action) => {
                state.bookingDetail.loading = false;
                state.bookingDetail.error   = action.payload;
            })

            // ── §4 Financial Ledger ───────────────────────────────────────────
            .addCase(fetchFinancialLedger.pending, (state) => {
                state.financialLedger.loading = true;
                state.financialLedger.error   = null;
            })
            .addCase(fetchFinancialLedger.fulfilled, (state, action) => {
                state.financialLedger.loading    = false;
                state.financialLedger.data       = action.payload.data;
                state.financialLedger.summary    = action.payload.summary || [];
                state.financialLedger.pagination = action.payload.pagination;
            })
            .addCase(fetchFinancialLedger.rejected, (state, action) => {
                state.financialLedger.loading = false;
                state.financialLedger.error   = action.payload;
            })

            // ── §5 Subscriptions (Billing Summary) ────────────────────────────
            .addCase(fetchBillingSummary.pending, (state) => {
                state.billingSummary.loading = true;
                state.billingSummary.error   = null;
            })
            .addCase(fetchBillingSummary.fulfilled, (state, action) => {
                state.billingSummary.loading          = false;
                state.billingSummary.summary          = action.payload.summary;
                state.billingSummary.planBreakdown    = action.payload.planBreakdown;
                state.billingSummary.upcomingRenewals = action.payload.upcomingRenewals;
                state.billingSummary.revenueTimeline  = action.payload.revenueTimeline;
            })
            .addCase(fetchBillingSummary.rejected, (state, action) => {
                state.billingSummary.loading = false;
                state.billingSummary.error   = action.payload;
            })

            // ── §6 Process Pharmacy Refund ────────────────────────────────────
            .addCase(processPharmacyRefund.pending, (state) => {
                state.refunds.processing = true;
                state.refunds.error      = null;
            })
            .addCase(processPharmacyRefund.fulfilled, (state, action) => {
                state.refunds.processing         = false;
                state.refunds.lastProcessedOrder = action.payload.data;
                // Sync updated order in local list without full refetch
                const idx = state.pharmacyOrders.data.findIndex(
                    (o) => o.orderId === action.payload.data.orderId
                );
                if (idx !== -1) state.pharmacyOrders.data[idx] = action.payload.data;
                
                // Sync detail view if currently open
                if (state.pharmacyOrderDetail.data?.orderId === action.payload.data.orderId) {
                    state.pharmacyOrderDetail.data = action.payload.data;
                }
            })
            .addCase(processPharmacyRefund.rejected, (state, action) => {
                state.refunds.processing = false;
                state.refunds.error      = action.payload;
            })

            // ── §6 Process Booking Refund ─────────────────────────────────────
            .addCase(processBookingRefund.pending, (state) => {
                state.refunds.processing = true;
                state.refunds.error      = null;
            })
            .addCase(processBookingRefund.fulfilled, (state) => {
                state.refunds.processing = false;
            })
            .addCase(processBookingRefund.rejected, (state, action) => {
                state.refunds.processing = false;
                state.refunds.error      = action.payload;
            })

            // ── §7 Wallet Detail ──────────────────────────────────────────────
            .addCase(fetchUserWallet.pending, (state) => {
                state.walletDetail.loading = true;
                state.walletDetail.error   = null;
            })
            .addCase(fetchUserWallet.fulfilled, (state, action) => {
                state.walletDetail.loading      = false;
                state.walletDetail.data         = action.payload.data;
                state.walletDetail.transactions = action.payload.transactions.data;
                state.walletDetail.pagination   = action.payload.transactions.pagination;
            })
            .addCase(fetchUserWallet.rejected, (state, action) => {
                state.walletDetail.loading = false;
                state.walletDetail.error   = action.payload;
            })

            // ── §7 Wallet Adjust ──────────────────────────────────────────────
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
            })

            // ── §8 Audit Logs ─────────────────────────────────────────────────
            .addCase(fetchAuditLogs.pending, (state) => {
                state.auditLogs.loading = true;
                state.auditLogs.error   = null;
            })
            .addCase(fetchAuditLogs.fulfilled, (state, action) => {
                state.auditLogs.loading    = false;
                state.auditLogs.data       = action.payload.data;
                state.auditLogs.pagination = action.payload.pagination;
            })
            .addCase(fetchAuditLogs.rejected, (state, action) => {
                state.auditLogs.loading = false;
                state.auditLogs.error   = action.payload;
            })

            // ── §9 Medicines / Inventory ──────────────────────────────────────
            .addCase(fetchMedicines.pending, (state) => {
                state.medicines.loading = true;
                state.medicines.error   = null;
            })
            .addCase(fetchMedicines.fulfilled, (state, action) => {
                state.medicines.loading    = false;
                state.medicines.data       = action.payload.data;
                state.medicines.pagination = action.payload.pagination;
            })
            .addCase(fetchMedicines.rejected, (state, action) => {
                state.medicines.loading = false;
                state.medicines.error   = action.payload;
            })

            // ── §10 Revenue Analytics ─────────────────────────────────────────
            .addCase(fetchRevenueAnalytics.pending, (state) => {
                state.revenueAnalytics.loading = true;
                state.revenueAnalytics.error   = null;
            })
            .addCase(fetchRevenueAnalytics.fulfilled, (state, action) => {
                state.revenueAnalytics.loading = false;
                state.revenueAnalytics.data    = action.payload; // Contains { period, revenue }
            })
            .addCase(fetchRevenueAnalytics.rejected, (state, action) => {
                state.revenueAnalytics.loading = false;
                state.revenueAnalytics.error   = action.payload;
            });
    },
});

export const {
    clearSuperadminState,
    resetRefundStatus,
    clearWalletDetail,
    clearPharmacyOrderDetail,
    clearBookingDetail,
} = superadminSlice.actions;

/**
 * @section SELECTORS
 */
export const selectPharmacyOrders      = (state) => state.superadmin.pharmacyOrders;
export const selectPharmacyOrderDetail = (state) => state.superadmin.pharmacyOrderDetail;
export const selectBookings            = (state) => state.superadmin.bookings;
export const selectBookingDetail       = (state) => state.superadmin.bookingDetail;
export const selectFinancialLedger     = (state) => state.superadmin.financialLedger;
export const selectBillingAnalytics    = (state) => state.superadmin.billingSummary;
export const selectAuditLogs           = (state) => state.superadmin.auditLogs;
export const selectRefundState         = (state) => state.superadmin.refunds;
export const selectWalletDetail        = (state) => state.superadmin.walletDetail;
export const selectWalletAdjust        = (state) => state.superadmin.walletAdjust;
export const selectMedicines           = (state) => state.superadmin.medicines;
export const selectRevenueAnalytics    = (state) => state.superadmin.revenueAnalytics;

export default superadminSlice.reducer;