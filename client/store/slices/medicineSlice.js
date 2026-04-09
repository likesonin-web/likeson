import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPER
// ─────────────────────────────────────────────────────────────────────────────

const extractError = (error, fallback) =>
  error.response?.data?.error ||
  error.response?.data?.message ||
  fallback;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — HSN THUNKS  [H1–H8]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [H1] GET /api/v1/medicines/hsn
 * List all HSN codes — paginated, filterable.
 * Params: { search?, gst?, chapter?, isActive?, page?, limit?, sort? }
 */
export const fetchHsnCodes = createAsyncThunk(
  'medicine/hsn/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/medicines/hsn', { params });
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to fetch HSN codes'));
    }
  }
);

/**
 * [H2] GET /api/v1/medicines/hsn/stats
 * Aggregated HSN statistics — gst distribution, source breakdown, active/inactive.
 * Access: admin, superadmin.
 */
export const fetchHsnStats = createAsyncThunk(
  'medicine/hsn/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/medicines/hsn/stats');
      return data.data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load HSN stats'));
    }
  }
);

/**
 * [H3] GET /api/v1/medicines/hsn/:code
 * Single HSN code lookup by 4–8 digit code string.
 */
export const fetchHsnByCode = createAsyncThunk(
  'medicine/hsn/fetchByCode',
  async (code, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/medicines/hsn/${code}`);
      return data.data;
    } catch (error) {
      return rejectWithValue(extractError(error, `HSN code '${code}' not found`));
    }
  }
);

/**
 * [H4] POST /api/v1/medicines/hsn
 * Create a single HSN code manually.
 * Body: { hsnCode, description, chapterHeading?, gstPercentage }
 * Access: admin, superadmin.
 */
export const createHsnCode = createAsyncThunk(
  'medicine/hsn/create',
  async (hsnData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/medicines/hsn', hsnData);
      toast.success('HSN code created successfully');
      return data.data;
    } catch (error) {
      const message = extractError(error, 'Failed to create HSN code');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [H5] POST /api/v1/medicines/hsn/upload
 * Bulk upsert via Excel/CSV/PDF file upload.
 * Body: multipart/form-data with field "file".
 * Access: admin, superadmin.
 */
export const uploadHsnFile = createAsyncThunk(
  'medicine/hsn/upload',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/medicines/hsn/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { inserted, updated, skipped, errorCount } = data.result;
      toast.success(
        `Upload complete — ${inserted} inserted, ${updated} updated, ${skipped} skipped` +
        (errorCount > 0 ? `, ${errorCount} errors` : '')
      );
      return data;
    } catch (error) {
      const message = extractError(error, 'HSN file upload failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [H6] POST /api/v1/medicines/hsn/bulk-delete
 * Soft-deactivates multiple HSN codes in one shot.
 * Body: { codes: string[] }
 * Access: superadmin.
 */
export const bulkDeleteHsnCodes = createAsyncThunk(
  'medicine/hsn/bulkDelete',
  async (codes, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/medicines/hsn/bulk-delete', { codes });
      toast.success(data.message || `${data.deactivated} HSN code(s) deactivated`);
      return { codes, deactivated: data.deactivated };
    } catch (error) {
      const message = extractError(error, 'Bulk delete failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [H7] PATCH /api/v1/medicines/hsn/:code
 * Partial update of a single HSN code.
 * Body: { description?, chapterHeading?, gstPercentage?, isActive? }
 * Access: admin, superadmin.
 */
export const updateHsnCode = createAsyncThunk(
  'medicine/hsn/update',
  async ({ code, updateData }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/medicines/hsn/${code}`, updateData);
      toast.success('HSN code updated');
      return data.data;
    } catch (error) {
      const message = extractError(error, 'HSN update failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [H8] DELETE /api/v1/medicines/hsn/:code
 * Soft-deactivates a single HSN code (sets isActive = false).
 * Access: superadmin.
 */
export const deleteHsnCode = createAsyncThunk(
  'medicine/hsn/delete',
  async (code, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/medicines/hsn/${code}`);
      toast.success(`HSN code '${code}' deactivated`);
      return { code, message: data.message };
    } catch (error) {
      const message = extractError(error, 'HSN delete failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B — MEDICINE THUNKS  [M1–M10]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [M1] GET /api/v1/medicines
 * Public paginated medicine list with filters.
 * Params: { search?, category?, schedule?, minPrice?, maxPrice?, sort?,
 *           page?, limit?, isPrescriptionRequired? }
 */
export const fetchMedicines = createAsyncThunk(
  'medicine/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/medicines', { params });
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to fetch medicines'));
    }
  }
);

/**
 * [M2] GET /api/v1/medicines/admin/stats
 * Aggregated dashboard stats — category counts, total stock, low-stock/expiry alerts.
 * Access: admin, superadmin, pharmacy.
 */
export const fetchInventoryStats = createAsyncThunk(
  'medicine/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/medicines/admin/stats');
      return data.data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load stats'));
    }
  }
);

/**
 * [M3] POST /api/v1/medicines/restock-request
 * Pharmacy raises a restock request — notifies all admins/superadmins in-app.
 * Body: { medicineId, quantityRequired }
 * Access: pharmacy.
 */
export const sendRestockRequest = createAsyncThunk(
  'medicine/sendRestockRequest',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/medicines/restock-request', payload);
      toast.success('Restock request submitted');
      return data;
    } catch (error) {
      const message = extractError(error, 'Restock request failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [M4] GET /api/v1/medicines/:slug
 * Single medicine detail by URL slug. Populates hsnCode + inventory stores.
 * Access: authenticated users.
 */
export const fetchMedicineBySlug = createAsyncThunk(
  'medicine/fetchBySlug',
  async (slug, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/medicines/${slug}`);
      return data.data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Medicine not found'));
    }
  }
);

/**
 * [M5] POST /api/v1/medicines
 * Creates a new medicine. Server auto-syncs zero-stock inventory entries
 * for all active stores via syncInventoryAllStores.
 *
 * Pharmacy body:          { ...medicineFields, initialStock?, expiryDate?, batchNumber?, pricePerUnit? }
 * Admin/superadmin body:  { ...medicineFields, storeId?, initialStock?, expiryDate?, batchNumber?, pricePerUnit? }
 * Access: admin, superadmin, pharmacy.
 */
export const createMedicine = createAsyncThunk(
  'medicine/create',
  async (medicineData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/medicines', medicineData);
      toast.success('Medicine cataloged successfully');
      return data.data;
    } catch (error) {
      const message = extractError(error, 'Failed to create medicine');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [M6] PATCH /api/v1/medicines/:id
 * Updates core medicine metadata (admin/superadmin) or own-store inventory
 * fields (pharmacy). syncInventoryAllStores runs after every admin/superadmin
 * save to fill new stores with zero-stock entries.
 *
 * Admin/superadmin body:  { ...coreFields, storeId?, initialStock?, expiryDate?, batchNumber?, pricePerUnit? }
 * Pharmacy body:          { stockQuantity?, expiryDate?, batchNumber?, pricePerUnit? }
 * Access: admin, superadmin, pharmacy.
 */
export const updateMedicine = createAsyncThunk(
  'medicine/update',
  async ({ id, updateData }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/medicines/${id}`, updateData);
      toast.success('Medicine updated successfully');
      return data.data;
    } catch (error) {
      const message = extractError(error, 'Update failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [M7] PATCH /api/v1/medicines/:id/update-stock
 * Targeted stock-level adjustment for a specific store.
 *
 * Pharmacy body:          { quantity, expiryDate?, batchNumber?, pricePerUnit? }
 * Admin/superadmin body:  { storeId (required), quantity, expiryDate?, batchNumber?, pricePerUnit? }
 * Access: pharmacy, admin, superadmin.
 */
export const updateStock = createAsyncThunk(
  'medicine/updateStock',
  async ({ id, stockData }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/medicines/${id}/update-stock`, stockData);
      toast.success('Inventory stock updated');
      return { id, inventory: data.data };
    } catch (error) {
      const message = extractError(error, 'Stock update failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [M8] DELETE /api/v1/medicines/:id
 * Soft-discontinues a medicine (isDiscontinued = true) and emails all pharmacy users.
 * Access: admin, superadmin.
 */
export const discontinueMedicine = createAsyncThunk(
  'medicine/discontinue',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/medicines/${id}`);
      toast.success('Medicine marked as discontinued');
      return { id, message: data.message };
    } catch (error) {
      const message = extractError(error, 'Action failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [M9] POST /api/v1/medicines/sync-inventory/all
 * Bulk sync — adds zero-stock entries for every active store on ALL
 * non-discontinued medicines. Run once after a new PharmacyStore is created.
 * Access: superadmin. Can be slow on large catalogs.
 */
export const syncAllInventory = createAsyncThunk(
  'medicine/syncAllInventory',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/medicines/sync-inventory/all');
      toast.success(
        `Bulk sync complete — ${data.totalEntriesAdded} entries added across ${data.medicinesSynced} medicines.`
      );
      return data;
    } catch (error) {
      const message = extractError(error, 'Bulk inventory sync failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [M10] POST /api/v1/medicines/:id/sync-inventory
 * Single-medicine sync — adds zero-stock entries for any stores that don't
 * have one yet. Existing entries with real stock are never overwritten.
 * Access: superadmin, admin.
 */
export const syncMedicineInventory = createAsyncThunk(
  'medicine/syncInventory',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/medicines/${id}/sync-inventory`);
      toast.success(data.message || `Synced ${data.addedCount} new store(s).`);
      return { id, addedCount: data.addedCount, totalInventoryEntries: data.totalInventoryEntries };
    } catch (error) {
      const message = extractError(error, 'Inventory sync failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION C — INVENTORY THUNKS  [INV1–INV7]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [INV1] GET /api/v1/medicines/:id/inventory
 * List all store inventory entries for a medicine.
 * Pharmacy role sees only their assigned store's entry (resolved server-side).
 * Access: admin, superadmin, pharmacy.
 */
export const fetchMedicineInventory = createAsyncThunk(
  'medicine/inventory/fetchAll',
  async (medicineId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/medicines/${medicineId}/inventory`);
      return { medicineId, inventory: data.data, count: data.count };
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to fetch inventory'));
    }
  }
);

/**
 * [INV2] GET /api/v1/medicines/:id/inventory/:storeId
 * Single store's inventory entry for a medicine.
 * Pharmacy can only view their own store's entry.
 * Access: admin, superadmin, pharmacy.
 */
export const fetchStoreInventoryEntry = createAsyncThunk(
  'medicine/inventory/fetchByStore',
  async ({ medicineId, storeId }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/medicines/${medicineId}/inventory/${storeId}`);
      return { medicineId, storeId, entry: data.data };
    } catch (error) {
      return rejectWithValue(extractError(error, 'Inventory entry not found'));
    }
  }
);

/**
 * [INV3] POST /api/v1/medicines/:id/inventory
 * Add a new store inventory entry. Prevents duplicates (409 if already exists).
 * Body: { storeId, expiryDate, stockQuantity?, batchNumber?, pricePerUnit?, location?, reorderLevel? }
 * Access: admin, superadmin.
 */
export const addInventoryEntry = createAsyncThunk(
  'medicine/inventory/add',
  async ({ medicineId, entryData }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/medicines/${medicineId}/inventory`, entryData);
      toast.success('Inventory entry added');
      return { medicineId, entry: data.data };
    } catch (error) {
      const message = extractError(error, 'Failed to add inventory entry');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [INV4] PATCH /api/v1/medicines/:id/inventory/:storeId
 * Granular partial update of a store's inventory entry.
 * Pharmacy can only update their own store's entry.
 * Body: { stockQuantity?, reservedQuantity?, reorderLevel?, expiryDate?,
 *         manufacturingDate?, batchNumber?, pricePerUnit?, location?, isActive? }
 * Access: admin, superadmin, pharmacy.
 */
export const updateInventoryEntry = createAsyncThunk(
  'medicine/inventory/update',
  async ({ medicineId, storeId, updateData }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/medicines/${medicineId}/inventory/${storeId}`,
        updateData
      );
      toast.success('Inventory entry updated');
      return { medicineId, storeId, entry: data.data };
    } catch (error) {
      const message = extractError(error, 'Inventory update failed');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [INV5] DELETE /api/v1/medicines/:id/inventory/:storeId
 * Soft-delete (isActive = false) by default.
 * SuperAdmin can hard-delete: pass hard = true → ?hard=true query param.
 * Access: admin, superadmin.
 */
export const deleteInventoryEntry = createAsyncThunk(
  'medicine/inventory/delete',
  async ({ medicineId, storeId, hard = false }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(
        `/medicines/${medicineId}/inventory/${storeId}`,
        { params: hard ? { hard: 'true' } : {} }
      );
      toast.success(data.message || 'Inventory entry removed');
      return { medicineId, storeId, hard };
    } catch (error) {
      const message = extractError(error, 'Failed to remove inventory entry');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [INV6] GET /api/v1/medicines/inventory/low-stock
 * Cross-medicine low-stock report. Paginated.
 * Pharmacy's storeId is resolved server-side automatically.
 * Params: { storeId?, page?, limit? }
 * Access: admin, superadmin, pharmacy.
 */
export const fetchLowStockReport = createAsyncThunk(
  'medicine/inventory/lowStock',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/medicines/inventory/low-stock', { params });
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to fetch low-stock report'));
    }
  }
);

/**
 * [INV7] GET /api/v1/medicines/inventory/expiry-alerts
 * Medicines expiring within N days (default 30). Paginated.
 * Params: { days?, storeId?, page?, limit? }
 * Access: admin, superadmin, pharmacy.
 */
export const fetchExpiryAlerts = createAsyncThunk(
  'medicine/inventory/expiryAlerts',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/medicines/inventory/expiry-alerts', { params });
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to fetch expiry alerts'));
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION D — PHARMACY STORE THUNKS  [S1–S5]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [S1] GET /api/v1/medicines/stores
 * List all pharmacy stores — paginated, filterable.
 * Params: { search?, status?, storeType?, page?, limit? }
 * Access: admin, superadmin.
 *
 * FIX: was hitting wrong URL '/pharmacy/stores'. Router mounts stores under
 * /medicines/stores so the correct path is '/medicines/stores'.
 * Also fixed: router returns { pagination: { total, page, limit, pages } }
 * not { metadata } — reducer updated to match.
 */
export const fetchStores = createAsyncThunk(
  'medicine/stores/fetchAll',
  async (
    { page = 1, limit = 12, status, storeType, search } = {},
    { rejectWithValue }
  ) => {
    try {
      const { data } = await API.get('/medicines/stores', {
        params: { page, limit, status, storeType, search },
      });
      return data; // { success, pagination: { total, page, limit, pages }, data }
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to fetch stores'));
    }
  }
);

/**
 * [S2] GET /api/v1/medicines/nearby
 * Geo-query — stores within radiusKm of a lat/lng point.
 * Params: { lat, lng, radiusKm?, limit? }
 */
export const fetchNearbyStores = createAsyncThunk(
  'medicine/stores/fetchNearby',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/medicines/nearby', { params });
      return data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to fetch nearby stores'));
    }
  }
);

/**
 * [S3] GET /api/v1/medicines/:id (store id)
 * Full store detail by ObjectId. bankDetails stripped unless admin/superadmin (server-side).
 * Access: authenticated users.
 */
export const fetchStoreById = createAsyncThunk(
  'medicine/stores/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/medicines/${id}`);
      return data.data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Store not found'));
    }
  }
);

/**
 * [S4] GET /api/v1/medicines/slug/:slug
 * Public store page by slug. bankDetails always stripped.
 */
export const fetchStoreBySlug = createAsyncThunk(
  'medicine/stores/fetchBySlug',
  async (slug, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/medicines/slug/${slug}`);
      return data.data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Store not found'));
    }
  }
);

/**
 * [S5] GET /api/v1/medicines/my/store
 * The store assigned to the currently logged-in pharmacy user.
 * Access: pharmacy role only.
 */
export const fetchMyStore = createAsyncThunk(
  'medicine/stores/fetchMine',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/medicines/my/store');
      return data.data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'No store assigned to your account'));
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION E — STORE LIFECYCLE THUNKS  [SL1–SL4]
// These were entirely missing from the original slice.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [SL1] DELETE /api/v1/medicines/stores/:storeId
 * Permanently deletes a PharmacyStore and hard-removes every inventory entry
 * for this store across ALL medicines. Notifies admins in-app.
 * Access: superadmin.
 */
export const deleteStore = createAsyncThunk(
  'medicine/stores/delete',
  async (storeId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/medicines/stores/${storeId}`);
      toast.success(data.message || `Store deleted successfully`);
      return { storeId, medicinesUpdated: data.medicinesUpdated, message: data.message };
    } catch (error) {
      const message = extractError(error, 'Failed to delete store');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [SL2] PATCH /api/v1/medicines/stores/:storeId/suspend
 * Suspends a PharmacyStore (status → 'Under-Maintenance').
 * Sets isActive = false on ALL inventory entries for this store across every medicine.
 * Sends in-app notifications to admins + email to pharmacist manager.
 * Body: { reason? }
 * Access: superadmin, admin.
 */
export const suspendStore = createAsyncThunk(
  'medicine/stores/suspend',
  async ({ storeId, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/medicines/stores/${storeId}/suspend`,
        { reason }
      );
      toast.success(data.message || `Store suspended`);
      return { storeId, medicinesUpdated: data.medicinesUpdated, message: data.message };
    } catch (error) {
      const message = extractError(error, 'Failed to suspend store');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [SL3] PATCH /api/v1/medicines/stores/:storeId/unsuspend
 * Unsuspends / re-opens a PharmacyStore. Restores isActive = true on all
 * inventory entries. Immediately fires low-stock notifications + emails.
 * Notifies admins and the pharmacist.
 * Access: superadmin, admin.
 */
export const unsuspendStore = createAsyncThunk(
  'medicine/stores/unsuspend',
  async (storeId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/medicines/stores/${storeId}/unsuspend`);
      toast.success(data.message || `Store reopened successfully`);
      return { storeId, medicinesUpdated: data.medicinesUpdated, message: data.message };
    } catch (error) {
      const message = extractError(error, 'Failed to unsuspend store');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/**
 * [SL4] POST /api/v1/medicines/stores/low-stock/trigger
 * Manually triggers the low-stock email + notification run.
 * If storeId is provided → single store. Omit for all open stores.
 * Body: { storeId? }
 * Access: superadmin.
 */
export const triggerLowStockAlerts = createAsyncThunk(
  'medicine/stores/triggerLowStock',
  async ({ storeId } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        '/medicines/stores/low-stock/trigger',
        storeId ? { storeId } : {}
      );
      toast.success(data.message || 'Low-stock alerts triggered');
      return { storeId: storeId ?? null, message: data.message };
    } catch (error) {
      const message = extractError(error, 'Failed to trigger low-stock alerts');
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION F — INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // ── Medicine list & detail ────────────────────────────────────────────────
  medicines:       [],
  currentMedicine: null,

  stats: {
    categoryDistribution: [],
    totalStock:           0,
    discontinuedCount:    0,
    lowStockAlerts:       0,
    expiryAlerts:         0,
    raw:                  null,
  },

  pagination: {
    totalItems:  0,
    totalPages:  1,
    currentPage: 1,
    pageSize:    20,
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  currentInventory:      [],    // [INV1] per-medicine inventory list
  currentInventoryEntry: null,  // [INV2] single store entry
  inventoryMedicineId:   null,  // which medicine currentInventory belongs to

  lowStockReport: {
    data:     [],
    total:    0,
    metadata: { currentPage: 1, totalPages: 1, pageSize: 20 },
  },

  expiryAlerts: {
    data:       [],
    total:      0,
    withinDays: 30,
    metadata:   { currentPage: 1, totalPages: 1, pageSize: 20 },
  },

  // ── Sync ──────────────────────────────────────────────────────────────────
  syncResult: null, // last result from [M9] bulk-sync or [M10] single-sync

  // ── HSN ───────────────────────────────────────────────────────────────────
  hsnCodes:       [],
  currentHsnCode: null,

  hsnStats: {
    gstDistribution:  [],
    sourceBreakdown:  [],
    activeVsInactive: [],
    total:            0,
    generatedAt:      null,
  },

  hsnPagination: {
    total:       0,
    totalPages:  1,
    currentPage: 1,
    pageSize:    20,
  },

  hsnUploadResult: null,

  // ── Pharmacy Stores ────────────────────────────────────────────────────────
  stores:        [],
  currentStore:  null,  // [S3] fetchStoreById / [S4] fetchStoreBySlug
  myStore:       null,  // [S5] fetchMyStore — pharmacy user's assigned store
  nearbyStores:  [],

  // FIX: router returns { pagination: { total, page, limit, pages } }
  // not { metadata } — shape corrected to match router response.
  storePagination: {
    total:       0,
    totalPages:  1,
    currentPage: 1,
    pageSize:    12,
  },

  // ── Store lifecycle operation result  [SL1–SL4] ───────────────────────────
  storeLifecycleResult: null,

  // ── Loading flags ─────────────────────────────────────────────────────────
  loading:             false,  // list fetches [M1, H1]
  detailLoading:       false,  // single-record fetches [M4, H3, INV2]
  hsnLoading:          false,  // [H2] fetchHsnStats
  inventoryLoading:    false,  // [INV1, INV6, INV7]
  storeLoading:        false,  // [S1, S2] list/geo
  storeDetailLoading:  false,  // [S3, S4, S5]
  storeActionLoading:  false,  // [SL1, SL2, SL3, SL4]
  actionLoading:       false,  // all other mutations
  syncLoading:         false,  // [M9, M10]

  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION G — SLICE
// ─────────────────────────────────────────────────────────────────────────────

const medicineSlice = createSlice({
  name: 'medicine',
  initialState,
  reducers: {
    resetMedicineState:       () => initialState,
    clearMedicineError:       (state) => { state.error = null; },
    resetCurrentMedicine:     (state) => { state.currentMedicine = null; state.detailLoading = false; },
    resetCurrentHsnCode:      (state) => { state.currentHsnCode = null; },
    clearHsnUploadResult:     (state) => { state.hsnUploadResult = null; },
    resetCurrentStore:        (state) => { state.currentStore = null; },
    clearSyncResult:          (state) => { state.syncResult = null; },
    clearStoreLifecycleResult:(state) => { state.storeLifecycleResult = null; },
    resetInventory:           (state) => {
      state.currentInventory      = [];
      state.currentInventoryEntry = null;
      state.inventoryMedicineId   = null;
    },
  },

  extraReducers: (builder) => {
    builder

      // ════════════════════════════════════════════════════════════════════
      // HSN  [H1–H8]
      // ════════════════════════════════════════════════════════════════════

      // [H1] fetchHsnCodes
      .addCase(fetchHsnCodes.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchHsnCodes.fulfilled, (state, { payload }) => {
        state.loading          = false;
        state.hsnCodes         = payload.data ?? [];
        state.hsnPagination.total = payload.total ?? 0;
        if (payload.metadata) {
          state.hsnPagination.currentPage = payload.metadata.currentPage;
          state.hsnPagination.totalPages  = payload.metadata.totalPages;
          state.hsnPagination.pageSize    = payload.metadata.pageSize ?? 20;
        }
      })
      .addCase(fetchHsnCodes.rejected,  (state, { payload }) => { state.loading = false; state.error = payload; })

      // [H2] fetchHsnStats
      .addCase(fetchHsnStats.pending,   (state) => { state.hsnLoading = true; state.error = null; })
      .addCase(fetchHsnStats.fulfilled, (state, { payload }) => {
        state.hsnLoading = false;
        const d = payload ?? {};
        state.hsnStats = {
          gstDistribution:  d.gstDistribution  ?? [],
          sourceBreakdown:  d.sourceBreakdown   ?? [],
          activeVsInactive: d.activeVsInactive  ?? [],
          total:            d.totals?.[0]?.total ?? 0,
          generatedAt:      new Date().toISOString(),
        };
      })
      .addCase(fetchHsnStats.rejected,  (state, { payload }) => { state.hsnLoading = false; state.error = payload; })

      // [H3] fetchHsnByCode
      .addCase(fetchHsnByCode.pending,   (state) => { state.detailLoading = true; state.currentHsnCode = null; state.error = null; })
      .addCase(fetchHsnByCode.fulfilled, (state, { payload }) => { state.detailLoading = false; state.currentHsnCode = payload; })
      .addCase(fetchHsnByCode.rejected,  (state, { payload }) => { state.detailLoading = false; state.error = payload; })

      // [H4] createHsnCode
      .addCase(createHsnCode.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(createHsnCode.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.hsnCodes.unshift(payload);
        state.hsnPagination.total += 1;
      })
      .addCase(createHsnCode.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [H5] uploadHsnFile
      .addCase(uploadHsnFile.pending,   (state) => { state.actionLoading = true; state.hsnUploadResult = null; state.error = null; })
      .addCase(uploadHsnFile.fulfilled, (state, { payload }) => { state.actionLoading = false; state.hsnUploadResult = payload; })
      .addCase(uploadHsnFile.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [H6] bulkDeleteHsnCodes
      .addCase(bulkDeleteHsnCodes.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(bulkDeleteHsnCodes.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        const deleted = (payload.codes ?? []).map((c) =>
          String(c).toUpperCase().replace(/\s/g, '')
        );
        state.hsnCodes = state.hsnCodes.map((h) =>
          deleted.includes(h.hsnCode) ? { ...h, isActive: false } : h
        );
      })
      .addCase(bulkDeleteHsnCodes.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [H7] updateHsnCode
      .addCase(updateHsnCode.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(updateHsnCode.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        const idx = state.hsnCodes.findIndex((h) => h.hsnCode === payload.hsnCode);
        if (idx !== -1) state.hsnCodes[idx] = payload;
        if (state.currentHsnCode?.hsnCode === payload.hsnCode) state.currentHsnCode = payload;
      })
      .addCase(updateHsnCode.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [H8] deleteHsnCode
      .addCase(deleteHsnCode.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(deleteHsnCode.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.hsnCodes = state.hsnCodes.map((h) =>
          h.hsnCode === payload.code ? { ...h, isActive: false } : h
        );
        if (state.currentHsnCode?.hsnCode === payload.code) {
          state.currentHsnCode = { ...state.currentHsnCode, isActive: false };
        }
      })
      .addCase(deleteHsnCode.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // ════════════════════════════════════════════════════════════════════
      // MEDICINE  [M1–M10]
      // ════════════════════════════════════════════════════════════════════

      // [M1] fetchMedicines
      .addCase(fetchMedicines.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMedicines.fulfilled, (state, { payload }) => {
        state.loading           = false;
        state.medicines         = payload.data ?? [];
        state.pagination.totalItems = payload.count ?? 0;
        if (payload.metadata) {
          state.pagination.totalPages  = payload.metadata.totalPages;
          state.pagination.currentPage = payload.metadata.currentPage;
          state.pagination.pageSize    = payload.metadata.pageSize ?? 20;
        }
      })
      .addCase(fetchMedicines.rejected,  (state, { payload }) => { state.loading = false; state.error = payload; })

      // [M2] fetchInventoryStats
      .addCase(fetchInventoryStats.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchInventoryStats.fulfilled, (state, { payload }) => {
        state.loading = false;
        const summary = payload?.summary ?? {};
        state.stats = {
          categoryDistribution: summary.categoryStats                   ?? [],
          totalStock:           summary.inventoryStats?.[0]?.totalStock ?? 0,
          discontinuedCount:    summary.discontinuedCount?.[0]?.count   ?? 0,
          lowStockAlerts:       summary.lowStockAlerts?.[0]?.count      ?? 0,
          expiryAlerts:         summary.expiryAlerts?.[0]?.count        ?? 0,
          raw:                  summary,
        };
      })
      .addCase(fetchInventoryStats.rejected,  (state, { payload }) => { state.loading = false; state.error = payload; })

      // [M3] sendRestockRequest
      .addCase(sendRestockRequest.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(sendRestockRequest.fulfilled, (state) => { state.actionLoading = false; })
      .addCase(sendRestockRequest.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [M4] fetchMedicineBySlug
      .addCase(fetchMedicineBySlug.pending,   (state) => { state.detailLoading = true; state.currentMedicine = null; state.error = null; })
      .addCase(fetchMedicineBySlug.fulfilled, (state, { payload }) => { state.detailLoading = false; state.currentMedicine = payload; })
      .addCase(fetchMedicineBySlug.rejected,  (state, { payload }) => { state.detailLoading = false; state.error = payload; })

      // [M5] createMedicine
      .addCase(createMedicine.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(createMedicine.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.medicines.unshift(payload);
        state.pagination.totalItems += 1;
      })
      .addCase(createMedicine.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [M6] updateMedicine
      .addCase(updateMedicine.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(updateMedicine.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (!payload) return;
        const idx = state.medicines.findIndex((m) => m._id === payload._id);
        if (idx !== -1) state.medicines[idx] = payload;
        if (state.currentMedicine?._id === payload._id) state.currentMedicine = payload;
        // Sync currentInventory if it belongs to this medicine
        if (state.inventoryMedicineId === payload._id && payload.inventory) {
          state.currentInventory = payload.inventory;
        }
      })
      .addCase(updateMedicine.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [M7] updateStock
      .addCase(updateStock.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(updateStock.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        const { id, inventory } = payload;
        // Router returns the full inventory array directly as data.data
        const inventoryArray = Array.isArray(inventory) ? inventory : null;
        if (inventoryArray) {
          const idx = state.medicines.findIndex((m) => m._id === id);
          if (idx !== -1) state.medicines[idx] = { ...state.medicines[idx], inventory: inventoryArray };
          if (state.currentMedicine?._id === id) {
            state.currentMedicine = { ...state.currentMedicine, inventory: inventoryArray };
          }
          if (state.inventoryMedicineId === id) state.currentInventory = inventoryArray;
        }
      })
      .addCase(updateStock.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [M8] discontinueMedicine
      .addCase(discontinueMedicine.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(discontinueMedicine.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        const { id } = payload;
        const idx = state.medicines.findIndex((m) => m._id === id);
        if (idx !== -1) state.medicines[idx].isDiscontinued = true;
        if (state.currentMedicine?._id === id) {
          state.currentMedicine = { ...state.currentMedicine, isDiscontinued: true };
        }
      })
      .addCase(discontinueMedicine.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [M9] syncAllInventory
      .addCase(syncAllInventory.pending,   (state) => { state.syncLoading = true; state.syncResult = null; state.error = null; })
      .addCase(syncAllInventory.fulfilled, (state, { payload }) => {
        state.syncLoading = false;
        state.syncResult  = {
          type:              'bulk',
          totalMedicines:    payload.totalMedicines,
          medicinesSynced:   payload.medicinesSynced,
          totalEntriesAdded: payload.totalEntriesAdded,
          errors:            payload.errors ?? [],
        };
      })
      .addCase(syncAllInventory.rejected,  (state, { payload }) => { state.syncLoading = false; state.error = payload; })

      // [M10] syncMedicineInventory
      .addCase(syncMedicineInventory.pending,   (state) => { state.syncLoading = true; state.error = null; })
      .addCase(syncMedicineInventory.fulfilled, (state, { payload }) => {
        state.syncLoading = false;
        state.syncResult  = {
          type:                  'single',
          medicineId:            payload.id,
          addedCount:            payload.addedCount,
          totalInventoryEntries: payload.totalInventoryEntries,
        };
        // Reflect updated total entry count without overwriting real stock data.
        // Caller should re-dispatch fetchMedicineInventory if they need the new entries.
        if (state.currentMedicine?._id === payload.id) {
          state.currentMedicine = {
            ...state.currentMedicine,
            _inventoryCount: payload.totalInventoryEntries,
          };
        }
      })
      .addCase(syncMedicineInventory.rejected,  (state, { payload }) => { state.syncLoading = false; state.error = payload; })

      // ════════════════════════════════════════════════════════════════════
      // INVENTORY  [INV1–INV7]
      // ════════════════════════════════════════════════════════════════════

      // [INV1] fetchMedicineInventory
      .addCase(fetchMedicineInventory.pending,   (state) => { state.inventoryLoading = true; state.error = null; })
      .addCase(fetchMedicineInventory.fulfilled, (state, { payload }) => {
        state.inventoryLoading    = false;
        state.currentInventory    = payload.inventory ?? [];
        state.inventoryMedicineId = payload.medicineId;
      })
      .addCase(fetchMedicineInventory.rejected,  (state, { payload }) => { state.inventoryLoading = false; state.error = payload; })

      // [INV2] fetchStoreInventoryEntry
      .addCase(fetchStoreInventoryEntry.pending,   (state) => { state.detailLoading = true; state.currentInventoryEntry = null; state.error = null; })
      .addCase(fetchStoreInventoryEntry.fulfilled, (state, { payload }) => { state.detailLoading = false; state.currentInventoryEntry = payload.entry; })
      .addCase(fetchStoreInventoryEntry.rejected,  (state, { payload }) => { state.detailLoading = false; state.error = payload; })

      // [INV3] addInventoryEntry
      .addCase(addInventoryEntry.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(addInventoryEntry.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.inventoryMedicineId === payload.medicineId) {
          state.currentInventory.push(payload.entry);
        }
        if (state.currentMedicine?._id === payload.medicineId) {
          state.currentMedicine = {
            ...state.currentMedicine,
            inventory: [...(state.currentMedicine.inventory ?? []), payload.entry],
          };
        }
      })
      .addCase(addInventoryEntry.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [INV4] updateInventoryEntry
      .addCase(updateInventoryEntry.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(updateInventoryEntry.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        const { medicineId, storeId, entry } = payload;

        const matchesStore = (inv) =>
          inv.storeId?.toString()      === storeId ||
          inv.storeId?._id?.toString() === storeId;

        // Sync currentInventory
        if (state.inventoryMedicineId === medicineId) {
          const idx = state.currentInventory.findIndex(matchesStore);
          if (idx !== -1) state.currentInventory[idx] = entry;
        }
        // Sync currentInventoryEntry
        if (matchesStore(state.currentInventoryEntry ?? {})) {
          state.currentInventoryEntry = entry;
        }
        // Sync currentMedicine.inventory
        if (state.currentMedicine?._id === medicineId) {
          const inv     = state.currentMedicine.inventory ?? [];
          const idx     = inv.findIndex(matchesStore);
          if (idx !== -1) {
            const updated = [...inv];
            updated[idx]  = entry;
            state.currentMedicine = { ...state.currentMedicine, inventory: updated };
          }
        }
      })
      .addCase(updateInventoryEntry.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [INV5] deleteInventoryEntry
      .addCase(deleteInventoryEntry.pending,   (state) => { state.actionLoading = true; state.error = null; })
      .addCase(deleteInventoryEntry.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        const { medicineId, storeId, hard } = payload;

        const matchesStore = (inv) =>
          inv.storeId?.toString()      === storeId ||
          inv.storeId?._id?.toString() === storeId;

        if (state.inventoryMedicineId === medicineId) {
          state.currentInventory = hard
            ? state.currentInventory.filter((inv) => !matchesStore(inv))
            : state.currentInventory.map((inv) =>
                matchesStore(inv) ? { ...inv, isActive: false } : inv
              );
        }
        if (state.currentMedicine?._id === medicineId) {
          const inv     = state.currentMedicine.inventory ?? [];
          const updated = hard
            ? inv.filter((i) => !matchesStore(i))
            : inv.map((i) => (matchesStore(i) ? { ...i, isActive: false } : i));
          state.currentMedicine = { ...state.currentMedicine, inventory: updated };
        }
      })
      .addCase(deleteInventoryEntry.rejected,  (state, { payload }) => { state.actionLoading = false; state.error = payload; })

      // [INV6] fetchLowStockReport
      .addCase(fetchLowStockReport.pending,   (state) => { state.inventoryLoading = true; state.error = null; })
      .addCase(fetchLowStockReport.fulfilled, (state, { payload }) => {
        state.inventoryLoading = false;
        state.lowStockReport = {
          data:     payload.data     ?? [],
          total:    payload.total    ?? 0,
          metadata: payload.metadata ?? { currentPage: 1, totalPages: 1, pageSize: 20 },
        };
      })
      .addCase(fetchLowStockReport.rejected,  (state, { payload }) => { state.inventoryLoading = false; state.error = payload; })

      // [INV7] fetchExpiryAlerts
      .addCase(fetchExpiryAlerts.pending,   (state) => { state.inventoryLoading = true; state.error = null; })
      .addCase(fetchExpiryAlerts.fulfilled, (state, { payload }) => {
        state.inventoryLoading = false;
        state.expiryAlerts = {
          data:       payload.data       ?? [],
          total:      payload.total      ?? 0,
          withinDays: payload.withinDays ?? 30,
          metadata:   payload.metadata   ?? { currentPage: 1, totalPages: 1, pageSize: 20 },
        };
      })
      .addCase(fetchExpiryAlerts.rejected,  (state, { payload }) => { state.inventoryLoading = false; state.error = payload; })

      // ════════════════════════════════════════════════════════════════════
      // PHARMACY STORES  [S1–S5]
      // ════════════════════════════════════════════════════════════════════

      // [S1] fetchStores
      // FIX: router returns { pagination: { total, page, limit, pages } }
      // not metadata — shape updated accordingly.
      .addCase(fetchStores.pending,   (state) => { state.storeLoading = true; state.error = null; })
      .addCase(fetchStores.fulfilled, (state, { payload }) => {
        state.storeLoading = false;
        state.stores       = payload.data ?? [];
        if (payload.pagination) {
          state.storePagination.total       = payload.pagination.total   ?? 0;
          state.storePagination.currentPage = payload.pagination.page    ?? 1;
          state.storePagination.totalPages  = payload.pagination.pages   ?? 1;
          state.storePagination.pageSize    = payload.pagination.limit   ?? 12;
        }
      })
      .addCase(fetchStores.rejected,  (state, { payload }) => { state.storeLoading = false; state.error = payload; })

      // [S2] fetchNearbyStores
      .addCase(fetchNearbyStores.pending,   (state) => { state.storeLoading = true; state.error = null; })
      .addCase(fetchNearbyStores.fulfilled, (state, { payload }) => {
        state.storeLoading = false;
        state.nearbyStores = payload.data ?? [];
      })
      .addCase(fetchNearbyStores.rejected,  (state, { payload }) => { state.storeLoading = false; state.error = payload; })

      // [S3] fetchStoreById
      .addCase(fetchStoreById.pending,   (state) => { state.storeDetailLoading = true; state.currentStore = null; state.error = null; })
      .addCase(fetchStoreById.fulfilled, (state, { payload }) => { state.storeDetailLoading = false; state.currentStore = payload; })
      .addCase(fetchStoreById.rejected,  (state, { payload }) => { state.storeDetailLoading = false; state.error = payload; })

      // [S4] fetchStoreBySlug
      .addCase(fetchStoreBySlug.pending,   (state) => { state.storeDetailLoading = true; state.currentStore = null; state.error = null; })
      .addCase(fetchStoreBySlug.fulfilled, (state, { payload }) => { state.storeDetailLoading = false; state.currentStore = payload; })
      .addCase(fetchStoreBySlug.rejected,  (state, { payload }) => { state.storeDetailLoading = false; state.error = payload; })

      // [S5] fetchMyStore
      .addCase(fetchMyStore.pending,   (state) => { state.storeDetailLoading = true; state.myStore = null; state.error = null; })
      .addCase(fetchMyStore.fulfilled, (state, { payload }) => { state.storeDetailLoading = false; state.myStore = payload; })
      .addCase(fetchMyStore.rejected,  (state, { payload }) => { state.storeDetailLoading = false; state.error = payload; })

      // ════════════════════════════════════════════════════════════════════
      // STORE LIFECYCLE  [SL1–SL4]  ← entirely new — was missing before
      // ════════════════════════════════════════════════════════════════════

      // [SL1] deleteStore
      .addCase(deleteStore.pending,   (state) => { state.storeActionLoading = true; state.error = null; })
      .addCase(deleteStore.fulfilled, (state, { payload }) => {
        state.storeActionLoading  = false;
        // Remove the store from the list
        state.stores = state.stores.filter((s) => s._id !== payload.storeId);
        state.storePagination.total = Math.max(0, state.storePagination.total - 1);
        // Clear currentStore if it was the deleted one
        if (state.currentStore?._id === payload.storeId) state.currentStore = null;
        // Clear myStore if it was the deleted one
        if (state.myStore?._id === payload.storeId) state.myStore = null;
        state.storeLifecycleResult = {
          type:             'deleted',
          storeId:          payload.storeId,
          medicinesUpdated: payload.medicinesUpdated,
        };
      })
      .addCase(deleteStore.rejected,  (state, { payload }) => { state.storeActionLoading = false; state.error = payload; })

      // [SL2] suspendStore
      .addCase(suspendStore.pending,   (state) => { state.storeActionLoading = true; state.error = null; })
      .addCase(suspendStore.fulfilled, (state, { payload }) => {
        state.storeActionLoading = false;
        // Update the store's status in the list
        const idx = state.stores.findIndex((s) => s._id === payload.storeId);
        if (idx !== -1) state.stores[idx] = { ...state.stores[idx], status: 'Under-Maintenance' };
        // Update currentStore if it was the suspended one
        if (state.currentStore?._id === payload.storeId) {
          state.currentStore = { ...state.currentStore, status: 'Under-Maintenance' };
        }
        if (state.myStore?._id === payload.storeId) {
          state.myStore = { ...state.myStore, status: 'Under-Maintenance' };
        }
        state.storeLifecycleResult = {
          type:             'suspended',
          storeId:          payload.storeId,
          medicinesUpdated: payload.medicinesUpdated,
        };
      })
      .addCase(suspendStore.rejected,  (state, { payload }) => { state.storeActionLoading = false; state.error = payload; })

      // [SL3] unsuspendStore
      .addCase(unsuspendStore.pending,   (state) => { state.storeActionLoading = true; state.error = null; })
      .addCase(unsuspendStore.fulfilled, (state, { payload }) => {
        state.storeActionLoading = false;
        const idx = state.stores.findIndex((s) => s._id === payload.storeId);
        if (idx !== -1) state.stores[idx] = { ...state.stores[idx], status: 'Open' };
        if (state.currentStore?._id === payload.storeId) {
          state.currentStore = { ...state.currentStore, status: 'Open' };
        }
        if (state.myStore?._id === payload.storeId) {
          state.myStore = { ...state.myStore, status: 'Open' };
        }
        state.storeLifecycleResult = {
          type:             'unsuspended',
          storeId:          payload.storeId,
          medicinesUpdated: payload.medicinesUpdated,
        };
      })
      .addCase(unsuspendStore.rejected,  (state, { payload }) => { state.storeActionLoading = false; state.error = payload; })

      // [SL4] triggerLowStockAlerts
      .addCase(triggerLowStockAlerts.pending,   (state) => { state.storeActionLoading = true; state.error = null; })
      .addCase(triggerLowStockAlerts.fulfilled, (state, { payload }) => {
        state.storeActionLoading  = false;
        state.storeLifecycleResult = {
          type:    'lowStockTriggered',
          storeId: payload.storeId,
          message: payload.message,
        };
      })
      .addCase(triggerLowStockAlerts.rejected,  (state, { payload }) => { state.storeActionLoading = false; state.error = payload; });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION H — ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  resetMedicineState,
  clearMedicineError,
  resetCurrentMedicine,
  resetCurrentHsnCode,
  clearHsnUploadResult,
  resetCurrentStore,
  clearSyncResult,
  clearStoreLifecycleResult,
  resetInventory,
} = medicineSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION I — SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// ── Medicine ──────────────────────────────────────────────────────────────────
export const selectAllMedicines          = (s) => s.medicine.medicines;
export const selectCurrentMedicine       = (s) => s.medicine.currentMedicine;
export const selectMedicineStats         = (s) => s.medicine.stats;
export const selectMedicineLoading       = (s) => s.medicine.loading;
export const selectMedicineDetailLoading = (s) => s.medicine.detailLoading;
export const selectMedicineActionLoading = (s) => s.medicine.actionLoading;
export const selectMedicineSyncLoading   = (s) => s.medicine.syncLoading;
export const selectMedicinePagination    = (s) => s.medicine.pagination;
export const selectMedicineError         = (s) => s.medicine.error;
export const selectSyncResult            = (s) => s.medicine.syncResult;

// ── Inventory ─────────────────────────────────────────────────────────────────
export const selectCurrentInventory      = (s) => s.medicine.currentInventory;
export const selectCurrentInventoryEntry = (s) => s.medicine.currentInventoryEntry;
export const selectInventoryMedicineId   = (s) => s.medicine.inventoryMedicineId;
export const selectInventoryLoading      = (s) => s.medicine.inventoryLoading;
export const selectLowStockReport        = (s) => s.medicine.lowStockReport;
export const selectExpiryAlerts          = (s) => s.medicine.expiryAlerts;

// ── HSN ───────────────────────────────────────────────────────────────────────
export const selectAllHsnCodes           = (s) => s.medicine.hsnCodes;
export const selectCurrentHsnCode        = (s) => s.medicine.currentHsnCode;
export const selectHsnStats              = (s) => s.medicine.hsnStats;
export const selectHsnPagination         = (s) => s.medicine.hsnPagination;
export const selectHsnUploadResult       = (s) => s.medicine.hsnUploadResult;
export const selectHsnLoading            = (s) => s.medicine.hsnLoading;

// ── Pharmacy Stores ───────────────────────────────────────────────────────────
export const selectAllStores             = (s) => s.medicine.stores;
export const selectCurrentStore          = (s) => s.medicine.currentStore;
export const selectMyStore               = (s) => s.medicine.myStore;
export const selectNearbyStores          = (s) => s.medicine.nearbyStores;
export const selectStorePagination       = (s) => s.medicine.storePagination;
export const selectStoreLoading          = (s) => s.medicine.storeLoading;
export const selectStoreDetailLoading    = (s) => s.medicine.storeDetailLoading;
export const selectStoreActionLoading    = (s) => s.medicine.storeActionLoading;
export const selectStoreLifecycleResult  = (s) => s.medicine.storeLifecycleResult;

export default medicineSlice.reducer;