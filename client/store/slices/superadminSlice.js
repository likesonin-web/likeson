import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

/**
 * @section INITIAL_STATE
 * Normalized state structure for enterprise-grade scalability.
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
        upcomingRenewals: [],
        loading: false,
        error: null,
    },
    auditLogs: {
        data: [],
        loading: false,
        error: null,
    },
    refunds: {
        processing: false,
        lastProcessedOrder: null,
        error: null,
    }
};

/**
 * @section ASYNC_THUNKS
 * Centralized API interaction logic with robust error handling.
 */

// Fetch Pharmacy Orders with advanced filtering
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

// Fetch Financial Ledger (Transaction History)
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

// Fetch Subscription Billing Summary & Analytics
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

// Process Refund for a specific order
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

// Fetch System Audit Logs (High-risk activities)
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

/**
 * @section SLICE_DEFINITION
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
        }
    },
    extraReducers: (builder) => {
        builder
            // Pharmacy Orders
            .addCase(fetchPharmacyOrders.pending, (state) => {
                state.pharmacyOrders.loading = true;
                state.pharmacyOrders.error = null;
            })
            .addCase(fetchPharmacyOrders.fulfilled, (state, action) => {
                state.pharmacyOrders.loading = false;
                state.pharmacyOrders.data = action.payload.data;
                state.pharmacyOrders.pagination = action.payload.pagination;
            })
            .addCase(fetchPharmacyOrders.rejected, (state, action) => {
                state.pharmacyOrders.loading = false;
                state.pharmacyOrders.error = action.payload;
            })

            // Financial Ledger
            .addCase(fetchFinancialLedger.pending, (state) => {
                state.financialLedger.loading = true;
                state.financialLedger.error = null;
            })
            .addCase(fetchFinancialLedger.fulfilled, (state, action) => {
                state.financialLedger.loading = false;
                state.financialLedger.data = action.payload.data;
                state.financialLedger.pagination = action.payload.pagination;
            })
            .addCase(fetchFinancialLedger.rejected, (state, action) => {
                state.financialLedger.loading = false;
                state.financialLedger.error = action.payload;
            })

            // Billing Summary
            .addCase(fetchBillingSummary.pending, (state) => {
                state.billingSummary.loading = true;
            })
            .addCase(fetchBillingSummary.fulfilled, (state, action) => {
                state.billingSummary.loading = false;
                state.billingSummary.summary = action.payload.summary;
                state.billingSummary.upcomingRenewals = action.payload.upcomingRenewals;
            })
            .addCase(fetchBillingSummary.rejected, (state, action) => {
                state.billingSummary.loading = false;
                state.billingSummary.error = action.payload;
            })

            // Process Refund
            .addCase(processOrderRefund.pending, (state) => {
                state.refunds.processing = true;
                state.refunds.error = null;
            })
            .addCase(processOrderRefund.fulfilled, (state, action) => {
                state.refunds.processing = false;
                state.refunds.lastProcessedOrder = action.payload.order;
                // Update order in local list if it exists to maintain sync without refetch
                const index = state.pharmacyOrders.data.findIndex(o => o.orderId === action.payload.order.orderId);
                if (index !== -1) state.pharmacyOrders.data[index] = action.payload.order;
            })
            .addCase(processOrderRefund.rejected, (state, action) => {
                state.refunds.processing = false;
                state.refunds.error = action.payload;
            })

            // Audit Logs
            .addCase(fetchAuditLogs.pending, (state) => {
                state.auditLogs.loading = true;
            })
            .addCase(fetchAuditLogs.fulfilled, (state, action) => {
                state.auditLogs.loading = false;
                state.auditLogs.data = action.payload.data;
            })
            .addCase(fetchAuditLogs.rejected, (state, action) => {
                state.auditLogs.loading = false;
                state.auditLogs.error = action.payload;
            });
    }
});

export const { clearSuperadminState, resetRefundStatus } = superadminSlice.actions;

// Selectors for optimized component consumption
export const selectPharmacyOrders = (state) => state.superadmin.pharmacyOrders;
export const selectFinancialLedger = (state) => state.superadmin.financialLedger;
export const selectBillingAnalytics = (state) => state.superadmin.billingSummary;
export const selectAuditLogs = (state) => state.superadmin.auditLogs;
export const selectRefundState = (state) => state.superadmin.refunds;

export default superadminSlice.reducer;