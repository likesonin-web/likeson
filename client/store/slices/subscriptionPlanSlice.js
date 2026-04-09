import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api'; 
import toast from 'react-hot-toast';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ASYNC THUNKS
 * ─────────────────────────────────────────────────────────────────────────────
 */

// 1. Create a Plan (POST /api/v1/plans)
export const createPlan = createAsyncThunk(
  'plans/create',
  async (planData, { rejectWithValue }) => {
    try {
      const response = await API.post('/plans', planData);
      toast.success(`Plan "${response.data.data.name}" created!`);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create plan';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// 2. Fetch All Plans (GET /api/v1/plans)
export const fetchPlans = createAsyncThunk(
  'plans/fetchAll',
  async (params = { page: 1, limit: 10 }, { rejectWithValue }) => {
    try {
      const response = await API.get('/plans', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch plans');
    }
  }
);

// 3. Fetch Admin Analytics (GET /api/v1/plans/active-subscriptions)
export const fetchActiveSubscriptions = createAsyncThunk(
  'plans/fetchActiveSubs',
  async (params = { page: 1, limit: 20 }, { rejectWithValue }) => {
    try {
      const response = await API.get('/plans/active-subscriptions', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load analytics');
    }
  }
);

// 4. Soft Delete/Deactivate Plan (DELETE /api/v1/plans/:id)
export const deletePlan = createAsyncThunk(
  'plans/delete',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/plans/${id}`);
      toast.success('Plan deactivated successfully');
      return id;
    } catch (error) {
      const message = error.response?.data?.message || 'Deactivation failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SLICE DEFINITION
 * ─────────────────────────────────────────────────────────────────────────────
 */

const planSlice = createSlice({
  name: 'plans',
  initialState: {
    items: [],                // Public plans list
    activeSubscriptions: [],  // Admin analytics list
    loading: false,
    analyticsLoading: false,
    error: null,
    pagination: { total: 0, page: 1, pages: 1 }
  },
  reducers: {
    clearPlanError: (state) => { 
      state.error = null; 
    }
  },
  extraReducers: (builder) => {
    builder
      /* Fetching Plans */
      .addCase(fetchPlans.pending, (state) => { state.loading = true; })
      .addCase(fetchPlans.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchPlans.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      /* Fetching Active Subscriptions (Analytics) */
      .addCase(fetchActiveSubscriptions.pending, (state) => { 
        state.analyticsLoading = true; 
      })
      .addCase(fetchActiveSubscriptions.fulfilled, (state, action) => {
        state.analyticsLoading = false;
        state.activeSubscriptions = action.payload.data;
      })
      .addCase(fetchActiveSubscriptions.rejected, (state) => {
        state.analyticsLoading = false;
      })

      /* Create & Delete Updates */
      .addCase(createPlan.fulfilled, (state, action) => {
        state.items.unshift(action.payload.data);
      })
      .addCase(deletePlan.fulfilled, (state, action) => {
        state.items = state.items.filter(plan => plan._id !== action.payload);
      });
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPORTS & SELECTORS
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const { clearPlanError } = planSlice.actions;

// Selectors for use in components
export const selectAllPlans = (state) => state.subscriptionPlans.items;
export const selectActiveSubscribers = (state) => state.subscriptionPlans.activeSubscriptions;
export const selectPlanLoading = (state) => state.subscriptionPlans.loading;
export const selectAnalyticsLoading = (state) => state.subscriptionPlans.analyticsLoading;
export const selectPlanPagination = (state) => state.subscriptionPlans.pagination;

export default planSlice.reducer;