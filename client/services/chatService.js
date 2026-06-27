import API from "@/store/api";

// ─── A. CONVERSATIONS ─────────────────────────────────────────────────────────

export const getConversations = (params = {}) =>
  API.get("/chat/conversations", { params });

export const createDirectConversation = (targetUserId) =>
  API.post("/chat/conversations/direct", { targetUserId });

export const createGroupConversation = (payload) =>
  API.post("/chat/conversations/group", payload);

export const createLinkedConversation = (payload) =>
  API.post("/chat/conversations/linked", payload);

export const getConversation = (conversationId) =>
  API.get(`/chat/conversations/${conversationId}`);

export const updateGroupConversation = (conversationId, payload) =>
  API.patch(`/chat/conversations/${conversationId}`, payload);

export const addGroupMembers = (conversationId, memberIds) =>
  API.post(`/chat/conversations/${conversationId}/members`, { memberIds });

export const removeGroupMember = (conversationId, memberId) =>
  API.delete(`/chat/conversations/${conversationId}/members/${memberId}`);

export const updateMemberAdminStatus = (conversationId, memberId, isAdmin) =>
  API.patch(`/chat/conversations/${conversationId}/members/${memberId}/admin`, { isAdmin });

export const blockConversation = (conversationId) =>
  API.post(`/chat/conversations/${conversationId}/block`);

export const archiveConversation = (conversationId, archive = true) =>
  API.patch(`/chat/conversations/${conversationId}/archive`, { archive });

export const muteConversation = (conversationId, mute = true, mutedUntil = null) =>
  API.patch(`/chat/conversations/${conversationId}/mute`, { mute, mutedUntil });

export const getConversationMedia = (conversationId, params = {}) =>
  API.get(`/chat/conversations/${conversationId}/media`, { params });

export const clearConversation = (conversationId) =>
  API.delete(`/chat/conversations/${conversationId}/clear`);

// ─── B. MESSAGES ──────────────────────────────────────────────────────────────

export const getMessages = (conversationId, params = {}) =>
  API.get(`/chat/conversations/${conversationId}/messages`, { params });

export const sendMessage = (conversationId, payload) =>
  API.post(`/chat/conversations/${conversationId}/messages`, payload);

export const sendMediaMessage = (conversationId, file, duration = null) => {
  const form = new FormData();
  form.append("file", file);
  if (duration) form.append("duration", duration);
  return API.post(`/chat/conversations/${conversationId}/messages/media`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const markMessagesRead = (conversationId) =>
  API.post(`/chat/conversations/${conversationId}/messages/read`);

export const markMessagesDelivered = (conversationId) =>
  API.post(`/chat/conversations/${conversationId}/messages/delivered`);

export const getPinnedMessages = (conversationId) =>
  API.get(`/chat/conversations/${conversationId}/messages/pinned`);

export const searchMessages = (conversationId, q, limit = 30) =>
  API.get(`/chat/conversations/${conversationId}/messages/search`, {
    params: { q, limit },
  });

export const editMessage = (messageId, text) =>
  API.patch(`/chat/messages/${messageId}`, { text });

export const deleteMessage = (messageId, scope = "for_me") =>
  API.delete(`/chat/messages/${messageId}`, { data: { scope } });

export const adminDeleteMessage = (messageId) =>
  API.delete(`/chat/messages/${messageId}/admin`);

export const reactToMessage = (messageId, emoji) =>
  API.post(`/chat/messages/${messageId}/react`, { emoji });

export const pinMessage = (messageId, pin = true) =>
  API.patch(`/chat/messages/${messageId}/pin`, { pin });

export const forwardMessage = (messageId, targetConversationId) =>
  API.post(`/chat/messages/${messageId}/forward`, { targetConversationId });

// ─── C. UNREAD ────────────────────────────────────────────────────────────────

export const getUnreadCount = () => API.get("/chat/unread");

// ─── D. BLOCK / UNBLOCK ───────────────────────────────────────────────────────

export const getBlockedUsers = () => API.get("/chat/blocked-users");

export const blockUser = (targetUserId) =>
  API.post("/chat/blocked-users", { targetUserId });

export const unblockUser = (targetUserId) =>
  API.delete(`/chat/blocked-users/${targetUserId}`);

// ─── E. CALLS ─────────────────────────────────────────────────────────────────

export const getRtmToken = () => API.get("/chat/agora/rtm-token");

export const initiateCall = (conversationId, type = "audio") =>
  API.post("/chat/calls", { conversationId, type });

export const joinCall = (callId) =>
  API.post(`/chat/calls/${callId}/join`);

export const endCall = (callId, status = "ended") =>
  API.post(`/chat/calls/${callId}/end`, { status });

export const refreshCallToken = (callId) =>
  API.post(`/chat/calls/${callId}/token/refresh`);

export const getCall = (callId) => API.get(`/chat/calls/${callId}`);

export const getCallHistory = (params = {}) =>
  API.get("/chat/calls", { params });

// ─── F. PRESENCE ──────────────────────────────────────────────────────────────

export const getUserPresence = (userId) =>
  API.get(`/chat/presence/${userId}`);

export const getBulkPresence = (userIds) =>
  API.post("/chat/presence/bulk", { userIds });

// ─── G. ROLE-LINKED CONVERSATIONS ────────────────────────────────────────────

export const getOrderConversation = (orderId) =>
  API.get(`/chat/order/${orderId}/conversation`);

export const getBookingConversation = (bookingId) =>
  API.get(`/chat/booking/${bookingId}/conversation`);

export const getBloodRequestConversation = (requestId) =>
  API.get(`/chat/blood-request/${requestId}/conversation`);

export const getLabTestConversation = (testId) =>
  API.get(`/chat/lab-test/${testId}/conversation`);

export const getFinanceOrderConversation = (orderId) =>
  API.get(`/chat/finance/order/${orderId}/conversation`);

// ─── H. ADMIN ────────────────────────────────────────────────────────────────

export const adminGetConversations = (params = {}) =>
  API.get("/chat/admin/conversations", { params });

export const adminGetMessages = (conversationId, params = {}) =>
  API.get(`/chat/admin/conversations/${conversationId}/messages`, { params });

export const adminGetCalls = (params = {}) =>
  API.get("/chat/admin/calls", { params });

export default {
  getConversations, createDirectConversation, createGroupConversation, createLinkedConversation,
  getConversation, updateGroupConversation, addGroupMembers, removeGroupMember,
  updateMemberAdminStatus, blockConversation, archiveConversation, muteConversation,
  getConversationMedia, clearConversation, getMessages, sendMessage, sendMediaMessage,
  markMessagesRead, markMessagesDelivered, getPinnedMessages, searchMessages, editMessage,
  deleteMessage, adminDeleteMessage, reactToMessage, pinMessage, forwardMessage, getUnreadCount,
  getBlockedUsers, blockUser, unblockUser, getRtmToken, initiateCall, joinCall, endCall,
  refreshCallToken, getCall, getCallHistory, getUserPresence, getBulkPresence,
  getOrderConversation, getBookingConversation, getBloodRequestConversation,
  getLabTestConversation, getFinanceOrderConversation, adminGetConversations,
  adminGetMessages, adminGetCalls,
};