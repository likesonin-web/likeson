import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState = {
  stores:       [],
  nearbyStores: [],
  ownedStores:  [],
  currentStore: null,
  myProfile:    null,

  /**
   * Pagination keys are normalised here to match what the component reads.
   * API response shape: { pagination: { total, page, limit, pages } }
   * Slice shape:        { total, currentPage, limit, totalPages }
   *
   * The mapping happens in fetchAllStores.fulfilled below.
   */
  pagination: {
    total:       0,
    totalPages:  0,
    currentPage: 1,
    limit:       12,
  },

  loading: {
    fetchAll:    false,
    fetchOne:    false,
    fetchNearby: false,
    mutation:    false,
    staffInvite: false,
  },

  error:   null,
  success: false,
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

/**
 * 1. Fetch All Pharmacy Stores (Admin / Superadmin)
 *
 * API response: { success, pagination: { total, page, limit, pages }, data: [...] }
 */
export const fetchAllStores = createAsyncThunk(
  'pharmacy/fetchAllStores',
  async (
    { page = 1, limit = 12, status, storeType, search } = {},
    { rejectWithValue }
  ) => {
    try {
      const { data } = await API.get('/pharmacy/stores', {
        params: { page, limit, status, storeType, search },
      });
      return data; // full envelope: { success, pagination, data }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ?? 'Failed to fetch store repository'
      );
    }
  }
);

/**
 * 2. Create New Pharmacy Store + Manager User Account (Admin)
 *
 * Payload : { name, email, phone, storeData }
 * Server atomically creates: User (role=pharmacy) + PharmacyStore + PharmacyProfile
 *
 * IMPORTANT: The returned store has managedBy as a raw ObjectId string (not
 * populated). We set success=true so the component triggers a fresh
 * fetchAllStores call which returns the fully-populated document.
 */
export const createPharmacyStore = createAsyncThunk(
  'pharmacy/createStore',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/pharmacy/stores', payload);
      toast.success('Pharmacy store & manager account created successfully');
      return data.data; // raw store doc — managedBy is an ObjectId string
    } catch (error) {
      const message = error.response?.data?.message ?? 'Store registration failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * 3. Update My Store Details (Pharmacist Owner / Manager)
 */
export const updateMyStore = createAsyncThunk(
  'pharmacy/updateMyStore',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/pharmacy/my-store', payload);
      toast.success('Store information updated successfully');
      return data.data;
    } catch (error) {
      const message = error.response?.data?.message ?? 'Failed to update store details';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * 4. Get Nearby Pharmacy Stores (Consumer Facing / Public)
 */
export const getNearbyStores = createAsyncThunk(
  'pharmacy/getNearbyStores',
  async ({ lat, lng, radius }, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/pharmacy/nearby', {
        params: { lat, lng, radius },
      });
      return data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ?? 'Unable to locate nearby pharmacies'
      );
    }
  }
);

/**
 * 5. Get Nearby Owned Stores (Direct business locations only)
 */
export const getNearbyOwnedStores = createAsyncThunk(
  'pharmacy/getNearbyOwnedStores',
  async ({ lat, lng, radius }, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/pharmacy/nearby-owned', {
        params: { lat, lng, radius },
      });
      return data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ?? 'Failed to fetch owned locations'
      );
    }
  }
);

/**
 * 6. Verify Store (Admin / Superadmin)
 *
 * Returns the full updated store document from the server.
 */
export const verifyPharmacyStore = createAsyncThunk(
  'pharmacy/verifyStore',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/pharmacy/${id}/verify`);
      toast.success('Pharmacy store verified successfully');
      return data.data; // full updated store object
    } catch (error) {
      const message = error.response?.data?.message ?? 'Verification failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * 7. Invite New Pharmacy Staff Member
 */
export const invitePharmacyStaff = createAsyncThunk(
  'pharmacy/inviteStaff',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/pharmacy/staff/invite', payload);
      toast.success('Staff invitation sent via email');
      return data;
    } catch (error) {
      const message = error.response?.data?.message ?? 'Staff invitation failed';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * 8. Get My Pharmacy Profile + Managed Store (Session-based, pharmacy role only)
 */
export const getMyPharmacyProfile = createAsyncThunk(
  'pharmacy/getMyProfile',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/pharmacy/me');
      return data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ?? 'Profile synchronization failed'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const pharmacySlice = createSlice({
  name: 'pharmacy',
  initialState,

  reducers: {
    /** Reset transient UI flags — call after consuming success / error in component */
    resetPharmacyStatus: (state) => {
      state.success = false;
      state.error   = null;
    },

    /** Full wipe — call on logout */
    clearPharmacyData: () => initialState,
  },

  extraReducers: (builder) => {
    builder

      // ── 1. Fetch All Stores ─────────────────────────────────────────────────
      .addCase(fetchAllStores.pending, (state) => {
        state.loading.fetchAll = true;
        state.error            = null;
      })
      .addCase(fetchAllStores.fulfilled, (state, action) => {
        state.loading.fetchAll = false;

        // action.payload = { success, pagination: { total, page, limit, pages }, data: [] }
        state.stores = action.payload.data ?? [];

        /**
         * Map server pagination keys → normalised slice keys.
         *
         * Server key  →  Slice key
         * ──────────────────────────
         * pages       →  totalPages   (server uses 'pages', not 'totalPages')
         * page        →  currentPage  (server uses 'page', not 'currentPage')
         */
        const p = action.payload.pagination ?? {};
        state.pagination = {
          total:       p.total ?? 0,
          totalPages:  p.pages ?? 0,   // ← server key is 'pages'
          currentPage: p.page  ?? 1,   // ← server key is 'page'
          limit:       p.limit ?? 12,
        };
      })
      .addCase(fetchAllStores.rejected, (state, action) => {
        state.loading.fetchAll = false;
        state.error            = action.payload ?? 'Failed to load stores';
      })

      // ── 2. Create Store + Manager Account ───────────────────────────────────
      .addCase(createPharmacyStore.pending, (state) => {
        state.loading.mutation = true;
        state.error            = null;
      })
      .addCase(createPharmacyStore.fulfilled, (state) => {
        /**
         * DO NOT optimistically unshift action.payload here.
         *
         * The returned store has `managedBy` as a raw ObjectId string — not
         * a populated object. Pushing it into state.stores would render the
         * card with "Manager Assigned" instead of the real name/avatar.
         *
         * Instead we set success = true so the component detects it, calls
         * resetPharmacyStatus(), resets to page 1, and fires a fresh
         * fetchAllStores — which returns fully-populated documents from DB.
         */
        state.loading.mutation = false;
        state.success          = true;
      })
      .addCase(createPharmacyStore.rejected, (state, action) => {
        state.loading.mutation = false;
        state.error            = action.payload ?? 'Store creation failed';
      })

      // ── 3. Update My Store ──────────────────────────────────────────────────
      .addCase(updateMyStore.pending, (state) => {
        state.loading.mutation = true;
        state.error            = null;
      })
      .addCase(updateMyStore.fulfilled, (state, action) => {
        state.loading.mutation = false;
        state.currentStore     = action.payload;

        // Keep myProfile.assignedStore in sync
        if (state.myProfile) {
          state.myProfile.assignedStore = action.payload;
        }

        // Patch the store in the admin list if present
        const idx = state.stores.findIndex((s) => s._id === action.payload?._id);
        if (idx !== -1) state.stores[idx] = action.payload;

        state.success = true;
      })
      .addCase(updateMyStore.rejected, (state, action) => {
        state.loading.mutation = false;
        state.error            = action.payload ?? 'Update failed';
      })

      // ── 4. Get Nearby Stores ────────────────────────────────────────────────
      .addCase(getNearbyStores.pending, (state) => {
        state.loading.fetchNearby = true;
        state.error               = null;
      })
      .addCase(getNearbyStores.fulfilled, (state, action) => {
        state.loading.fetchNearby = false;
        state.nearbyStores        = action.payload ?? [];
      })
      .addCase(getNearbyStores.rejected, (state, action) => {
        state.loading.fetchNearby = false;
        state.error               = action.payload ?? 'Could not fetch nearby stores';
      })

      // ── 5. Get Nearby Owned Stores ──────────────────────────────────────────
      .addCase(getNearbyOwnedStores.fulfilled, (state, action) => {
        state.ownedStores = action.payload ?? [];
      })
      .addCase(getNearbyOwnedStores.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not fetch owned stores';
      })

      // ── 6. Verify Store ─────────────────────────────────────────────────────
      .addCase(verifyPharmacyStore.fulfilled, (state, action) => {
        /**
         * Replace the ENTIRE store object in the list — not just isVerified.
         * This keeps all fields consistent with the server response and avoids
         * stale data if the server also updates updatedAt / updatedBy.
         */
        const idx = state.stores.findIndex((s) => s._id === action.payload?._id);
        if (idx !== -1) {
          state.stores[idx] = action.payload;
        }

        // Keep currentStore in sync too
        if (state.currentStore?._id === action.payload?._id) {
          state.currentStore = action.payload;
        }
      })
      .addCase(verifyPharmacyStore.rejected, (state, action) => {
        state.error = action.payload ?? 'Verification failed';
      })

      // ── 7. Invite Staff ─────────────────────────────────────────────────────
      .addCase(invitePharmacyStaff.pending, (state) => {
        state.loading.staffInvite = true;
        state.error               = null;
      })
      .addCase(invitePharmacyStaff.fulfilled, (state) => {
        state.loading.staffInvite = false;
        state.success             = true;
      })
      .addCase(invitePharmacyStaff.rejected, (state, action) => {
        state.loading.staffInvite = false;
        state.error               = action.payload ?? 'Staff invite failed';
      })

      // ── 8. Get My Profile ───────────────────────────────────────────────────
      .addCase(getMyPharmacyProfile.pending, (state) => {
        state.loading.fetchOne = true;
        state.error            = null;
      })
      .addCase(getMyPharmacyProfile.fulfilled, (state, action) => {
        state.loading.fetchOne = false;
        state.myProfile        = action.payload;
        state.currentStore     = action.payload?.assignedStore ?? null;
      })
      .addCase(getMyPharmacyProfile.rejected, (state, action) => {
        state.loading.fetchOne = false;
        state.error            = action.payload ?? 'Profile sync failed';
      });
  },
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export const { resetPharmacyStatus, clearPharmacyData } = pharmacySlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

/**
 * Granular selectors — each subscribes only to its specific slice of state.
 * Prefer these over the combined selectPharmacyLoading to prevent components
 * from re-rendering when an unrelated loading flag changes.
 */
export const selectAllStores          = (state) => state.pharmacy.stores;
export const selectPharmacyPagination = (state) => state.pharmacy.pagination;
export const selectPharmacyError      = (state) => state.pharmacy.error;
export const selectPharmacySuccess    = (state) => state.pharmacy.success;
export const selectMyPharmacyProfile  = (state) => state.pharmacy.myProfile;
export const selectMyPharmacyStore    = (state) => state.pharmacy.currentStore;
export const selectNearbyStores       = (state) => state.pharmacy.nearbyStores;
export const selectOwnedStores        = (state) => state.pharmacy.ownedStores;

// Granular per-action loading selectors
export const selectIsFetchingAll      = (state) => state.pharmacy.loading.fetchAll;
export const selectIsMutating         = (state) => state.pharmacy.loading.mutation;
export const selectIsFetchingNearby   = (state) => state.pharmacy.loading.fetchNearby;
export const selectIsInvitingStaff    = (state) => state.pharmacy.loading.staffInvite;
export const selectIsFetchingProfile  = (state) => state.pharmacy.loading.fetchOne;

// Legacy combined selector — kept for backward compatibility
export const selectPharmacyLoading    = (state) => state.pharmacy.loading;

export default pharmacySlice.reducer;