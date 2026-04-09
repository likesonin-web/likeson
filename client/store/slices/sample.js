import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api'; 
import toast from 'react-hot-toast';

/**
 * INITIAL STATE
 */
const initialState = {
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user')) : null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  profile: null, 
  activeDevices: [],    
  allUsers: {
    data: [],
    total: 0,
    pages: 1,
    currentPage: 1
  },
  loading: false,
  error: null,
};

// =========================================================================
// ASYNC THUNKS (21 Endpoints)
// =========================================================================

/** 01. POST: /signup */
export const signup = createAsyncThunk('user/signup', async (userData, { rejectWithValue }) => {
  try {
    const { data } = await API.post('/users/signup', userData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    toast.success('Registration successful!');
    return data;
  } catch (err) {
    const message = err.response?.data?.message || 'Signup failed';
    toast.error(message);
    return rejectWithValue(message);
  }
});

/** 02. POST: /login */
export const login = createAsyncThunk('user/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await API.post('/users/login', credentials);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    toast.success('Welcome back!');
    return data;
  } catch (err) {
    const message = err.response?.data?.message || 'Login failed';
    toast.error(message);
    return rejectWithValue(message);
  }
});

/** 03. GET: /google - Helper (Direct window redirect) */
export const loginWithGoogle = () => {
  window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/users/google`;
};

/** 04. Handle Google Callback */
export const handleGoogleCallback = createAsyncThunk('user/googleCallback', async (payload, { rejectWithValue }) => {
  if (payload.token) {
    localStorage.setItem('token', payload.token);
    if (payload.user) {
      localStorage.setItem('user', JSON.stringify(payload.user));
    }
    return payload;
  }
  return rejectWithValue('Google Auth Failed');
});

/** 05. POST: /otp-request */
export const requestOtp = createAsyncThunk('user/requestOtp', async (email, { rejectWithValue }) => {
  try {
    const { data } = await API.post('/users/otp-request', { email });
    toast.success('OTP sent to email');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'OTP request failed');
  }
});

/** 06. POST: /verify-email */
export const verifyEmail = createAsyncThunk('user/verifyEmail', async (otpData, { rejectWithValue }) => {
  try {
    const { data } = await API.post('/users/verify-email', otpData);
    toast.success('Email verified!');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Verification failed');
  }
});

/** 07. POST: /otp-login */
export const otpLogin = createAsyncThunk('user/otpLogin', async (otpData, { rejectWithValue }) => {
  try {
    const { data } = await API.post('/users/otp-login', otpData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    toast.success('Logged in successfully');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'OTP Login failed');
  }
});

/** 08. POST: /forgot-password */
export const forgotPassword = createAsyncThunk('user/forgotPassword', async (email, { rejectWithValue }) => {
  try {
    const { data } = await API.post('/users/forgot-password', { email });
    toast.success('Reset code sent to email');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Request failed');
  }
});

/** 09. POST: /reset-password */
export const resetPassword = createAsyncThunk('user/resetPassword', async (resetData, { rejectWithValue }) => {
  try {
    const { data } = await API.post('/users/reset-password', resetData);
    toast.success('Password reset success!');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Reset failed');
  }
});

/** 10. GET: /profile - Hydrates both User and Role Profile */
export const getProfile = createAsyncThunk('user/getProfile', async (_, { rejectWithValue }) => {
  try {
    const { data } = await API.get('/users/profile');
    return data; 
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Profile fetch failed');
  }
});

/** 11. GET: /devices - Audit Trail Fetch */
export const getActiveDevices = createAsyncThunk('user/getDevices', async (_, { rejectWithValue }) => {
  try {
    const { data } = await API.get('/users/devices');
    return data; 
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Device fetch failed');
  }
});

/** 12. DELETE: /devices/:tokenId - Remote Revocation */
export const logoutDevice = createAsyncThunk('user/logoutDevice', async (tokenId, { rejectWithValue }) => {
  try {
    await API.delete(`/users/devices/${tokenId}`);
    toast.success('Session revoked');
    return tokenId;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Revoke failed');
  }
});

/** 13. PUT: /profile - Updates User Core + Role Metadata */
export const updateProfile = createAsyncThunk('user/updateProfile', async (updateData, { rejectWithValue }) => {
  try {
    const { data } = await API.put('/users/profile', updateData);
    toast.success('Profile updated');
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data; 
  } catch (err) {
    const message = err.response?.data?.message || 'Update failed';
    toast.error(message);
    return rejectWithValue(message);
  }
});

/** 14. PUT: /change-password */
export const changePassword = createAsyncThunk('user/changePassword', async (passData, { rejectWithValue }) => {
  try {
    const { data } = await API.put('/users/change-password', passData);
    toast.success('Password changed successfully');
    return data;
  } catch (err) {
    const message = err.response?.data?.message || 'Password change failed';
    toast.error(message);
    return rejectWithValue(message);
  }
});

/** 15. DELETE: /delete-account */
export const deleteAccount = createAsyncThunk('user/deleteAccount', async (_, { rejectWithValue }) => {
  try {
    await API.delete('/users/delete-account');
    localStorage.clear();
    toast.success('Account permanently deleted');
    return null;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Deletion failed');
  }
});

/** 16. GET: /admin/users - Admin List with Pagination */
export const adminGetAllUsers = createAsyncThunk('user/adminAll', async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
  try {
    const { data } = await API.get(`/users/admin/users?page=${page}&limit=${limit}`);
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Admin fetch failed');
  }
});

/** 17. PATCH: /admin/update-role/:id */
export const adminUpdateRole = createAsyncThunk('user/adminUpdateRole', async ({ id, role }, { rejectWithValue }) => {
  try {
    const { data } = await API.patch(`/users/admin/update-role/${id}`, { role });
    toast.success('User role updated');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Update role failed');
  }
});

/** 18. PATCH: /admin/suspend/:id */
export const adminSuspendUser = createAsyncThunk('user/adminSuspend', async ({ id, reason, durationDays }, { rejectWithValue }) => {
  try {
    const { data } = await API.patch(`/users/admin/suspend/${id}`, { reason, durationDays });
    toast.success('User suspension active');
    return data; 
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Suspension failed');
  }
});

/** 19. POST: /admin/add-user */
export const adminCreateUser = createAsyncThunk('user/adminCreate', async (userData, { rejectWithValue }) => {
  try {
    const { data } = await API.post('/users/admin/add-user', userData);
    toast.success('New user provisioned');
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Creation failed');
  }
});

/** 20. Standard Logout (Local Only) */
export const logoutAction = createAsyncThunk('user/logoutLocal', async () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.clear(); 
  return null;
});

/** 21. PATCH: /update-location-by-address (NEW) */
export const updateLocationByAddress = createAsyncThunk('user/updateLocationByAddress', async (address, { rejectWithValue }) => {
  try {
    const { data } = await API.patch('/users/update-location-by-address', { address });
    toast.success(`Location updated to ${data.data.address}`);
    
    // Sync local storage if user object changed
    if (data.data.user) {
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    
    return data.data; // contains user, address, and coordinates
  } catch (err) {
    const message = err.response?.data?.message || 'Location update failed';
    toast.error(message);
    return rejectWithValue(message);
  }
});

// =========================================================================
// SLICE DEFINITION
// =========================================================================

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearErrors: (state) => {
      state.error = null;
    },
    resetAuthState: (state) => {
      state.user = null;
      state.token = null;
      state.profile = null;
      state.activeDevices = [];
    }
  },
  extraReducers: (builder) => {
    builder
      // CENTRALIZED LOADING HANDLER
      .addMatcher((action) => action.type.endsWith('/pending'), (state) => {
        state.loading = true;
        state.error = null;
      })
      // CENTRALIZED ERROR HANDLER
      .addMatcher((action) => action.type.endsWith('/rejected'), (state, action) => {
        state.loading = false;
        state.error = action.payload || 'An unexpected error occurred';
      })
      // SUCCESS HANDLERS
      .addMatcher((action) => action.type.endsWith('/fulfilled'), (state, action) => {
        state.loading = false;
        
        // Auth Lifecycle
        if (['user/signup/fulfilled', 'user/login/fulfilled', 'user/otpLogin/fulfilled', 'user/googleCallback/fulfilled'].includes(action.type)) {
          state.user = action.payload.user; 
          state.token = action.payload.token;
        }

        // Profile & Location Sync
        if ([
          'user/getProfile/fulfilled', 
          'user/updateProfile/fulfilled', 
          'user/updateLocationByAddress/fulfilled'
        ].includes(action.type)) {
          // Both Profile update and Location update return a user object
          state.user = action.payload.user;
          if (action.payload.profile) {
             state.profile = action.payload.profile;
          }
        }

        // Audit Trail: Active Devices
        if (action.type === getActiveDevices.fulfilled.type) {
          state.activeDevices = action.payload;
        }
        if (action.type === logoutDevice.fulfilled.type) {
          state.activeDevices = state.activeDevices.filter(d => d._id !== action.payload);
        }

        // Admin: User Management List
        if (action.type === adminGetAllUsers.fulfilled.type) {
          state.allUsers.data = action.payload.data;
          state.allUsers.total = action.payload.total;
          state.allUsers.pages = action.payload.pages;
        }
        
        // Admin: Update individual user in list
        if (['user/adminUpdateRole/fulfilled', 'user/adminSuspend/fulfilled'].includes(action.type)) {
            const updatedUser = action.payload.user;
            state.allUsers.data = state.allUsers.data.map(u => 
                u._id === updatedUser._id ? updatedUser : u
            );
        }

        // Logout/Account Deletion Cleanup
        if (action.type === logoutAction.fulfilled.type || action.type === deleteAccount.fulfilled.type) {
            state.user = null;
            state.token = null;
            state.profile = null;
            state.activeDevices = [];
            state.loading = false;
        }
      });
  }
});

export const { clearErrors, resetAuthState } = userSlice.actions;
export default userSlice.reducer;