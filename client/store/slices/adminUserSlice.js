import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: REFERENCE DATA THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchRefHospitals = createAsyncThunk(
  'adminUsers/fetchRefHospitals',
  async (type = '', { rejectWithValue }) => {
    try {
      const params = type ? `?type=${type}` : '';
      const { data } = await API.get(`/admin/users/ref/hospitals${params}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch hospitals');
    }
  }
);

export const fetchRefLabPartnerHospitals = createAsyncThunk(
  'adminUsers/fetchRefLabPartnerHospitals',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/admin/users/ref/hospitals/lab-partners');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch lab partner hospitals');
    }
  }
);

export const fetchRefPharmacyStores = createAsyncThunk(
  'adminUsers/fetchRefPharmacyStores',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/admin/users/ref/pharmacy-stores');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch pharmacy stores');
    }
  }
);

export const fetchRefTransportPartners = createAsyncThunk(
  'adminUsers/fetchRefTransportPartners',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/admin/users/ref/transport-partners');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch transport partners');
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: CREATE USER THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const createCustomer = createAsyncThunk(
  'adminUsers/createCustomer',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/admin/users/create/customer', payload);
      toast.success(data.message || 'Customer account created successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create customer';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const createDoctor = createAsyncThunk(
  'adminUsers/createDoctor',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/admin/users/create/doctor', payload);
      toast.success(data.message || 'Doctor account created successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create doctor';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const createLabPartner = createAsyncThunk(
  'adminUsers/createLabPartner',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/admin/users/create/lab-partner', payload);
      toast.success(data.message || 'Lab Partner account created successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create lab partner';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const createTransportPartner = createAsyncThunk(
  'adminUsers/createTransportPartner',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/admin/users/create/transport-partner', payload);
      toast.success(data.message || 'Transport Partner account created successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create transport partner';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const createPharmacy = createAsyncThunk(
  'adminUsers/createPharmacy',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/admin/users/create/pharmacy', payload);
      toast.success(data.message || 'Pharmacy user account created successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create pharmacy user';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const createFinance = createAsyncThunk(
  'adminUsers/createFinance',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/admin/users/create/finance', payload);
      toast.success(data.message || 'Finance account created successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create finance user';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const createCareAssistant = createAsyncThunk(
  'adminUsers/createCareAssistant',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/admin/users/create/care-assistant', payload);
      toast.success(data.message || 'Care Assistant account created successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create care assistant';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: LIST USERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * @param {Object} filters - { role, isBlocked, isEmailVerified, search, page, limit, sortBy, sortOrder }
 */
export const fetchAllUsers = createAsyncThunk(
  'adminUsers/fetchAllUsers',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const { data } = await API.get(`/admin/users?${params.toString()}`);
      return { users: data.data, pagination: data.pagination };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch users');
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: SINGLE USER
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/users/:id
export const fetchUserById = createAsyncThunk(
  'adminUsers/fetchUserById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/admin/users/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch user');
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users/analytics/overview
 * @param {{ from?: string, to?: string }} dateRange
 */
export const fetchUsersAnalytics = createAsyncThunk(
  'adminUsers/fetchUsersAnalytics',
  async ({ from, to } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const { data } = await API.get(`/admin/users/analytics/overview?${params.toString()}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch analytics');
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: MANAGE EXISTING USERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/users/:id/block
 * @param {{ id: string, action: 'block'|'unblock', reason?: string, unblockAt?: string }}
 */
export const blockUnblockUser = createAsyncThunk(
  'adminUsers/blockUnblockUser',
  async ({ id, action, reason, unblockAt }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/admin/users/${id}/block`, { action, reason, unblockAt });
      toast.success(data.message || `User ${action}ed successfully.`);
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || `Failed to ${action} user`;
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// PATCH /api/admin/users/:id/reset-password
export const resetUserPassword = createAsyncThunk(
  'adminUsers/resetUserPassword',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/admin/users/${id}/reset-password`);
      toast.success(data.message || 'Password reset successfully. Credentials sent via email.');
      return id;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// PATCH /api/admin/users/:id/verify-email
export const verifyUserEmail = createAsyncThunk(
  'adminUsers/verifyUserEmail',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/admin/users/${id}/verify-email`);
      toast.success(data.message || 'Email verified successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to verify email';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * PATCH /api/admin/users/:id
 * @param {{ id: string, updates: { name?, phone?, workStatus?, lastKnownAddress? } }}
 */
export const updateUser = createAsyncThunk(
  'adminUsers/updateUser',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/admin/users/${id}`, updates);
      toast.success(data.message || 'User updated successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update user';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// DELETE /api/admin/users/:id — Superadmin only (soft delete)
export const deleteUser = createAsyncThunk(
  'adminUsers/deleteUser',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/admin/users/${id}`);
      toast.success(data.message || 'User account deactivated successfully.');
      return id;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete user';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: SESSION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/users/:id/sessions
export const fetchUserSessions = createAsyncThunk(
  'adminUsers/fetchUserSessions',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/admin/users/${id}/sessions`);
      return { userId: id, sessions: data.data.sessions };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch sessions');
    }
  }
);

/**
 * DELETE /api/admin/users/:id/sessions/:sessionId
 * @param {{ userId: string, sessionId: string }}
 */
export const revokeUserSession = createAsyncThunk(
  'adminUsers/revokeUserSession',
  async ({ userId, sessionId }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/admin/users/${userId}/sessions/${sessionId}`);
      toast.success(data.message || 'Session revoked successfully.');
      return { userId, sessionId };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to revoke session';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// DELETE /api/admin/users/:id/sessions — revokes ALL sessions
export const revokeAllUserSessions = createAsyncThunk(
  'adminUsers/revokeAllUserSessions',
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/admin/users/${userId}/sessions`);
      toast.success(data.message || 'All sessions revoked. User logged out everywhere.');
      return userId;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to revoke all sessions';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/users/:id/settings
export const fetchUserSettings = createAsyncThunk(
  'adminUsers/fetchUserSettings',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/admin/users/${id}/settings`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch user settings');
    }
  }
);

/**
 * PATCH /api/admin/users/:id/settings
 * @param {{
 *   id: string,
 *   updates: {
 *     isEmailVerified?: boolean, isPhoneVerified?: boolean,
 *     workStatus?: string, lastKnownAddress?: string,
 *     coins?: number, referralCode?: string,
 *     role?: string  // superadmin only
 *   }
 * }}
 */
export const updateUserSettings = createAsyncThunk(
  'adminUsers/updateUserSettings',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/admin/users/${id}/settings`, updates);
      toast.success(data.message || 'User settings updated successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update user settings';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// DELETE /api/admin/users/:id/devices — clears ALL push device tokens
export const clearUserDevices = createAsyncThunk(
  'adminUsers/clearUserDevices',
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/admin/users/${userId}/devices`);
      toast.success(data.message || 'All device tokens cleared.');
      return userId;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to clear device tokens';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * DELETE /api/admin/users/:id/devices/:deviceId
 * @param {{ userId: string, deviceId: string }}
 */
export const removeUserDevice = createAsyncThunk(
  'adminUsers/removeUserDevice',
  async ({ userId, deviceId }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/admin/users/${userId}/devices/${deviceId}`);
      toast.success(data.message || 'Device token removed.');
      return { userId, deviceId };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to remove device token';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: SECURITY
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/users/:id/security
export const fetchUserSecurity = createAsyncThunk(
  'adminUsers/fetchUserSecurity',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/admin/users/${id}/security`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch security details');
    }
  }
);

/**
 * POST /api/admin/users/:id/security/send-notification
 * @param {{ userId: string, title: string, body: string, type?: string, priority?: string, channels?: Array }}
 */
export const sendUserNotification = createAsyncThunk(
  'adminUsers/sendUserNotification',
  async ({ userId, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/admin/users/${userId}/security/send-notification`, payload);
      toast.success(data.message || 'Notification sent successfully.');
      return data.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send notification';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * POST /api/admin/users/:id/security/adjust-coins — Superadmin only
 * @param {{ userId: string, action: 'credit'|'debit', amount: number, reason: string }}
 */
export const adjustUserCoins = createAsyncThunk(
  'adminUsers/adjustUserCoins',
  async ({ userId, action, amount, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/admin/users/${userId}/security/adjust-coins`, {
        action,
        amount,
        reason,
      });
      toast.success(data.message || `Coins ${action === 'credit' ? 'credited' : 'debited'} successfully.`);
      return data.data; // { _id, previousBalance, adjustment, newBalance, reason }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to adjust coins';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * PATCH /api/admin/users/:id/security/kyc
 * @param {{ userId: string, kycStatus: 'not-submitted'|'pending'|'under-review'|'verified'|'rejected', rejectionReason?: string }}
 */
export const updateUserKyc = createAsyncThunk(
  'adminUsers/updateUserKyc',
  async ({ userId, kycStatus, rejectionReason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/admin/users/${userId}/security/kyc`, {
        kycStatus,
        rejectionReason,
      });
      toast.success(data.message || `KYC status updated to "${kycStatus}".`);
      return data.data; // { userId, agencyName, kycStatus, kycVerifiedAt }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update KYC status';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * GET /api/admin/users/:id/notifications
 * @param {{ userId: string, filters?: { type?, priority?, isRead?, page?, limit? } }}
 */
export const fetchUserNotifications = createAsyncThunk(
  'adminUsers/fetchUserNotifications',
  async ({ userId, filters = {} }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const { data } = await API.get(`/admin/users/${userId}/notifications?${params.toString()}`);
      return data.data; // { user, unreadCount, pagination, notifications }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch user notifications');
    }
  }
);

// DELETE /api/admin/users/:id/notifications — Superadmin only
export const clearUserNotifications = createAsyncThunk(
  'adminUsers/clearUserNotifications',
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/admin/users/${userId}/notifications`);
      toast.success(data.message || 'All notifications cleared.');
      return userId;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to clear notifications';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: SYSTEM LOGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/users/logs — Create a manual system log entry
 * @param {{
 *   level: 'info'|'success'|'warning'|'error'|'debug',
 *   category: 'auth'|'user'|'security'|'payment'|'notification'|'kyc'|'system'|'api',
 *   message: string,
 *   details?: string,
 *   relatedEntity?: { model: string, entityId: string },
 *   metadata?: object
 * }}
 */
export const createSystemLog = createAsyncThunk(
  'adminUsers/createSystemLog',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/admin/users/logs', payload);
      toast.success(data.message || 'System log entry created.');
      return data.data; // { _id, logCode, level, category, message, createdAt }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create system log';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * GET /api/admin/users/logs — List system logs with filters and pagination
 * @param {{
 *   level?, category?, actorRole?, actorId?, entityModel?, entityId?,
 *   statusCode?, method?, ip?, environment?, search?,
 *   from?, to?, page?, limit?, sortBy?, sortOrder?
 * }}
 */
export const fetchSystemLogs = createAsyncThunk(
  'adminUsers/fetchSystemLogs',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const { data } = await API.get(`/admin/users/logs?${params.toString()}`);
      return { logs: data.data, pagination: data.pagination };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch system logs');
    }
  }
);

/**
 * GET /api/admin/users/logs/analytics — Aggregated log stats for dashboard
 * @param {{ from?: string, to?: string, environment?: string }}
 */
export const fetchSystemLogsAnalytics = createAsyncThunk(
  'adminUsers/fetchSystemLogsAnalytics',
  async ({ from, to, environment } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (environment) params.append('environment', environment);
      const { data } = await API.get(`/admin/users/logs/analytics?${params.toString()}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch log analytics');
    }
  }
);

/**
 * GET /api/admin/users/logs/export — Export logs as flat JSON (Superadmin only, max 5000)
 * @param {{ Same filters as fetchSystemLogs minus page/limit }}
 */
export const exportSystemLogs = createAsyncThunk(
  'adminUsers/exportSystemLogs',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const { data } = await API.get(`/admin/users/logs/export?${params.toString()}`);
      toast.success(`${data.count} log(s) exported successfully.`);
      return data.data; // flat array for CSV generation
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to export system logs';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * GET /api/admin/users/logs/:logId — Get a single log by _id or logCode
 * @param {string} logId — MongoDB _id or logCode string (e.g. "LOG-20250321-AB12C")
 */
export const fetchSystemLogById = createAsyncThunk(
  'adminUsers/fetchSystemLogById',
  async (logId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/admin/users/logs/${logId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch system log');
    }
  }
);

/**
 * GET /api/admin/users/logs/user/:userId — All logs triggered by or affecting a user
 * @param {{
 *   userId: string,
 *   filters?: { level?, category?, from?, to?, page?, limit? }
 * }}
 */
export const fetchSystemLogsByUser = createAsyncThunk(
  'adminUsers/fetchSystemLogsByUser',
  async ({ userId, filters = {} }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, val);
        }
      });
      const { data } = await API.get(`/admin/users/logs/user/${userId}?${params.toString()}`);
      return { logs: data.data, user: data.user, pagination: data.pagination };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch user system logs');
    }
  }
);

/**
 * PATCH /api/admin/users/logs/:logId — Update mutable fields (Superadmin only)
 * @param {{ logId: string, updates: { details?: string, metadata?: object } }}
 */
export const updateSystemLog = createAsyncThunk(
  'adminUsers/updateSystemLog',
  async ({ logId, updates }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/admin/users/logs/${logId}`, updates);
      toast.success(data.message || 'System log updated.');
      return data.data; // { _id, logCode, details, metadata }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update system log';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * DELETE /api/admin/users/logs/:logId — Delete a single log (Superadmin only)
 * @param {string} logId — MongoDB _id or logCode
 */
export const deleteSystemLog = createAsyncThunk(
  'adminUsers/deleteSystemLog',
  async (logId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/admin/users/logs/${logId}`);
      toast.success(data.message || 'System log deleted.');
      return logId;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete system log';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

/**
 * DELETE /api/admin/users/logs — Bulk delete logs (Superadmin only)
 * @param {{
 *   level?: string, category?: string, before?: string,
 *   actorId?: string, entityId?: string,
 *   confirm: true   // REQUIRED by backend as safety flag
 * }}
 */
export const bulkDeleteSystemLogs = createAsyncThunk(
  'adminUsers/bulkDeleteSystemLogs',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.delete('/admin/users/logs', { data: payload });
      toast.success(data.message || `${data.data?.deletedCount ?? 0} log(s) deleted.`);
      return data.data; // { deletedCount, filters }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to bulk delete system logs';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // ── User list ──────────────────────────────────────────────────────────────
  users: [],
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
  filters: {
    role: '',
    isBlocked: '',
    isEmailVerified: '',
    search: '',
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },

  // ── Single user detail ─────────────────────────────────────────────────────
  selectedUser: null,

  // ── Analytics ──────────────────────────────────────────────────────────────
  analytics: null,

  // ── Reference data (for dropdowns) ────────────────────────────────────────
  ref: {
    hospitals: [],
    labPartnerHospitals: [],
    pharmacyStores: [],
    transportPartners: [],
  },

  // ── Sessions of the currently viewed user ─────────────────────────────────
  userSessions: null,

  // ── Settings of the currently viewed user ─────────────────────────────────
  userSettings: null,

  // ── Full security audit of the currently viewed user ──────────────────────
  userSecurity: null,

  // ── Notification history of the currently viewed user ─────────────────────
  userNotifications: {
    list: [],
    unreadCount: 0,
    pagination: {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  },

  // ── System Logs ────────────────────────────────────────────────────────────
  systemLogs: {
    list: [],
    pagination: {
      total: 0,
      page: 1,
      limit: 30,
      totalPages: 1,
    },
    filters: {
      level: '',
      category: '',
      actorRole: '',
      actorId: '',
      entityModel: '',
      entityId: '',
      statusCode: '',
      method: '',
      ip: '',
      environment: '',
      search: '',
      from: '',
      to: '',
      page: 1,
      limit: 30,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
    selectedLog: null,          // single log detail
    analytics: null,            // aggregated stats from /logs/analytics
    exportedData: [],           // flat array from /logs/export
    userLogs: {                 // logs scoped to a specific user (/logs/user/:userId)
      list: [],
      user: null,
      pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
    },
  },

  // ── Loading states per operation ───────────────────────────────────────────
  loading: {
    list: false,
    detail: false,
    analytics: false,
    create: false,
    update: false,
    block: false,
    resetPassword: false,
    verifyEmail: false,
    delete: false,

    // Sessions
    sessions: false,
    revokeSession: false,
    revokeAllSessions: false,

    // Settings
    settings: false,
    updateSettings: false,
    clearDevices: false,
    removeDevice: false,

    // Security
    security: false,
    sendNotification: false,
    adjustCoins: false,
    updateKyc: false,
    userNotifications: false,
    clearNotifications: false,

    // Reference data
    refHospitals: false,
    refLabHospitals: false,
    refPharmacyStores: false,
    refTransportPartners: false,

    // System Logs
    logsList: false,
    logDetail: false,
    logCreate: false,
    logUpdate: false,
    logDelete: false,
    logBulkDelete: false,
    logAnalytics: false,
    logExport: false,
    logsByUser: false,
  },

  // ── Errors per operation ───────────────────────────────────────────────────
  errors: {
    list: null,
    detail: null,
    analytics: null,
    create: null,
    update: null,
    block: null,
    resetPassword: null,
    verifyEmail: null,
    delete: null,

    // Sessions
    sessions: null,
    revokeSession: null,
    revokeAllSessions: null,

    // Settings
    settings: null,
    updateSettings: null,
    clearDevices: null,
    removeDevice: null,

    // Security
    security: null,
    sendNotification: null,
    adjustCoins: null,
    updateKyc: null,
    userNotifications: null,
    clearNotifications: null,

    // Reference data
    ref: null,

    // System Logs
    logsList: null,
    logDetail: null,
    logCreate: null,
    logUpdate: null,
    logDelete: null,
    logBulkDelete: null,
    logAnalytics: null,
    logExport: null,
    logsByUser: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const adminUserSlice = createSlice({
  name: 'adminUsers',
  initialState,
  reducers: {
    // Update local filter state — always resets to page 1 on filter change
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload, page: 1 };
    },
    setPage(state, action) {
      state.filters.page = action.payload;
    },
    clearSelectedUser(state) {
      state.selectedUser = null;
      state.userSessions = null;
      state.userSettings = null;
      state.userSecurity = null;
      state.userNotifications = initialState.userNotifications;
    },
    clearCreateError(state) {
      state.errors.create = null;
    },
    clearErrors(state) {
      state.errors = initialState.errors;
    },
    // Optimistically update selectedUser when settings or coins change
    patchSelectedUser(state, action) {
      if (state.selectedUser) {
        state.selectedUser = { ...state.selectedUser, ...action.payload };
      }
    },
    // System log filters
    setLogFilters(state, action) {
      state.systemLogs.filters = {
        ...state.systemLogs.filters,
        ...action.payload,
        page: 1,
      };
    },
    setLogPage(state, action) {
      state.systemLogs.filters.page = action.payload;
    },
    clearSelectedLog(state) {
      state.systemLogs.selectedLog = null;
    },
    clearLogExport(state) {
      state.systemLogs.exportedData = [];
    },
    clearUserLogs(state) {
      state.systemLogs.userLogs = initialState.systemLogs.userLogs;
    },
  },

  extraReducers: (builder) => {

    // ── Ref: Hospitals ─────────────────────────────────────────────────────
    builder
      .addCase(fetchRefHospitals.pending, (state) => {
        state.loading.refHospitals = true;
        state.errors.ref = null;
      })
      .addCase(fetchRefHospitals.fulfilled, (state, action) => {
        state.loading.refHospitals = false;
        state.ref.hospitals = action.payload;
      })
      .addCase(fetchRefHospitals.rejected, (state, action) => {
        state.loading.refHospitals = false;
        state.errors.ref = action.payload;
      });

    // ── Ref: Lab Partner Hospitals ─────────────────────────────────────────
    builder
      .addCase(fetchRefLabPartnerHospitals.pending, (state) => {
        state.loading.refLabHospitals = true;
      })
      .addCase(fetchRefLabPartnerHospitals.fulfilled, (state, action) => {
        state.loading.refLabHospitals = false;
        state.ref.labPartnerHospitals = action.payload;
      })
      .addCase(fetchRefLabPartnerHospitals.rejected, (state, action) => {
        state.loading.refLabHospitals = false;
        state.errors.ref = action.payload;
      });

    // ── Ref: Pharmacy Stores ───────────────────────────────────────────────
    builder
      .addCase(fetchRefPharmacyStores.pending, (state) => {
        state.loading.refPharmacyStores = true;
      })
      .addCase(fetchRefPharmacyStores.fulfilled, (state, action) => {
        state.loading.refPharmacyStores = false;
        state.ref.pharmacyStores = action.payload;
      })
      .addCase(fetchRefPharmacyStores.rejected, (state, action) => {
        state.loading.refPharmacyStores = false;
        state.errors.ref = action.payload;
      });

    // ── Ref: Transport Partners ────────────────────────────────────────────
    builder
      .addCase(fetchRefTransportPartners.pending, (state) => {
        state.loading.refTransportPartners = true;
      })
      .addCase(fetchRefTransportPartners.fulfilled, (state, action) => {
        state.loading.refTransportPartners = false;
        state.ref.transportPartners = action.payload;
      })
      .addCase(fetchRefTransportPartners.rejected, (state, action) => {
        state.loading.refTransportPartners = false;
        state.errors.ref = action.payload;
      });

    // ── Create: Customer ───────────────────────────────────────────────────
    builder
      .addCase(createCustomer.pending, (state) => {
        state.loading.create = true;
        state.errors.create = null;
      })
      .addCase(createCustomer.fulfilled, (state, action) => {
        state.loading.create = false;
        state.users.unshift(action.payload);
        state.pagination.total += 1;
      })
      .addCase(createCustomer.rejected, (state, action) => {
        state.loading.create = false;
        state.errors.create = action.payload;
      });

    // ── Create: Doctor ─────────────────────────────────────────────────────
    builder
      .addCase(createDoctor.pending, (state) => {
        state.loading.create = true;
        state.errors.create = null;
      })
      .addCase(createDoctor.fulfilled, (state, action) => {
        state.loading.create = false;
        state.users.unshift(action.payload);
        state.pagination.total += 1;
      })
      .addCase(createDoctor.rejected, (state, action) => {
        state.loading.create = false;
        state.errors.create = action.payload;
      });

    // ── Create: Lab Partner ────────────────────────────────────────────────
    builder
      .addCase(createLabPartner.pending, (state) => {
        state.loading.create = true;
        state.errors.create = null;
      })
      .addCase(createLabPartner.fulfilled, (state, action) => {
        state.loading.create = false;
        state.users.unshift(action.payload);
        state.pagination.total += 1;
      })
      .addCase(createLabPartner.rejected, (state, action) => {
        state.loading.create = false;
        state.errors.create = action.payload;
      });

    // ── Create: Transport Partner ──────────────────────────────────────────
    builder
      .addCase(createTransportPartner.pending, (state) => {
        state.loading.create = true;
        state.errors.create = null;
      })
      .addCase(createTransportPartner.fulfilled, (state, action) => {
        state.loading.create = false;
        state.users.unshift(action.payload);
        state.pagination.total += 1;
      })
      .addCase(createTransportPartner.rejected, (state, action) => {
        state.loading.create = false;
        state.errors.create = action.payload;
      });

    // ── Create: Pharmacy ───────────────────────────────────────────────────
    builder
      .addCase(createPharmacy.pending, (state) => {
        state.loading.create = true;
        state.errors.create = null;
      })
      .addCase(createPharmacy.fulfilled, (state, action) => {
        state.loading.create = false;
        state.users.unshift(action.payload);
        state.pagination.total += 1;
      })
      .addCase(createPharmacy.rejected, (state, action) => {
        state.loading.create = false;
        state.errors.create = action.payload;
      });

    // ── Create: Finance ────────────────────────────────────────────────────
    builder
      .addCase(createFinance.pending, (state) => {
        state.loading.create = true;
        state.errors.create = null;
      })
      .addCase(createFinance.fulfilled, (state, action) => {
        state.loading.create = false;
        state.users.unshift(action.payload);
        state.pagination.total += 1;
      })
      .addCase(createFinance.rejected, (state, action) => {
        state.loading.create = false;
        state.errors.create = action.payload;
      });

    // ── Create: Care Assistant ─────────────────────────────────────────────
    builder
      .addCase(createCareAssistant.pending, (state) => {
        state.loading.create = true;
        state.errors.create = null;
      })
      .addCase(createCareAssistant.fulfilled, (state, action) => {
        state.loading.create = false;
        state.users.unshift(action.payload);
        state.pagination.total += 1;
      })
      .addCase(createCareAssistant.rejected, (state, action) => {
        state.loading.create = false;
        state.errors.create = action.payload;
      });

    // ── List Users ─────────────────────────────────────────────────────────
    builder
      .addCase(fetchAllUsers.pending, (state) => {
        state.loading.list = true;
        state.errors.list = null;
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.loading.list = false;
        state.users = action.payload.users;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading.list = false;
        state.errors.list = action.payload;
      });

    // ── Single User ────────────────────────────────────────────────────────
    builder
      .addCase(fetchUserById.pending, (state) => {
        state.loading.detail = true;
        state.errors.detail = null;
        state.selectedUser = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.loading.detail = false;
        state.selectedUser = action.payload;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.loading.detail = false;
        state.errors.detail = action.payload;
      });

    // ── Analytics ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchUsersAnalytics.pending, (state) => {
        state.loading.analytics = true;
        state.errors.analytics = null;
      })
      .addCase(fetchUsersAnalytics.fulfilled, (state, action) => {
        state.loading.analytics = false;
        state.analytics = action.payload;
      })
      .addCase(fetchUsersAnalytics.rejected, (state, action) => {
        state.loading.analytics = false;
        state.errors.analytics = action.payload;
      });

    // ── Block / Unblock ────────────────────────────────────────────────────
    builder
      .addCase(blockUnblockUser.pending, (state) => {
        state.loading.block = true;
        state.errors.block = null;
      })
      .addCase(blockUnblockUser.fulfilled, (state, action) => {
        state.loading.block = false;
        const updated = action.payload;
        const idx = state.users.findIndex((u) => u._id === updated._id);
        if (idx !== -1) state.users[idx] = { ...state.users[idx], ...updated };
        if (state.selectedUser?._id === updated._id) {
          state.selectedUser = { ...state.selectedUser, ...updated };
        }
      })
      .addCase(blockUnblockUser.rejected, (state, action) => {
        state.loading.block = false;
        state.errors.block = action.payload;
      });

    // ── Reset Password ─────────────────────────────────────────────────────
    builder
      .addCase(resetUserPassword.pending, (state) => {
        state.loading.resetPassword = true;
        state.errors.resetPassword = null;
      })
      .addCase(resetUserPassword.fulfilled, (state) => {
        state.loading.resetPassword = false;
      })
      .addCase(resetUserPassword.rejected, (state, action) => {
        state.loading.resetPassword = false;
        state.errors.resetPassword = action.payload;
      });

    // ── Verify Email ───────────────────────────────────────────────────────
    builder
      .addCase(verifyUserEmail.pending, (state) => {
        state.loading.verifyEmail = true;
        state.errors.verifyEmail = null;
      })
      .addCase(verifyUserEmail.fulfilled, (state, action) => {
        state.loading.verifyEmail = false;
        const updated = action.payload;
        const idx = state.users.findIndex((u) => u._id === updated._id);
        if (idx !== -1) state.users[idx] = { ...state.users[idx], ...updated };
        if (state.selectedUser?._id === updated._id) {
          state.selectedUser = { ...state.selectedUser, ...updated };
        }
      })
      .addCase(verifyUserEmail.rejected, (state, action) => {
        state.loading.verifyEmail = false;
        state.errors.verifyEmail = action.payload;
      });

    // ── Update User (basic fields) ─────────────────────────────────────────
    builder
      .addCase(updateUser.pending, (state) => {
        state.loading.update = true;
        state.errors.update = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading.update = false;
        const updated = action.payload;
        const idx = state.users.findIndex((u) => u._id === updated._id);
        if (idx !== -1) state.users[idx] = { ...state.users[idx], ...updated };
        if (state.selectedUser?._id === updated._id) {
          state.selectedUser = { ...state.selectedUser, ...updated };
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading.update = false;
        state.errors.update = action.payload;
      });

    // ── Delete (Soft) User ─────────────────────────────────────────────────
    builder
      .addCase(deleteUser.pending, (state) => {
        state.loading.delete = true;
        state.errors.delete = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading.delete = false;
        const deletedId = action.payload;
        state.users = state.users.filter((u) => u._id !== deletedId);
        state.pagination.total = Math.max(0, state.pagination.total - 1);
        if (state.selectedUser?._id === deletedId) state.selectedUser = null;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.loading.delete = false;
        state.errors.delete = action.payload;
      });

    // ── Fetch Sessions ─────────────────────────────────────────────────────
    builder
      .addCase(fetchUserSessions.pending, (state) => {
        state.loading.sessions = true;
        state.errors.sessions = null;
      })
      .addCase(fetchUserSessions.fulfilled, (state, action) => {
        state.loading.sessions = false;
        state.userSessions = action.payload.sessions;
      })
      .addCase(fetchUserSessions.rejected, (state, action) => {
        state.loading.sessions = false;
        state.errors.sessions = action.payload;
      });

    // ── Revoke Single Session ──────────────────────────────────────────────
    builder
      .addCase(revokeUserSession.pending, (state) => {
        state.loading.revokeSession = true;
        state.errors.revokeSession = null;
      })
      .addCase(revokeUserSession.fulfilled, (state, action) => {
        state.loading.revokeSession = false;
        const { sessionId } = action.payload;
        if (state.userSessions) {
          state.userSessions = state.userSessions.filter((s) => s._id !== sessionId);
        }
      })
      .addCase(revokeUserSession.rejected, (state, action) => {
        state.loading.revokeSession = false;
        state.errors.revokeSession = action.payload;
      });

    // ── Revoke ALL Sessions ────────────────────────────────────────────────
    builder
      .addCase(revokeAllUserSessions.pending, (state) => {
        state.loading.revokeAllSessions = true;
        state.errors.revokeAllSessions = null;
      })
      .addCase(revokeAllUserSessions.fulfilled, (state) => {
        state.loading.revokeAllSessions = false;
        state.userSessions = [];
      })
      .addCase(revokeAllUserSessions.rejected, (state, action) => {
        state.loading.revokeAllSessions = false;
        state.errors.revokeAllSessions = action.payload;
      });

    // ── Fetch User Settings ────────────────────────────────────────────────
    builder
      .addCase(fetchUserSettings.pending, (state) => {
        state.loading.settings = true;
        state.errors.settings = null;
      })
      .addCase(fetchUserSettings.fulfilled, (state, action) => {
        state.loading.settings = false;
        state.userSettings = action.payload;
      })
      .addCase(fetchUserSettings.rejected, (state, action) => {
        state.loading.settings = false;
        state.errors.settings = action.payload;
      });

    // ── Update User Settings ───────────────────────────────────────────────
    builder
      .addCase(updateUserSettings.pending, (state) => {
        state.loading.updateSettings = true;
        state.errors.updateSettings = null;
      })
      .addCase(updateUserSettings.fulfilled, (state, action) => {
        state.loading.updateSettings = false;
        const updated = action.payload;
        if (state.userSettings) {
          state.userSettings = { ...state.userSettings, ...updated };
        }
        if (state.selectedUser && state.selectedUser._id === updated._id) {
          state.selectedUser = { ...state.selectedUser, ...updated };
        }
        const idx = state.users.findIndex((u) => u._id === updated._id);
        if (idx !== -1) state.users[idx] = { ...state.users[idx], ...updated };
      })
      .addCase(updateUserSettings.rejected, (state, action) => {
        state.loading.updateSettings = false;
        state.errors.updateSettings = action.payload;
      });

    // ── Clear All Device Tokens ────────────────────────────────────────────
    builder
      .addCase(clearUserDevices.pending, (state) => {
        state.loading.clearDevices = true;
        state.errors.clearDevices = null;
      })
      .addCase(clearUserDevices.fulfilled, (state) => {
        state.loading.clearDevices = false;
        if (state.userSettings) {
          state.userSettings.devices = { registeredCount: 0, byPlatform: {} };
        }
        if (state.userSecurity) {
          state.userSecurity.devices = { total: 0, byPlatform: {} };
        }
      })
      .addCase(clearUserDevices.rejected, (state, action) => {
        state.loading.clearDevices = false;
        state.errors.clearDevices = action.payload;
      });

    // ── Remove Single Device Token ─────────────────────────────────────────
    builder
      .addCase(removeUserDevice.pending, (state) => {
        state.loading.removeDevice = true;
        state.errors.removeDevice = null;
      })
      .addCase(removeUserDevice.fulfilled, (state) => {
        state.loading.removeDevice = false;
        // Re-fetch settings to get updated device list (server computes counts).
        // Components should dispatch fetchUserSettings after this resolves.
      })
      .addCase(removeUserDevice.rejected, (state, action) => {
        state.loading.removeDevice = false;
        state.errors.removeDevice = action.payload;
      });

    // ── Fetch User Security ────────────────────────────────────────────────
    builder
      .addCase(fetchUserSecurity.pending, (state) => {
        state.loading.security = true;
        state.errors.security = null;
        state.userSecurity = null;
      })
      .addCase(fetchUserSecurity.fulfilled, (state, action) => {
        state.loading.security = false;
        state.userSecurity = action.payload;
      })
      .addCase(fetchUserSecurity.rejected, (state, action) => {
        state.loading.security = false;
        state.errors.security = action.payload;
      });

    // ── Send Manual Notification ───────────────────────────────────────────
    builder
      .addCase(sendUserNotification.pending, (state) => {
        state.loading.sendNotification = true;
        state.errors.sendNotification = null;
      })
      .addCase(sendUserNotification.fulfilled, (state) => {
        state.loading.sendNotification = false;
      })
      .addCase(sendUserNotification.rejected, (state, action) => {
        state.loading.sendNotification = false;
        state.errors.sendNotification = action.payload;
      });

    // ── Adjust Coins ───────────────────────────────────────────────────────
    builder
      .addCase(adjustUserCoins.pending, (state) => {
        state.loading.adjustCoins = true;
        state.errors.adjustCoins = null;
      })
      .addCase(adjustUserCoins.fulfilled, (state, action) => {
        state.loading.adjustCoins = false;
        const { _id, newBalance } = action.payload;
        if (state.userSecurity && state.userSecurity._id === _id) {
          state.userSecurity.coins.balance = newBalance;
          state.userSecurity.coins.balanceInRupees = +(newBalance / 100).toFixed(2);
        }
        if (state.userSettings && state.userSettings._id === _id) {
          state.userSettings.referral = {
            ...state.userSettings.referral,
            coins: newBalance,
          };
        }
        if (state.selectedUser?._id === _id) {
          state.selectedUser = { ...state.selectedUser, coins: newBalance };
        }
        const idx = state.users.findIndex((u) => u._id === _id);
        if (idx !== -1) state.users[idx] = { ...state.users[idx], coins: newBalance };
      })
      .addCase(adjustUserCoins.rejected, (state, action) => {
        state.loading.adjustCoins = false;
        state.errors.adjustCoins = action.payload;
      });

    // ── Update KYC Status ──────────────────────────────────────────────────
    builder
      .addCase(updateUserKyc.pending, (state) => {
        state.loading.updateKyc = true;
        state.errors.updateKyc = null;
      })
      .addCase(updateUserKyc.fulfilled, (state, action) => {
        state.loading.updateKyc = false;
        const { userId, kycStatus, kycVerifiedAt } = action.payload;
        if (state.selectedUser?._id === userId && state.selectedUser.profile) {
          state.selectedUser.profile = {
            ...state.selectedUser.profile,
            ownerKyc: {
              ...state.selectedUser.profile.ownerKyc,
              kycStatus,
              kycVerifiedAt: kycVerifiedAt || null,
            },
          };
        }
        if (state.userSecurity?._id === userId) {
          state.userSecurity = {
            ...state.userSecurity,
            kyc: { ...state.userSecurity.kyc, kycStatus },
          };
        }
      })
      .addCase(updateUserKyc.rejected, (state, action) => {
        state.loading.updateKyc = false;
        state.errors.updateKyc = action.payload;
      });

    // ── Fetch User Notifications ───────────────────────────────────────────
    builder
      .addCase(fetchUserNotifications.pending, (state) => {
        state.loading.userNotifications = true;
        state.errors.userNotifications = null;
      })
      .addCase(fetchUserNotifications.fulfilled, (state, action) => {
        state.loading.userNotifications = false;
        state.userNotifications = {
          list: action.payload.notifications,
          unreadCount: action.payload.unreadCount,
          pagination: action.payload.pagination,
        };
      })
      .addCase(fetchUserNotifications.rejected, (state, action) => {
        state.loading.userNotifications = false;
        state.errors.userNotifications = action.payload;
      });

    // ── Clear All User Notifications ───────────────────────────────────────
    builder
      .addCase(clearUserNotifications.pending, (state) => {
        state.loading.clearNotifications = true;
        state.errors.clearNotifications = null;
      })
      .addCase(clearUserNotifications.fulfilled, (state) => {
        state.loading.clearNotifications = false;
        state.userNotifications = initialState.userNotifications;
      })
      .addCase(clearUserNotifications.rejected, (state, action) => {
        state.loading.clearNotifications = false;
        state.errors.clearNotifications = action.payload;
      });

    // ══════════════════════════════════════════════════════════════════════
    // SECTION 10: SYSTEM LOGS EXTRA REDUCERS
    // ══════════════════════════════════════════════════════════════════════

    // ── Create System Log ──────────────────────────────────────────────────
    builder
      .addCase(createSystemLog.pending, (state) => {
        state.loading.logCreate = true;
        state.errors.logCreate = null;
      })
      .addCase(createSystemLog.fulfilled, (state, action) => {
        state.loading.logCreate = false;
        // Prepend the newly created log into the list if already loaded
        state.systemLogs.list.unshift(action.payload);
        state.systemLogs.pagination.total += 1;
      })
      .addCase(createSystemLog.rejected, (state, action) => {
        state.loading.logCreate = false;
        state.errors.logCreate = action.payload;
      });

    // ── Fetch System Logs (list) ───────────────────────────────────────────
    builder
      .addCase(fetchSystemLogs.pending, (state) => {
        state.loading.logsList = true;
        state.errors.logsList = null;
      })
      .addCase(fetchSystemLogs.fulfilled, (state, action) => {
        state.loading.logsList = false;
        state.systemLogs.list = action.payload.logs;
        state.systemLogs.pagination = action.payload.pagination;
      })
      .addCase(fetchSystemLogs.rejected, (state, action) => {
        state.loading.logsList = false;
        state.errors.logsList = action.payload;
      });

    // ── Fetch System Logs Analytics ────────────────────────────────────────
    builder
      .addCase(fetchSystemLogsAnalytics.pending, (state) => {
        state.loading.logAnalytics = true;
        state.errors.logAnalytics = null;
      })
      .addCase(fetchSystemLogsAnalytics.fulfilled, (state, action) => {
        state.loading.logAnalytics = false;
        state.systemLogs.analytics = action.payload;
      })
      .addCase(fetchSystemLogsAnalytics.rejected, (state, action) => {
        state.loading.logAnalytics = false;
        state.errors.logAnalytics = action.payload;
      });

    // ── Export System Logs ─────────────────────────────────────────────────
    builder
      .addCase(exportSystemLogs.pending, (state) => {
        state.loading.logExport = true;
        state.errors.logExport = null;
        state.systemLogs.exportedData = [];
      })
      .addCase(exportSystemLogs.fulfilled, (state, action) => {
        state.loading.logExport = false;
        state.systemLogs.exportedData = action.payload;
      })
      .addCase(exportSystemLogs.rejected, (state, action) => {
        state.loading.logExport = false;
        state.errors.logExport = action.payload;
      });

    // ── Fetch Single System Log ────────────────────────────────────────────
    builder
      .addCase(fetchSystemLogById.pending, (state) => {
        state.loading.logDetail = true;
        state.errors.logDetail = null;
        state.systemLogs.selectedLog = null;
      })
      .addCase(fetchSystemLogById.fulfilled, (state, action) => {
        state.loading.logDetail = false;
        state.systemLogs.selectedLog = action.payload;
      })
      .addCase(fetchSystemLogById.rejected, (state, action) => {
        state.loading.logDetail = false;
        state.errors.logDetail = action.payload;
      });

    // ── Fetch System Logs by User ──────────────────────────────────────────
    builder
      .addCase(fetchSystemLogsByUser.pending, (state) => {
        state.loading.logsByUser = true;
        state.errors.logsByUser = null;
      })
      .addCase(fetchSystemLogsByUser.fulfilled, (state, action) => {
        state.loading.logsByUser = false;
        state.systemLogs.userLogs = {
          list: action.payload.logs,
          user: action.payload.user,
          pagination: action.payload.pagination,
        };
      })
      .addCase(fetchSystemLogsByUser.rejected, (state, action) => {
        state.loading.logsByUser = false;
        state.errors.logsByUser = action.payload;
      });

    // ── Update System Log ──────────────────────────────────────────────────
    builder
      .addCase(updateSystemLog.pending, (state) => {
        state.loading.logUpdate = true;
        state.errors.logUpdate = null;
      })
      .addCase(updateSystemLog.fulfilled, (state, action) => {
        state.loading.logUpdate = false;
        const updated = action.payload;
        // Sync into list
        const idx = state.systemLogs.list.findIndex(
          (l) => l._id === updated._id || l.logCode === updated.logCode
        );
        if (idx !== -1) {
          state.systemLogs.list[idx] = { ...state.systemLogs.list[idx], ...updated };
        }
        // Sync into selectedLog
        if (
          state.systemLogs.selectedLog?._id === updated._id ||
          state.systemLogs.selectedLog?.logCode === updated.logCode
        ) {
          state.systemLogs.selectedLog = { ...state.systemLogs.selectedLog, ...updated };
        }
      })
      .addCase(updateSystemLog.rejected, (state, action) => {
        state.loading.logUpdate = false;
        state.errors.logUpdate = action.payload;
      });

    // ── Delete Single System Log ───────────────────────────────────────────
    builder
      .addCase(deleteSystemLog.pending, (state) => {
        state.loading.logDelete = true;
        state.errors.logDelete = null;
      })
      .addCase(deleteSystemLog.fulfilled, (state, action) => {
        state.loading.logDelete = false;
        const logId = action.payload; // _id or logCode string
        state.systemLogs.list = state.systemLogs.list.filter(
          (l) => l._id !== logId && l.logCode !== logId
        );
        state.systemLogs.pagination.total = Math.max(0, state.systemLogs.pagination.total - 1);
        if (
          state.systemLogs.selectedLog?._id === logId ||
          state.systemLogs.selectedLog?.logCode === logId
        ) {
          state.systemLogs.selectedLog = null;
        }
      })
      .addCase(deleteSystemLog.rejected, (state, action) => {
        state.loading.logDelete = false;
        state.errors.logDelete = action.payload;
      });

    // ── Bulk Delete System Logs ────────────────────────────────────────────
    builder
      .addCase(bulkDeleteSystemLogs.pending, (state) => {
        state.loading.logBulkDelete = true;
        state.errors.logBulkDelete = null;
      })
      .addCase(bulkDeleteSystemLogs.fulfilled, (state) => {
        state.loading.logBulkDelete = false;
        // Clear the list and reset pagination; caller should re-fetch.
        state.systemLogs.list = [];
        state.systemLogs.pagination = initialState.systemLogs.pagination;
      })
      .addCase(bulkDeleteSystemLogs.rejected, (state, action) => {
        state.loading.logBulkDelete = false;
        state.errors.logBulkDelete = action.payload;
      });
  },
});

export const {
  setFilters,
  setPage,
  clearSelectedUser,
  clearCreateError,
  clearErrors,
  patchSelectedUser,
  // System logs
  setLogFilters,
  setLogPage,
  clearSelectedLog,
  clearLogExport,
  clearUserLogs,
} = adminUserSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// ── List & Pagination ──────────────────────────────────────────────────────────
export const selectAllUsers        = (state) => state.adminUsers.users;
export const selectUsersPagination = (state) => state.adminUsers.pagination;
export const selectUsersFilters    = (state) => state.adminUsers.filters;

// ── Single User ───────────────────────────────────────────────────────────────
export const selectSelectedUser    = (state) => state.adminUsers.selectedUser;

// ── Analytics ─────────────────────────────────────────────────────────────────
export const selectUsersAnalytics  = (state) => state.adminUsers.analytics;

// ── Reference Data ────────────────────────────────────────────────────────────
export const selectRefData                = (state) => state.adminUsers.ref;
export const selectRefHospitals           = (state) => state.adminUsers.ref.hospitals;
export const selectRefLabPartnerHospitals = (state) => state.adminUsers.ref.labPartnerHospitals;
export const selectRefPharmacyStores      = (state) => state.adminUsers.ref.pharmacyStores;
export const selectRefTransportPartners   = (state) => state.adminUsers.ref.transportPartners;

// ── Sessions ──────────────────────────────────────────────────────────────────
export const selectUserSessions    = (state) => state.adminUsers.userSessions;

// ── Settings ──────────────────────────────────────────────────────────────────
export const selectUserSettings    = (state) => state.adminUsers.userSettings;

// ── Security ──────────────────────────────────────────────────────────────────
export const selectUserSecurity    = (state) => state.adminUsers.userSecurity;

// ── Notifications ─────────────────────────────────────────────────────────────
export const selectUserNotifications           = (state) => state.adminUsers.userNotifications.list;
export const selectUserNotificationsCount      = (state) => state.adminUsers.userNotifications.unreadCount;
export const selectUserNotificationsPagination = (state) => state.adminUsers.userNotifications.pagination;

// ── System Logs ───────────────────────────────────────────────────────────────
export const selectSystemLogs              = (state) => state.adminUsers.systemLogs.list;
export const selectSystemLogsPagination    = (state) => state.adminUsers.systemLogs.pagination;
export const selectSystemLogsFilters       = (state) => state.adminUsers.systemLogs.filters;
export const selectSelectedLog             = (state) => state.adminUsers.systemLogs.selectedLog;
export const selectSystemLogsAnalytics     = (state) => state.adminUsers.systemLogs.analytics;
export const selectExportedLogs            = (state) => state.adminUsers.systemLogs.exportedData;
export const selectUserLogs                = (state) => state.adminUsers.systemLogs.userLogs.list;
export const selectUserLogsUser            = (state) => state.adminUsers.systemLogs.userLogs.user;
export const selectUserLogsPagination      = (state) => state.adminUsers.systemLogs.userLogs.pagination;

// ── Loading (bulk) ────────────────────────────────────────────────────────────
export const selectUsersLoading    = (state) => state.adminUsers.loading;
export const selectUsersErrors     = (state) => state.adminUsers.errors;

// ── Loading (granular — Users) ────────────────────────────────────────────────
export const selectListLoading              = (state) => state.adminUsers.loading.list;
export const selectDetailLoading            = (state) => state.adminUsers.loading.detail;
export const selectCreateLoading            = (state) => state.adminUsers.loading.create;
export const selectBlockLoading             = (state) => state.adminUsers.loading.block;
export const selectResetPasswordLoading     = (state) => state.adminUsers.loading.resetPassword;
export const selectVerifyEmailLoading       = (state) => state.adminUsers.loading.verifyEmail;
export const selectUpdateLoading            = (state) => state.adminUsers.loading.update;
export const selectDeleteLoading            = (state) => state.adminUsers.loading.delete;
export const selectAnalyticsLoading         = (state) => state.adminUsers.loading.analytics;

// Sessions
export const selectSessionsLoading          = (state) => state.adminUsers.loading.sessions;
export const selectRevokeSessionLoading     = (state) => state.adminUsers.loading.revokeSession;
export const selectRevokeAllSessionsLoading = (state) => state.adminUsers.loading.revokeAllSessions;

// Settings
export const selectSettingsLoading          = (state) => state.adminUsers.loading.settings;
export const selectUpdateSettingsLoading    = (state) => state.adminUsers.loading.updateSettings;
export const selectClearDevicesLoading      = (state) => state.adminUsers.loading.clearDevices;
export const selectRemoveDeviceLoading      = (state) => state.adminUsers.loading.removeDevice;

// Security
export const selectSecurityLoading          = (state) => state.adminUsers.loading.security;
export const selectSendNotificationLoading  = (state) => state.adminUsers.loading.sendNotification;
export const selectAdjustCoinsLoading       = (state) => state.adminUsers.loading.adjustCoins;
export const selectUpdateKycLoading         = (state) => state.adminUsers.loading.updateKyc;
export const selectUserNotificationsLoading = (state) => state.adminUsers.loading.userNotifications;
export const selectClearNotificationsLoading = (state) => state.adminUsers.loading.clearNotifications;

// Ref data loading
export const selectRefHospitalsLoading         = (state) => state.adminUsers.loading.refHospitals;
export const selectRefLabHospitalsLoading      = (state) => state.adminUsers.loading.refLabHospitals;
export const selectRefPharmacyStoresLoading    = (state) => state.adminUsers.loading.refPharmacyStores;
export const selectRefTransportPartnersLoading = (state) => state.adminUsers.loading.refTransportPartners;

// ── Loading (granular — System Logs) ─────────────────────────────────────────
export const selectLogsListLoading      = (state) => state.adminUsers.loading.logsList;
export const selectLogDetailLoading     = (state) => state.adminUsers.loading.logDetail;
export const selectLogCreateLoading     = (state) => state.adminUsers.loading.logCreate;
export const selectLogUpdateLoading     = (state) => state.adminUsers.loading.logUpdate;
export const selectLogDeleteLoading     = (state) => state.adminUsers.loading.logDelete;
export const selectLogBulkDeleteLoading = (state) => state.adminUsers.loading.logBulkDelete;
export const selectLogAnalyticsLoading  = (state) => state.adminUsers.loading.logAnalytics;
export const selectLogExportLoading     = (state) => state.adminUsers.loading.logExport;
export const selectLogsByUserLoading    = (state) => state.adminUsers.loading.logsByUser;

// ── Errors (granular — System Logs) ──────────────────────────────────────────
export const selectLogsListError        = (state) => state.adminUsers.errors.logsList;
export const selectLogDetailError       = (state) => state.adminUsers.errors.logDetail;
export const selectLogCreateError       = (state) => state.adminUsers.errors.logCreate;
export const selectLogUpdateError       = (state) => state.adminUsers.errors.logUpdate;
export const selectLogDeleteError       = (state) => state.adminUsers.errors.logDelete;
export const selectLogBulkDeleteError   = (state) => state.adminUsers.errors.logBulkDelete;
export const selectLogAnalyticsError    = (state) => state.adminUsers.errors.logAnalytics;
export const selectLogExportError       = (state) => state.adminUsers.errors.logExport;
export const selectLogsByUserError      = (state) => state.adminUsers.errors.logsByUser;

export default adminUserSlice.reducer;