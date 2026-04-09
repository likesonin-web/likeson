 

import axios from 'axios';

// ─── Config ───────────────────────────────────────────────────────────────────

const ONESIGNAL_API_URL = 'https://api.onesignal.com';
const APP_ID            = process.env.ONESIGNAL_APP_ID;
const REST_API_KEY      = process.env.ONESIGNAL_REST_API_KEY;

// Fail fast at startup — never silently send nothing
if (!APP_ID || !REST_API_KEY) {
  throw new Error(
    '[pushService] Missing env vars. ' +
    'Ensure ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY are set.'
  );
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const oneSignalClient = axios.create({
  baseURL: ONESIGNAL_API_URL,
  timeout: 10_000,
  headers: {
    'Content-Type':  'application/json',
    'Authorization': `Basic ${REST_API_KEY}`,  // ← FIXED: was `Key ${REST_API_KEY}`
  },
});

// ─── Retry with exponential back-off ─────────────────────────────────────────

const MAX_RETRIES   = 3;
const BASE_DELAY_MS = 500; // 500ms → 1s → 2s

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retryable: network errors and 429 / 5xx.
 * NOT retryable: 400 (bad payload) or 401/403 (wrong key — don't hammer).
 */
const isRetryable = (err) => {
  if (!err.response) return true;
  const { status } = err.response;
  return status === 429 || (status >= 500 && status < 600);
};

const postWithRetry = async (path, body) => {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await oneSignalClient.post(path, body);
      return data;
    } catch (err) {
      lastError = err;

      const shouldRetry = isRetryable(err) && attempt < MAX_RETRIES;
      if (!shouldRetry) break;

      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(
        `[pushService] Attempt ${attempt + 1} failed — retrying in ${delay}ms.`,
        { path, status: err.response?.status, message: err.message }
      );
      await sleep(delay);
    }
  }

  const serverMessage =
    lastError?.response?.data?.errors?.[0] ??
    lastError?.response?.data?.error   ??
    lastError?.message;

  const error = new Error(`[pushService] OneSignal request failed: ${serverMessage}`);
  error.status       = lastError?.response?.status;
  error.oneSignalRaw = lastError?.response?.data;
  throw error;
};

// ─── Payload builder ──────────────────────────────────────────────────────────

const buildPayload = (templatePayload, targeting) => ({
  app_id:         APP_ID,
  target_channel: 'push',
  ...templatePayload,
  ...targeting,
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send to a single user by their OneSignal external_id alias.
 * The external_id must match what was set on the client via the OneSignal SDK
 * (typically your MongoDB _id.toString()).
 *
 * @param {string} externalUserId
 * @param {object} templatePayload  — output of a pushTemplates function
 * @returns {Promise<{ notificationId: string, recipients: number }>}
 */
const sendToUser = async (externalUserId, templatePayload) => {
  if (!externalUserId) throw new Error('[pushService] externalUserId is required');

  const payload = buildPayload(templatePayload, {
    include_aliases: { external_id: [String(externalUserId)] },
  });

  const data = await postWithRetry('/notifications', payload);

  console.info('[pushService] Sent to user', {
    externalUserId,
    notificationId: data.id,
    recipients:     data.recipients,
  });

  return { notificationId: data.id, recipients: data.recipients ?? 0 };
};

/**
 * Send to multiple users by external_id.
 * OneSignal hard limit: 2,000 aliases per request.
 *
 * @param {string[]} externalUserIds
 * @param {object}   templatePayload
 * @returns {Promise<{ notificationId: string, recipients: number }>}
 */
const sendToUsers = async (externalUserIds, templatePayload) => {
  if (!Array.isArray(externalUserIds) || externalUserIds.length === 0) {
    throw new Error('[pushService] externalUserIds must be a non-empty array');
  }
  if (externalUserIds.length > 2_000) {
    throw new Error('[pushService] Max 2,000 users per batch. Use sendToSegment for larger audiences.');
  }

  const payload = buildPayload(templatePayload, {
    include_aliases: { external_id: externalUserIds.map(String) },
  });

  const data = await postWithRetry('/notifications', payload);

  console.info('[pushService] Batch sent', {
    count:          externalUserIds.length,
    notificationId: data.id,
    recipients:     data.recipients,
  });

  return { notificationId: data.id, recipients: data.recipients ?? 0 };
};

/**
 * Send to a named OneSignal segment.
 * Built-in segments: 'All', 'Active Users', 'Inactive Users'.
 *
 * @param {string|string[]} segments
 * @param {object}          templatePayload
 * @param {string[]}        [excludeSegments]
 * @returns {Promise<{ notificationId: string, recipients: number }>}
 */
const sendToSegment = async (segments, templatePayload, excludeSegments = []) => {
  const segmentList = Array.isArray(segments) ? segments : [segments];

  const payload = buildPayload(templatePayload, {
    included_segments: segmentList,
    ...(excludeSegments.length > 0 && { excluded_segments: excludeSegments }),
  });

  const data = await postWithRetry('/notifications', payload);

  console.info('[pushService] Segment push sent', {
    segments:       segmentList,
    notificationId: data.id,
    recipients:     data.recipients,
  });

  return { notificationId: data.id, recipients: data.recipients ?? 0 };
};

/**
 * Broadcast to all subscribed users.
 *
 * @param {object} templatePayload
 * @returns {Promise<{ notificationId: string, recipients: number }>}
 */
const sendToAll = async (templatePayload) => sendToSegment('All', templatePayload);

/**
 * Schedule a notification for future delivery.
 *
 * @param {string} externalUserId
 * @param {object} templatePayload
 * @param {Date}   sendAt  — UTC Date object
 * @returns {Promise<{ notificationId: string }>}
 */
const sendScheduled = async (externalUserId, templatePayload, sendAt) => {
  if (!(sendAt instanceof Date) || isNaN(sendAt.getTime())) {
    throw new Error('[pushService] sendAt must be a valid Date object');
  }

  const payload = buildPayload(templatePayload, {
    include_aliases: { external_id: [String(externalUserId)] },
    send_after: sendAt.toISOString(),
  });

  const data = await postWithRetry('/notifications', payload);

  console.info('[pushService] Scheduled notification queued', {
    externalUserId,
    notificationId: data.id,
    sendAt:         sendAt.toISOString(),
  });

  return { notificationId: data.id };
};

/**
 * Cancel a scheduled notification before delivery.
 * No-op with warning if already delivered or not found (404).
 *
 * @param {string} notificationId
 */
const cancelNotification = async (notificationId) => {
  if (!notificationId) throw new Error('[pushService] notificationId is required');

  try {
    await oneSignalClient.delete(`/notifications/${notificationId}?app_id=${APP_ID}`);
    console.info('[pushService] Notification cancelled', { notificationId });
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn('[pushService] Notification not found (already delivered?)', { notificationId });
      return;
    }
    throw new Error(
      `[pushService] Cancel failed: ${err.response?.data?.errors?.[0] ?? err.message}`
    );
  }
};

/**
 * Fetch delivery statistics for a sent notification.
 *
 * @param {string} notificationId
 * @returns {Promise<{ sent, delivered, failed, opened, raw }>}
 */
const getNotificationStats = async (notificationId) => {
  if (!notificationId) throw new Error('[pushService] notificationId is required');

  try {
    const { data: d } = await oneSignalClient.get(
      `/notifications/${notificationId}?app_id=${APP_ID}`
    );
    return {
      notificationId: d.id,
      sent:      d.completed_at ? d.successful : 0,
      delivered: d.confirmed_at ? d.received   : 0,
      failed:    d.failed       ?? 0,
      opened:    d.converted    ?? 0,
      raw:       d,
    };
  } catch (err) {
    throw new Error(
      `[pushService] Stats fetch failed: ${err.response?.data?.errors?.[0] ?? err.message}`
    );
  }
};

// ─── Export ───────────────────────────────────────────────────────────────────

export default {
  sendToUser,
  sendToUsers,
  sendToSegment,
  sendToAll,
  sendScheduled,
  cancelNotification,
  getNotificationStats,
};