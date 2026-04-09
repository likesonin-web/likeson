import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

/**
 * 1. Fetch Employees for Meeting Selection
 */
export const fetchEmployees = createAsyncThunk(
  'meeting/fetchEmployees',
  async ({ role, search } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/meetings/employees', {
        params: { role, search },
      });
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch employees');
    }
  }
);

/**
 * 2. Create New Meeting (Includes Email/Notification triggers)
 */
export const createMeeting = createAsyncThunk(
  'meeting/createMeeting',
  async (meetingData, { rejectWithValue }) => {
    const loadingToast = toast.loading('Creating meeting and notifying participants...');
    try {
      const { data } = await API.post('/meetings/create', meetingData);
      toast.success('Meeting created successfully!', { id: loadingToast });
      return data.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create meeting';
      toast.error(message, { id: loadingToast });
      return rejectWithValue(message);
    }
  }
);

/**
 * 3. Fetch My Meetings (Personal Dashboard)
 */
export const fetchMyMeetings = createAsyncThunk(
  'meeting/fetchMyMeetings',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/meetings/my-meetings');
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch meetings');
    }
  }
);

/**
 * 4. Cancel Meeting
 */
export const cancelMeeting = createAsyncThunk(
  'meeting/cancelMeeting',
  async (meetingId, { rejectWithValue }) => {
    const loadingToast = toast.loading('Cancelling meeting...');
    try {
      const { data } = await API.patch(`/meetings/${meetingId}/cancel`);
      toast.success('Meeting cancelled and participants notified.', { id: loadingToast });
      return meetingId; // Return ID to update local state
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to cancel meeting';
      toast.error(message, { id: loadingToast });
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  meetings: [],
  employees: [],
  loading: false,
  fetchingEmployees: false,
  error: null,
};

const meetingSlice = createSlice({
  name: 'meeting',
  initialState,
  reducers: {
    clearMeetingError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Employees
      .addCase(fetchEmployees.pending, (state) => {
        state.fetchingEmployees = true;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.fetchingEmployees = false;
        state.employees = action.payload;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.fetchingEmployees = false;
        state.error = action.payload;
      })

      // Create Meeting
      .addCase(createMeeting.pending, (state) => {
        state.loading = true;
      })
      .addCase(createMeeting.fulfilled, (state, action) => {
        state.loading = false;
        state.meetings.unshift(action.payload); // Add new meeting to top of list
      })
      .addCase(createMeeting.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch My Meetings
      .addCase(fetchMyMeetings.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMyMeetings.fulfilled, (state, action) => {
        state.loading = false;
        state.meetings = action.payload;
      })
      .addCase(fetchMyMeetings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Cancel Meeting
      .addCase(cancelMeeting.fulfilled, (state, action) => {
        const index = state.meetings.findIndex(m => m._id === action.payload);
        if (index !== -1) {
          state.meetings[index].status = 'cancelled';
        }
      });
  },
});

export const { clearMeetingError } = meetingSlice.actions;
export default meetingSlice.reducer;