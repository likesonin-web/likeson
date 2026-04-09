import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─── Base URL ─────────────────────────────────────────────────────────────────

const BASE = '/user/pharmacy';

// ─── API helper (always sends auth token) ────────────────────────────────────

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ─── Multipart headers (for file uploads) ────────────────────────────────────

const multipartHeaders = () => ({
  ...authHeaders(),
  'Content-Type': 'multipart/form-data',
});

// ─── Generic error extractor ──────────────────────────────────────────────────

const extractError = (err) =>
  err?.response?.data?.message || err?.message || 'Something went wrong.';

// ══════════════════════════════════════════════════════════════════════════════
// THUNKS
// ══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 0a. GET /upload/auth
// Fetches ImageKit authentication parameters for client-side direct uploads.
// Returns: { token, expire, signature, publicKey, urlEndpoint }
// ─────────────────────────────────────────────────────────────────────────────

export const fetchUploadAuth = createAsyncThunk(
  'pharmacy/fetchUploadAuth',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/upload/auth`, {
        headers: authHeaders(),
      });
      return data; // { token, expire, signature, publicKey, urlEndpoint }
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 0b. POST /upload/prescription
// Uploads a prescription file to ImageKit via the server.
// Accepts a File object (multipart) OR a { base64, fileName } object.
//
// Usage A — File object (from <input type="file">):
//   dispatch(uploadPrescriptionFile({ file: fileObj }))
//
// Usage B — Base64 string:
//   dispatch(uploadPrescriptionFile({ base64: '...', fileName: 'rx.jpg' }))
//
// Returns: { imageUrl, fileName, size?, mimeType? }
// ─────────────────────────────────────────────────────────────────────────────

export const uploadPrescriptionFile = createAsyncThunk(
  'pharmacy/uploadPrescriptionFile',
  async ({ file, base64, fileName, mimeType }, { rejectWithValue }) => {
    try {
      let data;

      if (file) {
        // ── Multipart upload ─────────────────────────────────────────────────
        const formData = new FormData();
        formData.append('prescription', file);

        const response = await API.post(`${BASE}/upload/prescription`, formData, {
          headers: multipartHeaders(),
        });
        data = response.data;
      } else if (base64) {
        // ── Base64 JSON upload ───────────────────────────────────────────────
        const response = await API.post(
          `${BASE}/upload/prescription`,
          { base64, fileName: fileName || 'prescription.jpg', mimeType: mimeType || 'image/jpeg' },
          { headers: authHeaders() },
        );
        data = response.data;
      } else {
        return rejectWithValue('Provide either a file or a base64 string.');
      }

      toast.success('Prescription uploaded successfully.');
      return data; // { success, imageUrl, fileName, size, mimeType }
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /medicines
// Query params: search, category, storeId, page, limit, sort
// ─────────────────────────────────────────────────────────────────────────────

export const fetchMedicines = createAsyncThunk(
  'pharmacy/fetchMedicines',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/medicines`, { params });
      return data; // { success, pagination, medicines }
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /cart
// Returns cart with populated items + prescriptionSummary
// ─────────────────────────────────────────────────────────────────────────────

export const fetchCart = createAsyncThunk(
  'pharmacy/fetchCart',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/cart`, {
        headers: authHeaders(),
      });
      return data.cart;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /cart/add
// Body: { medicineId, quantity, storeId, prescription?: { imageUrl } }
// NOTE: no auth required — works for guests too
// ─────────────────────────────────────────────────────────────────────────────

export const addToCart = createAsyncThunk(
  'pharmacy/addToCart',
  async ({ medicineId, quantity = 1, storeId, prescription }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/cart/add`,
        { medicineId, quantity, storeId, prescription },
        { headers: authHeaders() },
      );
      if (!data.isGuest) {
        toast.success('Added to cart!');
      }
      return data;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /cart/update
// Body: { medicineId, quantity }  — quantity=0 removes the item
// ─────────────────────────────────────────────────────────────────────────────

export const updateCartItem = createAsyncThunk(
  'pharmacy/updateCartItem',
  async ({ medicineId, quantity }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/cart/update`,
        { medicineId, quantity },
        { headers: authHeaders() },
      );
      return data.cart;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4b. POST /cart/update (quantity = 0) — dedicated "remove" thunk
// ─────────────────────────────────────────────────────────────────────────────

export const removeCartItem = createAsyncThunk(
  'pharmacy/removeCartItem',
  async ({ medicineId, medicineName }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/cart/update`,
        { medicineId, quantity: 0 },
        { headers: authHeaders() },
      );
      toast.success(`${medicineName ?? 'Item'} removed from cart.`);
      return data.cart;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /cart — clears entire cart
// ─────────────────────────────────────────────────────────────────────────────

export const purgeCart = createAsyncThunk(
  'pharmacy/purgeCart',
  async (_, { rejectWithValue }) => {
    try {
      await API.delete(`${BASE}/cart`, { headers: authHeaders() });
      toast.success('Cart cleared.');
      return true;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 5a. POST /cart/prescription
// Attach an already-uploaded prescription imageUrl to a cart item.
// Use uploadPrescriptionFile() first to get the URL, then call this.
// Body: { medicineId, imageUrl }
// ─────────────────────────────────────────────────────────────────────────────

export const uploadCartItemPrescription = createAsyncThunk(
  'pharmacy/uploadCartItemPrescription',
  async ({ medicineId, imageUrl }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/cart/prescription`,
        { medicineId, imageUrl },
        { headers: authHeaders() },
      );
      toast.success('Prescription saved to cart.');
      return data.cart;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 5b. POST /cart/prescription/upload
// All-in-one: upload prescription file + save to cart item in one request.
// Accepts: { medicineId, file } — where file is a File object.
// Returns: { imageUrl, cart }
// ─────────────────────────────────────────────────────────────────────────────

export const uploadCartItemPrescriptionFile = createAsyncThunk(
  'pharmacy/uploadCartItemPrescriptionFile',
  async ({ medicineId, file }, { rejectWithValue }) => {
    try {
      if (!file) return rejectWithValue('No file provided.');
      if (!medicineId) return rejectWithValue('medicineId is required.');

      const formData = new FormData();
      formData.append('prescription', file);
      formData.append('medicineId', medicineId);

      const { data } = await API.post(
        `${BASE}/cart/prescription/upload`,
        formData,
        { headers: multipartHeaders() },
      );
      toast.success('Prescription uploaded and saved to cart.');
      return data; // { success, imageUrl, cart }
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /coupon/validate
// Body: { couponCode, orderTotal }
// ─────────────────────────────────────────────────────────────────────────────

export const validateCoupon = createAsyncThunk(
  'pharmacy/validateCoupon',
  async ({ couponCode, orderTotal }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/coupon/validate`,
        { couponCode, orderTotal },
        { headers: authHeaders() },
      );
      toast.success(data.message || 'Coupon applied!');
      return {
        code:           data.couponCode,
        discountAmount: data.discountAmount,
        benefitType:    data.benefitType,
        benefitValue:   data.benefitValue,
        maxCap:         data.maxCap,
        finalTotal:     data.finalTotal,
      };
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /order/checkout
// Body: { address, paymentMethod, couponCode? }
// ─────────────────────────────────────────────────────────────────────────────

export const checkoutCart = createAsyncThunk(
  'pharmacy/checkoutCart',
  async ({ address, paymentMethod, couponCode }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/checkout`,
        { address, paymentMethod, couponCode },
        { headers: authHeaders() },
      );
      return data; // { success, order, razorpayKey }
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /order/verify (Razorpay payment verification for cart checkout)
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// ─────────────────────────────────────────────────────────────────────────────

export const verifyPayment = createAsyncThunk(
  'pharmacy/verifyPayment',
  async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/verify`,
        { razorpay_order_id, razorpay_payment_id, razorpay_signature },
        { headers: authHeaders() },
      );
      toast.success('Payment verified! Order confirmed.');
      return data.order;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. POST /wallet/pay (wallet payment for an existing order)
// Body: { orderId }
// ─────────────────────────────────────────────────────────────────────────────

export const payViaWallet = createAsyncThunk(
  'pharmacy/payViaWallet',
  async ({ orderId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/wallet/pay`,
        { orderId },
        { headers: authHeaders() },
      );
      toast.success('Payment successful via wallet!');
      return data.order;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. GET /orders/my-orders
// Query params: page, limit, status
// ─────────────────────────────────────────────────────────────────────────────

export const fetchMyOrders = createAsyncThunk(
  'pharmacy/fetchMyOrders',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/orders/my-orders`, {
        params,
        headers: authHeaders(),
      });
      return data; // { success, pagination, orders }
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET /orders/:id
// ─────────────────────────────────────────────────────────────────────────────

export const fetchOrderById = createAsyncThunk(
  'pharmacy/fetchOrderById',
  async (orderId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/orders/${orderId}`, {
        headers: authHeaders(),
      });
      return data.order;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 11a. POST /order/upload-prescription
// Attach an already-uploaded prescription imageUrl to an existing order.
// Use uploadPrescriptionFile() first to get the imageUrl, then call this.
// Body: { orderId, imageUrl }
// ─────────────────────────────────────────────────────────────────────────────

export const uploadOrderPrescription = createAsyncThunk(
  'pharmacy/uploadOrderPrescription',
  async ({ orderId, imageUrl }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/upload-prescription`,
        { orderId, imageUrl },
        { headers: authHeaders() },
      );
      toast.success('Prescription uploaded. Pending pharmacist verification.');
      return data.prescription;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 11b. POST /order/upload-prescription/file
// All-in-one: upload prescription file to ImageKit + attach to order.
// Accepts: { orderId, file } — file is a File object from <input type="file">
// Returns: { imageUrl, prescription }
// ─────────────────────────────────────────────────────────────────────────────

export const uploadOrderPrescriptionFile = createAsyncThunk(
  'pharmacy/uploadOrderPrescriptionFile',
  async ({ orderId, file }, { rejectWithValue }) => {
    try {
      if (!file)    return rejectWithValue('No file provided.');
      if (!orderId) return rejectWithValue('orderId is required.');

      const formData = new FormData();
      formData.append('prescription', file);
      formData.append('orderId', orderId);

      const { data } = await API.post(
        `${BASE}/order/upload-prescription/file`,
        formData,
        { headers: multipartHeaders() },
      );
      toast.success('Prescription uploaded. Pending pharmacist verification.');
      return data; // { success, imageUrl, prescription }
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 11c. POST /order/verify-prescription (Pharmacist / Admin only)
// Body: { orderId, action: 'approve' | 'reject', notes?, rejectionReason? }
// ─────────────────────────────────────────────────────────────────────────────

export const verifyOrderPrescription = createAsyncThunk(
  'pharmacy/verifyOrderPrescription',
  async ({ orderId, action, notes = '', rejectionReason = '' }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/verify-prescription`,
        { orderId, action, notes, rejectionReason },
        { headers: authHeaders() },
      );
      toast.success(data.message);
      return data.prescription;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 12. POST /order/cancel
// Body: { orderId, reason? }
// ─────────────────────────────────────────────────────────────────────────────

export const cancelOrder = createAsyncThunk(
  'pharmacy/cancelOrder',
  async ({ orderId, reason = 'Customer requested cancellation' }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/cancel`,
        { orderId, reason },
        { headers: authHeaders() },
      );
      toast.success('Order cancelled successfully.');
      return data.order;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 13. POST /order/request-return
// Body:
//   orderId        {string}   required
//   returnReason   {string}   required, min 10 chars
//   evidence       {Array}    required — [{ mediaType: 'image'|'video', url }]
//   refundMethod   {string}   required — 'Wallet'|'Online'|'Bank_Transfer'|'Custom_Bank'
//   bankDetails    {Object?}  required for Bank_Transfer/Custom_Bank
// ─────────────────────────────────────────────────────────────────────────────

export const requestReturn = createAsyncThunk(
  'pharmacy/requestReturn',
  async ({ orderId, returnReason, evidence, refundMethod, bankDetails }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/request-return`,
        { orderId, returnReason, evidence, refundMethod, bankDetails },
        { headers: authHeaders() },
      );
      toast.success('Return request submitted successfully.');
      return data.order;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 14. POST /order/approve-return (Pharmacist / Admin only)
// Body: { orderId, decision: 'Accepted' | 'Rejected', notes? }
// ─────────────────────────────────────────────────────────────────────────────

export const approveReturn = createAsyncThunk(
  'pharmacy/approveReturn',
  async ({ orderId, decision, notes = '' }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/approve-return`,
        { orderId, decision, notes },
        { headers: authHeaders() },
      );
      toast.success(`Return request ${decision.toLowerCase()} successfully.`);
      return data.order;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 15. POST /order/verify-pickup (Store_Manager / Pharmacist / Admin only)
// Body: { orderId, conditionGood?: boolean, notes?: string }
// ─────────────────────────────────────────────────────────────────────────────

export const verifyPickup = createAsyncThunk(
  'pharmacy/verifyPickup',
  async ({ orderId, conditionGood = true, notes = '' }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/verify-pickup`,
        { orderId, conditionGood, notes },
        { headers: authHeaders() },
      );
      toast.success(data.message);
      return data.order;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 16. POST /order/submit-feedback
// Body: { orderId, rating (1-5), comment? }
// ─────────────────────────────────────────────────────────────────────────────

export const submitFeedback = createAsyncThunk(
  'pharmacy/submitFeedback',
  async ({ orderId, rating, comment = '' }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/submit-feedback`,
        { orderId, rating, comment },
        { headers: authHeaders() },
      );
      toast.success('Thank you for your feedback!');
      return data.order;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 17. POST /wallet/add-money
// Body: { amount } — creates a Razorpay order for the top-up
// ─────────────────────────────────────────────────────────────────────────────

export const addMoneyToWallet = createAsyncThunk(
  'pharmacy/addMoneyToWallet',
  async ({ amount }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/wallet/add-money`,
        { amount },
        { headers: authHeaders() },
      );
      return data; // { success, rzpOrder, razorpayKey }
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 18. POST /wallet/verify-topup
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount }
// ─────────────────────────────────────────────────────────────────────────────

export const verifyWalletTopup = createAsyncThunk(
  'pharmacy/verifyWalletTopup',
  async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature, amount }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/wallet/verify-topup`,
        { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount },
        { headers: authHeaders() },
      );
      toast.success(`Wallet topped up with ₹${amount}!`);
      return data.wallet;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 19. POST /order/direct
// Body: { medicineId, quantity, address, paymentMethod, storeId,
//         couponCode?, prescription?: { imageUrl } }
// ─────────────────────────────────────────────────────────────────────────────

export const placeDirectOrder = createAsyncThunk(
  'pharmacy/placeDirectOrder',
  async (
    { medicineId, quantity, address, paymentMethod = 'Razorpay', storeId, couponCode, prescription },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/direct`,
        { medicineId, quantity, address, paymentMethod, storeId, couponCode, prescription },
        { headers: authHeaders() },
      );
      return data; // { success, order, razorpayKey }
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 20. POST /order/direct/verify (Razorpay verification for direct orders)
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// ─────────────────────────────────────────────────────────────────────────────

export const verifyDirectPayment = createAsyncThunk(
  'pharmacy/verifyDirectPayment',
  async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/direct/verify`,
        { razorpay_order_id, razorpay_payment_id, razorpay_signature },
        { headers: authHeaders() },
      );
      toast.success('Payment verified! Order confirmed.');
      return data.order;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 21. POST /order/verify-delivery-otp
// Body: { orderId, otp }
// ─────────────────────────────────────────────────────────────────────────────

export const verifyDeliveryOtp = createAsyncThunk(
  'pharmacy/verifyDeliveryOtp',
  async ({ orderId, otp }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/order/verify-delivery-otp`,
        { orderId, otp },
        { headers: authHeaders() },
      );
      toast.success('Delivery confirmed! Order marked as Delivered.');
      return data.order;
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 22. GET /orders/:id/invoice
// Returns raw HTML string for in-browser viewing + print-to-PDF.
// ─────────────────────────────────────────────────────────────────────────────

export const fetchOrderInvoice = createAsyncThunk(
  'pharmacy/fetchOrderInvoice',
  async (orderId, { rejectWithValue }) => {
    try {
      const { data, headers } = await API.get(`${BASE}/orders/${orderId}/invoice`, {
        headers: { ...authHeaders(), Accept: 'text/html' },
        responseType: 'text',
      });
      // The server may set X-Invoice-Url header with the permanent CDN URL
      const invoiceUrl = headers?.['x-invoice-url'] || null;
      return { orderId, html: data, invoiceUrl };
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 22a. GET /orders/:id/invoice/download
// Triggers browser file download of the invoice HTML.
// ─────────────────────────────────────────────────────────────────────────────

export const downloadOrderInvoice = createAsyncThunk(
  'pharmacy/downloadOrderInvoice',
  async (orderId, { rejectWithValue }) => {
    try {
      const response = await API.get(`${BASE}/orders/${orderId}/invoice/download`, {
        headers: { ...authHeaders(), Accept: 'text/html' },
        responseType: 'blob',
      });

      // Trigger browser download
      const url      = window.URL.createObjectURL(new Blob([response.data], { type: 'text/html' }));
      const link     = document.createElement('a');
      link.href      = url;
      link.download  = `invoice-${orderId}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Invoice downloaded!');
      return { orderId };
    } catch (err) {
      const msg = extractError(err);
      toast.error(msg);
      return rejectWithValue(msg);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // ── Medicines list ──
  medicines:  [],
  pagination: { total: 0, pages: 1, page: 1, limit: 12 },

  // ── Cart ──
  cart: {
    items:      [],
    store:      null,
    billSummary: {
      itemsTotal:   0,
      estimatedTax: 0,
      totalAmount:  0,
    },
    prescriptionSummary: {
      hasRxItems:     false,
      missingUploads: [],
    },
  },

  // ── Current order ──
  currentOrder: null,

  // ── Invoice ──
  invoiceData:    null,   // { orderId, html, invoiceUrl? }
  invoiceLoading: false,
  invoiceError:   null,

  // ── Orders list ──
  orders:           [],
  ordersPagination: { total: 0, pages: 1, page: 1, limit: 10 },

  // ── Coupon ──
  coupon: {
    code:           null,
    discountAmount: 0,
    benefitType:    null,
    benefitValue:   null,
    maxCap:         null,
    finalTotal:     null,
  },

  // ── Wallet top-up Razorpay order (transient) ──
  walletTopupOrder: null,

  // ── Prescription upload (transient) ──
  // Holds the last successfully uploaded prescription URL (use to chain calls)
  prescriptionUpload: {
    imageUrl:  null,
    fileName:  null,
    mimeType:  null,
    loading:   false,
    error:     null,
  },

  // ── ImageKit auth params (for client-side direct upload) ──
  uploadAuth: {
    token:       null,
    expire:      null,
    signature:   null,
    publicKey:   null,
    urlEndpoint: null,
    loading:     false,
    error:       null,
  },

  // ── Loading / error flags ──
  globalLoading:  false,
  actionLoading:  false,
  couponLoading:  false,
  couponError:    null,
  orderError:     null,
  paymentError:   null,
  error:          null,
};

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const patchOrderInList = (state, updatedOrder) => {
  if (!updatedOrder) return;
  const idx = state.orders.findIndex(
    (o) => o._id === updatedOrder._id || o.orderId === updatedOrder.orderId,
  );
  if (idx !== -1) state.orders[idx] = updatedOrder;
  if (
    state.currentOrder &&
    (state.currentOrder._id === updatedOrder._id ||
      state.currentOrder.orderId === updatedOrder.orderId)
  ) {
    state.currentOrder = updatedOrder;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// SLICE
// ══════════════════════════════════════════════════════════════════════════════

const pharmacyOrderSlice = createSlice({
  name: 'pharmacyOrder',
  initialState,

  reducers: {
    clearCoupon(state) {
      state.coupon      = initialState.coupon;
      state.couponError = null;
    },
    clearPharmacyErrors(state) {
      state.orderError   = null;
      state.paymentError = null;
      state.couponError  = null;
      state.invoiceError = null;
      state.error        = null;
      state.prescriptionUpload.error = null;
      state.uploadAuth.error         = null;
    },
    clearCurrentOrder(state) {
      state.currentOrder = null;
    },
    clearInvoiceData(state) {
      state.invoiceData  = null;
      state.invoiceError = null;
    },
    // Clear the transient prescription upload result (e.g. after attaching to cart/order)
    clearPrescriptionUpload(state) {
      state.prescriptionUpload = initialState.prescriptionUpload;
    },
  },

  extraReducers: (builder) => {

    // ─────────────────────────────────────────────────────────────────────────
    // 0a. fetchUploadAuth
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(fetchUploadAuth.pending, (state) => {
        state.uploadAuth.loading = true;
        state.uploadAuth.error   = null;
      })
      .addCase(fetchUploadAuth.fulfilled, (state, { payload }) => {
        state.uploadAuth.loading     = false;
        state.uploadAuth.token       = payload.token       ?? null;
        state.uploadAuth.expire      = payload.expire      ?? null;
        state.uploadAuth.signature   = payload.signature   ?? null;
        state.uploadAuth.publicKey   = payload.publicKey   ?? null;
        state.uploadAuth.urlEndpoint = payload.urlEndpoint ?? null;
      })
      .addCase(fetchUploadAuth.rejected, (state, { payload }) => {
        state.uploadAuth.loading = false;
        state.uploadAuth.error   = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 0b. uploadPrescriptionFile
    // Stores the resulting imageUrl so the component can chain the next call.
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(uploadPrescriptionFile.pending, (state) => {
        state.prescriptionUpload.loading  = true;
        state.prescriptionUpload.error    = null;
        state.prescriptionUpload.imageUrl = null;
      })
      .addCase(uploadPrescriptionFile.fulfilled, (state, { payload }) => {
        state.prescriptionUpload.loading  = false;
        state.prescriptionUpload.imageUrl = payload.imageUrl ?? null;
        state.prescriptionUpload.fileName = payload.fileName ?? null;
        state.prescriptionUpload.mimeType = payload.mimeType ?? null;
      })
      .addCase(uploadPrescriptionFile.rejected, (state, { payload }) => {
        state.prescriptionUpload.loading = false;
        state.prescriptionUpload.error   = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 1. fetchMedicines
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(fetchMedicines.pending, (state) => {
        state.globalLoading = true;
        state.error         = null;
      })
      .addCase(fetchMedicines.fulfilled, (state, { payload }) => {
        state.globalLoading = false;
        state.medicines     = payload.medicines ?? [];
        state.pagination    = payload.pagination ?? initialState.pagination;
      })
      .addCase(fetchMedicines.rejected, (state, { payload }) => {
        state.globalLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. fetchCart
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(fetchCart.pending, (state) => {
        state.globalLoading = true;
        state.error         = null;
      })
      .addCase(fetchCart.fulfilled, (state, { payload }) => {
        state.globalLoading = false;
        state.cart          = payload ?? initialState.cart;
      })
      .addCase(fetchCart.rejected, (state, { payload }) => {
        state.globalLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. addToCart
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(addToCart.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(addToCart.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (!payload.isGuest && payload.cart) {
          state.cart = payload.cart;
        }
      })
      .addCase(addToCart.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. updateCartItem
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(updateCartItem.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(updateCartItem.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (payload) state.cart = payload;
      })
      .addCase(updateCartItem.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 4b. removeCartItem
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(removeCartItem.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(removeCartItem.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (payload) state.cart = payload;
      })
      .addCase(removeCartItem.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. purgeCart
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(purgeCart.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(purgeCart.fulfilled, (state) => {
        state.actionLoading = false;
        state.cart          = initialState.cart;
        state.coupon        = initialState.coupon;
      })
      .addCase(purgeCart.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 5a. uploadCartItemPrescription (URL-attach only)
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(uploadCartItemPrescription.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(uploadCartItemPrescription.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (payload) state.cart = payload;
      })
      .addCase(uploadCartItemPrescription.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 5b. uploadCartItemPrescriptionFile (file upload + attach in one shot)
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(uploadCartItemPrescriptionFile.pending, (state) => {
        state.prescriptionUpload.loading  = true;
        state.prescriptionUpload.error    = null;
        state.prescriptionUpload.imageUrl = null;
        state.actionLoading               = true;
      })
      .addCase(uploadCartItemPrescriptionFile.fulfilled, (state, { payload }) => {
        state.prescriptionUpload.loading  = false;
        state.prescriptionUpload.imageUrl = payload.imageUrl ?? null;
        state.actionLoading               = false;
        // payload.cart is the full updated cart
        if (payload.cart) state.cart = payload.cart;
      })
      .addCase(uploadCartItemPrescriptionFile.rejected, (state, { payload }) => {
        state.prescriptionUpload.loading = false;
        state.prescriptionUpload.error   = payload;
        state.actionLoading              = false;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 6. validateCoupon
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(validateCoupon.pending, (state) => {
        state.couponLoading = true;
        state.couponError   = null;
      })
      .addCase(validateCoupon.fulfilled, (state, { payload }) => {
        state.couponLoading = false;
        state.coupon        = payload;
      })
      .addCase(validateCoupon.rejected, (state, { payload }) => {
        state.couponLoading = false;
        state.couponError   = payload;
        state.coupon        = initialState.coupon;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 7. checkoutCart
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(checkoutCart.pending, (state) => {
        state.actionLoading = true;
        state.orderError    = null;
        state.paymentError  = null;
      })
      .addCase(checkoutCart.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.currentOrder  = payload.order ?? null;
        if (payload.order?.payment?.method !== 'Razorpay') {
          state.cart   = initialState.cart;
          state.coupon = initialState.coupon;
        }
      })
      .addCase(checkoutCart.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.orderError    = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 8. verifyPayment
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(verifyPayment.pending, (state) => {
        state.actionLoading = true;
        state.paymentError  = null;
      })
      .addCase(verifyPayment.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.currentOrder  = payload ?? state.currentOrder;
        state.cart          = initialState.cart;
        state.coupon        = initialState.coupon;
      })
      .addCase(verifyPayment.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.paymentError  = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 9. payViaWallet
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(payViaWallet.pending, (state) => {
        state.actionLoading = true;
        state.paymentError  = null;
      })
      .addCase(payViaWallet.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.currentOrder  = payload ?? state.currentOrder;
        state.cart          = initialState.cart;
        state.coupon        = initialState.coupon;
      })
      .addCase(payViaWallet.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.paymentError  = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 10. fetchMyOrders
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(fetchMyOrders.pending, (state) => {
        state.globalLoading = true;
        state.error         = null;
      })
      .addCase(fetchMyOrders.fulfilled, (state, { payload }) => {
        state.globalLoading    = false;
        state.orders           = payload.orders ?? [];
        state.ordersPagination = payload.pagination ?? initialState.ordersPagination;
      })
      .addCase(fetchMyOrders.rejected, (state, { payload }) => {
        state.globalLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 11. fetchOrderById
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(fetchOrderById.pending, (state) => {
        state.globalLoading = true;
        state.orderError    = null;
      })
      .addCase(fetchOrderById.fulfilled, (state, { payload }) => {
        state.globalLoading = false;
        state.currentOrder  = payload ?? null;
        patchOrderInList(state, payload);
      })
      .addCase(fetchOrderById.rejected, (state, { payload }) => {
        state.globalLoading = false;
        state.orderError    = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 11a. uploadOrderPrescription (URL-attach only)
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(uploadOrderPrescription.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(uploadOrderPrescription.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.currentOrder && payload) {
          state.currentOrder.prescription = payload;
        }
      })
      .addCase(uploadOrderPrescription.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 11b. uploadOrderPrescriptionFile (file upload + attach in one shot)
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(uploadOrderPrescriptionFile.pending, (state) => {
        state.prescriptionUpload.loading  = true;
        state.prescriptionUpload.error    = null;
        state.prescriptionUpload.imageUrl = null;
        state.actionLoading               = true;
      })
      .addCase(uploadOrderPrescriptionFile.fulfilled, (state, { payload }) => {
        state.prescriptionUpload.loading  = false;
        state.prescriptionUpload.imageUrl = payload.imageUrl ?? null;
        state.actionLoading               = false;
        if (state.currentOrder && payload.prescription) {
          state.currentOrder.prescription = payload.prescription;
        }
      })
      .addCase(uploadOrderPrescriptionFile.rejected, (state, { payload }) => {
        state.prescriptionUpload.loading = false;
        state.prescriptionUpload.error   = payload;
        state.actionLoading              = false;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 11c. verifyOrderPrescription (Pharmacist / Admin)
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(verifyOrderPrescription.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(verifyOrderPrescription.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.currentOrder && payload) {
          state.currentOrder.prescription = payload;
        }
      })
      .addCase(verifyOrderPrescription.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 12. cancelOrder
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(cancelOrder.pending, (state) => {
        state.actionLoading = true;
        state.orderError    = null;
      })
      .addCase(cancelOrder.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        patchOrderInList(state, payload);
      })
      .addCase(cancelOrder.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.orderError    = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 13. requestReturn
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(requestReturn.pending, (state) => {
        state.actionLoading = true;
        state.orderError    = null;
      })
      .addCase(requestReturn.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        patchOrderInList(state, payload);
      })
      .addCase(requestReturn.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.orderError    = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 14. approveReturn
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(approveReturn.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(approveReturn.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        patchOrderInList(state, payload);
      })
      .addCase(approveReturn.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 15. verifyPickup
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(verifyPickup.pending, (state) => {
        state.actionLoading = true;
        state.error         = null;
      })
      .addCase(verifyPickup.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        patchOrderInList(state, payload);
      })
      .addCase(verifyPickup.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.error         = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 16. submitFeedback
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(submitFeedback.pending, (state) => {
        state.actionLoading = true;
        state.orderError    = null;
      })
      .addCase(submitFeedback.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        patchOrderInList(state, payload);
      })
      .addCase(submitFeedback.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.orderError    = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 17. addMoneyToWallet
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(addMoneyToWallet.pending, (state) => {
        state.actionLoading    = true;
        state.paymentError     = null;
        state.walletTopupOrder = null;
      })
      .addCase(addMoneyToWallet.fulfilled, (state, { payload }) => {
        state.actionLoading    = false;
        state.walletTopupOrder = payload?.rzpOrder ?? null;
      })
      .addCase(addMoneyToWallet.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.paymentError  = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 18. verifyWalletTopup
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(verifyWalletTopup.pending, (state) => {
        state.actionLoading = true;
        state.paymentError  = null;
      })
      .addCase(verifyWalletTopup.fulfilled, (state) => {
        state.actionLoading    = false;
        state.walletTopupOrder = null;
      })
      .addCase(verifyWalletTopup.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.paymentError  = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 19. placeDirectOrder
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(placeDirectOrder.pending, (state) => {
        state.actionLoading = true;
        state.orderError    = null;
        state.paymentError  = null;
      })
      .addCase(placeDirectOrder.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.currentOrder  = payload.order ?? null;
      })
      .addCase(placeDirectOrder.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.orderError    = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 20. verifyDirectPayment
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(verifyDirectPayment.pending, (state) => {
        state.actionLoading = true;
        state.paymentError  = null;
      })
      .addCase(verifyDirectPayment.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.currentOrder  = payload ?? state.currentOrder;
      })
      .addCase(verifyDirectPayment.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.paymentError  = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 21. verifyDeliveryOtp
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(verifyDeliveryOtp.pending, (state) => {
        state.actionLoading = true;
        state.orderError    = null;
      })
      .addCase(verifyDeliveryOtp.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        patchOrderInList(state, payload);
      })
      .addCase(verifyDeliveryOtp.rejected, (state, { payload }) => {
        state.actionLoading = false;
        state.orderError    = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 22. fetchOrderInvoice
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(fetchOrderInvoice.pending, (state) => {
        state.invoiceLoading = true;
        state.invoiceError   = null;
        state.invoiceData    = null;
      })
      .addCase(fetchOrderInvoice.fulfilled, (state, { payload }) => {
        state.invoiceLoading = false;
        state.invoiceData    = payload; // { orderId, html, invoiceUrl? }
      })
      .addCase(fetchOrderInvoice.rejected, (state, { payload }) => {
        state.invoiceLoading = false;
        state.invoiceError   = payload;
      });

    // ─────────────────────────────────────────────────────────────────────────
    // 22a. downloadOrderInvoice
    // Uses its own transient loading flag to avoid blocking other UI.
    // ─────────────────────────────────────────────────────────────────────────
    builder
      .addCase(downloadOrderInvoice.pending, (state) => {
        state.invoiceLoading = true;
        state.invoiceError   = null;
      })
      .addCase(downloadOrderInvoice.fulfilled, (state) => {
        state.invoiceLoading = false;
      })
      .addCase(downloadOrderInvoice.rejected, (state, { payload }) => {
        state.invoiceLoading = false;
        state.invoiceError   = payload;
      });
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTION CREATORS (sync)
// ══════════════════════════════════════════════════════════════════════════════

export const {
  clearCoupon,
  clearPharmacyErrors,
  clearCurrentOrder,
  clearInvoiceData,
  clearPrescriptionUpload,
} = pharmacyOrderSlice.actions;

// ══════════════════════════════════════════════════════════════════════════════
// SELECTORS
// ══════════════════════════════════════════════════════════════════════════════

// ── Cart ──────────────────────────────────────────────────────────────────────
export const selectCart                    = (s) => s.pharmacyOrder.cart;
export const selectCartItems               = (s) => s.pharmacyOrder.cart.items ?? [];
export const selectCartStore               = (s) => s.pharmacyOrder.cart.store;
export const selectCartBillSummary         = (s) => s.pharmacyOrder.cart.billSummary ?? { itemsTotal: 0, estimatedTax: 0, totalAmount: 0 };
export const selectCartPrescriptionSummary = (s) => s.pharmacyOrder.cart.prescriptionSummary ?? { hasRxItems: false, missingUploads: [] };

// ── Medicines ─────────────────────────────────────────────────────────────────
export const selectMedicines          = (s) => s.pharmacyOrder.medicines;
export const selectMedicinePagination = (s) => s.pharmacyOrder.pagination;

// ── Orders ────────────────────────────────────────────────────────────────────
export const selectCurrentOrder     = (s) => s.pharmacyOrder.currentOrder;
export const selectOrders           = (s) => s.pharmacyOrder.orders;
export const selectOrdersPagination = (s) => s.pharmacyOrder.ordersPagination;

// ── Coupon ────────────────────────────────────────────────────────────────────
export const selectCoupon        = (s) => s.pharmacyOrder.coupon;
export const selectCouponLoading = (s) => s.pharmacyOrder.couponLoading;
export const selectCouponError   = (s) => s.pharmacyOrder.couponError;

// ── Invoice ───────────────────────────────────────────────────────────────────
export const selectInvoiceData    = (s) => s.pharmacyOrder.invoiceData;
export const selectInvoiceLoading = (s) => s.pharmacyOrder.invoiceLoading;
export const selectInvoiceError   = (s) => s.pharmacyOrder.invoiceError;

// ── Prescription upload ───────────────────────────────────────────────────────
export const selectPrescriptionUpload        = (s) => s.pharmacyOrder.prescriptionUpload;
export const selectPrescriptionUploadUrl     = (s) => s.pharmacyOrder.prescriptionUpload.imageUrl;
export const selectPrescriptionUploadLoading = (s) => s.pharmacyOrder.prescriptionUpload.loading;
export const selectPrescriptionUploadError   = (s) => s.pharmacyOrder.prescriptionUpload.error;

// ── ImageKit upload auth ──────────────────────────────────────────────────────
export const selectUploadAuth        = (s) => s.pharmacyOrder.uploadAuth;
export const selectUploadAuthLoading = (s) => s.pharmacyOrder.uploadAuth.loading;

// ── Loading / error ───────────────────────────────────────────────────────────
export const selectPharmacyGlobalLoading = (s) => s.pharmacyOrder.globalLoading;
export const selectPharmacyActionLoading = (s) => s.pharmacyOrder.actionLoading;
export const selectOrderError            = (s) => s.pharmacyOrder.orderError;
export const selectPaymentError          = (s) => s.pharmacyOrder.paymentError;
export const selectPharmacyError         = (s) => s.pharmacyOrder.error;

// ── Wallet top-up (transient) ─────────────────────────────────────────────────
export const selectWalletTopupOrder = (s) => s.pharmacyOrder.walletTopupOrder;

// ══════════════════════════════════════════════════════════════════════════════
// REDUCER
// ══════════════════════════════════════════════════════════════════════════════

export default pharmacyOrderSlice.reducer;