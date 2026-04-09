import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api'; 
import toast from 'react-hot-toast';

// --- Async Thunks ---

/**
 * Fetch All Ads (Admin Management View)
 */
export const fetchAllAds = createAsyncThunk('ads/fetchAllAds', async (_, { rejectWithValue }) => {
    try {
        const response = await API.get('/ads'); 
        return response.data.data;
    } catch (error) {
        return rejectWithValue(error.response?.data || 'Failed to fetch ads');
    }
});

/**
 * Fetch Active Banners (User Facing / Serve View)
 * Updated: Only uses page and slot to match the fixed backend router.
 */
export const fetchActiveBanners = createAsyncThunk('ads/fetchActiveBanners', async ({ page, slot }, { rejectWithValue }) => {
    try {
        const response = await API.get('/ads/serve', { params: { page, slot } });
        return response.data.data;
    } catch (error) {
        return rejectWithValue(error.response?.data || 'Failed to serve ads');
    }
});

export const createAd = createAsyncThunk('ads/createAd', async (adData, { rejectWithValue }) => {
    try {
        const response = await API.post('/ads', adData);
        toast.success('Campaign launched successfully! 🚀');
        return response.data.data;
    } catch (error) {
        const message = error.response?.data?.message || 'Failed to create ad';
        toast.error(message);
        return rejectWithValue(error.response?.data);
    }
});

export const trackAdActivity = createAsyncThunk('ads/trackActivity', async ({ id, type }, { rejectWithValue }) => {
    try {
        const response = await API.patch(`/ads/${id}/track`, { type });
        return { id, spend: response.data.spend, type };
    } catch (error) {
        return rejectWithValue(error.response?.data);
    }
});

export const updateAd = createAsyncThunk('ads/updateAd', async ({ id, adData }, { rejectWithValue }) => {
    try {
        const response = await API.put(`/ads/${id}`, adData);
        toast.success('Advertisement updated');
        return response.data.data;
    } catch (error) {
        toast.error(error.response?.data?.message || 'Update failed');
        return rejectWithValue(error.response?.data);
    }
});

export const getAdAnalytics = createAsyncThunk('ads/getAnalytics', async (_, { rejectWithValue }) => {
    try {
        const response = await API.get('/ads/analytics');
        return response.data.data;
    } catch (error) {
        return rejectWithValue(error.response?.data);
    }
});

export const archiveAd = createAsyncThunk('ads/archiveAd', async (id, { rejectWithValue }) => {
    try {
        await API.delete(`/ads/${id}`);
        toast.success('Ad archived');
        return id;
    } catch (error) {
        toast.error('Failed to archive ad');
        return rejectWithValue(error.response?.data);
    }
});

// --- Slice ---



const adsSlice = createSlice({
    name: 'ads',
    initialState: {
        activeBanners: [],  
        allAds: [],         
        analytics: [],
        loading: false,
        isRefreshing: false, 
        lastUpdated: null,
        error: null,
    },
    reducers: {
        clearAdError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Admin: Fetch All
            .addCase(fetchAllAds.pending, (state) => {
                if (state.allAds.length === 0) state.loading = true;
                state.isRefreshing = true;
            })
            .addCase(fetchAllAds.fulfilled, (state, action) => {
                state.loading = false;
                state.isRefreshing = false;
                state.allAds = action.payload;
                state.lastUpdated = new Date().toISOString();
            })

            // User: Fetch Active Banners
            .addCase(fetchActiveBanners.pending, (state) => {
                state.isRefreshing = true;
            })
            .addCase(fetchActiveBanners.fulfilled, (state, action) => {
                state.isRefreshing = false;
                state.activeBanners = action.payload;
                state.lastUpdated = new Date().toISOString();
            })

            // Admin: Create
            .addCase(createAd.fulfilled, (state, action) => {
                state.allAds.unshift(action.payload);
            })

            // Global: Interaction Tracking
            .addCase(trackAdActivity.fulfilled, (state, action) => {
                const { id, spend, type } = action.payload;
                
                // 1. Sync Admin Management View
                const adInAll = state.allAds.find(a => a._id === id);
                if (adInAll) {
                    adInAll.budget.currentSpend = spend;
                    if (type === 'click') adInAll.analytics.clicks += 1;
                    if (type === 'view') adInAll.analytics.views += 1;
                    // Auto-set depleted in admin view
                    if (spend >= adInAll.budget.totalMax) adInAll.status = 'Depleted';
                }

                // 2. Sync Active Banner View
                const adInActive = state.activeBanners.find(a => a._id === id);
                if (adInActive) {
                    adInActive.budget.currentSpend = spend;
                    // Optimistic removal: If budget used up, remove from frontend immediately
                    if (spend >= adInActive.budget.totalMax) {
                        state.activeBanners = state.activeBanners.filter(a => a._id !== id);
                    }
                }
            })

            // Admin: Update
            .addCase(updateAd.fulfilled, (state, action) => {
                const updatedAd = action.payload;
                const index = state.allAds.findIndex(ad => ad._id === updatedAd._id);
                if (index !== -1) state.allAds[index] = updatedAd;
                
                const activeIndex = state.activeBanners.findIndex(ad => ad._id === updatedAd._id);
                if (activeIndex !== -1) {
                    // If ad is no longer active or budget is empty, remove it from active list
                    if (updatedAd.status !== 'Active' || updatedAd.budget.currentSpend >= updatedAd.budget.totalMax) {
                        state.activeBanners = state.activeBanners.filter(a => a._id !== updatedAd._id);
                    } else {
                        state.activeBanners[activeIndex] = updatedAd;
                    }
                }
            })

            // Dashboard: Analytics
            .addCase(getAdAnalytics.fulfilled, (state, action) => {
                state.analytics = action.payload;
            })

            // Admin: Archive
            .addCase(archiveAd.fulfilled, (state, action) => {
                state.allAds = state.allAds.filter(ad => ad._id !== action.payload);
                state.activeBanners = state.activeBanners.filter(ad => ad._id !== action.payload);
            })

            // Global Error Handler
            .addMatcher(
                (action) => action.type.endsWith('/rejected'),
                (state, action) => {
                    state.loading = false;
                    state.isRefreshing = false;
                    state.error = action.payload?.message || "An unexpected error occurred";
                }
            );
    }
});

export const { clearAdError } = adsSlice.actions;
export default adsSlice.reducer;