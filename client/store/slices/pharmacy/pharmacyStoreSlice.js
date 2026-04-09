import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../api';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════════════════════
// § CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Must match the Express router mount path exactly. */
const API_BASE = '/pharmacy-store';

const ERROR_MESSAGES = {
  // Orders
  FETCH_ORDERS:               'Failed to fetch orders',
  FETCH_ORDER_DETAILS:        'Failed to fetch order details',
  VERIFY_PRESCRIPTION:        'Failed to verify prescription',
  CONFIRM_ORDER:              'Failed to confirm order',
  UPDATE_ORDER_STATUS:        'Failed to update order status',
  RETURN_ACCEPT:              'Failed to accept return request',
  PICKUP_VERIFY:              'Failed to verify pickup',
  PROCESS_REFUND:             'Failed to process refund',
  ADD_NOTE:                   'Failed to add note',
  ASSIGN_DRIVER:              'Failed to assign delivery partner',
  EXPORT_ORDER:               'Failed to export order',
  FETCH_ORDER_INVOICE:        'Failed to fetch order invoice',
  FETCH_ORDER_LABEL:          'Failed to fetch order label',
  // Inventory
  FETCH_MEDICINES:            'Failed to fetch medicines',
  ADD_STOCK:                  'Failed to add stock',
  DEDUCT_STOCK:               'Failed to deduct stock',
  FETCH_MEDICINE_STOCK:       'Failed to fetch medicine stock',
  FETCH_BATCHES:              'Failed to fetch inventory batches',
  FETCH_EXPIRY_ALERTS:        'Failed to fetch expiry alerts',
  FETCH_LOW_STOCK:            'Failed to fetch low-stock items',
  REQUEST_STOCK:              'Failed to request stock replenishment',
  FETCH_INVENTORY_SUMMARY:    'Failed to fetch inventory summary',
  // HSN
  FETCH_HSN_CODES:            'Failed to fetch HSN codes',
  FETCH_HSN_STATS:            'Failed to fetch HSN stats',
  FETCH_HSN_CODE:             'Failed to fetch HSN code',
  CREATE_HSN_CODE:            'Failed to create HSN code',
  UPDATE_HSN_CODE:            'Failed to update HSN code',
  DELETE_HSN_CODE:            'Failed to delete HSN code',
  HSN_BULK_DELETE:            'Failed to bulk delete HSN codes',
  HSN_UPLOAD:                 'Failed to upload HSN file',
  // Financials
  FETCH_DAILY_EARNINGS:       'Failed to fetch daily earnings',
  FETCH_MONTHLY_EARNINGS:     'Failed to fetch monthly earnings',
  FETCH_TOTAL_EARNINGS:       'Failed to fetch lifetime earnings',
  FETCH_EARNINGS_HISTORY:     'Failed to fetch earnings history',
  FETCH_STORE_INVOICE:        'Failed to fetch store invoice',
  SEND_STORE_INVOICE:         'Failed to send store invoice',
  // Payment Accounts
  FETCH_PAYMENT_ACCOUNT:      'Failed to fetch payment account',
  ADD_BANK_ACCOUNT:           'Failed to add bank account',
  UPDATE_BANK_ACCOUNT:        'Failed to update bank account',
  DELETE_BANK_ACCOUNT:        'Failed to delete bank account',
  ADD_UPI:                    'Failed to add UPI handle',
  DELETE_UPI:                 'Failed to delete UPI handle',
  // Settlements
  FETCH_SETTLEMENTS:          'Failed to fetch settlement summary',
  REQUEST_SETTLEMENT:         'Failed to request settlement',
  FETCH_SETTLEMENT_HISTORY:   'Failed to fetch settlement history',
  // Analytics
  FETCH_ANALYTICS_OVERVIEW:   'Failed to fetch analytics overview',
  FETCH_ANALYTICS_REVENUE:    'Failed to fetch revenue analytics',
  FETCH_ANALYTICS_RETURNS:    'Failed to fetch return analytics',
  FETCH_TOP_MEDICINES:        'Failed to fetch top medicines analytics',
  // Profile & Store
  FETCH_PROFILE:              'Failed to fetch profile',
  UPDATE_PROFILE:             'Failed to update profile',
  CHANGE_PASSWORD:            'Failed to change password',
  FETCH_PHARMACY_PROFILE:     'Failed to fetch pharmacy profile',
  UPDATE_PHARMACY_PROFILE:    'Failed to update pharmacy profile',
  FETCH_STORE:                'Failed to fetch store details',
  UPDATE_STORE:               'Failed to update store',
  // Audit
  FETCH_SESSIONS:             'Failed to fetch sessions',
  REVOKE_SESSION:             'Failed to revoke session',
  LOGOUT_ALL:                 'Failed to logout from all devices',
  FETCH_DEVICES:              'Failed to fetch devices',
  REMOVE_DEVICE:              'Failed to remove device',
  REMOVE_ALL_DEVICES:         'Failed to remove all devices',
};

// ═══════════════════════════════════════════════════════════════════════════════
// § HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Strips undefined / null / '' entries then serialises as a query string.
 * Returns an empty string when nothing survives the filter.
 */
const buildQueryParams = (params = {}) => {
  const filtered = Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') acc[key] = value;
    return acc;
  }, {});
  const qs = new URLSearchParams(filtered).toString();
  return qs ? `?${qs}` : '';
};

/**
 * Extract a clean error message from an Axios error or rejectWithValue payload.
 */
const extractErrorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

/**
 * Find an order in the list by its human-readable orderId and replace it in-place.
 */
const replaceOrderInList = (list, updated) => {
  const idx = list.findIndex((o) => o.orderId === updated.orderId);
  if (idx !== -1) list[idx] = updated;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — ORDER MANAGEMENT (Routes 01–13)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Route 01: fetchOrders ─────────────────────────────────────────────────────
/**
 * GET /pharmacy-store/orders
 * Router accepts: status, dateFilter (default:'today'), startDate, endDate,
 *                 paymentStatus, page, limit, sortBy (default:'createdAt'),
 *                 sortOrder (default:'desc')
 */
export const fetchOrders = createAsyncThunk(
  'pharmacyStore/fetchOrders',
  async (params, { rejectWithValue }) => {
  
    try {
      const {
        status,
        dateFilter = 'today',
        startDate,
        endDate,
        paymentStatus,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = params || {};
      const qs = buildQueryParams({
        status, dateFilter, startDate, endDate, paymentStatus,
        page, limit, sortBy, sortOrder,
      });
      const { data } = await API.get(`${API_BASE}/orders${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_ORDERS });
      return data.data; // { orders, pagination }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_ORDERS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 02: fetchOrderDetails ───────────────────────────────────────────────
/**
 * GET /pharmacy-store/orders/:orderId
 * Router uses findOrderPopulated → returns order.toObject({ virtuals: true })
 * Response shape: { success, data: { order } }
 */
export const fetchOrderDetails = createAsyncThunk(
  'pharmacyStore/fetchOrderDetails',
  async (orderId, { rejectWithValue }) => {
    try {
      if (!orderId) return rejectWithValue({ message: 'orderId is required' });
      const { data } = await API.get(`${API_BASE}/orders/${orderId}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_ORDER_DETAILS });
      return data.data.order;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_ORDER_DETAILS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 03: verifyPrescription ──────────────────────────────────────────────
/**
 * POST /pharmacy-store/orders/:orderId/verify-prescription
 * Body: { isVerified: bool, verificationNotes?, rejectionReason? }
 * Response: { success, message, data: { order } }
 */
export const verifyPrescription = createAsyncThunk(
  'pharmacyStore/verifyPrescription',
  async ({ orderId, isVerified, verificationNotes, rejectionReason }, { rejectWithValue }) => {
    try {
      if (typeof isVerified !== 'boolean')
        return rejectWithValue({ message: 'isVerified must be a boolean' });
      if (!isVerified && !rejectionReason?.trim())
        return rejectWithValue({ message: 'rejectionReason is required when rejecting' });

      const { data } = await API.post(`${API_BASE}/orders/${orderId}/verify-prescription`, {
        isVerified,
        verificationNotes: verificationNotes || '',
        ...(rejectionReason && { rejectionReason }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.VERIFY_PRESCRIPTION });
      return data.data.order;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.VERIFY_PRESCRIPTION, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 04: confirmOrder ────────────────────────────────────────────────────
/**
 * POST /pharmacy-store/orders/:orderId/confirm
 * Body: { deliveryType: 'Internal'|'Third-Party', internalPartner?, externalPartner? }
 * Router only requires deliveryType; partner fields are optional even on the router.
 * FIX: Removed client-side hard requirement for internalPartner when Internal —
 *      the router doesn't enforce it (it does a conditional assignment). Keeping
 *      the validation is still good UX but it must not block the thunk.
 * Response: { success, message, data: { order } }
 */
export const confirmOrder = createAsyncThunk(
  'pharmacyStore/confirmOrder',
  async ({ orderId, deliveryType, internalPartner, externalPartner }, { rejectWithValue }) => {
    try {
      if (!['Internal', 'Third-Party'].includes(deliveryType))
        return rejectWithValue({ message: 'deliveryType must be Internal or Third-Party' });

      const { data } = await API.post(`${API_BASE}/orders/${orderId}/confirm`, {
        deliveryType,
        ...(deliveryType === 'Internal'    && internalPartner  && { internalPartner }),
        ...(deliveryType === 'Third-Party' && externalPartner  && { externalPartner }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.CONFIRM_ORDER });
      return data.data.order;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.CONFIRM_ORDER, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 05: updateOrderStatus ───────────────────────────────────────────────
/**
 * PATCH /pharmacy-store/orders/:orderId/status
 * Body: { status (required), note?, estimatedArrival? }
 * Router valid transitions:
 *   Placed → Confirmed | Cancelled
 *   Confirmed → Processing | Cancelled
 *   Processing → Out-for-Delivery | Cancelled
 *   Out-for-Delivery → Delivered | Cancelled
 *   Delivered → Return_Requested
 *   Return_Requested → Return_Accepted | Return_Rejected
 *   Return_Accepted → Pickup_Assigned
 *   Pickup_Assigned → Pickup_Done
 *   Pickup_Done → Returned
 * Response: { success, message, data: { order } }
 */
export const updateOrderStatus = createAsyncThunk(
  'pharmacyStore/updateOrderStatus',
  async ({ orderId, status, note, estimatedArrival }, { rejectWithValue }) => {
    try {
      if (!status) return rejectWithValue({ message: 'status is required' });
      const { data } = await API.patch(`${API_BASE}/orders/${orderId}/status`, {
        status,
        ...(note             && { note }),
        ...(estimatedArrival && { estimatedArrival }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.UPDATE_ORDER_STATUS });
      return data.data.order;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.UPDATE_ORDER_STATUS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 06: acceptReturn ────────────────────────────────────────────────────
/**
 * POST /pharmacy-store/orders/:orderId/return-accept
 * Body: { pickupPartner?, pickupEstimatedAt? }
 * Router does NOT enforce pickupPartner as required — it conditionally assigns it.
 * FIX: Removed hard client-side guard so callers can omit pickupPartner.
 * Response: { success, message, data: { order } }
 */
export const acceptReturn = createAsyncThunk(
  'pharmacyStore/acceptReturn',
  async ({ orderId, pickupPartner, pickupEstimatedAt }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${API_BASE}/orders/${orderId}/return-accept`, {
        ...(pickupPartner      && { pickupPartner }),
        ...(pickupEstimatedAt  && { pickupEstimatedAt }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.RETURN_ACCEPT });
      return data.data.order;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.RETURN_ACCEPT, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 07: processRefund ───────────────────────────────────────────────────
/**
 * POST /pharmacy-store/orders/:orderId/process-refund
 * Body: { amount: number (₹, router converts to paise internally), reason? }
 * Router requires order.payment.razorpayPaymentId to exist.
 * Response: { success, message, data: { order, refundId } }
 */
export const processRefund = createAsyncThunk(
  'pharmacyStore/processRefund',
  async ({ orderId, amount, reason }, { rejectWithValue }) => {
    try {
      if (!amount || amount <= 0)
        return rejectWithValue({ message: 'Refund amount must be greater than 0' });
      const { data } = await API.post(`${API_BASE}/orders/${orderId}/process-refund`, {
        amount,
        reason: reason || '',
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.PROCESS_REFUND });
      return { orderId, ...data.data }; // { orderId, order, refundId }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.PROCESS_REFUND, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 08: addOrderNote ────────────────────────────────────────────────────
/**
 * POST /pharmacy-store/orders/:orderId/add-admin-note
 * Body: { note: string }
 * Response: { success, message, data: { order } }
 */
export const addOrderNote = createAsyncThunk(
  'pharmacyStore/addOrderNote',
  async ({ orderId, note }, { rejectWithValue }) => {
    try {
      if (!note?.trim()) return rejectWithValue({ message: 'Note must be a non-empty string' });
      const { data } = await API.post(`${API_BASE}/orders/${orderId}/add-admin-note`, { note: note.trim() });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.ADD_NOTE });
      return data.data.order;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.ADD_NOTE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 09: assignDeliveryPartner ───────────────────────────────────────────
/**
 * POST /pharmacy-store/orders/:orderId/assign-delivery-partner
 * Body: { deliveryPartnerId (required) }
 * Response: { success, message, data: { order } }
 */
export const assignDeliveryPartner = createAsyncThunk(
  'pharmacyStore/assignDeliveryPartner',
  async ({ orderId, deliveryPartnerId }, { rejectWithValue }) => {
    try {
      if (!deliveryPartnerId) return rejectWithValue({ message: 'deliveryPartnerId is required' });
      const { data } = await API.post(`${API_BASE}/orders/${orderId}/assign-delivery-partner`, { deliveryPartnerId });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.ASSIGN_DRIVER });
      return data.data.order;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.ASSIGN_DRIVER, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 10: exportOrder ─────────────────────────────────────────────────────
/**
 * GET /pharmacy-store/orders/:orderId/export
 * Uses findOrderPopulated → response: { success, data: { order } }
 * FIX: Payload is data.data (which contains { order }) — stored separately
 *      from currentOrder so it doesn't overwrite the live detail view.
 */
export const exportOrder = createAsyncThunk(
  'pharmacyStore/exportOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      if (!orderId) return rejectWithValue({ message: 'orderId is required' });
      const { data } = await API.get(`${API_BASE}/orders/${orderId}/export`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.EXPORT_ORDER });
      return data.data; // { order }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.EXPORT_ORDER, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 11: verifyPickup ────────────────────────────────────────────────────
/**
 * POST /pharmacy-store/orders/:orderId/pickup-verify
 * Body: { pickupConditionGood: bool (required), pickupConditionNotes?: string }
 * Router requires order.delivery.status === 'Pickup_Done'.
 * Refund routing (Wallet vs Original_Source) is handled server-side from
 * order.cancellation.selectedRefundMethod.
 * Response: { success, message, data: { order } }
 */
export const verifyPickup = createAsyncThunk(
  'pharmacyStore/verifyPickup',
  async ({ orderId, pickupConditionGood, pickupConditionNotes }, { rejectWithValue }) => {
    try {
      if (typeof pickupConditionGood !== 'boolean')
        return rejectWithValue({ message: 'pickupConditionGood must be a boolean' });

      const { data } = await API.post(`${API_BASE}/orders/${orderId}/pickup-verify`, {
        pickupConditionGood,
        pickupConditionNotes: pickupConditionNotes || '',
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.PICKUP_VERIFY });
      return data.data.order;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.PICKUP_VERIFY, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 12: fetchOrderInvoice ───────────────────────────────────────────────
/**
 * GET /pharmacy-store/orders/:orderId/invoice
 * Router responds with text/html (res.status(200).send(html)).
 * Must use responseType: 'text' to prevent Axios JSON-parsing.
 * Response: raw HTML string
 */
export const fetchOrderInvoice = createAsyncThunk(
  'pharmacyStore/fetchOrderInvoice',
  async (orderId, { rejectWithValue }) => {
    try {
      if (!orderId) return rejectWithValue({ message: 'orderId is required' });
      const { data } = await API.get(`${API_BASE}/orders/${orderId}/invoice`, { responseType: 'text' });
      return { orderId, html: data };
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_ORDER_INVOICE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 13: fetchOrderLabel ─────────────────────────────────────────────────
/**
 * GET /pharmacy-store/orders/:orderId/label
 * Router responds with text/html (res.status(200).send(html)).
 * Must use responseType: 'text'.
 * Response: raw HTML string
 */
export const fetchOrderLabel = createAsyncThunk(
  'pharmacyStore/fetchOrderLabel',
  async (orderId, { rejectWithValue }) => {
    try {
      if (!orderId) return rejectWithValue({ message: 'orderId is required' });
      const { data } = await API.get(`${API_BASE}/orders/${orderId}/label`, { responseType: 'text' });
      return { orderId, html: data };
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_ORDER_LABEL, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — MEDICINE & INVENTORY MANAGEMENT (Routes 14–21)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Route 14: fetchMedicines ──────────────────────────────────────────────────
/**
 * GET /pharmacy-store/medicines
 * Params: { search?, category?, lowStock?, expiringSoon?, page?, limit? }
 * Response: { success, data: { medicines, pagination } }
 */
export const fetchMedicines = createAsyncThunk(
  'pharmacyStore/fetchMedicines',
  async (params, { rejectWithValue }) => {
    try {
      const { page = 1, limit = 20, search, category, lowStock, expiringSoon } = params || {};
      const qs = buildQueryParams({ page, limit, search, category, lowStock, expiringSoon });
      const { data } = await API.get(`${API_BASE}/medicines${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_MEDICINES });
      return data.data; // { medicines, pagination }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_MEDICINES, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 15: addStock ────────────────────────────────────────────────────────
/**
 * POST /pharmacy-store/medicines/:medicineId/add-stock
 * Body: { stockQuantity (required, >0), batchNumber (required),
 *          expiryDate (required), pricePerUnit? }
 * isLowStock is computed server-side; never send it.
 * Response: { success, message, data: { medicine } }
 */
export const addStock = createAsyncThunk(
  'pharmacyStore/addStock',
  async ({ medicineId, stockQuantity, batchNumber, expiryDate, pricePerUnit }, { rejectWithValue }) => {
    try {
      if (!stockQuantity || stockQuantity <= 0)
        return rejectWithValue({ message: 'stockQuantity must be greater than 0' });
      if (!batchNumber) return rejectWithValue({ message: 'batchNumber is required' });
      if (!expiryDate)  return rejectWithValue({ message: 'expiryDate is required' });

      const { data } = await API.post(`${API_BASE}/medicines/${medicineId}/add-stock`, {
        stockQuantity,
        batchNumber,
        expiryDate,
        ...(pricePerUnit !== undefined && { pricePerUnit }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.ADD_STOCK });
      return data.data; // { medicine }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.ADD_STOCK, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 16: deductStock ─────────────────────────────────────────────────────
/**
 * PATCH /pharmacy-store/medicines/:medicineId/deduct-stock
 * Body: { quantity (required, >0), batchNumber?, reason? }
 * Response: { success, message, data: { medicine } }
 */
export const deductStock = createAsyncThunk(
  'pharmacyStore/deductStock',
  async ({ medicineId, quantity, batchNumber, reason }, { rejectWithValue }) => {
    try {
      if (!quantity || quantity <= 0)
        return rejectWithValue({ message: 'quantity must be greater than 0' });
      const { data } = await API.patch(`${API_BASE}/medicines/${medicineId}/deduct-stock`, {
        quantity,
        ...(batchNumber && { batchNumber }),
        ...(reason      && { reason }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.DEDUCT_STOCK });
      return data.data; // { medicine }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.DEDUCT_STOCK, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 17: fetchMedicineStock ──────────────────────────────────────────────
/**
 * GET /pharmacy-store/medicines/:medicineId/stock
 * Response: { success, data: { medicineId, name, brandName, mrp,
 *             storeInventory, totalStock, isLowStock } }
 */
export const fetchMedicineStock = createAsyncThunk(
  'pharmacyStore/fetchMedicineStock',
  async (medicineId, { rejectWithValue }) => {
    try {
      if (!medicineId) return rejectWithValue({ message: 'medicineId is required' });
      const { data } = await API.get(`${API_BASE}/medicines/${medicineId}/stock`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_MEDICINE_STOCK });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_MEDICINE_STOCK, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 18: fetchInventoryBatches ───────────────────────────────────────────
/**
 * GET /pharmacy-store/inventory/batches
 * Params: { page?, limit? }
 * Response: { success, data: { batches, pagination } }
 */
export const fetchInventoryBatches = createAsyncThunk(
  'pharmacyStore/fetchInventoryBatches',
  async (params, { rejectWithValue }) => {
    try {
      const { page = 1, limit = 20 } = params || {};
      const qs = buildQueryParams({ page, limit });
      const { data } = await API.get(`${API_BASE}/inventory/batches${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_BATCHES });
      return data.data; // { batches, pagination }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_BATCHES, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 19: fetchExpiryAlerts ───────────────────────────────────────────────
/**
 * GET /pharmacy-store/inventory/expiry-alerts
 * Params: { days?, sendEmail? }
 * Response: { success, data: { expiringMedicines, count, alertDays } }
 */
export const fetchExpiryAlerts = createAsyncThunk(
  'pharmacyStore/fetchExpiryAlerts',
  async (params, { rejectWithValue }) => {
    try {
      const { days, sendEmail } = params || {};
      const qs = buildQueryParams({ days, sendEmail });
      const { data } = await API.get(`${API_BASE}/inventory/expiry-alerts${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_EXPIRY_ALERTS });
      return data.data; // { expiringMedicines, count, alertDays }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_EXPIRY_ALERTS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 20: fetchLowStock ───────────────────────────────────────────────────
/**
 * GET /pharmacy-store/inventory/low-stock
 * Params: { threshold?, sendEmail? }
 * Response: { success, data: { lowStockItems, count, threshold } }
 */
export const fetchLowStock = createAsyncThunk(
  'pharmacyStore/fetchLowStock',
  async (params, { rejectWithValue }) => {
    try {
      const { threshold, sendEmail } = params || {};
      const qs = buildQueryParams({ threshold, sendEmail });
      const { data } = await API.get(`${API_BASE}/inventory/low-stock${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_LOW_STOCK });
      return data.data; // { lowStockItems, count, threshold }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_LOW_STOCK, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 21: requestStock ────────────────────────────────────────────────────
/**
 * POST /pharmacy-store/medicines/:medicineId/request-stock
 * Body: { requiredQuantity (required, >0), urgency?: 'Low'|'Medium'|'High'|'Critical' }
 * Response: { success, message, data: { medicineId, medicineName, requiredQuantity, urgency } }
 */
export const requestStock = createAsyncThunk(
  'pharmacyStore/requestStock',
  async ({ medicineId, requiredQuantity, urgency = 'Medium' }, { rejectWithValue }) => {
    try {
      const validUrgencies = ['Low', 'Medium', 'High', 'Critical'];
      if (!requiredQuantity || requiredQuantity <= 0)
        return rejectWithValue({ message: 'requiredQuantity must be greater than 0' });
      if (!validUrgencies.includes(urgency))
        return rejectWithValue({ message: `urgency must be one of: ${validUrgencies.join(', ')}` });

      const { data } = await API.post(`${API_BASE}/medicines/${medicineId}/request-stock`, {
        requiredQuantity,
        urgency,
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.REQUEST_STOCK });
      return data.data; // { medicineId, medicineName, requiredQuantity, urgency }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.REQUEST_STOCK, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — HSN CODE MANAGEMENT
// Router order matters: /hsn/stats and /hsn/bulk-delete are declared BEFORE
// /hsn/:code so they are not swallowed by the param route.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Route H1: fetchHsnCodes ───────────────────────────────────────────────────
/**
 * GET /pharmacy-store/hsn
 * Params: { search?, gst?, isActive? (default:'true'), page?, limit?, sort? }
 * Router sort options: 'hsnCode'(default)|'hsnCode_desc'|'gst_asc'|'newest'
 * Response: { success, total, metadata: { currentPage, totalPages, pageSize }, data: codes[] }
 * FIX: Return shape is NOT data.data — the router puts codes in data.data
 *      but total and metadata are siblings of data at the top level.
 */
export const fetchHsnCodes = createAsyncThunk(
  'pharmacyStore/fetchHsnCodes',
  async (params, { rejectWithValue }) => {
    try {
      const { search, gst, isActive, page = 1, limit = 20, sort = 'hsnCode' } = params || {};
      const qs = buildQueryParams({ search, gst, isActive, page, limit, sort });
      const { data } = await API.get(`${API_BASE}/hsn${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_HSN_CODES });
      // data = { success, total, metadata, data: codes[] }
      return data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_HSN_CODES, details: extractErrorMessage(err) });
    }
  },
);

// ── Route H2: fetchHsnStats ───────────────────────────────────────────────────
/**
 * GET /pharmacy-store/hsn/stats
 * @access Admin, SuperAdmin only
 * Response: { success, data: { gstDistribution, sourceBreakdown,
 *             activeVsInactive, totals }, generatedAt }
 */
export const fetchHsnStats = createAsyncThunk(
  'pharmacyStore/fetchHsnStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/hsn/stats`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_HSN_STATS });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_HSN_STATS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route H3: hsnBulkDelete ───────────────────────────────────────────────────
/**
 * POST /pharmacy-store/hsn/bulk-delete
 * Body: { codes: string[] } — soft-deactivates (isActive: false)
 * @access SuperAdmin only
 * Response: { success, message, matched, deactivated }
 */
export const hsnBulkDelete = createAsyncThunk(
  'pharmacyStore/hsnBulkDelete',
  async (codes, { rejectWithValue }) => {
    try {
      if (!Array.isArray(codes) || !codes.length)
        return rejectWithValue({ message: 'Provide a non-empty array of HSN codes' });
      const { data } = await API.post(`${API_BASE}/hsn/bulk-delete`, { codes });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.HSN_BULK_DELETE });
      return data; // { success, message, matched, deactivated }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.HSN_BULK_DELETE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route H4: uploadHsnFile ───────────────────────────────────────────────────
/**
 * POST /pharmacy-store/hsn/upload
 * Body: multipart/form-data, field name = "file" (Excel .xlsx/.xls/.csv or PDF)
 * Max size: 20 MB. Router uploads to ImageKit first, then parses rows.
 * @access Admin, SuperAdmin
 * Response (200 all good | 207 partial errors):
 *   { success, message, upload: { imagekitUrl, imagekitFileId, originalName, source },
 *     result: { inserted, updated, skipped, errors[] } }
 */
export const uploadHsnFile = createAsyncThunk(
  'pharmacyStore/uploadHsnFile',
  async (formData, { rejectWithValue }) => {
    try {
      if (!(formData instanceof FormData))
        return rejectWithValue({ message: 'formData must be a FormData instance' });
      const { data } = await API.post(`${API_BASE}/hsn/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.HSN_UPLOAD });
      return data; // { success, message, upload, result }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.HSN_UPLOAD, details: extractErrorMessage(err) });
    }
  },
);

// ── Route H5: fetchHsnCode ────────────────────────────────────────────────────
/**
 * GET /pharmacy-store/hsn/:code
 * code must be 4–8 digits (router validates this).
 * Response: { success, data: { _id, hsnCode, description, chapterHeading,
 *             gstPercentage, cgstPercentage, sgstPercentage, igstPercentage } }
 */
export const fetchHsnCode = createAsyncThunk(
  'pharmacyStore/fetchHsnCode',
  async (code, { rejectWithValue }) => {
    try {
      if (!code) return rejectWithValue({ message: 'HSN code is required' });
      const { data } = await API.get(`${API_BASE}/hsn/${code}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_HSN_CODE });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_HSN_CODE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route H6: createHsnCode ───────────────────────────────────────────────────
/**
 * POST /pharmacy-store/hsn
 * Body: { hsnCode (4–8 digits), description (required), gstPercentage (required,
 *          one of 0|5|12|18|28), chapterHeading? }
 * @access Admin, SuperAdmin
 * Response: { success, data: <HsnCode document> }
 */
export const createHsnCode = createAsyncThunk(
  'pharmacyStore/createHsnCode',
  async ({ hsnCode, description, gstPercentage, chapterHeading }, { rejectWithValue }) => {
    try {
      if (!hsnCode || !description || gstPercentage === undefined)
        return rejectWithValue({ message: 'hsnCode, description, and gstPercentage are required' });
      const { data } = await API.post(`${API_BASE}/hsn`, {
        hsnCode,
        description,
        gstPercentage,
        ...(chapterHeading && { chapterHeading }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.CREATE_HSN_CODE });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.CREATE_HSN_CODE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route H7: updateHsnCode ───────────────────────────────────────────────────
/**
 * PATCH /pharmacy-store/hsn/:code
 * Body: { description?, chapterHeading?, gstPercentage?, isActive? }
 * @access Admin, SuperAdmin
 * Response: { success, data: <updated HsnCode document> }
 */
export const updateHsnCode = createAsyncThunk(
  'pharmacyStore/updateHsnCode',
  async ({ code, description, chapterHeading, gstPercentage, isActive }, { rejectWithValue }) => {
    try {
      if (!code) return rejectWithValue({ message: 'HSN code is required' });
      const payload = {
        ...(description    !== undefined && { description }),
        ...(chapterHeading !== undefined && { chapterHeading }),
        ...(gstPercentage  !== undefined && { gstPercentage }),
        ...(isActive       !== undefined && { isActive }),
      };
      if (!Object.keys(payload).length)
        return rejectWithValue({ message: 'No valid fields to update' });

      const { data } = await API.patch(`${API_BASE}/hsn/${code}`, payload);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.UPDATE_HSN_CODE });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.UPDATE_HSN_CODE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route H8: deleteHsnCode ───────────────────────────────────────────────────
/**
 * DELETE /pharmacy-store/hsn/:code
 * Soft-delete only — sets isActive: false; returns 409 if already inactive.
 * @access SuperAdmin only
 * Response: { success, message }
 * FIX: Returns the code string so the reducer can optimistically update the list.
 */
export const deleteHsnCode = createAsyncThunk(
  'pharmacyStore/deleteHsnCode',
  async (code, { rejectWithValue }) => {
    try {
      if (!code) return rejectWithValue({ message: 'HSN code is required' });
      const { data } = await API.delete(`${API_BASE}/hsn/${code}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.DELETE_HSN_CODE });
      return code; // return deactivated code string for optimistic list update
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.DELETE_HSN_CODE, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — FINANCIAL REPORTS & EARNINGS (Routes 22–27)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Route 22: fetchDailyEarnings ──────────────────────────────────────────────
/**
 * GET /pharmacy-store/financials/daily
 * Params: { date? } — ISO date string e.g. '2024-12-01'; defaults to today
 * Response: { success, data: { date, totalOrders, grossRevenue, gstCollected,
 *             discounts, netRevenue, paidOrders, statusBreakdown } }
 */
export const fetchDailyEarnings = createAsyncThunk(
  'pharmacyStore/fetchDailyEarnings',
  async (params, { rejectWithValue }) => {
    try {
      const qs = buildQueryParams({ date: params?.date });
      const { data } = await API.get(`${API_BASE}/financials/daily${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_DAILY_EARNINGS });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_DAILY_EARNINGS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 23: fetchMonthlyEarnings ────────────────────────────────────────────
/**
 * GET /pharmacy-store/financials/monthly
 * Params: { month? } — format 'YYYY-MM'; defaults to current month
 * Response: { success, data: { month, grossRevenue, gstCollected, discounts,
 *             netRevenue, totalOrders, dailyBreakdown[] } }
 */
export const fetchMonthlyEarnings = createAsyncThunk(
  'pharmacyStore/fetchMonthlyEarnings',
  async (params, { rejectWithValue }) => {
    try {
      const qs = buildQueryParams({ month: params?.month });
      const { data } = await API.get(`${API_BASE}/financials/monthly${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_MONTHLY_EARNINGS });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_MONTHLY_EARNINGS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 24: fetchTotalEarnings ──────────────────────────────────────────────
/**
 * GET /pharmacy-store/financials/total
 * No params.
 * Response: { success, data: { grossRevenue, gstCollected, discounts, netRevenue,
 *             totalOrders, monthlyTrend[], topMedicines[] } }
 * Note: topMedicines here are aggregated by items.medicine (not medicineId).
 */
export const fetchTotalEarnings = createAsyncThunk(
  'pharmacyStore/fetchTotalEarnings',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/financials/total`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_TOTAL_EARNINGS });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_TOTAL_EARNINGS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 25: fetchEarningsHistory ────────────────────────────────────────────
/**
 * GET /pharmacy-store/financials/history
 * Params: { dateFilter? (default:'last30days'), startDate?, endDate?,
 *           paymentMethod?, page?, limit? }
 * Response: { success, data: { orders[], summary: { totalRevenue, totalGst,
 *             totalDiscount }, pagination } }
 */
export const fetchEarningsHistory = createAsyncThunk(
  'pharmacyStore/fetchEarningsHistory',
  async (params, { rejectWithValue }) => {
    try {
      const {
        dateFilter = 'last30days', startDate, endDate,
        paymentMethod, page = 1, limit = 20,
      } = params || {};
      const qs = buildQueryParams({ dateFilter, startDate, endDate, paymentMethod, page, limit });
      const { data } = await API.get(`${API_BASE}/financials/history${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_EARNINGS_HISTORY });
      return data.data; // { orders, summary, pagination }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_EARNINGS_HISTORY, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 26: fetchStoreInvoice ───────────────────────────────────────────────
/**
 * GET /pharmacy-store/financials/store-invoice
 * Params: { dateFilter? (default:'last30days'), startDate?, endDate? }
 * Router responds with text/html (res.status(200).send(html)).
 * Must use responseType: 'text'.
 */
export const fetchStoreInvoice = createAsyncThunk(
  'pharmacyStore/fetchStoreInvoice',
  async (params, { rejectWithValue }) => {
    try {
      const { dateFilter = 'last30days', startDate, endDate } = params || {};
      const qs = buildQueryParams({ dateFilter, startDate, endDate });
      const { data } = await API.get(`${API_BASE}/financials/store-invoice${qs}`, { responseType: 'text' });
      return { html: data };
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_STORE_INVOICE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 27: sendStoreInvoice ────────────────────────────────────────────────
/**
 * POST /pharmacy-store/financials/store-invoice/send
 * Body: { dateFilter? (default:'last30days'), startDate?, endDate?, recipientEmail? }
 * Router falls back to req.user email if recipientEmail is not provided.
 * Response: { success, message }
 */
export const sendStoreInvoice = createAsyncThunk(
  'pharmacyStore/sendStoreInvoice',
  async ({ dateFilter = 'last30days', startDate, endDate, recipientEmail } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${API_BASE}/financials/store-invoice/send`, {
        dateFilter,
        ...(startDate      && { startDate }),
        ...(endDate        && { endDate }),
        ...(recipientEmail && { recipientEmail }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.SEND_STORE_INVOICE });
      return data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.SEND_STORE_INVOICE, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — BANK SETTLEMENTS & PAYMENT ACCOUNTS (Routes 28–36)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Route 28: fetchPaymentAccount ─────────────────────────────────────────────
/**
 * GET /pharmacy-store/financials/payment-account
 * Router creates a new PaymentAccount if none exists.
 * Response: { success, data: { account } }
 */
export const fetchPaymentAccount = createAsyncThunk(
  'pharmacyStore/fetchPaymentAccount',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/financials/payment-account`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_PAYMENT_ACCOUNT });
      return data.data.account;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_PAYMENT_ACCOUNT, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 29: addBankAccount ──────────────────────────────────────────────────
/**
 * POST /pharmacy-store/financials/payment-account/bank
 * Body: { accountHolderName (req), accountNumber (req), ifscCode (req),
 *          bankName?, branchName?, accountType? (default:'Current'),
 *          isPrimary?, cancelledChequeUrl? }
 * Response: { success, message, data: { account } }
 */
export const addBankAccount = createAsyncThunk(
  'pharmacyStore/addBankAccount',
  async (payload, { rejectWithValue }) => {
    try {
      const { accountHolderName, accountNumber, ifscCode } = payload;
      if (!accountHolderName || !accountNumber || !ifscCode)
        return rejectWithValue({ message: 'accountHolderName, accountNumber, and ifscCode are required' });

      const { data } = await API.post(`${API_BASE}/financials/payment-account/bank`, payload);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.ADD_BANK_ACCOUNT });
      return data.data.account;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.ADD_BANK_ACCOUNT, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 30: updateBankAccount ───────────────────────────────────────────────
/**
 * PATCH /pharmacy-store/financials/payment-account/bank/:bankId
 * Body: { accountHolderName?, ifscCode?, bankName?, branchName?,
 *          accountType?, isPrimary?, cancelledChequeUrl? }
 * Note: accountNumber is NOT updatable (not in router's patch handler).
 * Response: { success, message, data: { account } }
 */
export const updateBankAccount = createAsyncThunk(
  'pharmacyStore/updateBankAccount',
  async ({ bankId, ...payload }, { rejectWithValue }) => {
    try {
      if (!bankId) return rejectWithValue({ message: 'bankId is required' });
      const { data } = await API.patch(`${API_BASE}/financials/payment-account/bank/${bankId}`, payload);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.UPDATE_BANK_ACCOUNT });
      return data.data.account;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.UPDATE_BANK_ACCOUNT, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 31: deleteBankAccount ───────────────────────────────────────────────
/**
 * DELETE /pharmacy-store/financials/payment-account/bank/:bankId
 * Response: { success, message }
 */
export const deleteBankAccount = createAsyncThunk(
  'pharmacyStore/deleteBankAccount',
  async (bankId, { rejectWithValue }) => {
    try {
      if (!bankId) return rejectWithValue({ message: 'bankId is required' });
      const { data } = await API.delete(`${API_BASE}/financials/payment-account/bank/${bankId}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.DELETE_BANK_ACCOUNT });
      return bankId;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.DELETE_BANK_ACCOUNT, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 32: addUpiHandle ────────────────────────────────────────────────────
/**
 * POST /pharmacy-store/financials/payment-account/upi
 * Body: { upiId (required), upiName?, isPrimary? }
 * Response: { success, message, data: { account } }
 */
export const addUpiHandle = createAsyncThunk(
  'pharmacyStore/addUpiHandle',
  async ({ upiId, upiName, isPrimary }, { rejectWithValue }) => {
    try {
      if (!upiId) return rejectWithValue({ message: 'upiId is required' });
      const { data } = await API.post(`${API_BASE}/financials/payment-account/upi`, {
        upiId,
        ...(upiName                        && { upiName }),
        ...(typeof isPrimary === 'boolean' && { isPrimary }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.ADD_UPI });
      return data.data.account;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.ADD_UPI, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 33: deleteUpiHandle ─────────────────────────────────────────────────
/**
 * DELETE /pharmacy-store/financials/payment-account/upi/:upiId
 * Note: :upiId here is the MongoDB _id of the upiHandle subdocument,
 *       NOT the UPI string like 'user@upi'. The router uses account.upiHandles.pull({ _id: req.params.upiId }).
 * Response: { success, message }
 */
export const deleteUpiHandle = createAsyncThunk(
  'pharmacyStore/deleteUpiHandle',
  async (upiHandleId, { rejectWithValue }) => {
    try {
      if (!upiHandleId) return rejectWithValue({ message: 'upiHandleId (_id) is required' });
      const { data } = await API.delete(`${API_BASE}/financials/payment-account/upi/${upiHandleId}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.DELETE_UPI });
      return upiHandleId; // the MongoDB _id of the removed subdoc
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.DELETE_UPI, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 34: fetchSettlements ────────────────────────────────────────────────
/**
 * GET /pharmacy-store/financials/settlements
 * Response: { success, data: { pendingBalance, totalEarned, totalSettled,
 *             totalDeductions, preferredPayoutMethod, payoutCycle,
 *             primaryBank, primaryUpi, settlementHistory[] (last 20) } }
 */
export const fetchSettlements = createAsyncThunk(
  'pharmacyStore/fetchSettlements',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/financials/settlements`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_SETTLEMENTS });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_SETTLEMENTS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 35: requestSettlement ───────────────────────────────────────────────
/**
 * POST /pharmacy-store/financials/settlements/request
 * Body: { amount (required, >0, ≤ pendingBalance), method?, note? }
 * Router subtracts from pendingBalance and pushes to settlementHistory.
 * Response: { success, message, data: { pendingBalance, totalSettled } }
 */
export const requestSettlement = createAsyncThunk(
  'pharmacyStore/requestSettlement',
  async ({ amount, method, note }, { rejectWithValue }) => {
    try {
      if (!amount || amount <= 0)
        return rejectWithValue({ message: 'Valid amount required' });
      const { data } = await API.post(`${API_BASE}/financials/settlements/request`, {
        amount,
        ...(method && { method }),
        ...(note   && { note }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.REQUEST_SETTLEMENT });
      return data.data; // { pendingBalance, totalSettled }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.REQUEST_SETTLEMENT, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 36: fetchSettlementHistory ──────────────────────────────────────────
/**
 * GET /pharmacy-store/financials/settlements/history
 * Params: { page?, limit? }
 * Router reverses the array and slices in-memory (not DB-level pagination).
 * Response: { success, data: { history[], pagination } }
 */
export const fetchSettlementHistory = createAsyncThunk(
  'pharmacyStore/fetchSettlementHistory',
  async (params, { rejectWithValue }) => {
    try {
      const { page = 1, limit = 20 } = params || {};
      const qs = buildQueryParams({ page, limit });
      const { data } = await API.get(`${API_BASE}/financials/settlements/history${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_SETTLEMENT_HISTORY });
      return data.data; // { history, pagination }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_SETTLEMENT_HISTORY, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — ANALYTICS (Routes 37–40)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Route 37: fetchAnalyticsOverview ──────────────────────────────────────────
/**
 * GET /pharmacy-store/analytics/overview
 * Params: { dateFilter? (default:'today') }
 * Note: Router only reads dateFilter; startDate/endDate are NOT forwarded
 *       to parseDateFilter in the analytics/overview route.
 * Response: { success, data: { totalOrders, totalRevenue, gstCollected,
 *             statusBreakdown } }
 */
export const fetchAnalyticsOverview = createAsyncThunk(
  'pharmacyStore/fetchAnalyticsOverview',
  async (params, { rejectWithValue }) => {
    try {
      const { dateFilter = 'today' } = params || {};
      const qs = buildQueryParams({ dateFilter });
      const { data } = await API.get(`${API_BASE}/analytics/overview${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_ANALYTICS_OVERVIEW });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_ANALYTICS_OVERVIEW, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 38: fetchRevenueAnalytics ───────────────────────────────────────────
/**
 * GET /pharmacy-store/analytics/revenue
 * Params: { dateFilter? (default:'last30days') }
 * Note: Router only reads dateFilter for revenue analytics.
 * Response: { success, data: { revenueByDay[] } }
 */
export const fetchRevenueAnalytics = createAsyncThunk(
  'pharmacyStore/fetchRevenueAnalytics',
  async (params, { rejectWithValue }) => {
    try {
      const { dateFilter = 'last30days' } = params || {};
      const qs = buildQueryParams({ dateFilter });
      const { data } = await API.get(`${API_BASE}/analytics/revenue${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_ANALYTICS_REVENUE });
      return data.data; // { revenueByDay }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_ANALYTICS_REVENUE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 39: fetchReturnAnalytics ────────────────────────────────────────────
/**
 * GET /pharmacy-store/analytics/returns
 * Params: { dateFilter? (default:'last30days') }
 * Response: { success, data: { returnMetrics[] } }
 */
export const fetchReturnAnalytics = createAsyncThunk(
  'pharmacyStore/fetchReturnAnalytics',
  async (params, { rejectWithValue }) => {
    try {
      const { dateFilter = 'last30days' } = params || {};
      const qs = buildQueryParams({ dateFilter });
      const { data } = await API.get(`${API_BASE}/analytics/returns${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_ANALYTICS_RETURNS });
      return data.data; // { returnMetrics }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_ANALYTICS_RETURNS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 40: fetchTopMedicines ───────────────────────────────────────────────
/**
 * GET /pharmacy-store/analytics/top-medicines
 * Params: { dateFilter? (default:'last30days'), limit? (default:10) }
 * Router groups by items.medicine (not items.medicineId — fixed in router).
 * Response: { success, data: { topMedicines[] } }
 */
export const fetchTopMedicines = createAsyncThunk(
  'pharmacyStore/fetchTopMedicines',
  async (params, { rejectWithValue }) => {
    try {
      const { dateFilter = 'last30days', limit = 10 } = params || {};
      const qs = buildQueryParams({ dateFilter, limit });
      const { data } = await API.get(`${API_BASE}/analytics/top-medicines${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_TOP_MEDICINES });
      return data.data; // { topMedicines }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_TOP_MEDICINES, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — PROFILE & STORE (Routes 41–48)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Route 41: fetchProfile ────────────────────────────────────────────────────
/**
 * GET /pharmacy-store/profile
 * Response: { success, data: { user } }  (password field excluded by router)
 */
export const fetchProfile = createAsyncThunk(
  'pharmacyStore/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/profile`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_PROFILE });
      return data.data.user;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_PROFILE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 42: updateUserProfile ───────────────────────────────────────────────
/**
 * PUT /pharmacy-store/profile
 * Body: { name?, phone?, avatar? }
 * Response: { success, message, data: { user } }
 */
export const updateUserProfile = createAsyncThunk(
  'pharmacyStore/updateUserProfile',
  async ({ name, phone, avatar }, { rejectWithValue }) => {
    try {
      const payload = {
        ...(name   && { name }),
        ...(phone  && { phone }),
        ...(avatar && { avatar }),
      };
      if (!Object.keys(payload).length)
        return rejectWithValue({ message: 'No valid fields to update' });

      const { data } = await API.put(`${API_BASE}/profile`, payload);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.UPDATE_PROFILE });
      return data.data.user;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.UPDATE_PROFILE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 43: changePassword ──────────────────────────────────────────────────
/**
 * PUT /pharmacy-store/profile/password
 * Body: { currentPassword (req), newPassword (req, ≥8 chars), confirmPassword (req) }
 * Router validates match and length server-side too.
 * Response: { success, message }
 */
export const changePassword = createAsyncThunk(
  'pharmacyStore/changePassword',
  async ({ currentPassword, newPassword, confirmPassword }, { rejectWithValue }) => {
    try {
      if (!currentPassword || !newPassword || !confirmPassword)
        return rejectWithValue({ message: 'All password fields are required' });
      if (newPassword !== confirmPassword)
        return rejectWithValue({ message: 'New passwords do not match' });
      if (newPassword.length < 8)
        return rejectWithValue({ message: 'Password must be at least 8 characters' });

      const { data } = await API.put(`${API_BASE}/profile/password`, {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.CHANGE_PASSWORD });
      return true;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.CHANGE_PASSWORD, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 44: fetchPharmacyProfile ────────────────────────────────────────────
/**
 * GET /pharmacy-store/profile/pharmacy
 * Response: { success, data: { pharmacyProfile } }
 * Router populates 'assignedStore'.
 */
export const fetchPharmacyProfile = createAsyncThunk(
  'pharmacyStore/fetchPharmacyProfile',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/profile/pharmacy`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_PHARMACY_PROFILE });
      return data.data.pharmacyProfile;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_PHARMACY_PROFILE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 45: updatePharmacyProfile ──────────────────────────────────────────
/**
 * PUT /pharmacy-store/profile/pharmacy
 * Body: { experienceYears?: number, qualification?: string }
 * Router only accepts these two fields.
 * Response: { success, message, data: { pharmacyProfile } }
 */
export const updatePharmacyProfile = createAsyncThunk(
  'pharmacyStore/updatePharmacyProfile',
  async ({ experienceYears, qualification }, { rejectWithValue }) => {
    try {
      const payload = {
        ...(typeof experienceYears === 'number' && { experienceYears }),
        ...(qualification && { qualification }),
      };
      if (!Object.keys(payload).length)
        return rejectWithValue({ message: 'No valid fields to update' });

      const { data } = await API.put(`${API_BASE}/profile/pharmacy`, payload);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.UPDATE_PHARMACY_PROFILE });
      return data.data.pharmacyProfile;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.UPDATE_PHARMACY_PROFILE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 46: fetchStore ──────────────────────────────────────────────────────
/**
 * GET /pharmacy-store/store
 * Response: { success, data: { store } }  (returns req.pharmacy.store)
 */
export const fetchStore = createAsyncThunk(
  'pharmacyStore/fetchStore',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/store`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_STORE });
      return data.data.store;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_STORE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 47: updateStore ─────────────────────────────────────────────────────
/**
 * PUT /pharmacy-store/store
 * Body: { deliveryRadiusKm?: number, estimatedDeliveryTime?: string,
 *          timings?, status? }
 * Router maps to nested paths: 'deliverySettings.deliveryRadiusKm',
 * 'deliverySettings.estimatedDeliveryTime'.
 * Response: { success, message, data: { store } }
 */
export const updateStore = createAsyncThunk(
  'pharmacyStore/updateStore',
  async ({ deliveryRadiusKm, estimatedDeliveryTime, timings, status }, { rejectWithValue }) => {
    try {
      const payload = {
        ...(typeof deliveryRadiusKm === 'number' && { deliveryRadiusKm }),
        ...(estimatedDeliveryTime && { estimatedDeliveryTime }),
        ...(timings && { timings }),
        ...(status  && { status }),
      };
      if (!Object.keys(payload).length)
        return rejectWithValue({ message: 'No valid fields to update' });

      const { data } = await API.put(`${API_BASE}/store`, payload);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.UPDATE_STORE });
      return data.data.store;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.UPDATE_STORE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 48: fetchInventorySummary ───────────────────────────────────────────
/**
 * GET /pharmacy-store/store/inventory-summary
 * Response: { success, data: { totalSKUs, totalUnits, lowStockCount,
 *             expiringSoonCount, lowStockThreshold, expiryAlertDays } }
 */
export const fetchInventorySummary = createAsyncThunk(
  'pharmacyStore/fetchInventorySummary',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/store/inventory-summary`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_INVENTORY_SUMMARY });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_INVENTORY_SUMMARY, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — AUDIT: SESSIONS & DEVICES (Routes 49–54)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Route 49: fetchSessions ───────────────────────────────────────────────────
/**
 * GET /pharmacy-store/audit/sessions
 * Response: { success, data: { sessions } }
 */
export const fetchSessions = createAsyncThunk(
  'pharmacyStore/fetchSessions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/audit/sessions`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_SESSIONS });
      return data.data; // { sessions }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_SESSIONS, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 50: revokeSession ───────────────────────────────────────────────────
/**
 * DELETE /pharmacy-store/audit/sessions/:sessionId
 * Response: { success, message }
 */
export const revokeSession = createAsyncThunk(
  'pharmacyStore/revokeSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      if (!sessionId) return rejectWithValue({ message: 'sessionId is required' });
      const { data } = await API.delete(`${API_BASE}/audit/sessions/${sessionId}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.REVOKE_SESSION });
      return sessionId;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.REVOKE_SESSION, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 51: logoutAllDevices ────────────────────────────────────────────────
/**
 * DELETE /pharmacy-store/audit/all-sessions
 * Clears auditSessions array on the User document.
 * Response: { success, message }
 */
export const logoutAllDevices = createAsyncThunk(
  'pharmacyStore/logoutAllDevices',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`${API_BASE}/audit/all-sessions`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.LOGOUT_ALL });
      return true;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.LOGOUT_ALL, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 52: fetchDevices ────────────────────────────────────────────────────
/**
 * GET /pharmacy-store/audit/devices
 * Response: { success, data: { devices } }
 */
export const fetchDevices = createAsyncThunk(
  'pharmacyStore/fetchDevices',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/audit/devices`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_DEVICES });
      return data.data; // { devices }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_DEVICES, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 53: removeDevice ────────────────────────────────────────────────────
/**
 * DELETE /pharmacy-store/audit/devices/:deviceId
 * Response: { success, message }
 */
export const removeDevice = createAsyncThunk(
  'pharmacyStore/removeDevice',
  async (deviceId, { rejectWithValue }) => {
    try {
      if (!deviceId) return rejectWithValue({ message: 'deviceId is required' });
      const { data } = await API.delete(`${API_BASE}/audit/devices/${deviceId}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.REMOVE_DEVICE });
      return deviceId;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.REMOVE_DEVICE, details: extractErrorMessage(err) });
    }
  },
);

// ── Route 54: removeAllDevices ────────────────────────────────────────────────
/**
 * DELETE /pharmacy-store/audit/devices
 * Clears deviceTokens array on the User document.
 * Response: { success, message }
 */
export const removeAllDevices = createAsyncThunk(
  'pharmacyStore/removeAllDevices',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`${API_BASE}/audit/devices`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.REMOVE_ALL_DEVICES });
      return true;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.REMOVE_ALL_DEVICES, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_PAGINATION = { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 20 };

const initialState = {
  // ── Orders ──────────────────────────────────────────────────────────────────
  orders:                   [],
  ordersPagination:         { ...DEFAULT_PAGINATION },
  currentOrder:             null,
  /** Exported order payload — kept separate from currentOrder detail. */
  exportedOrder:            null,
  currentOrderInvoiceHtml:  null,
  currentOrderLabelHtml:    null,

  // ── Medicines & Inventory ──────────────────────────────────────────────────
  medicines:            [],
  medicinesPagination:  { ...DEFAULT_PAGINATION },
  /** Single-medicine stock detail (fetchMedicineStock). */
  medicineStockDetail:  null,
  inventoryBatches:     [],
  batchesPagination:    { ...DEFAULT_PAGINATION },
  expiryAlerts:         [],
  expiryAlertsMeta:     { count: 0, alertDays: 30 },
  lowStockItems:        [],
  lowStockMeta:         { count: 0, threshold: 5 },
  /** Dashboard summary card (fetchInventorySummary). */
  inventorySummary:     null,

  // ── HSN Codes ──────────────────────────────────────────────────────────────
  hsnCodes:             [],
  hsnCodesPagination:   { ...DEFAULT_PAGINATION },
  hsnCodesTotal:        0,
  hsnStats:             null,
  /** Single HSN code detail (fetchHsnCode). */
  currentHsnCode:       null,

  // ── Financials ─────────────────────────────────────────────────────────────
  dailyEarnings:              null,
  monthlyEarnings:            null,
  totalEarnings:              null,
  earningsHistory:            [],
  earningsHistoryPagination:  { ...DEFAULT_PAGINATION },
  earningsHistorySummary:     null,
  storeInvoiceHtml:           null,

  // ── Payment Accounts ────────────────────────────────────────────────────────
  paymentAccount: null,

  // ── Settlements ─────────────────────────────────────────────────────────────
  settlements:                 null,
  settlementHistory:           [],
  settlementHistoryPagination: { ...DEFAULT_PAGINATION },

  // ── Analytics ──────────────────────────────────────────────────────────────
  analyticsOverview: null,
  revenueAnalytics:  null,
  returnAnalytics:   null,
  topMedicines:      [],

  // ── Profile ────────────────────────────────────────────────────────────────
  userProfile:     null,
  pharmacyProfile: null,

  // ── Store ───────────────────────────────────────────────────────────────────
  store: null,

  // ── Audit & Security ────────────────────────────────────────────────────────
  sessions: [],
  devices:  [],

  // ── Loading flags ───────────────────────────────────────────────────────────
  loading: {
    orders:            false,
    orderDetails:      false,
    prescription:      false,
    orderConfirm:      false,
    orderStatus:       false,
    returnAccept:      false,
    pickupVerify:      false,
    refund:            false,
    orderNote:         false,
    driverAssign:      false,
    orderExport:       false,
    orderInvoice:      false,
    orderLabel:        false,
    medicines:         false,
    medicineStock:     false,
    addStock:          false,
    deductStock:       false,
    inventoryBatches:  false,
    expiryAlerts:      false,
    lowStock:          false,
    requestStock:      false,
    inventorySummary:  false,
    hsnCodes:          false,
    hsnStats:          false,
    hsnCode:           false,
    hsnCreate:         false,
    hsnUpdate:         false,
    hsnDelete:         false,
    hsnBulkDelete:     false,
    hsnUpload:         false,
    dailyEarnings:     false,
    monthlyEarnings:   false,
    totalEarnings:     false,
    earningsHistory:   false,
    storeInvoice:      false,
    sendStoreInvoice:  false,
    paymentAccount:    false,
    bankAccount:       false,
    upiHandle:         false,
    settlements:          false,
    settlementRequest:    false,
    settlementHistory:    false,
    analyticsOverview:  false,
    analyticsRevenue:   false,
    analyticsReturns:   false,
    topMedicines:       false,
    profile:         false,
    pharmacyProfile: false,
    store:           false,
    sessions: false,
    devices:  false,
  },

  // ── Errors ──────────────────────────────────────────────────────────────────
  errors: {
    orders:            null,
    orderDetails:      null,
    prescription:      null,
    orderConfirm:      null,
    orderStatus:       null,
    returnAccept:      null,
    pickupVerify:      null,
    refund:            null,
    orderNote:         null,
    driverAssign:      null,
    orderExport:       null,
    orderInvoice:      null,
    orderLabel:        null,
    medicines:         null,
    medicineStock:     null,
    addStock:          null,
    deductStock:       null,
    inventoryBatches:  null,
    expiryAlerts:      null,
    lowStock:          null,
    requestStock:      null,
    inventorySummary:  null,
    hsnCodes:          null,
    hsnStats:          null,
    hsnCode:           null,
    hsnCreate:         null,
    hsnUpdate:         null,
    hsnDelete:         null,
    hsnBulkDelete:     null,
    hsnUpload:         null,
    dailyEarnings:     null,
    monthlyEarnings:   null,
    totalEarnings:     null,
    earningsHistory:   null,
    storeInvoice:      null,
    sendStoreInvoice:  null,
    paymentAccount:    null,
    bankAccount:       null,
    upiHandle:         null,
    settlements:          null,
    settlementRequest:    null,
    settlementHistory:    null,
    analyticsOverview:  null,
    analyticsRevenue:   null,
    analyticsReturns:   null,
    topMedicines:       null,
    profile:         null,
    pharmacyProfile: null,
    store:           null,
    sessions: null,
    devices:  null,
  },

  // ── One-shot success flags ───────────────────────────────────────────────────
  success: {
    prescription:              false,
    orderConfirm:              false,
    orderStatus:               false,
    returnAccept:              false,
    pickupVerify:              false,
    refund:                    false,
    orderNote:                 false,
    driverAssign:              false,
    addStock:                  false,
    deductStock:               false,
    requestStock:              false,
    sendStoreInvoice:          false,
    addBankAccount:            false,
    updateBankAccount:         false,
    deleteBankAccount:         false,
    addUpiHandle:              false,
    deleteUpiHandle:           false,
    settlementRequest:         false,
    profileUpdate:             false,
    pharmacyProfileUpdate:     false,
    passwordChange:            false,
    storeUpdate:               false,
    sessionRevoke:             false,
    logoutAll:                 false,
    deviceRemove:              false,
    allDevicesRemoved:         false,
    hsnCreate:                 false,
    hsnUpdate:                 false,
    hsnDelete:                 false,
    hsnBulkDelete:             false,
    hsnUpload:                 false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const pharmacyStoreSlice = createSlice({
  name: 'pharmacyStore',
  initialState,

  reducers: {
    /** Clear a single error field. payload: keyof errors */
    clearError: (state, { payload }) => {
      if (payload && payload in state.errors) state.errors[payload] = null;
    },

    /** Clear a single success flag. payload: keyof success */
    clearSuccess: (state, { payload }) => {
      if (payload && payload in state.success) state.success[payload] = false;
    },

    /** Clear every error field in one shot. */
    clearAllErrors: (state) => {
      Object.keys(state.errors).forEach((k) => { state.errors[k] = null; });
    },

    /** Clear every success flag in one shot. */
    clearAllSuccess: (state) => {
      Object.keys(state.success).forEach((k) => { state.success[k] = false; });
    },

    /** Hard-reset to initialState — call on logout. */
    resetPharmacyStore: () => initialState,

    /** Manually set the active order (e.g. from a navigation event). */
    setCurrentOrder: (state, { payload }) => {
      state.currentOrder = payload;
    },

    /** Clear the active order and any HTML artefacts. */
    clearCurrentOrder: (state) => {
      state.currentOrder            = null;
      state.currentOrderInvoiceHtml = null;
      state.currentOrderLabelHtml   = null;
    },

    /** Clear rendered HTML invoices/labels (e.g. on modal close). */
    clearOrderDocuments: (state) => {
      state.currentOrderInvoiceHtml = null;
      state.currentOrderLabelHtml   = null;
    },

    /** Clear store invoice HTML (e.g. on modal close). */
    clearStoreInvoice: (state) => {
      state.storeInvoiceHtml = null;
    },

    /** Clear the currently viewed single HSN code. */
    clearCurrentHsnCode: (state) => {
      state.currentHsnCode = null;
    },

    /** Clear exported order data. */
    clearExportedOrder: (state) => {
      state.exportedOrder = null;
    },
  },

  extraReducers: (builder) => {

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ ORDERS (Routes 01–13)
    // ─────────────────────────────────────────────────────────────────────────

    // Route 01 — fetchOrders
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.loading.orders = true;
        state.errors.orders  = null;
      })
      .addCase(fetchOrders.fulfilled, (state, { payload }) => {
        state.loading.orders   = false;
        state.orders           = payload.orders     || [];
        state.ordersPagination = payload.pagination || initialState.ordersPagination;
      })
      .addCase(fetchOrders.rejected, (state, { payload }) => {
        state.loading.orders = false;
        state.errors.orders  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_ORDERS);
      });

    // Route 02 — fetchOrderDetails
    builder
      .addCase(fetchOrderDetails.pending, (state) => {
        state.loading.orderDetails = true;
        state.errors.orderDetails  = null;
      })
      .addCase(fetchOrderDetails.fulfilled, (state, { payload }) => {
        state.loading.orderDetails = false;
        state.currentOrder         = payload;
      })
      .addCase(fetchOrderDetails.rejected, (state, { payload }) => {
        state.loading.orderDetails = false;
        state.errors.orderDetails  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_ORDER_DETAILS);
      });

    // Route 03 — verifyPrescription
    builder
      .addCase(verifyPrescription.pending, (state) => {
        state.loading.prescription = true;
        state.errors.prescription  = null;
        state.success.prescription = false;
      })
      .addCase(verifyPrescription.fulfilled, (state, { payload }) => {
        state.loading.prescription = false;
        state.success.prescription = true;
        state.currentOrder         = payload;
        replaceOrderInList(state.orders, payload);
        toast.success('Prescription verified successfully');
      })
      .addCase(verifyPrescription.rejected, (state, { payload }) => {
        state.loading.prescription = false;
        state.errors.prescription  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.VERIFY_PRESCRIPTION);
      });

    // Route 04 — confirmOrder
    builder
      .addCase(confirmOrder.pending, (state) => {
        state.loading.orderConfirm = true;
        state.errors.orderConfirm  = null;
        state.success.orderConfirm = false;
      })
      .addCase(confirmOrder.fulfilled, (state, { payload }) => {
        state.loading.orderConfirm = false;
        state.success.orderConfirm = true;
        state.currentOrder         = payload;
        replaceOrderInList(state.orders, payload);
        toast.success('Order confirmed successfully');
      })
      .addCase(confirmOrder.rejected, (state, { payload }) => {
        state.loading.orderConfirm = false;
        state.errors.orderConfirm  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.CONFIRM_ORDER);
      });

    // Route 05 — updateOrderStatus
    builder
      .addCase(updateOrderStatus.pending, (state) => {
        state.loading.orderStatus = true;
        state.errors.orderStatus  = null;
        state.success.orderStatus = false;
      })
      .addCase(updateOrderStatus.fulfilled, (state, { payload }) => {
        state.loading.orderStatus = false;
        state.success.orderStatus = true;
        state.currentOrder        = payload;
        replaceOrderInList(state.orders, payload);
        toast.success(`Order status updated to ${payload?.delivery?.status || 'new status'}`);
      })
      .addCase(updateOrderStatus.rejected, (state, { payload }) => {
        state.loading.orderStatus = false;
        state.errors.orderStatus  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.UPDATE_ORDER_STATUS);
      });

    // Route 06 — acceptReturn
    builder
      .addCase(acceptReturn.pending, (state) => {
        state.loading.returnAccept = true;
        state.errors.returnAccept  = null;
        state.success.returnAccept = false;
      })
      .addCase(acceptReturn.fulfilled, (state, { payload }) => {
        state.loading.returnAccept = false;
        state.success.returnAccept = true;
        state.currentOrder         = payload;
        replaceOrderInList(state.orders, payload);
        toast.success('Return request accepted');
      })
      .addCase(acceptReturn.rejected, (state, { payload }) => {
        state.loading.returnAccept = false;
        state.errors.returnAccept  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.RETURN_ACCEPT);
      });

    // Route 07 — processRefund
    builder
      .addCase(processRefund.pending, (state) => {
        state.loading.refund = true;
        state.errors.refund  = null;
        state.success.refund = false;
      })
      .addCase(processRefund.fulfilled, (state, { payload }) => {
        state.loading.refund = false;
        state.success.refund = true;
        if (payload?.order) {
          state.currentOrder = payload.order;
          replaceOrderInList(state.orders, payload.order);
        }
        toast.success('Refund initiated successfully');
      })
      .addCase(processRefund.rejected, (state, { payload }) => {
        state.loading.refund = false;
        state.errors.refund  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.PROCESS_REFUND);
      });

    // Route 08 — addOrderNote
    builder
      .addCase(addOrderNote.pending, (state) => {
        state.loading.orderNote = true;
        state.errors.orderNote  = null;
        state.success.orderNote = false;
      })
      .addCase(addOrderNote.fulfilled, (state, { payload }) => {
        state.loading.orderNote = false;
        state.success.orderNote = true;
        state.currentOrder      = payload;
        replaceOrderInList(state.orders, payload);
        toast.success('Note added successfully');
      })
      .addCase(addOrderNote.rejected, (state, { payload }) => {
        state.loading.orderNote = false;
        state.errors.orderNote  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.ADD_NOTE);
      });

    // Route 09 — assignDeliveryPartner
    builder
      .addCase(assignDeliveryPartner.pending, (state) => {
        state.loading.driverAssign = true;
        state.errors.driverAssign  = null;
        state.success.driverAssign = false;
      })
      .addCase(assignDeliveryPartner.fulfilled, (state, { payload }) => {
        state.loading.driverAssign = false;
        state.success.driverAssign = true;
        state.currentOrder         = payload;
        replaceOrderInList(state.orders, payload);
        toast.success('Delivery partner assigned');
      })
      .addCase(assignDeliveryPartner.rejected, (state, { payload }) => {
        state.loading.driverAssign = false;
        state.errors.driverAssign  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.ASSIGN_DRIVER);
      });

    // Route 10 — exportOrder
    // FIX: payload is data.data = { order } — stored in exportedOrder, NOT
    //      currentOrder, so it does not clobber the live detail view.
    builder
      .addCase(exportOrder.pending, (state) => {
        state.loading.orderExport = true;
        state.errors.orderExport  = null;
      })
      .addCase(exportOrder.fulfilled, (state, { payload }) => {
        state.loading.orderExport = false;
        state.exportedOrder       = payload?.order || payload;
        toast.success('Order exported successfully');
      })
      .addCase(exportOrder.rejected, (state, { payload }) => {
        state.loading.orderExport = false;
        state.errors.orderExport  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.EXPORT_ORDER);
      });

    // Route 11 — verifyPickup
    builder
      .addCase(verifyPickup.pending, (state) => {
        state.loading.pickupVerify = true;
        state.errors.pickupVerify  = null;
        state.success.pickupVerify = false;
      })
      .addCase(verifyPickup.fulfilled, (state, { payload }) => {
        state.loading.pickupVerify = false;
        state.success.pickupVerify = true;
        state.currentOrder         = payload;
        replaceOrderInList(state.orders, payload);
        toast.success('Pickup verified successfully');
      })
      .addCase(verifyPickup.rejected, (state, { payload }) => {
        state.loading.pickupVerify = false;
        state.errors.pickupVerify  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.PICKUP_VERIFY);
      });

    // Route 12 — fetchOrderInvoice
    builder
      .addCase(fetchOrderInvoice.pending, (state) => {
        state.loading.orderInvoice = true;
        state.errors.orderInvoice  = null;
      })
      .addCase(fetchOrderInvoice.fulfilled, (state, { payload }) => {
        state.loading.orderInvoice    = false;
        state.currentOrderInvoiceHtml = payload.html;
      })
      .addCase(fetchOrderInvoice.rejected, (state, { payload }) => {
        state.loading.orderInvoice = false;
        state.errors.orderInvoice  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_ORDER_INVOICE);
      });

    // Route 13 — fetchOrderLabel
    builder
      .addCase(fetchOrderLabel.pending, (state) => {
        state.loading.orderLabel = true;
        state.errors.orderLabel  = null;
      })
      .addCase(fetchOrderLabel.fulfilled, (state, { payload }) => {
        state.loading.orderLabel    = false;
        state.currentOrderLabelHtml = payload.html;
      })
      .addCase(fetchOrderLabel.rejected, (state, { payload }) => {
        state.loading.orderLabel = false;
        state.errors.orderLabel  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_ORDER_LABEL);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ MEDICINE & INVENTORY (Routes 14–21)
    // ─────────────────────────────────────────────────────────────────────────

    // Route 14 — fetchMedicines
    builder
      .addCase(fetchMedicines.pending, (state) => {
        state.loading.medicines = true;
        state.errors.medicines  = null;
      })
      .addCase(fetchMedicines.fulfilled, (state, { payload }) => {
        state.loading.medicines    = false;
        state.medicines            = payload.medicines  || [];
        state.medicinesPagination  = payload.pagination || initialState.medicinesPagination;
      })
      .addCase(fetchMedicines.rejected, (state, { payload }) => {
        state.loading.medicines = false;
        state.errors.medicines  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_MEDICINES);
      });

    // Route 15 — addStock
    builder
      .addCase(addStock.pending, (state) => {
        state.loading.addStock = true;
        state.errors.addStock  = null;
        state.success.addStock = false;
      })
      .addCase(addStock.fulfilled, (state) => {
        state.loading.addStock = false;
        state.success.addStock = true;
        toast.success('Stock added successfully');
      })
      .addCase(addStock.rejected, (state, { payload }) => {
        state.loading.addStock = false;
        state.errors.addStock  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.ADD_STOCK);
      });

    // Route 16 — deductStock
    builder
      .addCase(deductStock.pending, (state) => {
        state.loading.deductStock = true;
        state.errors.deductStock  = null;
        state.success.deductStock = false;
      })
      .addCase(deductStock.fulfilled, (state) => {
        state.loading.deductStock = false;
        state.success.deductStock = true;
        toast.success('Stock deducted successfully');
      })
      .addCase(deductStock.rejected, (state, { payload }) => {
        state.loading.deductStock = false;
        state.errors.deductStock  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.DEDUCT_STOCK);
      });

    // Route 17 — fetchMedicineStock
    builder
      .addCase(fetchMedicineStock.pending, (state) => {
        state.loading.medicineStock = true;
        state.errors.medicineStock  = null;
      })
      .addCase(fetchMedicineStock.fulfilled, (state, { payload }) => {
        state.loading.medicineStock = false;
        state.medicineStockDetail   = payload;
      })
      .addCase(fetchMedicineStock.rejected, (state, { payload }) => {
        state.loading.medicineStock = false;
        state.errors.medicineStock  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_MEDICINE_STOCK);
      });

    // Route 18 — fetchInventoryBatches
    builder
      .addCase(fetchInventoryBatches.pending, (state) => {
        state.loading.inventoryBatches = true;
        state.errors.inventoryBatches  = null;
      })
      .addCase(fetchInventoryBatches.fulfilled, (state, { payload }) => {
        state.loading.inventoryBatches = false;
        state.inventoryBatches         = payload.batches    || [];
        state.batchesPagination        = payload.pagination || initialState.batchesPagination;
      })
      .addCase(fetchInventoryBatches.rejected, (state, { payload }) => {
        state.loading.inventoryBatches = false;
        state.errors.inventoryBatches  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_BATCHES);
      });

    // Route 19 — fetchExpiryAlerts
    builder
      .addCase(fetchExpiryAlerts.pending, (state) => {
        state.loading.expiryAlerts = true;
        state.errors.expiryAlerts  = null;
      })
      .addCase(fetchExpiryAlerts.fulfilled, (state, { payload }) => {
        state.loading.expiryAlerts = false;
        state.expiryAlerts         = payload.expiringMedicines || [];
        state.expiryAlertsMeta     = { count: payload.count || 0, alertDays: payload.alertDays || 30 };
      })
      .addCase(fetchExpiryAlerts.rejected, (state, { payload }) => {
        state.loading.expiryAlerts = false;
        state.errors.expiryAlerts  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_EXPIRY_ALERTS);
      });

    // Route 20 — fetchLowStock
    builder
      .addCase(fetchLowStock.pending, (state) => {
        state.loading.lowStock = true;
        state.errors.lowStock  = null;
      })
      .addCase(fetchLowStock.fulfilled, (state, { payload }) => {
        state.loading.lowStock = false;
        state.lowStockItems    = payload.lowStockItems || [];
        state.lowStockMeta     = { count: payload.count || 0, threshold: payload.threshold || 5 };
      })
      .addCase(fetchLowStock.rejected, (state, { payload }) => {
        state.loading.lowStock = false;
        state.errors.lowStock  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_LOW_STOCK);
      });

    // Route 21 — requestStock
    builder
      .addCase(requestStock.pending, (state) => {
        state.loading.requestStock = true;
        state.errors.requestStock  = null;
        state.success.requestStock = false;
      })
      .addCase(requestStock.fulfilled, (state) => {
        state.loading.requestStock = false;
        state.success.requestStock = true;
        toast.success('Stock replenishment request submitted');
      })
      .addCase(requestStock.rejected, (state, { payload }) => {
        state.loading.requestStock = false;
        state.errors.requestStock  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.REQUEST_STOCK);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ HSN CODE MANAGEMENT (Routes H1–H8)
    // ─────────────────────────────────────────────────────────────────────────

    // Route H1 — fetchHsnCodes
    // FIX: payload IS the full response object { success, total, metadata, data: [] }
    //      NOT payload.data. Unpack accordingly.
    builder
      .addCase(fetchHsnCodes.pending, (state) => {
        state.loading.hsnCodes = true;
        state.errors.hsnCodes  = null;
      })
      .addCase(fetchHsnCodes.fulfilled, (state, { payload }) => {
        state.loading.hsnCodes   = false;
        state.hsnCodes           = payload.data     || [];
        state.hsnCodesTotal      = payload.total    || 0;
        state.hsnCodesPagination = payload.metadata
          ? {
              currentPage:  payload.metadata.currentPage,
              totalPages:   payload.metadata.totalPages,
              totalItems:   payload.total || 0,
              itemsPerPage: payload.metadata.pageSize,
            }
          : initialState.hsnCodesPagination;
      })
      .addCase(fetchHsnCodes.rejected, (state, { payload }) => {
        state.loading.hsnCodes = false;
        state.errors.hsnCodes  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_HSN_CODES);
      });

    // Route H2 — fetchHsnStats
    builder
      .addCase(fetchHsnStats.pending, (state) => {
        state.loading.hsnStats = true;
        state.errors.hsnStats  = null;
      })
      .addCase(fetchHsnStats.fulfilled, (state, { payload }) => {
        state.loading.hsnStats = false;
        state.hsnStats         = payload;
      })
      .addCase(fetchHsnStats.rejected, (state, { payload }) => {
        state.loading.hsnStats = false;
        state.errors.hsnStats  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_HSN_STATS);
      });

    // Route H3 — hsnBulkDelete
    builder
      .addCase(hsnBulkDelete.pending, (state) => {
        state.loading.hsnBulkDelete = true;
        state.errors.hsnBulkDelete  = null;
        state.success.hsnBulkDelete = false;
      })
      .addCase(hsnBulkDelete.fulfilled, (state, { payload }) => {
        state.loading.hsnBulkDelete = false;
        state.success.hsnBulkDelete = true;
        toast.success(payload?.message || `${payload?.deactivated || 0} HSN code(s) deactivated`);
      })
      .addCase(hsnBulkDelete.rejected, (state, { payload }) => {
        state.loading.hsnBulkDelete = false;
        state.errors.hsnBulkDelete  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.HSN_BULK_DELETE);
      });

    // Route H4 — uploadHsnFile
    builder
      .addCase(uploadHsnFile.pending, (state) => {
        state.loading.hsnUpload = true;
        state.errors.hsnUpload  = null;
        state.success.hsnUpload = false;
      })
      .addCase(uploadHsnFile.fulfilled, (state, { payload }) => {
        state.loading.hsnUpload = false;
        state.success.hsnUpload = true;
        toast.success(payload?.message || 'HSN file uploaded successfully');
      })
      .addCase(uploadHsnFile.rejected, (state, { payload }) => {
        state.loading.hsnUpload = false;
        state.errors.hsnUpload  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.HSN_UPLOAD);
      });

    // Route H5 — fetchHsnCode
    builder
      .addCase(fetchHsnCode.pending, (state) => {
        state.loading.hsnCode = true;
        state.errors.hsnCode  = null;
      })
      .addCase(fetchHsnCode.fulfilled, (state, { payload }) => {
        state.loading.hsnCode = false;
        state.currentHsnCode  = payload;
      })
      .addCase(fetchHsnCode.rejected, (state, { payload }) => {
        state.loading.hsnCode = false;
        state.errors.hsnCode  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_HSN_CODE);
      });

    // Route H6 — createHsnCode
    builder
      .addCase(createHsnCode.pending, (state) => {
        state.loading.hsnCreate = true;
        state.errors.hsnCreate  = null;
        state.success.hsnCreate = false;
      })
      .addCase(createHsnCode.fulfilled, (state, { payload }) => {
        state.loading.hsnCreate = false;
        state.success.hsnCreate = true;
        // Prepend so it's immediately visible without a refetch
        state.hsnCodes.unshift(payload);
        state.hsnCodesTotal += 1;
        toast.success(`HSN code ${payload?.hsnCode} created`);
      })
      .addCase(createHsnCode.rejected, (state, { payload }) => {
        state.loading.hsnCreate = false;
        state.errors.hsnCreate  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.CREATE_HSN_CODE);
      });

    // Route H7 — updateHsnCode
    builder
      .addCase(updateHsnCode.pending, (state) => {
        state.loading.hsnUpdate = true;
        state.errors.hsnUpdate  = null;
        state.success.hsnUpdate = false;
      })
      .addCase(updateHsnCode.fulfilled, (state, { payload }) => {
        state.loading.hsnUpdate = false;
        state.success.hsnUpdate = true;
        const idx = state.hsnCodes.findIndex((h) => h.hsnCode === payload?.hsnCode);
        if (idx !== -1) state.hsnCodes[idx] = payload;
        if (state.currentHsnCode?.hsnCode === payload?.hsnCode) {
          state.currentHsnCode = payload;
        }
        toast.success(`HSN code ${payload?.hsnCode} updated`);
      })
      .addCase(updateHsnCode.rejected, (state, { payload }) => {
        state.loading.hsnUpdate = false;
        state.errors.hsnUpdate  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.UPDATE_HSN_CODE);
      });

    // Route H8 — deleteHsnCode
    // FIX: payload is the code string. Router soft-deletes (isActive: false).
    //      Optimistically mark as inactive in the list; do NOT splice it out
    //      so the UI can still show it as inactive if isActive filter is 'all'.
    builder
      .addCase(deleteHsnCode.pending, (state) => {
        state.loading.hsnDelete = true;
        state.errors.hsnDelete  = null;
        state.success.hsnDelete = false;
      })
      .addCase(deleteHsnCode.fulfilled, (state, { payload: code }) => {
        state.loading.hsnDelete = false;
        state.success.hsnDelete = true;
        const idx = state.hsnCodes.findIndex((h) => h.hsnCode === code);
        if (idx !== -1) state.hsnCodes[idx] = { ...state.hsnCodes[idx], isActive: false };
        if (state.currentHsnCode?.hsnCode === code) {
          state.currentHsnCode = { ...state.currentHsnCode, isActive: false };
        }
        toast.success(`HSN code ${code} deactivated`);
      })
      .addCase(deleteHsnCode.rejected, (state, { payload }) => {
        state.loading.hsnDelete = false;
        state.errors.hsnDelete  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.DELETE_HSN_CODE);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ FINANCIALS (Routes 22–27)
    // ─────────────────────────────────────────────────────────────────────────

    // Route 22 — fetchDailyEarnings
    builder
      .addCase(fetchDailyEarnings.pending, (state) => {
        state.loading.dailyEarnings = true;
        state.errors.dailyEarnings  = null;
      })
      .addCase(fetchDailyEarnings.fulfilled, (state, { payload }) => {
        state.loading.dailyEarnings = false;
        state.dailyEarnings         = payload;
      })
      .addCase(fetchDailyEarnings.rejected, (state, { payload }) => {
        state.loading.dailyEarnings = false;
        state.errors.dailyEarnings  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_DAILY_EARNINGS);
      });

    // Route 23 — fetchMonthlyEarnings
    builder
      .addCase(fetchMonthlyEarnings.pending, (state) => {
        state.loading.monthlyEarnings = true;
        state.errors.monthlyEarnings  = null;
      })
      .addCase(fetchMonthlyEarnings.fulfilled, (state, { payload }) => {
        state.loading.monthlyEarnings = false;
        state.monthlyEarnings         = payload;
      })
      .addCase(fetchMonthlyEarnings.rejected, (state, { payload }) => {
        state.loading.monthlyEarnings = false;
        state.errors.monthlyEarnings  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_MONTHLY_EARNINGS);
      });

    // Route 24 — fetchTotalEarnings
    builder
      .addCase(fetchTotalEarnings.pending, (state) => {
        state.loading.totalEarnings = true;
        state.errors.totalEarnings  = null;
      })
      .addCase(fetchTotalEarnings.fulfilled, (state, { payload }) => {
        state.loading.totalEarnings = false;
        state.totalEarnings         = payload;
      })
      .addCase(fetchTotalEarnings.rejected, (state, { payload }) => {
        state.loading.totalEarnings = false;
        state.errors.totalEarnings  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_TOTAL_EARNINGS);
      });

    // Route 25 — fetchEarningsHistory
    builder
      .addCase(fetchEarningsHistory.pending, (state) => {
        state.loading.earningsHistory = true;
        state.errors.earningsHistory  = null;
      })
      .addCase(fetchEarningsHistory.fulfilled, (state, { payload }) => {
        state.loading.earningsHistory      = false;
        state.earningsHistory              = payload.orders     || [];
        state.earningsHistorySummary       = payload.summary    || null;
        state.earningsHistoryPagination    = payload.pagination || initialState.earningsHistoryPagination;
      })
      .addCase(fetchEarningsHistory.rejected, (state, { payload }) => {
        state.loading.earningsHistory = false;
        state.errors.earningsHistory  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_EARNINGS_HISTORY);
      });

    // Route 26 — fetchStoreInvoice
    builder
      .addCase(fetchStoreInvoice.pending, (state) => {
        state.loading.storeInvoice = true;
        state.errors.storeInvoice  = null;
      })
      .addCase(fetchStoreInvoice.fulfilled, (state, { payload }) => {
        state.loading.storeInvoice = false;
        state.storeInvoiceHtml     = payload.html;
      })
      .addCase(fetchStoreInvoice.rejected, (state, { payload }) => {
        state.loading.storeInvoice = false;
        state.errors.storeInvoice  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_STORE_INVOICE);
      });

    // Route 27 — sendStoreInvoice
    builder
      .addCase(sendStoreInvoice.pending, (state) => {
        state.loading.sendStoreInvoice = true;
        state.errors.sendStoreInvoice  = null;
        state.success.sendStoreInvoice = false;
      })
      .addCase(sendStoreInvoice.fulfilled, (state) => {
        state.loading.sendStoreInvoice = false;
        state.success.sendStoreInvoice = true;
        toast.success('Store invoice sent successfully');
      })
      .addCase(sendStoreInvoice.rejected, (state, { payload }) => {
        state.loading.sendStoreInvoice = false;
        state.errors.sendStoreInvoice  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.SEND_STORE_INVOICE);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ PAYMENT ACCOUNTS (Routes 28–33)
    // ─────────────────────────────────────────────────────────────────────────

    // Route 28 — fetchPaymentAccount
    builder
      .addCase(fetchPaymentAccount.pending, (state) => {
        state.loading.paymentAccount = true;
        state.errors.paymentAccount  = null;
      })
      .addCase(fetchPaymentAccount.fulfilled, (state, { payload }) => {
        state.loading.paymentAccount = false;
        state.paymentAccount         = payload;
      })
      .addCase(fetchPaymentAccount.rejected, (state, { payload }) => {
        state.loading.paymentAccount = false;
        state.errors.paymentAccount  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_PAYMENT_ACCOUNT);
      });

    // Route 29 — addBankAccount
    builder
      .addCase(addBankAccount.pending, (state) => {
        state.loading.bankAccount    = true;
        state.errors.bankAccount     = null;
        state.success.addBankAccount = false;
      })
      .addCase(addBankAccount.fulfilled, (state, { payload }) => {
        state.loading.bankAccount    = false;
        state.success.addBankAccount = true;
        state.paymentAccount         = payload;
        toast.success('Bank account added successfully');
      })
      .addCase(addBankAccount.rejected, (state, { payload }) => {
        state.loading.bankAccount = false;
        state.errors.bankAccount  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.ADD_BANK_ACCOUNT);
      });

    // Route 30 — updateBankAccount
    builder
      .addCase(updateBankAccount.pending, (state) => {
        state.loading.bankAccount       = true;
        state.errors.bankAccount        = null;
        state.success.updateBankAccount = false;
      })
      .addCase(updateBankAccount.fulfilled, (state, { payload }) => {
        state.loading.bankAccount       = false;
        state.success.updateBankAccount = true;
        state.paymentAccount            = payload;
        toast.success('Bank account updated');
      })
      .addCase(updateBankAccount.rejected, (state, { payload }) => {
        state.loading.bankAccount = false;
        state.errors.bankAccount  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.UPDATE_BANK_ACCOUNT);
      });

    // Route 31 — deleteBankAccount
    builder
      .addCase(deleteBankAccount.pending, (state) => {
        state.loading.bankAccount       = true;
        state.errors.bankAccount        = null;
        state.success.deleteBankAccount = false;
      })
      .addCase(deleteBankAccount.fulfilled, (state, { payload: bankId }) => {
        state.loading.bankAccount       = false;
        state.success.deleteBankAccount = true;
        if (state.paymentAccount?.bankAccounts) {
          state.paymentAccount.bankAccounts =
            state.paymentAccount.bankAccounts.filter((b) => String(b._id) !== String(bankId));
        }
        toast.success('Bank account removed');
      })
      .addCase(deleteBankAccount.rejected, (state, { payload }) => {
        state.loading.bankAccount = false;
        state.errors.bankAccount  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.DELETE_BANK_ACCOUNT);
      });

    // Route 32 — addUpiHandle
    builder
      .addCase(addUpiHandle.pending, (state) => {
        state.loading.upiHandle    = true;
        state.errors.upiHandle     = null;
        state.success.addUpiHandle = false;
      })
      .addCase(addUpiHandle.fulfilled, (state, { payload }) => {
        state.loading.upiHandle    = false;
        state.success.addUpiHandle = true;
        state.paymentAccount       = payload;
        toast.success('UPI handle added successfully');
      })
      .addCase(addUpiHandle.rejected, (state, { payload }) => {
        state.loading.upiHandle = false;
        state.errors.upiHandle  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.ADD_UPI);
      });

    // Route 33 — deleteUpiHandle
    // FIX: The router param is the subdocument _id (MongoDB ObjectId), NOT the
    //      UPI string. The reducer must filter by _id, not by upiId string.
    builder
      .addCase(deleteUpiHandle.pending, (state) => {
        state.loading.upiHandle       = true;
        state.errors.upiHandle        = null;
        state.success.deleteUpiHandle = false;
      })
      .addCase(deleteUpiHandle.fulfilled, (state, { payload: upiHandleId }) => {
        state.loading.upiHandle       = false;
        state.success.deleteUpiHandle = true;
        if (state.paymentAccount?.upiHandles) {
          state.paymentAccount.upiHandles =
            state.paymentAccount.upiHandles.filter((u) => String(u._id) !== String(upiHandleId));
        }
        toast.success('UPI handle removed');
      })
      .addCase(deleteUpiHandle.rejected, (state, { payload }) => {
        state.loading.upiHandle = false;
        state.errors.upiHandle  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.DELETE_UPI);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ SETTLEMENTS (Routes 34–36)
    // ─────────────────────────────────────────────────────────────────────────

    // Route 34 — fetchSettlements
    builder
      .addCase(fetchSettlements.pending, (state) => {
        state.loading.settlements = true;
        state.errors.settlements  = null;
      })
      .addCase(fetchSettlements.fulfilled, (state, { payload }) => {
        state.loading.settlements = false;
        state.settlements         = payload;
      })
      .addCase(fetchSettlements.rejected, (state, { payload }) => {
        state.loading.settlements = false;
        state.errors.settlements  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_SETTLEMENTS);
      });

    // Route 35 — requestSettlement
    builder
      .addCase(requestSettlement.pending, (state) => {
        state.loading.settlementRequest = true;
        state.errors.settlementRequest  = null;
        state.success.settlementRequest = false;
      })
      .addCase(requestSettlement.fulfilled, (state, { payload }) => {
        state.loading.settlementRequest = false;
        state.success.settlementRequest = true;
        // Sync pendingBalance / totalSettled into the settlements summary
        if (state.settlements) {
          state.settlements.pendingBalance = payload.pendingBalance;
          state.settlements.totalSettled   = payload.totalSettled;
        }
        toast.success('Settlement request processed successfully');
      })
      .addCase(requestSettlement.rejected, (state, { payload }) => {
        state.loading.settlementRequest = false;
        state.errors.settlementRequest  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.REQUEST_SETTLEMENT);
      });

    // Route 36 — fetchSettlementHistory
    builder
      .addCase(fetchSettlementHistory.pending, (state) => {
        state.loading.settlementHistory = true;
        state.errors.settlementHistory  = null;
      })
      .addCase(fetchSettlementHistory.fulfilled, (state, { payload }) => {
        state.loading.settlementHistory      = false;
        state.settlementHistory              = payload.history    || [];
        state.settlementHistoryPagination    = payload.pagination || initialState.settlementHistoryPagination;
      })
      .addCase(fetchSettlementHistory.rejected, (state, { payload }) => {
        state.loading.settlementHistory = false;
        state.errors.settlementHistory  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_SETTLEMENT_HISTORY);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ ANALYTICS (Routes 37–40)
    // ─────────────────────────────────────────────────────────────────────────

    // Route 37 — fetchAnalyticsOverview
    builder
      .addCase(fetchAnalyticsOverview.pending, (state) => {
        state.loading.analyticsOverview = true;
        state.errors.analyticsOverview  = null;
      })
      .addCase(fetchAnalyticsOverview.fulfilled, (state, { payload }) => {
        state.loading.analyticsOverview = false;
        state.analyticsOverview         = payload;
      })
      .addCase(fetchAnalyticsOverview.rejected, (state, { payload }) => {
        state.loading.analyticsOverview = false;
        state.errors.analyticsOverview  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_ANALYTICS_OVERVIEW);
      });

    // Route 38 — fetchRevenueAnalytics
    builder
      .addCase(fetchRevenueAnalytics.pending, (state) => {
        state.loading.analyticsRevenue = true;
        state.errors.analyticsRevenue  = null;
      })
      .addCase(fetchRevenueAnalytics.fulfilled, (state, { payload }) => {
        state.loading.analyticsRevenue = false;
        state.revenueAnalytics         = payload;
      })
      .addCase(fetchRevenueAnalytics.rejected, (state, { payload }) => {
        state.loading.analyticsRevenue = false;
        state.errors.analyticsRevenue  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_ANALYTICS_REVENUE);
      });

    // Route 39 — fetchReturnAnalytics
    builder
      .addCase(fetchReturnAnalytics.pending, (state) => {
        state.loading.analyticsReturns = true;
        state.errors.analyticsReturns  = null;
      })
      .addCase(fetchReturnAnalytics.fulfilled, (state, { payload }) => {
        state.loading.analyticsReturns = false;
        state.returnAnalytics          = payload;
      })
      .addCase(fetchReturnAnalytics.rejected, (state, { payload }) => {
        state.loading.analyticsReturns = false;
        state.errors.analyticsReturns  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_ANALYTICS_RETURNS);
      });

    // Route 40 — fetchTopMedicines
    builder
      .addCase(fetchTopMedicines.pending, (state) => {
        state.loading.topMedicines = true;
        state.errors.topMedicines  = null;
      })
      .addCase(fetchTopMedicines.fulfilled, (state, { payload }) => {
        state.loading.topMedicines = false;
        state.topMedicines         = payload.topMedicines || [];
      })
      .addCase(fetchTopMedicines.rejected, (state, { payload }) => {
        state.loading.topMedicines = false;
        state.errors.topMedicines  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_TOP_MEDICINES);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ PROFILE & STORE (Routes 41–48)
    // ─────────────────────────────────────────────────────────────────────────

    // Route 41 — fetchProfile
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.loading.profile = true;
        state.errors.profile  = null;
      })
      .addCase(fetchProfile.fulfilled, (state, { payload }) => {
        state.loading.profile = false;
        state.userProfile     = payload;
      })
      .addCase(fetchProfile.rejected, (state, { payload }) => {
        state.loading.profile = false;
        state.errors.profile  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_PROFILE);
      });

    // Route 42 — updateUserProfile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.loading.profile       = true;
        state.errors.profile        = null;
        state.success.profileUpdate = false;
      })
      .addCase(updateUserProfile.fulfilled, (state, { payload }) => {
        state.loading.profile       = false;
        state.success.profileUpdate = true;
        state.userProfile           = payload;
        toast.success('Profile updated successfully');
      })
      .addCase(updateUserProfile.rejected, (state, { payload }) => {
        state.loading.profile = false;
        state.errors.profile  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.UPDATE_PROFILE);
      });

    // Route 43 — changePassword
    builder
      .addCase(changePassword.pending, (state) => {
        state.loading.profile        = true;
        state.errors.profile         = null;
        state.success.passwordChange = false;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.loading.profile        = false;
        state.success.passwordChange = true;
        toast.success('Password changed successfully');
      })
      .addCase(changePassword.rejected, (state, { payload }) => {
        state.loading.profile = false;
        state.errors.profile  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.CHANGE_PASSWORD);
      });

    // Route 44 — fetchPharmacyProfile
    builder
      .addCase(fetchPharmacyProfile.pending, (state) => {
        state.loading.pharmacyProfile = true;
        state.errors.pharmacyProfile  = null;
      })
      .addCase(fetchPharmacyProfile.fulfilled, (state, { payload }) => {
        state.loading.pharmacyProfile = false;
        state.pharmacyProfile         = payload;
      })
      .addCase(fetchPharmacyProfile.rejected, (state, { payload }) => {
        state.loading.pharmacyProfile = false;
        state.errors.pharmacyProfile  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_PHARMACY_PROFILE);
      });

    // Route 45 — updatePharmacyProfile
    builder
      .addCase(updatePharmacyProfile.pending, (state) => {
        state.loading.pharmacyProfile       = true;
        state.errors.pharmacyProfile        = null;
        state.success.pharmacyProfileUpdate = false;
      })
      .addCase(updatePharmacyProfile.fulfilled, (state, { payload }) => {
        state.loading.pharmacyProfile       = false;
        state.success.pharmacyProfileUpdate = true;
        state.pharmacyProfile               = payload;
        toast.success('Pharmacy profile updated successfully');
      })
      .addCase(updatePharmacyProfile.rejected, (state, { payload }) => {
        state.loading.pharmacyProfile = false;
        state.errors.pharmacyProfile  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.UPDATE_PHARMACY_PROFILE);
      });

    // Route 46 — fetchStore
    builder
      .addCase(fetchStore.pending, (state) => {
        state.loading.store = true;
        state.errors.store  = null;
      })
      .addCase(fetchStore.fulfilled, (state, { payload }) => {
        state.loading.store = false;
        state.store         = payload;
      })
      .addCase(fetchStore.rejected, (state, { payload }) => {
        state.loading.store = false;
        state.errors.store  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_STORE);
      });

    // Route 47 — updateStore
    builder
      .addCase(updateStore.pending, (state) => {
        state.loading.store       = true;
        state.errors.store        = null;
        state.success.storeUpdate = false;
      })
      .addCase(updateStore.fulfilled, (state, { payload }) => {
        state.loading.store       = false;
        state.success.storeUpdate = true;
        state.store               = payload;
        toast.success('Store updated successfully');
      })
      .addCase(updateStore.rejected, (state, { payload }) => {
        state.loading.store = false;
        state.errors.store  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.UPDATE_STORE);
      });

    // Route 48 — fetchInventorySummary
    builder
      .addCase(fetchInventorySummary.pending, (state) => {
        state.loading.inventorySummary = true;
        state.errors.inventorySummary  = null;
      })
      .addCase(fetchInventorySummary.fulfilled, (state, { payload }) => {
        state.loading.inventorySummary = false;
        state.inventorySummary         = payload;
      })
      .addCase(fetchInventorySummary.rejected, (state, { payload }) => {
        state.loading.inventorySummary = false;
        state.errors.inventorySummary  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_INVENTORY_SUMMARY);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ AUDIT: SESSIONS & DEVICES (Routes 49–54)
    // ─────────────────────────────────────────────────────────────────────────

    // Route 49 — fetchSessions
    builder
      .addCase(fetchSessions.pending, (state) => {
        state.loading.sessions = true;
        state.errors.sessions  = null;
      })
      .addCase(fetchSessions.fulfilled, (state, { payload }) => {
        state.loading.sessions = false;
        state.sessions         = payload.sessions || [];
      })
      .addCase(fetchSessions.rejected, (state, { payload }) => {
        state.loading.sessions = false;
        state.errors.sessions  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_SESSIONS);
      });

    // Route 50 — revokeSession
    builder
      .addCase(revokeSession.pending, (state) => {
        state.loading.sessions      = true;
        state.errors.sessions       = null;
        state.success.sessionRevoke = false;
      })
      .addCase(revokeSession.fulfilled, (state, { payload: sessionId }) => {
        state.loading.sessions      = false;
        state.success.sessionRevoke = true;
        state.sessions = state.sessions.filter((s) => String(s._id) !== String(sessionId));
        toast.success('Session revoked');
      })
      .addCase(revokeSession.rejected, (state, { payload }) => {
        state.loading.sessions = false;
        state.errors.sessions  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.REVOKE_SESSION);
      });

    // Route 51 — logoutAllDevices
    builder
      .addCase(logoutAllDevices.pending, (state) => {
        state.loading.sessions  = true;
        state.loading.devices   = true;
        state.success.logoutAll = false;
      })
      .addCase(logoutAllDevices.fulfilled, (state) => {
        state.loading.sessions  = false;
        state.loading.devices   = false;
        state.success.logoutAll = true;
        state.sessions          = [];
        // NOTE: Router only clears auditSessions, not deviceTokens.
        //       We do NOT clear state.devices here to stay accurate.
        toast.success('Logged out from all devices');
      })
      .addCase(logoutAllDevices.rejected, (state, { payload }) => {
        state.loading.sessions = false;
        state.loading.devices  = false;
        toast.error(payload?.message || ERROR_MESSAGES.LOGOUT_ALL);
      });

    // Route 52 — fetchDevices
    builder
      .addCase(fetchDevices.pending, (state) => {
        state.loading.devices = true;
        state.errors.devices  = null;
      })
      .addCase(fetchDevices.fulfilled, (state, { payload }) => {
        state.loading.devices = false;
        state.devices         = payload.devices || [];
      })
      .addCase(fetchDevices.rejected, (state, { payload }) => {
        state.loading.devices = false;
        state.errors.devices  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_DEVICES);
      });

    // Route 53 — removeDevice
    builder
      .addCase(removeDevice.pending, (state) => {
        state.loading.devices      = true;
        state.errors.devices       = null;
        state.success.deviceRemove = false;
      })
      .addCase(removeDevice.fulfilled, (state, { payload: deviceId }) => {
        state.loading.devices      = false;
        state.success.deviceRemove = true;
        state.devices = state.devices.filter((d) => String(d._id) !== String(deviceId));
        toast.success('Device removed');
      })
      .addCase(removeDevice.rejected, (state, { payload }) => {
        state.loading.devices = false;
        state.errors.devices  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.REMOVE_DEVICE);
      });

    // Route 54 — removeAllDevices
    builder
      .addCase(removeAllDevices.pending, (state) => {
        state.loading.devices           = true;
        state.errors.devices            = null;
        state.success.allDevicesRemoved = false;
      })
      .addCase(removeAllDevices.fulfilled, (state) => {
        state.loading.devices           = false;
        state.success.allDevicesRemoved = true;
        state.devices                   = [];
        toast.success('All devices removed');
      })
      .addCase(removeAllDevices.rejected, (state, { payload }) => {
        state.loading.devices = false;
        state.errors.devices  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.REMOVE_ALL_DEVICES);
      });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// § EXPORTS — ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const {
  clearError,
  clearSuccess,
  clearAllErrors,
  clearAllSuccess,
  resetPharmacyStore,
  setCurrentOrder,
  clearCurrentOrder,
  clearOrderDocuments,
  clearStoreInvoice,
  clearCurrentHsnCode,
  clearExportedOrder,
} = pharmacyStoreSlice.actions;

// ═══════════════════════════════════════════════════════════════════════════════
// § EXPORTS — REDUCER
// ═══════════════════════════════════════════════════════════════════════════════

export default pharmacyStoreSlice.reducer;