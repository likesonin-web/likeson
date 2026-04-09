import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api'; 
import toast from 'react-hot-toast';

/**
 * @section ASYNC THUNKS
 * Enterprise-level API handling with standardized error extraction.
 */

// Fetch all coupons with pagination and filtering (Admin only)
export const fetchCoupons = createAsyncThunk(
  'promotion/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/coupons', { params });
      return data; // Expected: { success: true, data: [], pagination: {} }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch coupons';
      return rejectWithValue(message);
    }
  }
);

// Validate coupon for checkout (Public/Customer)
export const validateCoupon = createAsyncThunk(
  'promotion/validate',
  async ({ code, orderValue }, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/coupons/validate', { code, orderValue });
      toast.success(data.message || 'Coupon applied!');
      return data.data; // Expected: { code, benefitType, estimatedDiscount, finalPrice }
    } catch (error) {
      const message = error.response?.data?.message || 'Invalid coupon';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// Create New Coupon (Admin)
export const createCoupon = createAsyncThunk(
  'promotion/create',
  async (couponData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/coupons', couponData);
      toast.success('Coupon created successfully');
      return data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create coupon';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// Toggle Coupon Status (Admin)
export const updateCouponStatus = createAsyncThunk(
  'promotion/updateStatus',
  async ({ id, isActive }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/coupons/${id}`, { isActive });
      toast.success(`Coupon ${isActive ? 'activated' : 'deactivated'}`);
      return data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Update failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// Delete Coupon (Superadmin)
export const deleteCoupon = createAsyncThunk(
  'promotion/delete',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/coupons/${id}`);
      toast.success('Coupon deleted');
      return id;
    } catch (error) {
      const message = error.response?.data?.message || 'Delete failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * @section INITIAL STATE
 */
const initialState = {
  coupons: [],
  activeCoupon: null, // Currently applied coupon in checkout
  pagination: {
    total: 0,
    page: 1,
    pages: 0,
    limit: 10
  },
  loading: false,
  validating: false, // Specific loader for checkout button
  error: null,
};

/**
 * @section SLICE DEFINITION
 */
const promotionSlice = createSlice({
  name: 'promotion',
  initialState,
  reducers: {
    removeAppliedCoupon: (state) => {
      state.activeCoupon = null;
      toast.success('Coupon removed');
    },
    clearPromotionError: (state) => {
      state.error = null;
    },
    resetPromotionState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Fetch Coupons
      .addCase(fetchCoupons.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCoupons.fulfilled, (state, action) => {
        state.loading = false;
        state.coupons = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchCoupons.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Validate Coupon (Checkout)
      .addCase(validateCoupon.pending, (state) => {
        state.validating = true;
      })
      .addCase(validateCoupon.fulfilled, (state, action) => {
        state.validating = false;
        state.activeCoupon = action.payload;
      })
      .addCase(validateCoupon.rejected, (state) => {
        state.validating = false;
        state.activeCoupon = null;
      })

      // Create Coupon
      .addCase(createCoupon.fulfilled, (state, action) => {
        state.coupons.unshift(action.payload);
      })

      // Update Coupon
      .addCase(updateCouponStatus.fulfilled, (state, action) => {
        const index = state.coupons.findIndex(c => c._id === action.payload._id);
        if (index !== -1) {
          state.coupons[index] = action.payload;
        }
      })

      // Delete Coupon
      .addCase(deleteCoupon.fulfilled, (state, action) => {
        state.coupons = state.coupons.filter(c => c._id !== action.payload);
      });
  },
});

export const { removeAppliedCoupon, clearPromotionError, resetPromotionState } = promotionSlice.actions;

/**
 * @section SELECTORS
 */
export const selectAllCoupons = (state) => state.promotion.coupons;
export const selectActiveCoupon = (state) => state.promotion.activeCoupon;
export const selectPromotionLoading = (state) => state.promotion.loading;
export const selectCouponValidating = (state) => state.promotion.validating;

export default promotionSlice.reducer;