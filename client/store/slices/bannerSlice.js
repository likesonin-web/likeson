import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api'; 
import toast from 'react-hot-toast';

/**
 * --- Async Thunks ---
 */

// Public: Fetch valid banners for a specific position (Home_Top, Lab, etc.)
export const fetchActiveBanners = createAsyncThunk(
  'banners/fetchActive',
  async (position, { rejectWithValue }) => {
    try {
      const pos = position || 'Home_Top';
      const response = await API.get(`/banners/active?position=${pos}`);
      // Returning response.data.data because your router wraps it in a data object
      return response.data.data; 
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch banners');
    }
  }
);

// Admin: Fetch ALL banners for the management dashboard
export const fetchAllBanners = createAsyncThunk(
  'banners/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('/banners');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load banners');
    }
  }
);

// Admin: Create New Banner
export const createBanner = createAsyncThunk(
  'banners/create',
  async (bannerData, { rejectWithValue }) => {
    try {
      const response = await API.post('/banners', bannerData);
      toast.success('Banner created successfully!');
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Creation failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// Public: Increment Click Count (Background tracking)
export const trackBannerClick = createAsyncThunk(
  'banners/trackClick',
  async (id, { rejectWithValue }) => {
    try {
      await API.patch(`/banners/${id}/click`);
      return id;
    } catch (error) {
      return rejectWithValue(id); // Return ID even on failure to maintain UI state
    }
  }
);

// Admin: Update Banner Details
export const updateBanner = createAsyncThunk(
  'banners/update',
  async ({ id, bannerData }, { rejectWithValue }) => {
    try {
      const response = await API.put(`/banners/${id}`, bannerData);
      toast.success('Banner updated');
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Update failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// Admin: Permanent Delete
export const deleteBanner = createAsyncThunk(
  'banners/delete',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/banners/${id}`);
      toast.success('Banner removed successfully');
      return id;
    } catch (error) {
      const message = error.response?.data?.message || 'Deletion failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * --- The Slice ---
 */

const bannerSlice = createSlice({
  name: 'banners',
  initialState: {
    activeBanners: [],    // Public display
    adminBanners: [],     // Admin table/list
    loading: false,       // Admin actions loading
    isRefreshing: false,  // Public fetch loading
    error: null,
  },
  reducers: {
    resetBannerError: (state) => {
      state.error = null;
    },
    clearBannerState: (state) => {
      state.activeBanners = [];
      state.adminBanners = [];
      state.error = null;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder
      /* Fetch Active (Public) */
      .addCase(fetchActiveBanners.pending, (state) => {
        state.isRefreshing = true;
        state.error = null;
      })
      .addCase(fetchActiveBanners.fulfilled, (state, action) => {
        state.isRefreshing = false;
        state.activeBanners = Array.isArray(action.payload) ? action.payload : [];
      })

      /* Fetch All (Admin) */
      .addCase(fetchAllBanners.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllBanners.fulfilled, (state, action) => {
        state.loading = false;
        state.adminBanners = action.payload;
      })

      /* Create */
      .addCase(createBanner.pending, (state) => {
        state.loading = true;
      })
      .addCase(createBanner.fulfilled, (state, action) => {
        state.loading = false;
        state.adminBanners.unshift(action.payload); // Add new banner to top
      })

      /* Update */
      .addCase(updateBanner.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateBanner.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.adminBanners.findIndex(b => b._id === action.payload._id);
        if (index !== -1) {
          state.adminBanners[index] = action.payload;
        }
      })

      /* Delete */
      .addCase(deleteBanner.fulfilled, (state, action) => {
        state.loading = false;
        state.adminBanners = state.adminBanners.filter(b => b._id !== action.payload);
      })

      /* Click Tracking (Optimistic UI Update) */
      .addCase(trackBannerClick.fulfilled, (state, action) => {
        const banner = state.activeBanners.find(b => b._id === action.payload);
        if (banner) {
          if (!banner.analytics) banner.analytics = { clicks: 0, views: 0 };
          banner.analytics.clicks += 1;
        }
      })

      /* Global Rejected Matcher */
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        (state, action) => {
          state.loading = false;
          state.isRefreshing = false;
          state.error = action.payload || "An unexpected error occurred";
        }
      );
  }
});

export const { resetBannerError, clearBannerState } = bannerSlice.actions;
export default bannerSlice.reducer;