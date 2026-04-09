import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api'; 
import toast from 'react-hot-toast';

// --- Async Thunks ---

// 1. Fetch all notifications (GET /)
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await API.get('/notifications', { params });
      return response.data; // { success, pagination, data: [] }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load notifications');
    }
  }
);

// 2. Get Unread Count Only (GET /unread-count)
// Useful for refreshing just the badge number without fetching the whole list
export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('/notifications/unread-count');
      return response.data; // { success, unreadCount }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get count');
    }
  }
);

// 3. Mark a single notification as read (PATCH /:id/read)
export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (id, { rejectWithValue }) => {
    try {
      const response = await API.patch(`/notifications/${id}/read`);
      return response.data; // { success, data: { notification } }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update');
    }
  }
);

// 4. Mark all notifications as read (PATCH /read-all)
export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.patch('/notifications/read-all');
      return response.data; // { success, message, modified }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Update failed');
    }
  }
);

// 5. Delete/Dismiss notification (DELETE /:id)
export const deleteNotification = createAsyncThunk(
  'notifications/delete',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/notifications/${id}`);
      return id; // Return the ID so we can remove it from state
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Delete failed');
    }
  }
);

// 6. Admin: Send notification (POST /send)
export const sendNotification = createAsyncThunk(
  'notifications/send',
  async (notificationData, { rejectWithValue }) => {
    try {
      const response = await API.post('/notifications/send', notificationData);
      toast.success('Notification sent successfully');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send');
    }
  }
);

// --- Slice Definition ---

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    unreadCount: 0,
    pagination: {},
    loading: false,
    error: null,
  },
  reducers: {
    addIncomingNotification: (state, action) => {
      state.items.unshift(action.payload);
      state.unreadCount += 1;
    },
    clearNotificationError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch List
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data || [];
        state.pagination = action.payload.pagination || {};
        state.unreadCount = state.items.filter(n => !n.isRead).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Unread Count Only
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload.unreadCount;
      })

      // Single Read
      .addCase(markAsRead.fulfilled, (state, action) => {
        const updated = action.payload.data;
        const index = state.items.findIndex(n => n._id === updated._id);
        if (index !== -1) {
          state.items[index] = updated;
          state.unreadCount = state.items.filter(n => !n.isRead).length;
        }
      })

      // Mark All Read
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.items = state.items.map(n => ({ ...n, isRead: true }));
        state.unreadCount = 0;
        toast.success('All marked as read');
      })

      // Delete/Dismiss
      .addCase(deleteNotification.fulfilled, (state, action) => {
        state.items = state.items.filter(n => n._id !== action.payload);
        // Refresh unread count based on remaining items
        state.unreadCount = state.items.filter(n => !n.isRead).length;
      });
  },
});

export const { addIncomingNotification, clearNotificationError } = notificationSlice.actions;

// Selectors
export const selectAllNotifications = (state) => state.notifications.items;
export const selectUnreadCount = (state) => state.notifications.unreadCount;
export const selectNotificationPagination = (state) => state.notifications.pagination;
export const selectNotificationLoading = (state) => state.notifications.loading;

export default notificationSlice.reducer;