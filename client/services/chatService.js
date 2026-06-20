/**
 * services/chatService.js
 * Thin API wrapper — mirrors chatRoutes.js exactly.
 * All calls go through your axios instance (API) which has
 * baseURL + auth interceptor already set up.
 *
 * Usage:
 *   import chatService from '@/services/chatService';
 *   const { data } = await chatService.getConversations();
 */

import API from "@/store/api";

// ─── A. CONVERSATIONS ─────────────────────────────────────────────────────────

/** GET /api/chat/conversations */
export const getConversations = (params = {}) =>
  API.get("/chat/conversations", { params });

/** POST /api/chat/conversations/direct */
export const createDirectConversation = (targetUserId) =>
  API.post("/chat/conversations/direct", { targetUserId });

/** POST /api/chat/conversations/group */
export const createGroupConversation = (payload) =>
  API.post("/chat/conversations/group", payload);
// payload: { name, description?, memberIds[] }

/** POST /api/chat/conversations/linked  (staff only) */
export const createLinkedConversation = (payload) =>
  API.post("/chat/conversations/linked", payload);
// payload: { type, refModel, refId, participantIds[], name? }

/** GET /api/chat/conversations/:id */
export const getConversation = (conversationId) =>
  API.get(`/chat/conversations/${conversationId}`);

/** PATCH /api/chat/conversations/:id */
export const updateGroupConversation = (conversationId, payload) =>
  API.patch(`/chat/conversations/${conversationId}`, payload);
// payload: { name?, description?, avatar? }

/** POST /api/chat/conversations/:id/members */
export const addGroupMembers = (conversationId, memberIds) =>
  API.post(`/chat/conversations/${conversationId}/members`, { memberIds });

/** DELETE /api/chat/conversations/:id/members/:memberId */
export const removeGroupMember = (conversationId, memberId) =>
  API.delete(`/chat/conversations/${conversationId}/members/${memberId}`);

/** PATCH /api/chat/conversations/:id/members/:memberId/admin */
export const updateMemberAdminStatus = (conversationId, memberId, isAdmin) =>
  API.patch(`/chat/conversations/${conversationId}/members/${memberId}/admin`, { isAdmin });

/** POST /api/chat/conversations/:id/block */
export const blockConversation = (conversationId) =>
  API.post(`/chat/conversations/${conversationId}/block`);

/** PATCH /api/chat/conversations/:id/archive */
export const archiveConversation = (conversationId, archive = true) =>
  API.patch(`/chat/conversations/${conversationId}/archive`, { archive });

/** PATCH /api/chat/conversations/:id/mute */
export const muteConversation = (conversationId, mute = true, mutedUntil = null) =>
  API.patch(`/chat/conversations/${conversationId}/mute`, { mute, mutedUntil });

/** GET /api/chat/conversations/:id/media */
export const getConversationMedia = (conversationId, params = {}) =>
  API.get(`/chat/conversations/${conversationId}/media`, { params });
// params: { page, limit, type }

/** DELETE /api/chat/conversations/:id/clear */
export const clearConversation = (conversationId) =>
  API.delete(`/chat/conversations/${conversationId}/clear`);

// ─── B. MESSAGES ──────────────────────────────────────────────────────────────

/** GET /api/chat/conversations/:id/messages */
export const getMessages = (conversationId, params = {}) =>
  API.get(`/chat/conversations/${conversationId}/messages`, { params });
// params: { limit, before }

/** POST /api/chat/conversations/:id/messages */
export const sendMessage = (conversationId, payload) =>
  API.post(`/chat/conversations/${conversationId}/messages`, payload);
// payload: { type, text?, location?, cardPayload?, replyTo? }

/**
 * POST /api/chat/conversations/:id/messages/media
 * Upload binary — uses FormData.
 */
export const sendMediaMessage = (conversationId, file, duration = null) => {
  const form = new FormData();
  form.append("file", file);
  if (duration) form.append("duration", duration);
  return API.post(`/chat/conversations/${conversationId}/messages/media`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

/** POST /api/chat/conversations/:id/messages/read */
export const markMessagesRead = (conversationId) =>
  API.post(`/chat/conversations/${conversationId}/messages/read`);

/** POST /api/chat/conversations/:id/messages/delivered */
export const markMessagesDelivered = (conversationId) =>
  API.post(`/chat/conversations/${conversationId}/messages/delivered`);

/** GET /api/chat/conversations/:id/messages/pinned */
export const getPinnedMessages = (conversationId) =>
  API.get(`/chat/conversations/${conversationId}/messages/pinned`);

/** GET /api/chat/conversations/:id/messages/search */
export const searchMessages = (conversationId, q, limit = 30) =>
  API.get(`/chat/conversations/${conversationId}/messages/search`, {
    params: { q, limit },
  });

/** PATCH /api/chat/messages/:id */
export const editMessage = (messageId, text) =>
  API.patch(`/chat/messages/${messageId}`, { text });

/** DELETE /api/chat/messages/:id */
export const deleteMessage = (messageId, scope = "for_me") =>
  API.delete(`/chat/messages/${messageId}`, { data: { scope } });

/** DELETE /api/chat/messages/:id/admin  (admin only) */
export const adminDeleteMessage = (messageId) =>
  API.delete(`/chat/messages/${messageId}/admin`);

/** POST /api/chat/messages/:id/react */
export const reactToMessage = (messageId, emoji) =>
  API.post(`/chat/messages/${messageId}/react`, { emoji });

/** PATCH /api/chat/messages/:id/pin */
export const pinMessage = (messageId, pin = true) =>
  API.patch(`/chat/messages/${messageId}/pin`, { pin });

/** POST /api/chat/messages/:id/forward */
export const forwardMessage = (messageId, targetConversationId) =>
  API.post(`/chat/messages/${messageId}/forward`, { targetConversationId });

// ─── C. UNREAD ────────────────────────────────────────────────────────────────

/** GET /api/chat/unread */
export const getUnreadCount = () => API.get("/chat/unread");

// ─── D. BLOCK / UNBLOCK ───────────────────────────────────────────────────────

/** GET /api/chat/blocked-users */
export const getBlockedUsers = () => API.get("/chat/blocked-users");

/** POST /api/chat/blocked-users */
export const blockUser = (targetUserId) =>
  API.post("/chat/blocked-users", { targetUserId });

/** DELETE /api/chat/blocked-users/:id */
export const unblockUser = (targetUserId) =>
  API.delete(`/chat/blocked-users/${targetUserId}`);

// ─── E. CALLS (REST fallback) ─────────────────────────────────────────────────

/** GET /api/chat/agora/rtm-token */
export const getRtmToken = () => API.get("/chat/agora/rtm-token");

/** POST /api/chat/calls */
export const initiateCall = (conversationId, type = "audio") =>
  API.post("/chat/calls", { conversationId, type });

/** POST /api/chat/calls/:id/join */
export const joinCall = (callId) =>
  API.post(`/chat/calls/${callId}/join`);

/** POST /api/chat/calls/:id/end */
export const endCall = (callId, status = "ended") =>
  API.post(`/chat/calls/${callId}/end`, { status });

/** POST /api/chat/calls/:id/token/refresh */
export const refreshCallToken = (callId) =>
  API.post(`/chat/calls/${callId}/token/refresh`);

/** GET /api/chat/calls/:id */
export const getCall = (callId) => API.get(`/chat/calls/${callId}`);

/** GET /api/chat/calls */
export const getCallHistory = (params = {}) =>
  API.get("/chat/calls", { params });
// params: { limit, page, status }

// ─── F. PRESENCE ──────────────────────────────────────────────────────────────

/** GET /api/chat/presence/:userId */
export const getUserPresence = (userId) =>
  API.get(`/chat/presence/${userId}`);

/** POST /api/chat/presence/bulk */
export const getBulkPresence = (userIds) =>
  API.post("/chat/presence/bulk", { userIds });

// ─── G. ROLE-LINKED CONVERSATIONS ────────────────────────────────────────────

/** GET /api/chat/order/:orderId/conversation */
export const getOrderConversation = (orderId) =>
  API.get(`/chat/order/${orderId}/conversation`);

/** GET /api/chat/booking/:bookingId/conversation */
export const getBookingConversation = (bookingId) =>
  API.get(`/chat/booking/${bookingId}/conversation`);

/** GET /api/chat/blood-request/:requestId/conversation */
export const getBloodRequestConversation = (requestId) =>
  API.get(`/chat/blood-request/${requestId}/conversation`);

/** GET /api/chat/lab-test/:testId/conversation */
export const getLabTestConversation = (testId) =>
  API.get(`/chat/lab-test/${testId}/conversation`);

/** GET /api/chat/finance/order/:orderId/conversation  (finance only) */
export const getFinanceOrderConversation = (orderId) =>
  API.get(`/chat/finance/order/${orderId}/conversation`);

// ─── H. ADMIN ────────────────────────────────────────────────────────────────

/** GET /api/chat/admin/conversations */
export const adminGetConversations = (params = {}) =>
  API.get("/chat/admin/conversations", { params });

/** GET /api/chat/admin/conversations/:id/messages */
export const adminGetMessages = (conversationId, params = {}) =>
  API.get(`/chat/admin/conversations/${conversationId}/messages`, { params });

/** GET /api/chat/admin/calls */
export const adminGetCalls = (params = {}) =>
  API.get("/chat/admin/calls", { params });

// ─── Default export (optional convenience) ───────────────────────────────────

export default {
  // conversations
  getConversations,
  createDirectConversation,
  createGroupConversation,
  createLinkedConversation,
  getConversation,
  updateGroupConversation,
  addGroupMembers,
  removeGroupMember,
  updateMemberAdminStatus,
  blockConversation,
  archiveConversation,
  muteConversation,
  getConversationMedia,
  clearConversation,
  // messages
  getMessages,
  sendMessage,
  sendMediaMessage,
  markMessagesRead,
  markMessagesDelivered,
  getPinnedMessages,
  searchMessages,
  editMessage,
  deleteMessage,
  adminDeleteMessage,
  reactToMessage,
  pinMessage,
  forwardMessage,
  // unread
  getUnreadCount,
  // block
  getBlockedUsers,
  blockUser,
  unblockUser,
  // calls
  getRtmToken,
  initiateCall,
  joinCall,
  endCall,
  refreshCallToken,
  getCall,
  getCallHistory,
  // presence
  getUserPresence,
  getBulkPresence,
  // role-linked
  getOrderConversation,
  getBookingConversation,
  getBloodRequestConversation,
  getLabTestConversation,
  getFinanceOrderConversation,
  // admin
  adminGetConversations,
  adminGetMessages,
  adminGetCalls,
};