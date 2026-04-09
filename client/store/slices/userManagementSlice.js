import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api'; 
import toast from 'react-hot-toast';

/**
 * @desc Fetch Meta-Data (Hospitals, Stores, Agencies) for registration dropdowns
 */
export const fetchRegistrationMeta = createAsyncThunk(
  'userManagement/fetchMeta',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('/user-management/meta-data');
      return response.data; // { hospitals, stores, agencies }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch metadata');
    }
  }
);

/**
 * @desc Add New User/Employee with Role-Specific Profiles
 * Expects: { name, email, phone, role, ...roleSpecificFields }
 */
export const addUser = createAsyncThunk(
  'userManagement/addUser',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await API.post('/user-management/add-user', userData);
      toast.success(`${userData.role} added successfully! Credentials emailed.`);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to add user';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * @desc Fetch All Employees/Staff (excludes regular customers)
 */
export const fetchEmployees = createAsyncThunk(
  'userManagement/fetchEmployees',
  async (roleFilter = '', { rejectWithValue }) => {
    try {
      const url = roleFilter ? `/user-management/employees?role=${roleFilter}` : '/user-management/employees';
      const response = await API.get(url);
      return response.data.employees;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch employees');
    }
  }
);

const userManagementSlice = createSlice({
  name: 'userManagement',
  initialState: {
    employees: [],
    meta: {
      hospitals: [],
      stores: [],
      agencies: []
    },
    loading: false,
    metaLoading: false,
    error: null
  },
  reducers: {
    clearUserError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Metadata
      .addCase(fetchRegistrationMeta.pending, (state) => {
        state.metaLoading = true;
      })
      .addCase(fetchRegistrationMeta.fulfilled, (state, action) => {
        state.metaLoading = false;
        state.meta = action.payload;
      })
      .addCase(fetchRegistrationMeta.rejected, (state, action) => {
        state.metaLoading = false;
        state.error = action.payload;
      })

      // Add User
      .addCase(addUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(addUser.fulfilled, (state, action) => {
        state.loading = false;
        state.employees.unshift(action.payload.user);
      })
      .addCase(addUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Employees
      .addCase(fetchEmployees.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.loading = false;
        state.employees = action.payload;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearUserError } = userManagementSlice.actions;
export default userManagementSlice.reducer;