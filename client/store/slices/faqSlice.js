import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api'; 
import toast from 'react-hot-toast';

/**
 * @section ASYNC THUNKS
 * Enterprise-level API handling with standardized error extraction and toast notifications.
 */

// Fetch FAQs with pagination and filtering
export const fetchFAQs = createAsyncThunk(
  'faq/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      // params can include { page, limit, category, search, isActive }
      const { data } = await API.get('/faqs', { params });
      return data; // Expected: { success: true, data: [], pagination: {} }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch FAQs';
      return rejectWithValue(message);
    }
  }
);

// Create New FAQ
export const createFAQ = createAsyncThunk(
  'faq/create',
  async (faqData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/faqs', faqData);
      toast.success('FAQ created successfully');
      return data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create FAQ';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// Toggle Like/Unlike FAQ (Optimistic updates are handled in extraReducers)
export const toggleLikeFAQ = createAsyncThunk(
  'faq/toggleLike',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/faqs/${id}/like`);
      // We don't toast here to keep the UI snappy for social interactions
      return { id, message: data.message }; 
    } catch (error) {
      const message = error.response?.data?.message || 'Action failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// Update FAQ
export const updateFAQ = createAsyncThunk(
  'faq/update',
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/faqs/${id}`, formData);
      toast.success('FAQ updated successfully');
      return data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Update failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// Delete FAQ
export const deleteFAQ = createAsyncThunk(
  'faq/delete',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/faqs/${id}`);
      toast.success('FAQ deleted');
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
  items: [],
  pagination: {
    total: 0,
    page: 1,
    pages: 0,
    limit: 10
  },
  loading: false,
  actionLoading: false, // For specific buttons like 'Save' or 'Delete'
  error: null,
  currentCategory: 'All',
};

/**
 * @section SLICE DEFINITION
 */
const faqSlice = createSlice({
  name: 'faq',
  initialState,
  reducers: {
    setCategory: (state, action) => {
      state.currentCategory = action.payload;
    },
    clearFaqError: (state) => {
      state.error = null;
    },
    resetFaqState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Fetch FAQs
      .addCase(fetchFAQs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFAQs.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchFAQs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Create FAQ
      .addCase(createFAQ.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(createFAQ.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.items.unshift(action.payload); // Add to top of list
      })
      .addCase(createFAQ.rejected, (state) => {
        state.actionLoading = false;
      })

      // Update FAQ
      .addCase(updateFAQ.fulfilled, (state, action) => {
        const index = state.items.findIndex((f) => f._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.actionLoading = false;
      })

      // Delete FAQ
      .addCase(deleteFAQ.fulfilled, (state, action) => {
        state.items = state.items.filter((f) => f._id !== action.payload);
      })

      // Toggle Like (Local State Synchronization)
      .addCase(toggleLikeFAQ.fulfilled, (state, action) => {
        const faq = state.items.find((f) => f._id === action.payload.id);
        if (faq) {
          // If the message is "Liked", increment. If "Unliked", decrement.
          // This keeps Redux in sync with the backend logic without a full re-fetch.
          if (action.payload.message === 'Liked') {
            faq.likeCount += 1;
          } else {
            faq.likeCount = Math.max(0, faq.likeCount - 1);
          }
        }
      });
  },
});

export const { setCategory, clearFaqError, resetFaqState } = faqSlice.actions;

/**
 * @section SELECTORS
 * Memoized-style selectors for efficient component re-rendering
 */
export const selectAllFAQs = (state) => state.faq.items;
export const selectFAQLoading = (state) => state.faq.loading;
export const selectFAQPagination = (state) => state.faq.pagination;

export default faqSlice.reducer;