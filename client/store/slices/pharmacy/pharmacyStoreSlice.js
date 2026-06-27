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
  FETCH_ORDER_PRICING:        'Failed to fetch order pricing breakdown',
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
  
  // Inventory & Medicines
  FETCH_MEDICINES:            'Failed to fetch medicines',
  FETCH_MEDICINE_INVENTORY:   'Failed to fetch medicine inventory details',
  ADD_STOCK:                  'Failed to add stock',
  DEDUCT_STOCK:               'Failed to deduct stock',
  FETCH_MEDICINE_STOCK:       'Failed to fetch medicine stock',
  UPDATE_MEDICINE_INVENTORY:  'Failed to update medicine inventory',
  FETCH_BATCHES:              'Failed to fetch inventory batches',
  UPDATE_BATCH:               'Failed to update batch',
  FETCH_EXPIRY_ALERTS:        'Failed to fetch expiry alerts',
  FETCH_LOW_STOCK:            'Failed to fetch low-stock items',
  REQUEST_STOCK:              'Failed to request stock replenishment',
  FETCH_MOVEMENTS:            'Failed to fetch inventory movements',
  FETCH_INVENTORY_SUMMARY:    'Failed to fetch inventory summary',
  
  // Suppliers
  FETCH_SUPPLIERS:            'Failed to fetch suppliers',
  CREATE_SUPPLIER:            'Failed to create supplier',
  UPDATE_SUPPLIER:            'Failed to update supplier',
  DELETE_SUPPLIER:            'Failed to deactivate supplier',

  // Purchase Orders
  FETCH_PURCHASE_ORDERS:      'Failed to fetch purchase orders',
  FETCH_PURCHASE_ORDER:       'Failed to fetch purchase order details',
  CREATE_PURCHASE_ORDER:      'Failed to create purchase order',
  UPDATE_PO_STATUS:           'Failed to update purchase order status',
  RECEIVE_PO_STOCK:           'Failed to receive purchase order stock',

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
  FETCH_COD_PENDING:          'Failed to fetch pending COD remits',
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
  FETCH_INVENTORY_VALUE:      'Failed to fetch inventory value',
  
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
// § ASYNC THUNKS — ORDER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchOrders = createAsyncThunk(
  'pharmacyStore/fetchOrders',
  async (params, { rejectWithValue }) => {
    try {
      const {
        status, dateFilter = 'today', startDate, endDate, paymentStatus,
        page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc',
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

export const fetchOrderPricingBreakdown = createAsyncThunk(
  'pharmacyStore/fetchOrderPricingBreakdown',
  async (orderId, { rejectWithValue }) => {
    try {
      if (!orderId) return rejectWithValue({ message: 'orderId is required' });
      const { data } = await API.get(`${API_BASE}/orders/${orderId}/pricing-breakdown`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_ORDER_PRICING });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_ORDER_PRICING, details: extractErrorMessage(err) });
    }
  },
);

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
// § ASYNC THUNKS — MEDICINE & INVENTORY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

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

export const fetchMedicineInventoryDetail = createAsyncThunk(
  'pharmacyStore/fetchMedicineInventoryDetail',
  async (medicineId, { rejectWithValue }) => {
    try {
      if (!medicineId) return rejectWithValue({ message: 'medicineId is required' });
      const { data } = await API.get(`${API_BASE}/medicines/${medicineId}/inventory`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_MEDICINE_INVENTORY });
      return data.data; // { inventory, batches }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_MEDICINE_INVENTORY, details: extractErrorMessage(err) });
    }
  },
);

export const addStock = createAsyncThunk(
  'pharmacyStore/addStock',
  async (
    {
      medicineId, stockQuantity, batchNumber, expiryDate,
      mrp, sellingPrice, discountPercent,
      manufacturingDate, purchasePrice, purchaseInvoiceNo, purchaseInvoiceDate,
      supplierId, rackLocation,
    },
    { rejectWithValue }
  ) => {
    try {
      if (!stockQuantity || stockQuantity <= 0)
        return rejectWithValue({ message: 'stockQuantity must be > 0' });
      if (!batchNumber) return rejectWithValue({ message: 'batchNumber is required' });
      if (!expiryDate)  return rejectWithValue({ message: 'expiryDate is required' });
      if (!mrp || mrp <= 0) return rejectWithValue({ message: 'mrp is required and must be > 0' });
      if (!sellingPrice || sellingPrice <= 0) return rejectWithValue({ message: 'sellingPrice is required and must be > 0' });
 
      const { data } = await API.post(`${API_BASE}/medicines/${medicineId}/add-stock`, {
        stockQuantity,
        batchNumber,
        expiryDate,
        mrp,
        sellingPrice,
        ...(discountPercent    !== undefined && { discountPercent }),
        ...(manufacturingDate  && { manufacturingDate }),
        ...(purchasePrice      !== undefined && { purchasePrice }),
        ...(purchaseInvoiceNo  && { purchaseInvoiceNo }),
        ...(purchaseInvoiceDate && { purchaseInvoiceDate }),
        ...(supplierId         && { supplierId }),
        ...(rackLocation       && { rackLocation }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.ADD_STOCK });
      return data.data; // { inventory, batch }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.ADD_STOCK, details: extractErrorMessage(err) });
    }
  },
);

export const deductStock = createAsyncThunk(
  'pharmacyStore/deductStock',
  async ({ medicineId, quantity, batchNumber, reason, movementType = 'Adjustment_Sub' }, { rejectWithValue }) => {
    try {
      if (!quantity || quantity <= 0)
        return rejectWithValue({ message: 'quantity must be > 0' });
      const validMovements = ['Adjustment_Sub', 'Damage', 'Expiry', 'Transfer_Out'];
      if (!validMovements.includes(movementType))
        return rejectWithValue({ message: `movementType must be one of: ${validMovements.join(', ')}` });
 
      const { data } = await API.patch(`${API_BASE}/medicines/${medicineId}/deduct-stock`, {
        quantity,
        movementType,
        ...(batchNumber && { batchNumber }),
        ...(reason      && { reason }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.DEDUCT_STOCK });
      return data.data; // { inventory }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.DEDUCT_STOCK, details: extractErrorMessage(err) });
    }
  },
);

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

export const updateMedicineInventory = createAsyncThunk(
  'pharmacyStore/updateMedicineInventory',
  async ({ medicineId, ...payload }, { rejectWithValue }) => {
    try {
      if (!medicineId) return rejectWithValue({ message: 'medicineId is required' });
      if (!Object.keys(payload).length) return rejectWithValue({ message: 'No fields to update' });
      const { data } = await API.patch(`${API_BASE}/medicines/${medicineId}/inventory`, payload);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.UPDATE_MEDICINE_INVENTORY });
      return data.data.inventory;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.UPDATE_MEDICINE_INVENTORY, details: extractErrorMessage(err) });
    }
  },
);

export const fetchInventoryBatches = createAsyncThunk(
  'pharmacyStore/fetchInventoryBatches',
  async (params, { rejectWithValue }) => {
    try {
      const { page = 1, limit = 20, status, search, nearExpiry } = params || {};
      const qs = buildQueryParams({ page, limit, status, search, nearExpiry });
      const { data } = await API.get(`${API_BASE}/inventory/batches${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_BATCHES });
      return data.data; // { batches, pagination }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_BATCHES, details: extractErrorMessage(err) });
    }
  },
);

export const updateBatch = createAsyncThunk(
  'pharmacyStore/updateBatch',
  async ({ batchId, ...payload }, { rejectWithValue }) => {
    try {
      if (!batchId) return rejectWithValue({ message: 'batchId is required' });
      const { data } = await API.patch(`${API_BASE}/inventory/batches/${batchId}`, payload);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.UPDATE_BATCH });
      return data.data.batch;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.UPDATE_BATCH, details: extractErrorMessage(err) });
    }
  },
);

export const fetchExpiryAlerts = createAsyncThunk(
  'pharmacyStore/fetchExpiryAlerts',
  async (params, { rejectWithValue }) => {
    try {
      const { days, sendEmail, storeId } = params || {};
      const qs = buildQueryParams({ days, sendEmail, storeId });
      const { data } = await API.get(`${API_BASE}/inventory/expiry-alerts${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_EXPIRY_ALERTS });
      return data.data; // { expiringMedicines, count, alertDays }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_EXPIRY_ALERTS, details: extractErrorMessage(err) });
    }
  },
);

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

export const requestStock = createAsyncThunk(
  'pharmacyStore/requestStock',
  async ({ medicineId, requiredQuantity, urgency = 'Medium', supplierId, notes }, { rejectWithValue }) => {
    try {
      const validUrgencies = ['Low', 'Medium', 'High', 'Critical'];
      if (!requiredQuantity || requiredQuantity <= 0)
        return rejectWithValue({ message: 'requiredQuantity must be greater than 0' });
      if (!validUrgencies.includes(urgency))
        return rejectWithValue({ message: `urgency must be one of: ${validUrgencies.join(', ')}` });

      const { data } = await API.post(`${API_BASE}/medicines/${medicineId}/request-stock`, {
        requiredQuantity,
        urgency,
        ...(supplierId && { supplierId }),
        ...(notes && { notes })
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.REQUEST_STOCK });
      return data.data; 
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.REQUEST_STOCK, details: extractErrorMessage(err) });
    }
  },
);

export const fetchInventoryMovements = createAsyncThunk(
  'pharmacyStore/fetchInventoryMovements',
  async (params, { rejectWithValue }) => {
    try {
      const { medicineId, movementType, dateFilter = 'last30days', startDate, endDate, page = 1, limit = 20 } = params || {};
      const qs = buildQueryParams({ medicineId, movementType, dateFilter, startDate, endDate, page, limit });
      const { data } = await API.get(`${API_BASE}/inventory/movements${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_MOVEMENTS });
      return data.data; // { movements, pagination }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_MOVEMENTS, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — SUPPLIERS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchSuppliers = createAsyncThunk(
  'pharmacyStore/fetchSuppliers',
  async (params, { rejectWithValue }) => {
    try {
      const { search, isActive = 'true', page = 1, limit = 20 } = params || {};
      const qs = buildQueryParams({ search, isActive, page, limit });
      const { data } = await API.get(`${API_BASE}/suppliers${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_SUPPLIERS });
      return data.data; // { suppliers, pagination }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_SUPPLIERS, details: extractErrorMessage(err) });
    }
  },
);
 
export const fetchSupplier = createAsyncThunk(
  'pharmacyStore/fetchSupplier',
  async (supplierId, { rejectWithValue }) => {
    try {
      if (!supplierId) return rejectWithValue({ message: 'supplierId is required' });
      const { data } = await API.get(`${API_BASE}/suppliers/${supplierId}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_SUPPLIERS });
      return data.data.supplier;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_SUPPLIERS, details: extractErrorMessage(err) });
    }
  },
);
 
export const createSupplier = createAsyncThunk(
  'pharmacyStore/createSupplier',
  async (payload, { rejectWithValue }) => {
    try {
      const { name, contact, legal } = payload || {};
      if (!name || !contact?.email || !contact?.phone)
        return rejectWithValue({ message: 'name, contact.email, contact.phone required' });
      if (!legal?.gstNumber || !legal?.dlNumber)
        return rejectWithValue({ message: 'legal.gstNumber and legal.dlNumber required' });
      const { data } = await API.post(`${API_BASE}/suppliers`, payload);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.CREATE_SUPPLIER });
      return data.data.supplier;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.CREATE_SUPPLIER, details: extractErrorMessage(err) });
    }
  },
);
 
export const updateSupplier = createAsyncThunk(
  'pharmacyStore/updateSupplier',
  async ({ supplierId, ...payload }, { rejectWithValue }) => {
    try {
      if (!supplierId) return rejectWithValue({ message: 'supplierId is required' });
      const { data } = await API.patch(`${API_BASE}/suppliers/${supplierId}`, payload);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.UPDATE_SUPPLIER });
      return data.data.supplier;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.UPDATE_SUPPLIER, details: extractErrorMessage(err) });
    }
  },
);
 
export const deactivateSupplier = createAsyncThunk(
  'pharmacyStore/deactivateSupplier',
  async (supplierId, { rejectWithValue }) => {
    try {
      if (!supplierId) return rejectWithValue({ message: 'supplierId is required' });
      const { data } = await API.delete(`${API_BASE}/suppliers/${supplierId}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.DELETE_SUPPLIER });
      return supplierId;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.DELETE_SUPPLIER, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchPurchaseOrders = createAsyncThunk(
  'pharmacyStore/fetchPurchaseOrders',
  async (params, { rejectWithValue }) => {
    try {
      const { status, supplierId, dateFilter = 'last30days', startDate, endDate, page = 1, limit = 20 } = params || {};
      const qs = buildQueryParams({ status, supplierId, dateFilter, startDate, endDate, page, limit });
      const { data } = await API.get(`${API_BASE}/purchase-orders${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_PURCHASE_ORDERS });
      return data.data; // { purchaseOrders, pagination }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_PURCHASE_ORDERS, details: extractErrorMessage(err) });
    }
  },
);
 
export const createPurchaseOrder = createAsyncThunk(
  'pharmacyStore/createPurchaseOrder',
  async ({ supplierId, items, expectedDeliveryDate, notes }, { rejectWithValue }) => {
    try {
      if (!supplierId) return rejectWithValue({ message: 'supplierId is required' });
      if (!items?.length) return rejectWithValue({ message: 'items array required' });
      for (const item of items) {
        if (!item.medicineId || !item.requestedQuantity || !item.unitPrice)
          return rejectWithValue({ message: 'Each item needs medicineId, requestedQuantity, unitPrice' });
      }
      const { data } = await API.post(`${API_BASE}/purchase-orders`, {
        supplierId, items,
        ...(expectedDeliveryDate && { expectedDeliveryDate }),
        ...(notes && { notes }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.CREATE_PURCHASE_ORDER });
      return data.data.purchaseOrder;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.CREATE_PURCHASE_ORDER, details: extractErrorMessage(err) });
    }
  },
);
 
export const fetchPurchaseOrder = createAsyncThunk(
  'pharmacyStore/fetchPurchaseOrder',
  async (poId, { rejectWithValue }) => {
    try {
      if (!poId) return rejectWithValue({ message: 'poId is required' });
      const { data } = await API.get(`${API_BASE}/purchase-orders/${poId}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_PURCHASE_ORDER });
      return data.data.purchaseOrder;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_PURCHASE_ORDER, details: extractErrorMessage(err) });
    }
  },
);
 
export const updatePurchaseOrderStatus = createAsyncThunk(
  'pharmacyStore/updatePurchaseOrderStatus',
  async ({ poId, status, notes }, { rejectWithValue }) => {
    try {
      if (!poId) return rejectWithValue({ message: 'poId is required' });
      const allowed = ['Draft', 'Sent', 'Cancelled'];
      if (!allowed.includes(status)) return rejectWithValue({ message: `status must be one of: ${allowed.join(', ')}` });
      const { data } = await API.patch(`${API_BASE}/purchase-orders/${poId}/status`, {
        status,
        ...(notes && { notes }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.UPDATE_PO_STATUS });
      return data.data.purchaseOrder;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.UPDATE_PO_STATUS, details: extractErrorMessage(err) });
    }
  },
);
 
export const receivePurchaseOrderStock = createAsyncThunk(
  'pharmacyStore/receivePurchaseOrderStock',
  async ({ poId, items }, { rejectWithValue }) => {
    try {
      if (!poId) return rejectWithValue({ message: 'poId is required' });
      if (!items?.length) return rejectWithValue({ message: 'items array required' });
      for (const item of items) {
        if (!item.receivedQuantity || item.receivedQuantity <= 0 || !item.batchNumber || !item.expiryDate)
          return rejectWithValue({ message: 'Each item needs receivedQuantity, batchNumber, expiryDate' });
      }
      const { data } = await API.post(`${API_BASE}/purchase-orders/${poId}/receive`, { items });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.RECEIVE_PO_STOCK });
      return data.data; // { purchaseOrder, received }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.RECEIVE_PO_STOCK, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — HSN CODE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchHsnCodes = createAsyncThunk(
  'pharmacyStore/fetchHsnCodes',
  async (params, { rejectWithValue }) => {
    try {
      const { search, gst, isActive, page = 1, limit = 20, sort = 'hsnCode' } = params || {};
      const qs = buildQueryParams({ search, gst, isActive, page, limit, sort });
      const { data } = await API.get(`${API_BASE}/hsn${qs}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_HSN_CODES });
      return data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_HSN_CODES, details: extractErrorMessage(err) });
    }
  },
);

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

export const hsnBulkDelete = createAsyncThunk(
  'pharmacyStore/hsnBulkDelete',
  async (codes, { rejectWithValue }) => {
    try {
      if (!Array.isArray(codes) || !codes.length)
        return rejectWithValue({ message: 'Provide a non-empty array of HSN codes' });
      const { data } = await API.post(`${API_BASE}/hsn/bulk-delete`, { codes });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.HSN_BULK_DELETE });
      return data; 
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.HSN_BULK_DELETE, details: extractErrorMessage(err) });
    }
  },
);

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
      return data; 
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.HSN_UPLOAD, details: extractErrorMessage(err) });
    }
  },
);

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

export const deleteHsnCode = createAsyncThunk(
  'pharmacyStore/deleteHsnCode',
  async (code, { rejectWithValue }) => {
    try {
      if (!code) return rejectWithValue({ message: 'HSN code is required' });
      const { data } = await API.delete(`${API_BASE}/hsn/${code}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.DELETE_HSN_CODE });
      return code; 
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.DELETE_HSN_CODE, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — FINANCIAL REPORTS & EARNINGS
// ═══════════════════════════════════════════════════════════════════════════════

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

export const fetchCodPending = createAsyncThunk(
  'pharmacyStore/fetchCodPending',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/financials/cod-pending`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_COD_PENDING });
      return data.data; // { summary, orders }
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_COD_PENDING, details: extractErrorMessage(err) });
    }
  },
);

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
// § ASYNC THUNKS — BANK SETTLEMENTS & PAYMENT ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

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

export const addUpiHandle = createAsyncThunk(
  'pharmacyStore/addUpiHandle',
  async ({ upiId, upiName, isPrimary }, { rejectWithValue }) => {
    try {
      if (!upiId) return rejectWithValue({ message: 'upiId is required' });
      const { data } = await API.post(`${API_BASE}/financials/payment-account/upi`, {
        upiId,
        ...(upiName                         && { upiName }),
        ...(typeof isPrimary === 'boolean' && { isPrimary }),
      });
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.ADD_UPI });
      return data.data.account;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.ADD_UPI, details: extractErrorMessage(err) });
    }
  },
);

export const deleteUpiHandle = createAsyncThunk(
  'pharmacyStore/deleteUpiHandle',
  async (upiHandleId, { rejectWithValue }) => {
    try {
      if (!upiHandleId) return rejectWithValue({ message: 'upiHandleId (_id) is required' });
      const { data } = await API.delete(`${API_BASE}/financials/payment-account/upi/${upiHandleId}`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.DELETE_UPI });
      return upiHandleId;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.DELETE_UPI, details: extractErrorMessage(err) });
    }
  },
);

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
// § ASYNC THUNKS — ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

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

export const fetchInventoryValue = createAsyncThunk(
  'pharmacyStore/fetchInventoryValue',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${API_BASE}/analytics/inventory-value`);
      if (!data.success) return rejectWithValue({ message: data.message || ERROR_MESSAGES.FETCH_INVENTORY_VALUE });
      return data.data;
    } catch (err) {
      return rejectWithValue({ message: ERROR_MESSAGES.FETCH_INVENTORY_VALUE, details: extractErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// § ASYNC THUNKS — PROFILE & STORE
// ═══════════════════════════════════════════════════════════════════════════════

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
// § ASYNC THUNKS — AUDIT: SESSIONS & DEVICES
// ═══════════════════════════════════════════════════════════════════════════════

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
  orderPricingBreakdown:    null,
  exportedOrder:            null,
  currentOrderInvoiceHtml:  null,
  currentOrderLabelHtml:    null,

  // ── Medicines & Inventory ──────────────────────────────────────────────────
  medicines:                [],
  medicinesPagination:      { ...DEFAULT_PAGINATION },
  medicineStockDetail:      null,
  medicineInventoryDetail:  null,
  inventoryBatches:         [],
  batchesPagination:        { ...DEFAULT_PAGINATION },
  expiryAlerts:             [],
  expiryAlertsMeta:         { count: 0, alertDays: 30 },
  lowStockItems:            [],
  lowStockMeta:             { count: 0, threshold: 5 },
  inventorySummary:         null,
  inventoryMovements:       [],
  movementsPagination:      { ...DEFAULT_PAGINATION },

  // ── Suppliers ──────────────────────────────────────────────────────────────
  suppliers:                [],
  suppliersPagination:      { ...DEFAULT_PAGINATION },
  currentSupplier:          null,

  // ── Purchase Orders ────────────────────────────────────────────────────────
  purchaseOrders:           [],
  purchaseOrdersPagination: { ...DEFAULT_PAGINATION },
  currentPurchaseOrder:     null,
  poReceivingResult:        null,

  // ── HSN Codes ──────────────────────────────────────────────────────────────
  hsnCodes:                 [],
  hsnCodesPagination:       { ...DEFAULT_PAGINATION },
  hsnCodesTotal:            0,
  hsnStats:                 null,
  currentHsnCode:           null,

  // ── Financials ─────────────────────────────────────────────────────────────
  dailyEarnings:            null,
  monthlyEarnings:          null,
  totalEarnings:            null,
  earningsHistory:          [],
  earningsHistoryPagination:{ ...DEFAULT_PAGINATION },
  earningsHistorySummary:   null,
  codPending:               null,
  storeInvoiceHtml:         null,

  // ── Payment Accounts ────────────────────────────────────────────────────────
  paymentAccount:           null,

  // ── Settlements ─────────────────────────────────────────────────────────────
  settlements:                 null,
  settlementHistory:           [],
  settlementHistoryPagination: { ...DEFAULT_PAGINATION },

  // ── Analytics ──────────────────────────────────────────────────────────────
  analyticsOverview:        null,
  revenueAnalytics:         null,
  returnAnalytics:          null,
  topMedicines:             [],
  inventoryValue:           null,

  // ── Profile ────────────────────────────────────────────────────────────────
  userProfile:              null,
  pharmacyProfile:          null,

  // ── Store ───────────────────────────────────────────────────────────────────
  store:                    null,

  // ── Audit & Security ────────────────────────────────────────────────────────
  sessions:                 [],
  devices:                  [],

  // ── Loading flags ───────────────────────────────────────────────────────────
  loading: {
    orders:                   false,
    orderDetails:             false,
    orderPricing:             false,
    prescription:             false,
    orderConfirm:             false,
    orderStatus:              false,
    returnAccept:             false,
    pickupVerify:             false,
    refund:                   false,
    orderNote:                false,
    driverAssign:             false,
    orderExport:              false,
    orderInvoice:             false,
    orderLabel:               false,
    medicines:                false,
    medicineStock:            false,
    medicineInventoryDetail:  false,
    addStock:                 false,
    deductStock:              false,
    updateMedicineInventory:  false,
    inventoryBatches:         false,
    updateBatch:              false,
    expiryAlerts:             false,
    lowStock:                 false,
    requestStock:             false,
    inventoryMovements:       false,
    inventorySummary:         false,
    suppliers:                false,
    supplierDetail:           false,
    createSupplier:           false,
    updateSupplier:           false,
    deleteSupplier:           false,
    purchaseOrders:           false,
    purchaseOrderDetail:      false,
    createPurchaseOrder:      false,
    updatePurchaseOrder:      false,
    receivePurchaseOrder:     false,
    hsnCodes:                 false,
    hsnStats:                 false,
    hsnCode:                  false,
    hsnCreate:                false,
    hsnUpdate:                false,
    hsnDelete:                false,
    hsnBulkDelete:            false,
    hsnUpload:                false,
    dailyEarnings:            false,
    monthlyEarnings:          false,
    totalEarnings:            false,
    earningsHistory:          false,
    codPending:               false,
    storeInvoice:             false,
    sendStoreInvoice:         false,
    paymentAccount:           false,
    bankAccount:              false,
    upiHandle:                false,
    settlements:              false,
    settlementRequest:        false,
    settlementHistory:        false,
    analyticsOverview:        false,
    analyticsRevenue:         false,
    analyticsReturns:         false,
    topMedicines:             false,
    inventoryValue:           false,
    profile:                  false,
    pharmacyProfile:          false,
    store:                    false,
    sessions:                 false,
    devices:                  false,
  },

  // ── Errors ──────────────────────────────────────────────────────────────────
  errors: {
    orders:                   null,
    orderDetails:             null,
    orderPricing:             null,
    prescription:             null,
    orderConfirm:             null,
    orderStatus:              null,
    returnAccept:             null,
    pickupVerify:             null,
    refund:                   null,
    orderNote:                null,
    driverAssign:             null,
    orderExport:              null,
    orderInvoice:             null,
    orderLabel:               null,
    medicines:                null,
    medicineStock:            null,
    medicineInventoryDetail:  null,
    addStock:                 null,
    deductStock:              null,
    updateMedicineInventory:  null,
    inventoryBatches:         null,
    updateBatch:              null,
    expiryAlerts:             null,
    lowStock:                 null,
    requestStock:             null,
    inventoryMovements:       null,
    inventorySummary:         null,
    suppliers:                null,
    supplierDetail:           null,
    createSupplier:           null,
    updateSupplier:           null,
    deleteSupplier:           null,
    purchaseOrders:           null,
    purchaseOrderDetail:      null,
    createPurchaseOrder:      null,
    updatePurchaseOrder:      null,
    receivePurchaseOrder:     null,
    hsnCodes:                 null,
    hsnStats:                 null,
    hsnCode:                  null,
    hsnCreate:                null,
    hsnUpdate:                null,
    hsnDelete:                null,
    hsnBulkDelete:            null,
    hsnUpload:                null,
    dailyEarnings:            null,
    monthlyEarnings:          null,
    totalEarnings:            null,
    earningsHistory:          null,
    codPending:               null,
    storeInvoice:             null,
    sendStoreInvoice:         null,
    paymentAccount:           null,
    bankAccount:              null,
    upiHandle:                null,
    settlements:              null,
    settlementRequest:        null,
    settlementHistory:        null,
    analyticsOverview:        null,
    analyticsRevenue:         null,
    analyticsReturns:         null,
    topMedicines:             null,
    inventoryValue:           null,
    profile:                  null,
    pharmacyProfile:          null,
    store:                    null,
    sessions:                 null,
    devices:                  null,
  },

  // ── One-shot success flags ───────────────────────────────────────────────────
  success: {
    prescription:             false,
    orderConfirm:             false,
    orderStatus:              false,
    returnAccept:             false,
    pickupVerify:             false,
    refund:                   false,
    orderNote:                false,
    driverAssign:             false,
    addStock:                 false,
    deductStock:              false,
    requestStock:             false,
    updateMedicineInventory:  false,
    updateBatch:              false,
    createSupplier:           false,
    updateSupplier:           false,
    deleteSupplier:           false,
    createPurchaseOrder:      false,
    updatePurchaseOrder:      false,
    receivePurchaseOrder:     false,
    sendStoreInvoice:         false,
    addBankAccount:           false,
    updateBankAccount:        false,
    deleteBankAccount:        false,
    addUpiHandle:             false,
    deleteUpiHandle:          false,
    settlementRequest:        false,
    profileUpdate:            false,
    pharmacyProfileUpdate:    false,
    passwordChange:           false,
    storeUpdate:              false,
    sessionRevoke:            false,
    logoutAll:                false,
    deviceRemove:             false,
    allDevicesRemoved:        false,
    hsnCreate:                false,
    hsnUpdate:                false,
    hsnDelete:                false,
    hsnBulkDelete:            false,
    hsnUpload:                false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const pharmacyStoreSlice = createSlice({
  name: 'pharmacyStore',
  initialState,
  reducers: {
    clearError: (state, { payload }) => {
      if (payload && payload in state.errors) state.errors[payload] = null;
    },
    clearSuccess: (state, { payload }) => {
      if (payload && payload in state.success) state.success[payload] = false;
    },
    clearAllErrors: (state) => {
      Object.keys(state.errors).forEach((k) => { state.errors[k] = null; });
    },
    clearAllSuccess: (state) => {
      Object.keys(state.success).forEach((k) => { state.success[k] = false; });
    },
    resetPharmacyStore: () => initialState,
    setCurrentOrder: (state, { payload }) => {
      state.currentOrder = payload;
    },
    clearCurrentOrder: (state) => {
      state.currentOrder            = null;
      state.orderPricingBreakdown   = null;
      state.currentOrderInvoiceHtml = null;
      state.currentOrderLabelHtml   = null;
    },
    clearOrderDocuments: (state) => {
      state.currentOrderInvoiceHtml = null;
      state.currentOrderLabelHtml   = null;
    },
    clearStoreInvoice: (state) => {
      state.storeInvoiceHtml = null;
    },
    clearCurrentHsnCode: (state) => {
      state.currentHsnCode = null;
    },
    clearExportedOrder: (state) => {
      state.exportedOrder = null;
    },
    clearCurrentSupplier: (state) => {
      state.currentSupplier = null;
    },
    clearCurrentPurchaseOrder: (state) => {
      state.currentPurchaseOrder = null;
      state.poReceivingResult = null;
    }
  },

  extraReducers: (builder) => {

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ ORDERS
    // ─────────────────────────────────────────────────────────────────────────

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

    builder
      .addCase(fetchOrderPricingBreakdown.pending, (state) => {
        state.loading.orderPricing = true;
        state.errors.orderPricing  = null;
      })
      .addCase(fetchOrderPricingBreakdown.fulfilled, (state, { payload }) => {
        state.loading.orderPricing = false;
        state.orderPricingBreakdown = payload;
      })
      .addCase(fetchOrderPricingBreakdown.rejected, (state, { payload }) => {
        state.loading.orderPricing = false;
        state.errors.orderPricing  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_ORDER_PRICING);
      });

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
    // ▶ MEDICINE & INVENTORY
    // ─────────────────────────────────────────────────────────────────────────

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

    builder
      .addCase(fetchMedicineInventoryDetail.pending, (state) => {
        state.loading.medicineInventoryDetail = true;
        state.errors.medicineInventoryDetail  = null;
      })
      .addCase(fetchMedicineInventoryDetail.fulfilled, (state, { payload }) => {
        state.loading.medicineInventoryDetail = false;
        state.medicineInventoryDetail         = payload;
      })
      .addCase(fetchMedicineInventoryDetail.rejected, (state, { payload }) => {
        state.loading.medicineInventoryDetail = false;
        state.errors.medicineInventoryDetail  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_MEDICINE_INVENTORY);
      });

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

    builder
      .addCase(updateMedicineInventory.pending, (state) => {
        state.loading.updateMedicineInventory = true;
        state.errors.updateMedicineInventory  = null;
        state.success.updateMedicineInventory = false;
      })
      .addCase(updateMedicineInventory.fulfilled, (state) => {
        state.loading.updateMedicineInventory = false;
        state.success.updateMedicineInventory = true;
        toast.success('Inventory updated successfully');
      })
      .addCase(updateMedicineInventory.rejected, (state, { payload }) => {
        state.loading.updateMedicineInventory = false;
        state.errors.updateMedicineInventory  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.UPDATE_MEDICINE_INVENTORY);
      });

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

    builder
      .addCase(updateBatch.pending, (state) => {
        state.loading.updateBatch = true;
        state.errors.updateBatch  = null;
        state.success.updateBatch = false;
      })
      .addCase(updateBatch.fulfilled, (state) => {
        state.loading.updateBatch = false;
        state.success.updateBatch = true;
        toast.success('Batch updated successfully');
      })
      .addCase(updateBatch.rejected, (state, { payload }) => {
        state.loading.updateBatch = false;
        state.errors.updateBatch  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.UPDATE_BATCH);
      });

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

    builder
      .addCase(fetchInventoryMovements.pending, (state) => {
        state.loading.inventoryMovements = true;
        state.errors.inventoryMovements  = null;
      })
      .addCase(fetchInventoryMovements.fulfilled, (state, { payload }) => {
        state.loading.inventoryMovements = false;
        state.inventoryMovements         = payload.movements  || [];
        state.movementsPagination        = payload.pagination || initialState.movementsPagination;
      })
      .addCase(fetchInventoryMovements.rejected, (state, { payload }) => {
        state.loading.inventoryMovements = false;
        state.errors.inventoryMovements  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_MOVEMENTS);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ SUPPLIERS
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(fetchSuppliers.pending, (state) => {
        state.loading.suppliers = true;
        state.errors.suppliers  = null;
      })
      .addCase(fetchSuppliers.fulfilled, (state, { payload }) => {
        state.loading.suppliers   = false;
        state.suppliers           = payload.suppliers || [];
        state.suppliersPagination = payload.pagination || initialState.suppliersPagination;
      })
      .addCase(fetchSuppliers.rejected, (state, { payload }) => {
        state.loading.suppliers = false;
        state.errors.suppliers  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_SUPPLIERS);
      });

    builder
      .addCase(fetchSupplier.pending, (state) => {
        state.loading.supplierDetail = true;
        state.errors.supplierDetail  = null;
      })
      .addCase(fetchSupplier.fulfilled, (state, { payload }) => {
        state.loading.supplierDetail = false;
        state.currentSupplier        = payload;
      })
      .addCase(fetchSupplier.rejected, (state, { payload }) => {
        state.loading.supplierDetail = false;
        state.errors.supplierDetail  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_SUPPLIERS);
      });

    builder
      .addCase(createSupplier.pending, (state) => {
        state.loading.createSupplier = true;
        state.errors.createSupplier  = null;
        state.success.createSupplier = false;
      })
      .addCase(createSupplier.fulfilled, (state) => {
        state.loading.createSupplier = false;
        state.success.createSupplier = true;
        toast.success('Supplier created successfully');
      })
      .addCase(createSupplier.rejected, (state, { payload }) => {
        state.loading.createSupplier = false;
        state.errors.createSupplier  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.CREATE_SUPPLIER);
      });

    builder
      .addCase(updateSupplier.pending, (state) => {
        state.loading.updateSupplier = true;
        state.errors.updateSupplier  = null;
        state.success.updateSupplier = false;
      })
      .addCase(updateSupplier.fulfilled, (state) => {
        state.loading.updateSupplier = false;
        state.success.updateSupplier = true;
        toast.success('Supplier updated successfully');
      })
      .addCase(updateSupplier.rejected, (state, { payload }) => {
        state.loading.updateSupplier = false;
        state.errors.updateSupplier  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.UPDATE_SUPPLIER);
      });

    builder
      .addCase(deactivateSupplier.pending, (state) => {
        state.loading.deleteSupplier = true;
        state.errors.deleteSupplier  = null;
        state.success.deleteSupplier = false;
      })
      .addCase(deactivateSupplier.fulfilled, (state) => {
        state.loading.deleteSupplier = false;
        state.success.deleteSupplier = true;
        toast.success('Supplier deactivated successfully');
      })
      .addCase(deactivateSupplier.rejected, (state, { payload }) => {
        state.loading.deleteSupplier = false;
        state.errors.deleteSupplier  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.DELETE_SUPPLIER);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ PURCHASE ORDERS
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(fetchPurchaseOrders.pending, (state) => {
        state.loading.purchaseOrders = true;
        state.errors.purchaseOrders  = null;
      })
      .addCase(fetchPurchaseOrders.fulfilled, (state, { payload }) => {
        state.loading.purchaseOrders   = false;
        state.purchaseOrders           = payload.purchaseOrders || [];
        state.purchaseOrdersPagination = payload.pagination || initialState.purchaseOrdersPagination;
      })
      .addCase(fetchPurchaseOrders.rejected, (state, { payload }) => {
        state.loading.purchaseOrders = false;
        state.errors.purchaseOrders  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_PURCHASE_ORDERS);
      });

    builder
      .addCase(fetchPurchaseOrder.pending, (state) => {
        state.loading.purchaseOrderDetail = true;
        state.errors.purchaseOrderDetail  = null;
      })
      .addCase(fetchPurchaseOrder.fulfilled, (state, { payload }) => {
        state.loading.purchaseOrderDetail = false;
        state.currentPurchaseOrder        = payload;
      })
      .addCase(fetchPurchaseOrder.rejected, (state, { payload }) => {
        state.loading.purchaseOrderDetail = false;
        state.errors.purchaseOrderDetail  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_PURCHASE_ORDER);
      });

    builder
      .addCase(createPurchaseOrder.pending, (state) => {
        state.loading.createPurchaseOrder = true;
        state.errors.createPurchaseOrder  = null;
        state.success.createPurchaseOrder = false;
      })
      .addCase(createPurchaseOrder.fulfilled, (state) => {
        state.loading.createPurchaseOrder = false;
        state.success.createPurchaseOrder = true;
        toast.success('Purchase order created successfully');
      })
      .addCase(createPurchaseOrder.rejected, (state, { payload }) => {
        state.loading.createPurchaseOrder = false;
        state.errors.createPurchaseOrder  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.CREATE_PURCHASE_ORDER);
      });

    builder
      .addCase(updatePurchaseOrderStatus.pending, (state) => {
        state.loading.updatePurchaseOrder = true;
        state.errors.updatePurchaseOrder  = null;
        state.success.updatePurchaseOrder = false;
      })
      .addCase(updatePurchaseOrderStatus.fulfilled, (state) => {
        state.loading.updatePurchaseOrder = false;
        state.success.updatePurchaseOrder = true;
        toast.success('Purchase order status updated');
      })
      .addCase(updatePurchaseOrderStatus.rejected, (state, { payload }) => {
        state.loading.updatePurchaseOrder = false;
        state.errors.updatePurchaseOrder  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.UPDATE_PO_STATUS);
      });

    builder
      .addCase(receivePurchaseOrderStock.pending, (state) => {
        state.loading.receivePurchaseOrder = true;
        state.errors.receivePurchaseOrder  = null;
        state.success.receivePurchaseOrder = false;
      })
      .addCase(receivePurchaseOrderStock.fulfilled, (state, { payload }) => {
        state.loading.receivePurchaseOrder = false;
        state.success.receivePurchaseOrder = true;
        state.poReceivingResult            = payload;
        toast.success('Stock received for Purchase Order');
      })
      .addCase(receivePurchaseOrderStock.rejected, (state, { payload }) => {
        state.loading.receivePurchaseOrder = false;
        state.errors.receivePurchaseOrder  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.RECEIVE_PO_STOCK);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ HSN CODE MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

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

    builder
      .addCase(createHsnCode.pending, (state) => {
        state.loading.hsnCreate = true;
        state.errors.hsnCreate  = null;
        state.success.hsnCreate = false;
      })
      .addCase(createHsnCode.fulfilled, (state, { payload }) => {
        state.loading.hsnCreate = false;
        state.success.hsnCreate = true;
        state.hsnCodes.unshift(payload);
        state.hsnCodesTotal += 1;
        toast.success(`HSN code ${payload?.hsnCode} created`);
      })
      .addCase(createHsnCode.rejected, (state, { payload }) => {
        state.loading.hsnCreate = false;
        state.errors.hsnCreate  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.CREATE_HSN_CODE);
      });

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
    // ▶ FINANCIALS
    // ─────────────────────────────────────────────────────────────────────────

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

    builder
      .addCase(fetchCodPending.pending, (state) => {
        state.loading.codPending = true;
        state.errors.codPending  = null;
      })
      .addCase(fetchCodPending.fulfilled, (state, { payload }) => {
        state.loading.codPending = false;
        state.codPending         = payload;
      })
      .addCase(fetchCodPending.rejected, (state, { payload }) => {
        state.loading.codPending = false;
        state.errors.codPending  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_COD_PENDING);
      });

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
    // ▶ PAYMENT ACCOUNTS
    // ─────────────────────────────────────────────────────────────────────────

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
    // ▶ SETTLEMENTS
    // ─────────────────────────────────────────────────────────────────────────

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

    builder
      .addCase(requestSettlement.pending, (state) => {
        state.loading.settlementRequest = true;
        state.errors.settlementRequest  = null;
        state.success.settlementRequest = false;
      })
      .addCase(requestSettlement.fulfilled, (state, { payload }) => {
        state.loading.settlementRequest = false;
        state.success.settlementRequest = true;
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
    // ▶ ANALYTICS
    // ─────────────────────────────────────────────────────────────────────────

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

    builder
      .addCase(fetchInventoryValue.pending, (state) => {
        state.loading.inventoryValue = true;
        state.errors.inventoryValue  = null;
      })
      .addCase(fetchInventoryValue.fulfilled, (state, { payload }) => {
        state.loading.inventoryValue = false;
        state.inventoryValue         = payload;
      })
      .addCase(fetchInventoryValue.rejected, (state, { payload }) => {
        state.loading.inventoryValue = false;
        state.errors.inventoryValue  = payload;
        toast.error(payload?.message || ERROR_MESSAGES.FETCH_INVENTORY_VALUE);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // ▶ PROFILE & STORE
    // ─────────────────────────────────────────────────────────────────────────

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
    // ▶ AUDIT: SESSIONS & DEVICES
    // ─────────────────────────────────────────────────────────────────────────

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
        toast.success('Logged out from all devices');
      })
      .addCase(logoutAllDevices.rejected, (state, { payload }) => {
        state.loading.sessions = false;
        state.loading.devices  = false;
        toast.error(payload?.message || ERROR_MESSAGES.LOGOUT_ALL);
      });

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
  clearCurrentSupplier,
  clearCurrentPurchaseOrder,
} = pharmacyStoreSlice.actions;

// ═══════════════════════════════════════════════════════════════════════════════
// § EXPORTS — REDUCER
// ═══════════════════════════════════════════════════════════════════════════════

export default pharmacyStoreSlice.reducer;